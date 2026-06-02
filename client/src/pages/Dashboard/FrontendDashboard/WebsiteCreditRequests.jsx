import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip, TextField } from "@mui/material";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

const WebsiteCreditRequests = () => {
  const axiosPrivate = useAxiosPrivate();
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
    queryKey: ["website-credit-requests", resolvedCompanyId, statusFilter, fromDate, toDate],
    enabled: Boolean(resolvedCompanyId),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("companyId", resolvedCompanyId);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const response = await axiosPrivate.get(
        `/api/website-credits/requests?${params.toString()}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["website-credit-requests"] });

  const { mutate: approveRequest } = useMutation({
    mutationFn: async (requestId) =>
      axiosPrivate.patch(`/api/website-credits/requests/${requestId}/approve`),
    onSuccess: () => {
      toast.success("Request approved");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to approve request"),
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ requestId, reason }) =>
      axiosPrivate.patch(`/api/website-credits/requests/${requestId}/reject`, {
        reason,
      }),
    onSuccess: () => {
      toast.success("Request rejected");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to reject request"),
  });

  const { mutate: sendPaymentLink } = useMutation({
    mutationFn: async (requestId) =>
      axiosPrivate.patch(
        `/api/website-credits/requests/${requestId}/send-payment-link`,
        {},
      ),
    onSuccess: () => {
      toast.success("Payment link email sent");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to send payment link"),
  });

  const { mutate: markPaid } = useMutation({
    mutationFn: async (requestId) =>
      axiosPrivate.patch(`/api/website-credits/requests/${requestId}/payment-status`, {
        paymentStatus: "paid",
      }),
    onSuccess: () => {
      toast.success("Marked as paid");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to mark paid"),
  });

  const { mutate: addCredits } = useMutation({
    mutationFn: async (requestId) =>
      axiosPrivate.patch(`/api/website-credits/requests/${requestId}/add-credits`),
    onSuccess: () => {
      toast.success("Credits added and email sent");
      invalidate();
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to add credits"),
  });

  const columns = useMemo(
    () => [
      {
        field: "companyName",
        headerName: "Company",
        flex: 1,
        valueGetter: (params) =>
          params.data?.companyName ||
          params.data?.company ||
          params.data?.businessName ||
          params.data?.companyId ||
          "-",
      },
      {
        field: "workspaceName",
        headerName: "Workspace",
        flex: 1,
        valueGetter: (params) =>
          params.data?.workspaceName ||
          params.data?.workspace ||
          params.data?.workspaceTitle ||
          params.data?.workspaceId ||
          "-",
      },
      {
        field: "creditsRequested",
        headerName: "Credits Requested",
        flex: 1,
        valueGetter: (params) =>
          params.data?.creditsRequested ??
          params.data?.requestedCredits ??
          params.data?.credits ??
          params.data?.creditRequest ??
          "-",
      },
      {
        field: "requestedByName",
        headerName: "Requested By",
        flex: 1,
        valueGetter: (params) =>
          params.data?.requestedBy?.name ||
          params.data?.requestedBy?.email ||
          params.data?.requestedByName ||
          params.data?.requestedByEmail ||
          params.data?.requestBy ||
          params.data?.userName ||
          params.data?.userEmail ||
          params.data?.requestedByUserId ||
          "-",
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        cellRenderer: (params) => {
          const status = String(params.value || "pending").toLowerCase();
          const map = {
            pending: { bg: "#FEF3C7", color: "#B45309", label: "Pending" },
            approved: { bg: "#DCFCE7", color: "#166534", label: "Approved" },
            rejected: { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" },
          };
          const style = map[status] || map.pending;
          return (
            <Chip
              label={style.label}
              size="small"
              sx={{ backgroundColor: style.bg, color: style.color, fontWeight: 600 }}
            />
          );
        },
      },
      {
        field: "paymentLink",
        headerName: "Payment Link",
        flex: 1,
        valueGetter: (params) => {
          const row = params.data || {};
          return row.paymentLinkSentAt ? "Sent" : "Not Sent";
        },
        cellRenderer: (params) => {
          const value = String(params.value || "Not Sent");
          const map = {
            Sent: { bg: "#DBEAFE", color: "#1D4ED8" },
            "Not Sent": { bg: "#F3F4F6", color: "#4B5563" },
          };
          const style = map[value] || map["Not Sent"];
          return (
            <Chip
              label={value}
              size="small"
              sx={{ backgroundColor: style.bg, color: style.color, fontWeight: 600 }}
            />
          );
        },
      },
      {
        field: "payment",
        headerName: "Payment",
        flex: 1,
        valueGetter: (params) => {
          const row = params.data || {};
          if (row.paymentStatus === "paid") return "Paid";
          if (row.paymentStatus === true) return "Paid";
          if (row.paymentLinkSentAt) return "Unpaid";
          return "-";
        },
        cellRenderer: (params) => {
          const value = String(params.value || "-");
          const map = {
            Paid: { bg: "#DCFCE7", color: "#166534" },
            Unpaid: { bg: "#FEE2E2", color: "#991B1B" },
            "-": { bg: "#F3F4F6", color: "#4B5563" },
          };
          const style = map[value] || map["-"];
          return (
            <Chip
              label={value}
              size="small"
              sx={{ backgroundColor: style.bg, color: style.color, fontWeight: 600 }}
            />
          );
        },
      },
      {
        field: "requestedAt",
        headerName: "Requested At",
        flex: 1,
        valueGetter: (params) =>
          formatDateTime(
            params.data?.createdAt ||
              params.data?.requestedAt ||
              params.data?.requestDate ||
              params.data?.date,
          ),
      },
      {
        field: "reviewedAt",
        headerName: "Reviewed At",
        flex: 1,
        valueGetter: (params) =>
          formatDateTime(params.data?.reviewedAt || params.data?.updatedAt),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        cellRenderer: (params) => {
          const row = params.data || {};
          const menuItems = [];

          menuItems.push({
            label: "View",
            onClick: () => {
              setSelectedRequest(row);
              setIsViewModalOpen(true);
            },
          });

          if (row.status === "pending") {
            menuItems.push({
              label: "Approve Request",
              onClick: () => approveRequest(row._id),
            });
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
            menuItems.push({
              label: "Send Payment Link",
              onClick: () => sendPaymentLink(row._id),
            });
          }

          const isPaid = row.paymentStatus === "paid" || row.paymentStatus === true;

          if (row.status === "approved" && row.paymentLinkSentAt && !isPaid) {
            menuItems.push({
              label: "Mark As Paid",
              onClick: () => markPaid(row._id),
            });
          }

          if (row.status === "approved" && isPaid && !row.creditsAddedAt) {
            menuItems.push({
              label: "Add Credits",
              onClick: () => addCredits(row._id),
            });
          }

          return (
            <ThreeDotMenu
              rowId={row._id}
              disabled={!menuItems.length}
              menuItems={menuItems}
            />
          );
        },
      },
    ],
        [addCredits, approveRequest, markPaid, rejectRequest, sendPaymentLink],
  );

  return (
    <div className="p-4">
      <PageFrame>
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            SelectProps={{ native: true }}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From Date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </div>

        {!isLoading && (!Array.isArray(requests) || requests.length === 0) ? (
          <div className="h-[420px] w-full flex items-center justify-center rounded-lg border border-gray-200 text-gray-500">
            No record data
          </div>
        ) : (
          <AgTable
            data={requests}
            columns={columns}
            search
            tableTitle="Website Credit Requests"
            tableHeight={500}
            filterExcludeColumns={["actions", "status"]}
            loading={isLoading}
          />
        )}
      </PageFrame>

      <MuiModal
        open={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedRequest(null);
        }}
        title="Website Credit Request Details"
      >
        <div className="flex flex-col gap-3 text-content">
          <DetailRow
            label="Company"
            value={
              selectedRequest?.companyName ||
              selectedRequest?.company ||
              selectedRequest?.businessName ||
              selectedRequest?.companyId
            }
          />
          <DetailRow
            label="Workspace"
            value={
              selectedRequest?.workspaceName ||
              selectedRequest?.workspace ||
              selectedRequest?.workspaceTitle ||
              selectedRequest?.workspaceId
            }
          />
          <DetailRow
            label="Credits Requested"
            value={
              selectedRequest?.creditsRequested ??
              selectedRequest?.requestedCredits ??
              selectedRequest?.credits ??
              selectedRequest?.creditRequest
            }
          />
          <DetailRow
            label="Requested By"
            value={
              selectedRequest?.requestedBy?.name ||
              selectedRequest?.requestedBy?.email ||
              selectedRequest?.requestedByName ||
              selectedRequest?.requestedByEmail ||
              selectedRequest?.requestBy ||
              selectedRequest?.userName ||
              selectedRequest?.userEmail ||
              selectedRequest?.requestedByUserId
            }
          />
          <DetailRow label="Status" value={selectedRequest?.status} />
          <DetailRow
            label="Payment"
            value={
              selectedRequest?.paymentStatus === "paid" ||
              selectedRequest?.paymentStatus === true
                ? "Paid"
                : selectedRequest?.paymentLinkSentAt
                ? "Unpaid"
                : "-"
            }
          />
          <DetailRow
            label="Requested At"
            value={formatDateTime(
              selectedRequest?.createdAt ||
                selectedRequest?.requestedAt ||
                selectedRequest?.requestDate ||
                selectedRequest?.date,
            )}
          />
          <DetailRow
            label="Reviewed At"
            value={formatDateTime(selectedRequest?.reviewedAt || selectedRequest?.updatedAt)}
          />
          <DetailRow
            label="Credits Added"
            value={selectedRequest?.creditsAddedAt ? "Done" : "Pending"}
          />
        </div>
      </MuiModal>
    </div>
  );
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const DetailRow = ({ label, value }) => (
  <div className="grid grid-cols-[150px_16px_1fr] gap-2">
    <span className="font-pmedium text-gray-700">{label}</span>
    <span className="text-gray-400">:</span>
    <span className="break-words text-gray-900">{value || "-"}</span>
  </div>
);

export default WebsiteCreditRequests;
