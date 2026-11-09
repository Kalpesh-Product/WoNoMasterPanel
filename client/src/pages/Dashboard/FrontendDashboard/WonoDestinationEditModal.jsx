import React, { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";

const FACTOR_FIELDS = [
  ["targetBusinessSupply", "Target Business Supply"],
  ["tourismAccommodationBase", "Tourism / Accommodation Base"],
  ["marketScale", "Market Scale"],
  ["nomadDemandCommunity", "Nomad Demand & Community"],
  ["remoteWorkInfrastructure", "Remote Work Infrastructure"],
  ["businessJobsEcosystem", "Business & Jobs Ecosystem"],
  ["flightConnectivity", "Flight Connectivity"],
  ["affordability", "Affordability"],
  ["visaEntryAccessibility", "Visa Entry Accessibility"],
  ["safetyHealthcare", "Safety / Healthcare"],
];

const TIER_OPTIONS = [
  { value: "94", label: "94 — Very strong / global-leading" },
  { value: "82", label: "82 — Strong / established" },
  { value: "68", label: "68 — Good / mid-tier" },
  { value: "55", label: "55 — Emerging / moderate" },
  { value: "40", label: "40 — Limited / early-stage" },
];

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-pmedium text-slate-900 outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

const buildInitialForm = (destination) => ({
  destination: destination?.destination || "",
  country: destination?.country || "",
  continent: destination?.continent || "",
  isActive: Boolean(destination?.isActive),
  factors: FACTOR_FIELDS.reduce((acc, [key]) => {
    acc[key] = destination?.factors?.[key] !== undefined && destination?.factors?.[key] !== null
      ? String(destination.factors[key])
      : "";
    return acc;
  }, {}),
});

const WonoDestinationEditModal = ({ destination, onClose }) => {
  const axios = useAxiosPrivate();
  const isEditing = Boolean(destination?._id);
  const [form, setForm] = useState(() => buildInitialForm(destination));

  useEffect(() => {
    setForm(buildInitialForm(destination));
  }, [destination]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["wono-destination-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["wono-destination-analytics-dashboard"] });
  };

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const payload = {
        destination: form.destination,
        country: form.country,
        continent: form.continent,
        isActive: form.isActive,
        factors: Object.fromEntries(
          FACTOR_FIELDS
            .filter(([key]) => form.factors[key] !== "")
            .map(([key]) => [key, Number(form.factors[key])]),
        ),
      };
      if (isEditing) {
        const response = await axios.patch(`/api/hosts/destination-analytics/${destination._id}`, payload);
        return response.data;
      }
      const response = await axios.post("/api/hosts/destination-analytics", payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(isEditing ? "Destination updated" : "Destination added");
      invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save destination");
    },
  });

  if (!destination) return null;

  const missingCount = FACTOR_FIELDS.filter(([key]) => form.factors[key] === "").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{isEditing ? "Edit destination" : "Add destination"}</p>
            <h2 className="mt-1 text-lg font-pmedium text-slate-900">{isEditing ? destination.destination : "New destination"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200"><X size={16} /></button>
        </div>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Destination</label>
              <input disabled={isEditing} className={`${inputCls} mt-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} value={form.destination} onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))} placeholder="e.g. Lisbon" />
            </div>
            <div>
              <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Country</label>
              <input disabled={isEditing} className={`${inputCls} mt-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} placeholder="e.g. Portugal" />
            </div>
            <div>
              <label className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">Continent</label>
              <input disabled={isEditing} className={`${inputCls} mt-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} value={form.continent} onChange={(event) => setForm((prev) => ({ ...prev, continent: event.target.value }))} placeholder="e.g. Europe" />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
              Score factors — {missingCount === 0 ? "all 10 set" : `${missingCount} missing`}
            </div>
            {FACTOR_FIELDS.map(([key, label]) => (
              <div key={key} className="grid grid-cols-[1fr_1.3fr] items-center gap-3 border-b border-slate-100 px-5 py-2.5 last:border-0">
                <span className="text-xs font-pmedium text-slate-700">{label}</span>
                <select
                  className={inputCls}
                  value={form.factors[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, factors: { ...prev.factors, [key]: event.target.value } }))}
                >
                  <option value="">— Select —</option>
                  {TIER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <label className="mt-5 flex items-center gap-2 text-xs font-pmedium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active (included in ranking) — requires all 10 factors
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-pmedium text-slate-600 transition hover:border-slate-300">Cancel</button>
            <button
              type="button"
              disabled={isSaving || !form.destination.trim() || !form.country.trim() || !form.continent.trim()}
              onClick={() => save()}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WonoDestinationEditModal;
