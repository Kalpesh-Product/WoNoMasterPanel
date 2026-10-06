import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Eye,
  Mail,
  Phone,
  Search,
  Target,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_BACKEND_URL } from "../../../constants/api";
import { ValueAddsLeadsTableSkeleton } from "../../../components/ui/Skeleton";

const API_BASE_URL =
  import.meta.env.VITE_VALUE_ADDS_API_BASE_URL || NOMADS_BACKEND_URL;

const CONTRIBUTOR_TABS = [
  {
    slug: "bloggers",
    label: "Bloggers",
    singular: "Blogger",
    contributionLabel: "Become a Blogger",
    roleFlag: "isBlogger",
    matchers: ["become a blogger", "blogger"],
  },
  {
    slug: "news-writers",
    label: "News Writers",
    singular: "News Writer",
    contributionLabel: "Become A News Writer",
    roleFlag: "isNewsWriter",
    matchers: ["become a news writer", "news writer"],
  },
  {
    slug: "events-contributors",
    label: "Events Contributors",
    singular: "Event Contributor",
    contributionLabel: "Contribute To Events",
    roleFlag: "isEventWriter",
    matchers: ["contribute to events", "event writer", "events"],
  },
  {
    slug: "places-contributors",
    label: "Places Contributors",
    singular: "Place Contributor",
    contributionLabel: "Contribute To Places",
    roleFlag: "isPlaceWriter",
    matchers: ["contribute to places", "place writer", "places"],
  },
];

const DEFAULT_TAB = CONTRIBUTOR_TABS[0];
const TAB_BY_SLUG = CONTRIBUTOR_TABS.reduce(
  (acc, tab) => ({ ...acc, [tab.slug]: tab }),
  {},
);

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

const matchesContributorTab = (row, tab) => {
  if (row?.[tab.roleFlag]) return true;
  const typeText = normalize(getContributionTypes(row).join(" "));
  return tab.matchers.some((matcher) => typeText.includes(matcher));
};

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

const ContributorDetailsModal = ({ lead, activeTab, onClose }) => {
  if (!lead) return null;
  const contributionTypes = getContributionTypes(lead);
  const contributionType =
    contributionTypes.find((type) =>
      activeTab.matchers.some((matcher) => normalize(type).includes(matcher)),
    ) ||
    contributionTypes.join(", ") ||
    activeTab.contributionLabel;

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
                Become Contributor
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
              {[
                ["Contribution Type", contributionType],
                ["Current Country", lead.currentCountry || lead.country || "--"],
                ["LinkedIn Profile", lead.linkedinProfile || "--"],
                ["Message", lead.message || "--"],
                ["Submitted At", formatDateLabel(lead.createdAt)],
              ].map(([label, value]) => (
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

const ContributorLeads = () => {
  const navigate = useNavigate();
  const { contributorLeadTab } = useParams();
  const axiosPrivate = useAxiosPrivate();
  const activeTab = TAB_BY_SLUG[contributorLeadTab] || DEFAULT_TAB;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  useEffect(() => {
    if (!contributorLeadTab || !TAB_BY_SLUG[contributorLeadTab]) {
      navigate(`/dashboard/contributor-leads/${DEFAULT_TAB.slug}`, {
        replace: true,
      });
    }
  }, [contributorLeadTab, navigate]);

  useEffect(() => {
    setSearchQuery("");
    setSelectedLeadId(null);
  }, [activeTab.slug]);

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: ["contributorLeads"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${API_BASE_URL}/api/become-contributor`,
      );
      return response?.data?.data || [];
    },
  });

  const activeLeads = useMemo(
    () => leads.filter((lead) => matchesContributorTab(lead, activeTab)),
    [activeTab, leads],
  );

  const filteredLeads = useMemo(() => {
    const query = normalize(searchQuery);
    if (!query) return activeLeads;
    return activeLeads.filter((lead) =>
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
        .some((value) => normalize(value).includes(query)),
    );
  }, [activeLeads, searchQuery]);

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
                Contributor Leads
              </h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-pmedium text-blue-600">
                Guide
              </span>
            </div>
            <p className="text-xs font-pmedium text-slate-500">
              Leads received for {activeTab.label}.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Contributor lead type"
            className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm"
          >
            {CONTRIBUTOR_TABS.map((tab) => (
              <NavLink
                key={tab.slug}
                role="tab"
                aria-selected={activeTab.slug === tab.slug}
                to={`/dashboard/contributor-leads/${tab.slug}`}
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

          {isError ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center text-sm font-semibold text-red-500">
              Failed to load contributor leads.
            </div>
          ) : (
            <>
              <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3">
                <StatTile
                  label={`Total ${activeTab.label}`}
                  value={activeLeads.length}
                  icon={Target}
                  tone="slate"
                />
                <StatTile label="This Week" value={thisWeek} icon={Clock} tone="amber" />
                <StatTile
                  label="Showing"
                  value={filteredLeads.length}
                  icon={Users}
                  tone="emerald"
                />
              </div>

              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm backdrop-blur-md">
                <div className="flex flex-col gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4 lg:p-5">
                  <div className="relative min-w-[180px] flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      size={15}
                    />
                    <input
                      type="text"
                      placeholder={`Search ${activeTab.singular.toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                </div>

                {filteredLeads.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                      <UserRoundCheck size={28} />
                    </div>
                    <p className="font-pmedium font-semibold text-slate-400">
                      No matching contributor leads found.
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
                          <th className="px-5 py-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {filteredLeads.map((lead, index) => {
                          const leadId = lead._id || lead.id;
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
                              <td className="px-5 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLeadId(leadId)}
                                  title="View details"
                                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                  <Eye size={15} strokeWidth={2.5} />
                                </button>
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

      <ContributorDetailsModal
        lead={selectedLead}
        activeTab={activeTab}
        onClose={() => setSelectedLeadId(null)}
      />
    </div>
  );
};

export default ContributorLeads;
