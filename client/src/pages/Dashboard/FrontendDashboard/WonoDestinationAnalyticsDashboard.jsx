import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactApexChart from "react-apexcharts";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Eye,
  Globe2,
  Layers3,
  MapPin,
  Star,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import WonoDestinationDetailModal from "./WonoDestinationDetailModal";
import {
  getDestinationContinentMeta,
  getDestinationPriorityClasses,
  getDestinationPriorityMeta,
} from "./wonoDestinationAnalyticsTheme";

const number = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priorityMeta = {
  P1: {
    ...getDestinationPriorityMeta("P1"),
    label: "Immediate priority",
    reason: "First onboarding wave. Strongest combined client opportunity, demand and market readiness.",
  },
  P2: {
    ...getDestinationPriorityMeta("P2"),
    label: "High priority",
    reason: "Second onboarding wave. Strong markets with a comparatively weaker factor than P1.",
  },
  P3: {
    ...getDestinationPriorityMeta("P3"),
    label: "Medium priority",
    reason: "Selective validation markets. Opportunity exists but strength is less consistent than P1/P2.",
  },
  P4: {
    ...getDestinationPriorityMeta("P4"),
    label: "Low priority",
    reason: "Monitor or selectively test. Lowest-ranked markets in the current 132-destination set.",
  },
};

