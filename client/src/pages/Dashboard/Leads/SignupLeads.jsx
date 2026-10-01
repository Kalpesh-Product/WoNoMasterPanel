import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { toast } from "sonner";
import {
  Search,
  Eye,
  X,
  Mail,
  MessageSquare,
  Users,
  Target,
  CheckCircle2,
  Clock,
  Send,
  FileText,
  Paperclip,
  Building2,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";
import PageFrame from "../../../components/Pages/PageFrame";
import CustomPlanModulePicker from "../../../components/CustomPlanModulePicker";
import { buildListingUrl } from "../../../constants/verificationTiers";

const STATUSES = ["pending", "contacted", "closed", "rejected"];
const PLANS = ["basic", "professional", "customise"];
const INVITE_STATUSES = ["not_invited", "invite_sent", "registered", "joined"];

const normalizePlanValue = (value) => {
  const n = String(value || "basic")
    .trim()
    .toLowerCase();
  if (["custom", "customise", "customize", "customised", "customized"].includes(n))
    return "customise";
  if (n === "professional") return "professional";
  return "basic";
};

const normalizeInviteStatus = (status) => {
  const n = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (n === "invite_sent") return "invite_sent";
  if (n === "registered") return "registered";
  if (n === "joined") return "joined";
  return "not_invited";
};

const deriveInviteStatus = (lead = {}, overrides = {}) => {
  const explicit = normalizeInviteStatus(
    overrides.inviteStatus ||
      lead.inviteStatus ||
      lead.invitationStatus ||
      lead.userStatus ||
      lead.registrationStatus,
  );
  if (
    overrides.joinedAt ||
    lead.joinedAt ||
    lead.lastLoginAt ||
    lead.isJoined === true
  )
    return "joined";
  if (
    overrides.registeredAt ||
    lead.registeredAt ||
    lead.accountCreatedAt ||
    lead.isRegistered === true
  )
    return "registered";
  if (overrides.inviteSentAt || lead.inviteSentAt) return "invite_sent";
  return explicit;
};

const formatDate = (value) => {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getInitials = (value) =>
  String(value || "LD")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

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

// "closed" is stored as-is (Nomads and the invite gate key off it) but staff
// know it as the lead being approved after confirming their requirements.
const statusLabel = (status) =>
  status === "closed"
    ? "Approved"
    : String(status || "").charAt(0).toUpperCase() + String(status || "").slice(1);

const MAX_AGREEMENT_BYTES = 5 * 1024 * 1024;

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
  const [sendingPaymentLeadId, setSendingPaymentLeadId] = useState(null);
  const [customPaymentLead, setCustomPaymentLead] = useState(null);
  const [inviteLead, setInviteLead] = useState(null);
  const [showInterest, setShowInterest] = useState(false);
  const [planFilter, setPlanFilter] = useState("All");
  const [inviteFilter, setInviteFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");

  const { data: leads = [], isPending } = useQuery({
    queryKey: ["signup-leads"],
    queryFn: async () => {
      const response = await axios.get(
        `${NOMADS_API_BASE_URL}/forms/host-users`,
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const inviteEmails = useMemo(
    () =>
      leads
        .map((l) =>
          String(l?.email || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
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

  const { data: defaultAgreement } = useQuery({
    queryKey: ["invite-default-agreement"],
    queryFn: async () =>
      (await axios.get("/api/host-user/invite-agreement")).data?.agreement || null,
  });

  const saveAgreementMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("agreement", file);
      return (await axios.put("/api/host-user/invite-agreement", formData)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invite-default-agreement"] });
      toast.success(data?.message || "Default agreement saved");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "Failed to save the agreement"),
  });

  const removeAgreementMutation = useMutation({
    mutationFn: async () => (await axios.delete("/api/host-user/invite-agreement")).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-default-agreement"] });
      toast.success("Default agreement removed");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "Failed to remove the agreement"),
  });

  const { data: clickInterest = [], isPending: isLoadingInterest } = useQuery({
    queryKey: ["verify-business-clicks"],
    enabled: showInterest,
    queryFn: async () =>
      (await axios.get("/api/host-user/verify-clicks")).data?.data || [],
  });

  // Custom-plan module selections staff have already saved per lead.
  const { data: savedSelections = {} } = useQuery({
    queryKey: ["custom-plan-selections"],
    queryFn: async () =>
      (await axios.get("/api/hosts/plan-payments/custom-selections")).data || {},
  });

  const saveSelectionMutation = useMutation({
    mutationFn: async ({ lead, customModuleIds, priceOverrides, overallDiscountUsd }) =>
      (
        await axios.post("/api/hosts/plan-payments/custom-selection", {
          companyId: lead?._id,
          companyName: lead?.companyName,
          email: lead?.email,
          name: lead?.name,
          customModuleIds,
          priceOverrides,
          overallDiscountUsd,
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom-plan-selections"] });
      setCustomPaymentLead(null);
      toast.success(
        `Selection saved — $${data?.monthlyPriceUsd ?? "--"}/mo. Send the link when ready.`,
      );
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "Failed to save the selection"),
  });

  const { data: planPricing } = useQuery({
    queryKey: ["planPricing"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-pricing");
      return response?.data || { settings: {}, rows: [] };
    },
  });

  const { data: paymentStatusByLeadId = {} } = useQuery({
    queryKey: ["planPaymentStatuses"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-payments");
      return response?.data || {};
    },
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ hostUserId, ...payload }) => {
      const res = await axios.patch(
        `${NOMADS_API_BASE_URL}/forms/host-users/${hostUserId}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      queryClient.invalidateQueries({
        queryKey: ["signup-lead-invite-statuses"],
      });
      setSelectedLead(null);
      toast.success("Lead updated");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "Update failed"),
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ lead }) => {
      const invitePayload = {
        leadId: lead?._id,
        email: lead?.email,
        name: lead?.name,
        mobile: lead?.mobile,
        companyName: lead?.companyName,
        verticalType: lead?.verticalType,
        country: lead?.country,
        state: lead?.state,
        city: lead?.city,
        source: lead?.source,
        fullName: lead?.name,
        selectedPlan: lead?.goals,
        status: lead?.status,
        goals: lead?.goals,
        comment: lead?.comment,
        // The wono.co company the lead asked to verify (if any). Only a
        // suggestion: HostPanel pre-selects it in "Verify Existing Listings",
        // and nothing is linked until staff approve the host's request there.
        suggestedNomadsCompanyId: lead?.nomadsCompanyId || undefined,
      };
      const res = await axios.post("/api/host-user/send-invite", invitePayload);
      if (lead?._id) {
        try {
          await axios.patch(
            `${NOMADS_API_BASE_URL}/forms/host-users/${lead._id}`,
            {
              status: String(lead?.status || "closed").toLowerCase(),
              inviteStatus: "invite_sent",
              inviteSentAt: new Date().toISOString(),
            },
          );
        } catch (e) {
          /* best-effort */
        }
      }
      return res.data;
    },
    onSuccess: (data, { lead }) => {
      setSendingInviteId(null);
      const emailKey = String(lead?.email || "")
        .trim()
        .toLowerCase();
      const inviteSentAt = new Date().toISOString();
      setInviteOverrides((prev) => ({
        ...prev,
        [emailKey]: {
          ...prev[emailKey],
          inviteStatus: "invite_sent",
          inviteSentAt,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["signup-leads"] });
      queryClient.invalidateQueries({
        queryKey: ["signup-lead-invite-statuses"],
      });
      toast.success(data?.message || "Invite email sent");
    },
    onError: (err) => {
      setSendingInviteId(null);
      toast.error(err?.response?.data?.message || "Failed to send invite");
    },
  });

  const getPaymentInfo = (lead) => {
    const record = paymentStatusByLeadId[String(lead?._id || "")];
    if (!record)
      return { status: "Not Sent", label: "Not Sent", isPaid: false };

    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(record.currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(record.amount || 0);

    const isPaid = record.status === "paid";
    const cycleSuffix =
      String(record.billingCycle || "").toLowerCase() === "annual" ? "/yr" : "/mo";
    return {
      status: isPaid ? "Paid" : "Pending",
      label: `${isPaid ? "Paid" : "Pending"} · ${formattedAmount}${cycleSuffix}`,
      isPaid,
    };
  };

  const sendPlanPaymentLinkMutation = useMutation({
    mutationFn: async ({ lead, plan, customModuleIds, customPriceOverrides, customOverallDiscountUsd }) => {
      const response = await axios.post("/api/hosts/plan-payments/send", {
        companyId: lead?._id,
        email: lead?.email,
        name: lead?.name,
        companyName: lead?.companyName,
        plan,
        customModuleIds,
        customPriceOverrides,
        customOverallDiscountUsd,
        billingCycle: lead?.billingCycle || "monthly",
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSendingPaymentLeadId(null);
      setCustomPaymentLead(null);
      queryClient.invalidateQueries({ queryKey: ["planPaymentStatuses"] });
      const cycle = String(data?.billingCycle || "monthly").toLowerCase();
      toast.success(
        data?.message
          ? `${data.message} ($${Number(data.amount || 0).toFixed(0)}/${cycle === "annual" ? "yr" : "mo"})`
          : "Payment link email sent",
      );
    },
    onError: (error) => {
      setSendingPaymentLeadId(null);
      toast.error(
        error?.response?.data?.message || "Failed to send payment link",
      );
    },
  });

  const handleSendPlanPayment = (lead) => {
    const plan = normalizePlanValue(lead?.goals);

    if (plan === "professional") {
      setSendingPaymentLeadId(lead._id);
      sendPlanPaymentLinkMutation.mutate({ lead, plan: "professional" });
      return;
    }

    // Custom plan's price is computed server-side from the module selection
    // staff pick here — no amount is typed by hand.
    setCustomPaymentLead(lead);
  };

  const handleSubmitCustomPayment = (selectedModuleIds, _totalUsd, priceOverrides, overallDiscountUsd) => {
    setSendingPaymentLeadId(customPaymentLead._id);
    sendPlanPaymentLinkMutation.mutate({
      lead: customPaymentLead,
      plan: "custom",
      customModuleIds: selectedModuleIds,
      customPriceOverrides: priceOverrides,
      customOverallDiscountUsd: overallDiscountUsd,
    });
  };

  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter(
      (l) => (l.status || "pending") === "pending",
    ).length;
    const contacted = leads.filter((l) => l.status === "contacted").length;
    const closed = leads.filter((l) => l.status === "closed").length;
    // New leads by sign-up date: since midnight today, and in the last 30 days.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const createdMs = (l) => new Date(l.createdAt).getTime() || 0;
    const newToday = leads.filter((l) => createdMs(l) >= startOfToday.getTime()).length;
    const last30Days = leads.filter((l) => createdMs(l) >= thirtyDaysAgo).length;
    return { total, pending, contacted, closed, newToday, last30Days };
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "All" || (lead.status || "pending") === statusFilter;
      const matchesQuery =
        !q ||
        [
          lead.name,
          lead.email,
          lead.companyName,
          lead.mobile,
          lead.source,
          lead.country,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [leads, search, statusFilter]);

  const getInviteStatus = (lead) => {
    const emailKey = String(lead?.email || "")
      .trim()
      .toLowerCase();
    return deriveInviteStatus(lead, {
      ...(inviteStatuses[emailKey] || {}),
      ...(inviteOverrides[emailKey] || {}),
    });
  };

  // Tabs + search narrow `filtered`; the plan / invite / date dropdowns narrow it further.
  const DATE_FILTER_DAYS = { today: 0, "7d": 7, "30d": 30 };
  const visibleLeads = filtered.filter((lead) => {
    if (planFilter !== "All" && normalizePlanValue(lead.goals) !== planFilter) return false;
    if (inviteFilter !== "All" && getInviteStatus(lead) !== inviteFilter) return false;
    if (dateFilter !== "All") {
      const created = new Date(lead.createdAt).getTime() || 0;
      const since = new Date();
      if (dateFilter === "today") since.setHours(0, 0, 0, 0);
      else since.setTime(Date.now() - DATE_FILTER_DAYS[dateFilter] * 24 * 60 * 60 * 1000);
      if (created < since.getTime()) return false;
    }
    return true;
  });
  const hasExtraFilters =
    planFilter !== "All" || inviteFilter !== "All" || dateFilter !== "All";

  const closeInviteModal = () => {
    setInviteLead(null);
  };

  const handleAgreementPick = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("The agreement must be a PDF file");
      return;
    }
    if (file.size > MAX_AGREEMENT_BYTES) {
      toast.error("The agreement must be 5 MB or smaller");
      return;
    }
    saveAgreementMutation.mutate(file);
  };

  const handleConfirmInvite = () => {
    if (!inviteLead) return;
    setSendingInviteId(inviteLead._id);
    // The agreement is compulsory — nothing goes out without one saved.
    if (!defaultAgreement) return;
    inviteMutation.mutate({ lead: inviteLead });
    closeInviteModal();
  };

  const handleStatusChange = (leadId, status) => {
    updateMutation.mutate({ hostUserId: leadId, status: status.toLowerCase() });
  };

  const handlePlanChange = (leadId, plan) => {
    updateMutation.mutate({
      hostUserId: leadId,
      goals: normalizePlanValue(plan),
    });
  };

  const handleComment = () => {
    if (!selectedLead?._id || !commentText.trim()) return;
    updateMutation.mutate({
      hostUserId: selectedLead._id,
      comment: commentText.trim(),
    });
  };

  const pageHeading = (
    <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
      <div>
        <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
          Signup Leads
        </h2>
        <p className="text-xs font-pmedium text-slate-500 mt-1">
          Track and manage incoming signup leads, invite qualified leads to
          register.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setShowInterest(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-pmedium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <Building2 size={13} /> wono.co Interest
      </button>
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
                <div
                  key={i}
                  className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse"
                >
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
            <div data-tour="signup-leads-stats" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 shrink-0">
              {[
                {
                  label: "Total Leads",
                  value: stats.total,
                  icon: Target,
                  accent: "border-l-slate-400",
                  textColor: "text-slate-500",
                  bgColor: "bg-slate-50",
                },
                {
                  label: "New Today",
                  value: stats.newToday,
                  icon: CalendarDays,
                  accent: "border-l-indigo-500",
                  textColor: "text-indigo-600",
                  bgColor: "bg-indigo-50",
                },
                {
                  label: "Last 30 Days",
                  value: stats.last30Days,
                  icon: CalendarRange,
                  accent: "border-l-sky-500",
                  textColor: "text-sky-600",
                  bgColor: "bg-sky-50",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  icon: Clock,
                  accent: "border-l-amber-500",
                  textColor: "text-amber-600",
                  bgColor: "bg-amber-50",
                },
                {
                  label: "Contacted",
                  value: stats.contacted,
                  icon: Users,
                  accent: "border-l-blue-500",
                  textColor: "text-blue-600",
                  bgColor: "bg-blue-50",
                },
                {
                  label: "Approved",
                  value: stats.closed,
                  icon: CheckCircle2,
                  accent: "border-l-emerald-500",
                  textColor: "text-emerald-600",
                  bgColor: "bg-emerald-50",
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}
                  >
                    <div>
                      <p
                        className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${s.textColor}`}
                      >
                        {s.label}
                      </p>
                      <p className="text-[15px] font-pmedium text-slate-900">
                        {s.value}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl p-2 ${s.bgColor} ${s.textColor}`}
                    >
                      <Icon size={16} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-slate-50/50">
                <div data-tour="signup-leads-status-filter" className="flex min-w-0 flex-wrap gap-1.5 overflow-x-auto">
                  {["All", ...STATUSES].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-pmedium transition ${statusFilter === s ? "bg-[#2563EB] text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                  {[
                    {
                      key: "plan",
                      value: planFilter,
                      set: setPlanFilter,
                      options: [
                        ["All", "All plans"],
                        ...PLANS.map((p) => [p, p.charAt(0).toUpperCase() + p.slice(1)]),
                      ],
                    },
                    {
                      key: "invite",
                      value: inviteFilter,
                      set: setInviteFilter,
                      options: [
                        ["All", "All invites"],
                        ...INVITE_STATUSES.map((st) => [st, inviteLabels[st]]),
                      ],
                    },
                    {
                      key: "date",
                      value: dateFilter,
                      set: setDateFilter,
                      options: [
                        ["All", "Any date"],
                        ["today", "Today"],
                        ["7d", "Last 7 days"],
                        ["30d", "Last 30 days"],
                      ],
                    },
                  ].map((f) => (
                    <select
                      key={f.key}
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      className={`rounded-lg border bg-white px-2.5 py-2 text-[11px] font-pmedium outline-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 ${f.value === "All" ? "border-slate-200/60 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                    >
                      {f.options.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ))}
                  {hasExtraFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlanFilter("All");
                        setInviteFilter("All");
                        setDateFilter("All");
                      }}
                      className="text-[11px] font-pmedium text-slate-500 underline hover:text-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div data-tour="signup-leads-search" className="relative w-full shrink-0 lg:w-72">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                  />
                  <input
                    type="text"
                    placeholder="Search name, email, company..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
              {visibleLeads.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <Target size={28} />
                  </div>
                  <p className="text-slate-400 font-semibold font-pmedium">
                    No matching leads found.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table
                    data-tour="signup-leads-table"
                    className="w-full text-left min-w-[1600px]"
                  >
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-5 py-4 whitespace-nowrap">Sr No</th>
                        <th className="px-5 py-4 whitespace-nowrap">Lead</th>
                        <th className="px-5 py-4 whitespace-nowrap">Company</th>
                        <th className="px-5 py-4 whitespace-nowrap">Plan</th>
                        <th className="px-5 py-4 whitespace-nowrap">Billing</th>
                        <th className="px-5 py-4 whitespace-nowrap">Status</th>
                        <th className="px-5 py-4 whitespace-nowrap">Invite Status</th>
                        <th className="px-5 py-4 whitespace-nowrap">Invite</th>
                        <th className="px-5 py-4 whitespace-nowrap">Payment Status</th>
                        <th className="px-5 py-4 whitespace-nowrap">Payment Link</th>
                        <th className="px-5 py-4 whitespace-nowrap text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                      {visibleLeads.map((lead, index) => {
                        const inviteStatus = getInviteStatus(lead);
                        const statusVal = (
                          lead.status || "pending"
                        ).toLowerCase();
                        const planVal = normalizePlanValue(lead.goals);
                        const paymentInfo = getPaymentInfo(lead);
                        const canInvite =
                          statusVal === "closed" &&
                          !["registered", "joined"].includes(inviteStatus) &&
                          (planVal === "basic" || paymentInfo.isPaid);
                        const isSending = sendingInviteId === lead._id;
                        const isSendingPayment =
                          sendingPaymentLeadId === lead._id;
                        return (
                          <tr
                            key={lead._id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                  {getInitials(lead.name)}
                                </div>
                                <div className="min-w-0 max-w-[210px]">
                                  <p
                                    className="text-[12px] font-pmedium text-slate-900 truncate"
                                    title={lead.name}
                                  >
                                    {lead.name || "--"}
                                  </p>
                                  <p
                                    className="text-[10px] font-pmedium text-slate-500 truncate"
                                    title={lead.email}
                                  >
                                    {lead.email || ""}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[220px]"
                              title={lead.companyName}
                            >
                              {lead.companyName || "--"}
                            </td>
                            <td
                              data-tour="signup-leads-plan-column"
                              className="px-5 py-4"
                            >
                              <select
                                value={planVal}
                                onChange={(e) =>
                                  handlePlanChange(lead._id, e.target.value)
                                }
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${planTones[planVal] || "bg-slate-50 text-slate-600 border-slate-200"}`}
                              >
                                {PLANS.map((p) => (
                                  <option key={p} value={p}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {planVal === "basic" ? (
                                <span className="text-[12px] font-pmedium text-slate-300">—</span>
                              ) : (
                                <span
                                  className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${
                                    lead.billingCycle === "annual"
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {lead.billingCycle === "annual" ? "Annual" : "Monthly"}
                                </span>
                              )}
                            </td>
                            <td
                              data-tour="signup-leads-status-column"
                              className="px-5 py-4"
                            >
                              <select
                                value={statusVal}
                                onChange={(e) =>
                                  handleStatusChange(lead._id, e.target.value)
                                }
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider cursor-pointer outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${statusPillClass(statusVal)}`}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {statusLabel(s)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td
                              data-tour="signup-leads-invite-status-column"
                              className="px-5 py-4"
                            >
                              <span
                                className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${inviteTones[inviteStatus] || inviteTones.not_invited}`}
                              >
                                {inviteLabels[inviteStatus] || inviteStatus}
                              </span>
                              {(() => {
                                const meta =
                                  inviteStatuses[String(lead.email || "").trim().toLowerCase()];
                                const sentAt = meta?.lastInviteSentAt || meta?.inviteSentAt;
                                if (!sentAt || inviteStatus === "not_invited") return null;
                                return (
                                  <p className="mt-1 text-[10px] font-pmedium text-slate-500 whitespace-nowrap">
                                    Sent {formatDate(sentAt)}
                                    {meta?.inviteCount > 1 ? ` · ${meta.inviteCount}×` : ""}
                                  </p>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                disabled={!canInvite || isSending}
                                onClick={() => setInviteLead(lead)}
                                title={
                                  !canInvite &&
                                  statusVal === "closed" &&
                                  planVal !== "basic" &&
                                  !paymentInfo.isPaid
                                    ? "Invite unlocks once the plan payment is confirmed"
                                    : undefined
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition ${canInvite ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                              >
                                <Send size={10} />
                                {isSending
                                  ? "Sending..."
                                  : inviteStatus === "invite_sent"
                                    ? "Resend"
                                    : "Invite"}
                              </button>
                            </td>
                            <td
                              data-tour="signup-leads-payment-status-column"
                              className="px-5 py-4"
                            >
                              {planVal === "basic" ? (
                                <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-blue-50 text-blue-700">
                                  Free Plan
                                </span>
                              ) : (
                                <span
                                  className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${paymentInfo.isPaid ? "bg-emerald-50 text-emerald-700" : paymentInfo.status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                                >
                                  {paymentInfo.label}
                                </span>
                              )}
                            </td>
                            <td
                              data-tour="signup-leads-payment-link-column"
                              className="px-5 py-4 text-center"
                            >
                              {planVal === "basic" ? (
                                <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-blue-50 text-blue-700">
                                  Free Plan
                                </span>
                              ) : paymentInfo.isPaid ? (
                                <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider bg-emerald-50 text-emerald-700">
                                  {paymentInfo.label}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSendingPayment}
                                  onClick={() => handleSendPlanPayment(lead)}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSendingPayment
                                    ? "Sending..."
                                    : planVal === "professional"
                                      ? `Send $${lead?.billingCycle === "annual"
                                          ? planPricing?.settings?.professionalAnnualPlanPriceUsd ?? "..."
                                          : planPricing?.settings?.professionalPlanPriceUsd ?? "..."} Link`
                                      : (savedSelections[String(lead._id)]?.moduleIds || []).length
                                        ? `Send Link · ${savedSelections[String(lead._id)].moduleIds.length} modules`
                                        : "Select Modules & Send Link"}
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewLead(lead);
                                    setCommentText(lead.comment || "");
                                  }}
                                  title="View details"
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                  <Eye size={15} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLead(lead);
                                    setCommentText(lead.comment || "");
                                  }}
                                  title="Add comment"
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                                >
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
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setViewLead(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  {getInitials(viewLead.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                    {viewLead.name}
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                    {viewLead.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewLead(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <Mail size={14} /> Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Phone
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.mobile || "Not shared"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Email
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900 break-all">
                      {viewLead.email || "Not shared"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Company
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.companyName || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Role
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.role || "--"}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <Target size={14} /> Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Plan
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900 uppercase">
                      {normalizePlanValue(viewLead.goals)}
                    </p>
                  </div>
                  {normalizePlanValue(viewLead.goals) !== "basic" && (
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                        Billing
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900">
                        {viewLead.billingCycle === "annual"
                          ? "Annual (chosen at signup)"
                          : "Monthly (chosen at signup)"}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Status
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {statusLabel(viewLead.status || "pending")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Vertical
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {Array.isArray(viewLead.verticalType)
                        ? viewLead.verticalType.join(", ")
                        : viewLead.verticalType || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Country
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.country || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      State
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.state || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      City
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.city || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Source
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.source || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Form
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {viewLead.formName || "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                      Created
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">
                      {formatDate(viewLead.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              {(() => {
                const payment = paymentStatusByLeadId[String(viewLead._id || "")];
                if (!payment || payment.status !== "paid") return null;
                const invoiceUrl = payment.hostedInvoiceUrl || payment.invoicePdfUrl;
                return (
                  <div>
                    <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <FileText size={14} /> Plan Payment
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                          Plan
                        </p>
                        <p className="text-[12px] font-pmedium text-slate-900 capitalize">
                          {payment.plan} · {payment.billingCycle === "annual" ? "Annual" : "Monthly"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                          Amount paid
                        </p>
                        <p className="text-[12px] font-pmedium text-slate-900">
                          {String(payment.currency || "usd").toUpperCase()} {payment.amount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                          Paid on
                        </p>
                        <p className="text-[12px] font-pmedium text-slate-900">
                          {formatDate(payment.paidAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                          Invoice
                        </p>
                        {invoiceUrl ? (
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-pmedium text-blue-600 hover:underline"
                          >
                            <FileText size={12} /> View Invoice
                          </a>
                        ) : (
                          <p className="text-[12px] font-pmedium text-slate-500">
                            Being generated
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {viewLead.nomadsCompanyId && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                    <Building2 size={14} /> Came From wono.co
                  </h3>
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 text-[12px] font-pmedium text-slate-700">
                    <p>
                      Clicked <b>Verify Business</b> on the listing of{" "}
                      <b>{viewLead.sourceListing?.companyName || viewLead.companyName}</b>.
                    </p>
                    <a
                      href={buildListingUrl({
                        businessId: viewLead.sourceListing?.businessId,
                        companyType: viewLead.sourceListing?.companyType,
                        companyName:
                          viewLead.sourceListing?.companyName || viewLead.companyName,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-blue-600 hover:underline"
                    >
                      View listing on wono.co
                    </a>
                  </div>
                </div>
              )}
              {(() => {
                const agreement =
                  inviteStatuses[
                    String(viewLead.email || "").trim().toLowerCase()
                  ]?.agreement;
                if (!agreement?.sent && !agreement?.accepted) return null;
                const linkClass =
                  "text-[12px] font-pmedium text-blue-600 hover:underline break-all";
                return (
                  <div>
                    <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <FileText size={14} /> Agreement &amp; Documents
                    </h3>
                    <div className="grid grid-cols-1 gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      {agreement.sent && (
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                            Agreement sent
                          </p>
                          <a
                            href={agreement.sent.url}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClass}
                          >
                            {agreement.sent.name}
                          </a>
                          <span className="text-[11px] text-slate-500">
                            {" "}
                            · {formatDate(agreement.sent.sentAt)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                          Accepted by host
                        </p>
                        <p className="text-[12px] font-pmedium text-slate-900">
                          {agreement.accepted
                            ? `Yes · ${formatDate(agreement.acceptedAt)}`
                            : "Not yet"}
                        </p>
                      </div>
                      {agreement.signedDocument && (
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                            Signed agreement
                          </p>
                          <a
                            href={agreement.signedDocument.url}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClass}
                          >
                            {agreement.signedDocument.name || "Signed agreement"}
                          </a>
                        </div>
                      )}
                      {agreement.businessDocuments?.length > 0 && (
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                            Business documents
                          </p>
                          <div className="flex flex-col gap-1">
                            {agreement.businessDocuments.map((doc) => (
                              <a
                                key={doc.id || doc.url}
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className={linkClass}
                              >
                                {doc.name || "Business document"}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {viewLead.comment && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                    <MessageSquare size={14} /> Comment
                  </h3>
                  <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[12px] font-pmedium leading-5 text-slate-700 whitespace-pre-wrap">
                      {viewLead.comment}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setViewLead(null)}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal — optional agreement attachment */}
      {inviteLead && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={closeInviteModal}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                  {getInviteStatus(inviteLead) === "invite_sent" ? "Resend Invite" : "Send Invite"}
                </h2>
                <p className="text-[11px] font-pmedium text-slate-500 mt-0.5 truncate">
                  {inviteLead.name} · {inviteLead.email}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-3">
              {getInviteStatus(inviteLead) === "invite_sent" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-pmedium leading-5 text-amber-800">
                  An invite was already sent to this lead. This emails a fresh
                  invite link (valid for 7 days) — use it if the first one didn&apos;t
                  arrive or has expired.
                </p>
              )}
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest block">
                Agreement (required)
              </label>
              {defaultAgreement ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <a
                      href={defaultAgreement.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-2 text-[12px] font-pmedium text-blue-600 hover:underline"
                    >
                      <Paperclip size={14} className="shrink-0" />
                      <span className="truncate">{defaultAgreement.name}</span>
                    </a>
                    <span className="flex shrink-0 items-center gap-3 text-[11px] font-pmedium">
                      <label className="cursor-pointer text-slate-600 hover:text-[#2563EB]">
                        {saveAgreementMutation.isPending ? "Saving..." : "Replace"}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={saveAgreementMutation.isPending}
                          onChange={handleAgreementPick}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={removeAgreementMutation.isPending}
                        onClick={() => removeAgreementMutation.mutate()}
                        className="text-slate-500 hover:text-rose-600 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                </>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-[12px] font-pmedium text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                  <Paperclip size={14} />
                  {saveAgreementMutation.isPending ? "Saving..." : "Upload agreement PDF to continue"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={saveAgreementMutation.isPending}
                    onChange={handleAgreementPick}
                  />
                </label>
              )}
              <p className="text-[11px] font-pmedium leading-5 text-slate-500">
                {defaultAgreement
                  ? "This agreement is attached to every invite until you replace it. "
                  : "An agreement is required before an invite can be sent. Upload it once and it's attached to every invite from now on. "}
                The host fills it in, then uploads it — and ticks &quot;I agree&quot; —
                while creating their business location.
              </p>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2.5">
              <button
                type="button"
                onClick={closeInviteModal}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInvite}
                disabled={!defaultAgreement}
                title={defaultAgreement ? undefined : "Upload the agreement first"}
                className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2563EB]"
              >
                {getInviteStatus(inviteLead) === "invite_sent" ? "Resend invite" : "Send invite"} with
                agreement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* wono.co Interest Modal — "Verify Business" clicks per listing company */}
      {showInterest && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setShowInterest(false)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                  wono.co Interest
                </h2>
                <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                  Businesses whose listing visitors clicked &quot;Verify Business&quot; on.
                  Ones with no signup yet are worth following up.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInterest(false)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto">
              {isLoadingInterest ? (
                <p className="p-8 text-center text-[12px] font-pmedium text-slate-400">Loading...</p>
              ) : clickInterest.length === 0 ? (
                <p className="p-8 text-center text-[12px] font-pmedium text-slate-400">
                  No clicks recorded yet.
                </p>
              ) : (
                <table className="w-full text-left min-w-[640px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Clicks</th>
                      <th className="px-5 py-3">Visitors</th>
                      <th className="px-5 py-3">Last clicked</th>
                      <th className="px-5 py-3">Signed up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {clickInterest.map((row) => (
                      <tr key={row.companyId}>
                        <td className="px-5 py-3">
                          <a
                            href={buildListingUrl({
                              businessId: row.businessId,
                              companyType: row.companyType,
                              companyName: row.companyName,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] font-pmedium text-blue-600 hover:underline"
                          >
                            {row.companyName}
                          </a>
                          <p className="text-[10px] font-pmedium text-slate-500">
                            {[row.city, row.country].filter(Boolean).join(", ")}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-[12px] font-pmedium text-slate-800">{row.clicks}</td>
                        <td className="px-5 py-3 text-[12px] font-pmedium text-slate-800">
                          {row.uniqueVisitors}
                        </td>
                        <td className="px-5 py-3 text-[12px] font-pmedium text-slate-700">
                          {formatDate(row.lastClickedAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${row.signedUps > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                          >
                            {row.signedUps > 0 ? "Yes" : "Not yet"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-amber-500 text-white">
                  <MessageSquare size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                    Update Comment
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                    {selectedLead.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                  placeholder="Enter your comment..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all resize-none"
                />
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComment}
                disabled={updateMutation.isPending || !commentText.trim()}
                className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? "Saving..." : "Save Comment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomPlanModulePicker
        open={Boolean(customPaymentLead)}
        contactName={customPaymentLead?.name}
        contactEmail={customPaymentLead?.email}
        onClose={() => setCustomPaymentLead(null)}
        onSubmit={(selectedModuleIds, totalUsd, priceOverrides, overallDiscountUsd) =>
          handleSubmitCustomPayment(selectedModuleIds, totalUsd, priceOverrides, overallDiscountUsd)
        }
        isSubmitting={sendPlanPaymentLinkMutation.isPending}
        billingCycle={customPaymentLead?.billingCycle}
        initialSelectedModuleIds={
          savedSelections[String(customPaymentLead?._id || "")]?.moduleIds || []
        }
        initialPriceOverrides={
          savedSelections[String(customPaymentLead?._id || "")]?.priceOverrides || {}
        }
        initialOverallDiscountUsd={
          savedSelections[String(customPaymentLead?._id || "")]?.overallDiscountUsd || 0
        }
        onSave={(customModuleIds, _totalUsd, priceOverrides, overallDiscountUsd) =>
          saveSelectionMutation.mutate({
            lead: customPaymentLead,
            customModuleIds,
            priceOverrides,
            overallDiscountUsd,
          })
        }
        isSaving={saveSelectionMutation.isPending}
      />
    </>
  );
};

export default SignupLeads;
