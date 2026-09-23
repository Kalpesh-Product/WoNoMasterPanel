import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Search, Send, RotateCw, FileText, X } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";
import CustomPlanModulePicker from "../../../components/CustomPlanModulePicker";

const formatPlan = (value) => {
  const rawPlan = String(value || "").trim();
  if (!rawPlan) return "Not Assigned";
  return rawPlan
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const statusPill = (value, colorMap) => {
  const style = colorMap[value] || { bg: "#F3F4F6", color: "#4B5563" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {value}
    </span>
  );
};

const UpgradePlan = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const axiosPrivate = useAxiosPrivate();
  const { auth } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customPaymentCompany, setCustomPaymentCompany] = useState(null);
  const [customModuleEditCompany, setCustomModuleEditCompany] = useState(null);
  const [sendingPaymentCompanyId, setSendingPaymentCompanyId] = useState(null);
  const [activeTab, setActiveTab] = useState("requested");
  const [isEditingModules, setIsEditingModules] = useState(false);
  const [editedModuleIds, setEditedModuleIds] = useState([]);
  const resolvedCompanyId = useMemo(() => {
    const stateCompanyId = String(location.state?.companyId || "").trim();
    if (stateCompanyId) return stateCompanyId;
    const storedCompanyId = String(sessionStorage.getItem("companyId") || "").trim();
    if (storedCompanyId) return storedCompanyId;
    return "";
  }, [location.state]);

  const userEmail = auth?.user?.email;
  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
    "gourish.wono@gmail.com",
  ];
  const companiesAccessAllowedEmails = [
    "gourish.wono@gmail.com",
  ];

  const isRestrictedUser = restrictedEmails.includes(userEmail);
  const canAccessCompanies = companiesAccessAllowedEmails.includes(userEmail);
  const shouldRedirectFromCompanies = isRestrictedUser && !canAccessCompanies;

  useEffect(() => {
    if (shouldRedirectFromCompanies) {
      navigate("/dashboard/data-upload/bulk-upload-images", { replace: true });
    }
  }, [navigate, shouldRedirectFromCompanies]);

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ["hostCompaniesList"],
    enabled: !shouldRedirectFromCompanies,
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/host-companies");
      return response.data;
    },
    // Without this, a host's new upgrade request (requestedPlan,
    // customPlanModuleIds) never appears here unless staff manually reload
    // the page — nothing else invalidates this query for a change made by a
    // completely different user in a different session.
    refetchInterval: 15000,
  });


  // Live pricing (same source the Custom module picker reads) — used to show
  // an estimated price on a Custom request before staff have even opened
  // the picker, so the request is reviewable at a glance.
  const { data: planPricing } = useQuery({
    queryKey: ["planPricing"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/hosts/plan-pricing");
      return response?.data || { settings: {}, rows: [] };
    },
  });


  const computeCustomPlanBreakdown = (customModuleIds = []) => {
    const basePriceUsd = Number(planPricing?.settings?.professionalPlanPriceUsd || 0);
    const rows = planPricing?.rows || [];
    const selected = new Set(customModuleIds);
    const departments = rows.filter((r) => r.itemType === "department");
    const modules = rows.filter((r) => r.itemType === "module");
    const covered = new Set();
    const lineItems = [];
    let total = basePriceUsd;

    for (const dept of departments) {
      const ids = dept.includesModuleIds || [];
      if (selected.has(dept.itemId) || (ids.length && ids.every((id) => selected.has(id)))) {
        const price = Number(dept.priceUsd || 0);
        total += price;
        lineItems.push({ ...dept, priceUsd: price, displayType: "Bundle" });
        ids.forEach((id) => covered.add(id));
        covered.add(dept.itemId);
      }
    }

    for (const id of selected) {
      if (covered.has(id)) continue;
      const row = modules.find((m) => m.itemId === id);
      if (!row) continue;
      const price = Number(row.priceUsd || 0);
      total += price;
      lineItems.push({ ...row, priceUsd: price, displayType: "Module" });
    }

    return { basePriceUsd, lineItems, totalMonthlyPriceUsd: Math.round(total * 100) / 100 };
  };

  const computeCustomPlanPrice = (customModuleIds = []) => computeCustomPlanBreakdown(customModuleIds).totalMonthlyPriceUsd;

  // Full plan-payment history for this company — the "Payment History"
  // sub-tab. Once a requested upgrade is actually paid, it moves here
  // instead of staying mixed in with still-pending requests.
  const { data: planHistoryData } = useQuery({
    queryKey: ["hostCompanyPlanHistory", resolvedCompanyId],
    enabled: Boolean(resolvedCompanyId) && activeTab === "history",
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `/api/hosts/host-companies/${resolvedCompanyId}/plan-history`,
      );
      return response?.data?.history || [];
    },
  });