const Stat = ({ label, value, icon: Icon, accent = "text-[#2563EB]", border = "border-l-[#2563EB]", tour }) => (
  <div data-tour={tour} className={`min-w-0 rounded-[2rem] border border-slate-100 border-l-4 ${border} bg-white px-4 py-4 shadow-sm`}>
    <div className={`flex items-center gap-1.5 text-[9px] font-pmedium uppercase tracking-widest ${accent}`}>
      <Icon size={12} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-2 truncate text-[16px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const Panel = ({ title, description, children, tour, scrollMarginTop }) => (
  <section data-tour={tour} style={scrollMarginTop ? { scrollMarginTop } : undefined} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-white px-5 py-4">
      <h2 className="text-sm font-pmedium text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs font-pmedium text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

const PriorityLegend = ({ prioritySummary, mode }) => (
  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-4">
    {prioritySummary.map((item) => (
      <div key={item.priority} className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-pmedium text-slate-700">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityMeta[item.priority].color }} />
          <span className="truncate">{item.priority} · {priorityMeta[item.priority].label}</span>
        </div>
        <p className="mt-1 pl-3.5 text-[10px] font-pmedium text-slate-400">
          {mode === "count" ? `${item.count} destinations` : `avg ${number.format(item.averageScore)}`}
        </p>
      </div>
    ))}
  </div>
);

const WonoDestinationAnalyticsDashboard = () => {
  const axios = useAxiosPrivate();
  const navigate = useNavigate();
  const [activePriority, setActivePriority] = useState("P1");
  const [activeContinent, setActiveContinent] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["wono-destination-analytics-dashboard"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", { params: { limit: 250 } });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = data?.items || [];
  const summary = data?.summary;

  const prioritySummary = useMemo(() => (
    (summary?.prioritySummary || []).map((item) => {
      const priorityRows = rows.filter((row) => row.priority === item.priority);
      return {
        ...item,
        rows: priorityRows,
        topDestination: priorityRows[0],
        bottomScore: priorityRows[priorityRows.length - 1]?.score || 0,
      };
    })
  ), [rows, summary]);

  const continentSummary = useMemo(() => (
    (summary?.continentSummary || []).map((item) => {
      const continentRows = rows.filter((row) => row.continent === item.continent);
      const continentMeta = getDestinationContinentMeta(item.continent);
      return {
        ...item,
        color: continentMeta.color,
        style: continentMeta,
        topDestination: continentRows[0],
        lowScore: continentRows[continentRows.length - 1]?.score || 0,
      };
    })
  ), [rows, summary]);

  const activePriorityData = prioritySummary.find((item) => item.priority === activePriority);
  const selectedContinent = activeContinent || continentSummary[0]?.continent || "";
  const top5ByPriority = (activePriorityData?.rows || []).slice(0, 5);
  const continentRows = rows.filter((row) => row.continent === selectedContinent);
  const top5ByContinent = continentRows.slice(0, 5);

  const priorityByContinentChart = useMemo(() => ({
    series: Object.keys(priorityMeta).map((priority) => ({
      name: `${priority} · ${priorityMeta[priority].label}`,
      data: continentSummary.map((item) => rows.filter((row) => row.continent === item.continent && row.priority === priority).length),
    })),
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", stacked: true, stackType: "100%", toolbar: { show: false } },
      colors: Object.keys(priorityMeta).map((priority) => priorityMeta[priority].color),
      plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: "55%", dataLabels: { position: "center" } } },
      dataLabels: {
        enabled: true,
        style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px", colors: ["#fff"] },
        formatter: (_value, opts) => {
          const count = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
          return count > 0 ? count : "";
        },
      },
      xaxis: {
        categories: continentSummary.map((item) => `${item.continent} · ${((item.count / rows.length) * 100).toFixed(1)}%`),
        max: 100,
        labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" }, formatter: (value) => `${value}%` },
      },
      yaxis: { labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" },
      tooltip: { y: { formatter: (value) => `${value} destinations` } },
    },
  }), [rows, continentSummary]);

  const countryBins = useMemo(() => {
    const perCountry = {};
    rows.forEach((row) => { perCountry[row.country] = (perCountry[row.country] || 0) + 1; });
    const counts = Object.values(perCountry);
    const maxBin = Math.max(1, ...counts);
    return Array.from({ length: maxBin }, (_, index) => index + 1)
      .map((bin) => ({ bin, countries: counts.filter((count) => count === bin).length }))
      .filter((item) => item.countries > 0);
  }, [rows]);

  const countryBinsChart = useMemo(() => ({
    series: [{ name: "Countries", data: countryBins.map((item) => item.countries) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: ["#7C3AED"],
      plotOptions: { bar: { borderRadius: 5, columnWidth: "46%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] } },
      xaxis: { categories: countryBins.map((item) => `${item.bin} destination${item.bin > 1 ? "s" : ""}`), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" } } },
      yaxis: { title: { text: "Countries", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", fontWeight: 500, color: "#64748B" } }, labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { y: { formatter: (value) => `${value} countries` } },
    },
  }), [countryBins]);

  const top5Chart = (items, color) => ({
    series: [{ name: "WoNo score", data: items.map((item) => item.score) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: [color],
      plotOptions: { bar: { borderRadius: 6, columnWidth: "55%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] }, formatter: (value) => number.format(value) },
      xaxis: { categories: items.map((item) => item.destination), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      yaxis: { min: 0, max: 100, title: { text: "WoNo Score", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", fontWeight: 500, color: "#64748B" } }, labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { y: { formatter: (value) => number.format(value) } },
    },
  });

  const top5PriorityChart = top5Chart(top5ByPriority, priorityMeta[activePriority].color);
  const top5ContinentChart = top5Chart(top5ByContinent, continentSummary.find((item) => item.continent === selectedContinent)?.color || "#2563EB");

  const priorityChart = useMemo(() => ({
    series: prioritySummary.map((item) => item.count),
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "donut", toolbar: { show: false } },
      labels: prioritySummary.map((item) => item.priority),
      colors: prioritySummary.map((item) => priorityMeta[item.priority].color),
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" }, dropShadow: { enabled: false } },
      stroke: { width: 0 },
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: "67%",
            labels: {
              show: true,
              name: { fontSize: "12px" },
              value: { fontSize: "14px", fontFamily: "Poppins-SemiBold, sans-serif" },
              total: { show: true, label: "Destinations", fontSize: "11px", formatter: () => String(summary?.destinations || 0) },
            },
          },
        },
      },
      tooltip: { y: { formatter: (value) => `${value} destinations` } },
    },
  }), [prioritySummary, summary]);

  const priorityScoreChart = useMemo(() => ({
    series: [{ name: "Average score", data: prioritySummary.map((item) => Number(item.averageScore.toFixed(2))) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: prioritySummary.map((item) => priorityMeta[item.priority].color),
      plotOptions: { bar: { borderRadius: 5, distributed: true, columnWidth: "46%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] }, formatter: (value) => number.format(value) },
      xaxis: { categories: prioritySummary.map((item) => item.priority), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      yaxis: { min: 0, max: 100, title: { text: "WoNo Score", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", fontWeight: 500, color: "#64748B" } }, labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { y: { formatter: (value) => number.format(value) } },
    },
  }), [prioritySummary]);

  const continentShareChart = useMemo(() => ({
    series: continentSummary.map((item) => item.count),
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "donut", toolbar: { show: false } },
      labels: continentSummary.map((item) => item.continent),
      colors: continentSummary.map((item) => item.color),
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" }, dropShadow: { enabled: false } },
      stroke: { width: 0 },
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px", itemMargin: { horizontal: 5, vertical: 1 } },
      plotOptions: {
        pie: {
          donut: {
            size: "67%",
            labels: {
              show: true,
              name: { fontSize: "12px" },
              value: { fontSize: "14px", fontFamily: "Poppins-SemiBold, sans-serif" },
              total: { show: true, label: "Continents", fontSize: "11px", formatter: () => String(summary?.continents || 0) },
            },
          },
        },
      },
      tooltip: { y: { formatter: (value) => `${value} destinations` } },
    },
  }), [continentSummary, summary]);

  const continentScoreChart = useMemo(() => ({
    series: [{ name: "Average WoNo score", data: continentSummary.map((item) => Number(item.averageScore.toFixed(2))) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: continentSummary.map((item) => item.color),
      plotOptions: { bar: { borderRadius: 5, distributed: true, columnWidth: "50%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] }, formatter: (value) => number.format(value) },
      xaxis: { categories: continentSummary.map((item) => item.continent), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" }, rotate: -35 } },
      yaxis: { min: 0, max: 100, title: { text: "WoNo Score", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", fontWeight: 500, color: "#64748B" } }, labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { y: { formatter: (value) => number.format(value) } },
    },
  }), [continentSummary]);

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 p-5 animate-pulse lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[1.75rem] bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-full p-2 text-[12px] font-pmedium text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="mt-1 text-title text-primary uppercase">
                Destination sequence & ranking dashboard
              </h1>
              <button
                data-tour="destination-dashboard-header"
                type="button"
                onClick={() => navigate("/dashboard/destination-data-analytics/ranking")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-white transition hover:bg-[#1d4ed8]"
              >
                View All 132 Destinations
                <ArrowRight size={14} />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Overall share, onboarding priorities, ranked destinations and continent performance from the approved 132-destination research set.
            </p>
          </section>

          {isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-700">
              Destination dashboard could not be loaded. {" "}
              <button type="button" onClick={() => refetch()} className="underline">Try again</button>.
            </div>
          ) : (
            <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat tour="destination-dashboard-stat-total" label="Total destinations" value={summary?.destinations || 0} icon={Layers3} />
              <Stat tour="destination-dashboard-stat-countries" label="Countries" value={summary?.countries || 0} icon={MapPin} accent="text-violet-600" border="border-l-violet-500" />
              <Stat tour="destination-dashboard-stat-continents" label="Continents" value={summary?.continents || 0} icon={Globe2} accent="text-amber-600" border="border-l-amber-500" />
              <Stat tour="destination-dashboard-stat-avg-score" label="Average WoNo score" value={number.format(summary?.averageScore || 0)} icon={BarChart3} accent="text-emerald-600" border="border-l-emerald-500" />
              <Stat tour="destination-dashboard-stat-top" label="Top destination" value={rows[0] ? `${rows[0].destination} · ${number.format(rows[0].score)}` : "—"} icon={Star} accent="text-rose-600" border="border-l-rose-500" />
            </div>

            <section className="grid gap-4 xl:grid-cols-2">
              <Panel tour="destination-dashboard-chart-priority-share" title="Priority Share" description="Destination count by onboarding band.">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={priorityChart.options} series={priorityChart.series} type="donut" height={230} />
                <PriorityLegend prioritySummary={prioritySummary} mode="count" />
              </Panel>
              <Panel tour="destination-dashboard-chart-priority-score" title="Priority Score Comparison" description="Average WoNo score by onboarding band.">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={priorityScoreChart.options} series={priorityScoreChart.series} type="bar" height={230} />
                <PriorityLegend prioritySummary={prioritySummary} mode="score" />
              </Panel>
              <Panel tour="destination-dashboard-chart-continent-share" title="Continent Share" description="Destination count by continent.">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={continentShareChart.options} series={continentShareChart.series} type="donut" height={250} />
              </Panel>
              <Panel tour="destination-dashboard-chart-continent-score" title="Continent Score Comparison" description="Average WoNo score by continent.">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={continentScoreChart.options} series={continentScoreChart.series} type="bar" height={250} />
              </Panel>
            </section>

            <Panel tour="destination-dashboard-chart-priority-mix" title="Priority Mix By Continent" description="How many destinations in each priority band, per continent.">
              <div className="px-2 pt-2">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={priorityByContinentChart.options} series={priorityByContinentChart.series} type="bar" height={340} />
              </div>
            </Panel>
            <Panel tour="destination-dashboard-chart-country-bins" title="Destinations Per Country" description="How many countries have 1, 2, 3+ WoNo destinations.">
              <div className="px-2 pt-2">
                <ReactApexChart className="chart-tooltip-overflow-visible" options={countryBinsChart.options} series={countryBinsChart.series} type="bar" height={280} />
              </div>
            </Panel>

            <section>
              <div className="px-1 pb-3">
                <h2 className="text-sm text-slate-900 font-pmedium">Priority Bands</h2>
                <p className="mt-1 text-xs font-pmedium text-slate-500">Select a priority to see its top destinations and full ranked list below.</p>
              </div>
              <div data-tour="destination-dashboard-priority-bands" className="sticky top-0 z-20 bg-white py-2">
                <div className="grid gap-2 xl:grid-cols-4">
                  {prioritySummary.map((item) => {
                    const meta = priorityMeta[item.priority];

                  return (
                    <button
                      key={item.priority}
                      type="button"
                      onClick={() => setActivePriority(item.priority)}
                      className={`rounded-2xl border ${meta.border} ${meta.surface} p-3 text-left font-pmedium transition hover:-translate-y-0.5 ${activePriority === item.priority ? "ring-2 ring-offset-2" : ""}`}
                      style={activePriority === item.priority ? { "--tw-ring-color": meta.color } : undefined}
                    >
                      <div className={`flex items-center justify-between gap-2 text-[10px] font-pmedium uppercase tracking-widest ${meta.text}`}>
                        <span className="truncate">{item.priority} · {meta.label}</span>
                        <span className="shrink-0">{item.rankRange}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-pmedium text-slate-500">Destinations</p>
                          <p className="mt-0.5 text-lg text-slate-900">{item.count}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-pmedium text-slate-500">Average</p>
                          <p className="mt-0.5 text-lg text-slate-900">{number.format(item.averageScore)}</p>
                        </div>
                      </div>
                      <p className="mt-2 truncate text-[10px] font-pmedium text-slate-600">Top: {item.topDestination?.destination}</p>
                      {activePriority === item.priority && (
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-pmedium" style={{ color: meta.color }}>
                          View ranked list below <ChevronDown size={11} />
                        </p>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <Panel tour="destination-dashboard-chart-top5-priority" title={`Top 5 In ${activePriority}`} description="Highest-scoring destinations in the selected priority band.">
                  <div className="px-2 pt-2">
                    <ReactApexChart className="chart-tooltip-overflow-visible" key={`top5-priority-${activePriority}`} options={top5PriorityChart.options} series={top5PriorityChart.series} type="bar" height={260} />
                  </div>
                </Panel>

                <Panel tour="destination-dashboard-priority-table" title={`${activePriority} Ranked Destinations`} description={`${priorityMeta[activePriority].reason} Showing all ${activePriorityData?.count || 0} destinations in rank order.`}>
                  <div className="max-h-[540px] overflow-auto">
                    <table className="w-full min-w-[840px] table-fixed text-left">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="w-[9%] px-5 py-3">Rank</th>
                          <th className="w-[26%] px-5 py-3">Destination</th>
                          <th className="w-[21%] px-5 py-3">Country</th>
                          <th className="w-[19%] px-5 py-3">Continent</th>
                          <th className="w-[15%] px-5 py-3 text-right">WoNo score</th>
                          <th className="w-[10%] px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(activePriorityData?.rows || []).map((item) => (
                          <tr key={item.rank} className="transition hover:bg-slate-50">
                            <td className="px-5 py-3.5 text-slate-500">#{item.rank}</td>
                            <td className="truncate px-5 py-3.5" title={item.destination}>
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(item.destination)}`)}
                                className="truncate font-pmedium text-[#2563EB] hover:underline"
                              >
                                {item.destination}
                              </button>
                            </td>
                            <td className="truncate px-5 py-3.5 text-slate-600" title={item.country}>{item.country}</td>
                            <td className="truncate px-5 py-3.5 text-slate-600" title={item.continent}>{item.continent}</td>
                            <td className="px-5 py-3.5 text-right text-slate-900">{number.format(item.score)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedDestination(item)}
                                aria-label={`View ${item.destination} score details`}
                                className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-[#2563EB]"
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </section>

            <section>
              <div className="px-1 pb-3">
                <h2 className="text-sm text-slate-900 font-pmedium">Continent Performance</h2>
                <p className="mt-1 text-xs font-pmedium text-slate-500">Select a continent to see its top destinations and full ranked list below.</p>
              </div>
              <div data-tour="destination-dashboard-continent-cards" className="sticky top-0 z-20 bg-white py-2">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                  {continentSummary.map((item) => (
                    <button
                      key={item.continent}
                      type="button"
                      onClick={() => setActiveContinent(item.continent)}
                      className={`rounded-2xl border ${item.style.border} ${item.style.surface} p-3 text-left font-pmedium transition hover:-translate-y-0.5 ${selectedContinent === item.continent ? "ring-2 ring-offset-2" : ""}`}
                      style={selectedContinent === item.continent ? { "--tw-ring-color": item.color } : undefined}
                    >
                      <div className={`flex items-center justify-between gap-2 text-[10px] font-pmedium uppercase tracking-widest ${item.style.text}`}>
                        <span className="truncate">{item.continent} </span>
                        <span className="shrink-0">{number.format(item.averageScore)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-pmedium text-slate-500">Destinations</p>
                          <p className="mt-0.5 text-lg text-slate-900">{item.count}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-pmedium text-slate-500">Average</p>
                          <p className="mt-0.5 text-lg text-slate-900">{number.format(item.averageScore)}</p>
                        </div>
                      </div>
                      <p className="mt-2 truncate text-[10px] font-pmedium text-slate-600">Top: {item.topDestination?.destination}</p>
                      {selectedContinent === item.continent && (
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-pmedium" style={{ color: item.color }}>
                          View ranked list below <ChevronDown size={11} />
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <Panel tour="destination-dashboard-chart-top5-continent" title={`Top 5 In ${selectedContinent}`} description="Highest-scoring destinations in the selected continent.">
                  <div className="px-2 pt-2">
                    <ReactApexChart className="chart-tooltip-overflow-visible" key={`top5-continent-${selectedContinent}`} options={top5ContinentChart.options} series={top5ContinentChart.series} type="bar" height={260} />
                  </div>
                </Panel>

                <Panel tour="destination-dashboard-continent-table" title={`${selectedContinent} Ranked Destinations`} description={`Showing all ${continentRows.length} destinations in rank order.`}>
                  <div className="max-h-[540px] overflow-auto">
                    <table className="w-full min-w-[840px] table-fixed text-left">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="w-[9%] px-5 py-3">Rank</th>
                          <th className="w-[26%] px-5 py-3">Destination</th>
                          <th className="w-[21%] px-5 py-3">Country</th>
                          <th className="w-[19%] px-5 py-3">Priority</th>
                          <th className="w-[15%] px-5 py-3 text-right">WoNo score</th>
                          <th className="w-[10%] px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {continentRows.map((item) => (
                          <tr key={item.rank} className="transition hover:bg-slate-50">
                            <td className="px-5 py-3.5 font-pmedium text-slate-500">#{item.rank}</td>
                            <td className="truncate px-5 py-3.5" title={item.destination}>
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(item.destination)}`)}
                                className="truncate font-pmedium text-[#2563EB] hover:underline"
                              >
                                {item.destination}
                              </button>
                            </td>
                            <td className="truncate px-5 py-3.5 font-pmedium text-slate-600" title={item.country}>{item.country}</td>
                            <td className="truncate px-5 py-3.5">
                              {item.priority ? <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${getDestinationPriorityClasses(item.priority)}`}>{item.priority} · {item.priorityLabel}</span> : <span className="text-[10px] text-slate-400">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right font-pmedium text-slate-900">{number.format(item.score)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedDestination(item)}
                                aria-label={`View ${item.destination} score details`}
                                className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-[#2563EB]"
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </section>

            </>
          )}
        </div>
      </PageFrame>
      <WonoDestinationDetailModal destination={selectedDestination} onClose={() => setSelectedDestination(null)} />
    </div>
  );
};

export default WonoDestinationAnalyticsDashboard;
