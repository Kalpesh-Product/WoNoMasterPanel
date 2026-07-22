import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { toast } from "sonner";
import { Search, Eye, X, Mail, MessageSquare, Users, Target, CheckCircle2, Clock, Send } from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";
import PageFrame from "../../../components/Pages/PageFrame";

const STATUSES = ["pending", "contacted", "closed", "rejected"];
const PLANS = ["basic", "professional", "customise"];
const INVITE_STATUSES = ["not_invited", "invite_sent", "registered", "joined"];

const normalizePlanValue = (value) => {
  const n = String(value || "basic").trim().toLowerCase();
  if (["custom", "customize", "customised", "customized"].includes(n)) return "customise";
  if (n === "professional") return "professional";
  return "basic";
};

const normalizeInviteStatus = (status) => {
  const n = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (n === "invite_sent") return "invite_sent";
  if (n === "registered") return "registered";
  if (n === "joined") return "joined";
  return "not_invited";
};

const deriveInviteStatus = (lead = {}, overrides = {}) => {
  const explicit = normalizeInviteStatus(overrides.inviteStatus || lead.inviteStatus || lead.invitationStatus || lead.userStatus || lead.registrationStatus);
  if (overrides.joinedAt || lead.joinedAt || lead.lastLoginAt || lead.isJoined === true) return "joined";
  if (overrides.registeredAt || lead.registeredAt || lead.accountCreatedAt || lead.isRegistered === true) return "registered";
  if (overrides.inviteSentAt || lead.inviteSentAt) return "invite_sent";
  return explicit;
};

