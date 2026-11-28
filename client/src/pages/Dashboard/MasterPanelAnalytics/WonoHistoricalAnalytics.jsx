import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Clock3,
  Download,
  Eye,
  FileDown,
  Gauge,
  Loader2,
  Minus,
  MousePointerClick,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { RANGE_OPTIONS } from "./RangeTabs";
import WonoAnalyticsDecisionLayer from "./WonoAnalyticsDecisionLayer";
import GeographicUsersChart from "./GeographicUsersChart";
import { exportWonoAnalyticsPdf } from "./wonoAnalyticsPdf";
import {
  BarDiagram,
  TrendLine,
  DistributionDonut,
  layoutChartRows,
} from "../MainDashboard/charts/charts";

const renderChart = (chart) => {
  if (chart.type === "geo-bars") {
    return <GeographicUsersChart data={chart.dataset} title={chart.title} />;
  }
  if (chart.type === "bars") return <BarDiagram bars={chart.dataset} title={chart.title} />;
  if (chart.type === "line") return <TrendLine data={chart.dataset} title={chart.title} />;
  return <DistributionDonut data={chart.dataset} title={chart.title} />;
};

// Each chart is already a uniform [{ label, value }] list, so a CSV just
// stacks them with a heading row per section — opens straight in Excel.
const escapeCsvCell = (value) => {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const EXPORT_TIME_ZONE = "Asia/Calcutta";

const SUMMARY_METRICS = [
  { key: "activeUsers", label: "Active Users", icon: Users },
  { key: "sessions", label: "Sessions", icon: MousePointerClick },
  { key: "screenPageViews", label: "Page Views", icon: Eye },
  { key: "newUsers", label: "New Users", icon: UserPlus },
  { key: "engagementRate", label: "Engagement Rate", icon: Gauge },
  { key: "averageSessionDuration", label: "Avg. Session", icon: Clock3 },
];

const formatDuration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
};

const formatMetricValue = (key, value) => {
  if (key === "engagementRate") return `${((Number(value) || 0) * 100).toFixed(1)}%`;
  if (key === "averageSessionDuration") return formatDuration(value);
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
};

