import { AlertCircle, BarChart3 } from "lucide-react";
import ReactApexChart from "react-apexcharts";

const FONT = "Poppins-SemiBold, sans-serif";

const CHART_COLORS = [
  "#2563EB",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

const axisLabelStyle = { fontFamily: FONT, fontSize: "9px" };

const baseChartOptions = (type) => ({
  chart: { fontFamily: FONT, type, toolbar: { show: false } },
  grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
  legend: { show: false },
  tooltip: { y: { formatter: (value) => Number(value || 0).toLocaleString("en-US") } },
});

export const ChartCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
    <div className="border-b border-slate-100 px-5 py-4">
      <p className="text-sm font-pmedium text-slate-900">{title}</p>
    </div>
    <div className="flex-1 px-2 pb-2 pt-3">{children}</div>
  </div>
);

// Layout pass shared by the chart renderers. Compact charts (donuts and
// short bar series) pair up two per row; horizontally hungry ones — trend
// lines and bar series with 6+ columns — take a full row. When a compact
// chart would trail alone before a full-row chart, the next compact chart
// is pulled forward so rows stay filled instead of leaving a vacant slot.
const WIDE_BAR_MIN = 9;

export const isWideChart = (chart) => {
  if (!chart) return false;
  if (chart.fullWidth != null) return Boolean(chart.fullWidth);
  if (chart.type === "line") return true;
  if (chart.type === "bars") {
    return (Array.isArray(chart.dataset) ? chart.dataset.length : 0) >= WIDE_BAR_MIN;
  }
  return false;
};

export const layoutChartRows = (charts) => {
  const list = Array.isArray(charts) ? [...charts] : [];
  const ordered = [];

  let i = 0;
  while (i < list.length) {
    if (isWideChart(list[i])) {
      ordered.push({ chart: list[i], span: 2 });
      i += 1;
      continue;
    }

    const next = list[i + 1];
    if (next && !isWideChart(next)) {
      ordered.push({ chart: list[i], span: 1 }, { chart: next, span: 1 });
      i += 2;
      continue;
    }

    // Lone compact chart ahead of a wide one — borrow the next compact
    // chart from further down the list to complete this row.
    const borrowIndex = list.findIndex((entry, j) => j > i + 1 && !isWideChart(entry));
    if (borrowIndex > -1) {
      const [borrowed] = list.splice(borrowIndex, 1);
      ordered.push({ chart: list[i], span: 1 }, { chart: borrowed, span: 1 });
      i += 1;
      continue;
    }

    ordered.push({ chart: list[i], span: 1 });
    i += 1;
  }

  return ordered;
};

export const BarDiagram = ({ bars, title = "Bar Diagram" }) => {
  const items = Array.isArray(bars) ? bars : [];
  const manyLabels = items.length > 6;

  const options = {
    ...baseChartOptions("bar"),
    colors: ["#2563EB"],
    plotOptions: {
      bar: { borderRadius: 6, columnWidth: "50%", dataLabels: { position: "center" } },
    },
    dataLabels: {
      enabled: true,
      style: { fontFamily: FONT, fontSize: "10px", colors: ["#fff"] },
      formatter: (value) => Number(value || 0).toLocaleString("en-US"),
    },
    xaxis: {
      categories: items.map((item) => item.label),
      labels: {
        style: axisLabelStyle,
        rotate: manyLabels ? -35 : 0,
        rotateAlways: false,
        trim: true,
      },
    },
    yaxis: {
      min: 0,
      labels: { style: axisLabelStyle },
      axisTicks: { show: false },
    },
  };

  return (
    <ChartCard title={title}>
      <ReactApexChart
        className="chart-tooltip-overflow-visible"
        options={options}
        series={[{ name: title, data: items.map((item) => Number(item.value) || 0) }]}
        type="bar"
        height={250}
      />
    </ChartCard>
  );
};

export const DistributionDonut = ({ data, title = "Distribution" }) => {
  const items = (Array.isArray(data) ? data : []).map((entry, index) => ({
    ...entry,
    color: entry.color || CHART_COLORS[index % CHART_COLORS.length],
  }));
  const total = items.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  const options = {
    ...baseChartOptions("donut"),
    labels: items.map((entry) => entry.label),
    colors: items.map((entry) => entry.color),
    stroke: { width: 0 },
    dataLabels: {
      enabled: true,
      style: { fontFamily: FONT, fontSize: "10px" },
      dropShadow: { enabled: false },
    },
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
              label: "Total",
              fontSize: "11px",
              formatter: () => String(total),
            },
          },
        },
      },
    },
  };

  return (
    <ChartCard title={title}>
      <ReactApexChart
        className="chart-tooltip-overflow-visible"
        options={options}
        series={items.map((entry) => Number(entry.value) || 0)}
        type="donut"
        height={250}
      />
    </ChartCard>
  );
};

export const TrendLine = ({ data, title = "Trend Line" }) => {
  const items = Array.isArray(data) ? data : [];

  if (items.length < 2) {
    return (
      <ChartCard title={title}>
        <p className="px-3 py-6 text-xs font-pmedium text-slate-400">
          Not enough data points to render a trend yet.
        </p>
      </ChartCard>
    );
  }

  const options = {
    ...baseChartOptions("area"),
    colors: ["#2563EB"],
    stroke: { curve: "smooth", width: 2.5 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0, stops: [0, 100] },
    },
    markers: { size: 3, strokeWidth: 2, hover: { size: 5 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: items.map((item) => item.label),
      labels: { style: axisLabelStyle, rotate: 0, trim: true },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: axisLabelStyle },
      axisTicks: { show: false },
    },
  };

  return (
    <ChartCard title={title}>
      <ReactApexChart
        className="chart-tooltip-overflow-visible"
        options={options}
        series={[{ name: title, data: items.map((item) => Number(item.value) || 0) }]}
        type="area"
        height={250}
      />
    </ChartCard>
  );
};

const SkeletonBar = () => (
  <div className="animate-pulse">
    <div className="h-3 w-1/3 rounded bg-slate-100 mb-5" />
    <div className="flex h-48 items-end gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-slate-100" style={{ height: `${30 + ((i * 13) % 60)}%` }} />
      ))}
    </div>
  </div>
);

export const LoadingOverview = () => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse bg-white px-4 py-4 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="h-3 w-2/3 rounded bg-slate-100 mb-2" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <SkeletonBar />
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <SkeletonBar />
      </div>
    </div>
  </div>
);

export const ErrorOverview = ({ onRetry }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <AlertCircle size={20} className="text-red-500" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      Failed to load overview data. The section may be unavailable or the
      backend may be offline.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[10px] font-pmedium uppercase tracking-widest shadow-sm shadow-blue-200 transition-all hover:opacity-90"
    >
      Retry
    </button>
  </div>
);

export const EmptyOverview = ({ title }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <BarChart3 size={20} className="text-slate-300" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      No overview data available for {title}. This section does not currently
      expose any chartable data.
    </p>
  </div>
);

export const NoChartsNote = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <BarChart3 size={20} className="text-slate-300" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      This section is a reference/lookup table, so no chart data is shown.
    </p>
  </div>
);
