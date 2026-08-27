import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-date-range";
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
  UserCheck,
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

const LISTING_VIEW_TABS = [
  { key: "all", label: "All" },
  { key: "list", label: "List View" },
  { key: "map", label: "Map View" },
];

const USER_VIEW_TABS = [
  { key: "guest", label: "Guest Users" },
  { key: "loggedIn", label: "Logged In Users" },
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

  const from = new Date(customRange.startDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(customRange.endDate);
  to.setHours(23, 59, 59, 999);
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
  const [dateMode, setDateMode] = useState("today");
  const [customRange, setCustomRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [search, setSearch] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [destinationTab, setDestinationTab] = useState("overview");
  const [listingViewTab, setListingViewTab] = useState("all");
  const [userViewTab, setUserViewTab] = useState("guest");
  const [listingSearch, setListingSearch] = useState("");

  const { from, to } = useMemo(
    () => getDateRange(dateMode, customRange),
    [dateMode, customRange],
  );

  const [isCustomRangeOpen, setIsCustomRangeOpen] = useState(false);
  // With moveRangeOnFirstSelection={false}, the first click sets start=end
  // to the same day and the second click sets the real end date — so two
  // onChange firings means a full range has been picked.
  const customRangeClicksRef = useRef(0);

  const switchDateMode = (mode) => {
    if (mode === "custom") {
      setIsCustomRangeOpen((prev) => {
        const next = dateMode === "custom" ? !prev : true;
        if (next) customRangeClicksRef.current = 0;
        return next;
      });
    } else {
      setIsCustomRangeOpen(false);
    }
    if (mode === dateMode) return;
    setDateMode(mode);
  };

  const handleCustomRangeChange = (ranges) => {
    setCustomRange(ranges.selection);
    customRangeClicksRef.current += 1;
    if (customRangeClicksRef.current >= 2) {
      setIsCustomRangeOpen(false);
    }
  };

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

  // GA4's realtime API itself only refreshes every ~30-60s, so polling this
  // faster gains nothing. Same property/endpoint as the wono.co widget on
  // Master Panel Analytics — Nomad and wono.co share one GA4 property.
  const { data: realtimeData } = useQuery({
    queryKey: ["wonoRealtimeActiveUsers"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        "/api/site-analytics/wono/realtime-active-users",
      );
      return response.data;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
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

  const buildListingQuery = (viewMode) => ({
    queryKey: [
      "nomadDestinationListingAnalyticsModal",
      viewMode,
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
            viewMode: viewMode === "all" ? undefined : viewMode,
          },
        },
      );
      return response.data;
    },
  });

  const {
    data: listingData,
    isPending: isListingsPending,
    isFetching: isListingsFetching,
    isError: isListingsError,
  } = useQuery(buildListingQuery("all"));

  const {
    data: listViewListingData,
    isPending: isListViewListingsPending,
    isFetching: isListViewListingsFetching,
    isError: isListViewListingsError,
  } = useQuery(buildListingQuery("list"));

  const {
    data: mapViewListingData,
    isPending: isMapViewListingsPending,
    isFetching: isMapViewListingsFetching,
    isError: isMapViewListingsError,
  } = useQuery(buildListingQuery("map"));

  const {
    data: destinationUsersData,
    isPending: isDestinationUsersPending,
    isFetching: isDestinationUsersFetching,
    isError: isDestinationUsersError,
  } = useQuery({
    queryKey: [
      "nomadDestinationUsersModal",
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
        "/api/nomad-users/popular-destinations/users",
        {
          params: {
            country: selectedDestination.country,
            state: selectedDestination.state,
            title: selectedDestination.title,
            continent: selectedDestination.continent,
            from: from?.toISOString?.(),
            to: to?.toISOString?.(),
            limit: 500,
          },
        },
      );
      return response.data;
    },
  });

  const listingDataByView = {
    all: listingData,
    list: listViewListingData,
    map: mapViewListingData,
  };

  const listingPendingByView = {
    all: isListingsPending,
    list: isListViewListingsPending,
    map: isMapViewListingsPending,
  };

  const listingFetchingByView = {
    all: isListingsFetching,
    list: isListViewListingsFetching,
    map: isMapViewListingsFetching,
  };

  const listingErrorByView = {
    all: isListingsError,
    list: isListViewListingsError,
    map: isMapViewListingsError,
  };

  const activeListingData = listingDataByView[listingViewTab];
  const listingItems = useMemo(() => listingData?.items || [], [listingData?.items]);
  const listingTotals = listingData?.totals || {
    totalClicks: 0,
    totalListings: 0,
    uniqueUsers: 0,
  };
  const activeListingItems = useMemo(
    () => activeListingData?.items || [],
    [activeListingData?.items],
  );
  const activeListingTotals = activeListingData?.totals || {
    totalClicks: 0,
    totalListings: 0,
    uniqueUsers: 0,
  };
  const isActiveListingsPending = listingPendingByView[listingViewTab];
  const isActiveListingsFetching = listingFetchingByView[listingViewTab];
  const isActiveListingsError = listingErrorByView[listingViewTab];
  const guestUsers = destinationUsersData?.guestUsers || [];
  const loggedInUsers = destinationUsersData?.loggedInUsers || [];
  const activeUsers = userViewTab === "guest" ? guestUsers : loggedInUsers;

  const filteredListings = useMemo(() => {
    const query = listingSearch.trim().toLowerCase();
    if (!query) return activeListingItems;
    return activeListingItems.filter((item) =>
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
  }, [activeListingItems, listingSearch]);

  const summaryCards = [
    {
      label: "Active Users",
      value: realtimeData?.activeUsers ?? 0,
      icon: UserCheck,
      accent: "border-l-purple-500",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
      isLive: true,
    },
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
    setListingViewTab("all");
    setUserViewTab("guest");
    setListingSearch("");
  };

  const closeDestinationDetails = () => {
    setSelectedDestination(null);
    setDestinationTab("overview");
    setListingViewTab("all");
    setUserViewTab("guest");
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

            {/* <button
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
            </button> */}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${card.accent}`}
                >
                  <div>
                    <p
                      className={`mb-1 flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest ${card.textColor}`}
                    >
                      {card.label}
                      {card.isLive && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-purple-500" />
                        </span>
                      )}
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
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full min-w-[220px] flex-1">
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

                <div className="relative flex flex-wrap items-center gap-1.5">
                  {DATE_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => switchDateMode(option.key)}
                      className={`rounded-lg px-3 py-2 text-[11px] font-pmedium transition-colors ${
                        dateMode === option.key
                          ? "bg-[#2563EB] text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  {dateMode === "custom" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-pmedium text-blue-700">
                      <CalendarDays size={13} />
                      {formatDateOnly(customRange.startDate)} — {formatDateOnly(customRange.endDate)}
                    </span>
                  )}

                  {isCustomRangeOpen && (
                    <div className="absolute right-0 top-full z-10 mt-2 max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
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
                        ranges={[customRange]}
                        onChange={handleCustomRangeChange}
                        moveRangeOnFirstSelection={false}
                        maxDate={new Date()}
                      />
                    </div>
                  )}
                </div>
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
                { key: "users", label: "Users" },
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

            {destinationTab === "listings" && (
              <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  {LISTING_VIEW_TABS.map((tab) => {
                    const isActive = listingViewTab === tab.key;
                    const listingCount = (listingDataByView[tab.key]?.totals || {})
                      .totalListings;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setListingViewTab(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition-colors ${
                          isActive
                            ? "bg-[#2563EB] text-white shadow-sm"
                            : "border border-slate-200/60 bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {formatNumber(listingCount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {destinationTab === "users" && (
              <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  {USER_VIEW_TABS.map((tab) => {
                    const isActive = userViewTab === tab.key;
                    const userCount =
                      tab.key === "guest" ? guestUsers.length : loggedInUsers.length;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setUserViewTab(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition-colors ${
                          isActive
                            ? "bg-[#2563EB] text-white shadow-sm"
                            : "border border-slate-200/60 bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {formatNumber(userCount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
              ) : destinationTab === "listings" ? (
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
                      {formatNumber(activeListingTotals.totalListings)} listings
                    </div>
                  </div>

                  {!selectedDestination.country || !selectedDestination.state ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MapPin size={28} className="mb-2 text-slate-300" />
                      <p className="text-[12px] font-pmedium text-red-500">
                        Destination details are missing.
                      </p>
                    </div>
                  ) : isActiveListingsPending ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : isActiveListingsError ? (
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
                          activeListingTotals.totalClicks,
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

                  {isActiveListingsFetching && !isActiveListingsPending && (
                    <div className="flex items-center justify-center py-2 text-slate-400">
                      <Loader2 size={14} className="animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-[12px] font-pmedium text-slate-800">
                        {userViewTab === "guest" ? "Guest Users" : "Logged In Users"}
                      </p>
                      <p className="text-[10px] font-pmedium text-slate-400">
                        IP addresses captured when the destination click happened.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-pmedium text-slate-500">
                      <Users size={12} />
                      {formatNumber(activeUsers.length)} clicks
                    </div>
                  </div>

                  {isDestinationUsersPending ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : isDestinationUsersError ? (
                    <div className="flex items-center justify-center py-16 text-center text-red-500">
                      Failed to load user IP analytics.
                    </div>
                  ) : activeUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users size={28} className="mb-2 text-slate-300" />
                      <p className="text-[12px] font-pmedium text-slate-400">
                        No {userViewTab === "guest" ? "guest" : "logged in"} user clicks found.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60">
                      {activeUsers.map((entry, index) => (
                        <div
                          key={entry.id || `${entry.ipAddress}-${entry.clickedAt}-${index}`}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-pmedium text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-pmedium text-slate-800">
                              {entry.ipAddress || "IP not captured"}
                              {[entry.location?.city, entry.location?.state, entry.location?.country]
                                .filter(Boolean).length > 0
                                ? ` - ${[entry.location?.city, entry.location?.state, entry.location?.country]
                                    .filter(Boolean)
                                    .join(", ")}`
                                : ""}
                            </p>
                            <p className="truncate text-[10px] font-pmedium text-slate-500">
                              {entry.user?.name || "Guest user"}
                              {entry.user?.email ? ` - ${entry.user.email}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[11px] font-pmedium text-slate-500">
                              {formatDate(entry.clickedAt)}
                            </p>
                            {/* <p className="text-[10px] font-pmedium text-slate-400">
                              {entry.sessionId ? `Session ${entry.sessionId}` : "No session"}
                            </p> */}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isDestinationUsersFetching && !isDestinationUsersPending && (
                    <div className="flex items-center justify-center py-2 text-slate-400">
                      <Loader2 size={14} className="animate-spin" />
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
