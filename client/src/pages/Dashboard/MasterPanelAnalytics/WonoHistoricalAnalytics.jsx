import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import {
  BarDiagram,
  TrendLine,
  DistributionDonut,
  layoutChartRows,
} from "../MainDashboard/charts/charts";

const renderChart = (chart) => {
  if (chart.type === "bars") return <BarDiagram bars={chart.dataset} title={chart.title} />;
  if (chart.type === "line") return <TrendLine data={chart.dataset} title={chart.title} />;
  return <DistributionDonut data={chart.dataset} title={chart.title} />;
};

// range comes from the page-level RangeTabs control (MasterPanelAnalytics)
// so this widget stays in lockstep with every other section on the page.
const WonoHistoricalAnalytics = ({ range }) => {
  const axiosPrivate = useAxiosPrivate();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["wonoHistoricalAnalytics", range],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/site-analytics/wono/historical", {
        params: { from: range, to: "today" },
      });
      return response.data;
    },
  });

  const charts = data
    ? [
        { type: "bars", title: "Top Pages (Unique Visitors)", dataset: data.topPages },
        { type: "pie", title: "Unique Visitors by Country", dataset: data.byCountry },
        { type: "bars", title: "Unique Visitors by State", dataset: data.byState },
        { type: "bars", title: "Unique Visitors by City", dataset: data.byCity },
        { type: "line", title: "Traffic by Hour of Day", dataset: data.byHour },
        { type: "bars", title: "Traffic by Day of Week", dataset: data.byDayOfWeek },
      ].filter((chart) => Array.isArray(chart.dataset) && chart.dataset.length > 0)
    : [];

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
              Top pages, where visitors come from, and when traffic peaks.
            </span>
          </span>
        </span>
      </div>

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
                className={`h-full ${entry.span === 2 ? "md:col-span-2" : ""}`}
              >
                {renderChart(entry.chart)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default WonoHistoricalAnalytics;
