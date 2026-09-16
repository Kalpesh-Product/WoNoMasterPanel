import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { toast } from "sonner";
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  History,
  X,
  Layers,
  Eye,
  TrendingUp,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import VerificationLeadDetailModal from "../../../components/VerificationLeadDetailModal";
import {
  TIER_LABELS,
  TIER_OPTIONS,
  CHANGE_TYPE_LABELS,
  RENEW_ENABLED_WITHIN_DAYS,
  daysUntil,
  formatDate,
  getInitials,
} from "../../../constants/verificationTiers";

// Auto-refresh so Active/Expiring Soon/Expired tags and tab counts stay
// correct on their own as time passes, without needing a manual reload.
const AUTO_REFRESH_MS = 60 * 1000;

const getLifecycleTag = (lead) => {
  const days = daysUntil(lead.verificationExpiresAt);
  if (days === null) return { key: "active", label: "Active", tone: "bg-emerald-50 text-emerald-600" };
  if (days <= 0) return { key: "expired", label: "Expired", tone: "bg-rose-50 text-rose-600" };
  if (days <= RENEW_ENABLED_WITHIN_DAYS) {
    return { key: "expiring", label: "Expiring Soon", tone: "bg-amber-50 text-amber-600" };
  }
  return { key: "active", label: "Active", tone: "bg-emerald-50 text-emerald-600" };
};

// Backs both the (non-interactive, informational) stat-card row up top and
// the pill-style sub-tab filter below it — same split used by Company
// Verification Leads, kept as two separate elements rather than merging
// stats into clickable cards (no other page in this app does that).
const TABS = [
  {
    key: "all",
    label: "All Verified",
    icon: ShieldCheck,
    accent: "border-l-slate-400",
    textColor: "text-slate-500",
    bgColor: "bg-slate-50",
  },
  {
    key: "active",
    label: "Active",
    icon: CheckCircle2,
    accent: "border-l-emerald-500",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    key: "expiring",
    label: "Expiring Soon",
    icon: Clock,
    accent: "border-l-amber-500",
    textColor: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    key: "expired",
    label: "Expired",
    icon: AlertCircle,
    accent: "border-l-rose-500",
    textColor: "text-rose-600",
    bgColor: "bg-rose-50",
  },
];

