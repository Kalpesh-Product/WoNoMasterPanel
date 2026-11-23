import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactApexChart from "react-apexcharts";
import { BarChart3, Globe2, Layers3, MapPin, Star } from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import {
  getDestinationContinentMeta,
  getDestinationPriorityMeta,
} from "../../FrontendDashboard/wonoDestinationAnalyticsTheme";
import { EmptyOverview, ErrorOverview, LoadingOverview } from "./charts";

const number = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FONT = "Poppins-SemiBold, sans-serif";
const PRIORITIES = ["P1", "P2", "P3", "P4"];
const PRIORITY_LABELS = { P1: "Immediate", P2: "High", P3: "Medium", P4: "Low" };

const axisStyle = { fontFamily: FONT, fontSize: "9px" };

const Stat = ({ label, value, icon: Icon, accent = "text-[#2563EB]", border = "border-l-[#2563EB]" }) => (
  <div className={`min-w-0 rounded-[2rem] border border-slate-100 border-l-4 ${border} bg-white px-4 py-4 shadow-sm`}>
    <div className={`flex items-center gap-1.5 text-[9px] font-pmedium uppercase tracking-widest ${accent}`}>
      <Icon size={12} />
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-2 truncate text-[16px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const Panel = ({ title, description, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 bg-white px-5 py-4">
      <h2 className="text-sm font-pmedium text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs font-pmedium text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

const DestinationAnalyticsCharts = () => {
  const axios = useAxiosPrivate();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["wono-destination-analytics-dashboard"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", { params: { limit: 250 } });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => data?.items || [], [data]);
  const summary = data?.summary;

  const prioritySummary = useMemo(
    () => summary?.prioritySummary || [],
    [summary],
  );

  const continentSummary = useMemo(
    () =>
      (summary?.continentSummary || []).map((item) => ({
        ...item,
        ...getDestinationContinentMeta(item.continent),
      })),
    [summary],
  );

  const priorityMeta = useMemo(
    () => Object.fromEntries(PRIORITIES.map((priority) => [priority, getDestinationPriorityMeta(priority)])),
    [],
  );

  const priorityChart = useMemo(
    () => ({
      series: prioritySummary.map((item) => item.count),
      options: {
        chart: { fontFamily: FONT, type: "donut", toolbar: { show: false } },
        labels: prioritySummary.map((item) => item.priority),
        colors: prioritySummary.map((item) => priorityMeta[item.priority].color),
        dataLabels: {
          enabled: true,
          style: { fontFamily: FONT, fontSize: "10px" },
          dropShadow: { enabled: false },
        },
        stroke: { width: 0 },
        legend: { show: false },
        plotOptions: {
          pie: {
            donut: {
              size: "67%",
              labels: {
                show: true,
                name: { fontSize: "12px" },
                value: { fontSize: "14px", fontFamily: FONT },
                total: {
                  show: true,
                  label: "Destinations",
                  fontSize: "11px",
                  formatter: () => String(summary?.destinations || 0),
                },
              },
            },
          },
        },
        tooltip: { y: { formatter: (value) => `${value} destinations` } },
      },
    }),
    [prioritySummary, priorityMeta, summary],
  );

  const priorityScoreChart = useMemo(
    () => ({
      series: [{ name: "Average score", data: prioritySummary.map((item) => Number(item.averageScore.toFixed(2))) }],
      options: {
        chart: { fontFamily: FONT, type: "bar", toolbar: { show: false } },
        colors: prioritySummary.map((item) => priorityMeta[item.priority].color),
        plotOptions: {
          bar: { borderRadius: 5, distributed: true, columnWidth: "46%", dataLabels: { position: "center" } },
        },
        dataLabels: {
          enabled: true,
          style: { fontFamily: FONT, fontSize: "10px", colors: ["#fff"] },
          formatter: (value) => number.format(value),
        },
        xaxis: {
          categories: prioritySummary.map((item) => item.priority),
          labels: { style: { fontFamily: FONT, fontSize: "10px" } },
        },
        yaxis: {
          min: 0,
          max: 100,
          title: { text: "WoNo Score", style: { fontFamily: FONT, fontSize: "10px", fontWeight: 500, color: "#64748B" } },
          labels: { style: { fontFamily: FONT, fontSize: "10px" } },
        },
        grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
        legend: { show: false },
        tooltip: { y: { formatter: (value) => number.format(value) } },
      },
    }),
    [prioritySummary, priorityMeta],
  );

  const continentShareChart = useMemo(
    () => ({
      series: continentSummary.map((item) => item.count),
      options: {
        chart: { fontFamily: FONT, type: "donut", toolbar: { show: false } },
        labels: continentSummary.map((item) => item.continent),
        colors: continentSummary.map((item) => item.color),
        dataLabels: {
          enabled: true,
          style: { fontFamily: FONT, fontSize: "10px" },
          dropShadow: { enabled: false },
        },
        stroke: { width: 0 },
        legend: {
          position: "bottom",
          fontFamily: FONT,
          fontSize: "9px",
          itemMargin: { horizontal: 5, vertical: 1 },
        },
        plotOptions: {
          pie: {
            donut: {
              size: "67%",
              labels: {
                show: true,
                name: { fontSize: "12px" },
                value: { fontSize: "14px", fontFamily: FONT },
                total: {
                  show: true,
                  label: "Continents",
                  fontSize: "11px",
                  formatter: () => String(summary?.continents || 0),
                },
              },
            },
          },
        },
        tooltip: { y: { formatter: (value) => `${value} destinations` } },
      },
    }),
    [continentSummary, summary],
  );

  const continentScoreChart = useMemo(
    () => ({
      series: [{ name: "Average score", data: continentSummary.map((item) => Number(item.averageScore.toFixed(2))) }],
      options: {
        chart: { fontFamily: FONT, type: "bar", toolbar: { show: false } },
        colors: continentSummary.map((item) => item.color),
        plotOptions: {
          bar: { borderRadius: 5, distributed: true, columnWidth: "50%", dataLabels: { position: "center" } },
        },
        dataLabels: {
          enabled: true,
          style: { fontFamily: FONT, fontSize: "10px", colors: ["#fff"] },
          formatter: (value) => number.format(value),
        },
        xaxis: {
          categories: continentSummary.map((item) => item.continent),
          labels: { style: { fontFamily: FONT, fontSize: "9px" }, rotate: -35 },
        },
        yaxis: {
          min: 0,
          max: 100,
          title: { text: "WoNo Score", style: { fontFamily: FONT, fontSize: "10px", fontWeight: 500, color: "#64748B" } },
          labels: { style: { fontFamily: FONT, fontSize: "10px" } },
        },
        grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
        legend: { show: false },
        tooltip: { y: { formatter: (value) => number.format(value) } },
      },
    }),
    [continentSummary],
  );

  const priorityByContinentChart = useMemo(
    () => ({
      series: PRIORITIES.map((priority) => ({
        name: `${priority} · ${PRIORITY_LABELS[priority]}`,
        data: continentSummary.map(
          (item) => rows.filter((row) => row.continent === item.continent && row.priority === priority).length,
        ),
      })),
      options: {
        chart: { fontFamily: FONT, type: "bar", stacked: true, stackType: "100%", toolbar: { show: false } },
        colors: PRIORITIES.map((priority) => priorityMeta[priority].color),
        plotOptions: {
          bar: { borderRadius: 4, horizontal: true, barHeight: "55%", dataLabels: { position: "center" } },
        },
        dataLabels: {
          enabled: true,
          style: { fontFamily: FONT, fontSize: "9px", colors: ["#fff"] },
          formatter: (_value, opts) => {
            const count = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
            return count > 0 ? count : "";
          },
        },
        xaxis: {
          categories: continentSummary.map(
            (item) => `${item.continent} · ${rows.length ? ((item.count / rows.length) * 100).toFixed(1) : "0.0"}%`,
          ),
          max: 100,
          labels: { style: { fontFamily: FONT, fontSize: "9px" }, formatter: (value) => `${value}%` },
        },
        yaxis: { labels: { style: { fontFamily: FONT, fontSize: "9px" } } },
        grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
        legend: { position: "bottom", fontFamily: FONT, fontSize: "9px" },
        tooltip: { y: { formatter: (value) => `${value} destinations` } },
      },
    }),
    [continentSummary, rows, priorityMeta],
  );

  const countryBinsChart = useMemo(() => {
    const perCountry = {};
    rows.forEach((row) => {
      perCountry[row.country] = (perCountry[row.country] || 0) + 1;
    });
    const counts = Object.values(perCountry);
    const maxBin = Math.max(1, ...counts);
    const bins = Array.from({ length: maxBin }, (_, index) => index + 1)
      .map((bin) => ({ bin, countries: counts.filter((count) => count === bin).length }))
      .filter((item) => item.countries > 0);

    return {
      series: [{ name: "Countries", data: bins.map((item) => item.countries) }],
      options: {
        chart: { fontFamily: FONT, type: "bar", toolbar: { show: false } },
        colors: ["#7C3AED"],
        plotOptions: { bar: { borderRadius: 5, columnWidth: "46%", dataLabels: { position: "center" } } },
        dataLabels: { enabled: true, style: { fontFamily: FONT, fontSize: "10px", colors: ["#fff"] } },
        xaxis: {
          categories: bins.map((item) => `${item.bin} destination${item.bin > 1 ? "s" : ""}`),
          labels: { style: axisStyle },
        },
        yaxis: {
          title: { text: "Countries", style: { fontFamily: FONT, fontSize: "10px", fontWeight: 500, color: "#64748B" } },
          labels: { style: { fontFamily: FONT, fontSize: "10px" } },
        },
        grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
        legend: { show: false },
        tooltip: { y: { formatter: (value) => `${value} countries` } },
      },
    };
  }, [rows]);

  if (isPending) return <LoadingOverview />;
  if (isError) return <ErrorOverview onRetry={() => refetch()} />;
  if (!rows.length) return <EmptyOverview title="Destination Data Analytics" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total destinations" value={summary?.destinations || 0} icon={Layers3} />
        <Stat
          label="Countries"
          value={summary?.countries || 0}
          icon={MapPin}
          accent="text-violet-600"
          border="border-l-violet-500"
        />
        <Stat
          label="Continents"
          value={summary?.continents || 0}
          icon={Globe2}
          accent="text-amber-600"
          border="border-l-amber-500"
        />
        <Stat
          label="Average WoNo score"
          value={number.format(summary?.averageScore || 0)}
          icon={BarChart3}
          accent="text-emerald-600"
          border="border-l-emerald-500"
        />
        <Stat
          label="Top destination"
          value={rows[0] ? `${rows[0].destination} · ${number.format(rows[0].score)}` : "—"}
          icon={Star}
          accent="text-rose-600"
          border="border-l-rose-500"
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Priority Share" description="Destination count by onboarding band.">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={priorityChart.options}
            series={priorityChart.series}
            type="donut"
            height={230}
          />
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-4">
            {prioritySummary.map((item) => (
              <div key={item.priority} className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-pmedium text-slate-700">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: priorityMeta[item.priority]?.color }}
                  />
                  <span className="truncate">
                    {item.priority} · {PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
                <p className="mt-1 pl-3.5 text-[10px] font-pmedium text-slate-400">{item.count} destinations</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Priority Score Comparison" description="Average WoNo score by onboarding band.">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={priorityScoreChart.options}
            series={priorityScoreChart.series}
            type="bar"
            height={230}
          />
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-4">
            {prioritySummary.map((item) => (
              <div key={item.priority} className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-pmedium text-slate-700">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: priorityMeta[item.priority]?.color }}
                  />
                  <span className="truncate">
                    {item.priority} · {PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
                <p className="mt-1 pl-3.5 text-[10px] font-pmedium text-slate-400">
                  avg {number.format(item.averageScore)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Continent Share" description="Destination count by continent.">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={continentShareChart.options}
            series={continentShareChart.series}
            type="donut"
            height={250}
          />
        </Panel>
        <Panel title="Continent Score Comparison" description="Average WoNo score by continent.">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={continentScoreChart.options}
            series={continentScoreChart.series}
            type="bar"
            height={250}
          />
        </Panel>
      </section>

      <Panel title="Priority Mix By Continent" description="How many destinations in each priority band, per continent.">
        <div className="px-2 pt-2">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={priorityByContinentChart.options}
            series={priorityByContinentChart.series}
            type="bar"
            height={320}
          />
        </div>
      </Panel>

      <Panel title="Destinations Per Country" description="How many countries have 1, 2, 3+ WoNo destinations.">
        <div className="px-2 pt-2">
          <ReactApexChart
            className="chart-tooltip-overflow-visible"
            options={countryBinsChart.options}
            series={countryBinsChart.series}
            type="bar"
            height={260}
          />
        </div>
      </Panel>
    </div>
  );
};

export default DestinationAnalyticsCharts;
