import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import useAxiosPrivate from "../hooks/useAxiosPrivate";

// Shared by Signup Leads (new Custom-plan signups) and Upgrade Plan
// (existing workspaces requesting a Custom upgrade) — module/department
// checkboxes with a live total price, both reading the exact same Plan
// Pricing settings live from MasterPanel (nothing typed by hand, apart from
// the optional negotiated-price/overall-discount fields below). The
// caller gets back the selected ids + computed total (plus the raw
// discount inputs) and decides what to do with them (create a lead + send
// a link, or send a link to an existing company).
const CustomPlanModulePicker = ({
  open,
  title = "Send Custom Plan Payment Link",
  contactName,
  contactEmail,
  onClose,
  onSubmit,
  isSubmitting = false,
  // Pre-fills the picker — e.g. with the host's own selection submitted
  // from HostPanel's upgrade request, or a quote staff already saved —
  // so staff review/adjust it rather than re-picking from scratch.
  initialSelectedModuleIds = [],
  initialPriceOverrides = {},
  initialOverallDiscountUsd = 0,
  submitLabel = "Generate & Send",
  submittingLabel = "Sending...",
  // "annual" shows what will actually be charged (12x the monthly figure).
  billingCycle = "monthly",
  // Optional: lets staff keep the selection without sending a link yet.
  onSave,
  isSaving = false,
}) => {
  const isAnnual = String(billingCycle || "").toLowerCase() === "annual";
  const axios = useAxiosPrivate();
  const [selectedModuleIds, setSelectedModuleIds] = useState(initialSelectedModuleIds);
  // Per-line negotiated price overrides, keyed by itemId — the value staff
  // typed in, kept as a string while editing so a field can be blanked
  // without snapping back to the listed price mid-edit.
  const [priceOverrides, setPriceOverrides] = useState(initialPriceOverrides || {});
  const [overallDiscountInput, setOverallDiscountInput] = useState(
    initialOverallDiscountUsd ? String(initialOverallDiscountUsd) : "",
  );

  useEffect(() => {
    if (open) {
      setSelectedModuleIds(initialSelectedModuleIds);
      setPriceOverrides(initialPriceOverrides || {});
      setOverallDiscountInput(initialOverallDiscountUsd ? String(initialOverallDiscountUsd) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactEmail]);

  const { data: planPricing } = useQuery({
    queryKey: ["planPricing"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-pricing");
      return response?.data || { settings: {}, rows: [] };
    },
    enabled: open,
  });

  // Mirrors the server's buildCustomPlanPricingBreakdownFromRows
  // (modulePricingService.js) exactly, so the number shown here is the
  // number that will actually be charged.
  const breakdown = useMemo(() => {
    const basePriceUsd = Number(planPricing?.settings?.professionalPlanPriceUsd || 0);
    const rows = planPricing?.rows || [];
    const selected = new Set(selectedModuleIds);
    const departments = rows.filter((r) => r.itemType === "department");
    const modules = rows.filter((r) => r.itemType === "module");
    const covered = new Set();
    const lineItems = [];
    let subtotal = basePriceUsd;

    // A negotiated price can only discount — never exceed the module's own
    // listed rate (that would be a markup) — and never go below $0. Mirrors
    // modulePricingService.js's overrideFor on the server.
    const effectivePriceFor = (itemId, listedPriceUsd) => {
      const raw = priceOverrides[itemId];
      const parsed = Number(raw);
      return raw !== "" && raw != null && Number.isFinite(parsed)
        ? Math.min(Math.max(0, parsed), listedPriceUsd)
        : listedPriceUsd;
    };

    for (const dept of departments) {
      const ids = dept.includesModuleIds || [];
      if (selected.has(dept.itemId) || (ids.length && ids.every((id) => selected.has(id)))) {
        const effectivePriceUsd = effectivePriceFor(dept.itemId, dept.priceUsd);
        lineItems.push({
          itemId: dept.itemId,
          label: dept.label,
          itemType: "department",
          priceUsd: dept.priceUsd,
          effectivePriceUsd,
          discountUsd: Math.round((dept.priceUsd - effectivePriceUsd) * 100) / 100,
        });
        subtotal += effectivePriceUsd;
        ids.forEach((id) => covered.add(id));
        covered.add(dept.itemId);
      }
    }
    for (const id of selected) {
      if (covered.has(id)) continue;
      const row = modules.find((m) => m.itemId === id);
      if (!row) continue;
      const effectivePriceUsd = effectivePriceFor(row.itemId, row.priceUsd);
      lineItems.push({
        itemId: row.itemId,
        label: row.label,
        itemType: "module",
        priceUsd: row.priceUsd,
        effectivePriceUsd,
        discountUsd: Math.round((row.priceUsd - effectivePriceUsd) * 100) / 100,
      });
      subtotal += effectivePriceUsd;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const lineDiscountTotal = Math.round(
      lineItems.reduce((sum, item) => sum + (item.discountUsd || 0), 0) * 100,
    ) / 100;
    const requestedOverallDiscount = Number(overallDiscountInput);
    const overallDiscountUsd = Math.min(
      Math.max(0, Number.isFinite(requestedOverallDiscount) ? requestedOverallDiscount : 0),
      subtotal,
    );
    const totalUsd = Math.round((subtotal - overallDiscountUsd) * 100) / 100;

    return {
      contributingItemIds: new Set(lineItems.map((item) => item.itemId)),
      lineItems,
      subtotal,
      lineDiscountTotal,
      overallDiscountUsd,
      totalUsd,
    };
  }, [planPricing, selectedModuleIds, priceOverrides, overallDiscountInput]);

  const totalUsd = breakdown.totalUsd;
  const overallDiscountExceedsSubtotal =
    overallDiscountInput !== "" &&
    Number.isFinite(Number(overallDiscountInput)) &&
    Number(overallDiscountInput) > breakdown.subtotal;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-pmedium tracking-tight text-slate-800">{title}</h2>
            <p className="text-[11px] font-pmedium text-slate-500 mt-0.5 truncate">
              To {contactName || "this contact"} {contactEmail ? `(${contactEmail})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <p className="text-[11px] font-pmedium text-slate-500">
            Select the extra modules this Custom plan includes on top of
            everything in Professional. Price is computed automatically from
            Master Panel's Plan Pricing settings — negotiate a lower price for
            a selected module/bundle, or apply an overall discount below.
          </p>
          {initialSelectedModuleIds.length > 0 && (
            <p className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Pre-filled with the modules the host selected on their end — review and adjust before sending.
            </p>
          )}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {(planPricing?.rows || []).map((row) => {
              const isChecked = selectedModuleIds.includes(row.itemId);
              // Only rows that actually contribute to the subtotal (a
              // department, or a standalone module not already covered by a
              // selected department bundle) get a discount field — a module
              // row ticked only because its parent bundle covers it has no
              // price of its own to discount.
              const isDiscountable = isChecked && breakdown.contributingItemIds.has(row.itemId);
              const overrideValue = priceOverrides[row.itemId];
              const overrideExceedsListed =
                overrideValue !== undefined &&
                overrideValue !== "" &&
                Number.isFinite(Number(overrideValue)) &&
                Number(overrideValue) > row.priceUsd;
              return (
                <div
                  key={row.itemId}
                  className="rounded-xl border border-slate-200 hover:bg-slate-50/60 transition-colors"
                >
                  <label className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-[12px] font-pmedium text-slate-700">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelectedModuleIds((prev) => {
                            const relatedIds = row.itemType === "department"
                              ? [row.itemId, ...(row.includesModuleIds || [])]
                              : [row.itemId];
                            const next = new Set(prev);
                            if (e.target.checked) {
                              relatedIds.forEach((id) => next.add(id));
                            } else {
                              relatedIds.forEach((id) => next.delete(id));
                            }
                            return Array.from(next);
                          })
                        }
                      />
                      {row.label}
                      {row.itemType === "department" && (
                        <span className="text-[9px] uppercase tracking-wider text-blue-500">
                          bundle
                        </span>
                      )}
                    </span>
                    <span className="text-slate-500">${row.priceUsd}/mo</span>
                  </label>
                  {isDiscountable && (
                    <div className="px-3 pb-2.5 -mt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400">Negotiated price</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            max={row.priceUsd}
                            step="1"
                            placeholder={String(row.priceUsd)}
                            value={overrideValue ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setPriceOverrides((prev) => ({ ...prev, [row.itemId]: e.target.value }))
                            }
                            onBlur={(e) => {
                              const parsed = Number(e.target.value);
                              if (e.target.value === "" || !Number.isFinite(parsed)) return;
                              const clamped = String(Math.min(Math.max(0, parsed), row.priceUsd));
                              if (clamped !== e.target.value) {
                                setPriceOverrides((prev) => ({ ...prev, [row.itemId]: clamped }));
                              }
                            }}
                            className={`w-20 rounded-lg border px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 ${
                              overrideExceedsListed
                                ? "border-rose-300 focus:ring-rose-300"
                                : "border-slate-200 focus:ring-blue-300"
                            }`}
                          />
                          <span className="text-[10px] text-slate-400">/mo</span>
                        </div>
                      </div>
                      {overrideExceedsListed && (
                        <p className="mt-1 text-right text-[10px] text-rose-600">
                          Discount can't be more than this module's price (${row.priceUsd}/mo) — it'll be capped when you leave this field.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!(planPricing?.rows || []).length && (
              <p className="text-[11px] text-slate-400">
                No priced add-on modules configured yet in Plan Pricing settings.
              </p>
            )}
          </div>
          <div className="rounded-xl bg-blue-50/60 border border-blue-100 text-[12px] font-pmedium text-blue-800 divide-y divide-blue-100/70">
            <div className="flex items-center justify-between px-3 py-2">
              <span>Subtotal</span>
              <span>${breakdown.subtotal}/mo</span>
            </div>
            {breakdown.lineDiscountTotal > 0 && (
              <div className="flex items-center justify-between px-3 py-2 text-emerald-700">
                <span>Module discounts</span>
                <span>-${breakdown.lineDiscountTotal}/mo</span>
              </div>
            )}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span>Overall discount</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-blue-700/70">$</span>
                  <input
                    type="number"
                    min="0"
                    max={breakdown.subtotal}
                    step="1"
                    placeholder="0"
                    value={overallDiscountInput}
                    onChange={(e) => setOverallDiscountInput(e.target.value)}
                    onBlur={(e) => {
                      const parsed = Number(e.target.value);
                      if (e.target.value === "" || !Number.isFinite(parsed)) return;
                      const clamped = String(Math.min(Math.max(0, parsed), breakdown.subtotal));
                      if (clamped !== e.target.value) setOverallDiscountInput(clamped);
                    }}
                    className={`w-20 rounded-lg border bg-white px-2 py-1 text-[11px] text-slate-700 focus:outline-none focus:ring-1 ${
                      overallDiscountExceedsSubtotal
                        ? "border-rose-300 focus:ring-rose-300"
                        : "border-blue-200 focus:ring-blue-300"
                    }`}
                  />
                  <span className="text-[10px] text-blue-700/70">/mo</span>
                </div>
              </div>
              {overallDiscountExceedsSubtotal && (
                <p className="mt-1 text-right text-[10px] text-rose-600">
                  Discount can't be more than the subtotal (${breakdown.subtotal}/mo) — it'll be capped when you leave this field.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span>{isAnnual ? "Total per year (billed annually)" : "Total monthly price"}</span>
              <span>
                {isAnnual
                  ? `$${Math.round(totalUsd * 12 * 100) / 100}/yr`
                  : `$${totalUsd}/mo`}
              </span>
            </div>
            {isAnnual && (
              <p className="px-3 py-2.5 text-[10px] text-blue-600">
                This lead is on annual billing — the payment link charges 12 × the monthly price
                (${totalUsd}/mo).
              </p>
            )}
          </div>
        </div>
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
          >
            Cancel
          </button>
          {onSave && (
            <button
              type="button"
              onClick={() =>
                onSave(selectedModuleIds, totalUsd, priceOverrides, breakdown.overallDiscountUsd)
              }
              disabled={isSaving || isSubmitting || !selectedModuleIds.length}
              className="flex-1 py-2.5 bg-white border border-[#2563EB]/40 text-[#2563EB] rounded-xl font-pmedium text-[12px] hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save selection"}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onSubmit(selectedModuleIds, totalUsd, priceOverrides, breakdown.overallDiscountUsd)
            }
            disabled={isSubmitting || !selectedModuleIds.length}
            className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPlanModulePicker;
