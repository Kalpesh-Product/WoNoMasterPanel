import React, { useEffect, useMemo, useState } from "react";
import { Calculator, ChevronRight, Pencil, X } from "lucide-react";
import {
  ATTRIBUTE_TIER_LABELS,
  calculateScore,
  getLabelForScore,
  STATEWISE_WEIGHT_FORMULAS,
} from "../../../utils/weightCalculationsV2";
import {
  ALGO2_BASE_METRICS,
  FACTOR_SHORT_LABELS,
  tierPillClass,
} from "../../../constants/algo2Metrics";

const toEngineNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 5;
};

const titleCaseKey = (key = "") =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const formatScore = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "-";

const Algo2MathDrawer = ({
  row,
  attributeKey,
  categoryAttributes = [],
  onClose,
  onEdit,
  onSelectAttribute,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setVisible(false);
    window.setTimeout(() => onClose?.(), 220);
  };

  const factors = useMemo(
    () => STATEWISE_WEIGHT_FORMULAS[attributeKey] || {},
    [attributeKey],
  );
  const weights = useMemo(() => row?.weight || row?.weights || {}, [row]);
  const tierLabels = ATTRIBUTE_TIER_LABELS[attributeKey] || [];

  const steps = useMemo(
    () =>
      Object.entries(factors).map(([factor, multiplier]) => {
        const value = toEngineNumber(weights[factor]);
        return {
          factor,
          label: FACTOR_SHORT_LABELS[factor] || titleCaseKey(factor),
          value: Number(value.toFixed(2)),
          multiplier,
          contribution: Number((value * multiplier).toFixed(2)),
        };
      }),
    [factors, weights],
  );

  const score = calculateScore(weights, factors);
  const badge = getLabelForScore(attributeKey, score);

  const siblings = useMemo(
    () =>
      categoryAttributes
        .filter((key) => key !== attributeKey && STATEWISE_WEIGHT_FORMULAS[key])
        .map((key) => {
          const siblingScore = calculateScore(weights, STATEWISE_WEIGHT_FORMULAS[key]);
          return {
            key,
            label: titleCaseKey(key),
            score: siblingScore,
            badge: getLabelForScore(key, siblingScore),
            tiers: ATTRIBUTE_TIER_LABELS[key] || [],
          };
        }),
    [categoryAttributes, attributeKey, weights],
  );

  const formatDecimal = (value) => String(Number(value.toFixed(2)));
  const expression = steps
    .map((step) => `(${formatDecimal(step.value)}×${step.multiplier.toFixed(2)})`)
    .join("+");

  const destinationName =
    row?.destination || row?.state || row?.title || row?.city || "-";

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-pmedium uppercase tracking-widest text-[#2563EB]">
                <Calculator size={12} /> Algo 2.0 Math
              </span>
              <span className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                Dynamic Rank #{row?.dynamicRank ?? row?.rank ?? "-"}
              </span>
            </div>
            <h2 className="mt-2 truncate text-lg font-pmedium text-slate-900">
              {destinationName}
            </h2>
            <p className="mt-1 text-xs font-pmedium text-slate-500">
              {row?.country || "-"} · {row?.continent || "-"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close math drawer"
            className="w-8 h-8 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-5 py-5 sm:px-6 space-y-6">
          <section>
            <div className="flex items-end justify-between gap-3 border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                1 · Step-by-step arithmetic
              </h3>
              <span className="text-[10px] font-pmedium text-slate-400">
                {titleCaseKey(attributeKey)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4">
              <div>
                <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">
                  Weighted score
                </p>
                <p className="mt-1 text-2xl font-pmedium text-blue-950">
                  {formatScore(score)} <span className="text-xs">/ 10</span>
                </p>
              </div>
              <span
                className={`ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${tierPillClass(badge, tierLabels)}`}
              >
                {badge || "-"}
              </span>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[1fr_64px_64px_80px] border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
                <span>Base metric</span>
                <span className="text-right">x</span>
                <span className="text-right">w</span>
                <span className="text-right">w · x</span>
              </div>
              {steps.map((step) => (
                <div
                  key={step.factor}
                  className="grid grid-cols-[1fr_64px_64px_80px] items-center border-b border-slate-100 px-4 py-2.5 last:border-0"
                >
                  <span className="truncate text-[11px] font-pmedium text-slate-700">
                    {step.label}
                  </span>
                  <span className="text-right text-[11px] font-pmedium text-slate-700">
                    {step.value.toFixed(2)}
                  </span>
                  <span className="text-right text-[11px] font-pmedium text-slate-500">
                    {step.multiplier.toFixed(2)}
                  </span>
                  <span className="text-right text-[11px] font-pmedium text-[#2563EB]">
                    {step.contribution.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
                Full expression
              </p>
              <p className="mt-2 break-words font-mono text-[11px] leading-6 text-slate-700">
                {expression} = {formatScore(score)}/10
              </p>
            </div>
          </section>

          <section>
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                2 · Other persona scores in this category
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {siblings.length === 0 ? (
                <p className="text-[11px] font-pmedium text-slate-400">
                  No sibling attributes in this category.
                </p>
              ) : (
                siblings.map((sibling) => (
                  <button
                    key={sibling.key}
                    type="button"
                    // onClick={() => onSelectAttribute?.(sibling.key)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[11px] font-pmedium text-slate-700 group-hover:text-[#2563EB]">
                          {sibling.label}
                        </span>
                        <span className="text-[11px] font-pmedium text-slate-900">
                          {formatScore(sibling.score)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#2563EB]"
                          style={{ width: `${Math.min(100, (sibling.score / 10) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex rounded-full px-2 py-1 text-[9px] font-pmedium uppercase tracking-wider ${tierPillClass(sibling.badge, sibling.tiers)}`}
                    >
                      {sibling.badge || "-"}
                    </span>
                    {/* <ChevronRight size={13} className="shrink-0 text-slate-300 group-hover:text-[#2563EB]" /> */}
                  </button>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest">
                3 · Raw 24 normalized base weights (1.0 – 10.0)
              </h3>
              <button
                type="button"
                onClick={() => onEdit?.(row)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
              >
                <Pencil size={11} /> Edit
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ALGO2_BASE_METRICS.map((metric) => {
                const raw = weights[metric.field];
                const numeric = Number(raw);
                const display = Number.isFinite(numeric)
                  ? toEngineNumber(numeric).toFixed(1)
                  : "-";
                return (
                  <div
                    key={metric.field}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                  >
                    <p className="truncate text-[9px] font-pmedium uppercase tracking-wider text-slate-400">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-[12px] font-pmedium text-slate-800">
                      {display}
                      <span className="text-[9px] font-pregular text-slate-400"> / 10</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default Algo2MathDrawer;
