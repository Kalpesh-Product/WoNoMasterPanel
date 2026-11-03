import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactApexChart from "react-apexcharts";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, Eye, Layers3, Pencil, Search, Star } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import WonoListingDetailModal from "./WonoListingDetailModal";
import WonoListingEditModal from "./WonoListingEditModal";

const number = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const priorityColors = {  "High Opportunity": "#059669", "Medium Opportunity": "#D97706", "Lower Opportunity": "#94A3B8" };
const categoryColors = { Coworking: "#2563EB", Coliving: "#7C3AED", Cafe: "#D97706", Hostel: "#0D9488", "Meeting Room": "#DB2777" };
const categoryStyles = {
  Coworking: { surface: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  Coliving: { surface: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  Cafe: { surface: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  Hostel: { surface: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
  "Meeting Room": { surface: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
};
const STATUS_OPTIONS = ["New", "Contacted", "Follow-up", "Qualified", "Proposal", "Won", "Lost"];
const BUSINESS_STATUS_OPTIONS = ["Active", "Permanently Closed", "Temporarily Closed"];
const NEXT_ACTION_OPTIONS = ["PENDING", "ONBOARD"];
const PLAN_OPTIONS = ["Basic", "Proffesional", "Custom", "Select"];
const fieldLabel = { status: "Status", businessStatus: "Business status", nextAction: "Next action", plan: "Plan" };
const statusStyle = {
  New: "border-blue-200 bg-blue-50 text-blue-700",
  Contacted: "border-violet-200 bg-violet-50 text-violet-700",
  "Follow-up": "border-amber-200 bg-amber-50 text-amber-700",
  Qualified: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Proposal: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Lost: "border-rose-200 bg-rose-50 text-rose-700",
};
const businessStatusStyle = {
  Active: "bg-emerald-50 text-emerald-700",
  "Permanently Closed": "bg-rose-50 text-rose-700",
  "Temporarily Closed": "bg-amber-50 text-amber-700",
};
const nextActionStyle = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  ONBOARD: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const planStyle = {
  Select: "border-slate-200 bg-slate-50 text-slate-500",
  Basic: "border-blue-200 bg-blue-50 text-blue-700",
  Proffesional: "border-violet-200 bg-violet-50 text-violet-700",
  Custom: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
};

const Stat = ({ label, value, icon: Icon, accent = "text-[#2563EB]", border = "border-l-[#2563EB]" }) => (
  <div className={`min-w-0 bg-white rounded-[2rem] border border-slate-100 border-l-4 ${border} px-5 py-5 shadow-sm`}>
    <div className={`flex items-center gap-2 whitespace-nowrap text-[9px] font-pmedium uppercase tracking-wider ${accent}`}>
      <Icon size={13} /> {label}
    </div>
    <div className="mt-2 text-[17px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const Panel = ({ title, description, children, clip = true }) => (
  <section className={`${clip ? "overflow-hidden" : ""} rounded-2xl border border-slate-100 bg-white shadow-sm`}>
    <div className="border-b border-slate-100 px-5 py-4">
      <h2 className="text-sm font-pmedium text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs font-pmedium text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

const WonoDestinationExecutiveDashboard = () => {
  const { destination } = useParams();
  const navigate = useNavigate();
  const axios = useAxiosPrivate();
  const [selectedLead, setSelectedLead] = React.useState(null);
  const [editingLead, setEditingLead] = React.useState(null);
  const [priorityFilter, setPriorityFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [businessStatusFilter, setBusinessStatusFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [fieldOverrides, setFieldOverrides] = React.useState({});
  const [activeCategory, setActiveCategory] = React.useState(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["wono-destination-listings-summary", destination],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-listings/summary", { params: { destination } });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const clearFieldOverride = (id, field) => {
    setFieldOverrides((current) => {
      const next = { ...current };
      const row = { ...(next[id] || {}) };
      delete row[field];
      if (Object.keys(row).length) next[id] = row;
      else delete next[id];
      return next;
    });
  };

  const { mutate: updateField, isPending: isUpdatingField, variables: updatingField } = useMutation({
    mutationFn: async ({ id, field, value }) => {
      const response = await axios.patch(`/api/hosts/destination-listings/${id}`, { [field]: value });
      return response.data;
    },
    onSuccess: (_response, variables) => {
      queryClient.setQueryData(["wono-destination-listings-summary", destination], (current) => current ? ({
        ...current,
        priorityLeads: (current.priorityLeads || current.topLeads || []).map((lead) => lead._id === variables.id ? { ...lead, [variables.field]: variables.value } : lead),
        topLeads: (current.topLeads || []).map((lead) => lead._id === variables.id ? { ...lead, [variables.field]: variables.value } : lead),
      }) : current);
      clearFieldOverride(variables.id, variables.field);
      toast.success(`${fieldLabel[variables.field]} updated`);
      queryClient.invalidateQueries({ queryKey: ["wono-destination-listings"] });
      queryClient.invalidateQueries({ queryKey: ["wono-destination-listings-summary"] });
    },
    onError: (error, variables) => {
      clearFieldOverride(variables.id, variables.field);
      toast.error(error?.response?.data?.message || `Failed to update ${fieldLabel[variables.field].toLowerCase()}`);
    },
  });

  const visibleLeads = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.priorityLeads || data?.topLeads || []).filter((lead) => {
      const priority = lead.scoring?.priority || "";
      const status = fieldOverrides[lead._id]?.status || lead.status || "New";
      const businessStatus = fieldOverrides[lead._id]?.businessStatus || lead.businessStatus || "Active";
      const matchesPriority = priorityFilter === "All" || priority === priorityFilter;
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      const matchesBusinessStatus = businessStatusFilter === "All" || businessStatus === businessStatusFilter;
      const matchesSearch = !query || [lead.businessName, lead.category, lead.email, lead.contact, lead.owner]
        .some((value) => String(value || "").toLowerCase().includes(query));
      return matchesPriority && matchesStatus && matchesBusinessStatus && matchesSearch;
    });
  }, [businessStatusFilter, data, fieldOverrides, priorityFilter, search, statusFilter]);

  const handleFieldChange = (lead, field, value) => {
    setFieldOverrides((current) => ({
      ...current,
      [lead._id]: { ...(current[lead._id] || {}), [field]: value },
    }));
    updateField({ id: lead._id, field, value });
  };

  const priorityChart = React.useMemo(() => ({
    series: (data?.priorityMix || []).map((item) => item.count),
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "donut", toolbar: { show: false } },
      labels: (data?.priorityMix || []).map((item) => item.priority),
      colors: (data?.priorityMix || []).map((item) => priorityColors[item.priority]),
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" }, dropShadow: { enabled: false } },
      stroke: { width: 0 },
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" },
      plotOptions: {
        pie: {
          donut: {
            size: "67%",
            labels: {
              show: true,
              name: { fontSize: "12px" },
              value: { fontSize: "14px", fontFamily: "Poppins-SemiBold, sans-serif" },
              total: { show: true, label: "Businesses", fontSize: "11px", formatter: () => String(data?.totalBusinesses || 0) },
            },
          },
        },
      },
      tooltip: { y: { formatter: (value) => `${value} businesses` } },
    },
  }), [data]);

  const categoryPriorityChart = React.useMemo(() => ({
    series: Object.keys(priorityColors).map((priority) => ({
      name: priority,
      data: (data?.categories || []).map((item) => item.priorityCounts?.[priority] || 0),
    })),
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", stacked: true, stackType: "100%", toolbar: { show: false } },
      colors: Object.values(priorityColors),
      plotOptions: { bar: { borderRadius: 3, horizontal: true, barHeight: "60%", dataLabels: { position: "center" } } },
      dataLabels: {
        enabled: true,
        style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px", colors: ["#fff"] },
        formatter: (_value, opts) => {
          const count = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex];
          return count > 0 ? count : "";
        },
      },
      xaxis: {
        categories: (data?.categories || []).map((item) => `${item.category} · ${((item.count / (data?.totalBusinesses || 1)) * 100).toFixed(1)}%`),
        max: 100,
        labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" }, formatter: (value) => `${value}%` },
      },
      yaxis: { labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "8px" },
      tooltip: { y: { formatter: (value) => `${value} businesses` } },
    },
  }), [data]);

  const categoryChart = React.useMemo(() => ({
    series: [{ name: "Average opportunity score", data: (data?.categories || []).map((item) => item.averageScore) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: (data?.categories || []).map((item) => categoryColors[item.category]),
      plotOptions: { bar: { borderRadius: 5, distributed: true, columnWidth: "46%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] }, formatter: (value) => number.format(value) },
      xaxis: { categories: (data?.categories || []).map((item) => item.category), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" }, rotate: -20 } },
      yaxis: { min: 0, max: 100, title: { text: "Opportunity score", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", color: "#64748B" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
    },
  }), [data]);

  const digitalPresenceChart = React.useMemo(() => ({
    series: [
      { name: "Present", data: (data?.digitalPresence || []).map((item) => item.present) },
      { name: "Missing", data: (data?.digitalPresence || []).map((item) => item.missing) },
    ],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: ["#2563EB", "#F59E0B"],
      plotOptions: { bar: { borderRadius: 4, columnWidth: "55%", dataLabels: { position: "center" } } },
      dataLabels: { enabled: true, style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px", colors: ["#fff"] } },
      xaxis: { categories: (data?.digitalPresence || []).map((item) => item.channel), labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" } } },
      yaxis: { title: { text: "Businesses", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", color: "#64748B" } }, labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" } } },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "8px" },
    },
  }), [data]);

  const activeCategoryData = (data?.categories || []).find((item) => item.category === activeCategory);
  const activeCategoryLeads = React.useMemo(() => (
    (data?.priorityLeads || data?.topLeads || [])
      .filter((lead) => lead.category === activeCategory)
      .slice(0, 5)
  ), [activeCategory, data]);

  const categoryTopFiveChart = React.useMemo(() => ({
    series: [{ name: "Opportunity score", data: activeCategoryLeads.map((lead) => Number(lead.scoring?.finalScore || 0)) }],
    options: {
      chart: { fontFamily: "Poppins-SemiBold, sans-serif", type: "bar", toolbar: { show: false } },
      colors: [categoryColors[activeCategory] || "#2563EB"],
      plotOptions: { bar: { borderRadius: 6, columnWidth: "55%", dataLabels: { position: "center" } } },
      dataLabels: {
        enabled: true,
        formatter: (value) => number.format(value),
        style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", colors: ["#fff"] },
      },
      xaxis: {
        categories: activeCategoryLeads.map((lead) => lead.businessName),
        labels: {
          style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" },
          rotate: -20,
          trim: true,
          formatter: (value) => (value?.length > 18 ? `${value.slice(0, 18)}…` : value),
        },
      },
      yaxis: {
        min: 0,
        max: 100,
        title: { text: "Opportunity Score", style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px", fontWeight: 500, color: "#64748B" } },
        labels: { style: { fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "10px" } },
      },
      grid: { borderColor: "#E2E8F0", strokeDashArray: 3 },
      legend: { show: false },
      tooltip: { y: { formatter: (value) => `${number.format(value)} opportunity score` } },
    },
  }), [activeCategory, activeCategoryLeads]);

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-pregular text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <section>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate("/dashboard/destination-data-analytics/ranking")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-600 transition hover:border-blue-200 hover:text-[#2563EB]"><ArrowLeft size={13} /> Ranking</button>
              <h1 className="text-title font-pmedium text-primary uppercase">{destination} — Executive Opportunity Dashboard</h1>
            </div>
            <p className="mt-1 text-xs font-pmedium text-slate-500">City-wide business opportunity scoring across WoNo's 5 target categories.</p>
          </section>

          {isPending ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-[1.75rem] bg-slate-100" />)}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 font-pmedium text-red-700">Could not load this destination's analytics.</div>
          ) : !data?.exists ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-6 text-center font-pmedium text-amber-800">
              Business listing analysis is not yet available for {destination}. The data team hasn't completed this destination's survey yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
                <Stat label="Total businesses" value={data.totalBusinesses} icon={Layers3} />
                <Stat label="No website" value={data.digitalPresence?.find((item) => item.channel === "Website")?.missing || 0} icon={Briefcase} accent="text-rose-600" border="border-l-rose-500" />
                <Stat label="2+ digital gaps" value={(data.digitalGapsBuckets || []).filter((item) => item.gaps >= 2).reduce((sum, item) => sum + item.count, 0)} icon={Star} accent="text-violet-600" border="border-l-violet-500" />
                <Stat label="High opportunity" value={data.priorityMix.find((p) => p.priority === "High Opportunity")?.count || 0} icon={Star} accent="text-emerald-600" border="border-l-emerald-500" />
                <Stat label="Medium opportunity" value={data.priorityMix.find((p) => p.priority === "Medium Opportunity")?.count || 0} icon={Star} accent="text-amber-600" border="border-l-amber-500" />
                <Stat label="Lower opportunity" value={data.priorityMix.find((p) => p.priority === "Lower Opportunity")?.count || 0} icon={Star} accent="text-slate-500" border="border-l-slate-400" />
              </div>

              <section className="grid gap-4 md:grid-cols-2">
                <Panel title="Overall Priority Mix" description="Opportunity band across every business.">
                  <ReactApexChart className="chart-tooltip-overflow-visible" options={priorityChart.options} series={priorityChart.series} type="donut" height={250} />
                </Panel>
                <Panel title="Opportunity By Category" description="Average score per business category.">
                  <div className="px-2 pt-2"><ReactApexChart className="chart-tooltip-overflow-visible" options={categoryChart.options} series={categoryChart.series} type="bar" height={250} /></div>
                </Panel>
                <div className="md:col-span-2">
                  <Panel title="Priority By Category" description="High, medium and lower opportunity across all five categories." clip={false}>
                    <div className="chart-tooltip-overflow-visible px-3 pt-2"><ReactApexChart className="chart-tooltip-overflow-visible" options={categoryPriorityChart.options} series={categoryPriorityChart.series} type="bar" height={320} /></div>
                  </Panel>
                </div>
                <div className="md:col-span-2">
                  <Panel title="Digital Presence" description="Website, Instagram and Facebook availability across the destination.">
                    <div className="px-3 pt-2"><ReactApexChart className="chart-tooltip-overflow-visible" options={digitalPresenceChart.options} series={digitalPresenceChart.series} type="bar" height={260} /></div>
                  </Panel>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {data.categories.map((item) => {
                  const style = categoryStyles[item.category] || categoryStyles.Coworking;
                  const isActive = activeCategory === item.category;
                  return (
                    <div
                      key={item.category}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveCategory((current) => current === item.category ? null : item.category)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setActiveCategory((current) => current === item.category ? null : item.category);
                      }}
                      className={`cursor-pointer rounded-2xl border ${style.border} ${style.surface} p-4 text-left transition hover:-translate-y-0.5 ${isActive ? "ring-2 ring-offset-2" : ""}`}
                      style={isActive ? { "--tw-ring-color": categoryColors[item.category] } : undefined}
                    >
                      <div className={`flex items-center justify-between text-[10px] font-pmedium uppercase tracking-widest ${style.text}`}>
                        <span>{item.category}</span>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColors[item.category] }} />
                      </div>
                      <p className="mt-2 text-lg font-pmedium text-slate-900">{item.count} businesses</p>
                      <p className="mt-1 text-[10px] font-pmedium text-slate-600">avg {number.format(item.averageScore)} · {item.highOpportunityCount} high opportunity</p>
                      <div className="mt-2 flex items-center">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(destination)}/${encodeURIComponent(item.category)}`);
                          }}
                          className="flex items-center gap-1 text-[10px] font-pmedium uppercase tracking-widest text-[#2563EB] hover:underline"
                        >
                          Open category <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>

              {activeCategoryData ? (
                <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-blue-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-pmedium text-slate-900">Top 5 {activeCategoryData.category} Priority Leads</h2>
                      <p className="mt-1 text-[11px] text-slate-500">Highest opportunity scores in this category.</p>
                    </div>
                    <button type="button" onClick={() => navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(destination)}/${encodeURIComponent(activeCategoryData.category)}`)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-white transition hover:bg-blue-700">
                      Open category <ArrowRight size={12} />
                    </button>
                  </div>
                  <div className="px-3 py-3">
                    <ReactApexChart className="chart-tooltip-overflow-visible" options={categoryTopFiveChart.options} series={categoryTopFiveChart.series} type="bar" height={300} />
                  </div>
                </section>
              ) : null}

              <Panel title="All Priority Leads" description="Every surveyed business, ranked by opportunity score across all categories.">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search business, category or owner..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[11px] font-pmedium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value)}
                        className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 text-[11px] font-pmedium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 ${priorityFilter === "All" ? "border-slate-200 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                      >
                        <option value="All">All priorities</option>
                        {Object.keys(priorityColors).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 text-[11px] font-pmedium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 ${statusFilter === "All" ? "border-slate-200 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                      >
                        <option value="All">All lead statuses</option>
                        {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <select
                        value={businessStatusFilter}
                        onChange={(event) => setBusinessStatusFilter(event.target.value)}
                        className={`cursor-pointer rounded-lg border bg-white px-3 py-2.5 text-[11px] font-pmedium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 ${businessStatusFilter === "All" ? "border-slate-200 text-slate-600" : "border-[#2563EB]/40 text-[#2563EB]"}`}
                      >
                        <option value="All">All business statuses</option>
                        {BUSINESS_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[2150px] text-left">
                    <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3">Business</th>
                        <th className="whitespace-nowrap px-4 py-3">Category</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Score</th>
                        <th className="whitespace-nowrap px-4 py-3">Priority</th>
                        <th className="whitespace-nowrap px-4 py-3">Contact</th>
                        <th className="whitespace-nowrap px-4 py-3">Email</th>
                        <th className="w-[180px] px-4 py-3">Website</th>
                        <th className="w-[180px] px-4 py-3">LinkedIn</th>
                        <th className="whitespace-nowrap px-4 py-3">Status</th>
                        <th className="whitespace-nowrap px-4 py-3">Business Status</th>
                        <th className="whitespace-nowrap px-4 py-3">Next Action</th>
                        <th className="whitespace-nowrap px-4 py-3">Plan</th>
                        <th className="whitespace-nowrap px-4 py-3">Owner</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="sticky right-0 z-20 whitespace-nowrap border-l border-slate-200 bg-slate-50 px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {visibleLeads.map((lead) => {
                        const leadStatus = fieldOverrides[lead._id]?.status || lead.status || "New";
                        const leadBusinessStatus = fieldOverrides[lead._id]?.businessStatus || lead.businessStatus || "Active";
                        const leadNextAction = fieldOverrides[lead._id]?.nextAction || String(lead.nextAction || "PENDING").trim();
                        const leadPlan = fieldOverrides[lead._id]?.plan || lead.plan || "Select";
                        const isSavingField = (field) => isUpdatingField && updatingField?.id === lead._id && updatingField?.field === field;
                        return (
                        <tr key={lead._id} className="group transition-colors hover:bg-blue-50/30">
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-900">{lead.businessName}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{lead.category}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-right text-slate-900">{number.format(lead.scoring?.finalScore)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><span className="inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium" style={{ color: priorityColors[lead.scoring?.priority], borderColor: priorityColors[lead.scoring?.priority] }}>{lead.scoring?.priority}</span></td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{lead.contact || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{lead.email || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-3.5 font-pmedium text-slate-600" title={lead.website}>{lead.website || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-3.5 font-pmedium text-slate-600" title={lead.linkedin}>{lead.linkedin || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select value={leadStatus} disabled={isSavingField("status")} onChange={(event) => handleFieldChange(lead, "status", event.target.value)} aria-label={`Update status for ${lead.businessName}`} className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${statusStyle[leadStatus] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select value={leadBusinessStatus} disabled={isSavingField("businessStatus")} onChange={(event) => handleFieldChange(lead, "businessStatus", event.target.value)} aria-label={`Update business status for ${lead.businessName}`} className={`cursor-pointer rounded-full border border-transparent px-2.5 py-1 text-[10px] font-pmedium outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${businessStatusStyle[leadBusinessStatus] || "bg-slate-100 text-slate-600"}`}>
                              {BUSINESS_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select value={leadNextAction} disabled={isSavingField("nextAction")} onChange={(event) => handleFieldChange(lead, "nextAction", event.target.value)} aria-label={`Update next action for ${lead.businessName}`} className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${nextActionStyle[leadNextAction] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {NEXT_ACTION_OPTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select value={leadPlan} disabled={isSavingField("plan")} onChange={(event) => handleFieldChange(lead, "plan", event.target.value)} aria-label={`Update plan for ${lead.businessName}`} className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${planStyle[leadPlan] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{lead.owner || "—"}</td>
                          <td className="px-4 py-3.5 font-pmedium text-slate-600">{lead.notes || "—"}</td>
                          <td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-200 bg-white px-4 py-3.5 text-right group-hover:bg-blue-50/30">
                            <div className="inline-flex items-center gap-1.5">
                              <button type="button" onClick={() => setSelectedLead(lead)} className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-[#2563EB]"><Eye size={14} /></button>
                              <button type="button" onClick={() => setEditingLead(lead)} className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-[#2563EB]"><Pencil size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  {visibleLeads.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]"><Search size={20} /></div>
                      <p className="font-pmedium text-slate-700">No matching priority leads</p>
                      <p className="mt-1 text-[11px] text-slate-400">Try another priority, status, or search term.</p>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </>
          )}
        </div>
      </PageFrame>
      <WonoListingDetailModal listing={selectedLead} onClose={() => setSelectedLead(null)} onEdit={(lead) => { setSelectedLead(null); setEditingLead(lead); }} />
      <WonoListingEditModal listing={editingLead} onClose={() => setEditingLead(null)} />
    </div>
  );
};

export default WonoDestinationExecutiveDashboard;
