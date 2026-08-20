import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const DATE_FILTER_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value) || 0);

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
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from, to };
  }

  if (mode === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  const from = new Date(`${customRange.from}T00:00:00`);
  const to = new Date(`${customRange.to}T23:59:59`);
  return { from, to };
};

const getDestinationLabel = (item = {}) =>
  [item.title || item.state, item.country].filter(Boolean).join(", ") || "-";

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

  const { from, to } = useMemo(
    () => getDateRange(dateMode, customRange),
    [dateMode, customRange],
  );

  const {
    data,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "nomadClickAnalytics",
      dateMode,
      from?.toISOString?.() || "all",
      to?.toISOString?.() || "all",
    ],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/nomad-users/popular-destinations", {
        params: {
          limit: 50,
          from: from?.toISOString?.(),
          to: to?.toISOString?.(),
        },
      });
      return response.data;
    },
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
  const totals = data?.totals || {
    totalClicks: 0,
    totalDestinations: 0,
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
      label: "Unique Sessions",
      value: totals.uniqueSessions,
      icon: Users,
      accent: "border-l-amber-500",
      textColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Signed-In Users",
      value: totals.uniqueUsers,
      icon: Clock3,
      accent: "border-l-slate-400",
      textColor: "text-slate-600",
      bgColor: "bg-slate-50",
    },
  ];

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
              {isFetching ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
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
                      setCustomRange((prev) => ({ ...prev, from: event.target.value }))
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
                      setCustomRange((prev) => ({ ...prev, to: event.target.value }))
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
                    <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${card.textColor}`}>
                      {card.label}
                    </p>
                    <p className="text-[15px] font-pmedium text-slate-900">
                      {formatNumber(card.value)}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-2 ${card.bgColor} ${card.textColor}`}>
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100/60 bg-slate-50/50 p-3 sm:p-4 lg:p-5">
              <div className="relative w-full xl:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
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
                <table className="w-full min-w-[980px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[28%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Destination</th>
                      <th className="px-5 py-4">Clicks</th>
                      <th className="px-5 py-4">Click Percentage</th>
                      <th className="px-5 py-4">Sessions</th>
                      <th className="px-5 py-4">Users</th>
                      <th className="px-5 py-4">Last Click</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredItems.map((item, index) => {
                      const percent = getPercent(item.clicks, totals.totalClicks);
                      return (
                        <tr key={`${item.country}-${item.state}-${item.title || index}`} className="transition-colors hover:bg-slate-50/50">
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
                                {[item.state, item.continent].filter(Boolean).join(" - ") || "-"}
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
                            {formatNumber(item.uniqueSessions)}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {formatNumber(item.uniqueUsers)}
                          </td>
                          <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                            {formatDate(item.lastClickedAt)}
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
  );
};

export default NomadClickAnalytics;
