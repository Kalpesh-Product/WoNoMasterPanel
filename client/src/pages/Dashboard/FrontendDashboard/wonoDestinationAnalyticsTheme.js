export const destinationPriorityMeta = {
  immediate: {
    color: "#DC2626",
    surface: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  high: {
    color: "#059669",
    surface: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  medium: {
    color: "#D97706",
    surface: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  lower: {
    color: "#94A3B8",
    surface: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-600",
  },
};

const priorityBandMap = {
  P1: "immediate",
  "Immediate Priority": "immediate",
  "Immediate Opportunity": "immediate",
  P2: "high",
  "High Priority": "high",
  "High Opportunity": "high",
  P3: "medium",
  "Medium Priority": "medium",
  "Medium Opportunity": "medium",
  P4: "lower",
  "Low Priority": "lower",
  "Lower Opportunity": "lower",
};

export const getDestinationPriorityMeta = (priority) => (
  destinationPriorityMeta[priorityBandMap[priority]] || destinationPriorityMeta.lower
);

export const getDestinationPriorityClasses = (priority) => {
  const meta = getDestinationPriorityMeta(priority);
  return `${meta.surface} ${meta.text} ${meta.border}`;
};

export const destinationContinentMeta = {
  Africa: {
    color: "#EA580C",
    surface: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
  },
  Asia: {
    color: "#CA8A04",
    surface: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  Europe: {
    color: "#16A34A",
    surface: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
  },
  "North America": {
    color: "#0E7490",
    surface: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
  },
  Oceania: {
    color: "#2563EB",
    surface: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  "South America": {
    color: "#7C3AED",
    surface: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
  },
};

const fallbackContinentMeta = {
  color: "#64748B",
  surface: "bg-slate-100",
  border: "border-slate-200",
  text: "text-slate-600",
};

export const getDestinationContinentMeta = (continent) => (
  destinationContinentMeta[continent] || fallbackContinentMeta
);