const sendPlanPaymentLinkMutation = useMutation({
    mutationFn: async ({ company, plan, customModuleIds }) => {
      const response = await axiosPrivate.post("/api/hosts/plan-payments/send", {
        companyId: company.companyId,
        email: company?.pocEmail,
        name: company?.pocName,
        companyName: company?.companyName,
        plan,
        customModuleIds,
        billingCycle: company?.billingCycle || "monthly",
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSendingPaymentCompanyId(null);
      setCustomPaymentCompany(null);
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
      const cycle = String(data?.billingCycle || "monthly").toLowerCase();
      toast.success(
        data?.message
          ? `${data.message} ($${Number(data.amount || 0).toFixed(0)}/${cycle === "annual" ? "yr" : "mo"})`
          : "Payment link sent",
      );
    },
    onError: (error) => {
      setSendingPaymentCompanyId(null);
      toast.error(error?.response?.data?.message || "Failed to send payment link");
    },
  });

  // Lets staff remove modules from a Custom request's selection (e.g. the
  // host over-selected) directly from the View modal, without restarting
  // the whole review cycle — invalidates any already-sent payment link
  // since the price may have changed.
  const updateRequestedModulesMutation = useMutation({
    mutationFn: async ({ companyId, customModuleIds }) => {
      const response = await axiosPrivate.patch(
        `/api/hosts/host-companies/${companyId}/custom-plan-modules`,
        { customModuleIds },
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
      setSelectedCompany(data?.company || null);
      setCustomModuleEditCompany(null);
      setIsEditingModules(false);
      toast.success(data?.message || "Modules updated");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update modules");
    },
  });

  const handleSendPaymentLink = (company) => {
    const plan = String(company.requestedPlan || "").trim().toLowerCase();
    if (plan === "custom" || plan === "customise") {
      setCustomPaymentCompany(company);
      return;
    }
    setSendingPaymentCompanyId(company.companyId);
    sendPlanPaymentLinkMutation.mutate({ company, plan: "professional" });
  };

  const handleSubmitCustomPayment = (selectedModuleIds) => {
    setSendingPaymentCompanyId(customPaymentCompany.companyId);
    sendPlanPaymentLinkMutation.mutate({
      company: customPaymentCompany,
      plan: "custom",
      customModuleIds: selectedModuleIds,
    });
  };

  const handleViewCompany = (company) => {
    setSelectedCompany(company);
    setIsViewModalOpen(true);
    setIsEditingModules(false);
    setEditedModuleIds(company?.customPlanModuleIds || []);
  };

  const normalizePlan = (value) =>
    String(value || "").trim().toLowerCase();

  // Whether THIS specific upgrade request/cycle has been fulfilled — driven
  // by HostLeadCompany.upgradeStatus (reset to "requested" by every new
  // request, flipped to "active" only when ITS OWN payment succeeds), never
  // by getPaymentInfo()/PlanPaymentLink's "latest ever" status. A company
  // that already paid for Professional last month and just requested Custom
  // must still show as pending here — the old paid link is unrelated
  // history, not proof the *new* request is fulfilled.
  const isRequestFulfilled = (company) =>
    String(company?.upgradeStatus || "").trim().toLowerCase() === "active";

  const sortedCompanies = useMemo(
    () =>
      companies
        .filter((company) => String(company?.companyId || "").trim() === resolvedCompanyId)
        .filter((company) => Boolean(normalizePlan(company?.requestedPlan)))
        .sort((a, b) => {
          const aPaid = isRequestFulfilled(a);
          const bPaid = isRequestFulfilled(b);
          if (aPaid !== bPaid) return aPaid ? 1 : -1;
          return 0;
        }),
    [companies, resolvedCompanyId],
  );

  // Requested tab shows only what's still awaiting payment — once paid, a
  // request moves out of here and into the Payment History tab instead of
  // staying mixed in with genuinely pending ones.
  const requestedCompanies = useMemo(
    () => sortedCompanies.filter((c) => !isRequestFulfilled(c)),
    [sortedCompanies],
  );

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requestedCompanies.filter((c) => {
      if (!query) return true;
      return (
        (c.companyName || "").toLowerCase().includes(query) ||
        (c.industry || "").toLowerCase().includes(query) ||
        formatPlan(c.plan).toLowerCase().includes(query) ||
        formatPlan(c.requestedPlan).toLowerCase().includes(query)
      );
    });
  }, [requestedCompanies, searchQuery]);

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const history = planHistoryData || [];
    return history.filter((entry) => {
      if (!query) return true;
      return `${formatPlan(entry.plan)} ${entry.amount}`.toLowerCase().includes(query);
    });
  }, [planHistoryData, searchQuery]);

  const totalCount = sortedCompanies.length;
  const paidCount = sortedCompanies.filter((c) => isRequestFulfilled(c)).length;
  const pendingCount = requestedCompanies.length;

  if (isLoading) return <div className="p-6">Loading host companies...</div>;
  if (isError) return <div className="p-6 text-red-500">Failed to load companies.</div>;

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">Upgrade Plan</h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Real Stripe payment links, generated and verified automatically
              — nothing here is self-reported.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("requested")}
            className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all ${
              activeTab === "requested"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Upgrade Plan Requests
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all ${
              activeTab === "history"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Payment History
          </button>
        </div>

        {/* Stat Cards */}
        <div data-tour="upgrade-plan-stats" className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-1 shrink-0">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Total Requests</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalCount}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Pending</p>
              <p className="text-[15px] font-pmedium text-slate-900">{pendingCount}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Paid</p>
              <p className="text-[15px] font-pmedium text-slate-900">{paidCount}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
            <div />
            <div className="relative flex-1 min-w-[180px] max-w-md" data-tour="upgrade-plan-search">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder={activeTab === "requested" ? "Search companies..." : "Search payment history..."}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {activeTab === "history" ? (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Paid / Requested</th>
                    <th className="px-5 py-3.5 text-center">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 font-pmedium">
                        No payment history yet.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((entry) => (
                      <tr key={entry._id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                        <td className="px-5 py-3.5 text-[12px] font-pmedium text-slate-800">{formatPlan(entry.plan)}</td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-600">{formatPlan(entry.changeType)}</td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-600">${entry.amount}</td>
                        <td className="px-5 py-3.5">
                          {statusPill(entry.status === "paid" ? "Paid" : "Pending", {
                            Paid: { bg: "#D1FAE5", color: "#10B981" },
                            Pending: { bg: "#FEF3C7", color: "#B45309" },
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] text-slate-500">
                          {formatDateTime(entry.status === "paid" ? entry.paidAt : entry.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {entry.hostedInvoiceUrl ? (
                            <button
                              type="button"
                              onClick={() => window.open(entry.hostedInvoiceUrl, "_blank", "noopener")}
                              title="View invoice"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all inline-flex"
                            >
                              <FileText size={14} strokeWidth={2.5} />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
          <div className="overflow-x-auto flex-1">
            <table data-tour="upgrade-plan-table" className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Vertical</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Current Plan</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested Plan</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Est. Price</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Payment Link</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Upgrade Status</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-20 text-slate-400 font-pmedium">No upgrade requests found.</td>
                  </tr>
                ) : (
                  filteredCompanies.map((row, index) => {
                    const isSent = Boolean(row.paymentLinkSentAt);
                    const upgradeStatus = String(row.upgradeStatus || "requested").trim().toLowerCase();
                    const isSending =
                      sendingPaymentCompanyId === row.companyId && sendPlanPaymentLinkMutation.isPending;

                    return (
                      <tr key={row.companyId} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 align-top">
                          <div className="font-pmedium text-[#0F172A] text-[13px]">{row.companyName || "-"}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.industry || "-"}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{formatPlan(row.plan)}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{formatPlan(row.requestedPlan)}</td>
<td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">
                          {normalizePlan(row.requestedPlan) === "custom" || normalizePlan(row.requestedPlan) === "customise"
                            ? `$${computeCustomPlanPrice(row.customPlanModuleIds || [])}/mo`
                            : normalizePlan(row.requestedPlan) === "professional"
                              ? row?.billingCycle === "annual"
                                ? `$${planPricing?.settings?.professionalAnnualPlanPriceUsd ?? "-"}/yr (annual)`
                                : `$${planPricing?.settings?.professionalPlanPriceUsd ?? "-"}/mo`
                              : "-"}
                        </td>
                        <td className="px-5 py-4 align-top text-center">
                          {statusPill(isSent ? "Sent" : "Not Sent", {
                            Sent: { bg: "#DBEAFE", color: "#1D4ED8" },
                            "Not Sent": { bg: "#F3F4F6", color: "#4B5563" },
                          })}
                        </td>
                        <td className="px-5 py-4 align-top text-center">
                          {statusPill(formatPlan(upgradeStatus), {
                            Requested: { bg: "#FEF3C7", color: "#B45309" },
                            "Payment Link Sent": { bg: "#DBEAFE", color: "#1D4ED8" },
                            Active: { bg: "#D1FAE5", color: "#047857" },
                            Downgraded: { bg: "#FEE2E2", color: "#B91C1C" },
                          })}
                        </td>
                        <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                          <div
                            data-tour={index === 0 ? "upgrade-plan-row-actions" : undefined}
                            className="flex items-center justify-center gap-1"
                          >
                            <button
                              type="button"
                              onClick={() => handleViewCompany(row)}
                              title="View details"
                              data-tour={index === 0 ? "upgrade-plan-action-view" : undefined}
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                            >
                              <Eye size={15} strokeWidth={2.5} />
                            </button>
                            {/* Every row here is, by construction, an
                            unfulfilled request (isRequestFulfilled filters
                            fulfilled ones out into Payment History) — always
                            offer Send/Resend, never "View Invoice", which
                            would otherwise show for a company that has some
                            unrelated OLD paid plan on record. */}
                            {Boolean(String(row.requestedPlan || "").trim()) && (
                              <button
                                type="button"
                                onClick={() => handleSendPaymentLink(row)}
                                disabled={isSending}
                                title={row.paymentLinkSentAt ? "Resend payment link" : "Send payment link"}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {row.paymentLinkSentAt ? (
                                  <RotateCw size={15} strokeWidth={2.5} />
                                ) : (
                                  <Send size={15} strokeWidth={2.5} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => { setIsViewModalOpen(false); setSelectedCompany(null); }}
        >
          <div
            data-tour="upgrade-plan-details-modal"
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Eye size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                    {selectedCompany?.companyName || "Company Details"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {statusPill(formatPlan(String(selectedCompany?.upgradeStatus || "requested").trim().toLowerCase()), {
                      Requested: { bg: "#FEF3C7", color: "#B45309" },
                      "Payment Link Sent": { bg: "#DBEAFE", color: "#1D4ED8" },
                      Active: { bg: "#D1FAE5", color: "#047857" },
                      Downgraded: { bg: "#FEE2E2", color: "#B91C1C" },
                    })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsViewModalOpen(false); setSelectedCompany(null); }}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Company Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Vertical</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany?.industry || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Name</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany?.pocName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Email</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany?.pocEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">POC Phone</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany?.pocPhone || "-"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Upgrade Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Current Plan</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatPlan(selectedCompany?.plan)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Requested Plan</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatPlan(selectedCompany?.requestedPlan)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Payment Link Sent</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatDateTime(selectedCompany?.paymentLinkSentAt)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Payment Confirmed</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatDateTime(selectedCompany?.paymentConfirmedAt)}</p>
                  </div>
                  {selectedCompany?.comment && (
                    <div className="sm:col-span-2">
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Comment</p>
                      <p className="text-[12px] font-pmedium text-slate-900">{selectedCompany.comment}</p>
                    </div>
                  )}
                </div>
              </div>

              {(normalizePlan(selectedCompany?.requestedPlan) === "custom" ||
                normalizePlan(selectedCompany?.requestedPlan) === "customise") && (
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                      Modules Requested
                    </h3>
                    {!isEditingModules && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditedModuleIds(selectedCompany?.customPlanModuleIds || []);
                          setCustomModuleEditCompany(selectedCompany);
                        }}
                        className="text-[10px] font-pmedium text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                      >
                        Add / Remove
                      </button>
                    )}
                  </div>
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3">
                    {isEditingModules ? (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {editedModuleIds.length === 0 && (
                            <p className="text-[11px] text-slate-400">No modules selected.</p>
                          )}
                          {editedModuleIds.map((id) => {
                            const row = (planPricing?.rows || []).find((r) => r.itemId === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-pmedium text-slate-700"
                              >
                                {row?.label || id}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditedModuleIds((prev) => prev.filter((m) => m !== id))
                                  }
                                  title="Remove"
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <X size={12} strokeWidth={2.5} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-100 text-[12px] font-pmedium text-blue-800">
                          <span>New Estimated Price</span>
                          <span>${computeCustomPlanPrice(editedModuleIds)}/mo</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingModules(false)}
                            className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[11px] hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRequestedModulesMutation.mutate({
                                companyId: selectedCompany.companyId,
                                customModuleIds: editedModuleIds,
                              })
                            }
                            disabled={updateRequestedModulesMutation.isPending}
                            className="flex-1 py-2 bg-[#2563EB] text-white rounded-xl font-pmedium text-[11px] hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {updateRequestedModulesMutation.isPending ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedCompany?.customPlanModuleIds || []).length === 0 ? (
                            <p className="text-[11px] text-slate-400">No modules selected.</p>
                          ) : (
                            (selectedCompany?.customPlanModuleIds || []).map((id) => {
                              const row = (planPricing?.rows || []).find((r) => r.itemId === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center rounded-full bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-pmedium text-slate-700"
                                >
                                  {row?.label || id}
                                </span>
                              );
                            })
                          )}
                        </div>
                        {(() => {
                          const breakdown = computeCustomPlanBreakdown(selectedCompany?.customPlanModuleIds || []);
                          return (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              <div className="flex items-center justify-between px-3 py-2 text-[11px] font-pmedium text-slate-700 border-b border-slate-100">
                                <span>Professional Base</span>
                                <span>${breakdown.basePriceUsd}/mo</span>
                              </div>
                              {breakdown.lineItems.map((item) => (
                                <div key={item.itemId} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] font-pmedium text-slate-700 border-b border-slate-100 last:border-b-0">
                                  <span className="min-w-0">
                                    <span className="block truncate">{item.label || item.itemId}</span>
                                    <span className="text-[9px] uppercase tracking-widest text-slate-400">{item.displayType}</span>
                                  </span>
                                  <span className="shrink-0 text-slate-900">${item.priceUsd}/mo</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-100 text-[12px] font-pmedium text-blue-800">
                          <span>Final Amount</span>
                          <span>
                            ${computeCustomPlanPrice(selectedCompany?.customPlanModuleIds || [])}/mo
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CustomPlanModulePicker
        open={Boolean(customPaymentCompany)}
        title="Send Custom Plan Payment Link"
        contactName={customPaymentCompany?.pocName}
        contactEmail={customPaymentCompany?.pocEmail}
        onClose={() => setCustomPaymentCompany(null)}
        onSubmit={(selectedModuleIds) => handleSubmitCustomPayment(selectedModuleIds)}
        isSubmitting={sendPlanPaymentLinkMutation.isPending}
        initialSelectedModuleIds={customPaymentCompany?.customPlanModuleIds || []}
      />
      <CustomPlanModulePicker
        open={Boolean(customModuleEditCompany)}
        title="Edit Custom Plan Modules"
        contactName={customModuleEditCompany?.pocName}
        contactEmail={customModuleEditCompany?.pocEmail}
        onClose={() => setCustomModuleEditCompany(null)}
        onSubmit={(selectedModuleIds) =>
          updateRequestedModulesMutation.mutate({
            companyId: customModuleEditCompany.companyId,
            customModuleIds: selectedModuleIds,
          })
        }
        isSubmitting={updateRequestedModulesMutation.isPending}
        initialSelectedModuleIds={customModuleEditCompany?.customPlanModuleIds || []}
        submitLabel="Save Modules"
        submittingLabel="Saving..."
      />
    </PageFrame>
  );
};

export default UpgradePlan;
