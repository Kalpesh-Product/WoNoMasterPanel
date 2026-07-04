import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip, Button } from "@mui/material";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import MuiModal from "../../../components/MuiModal";
import DetalisFormatted from "../../../components/DetalisFormatted";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { MdOutlineRemoveRedEye, MdOpenInNew } from "react-icons/md";

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

const statusColorMap = {
  Open: { backgroundColor: "#E6E6FA", color: "#4B0082" },
  Accepted: { backgroundColor: "#DCFCE7", color: "#166534" },
  "In Progress": { backgroundColor: "#ADD8E6", color: "#00008B" },
  Closed: { backgroundColor: "#90EE90", color: "#006400" },
  Pending: { backgroundColor: "#FFECC5", color: "#CC8400" },
  Escalated: { backgroundColor: "#FECACA", color: "#B91C1C" },
  Rejected: { backgroundColor: "#E5E7EB", color: "#4B5563" },
};

const HostSupportTickets = () => {
  const axios = useAxiosPrivate();
  const [openView, setOpenView] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const { data = [], isPending, isError } = useQuery({
    queryKey: ["host-support-tickets"],
    queryFn: async () => {
      const response = await axios.get("/api/tickets/host-support-tickets");
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const tableData = useMemo(
    () =>
      data.map((item, index) => ({
        id: item?._id || index,
        srNo: index + 1,
        ticketNumber: item?.ticketId || "-",
        title: item?.title || "-",
        description: item?.description || "-",
        pageUrl: item?.pageUrl || "",
        companyName: item?.companyName || item?.company?.companyName || "-",
        workspaceName: item?.workspaceName || item?.workspace?.workspaceName || "-",
        requestedBy:
          String(item?.requestedByName || "").trim() ||
          String(item?.requestedByEmail || "").trim() ||
          getFullName(item?.requestedBy),
        requestedById: item?.requestedBy?._id || item?.requestedBy || "",
        workspaceId: item?.workspace?._id || item?.workspace || "",
        requestedAt: formatDateTime(item?.requestedAt || item?.createdAt),
        status: item?.status || "-",
        image: item?.image?.url || "",
        resolutionMessage: String(item?.resolutionMessage || "").trim(),
        resolvedAt: formatDateTime(item?.resolvedAt),
      })),
    [data],
  );

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setOpenView(true);
  };

  const { mutate: viewAs, isPending: isViewAsLoading } = useMutation({
    mutationKey: ["host-support-ticket-view-as"],
    mutationFn: async (ticketId) => {
      const response = await axios.post(
        `/api/tickets/host-support-tickets/${ticketId}/view-as`,
      );
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Could not generate a view-as link for this ticket.");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to generate view-as link.");
    },
  });

  const columns = useMemo(
    () => [
      { field: "srNo", pinned: "left", lockPinned: true, headerName: "Sr No", width: 90 },
      { field: "ticketNumber", headerName: "Ticket ID", minWidth: 140 },
      { field: "requestedAt", headerName: "Requested At", minWidth: 190 },
      { field: "title", headerName: "Title", minWidth: 180 },
      { field: "companyName", headerName: "Company Name", minWidth: 180 },
      { field: "requestedBy", headerName: "Requested By", minWidth: 180 },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 100,
        pinned: "right",
        lockPinned: true,
        cellRenderer: (params) => (
          <div className="flex items-center gap-2">
            <div
              role="button"
              onClick={() => handleView(params.data)}
              className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
              title="View details"
            >
              <MdOutlineRemoveRedEye />
            </div>
            {params.data?.requestedById && params.data?.workspaceId ? (
              <div
                role="button"
                onClick={() => viewAs(params.data.id)}
                className="p-2 rounded-full hover:bg-borderGray cursor-pointer"
                title="View As"
              >
                <MdOpenInNew />
              </div>
            ) : null}
          </div>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 150,
        cellRenderer: (params) => {
          const statusStyle = statusColorMap[params.value] || {
            backgroundColor: "#E5E7EB",
            color: "#374151",
          };
          return <Chip label={params.value} size="small" style={statusStyle} />;
        },
      },
    ],
    [viewAs],
  );

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load host support tickets.</div>;
  }

  return (
    <div>
      <AgTable
        data={tableData}
        columns={columns}
        search
        tableTitle="Host Company Support Tickets"
        tableHeight={500}
        loading={isPending}
      />

      <MuiModal
        open={openView}
        onClose={() => setOpenView(false)}
        title="Host Support Ticket Details"
      >
        <div className="flex flex-col gap-3">
          <DetalisFormatted title="Ticket ID" detail={selectedTicket?.ticketNumber} />
          <DetalisFormatted title="Title" detail={selectedTicket?.title} />
          <DetalisFormatted title="Description" detail={selectedTicket?.description} />
          <DetalisFormatted title="Company Name" detail={selectedTicket?.companyName} />
          <DetalisFormatted title="Workspace" detail={selectedTicket?.workspaceName} />
          <DetalisFormatted title="Requested By" detail={selectedTicket?.requestedBy} />
          <DetalisFormatted title="Requested At" detail={selectedTicket?.requestedAt} />
          <DetalisFormatted title="Status" detail={selectedTicket?.status} />
          <DetalisFormatted title="Page URL" detail={selectedTicket?.pageUrl || "-"} />
          <DetalisFormatted title="Resolution Message" detail={selectedTicket?.resolutionMessage || "-"} />
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

          <div className="pt-2 flex justify-end">
            <Button
              variant="contained"
              size="small"
              disabled={isViewAsLoading || !selectedTicket?.requestedById || !selectedTicket?.workspaceId}
              onClick={() => viewAs(selectedTicket?.id)}
            >
              {isViewAsLoading ? "Generating link..." : "View As"}
            </Button>
          </div>
        </div>
      </MuiModal>
    </div>
  );
};

export default HostSupportTickets;
