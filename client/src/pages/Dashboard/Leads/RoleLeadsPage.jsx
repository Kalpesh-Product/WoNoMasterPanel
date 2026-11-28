import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Mail,
  Paperclip,
  Phone,
  Power,
  Search,
  Send,
  Target,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { ValueAddsLeadsTableSkeleton } from "../../../components/ui/Skeleton";

// Generic "leads with per-role approval tabs" page, shared by Contributor Leads
// and Value Adds Partner Leads: one lead can request several roles at once
// (e.g. several contribution/partner types), so it shows up under every
// matching tab instead of being duplicated per choice.

const formatDateLabel = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getName = (row) => row.fullName || row.name || "--";
const getEmail = (row) => row.email || "--";
const getPhone = (row) => {
  const number = row.contactNumber || row.mobileNumber || "";
  const code = row.contactCode || "";
  return [code, number].filter(Boolean).join(" ") || "--";
};

const getInitials = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CL";

const getContributionTypes = (row) => {
  if (Array.isArray(row.contributionType)) return row.contributionType;
  if (Array.isArray(row.contributionTypes)) return row.contributionTypes;
  return String(row.contributionType || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const REVIEW_STATUSES = ["pending", "contacted", "approved", "rejected"];
const normalizeReviewStatus = (value) => {
  const status = normalize(value);
  return REVIEW_STATUSES.includes(status) ? status : "pending";
};
const reviewStatusTone = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const invitationStatusTone = {
  not_invited: "border-slate-200 bg-slate-50 text-slate-600",
  invite_sent: "border-blue-200 bg-blue-50 text-blue-700",
  joined: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const invitationStatusLabel = {
  not_invited: "Not Invited",
  invite_sent: "Invite Sent",
  joined: "Joined",
};
const stickyActionHeaderClass =
  "sticky right-0 z-20 border-l border-slate-100 bg-slate-50 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.18)]";
const stickyActionCellClass =
  "sticky right-0 z-10 border-l border-slate-100 bg-white shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.18)] group-hover:bg-slate-50";

const MAX_AGREEMENT_BYTES = 5 * 1024 * 1024;

const matchesDateFilter = (value, filter) => {
  if (filter === "all") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === "today") return date.toDateString() === now.toDateString();
  const days = filter === "7d" ? 7 : 30;
  return date >= new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

const matchesTab = (row, tab) => {
  const contributionTypes = getContributionTypes(row);
  if (!contributionTypes.length) return row?.[tab.roleFlag] === true;
  const typeText = normalize(contributionTypes.join(" "));
  return tab.matchers.some((matcher) => typeText.includes(matcher));
};

const getMatchedTabs = (row, tabsList) => tabsList.filter((tab) => matchesTab(row, tab));

const StatTile = ({ label, value, icon: Icon, tone }) => {
  const tones = {
    slate: {
      border: "border-l-slate-400",
      label: "text-slate-500",
      icon: "bg-slate-50 text-slate-600",
    },
    amber: {
      border: "border-l-amber-500",
      label: "text-amber-600",
      icon: "bg-amber-50 text-amber-600",
    },
    emerald: {
      border: "border-l-emerald-500",
      label: "text-emerald-600",
      icon: "bg-emerald-50 text-emerald-600",
    },
    indigo: {
      border: "border-l-indigo-500",
      label: "text-indigo-600",
      icon: "bg-indigo-50 text-indigo-600",
    },
    sky: {
      border: "border-l-sky-500",
      label: "text-sky-600",
      icon: "bg-sky-50 text-sky-600",
    },
    blue: {
      border: "border-l-blue-500",
      label: "text-blue-600",
      icon: "bg-blue-50 text-blue-600",
    },
    rose: {
      border: "border-l-rose-500",
      label: "text-rose-600",
      icon: "bg-rose-50 text-rose-600",
    },
  }[tone];

  return (
    <div
      className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${tones.border}`}
    >
      <div className="min-w-0">
        <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${tones.label}`}>
          {label}
        </p>
        <p className="text-[15px] font-pmedium text-slate-900">{value}</p>
      </div>
      <div className={`shrink-0 rounded-2xl p-2 ${tones.icon}`}>
        <Icon size={16} />
      </div>
    </div>
  );
};

const RequestedServiceBadges = ({ tabs }) => {
  const [expanded, setExpanded] = useState(false);
  const extraCount = tabs.length - 1;
  const visibleTabs = expanded ? tabs : tabs.slice(0, 1);

  return (
    <div className="flex flex-col items-start gap-1">
      {visibleTabs.map((tab) => (
        <span
          key={tab.slug}
          title={tab.label}
          className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-pmedium capitalize text-slate-600"
        >
          {tab.label}
        </span>
      ))}
      {extraCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="whitespace-nowrap text-[10px] font-pmedium text-blue-600 hover:underline"
        >
          {expanded ? "Show less" : `+${extraCount} more`}
        </button>
      ) : null}
    </div>
  );
};

const LeadDetailsModal = ({ lead, activeTab, tabs, combineRoles, modalKindLabel, reviewStatuses, onClose }) => {
  if (!lead) return null;
  const contributionTypes = getContributionTypes(lead);
  const contributionType =
    contributionTypes.find((type) =>
      activeTab.matchers.some((matcher) => normalize(type).includes(matcher)),
    ) ||
    contributionTypes.join(", ") ||
    activeTab.contributionLabel;
  const matchedTabs = combineRoles ? getMatchedTabs(lead, tabs) : [activeTab];

  const detailRows = [];
  if (combineRoles) {
    detailRows.push(["Requested Services", matchedTabs.map((tab) => tab.label).join(", ") || "--"]);
    if (reviewStatuses) {
      detailRows.push(["Review Status", normalizeReviewStatus(lead.partnerStatuses?.[matchedTabs[0]?.roleFlag])]);
    }
  } else {
    detailRows.push(["Contribution Type", contributionType]);
    if (reviewStatuses) {
      detailRows.push(["Review Status", normalizeReviewStatus(lead.partnerStatuses?.[activeTab.roleFlag])]);
    }
  }
  detailRows.push(
    ["Current Country", lead.currentCountry || lead.country || "--"],
    ["LinkedIn Profile", lead.linkedinProfile || "--"],
    ["Message", lead.message || "--"],
    ["Submitted At", formatDateLabel(lead.createdAt)],
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-blue-50/30 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-[12px] font-pmedium text-white shadow-sm">
              {getInitials(getName(lead))}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-pmedium tracking-tight text-slate-800 lg:text-lg">
                {getName(lead)}
              </h2>
              <p className="mt-0.5 text-[11px] font-pmedium text-slate-500">
                {modalKindLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto bg-white p-5 sm:p-6">
          <div>
            <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
              <Phone size={14} /> Contact Information
            </h3>
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                  <Phone size={10} /> Phone
                </p>
                <p className="text-[12px] font-pmedium text-slate-900">
                  {getPhone(lead)}
                </p>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                  <Mail size={10} /> Email
                </p>
                <p className="break-all text-[12px] font-pmedium text-slate-900">
                  {getEmail(lead)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
              <Calendar size={14} /> Details
            </h3>
            <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
              {detailRows.map(([label, value]) => (
                <div key={label}>
                  <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                    {label}
                  </p>
                  <p className="break-words text-[12px] font-pmedium text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[12px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SharedLeadsReviewPage = ({
  tabs,
  activeSlug,
  basePath,
  apiEndpoint,
  queryKey,
  modalKindLabel,
  inviteEndpoint,
  reviewStatuses = false,
  combineRoles = false,
  pageLabel,
  pageDescription,
}) => {
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const defaultTab = tabs[0];
  const tabBySlug = useMemo(
    () => tabs.reduce((acc, tab) => ({ ...acc, [tab.slug]: tab }), {}),
    [tabs],
  );
  const activeTab = tabBySlug[activeSlug] || defaultTab;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteFilter, setInviteFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [inviteLead, setInviteLead] = useState(null);

  useEffect(() => {
    if (combineRoles) return;
    if (!activeSlug || !tabBySlug[activeSlug]) {
      navigate(`${basePath}/${defaultTab.slug}`, { replace: true });
    }
  }, [activeSlug, basePath, combineRoles, defaultTab.slug, navigate, tabBySlug]);

  useEffect(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setInviteFilter("all");
    setDateFilter("all");
    setSelectedLeadId(null);
  }, [activeTab.slug]);

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const response = await axiosPrivate.get(apiEndpoint);
      return response?.data?.data || [];
    },
  });

  const { data: invitationStatuses = {} } = useQuery({
    queryKey: ["partner-lead-invitation-statuses"],
    queryFn: async () =>
      (await axiosPrivate.get("/api/onboarded-partners/lead-statuses")).data?.data || {},
    enabled: Boolean(inviteEndpoint),
  });

  const getInvitationState = (lead) =>
    invitationStatuses[normalize(getEmail(lead))]?.status || "not_invited";

  const updateStatus = useMutation({
    mutationFn: async ({ leadId, role, isActive, status }) =>
      (await axiosPrivate.patch(`${apiEndpoint}/${leadId}/status`, { role, isActive, status })).data,
    onSuccess: (data) => {
      toast.success(data.message || "Lead status updated.");
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update access.");
    },
  });

  const sendInvite = useMutation({
    mutationFn: async ({ lead, service, services: requestedServices }) => {
      // One request for every requested service — Partners Panel sends a
      // single email listing all of them, never one email per service.
      const servicesToInvite = requestedServices || [service];
      return (
        await axiosPrivate.post(inviteEndpoint, {
          leadId: lead._id || lead.id,
          email: getEmail(lead),
          fullName: getName(lead),
          contactCode: lead.contactCode || "",
          contactNumber: lead.contactNumber || lead.mobileNumber || "",
          linkedinProfile: lead.linkedinProfile || "",
          currentCountry: lead.currentCountry || lead.country || "",
          message: lead.message || "",
          submittedAt: lead.createdAt || "",
          services: servicesToInvite,
        })
      ).data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Invite sent.");
      queryClient.invalidateQueries({ queryKey: ["partner-lead-invitation-statuses"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to send invite.");
    },
  });

  // Same one-PDF-attached-to-every-invite pattern as Signup Leads' invite
  // flow for hosts — an agreement must be on file before Send is allowed.
  const { data: defaultAgreement } = useQuery({
    queryKey: ["partner-invite-default-agreement"],
    queryFn: async () =>
      (await axiosPrivate.get("/api/partner-invites/agreement")).data?.agreement || null,
    enabled: Boolean(inviteEndpoint),
  });

  const saveAgreementMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("agreement", file);
      return (await axiosPrivate.put("/api/partner-invites/agreement", formData)).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-invite-default-agreement"] });
      toast.success(data?.message || "Default agreement saved");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to save the agreement"),
  });

  const removeAgreementMutation = useMutation({
    mutationFn: async () => (await axiosPrivate.delete("/api/partner-invites/agreement")).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-invite-default-agreement"] });
      toast.success("Default agreement removed");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to remove the agreement"),
  });

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
    if (!inviteLead || !defaultAgreement) return;
    const leadMatchedTabs = combineRoles ? getMatchedTabs(inviteLead, tabs) : [activeTab];
    const approved = leadMatchedTabs
      .filter((tab) => normalizeReviewStatus(inviteLead.partnerStatuses?.[tab.roleFlag]) === "approved")
      .map((tab) => tab.service);
    sendInvite.mutate({
      lead: inviteLead,
      services: combineRoles ? approved : undefined,
      service: combineRoles ? undefined : activeTab.service,
    });
    setInviteLead(null);
  };

  const activeLeads = useMemo(() => {
    if (combineRoles) {
      return leads.filter((lead) => tabs.some((tab) => matchesTab(lead, tab)));
    }
    return leads.filter((lead) => matchesTab(lead, activeTab));
  }, [activeTab, combineRoles, leads, tabs]);

  const filteredLeads = useMemo(() => {
    const query = normalize(searchQuery);
    return activeLeads.filter((lead) =>
      (!reviewStatuses ||
        statusFilter === "all" ||
        (combineRoles
          ? getMatchedTabs(lead, tabs).some(
              (tab) => normalizeReviewStatus(lead.partnerStatuses?.[tab.roleFlag]) === statusFilter,
            )
          : normalizeReviewStatus(lead.partnerStatuses?.[activeTab.roleFlag]) === statusFilter)) &&
      (inviteFilter === "all" ||
        (invitationStatuses[normalize(getEmail(lead))]?.status || "not_invited") === inviteFilter) &&
      matchesDateFilter(lead.createdAt, dateFilter) &&
      (!query ||
        [
          getName(lead),
          getEmail(lead),
          getPhone(lead),
          lead.currentCountry,
          lead.country,
          lead.linkedinProfile,
          lead.message,
          getContributionTypes(lead).join(" "),
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(query))),
    );
  }, [activeLeads, activeTab.roleFlag, combineRoles, dateFilter, invitationStatuses, inviteFilter, reviewStatuses, searchQuery, statusFilter, tabs]);

  const thisWeek = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return activeLeads.filter(
      (lead) => lead.createdAt && new Date(lead.createdAt) >= weekStart,
    ).length;
  }, [activeLeads]);

  const lifecycleStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 29);
    const leadHasStatus = (lead, status) => {
      const leadTabs = combineRoles ? getMatchedTabs(lead, tabs) : [activeTab];
      return leadTabs.some(
        (tab) => normalizeReviewStatus(lead.partnerStatuses?.[tab.roleFlag]) === status,
      );
    };
    return {
      newToday: activeLeads.filter((lead) => {
        const createdAt = new Date(lead.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= today;
      }).length,
      last30Days: activeLeads.filter((lead) => {
        const createdAt = new Date(lead.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= last30Days;
      }).length,
      pending: activeLeads.filter((lead) => leadHasStatus(lead, "pending")).length,
      contacted: activeLeads.filter((lead) => leadHasStatus(lead, "contacted")).length,
      approved: activeLeads.filter((lead) => leadHasStatus(lead, "approved")).length,
    };
  }, [activeLeads, activeTab, combineRoles, tabs]);

  const selectedLead = useMemo(
    () => leads.find((lead) => (lead._id || lead.id) === selectedLeadId),
    [leads, selectedLeadId],
  );

  if (isPending) {
    return (
      <div className="min-h-full p-2 text-[#0F172A] lg:p-2.5">
        <PageFrame>
          <ValueAddsLeadsTableSkeleton />
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="min-h-full p-2 text-[12px] text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4 font-sans text-slate-700">
          <div className="mb-1 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-title font-pmedium uppercase text-primary">
                {combineRoles ? pageLabel || "Leads" : activeTab.label}
              </h2>
            </div>
            <p className="text-xs font-pmedium text-slate-500">
              {combineRoles
                ? pageDescription || "Leads received across all services."
                : `Leads received for ${activeTab.label}.`}
            </p>
          </div>

          {!combineRoles ? (
            <div
              role="tablist"
              aria-label="Lead type"
              className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm"
            >
              {tabs.map((tab) => (
                <NavLink
                  key={tab.slug}
                  role="tab"
                  aria-selected={activeTab.slug === tab.slug}
                  to={`${basePath}/${tab.slug}`}
                  className={`flex-1 rounded-xl px-4 py-2 text-center text-[10px] font-pmedium uppercase tracking-widest transition-all ${
                    activeTab.slug === tab.slug
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center text-sm font-semibold text-red-500">
              Failed to load leads.
            </div>
          ) : (
            <>
              <div className={`grid shrink-0 grid-cols-2 gap-3 ${reviewStatuses ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-3"}`}>
                <StatTile label="Total Leads" value={activeLeads.length} icon={Target} tone="slate" />
                {reviewStatuses ? (
                  <>
                    <StatTile label="New Today" value={lifecycleStats.newToday} icon={CalendarDays} tone="indigo" />
                    <StatTile label="Last 30 Days" value={lifecycleStats.last30Days} icon={CalendarRange} tone="sky" />
                    <StatTile label="Pending Review" value={lifecycleStats.pending} icon={Clock} tone="amber" />
                    <StatTile label="Contacted" value={lifecycleStats.contacted} icon={Phone} tone="blue" />
                    <StatTile label="Approved Leads" value={lifecycleStats.approved} icon={CheckCircle2} tone="blue" />
                  </>
                ) : (
                  <>
                    <StatTile label="This Week" value={thisWeek} icon={Clock} tone="amber" />
                    <StatTile label="Showing" value={filteredLeads.length} icon={Users} tone="emerald" />
                  </>
                )}
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex flex-col items-stretch gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:p-4 lg:p-5">
                  <div className="relative min-w-[180px] flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      size={15}
                    />
                    <input
                      type="text"
                      placeholder={`Search ${combineRoles ? "partner leads" : activeTab.singular.toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                  {reviewStatuses ? (
                    <div className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto sm:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="relative shrink-0">
                        <select
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                          aria-label="Filter partner leads by status"
                          className={`appearance-none rounded-lg border bg-white py-2 pl-3 pr-8 text-[11px] font-pmedium outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 ${statusFilter === "all" ? "border-slate-200/60 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="contacted">Contacted</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                      {inviteEndpoint ? (
                        <select
                          value={inviteFilter}
                          onChange={(event) => setInviteFilter(event.target.value)}
                          aria-label="Filter partner leads by invite status"
                          className={`shrink-0 rounded-lg border bg-white px-2.5 py-2 text-[11px] font-pmedium outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${inviteFilter === "all" ? "border-slate-200/60 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                        >
                          <option value="all">All invites</option>
                          <option value="not_invited">Not Invited</option>
                          <option value="invite_sent">Invite Sent</option>
                          <option value="joined">Joined</option>
                        </select>
                      ) : null}
                      <select
                        value={dateFilter}
                        onChange={(event) => setDateFilter(event.target.value)}
                        aria-label="Filter leads by date"
                        className={`shrink-0 rounded-lg border bg-white px-2.5 py-2 text-[11px] font-pmedium outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${dateFilter === "all" ? "border-slate-200/60 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                      >
                        <option value="all">Any date</option>
                        <option value="today">Today</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                      </select>
                      {statusFilter !== "all" || inviteFilter !== "all" || dateFilter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => { setStatusFilter("all"); setInviteFilter("all"); setDateFilter("all"); }}
                          className="shrink-0 text-[11px] font-pmedium text-slate-500 underline hover:text-slate-800"
                        >
                          Clear
                        </button>
                      ) : null}
                      {/* <span className="whitespace-nowrap text-[10px] font-pmedium text-slate-400">
                        {filteredLeads.length} of {activeLeads.length}
                      </span> */}
                    </div>
                  ) : null}
                </div>

                {filteredLeads.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                      <UserRoundCheck size={28} />
                    </div>
                    <p className="font-pmedium font-semibold text-slate-400">
                      No matching leads found.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-max min-w-full table-auto bg-white text-left">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="whitespace-nowrap px-5 py-4">Sr No</th>
                          <th className="whitespace-nowrap px-5 py-4">Lead</th>
                          <th className="whitespace-nowrap px-5 py-4">Contact</th>
                          <th className="whitespace-nowrap px-5 py-4">Nationality</th>
                          {reviewStatuses && combineRoles ? (
                            <th className="whitespace-nowrap px-5 py-4">Requested Service</th>
                          ) : null}
                          <th className="whitespace-nowrap px-5 py-4">Date</th>
                          {reviewStatuses ? (
                            <th className="whitespace-nowrap px-5 py-4 text-center">
                              Status
                            </th>
                          ) : null}
                          {reviewStatuses && inviteEndpoint ? (
                            <>
                              <th className="whitespace-nowrap px-5 py-4">Invite Status</th>
                              <th className="whitespace-nowrap px-5 py-4 text-center">Invite</th>
                            </>
                          ) : null}
                          <th className={`whitespace-nowrap px-5 py-4 text-center ${stickyActionHeaderClass}`}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {filteredLeads.map((lead, index) => {
                          const leadId = lead._id || lead.id;
                          const isActive = lead[activeTab.roleFlag] === true;
                          const matchedTabs = getMatchedTabs(lead, tabs);
                          // One shared status per lead when several services were
                          // requested — approving it approves every requested
                          // service at once, never some approved and some not.
                          const reviewStatus = normalizeReviewStatus(
                            lead.partnerStatuses?.[(combineRoles ? matchedTabs[0] : activeTab)?.roleFlag],
                          );
                          const invitationState = getInvitationState(lead);
                          const hasJoined = invitationState === "joined";
                          const approvedServices = matchedTabs
                            .filter(
                              (tab) =>
                                normalizeReviewStatus(lead.partnerStatuses?.[tab.roleFlag]) ===
                                "approved",
                            )
                            .map((tab) => tab.service);
                          return (
                            <tr
                              key={leadId || index}
                              className="group transition-colors hover:bg-slate-50"
                            >
                              <td className="whitespace-nowrap px-5 py-4 text-[12px] font-pmedium text-slate-400">
                                {index + 1}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                    {getInitials(getName(lead))}
                                  </div>
                                  <div>
                                    <p className="whitespace-nowrap text-[12px] font-pmedium text-slate-900" title={getName(lead)}>{getName(lead)}</p>
                                    <p className="whitespace-nowrap text-[10px] font-pmedium text-slate-500" title={getEmail(lead)}>{getEmail(lead)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-5 py-4">
                                <div className="text-[11px] font-pmedium text-slate-600">
                                  <p className="flex items-center gap-1">
                                    <Phone size={10} className="text-slate-400" />
                                    {getPhone(lead)}
                                  </p>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-[12px] font-pmedium text-slate-700">
                                {lead.currentCountry || lead.country || "--"}
                              </td>
                              {reviewStatuses && combineRoles ? (
                                <td className="whitespace-nowrap px-5 py-4">
                                  <RequestedServiceBadges tabs={matchedTabs} />
                                </td>
                              ) : null}
                              <td className="whitespace-nowrap px-5 py-4 text-[11px] font-pmedium text-slate-500">
                                {formatDateLabel(lead.createdAt)}
                              </td>
                              {reviewStatuses ? (
                                <td className="whitespace-nowrap px-5 py-4 text-center">
                                  <div className="relative mx-auto min-w-[112px]">
                                    <select
                                      value={reviewStatus}
                                      onChange={(event) => {
                                        const nextStatus = event.target.value;
                                        const rolesToUpdate = combineRoles
                                          ? matchedTabs.map((tab) => tab.roleFlag)
                                          : [activeTab.roleFlag];
                                        rolesToUpdate.forEach((role) =>
                                          updateStatus.mutate({ leadId, role, status: nextStatus }),
                                        );
                                      }}
                                      disabled={updateStatus.isPending || hasJoined}
                                      aria-label={`Review status for ${getName(lead)}`}
                                      title={combineRoles ? "Approving/rejecting applies to every requested service at once" : undefined}
                                      className={`w-full appearance-none rounded-full border py-2 pl-4 pr-9 text-[10px] font-pmedium uppercase tracking-wider outline-none transition-colors focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${reviewStatusTone[reviewStatus]}`}
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="contacted">Contacted</option>
                                      <option value="approved">Approved</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                    <ChevronDown
                                      size={14}
                                      aria-hidden="true"
                                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                                    />
                                  </div>
                                </td>
                              ) : null}
                              {reviewStatuses && inviteEndpoint ? (
                                <td className="whitespace-nowrap px-5 py-4">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${invitationStatusTone[invitationState]}`}
                                  >
                                    {invitationStatusLabel[invitationState]}
                                  </span>
                                  {invitationState === "invite_sent" && invitationStatuses[normalize(getEmail(lead))]?.updatedAt ? (
                                    <p className="mt-1 text-[10px] font-pmedium text-slate-500">
                                      Sent {formatDateLabel(invitationStatuses[normalize(getEmail(lead))].updatedAt)}
                                    </p>
                                  ) : null}
                                </td>
                              ) : null}
                              {reviewStatuses && inviteEndpoint ? (
                                <td className="whitespace-nowrap px-5 py-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setInviteLead(lead)}
                                    disabled={(combineRoles ? approvedServices.length === 0 : reviewStatus !== "approved") || hasJoined || sendInvite.isPending}
                                    title={hasJoined ? "Partner has already joined" : (combineRoles ? approvedServices.length > 0 : reviewStatus === "approved") ? "Send partner invite" : "Approve this lead first"}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition ${(combineRoles ? approvedServices.length > 0 : reviewStatus === "approved") && !hasJoined ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
                                  >
                                    <Send size={10} />
                                    {sendInvite.isPending ? "Sending..." : invitationState === "invite_sent" ? "Resend" : "Invite"}
                                  </button>
                                </td>
                              ) : null}
                              <td className={`px-5 py-4 text-center ${stickyActionCellClass}`}>
                                <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLeadId(leadId)}
                                  title="View details"
                                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                  <Eye size={15} strokeWidth={2.5} />
                                </button>
                                {!reviewStatuses ? (
                                  <button
                                    type="button"
                                    onClick={() => updateStatus.mutate({ leadId, role: activeTab.roleFlag, isActive: !isActive })}
                                    disabled={updateStatus.isPending}
                                    title={isActive ? "Mark as Inactive" : "Mark as Active"}
                                    aria-label={`${isActive ? "Mark as Inactive" : "Mark as Active"}: ${getName(lead)} (${activeTab.singular})`}
                                    aria-pressed={isActive}
                                    className={`p-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isActive
                                        ? "bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-700"
                                        : "bg-rose-100 text-rose-700 hover:bg-emerald-100 hover:text-emerald-700"
                                    }`}
                                  >
                                    <Power size={15} strokeWidth={2.5} />
                                  </button>
                                ) : null}
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
            </>
          )}
        </div>
      </PageFrame>

      <LeadDetailsModal
        lead={selectedLead}
        activeTab={activeTab}
        tabs={tabs}
        combineRoles={combineRoles}
        modalKindLabel={modalKindLabel}
        reviewStatuses={reviewStatuses}
        onClose={() => setSelectedLeadId(null)}
      />

      {inviteEndpoint && inviteLead ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
          onClick={() => setInviteLead(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-blue-50/30 p-5 sm:p-6">
              <div className="min-w-0">
                <h2 className="text-base font-pmedium tracking-tight text-slate-800">
                  {getInvitationState(inviteLead) === "invite_sent" ? "Resend Invite" : "Send Invite"}
                </h2>
                <p className="mt-0.5 truncate text-[11px] font-pmedium text-slate-500">
                  {getName(inviteLead)} &middot; {getEmail(inviteLead)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteLead(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              <label className="block text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                Agreement (required)
              </label>
              {defaultAgreement ? (
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
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-[12px] font-pmedium text-slate-600 transition-colors hover:border-[#2563EB] hover:text-[#2563EB]">
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
                The partner fills it in, then uploads it back — and ticks &quot;I agree&quot; — while creating their partner account.
              </p>
            </div>
            <div className="flex shrink-0 gap-2.5 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setInviteLead(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[12px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInvite}
                disabled={!defaultAgreement}
                title={defaultAgreement ? undefined : "Upload the agreement first"}
                className="flex-1 rounded-xl bg-[#2563EB] py-2.5 text-[12px] font-pmedium text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2563EB]"
              >
                {getInvitationState(inviteLead) === "invite_sent" ? "Resend invite" : "Send invite"} with agreement
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SharedLeadsReviewPage;