// Info-only extra cards (not filterable tabs — a company's history isn't a
// current lifecycle state, so it doesn't fit the row-filter model above).
const EXTRA_STAT_CARDS = [
  {
    key: "renewed",
    label: "Renewed",
    icon: RefreshCw,
    accent: "border-l-sky-500",
    textColor: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  {
    key: "changedPlan",
    label: "Changed Plan",
    icon: TrendingUp,
    accent: "border-l-violet-500",
    textColor: "text-violet-600",
    bgColor: "bg-violet-50",
  },
];

const CompanyVerified = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [changePlanLead, setChangePlanLead] = useState(null);
  const [changePlanTier, setChangePlanTier] = useState("1m");
  const [historyLead, setHistoryLead] = useState(null);
  const [viewLead, setViewLead] = useState(null);

  const { data: leadsRaw = [], isPending } = useQuery({
    queryKey: ["company-verified"],
    queryFn: async () => {
      const response = await axios.get("/api/company-verification-leads");
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
    refetchInterval: AUTO_REFRESH_MS,
  });

  // Only companies that have actually been verified at least once —
  // pending/awaiting-payment leads stay in the Company Verification Leads
  // queue, not here.
  const leads = useMemo(
    () => leadsRaw.filter((l) => l.paymentStatus === "paid"),
    [leadsRaw],
  );

  const { data: paymentHistory = [] } = useQuery({
    queryKey: ["company-verified-payment-history"],
    queryFn: async () => {
      const response = await axios.get(
        "/api/company-verification-leads/payment-history",
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
    refetchInterval: AUTO_REFRESH_MS,
  });

  const { data: historyRows = [], isPending: isHistoryPending } = useQuery({
    queryKey: ["company-verified-history", historyLead?._id],
    queryFn: async () => {
      const response = await axios.get(
        `/api/company-verification-leads/${historyLead._id}/history`,
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
    enabled: Boolean(historyLead?._id),
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async ({ id, tier }) => {
      const res = await axios.post(
        `/api/company-verification-leads/${id}/send-payment-link`,
        { tier },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-verified"] });
      toast.success("Payment link email sent");
      setChangePlanLead(null);
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message || "Failed to send payment link",
      ),
  });

  const tagged = useMemo(
    () => leads.map((lead) => ({ lead, tag: getLifecycleTag(lead) })),
    [leads],
  );

  const counts = useMemo(() => {
    const c = {
      all: tagged.length,
      active: 0,
      expiring: 0,
      expired: 0,
      renewed: paymentHistory.filter((p) => p.changeType === "renewal").length,
      changedPlan: paymentHistory.filter((p) =>
        ["upgrade", "downgrade"].includes(p.changeType),
      ).length,
    };
    tagged.forEach(({ tag }) => {
      c[tag.key] += 1;
    });
    return c;
  }, [tagged, paymentHistory]);

  const filtered = useMemo(() => {
    const byTab =
      activeTab === "all" ? tagged : tagged.filter(({ tag }) => tag.key === activeTab);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(({ lead }) =>
      [lead.fullName, lead.email, lead.companyName, lead.businessName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [tagged, activeTab, search]);

  const openChangePlan = (lead) => {
    setChangePlanLead(lead);
    setChangePlanTier(lead.activeTier || "1m");
  };

  const pageHeading = (
    <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
      <div>
        <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
          Companies Verified
        </h2>
        <p className="text-xs font-pmedium text-slate-500 mt-1">
          Track every verified company's plan, expiry, and renewal history in
          one place.
        </p>
      </div>
    </div>
  );

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            {pageHeading}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse"
                >
                  <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
                  <div className="h-5 w-10 bg-slate-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-9 w-9 bg-slate-200 rounded-2xl shrink-0" />
                  <div className="h-3 bg-slate-200 rounded-full w-32" />
                  <div className="h-3 bg-slate-200 rounded-full w-24" />
                  <div className="h-3 bg-slate-200 rounded-full w-20" />
                </div>
              ))}
            </div>
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <>
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            {pageHeading}

            {/* Stat cards — informational only, always show totals across all tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
              {[...TABS, ...EXTRA_STAT_CARDS].map((tab) => {
                const Icon = tab.icon;
                return (
                  <div
                    key={tab.key}
                    className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${tab.accent}`}
                  >
                    <div>
                      <p
                        className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${tab.textColor}`}
                      >
                        {tab.label}
                      </p>
                      <p className="text-[15px] font-pmedium text-slate-900">
                        {counts[tab.key] || 0}
                      </p>
                    </div>
                    <div className={`rounded-2xl p-2 ${tab.bgColor} ${tab.textColor}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
                <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${
                        activeTab === tab.key
                          ? "bg-[#2563EB] text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="relative max-w-sm sm:shrink-0">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                  />
                  <input
                    type="text"
                    placeholder="Search name, email, business..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <ShieldCheck size={28} />
                  </div>
                  <p className="text-slate-400 font-semibold font-pmedium">
                    No companies in this tab.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-5 py-4">Company</th>
                        <th className="px-5 py-4">Plan</th>
                        <th className="px-5 py-4">Start Date</th>
                        <th className="px-5 py-4">End Date</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {filtered.map(({ lead, tag }) => {
                        const days = daysUntil(lead.verificationExpiresAt);
                        const canRenew =
                          days === null || days <= RENEW_ENABLED_WITHIN_DAYS;
                        return (
                          <tr
                            key={lead._id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                  {getInitials(
                                    lead.businessName || lead.companyName,
                                  )}
                                </div>
                                <div>
                                  <p className="text-[12px] font-pmedium text-slate-900 truncate max-w-[180px]">
                                    {lead.businessName || lead.companyName || "--"}
                                  </p>
                                  <p className="text-[10px] font-pmedium text-slate-500 truncate max-w-[180px]">
                                    {lead.email || ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-blue-50 text-blue-700">
                                {TIER_LABELS[lead.activeTier] || lead.activeTier}{" "}
                                · ${lead.activeAmountUsd}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600">
                              {formatDate(lead.paidAt)}
                            </td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600">
                              {formatDate(lead.verificationExpiresAt)}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium whitespace-nowrap ${tag.tone}`}
                              >
                                {tag.label}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewLead(lead)}
                                  title="View details"
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                  <Eye size={15} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  title={
                                    canRenew
                                      ? "Renew this plan"
                                      : `Renew unlocks within ${RENEW_ENABLED_WITHIN_DAYS} days of expiry`
                                  }
                                  disabled={
                                    !canRenew || sendPaymentLinkMutation.isPending
                                  }
                                  onClick={() =>
                                    sendPaymentLinkMutation.mutate({
                                      id: lead._id,
                                      tier: lead.activeTier,
                                    })
                                  }
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                >
                                  <RefreshCw size={15} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  title="Change plan"
                                  disabled={sendPaymentLinkMutation.isPending}
                                  onClick={() => openChangePlan(lead)}
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                  <Layers size={15} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  title="View renewal history"
                                  onClick={() => setHistoryLead(lead)}
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                                >
                                  <History size={15} strokeWidth={2.5} />
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
        </PageFrame>
      </div>

      {viewLead && (
        <VerificationLeadDetailModal
          lead={viewLead}
          onClose={() => setViewLead(null)}
          onViewHistory={() => {
            setHistoryLead(viewLead);
            setViewLead(null);
          }}
        />
      )}

      {/* Change Plan Modal */}
      {changePlanLead && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setChangePlanLead(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-sm w-full shadow-2xl overflow-hidden flex flex-col border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 bg-blue-50/30">
              <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                Change Plan
              </h2>
              <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                {changePlanLead.businessName || changePlanLead.companyName}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                  Current Plan
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {TIER_LABELS[changePlanLead.activeTier] ||
                    changePlanLead.activeTier ||
                    "--"}{" "}
                  · Ends {formatDate(changePlanLead.verificationExpiresAt)}
                </p>
              </div>
              <div>
                <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1 block">
                  New Plan
                </label>
                <select
                  value={changePlanTier}
                  onChange={(e) => setChangePlanTier(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-pmedium text-slate-900 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                >
                  {TIER_OPTIONS.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] font-pmedium text-slate-500">
                Sends a new Stripe payment link for the selected plan. If the
                current plan is still active, the new one starts right after
                it ends — no time is lost.
              </p>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => setChangePlanLead(null)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendPaymentLinkMutation.isPending}
                onClick={() =>
                  sendPaymentLinkMutation.mutate({
                    id: changePlanLead._id,
                    tier: changePlanTier,
                  })
                }
                className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] hover:bg-[#1d4fd1] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendPaymentLinkMutation.isPending
                  ? "Sending..."
                  : "Send Payment Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyLead && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setHistoryLead(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                  Renewal History
                </h2>
                <p className="text-[11px] font-pmedium text-slate-500 mt-0.5 truncate">
                  {historyLead.businessName || historyLead.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryLead(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-2 overflow-y-auto bg-white">
              {isHistoryPending ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-slate-300" size={24} />
                </div>
              ) : historyRows.filter((r) => r.status === "paid").length ===
                0 ? (
                <p className="text-center text-slate-400 font-pmedium py-8">
                  No renewal history yet.
                </p>
              ) : (
                historyRows
                  .filter((r) => r.status === "paid")
                  .map((entry) => {
                    const isPlanChange = ["upgrade", "downgrade"].includes(
                      entry.changeType,
                    );
                    return (
                      <div
                        key={entry._id}
                        className="flex flex-col gap-2 bg-slate-50/60 rounded-xl p-3 border border-slate-100"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-[12px] font-pmedium text-slate-900">
                              {CHANGE_TYPE_LABELS[entry.changeType] ||
                                entry.changeType}
                            </span>
                            <span className="text-[11px] font-pmedium text-slate-500">
                              ${entry.amount}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-pmedium text-slate-600">
                              {formatDate(entry.paidAt)}
                              {entry.verificationExpiresAt
                                ? ` → ${formatDate(entry.verificationExpiresAt)}`
                                : ""}
                            </div>
                            {(entry.hostedInvoiceUrl || entry.invoicePdfUrl) && (
                              <a
                                href={entry.hostedInvoiceUrl || entry.invoicePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-pmedium text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                              >
                                Invoice
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-pmedium pl-6">
                          <span className="text-slate-500">
                            Existing Plan:{" "}
                            <span className="text-slate-800">
                              {entry.previousTier
                                ? TIER_LABELS[entry.previousTier] || entry.previousTier
                                : "None"}
                            </span>
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="text-slate-500">
                            New Plan:{" "}
                            <span
                              className={
                                isPlanChange
                                  ? "text-violet-700 font-semibold"
                                  : "text-slate-800"
                              }
                            >
                              {TIER_LABELS[entry.tier] || entry.tier}
                            </span>
                          </span>
                          {!isPlanChange && entry.previousTier && (
                            <span className="rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px]">
                              Same Plan
                            </span>
                          )}
                          {isPlanChange && (
                            <span className="rounded-full px-2 py-0.5 bg-violet-50 text-violet-600 text-[10px]">
                              Changed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryLead(null)}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CompanyVerified;
