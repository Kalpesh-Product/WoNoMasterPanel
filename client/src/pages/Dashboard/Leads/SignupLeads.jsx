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
  const [sendingInviteLeadId, setSendingInviteLeadId] = useState(null);
  const [inviteStatusOverrides, setInviteStatusOverrides] = useState({});
  const [sendingPaymentLeadId, setSendingPaymentLeadId] = useState(null);
  const [customPaymentLead, setCustomPaymentLead] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [customDescription, setCustomDescription] = useState("WONO Custom Plan — Subscription");

  const normalizeInviteStatus = (status) => {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (normalized === "invite_sent") return "invite_sent";
    if (normalized === "registered") return "registered";
    if (normalized === "joined") return "joined";
    return "not_invited";
  };

  const deriveInviteStatusFromLead = (lead = {}, localStatus) => {
    const explicitStatus = normalizeInviteStatus(
      localStatus?.inviteStatus ||
      lead?.inviteStatus ||
      lead?.invitationStatus ||
      lead?.userStatus ||
      lead?.registrationStatus,
    );

    if (
      localStatus?.joinedAt ||
      lead?.joinedAt ||
      lead?.lastLoginAt ||
      lead?.isJoined === true
    ) {
      return "joined";
    }

    if (
      localStatus?.registeredAt ||
      lead?.registeredAt ||
      lead?.accountCreatedAt ||
      lead?.isRegistered === true
    ) {
      return "registered";
    }

    if (localStatus?.inviteSentAt || lead?.inviteSentAt) {
      return "invite_sent";
    }

    return explicitStatus;
  };

  const normalizePlanValue = (value) => {
    const normalized = String(value || "basic").trim().toLowerCase();

    if (normalized === "custom") {
      return "customise";
    }

    if (["customise", "customized", "customised"].includes(normalized)) {
      return "customise";
    }

    if (normalized === "professional") return "professional";
    return "basic";
  };

  const {
    data: leads = [],
    isPending,
    isError,
  } = useQuery({
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
    onError: (error) => {
      setSendingInviteLeadId(null);
      toast.error(error?.response?.data?.message || "Failed to send invite");
    },
  });

  // Fixed monthly price for the Professional plan, matches AiHostPricing.jsx's
  // marketing card ($199/month). Custom plan has no fixed price — staff enters
  // it manually via the popup below.
  const PROFESSIONAL_PLAN_PRICE_USD = 199;

  const { data: paymentStatusByLeadId = {} } = useQuery({
    queryKey: ["bookingPaymentStatuses"],
    queryFn: async () => {
      const response = await axios.get("/api/host-user/booking-payment-links");
      return response?.data || {};
    },
    refetchInterval: 15000,
  });

  const getPaymentInfo = (lead) => {
    const record = paymentStatusByLeadId[String(lead?._id || "")];
    if (!record) return { status: "Not Sent", label: "Not Sent", isPaid: false };

    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(record.currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(record.amount || 0);

    const isPaid = record.status === "paid";
    return {
      status: isPaid ? "Paid" : "Pending",
      label: `${isPaid ? "Paid" : "Pending"} · ${formattedAmount}`,
      isPaid,
    };
  };

  const sendPlanPaymentLinkMutation = useMutation({
    mutationFn: async ({ lead, amount, description }) => {
      const response = await axios.post("/api/host-user/send-booking-payment-link", {
        leadId: lead?._id,
        customerName: lead?.name,
        customerEmail: lead?.email,
        companyName: lead?.companyName,
        productType: `${normalizePlanValue(lead?.goals) === "professional" ? "Professional" : "Custom"} Plan`,
        amount,
        currency: "usd",
        description,
        paymentType: "plan_subscription",
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSendingPaymentLeadId(null);
      setCustomPaymentLead(null);
      setCustomAmount("");
      queryClient.invalidateQueries({ queryKey: ["bookingPaymentStatuses"] });
      toast.success(data?.message || "Payment link email sent");
    },
    onError: (error) => {
      setSendingPaymentLeadId(null);
      toast.error(error?.response?.data?.message || "Failed to send payment link");
    },
  });

  const handleSendPlanPayment = (lead) => {
    const plan = normalizePlanValue(lead?.goals);

    if (plan === "professional") {
      setSendingPaymentLeadId(lead._id);
      sendPlanPaymentLinkMutation.mutate({
        lead,
        amount: PROFESSIONAL_PLAN_PRICE_USD,
        description: "WONO Professional Plan — Monthly Subscription",
      });
      return;
    }

    // Custom plan has no fixed price — open the popup to enter one manually.
    setCustomPaymentLead(lead);
    setCustomAmount("");
    setCustomDescription("WONO Custom Plan — Subscription");
  };

  const handleSubmitCustomPayment = () => {
    const amount = Number(customAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than 0");
      return;
    }
    setSendingPaymentLeadId(customPaymentLead._id);
    sendPlanPaymentLinkMutation.mutate({
      lead: customPaymentLead,
      amount,
      description: customDescription,
    });
  };

  const { control, handleSubmit, reset } = useForm({
    defaultValues: { comment: "" },
  });

  const handleStatusChange = (hostUserId, status) => {
    if (!hostUserId || !status) return;
    updateLeadMutation.mutate({ hostUserId, status: status.toLowerCase() });
  };

  const handlePlanChange = (hostUserId, plan) => {
    if (!hostUserId || !plan) return;
    updateLeadMutation.mutate({
      hostUserId,
      goals: normalizePlanValue(plan),
    });
  };

  const handleOpenModal = (lead) => {
    setSelectedLead(lead);
    reset({ comment: lead?.comment || "" });
    setOpenModal(true);
  };

  const handleOpenViewModal = (lead) => {
    setSelectedLead(lead);
    setOpenViewModal(true);
  };

  const onSubmitComment = (data) => {
    if (!selectedLead?._id) return;
    updateLeadMutation.mutate({
      hostUserId: selectedLead._id,
      comment: data.comment,
    });
  };

  const getSelectChipSx = (styles, value) => ({
    minWidth: 130,
    "& .MuiOutlinedInput-root": {
      borderRadius: "9999px",
      minHeight: 30,
      px: 1,
      fontWeight: 600,
      fontSize: "0.75rem",
      backgroundColor: styles[value]?.bg,
      color: styles[value]?.color,
      border: "1px solid rgba(148, 163, 184, 0.35)",
      "& fieldset": { border: "none" },
    },
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      py: "4px !important",
      pr: "22px !important",
      pl: "10px !important",
      textTransform: "capitalize",
    },
    "& .MuiSelect-icon": {
      right: 8,
      color: styles[value]?.color,
      fontSize: "1rem",
    },
  });

  const selectMenuProps = {
    PaperProps: {
      sx: {
        mt: 1,
        borderRadius: "18px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
        p: 0.5,
        overflow: "hidden",
      },
    },
    MenuListProps: {
      dense: true,
      sx: {
        p: 0,
      },
    },
  };

  const columns = [
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    // { field: "mobile", headerName: "Mobile" },
    { field: "companyName", headerName: "Company" },
    {
      field: "goals",
      headerName: "Plan",
      cellRenderer: (params) => {
        const planValue = normalizePlanValue(params.data.goals);
        const planStyles = {
          basic: { bg: "#DBEAFE", color: "#1D4ED8" },
          professional: { bg: "#FEF3C7", color: "#B45309" },
          customise: { bg: "#FCE7F3", color: "#BE185D" },
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TextField
              select
              size="small"
              value={planValue}
              onChange={(e) => handlePlanChange(params.data._id, e.target.value)}
              sx={getSelectChipSx(planStyles, planValue)}
              MenuProps={selectMenuProps}
            >
              {["basic", "professional", "customise"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    color: "#0f172a",
                    my: 0,
                    px: 1.5,
                    py: 1,
                    textTransform: "capitalize",
                    "&:hover": {
                      backgroundColor: "#f8fafc",
                    },
                  }}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </div>
        );
      },
    },
    {
      field: "status",
      headerName: "Leads Status",
      cellRenderer: (params) => {
        const statusValue = (params.data.status || "pending").toLowerCase();
        const statusStyles = {
          pending: { bg: "#FEF3C7", color: "#F59E0B" },
          contacted: { bg: "#c7fef9", color: "#0b69f5" },
          closed: { bg: "#D1FAE5", color: "#10B981" },
          rejected: { bg: "#FEE2E2", color: "#EF4444" },
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TextField
              select
              size="small"
              value={statusValue}
              onChange={(e) =>
                handleStatusChange(params.data._id, e.target.value)
              }
              sx={getSelectChipSx(statusStyles, statusValue)}
              MenuProps={selectMenuProps}
            >
              {["pending", "contacted", "closed", "rejected"].map((option) => (
                <MenuItem
                  key={option}
                  value={option}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    borderRadius: 0,
                    backgroundColor: "transparent",
                    color: "#0f172a",
                    my: 0,
                    px: 1.5,
                    py: 1,
                    textTransform: "capitalize",
                    "&:hover": {
                      backgroundColor: "#f8fafc",
                    },
                  }}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </div>
        );
      },
    },
    {
      field: "inviteStatus",
      headerName: "Invite Status",
      cellRenderer: (params) => {
        const emailKey = String(params.data?.email || "").trim().toLowerCase();
        const inviteStatus = deriveInviteStatusFromLead(
          params.data,
          {
            ...(inviteStatuses[emailKey] || {}),
            ...(inviteStatusOverrides[emailKey] || {}),
          },
        );
        const statusStyles = {
          not_invited: { bg: "#F3F4F6", color: "#4B5563" },
          invite_sent: { bg: "#DBEAFE", color: "#1D4ED8" },
          registered: { bg: "#FEF3C7", color: "#B45309" },
          joined: { bg: "#D1FAE5", color: "#047857" },
        };
        const labelMap = {
          not_invited: "Not invited",
          invite_sent: "Invite sent",
          registered: "Registered",
          joined: "Joined",
        };

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Chip
              label={labelMap[inviteStatus]}
              size="small"
              sx={{
                backgroundColor: statusStyles[inviteStatus]?.bg,
                color: statusStyles[inviteStatus]?.color,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          </div>
        );
      },
    },
    {
      field: "paymentStatus",
      headerName: "Payment Status",
      cellRenderer: (params) => {
        const lead = params.data;
        const plan = normalizePlanValue(lead.goals);

        if (plan === "basic") {
          return (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Chip
                label="Free Plan"
                size="small"
                sx={{ backgroundColor: "#DBEAFE", color: "#1D4ED8", fontWeight: 600, fontSize: "0.75rem" }}
              />
            </div>
          );
        }

        const paymentInfo = getPaymentInfo(lead);

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Chip
              label={paymentInfo.label}
              size="small"
              sx={{
                backgroundColor: paymentInfo.isPaid ? "#D1FAE5" : paymentInfo.status === "Pending" ? "#FEF3C7" : "#F3F4F6",
                color: paymentInfo.isPaid ? "#047857" : paymentInfo.status === "Pending" ? "#B45309" : "#4B5563",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          </div>
        );
      },
    },
    {
      field: "sendPaymentLink",
      headerName: "Send Payment Link",
      cellRenderer: (params) => {
        const lead = params.data;
        const plan = normalizePlanValue(lead.goals);
        const isSendingThisRow = sendingPaymentLeadId === lead._id;

        if (plan === "basic") {
          return (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Chip
                label="Free Plan"
                size="small"
                sx={{ backgroundColor: "#DBEAFE", color: "#1D4ED8", fontWeight: 600, fontSize: "0.75rem" }}
              />
            </div>
          );
        }

        const paymentInfo = getPaymentInfo(lead);
        if (paymentInfo.isPaid) {
          return (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Chip
                label={paymentInfo.label}
                size="small"
                sx={{ backgroundColor: "#D1FAE5", color: "#047857", fontWeight: 600, fontSize: "0.75rem" }}
              />
            </div>
          );
        }

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              variant="outlined"
              size="small"
              disabled={isSendingThisRow}
              onClick={() => handleSendPlanPayment(lead)}
              sx={{ textTransform: "none", borderRadius: "9999px", fontSize: "0.7rem", py: 0.3 }}
            >
              {isSendingThisRow ? "Sending..." : plan === "professional" ? "Send $199 Link" : "Send Payment Link"}
            </Button>
          </div>
        );
      },
    },
    {
      field: "Invite user",
      headerName: "Invite user",
      cellRenderer: (params) => {
        const emailKey = String(params.data?.email || "").trim().toLowerCase();
        const inviteStatus = deriveInviteStatusFromLead(
          params.data,
          {
            ...(inviteStatuses[emailKey] || {}),
            ...(inviteStatusOverrides[emailKey] || {}),
          },
        );
        const canInvite =
          (params.data.status || "").toLowerCase() === "closed" &&
          !["registered", "joined"].includes(inviteStatus);
        const isSendingThisRow = sendingInviteLeadId === params.data._id;

        return (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#2563eb",
                color: "white",
                textTransform: "none",
                borderRadius: "9999px",
              }}
              disabled={!canInvite || isSendingThisRow}
              onClick={() => {
                setSendingInviteLeadId(params.data._id);
                sendInviteMutation.mutate(params.data);
              }}
            >
              {isSendingThisRow ? "Sending..." : "Invite user"}
            </Button>
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
      </MuiModal>

      <MuiModal
        open={!!customPaymentLead}
        onClose={() => setCustomPaymentLead(null)}
        title="Send Custom Plan Payment Link"
      >
        <div className="flex flex-col gap-4">
          <p className="text-content text-gray-500">
            To {customPaymentLead?.name || "this lead"} ({customPaymentLead?.email})
          </p>
          <TextField
            label="Amount (USD)"
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Description"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            fullWidth
          />
          <PrimaryButton
            title="Generate & Send"
            handleSubmit={handleSubmitCustomPayment}
            isLoading={sendPlanPaymentLinkMutation.isPending}
          />
        </div>
      </MuiModal>
    </>
  );
};

export default SignupLeads;
