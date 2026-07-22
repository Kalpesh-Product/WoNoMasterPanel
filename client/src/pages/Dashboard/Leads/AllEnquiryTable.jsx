import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  Mail,
  Phone,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { statusPillClass, statusToneClass } from "../../../lib/status-pill";

const MASTER_STATUSES = ["Pending", "Contacted", "Closed"];
const getMasterStatus = (value) => MASTER_STATUSES.includes(value) ? value : "Pending";

const getTimestamp = (lead) => {
  const timestamp = new Date(lead?.createdAt || lead?.submittedAt || lead?.recievedDate || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const getInitials = (value) =>
  String(value || "Lead").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const getLeadDetailFields = (lead) => {
  if (!lead) return [];
  const fields = [
    { label: "Start Date", value: lead.startDate, date: true },
    { label: "End Date", value: lead.endDate, date: true },
    { label: "Package / Plan", value: lead.packageName },
    { label: "Inquiry Type", value: lead.inquiryType },
    { label: "Room Type", value: lead.roomType },
    { label: "Bed / Dorm Type", value: lead.dormType },
    { label: "Stay Duration", value: lead.stayDuration },
    { label: "Preferred Time", value: lead.timeSlot },
    { label: "Attendees", value: lead.attendees },
    { label: "Budget", value: lead.budget },
    { label: "Location", value: lead.location },
    { label: "Country", value: lead.country },
    { label: "State", value: lead.state },
    { label: "Website", value: lead.websiteUrl },
  ];

  const existingLabels = new Set(fields.map((field) => field.label.toLowerCase()));
  const metaFields = lead.leadMeta && typeof lead.leadMeta === "object"
    ? Object.entries(lead.leadMeta).map(([key, value]) => ({
        label: key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/^./, (char) => char.toUpperCase()),
        value,
      }))
    : [];

  return [...fields, ...metaFields]
    .filter(({ label, value }) => {
      if (value === null || value === undefined || value === "") return false;
      if (existingLabels.has(label.toLowerCase()) && !fields.some((field) => field.label === label && field.value === value)) return false;
      return typeof value !== "object";
    })
    .map((field) => ({
      ...field,
      value: field.date ? formatDate(field.value) : String(field.value),
    }));
};

export default function AllEnquiryTable() {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sendingPaymentLeadId, setSendingPaymentLeadId] = useState(null);
  const [escalatingLeadId, setEscalatingLeadId] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: ["leadCompany"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/company/all-leads`);
      return Array.isArray(response?.data) ? response.data : [];
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, status }) => {
      const response = await axios.patch("/api/admin/website-leads/update", { leadId, status });
      return response.data;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData(["leadCompany"], (current = []) =>
        current.map((lead) => lead?._id === variables.leadId
          ? { ...lead, ...(response?.lead || {}), status: variables.status }
          : lead),
      );
      toast.success(response?.message || "Master Panel status updated");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to update lead"),
  });

  const escalateLeadMutation = useMutation({
    mutationFn: async (lead) => {
      const response = await axios.patch("/api/admin/website-leads/escalate", {
        leadId: lead?._id,
        companyId: lead?.companyId,
        companyName: lead?.companyName,
        workspaceId: lead?.workspaceId,
      });
      return response.data;
    },
    onSuccess: (response, lead) => {
      setEscalatingLeadId(null);
      queryClient.setQueryData(["leadCompany"], (current = []) =>
        current.map((item) => item?._id === lead?._id
          ? { ...item, ...(response?.lead || {}), isEscalated: true }
          : item),
      );
      toast.success(response?.message || "Lead escalated to HostPanel");
    },
    onError: (error) => {
      setEscalatingLeadId(null);
      toast.error(error?.response?.data?.message || "Failed to escalate lead to HostPanel");
    },
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async (lead) => {
      const response = await axios.post("/api/host-user/send-booking-payment-link", {
        customerName: lead?.fullName,
        customerEmail: lead?.email,
        companyName: lead?.companyName,
        productType: lead?.productType || lead?.verticalType,
        startDate: lead?.startDate,
        endDate: lead?.endDate,
        noOfPeople: lead?.noOfPeople,
        paymentLinkUrl: "https://example.com",
      });
      return response.data;
    },
    onSuccess: (response) => {
      setSendingPaymentLeadId(null);
      toast.success(response?.message || "Payment link email sent");
    },
    onError: (error) => {
      setSendingPaymentLeadId(null);
      toast.error(error?.response?.data?.message || "Failed to send payment link");
    },
  });

  const stats = useMemo(() => ({
    total: leads.length,
    pending: leads.filter((lead) => getMasterStatus(lead.status) === "Pending").length,
    contacted: leads.filter((lead) => lead.status === "Contacted").length,
    closed: leads.filter((lead) => lead.status === "Closed").length,
  }), [leads]);

  const visibleLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...leads]
      .sort((a, b) => getTimestamp(b) - getTimestamp(a))
      .filter((lead) => {
        const matchesStatus = statusFilter === "All" || getMasterStatus(lead.status) === statusFilter;
        const matchesQuery = !query || [
          lead.fullName, lead.email, lead.mobileNumber, lead.companyName,
          lead.source, lead.productType, lead.verticalType,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
        return matchesStatus && matchesQuery;
      });
  }, [leads, searchQuery, statusFilter]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead._id === selectedLeadId) || null,
    [leads, selectedLeadId],
  );

  if (isPending) {
    return <div className="m-2 h-[560px] animate-pulse rounded-2xl border border-slate-100 bg-white" />;
  }

  if (isError) return <p className="p-4 text-red-600">Unable to load enquiries.</p>;

  const statCards = [
    { label: "All Enquiries", value: stats.total, icon: Target, cardClass: "border-l-slate-400", labelClass: "text-slate-500", iconClass: "bg-slate-50 text-slate-600" },
    { label: "Pending", value: stats.pending, icon: Sparkles, cardClass: "border-l-amber-500", labelClass: "text-amber-600", iconClass: "bg-amber-50 text-amber-600" },
    { label: "Contacted", value: stats.contacted, icon: BadgeCheck, cardClass: "border-l-blue-500", labelClass: "text-blue-600", iconClass: "bg-blue-50 text-blue-600" },
    { label: "Closed", value: stats.closed, icon: CheckCircle2, cardClass: "border-l-emerald-500", labelClass: "text-emerald-600", iconClass: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, cardClass, labelClass, iconClass }) => (
              <div key={label} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${cardClass}`}>
                <div>
                  <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${labelClass}`}>{label}</p>
                  <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
                </div>
                <div className={`rounded-2xl p-2 ${iconClass}`}><Icon size={16} /></div>
              </div>
            ))}
          </div>

          <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-1.5 overflow-x-auto">
                {["All", ...MASTER_STATUSES].map((status) => (
                  <button key={status} type="button" onClick={() => setStatusFilter(status)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${statusFilter === status ? "bg-[#2563EB] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {status}
                  </button>
                ))}
              </div>
              <div className="relative w-full xl:w-[320px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, company, email, phone..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>

            {visibleLeads.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-slate-400">
                <Target size={28} />
                <p className="mt-3 font-pmedium">No matching enquiries found.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <table className="w-full table-fixed text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="w-[15%] px-3 py-4">Lead</th>
                      <th className="w-[14%] px-3 py-4">Company</th>
                      <th className="w-[8%] px-3 py-4">Source</th>
                      <th className="w-[11%] px-3 py-4">Product</th>
                      <th className="w-[12%] px-3 py-4">Master Status</th>
                      <th className="w-[14%] px-3 py-4">Host Status</th>
                      <th className="w-[10%] px-3 py-4">Submitted</th>
                      <th className="w-[16%] px-3 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLeads.map((lead) => {
                      const masterStatus = getMasterStatus(lead.status);
                      const hostStatus = lead.isEscalated === true ? (lead.hostPanelStatus || "Pending") : "Not Escalated";
                      const canEscalate = masterStatus === "Closed" && lead.isEscalated !== true;
                      const isEscalating = escalatingLeadId === lead._id;
                      const isSending = sendingPaymentLeadId === lead._id;
                      return (
                        <tr key={lead._id} className="transition hover:bg-slate-50/60">
                          <td className="px-3 py-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[9px] font-pmedium text-white">{getInitials(lead.fullName)}</div>
                              <p className="truncate whitespace-nowrap font-pmedium text-slate-900" title={lead.fullName}>{lead.fullName || "Unnamed lead"}</p>
                            </div>
                          </td>
                          <td className="truncate px-3 py-4 font-pmedium text-slate-700" title={lead.companyName}>{lead.companyName || "--"}</td>
                          <td className="px-3 py-4 font-pmedium capitalize text-slate-700">{lead.source || "--"}</td>
                          <td className="truncate px-3 py-4 text-slate-600" title={lead.productType || lead.verticalType}>{lead.productType || lead.verticalType || "--"}</td>
                          <td className="px-3 py-4">
                            <select value={masterStatus} onChange={(event) => updateLeadMutation.mutate({ leadId: lead._id, status: event.target.value })}
                              disabled={updateLeadMutation.isPending}
                              className={`rounded-full border border-transparent px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none ${statusToneClass(masterStatus)}`}>
                              {MASTER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-4"><span className={statusPillClass(hostStatus)}>{hostStatus}</span></td>
                          <td className="whitespace-nowrap px-3 py-4 font-pmedium text-slate-700">{formatDate(lead.createdAt || lead.submittedAt)}</td>
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <button type="button" onClick={() => setSelectedLeadId(lead._id)}
                                title="View lead details" aria-label={`View details for ${lead.fullName || "lead"}`}
                                className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                                <Eye size={13} />
                              </button>
                              <button type="button" disabled={isSending || !lead.email}
                                title={!lead.email ? "Email is required" : "Send payment link"}
                                aria-label={`Send payment link to ${lead.fullName || "lead"}`}
                                onClick={() => { setSendingPaymentLeadId(lead._id); sendPaymentLinkMutation.mutate(lead); }}
                                className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                                <CreditCard size={13} />
                              </button>
                              <button type="button" disabled={lead.isEscalated === true || !canEscalate || escalateLeadMutation.isPending}
                                title={lead.isEscalated ? "Already escalated" : canEscalate ? "Escalate to HostPanel" : "Close the Master lead before escalating"}
                                onClick={() => { setEscalatingLeadId(lead._id); escalateLeadMutation.mutate(lead); }}
                                className={`rounded-lg px-2.5 py-2 text-[10px] font-pmedium transition ${lead.isEscalated ? "bg-emerald-50 text-emerald-700" : canEscalate ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>
                                {lead.isEscalated ? "Escalated" : isEscalating ? "Escalating..." : "Escalate"}
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

          {selectedLead && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm" onClick={() => setSelectedLeadId(null)}>
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/40 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-pmedium text-white">{getInitials(selectedLead.fullName)}</div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-pmedium text-slate-900">{selectedLead.fullName || "Unnamed lead"}</h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={statusPillClass(getMasterStatus(selectedLead.status))}>Master: {getMasterStatus(selectedLead.status)}</span>
                        <span className={statusPillClass(selectedLead.isEscalated ? (selectedLead.hostPanelStatus || "Pending") : "Not Escalated")}>Host: {selectedLead.isEscalated ? (selectedLead.hostPanelStatus || "Pending") : "Not Escalated"}</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedLeadId(null)} aria-label="Close lead details" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:text-slate-700"><X size={15} /></button>
                </div>
                <div className="space-y-4 overflow-y-auto p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Contact Details</p>
                    <p className="flex items-center gap-2 text-[12px] font-pmedium text-slate-800"><Phone size={13} className="text-slate-400" />{selectedLead.mobileNumber || "Not shared"}</p>
                    <p className="mt-2 flex items-center gap-2 break-all text-[12px] font-pmedium text-slate-800"><Mail size={13} className="text-slate-400" />{selectedLead.email || "Not shared"}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Lead Details</p>
                      <dl className="grid grid-cols-2 gap-3 text-[11px]">
                        <div><dt className="text-slate-400">Company</dt><dd className="mt-0.5 font-pmedium text-slate-800">{selectedLead.companyName || "--"}</dd></div>
                        <div><dt className="text-slate-400">Source</dt><dd className="mt-0.5 font-pmedium capitalize text-slate-800">{selectedLead.source || "--"}</dd></div>
                        <div><dt className="text-slate-400">Product</dt><dd className="mt-0.5 font-pmedium text-slate-800">{selectedLead.productType || selectedLead.verticalType || "--"}</dd></div>
                        <div><dt className="text-slate-400">People</dt><dd className="mt-0.5 font-pmedium text-slate-800">{selectedLead.noOfPeople || "--"}</dd></div>
                        <div className="col-span-2"><dt className="text-slate-400">Submitted</dt><dd className="mt-0.5 font-pmedium text-slate-800">{formatDate(selectedLead.createdAt || selectedLead.submittedAt)}</dd></div>
                      </dl>
                    </div>
                  </div>

                  {getLeadDetailFields(selectedLead).length > 0 && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="mb-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Booking / Enquiry Details</p>
                      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-[11px] sm:grid-cols-3">
                        {getLeadDetailFields(selectedLead).map(({ label, value }) => (
                          <div key={`${label}-${value}`} className="min-w-0">
                            <dt className="text-slate-400">{label}</dt>
                            <dd className="mt-0.5 break-words font-pmedium text-slate-800">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {(selectedLead.message || selectedLead.comment) && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <p className="mb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Message / Notes</p>
                      <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-700">{selectedLead.message || selectedLead.comment}</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <button type="button" onClick={() => setSelectedLeadId(null)} className="w-full rounded-xl bg-blue-600 py-2.5 text-[12px] font-pmedium text-white transition hover:bg-blue-700">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
  );
}
