import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import { toast } from "sonner";
import { queryClient } from "../../../main";
import { Building2, Clock, Eye, Layers, Sparkles, Tags, X } from "lucide-react";
import DataTable from "../../../components/Tables/DataTable";

const emptyForm = {
  companyName: "",
  companyCity: "",
  companyState: "",
  companyCountry: "",
  companyContinent: "",
};

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
};

const getLogoUrl = (request) => {
  const logo = request?.logo;
  if (typeof logo === "string") return logo;
  return logo?.url || null;
};

const getInitials = (value) =>
  String(value || "Company")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const FILTER_CLASS = (active) =>
  `rounded-lg border bg-white px-2.5 py-2 text-[11px] font-pmedium outline-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 ${
    active
      ? "border-[#2563EB]/40 text-[#2563EB]"
      : "border-slate-200/60 text-slate-600"
  }`;

const CompaniesRequests = () => {
  const axiosPrivate = useAxiosPrivate();
  const navigate = useNavigate();
  const [reviewTarget, setReviewTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  const {
    data: requests = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesListingRequests"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/companies-requests");
      return response.data || [];
    },
  });

  const openReview = (request) => {
    setReviewTarget(request);
    setForm({
      companyName: request.companyName || "",
      companyCity: request.companyCity || "",
      companyState: request.companyState || "",
      companyCountry: request.companyCountry || "",
      companyContinent: request.companyContinent || "",
    });
  };

  const closeReview = () => {
    setReviewTarget(null);
    setForm(emptyForm);
  };

  const { mutate: approveRequest, isPending: isApproving } = useMutation({
    mutationFn: async () => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${reviewTarget.companyId}/approve`,
        form,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Company created");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["companiesList"] });
      closeReview();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create company");
    },
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async (companyId) => {
      const response = await axiosPrivate.post(
        `/api/hosts/companies-requests/${companyId}/reject`,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Request dismissed");
      queryClient.invalidateQueries({ queryKey: ["companiesListingRequests"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to dismiss request");
    },
  });

  // A request is "new" for its first week; older ones are the backlog.
  const isNewRequest = (request) => {
    const requestedAt = new Date(request.companiesListingRequestedAt || 0).getTime();
    return requestedAt > 0 && Date.now() - requestedAt <= 7 * 24 * 60 * 60 * 1000;
  };

  const { newCount, typeCount } = useMemo(() => {
    const types = new Set();
    let fresh = 0;
    requests.forEach((r) => {
      if (isNewRequest(r)) fresh += 1;
      (r.companiesListingRequestedTypes || []).forEach((t) => types.add(t));
    });
    return { newCount: fresh, typeCount: types.size };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (ageFilter === "new" && !isNewRequest(r)) return false;
      if (ageFilter === "older" && isNewRequest(r)) return false;
      if (!q) return true;
      return (
        r.companyName?.toLowerCase().includes(q) ||
        r.companyCountry?.toLowerCase().includes(q) ||
        r.companyState?.toLowerCase().includes(q) ||
        r.companyCity?.toLowerCase().includes(q) ||
        (r.companiesListingRequestedTypes || []).some((type) =>
          String(type).toLowerCase().includes(q),
        )
      );
    });
  }, [requests, searchQuery, ageFilter]);

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">
          Loading requests...
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="p-6 text-red-500">Failed to load requests.</div>;
  }

  const statCards = [
    {
      label: "Total Requests",
      value: requests.length,
      icon: Building2,
      accent: "border-l-slate-400",
      labelClass: "text-slate-500",
      iconClass: "bg-slate-50 text-slate-600",
    },
    {
      label: "New This Week",
      value: newCount,
      icon: Sparkles,
      accent: "border-l-blue-500",
      labelClass: "text-blue-600",
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      label: "Product Types Requested",
      value: typeCount,
      icon: Tags,
      accent: "border-l-violet-500",
      labelClass: "text-violet-600",
      iconClass: "bg-violet-50 text-violet-600",
    },
    {
      label: "Showing",
      value: filteredRequests.length,
      icon: Layers,
      accent: "border-l-emerald-500",
      labelClass: "text-emerald-600",
      iconClass: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        <div
          data-tour="companies-requests-stats"
          className="grid grid-cols-2 gap-3 mb-1 shrink-0 md:grid-cols-4"
        >
          {statCards.map(({ label, value, icon: Icon, accent, labelClass, iconClass }) => (
            <div
              key={label}
              className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm transition-all hover:shadow-md ${accent}`}
            >
              <div className="min-w-0">
                <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${labelClass}`}>
                  {label}
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
              </div>
              <div className={`shrink-0 rounded-2xl p-2 ${iconClass}`}>
                <Icon size={16} />
              </div>
            </div>
          ))}
        </div>

        <DataTable
          rows={filteredRequests}
          rowKey={(request) => request.companyId}
          minWidth={1050}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search requests, types, city..."
          filters={
            <div data-tour="companies-requests-filters">
              <select
                value={ageFilter}
                onChange={(event) => setAgeFilter(event.target.value)}
                aria-label="Filter requests by age"
                className={FILTER_CLASS(ageFilter !== "all")}
              >
                <option value="all">All requests</option>
                <option value="new">New this week</option>
                <option value="older">Older</option>
              </select>
            </div>
          }
          emptyText={
            requests.length === 0
              ? "No listing requests yet."
              : "No requests match these filters."
          }
          emptyIcon={Building2}
          tableProps={{ "data-tour": "companies-requests-table" }}
          columns={[
            {
              key: "company",
              header: "Company",
              minWidth: 240,
              render: (request) => {
                const logoUrl = getLogoUrl(request);
                return (
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${request.companyName || "Company"} logo`}
                        className="h-9 w-9 shrink-0 rounded-xl border border-slate-100 bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-pmedium text-white">
                        {getInitials(request.companyName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        title={request.companyName || "-"}
                        onClick={() =>
                          navigate(`/dashboard/companies/requests/${slugify(request.companyName)}`, {
                            state: {
                              companyId: request.companyId,
                              companyName: request.companyName,
                              companyCity: request.companyCity,
                              companyState: request.companyState,
                              companyCountry: request.companyCountry,
                              companyContinent: request.companyContinent,
                            },
                          })
                        }
                        className="block max-w-[190px] truncate text-left text-[12px] font-pmedium text-blue-600 hover:underline"
                      >
                        {request.companyName || "-"}
                      </button>
                      {request.companiesListingRequestedAt ? (
                        <p className="max-w-[190px] truncate text-[10px] text-slate-400">
                          Requested {formatDate(request.companiesListingRequestedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              },
            },
            {
              key: "types",
              header: "Requested Types",
              minWidth: 180,
              render: (request) =>
                request.companiesListingRequestedTypes?.length ? (
                  <div className="flex max-w-[200px] flex-wrap gap-1">
                    {request.companiesListingRequestedTypes.map((type) => (
                      <span
                        key={type}
                        className="whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-pmedium capitalize text-blue-700"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                ),
            },
            {
              key: "location",
              header: "Location",
              minWidth: 200,
              render: (request) => (
                <div className="min-w-0">
                  <p className="max-w-[230px] truncate text-slate-700">
                    {[request.companyCity, request.companyState].filter(Boolean).join(", ") || "-"}
                  </p>
                  <p className="max-w-[230px] truncate text-[10px] text-slate-400">
                    {[request.companyCountry, request.companyContinent]
                      .filter(Boolean)
                      .join(" · ") || "Country not set"}
                  </p>
                </div>
              ),
            },
            {
              key: "requestedAt",
              header: "Requested",
              render: (request) => (
                <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                  <Clock size={12} className="shrink-0 text-slate-400" />
                  {formatDate(request.companiesListingRequestedAt)}
                </span>
              ),
            },
            {
              key: "age",
              header: "Age",
              align: "center",
              render: (request) => (
                <span
                  className={`inline-flex w-max items-center rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${
                    isNewRequest(request)
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isNewRequest(request) ? "New" : "Backlog"}
                </span>
              ),
            },
          ]}
          actions={(request, index) => (
            <>
              <button
                type="button"
                onClick={() => openReview(request)}
                title="Review & Create"
                aria-label={`Review ${request.companyName || "request"}`}
                className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <Eye size={14} />
              </button>
              <ThreeDotMenu
                rowId={request.companyId}
                dataTour={index === 0 ? "companies-requests-more-actions" : undefined}
                menuItems={[
                  {
                    label: "Review & Create",
                    onClick: () => openReview(request),
                  },
                  {
                    label: "Reject",
                    onClick: () => rejectRequest(request.companyId),
                  },
                ]}
              />
            </>
          )}
        />
      </div>

      {reviewTarget ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={closeReview}>
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Eye size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">Review & Create Company</h2>
                  <p className="text-[10px] font-pmedium text-slate-500 mt-1">This creates a new entry in Companies, linked back to this host's already-existing Nomads listing(s).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReview}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto bg-white">
              {reviewTarget?.companiesListingRequestedTypes?.length ? (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                  <span className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Requested Product Types</span>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewTarget.companiesListingRequestedTypes.map((type) => (
                      <span key={type} className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-[10px] font-pmedium capitalize">
                        {type}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] font-medium text-slate-500">On approval, listings of these types will be activated and every other existing listing under this company will be deactivated automatically.</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Company Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">City</label>
                <input
                  type="text"
                  value={form.companyCity}
                  onChange={(e) => setForm((f) => ({ ...f, companyCity: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">State</label>
                <input
                  type="text"
                  value={form.companyState}
                  onChange={(e) => setForm((f) => ({ ...f, companyState: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Country</label>
                <input
                  type="text"
                  value={form.companyCountry}
                  onChange={(e) => setForm((f) => ({ ...f, companyCountry: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">Continent</label>
                <input
                  type="text"
                  value={form.companyContinent}
                  onChange={(e) => setForm((f) => ({ ...f, companyContinent: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-slate-400"
                />
                <p className="text-[10px] font-medium text-slate-400">Leave blank to auto-derive from country</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReview}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.companyName.trim() || isApproving}
                onClick={() => approveRequest()}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isApproving ? "Creating..." : "Create Company"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CompaniesRequests;