const getMetricChange = (current, previous) => {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveGaDate = (value, today) => {
  if (!value || value === "today") return new Date(today);
  const relativeMatch = String(value).match(/^(\d+)daysAgo$/);
  if (relativeMatch) {
    const date = new Date(today);
    date.setDate(date.getDate() - Number(relativeMatch[1]));
    return date;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getGaStartDate = (range) => {
  if (range === "thisMonth") {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  // GA4 date ranges include both endpoints, so these starts produce exactly
  // 7, 30, and 90 calendar days when the end date is today.
  return {
    "7daysAgo": "6daysAgo",
    "30daysAgo": "29daysAgo",
    "90daysAgo": "89daysAgo",
  }[range] || range;
};

const formatReviewDate = (date) =>
  date?.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: EXPORT_TIME_ZONE,
  }) || "Not available";

const getExportContext = (range, reportedRange) => {
  const generatedAt = new Date();
  const periodLabel =
    RANGE_OPTIONS.find((option) => option.key === range)?.label || range || "Selected Range";
  const startDate = resolveGaDate(reportedRange?.from || range, generatedAt);
  const endDate = resolveGaDate(reportedRange?.to || "today", generatedAt);
  const startIso = startDate ? toIsoDate(startDate) : "not-available";
  const endIso = endDate ? toIsoDate(endDate) : "not-available";

  return {
    generatedAt,
    periodLabel,
    startDate,
    endDate,
    startIso,
    endIso,
    filenamePeriod: periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  };
};

const exportChartsToCsv = (charts, range, reportedRange, summary) => {
  const context = getExportContext(range, reportedRange);
  const totalRows = charts.reduce((sum, chart) => sum + chart.dataset.length, 0);
  const metadata = [
    ["Report", "wono.co - Traffic & Audience"],
    ["Selected Period", context.periodLabel],
    ["Exact Date Range", `${formatReviewDate(context.startDate)} to ${formatReviewDate(context.endDate)}`],
    ["Start Date", context.startIso],
    ["End Date", context.endIso],
    [
      "Generated On",
      context.generatedAt.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "long",
        timeZone: EXPORT_TIME_ZONE,
      }),
    ],
    ["Report Time Zone", "India Standard Time (Asia/Calcutta)"],
    ["Data Source", "Google Analytics 4"],
    ["Sections Included", charts.length],
    ["Exported Data Rows", totalRows],
  ];
  const lines = metadata.map((row) => row.map(escapeCsvCell).join(","));
  lines.push("");

  if (summary?.current) {
    lines.push("Executive KPI Summary");
    lines.push("Metric,Current Period,Previous Period,Change");
    SUMMARY_METRICS.forEach((metric) => {
      const currentValue = summary.current[metric.key];
      const previousValue = summary.previous?.[metric.key];
      const change = getMetricChange(currentValue, previousValue);
      lines.push(
        [
          metric.label,
          formatMetricValue(metric.key, currentValue),
          summary.previous ? formatMetricValue(metric.key, previousValue) : "Not available",
          change === null ? "Not available" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    });
    lines.push("");
  }

  charts.forEach((chart) => {
    lines.push(escapeCsvCell(chart.title));
    lines.push(`Records,${chart.dataset.length}`);
    const isGeographicComparison = chart.type === "geo-bars";
    lines.push(isGeographicComparison ? "Location,Active Users,New Users" : "Label,Value");
    chart.dataset.forEach((row) => {
      lines.push(
        isGeographicComparison
          ? [row.label, row.activeUsers, row.newUsers].map(escapeCsvCell).join(",")
          : `${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`,
      );
    });
    lines.push("");
  });

  const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `wono-traffic-${context.filenamePeriod}-${context.startIso}-to-${context.endIso}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const ExecutiveMetric = ({ metric, current, previous }) => {
  const Icon = metric.icon;
  const change = getMetricChange(current, previous);
  const ChangeIcon = change === null ? Minus : change >= 0 ? TrendingUp : TrendingDown;
  const changeTone =
    change === null
      ? "text-slate-400 bg-slate-100"
      : change >= 0
        ? "text-emerald-700 bg-emerald-50"
        : "text-red-600 bg-red-50";

  return (
    <div className="min-w-0 px-4 py-4 lg:px-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
          <Icon size={15} />
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-pmedium ${changeTone}`}>
          <ChangeIcon size={10} />
          {change === null ? "No comparison" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
        </span>
      </div>
      <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
        {metric.label}
      </p>
      <p className="mt-1 text-xl font-pmedium tracking-tight text-slate-900">
        {formatMetricValue(metric.key, current)}
      </p>
      {previous !== undefined && previous !== null && (
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Previous: {formatMetricValue(metric.key, previous)}
        </p>
      )}
    </div>
  );
};

const TrafficExecutiveSummary = ({ summary, range, reportedRange }) => {
  if (!summary?.current) return null;
  const context = getExportContext(range, reportedRange);

  return (
    <section data-wono-pdf-section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 md:flex-row md:items-center">
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-xl bg-[#2563EB] p-2 text-white shadow-sm shadow-blue-200">
            <Gauge size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-pmedium uppercase tracking-wide text-slate-900">
              Executive Traffic Summary
            </span>
            <span className="mt-0.5 block text-xs font-pmedium text-slate-500">
              {context.periodLabel}: {formatReviewDate(context.startDate)} to {formatReviewDate(context.endDate)}
            </span>
          </span>
        </span>
        <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
          {summary.previous ? "Compared with previous equivalent period" : "All available history"}
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        {SUMMARY_METRICS.map((metric) => (
          <ExecutiveMetric
            key={metric.key}
            metric={metric}
            current={summary.current[metric.key]}
            previous={summary.previous?.[metric.key]}
          />
        ))}
      </div>
    </section>
  );
};

// range comes from the page-level RangeTabs control (MasterPanelAnalytics)
// so this widget stays in lockstep with every other section on the page.
const WonoHistoricalAnalytics = ({ range }) => {
  const axiosPrivate = useAxiosPrivate();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["wonoHistoricalAnalytics", range],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/site-analytics/wono/historical", {
        params: { from: getGaStartDate(range), to: "today" },
      });
      return response.data;
    },
  });

  const charts = data
    ? [
        { type: "line", title: "Daily Active User Trend", dataset: data.trendByDate },
        { type: "bars", title: "Sessions by Acquisition Channel", dataset: data.byChannel },
        { type: "pie", title: "Active Users by Device", dataset: data.byDevice },
        { type: "bars", title: "Top Pages (Unique Visitors)", dataset: data.topPages },
        {
          type: "geo-bars",
          title: "Active vs New Users by Country",
          dataset: data.geographicUsers?.countries,
          fullWidth: true,
        },
        {
          type: "geo-bars",
          title: "Active vs New Users by State",
          dataset: data.geographicUsers?.states,
          fullWidth: true,
        },
        {
          type: "geo-bars",
          title: "Active vs New Users by City",
          dataset: data.geographicUsers?.cities,
          fullWidth: true,
        },
        { type: "line", title: "Traffic by Hour of Day", dataset: data.byHour },
        { type: "bars", title: "Traffic by Day of Week", dataset: data.byDayOfWeek },
      ].filter((chart) => Array.isArray(chart.dataset) && chart.dataset.length > 0)
    : [];

  const handleExportPdf = async () => {
    const context = getExportContext(range, data?.range);
    setIsExportingPdf(true);
    setPdfError("");
    try {
      await exportWonoAnalyticsPdf({
        filename: `wono-analytics-${context.filenamePeriod}-${context.startIso}-to-${context.endIso}.pdf`,
        rangeLabel: `${context.periodLabel}: ${formatReviewDate(context.startDate)} to ${formatReviewDate(context.endDate)}`,
      });
    } catch (error) {
      console.error("WONO analytics PDF export failed:", error);
      setPdfError("Could not create the PDF. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      {isPending ? (
        <section className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
      ) : (
        <TrafficExecutiveSummary summary={data?.summary} range={range} reportedRange={data?.range} />
      )}
      {!isPending && !isError && <WonoAnalyticsDecisionLayer data={data} range={range} />}
      <section data-tour="master-panel-analytics-traffic" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
        <span className="flex items-center gap-3 min-w-0">
          <span className="p-2 rounded-xl bg-[#2563EB] text-white shrink-0 shadow-sm shadow-blue-200">
            <BarChart3 size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-pmedium text-slate-900 uppercase tracking-wide">
              wono.co — Traffic & Audience
            </span>
            <span className="block text-xs font-pmedium text-slate-500 mt-0.5">
              Active and new users by location, plus traffic sources and timing.
            </span>
          </span>
        </span>
        {charts.length > 0 && (
          <div data-html2canvas-ignore="true" className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => exportChartsToCsv(charts, range, data?.range, data?.summary)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50"
            >
              <Download size={12} /> Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-white shadow-sm shadow-blue-200 transition-all hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {isExportingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
              {isExportingPdf ? "Creating PDF" : "Export PDF"}
            </button>
          </div>
        )}
      </div>

      {pdfError && (
        <p data-html2canvas-ignore="true" className="border-b border-red-100 bg-red-50 px-5 py-2 text-[10px] font-pmedium text-red-600">
          {pdfError}
        </p>
      )}

      <div className="p-4">
        {isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="animate-pulse bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-48"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
            <p className="text-xs font-pmedium text-slate-500 text-center">
              Failed to load traffic analytics.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[10px] font-pmedium uppercase tracking-widest shadow-sm shadow-blue-200 transition-all hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : charts.length === 0 ? (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
            <BarChart3 size={20} className="text-slate-300" />
            <p className="text-xs font-pmedium text-slate-500 text-center">
              No traffic recorded for this period.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {layoutChartRows(charts).map((entry, index) => (
              <div
                key={`${entry.chart.title}-${index}`}
                data-wono-pdf-section
                className={`h-full ${entry.span === 2 ? "md:col-span-2" : ""}`}
              >
                {renderChart(entry.chart)}
              </div>
            ))}
          </div>
        )}
      </div>
      </section>
    </>
  );
};

export default WonoHistoricalAnalytics;
