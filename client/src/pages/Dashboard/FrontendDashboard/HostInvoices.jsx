import React, { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const InvoiceRow = ({ entry, companyId }) => {
    const bookings = Array.isArray(entry.bookings) ? entry.bookings : [];
    const axiosPrivate = useAxiosPrivate();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [paymentReference, setPaymentReference] = useState("");
    const [notes, setNotes] = useState("");

    const markPaidMutation = useMutation({
        mutationFn: async () => {
            const response = await axiosPrivate.patch(
                `/api/hosts/host-companies/${companyId}/invoices/${entry._id}/mark-paid`,
                { paymentReference: paymentReference.trim(), notes: notes.trim() },
            );
            return response?.data;
        },
        onSuccess: () => {
            toast.success("Invoice marked as paid");
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["hostInvoices", companyId] });
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || "Failed to mark invoice as paid");
        },
    });

    return (
        <tr className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 align-top">
            <td className="px-5 py-3.5 text-[12px] text-slate-700">
                {bookings.length} booking{bookings.length === 1 ? "" : "s"}
            </td>
            <td className="px-5 py-3.5 text-[13px] font-pmedium text-slate-800">{formatMoney(entry.amount, entry.currency)}</td>
            <td className="px-5 py-3.5">
                <span className={statusPillClass(entry.status)}>{entry.status}</span>
            </td>
            <td className="px-5 py-3.5 text-[12px] text-slate-500">{formatDate(entry.requestedAt)}</td>
            <td className="px-5 py-3.5 text-[12px] text-slate-500">
                {formatDate(entry.paidAt)}
                {entry.paymentReference ? (
                    <p className="text-[11px] text-slate-400 mt-0.5">Ref: {entry.paymentReference}</p>
                ) : null}
            </td>
            <td className="px-5 py-3.5 text-[12px]">
                {entry.invoicePdfUrl ? (
                    <a href={entry.invoicePdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-pmedium">View PDF</a>
                ) : (
                    <span className="text-slate-400">-</span>
                )}
            </td>
            <td className="px-5 py-3.5 text-[12px]">
                {entry.status !== "Requested" ? (
                    <span className="text-slate-400">-</span>
                ) : !showForm ? (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-pmedium hover:bg-blue-700 transition-colors"
                    >
                        Mark as Paid
                    </button>
                ) : (
                    <div className="flex flex-col gap-1.5 w-56">
                        <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Bank reference / UTR (required)"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                disabled={!paymentReference.trim() || markPaidMutation.isPending}
                                onClick={() => markPaidMutation.mutate()}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-pmedium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {markPaidMutation.isPending ? "Saving..." : "Confirm"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-pmedium hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </td>
        </tr>
    );
};

// Every consolidated "Request Payout" a host has made from HostPanel's
// Website Leads page — ONE request bundles every booking that was paid and
// unbilled at the time (not one request per booking, see sendInvoiceToWono
// in HostPanel's leadsControllers.ts). Read-only here; HostPanel is the
// only side that creates these.
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
    const totalBookings = useMemo(
        () => invoices.reduce((sum, i) => sum + (Array.isArray(i.bookings) ? i.bookings.length : 0), 0),
        [invoices],
    );

    return (
        <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
            <PageFrame>
                <div className="flex flex-col gap-4">
                    <div className="mb-1">
                        <h2 className="text-title font-pmedium text-primary uppercase">
                            {displayName || "Host Company"} — Payout Requests
                        </h2>
                        <p className="text-xs font-pmedium text-slate-500 mt-1">
                            Consolidated payout requests this host has sent, each bundling every booking paid and unbilled at the time.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Payout Requests</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{invoices.length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-indigo-500">
                            <div className="min-w-0">
                                <p className="text-[10px] font-pmedium text-indigo-600 uppercase tracking-widest mb-1">Bookings Covered</p>
                                <p className="text-[15px] font-pmedium text-slate-900">{totalBookings}</p>
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
                                {invoices.length} payout {invoices.length === 1 ? "request" : "requests"}
                            </p>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                                    <tr>
                                        <th className="px-5 py-3.5">Bookings</th>
                                        <th className="px-5 py-3.5">Total Amount</th>
                                        <th className="px-5 py-3.5">Status</th>
                                        <th className="px-5 py-3.5">Requested On</th>
                                        <th className="px-5 py-3.5">Paid On</th>
                                        <th className="px-5 py-3.5">Invoice PDF</th>
                                        <th className="px-5 py-3.5">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">Loading…</td>
                                        </tr>
                                    ) : invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400 font-pmedium">No payout requests yet.</td>
                                        </tr>
                                    ) : (
                                        invoices.map((entry) => (
                                            <InvoiceRow key={entry._id} entry={entry} companyId={resolvedCompanyId} />
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
