import React, { useMemo, useState } from "react";
import {
  Building2,
  Eye,
  Globe2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { statusPillClass, statusToneClass } from "../../../lib/status-pill";
import { TablePageSkeleton } from "../../../components/ui/Skeleton";

// TODO(next): these status changes are intentionally public for now, matching
// the other lead endpoints. Before production exposure, route the PATCH through
// the Master Panel server (or add verifyAdminApiKey on the Nomads route) and
// append { from, to, changedBy, changedAt } to an audit history array.

const STATUSES = ["Pending", "In Review", "Resolved", "Rejected"];
// Legacy rows were saved before `status` existed — treat them as Pending.
const getStatus = (value) => (STATUSES.includes(value) ? value : "Pending");

const getInitials = (value) =>
  String(value || "Company")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
};

const parseUrls = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[\n,;]+/)
    .map((url) => url.trim())
    .filter(Boolean);
};

const toHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const ContentRemovalTable = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { data: requests = [], isPending, isError } = useQuery({
    queryKey: ["contentRemovalRequests"],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_API_BASE_URL}/forms/content-removal`,
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  // Simple public status update — see TODO comment at top of file.
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await axios.patch(
        `${NOMADS_API_BASE_URL}/forms/content-removal/${id}/status`,
        { status },
      );
      return response.data?.data;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["contentRemovalRequests"] });
      const previous = queryClient.getQueryData(["contentRemovalRequests"]);
      queryClient.setQueryData(["contentRemovalRequests"], (old = []) =>
        old.map((row) => (row._id === id ? { ...row, status } : row)),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["contentRemovalRequests"], context.previous);
      }
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["contentRemovalRequests"] });
    },
  });

  const changeStatus = (row, status) => {
    if (getStatus(row.status) === status) return;
    statusMutation.mutate({ id: row._id, status });
    if (selectedRequest?._id === row._id) {
      setSelectedRequest((current) => ({ ...current, status }));
    }
  };

  const filtered = useMemo(() => {
    let result = requests;
    if (statusFilter !== "All") {
      result = result.filter((row) => getStatus(row.status) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        [
          row.fullName,
          row.companyName,
          row.designation,
          row.email,
          row.mobile,
          row.urls,
          row.source,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    return result;
  }, [requests, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      nomad: requests.filter((row) => row.source === "nomad").length,
      host: requests.filter((row) => row.source === "host").length,
    }),
    [requests],
  );

  if (isPending) return <TablePageSkeleton />;
  if (isError)
    return <p className="p-4 text-red-600">Unable to load removal requests.</p>;

  const statCards = [
    {
      label: "Total Requests",
      value: stats.total,
      icon: ShieldCheck,
      accent: "border-l-slate-400",
      textColor: "text-slate-500",
      bgColor: "bg-slate-50",
    },
    {
      label: "Nomad",
      value: stats.nomad,
      icon: Globe2,
      accent: "border-l-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    // {
    //   label: "Host",
    //   value: stats.host,
    //   icon: Building2,
    //   accent: "border-l-amber-500",
    //   textColor: "text-amber-600",
    //   bgColor: "bg-amber-50",
    // },
    {
      label: "Showing",
      value: filtered.length,
      icon: Search,
      accent: "border-l-emerald-500",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div
        data-tour="content-removal-quick-stats"
        className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0"
      >
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}
            >
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${s.textColor}`}
                >
                  {s.label}
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">
                  {s.value}
                </p>
              </div>
              <div
                className={`p-2 rounded-2xl ${s.bgColor} ${s.textColor} shrink-0`}
              >
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div
            data-tour="content-removal-status-filter"
            className="flex gap-1.5 overflow-x-auto"
          >
            {["All", ...STATUSES].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${
                  statusFilter === status
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div
            data-tour="content-removal-search"
            className="relative w-full xl:w-[320px]"
          >
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email, phone..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div data-tour="content-removal-table">
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <ShieldCheck size={28} />
              </div>
              <p className="text-slate-400 font-semibold font-pmedium">
                No removal requests yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-5 py-4">Organization</th>
                    <th className="px-5 py-4">Contact Person</th>
                    <th className="px-5 py-4">Contact Info</th>
                    <th className="px-5 py-4">URLs Requested</th>
                    {/* <th className="px-5 py-4">Source</th> */}
                    <th className="px-5 py-4">Submitted</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {filtered.map((row, ri) => {
                    const urls = parseUrls(row.urls);
                    return (
                      <tr
                        key={row._id || ri}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                              {getInitials(row.companyName)}
                            </div>
                            <span
                              className="text-[12px] font-pmedium text-slate-900"
                              title={row.companyName}
                            >
                              {row.companyName || "--"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[12px] font-pmedium text-slate-900">
                            {row.fullName || "--"}
                          </p>
                          <p className="text-[10px] font-pmedium text-slate-500">
                            {row.designation || "--"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[11px] font-pmedium text-slate-600 break-all">
                            {row.email || "--"}
                          </p>
                          <p className="text-[10px] font-pmedium text-slate-500">
                            {row.mobile || "--"}
                          </p>
                        </td>
                        <td className="px-5 py-4 max-w-[240px]">
                          {urls.length ? (
                            <div className="flex flex-col gap-1">
                              <a
                                href={toHref(urls[0])}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-pmedium text-blue-600 hover:text-blue-800 underline truncate"
                                title={urls[0]}
                              >
                                {urls[0]}
                              </a>
                              {urls.length > 1 && (
                                <span className="text-[10px] font-pmedium text-slate-400">
                                  +{urls.length - 1} more URL
                                  {urls.length > 2 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-pmedium text-slate-400">
                              --
                            </span>
                          )}
                        </td>
                        {/* <td className="px-5 py-4">
                          <span className={statusPillClass(row.source || "--")}>
                            {row.source || "--"}
                          </span>
                        </td> */}
                        
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">
                          {formatDate(row.submittedAt || row.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={getStatus(row.status)}
                            onChange={(event) =>
                              changeStatus(row, event.target.value)
                            }
                            disabled={statusMutation.isPending}
                            aria-label={`Change status for ${row.companyName || "request"}`}
                            className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${statusToneClass(getStatus(row.status))}`}
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setSelectedRequest(row)}
                              title="View details"
                              aria-label={`View details for ${row.companyName || "request"}`}
                              data-tour={
                                ri === 0
                                  ? "content-removal-action-view"
                                  : undefined
                              }
                              className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/40 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-pmedium text-white">
                  {getInitials(selectedRequest.companyName)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-pmedium text-slate-900">
                    {selectedRequest.companyName || "Unnamed organization"}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={statusPillClass(selectedRequest.source || "--")}
                    >
                      {selectedRequest.source || "--"}
                    </span>
                    <span
                      className={statusPillClass(
                        getStatus(selectedRequest.status),
                      )}
                    >
                      {getStatus(selectedRequest.status)}
                    </span>
                    <span className="text-[11px] font-pmedium text-slate-500">
                      {formatDate(
                        selectedRequest.submittedAt || selectedRequest.createdAt,
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close removal request details"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    Contact Person
                  </p>
                  <p className="text-[12px] font-pmedium text-slate-800">
                    {selectedRequest.fullName || "--"}
                  </p>
                  <p className="mt-1 text-[11px] font-pmedium text-slate-500">
                    {selectedRequest.designation || "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    Follow-up Details
                  </p>
                  <p className="flex items-center gap-2 break-all text-[12px] font-pmedium text-slate-800">
                    <Mail size={13} className="shrink-0 text-slate-400" />
                    {selectedRequest.email || "Not shared"}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[12px] font-pmedium text-slate-800">
                    <Phone size={13} className="shrink-0 text-slate-400" />
                    {selectedRequest.mobile || "Not shared"}
                  </p>
                  {/* <p className="mt-2 text-[10px] font-pmedium text-slate-400">
                    Sheet: {selectedRequest.sheetName || "--"}
                  </p> */}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  URLs Requested for Removal
                </p>
                {parseUrls(selectedRequest.urls).length ? (
                  <ul className="space-y-2">
                    {parseUrls(selectedRequest.urls).map((url, index) => (
                      <li
                        key={`${url}-${index}`}
                        className="flex items-start gap-2 text-[11px] font-pmedium text-slate-700"
                      >
                        <Globe2
                          size={13}
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <a
                          href={toHref(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-blue-600 hover:text-blue-800 underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] font-pmedium text-slate-400">
                    No URLs submitted.
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-[12px] font-pmedium text-white transition hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentRemovalTable;
