import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Search,
  Settings2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import { DEFAULT_TEMPLATE_ID, TEMPLATE_REGISTRY } from "./WebsiteBuilder/templates/templateRegistry";

const PLAN_KEYS = ["basic", "professional", "custom"];
const EXTRA_TEMPLATE_META = {
  "minimal-swiss": {
    id: "minimal-swiss",
    name: "Minimal Swiss",
    description: "Whitespace-heavy, monochrome layout reserved for a future release.",
    swatch: { bg: "#ffffff", fg: "#000000", accent: "#D7263D", font: "'Inter', sans-serif" },
  },
};

const templateDefinition = (id) =>
  TEMPLATE_REGISTRY[String(id || "").trim()] ||
  EXTRA_TEMPLATE_META[String(id || "").trim()] ||
  TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];

const templateName = (id) => templateDefinition(id)?.name || "Classic";

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
};

const statusClass = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-pmedium capitalize ${statusClass[status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
    {status === "completed" ? <CheckCircle2 size={12} /> : status === "rejected" ? <XCircle size={12} /> : <Clock3 size={12} />}
    {status}
  </span>
);

const TemplateVisual = ({ templateId, label }) => {
  const template = templateDefinition(templateId);
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[9px] font-pmedium uppercase tracking-widest text-slate-400">{label}</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className="flex h-32 flex-col justify-between p-4"
          style={{ backgroundColor: template.swatch.bg, color: template.swatch.fg, fontFamily: template.swatch.font }}
        >
          <div className="h-2 w-10 rounded-full" style={{ backgroundColor: template.swatch.accent }} />
          <div>
            <div className="h-2 w-3/4 rounded-full bg-current opacity-70" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-current opacity-40" />
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-pmedium text-slate-900">{template.name}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{template.description}</p>
        </div>
      </div>
    </div>
  );
};