const formatDate = (value) => {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const getInitials = (value) =>
  String(value || "LD").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

const planTones = {
  basic: "bg-blue-50 text-blue-700 border-blue-100",
  professional: "bg-amber-50 text-amber-700 border-amber-100",
  customise: "bg-pink-50 text-pink-700 border-pink-100",
};

const inviteTones = {
  not_invited: "bg-slate-100 text-slate-600",
  invite_sent: "bg-blue-50 text-blue-700",
  registered: "bg-amber-50 text-amber-700",
  joined: "bg-emerald-50 text-emerald-700",
};

const inviteLabels = {
  not_invited: "Not Invited",
  invite_sent: "Invite Sent",
  registered: "Registered",
  joined: "Joined",
};

const SignupLeads = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLead, setSelectedLead] = useState(null);
  const [viewLead, setViewLead] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [sendingInviteId, setSendingInviteId] = useState(null);
  const [inviteOverrides, setInviteOverrides] = useState({});

  const { data: leads = [], isPending } = useQuery({
    queryKey: ["signup-leads"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/forms/host-users`);
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const inviteEmails = useMemo(
    () => leads.map((l) => String(l?.email || "").trim().toLowerCase()).filter(Boolean),
    [leads],
  );

  const { data: inviteStatuses = {} } = useQuery({
    queryKey: ["signup-lead-invite-statuses", inviteEmails],
    enabled: inviteEmails.length > 0,
    queryFn: async () => {
      const response = await axios.get("/api/host-user/invite-statuses", {
        params: { emails: inviteEmails.join(",") },
      });
      return response?.data?.data || {};
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ hostUserId, ...payload }) => {
      const res = await axios.patch(`${NOMADS_API_BASE_URL}/forms/host-users/${hostUserId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      queryClient.invalidateQueries({ queryKey: ["signup-lead-invite-statuses"] });
      setSelectedLead(null);
      toast.success("Lead updated");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Update failed"),
  });

  const inviteMutation = useMutation({
    mutationFn: async (lead) => {
      const res = await axios.post("/api/host-user/send-invite", {
        leadId: lead?._id, email: lead?.email, name: lead?.name, mobile: lead?.mobile,
        companyName: lead?.companyName, verticalType: lead?.verticalType,
        country: lead?.country, state: lead?.state, city: lead?.city, source: lead?.source,
        fullName: lead?.name, selectedPlan: lead?.goals, status: lead?.status,
        goals: lead?.goals, comment: lead?.comment,
      });
      if (lead?._id) {
        try {
          await axios.patch(`${NOMADS_API_BASE_URL}/forms/host-users/${lead._id}`, {
            status: String(lead?.status || "closed").toLowerCase(),
            inviteStatus: "invite_sent", inviteSentAt: new Date().toISOString(),
          });
        } catch (e) { /* best-effort */ }
      }
      return res.data;
    },
    onSuccess: (data, lead) => {
      setSendingInviteId(null);
      const emailKey = String(lead?.email || "").trim().toLowerCase();
      const inviteSentAt = new Date().toISOString();
      setInviteOverrides((prev) => ({ ...prev, [emailKey]: { ...prev[emailKey], inviteStatus: "invite_sent", inviteSentAt } }));
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      queryClient.invalidateQueries({ queryKey: ["signup-lead-invite-statuses"] });
      toast.success(data?.message || "Invite email sent");
    },
    onError: (err) => {
      setSendingInviteId(null);
      toast.error(err?.response?.data?.message || "Failed to send invite");
    },
  });

  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter((l) => (l.status || "pending") === "pending").length;
    const contacted = leads.filter((l) => l.status === "contacted").length;
    const closed = leads.filter((l) => l.status === "closed").length;
    return { total, pending, contacted, closed };
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === "All" || (lead.status || "pending") === statusFilter;
      const matchesQuery = !q || [lead.name, lead.email, lead.companyName, lead.mobile, lead.source, lead.country]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [leads, search, statusFilter]);

  const getInviteStatus = (lead) => {
    const emailKey = String(lead?.email || "").trim().toLowerCase();
    return deriveInviteStatus(lead, { ...(inviteStatuses[emailKey] || {}), ...(inviteOverrides[emailKey] || {}) });
  };

  const handleStatusChange = (leadId, status) => {
    updateMutation.mutate({ hostUserId: leadId, status: status.toLowerCase() });
  };

  const handlePlanChange = (leadId, plan) => {
    updateMutation.mutate({ hostUserId: leadId, goals: normalizePlanValue(plan) });
  };

  const handleComment = () => {
    if (!selectedLead?._id || !commentText.trim()) return;
    updateMutation.mutate({ hostUserId: selectedLead._id, comment: commentText.trim() });
  };

  const pageHeading = (
    <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
      <div>
        <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Signup Leads</h2>
        <p className="text-xs font-pmedium text-slate-500 mt-1">Track and manage incoming signup leads, invite qualified leads to register.</p>
      </div>
    </div>
  );

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            {pageHeading}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
                  <div className="h-5 w-10 bg-slate-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-9 w-9 bg-slate-200 rounded-2xl shrink-0" />
                  <div className="h-3 bg-slate-200 rounded-full w-32" />
                  <div className="h-3 bg-slate-200 rounded-full w-24" />
                  <div className="h-3 bg-slate-200 rounded-full w-20" />
                </div>
              ))}
            </div>
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <>
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            {pageHeading}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              {[
                { label: "Total Leads", value: stats.total, icon: Target, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
                { label: "Pending", value: stats.pending, icon: Clock, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
                { label: "Contacted", value: stats.contacted, icon: Users, accent: "border-l-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
                { label: "Closed", value: stats.closed, icon: CheckCircle2, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}>
                    <div>
                      <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${s.textColor}`}>{s.label}</p>
                      <p className="text-[15px] font-pmedium text-slate-900">{s.value}</p>
                    </div>
                    <div className={`rounded-2xl p-2 ${s.bgColor} ${s.textColor}`}><Icon size={16} /></div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
                <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                  {["All", ...STATUSES].map((s) => (
                    <button key={s} type="button" onClick={() => setStatusFilter(s)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${statusFilter === s ? "bg-[#2563EB] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" placeholder="Search name, email, company..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Target size={28} /></div>
                  <p className="text-slate-400 font-semibold font-pmedium">No matching leads found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left min-w-[1100px]">
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-5 py-4">Lead</th>
                        <th className="px-5 py-4">Company</th>
                        <th className="px-5 py-4">Plan</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Invite Status</th>
                        <th className="px-5 py-4">Invite</th>
                        <th className="px-5 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {filtered.map((lead) => {
                        const inviteStatus = getInviteStatus(lead);
                        const statusVal = (lead.status || "pending").toLowerCase();
                        const planVal = normalizePlanValue(lead.goals);
                        const canInvite = statusVal === "closed" && !["registered", "joined"].includes(inviteStatus);
                        const isSending = sendingInviteId === lead._id;
                        return (
                          <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">{getInitials(lead.name)}</div>
                                <div>
                                  <p className="text-[12px] font-pmedium text-slate-900 truncate max-w-[160px]">{lead.name || "--"}</p>
                                  <p className="text-[10px] font-pmedium text-slate-500 truncate max-w-[160px]">{lead.email || ""}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[140px]" title={lead.companyName}>{lead.companyName || "--"}</td>
                            <td className="px-5 py-4">
                              <select value={planVal} onChange={(e) => handlePlanChange(lead._id, e.target.value)}
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${planTones[planVal] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              <select value={statusVal} onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${statusPillClass(statusVal)}`}>
                                {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${inviteTones[inviteStatus] || inviteTones.not_invited}`}>
                                {inviteLabels[inviteStatus] || inviteStatus}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button type="button" disabled={!canInvite || isSending}
                                onClick={() => { setSendingInviteId(lead._id); inviteMutation.mutate(lead); }}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition ${canInvite ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                                <Send size={10} />
                                {isSending ? "Sending..." : "Invite"}
                              </button>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => { setViewLead(lead); setCommentText(lead.comment || ""); }}
                                  title="View details"
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
                                  <Eye size={15} strokeWidth={2.5} />
                                </button>
                                <button type="button" onClick={() => { setSelectedLead(lead); setCommentText(lead.comment || ""); }}
                                  title="Add comment"
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40">
                                  <MessageSquare size={15} strokeWidth={2.5} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </PageFrame>
      </div>

      {/* View Detail Modal */}
      {viewLead && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setViewLead(null)}>
          <div className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">{getInitials(viewLead.name)}</div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">{viewLead.name}</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{viewLead.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => setViewLead(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2"><Mail size={14} /> Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Phone</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.mobile || "Not shared"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Email</p><p className="text-[12px] font-pmedium text-slate-900 break-all">{viewLead.email || "Not shared"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Company</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.companyName || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Role</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.role || "--"}</p></div>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2"><Target size={14} /> Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Plan</p><p className="text-[12px] font-pmedium text-slate-900 uppercase">{normalizePlanValue(viewLead.goals)}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Status</p><p className="text-[12px] font-pmedium text-slate-900 capitalize">{viewLead.status || "pending"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Vertical</p><p className="text-[12px] font-pmedium text-slate-900">{Array.isArray(viewLead.verticalType) ? viewLead.verticalType.join(", ") : viewLead.verticalType || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Country</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.country || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">State</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.state || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">City</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.city || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Source</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.source || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Form</p><p className="text-[12px] font-pmedium text-slate-900">{viewLead.formName || "--"}</p></div>
                  <div><p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">Created</p><p className="text-[12px] font-pmedium text-slate-900">{formatDate(viewLead.createdAt)}</p></div>
                </div>
              </div>
              {viewLead.comment && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2"><MessageSquare size={14} /> Comment</h3>
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100"><p className="text-[12px] font-pmedium leading-5 text-slate-700 whitespace-pre-wrap">{viewLead.comment}</p></div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setViewLead(null)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-amber-500 text-white"><MessageSquare size={16} /></div>
                <div className="min-w-0">
                  <h2 className="text-base font-pmedium tracking-tight text-slate-800">Update Comment</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{selectedLead.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedLead(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">Comment</label>
                <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={4} placeholder="Enter your comment..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all resize-none" />
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2.5">
              <button type="button" onClick={() => setSelectedLead(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm">Cancel</button>
              <button type="button" onClick={handleComment} disabled={updateMutation.isPending || !commentText.trim()}
                className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {updateMutation.isPending ? "Saving..." : "Save Comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SignupLeads;
