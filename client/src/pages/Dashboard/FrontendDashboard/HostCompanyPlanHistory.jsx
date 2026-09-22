import React, { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const PLAN_LABELS = { basic: "Basic Plan", professional: "Professional Plan", custom: "Custom Plan" };

const formatLabel = (value) =>
    String(value || "-")
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });
};

const STATUS_TONE = {
    active: "bg-emerald-50 text-emerald-700",
    expiring_soon: "bg-amber-50 text-amber-700",
    expired_downgraded: "bg-red-50 text-red-600",
    none: "bg-slate-100 text-slate-500",
};

const HostCompanyPlanHistory = () => {
    const { companyId: companySlug } = useParams();
    const location = useLocation();
    const axiosPrivate = useAxiosPrivate();
    const { companyId, companyName } = location?.state || {};
    const resolvedCompanyId = companyId || String(sessionStorage.getItem("companyId") || "");
    const displayName = companyName || String(sessionStorage.getItem("companyName") || companySlug || "");

    const { data: companies = [] } = useQuery({
        queryKey: ["hostCompaniesList"],
        queryFn: async () => {
            const response = await axiosPrivate.get("/api/hosts/host-companies");
            return response.data;
        },
    });

    const company = useMemo(
        () => companies.find((c) => c.companyId === resolvedCompanyId),
        [companies, resolvedCompanyId],
    );

    const { data: historyData, isLoading } = useQuery({
        queryKey: ["hostCompanyPlanHistory", resolvedCompanyId],
        enabled: Boolean(resolvedCompanyId),
        queryFn: async () => {
            const response = await axiosPrivate.get(
                `/api/hosts/host-companies/${resolvedCompanyId}/plan-history`,
            );
            return response?.data?.history || [];
        },
    });
    const history = historyData || [];

    const planId = company?.plan || "basic";
    const planStatus = company?.planStatus || "none";

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">
                    <div className="mb-1">
                        <h2 className="text-title font-pmedium text-primary uppercase">
                            {displayName || "Host Company"} — Plan &amp; Payment History
                        </h2>
                        <p className="text-xs font-pmedium text-slate-500 mt-1">
                            Current plan and every payment attempt ever made for this company.
                        </p>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Current Plan</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{PLAN_LABELS[planId] || formatLabel(planId)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-slate-400">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-pmedium uppercase tracking-wide ${STATUS_TONE[planStatus] || STATUS_TONE.none}`}>
                                    {planStatus.replace(/_/g, " ")}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-purple-500">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-purple-600 uppercase tracking-widest mb-1">Plan Start</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{formatDate(company?.planStartDate)}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Plan End</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{formatDate(company?.planExpiryDate)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
                            <p className="text-[11px] font-pmedium text-slate-500">
                                {history.length} payment {history.length === 1 ? "record" : "records"}
                            </p>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                                    <tr>
                                        <th className="px-5 py-3.5">Plan</th>
                                        <th className="px-5 py-3.5">Type</th>
                                        <th className="px-5 py-3.5">Amount</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5">Covers</th>
                                        <th className="px-5 py-3.5">Paid / Requested</th>
                                        <th className="px-5 py-3.5 text-center">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">Loading…</td>
                                        </tr>
                                    ) : history.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">No plan payments yet.</td>
                                        </tr>
                                    ) : (
                                        history.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                                <td className="px-5 py-3.5 text-[12px] font-pmedium text-slate-800">
                                                    {PLAN_LABELS[entry.plan] || formatLabel(entry.plan)}
                                                </td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-600">{formatLabel(entry.changeType)}</td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-600">${entry.amount}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={statusPillClass(entry.status === "paid" ? "Paid" : "Pending")}>
                                                        {entry.status === "paid" ? "Paid" : "Pending"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-500">
                                                    {entry.periodStart && entry.periodEnd
                                                        ? `${formatDate(entry.periodStart)} – ${formatDate(entry.periodEnd)}`
                                                        : "-"}
                                                </td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-500">
                                                    {entry.status === "paid" ? formatDate(entry.paidAt) : formatDate(entry.createdAt)}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    {entry.hostedInvoiceUrl ? (
                                                        <a
                                                            href={entry.hostedInvoiceUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-[11px] font-pmedium text-blue-600 hover:underline"
                                                        >
                                                            <FileText size={12} />
                                                            View
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </PageFrame>
        </div>
    );
};

export default HostCompanyPlanHistory;
