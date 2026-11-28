import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Lightbulb,
  Save,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

const TARGET_STORAGE_KEY = "wono-analytics-monthly-targets-v1";
const TARGET_METRICS = [
  { key: "activeUsers", label: "Active Users" },
  { key: "sessions", label: "Sessions" },
  { key: "screenPageViews", label: "Page Views" },
  { key: "newUsers", label: "New Users" },
];

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));

const roundTarget = (value) => {
  const amount = Math.max(0, Number(value) || 0);
  if (amount === 0) return 0;
  const step = amount < 100 ? 10 : amount < 1000 ? 50 : 500;
  return Math.ceil(amount / step) * step;
};

const getSuggestedTargets = (current) => {
  const today = new Date();
  const elapsedDays = Math.max(today.getDate(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return Object.fromEntries(
    TARGET_METRICS.map((metric) => {
      const value = Number(current?.[metric.key]) || 0;
      const projected = (value / elapsedDays) * daysInMonth;
      return [metric.key, roundTarget(projected * 1.1)];
    }),
  );
};

const readStoredTargets = () => {
  try {
    const stored = window.localStorage.getItem(TARGET_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const MonthlyTargets = ({ summary }) => {
  const [targets, setTargets] = useState(readStoredTargets);
  const [draftTargets, setDraftTargets] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const currentSummary = summary?.current;

  useEffect(() => {
    if (!targets && currentSummary) {
      setTargets(getSuggestedTargets(currentSummary));
    }
  }, [currentSummary, targets]);

  const monthProgress = useMemo(() => {
    const today = new Date();
    const elapsedDays = Math.max(today.getDate(), 1);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return { elapsedDays, daysInMonth, remainingDays: Math.max(daysInMonth - elapsedDays, 0) };
  }, []);

  if (!currentSummary || !targets) return null;

  const startEditing = () => {
    setDraftTargets({ ...targets });
    setIsEditing(true);
  };

  const saveTargets = () => {
    const normalized = Object.fromEntries(
      TARGET_METRICS.map((metric) => [metric.key, Math.max(0, Number(draftTargets?.[metric.key]) || 0)]),
    );
    setTargets(normalized);
    setIsEditing(false);
    try {
      window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // The dashboard still works when browser storage is unavailable.
    }
  };

  return (
    <section data-wono-pdf-section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 md:flex-row md:items-center">
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-xl bg-[#2563EB] p-2 text-white shadow-sm shadow-blue-200">
            <Target size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-pmedium uppercase tracking-wide text-slate-900">
              Monthly Traffic Targets
            </span>
            <span className="mt-0.5 block text-xs font-pmedium text-slate-500">
              Initial suggestions are 10% above projected pace; edit and save the approved targets.
            </span>
          </span>
        </span>
        <div data-html2canvas-ignore="true" className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500"
              >
                <X size={12} /> Cancel
              </button>
              <button
                type="button"
                onClick={saveTargets}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-white shadow-sm shadow-blue-200"
              >
                <Save size={12} /> Save Targets
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Edit3 size={12} /> Edit Targets
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
        {TARGET_METRICS.map((metric) => {
          const current = Number(currentSummary[metric.key]) || 0;
          const target = Number(isEditing ? draftTargets?.[metric.key] : targets[metric.key]) || 0;
          const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
          const projected = (current / monthProgress.elapsedDays) * monthProgress.daysInMonth;
          const requiredDaily =
            monthProgress.remainingDays > 0
              ? Math.max(target - current, 0) / monthProgress.remainingDays
              : 0;
          const achieved = target > 0 && current >= target;

          return (
            <div key={metric.key} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xl font-pmedium tracking-tight text-slate-900">
                    {formatNumber(current)}
                  </p>
                </div>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={draftTargets?.[metric.key] ?? ""}
                    onChange={(event) =>
                      setDraftTargets((previous) => ({
                        ...previous,
                        [metric.key]: event.target.value,
                      }))
                    }
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-xs font-pmedium text-slate-800 outline-none focus:border-blue-400"
                    aria-label={`${metric.label} monthly target`}
                  />
                ) : (
                  <span className={`rounded-full px-2 py-1 text-[9px] font-pmedium ${achieved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                    {target > 0 ? `${progress.toFixed(0)}%` : "Set target"}
                  </span>
                )}
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${achieved ? "bg-emerald-500" : "bg-[#2563EB]"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-pmedium text-slate-400">
                <span>Target {formatNumber(target)}</span>
                <span>Projected {formatNumber(projected)}</span>
              </div>
              <p className="mt-1 text-[10px] font-pmedium text-slate-500">
                {achieved
                  ? "Target achieved"
                  : target > 0
                    ? `${formatNumber(requiredDaily)} per day required`
                    : "Enter a target to track progress"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const buildObservations = (data) => {
  const current = data?.summary?.current || {};
  const previous = data?.summary?.previous || {};
  const observations = [];
  const sessionChange = previous.sessions
    ? ((Number(current.sessions || 0) - Number(previous.sessions)) / Number(previous.sessions)) * 100
    : null;

  if (sessionChange !== null) {
    observations.push({
      icon: sessionChange >= 0 ? TrendingUp : TrendingDown,
      tone: sessionChange >= 0 ? "positive" : "warning",
      title: `Sessions ${sessionChange >= 0 ? "increased" : "decreased"} ${Math.abs(sessionChange).toFixed(1)}%`,
      detail: "Compared with the immediately preceding equivalent period.",
    });
  }

  const engagementRate = (Number(current.engagementRate) || 0) * 100;
  observations.push({
    icon: engagementRate >= 60 ? CheckCircle2 : engagementRate < 40 ? AlertTriangle : Lightbulb,
    tone: engagementRate >= 60 ? "positive" : engagementRate < 40 ? "warning" : "neutral",
    title: `${engagementRate.toFixed(1)}% engagement rate`,
    detail:
      engagementRate >= 60
        ? "Most sessions met GA4's engaged-session criteria."
        : engagementRate < 40
          ? "A large share of sessions did not meet GA4's engaged-session criteria."
          : "Engagement is moderate for the selected period.",
  });

  const topChannel = data?.byChannel?.[0];
  if (topChannel && Number(current.sessions) > 0) {
    const share = (Number(topChannel.value || 0) / Number(current.sessions)) * 100;
    observations.push({
      icon: TrendingUp,
      tone: "neutral",
      title: `${topChannel.label} is the leading acquisition channel`,
      detail: `${formatNumber(topChannel.value)} sessions, representing ${share.toFixed(1)}% of all sessions.`,
    });
  }

  const topDevice = data?.byDevice?.[0];
  const deviceAttributions = (data?.byDevice || []).reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  );
  if (topDevice && deviceAttributions > 0) {
    const share = (Number(topDevice.value || 0) / deviceAttributions) * 100;
    observations.push({
      icon: Lightbulb,
      tone: "neutral",
      title: `${topDevice.label} is the primary device`,
      detail: `${share.toFixed(1)}% of active users were attributed to this device category.`,
    });
  }

  const peakDay = [...(data?.byDayOfWeek || [])].sort((a, b) => b.value - a.value)[0];
  const peakHour = [...(data?.byHour || [])].sort((a, b) => b.value - a.value)[0];
  if (peakDay && peakHour) {
    observations.push({
      icon: Lightbulb,
      tone: "neutral",
      title: `${peakDay.label} and ${peakHour.label} are the strongest traffic windows`,
      detail: "Use the longer date ranges before treating this as a recurring audience pattern.",
    });
  }

  return observations.slice(0, 5);
};

const AutomatedObservations = ({ data }) => {
  const observations = useMemo(() => buildObservations(data), [data]);
  if (observations.length === 0) return null;

  const toneClass = {
    positive: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    neutral: "bg-blue-50 text-blue-700",
  };

  return (
    <section data-wono-pdf-section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <span className="shrink-0 rounded-xl bg-[#2563EB] p-2 text-white shadow-sm shadow-blue-200">
          <Lightbulb size={16} />
        </span>
        <span>
          <span className="block text-sm font-pmedium uppercase tracking-wide text-slate-900">
            Automated Observations
          </span>
          <span className="mt-0.5 block text-xs font-pmedium text-slate-500">
            Rule-based findings calculated directly from the selected period's data.
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        {observations.map((observation, index) => {
          const Icon = observation.icon;
          return (
            <div key={`${observation.title}-${index}`} className="flex gap-3 px-5 py-4">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toneClass[observation.tone]}`}>
                <Icon size={14} />
              </span>
              <span>
                <span className="block text-xs font-pmedium text-slate-900">{observation.title}</span>
                <span className="mt-1 block text-[10px] font-pmedium leading-4 text-slate-500">
                  {observation.detail}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const WonoAnalyticsDecisionLayer = ({ data, range }) => (
  <>
    {range === "thisMonth" && <MonthlyTargets summary={data?.summary} />}
    <AutomatedObservations data={data} />
  </>
);

export default WonoAnalyticsDecisionLayer;
