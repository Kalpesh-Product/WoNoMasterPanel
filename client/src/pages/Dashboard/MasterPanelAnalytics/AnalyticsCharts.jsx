// Same renderer as the module-wise Dashboard's TabCharts, but feeds from
// ANALYTICS_OVERVIEWS so every tab shows its extended set of info graphs —
// compact charts pair two per row, heavy ones take a full line (see
// layoutChartRows). OverviewContent is exported so other pages can render
// any overview config inline.
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Users,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  Star,
} from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { ANALYTICS_OVERVIEWS } from "./data/analyticsOverviews";
import { buildOverview } from "../MainDashboard/data/aggregate";
import {
  BarDiagram,
  TrendLine,
  DistributionDonut,
  LoadingOverview,
  ErrorOverview,
  EmptyOverview,
  NoChartsNote,
  layoutChartRows,
} from "../MainDashboard/charts/charts";

const CARD_STYLES = [
  { border: "border-l-slate-400", chip: "bg-slate-50 text-slate-600" },
  { border: "border-l-blue-500", chip: "bg-blue-50 text-blue-600" },
  { border: "border-l-amber-500", chip: "bg-amber-50 text-amber-600" },
  { border: "border-l-emerald-500", chip: "bg-emerald-50 text-emerald-600" },
  { border: "border-l-red-500", chip: "bg-red-50 text-red-600" },
  { border: "border-l-violet-500", chip: "bg-violet-50 text-violet-600" },
  { border: "border-l-cyan-500", chip: "bg-cyan-50 text-cyan-600" },
  { border: "border-l-orange-500", chip: "bg-orange-50 text-orange-600" },
];

const DEFAULT_ICONS = [Users, FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Layers, Star];

const StatCard = ({ label, value, icon, tone }) => {
  const Icon = icon || DEFAULT_ICONS[tone % DEFAULT_ICONS.length];
  const style = CARD_STYLES[tone % CARD_STYLES.length];
  return (
    <div
      className={`bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 ${style.border} shadow-sm flex justify-between items-center transition-all hover:shadow-md`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-[15px] font-pmedium text-slate-900">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
      </div>
      <div className={`p-2 rounded-2xl ${style.chip} shrink-0`}>
        <Icon size={16} />
      </div>
    </div>
  );
};

const renderChart = (chart) => {
  if (chart.type === "bars") return <BarDiagram bars={chart.dataset} title={chart.title} />;
  if (chart.type === "line") return <TrendLine data={chart.dataset} title={chart.title} />;
  return <DistributionDonut data={chart.dataset} title={chart.title} />;
};

// Renders one overview config: fetches every source, then stat cards +
// charts. A failing source degrades to empty instead of blanking the whole
// section.
export const OverviewContent = ({ config, storageKey, title }) => {
  const axiosPrivate = useAxiosPrivate();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["module-analytics-overview", storageKey],
    enabled: Boolean(config),
    queryFn: async () => {
      if (!config) return null;
      const entries = await Promise.all(
        config.sources.map(async (source) => {
          try {
            const http = source.auth === "public" ? axios : axiosPrivate;
            const res = await http.get(source.url, { params: source.params });
            return [source.key, source.pick ? source.pick(res) : res?.data];
          } catch {
            return [source.key, null];
          }
        }),
      );
      return buildOverview(config, Object.fromEntries(entries));
    },
  });

  if (!config) return <EmptyOverview title={title || storageKey} />;
  if (isPending) return <LoadingOverview />;
  if (isError) return <ErrorOverview onRetry={() => refetch()} />;

  const { cards = [], charts = [] } = data || {};
  const isEmpty =
    cards.length > 0 && charts.length === 0 && cards.every((card) => card.value === 0);

  if (isEmpty || !data) return <EmptyOverview title={title || storageKey} />;

  return (
    <div className="flex flex-col gap-3">
      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}
      {charts.length > 0 ? (
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
      ) : (
        <NoChartsNote />
      )}
    </div>
  );
};

const AnalyticsCharts = ({ tab }) => {
  const config = ANALYTICS_OVERVIEWS[tab.key];

  if (!config) return <EmptyOverview title={tab.title} />;

  return <OverviewContent config={config} storageKey={tab.key} title={tab.title} />;
};

export default AnalyticsCharts;
