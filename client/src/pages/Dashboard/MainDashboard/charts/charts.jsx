import { useState } from "react";
import { AlertCircle, BarChart3 } from "lucide-react";

const CHART_COLORS = [
  "#2563EB",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

const percentOf = (value, total) => (total ? Math.round((value / total) * 100) : 0);

export const ChartCard = ({ title, children }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-full">
    <p className="text-[11px] font-pmedium text-slate-400 uppercase tracking-widest mb-5">
      {title}
    </p>
    {children}
  </div>
);

const Tooltip = ({ x, y, label, value, total }) => {
  if (label == null) return null;
  return (
    <div
      className="absolute z-20 pointer-events-none rounded-xl bg-slate-900 text-white text-[11px] font-pmedium px-3 py-1.5 shadow-lg whitespace-nowrap"
      style={{ left: x, top: y, transform: "translate(-50%, -135%)" }}
    >
      <span className="text-slate-400">{label}: </span>
      <span>{typeof value === "number" ? value.toLocaleString("en-US") : value}</span>
      {total > 0 && <span className="text-blue-300"> ({percentOf(value, total)}%)</span>}
    </div>
  );
};

const ChartFooter = ({ total, detail }) => (
  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] font-pmedium">
    <span className="text-[10px] text-slate-400 uppercase tracking-widest shrink-0">
      Total {total.toLocaleString("en-US")}
    </span>
    {detail ? (
      <span className="text-slate-600 text-right">
        <span className="text-slate-400">{detail.label}: </span>
        <span className="text-[#2563EB]">{detail.value.toLocaleString("en-US")}</span>
        <span className="text-slate-400"> ({percentOf(detail.value, total)}%)</span>
      </span>
    ) : (
      <span className="text-slate-300">Click a segment to see its share</span>
    )}
  </div>
);

// Layout pass shared by the chart renderers. Compact charts (donuts and
// short bar series) pair up two per row; horizontally hungry ones — trend
// lines and bar series with 6+ columns — take a full row. When a compact
// chart would trail alone before a full-row chart, the next compact chart
// is pulled forward so rows stay filled instead of leaving a vacant slot.
const WIDE_BAR_MIN = 9;

export const isWideChart = (chart) => {
  if (!chart) return false;
  if (chart.fullWidth != null) return Boolean(chart.fullWidth);
  if (chart.type === "line") return true;
  if (chart.type === "bars") {
    return (Array.isArray(chart.dataset) ? chart.dataset.length : 0) >= WIDE_BAR_MIN;
  }
  return false;
};

export const layoutChartRows = (charts) => {
  const list = Array.isArray(charts) ? [...charts] : [];
  const ordered = [];

  let i = 0;
  while (i < list.length) {
    if (isWideChart(list[i])) {
      ordered.push({ chart: list[i], span: 2 });
      i += 1;
      continue;
    }

    const next = list[i + 1];
    if (next && !isWideChart(next)) {
      ordered.push({ chart: list[i], span: 1 }, { chart: next, span: 1 });
      i += 2;
      continue;
    }

    // Lone compact chart ahead of a wide one — borrow the next compact
    // chart from further down the list to complete this row.
    const borrowIndex = list.findIndex((entry, j) => j > i + 1 && !isWideChart(entry));
    if (borrowIndex > -1) {
      const [borrowed] = list.splice(borrowIndex, 1);
      ordered.push({ chart: list[i], span: 1 }, { chart: borrowed, span: 1 });
      i += 1;
      continue;
    }

    ordered.push({ chart: list[i], span: 1 });
    i += 1;
  }

  return ordered;
};

