import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { toast } from "sonner";
import { Plus, Trash2, Save, Users, Tag, Power } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import TrialCompaniesModal from "../../../components/TrialCompaniesModal";

// Lets staff change every dollar amount that drives Custom-plan pricing —
// nothing here is a hardcoded constant in code. There is only ONE base
// price (Professional's), stored in PlanPricingSettings (a singleton doc);
// Custom always costs that same amount plus whatever individually-priced
// modules/department bundles are selected on top (ModulePricing rows).
// See D:\WoNoMasterPanel\server\services\modulePricingService.js.
const PlanPricingSettings = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [professionalPrice, setProfessionalPrice] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [basicPrice, setBasicPrice] = useState("");
  const [basicAnnualPrice, setBasicAnnualPrice] = useState("");
  const [basicFreeDurationMonths, setBasicFreeDurationMonths] = useState("6");
  const [freeTrialEnabled, setFreeTrialEnabled] = useState(false);
  const [freeTrialDurationDays, setFreeTrialDurationDays] = useState("30");
  const [activeTrialPromotionCodeId, setActiveTrialPromotionCodeId] = useState("");
  const [isTrialCompaniesOpen, setIsTrialCompaniesOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("module");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [newPriceUsd, setNewPriceUsd] = useState("");
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoDiscountType, setNewPromoDiscountType] = useState("percent");
  const [newPromoDiscountValue, setNewPromoDiscountValue] = useState("");
  // "once" = applies to the first real charge only, then the host pays
  // full price from then on — the usual "first month off" meaning, and
  // what a trial discount should default to. "forever"/"repeating" keep
  // discounting every future invoice — rarely what's meant for a trial
  // code, so staff must deliberately choose one of those.
  const [newPromoDuration, setNewPromoDuration] = useState("once");
  const [newPromoDurationInMonths, setNewPromoDurationInMonths] = useState("3");

  const { data, isLoading } = useQuery({
    queryKey: ["planPricingSettings"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-pricing");
      return response?.data || { settings: {}, rows: [] };
    },
  });

  // TanStack Query v5 removed the onSuccess callback from useQuery (it only
  // still exists on useMutation) — this replaces it. Only syncs in the
  // price the server actually has while the field hasn't been hand-edited
  // yet, so it doesn't clobber what staff are mid-typing.
  const [priceTouched, setPriceTouched] = useState(false);
  useEffect(() => {
    if (priceTouched) return;
    if (data?.settings?.professionalPlanPriceUsd == null) return;
    setProfessionalPrice(String(data.settings.professionalPlanPriceUsd));
    setAnnualPrice(
      data.settings.professionalAnnualPlanPriceUsd != null
        ? String(data.settings.professionalAnnualPlanPriceUsd)
        : "",
    );
    setBasicPrice(String(data.settings.basicPlanPriceUsd ?? 0));
    setBasicAnnualPrice(
      data.settings.basicPlanAnnualPriceUsd != null
        ? String(data.settings.basicPlanAnnualPriceUsd)
        : "",
    );
    setBasicFreeDurationMonths(String(data.settings.basicFreeDurationMonths ?? 6));
    setFreeTrialEnabled(Boolean(data.settings.freeTrialEnabled));
    setFreeTrialDurationDays(String(data.settings.freeTrialDurationDays ?? 30));
    setActiveTrialPromotionCodeId(data.settings.activeTrialPromotionCodeId || "");
  }, [data, priceTouched]);

  // Stripe Promotion Codes (coupons attached to a customer-facing code) —
  // live from Stripe's own account, not stored locally, so this always
  // matches what's actually usable at checkout.
  const { data: promoCodesData, isLoading: promoCodesLoading } = useQuery({
    queryKey: ["trialPromoCodes"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/promo-codes");
      return response?.data || { codes: [] };
    },
  });
  const promoCodes = promoCodesData?.codes || [];

  const createPromoCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post("/api/hosts/promo-codes", {
        code: newPromoCode,
        percentOff: newPromoDiscountType === "percent" ? Number(newPromoDiscountValue) : undefined,
        amountOffUsd: newPromoDiscountType === "amount" ? Number(newPromoDiscountValue) : undefined,
        duration: newPromoDuration,
        durationInMonths: newPromoDuration === "repeating" ? Number(newPromoDurationInMonths) : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      setNewPromoCode("");
      setNewPromoDiscountValue("");
      setNewPromoDuration("once");
      setNewPromoDurationInMonths("3");
      queryClient.invalidateQueries({ queryKey: ["trialPromoCodes"] });
      toast.success("Promo code created");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to create promo code"),
  });

  const togglePromoCodeActiveMutation = useMutation({
    mutationFn: async ({ id, active }) => {
      const res = await axios.patch(`/api/hosts/promo-codes/${id}/active`, { active });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trialPromoCodes"] });
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to update promo code"),
  });

  const deletePromoCodeMutation = useMutation({
    mutationFn: async (id) => (await axios.delete(`/api/hosts/promo-codes/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trialPromoCodes"] });
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
      toast.success("Promo code deleted");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to delete promo code"),
  });

  const saveActiveTrialPromoMutation = useMutation({
    mutationFn: async (value) => {
      const res = await axios.patch("/api/hosts/plan-pricing/settings", {
        activeTrialPromotionCodeId: value,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
      toast.success("Trial auto-apply updated");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to update"),
  });

  // The REAL modules/departments that can be priced, derived server-side
  // from the actual module catalog — staff pick from this instead of typing
  // ids by hand, so a pricing row can never reference something that
  // doesn't exist or has already been priced.
  const { data: catalogData } = useQuery({
    queryKey: ["planPricingCatalog"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/plan-pricing/catalog");
      return response?.data || { modules: [], departments: [] };
    },
  });

  const settings = data?.settings || {};
  const rows = data?.rows || [];
  const catalogOptions =
    newItemType === "department" ? catalogData?.departments || [] : catalogData?.modules || [];
  const selectedCatalogEntry = catalogOptions.find((o) => o.itemId === selectedCatalogId);

  const saveBaseMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.patch("/api/hosts/plan-pricing/settings", {
        professionalPlanPriceUsd: Number(professionalPrice),
        professionalAnnualPlanPriceUsd:
          annualPrice === "" || annualPrice == null ? null : Number(annualPrice),
        basicPlanPriceUsd: Number(basicPrice),
        basicPlanAnnualPriceUsd:
          basicAnnualPrice === "" || basicAnnualPrice == null ? null : Number(basicAnnualPrice),
        basicFreeDurationMonths: Number(basicFreeDurationMonths),
        freeTrialEnabled,
        freeTrialDurationDays: Number(freeTrialDurationDays),
      });
      return res.data;
    },
    onSuccess: () => {
      setPriceTouched(false);
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
      toast.success("Plan pricing updated");
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to update pricing"),
  });

  const upsertRowMutation = useMutation({
    mutationFn: async (row) => {
      const res = await axios.put(`/api/hosts/plan-pricing/${row.itemId}`, {
        itemType: row.itemType,
        label: row.label,
        priceUsd: Number(row.priceUsd),
        // includesModuleIds is always already an array here — either from an
        // existing DB row (PricingRow) or from the catalog picker
        // (selectedCatalogEntry.includesModuleIds) — never a typed string.
        includesModuleIds: Array.isArray(row.includesModuleIds) ? row.includesModuleIds : [],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
      queryClient.invalidateQueries({ queryKey: ["planPricingCatalog"] });
      toast.success("Pricing saved");
      setSelectedCatalogId("");
      setNewPriceUsd("");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to save pricing"),
  });

  const deleteRowMutation = useMutation({
    mutationFn: async (itemId) => {
      const res = await axios.delete(`/api/hosts/plan-pricing/${itemId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planPricingSettings"] });
      queryClient.invalidateQueries({ queryKey: ["planPricingCatalog"] });
      toast.success("Pricing item removed");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to remove item"),
  });

  return (
    <PageFrame>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-lg font-pmedium text-slate-800">Plan Pricing</h1>
          <p className="text-[12px] font-pmedium text-slate-500 mt-1">
            Every amount here is live-editable and takes effect on the next
            payment link generated — never on an already-sent or already-paid
            link/invoice.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-[13px] font-pmedium text-slate-700">Professional Plan Price</h2>
          <p className="text-[11px] font-pmedium text-slate-500 max-w-2xl">
            There's only one base price. Custom plan always includes
            everything in Professional, so it costs this same amount plus
            whatever add-on modules/departments are priced below — there's no
            separate Custom base price to set. The Annual rate is the full
            yearly price (e.g. $1,999/yr) charged once, in advance, for a
            12-month cycle — the save shown to hosts is the discount vs
            paying the monthly rate for 12 months. Leave it blank to offer
            monthly billing only.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="max-w-xs w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Professional Plan (USD / month)
              </label>
              <input
                type="number"
                value={professionalPrice}
                onChange={(e) => {
                  setPriceTouched(true);
                  setProfessionalPrice(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <div className="max-w-xs w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Professional Plan Annual (USD / year)
              </label>
              <input
                type="number"
                value={annualPrice}
                placeholder="Blank = no discount"
                onChange={(e) => {
                  setPriceTouched(true);
                  setAnnualPrice(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <button
              type="button"
              onClick={() => saveBaseMutation.mutate()}
              disabled={saveBaseMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[11px] font-pmedium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              <Save size={12} />
              Save Prices
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-[13px] font-pmedium text-slate-700">Basic Plan Price</h2>
          <p className="text-[11px] font-pmedium text-slate-500 max-w-2xl">
            Basic is free today this provision is for later where you can set a price for the Basic plan. The Annual rate is the full yearly price (e.g. $199/yr) charged once, in advance, for a 12-month cycle — the save shown to hosts is the discount vs paying the monthly rate for 12 months. Leave it blank to offer monthly billing only.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="max-w-xs w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Basic Plan (USD / month)
              </label>
              <input
                type="number"
                value={basicPrice}
                onChange={(e) => {
                  setPriceTouched(true);
                  setBasicPrice(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <div className="max-w-xs w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Basic Plan Annual (USD / year)
              </label>
              <input
                type="number"
                value={basicAnnualPrice}
                placeholder="Blank = no discount"
                onChange={(e) => {
                  setPriceTouched(true);
                  setBasicAnnualPrice(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <div className="max-w-[160px] w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Free Period (months)
              </label>
              <input
                type="number"
                min={1}
                value={basicFreeDurationMonths}
                onChange={(e) => {
                  setPriceTouched(true);
                  setBasicFreeDurationMonths(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <button
              type="button"
              onClick={() => saveBaseMutation.mutate()}
              disabled={saveBaseMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[11px] font-pmedium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              <Save size={12} />
              Save Prices
            </button>
          </div>
          <p className="text-[10px] font-pmedium text-slate-400 max-w-2xl">
            Free Period isn't counted down or enforced anywhere yet — it's
            groundwork for a future "free for N months, then pay" cutoff.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-[13px] font-pmedium text-slate-700">Professional Free Trial</h2>
            <button
              type="button"
              onClick={() => setIsTrialCompaniesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-pmedium bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Users size={12} />
              View Trial Companies
            </button>
          </div>
          <p className="text-[11px] font-pmedium text-slate-500 max-w-2xl">
            When on, a host who has never claimed a trial before sees a "Start
            Free Trial" option on the Professional plan card. Changing the
            duration only affects trials started after the change — a trial
            already running keeps the day count it started with. Turning the
            offer off stops new claims but does not end a trial already in
            progress. "View Trial Companies" shows who's claimed it, when it
            ends, and lets you grant a specific company an extra trial window
            on top of the normal one-time trial (e.g. once theirs is over).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="self-stretch flex items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={freeTrialEnabled}
                  onChange={(e) => {
                    setPriceTouched(true);
                    setFreeTrialEnabled(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-pmedium text-slate-700">
                  Offer active
                </span>
              </label>
            </div>
            <div className="max-w-[160px] w-full">
              <label className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5 block">
                Trial Length (days)
              </label>
              <input
                type="number"
                min={1}
                value={freeTrialDurationDays}
                onChange={(e) => {
                  setPriceTouched(true);
                  setFreeTrialDurationDays(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-pmedium text-slate-800 outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <button
              type="button"
              onClick={() => saveBaseMutation.mutate()}
              disabled={saveBaseMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[11px] font-pmedium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              <Save size={12} />
              Save Trial Settings
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-[13px] font-pmedium text-slate-700">Trial Promo Code</h2>
          <p className="text-[11px] font-pmedium text-slate-500 max-w-2xl">
            Created here, these are real Stripe coupons — same test/live mode
            as everything else, no separate setup needed. Pick one as
            "Auto-apply" and it's applied automatically on every new trial
            checkout, discount shown upfront, with nothing for the host to
            type in. Leave it on "None" to let a host type in any code
            themselves instead.
          </p>

          {promoCodesLoading ? (
            <p className="text-[12px] font-pmedium text-slate-400">Loading…</p>
          ) : promoCodes.length ? (
            <div className="space-y-2">
              {promoCodes.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag size={13} className="text-slate-400 shrink-0" />
                    <span className="text-[12px] font-pmedium text-slate-800 truncate">{promo.code}</span>
                    <span className="text-[11px] font-pmedium text-slate-500">
                      {promo.percentOff ? `${promo.percentOff}% off` : `$${promo.amountOffUsd} off`}
                    </span>
                    <span
                      className={`text-[10px] font-pmedium uppercase tracking-wider ${promo.duration === "forever" ? "text-amber-600" : "text-slate-400"}`}
                      title={
                        promo.duration === "once"
                          ? "Applies to the first charge only"
                          : promo.duration === "repeating"
                            ? `Applies to the first ${promo.durationInMonths || 1} month(s)`
                            : "Applies to every future charge, forever"
                      }
                    >
                      {promo.duration === "once"
                        ? "Once"
                        : promo.duration === "repeating"
                          ? `${promo.durationInMonths || 1}mo`
                          : "Forever"}
                    </span>
                    {!promo.active ? (
                      <span className="text-[10px] font-pmedium uppercase tracking-wider text-slate-400">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-pmedium text-slate-600 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="activeTrialPromo"
                        checked={activeTrialPromotionCodeId === promo.id}
                        disabled={!promo.active}
                        onChange={() => {
                          setActiveTrialPromotionCodeId(promo.id);
                          saveActiveTrialPromoMutation.mutate(promo.id);
                        }}
                      />
                      Auto-apply
                    </label>
                    <button
                      type="button"
                      onClick={() => togglePromoCodeActiveMutation.mutate({ id: promo.id, active: !promo.active })}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                      title={promo.active ? "Deactivate" : "Activate"}
                    >
                      <Power size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Permanently delete "${promo.code}"? This can't be undone.`)) {
                          deletePromoCodeMutation.mutate(promo.id);
                        }
                      }}
                      disabled={deletePromoCodeMutation.isPending}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40"
                      title="Delete permanently"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-1.5 text-[11px] font-pmedium text-slate-500 cursor-pointer select-none pt-1">
                <input
                  type="radio"
                  name="activeTrialPromo"
                  checked={!activeTrialPromotionCodeId}
                  onChange={() => {
                    setActiveTrialPromotionCodeId("");
                    saveActiveTrialPromoMutation.mutate("");
                  }}
                />
                None — let hosts type in a code themselves
              </label>
            </div>
          ) : (
            <p className="text-[12px] font-pmedium text-slate-400">No promo codes yet — add one below.</p>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="CODE (e.g. LAUNCH50)"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium uppercase"
              />
              <select
                value={newPromoDiscountType}
                onChange={(e) => setNewPromoDiscountType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium"
              >
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
              <input
                type="number"
                placeholder={newPromoDiscountType === "percent" ? "e.g. 50" : "e.g. 199"}
                value={newPromoDiscountValue}
                onChange={(e) => setNewPromoDiscountValue(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium"
              />
              <button
                type="button"
                disabled={!newPromoCode || !newPromoDiscountValue || createPromoCodeMutation.isPending}
                onClick={() => createPromoCodeMutation.mutate()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-pmedium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <Plus size={12} />
                Add Code
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={newPromoDuration}
                onChange={(e) => setNewPromoDuration(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium sm:col-span-2"
              >
                <option value="once">Once — first charge only, then full price</option>
                <option value="repeating">Repeating — discount the first N months</option>
                <option value="forever">Forever — discount every future charge</option>
              </select>
              {newPromoDuration === "repeating" ? (
                <input
                  type="number"
                  min={1}
                  placeholder="Months"
                  value={newPromoDurationInMonths}
                  onChange={(e) => setNewPromoDurationInMonths(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-[13px] font-pmedium text-slate-700">
            Custom Plan Add-Ons — Modules &amp; Department Bundles
          </h2>
          <p className="text-[11px] font-pmedium text-slate-500 max-w-3xl">
            "Module" prices a single module id. "Department" prices a whole
            department bundle at a discounted flat rate, charged once instead
            of summing every tab id listed in "Includes" — only when every one
            of those ids is selected for a Custom workspace.
          </p>

          {isLoading ? (
            <p className="text-[12px] font-pmedium text-slate-400">Loading…</p>
          ) : rows.length ? (
            <div className="grid font-pmedium grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {rows.map((row) => (
                <PricingRow
                  key={row.itemId}
                  row={row}
                  onSave={(updated) => upsertRowMutation.mutate(updated)}
                  onDelete={() => deleteRowMutation.mutate(row.itemId)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] font-pmedium text-slate-400">
              No pricing items yet — add one below.
            </p>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-pmedium text-slate-600 mb-2">
              Add pricing for a module or department — picked from the actual
              catalog, not typed by hand.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
              <select
                value={newItemType}
                onChange={(e) => {
                  setNewItemType(e.target.value);
                  setSelectedCatalogId("");
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium"
              >
                <option value="module">Module</option>
                <option value="department">Department Bundle</option>
              </select>
              <select
                value={selectedCatalogId}
                onChange={(e) => setSelectedCatalogId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium sm:col-span-2"
              >
                <option value="">
                  {catalogOptions.length
                    ? "Select a module/department…"
                    : "Nothing left to price — all covered by Professional or already priced"}
                </option>
                {catalogOptions.map((option) => (
                  <option key={option.itemId} value={option.itemId} disabled={option.alreadyPriced}>
                    {option.label}
                    {option.sectionLabel ? ` (${option.sectionLabel})` : ""}
                    {option.alreadyPriced ? " — already priced" : ""}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Price USD / month"
                value={newPriceUsd}
                onChange={(e) => setNewPriceUsd(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-pmedium"
              />
            </div>
            {selectedCatalogEntry?.includesModuleIds?.length ? (
              <p className="text-[10px] text-slate-400 mb-2">
                Bundle covers: {selectedCatalogEntry.includesModuleIds.join(", ")}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!selectedCatalogEntry || newPriceUsd === "" || upsertRowMutation.isPending}
              onClick={() =>
                upsertRowMutation.mutate({
                  itemType: newItemType,
                  itemId: selectedCatalogEntry.itemId,
                  label: selectedCatalogEntry.label,
                  priceUsd: newPriceUsd,
                  includesModuleIds: selectedCatalogEntry.includesModuleIds || [],
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-pmedium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              <Plus size={12} />
              Add Pricing Item
            </button>
          </div>
        </div>
      </div>

      <TrialCompaniesModal
        open={isTrialCompaniesOpen}
        onClose={() => setIsTrialCompaniesOpen(false)}
      />
    </PageFrame>
  );
};

const PricingRow = ({ row, onSave, onDelete }) => {
  const [priceUsd, setPriceUsd] = useState(String(row.priceUsd));
  const dirty = priceUsd !== String(row.priceUsd);

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-200">
      <div className="min-w-0">
        <p className="text-[12px] font-pmedium text-slate-800 truncate">{row.label}</p>
        <p className="text-[10px] text-slate-400 truncate">
          {row.itemType === "department" ? "Department bundle" : "Module"} · {row.itemId}
          {row.includesModuleIds?.length ? ` · includes: ${row.includesModuleIds.join(", ")}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-slate-400 text-[11px]">$</span>
        <input
          type="number"
          value={priceUsd}
          onChange={(e) => setPriceUsd(e.target.value)}
          className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-pmedium text-right"
        />
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave({ ...row, priceUsd })}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-30"
          title="Save"
        >
          <Save size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default PlanPricingSettings;
