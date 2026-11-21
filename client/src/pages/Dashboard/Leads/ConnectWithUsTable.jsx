import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { statusPillClass, statusToneClass } from "../../../lib/status-pill";
import { TablePageSkeleton } from "../../../components/ui/Skeleton";
import DataTable from "../../../components/Tables/DataTable";

// TODO(next): these status changes are intentionally public for now, matching
// the other lead endpoints. Before production exposure, route the PATCH through
// the Master Panel server (or add verifyAdminApiKey on the Nomads route) and
// append { from, to, changedBy, changedAt } to an audit history array.

const STATUSES = ["Pending", "Contacted", "Closed"];
const getStatus = (value) => (STATUSES.includes(value) ? value : "Pending");

const getInitials = (value) =>
  String(value || "Lead")
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

const columns = [
  { field: "name", headerName: "Name" },
  { field: "email", headerName: "Email" },
  { field: "mobile", headerName: "Mobile" },
  { field: "typeOfPartnerShip", headerName: "Partnership Type" },
  // { field: "message", headerName: "Message" },
  { field: "submittedAt", headerName: "Submitted" },
];

const ConnectWithUsTable = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLead, setSelectedLead] = useState(null);

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: ["connectWithUsLeads"],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_API_BASE_URL}/forms/connect-with-us`,
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  // Simple public status update — see TODO comment at top of file.
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await axios.patch(
        `${NOMADS_API_BASE_URL}/forms/connect-with-us/${id}/status`,
        { status },
      );
      return response.data?.data;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["connectWithUsLeads"] });
      const previous = queryClient.getQueryData(["connectWithUsLeads"]);
      queryClient.setQueryData(["connectWithUsLeads"], (old = []) =>
        old.map((row) => (row._id === id ? { ...row, status } : row)),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["connectWithUsLeads"], context.previous);
      }
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["connectWithUsLeads"] });
    },
  });

  const changeStatus = (row, status) => {
    if (getStatus(row.status) === status) return;
    statusMutation.mutate({ id: row._id, status });
    if (selectedLead?._id === row._id) {
      setSelectedLead((current) => ({ ...current, status }));
    }
  };

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "All") {
      result = result.filter((row) => getStatus(row.status) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) =>
          String(row[col.field] ?? "").toLowerCase().includes(q),
        ),
      );
    }
    return result;
  }, [leads, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      pending: leads.filter((lead) => getStatus(lead.status) === "Pending")
        .length,
      contacted: leads.filter((lead) => lead.status === "Contacted").length,
      closed: leads.filter((lead) => lead.status === "Closed").length,
    }),
    [leads],
  );

  if (isPending) return <TablePageSkeleton />;
  if (isError)
    return <p className="p-4 text-red-600">Unable to load enquiries.</p>;

  const statCards = [
    {
      label: "Total Enquiries",
      value: stats.total,
      icon: Users,
      accent: "border-l-slate-400",
      textColor: "text-slate-500",
      bgColor: "bg-slate-50",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: Sparkles,
      accent: "border-l-amber-500",
      textColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Contacted",
      value: stats.contacted,
      icon: MessageSquare,
      accent: "border-l-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Closed",
      value: stats.closed,
      icon: CheckCircle2,
      accent: "border-l-emerald-500",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div
        data-tour="connect-quick-stats"
        className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0"
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

      <DataTable
        rows={filtered}
        rowKey={(row, index) => row._id || index}
        minWidth={1000}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, mobile, partnership..."
        searchWrapperProps={{ "data-tour": "connect-search" }}
        filters={
          <div
            data-tour="connect-status-filter"
            className="flex items-center justify-end gap-2"
          >
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className={`rounded-lg border bg-white px-2.5 py-2 text-[11px] font-pmedium outline-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 ${
                statusFilter === "All"
                  ? "border-slate-200/60 text-slate-600"
                  : "border-[#2563EB]/40 text-[#2563EB]"
              }`}
            >
              <option value="All">All status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        }
        emptyText="No enquiries yet."
        emptyIcon={MessageSquare}
        tableProps={{ "data-tour": "connect-table" }}
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                  {getInitials(row.name)}
                </div>
                <span className="text-[12px] font-pmedium text-slate-900">
                  {row.name || "--"}
                </span>
              </div>
            ),
          },
          {
            key: "email",
            header: "Email",
            render: (row) => (
              <span
                className="block max-w-[200px] truncate text-[11px] text-slate-600"
                title={row.email}
              >
                {row.email || "--"}
              </span>
            ),
          },
          {
            key: "mobile",
            header: "Mobile",
            render: (row) => row.mobile || "--",
          },
          {
            key: "typeOfPartnerShip",
            header: "Partnership Type",
            render: (row) => row.typeOfPartnerShip || "--",
          },
          {
            key: "submittedAt",
            header: "Submitted",
            render: (row) => formatDate(row.submittedAt || row.createdAt),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <select
                value={getStatus(row.status)}
                onChange={(event) => changeStatus(row, event.target.value)}
                disabled={statusMutation.isPending}
                aria-label={`Change status for ${row.name || "enquiry"}`}
                className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${statusToneClass(getStatus(row.status))}`}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
        actions={(row, index) => (
          <button
            type="button"
            onClick={() => setSelectedLead(row)}
            title="View details"
            aria-label={`View details for ${row.name || "enquiry"}`}
            data-tour={index === 0 ? "connect-action-view" : undefined}
            className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <Eye size={13} />
          </button>
        )}
      />
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/40 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-pmedium text-white">
                  {getInitials(selectedLead.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-pmedium text-slate-900">
                    {selectedLead.name || "Unnamed enquiry"}
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={statusPillClass(getStatus(selectedLead.status))}
                    >
                      {getStatus(selectedLead.status)}
                    </span>
                    <span className={statusPillClass(selectedLead.source || "nomad")}>
                      {selectedLead.source || "nomad"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                aria-label="Close enquiry details"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    Contact Details
                  </p>
                  <p className="flex items-center gap-2 break-all text-[12px] font-pmedium text-slate-800">
                    <Mail size={13} className="shrink-0 text-slate-400" />
                    {selectedLead.email || "Not shared"}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[12px] font-pmedium text-slate-800">
                    <Phone size={13} className="shrink-0 text-slate-400" />
                    {selectedLead.mobile || "Not shared"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    Enquiry Details
                  </p>
                  <dl className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <dt className="text-slate-400">Partnership Type</dt>
                      <dd className="mt-0.5 font-pmedium text-slate-800">
                        {selectedLead.typeOfPartnerShip || "--"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Submitted</dt>
                      <dd className="mt-0.5 font-pmedium text-slate-800">
                        {formatDate(selectedLead.submittedAt || selectedLead.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="mb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  Message
                </p>
                <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-700">
                  {selectedLead.message || "No message submitted."}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
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

export default ConnectWithUsTable;
