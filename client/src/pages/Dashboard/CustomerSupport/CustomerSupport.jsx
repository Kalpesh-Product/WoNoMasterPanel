import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip } from "@mui/material";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import MuiModal from "../../../components/MuiModal";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import DetalisFormatted from "../../../components/DetalisFormatted";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
};

const getFullName = (user) => {
  if (!user) return "-";

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.email || "-";
};

const getStatusValue = (item) => item?.status || item?.ticket?.status || "-";

const statusColorMap = {
  Open: { backgroundColor: "#E6E6FA", color: "#4B0082" },
  "In Progress": { backgroundColor: "#ADD8E6", color: "#00008B" },
  Closed: { backgroundColor: "#90EE90", color: "#006400" },
  Pending: { backgroundColor: "#FFECC5", color: "#CC8400" },
  Escalated: { backgroundColor: "#FECACA", color: "#B91C1C" },
  Rejected: { backgroundColor: "#E5E7EB", color: "#4B5563" },
};

const supportStatuses = [
  "Open",
  "In Progress",
  "Pending",
  "Escalated",
  "Rejected",
  "Closed",
];

const CustomerSupport = () => {
  const axios = useAxiosPrivate();
  const [openView, setOpenView] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const { data = [], isPending, isError } = useQuery({
    queryKey: ["dashboard-customer-support"],
    queryFn: async () => {
      const response = await axios.get("/api/tickets/support-tickets");
      return Array.isArray(response?.data) ? response.data : [];
    },
  });

  const { mutate: updateStatus, isPending: isStatusUpdating } = useMutation({
    mutationKey: ["dashboard-customer-support-status"],
    mutationFn: async ({ supportTicketId, status }) => {
      const response = await axios.patch(
        `/api/tickets/support-tickets/${supportTicketId}/status`,
        { status }
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Status updated");
      queryClient.invalidateQueries({ queryKey: ["dashboard-customer-support"] });
      queryClient.invalidateQueries({ queryKey: ["supported-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-data"] });
      if (selectedTicket && data?.data?._id === selectedTicket.supportTicketId) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, ticketStatus: data.data.status } : prev
        );
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
  });

  const tableData = useMemo(
    () =>
      data.map((item, index) => ({
        id: item?.ticket?._id || index,
        supportTicketId: item?._id || "",
        srNo: index + 1,
        ticketNumber: item?.ticketId || item?.ticket?.ticket || "-",
        title: item?.title || item?.ticket?.ticket || "-",
        description: item?.description || "-",
        companyName:
          item?.companyName ||
          item?.company?.companyName ||
          item?.ticket?.company?.companyName ||
          "-",
        role: item?.role || "-",
        department: item?.department || item?.ticket?.raisedToDepartment?.name || "-",
        acceptedBy: getFullName(item?.acceptedBy || item?.ticket?.acceptedBy),
        requestedAt: formatDateTime(item?.requestedAt || item?.createdAt),
        ticketStatus: getStatusValue(item),
        image: item?.image?.url || "",
        requestedBy: getFullName(item?.requestedBy || item?.user),
        resolvedBy: getFullName(item?.resolvedBy || item?.ticket?.closedBy),
        resolvedAt: formatDateTime(item?.resolvedAt),
      })),
    [data],
  );

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setOpenView(true);
  };

  const columns = useMemo(
    () => [
      { field: "srNo", headerName: "Sr No", width: 90 },
      { field: "ticketNumber", headerName: "Ticket ID", minWidth: 140 },
      { field: "title", headerName: "Title", minWidth: 180 },
      { field: "companyName", headerName: "Company Name", minWidth: 180 },
      { field: "department", headerName: "Department", minWidth: 160 },
      { field: "acceptedBy", headerName: "Accepted By", minWidth: 180 },
      {
        field: "ticketStatus",
        headerName: "Status",
        minWidth: 150,
        cellRenderer: (params) => {
          const statusStyle = statusColorMap[params.value] || {
            backgroundColor: "#E5E7EB",
            color: "#374151",
          };

          return (
            <Chip
              label={params.value}
              size="small"
              style={statusStyle}
            />
          );
        },
      },
      { field: "requestedAt", headerName: "Requested At", minWidth: 190 },
      { field: "requestedBy", headerName: "Requested By", minWidth: 180 },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 110,
        pinned: "right",
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={params.data.supportTicketId}
            isLoading={isStatusUpdating}
            menuItems={[
              {
                label: "View",
                onClick: () => handleView(params.data),
              },
              ...supportStatuses.map((status) => ({
                label: `Status: ${status}`,
                onClick: () =>
                  updateStatus({
                    supportTicketId: params.data.supportTicketId,
                    status,
                  }),
                disabled: params.data.ticketStatus === status,
              })),
            ]}
          />
        ),
      },
    ],
    [isStatusUpdating],
  );

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load customer support data.</div>;
  }

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={tableData}
          columns={columns}
          search
          tableTitle="Customer Support"
          tableHeight={500}
          loading={isPending}
        />
      </PageFrame>

      <MuiModal
        open={openView}
        onClose={() => setOpenView(false)}
        title="Customer Support Details"
      >
        <div className="flex flex-col gap-3">
          <DetalisFormatted title="Ticket ID" detail={selectedTicket?.ticketNumber} />
          <DetalisFormatted title="Title" detail={selectedTicket?.title} />
          <DetalisFormatted title="Description" detail={selectedTicket?.description} />
          <DetalisFormatted title="Company Name" detail={selectedTicket?.companyName} />
          <DetalisFormatted title="Role" detail={selectedTicket?.role} />
          <DetalisFormatted title="Department" detail={selectedTicket?.department} />
          <DetalisFormatted title="Accepted By" detail={selectedTicket?.acceptedBy} />
          <DetalisFormatted title="Requested At" detail={selectedTicket?.requestedAt} />
          <DetalisFormatted title="Status" detail={selectedTicket?.ticketStatus} />
          <DetalisFormatted title="Requested By" detail={selectedTicket?.requestedBy} />
          <DetalisFormatted title="Resolved By" detail={selectedTicket?.resolvedBy} />
          <DetalisFormatted title="Resolved At" detail={selectedTicket?.resolvedAt} />
          <div>
            <span className="text-content flex items-start w-full">
              <span className="w-[50%]">Image Upload</span>
              <span>:</span>
              <span className="text-content flex flex-col gap-2 items-start w-full justify-start pl-4">
                {selectedTicket?.image ? (
                  <a
                    href={selectedTicket.image}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    View Image
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </span>
          </div>
        </div>
      </MuiModal>
    </div>
  );
};

export default CustomerSupport;
