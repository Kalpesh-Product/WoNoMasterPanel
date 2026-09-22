import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import useAxiosPrivate from "../hooks/useAxiosPrivate";

// Shared by Signup Leads (new Custom-plan signups) and Upgrade Plan
// (existing workspaces requesting a Custom upgrade) — module/department
// checkboxes with a live total price, both reading the exact same Plan
// Pricing settings live from MasterPanel (nothing typed by hand). The
// caller gets back the selected ids + computed total and decides what to do
// with them (create a lead + send a link, or send a link to an existing
// company).
const CustomPlanModulePicker = ({
  open,
  title = "Send Custom Plan Payment Link",
  contactName,
  contactEmail,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const axios = useAxiosPrivate();
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);

  useEffect(() => {
    if (open) setSelectedModuleIds([]);
  }, [open, contactEmail]);

  const { data: planPricing } = useQuery({
    queryKey: ["planPricing"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-pricing");
      return response?.data || { settings: {}, rows: [] };
    },
    enabled: open,
  });

  const totalUsd = useMemo(() => {
    const base = Number(planPricing?.settings?.professionalPlanPriceUsd || 0);
    const rows = planPricing?.rows || [];
    const selected = new Set(selectedModuleIds);
    const departments = rows.filter((r) => r.itemType === "department");
    const modules = rows.filter((r) => r.itemType === "module");
    const covered = new Set();
    let extra = 0;
    for (const dept of departments) {
      const ids = dept.includesModuleIds || [];
      if (ids.length && ids.every((id) => selected.has(id))) {
        extra += dept.priceUsd;
        ids.forEach((id) => covered.add(id));
      }
    }
    for (const id of selected) {
      if (covered.has(id)) continue;
      const row = modules.find((m) => m.itemId === id);
      if (row) extra += row.priceUsd;
    }
    return base + extra;
  }, [planPricing, selectedModuleIds]);

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
            Master Panel's Plan Pricing settings — nothing is typed by hand.
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {(planPricing?.rows || []).map((row) => (
              <label
                key={row.itemId}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-[12px] font-pmedium text-slate-700"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedModuleIds.includes(row.itemId)}
                    onChange={(e) =>
                      setSelectedModuleIds((prev) =>
                        e.target.checked
                          ? [...prev, row.itemId]
                          : prev.filter((id) => id !== row.itemId),
                      )
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
            ))}
            {!(planPricing?.rows || []).length && (
              <p className="text-[11px] text-slate-400">
                No priced add-on modules configured yet in Plan Pricing settings.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-[12px] font-pmedium text-blue-800">
            <span>Total monthly price</span>
            <span>${totalUsd}/mo</span>
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
          <button
            type="button"
            onClick={() => onSubmit(selectedModuleIds, totalUsd)}
            disabled={isSubmitting || !selectedModuleIds.length}
            className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending..." : "Generate & Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPlanModulePicker;
