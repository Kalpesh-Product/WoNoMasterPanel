import React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactApexChart from "react-apexcharts";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Eye, Globe, Layers3, Pencil, Search, Star } from "lucide-react";
import { toast } from "sonner";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import WonoListingDetailModal from "./WonoListingDetailModal";
import WonoListingEditModal from "./WonoListingEditModal";

const number = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const priorityColors = { "High Opportunity": "#059669", "Medium Opportunity": "#D97706", "Lower Opportunity": "#94A3B8" };
const priorityStyle = {
  "High Opportunity": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Medium Opportunity": "bg-amber-50 text-amber-700 border-amber-200",
  "Lower Opportunity": "bg-slate-100 text-slate-600 border-slate-200",
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

const Panel = ({ title, description, children }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-4">
      <h2 className="text-sm font-pmedium text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs font-pmedium text-slate-500">{description}</p>}
    </div>
    {children}
  </section>
);

const WonoDestinationCategoryDashboard = () => {
  const { destination, category } = useParams();
  const navigate = useNavigate();
  const axios = useAxiosPrivate();
  const [selectedListing, setSelectedListing] = React.useState(null);
  const [editingListing, setEditingListing] = React.useState(null);
  const [priorityFilter, setPriorityFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [businessStatusFilter, setBusinessStatusFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [fieldOverrides, setFieldOverrides] = React.useState({});

  const { data, isPending, isError } = useQuery({
    queryKey: ["wono-destination-listings", destination, category],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-listings", { params: { destination, category } });
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
      queryClient.setQueryData(["wono-destination-listings", destination, category], (current) => current ? ({
        ...current,
        items: (current.items || []).map((item) => item._id === variables.id ? { ...item, [variables.field]: variables.value } : item),
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

  const visibleItems = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items || []).filter((item) => {
      const status = fieldOverrides[item._id]?.status || item.status || "New";
      const businessStatus = fieldOverrides[item._id]?.businessStatus || item.businessStatus || "Active";
      const priority = item.scoring?.priority || "";
      const matchesPriority = priorityFilter === "All" || priority === priorityFilter;
      const matchesStatus = statusFilter === "All" || status === statusFilter;
      const matchesBusinessStatus = businessStatusFilter === "All" || businessStatus === businessStatusFilter;
      const matchesSearch = !query || [item.businessName, item.email, item.contact, item.owner]
        .some((value) => String(value || "").toLowerCase().includes(query));
      return matchesPriority && matchesStatus && matchesBusinessStatus && matchesSearch;
    });
  }, [businessStatusFilter, data, fieldOverrides, priorityFilter, search, statusFilter]);

  const handleFieldChange = (item, field, value) => {
    setFieldOverrides((current) => ({
      ...current,
      [item._id]: { ...(current[item._id] || {}), [field]: value },
    }));
    updateField({ id: item._id, field, value });
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
              total: { show: true, label: "Businesses", fontSize: "11px", formatter: () => String(data?.total || 0) },
            },
          },
        },
      },
      tooltip: { y: { formatter: (value) => `${value} businesses` } },
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
      legend: { position: "bottom", fontFamily: "Poppins-SemiBold, sans-serif", fontSize: "9px" },
    },
  }), [data]);

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-pregular text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <section>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(destination)}`)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-600 transition hover:border-blue-200 hover:text-[#2563EB]"><ArrowLeft size={13} /> {destination}</button>
              <h1 className="text-title font-pmedium text-primary uppercase">{category} Dashboard</h1>
            </div>
            <p className="mt-1 text-xs font-pmedium text-slate-500">Every surveyed {category} business in {destination}, ranked by WoNo opportunity score.</p>
          </section>

          {isPending ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-[1.75rem] bg-slate-100" />)}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 font-pmedium text-red-700">Could not load this category's listings.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
                <Stat label="Total companies" value={data.total} icon={Layers3} />
                <Stat label="No website" value={data.stats?.noWebsite || 0} icon={Briefcase} accent="text-rose-600" border="border-l-rose-500" />
                <Stat label="2+ digital gaps" value={data.stats?.twoPlusDigitalGaps || 0} icon={Star} accent="text-violet-600" border="border-l-violet-500" />
                <Stat label="High opportunity" value={data.priorityMix.find((p) => p.priority === "High Opportunity")?.count || 0} icon={Globe} accent="text-emerald-600" border="border-l-emerald-500" />
                <Stat label="Medium opportunity" value={data.priorityMix.find((p) => p.priority === "Medium Opportunity")?.count || 0} icon={Globe} accent="text-amber-600" border="border-l-amber-500" />
                <Stat label="Lower opportunity" value={data.priorityMix.find((p) => p.priority === "Lower Opportunity")?.count || 0} icon={Globe} accent="text-slate-500" border="border-l-slate-400" />
              </div>

              <section className="grid gap-4 md:grid-cols-2">
                <Panel title={`${category} Lead Priority Mix`} description="Opportunity band across this category's businesses.">
                  <ReactApexChart className="chart-tooltip-overflow-visible" options={priorityChart.options} series={priorityChart.series} type="donut" height={250} />
                </Panel>
                <Panel title="Digital Presence Gaps" description="Website, Instagram and Facebook availability in this category.">
                  <div className="px-3 pt-2"><ReactApexChart className="chart-tooltip-overflow-visible" options={digitalPresenceChart.options} series={digitalPresenceChart.series} type="bar" height={250} /></div>
                </Panel>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-pmedium text-slate-900">Lead Priority Results — {category}</h2>
                  <p className="mt-1 text-xs font-pmedium text-slate-500">Sorted by opportunity score, highest first.</p>
                </div>
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search business, contact or owner..."
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
                        {Object.keys(priorityStyle).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
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
                    <thead className="sticky top-0 z-30 border-b border-slate-100 bg-slate-50 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3">Rank</th>
                        <th className="whitespace-nowrap px-4 py-3">Business Name</th>
                        <th className="whitespace-nowrap px-4 py-3">Category</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Opportunity Score</th>
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
                        <th className="sticky right-0 z-20 whitespace-nowrap border-l border-slate-200 bg-slate-50 px-4 py-3 text-right will-change-transform">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {visibleItems.map((item) => {
                        const rank = data.items.findIndex((row) => row._id === item._id) + 1;
                        const itemStatus = fieldOverrides[item._id]?.status || item.status || "New";
                        const itemBusinessStatus = fieldOverrides[item._id]?.businessStatus || item.businessStatus || "Active";
                        const itemNextAction = fieldOverrides[item._id]?.nextAction || String(item.nextAction || "PENDING").trim();
                        const itemPlan = fieldOverrides[item._id]?.plan || item.plan || "Select";
                        const isSavingField = (field) => isUpdatingField && updatingField?.id === item._id && updatingField?.field === field;
                        return (
                        <tr key={item._id} className="group transition-colors hover:bg-blue-50/30">
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-400">{String(rank).padStart(2, "0")}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-900">{item.businessName}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{item.category}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-right text-slate-900">{number.format(item.scoring?.finalScore)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[item.scoring?.priority]}`}>{item.scoring?.priority}</span></td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{item.contact || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{item.email || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-3.5 font-pmedium text-slate-600" title={item.website}>{item.website || "—"}</td>
                          <td className="max-w-[180px] truncate px-4 py-3.5 font-pmedium text-slate-600" title={item.linkedin}>{item.linkedin || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select
                              value={itemStatus}
                              disabled={isSavingField("status")}
                              onChange={(event) => handleFieldChange(item, "status", event.target.value)}
                              aria-label={`Update status for ${item.businessName}`}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${statusStyle[itemStatus] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                            >
                              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select
                              value={itemBusinessStatus}
                              disabled={isSavingField("businessStatus")}
                              onChange={(event) => handleFieldChange(item, "businessStatus", event.target.value)}
                              aria-label={`Update business status for ${item.businessName}`}
                              className={`cursor-pointer rounded-full border border-transparent px-2.5 py-1 text-[10px] font-pmedium outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${businessStatusStyle[itemBusinessStatus] || "bg-slate-100 text-slate-600"}`}
                            >
                              {BUSINESS_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select
                              value={itemNextAction}
                              disabled={isSavingField("nextAction")}
                              onChange={(event) => handleFieldChange(item, "nextAction", event.target.value)}
                              aria-label={`Update next action for ${item.businessName}`}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${nextActionStyle[itemNextAction] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                            >
                              {NEXT_ACTION_OPTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <select
                              value={itemPlan}
                              disabled={isSavingField("plan")}
                              onChange={(event) => handleFieldChange(item, "plan", event.target.value)}
                              aria-label={`Update plan for ${item.businessName}`}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-pmedium outline-none transition focus:ring-2 focus:ring-[#2563EB]/20 disabled:cursor-wait disabled:opacity-60 ${planStyle[itemPlan] || "border-slate-200 bg-slate-50 text-slate-600"}`}
                            >
                              {PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                            </select>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-pmedium text-slate-600">{item.owner || "—"}</td>
                          <td className="px-4 py-3.5 font-pmedium text-slate-600">{item.notes || "—"}</td>
                          <td className="sticky right-0 z-10 whitespace-nowrap border-l border-slate-200 bg-white px-4 py-3.5 text-right will-change-transform group-hover:bg-blue-50/30">
                            <div className="inline-flex items-center gap-1.5">
                              <button type="button" onClick={() => setSelectedListing(item)} aria-label={`View ${item.businessName}`} title="View listing" className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-[#2563EB]"><Eye size={14} /></button>
                              <button type="button" onClick={() => setEditingListing(item)} aria-label={`Edit ${item.businessName}`} title="Edit listing" className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-amber-100 hover:text-amber-700"><Pencil size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                  {visibleItems.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]"><Search size={20} /></div>
                      <p className="font-pmedium text-slate-700">No matching listings</p>
                      <p className="mt-1 text-[11px] text-slate-400">Try another status, business state, or search term.</p>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>
      </PageFrame>
      <WonoListingDetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} onEdit={(listing) => { setSelectedListing(null); setEditingListing(listing); }} />
      <WonoListingEditModal listing={editingListing} onClose={() => setEditingListing(null)} />
    </div>
  );
};

export default WonoDestinationCategoryDashboard;