export const BarDiagram = ({ bars, title = "Bar Diagram" }) => {  const items = Array.isArray(bars) ? bars : [];
  const total = items.reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const max = Math.max(...items.map((b) => b.value), 1);
  const [active, setActive] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const selectedItem = selected != null ? items[selected] : null;

  return (
    <ChartCard title={title}>
      <div className="relative flex-1 min-h-[10rem]" onMouseMove={handleMove} onMouseLeave={() => setActive(null)}>
        <div className="flex h-full items-end justify-center gap-3">
          {items.map((bar, i) => {
            const isActive = active === i;
            const isSelected = selected === i;
            const isTop = bar.value === max && max > 0;
            const heightPct = Math.max(3, Math.round((bar.value / max) * 100));
            return (
              <div
                key={`${bar.label}-${i}`}
                className="flex h-full max-w-[72px] flex-1 flex-col items-center cursor-pointer"
                onMouseEnter={() => setActive(i)}
                onClick={() => setSelected((prev) => (prev === i ? null : i))}
              >
                <div className="relative flex-1 w-full flex items-end justify-center">
                  <span
                    className={`absolute text-[10px] font-pmedium transition-colors ${
                      isActive || isSelected ? "text-slate-700" : "text-slate-400"
                    }`}
                    style={{ bottom: `calc(${heightPct}% + 4px)` }}
                  >
                    {bar.value}
                  </span>
                  <div
                    className={`w-full max-w-[38px] rounded-t-md transition-all ${
                      isActive || isSelected ? "bg-[#2563EB]" : isTop ? "bg-primary" : "bg-[#2563EB]/70"
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className="text-[10px] font-pmedium text-slate-400 truncate max-w-full shrink-0"
                  title={bar.label}
                >
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
        {active != null && items[active] && <Tooltip {...pos} {...items[active]} total={total} />}
      </div>
      <ChartFooter total={total} detail={selectedItem} />
    </ChartCard>
  );
};

const polarPoint = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.sin(angle),
  y: cy - radius * Math.cos(angle),
});

const donutSlice = (cx, cy, outer, inner, startAngle, endAngle) => {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const p0o = polarPoint(cx, cy, outer, startAngle);
  const p0i = polarPoint(cx, cy, inner, startAngle);
  const p1i = polarPoint(cx, cy, inner, endAngle);
  const p1o = polarPoint(cx, cy, outer, endAngle);
  return [
    `M ${p0o.x} ${p0o.y}`,
    `L ${p0i.x} ${p0i.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${p1i.x} ${p1i.y}`,
    `L ${p1o.x} ${p1o.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${p0o.x} ${p0o.y}`,
    "Z",
  ].join(" ");
};

export const DistributionDonut = ({ data, title = "Distribution" }) => {
  const items = (Array.isArray(data) ? data : []).map((d, i) => ({
    ...d,
    color: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const cx = 120;
  const cy = 120;
  const outerR = 100;
  const innerR = 62;

  const segments = [];
  let acc = 0;
  items.forEach((item, i) => {
    const start = acc;
    const sweep = total ? (Number(item.value) || 0) / total : 0;
    acc += sweep * Math.PI * 2;
    segments.push({ item, start, end: acc });
  });

  const selectedItem = selected != null ? items[selected] : null;

  return (
    <ChartCard title={title}>
      <div className="relative flex-1 min-h-[12rem] flex flex-col justify-center" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        <div className="flex justify-center">
          <svg viewBox="0 0 240 240" className="w-full max-w-[230px]">
            {items.length === 1 ? (
              <g>
                <circle cx={cx} cy={cy} r={outerR} fill={items[0].color} stroke="#fff" strokeWidth="3" />
                <circle cx={cx} cy={cy} r={innerR} fill="#fff" />
              </g>
            ) : (
              segments.map(({ item, start, end }, i) => {
                const isHover = hover === i;
                const isSelected = selected === i;
                const dimmed = hover != null && !isHover;
                const emphasis = isHover || isSelected;
                return (
                  <path
                    key={`${item.label}-${i}`}
                    d={donutSlice(cx, cy, emphasis ? outerR + 6 : outerR, emphasis ? innerR + 4 : innerR, start, end)}
                    fill={item.color}
                    fillOpacity={dimmed ? 0.4 : 1}
                    stroke="#fff"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setSelected((prev) => (prev === i ? null : i))}
                  />
                );
              })
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {selectedItem ? (
              <>
                <span className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest max-w-[110px] text-center">
                  {selectedItem.label}
                </span>
                <span className="text-xl font-pmedium text-slate-900">
                  {percentOf(selectedItem.value, total)}%
                </span>
                <span className="text-[10px] font-pmedium text-slate-400">
                  {selectedItem.value.toLocaleString("en-US")}
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-pmedium text-slate-900">{total.toLocaleString("en-US")}</span>
                <span className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest">
                  Total
                </span>
              </>
            )}
          </div>
        </div>
        {hover != null && segments[hover] && <Tooltip {...pos} {...segments[hover].item} total={total} />}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        {items.map((d, i) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setSelected((prev) => (prev === i ? null : i))}
            className={`flex items-center gap-1.5 text-[11px] font-pmedium rounded-full px-2 py-1 transition-colors ${
              selected === i ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label}
            <span className="text-slate-400">
              {d.value.toLocaleString("en-US")} ({percentOf(d.value, total)}%)
            </span>
          </button>
        ))}
      </div>
    </ChartCard>
  );
};

export const TrendLine = ({ data, title = "Trend Line" }) => {
  const items = Array.isArray(data) ? data : [];
  const total = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const [hover, setHover] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const w = 600;
  const h = 200;
  const pad = 26;
  const max = Math.max(...items.map((d) => d.value), 1);
  const min = Math.min(...items.map((d) => d.value), 0);
  const range = max - min || 1;

  const points = items.map((d, i) => {
    const x = pad + (i * (w - 2 * pad)) / Math.max(items.length - 1, 1);
    const y = h - pad - ((d.value - min) / range) * (h - 2 * pad);
    return { x, y, label: d.label, value: d.value };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${h - pad} ${polyline} ${w - pad},${h - pad}`;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xView = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const distance = Math.abs(p.x - xView);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setHover(nearest);
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (items.length < 2) {
    return (
      <ChartCard title={title}>
        <p className="text-xs font-pmedium text-slate-400">
          Not enough data points to render a trend yet.
        </p>
      </ChartCard>
    );
  }

  const hoveredPoint = hover != null ? points[hover] : null;

  // Labeling every point works fine for a handful of points but overlaps
  // once a series has dozens (e.g. a 30/90-day daily trend) — thin them out
  // to roughly 8 evenly-spaced labels, always keeping the last point so the
  // series doesn't visually trail off unlabeled.
  const maxLabels = 8;
  const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));
  const showLabel = (i) => i % labelEvery === 0 || i === points.length - 1;

  return (
    <ChartCard title={title}>
      <div className="relative flex-1 min-h-[10rem]" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          <defs>
            <linearGradient id="linefill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#linefill)" />
          <polyline
            points={polyline}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <g key={p.label}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === i ? 5 : 3}
                fill={hover === i ? "#2563EB" : "#fff"}
                stroke="#2563EB"
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
              />
              {showLabel(i) && (
                <text
                  x={p.x}
                  y={h - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill={hover === i ? "#2563EB" : "#94A3B8"}
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        {hoveredPoint && (
          <Tooltip {...pos} label={hoveredPoint.label} value={hoveredPoint.value} total={total} />
        )}
      </div>
      <ChartFooter total={total} detail={hoveredPoint} />
    </ChartCard>
  );
};

const SkeletonBar = () => (
  <div className="animate-pulse">
    <div className="h-3 w-1/3 rounded bg-slate-100 mb-5" />
    <div className="flex h-48 items-end gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-slate-100" style={{ height: `${30 + ((i * 13) % 60)}%` }} />
      ))}
    </div>
  </div>
);

export const LoadingOverview = () => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="h-3 w-2/3 rounded bg-slate-100 mb-2" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <SkeletonBar />
      </div>
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <SkeletonBar />
      </div>
    </div>
  </div>
);

export const ErrorOverview = ({ onRetry }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <AlertCircle size={20} className="text-red-500" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      Failed to load overview data. The section may be unavailable or the
      backend may be offline.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[10px] font-pmedium uppercase tracking-widest shadow-sm shadow-blue-200 transition-all hover:opacity-90"
    >
      Retry
    </button>
  </div>
);

export const EmptyOverview = ({ title }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <BarChart3 size={20} className="text-slate-300" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      No overview data available for {title}. This section does not currently
      expose any chartable data.
    </p>
  </div>
);

export const NoChartsNote = () => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center gap-3">
    <BarChart3 size={20} className="text-slate-300" />
    <p className="text-xs font-pmedium text-slate-500 text-center">
      This section is a reference/lookup table, so no chart data is shown.
    </p>
  </div>
);
