import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import useAuth from "../../../hooks/useAuth";
import { queryClient } from "../../../main";

const DEFAULT_TEST_PAYMENT_LINK = "https://example.com/test-payment-link";

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

const DetailRow = ({ label, value }) => (
  <div className="grid grid-cols-[140px_16px_1fr] gap-2 text-content">
    <span className="font-pmedium text-gray-700">{label}</span>
    <span className="text-gray-400">:</span>
    <span className="break-words text-gray-900">{value || "-"}</span>
  </div>
);

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
  const [paymentLinks, setPaymentLinks] = useState({});
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    "savita.wono@gmail.com",
    "gourish.wono@gmail.com",
  ];
  const companiesAccessAllowedEmails = [
    "gourish.wono@gmail.com",
    "savita.wono@gmail.com",
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
  });

  useEffect(() => {
    setPaymentLinks((prev) => {
      const next = { ...prev };
      companies.forEach((company) => {
        if (!next[company.companyId]) {
          next[company.companyId] = company.paymentLinkUrl || DEFAULT_TEST_PAYMENT_LINK;
        }
      });
      return next;
    });
  }, [companies]);

  const updateCompaniesCache = (updater) => {
    queryClient.setQueryData(["hostCompaniesList"], (oldCompanies = []) =>
      oldCompanies.map((company) => updater(company)),
    );
  };

  const { mutate: sendPaymentLink, isPending: isSendingPaymentLink } = useMutation({
    mutationFn: async (company) => {
      const paymentLinkUrl = paymentLinks[company.companyId] || DEFAULT_TEST_PAYMENT_LINK;
      await axiosPrivate.patch("/api/hosts/send-upgrade-payment-link", {
        companyId: company.companyId,
        paymentLinkUrl,
      });
      const response = await axiosPrivate.post(
        "/api/host-user/send-upgrade-payment-link-email",
        {
          email: company?.pocEmail,
          name: company?.pocName,
          companyName: company?.companyName,
          currentPlan: company?.plan,
          selectedPlan: company?.requestedPlan || company?.plan,
          paymentLinkUrl,
        },
      );
      return { response: response.data, company, paymentLinkUrl };
    },
    onMutate: async (company) => {
      await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });
      const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
      const paymentLinkUrl = paymentLinks[company.companyId] || DEFAULT_TEST_PAYMENT_LINK;
      const paymentLinkSentAt = new Date().toISOString();
      updateCompaniesCache((row) =>
        row.companyId === company.companyId
          ? { ...row, paymentLinkUrl, paymentLinkSentAt, upgradeStatus: "payment_link_sent" }
          : row,
      );
      return { previousCompanies };
    },
    onSuccess: ({ response }) => {
      toast.success(response?.message || "Payment link email sent successfully");
    },
    onError: (error, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
      }
      toast.error(error?.response?.data?.message || "Failed to send payment link email");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
    },
  });

  const { mutate: updatePaymentStatus } = useMutation({
    mutationFn: async ({ companyId, paymentStatus }) => {
      const response = await axiosPrivate.patch(
        "/api/hosts/update-upgrade-payment-status",
        { companyId, paymentStatus },
      );
      return response.data;
    },
    onMutate: async ({ companyId, paymentStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });
      const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
      const paymentConfirmedAt = paymentStatus ? new Date().toISOString() : null;
      updateCompaniesCache((company) =>
        company.companyId === companyId
          ? {
              ...company,
              paymentStatus,
              paymentConfirmedAt,
              plan: paymentStatus
                ? String(company.requestedPlan || company.plan || "").trim().toLowerCase() || company.plan
                : company.plan,
              upgradeStatus: paymentStatus
                ? "paid"
                : company.paymentLinkSentAt
                  ? "payment_link_sent"
                  : "requested",
            }
          : company,
      );
      return { previousCompanies };
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Payment status updated");
    },
    onError: (error, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
      }
      toast.error(error?.response?.data?.message || "Failed to update payment status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
    },
  });

  const { mutate: sendUpgradeSuccess, isPending: isSendingUpgradeSuccess } = useMutation({
    mutationFn: async (company) => {
      await axiosPrivate.post("/api/host-user/send-upgrade-success-email", {
        email: company?.pocEmail,
        name: company?.pocName,
        companyId: company?.companyId,
        companyName: company?.companyName,
        selectedPlan: company?.requestedPlan || company?.plan,
      });
      const response = await axiosPrivate.patch(
        "/api/hosts/mark-upgrade-success-email-sent",
        { companyId: company.companyId },
      );
      return { response: response.data, company };
    },
    onMutate: async (company) => {
      await queryClient.cancelQueries({ queryKey: ["hostCompaniesList"] });
      const previousCompanies = queryClient.getQueryData(["hostCompaniesList"]);
      const upgradeSuccessSentAt = new Date().toISOString();
      updateCompaniesCache((row) =>
        row.companyId === company.companyId
          ? { ...row, upgradeSuccessSentAt, upgradeStatus: "upgraded" }
          : row,
      );
      return { previousCompanies };
    },
    onSuccess: ({ response }) => {
      toast.success(response?.message || "Upgrade success email sent successfully");
    },
    onError: (error, _variables, context) => {
      if (context?.previousCompanies) {
        queryClient.setQueryData(["hostCompaniesList"], context.previousCompanies);
      }
      toast.error(error?.response?.data?.message || "Failed to send upgrade success email");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["hostCompaniesList"] });
    },
  });

  const handlePaymentLinkChange = (companyId, value) => {
    setPaymentLinks((prev) => ({ ...prev, [companyId]: value }));
  };

  const handleViewCompany = (company) => {
    setSelectedCompany(company);
    setIsViewModalOpen(true);
  };

  const normalizePlan = (value) =>
    String(value || "").trim().toLowerCase();

  const sortedCompanies = useMemo(
    () =>
      companies
        .filter((company) => String(company?.companyId || "").trim() === resolvedCompanyId)
        .filter((company) => Boolean(normalizePlan(company?.requestedPlan)))
        .sort((a, b) => {
          const aDone = Boolean(a?.upgradeSuccessSentAt);
          const bDone = Boolean(b?.upgradeSuccessSentAt);
          if (aDone !== bDone) return aDone ? 1 : -1;
          if (a.paymentStatus === b.paymentStatus) return 0;
          return a.paymentStatus ? -1 : 1;
        }),
    [companies, resolvedCompanyId],
  );

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortedCompanies.filter((c) => {
      if (!query) return true;
      return (
        (c.companyName || "").toLowerCase().includes(query) ||
        (c.industry || "").toLowerCase().includes(query) ||
        formatPlan(c.plan).toLowerCase().includes(query) ||
        formatPlan(c.requestedPlan).toLowerCase().includes(query)
      );
    });
  }, [sortedCompanies, searchQuery]);

  const totalCount = sortedCompanies.length;
  const paidCount = sortedCompanies.filter((c) => c.paymentStatus === true).length;
  const pendingCount = sortedCompanies.filter((c) => !c.paymentStatus).length;
  const upgradedCount = sortedCompanies.filter((c) => c.upgradeStatus === "upgraded").length;

  const getActionMenuItems = (row) => {
    const hasRequestedPlan = Boolean(String(row.requestedPlan || "").trim());
    const isAlreadySent = Boolean(row.paymentLinkSentAt);
    const canSend = row.paymentStatus === true;
    const isSuccessSent = Boolean(row.upgradeSuccessSentAt);
    const canUpdatePayment = Boolean(row.paymentLinkSentAt) && row.paymentStatus !== true;
    const menuItems = [];

    if (!isAlreadySent && hasRequestedPlan) {
      menuItems.push({
        label: "Send Payment Link",
        disabled: isSendingPaymentLink,
        onClick: () => sendPaymentLink(row),
      });
    } else if (canUpdatePayment) {
      menuItems.push({
        label: "Mark As Paid",
        disabled: false,
        onClick: () => updatePaymentStatus({ companyId: row.companyId, paymentStatus: true }),
      });
    } else if (canSend && !isSuccessSent) {
      if (row.workspacePlanApplied) {
        menuItems.push({
          label: "Send Success Email",
          disabled: isSendingUpgradeSuccess,
          onClick: () => sendUpgradeSuccess(row),
        });
      } else {
        menuItems.push({
          label: "Workspace plan not synced — re-confirm payment",
          disabled: true,
          onClick: () => {},
        });
      }
    }
    return menuItems;
  };

  if (isLoading) return <div className="p-6">Loading host companies...</div>;
  if (isError) return <div className="p-6 text-red-500">Failed to load companies.</div>;

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">Upgrade Plan</h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Manage payment links and upgrade workflows for host companies.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
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
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-purple-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-purple-600 uppercase tracking-widest mb-1">Upgraded</p>
              <p className="text-[15px] font-pmedium text-slate-900">{upgradedCount}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
            <div />
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search companies..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Vertical</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Current Plan</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested Plan</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Payment Link</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Payment</th>
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
                  filteredCompanies.map((row) => {
                    const isSent = Boolean(row.paymentLinkSentAt);
                    const isPaid = row.paymentStatus === true;
                    const upgradeStatus = String(row.upgradeStatus || "requested").trim().toLowerCase();

                    return (
                      <tr key={row.companyId} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 align-top">
                          <div className="font-pmedium text-[#0F172A] text-[13px]">{row.companyName || "-"}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.industry || "-"}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{formatPlan(row.plan)}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{formatPlan(row.requestedPlan)}</td>
                        <td className="px-5 py-4 align-top text-center">
                          {statusPill(isSent ? "Sent" : "Not Sent", {
                            Sent: { bg: "#DBEAFE", color: "#1D4ED8" },
                            "Not Sent": { bg: "#F3F4F6", color: "#4B5563" },
                          })}
                        </td>
                        <td className="px-5 py-4 align-top text-center">
                          {statusPill(isPaid ? "Paid" : "Unpaid", {
                            Paid: { bg: "#D1FAE5", color: "#10B981" },
                            Unpaid: { bg: "#FEE2E2", color: "#EF4444" },
                          })}
                        </td>
                        <td className="px-5 py-4 align-top text-center">
                          {statusPill(formatPlan(upgradeStatus), {
                            Requested: { bg: "#FEF3C7", color: "#B45309" },
                            "Payment Link Sent": { bg: "#DBEAFE", color: "#1D4ED8" },
                            Paid: { bg: "#D1FAE5", color: "#047857" },
                            Upgraded: { bg: "#E9D5FF", color: "#7C3AED" },
                          })}
                        </td>
                        <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewCompany(row)}
                              title="View details"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                            >
                              <Eye size={15} strokeWidth={2.5} />
                            </button>
                            <ThreeDotMenu
                              rowId={row.companyId}
                              disabled={!getActionMenuItems(row).length}
                              menuItems={getActionMenuItems(row)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { setIsViewModalOpen(false); setSelectedCompany(null); }}
        >
          <div
            className="rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] w-[min(650px,92vw)] max-h-[84vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10">
                  <Eye size={18} className="text-[#2563EB]" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Upgrade Plan Details</h2>
              </div>
              <button
                onClick={() => { setIsViewModalOpen(false); setSelectedCompany(null); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-4">
                <h2 className="text-subtitle font-pmedium text-gray-800">Company Details</h2>
                <DetailRow label="Company Name" value={selectedCompany?.companyName} />
                <DetailRow label="Vertical" value={selectedCompany?.industry} />
                <DetailRow label="POC Name" value={selectedCompany?.pocName} />
                <DetailRow label="POC Email" value={selectedCompany?.pocEmail} />
                <DetailRow label="POC Phone" value={selectedCompany?.pocPhone} />
                <hr className="border-borderGray my-1" />
                <h2 className="text-subtitle font-pmedium text-gray-800">Upgrade Details</h2>
                <DetailRow label="Current Plan" value={formatPlan(selectedCompany?.plan)} />
                <DetailRow label="Requested Plan" value={formatPlan(selectedCompany?.requestedPlan)} />
                <DetailRow label="Payment Status" value={selectedCompany?.paymentStatus ? "Paid" : "Unpaid"} />
                <DetailRow label="Upgrade Status" value={formatPlan(selectedCompany?.upgradeStatus)} />
                <DetailRow label="Trial Start" value={formatDateTime(selectedCompany?.trialStartAt)} />
                <DetailRow label="Trial End" value={formatDateTime(selectedCompany?.trialEndAt)} />
                <DetailRow label="Subscription Status" value={formatPlan(selectedCompany?.subscriptionStatus)} />
                <DetailRow label="Payment Link" value={selectedCompany?.paymentLinkUrl || paymentLinks[selectedCompany?.companyId]} />
                <DetailRow label="Payment Link Sent" value={formatDateTime(selectedCompany?.paymentLinkSentAt)} />
                <DetailRow label="Payment Confirmed" value={formatDateTime(selectedCompany?.paymentConfirmedAt)} />
                <DetailRow label="Success Email Sent" value={formatDateTime(selectedCompany?.upgradeSuccessSentAt)} />
                <DetailRow label="Comment" value={selectedCompany?.comment} />
              </div>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
};

export default UpgradePlan;
