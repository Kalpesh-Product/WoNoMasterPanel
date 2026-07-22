import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

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

const DetailRow = ({ label, value }) => (
  <div className="grid grid-cols-[150px_16px_1fr] gap-2">
    <span className="font-pmedium text-gray-700">{label}</span>
    <span className="text-gray-400">:</span>
    <span className="break-words text-gray-900">{value || "-"}</span>
  </div>
);

const WebsiteCreditRequests = () => {
  const axiosPrivate = useAxiosPrivate();
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const resolvedCompanyId = useMemo(() => {
    const stateCompanyId = String(location.state?.companyId || "").trim();
    if (stateCompanyId) return stateCompanyId;
    const storedCompanyId = String(sessionStorage.getItem("companyId") || "").trim();
    if (storedCompanyId) return storedCompanyId;
    return "";
  }, [location.state]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["website-credit-requests", resolvedCompanyId, statusFilter],
    enabled: Boolean(resolvedCompanyId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("companyId", resolvedCompanyId);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const response = await axiosPrivate.get(`/api/website-credits/requests?${params.toString()}`);
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["website-credit-requests"] });

  const { mutate: approveRequest } = useMutation({
    mutationFn: async (requestId) => axiosPrivate.patch(`/api/website-credits/requests/${requestId}/approve`),
    onSuccess: () => { toast.success("Request approved"); invalidate(); },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to approve request"),
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ requestId, reason }) =>
      axiosPrivate.patch(`/api/website-credits/requests/${requestId}/reject`, { reason }),
    onSuccess: () => { toast.success("Request rejected"); invalidate(); },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to reject request"),
  });

  const { mutate: sendPaymentLink } = useMutation({
    mutationFn: async (requestId) => axiosPrivate.patch(`/api/website-credits/requests/${requestId}/send-payment-link`, {}),
    onSuccess: () => { toast.success("Payment link email sent"); invalidate(); },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to send payment link"),
  });

  const { mutate: markPaid } = useMutation({
    mutationFn: async (requestId) => axiosPrivate.patch(`/api/website-credits/requests/${requestId}/payment-status`, { paymentStatus: "paid" }),
    onSuccess: () => { toast.success("Marked as paid"); invalidate(); },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to mark paid"),
  });

  const { mutate: addCredits } = useMutation({
    mutationFn: async (requestId) => axiosPrivate.patch(`/api/website-credits/requests/${requestId}/add-credits`),
    onSuccess: () => { toast.success("Credits added and email sent"); invalidate(); },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to add credits"),
  });

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      if (!query) return true;
      return (
        (r.companyName || r.company || r.businessName || "").toLowerCase().includes(query) ||
        (r.workspaceName || r.workspace || "").toLowerCase().includes(query)
      );
    });
  }, [requests, searchQuery]);

  const totalCount = requests.length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const getActionMenuItems = (row) => {
    const menuItems = [{ label: "View", onClick: () => { setSelectedRequest(row); setIsViewModalOpen(true); } }];
    if (row.status === "pending") {
      menuItems.push({ label: "Approve Request", onClick: () => approveRequest(row._id) });
      menuItems.push({
        label: "Reject Request",
        onClick: () => {
          const reason = window.prompt("Enter rejection reason:");
          if (!String(reason || "").trim()) return;
          rejectRequest({ requestId: row._id, reason });
        },
      });
    }
    if (row.status === "approved" && !row.paymentLinkSentAt) {
      menuItems.push({ label: "Send Payment Link", onClick: () => sendPaymentLink(row._id) });
    }
    const isPaid = row.paymentStatus === "paid" || row.paymentStatus === true;
    if (row.status === "approved" && row.paymentLinkSentAt && !isPaid) {
      menuItems.push({ label: "Mark As Paid", onClick: () => markPaid(row._id) });
    }
    if (row.status === "approved" && isPaid && !row.creditsAddedAt) {
      menuItems.push({ label: "Add Credits", onClick: () => addCredits(row._id) });
    }
    return menuItems;
  };

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">Website Credit Requests</h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">Review and manage credit requests from host companies.</p>
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
              <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Approved</p>
              <p className="text-[15px] font-pmedium text-slate-900">{approvedCount}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-red-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-red-600 uppercase tracking-widest mb-1">Rejected</p>
              <p className="text-[15px] font-pmedium text-slate-900">{rejectedCount}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {statusFilters.map((sf) => (
                <button
                  key={sf.value}
                  onClick={() => setStatusFilter(sf.value)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
                    statusFilter === sf.value
                      ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
                      : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search requests..."
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
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Workspace</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-right">Credits</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested By</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Payment Link</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Payment</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested At</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-20 text-slate-400 font-pmedium">Loading...</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-20 text-slate-400 font-pmedium">No credit requests found.</td></tr>
                ) : (
                  filteredRequests.map((row) => {
                    const isPaid = row.paymentStatus === "paid" || row.paymentStatus === true;
                    const isSent = Boolean(row.paymentLinkSentAt);
                    return (
                      <tr key={row._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 text-xs font-pmedium text-[#0F172A]">{row.companyName || row.company || row.businessName || "-"}</td>
                        <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.workspaceName || row.workspace || "-"}</td>
                        <td className="px-5 py-4 text-xs font-pmedium text-slate-600 text-right">{row.creditsRequested ?? row.requestedCredits ?? row.credits ?? "-"}</td>
                        <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.requestedBy?.name || row.requestedBy?.email || row.requestedByName || "-"}</td>
                        <td className="px-5 py-4 text-center">
                          {statusPill(String(row.status || "pending").charAt(0).toUpperCase() + String(row.status || "pending").slice(1), {
                            Pending: { bg: "#FEF3C7", color: "#B45309" },
                            Approved: { bg: "#DCFCE7", color: "#166534" },
                            Rejected: { bg: "#FEE2E2", color: "#991B1B" },
                          })}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {statusPill(isSent ? "Sent" : "Not Sent", {
                            Sent: { bg: "#DBEAFE", color: "#1D4ED8" },
                            "Not Sent": { bg: "#F3F4F6", color: "#4B5563" },
                          })}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {isPaid
                            ? statusPill("Paid", { Paid: { bg: "#DCFCE7", color: "#166534" } })
                            : isSent
                              ? statusPill("Unpaid", { Unpaid: { bg: "#FEE2E2", color: "#991B1B" } })
                              : statusPill("-", {})}
                        </td>
                        <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{formatDateTime(row.createdAt || row.requestedAt)}</td>
                        <td className="px-5 py-4 text-center">
                          <ThreeDotMenu rowId={row._id} disabled={!getActionMenuItems(row).length} menuItems={getActionMenuItems(row)} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setIsViewModalOpen(false); setSelectedRequest(null); }}>
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] w-[min(550px,92vw)] max-h-[84vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Website Credit Request Details</h2>
              <button onClick={() => { setIsViewModalOpen(false); setSelectedRequest(null); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-3 text-content">
                <DetailRow label="Company" value={selectedRequest?.companyName || selectedRequest?.company || selectedRequest?.companyId} />
                <DetailRow label="Workspace" value={selectedRequest?.workspaceName || selectedRequest?.workspace || selectedRequest?.workspaceId} />
                <DetailRow label="Credits Requested" value={selectedRequest?.creditsRequested ?? selectedRequest?.requestedCredits ?? selectedRequest?.credits} />
                <DetailRow label="Requested By" value={selectedRequest?.requestedBy?.name || selectedRequest?.requestedBy?.email || selectedRequest?.requestedByName} />
                <DetailRow label="Status" value={selectedRequest?.status} />
                <DetailRow label="Payment" value={selectedRequest?.paymentStatus === "paid" || selectedRequest?.paymentStatus === true ? "Paid" : selectedRequest?.paymentLinkSentAt ? "Unpaid" : "-"} />
                <DetailRow label="Requested At" value={formatDateTime(selectedRequest?.createdAt || selectedRequest?.requestedAt)} />
                <DetailRow label="Reviewed At" value={formatDateTime(selectedRequest?.reviewedAt || selectedRequest?.updatedAt)} />
                <DetailRow label="Credits Added" value={selectedRequest?.creditsAddedAt ? "Done" : "Pending"} />
              </div>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
};

export default WebsiteCreditRequests;
