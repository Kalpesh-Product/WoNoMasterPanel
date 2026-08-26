// Shared date-range control. "overall" means no filtering; the others map
// to a days-ago cutoff applied client-side over already-fetched data (see
// filterDataByRange in MainDashboard/data/aggregate.js) — GA4's realtime
// widgets use the same option keys so both systems stay consistent.
export const RANGE_OPTIONS = [
  { key: "7daysAgo", label: "Last 7 Days" },
  { key: "30daysAgo", label: "Last 30 Days" },
  { key: "90daysAgo", label: "Last 90 Days" },
  { key: "overall", label: "Overall" },
];

const RangeTabs = ({ value, onChange }) => (
  <div className="flex gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm shrink-0">
    {RANGE_OPTIONS.map((option) => (
      <button
        type="button"
        key={option.key}
        onClick={() => onChange(option.key)}
        className={`rounded-xl px-3 py-1.5 text-[10px] font-pmedium uppercase tracking-widest transition-all whitespace-nowrap ${
          value === option.key
            ? "bg-[#2563EB] text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default RangeTabs;
