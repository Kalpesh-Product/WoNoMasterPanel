import React, { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });
};

const formatMoney = (amount, currency) => {
    const value = Number(amount) || 0;
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "USD").toUpperCase() }).format(value);
    } catch {
        return `${String(currency || "USD").toUpperCase()} ${value.toFixed(2)}`;
    }
};

const BOOKING_TYPE_LABELS = { MeetingRoom: "Meeting Room", CoLiving: "Co-Living", Hostel: "Hostel" };

// Every "Send Invoice to WONO" request a host has made from HostPanel's
// Website Booking tab — one row per finalized, paid website booking they
// want payout for. Read-only here; HostPanel is the only side that creates
// these (see sendInvoiceToWono in HostPanel's leadsControllers.ts).
const HostInvoices = () => {
    const { companyId: companySlug } = useParams();
    const location = useLocation();
    const axiosPrivate = useAxiosPrivate();
    const { companyId, companyName } = location?.state || {};
    const resolvedCompanyId = companyId || String(sessionStorage.getItem("companyId") || "");
    const displayName = companyName || String(sessionStorage.getItem("companyName") || companySlug || "");

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ["hostInvoices", resolvedCompanyId],
        enabled: Boolean(resolvedCompanyId),
        queryFn: async () => {
            const response = await axiosPrivate.get(
                `/api/hosts/host-companies/${resolvedCompanyId}/invoices`,
            );
            return response?.data?.invoices || [];
        },
    });

    const totalRequested = useMemo(
        () => invoices.filter((i) => i.status === "Requested").reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
        [invoices],
    );

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">
                    <div className="mb-1">
                        <h2 className="text-title font-pmedium text-primary uppercase">
                            {displayName || "Host Company"} — Invoices Sent to WONO
                        </h2>
                        <p className="text-xs font-pmedium text-slate-500 mt-1">
                            Payout requests this host has sent for finalized, paid website bookings.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-1 shrink-0">
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Total Invoices</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{invoices.length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Awaiting Payout</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{invoices.filter((i) => i.status === "Requested").length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Amount Due</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{formatMoney(totalRequested, invoices[0]?.currency)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
                            <p className="text-[11px] font-pmedium text-slate-500">
                                {invoices.length} invoice {invoices.length === 1 ? "record" : "records"}
                            </p>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                                    <tr>
                                        <th className="px-5 py-3.5">Booking Code</th>
                                        <th className="px-5 py-3.5">Booking Type</th>
                                        <th className="px-5 py-3.5">Amount</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5">Requested On</th>
                                        <th className="px-5 py-3.5">Paid On</th>
                                        <th className="px-5 py-3.5">Invoice PDF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">Loading…</td>
                                        </tr>
                                    ) : invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">No invoices sent yet.</td>
                                        </tr>
                                    ) : (
                                        invoices.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                                <td className="px-5 py-3.5 text-[12px] font-pmedium text-slate-800">{entry.bookingCode || "-"}</td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-600">{BOOKING_TYPE_LABELS[entry.bookingType] || entry.bookingType || "-"}</td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-600">{formatMoney(entry.amount, entry.currency)}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={statusPillClass(entry.status)}>{entry.status}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-500">{formatDate(entry.requestedAt)}</td>
                                                <td className="px-5 py-3.5 text-[12px] text-slate-500">{formatDate(entry.paidAt)}</td>
                                                <td className="px-5 py-3.5 text-[12px]">
                                                    {entry.invoicePdfUrl ? (
                                                        <a href={entry.invoicePdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-pmedium">View PDF</a>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
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

export default HostInvoices;
