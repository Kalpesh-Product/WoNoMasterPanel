import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Mail,
  Phone,
  Power,
  Search,
  Send,
  Target,
  UserRoundCheck,
  Users,
  X,
  XCircle,
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

const REVIEW_STATUSES = ["pending", "approved", "rejected"];
const normalizeReviewStatus = (value) => {
  const status = normalize(value);
  return REVIEW_STATUSES.includes(status) ? status : "pending";
};
const reviewStatusTone = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
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
      matchedTabs.forEach((tab) =>
        detailRows.push([`${tab.label} Status`, normalizeReviewStatus(lead.partnerStatuses?.[tab.roleFlag])]),
      );
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

const RoleLeadsPage = ({
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
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  useEffect(() => {
    if (combineRoles) return;
    if (!activeSlug || !tabBySlug[activeSlug]) {
      navigate(`${basePath}/${defaultTab.slug}`, { replace: true });
    }
  }, [activeSlug, basePath, combineRoles, defaultTab.slug, navigate, tabBySlug]);

  useEffect(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedLeadId(null);
  }, [activeTab.slug]);

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const response = await axiosPrivate.get(apiEndpoint);
      return response?.data?.data || [];
    },
  });

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
    mutationFn: async ({ lead, service }) =>
      (
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
          service,
        })
      ).data,
    onSuccess: (data) => {
      toast.success(data.message || "Invite sent.");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to send invite.");
    },
  });

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
  }, [activeLeads, activeTab.roleFlag, combineRoles, reviewStatuses, searchQuery, statusFilter, tabs]);

  const reviewCounts = useMemo(
    () =>
      activeLeads.reduce(
        (counts, lead) => {
          if (combineRoles) {
            getMatchedTabs(lead, tabs).forEach((tab) => {
              counts[normalizeReviewStatus(lead.partnerStatuses?.[tab.roleFlag])] += 1;
            });
            return counts;
          }
          const status = normalizeReviewStatus(
            lead.partnerStatuses?.[activeTab.roleFlag],
          );
          counts[status] += 1;
          return counts;
        },
        { pending: 0, approved: 0, rejected: 0 },
      ),
    [activeLeads, activeTab.roleFlag, combineRoles, tabs],
  );

  const thisWeek = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return activeLeads.filter(
      (lead) => lead.createdAt && new Date(lead.createdAt) >= weekStart,
    ).length;
  }, [activeLeads]);

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
              <div className={`grid shrink-0 grid-cols-2 gap-3 ${reviewStatuses ? "xl:grid-cols-4" : "md:grid-cols-3"}`}>
                <StatTile label="Total Leads" value={activeLeads.length} icon={Target} tone="slate" />
                {reviewStatuses ? (
                  <>
                    <StatTile label="Pending Review" value={reviewCounts.pending} icon={Clock} tone="amber" />
                    <StatTile label="Approved" value={reviewCounts.approved} icon={CheckCircle2} tone="emerald" />
                    <StatTile label="Rejected" value={reviewCounts.rejected} icon={XCircle} tone="rose" />
                  </>
                ) : (
                  <>
                    <StatTile label="This Week" value={thisWeek} icon={Clock} tone="amber" />
                    <StatTile label="Showing" value={filteredLeads.length} icon={Users} tone="emerald" />
                  </>
                )}
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex flex-col gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:p-4 lg:p-5">
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
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <div className="relative min-w-[160px] flex-1 sm:flex-none">
                        <select
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value)}
                          aria-label="Filter partner leads by status"
                          className="w-full appearance-none rounded-lg border border-slate-200/60 bg-white py-2.5 pl-3.5 pr-9 text-[12px] font-pmedium text-slate-700 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                        >
                          <option value="all">All statuses</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-pmedium text-slate-400">
                        {filteredLeads.length} of {activeLeads.length}
                      </span>
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
                    <table className="w-full min-w-[860px] text-left">
                      <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-5 py-4">Name</th>
                          <th className="px-5 py-4">Contact</th>
                          <th className="px-5 py-4">LinkedIn Profile</th>
                          <th className="px-5 py-4">Nationality</th>
                          <th className="px-5 py-4">Date</th>
                          {reviewStatuses ? (
                            <th className="px-5 py-4 text-center">
                              {combineRoles ? "Requested Services" : "Status"}
                            </th>
                          ) : null}
                          <th className="px-5 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {filteredLeads.map((lead, index) => {
                          const leadId = lead._id || lead.id;
                          const isActive = lead[activeTab.roleFlag] === true;
                          const reviewStatus = normalizeReviewStatus(
                            lead.partnerStatuses?.[activeTab.roleFlag],
                          );
                          return (
                            <tr
                              key={leadId || index}
                              className="transition-colors hover:bg-slate-50/50"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                    {getInitials(getName(lead))}
                                  </div>
                                  <span className="max-w-[170px] truncate text-[12px] font-pmedium text-slate-900">
                                    {getName(lead)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="space-y-0.5 text-[11px] font-pmedium text-slate-600">
                                  <p className="flex items-center gap-1">
                                    <Phone size={10} className="text-slate-400" />
                                    {getPhone(lead)}
                                  </p>
                                  <p className="flex items-center gap-1">
                                    <Mail size={10} className="text-slate-400" />
                                    {getEmail(lead)}
                                  </p>
                                </div>
                              </td>
                              <td
                                className="max-w-[180px] truncate px-5 py-4 text-[12px] font-pmedium text-slate-700"
                                title={lead.linkedinProfile || ""}
                              >
                                {lead.linkedinProfile || "--"}
                              </td>
                              <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                                {lead.currentCountry || lead.country || "--"}
                              </td>
                              <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                                {formatDateLabel(lead.createdAt)}
                              </td>
                              {reviewStatuses ? (
                                <td className="px-5 py-4 text-center">
                                  {combineRoles ? (
                                    <div className="flex flex-col items-start gap-1.5">
                                      {getMatchedTabs(lead, tabs).map((tab) => {
                                        const tabStatus = normalizeReviewStatus(
                                          lead.partnerStatuses?.[tab.roleFlag],
                                        );
                                        return (
                                          <div key={tab.slug} className="flex items-center gap-1.5">
                                            <span
                                              className="min-w-[110px] truncate text-left text-[9px] font-pmedium uppercase tracking-wider text-slate-500"
                                              title={tab.label}
                                            >
                                              {tab.label}
                                            </span>
                                            <div className="relative">
                                              <select
                                                value={tabStatus}
                                                onChange={(event) =>
                                                  updateStatus.mutate({
                                                    leadId,
                                                    role: tab.roleFlag,
                                                    status: event.target.value,
                                                  })
                                                }
                                                disabled={updateStatus.isPending}
                                                aria-label={`Review status for ${getName(lead)} - ${tab.label}`}
                                                className={`appearance-none rounded-full border py-1 pl-3 pr-7 text-[9px] font-pmedium uppercase tracking-wider outline-none transition-colors focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${reviewStatusTone[tabStatus]}`}
                                              >
                                                <option value="pending">Pending</option>
                                                <option value="approved">Approved</option>
                                                <option value="rejected">Rejected</option>
                                              </select>
                                              <ChevronDown
                                                size={12}
                                                aria-hidden="true"
                                                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60"
                                              />
                                            </div>
                                            {inviteEndpoint ? (
                                              <button
                                                type="button"
                                                onClick={() => sendInvite.mutate({ lead, service: tab.service })}
                                                disabled={tabStatus !== "approved" || sendInvite.isPending}
                                                title={tabStatus === "approved" ? `Send invite for ${tab.label}` : "Approve this service first"}
                                                aria-label={`Send partner invite for ${tab.label}: ${getName(lead)}`}
                                                className="shrink-0 rounded-lg bg-blue-100 p-1 text-blue-700 transition-all hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                                              >
                                                <Send size={13} strokeWidth={2.5} />
                                              </button>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="relative mx-auto w-[132px]">
                                      <select
                                        value={reviewStatus}
                                        onChange={(event) =>
                                          updateStatus.mutate({
                                            leadId,
                                            role: activeTab.roleFlag,
                                            status: event.target.value,
                                          })
                                        }
                                        disabled={updateStatus.isPending}
                                        aria-label={`Review status for ${getName(lead)}`}
                                        className={`w-full appearance-none rounded-full border py-2 pl-4 pr-9 text-[10px] font-pmedium uppercase tracking-wider outline-none transition-colors focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${reviewStatusTone[reviewStatus]}`}
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                      </select>
                                      <ChevronDown
                                        size={14}
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
                                      />
                                    </div>
                                  )}
                                </td>
                              ) : null}
                              <td className="px-5 py-4 text-center">
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
                                {inviteEndpoint && !combineRoles ? (
                                  <button
                                    type="button"
                                    onClick={() => sendInvite.mutate({ lead, service: activeTab.service })}
                                    disabled={reviewStatus !== "approved" || sendInvite.isPending}
                                    title={reviewStatus === "approved" ? "Send partner invite" : "Approve this lead first"}
                                    aria-label={`Send partner invite: ${getName(lead)}`}
                                    className="rounded-lg bg-blue-100 p-1.5 text-blue-700 transition-all hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <Send size={15} strokeWidth={2.5} />
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
    </div>
  );
};

export default RoleLeadsPage;
