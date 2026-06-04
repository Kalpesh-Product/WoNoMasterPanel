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
import { MdOutlineRemoveRedEye } from "react-icons/md";

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
};

const getFullName = (user) => {
  if (!user) return "-";
  if (typeof user === "string") return user;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.name || user.fullName || user.email || "-";
};

const getStatusValue = (item) => item?.status || item?.ticket?.status || "-";

const statusColorMap = {
  Open: { backgroundColor: "#E6E6FA", color: "#4B0082" },
  Accepted: { backgroundColor: "#DCFCE7", color: "#166534" },
  "In Progress": { backgroundColor: "#ADD8E6", color: "#00008B" },
  Closed: { backgroundColor: "#90EE90", color: "#006400" },
  Pending: { backgroundColor: "#FFECC5", color: "#CC8400" },
  Escalated: { backgroundColor: "#FECACA", color: "#B91C1C" },
  Rejected: { backgroundColor: "#E5E7EB", color: "#4B5563" },
};

const getAvailableStatusActions = (currentStatus) => {
  switch (currentStatus) {
    case "Open":
      return ["Accepted", "Rejected"];
    case "Accepted":
      return ["In Progress", "Rejected"];
    case "In Progress":
      return ["Pending", "Closed", "Rejected"];
    case "Pending":
      return ["Closed", "Rejected"];
    default:
      return [];
  }
};

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
    mutationFn: async ({ supportTicketId, status, resolutionMessage }) => {
      const response = await axios.patch(
        `/api/tickets/support-tickets/${supportTicketId}/status`,
        { status, resolutionMessage }
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
        workspaceName: item?.workspaceName || item?.ticket?.workspace?.name || "-",
        department: item?.department || item?.ticket?.raisedToDepartment?.name || "-",
        acceptedBy:
          String(item?.acceptedByName || "").trim() ||
          String(item?.acceptedByEmail || "").trim() ||
          getFullName(item?.acceptedBy || item?.ticket?.acceptedBy),
        requestedAt: formatDateTime(item?.requestedAt || item?.createdAt),
        ticketStatus: getStatusValue(item),
        image: item?.image?.url || "",
        requestedBy:
          String(item?.requestedByName || "").trim() ||
          String(item?.requestedByEmail || "").trim() ||
          getFullName(item?.requestedBy),
        resolutionMessage: String(item?.resolutionMessage || "").trim(),
        resolvedBy:
          String(item?.resolvedByName || "").trim() ||
          String(item?.resolvedByEmail || "").trim() ||
          getFullName(item?.resolvedBy || item?.ticket?.closedBy),
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
      { field: "srNo", pinned: "left", lockPinned: true, headerName: "Sr No", width: 90 },
      { field: "ticketNumber", headerName: "Ticket ID", minWidth: 140 },
      { field: "requestedAt", headerName: "Requested At", minWidth: 190 },
      { field: "title", headerName: "Title", minWidth: 180 },
      { field: "companyName", headerName: "Company Name", minWidth: 180 },
      { field: "requestedBy", headerName: "Requested By", minWidth: 180 },
      // { field: "department", headerName: "Department", minWidth: 160 },
      // { field: "acceptedBy", headerName: "Accepted By", minWidth: 180 },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 120,
        pinned: "right",
        lockPinned: true,
        cellRenderer: (params) => (
          <div className="flex items-center gap-2">
            <div
              role="button"
              onClick={() => handleView(params.data)}
              className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
            >
              <MdOutlineRemoveRedEye />
            </div>
            <ThreeDotMenu
              rowId={params.data.supportTicketId}
              isLoading={isStatusUpdating}
              menuItems={getAvailableStatusActions(params.data.ticketStatus).map(
                (status) => ({
                  label: status,
                  onClick: () => {
                    if (status === "Pending") {
                      const message = window.prompt(
                        "Enter resolution message for the user:"
                      );
                      if (!message || !message.trim()) {
                        toast.error("Resolution message is required for Pending status");
                        return;
                      }
                      updateStatus({
                        supportTicketId: params.data.supportTicketId,
                        status,
                        resolutionMessage: message.trim(),
                      });
                      return;
                    }

                    updateStatus({
                      supportTicketId: params.data.supportTicketId,
                      status,
                    });
                  },
                }),
              )}
            />
          </div>
        ),
      },
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
    ],
    [isStatusUpdating],
  );

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load customer support data.</div>;
  }

  return (
    <div>
      <>
        <AgTable
          data={tableData}
          columns={columns}
          search
          tableTitle="Customer Support"
          tableHeight={500}
          loading={isPending}
        />
      </>

      <MuiModal
        open={openView}
        onClose={() => setOpenView(false)}
        title="Customer Support Details"
      >
        <div className="flex flex-col gap-3">
          <DetalisFormatted title="Ticket ID" detail={selectedTicket?.ticketNumber} />
          <DetalisFormatted title="Title" detail={selectedTicket?.title} />
          <DetalisFormatted title="Description" detail={selectedTicket?.description} />
          <DetalisFormatted title="Workspace" detail={selectedTicket?.workspaceName} />
          <DetalisFormatted title="Company Name" detail={selectedTicket?.companyName} />
          <DetalisFormatted title="Role" detail={selectedTicket?.role} />
          <DetalisFormatted title="Department" detail={selectedTicket?.department} />
          <DetalisFormatted title="Accepted By" detail={selectedTicket?.acceptedBy} />
          <DetalisFormatted title="Requested At" detail={selectedTicket?.requestedAt} />
          <DetalisFormatted title="Status" detail={selectedTicket?.ticketStatus} />
          <DetalisFormatted title="Requested By" detail={selectedTicket?.requestedBy} />
          <DetalisFormatted title="Resolution Message" detail={selectedTicket?.resolutionMessage || "-"} />
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
