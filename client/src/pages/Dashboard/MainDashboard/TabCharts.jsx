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
import { TAB_OVERVIEWS } from "./data/tabOverviews";
import { buildOverview } from "./data/aggregate";
import {
  BarDiagram,
  TrendLine,
  DistributionDonut,
  LoadingOverview,
  ErrorOverview,
  EmptyOverview,
  NoChartsNote,
  layoutChartRows,
} from "./charts/charts";
import DestinationAnalyticsCharts from "./charts/DestinationAnalyticsCharts";

// Tabs whose charts need a dedicated composition (extra legends or stacked
// series) on top of the shared ApexCharts renderers below.
const CUSTOM_TAB_RENDERERS = {
  "dashboard.destination-data-analytics": DestinationAnalyticsCharts,
};

const CARD_STYLES = [
  { border: "border-l-[#2563EB]", accent: "text-[#2563EB]" },
  { border: "border-l-violet-500", accent: "text-violet-600" },
  { border: "border-l-amber-500", accent: "text-amber-600" },
  { border: "border-l-emerald-500", accent: "text-emerald-600" },
  { border: "border-l-rose-500", accent: "text-rose-600" },
  { border: "border-l-cyan-500", accent: "text-cyan-600" },
  { border: "border-l-orange-500", accent: "text-orange-600" },
  { border: "border-l-slate-400", accent: "text-slate-600" },
];

const DEFAULT_ICONS = [Users, FileText, Clock, CheckCircle2, AlertCircle, TrendingUp, Layers, Star];

const StatCard = ({ label, value, icon, tone }) => {
  const Icon = icon || DEFAULT_ICONS[tone % DEFAULT_ICONS.length];
  const style = CARD_STYLES[tone % CARD_STYLES.length];
  const display = typeof value === "number" ? value.toLocaleString("en-US") : value;

  return (
    <div
      className={`min-w-0 rounded-[2rem] border border-slate-100 border-l-4 ${style.border} bg-white px-4 py-4 shadow-sm`}
    >
      <div className={`flex items-center gap-1.5 text-[9px] font-pmedium uppercase tracking-widest ${style.accent}`}>
        <Icon size={12} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-[16px] font-pmedium text-slate-900" title={String(display)}>
        {display}
      </div>
    </div>
  );
};

const renderChart = (chart) => {
  if (chart.type === "bars") return <BarDiagram bars={chart.dataset} title={chart.title} />;
  if (chart.type === "line") return <TrendLine data={chart.dataset} title={chart.title} />;
  return <DistributionDonut data={chart.dataset} title={chart.title} />;
};

const TabCharts = ({ tab }) => {
  const CompactRenderer = CUSTOM_TAB_RENDERERS[tab.key];
  const config = TAB_OVERVIEWS[tab.key];
  const axiosPrivate = useAxiosPrivate();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["module-dashboard-overview", tab.key],
    enabled: Boolean(config),
    queryFn: async () => {
      if (!config) return null;
      const entries = await Promise.all(
        config.sources.map(async (source) => {
          const http = source.auth === "public" ? axios : axiosPrivate;
          const res = await http.get(source.url, { params: source.params });
          return [source.key, source.pick ? source.pick(res) : res?.data];
        }),
      );
      return buildOverview(config, Object.fromEntries(entries));
    },
  });

  if (CompactRenderer) return <CompactRenderer />;
  if (!config) return <EmptyOverview title={tab.title} />;
  if (isPending) return <LoadingOverview />;
  if (isError) return <ErrorOverview onRetry={() => refetch()} />;

  const { cards = [], charts = [] } = data || {};
  const isEmpty =
    cards.length > 0 && charts.length === 0 && cards.every((card) => card.value === 0);

  if (isEmpty || !data) return <EmptyOverview title={tab.title} />;

  return (
    <div className="flex flex-col gap-3">
      {cards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

export default TabCharts;
