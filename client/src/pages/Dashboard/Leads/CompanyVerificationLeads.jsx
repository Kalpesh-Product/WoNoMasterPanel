import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { toast } from "sonner";
import {
  Search,
  Eye,
  ShieldCheck,
  Clock,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";
import PageFrame from "../../../components/Pages/PageFrame";
import VerificationLeadDetailModal from "../../../components/VerificationLeadDetailModal";
import {
  TIER_LABELS,
  formatDate,
  getInitials,
  getPaymentInfo,
} from "../../../constants/verificationTiers";

const STATUSES = ["pending", "approved", "rejected"];

const CompanyVerificationLeads = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewLead, setViewLead] = useState(null);

  const { data: leads = [], isPending } = useQuery({
    queryKey: ["company-verification-leads"],
    queryFn: async () => {
      const response = await axios.get("/api/company-verification-leads");
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }) => {
      const res = await axios.patch(
        `/api/company-verification-leads/${id}/status`,
        { status, rejectionReason },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-verification-leads"],
      });
      toast.success("Lead updated");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "Update failed"),
  });

  // Approving no longer auto-sends the payment link email — staff click the
  // "Send Payment Link" button below (which this same mutation backs) once
  // they're actually ready for the customer to get it. Everything after the
  // first payment (renew, change plan) lives on the Companies Verified page.
  const sendPaymentLinkMutation = useMutation({
    mutationFn: async ({ id, tier }) => {
      const res = await axios.post(
        `/api/company-verification-leads/${id}/send-payment-link`,
        { tier },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-verification-leads"],
      });
      toast.success("Payment link email sent");
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message || "Failed to send payment link",
      ),
  });

  const handleStatusChange = (id, status) => {
    if (status === "rejected") {
      // The host sees this reason in HostPanel's Verify Business > Status tab
      // so they know what to fix before resubmitting.
      const reason = window.prompt(
        "Reason for rejection (shown to the host so they can fix and resubmit):",
      );
      if (reason === null) return;
      if (!reason.trim()) {
        toast.error("A rejection reason is required");
        return;
      }
      updateMutation.mutate({ id, status, rejectionReason: reason.trim() });
      return;
    }
    updateMutation.mutate({ id, status });
  };

  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter(
      (l) => (l.status || "pending") === "pending",
    ).length;
    const approved = leads.filter((l) => l.status === "approved").length;
    const rejected = leads.filter((l) => l.status === "rejected").length;
    const last30Days = leads.filter((l) => {
      if (!l.createdAt) return false;
      const days = (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length;
    return { total, pending, approved, rejected, last30Days };
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "All" || (lead.status || "pending") === statusFilter;
      const matchesQuery =
        !q ||
        [
          lead.fullName,
          lead.email,
          lead.mobile,
          lead.companyName,
          lead.businessName,
          lead.registeredCompanyName,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [leads, search, statusFilter]);

  const pageHeading = (
    <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
      <div>
        <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
          Company Verification Leads
        </h2>
        <p className="text-xs font-pmedium text-slate-500 mt-1">
          Review business verification requests submitted from the Nomads
          site and approve or reject them. Once verified and paid, a company
          moves to Companies Verified for ongoing plan management.
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              {[
                {
                  label: "Total Requests",
                  value: stats.total,
                  icon: ShieldCheck,
                  accent: "border-l-slate-400",
                  textColor: "text-slate-500",
                  bgColor: "bg-slate-50",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  icon: Clock,
                  accent: "border-l-amber-500",
                  textColor: "text-amber-600",
                  bgColor: "bg-amber-50",
                },
                {
                  label: "Approved",
                  value: stats.approved,
                  icon: CheckCircle2,
                  accent: "border-l-emerald-500",
                  textColor: "text-emerald-600",
                  bgColor: "bg-emerald-50",
                },
                {
                  label: "Rejected",
                  value: stats.rejected,
                  icon: XCircle,
                  accent: "border-l-rose-500",
                  textColor: "text-rose-600",
                  bgColor: "bg-rose-50",
                },
                {
                  label: "Last 30 Days",
                  value: stats.last30Days,
                  icon: CalendarClock,
                  accent: "border-l-blue-500",
                  textColor: "text-blue-600",
                  bgColor: "bg-blue-50",
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}
                  >
                    <div>
                      <p
                        className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${s.textColor}`}
                      >
                        {s.label}
                      </p>
                      <p className="text-[15px] font-pmedium text-slate-900">
                        {s.value}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl p-2 ${s.bgColor} ${s.textColor}`}
                    >
                      <Icon size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
                <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                  {["All", ...STATUSES].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${statusFilter === s ? "bg-[#2563EB] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="relative max-w-sm">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                  />
                  <input
                    type="text"
                    placeholder="Search name, email, business..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <ShieldCheck size={28} />
                  </div>
                  <p className="text-slate-400 font-semibold font-pmedium">
                    No matching requests found.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left min-w-[1000px]">
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-5 py-4">Submitted By</th>
                        <th className="px-5 py-4">Business</th>
                        <th className="px-5 py-4">Plan</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Payment</th>
                        <th className="px-5 py-4">Submitted</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {filtered.map((lead) => {
                        const statusVal = (
                          lead.status || "pending"
                        ).toLowerCase();
                        return (
                          <tr
                            key={lead._id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                  {getInitials(lead.fullName)}
                                </div>
                                <div>
                                  <p className="text-[12px] font-pmedium text-slate-900 truncate max-w-[160px]">
                                    {lead.fullName || "--"}
                                  </p>
                                  <p className="text-[10px] font-pmedium text-slate-500 truncate max-w-[160px]">
                                    {lead.email || ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]"
                              title={lead.businessName || lead.companyName}
                            >
                              {lead.businessName || lead.companyName || "--"}
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-blue-50 text-blue-700">
                                {TIER_LABELS[lead.requestedTier] ||
                                  lead.requestedTier}{" "}
                                · ${lead.requestedAmountUsd}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={statusVal}
                                onChange={(e) =>
                                  handleStatusChange(lead._id, e.target.value)
                                }
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${statusPillClass(statusVal)}`}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              {(() => {
                                const paymentInfo = getPaymentInfo(lead);
                                return (
                                  <span
                                    className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium whitespace-nowrap ${paymentInfo.tone}`}
                                  >
                                    {paymentInfo.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600">
                              {formatDate(lead.createdAt)}
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
                                {statusVal === "approved" && (
                                  <button
                                    type="button"
                                    disabled={
                                      lead.paymentStatus === "paid" ||
                                      sendPaymentLinkMutation.isPending
                                    }
                                    onClick={() =>
                                      sendPaymentLinkMutation.mutate({
                                        id: lead._id,
                                        tier: lead.requestedTier,
                                      })
                                    }
                                    title={
                                      lead.paymentStatus === "paid"
                                        ? "Already paid — see Payment column"
                                        : "Send payment link"
                                    }
                                    className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                  >
                                    <Send size={15} strokeWidth={2.5} />
                                  </button>
                                )}
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
        />
      )}
    </>
  );
};

export default CompanyVerificationLeads;
