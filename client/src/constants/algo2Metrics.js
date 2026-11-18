// Algo 2.0 presentation constants. The formulas live in
// src/utils/weightCalculationsV2.js — these labels are display-only.

export const ALGO2_BASE_METRICS = [
  { field: "costOfLiving", label: "Cost Of Living", shortLabel: "Cost" },
  { field: "internet", label: "Internet", shortLabel: "Internet" },
  { field: "safety", label: "Safety", shortLabel: "Safety" },
  { field: "nomadCommunity", label: "Nomad Community", shortLabel: "Nomad" },
  {
    field: "workInfrastructure",
    label: "Work Infrastructure",
    shortLabel: "Work Infra",
  },
  {
    field: "airQualityIndex",
    label: "Air Quality Index",
    shortLabel: "Clean Air",
  },
  {
    field: "startupEcosystem",
    label: "Startup Ecosystem",
    shortLabel: "Startup",
  },
  {
    field: "healthcareCostIndex",
    label: "Healthcare Cost Index",
    shortLabel: "Healthcare Cost",
  },
  {
    field: "purchasingPower",
    label: "Purchasing Power",
    shortLabel: "Purchasing",
  },
  {
    field: "inflationStability",
    label: "Inflation Stability",
    shortLabel: "Stability",
  },
  {
    field: "meetupsEvents",
    label: "Meetups & Events",
    shortLabel: "Meetups",
  },
  {
    field: "incubators",
    label: "Startup Incubators & Accelerators",
    shortLabel: "Incubators",
  },
  {
    field: "climateEnvironment",
    label: "Climate & Environment",
    shortLabel: "Climate",
  },
  { field: "lowerTaxes", label: "Lower Taxes", shortLabel: "Taxes" },
  {
    field: "natureNomadTravelling",
    label: "Nature Nomad Travelling",
    shortLabel: "Nature",
  },
  { field: "yoga", label: "Yoga", shortLabel: "Yoga" },
  {
    field: "ventureCapitalPresence",
    label: "Venture Capital Presence",
    shortLabel: "VC Presence",
  },
  {
    field: "ventureCapitalInvestments",
    label: "Venture Capital Investments",
    shortLabel: "VC Investment",
  },
  { field: "visaOpenness", label: "Visa Openness", shortLabel: "Visa" },
  {
    field: "healthcareQuality",
    label: "Healthcare Quality",
    shortLabel: "Healthcare",
  },
  {
    field: "flightConnectivity",
    label: "Flight Connectivity",
    shortLabel: "Flights",
  },
  { field: "remoteJobs", label: "Remote Jobs", shortLabel: "Remote Jobs" },
  {
    field: "techTalentDensity",
    label: "Tech Talent Density",
    shortLabel: "Tech Talent",
  },
  {
    field: "conferencesEvents",
    label: "Conferences & Events",
    shortLabel: "Conferences",
  },
];

export const FACTOR_SHORT_LABELS = Object.fromEntries(
  ALGO2_BASE_METRICS.map((metric) => [metric.field, metric.shortLabel]),
);

export const tierPillClass = (label = "", tierLabels = []) => {
  const index = tierLabels.indexOf(label);
  if (index === 0) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (index === 1) return "bg-blue-50 text-blue-700 border border-blue-200";
  if (index === 2) return "bg-violet-50 text-violet-700 border border-violet-200";
  if (index === 3) return "bg-amber-50 text-amber-700 border border-amber-200";
  if (index === 4) return "bg-rose-50 text-rose-700 border border-rose-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
};
