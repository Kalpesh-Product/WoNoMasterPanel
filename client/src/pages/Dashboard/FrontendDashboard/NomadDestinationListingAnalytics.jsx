import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Loader2,
  MapPin,
  MousePointerClick,
  Search,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

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

const getPercent = (clicks, totalClicks) => {
  if (!totalClicks) return 0;
  return Math.round((Number(clicks || 0) / totalClicks) * 100);
};

const getDestinationLabel = ({ title, state, country } = {}) =>
  [title || state, country].filter(Boolean).join(", ") || "Destination";

const getListingLabel = (item = {}) =>
  item.companyName
    ? `${item.companyName}${item.city ? ` - ${item.city}` : ""}`
    : item.businessId || item.companyId || "-";

const NomadDestinationListingAnalytics = () => {
  const axiosPrivate = useAxiosPrivate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const destination = useMemo(
    () => ({
      country: searchParams.get("country") || "",
      state: searchParams.get("state") || "",
      title: searchParams.get("title") || "",
      continent: searchParams.get("continent") || "",
    }),
    [searchParams],
  );

  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const destinationLabel = getDestinationLabel(destination);

  const {
    data,
    isPending,
    isFetching,
    isError,
  } = useQuery({
    queryKey: [
      "nomadDestinationListingAnalytics",
      destination.country,
      destination.state,
      destination.continent,
      from,
      to,
    ],
    enabled: Boolean(destination.country && destination.state),
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/nomad-users/popular-destinations/listings", {
        params: {
          country: destination.country,
          state: destination.state,
          continent: destination.continent,
          from,
          to,
          limit: 100,
        },
      });
      return response.data;
    },
  });

  const items = useMemo(() => data?.items || [], [data?.items]);
  const totals = data?.totals || {
    totalClicks: 0,
    totalListings: 0,
    guestClicks: 0,
    loggedInClicks: 0,
    uniqueUsers: 0,
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.companyName, item.businessId, item.companyId, item.city, item.state, item.country, item.continent]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const summaryCards = [
    {
      label: "Listing Clicks",
      value: totals.totalClicks,
      icon: MousePointerClick,
      accent: "border-l-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Listings",
      value: totals.totalListings,
      icon: Building2,
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

  return (
    <div className="min-h-full p-2 text-[12px] text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/nomad-click-analytics")}
                className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft size={13} />
                Back
              </button>
              <h2 className="flex items-center gap-1.5 text-title font-pmedium uppercase text-primary">
                Listing Analytics
              </h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                Listings clicked within {destinationLabel}.
              </p>
            </div>

            {isFetching && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-pmedium text-slate-500">
                <Loader2 size={13} className="animate-spin" />
                Refreshing
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
                  <div className="min-w-0">
                    <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${card.textColor}`}>
                      {card.label}
                    </p>
                    <p className="truncate text-[15px] font-pmedium text-slate-900">
                      {typeof card.value === "number" ? formatNumber(card.value) : card.value}
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-2xl p-2 ${card.bgColor} ${card.textColor}`}>
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
                  placeholder="Search listing, city, country..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            {!destination.country || !destination.state ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-red-500">
                Destination details are missing.
              </div>
            ) : isPending ? (
              <div className="flex flex-1 items-center justify-center text-slate-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : isError ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-red-500">
                Failed to load listing analytics.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <MapPin size={28} className="mb-2 text-slate-300" />
                <p className="text-[12px] font-pmedium text-slate-400">
                  No listing clicks found for this destination.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[1120px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="border-b border-slate-100/60 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Listing</th>
                      <th className="px-5 py-4">Clicks</th>
                      <th className="px-5 py-4">Click Percentage</th>
                      <th className="px-5 py-4">Guest User Clicks</th>
                      <th className="px-5 py-4">Logged In User Clicks</th>
                      <th className="px-5 py-4">Last Click</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredItems.map((item, index) => {
                      const percent = getPercent(item.clicks, totals.totalClicks);
                      return (
                        <tr
                          key={`${item.businessId || item.companyId || item.companyName}-${item.city}-${index}`}
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
                                {getListingLabel(item)}
                              </p>
                              <p className="truncate text-[10px] font-pmedium text-slate-500">
                                {[item.state, item.country].filter(Boolean).join(" - ") || "-"}
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

export default NomadDestinationListingAnalytics;
