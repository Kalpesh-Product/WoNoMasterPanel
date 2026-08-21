import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  Clock3,
  Eye,
  Loader2,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const DATE_FILTER_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(Number(value) || 0);

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
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRange = (mode, customRange) => {
  if (mode === "all") return {};

  const now = new Date();
  if (mode === "today") {
    const from = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const to = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    return { from, to };
  }

  if (mode === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { from, to };
  }

  const from = new Date(`${customRange.from}T00:00:00`);
  const to = new Date(`${customRange.to}T23:59:59`);
  return { from, to };
};

const getDestinationLabel = (item) => {
  const destination = item || {};
  return (
    [destination.title || destination.state, destination.country]
      .filter(Boolean)
      .join(", ") || "-"
  );
};

const getListingLabel = (item = {}) =>
  item.companyName
    ? `${item.companyName}${item.city ? ` - ${item.city}` : ""}`
    : item.businessId || item.companyId || "-";

const getPercent = (clicks, totalClicks) => {
  if (!totalClicks) return 0;
  return Math.round((Number(clicks || 0) / totalClicks) * 100);
};

const NomadClickAnalytics = () => {
  const axiosPrivate = useAxiosPrivate();
  const today = useMemo(() => formatInputDate(new Date()), []);
  const [dateMode, setDateMode] = useState("today");
  const [customRange, setCustomRange] = useState({ from: today, to: today });
  const [search, setSearch] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [destinationTab, setDestinationTab] = useState("overview");
  const [listingSearch, setListingSearch] = useState("");

  const { from, to } = useMemo(
    () => getDateRange(dateMode, customRange),
    [dateMode, customRange],
  );

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: [
      "nomadClickAnalytics",
      dateMode,
      from?.toISOString?.() || "all",
      to?.toISOString?.() || "all",
    ],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "/api/nomad-users/popular-destinations",
        {
          params: {
            limit: 50,
            from: from?.toISOString?.(),
            to: to?.toISOString?.(),
          },
        },
      );
      return response.data;
    },
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
  const totals = data?.totals || {
    totalClicks: 0,
    totalDestinations: 0,
    guestClicks: 0,
    loggedInClicks: 0,
    uniqueUsers: 0,
    uniqueSessions: 0,
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, item.state, item.country, item.continent]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const destinationLabel = getDestinationLabel(selectedDestination);
  const dateLabel = useMemo(() => {
    if (dateMode === "today") return "Today";
    if (dateMode === "month") return "This Month";
    if (dateMode === "all") return "All Time";
    const fromLabel = formatDateOnly(from);
    const toLabel = formatDateOnly(to);
    return [fromLabel, toLabel].filter(Boolean).join(" - ") || "Custom Range";
  }, [dateMode, from, to]);

  const {
    data: listingData,
    isPending: isListingsPending,
    isFetching: isListingsFetching,
    isError: isListingsError,
  } = useQuery({
    queryKey: [
      "nomadDestinationListingAnalyticsModal",
      selectedDestination?.country || "",
      selectedDestination?.state || "",
      selectedDestination?.title || "",
      selectedDestination?.continent || "",
      from?.toISOString?.() || "all",
      to?.toISOString?.() || "all",
    ],
    enabled: Boolean(selectedDestination?.country && selectedDestination?.state),
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "/api/nomad-users/popular-destinations/listings",
        {
          params: {
            country: selectedDestination.country,
            state: selectedDestination.state,
            title: selectedDestination.title,
            continent: selectedDestination.continent,
            from: from?.toISOString?.(),
            to: to?.toISOString?.(),
            limit: 100,
          },
        },
      );
      return response.data;
    },
  });

  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const listingTotals = listingData?.totals || {
    totalClicks: 0,
    totalListings: 0,
    uniqueUsers: 0,
  };

  const filteredListings = useMemo(() => {
    const query = listingSearch.trim().toLowerCase();
    if (!query) return listingItems;
    return listingItems.filter((item) =>
      [
        item.companyName,
        item.businessId,
        item.companyId,
        item.city,
        item.state,
        item.country,
        item.continent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [listingItems, listingSearch]);

  const summaryCards = [
    {
      label: "Total Clicks",
      value: totals.totalClicks,
      icon: MousePointerClick,
      accent: "border-l-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Destinations",
      value: totals.totalDestinations,
      icon: MapPin,
      accent: "border-l-emerald-500",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Guest User Clicks",
      value: totals.guestClicks,
      icon: Users,
      accent: "border-l-amber-500",
      textColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Logged In User Clicks",
      value: totals.loggedInClicks,
      icon: Clock3,
      accent: "border-l-slate-400",
      textColor: "text-slate-600",
      bgColor: "bg-slate-50",
    },
  ];

  const openDestinationDetails = (item) => {
    setSelectedDestination(item);
    setDestinationTab("overview");
    setListingSearch("");
  };

  const closeDestinationDetails = () => {
    setSelectedDestination(null);
    setDestinationTab("overview");
    setListingSearch("");
  };

  return (
    <div className="min-h-full p-2 text-[12px] text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="flex items-center gap-1.5 text-title font-pmedium uppercase text-primary">
                Nomad Click Analytics
              </h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                Popular destinations from Nomads destination clicks.
              </p>
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDateMode(option.key)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-pmedium transition-colors ${
                    dateMode === option.key
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {dateMode === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-pmedium text-slate-600">
                  <CalendarDays size={13} className="text-slate-400" />
                  From
                  <input
                    type="date"
                    value={customRange.from}
                    max={customRange.to}
                    onChange={(event) =>
                      setCustomRange((prev) => ({
                        ...prev,
                        from: event.target.value,
                      }))
                    }
                    className="bg-transparent text-slate-800 outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-pmedium text-slate-600">
                  <CalendarDays size={13} className="text-slate-400" />
                  To
                  <input
                    type="date"
                    value={customRange.to}
                    min={customRange.from}
                    max={today}
                    onChange={(event) =>
                      setCustomRange((prev) => ({
                        ...prev,
                        to: event.target.value,
                      }))
                    }
                    className="bg-transparent text-slate-800 outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${card.accent}`}
                >
                  <div>
                    <p
                      className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${card.textColor}`}
                    >
                      {card.label}
                    </p>
                    <p className="text-[15px] font-pmedium text-slate-900">
                      {formatNumber(card.value)}
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl p-2 ${card.bgColor} ${card.textColor}`}
                  >
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4 lg:p-5">
              <div className="relative w-full xl:max-w-md">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={15}
                />
                <input
                  type="text"
                  placeholder="Search destination, country, continent..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            {isPending ? (
              <div className="flex flex-1 items-center justify-center text-slate-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : isError ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-red-500">
                Failed to load Nomads click analytics.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <MapPin size={28} className="mb-2 text-slate-300" />
                <p className="text-[12px] font-pmedium text-slate-400">
                  No destination clicks found for this filter.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[1120px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[7%]" />
                    <col className="w-[24%]" />
                    <col className="w-[12%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Destination</th>
                      <th className="px-5 py-4">Clicks</th>
                      <th className="px-5 py-4">Click Percentage</th>
                      <th className="px-5 py-4">Guest User Clicks</th>
                      <th className="px-5 py-4">Logged In User Clicks</th>
                      <th className="px-5 py-4">Last Click</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredItems.map((item, index) => {
                      const percent = getPercent(
                        item.clicks,
                        totals.totalClicks,
                      );
                      return (
                        <tr
                          key={`${item.country}-${item.state}-${item.title || index}`}
                          className="transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-5 py-4">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-pmedium text-white">
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-pmedium text-slate-900">
                                {getDestinationLabel(item)}
                              </p>
                              <p className="truncate text-[10px] font-pmedium text-slate-500">
                                {[item.state, item.continent]
                                  .filter(Boolean)
                                  .join(" - ") || "-"}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {formatNumber(item.clicks)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#2563EB]"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-pmedium text-slate-500">
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {formatNumber(item.guestClicks)}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {formatNumber(item.loggedInClicks)}
                          </td>
                          <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                            {formatDate(item.lastClickedAt)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => openDestinationDetails(item)}
                              title="View listing analytics"
                              aria-label={`View listing analytics for ${getDestinationLabel(item)}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Eye size={10} />
                              View
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
        </div>
      </PageFrame>

      {selectedDestination && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
          onClick={closeDestinationDetails}
        >
          <div
            className="flex max-h-[95vh] min-h-[620px] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-blue-50/40 p-5 sm:p-6">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-sm">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-pmedium tracking-tight text-slate-800 lg:text-lg">
                    {destinationLabel}
                  </h2>
                  <p className="truncate text-[11px] font-pmedium text-slate-500">
                    Destination click analytics for {dateLabel}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDestinationDetails}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-white px-5 pt-3 sm:px-6">
              {[
                { key: "overview", label: "Overview" },
                { key: "listings", label: "Listings" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDestinationTab(tab.key)}
                  className={`rounded-t-lg px-3 py-2 text-[11px] font-pmedium transition-colors ${
                    destinationTab === tab.key
                      ? "border-b-2 border-blue-500 text-blue-700"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-6">
              {destinationTab === "overview" ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      {
                        label: "Clicks",
                        value: selectedDestination.clicks,
                        icon: MousePointerClick,
                        tone: "text-blue-600 bg-blue-50 border-l-blue-500",
                      },
                      {
                        label: "Guest User Clicks",
                        value: selectedDestination.guestClicks,
                        icon: Users,
                        tone: "text-amber-600 bg-amber-50 border-l-amber-500",
                      },
                      {
                        label: "Logged In User Clicks",
                        value: selectedDestination.loggedInClicks,
                        icon: Clock3,
                        tone: "text-emerald-600 bg-emerald-50 border-l-emerald-500",
                      },
                      {
                        label: "Listings",
                        value: listingTotals.totalListings,
                        icon: Building2,
                        tone: "text-slate-600 bg-slate-50 border-l-slate-400",
                      },
                    ].map((card) => {
                      const Icon = card.icon;
                      const [textColor, bgColor, accent] = card.tone.split(" ");
                      return (
                        <div
                          key={card.label}
                          className={`flex items-center justify-between rounded-2xl border border-slate-100 border-l-4 bg-white p-4 shadow-sm ${accent}`}
                        >
                          <div className="min-w-0">
                            <p className={`mb-1 text-[9px] font-pmedium uppercase tracking-widest ${textColor}`}>
                              {card.label}
                            </p>
                            <p className="truncate text-[14px] font-pmedium text-slate-900">
                              {formatNumber(card.value)}
                            </p>
                          </div>
                          <div className={`shrink-0 rounded-xl p-2 ${bgColor} ${textColor}`}>
                            <Icon size={15} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                        Destination
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900">
                        {destinationLabel}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                        Date Range
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900">
                        {dateLabel}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                        Continent
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900">
                        {selectedDestination.continent || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-pmedium uppercase tracking-widest text-slate-500">
                        Last Click
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900">
                        {formatDate(selectedDestination.lastClickedAt)}
                      </p>
                    </div>
                  </div>

                  {isListingsFetching && (
                    <div className="flex items-center justify-center py-3 text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-sm">
                      <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={15}
                      />
                      <input
                        type="text"
                        placeholder="Search listing, city, country..."
                        value={listingSearch}
                        onChange={(event) => setListingSearch(event.target.value)}
                        className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                      />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-pmedium text-slate-500">
                      <Building2 size={12} />
                      {formatNumber(listingTotals.totalListings)} listings
                    </div>
                  </div>

                  {!selectedDestination.country || !selectedDestination.state ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MapPin size={28} className="mb-2 text-slate-300" />
                      <p className="text-[12px] font-pmedium text-red-500">
                        Destination details are missing.
                      </p>
                    </div>
                  ) : isListingsPending ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : isListingsError ? (
                    <div className="flex items-center justify-center py-16 text-center text-red-500">
                      Failed to load listing analytics.
                    </div>
                  ) : filteredListings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Building2 size={28} className="mb-2 text-slate-300" />
                      <p className="text-[12px] font-pmedium text-slate-400">
                        No listing clicks found for this destination.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60">
                      {filteredListings.map((listing, index) => {
                        const percent = getPercent(
                          listing.clicks,
                          listingTotals.totalClicks,
                        );
                        return (
                          <div
                            key={`${listing.businessId || listing.companyId || listing.companyName}-${listing.city}-${index}`}
                            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-pmedium text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-pmedium text-slate-800">
                                {getListingLabel(listing)}
                              </p>
                              <p className="truncate text-[10px] font-pmedium text-slate-500">
                                {[listing.state, listing.country].filter(Boolean).join(" - ") || "-"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[12px] font-pmedium text-slate-800">
                                {formatNumber(listing.clicks)} clicks
                              </p>
                              <p className="text-[10px] font-pmedium text-slate-400">
                                {percent}% · {formatNumber(listing.guestClicks)} guest · {formatNumber(listing.loggedInClicks)} logged in · {formatDate(listing.lastClickedAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
              <button
                type="button"
                onClick={closeDestinationDetails}
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

export default NomadClickAnalytics;
