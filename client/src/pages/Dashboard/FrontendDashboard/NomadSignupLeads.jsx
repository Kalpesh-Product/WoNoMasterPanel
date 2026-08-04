import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-date-range";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock3,
  Download,
  Eye,
  Heart,
  Loader2,
  MapPin,
  Phone,
  Search,
  Star,
  Target,
  Users,
  Wallet,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { statusPillClass } from "../../../lib/status-pill";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getPrimaryText = (lead = {}) =>
  String(
    lead.fullName ||
      [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
      lead.email ||
      lead._id ||
      "-",
  ).trim();

const getCountryLabel = (lead = {}) =>
  String(lead.country || lead.countryOfResidence || "-").trim() || "-";

const getDestinationLabel = (destination = {}) =>
  [destination.title, destination.state, destination.country].filter(Boolean).join(", ") || "-";

const capitalizeWords = (value = "") =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getDestinationViewLabel = (view = {}) =>
  [view.title || capitalizeWords(view.state), capitalizeWords(view.country)].filter(Boolean).join(", ") || "-";

const getCompanyLabel = (company = {}) =>
  company.companyName
    ? `${company.companyName}${company.city ? ` — ${company.city}, ${company.country || ""}`.replace(/,\s*$/, "") : ""}`
    : "-";

const getLeadDate = (lead = {}) => {
  const date = new Date(lead.createdAt || lead.updatedAt || null);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (left, right) =>
  !!left &&
  !!right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isSameMonth = (left, right) =>
  !!left && !!right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const DATE_FILTER_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

const getDateFilterRange = (mode, customRange) => {
  const now = new Date();
  if (mode === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from, to };
  }
  if (mode === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }
  const from = new Date(customRange.startDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(customRange.endDate);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const NomadSignupLeads = () => {
  const axiosPrivate = useAxiosPrivate();
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const LOGS_TABS = [
    { key: "destinations", label: "Destinations" },
    { key: "listings", label: "Listings" },
    { key: "sessions", label: "Sign In/Out" },
  ];
  const LOGS_TAB_ENDPOINTS = {
    destinations: "destination-views",
    listings: "listing-views",
    sessions: "sessions",
  };

  const [logsUser, setLogsUser] = useState(null);
  const [logsTab, setLogsTab] = useState("destinations");
  const [logsPage, setLogsPage] = useState(1);
  const [logEntries, setLogEntries] = useState([]);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsDateMode, setLogsDateMode] = useState("today");
  const [logsCustomRange, setLogsCustomRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // With moveRangeOnFirstSelection={false}, the first click sets start=end
  // to the same day and the second click sets the real end date — so two
  // onChange firings means a full range has been picked.
  const customRangeClicksRef = useRef(0);

  const { from: logsFrom, to: logsTo } = useMemo(
    () => getDateFilterRange(logsDateMode, logsCustomRange),
    [logsDateMode, logsCustomRange],
  );

  const { data: logsResponse, isFetching: isLogsFetching } = useQuery({
    queryKey: [
      "nomadUserHistory",
      logsUser?._id,
      logsTab,
      logsPage,
      logsFrom.getTime(),
      logsTo.getTime(),
    ],
    enabled: !!logsUser,
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `/api/nomad-users/${logsUser._id}/${LOGS_TAB_ENDPOINTS[logsTab]}`,
        {
          params: {
            page: logsPage,
            limit: 20,
            from: logsFrom.toISOString(),
            to: logsTo.toISOString(),
          },
        },
      );
      return response.data;
    },
  });

  useEffect(() => {
    if (!logsResponse) return;
    setLogEntries((prev) => (logsPage === 1 ? logsResponse.items : [...prev, ...logsResponse.items]));
    setLogsHasMore(!!logsResponse.hasMore);
  }, [logsResponse, logsPage]);

  const resetLogsListing = () => {
    setLogsPage(1);
    setLogEntries([]);
    setLogsHasMore(false);
  };

  const openLogsFor = (lead) => {
    resetLogsListing();
    setLogsTab("destinations");
    setLogsDateMode("today");
    setIsCustomRangeOpen(false);
    setLogsUser(lead);
  };

  const closeLogs = () => {
    setLogsUser(null);
    resetLogsListing();
    setIsCustomRangeOpen(false);
  };

  const switchLogsTab = (tab) => {
    if (tab === logsTab) return;
    setLogsTab(tab);
    resetLogsListing();
  };

  const switchLogsDateMode = (mode) => {
    if (mode === "custom") {
      // Re-clicking "Custom Range" while already on custom toggles the
      // calendar open/closed instead of forcing it open every time.
      setIsCustomRangeOpen((prev) => {
        const next = logsDateMode === "custom" ? !prev : true;
        if (next) customRangeClicksRef.current = 0;
        return next;
      });
    } else {
      setIsCustomRangeOpen(false);
    }
    if (mode === logsDateMode) return;
    setLogsDateMode(mode);
    resetLogsListing();
  };

  const handleCustomRangeChange = (ranges) => {
    setLogsCustomRange(ranges.selection);
    resetLogsListing();
    customRangeClicksRef.current += 1;
    if (customRangeClicksRef.current >= 2) {
      setIsCustomRangeOpen(false);
    }
  };

  const getExportDateLabel = () => {
    if (logsDateMode === "today") {
      return formatDateOnly(new Date()).replace(/,/g, "").replace(/\s+/g, "-");
    }
    if (logsDateMode === "month") {
      return new Date()
        .toLocaleDateString("en-US", { month: "long", year: "numeric" })
        .replace(/\s+/g, "-");
    }
    const start = formatDateOnly(logsCustomRange.startDate).replace(/,/g, "").replace(/\s+/g, "-");
    const end = formatDateOnly(logsCustomRange.endDate).replace(/,/g, "").replace(/\s+/g, "-");
    return `${start}_to_${end}`;
  };

  const handleExportLogs = async () => {
    if (!logsUser) return;
    setIsExporting(true);
    try {
      const response = await axiosPrivate.get(`/api/nomad-users/${logsUser._id}/export`, {
        params: { from: logsFrom.toISOString(), to: logsTo.toISOString() },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = getPrimaryText(logsUser).trim().replace(/\s+/g, "-").toLowerCase() || "nomad-user";
      link.setAttribute("download", `nomad-activity-${safeName}-${getExportDateLabel()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to export activity");
    } finally {
      setIsExporting(false);
    }
  };

  const { data: leads = [], isPending, isError } = useQuery({
    queryKey: ["nomadSignupLeads"],
    queryFn: async () => {
      try {
        const response = await axiosPrivate.get("/api/nomad-users");
        return response.data?.items || [];
      } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch nomad signup leads");
      }
    },
  });

  const counts = useMemo(() => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const rollingWindow = new Date(today);
    rollingWindow.setDate(rollingWindow.getDate() - 30);

    return leads.reduce(
      (acc, lead) => {
        const leadDate = getLeadDate(lead);
        acc.all += 1;
        if (leadDate && isSameDay(leadDate, today)) acc.today += 1;
        if (leadDate && isSameMonth(leadDate, monthStart)) acc.month += 1;
        if (leadDate && leadDate >= rollingWindow) acc.last += 1;
        return acc;
      },
      { all: 0, today: 0, month: 0, last: 0 },
    );
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...leads]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .filter((lead) => {
        if (!query) return true;
        return [
          getPrimaryText(lead),
          lead.email,
          lead.mobile,
          lead.contactNumber,
          lead.country,
          lead.countryOfResidence,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [leads, search]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead._id === selectedLeadId) || null,
    [leads, selectedLeadId],
  );

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex items-center justify-center py-20 text-slate-400 font-pmedium">Loading nomad signup leads...</div>
        </PageFrame>
      </div>
    );
  }

  if (isError) {
    return <div className="p-6 text-red-500">Failed to load nomad signup leads.</div>;
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                Nomad Signup Leads
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Users who created accounts in the Nomads app, loaded directly from the Nomads database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {[
              { label: "Total Leads", value: counts.all, icon: Target, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
              { label: "Today's New Users", value: counts.today, icon: CalendarDays, accent: "border-l-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
              { label: "This Month", value: counts.month, icon: Users, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
              { label: "Last 30 Days", value: counts.last, icon: Clock3, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${card.accent}`}>
                  <div>
                    <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${card.textColor}`}>{card.label}</p>
                    <p className="text-[15px] font-pmedium text-slate-900">{card.value}</p>
                  </div>
                  <div className={`rounded-2xl p-2 ${card.bgColor} ${card.textColor}`}>
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-md shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
              <div className="relative w-full xl:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search name, email, phone, country..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Users size={28} />
                </div>
                <p className="text-slate-400 font-semibold">No matching Nomad signup leads found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1100px]">
                  <colgroup>
                    <col className="w-[17%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[13%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">User</th>
                      <th className="px-5 py-4">Contact</th>
                      <th className="px-5 py-4">Country</th>
                      <th className="px-5 py-4">Salary</th>
                      <th className="px-5 py-4 text-center">Favorites</th>
                      <th className="px-5 py-4 text-center">Likes</th>
                      <th className="px-5 py-4">Account Created</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredLeads.map((lead) => (
                      <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                              {getPrimaryText(lead).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-pmedium text-slate-900 truncate">{getPrimaryText(lead)}</p>
                              <p className="text-[10px] font-pmedium text-slate-500 truncate">{lead.email || "-"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="flex items-center gap-1.5 text-[12px] font-pmedium text-slate-600 truncate">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            {lead.mobile || lead.contactNumber || "-"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-pmedium text-slate-700 truncate">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            {getCountryLabel(lead)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-pmedium text-slate-700 truncate">
                            <Wallet size={11} className="text-slate-400 shrink-0" />
                            {lead.salary || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={statusPillClass("pending")}>{lead.favoriteDestination?.length || 0}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={statusPillClass("active")}>{lead.likes?.length || 0}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-pmedium text-slate-700 truncate">
                            <CalendarDays size={11} className="text-slate-400 shrink-0" />
                            {formatDateOnly(lead.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLeadId(lead._id)}
                              title="View details"
                              aria-label={`View details for ${getPrimaryText(lead)}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Eye size={10} />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openLogsFor(lead)}
                              title="View this user's activity"
                              aria-label={`View activity for ${getPrimaryText(lead)}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700"
                            >
                              <MapPin size={10} />
                              Logs
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>

      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
          onClick={() => setSelectedLeadId(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-blue-50/30 p-5 sm:p-6">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-sm font-pmedium text-white shadow-sm">
                  {getPrimaryText(selectedLead).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base lg:text-lg font-pmedium tracking-tight text-slate-800">{getPrimaryText(selectedLead)}</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 truncate">{selectedLead.email || "-"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadId(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto bg-white p-5 sm:p-6 space-y-5">
              <div>
                <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  <Users size={14} /> Personal Details
                </h3>
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Email</p>
                    <p className="text-[12px] font-pmedium text-slate-900 break-all">{selectedLead.email || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Phone</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedLead.mobile || selectedLead.contactNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Country</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{getCountryLabel(selectedLead)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Salary</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedLead.salary || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Designation</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedLead.designation || "-"}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Account Created</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatDate(selectedLead.createdAt)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">Updated On</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{formatDate(selectedLead.updatedAt)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  <Star size={14} /> Favorite Destinations ({selectedLead.favoriteDestination?.length || 0})
                </h3>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  {selectedLead.favoriteDestination?.length ? (
                    selectedLead.favoriteDestination.map((destination) => (
                      <span key={destination._id} className={statusPillClass("pending")}>
                        {getDestinationLabel(destination)}
                      </span>
                    ))
                  ) : (
                    <p className="text-[12px] font-pmedium text-slate-400">No favorite destinations yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  <Heart size={14} /> Liked Listings ({selectedLead.likes?.length || 0})
                </h3>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  {selectedLead.likes?.length ? (
                    selectedLead.likes.map((company) => (
                      <span key={company._id} className={statusPillClass("active")}>
                        {getCompanyLabel(company)}
                      </span>
                    ))
                  ) : (
                    <p className="text-[12px] font-pmedium text-slate-400">No liked listings yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={() => setSelectedLeadId(null)}
                className="w-full rounded-xl bg-[#2563EB] py-2.5 text-[12px] font-pmedium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {logsUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
          onClick={closeLogs}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-amber-50/40 p-5 sm:p-6">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base lg:text-lg font-pmedium tracking-tight text-slate-800">
                    Activity — {getPrimaryText(logsUser)}
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 truncate">
                    What this user viewed and when they were signed in, most recent first.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeLogs}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-white px-5 pt-3 sm:px-6">
              {LOGS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => switchLogsTab(tab.key)}
                  className={`rounded-t-lg px-3 py-2 text-[11px] font-pmedium transition-colors ${
                    logsTab === tab.key
                      ? "border-b-2 border-amber-500 text-amber-700"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6">
              <div className="flex flex-wrap items-center gap-1.5">
                {DATE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => switchLogsDateMode(option.key)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition-colors ${
                      logsDateMode === option.key
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-white text-slate-500 border border-slate-200/60 hover:bg-slate-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {logsDateMode === "custom" && (
                  <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-pmedium text-amber-700">
                    {formatDateOnly(logsCustomRange.startDate)} — {formatDateOnly(logsCustomRange.endDate)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleExportLogs}
                disabled={isExporting}
                title="Export Destinations, Listings & Sign In/Out as Excel"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-pmedium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Export Excel
              </button>

              {isCustomRangeOpen && (
                <div className="absolute right-5 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:right-6">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      Select Range
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCustomRangeOpen(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <DateRange
                    ranges={[logsCustomRange]}
                    onChange={handleCustomRangeChange}
                    moveRangeOnFirstSelection={false}
                    maxDate={new Date()}
                  />
                </div>
              )}
            </div>

            <div className="overflow-y-auto bg-white p-5 sm:p-6">
              {logEntries.length === 0 && !isLogsFetching ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MapPin size={28} className="mb-2 text-slate-300" />
                  <p className="text-[12px] font-pmedium text-slate-400">
                    Nothing recorded yet for this user.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60">
                  {logEntries.map((entry) => (
                    <div key={entry._id} className="flex items-center justify-between gap-3 px-4 py-3">
                      {logsTab === "sessions" ? (
                        <span
                          className={statusPillClass(entry.event === "login" ? "active" : "inactive")}
                        >
                          {entry.event === "login" ? "Signed In" : "Signed Out"}
                        </span>
                      ) : (
                        <div className="min-w-0 flex items-center gap-2.5">
                          <MapPin size={13} className="shrink-0 text-slate-400" />
                          <p className="truncate text-[12px] font-pmedium text-slate-700">
                            {logsTab === "listings" ? getCompanyLabel(entry) : getDestinationViewLabel(entry)}
                          </p>
                          {entry.continent && (
                            <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-pmedium uppercase tracking-wider text-slate-500">
                              {capitalizeWords(entry.continent)}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="shrink-0 text-[10px] font-pmedium text-slate-400 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {isLogsFetching && (
                <div className="flex items-center justify-center py-4 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              )}

              {!isLogsFetching && logsHasMore && (
                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setLogsPage((prev) => prev + 1)}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-[11px] font-pmedium text-slate-600 transition hover:bg-slate-200"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={closeLogs}
                className="w-full rounded-xl bg-[#2563EB] py-2.5 text-[12px] font-pmedium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NomadSignupLeads;
