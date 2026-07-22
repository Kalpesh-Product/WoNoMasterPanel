import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Eye, AlertCircle, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import DetalisFormatted from "../../../components/DetalisFormatted";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import { statusPillClass } from "../../../lib/status-pill";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  const { mutate: viewAs, isPending: isViewAsLoading } = useMutation({
    mutationKey: ["dashboard-customer-support-view-as"],
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
        requestedById: item?.requestedBy?._id || item?.requestedBy || "",
        workspaceId: item?.workspace?._id || item?.workspace || "",
        resolutionMessage: String(item?.resolutionMessage || "").trim(),
        resolvedBy:
          String(item?.resolvedByName || "").trim() ||
          String(item?.resolvedByEmail || "").trim() ||
          getFullName(item?.resolvedBy || item?.ticket?.closedBy),
        resolvedAt: formatDateTime(item?.resolvedAt),
      })),
    [data],
  );

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tableData.filter((row) => {
      const matchesStatus =
        statusFilter === "All" || row.ticketStatus === statusFilter;
      const matchesSearch =
        !query ||
        row.ticketNumber.toLowerCase().includes(query) ||
        row.title.toLowerCase().includes(query) ||
        row.companyName.toLowerCase().includes(query) ||
        row.requestedBy.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [tableData, searchQuery, statusFilter]);

  const totalCount = tableData.length;
  const openCount = tableData.filter((t) => t.ticketStatus === "Open").length;
  const inProgressCount = tableData.filter((t) => t.ticketStatus === "In Progress").length;
  const resolvedCount = tableData.filter(
    (t) => t.ticketStatus === "Closed" || t.ticketStatus === "Pending",
  ).length;

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setOpenView(true);
  };

  const statusFilters = ["All", "Open", "Accepted", "In Progress", "Closed"];

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load customer support data.</div>;
  }

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">Customer Support</h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Manage support tickets raised by host companies.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Total Tickets</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalCount}</p>
            </div>
            <div className="p-2 rounded-2xl bg-slate-50 text-slate-600 shrink-0"><AlertCircle size={16} /></div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Open</p>
              <p className="text-[15px] font-pmedium text-slate-900">{openCount}</p>
            </div>
            <div className="p-2 rounded-2xl bg-amber-50 text-amber-600 shrink-0"><AlertCircle size={16} /></div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-blue-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">In Progress</p>
              <p className="text-[15px] font-pmedium text-slate-900">{inProgressCount}</p>
            </div>
            <div className="p-2 rounded-2xl bg-blue-50 text-blue-600 shrink-0"><Clock size={16} /></div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Closed</p>
              <p className="text-[15px] font-pmedium text-slate-900">{resolvedCount}</p>
            </div>
            <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0"><CheckCircle2 size={16} /></div>
          </div>
        </div>

        {/* Status Filter + Search */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {statusFilters.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
                    statusFilter === status
                      ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
                      : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                  }`}
                >
                  {status === "Open" ? "Raised" : status}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Ticket ID</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Title</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested By</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested At</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isPending ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">Loading...</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-slate-400 font-pmedium">No tickets found.</td>
                  </tr>
                ) : (
                  filteredData.map((ticket) => (
                    <tr key={ticket.supportTicketId || ticket.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-4 align-top whitespace-nowrap">
                        <div className="font-pmedium text-slate-600">{ticket.ticketNumber}</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-pmedium text-[#0F172A] text-[13px] truncate max-w-[200px]">{ticket.title}</div>
                      </td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.companyName}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.requestedBy}</td>
                      <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.requestedAt}</td>
                      <td className="px-5 py-4 align-top text-center">
                        <span className={statusPillClass(ticket.ticketStatus)}>{ticket.ticketStatus}</span>
                      </td>
                      <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                           <button
                            type="button"
                            onClick={() => handleView(ticket)}
                            title="View details"
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                          >
                            <Eye size={15} strokeWidth={2.5} />
                          </button>
                          {ticket.requestedById && ticket.workspaceId ? (
                            <button
                              type="button"
                              onClick={() => viewAs(ticket.supportTicketId)}
                              disabled={isViewAsLoading}
                              title="View As"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all disabled:opacity-50"
                            >
                              <ExternalLink size={15} strokeWidth={2.5} />
                            </button>
                          ) : null}
                          {getAvailableStatusActions(ticket.ticketStatus).length > 0 && (
                            <ThreeDotMenu
                              rowId={ticket.supportTicketId}
                              isLoading={isStatusUpdating}
                              menuItems={getAvailableStatusActions(ticket.ticketStatus).map(
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
                                        supportTicketId: ticket.supportTicketId,
                                        status,
                                        resolutionMessage: message.trim(),
                                      });
                                      return;
                                    }
                                    updateStatus({
                                      supportTicketId: ticket.supportTicketId,
                                      status,
                                    });
                                  },
                                }),
                              )}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {openView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpenView(false)}
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
                <h2 className="text-base font-semibold text-slate-900">Customer Support Details</h2>
              </div>
              <button
                onClick={() => setOpenView(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
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
            </div>
            <div className="flex items-center justify-end border-t border-slate-100 px-6 py-4">
              {selectedTicket?.requestedById && selectedTicket?.workspaceId ? (
                <button
                  type="button"
                  disabled={isViewAsLoading}
                  onClick={() => viewAs(selectedTicket.supportTicketId)}
                  className="px-4 py-2 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  {isViewAsLoading ? "Generating..." : "View As"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
};

export default CustomerSupport;
