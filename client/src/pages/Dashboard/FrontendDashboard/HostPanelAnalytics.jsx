import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarClock,
  Eye,
  LayoutGrid,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
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

const HostPanelAnalytics = () => {
  const axios = useAxiosPrivate();
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
                                {company.companyCity || company.companyCountry || company.companyId || "-"}
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
                          <button
                            type="button"
                            onClick={() => setSelectedCompany(company)}
                            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-700"
                          >
                            <Eye size={15} strokeWidth={2.5} />
                          </button>
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
                    {selectedCompany.companyId || "-"}
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

export default HostPanelAnalytics;