const ModalShell = ({ title, subtitle, onClose, children, width = "900px" }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <div
      className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      style={{ maxWidth: width }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-pmedium text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-[11px] font-pmedium text-slate-500">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
          <X size={17} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const WebsiteTemplateRequests = () => {
  const axiosPrivate = useAxiosPrivate();
  const actionGuardRef = useRef(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [confirmingChange, setConfirmingChange] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);

  const requestsQuery = useQuery({
    queryKey: ["website-template-change-requests"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-template-changes/requests");
      return Array.isArray(response.data) ? response.data : [];
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const settingsQuery = useQuery({
    queryKey: ["website-template-change-settings"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-template-changes/settings");
      return response.data;
    },
  });

  const invalidateRequests = () => queryClient.invalidateQueries({ queryKey: ["website-template-change-requests"] });

  const approveMutation = useMutation({
    mutationFn: (requestId) => axiosPrivate.patch(`/api/website-template-changes/requests/${requestId}/approve`),
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Template request approved");
      await invalidateRequests();
      setSelectedRequest(response.data?.request || null);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to approve request"),
    onSettled: () => { actionGuardRef.current = false; },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }) => axiosPrivate.patch(`/api/website-template-changes/requests/${requestId}/reject`, { reason }),
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Template request rejected");
      setRejectionTarget(null);
      setRejectionReason("");
      if (selectedRequest?._id === response.data?.request?._id) setSelectedRequest(response.data.request);
      await invalidateRequests();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to reject request"),
    onSettled: () => { actionGuardRef.current = false; },
  });

  const completeMutation = useMutation({
    mutationFn: (requestId) => axiosPrivate.patch(`/api/website-template-changes/requests/${requestId}/complete`),
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Website template changed successfully");
      setConfirmingChange(false);
      setSelectedRequest(response.data?.request || null);
      await invalidateRequests();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to change website template"),
    onSettled: () => { actionGuardRef.current = false; },
  });

  const settingsMutation = useMutation({
    mutationFn: (payload) => axiosPrivate.put("/api/website-template-changes/settings", payload),
    onSuccess: async (response) => {
      toast.success(response.data?.message || "Template settings updated");
      setSettingsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["website-template-change-settings"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to update template settings"),
  });

  const requests = useMemo(() => requestsQuery.data || [], [requestsQuery.data]);
  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (!query) return true;
      return [request.companyName, request.companyId, request.workspaceId, request.requestedByName, request.requestedByEmail, request.unitName]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [requests, searchQuery, statusFilter]);

  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved").length,
    completed: requests.filter((request) => request.status === "completed").length,
  }), [requests]);

  useEffect(() => {
    if (!settingsOpen || !settingsQuery.data) return;
    setSettingsDraft(JSON.parse(JSON.stringify(settingsQuery.data)));
  }, [settingsOpen, settingsQuery.data]);

  const runGuarded = (callback) => {
    if (actionGuardRef.current) return;
    actionGuardRef.current = true;
    callback();
  };

  const openRequest = (request, shouldConfirm = false) => {
    setSelectedRequest(request);
    setConfirmingChange(shouldConfirm && request.status === "approved");
  };

  const submitRejection = () => {
    const reason = rejectionReason.trim();
    if (!reason) return toast.error("Enter a rejection reason");
    runGuarded(() => rejectMutation.mutate({ requestId: rejectionTarget._id, reason }));
  };

  const updatePlanLimit = (plan, value) => {
    setSettingsDraft((current) => ({
      ...current,
      planChangeLimits: { ...current.planChangeLimits, [plan]: value },
    }));
  };

  const updateTemplateRow = (templateId, patch) => {
    setSettingsDraft((current) => ({
      ...current,
      templates: current.templates.map((row) => row.templateId === templateId ? { ...row, ...patch } : row),
    }));
  };

  const toggleTemplatePlan = (templateId, plan) => {
    const row = settingsDraft.templates.find((item) => item.templateId === templateId);
    const selected = new Set(row.allowedPlans || []);
    if (selected.has(plan)) selected.delete(plan); else selected.add(plan);
    updateTemplateRow(templateId, { allowedPlans: [...selected] });
  };

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1">
          <div>
            <h2 className="text-title font-pmedium uppercase text-primary">Website Templates</h2>
            <p className="mt-1 text-xs font-pmedium text-slate-500">Review template-change requests and control template access by plan.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Total Requests", counts.total, "border-l-slate-400", "text-slate-500"],
            ["Pending", counts.pending, "border-l-amber-500", "text-amber-600"],
            ["Approved", counts.approved, "border-l-blue-500", "text-blue-600"],
            ["Completed", counts.completed, "border-l-emerald-500", "text-emerald-600"],
          ].map(([label, value, border, color]) => (
            <div key={label} className={`rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${border}`}>
              <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${color}`}>{label}</p>
              <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-100/60 bg-slate-50/50 p-4 xl:flex-row xl:items-center">
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto">
              {["all", "pending", "approved", "completed", "rejected"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium capitalize transition-all ${statusFilter === status ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200" : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70"}`}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
              <div className="relative w-full sm:min-w-72 xl:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search companies or requesters..."
                  className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-slate-900 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium uppercase tracking-wider text-white shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700"
              >
                <Settings2 size={15} /> Template settings
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                <tr>
                  {["Company", "User Name", "Unit Name", "Plan", "Current", "Requested", "Status", "Requested At", "Actions"].map((heading) => (
                    <th key={heading} className={`px-5 py-3.5 text-[11px] font-pmedium uppercase tracking-widest text-slate-400 ${heading === "Actions" ? "text-center" : "text-left"}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requestsQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td colSpan={9} className="px-5 py-4"><div className="h-8 animate-pulse rounded-lg bg-slate-100" /></td>
                    </tr>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={9} className="py-20 text-center text-sm font-pmedium text-slate-400">No template-change requests found.</td></tr>
                ) : filteredRequests.map((request) => (
                  <tr key={request._id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <p className="text-xs font-pmedium text-slate-900">{request.companyName || "-"}</p>
                      {/* <p className="mt-1 text-[10px] text-slate-400">{request.companyId || request.workspaceId || "-"}</p> */}
                    </td>
                    <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{request.requestedByName || request.requestedByEmail || "-"}</td>
                    <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{request.unitName || "-"}</td>
                    <td className="px-5 py-4 text-xs font-pmedium capitalize text-slate-600">{request.planAtRequest || "basic"}</td>
                    <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{templateName(request.currentTemplateId)}</td>
                    <td className="px-5 py-4 text-xs font-pmedium text-[#2563EB]">{templateName(request.requestedTemplateId)}</td>
                    <td className="px-5 py-4"><StatusPill status={request.status} /></td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{formatDate(request.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" title="View request" onClick={() => openRequest(request)} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-700"><Eye size={15} /></button>
                        {request.status === "pending" ? (
                          <>
                            <button type="button" title="Approve request" disabled={approveMutation.isPending} onClick={() => runGuarded(() => approveMutation.mutate(request._id))} className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"><Check size={15} /></button>
                            <button type="button" title="Reject request" onClick={() => { setRejectionTarget(request); setRejectionReason(""); }} className="rounded-lg bg-rose-50 p-1.5 text-rose-700 transition-colors hover:bg-rose-100"><X size={15} /></button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          title={request.status === "approved" ? "Change template" : "Approve the request before changing the template"}
                          disabled={request.status !== "approved"}
                          onClick={() => openRequest(request, true)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 py-1.5 text-[10px] font-pmedium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          Change <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRequest ? (
        <ModalShell
          title="Website template request"
          subtitle={`${selectedRequest.companyName || "Company"} · ${selectedRequest.planAtRequest || "basic"} plan`}
          onClose={() => { if (!completeMutation.isPending) { setSelectedRequest(null); setConfirmingChange(false); } }}
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Request status</p>
                <div className="mt-2"><StatusPill status={selectedRequest.status} /></div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Submitted</p>
                <p className="mt-1 text-xs font-pmedium text-slate-700">{formatDate(selectedRequest.createdAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <TemplateVisual templateId={selectedRequest.currentTemplateId} label="Current template" />
              <ArrowRight size={22} className="text-[#2563EB]" />
              <TemplateVisual templateId={selectedRequest.requestedTemplateId} label="Requested template" />
            </div>
            {selectedRequest.rejectionReason ? (
              <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800">
                <span className="font-pmedium">Rejection reason:</span> {selectedRequest.rejectionReason}
              </div>
            ) : null}
            {confirmingChange ? (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                This immediately changes the website from <strong>{templateName(selectedRequest.currentTemplateId)}</strong> to <strong>{templateName(selectedRequest.requestedTemplateId)}</strong>, publishes a new template version, and completes the request.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
            {selectedRequest.status === "pending" ? (
              <>
                <button type="button" onClick={() => { setRejectionTarget(selectedRequest); setRejectionReason(""); }} className="rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-rose-700 hover:bg-rose-50">Reject</button>
                <button type="button" disabled={approveMutation.isPending} onClick={() => runGuarded(() => approveMutation.mutate(selectedRequest._id))} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50">{approveMutation.isPending ? "Approving..." : "Approve request"}</button>
              </>
            ) : selectedRequest.status === "approved" ? (
              confirmingChange ? (
                <>
                  <button type="button" disabled={completeMutation.isPending} onClick={() => setConfirmingChange(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50">Back</button>
                  <button type="button" disabled={completeMutation.isPending} onClick={() => runGuarded(() => completeMutation.mutate(selectedRequest._id))} className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50">{completeMutation.isPending ? "Changing..." : "Confirm template change"}</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmingChange(true)} className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white hover:bg-blue-700">Change template</button>
              )
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {rejectionTarget ? (
        <ModalShell title="Reject template request" subtitle={`${rejectionTarget.companyName || "Company"} · ${templateName(rejectionTarget.requestedTemplateId)}`} onClose={() => { if (!rejectMutation.isPending) setRejectionTarget(null); }} width="520px">
          <div className="px-6 py-5">
            <label className="mb-2 block text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Rejection reason</label>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value.slice(0, 500))}
              rows={4}
              placeholder="Explain why this template change cannot be approved..."
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-pmedium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            />
            <p className="mt-1 text-right text-[10px] text-slate-400">{rejectionReason.length}/500</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" disabled={rejectMutation.isPending} onClick={() => setRejectionTarget(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={!rejectionReason.trim() || rejectMutation.isPending} onClick={submitRejection} className="rounded-xl bg-rose-600 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white hover:bg-rose-700 disabled:opacity-50">{rejectMutation.isPending ? "Rejecting..." : "Reject request"}</button>
          </div>
        </ModalShell>
      ) : null}

      {settingsOpen ? (
        <ModalShell title="Template settings" subtitle="Control plan limits, visibility, and template availability in HostPanel." onClose={() => { if (!settingsMutation.isPending) setSettingsOpen(false); }} width="980px">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!settingsDraft ? (
              <div className="py-16 text-center text-sm font-pmedium text-slate-400">Loading settings...</div>
            ) : (
              <div className="flex flex-col gap-6">
                <section>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-pmedium text-slate-900">Plan change limits</h3>
                      <p className="mt-1 text-[11px] text-slate-500">Completed template changes consume the configured limit.</p>
                    </div>
                    <select value={settingsDraft.limitPeriod} onChange={(event) => setSettingsDraft((current) => ({ ...current, limitPeriod: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB]">
                      <option value="monthly">Reset monthly</option>
                      <option value="lifetime">Lifetime limit</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PLAN_KEYS.map((plan) => (
                      <label key={plan} className="border-y border-slate-100 py-3">
                        <span className="block text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{plan}</span>
                        <input type="number" min="0" max="100" value={settingsDraft.planChangeLimits?.[plan] ?? 0} onChange={(event) => updatePlanLimit(plan, event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-pmedium outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-pmedium text-slate-900">Template availability</h3>
                  <p className="mt-1 text-[11px] text-slate-500">Disabled templates remain visible as coming soon when visibility is enabled.</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {settingsDraft.templates.map((row) => (
                      <div key={row.templateId} className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
                        <div className="border-b border-slate-100 pb-3">
                          <p className="text-xs font-pmedium text-slate-900">{templateName(row.templateId)}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{row.templateId}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                          <label className="inline-flex items-center gap-2 text-[11px] font-pmedium text-slate-600"><input type="checkbox" checked={row.enabled === true} onChange={(event) => updateTemplateRow(row.templateId, { enabled: event.target.checked })} className="h-4 w-4 accent-[#2563EB]" /> Enabled</label>
                          <label className="inline-flex items-center gap-2 text-[11px] font-pmedium text-slate-600"><input type="checkbox" checked={row.visible !== false} onChange={(event) => updateTemplateRow(row.templateId, { visible: event.target.checked })} className="h-4 w-4 accent-[#2563EB]" /> Visible</label>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <p className="mb-2 text-[9px] font-pmedium uppercase tracking-widest text-slate-400">Available for plans</p>
                          <div className="flex flex-wrap items-center gap-3">
                            {PLAN_KEYS.map((plan) => (
                              <label key={plan} className="inline-flex items-center gap-1.5 text-[10px] font-pmedium capitalize text-slate-500"><input type="checkbox" checked={(row.allowedPlans || []).includes(plan)} onChange={() => toggleTemplatePlan(row.templateId, plan)} className="h-3.5 w-3.5 accent-[#2563EB]" /> {plan}</label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" disabled={settingsMutation.isPending} onClick={() => setSettingsOpen(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={!settingsDraft || settingsMutation.isPending} onClick={() => settingsMutation.mutate(settingsDraft)} className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-wider text-white hover:bg-blue-700 disabled:opacity-50">{settingsMutation.isPending ? "Saving..." : "Save settings"}</button>
          </div>
        </ModalShell>
      ) : null}
    </PageFrame>
  );
};

export default WebsiteTemplateRequests;
