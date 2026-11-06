import React, { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  MapPin,
  Search,
  Layers3,
  Globe2,
  Eye,
  ArrowLeft,
  Plus,
  Pencil,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  Database,
  Calculator,
  ListOrdered,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import WonoDestinationDetailModal from "./WonoDestinationDetailModal";
import WonoDestinationEditModal from "./WonoDestinationEditModal";
import {
  getDestinationContinentMeta,
  getDestinationPriorityClasses,
} from "./wonoDestinationAnalyticsTheme";

const priorityStyle = {
  P1: getDestinationPriorityClasses("P1"),
  P2: getDestinationPriorityClasses("P2"),
  P3: getDestinationPriorityClasses("P3"),
  P4: getDestinationPriorityClasses("P4"),
};

const clientOpportunityInputs = [
  {
    label: "Target Business Supply",
    weight: 60,
    description:
      "Potential businesses WoNo can onboard across its target categories.",
  },
  {
    label: "Tourism / Accommodation Base",
    weight: 25,
    description: "Strength of tourism, hospitality and accommodation activity.",
  },
  {
    label: "Market Scale",
    weight: 15,
    description:
      "Commercial reach indicated by the destination's urban population.",
  },
];

const modelWeights = [
  {
    label: "Client Opportunity",
    weight: 35,
    description: "Onboardable business supply and market potential.",
  },
  {
    label: "Nomad Demand & Community",
    weight: 20,
    description: "Existing nomad popularity and community demand.",
  },
  {
    label: "Remote Work Infrastructure",
    weight: 15,
    description: "Connectivity needed for practical remote work.",
  },
  {
    label: "Business & Jobs Ecosystem",
    weight: 10,
    description: "Economic, employer and professional-market strength.",
  },
  {
    label: "Flight Connectivity",
    weight: 7,
    description: "International and regional accessibility.",
  },
  {
    label: "Affordability",
    weight: 5,
    description: "Relative cost-of-living advantage.",
  },
  {
    label: "Visa Entry Accessibility",
    weight: 5,
    description: "Ease of entry for international passport holders.",
  },
  {
    label: "Safety / Healthcare",
    weight: 3,
    description: "Baseline safety and healthcare conditions.",
  },
];

const scoreAnchors = [
  [94, "Very strong"],
  [82, "Strong"],
  [68, "Good"],
  [55, "Moderate"],
  [40, "Limited"],
];

const priorityActions = {
  P1: "Start targeted onboarding first",
  P2: "Second-wave onboarding",
  P3: "Selective onboarding and validation",
  P4: "Monitor or test selectively",
};

const number = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const Stat = ({
  label,
  value,
  icon: Icon,
  accent = "text-[#2563EB]",
  border = "border-l-[#2563EB]",
  tour,
}) => (
  <div
    data-tour={tour}
    className={`bg-white rounded-[2rem] border border-slate-100 border-l-4 ${border} px-5 py-5 shadow-sm min-w-[150px]`}
  >
    <div
      className={`flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest ${accent}`}
    >
      <Icon size={13} /> {label}
    </div>
    <div className="mt-2 text-[17px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const StepHeading = ({
  number: stepNumber,
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
      <Icon size={16} />
    </span>
    <span>
      <span className="text-[10px] font-pmedium uppercase tracking-widest text-[#2563EB]">
        Step {stepNumber}
      </span>
      <span className="mt-0.5 block text-sm font-pmedium text-slate-900">
        {title}
      </span>
      <span className="mt-1 block text-[11px] font-pmedium leading-5 text-slate-500">
        {description}
      </span>
    </span>
  </div>
);

const ScoringModelGuide = ({ prioritySummary = [] }) => (
  <div className="space-y-4">
    <div className="px-1">
      <h2 className="text-sm font-pmedium text-slate-900">
        How the WoNo scoring model works
      </h2>
      <p className="mt-1 max-w-4xl text-xs font-pmedium leading-5 text-slate-500">
        The model compares different source measurements on one common scale,
        calculates a 0–100 WoNo score, then ranks every active destination from
        highest to lowest.
      </p>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <section data-tour="destination-ranking-scoring-step-1" className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
        <div className="flex-1 space-y-4">
          <StepHeading
            number="1"
            icon={Database}
            title="Convert source evidence into comparable scores"
            description="Business listings, visitor arrivals, population, internet speed and other source values use different units. Each is placed into a documented performance band first."
          />
          <div className="mt-4 grid grid-cols-5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
            {scoreAnchors.map(([score, label]) => (
              <div
                key={score}
                className="border-r border-slate-100 px-1.5 py-3 text-center last:border-r-0"
              >
                <p className="text-sm font-pmedium text-slate-900">{score}</p>
                <p className="mt-1 text-[9px] font-pmedium leading-3 text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-pmedium leading-5 text-slate-500">
          These are WoNo anchor scores, not percentages published by the
          external sources. Higher always means stronger for WoNo onboarding
          priority.
        </p>
      </section>

      <section data-tour="destination-ranking-scoring-step-2" className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
        <div className="flex-1 space-y-5">
          <StepHeading
            number="2"
            icon={Calculator}
            title="Build the Client Opportunity score"
            description="The most business-focused inputs are combined before they enter the final model."
          />
          <div className="space-y-3">
            {clientOpportunityInputs.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3 text-[10px] font-pmedium text-slate-700">
                  <span>{item.label}</span>
                  <span className="text-[#2563EB]">{item.weight}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${item.weight}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] font-pmedium leading-4 text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[10px] font-pmedium leading-5 text-blue-950">
          Client Opportunity = Target Business Supply × 60% + Tourism /
          Accommodation Base × 25% + Market Scale × 15%
        </div>
      </section>

      <section data-tour="destination-ranking-scoring-step-3" className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
        <div className="flex-1 space-y-5">
          <StepHeading
            number="3"
            icon={BarChart3}
            title="Apply the eight final-score weights"
            description="Each pillar score is multiplied by its WoNo weight. All eight weighted contributions add up to the final 0–100 score."
          />
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {modelWeights.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3 text-[10px] font-pmedium">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="text-[#2563EB]">{item.weight}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#2563EB]"
                    style={{ width: `${(item.weight / 35) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] font-pmedium leading-4 text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[10px] font-pmedium leading-5 text-blue-950">
          Final WoNo Score = Client Opportunity × 35% + Nomad Demand &amp;
          Community × 20% + Remote Work Infrastructure × 15% + Business &amp;
          Jobs Ecosystem × 10% + Flight Connectivity × 7% + Affordability × 5% +
          Visa Entry Accessibility × 5% + Safety / Healthcare × 3%
        </div>
      </section>

      <section data-tour="destination-ranking-scoring-step-4" className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:p-6">
        <div className="flex-1 space-y-5">
          <StepHeading
            number="4"
            icon={ListOrdered}
            title="Rank destinations and assign priority"
            description="Priority is based on the destination's position after all active destinations are sorted by final score. It is not a fixed score cutoff."
          />
          <div className="space-y-2">
            {prioritySummary.map((item) => (
              <div
                key={item.priority}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
              >
                <span
                  className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[item.priority]}`}
                >
                  {item.priority}
                </span>
                <span>
                  <span className="block text-[10px] font-pmedium text-slate-700">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-pmedium text-slate-400">
                    {priorityActions[item.priority]}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[10px] font-pmedium text-slate-900">
                    Ranks {item.rankRange}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-pmedium text-slate-400">
                    {item.count} destinations
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] font-pmedium leading-5 text-slate-500">
          A high score means stronger onboarding potential. The ranking shows
          relative priority across the complete destination list, not whether a
          city is universally “better.”
        </p>
      </section>
    </div>
  </div>
);

const WonoDestinationAnalytics = () => {
  const axios = useAxiosPrivate();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [continent, setContinent] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [editingDestination, setEditingDestination] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: [
      "wono-destination-analytics",
      debouncedSearch,
      priority,
      continent,
    ],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", {
        params: {
          search: debouncedSearch,
          priority,
          continent,
          limit: 250,
          includeInactive: true,
        },
      });
      return response.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: async (row) => {
      const response = await axios.patch(
        `/api/hosts/destination-analytics/${row._id}`,
        { isActive: !row.isActive },
      );
      return response.data;
    },
    onSuccess: (_data, row) => {
      toast.success(
        row.isActive ? "Destination deactivated" : "Destination activated",
      );
      queryClient.invalidateQueries({
        queryKey: ["wono-destination-analytics"],
      });
      queryClient.invalidateQueries({
        queryKey: ["wono-destination-analytics-dashboard"],
      });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
  });

  const summary = data?.summary;
  const rows = data?.items || [];
  const maxContinentCount = useMemo(
    () =>
      Math.max(
        ...(summary?.continentSummary || []).map((item) => item.count),
        1,
      ),
    [summary],
  );

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <section
            className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
          >
            <div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  data-tour="destination-ranking-header"
                  onClick={() =>
                    navigate("/dashboard/destination-data-analytics")
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-600 transition hover:border-blue-200 hover:text-[#2563EB]"
                >
                  <ArrowLeft size={13} />
                </button>
                <h1 className="text-title font-pmedium text-primary uppercase">
                  Full destination sequence & ranking
                </h1>
              </div>
              <p className="mt-1 text-xs font-pmedium text-slate-500">
                All 132 approved destinations, their WoNo score and every value
                used in the model.
              </p>
            </div>
            {/* <button
              type="button"
              onClick={() => setEditingDestination({})}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-[#2563EB] px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-white transition hover:bg-[#1d4ed8]"
            >
              <Plus size={13} /> Add destination
            </button> */}
            {/* <div className="flex items-center gap-2 text-[10px] font-pmedium text-slate-500">
              <span>Source snapshot: {summary?.sourceSnapshot || "—"}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 uppercase tracking-widest text-slate-600 transition-colors hover:border-blue-200 hover:text-[#2563EB]"
              >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} /> Refresh
              </button>
            </div> */}
          </section>

          {isPending ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-[1.75rem] bg-slate-100"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 font-pmedium text-red-700">
              Destination ranking analytics could not be loaded. Refresh and try
              again.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                  tour="destination-ranking-stat-total"
                  label="Total destinations"
                  value={summary?.destinations || 0}
                  icon={Layers3}
                />
                <Stat
                  tour="destination-ranking-stat-countries"
                  label="Countries"
                  value={summary?.countries || 0}
                  icon={MapPin}
                  accent="text-violet-600"
                  border="border-l-violet-500"
                />
                <Stat
                  tour="destination-ranking-stat-continents"
                  label="Continents"
                  value={summary?.continents || 0}
                  icon={Globe2}
                  accent="text-amber-600"
                  border="border-l-amber-500"
                />
                <Stat
                  tour="destination-ranking-stat-avg-score"
                  label="Average WoNo score"
                  value={number.format(summary?.averageScore || 0)}
                  icon={BarChart3}
                  accent="text-emerald-600"
                  border="border-l-emerald-500"
                />
              </div>

              <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
                <div
                  data-tour="destination-ranking-priority-bands"
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h2 className="text-sm font-pmedium text-slate-900">
                      Priority bands
                    </h2>
                    <p className="mt-1 text-xs font-pmedium text-slate-500">
                      Sequence bands are fixed by the approved ranking snapshot.
                    </p>
                  </div>
                  <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    {(summary?.prioritySummary || []).map((item) => (
                      <div
                        key={item.priority}
                        className="flex items-center justify-between gap-3 px-5 py-4"
                      >
                        <span>
                          <span
                            className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[item.priority]}`}
                          >
                            {item.priority}
                          </span>
                          <span className="ml-2 text-xs font-pmedium text-slate-700">
                            {item.label}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-base font-pmedium text-slate-900">
                            {item.count}
                          </span>
                          <span className="block text-[10px] font-pmedium text-slate-400">
                            avg {number.format(item.averageScore)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  data-tour="destination-ranking-continent-distribution"
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4"
                >
                  <h2 className="text-sm font-pmedium text-slate-900">
                    Continent distribution
                  </h2>
                  <div className="mt-4 space-y-3">
                    {(summary?.continentSummary || []).map((item) => {
                      const continentMeta = getDestinationContinentMeta(
                        item.continent,
                      );
                      return (
                        <div key={item.continent}>
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-pmedium text-slate-500">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: continentMeta.color }}
                              />
                              {item.continent}
                            </span>
                            <span>
                              {item.count} destinations ·{" "}
                              {number.format(item.averageScore)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: continentMeta.color,
                                width: `${(item.count / maxContinentCount) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <ScoringModelGuide prioritySummary={summary?.prioritySummary} />

              <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4 lg:flex-row lg:items-center">
                  <div data-tour="destination-ranking-search" className="relative flex-1">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search destination, country or continent"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                    />
                  </div>
                  <select
                    data-tour="destination-ranking-priority-filter"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB]"
                  >
                    <option value="">All priorities</option>
                    {(data?.filterOptions?.priorities || []).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.key} · {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    data-tour="destination-ranking-continent-filter"
                    value={continent}
                    onChange={(event) => setContinent(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB]"
                  >
                    <option value="">All continents</option>
                    {(data?.filterOptions?.continents || []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  data-tour="destination-ranking-table"
                  className="overflow-x-auto"
                >
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="border-b border-slate-100 bg-white text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                      <tr>
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Destination</th>
                        <th className="px-5 py-3">Country</th>
                        <th className="px-5 py-3">Continent</th>
                        <th className="px-5 py-3">Priority</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">WoNo score</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr
                          key={row._id || `${row.rank}-${row.destination}`}
                          className="transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-3.5 font-pmedium text-slate-500">
                            {row.rank ?? "—"}
                          </td>
                          <td
                            data-tour="destination-ranking-name-link"
                            className="px-5 py-3.5 font-pmedium"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(row.destination)}`,
                                )
                              }
                              className="text-[#2563EB] underline-offset-2 transition hover:underline"
                            >
                              {row.destination}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 font-pmedium text-slate-600">
                            {row.country}
                          </td>
                          <td className="px-5 py-3.5 font-pmedium text-slate-600">
                            {row.continent}
                          </td>
                          <td className="px-5 py-3.5">
                            {row.priority ? (
                              <span
                                className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-pmedium ${priorityStyle[row.priority]}`}
                              >
                                {row.priority} · {row.priorityLabel}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {row.isActive ? (
                              <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-pmedium text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span
                                className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-pmedium text-amber-700"
                                title={
                                  row.missingFactors?.length
                                    ? `Missing: ${row.missingFactors.join(", ")}`
                                    : ""
                                }
                              >
                                Pending
                                {row.missingFactors?.length
                                  ? ` · ${row.missingFactors.length} factor${row.missingFactors.length > 1 ? "s" : ""} missing`
                                  : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-pmedium text-slate-900">
                            {row.score != null ? number.format(row.score) : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {/* <button type="button" onClick={() => navigate(`/dashboard/destination-data-analytics/ranking/destination/${encodeURIComponent(row.destination)}`)} aria-label={`Open ${row.destination} dashboard`} title="Open destination dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"><LayoutDashboard size={12} /></button> */}
                              <button
                                data-tour="destination-ranking-action-view"
                                type="button"
                                onClick={() => setSelectedDestination(row)}
                                aria-label={`View ${row.destination}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                data-tour="destination-ranking-action-edit"
                                type="button"
                                onClick={() => setEditingDestination(row)}
                                aria-label={`Edit ${row.destination}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                data-tour="destination-ranking-action-toggle"
                                type="button"
                                onClick={() => toggleActive(row)}
                                aria-label={
                                  row.isActive
                                    ? `Deactivate ${row.destination}`
                                    : `Activate ${row.destination}`
                                }
                                title={row.isActive ? "Deactivate" : "Activate"}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition-colors ${row.isActive ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                              >
                                {row.isActive ? (
                                  <CheckCircle2 size={12} />
                                ) : (
                                  <XCircle size={12} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <WonoDestinationDetailModal
                destination={selectedDestination}
                onClose={() => setSelectedDestination(null)}
              />
              <WonoDestinationEditModal
                destination={editingDestination}
                onClose={() => setEditingDestination(null)}
              />
            </>
          )}
        </div>
      </PageFrame>
    </div>
  );
};

export default WonoDestinationAnalytics;
