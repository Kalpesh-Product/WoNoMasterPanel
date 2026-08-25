import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  LayoutGrid,
  ListTodo,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import { ChartCard, BarDiagram, DistributionDonut } from "../MainDashboard/charts/charts";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

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

const healthLabel = {
  highly_active: "Highly active",
  active: "Active",
  low: "Low activity",
  dormant: "Dormant",
  none: "No activity",
};

const healthClass = {
  highly_active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  active: "bg-blue-50 text-blue-700 border-blue-100",
  low: "bg-amber-50 text-amber-700 border-amber-100",
  dormant: "bg-rose-50 text-rose-700 border-rose-100",
  none: "bg-slate-50 text-slate-600 border-slate-100",
};

const getCompanyLocation = (company) =>
  [company?.companyCity, company?.companyCountry]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "-";
const ProgressBar = ({ value, max, color = "bg-blue-500" }) => {
  const pct = max ? Math.min(100, Math.round((Number(value || 0) / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const ListMetric = ({ title, rows, color }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <h3 className="mb-4 text-[11px] font-pmedium uppercase tracking-widest text-slate-500">
      {title}
    </h3>
    <div className="space-y-3">
      {(rows || []).length ? (
        rows.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[12px] font-pmedium text-slate-700">
                {item.label || "-"}
              </p>
              <span className="text-[11px] font-pmedium text-slate-500">
                {formatNumber(item.value)}
              </span>
            </div>
            <ProgressBar value={item.value} max={rows[0]?.value || 0} color={color} />
          </div>
        ))
      ) : (
        <p className="py-6 text-center text-[12px] font-pmedium text-slate-400">
          No activity yet.
        </p>
      )}
    </div>
  </div>
);

const planChipClass = (availability) => {
  switch (availability) {
    case "All Plans":
      return "bg-green-50 text-green-700";
    case "Professional +":
      return "bg-blue-50 text-blue-700";
    case "Custom":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-50 text-slate-500";
  }
};

const monthlyToRows = (points) => (Array.isArray(points) ? points.map((p) => ({ label: p.label, value: p.count })) : []);

// Mirrors HostPanel's own DeepDiveCard (AnalyticsPage.tsx) for content —
// same stat cards, KPI chips, and tile layout — but rendered with Master
// Panel's own Dashboard building blocks (BarDiagram/DistributionDonut from
// MainDashboard/charts/charts.jsx, same StatCard look as TabCharts.jsx) so
// this reads as one system with the rest of Master Panel, not a bolt-on.
const ModuleDeepDiveCard = ({ entry }) => {
  const stats = entry.stats || {};
  const kpis = Array.isArray(stats.kpis) ? stats.kpis : [];
  const breakdown = Array.isArray(stats.breakdown) ? stats.breakdown : [];
  const secondary = Array.isArray(stats.secondaryBreakdown) ? stats.secondaryBreakdown : [];
  const deptBreakdown = Array.isArray(stats.deptBreakdown) ? stats.deptBreakdown : [];
  const monthly = monthlyToRows(stats.monthly);
  const peakDays = monthlyToRows(stats.insights?.byDay);
  const hasMonthly = monthly.some((point) => point.value > 0);
  const hasPeakDays = peakDays.some((point) => point.value > 0);
  const [titleA, titleB] = entry.breakdownTitles || ["Distribution", "Breakdown"];
  const completionValue =
    stats.completionRate === null || stats.completionRate === undefined
      ? `${entry.activityScore}/100`
      : `${stats.completionRate}%`;

  const summaryCards = [
    { label: "Total Records", value: formatNumber(stats.totalRecords), icon: Database, color: "#2563EB", accent: "border-l-blue-500" },
    { label: "Last 30 Days", value: formatNumber(stats.activeLast30Days), icon: Activity, color: "#80bf01", accent: "border-l-[#80bf01]" },
    { label: "Open Items", value: formatNumber(stats.openItems), icon: ListTodo, color: "#f59e0b", accent: "border-l-amber-500" },
    {
      label: stats.completionRate === null || stats.completionRate === undefined ? "Activity Score" : "Completion",
      value: completionValue,
      icon: BarChart3,
      color: "#7c3aed",
      accent: "border-l-violet-500",
    },
  ];

  const tiles = [];
  if (breakdown.length) tiles.push({ key: "primary", title: titleA, rows: breakdown, mode: "donut" });
  if (secondary.length) tiles.push({ key: "secondary", title: titleB, rows: secondary, mode: "donut" });
  if (deptBreakdown.length) tiles.push({ key: "dept", title: "Dept-wise", rows: deptBreakdown, mode: "donut" });
  if (hasMonthly) tiles.push({ key: "monthly", title: "Monthly Trend", rows: monthly, mode: "bar" });
  if (hasPeakDays) tiles.push({ key: "peak", title: "Peak Days (last 90d)", rows: peakDays, mode: "bar" });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 ${card.accent} shadow-sm flex justify-between items-center transition-all hover:shadow-md`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                <p className="text-[15px] font-pmedium text-slate-900 truncate">{card.value}</p>
              </div>
              <div className="p-2 rounded-2xl shrink-0" style={{ backgroundColor: `${card.color}18` }}>
                <Icon size={16} style={{ color: card.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {kpis.length ? (
        <div className="flex flex-wrap gap-2">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex items-baseline gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5">
              <span className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">{kpi.label}</span>
              <span className="text-[11px] font-pmedium text-slate-900">
                {typeof kpi.value === "number" ? formatNumber(kpi.value) : kpi.value}
                {kpi.suffix || ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {tiles.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tiles.map((tile) =>
            tile.mode === "donut" ? (
              <DistributionDonut key={`${entry.id}-${tile.key}`} data={tile.rows} title={tile.title} />
            ) : (
              <div key={`${entry.id}-${tile.key}`} className="md:col-span-2">
                <BarDiagram bars={tile.rows} title={tile.title} />
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
          <BarChart3 size={20} className="text-slate-300" />
          <p className="text-xs font-pmedium text-slate-500 text-center">No activity recorded yet.</p>
        </div>
      )}
    </div>
  );
};

// Real per-module analytics (tickets/assets/tasks/etc.) for this company —
// same engine and same charts as the company's own Host Panel Analytics
// page, computed straight from the shared collections rather than
// reconstructed from activity logs. Mirrors Host Panel's unit dropdown, plus
// an "All Units Combined" option this company view adds on top.
const HostPanelModuleAnalytics = ({ companyId }) => {
  const axios = useAxiosPrivate();
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [activeTabs, setActiveTabs] = useState({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["host-panel-module-analytics", companyId, selectedUnit],
    queryFn: async () => {
      const response = await axios.get(`/api/logs/host-panel-analytics/${encodeURIComponent(companyId)}/modules`, {
        params: { workspaceId: selectedUnit },
      });
      return response.data || {};
    },
    enabled: Boolean(companyId),
  });

  const units = Array.isArray(data?.units) ? data.units : [];
  const modules = Array.isArray(data?.modules) ? data.modules : [];

  const groups = useMemo(() => {
    const order = [];
    const byLabel = new Map();
    modules.forEach((entry) => {
      const key = entry.sectionLabel || "Other";
      if (!byLabel.has(key)) {
        byLabel.set(key, []);
        order.push(key);
      }
      byLabel.get(key).push(entry);
    });
    return order.map((label) => ({ key: label, label, modules: byLabel.get(label) }));
  }, [modules]);

  useEffect(() => {
    if (!groups.length) return;
    setExpandedGroups((current) => (current.size ? current : new Set([groups[0].key])));
    setActiveTabs((current) => {
      let changed = false;
      const next = { ...current };
      groups.forEach((group) => {
        if (!next[group.key] && group.modules[0]) {
          next[group.key] = group.modules[0].id;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [groups]);

  const toggleGroup = (key) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[13px] font-pmedium text-slate-900">Module Wise Analytics</h3>
          <p className="mt-1 text-[11px] font-pmedium text-slate-500">
            Real per-module data — same as this company sees in its own Host Panel Analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {units.length > 1 ? (
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <Building2 size={13} className="shrink-0 text-primary" />
              <select
                value={selectedUnit}
                onChange={(event) => setSelectedUnit(event.target.value)}
                className="max-w-[200px] cursor-pointer bg-transparent text-[10px] font-pmedium uppercase tracking-widest text-slate-600 outline-none"
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-[12px] font-pmedium text-slate-400">Loading module analytics...</div>
      ) : isError ? (
        <div className="p-5 text-[12px] font-pmedium text-rose-700">Failed to load module analytics.</div>
      ) : !groups.length ? (
        <div className="flex h-40 items-center justify-center text-[12px] font-pmedium text-slate-400">No workspaces found for this company.</div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {groups.map((group) => {
            const isOpen = expandedGroups.has(group.key);
            const tabs = group.modules;
            const activeModule = tabs.find((entry) => entry.id === activeTabs[group.key]) ?? tabs[0];

            return (
              <div key={group.key} className="rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    isOpen ? "bg-[#F7F8FA] border-b border-slate-100" : "bg-white hover:bg-slate-50/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-pmedium text-slate-900">{group.label}</span>
                    <span className="rounded-full bg-white text-slate-500 text-[10px] font-pmedium px-2 py-0.5 uppercase tracking-widest border border-slate-100">
                      {tabs.length} tabs
                    </span>
                  </span>
                  {isOpen ? (
                    <ChevronUp size={14} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen ? (
                  <div className="p-4 flex flex-col gap-4 bg-white">
                    <div className="flex gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm overflow-x-auto [&::-webkit-scrollbar]:hidden">
                      {tabs.map((entry) => {
                        const isTabActive = activeModule?.id === entry.id;
                        return (
                          <button
                            type="button"
                            key={entry.id}
                            onClick={() => setActiveTabs((current) => ({ ...current, [group.key]: entry.id }))}
                            className={`flex-1 shrink-0 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all text-center whitespace-nowrap ${
                              isTabActive ? "bg-[#2563EB] text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            {entry.label}
                          </button>
                        );
                      })}
                    </div>

                    {activeModule ? (
                      <div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5 mb-3">
                          <div>
                            <h3 className="text-[15px] font-pmedium text-slate-900 uppercase">{activeModule.label}</h3>
                            {activeModule.description ? (
                              <p className="text-xs font-pmedium text-slate-500 mt-1 normal-case">{activeModule.description}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {activeModule.enabled === false ? (
                              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-pmedium uppercase tracking-widest text-rose-600">
                                Not Enabled
                              </span>
                            ) : null}
                            {activeModule.planAvailability ? (
                              <span className={`rounded-full px-2.5 py-1 text-[9px] font-pmedium uppercase tracking-widest ${planChipClass(activeModule.planAvailability)}`}>
                                {activeModule.planAvailability}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ModuleDeepDiveCard entry={activeModule} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
const HostPanelAnalytics = () => {
  const { companyId } = useParams();

  if (companyId) return <HostPanelCompanyAnalytics companyId={companyId} />;

  return <HostPanelAnalyticsOverview />;
};

const HostPanelAnalyticsOverview = () => {
  const axios = useAxiosPrivate();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["host-panel-analytics"],
    queryFn: async () => {
      const response = await axios.get("/api/logs/host-panel-analytics");
      return response.data || {};
    },
  });

  const stats = data?.stats || {};
  const companies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = Array.isArray(data?.companies) ? data.companies : [];
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.companyName,
        row.companyId,
        row.companyCity,
        row.companyCountry,
        row.industry,
        row.plan,
        row.subscriptionStatus,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [data?.companies, search]);

  const trendMax = Math.max(...(data?.trend || []).map((item) => item.value || 0), 0);

  if (isLoading) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">
                Host Panel Analytics
              </h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                Track company usage, activity, users, and workspaces.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 h-3 w-24 rounded-full bg-slate-200" />
                  <div className="h-6 w-12 rounded-lg bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="h-[480px] animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">
                Host Panel Analytics
              </h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                Track company usage, activity, users, and workspaces.
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TrendingUp size={14} />
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {isError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-[12px] font-pmedium text-rose-700">
              Failed to load host panel analytics.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Companies",
                value: stats.totalCompanies,
                helper: `${formatNumber(stats.registeredCompanies)} registered`,
                icon: Building2,
                accent: "border-l-blue-500",
                iconClass: "bg-blue-50 text-blue-600",
              },
              {
                label: "Active Companies",
                value: stats.activeCompanies,
                helper: `${formatNumber(stats.dormantCompanies)} dormant`,
                icon: ShieldCheck,
                accent: "border-l-emerald-500",
                iconClass: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "Last 30 Days",
                value: stats.activitiesLast30Days,
                helper: `${formatNumber(stats.activitiesThisMonth)} this month`,
                icon: Activity,
                accent: "border-l-amber-500",
                iconClass: "bg-amber-50 text-amber-600",
              },
              {
                label: "Users / Workspaces",
                value: `${formatNumber(stats.totalUsers)} / ${formatNumber(stats.totalWorkspaces)}`,
                helper: `${formatNumber(stats.activeUsers)} active users`,
                icon: Users,
                accent: "border-l-slate-400",
                iconClass: "bg-slate-50 text-slate-600",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`flex items-center justify-between rounded-[2rem] border border-l-4 border-slate-100 bg-white p-5 shadow-sm ${card.accent}`}
                >
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      {card.label}
                    </p>
                    <p className="truncate text-[15px] font-pmedium text-slate-900">
                      {typeof card.value === "string" ? card.value : formatNumber(card.value)}
                    </p>
                    <p className="mt-1 text-[10px] font-pmedium text-slate-400">
                      {card.helper}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-2 ${card.iconClass}`}>
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm xl:col-span-1">
              <h3 className="mb-4 text-[11px] font-pmedium uppercase tracking-widest text-slate-500">
                Six Month Activity
              </h3>
              <div className="flex h-48 items-end gap-3">
                {(data?.trend || []).map((item) => (
                  <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end rounded-t-lg bg-slate-50 px-1">
                      <div
                        className="w-full rounded-t-lg bg-blue-500"
                        style={{
                          height: `${trendMax ? Math.max(8, (item.value / trendMax) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-pmedium text-slate-500">{item.label}</p>
                      <p className="text-[11px] font-pmedium text-slate-900">
                        {formatNumber(item.value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ListMetric title="Top Companies" rows={data?.topCompanies || []} color="bg-emerald-500" />
            <ListMetric title="Top Modules" rows={data?.modules || []} color="bg-amber-500" />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[13px] font-pmedium text-slate-900">Company Activity</h3>
                <p className="mt-1 text-[11px] font-pmedium text-slate-500">
                  Sorted by recent activity from host panel logs.
                </p>
              </div>
              <div className="relative w-full md:max-w-sm">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={15}
                />
                <input
                  type="text"
                  placeholder="Search company, plan, city..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-slate-200/70 bg-white py-2.5 pl-9 pr-4 text-[12px] font-pmedium text-[#0F172A] outline-none transition-all placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Company</th>
                    <th className="px-5 py-4">Plan</th>
                    <th className="px-5 py-4">Last 30 Days</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Users</th>
                    <th className="px-5 py-4">Workspaces</th>
                    <th className="px-5 py-4">Health</th>
                    <th className="px-5 py-4">Last Activity</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.length ? (
                    companies.map((company) => (
                      <tr key={company.companyId || company.companyName} className="transition-colors hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-500">
                              {company.logoUrl ? (
                                <img
                                  src={company.logoUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Building2 size={16} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-pmedium text-slate-900">
                                {company.companyName || "-"}
                              </p>
                              <p className="truncate text-[11px] font-pmedium text-slate-500">
                                {getCompanyLocation(company)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                          {company.plan || "-"}
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-900">
                          {formatNumber(company.activitiesLast30Days)}
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                          {formatNumber(company.totalActivities)}
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                          {formatNumber(company.activeUsers)} / {formatNumber(company.totalUsers)}
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                          {formatNumber(company.workspacesUsed)} / {formatNumber(company.totalWorkspaces)}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium ${healthClass[company.health] || healthClass.none}`}>
                            {healthLabel[company.health] || "Unknown"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                          {formatDate(company.lastActivityAt)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCompany(company)}
                              className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"
                              title="View company"
                            >
                              <Eye size={15} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(String(company.companyId || ""), { state: { companyName: company.companyName } })}
                              disabled={!company.companyId}
                              className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-emerald-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              title="View analytics"
                            >
                              <BarChart3 size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-[12px] font-pmedium text-slate-400">
                        No companies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </PageFrame>

      {selectedCompany ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 p-3 backdrop-blur-sm"
          onClick={() => setSelectedCompany(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-blue-50/30 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-sm">
                  <LayoutGrid size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-pmedium tracking-tight text-slate-800">
                    {selectedCompany.companyName || "Company Analytics"}
                  </h2>
                  <p className="mt-0.5 text-[11px] font-pmedium text-slate-500">
                    {getCompanyLocation(selectedCompany)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-5 overflow-y-auto bg-white p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Total activities", formatNumber(selectedCompany.totalActivities)],
                  ["Last 30 days", formatNumber(selectedCompany.activitiesLast30Days)],
                  ["This month", formatNumber(selectedCompany.activitiesThisMonth)],
                  ["Success rate", selectedCompany.successRate === null ? "-" : `${selectedCompany.successRate}%`],
                  ["Users", `${formatNumber(selectedCompany.activeUsers)} active / ${formatNumber(selectedCompany.totalUsers)} total`],
                  ["Workspaces", `${formatNumber(selectedCompany.workspacesUsed)} used / ${formatNumber(selectedCompany.totalWorkspaces)} total`],
                  ["Performance score", `${formatNumber(selectedCompany.performanceScore)} / 100`],
                  ["Onboarded", formatDate(selectedCompany.onboardedAt)],
                  ["First activity", formatDate(selectedCompany.firstActivityAt)],
                  ["Last activity", formatDate(selectedCompany.lastActivityAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      {label}
                    </p>
                    <p className="text-[12px] font-pmedium text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-pmedium text-slate-700">
                  <CalendarClock size={15} />
                  Company status
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1.5 text-[11px] font-pmedium ${healthClass[selectedCompany.health] || healthClass.none}`}>
                    {healthLabel[selectedCompany.health] || "Unknown"}
                  </span>
                  <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-pmedium text-slate-600">
                    {selectedCompany.isRegistered ? "Registered" : "Not registered"}
                  </span>
                  <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-pmedium text-slate-600">
                    {selectedCompany.paymentStatus ? "Payment active" : "Payment inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const HostPanelCompanyAnalytics = ({ companyId }) => {
  const axios = useAxiosPrivate();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["host-panel-company-analytics", companyId],
    queryFn: async () => {
      const response = await axios.get(`/api/logs/host-panel-analytics/${encodeURIComponent(companyId)}`);
      return response.data || {};
    },
    enabled: Boolean(companyId),
  });

  const company = data?.company || {};
  const metrics = data?.metrics || {};
  const companyName = company.companyName || "Company";
  const trendMax = Math.max(...(data?.trend || []).map((item) => item.value || 0), 0);

  const cards = [
    {
      label: "Total Activities",
      value: formatNumber(metrics.totalActivities),
      helper: `${formatNumber(metrics.activitiesThisMonth)} this month`,
      icon: Activity,
      accent: "border-l-blue-500",
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      label: "Last 30 Days",
      value: formatNumber(metrics.activitiesLast30Days),
      helper: `${formatNumber(metrics.activitiesPrev30Days)} previous period`,
      icon: TrendingUp,
      accent: "border-l-emerald-500",
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Active Users",
      value: formatNumber(metrics.activeUsers),
      helper: metrics.successRate === null || metrics.successRate === undefined ? "Success rate unavailable" : `${metrics.successRate}% success rate`,
      icon: Users,
      accent: "border-l-amber-500",
      iconClass: "bg-amber-50 text-amber-600",
    },
    {
      label: "Workspaces Used",
      value: formatNumber(metrics.workspacesUsed),
      helper: metrics.avgResponseTimeMs ? `${formatNumber(metrics.avgResponseTimeMs)}ms avg response` : "Response time unavailable",
      icon: Building2,
      accent: "border-l-slate-400",
      iconClass: "bg-slate-50 text-slate-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm" />
              ))}
            </div>
            <div className="h-[480px] animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">
                {companyName} Analytics
              </h2>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                {getCompanyLocation(company)}{company.plan ? ` | ${company.plan}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-pmedium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TrendingUp size={14} />
                {isFetching ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {isError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-[12px] font-pmedium text-rose-700">
              Failed to load company analytics.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`flex items-center justify-between rounded-[2rem] border border-l-4 border-slate-100 bg-white p-5 shadow-sm ${card.accent}`}>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{card.label}</p>
                    <p className="truncate text-[15px] font-pmedium text-slate-900">{card.value}</p>
                    <p className="mt-1 text-[10px] font-pmedium text-slate-400">{card.helper}</p>
                  </div>
                  <div className={`rounded-2xl p-2 ${card.iconClass}`}>
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm xl:col-span-1">
              <h3 className="mb-4 text-[11px] font-pmedium uppercase tracking-widest text-slate-500">Six Month Activity</h3>
              <div className="flex h-48 items-end gap-3">
                {(data?.trend || []).map((item) => (
                  <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end rounded-t-lg bg-slate-50 px-1">
                      <div className="w-full rounded-t-lg bg-blue-500" style={{ height: `${trendMax ? Math.max(8, (item.value / trendMax) * 100) : 0}%` }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-pmedium text-slate-500">{item.label}</p>
                      <p className="text-[11px] font-pmedium text-slate-900">{formatNumber(item.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ListMetric title="Top Modules" rows={data?.modules || []} color="bg-emerald-500" />
            <ListMetric title="Top Users" rows={data?.topUsers || []} color="bg-amber-500" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ListMetric title="Top Actions" rows={data?.actions || []} color="bg-blue-500" />
            <ListMetric title="Workspace Activity" rows={data?.workspaces || []} color="bg-violet-500" />
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-[11px] font-pmedium uppercase tracking-widest text-slate-500">Company Status</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-pmedium ${healthClass[metrics.health] || healthClass.none}`}>
                  {healthLabel[metrics.health] || "Unknown"}
                </span>
                <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-pmedium text-slate-600">
                  {company.subscriptionStatus || "Subscription status unavailable"}
                </span>
                <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-pmedium text-slate-600">
                  {company.paymentStatus ? "Payment active" : "Payment inactive"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">First Activity</p>
                  <p className="mt-1 text-[12px] font-pmedium text-slate-900">{formatDate(metrics.firstActivityAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Last Activity</p>
                  <p className="mt-1 text-[12px] font-pmedium text-slate-900">{formatDate(metrics.lastActivityAt)}</p>
                </div>
              </div>
            </div>
          </div>

          <HostPanelModuleAnalytics companyId={companyId} />
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 p-4">
              <h3 className="text-[13px] font-pmedium text-slate-900">Recent Activity</h3>
              <p className="mt-1 text-[11px] font-pmedium text-slate-500">Latest actions performed inside this company's Host Panel.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Action</th>
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">User</th>
                    <th className="px-5 py-4">Workspace</th>
                    <th className="px-5 py-4">Method</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.recentLogs || []).length ? data.recentLogs.map((log, index) => (
                    <tr key={`${log.createdAt || "log"}-${index}`} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 text-[12px] font-pmedium text-slate-900">{log.action || "-"}</td>
                      <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{log.module || "-"}</td>
                      <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{log.fullName || log.email || "-"}</td>
                      <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{log.workspaceName || "-"}</td>
                      <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{log.method || "-"}</td>
                      <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-pmedium ${log.success === false ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{log.success === false ? "Failed" : "Success"}</span></td>
                      <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{formatDate(log.createdAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="px-5 py-16 text-center text-[12px] font-pmedium text-slate-400">No recent activity found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/50 p-4">
                <h3 className="text-[13px] font-pmedium text-slate-900">Users</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {(data?.hostUsers || []).length ? data.hostUsers.map((user) => (
                  <div key={user._id || user.email} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-pmedium text-slate-900">{user.name || user.email || "-"}</p>
                      <p className="truncate text-[11px] font-pmedium text-slate-500">{user.email || "-"}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-pmedium text-slate-600">{user.isActive ? "Active" : user.inviteStatus || "Inactive"}</span>
                  </div>
                )) : <p className="p-8 text-center text-[12px] font-pmedium text-slate-400">No users found.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/50 p-4">
                <h3 className="text-[13px] font-pmedium text-slate-900">Workspaces</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {(data?.workspacesList || []).length ? data.workspacesList.map((workspace) => (
                  <div key={workspace._id || workspace.workspaceId} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-pmedium text-slate-900">{workspace.workspaceName || workspace.businessName || "-"}</p>
                      <p className="truncate text-[11px] font-pmedium text-slate-500">{workspace.selectedPlan || "-"} | {formatNumber(workspace.enabledModulesCount)} modules</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-pmedium ${workspace.isActive ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-600"}`}>{workspace.isActive ? "Active" : "Inactive"}</span>
                  </div>
                )) : <p className="p-8 text-center text-[12px] font-pmedium text-slate-400">No workspaces found.</p>}
              </div>
            </div>
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default HostPanelAnalytics;








