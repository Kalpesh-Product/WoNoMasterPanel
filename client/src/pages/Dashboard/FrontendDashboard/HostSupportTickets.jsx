import React, { useMemo, useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, AlertCircle, AlertTriangle, Clock, CheckCircle2, Eye, ExternalLink, X, ChevronDown } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import { statusPillClass } from "../../../lib/status-pill";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getFullName = (user) => {
  if (!user) return "-";
  if (typeof user === "string") return user;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.name || user.fullName || user.email || "-";
};

const getAvailableStatusActions = (currentStatus) => {
  switch (currentStatus) {
    case "Open": return ["Accepted", "Rejected"];
    case "Accepted": return ["In Progress", "Rejected"];
    case "In Progress": return ["Pending", "Closed", "Rejected"];
    case "Pending": return ["Closed", "Rejected"];
    default: return [];
  }
};

const closedPillClass = "inline-flex w-max items-center rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-emerald-50 text-emerald-700";

const HostSupportTickets = () => {
  const axios = useAxiosPrivate();
  const [openView, setOpenView] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatusDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data = [], isPending, isError } = useQuery({
    queryKey: ["host-support-tickets"],
    queryFn: async () => {
      const response = await axios.get("/api/tickets/host-support-tickets");
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const { mutate: updateStatus, isPending: isStatusUpdating } = useMutation({
    mutationKey: ["host-support-ticket-status"],
    mutationFn: async ({ supportTicketId, status, resolutionMessage }) => {
      const response = await axios.patch(
        `/api/tickets/support-tickets/${supportTicketId}/status`,
        { status, resolutionMessage },
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Status updated");
      queryClient.invalidateQueries({ queryKey: ["host-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-customer-support"] });
      queryClient.invalidateQueries({ queryKey: ["supported-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets-data"] });
      if (selectedTicket && data?.data?._id === selectedTicket.id) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, status: data.data.status } : prev,
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

  const allTickets = tableData;
  const openCount = useMemo(() => allTickets.filter((t) => t.status === "Open").length, [allTickets]);
  const inProgressCount = useMemo(() => allTickets.filter((t) => t.status === "In Progress" || t.status === "Accepted").length, [allTickets]);
  const resolvedCount = useMemo(() => allTickets.filter((t) => t.status === "Closed" || t.status === "Resolved").length, [allTickets]);

  const filteredList = useMemo(() => {
    let list = allTickets;
    if (statusFilter !== "All") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber?.toLowerCase().includes(q) ||
          t.title?.toLowerCase().includes(q) ||
          t.companyName?.toLowerCase().includes(q) ||
          t.requestedBy?.toLowerCase().includes(q) ||
          t.status?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allTickets, searchQuery, statusFilter]);

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setOpenView(true);
  };

  const handleStatusAction = (ticket, status) => {
    setStatusDropdownId(null);
    if (status === "Pending") {
      const message = window.prompt("Enter resolution message for the user:");
      if (!message || !message.trim()) {
        toast.error("Resolution message is required for Pending status");
        return;
      }
      updateStatus({ supportTicketId: ticket.id, status, resolutionMessage: message.trim() });
      return;
    }
    updateStatus({ supportTicketId: ticket.id, status });
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

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load host support tickets.</div>;
  }

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">Loading...</div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">

          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                Host Support Tickets
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Monitor and manage support tickets raised by host companies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 shrink-0">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Total Tickets</p>
                <p className="text-[15px] font-pmedium text-slate-900">{allTickets.length}</p>
              </div>
              <div className="p-2 rounded-2xl bg-slate-50 text-slate-600 shrink-0"><AlertCircle size={16} /></div>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Open</p>
                <p className="text-[15px] font-pmedium text-slate-900">{openCount}</p>
              </div>
              <div className="p-2 rounded-2xl bg-amber-50 text-amber-600 shrink-0"><AlertTriangle size={16} /></div>
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
                <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Resolved / Closed</p>
                <p className="text-[15px] font-pmedium text-slate-900">{resolvedCount}</p>
              </div>
              <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0"><CheckCircle2 size={16} /></div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {["All", "Open", "Accepted", "In Progress", "Pending", "Closed", "Rejected"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-pmedium whitespace-nowrap transition-all ${
                      statusFilter === status
                        ? "bg-[#2563EB] text-white shadow-sm shadow-blue-200"
                        : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="w-full xl:max-w-md">
                <div className="relative w-full">
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
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Sr No</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Ticket ID</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Title</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested By</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Requested At</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-20 text-slate-400 font-pmedium">No tickets found.</td>
                    </tr>
                  ) : (
                    filteredList.map((ticket) => {
                      const availableStatuses = getAvailableStatusActions(ticket.status);
                      const isDropdownOpen = statusDropdownId === ticket.id;
                      return (
                      <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{ticket.srNo}</td>
                        <td className="px-5 py-4 align-top whitespace-nowrap">
                          <div className="font-pmedium text-slate-600 inline-flex items-center gap-1 whitespace-nowrap">{ticket.ticketNumber || "N/A"}</div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="font-pmedium text-[#0F172A] text-[13px] truncate max-w-[200px]">{ticket.title}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.companyName}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.requestedBy}</td>
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600 whitespace-nowrap">{ticket.requestedAt}</td>
                        <td className="px-5 py-4 align-top text-center relative" ref={availableStatuses.length > 0 ? dropdownRef : undefined}>
                          <div className="inline-block relative">
                            <button
                              type="button"
                              onClick={() => availableStatuses.length > 0 && setStatusDropdownId(isDropdownOpen ? null : ticket.id)}
                              disabled={isStatusUpdating}
                              className={`inline-flex items-center gap-1 transition-all disabled:opacity-50 ${
                                availableStatuses.length > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default"
                              } ${ticket.status === "Closed" ? closedPillClass : statusPillClass(ticket.status)}`}
                            >
                              {ticket.status}
                              {availableStatuses.length > 0 && <ChevronDown size={10} strokeWidth={3} />}
                            </button>
                            {isDropdownOpen && availableStatuses.length > 0 && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[140px] py-1 animate-in fade-in duration-150">
                                {availableStatuses.map((status) => (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleStatusAction(ticket, status)}
                                    className="w-full text-left px-3 py-2 text-[11px] font-pmedium text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(ticket)}
                              title="View details"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            >
                              <Eye size={15} strokeWidth={2.5} />
                            </button>
                            {ticket.requestedById && ticket.workspaceId ? (
                              <button
                                type="button"
                                onClick={() => viewAs(ticket.id)}
                                disabled={isViewAsLoading}
                                title="View As"
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
                              >
                                <ExternalLink size={15} strokeWidth={2.5} />
                              </button>
                            ) : null}
                          </div>
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
      </PageFrame>

      {openView && selectedTicket ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => { setOpenView(false); setSelectedTicket(null); }}>
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <AlertCircle size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">{selectedTicket.title || "Ticket Details"}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={selectedTicket.status === "Closed" ? closedPillClass : statusPillClass(selectedTicket.status)}>{selectedTicket.status}</span>
                    <span className="text-[10px] font-pmedium text-slate-500">{selectedTicket.ticketNumber || "-"}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setOpenView(false); setSelectedTicket(null); }}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} /> Ticket Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Ticket ID</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.ticketNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Company</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.companyName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Workspace</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.workspaceName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Requested By</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.requestedBy || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Requested At</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.requestedAt}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Status</p>
                    <p className="text-[12px] font-pmedium text-slate-900"><span className={statusPillClass(selectedTicket.status)}>{selectedTicket.status}</span></p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} /> Issue Details
                </h3>
                <div className="grid grid-cols-1 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Title</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.title || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Description</p>
                    <p className="text-[12px] font-pmedium text-slate-900 whitespace-pre-wrap max-h-24 overflow-y-auto">{selectedTicket.description || "-"}</p>
                  </div>
                  {selectedTicket.pageUrl && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Page URL</p>
                      <a href={selectedTicket.pageUrl} target="_blank" rel="noreferrer" className="text-[12px] font-pmedium text-blue-600 underline">{selectedTicket.pageUrl}</a>
                    </div>
                  )}
                  {selectedTicket.image && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Image</p>
                      <a href={selectedTicket.image} target="_blank" rel="noreferrer" className="text-[12px] font-pmedium text-blue-600 underline">View Image</a>
                    </div>
                  )}
                  {selectedTicket.resolutionMessage && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Resolution Message</p>
                      <p className="text-[12px] font-pmedium text-slate-900 whitespace-pre-wrap">{selectedTicket.resolutionMessage}</p>
                    </div>
                  )}
                  {selectedTicket.resolvedAt && selectedTicket.resolvedAt !== "-" && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Resolved At</p>
                      <p className="text-[12px] font-pmedium text-slate-900">{selectedTicket.resolvedAt}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              {selectedTicket.requestedById && selectedTicket.workspaceId && (
                <button
                  type="button"
                  disabled={isViewAsLoading}
                  onClick={() => viewAs(selectedTicket.id)}
                  className="px-4 py-2 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  {isViewAsLoading ? "Generating..." : "View As"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HostSupportTickets;
