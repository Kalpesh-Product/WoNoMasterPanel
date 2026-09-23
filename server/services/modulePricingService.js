const ModulePricing = require("../models/hostCompany/ModulePricing");
const PlanPricingSettings = require("../models/hostCompany/PlanPricingSettings");

const getOrCreatePlanPricingSettings = async () => {
  let settings = await PlanPricingSettings.findOne({ singletonKey: "default" });
  if (!settings) {
    settings = await PlanPricingSettings.create({ singletonKey: "default" });
  }
  return settings;
};

const listModulePricing = () =>
  ModulePricing.find().sort({ itemType: 1, label: 1 }).lean();

const upsertModulePricing = async ({
  itemType,
  itemId,
  label,
  priceUsd,
  includesModuleIds,
  updatedByEmail,
}) => {
  if (!itemId) throw new Error("itemId is required");
  return ModulePricing.findOneAndUpdate(
    { itemId },
    {
      $set: {
        itemType,
        label,
        priceUsd,
        includesModuleIds: Array.isArray(includesModuleIds) ? includesModuleIds : [],
        updatedByEmail: updatedByEmail || "",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

const deleteModulePricing = (itemId) => ModulePricing.deleteOne({ itemId });

const updatePlanPricingSettings = async ({
  professionalPlanPriceUsd,
  professionalAnnualPlanPriceUsd,
  updatedByEmail,
}) => {
  const settings = await getOrCreatePlanPricingSettings();
  if (professionalPlanPriceUsd != null) settings.professionalPlanPriceUsd = professionalPlanPriceUsd;
  if (professionalAnnualPlanPriceUsd != null) {
    settings.professionalAnnualPlanPriceUsd = professionalAnnualPlanPriceUsd;
  }
  if (updatedByEmail) settings.updatedByEmail = updatedByEmail;
  await settings.save();
  return settings;
};

const getProfessionalPlanPriceUsd = async () => {
  const settings = await getOrCreatePlanPricingSettings();
  return settings.professionalPlanPriceUsd;
};

// The FULL yearly total for an annual cycle (e.g. $1,999/yr). Falls back to
// 12× the monthly rate (i.e. no discount) when staff hasn't set one, so
// display/number-crunching never breaks on an unset value.
const getProfessionalAnnualPlanPriceUsd = async () => {
  const settings = await getOrCreatePlanPricingSettings();
  const annual = Number(settings.professionalAnnualPlanPriceUsd);
  return Number.isFinite(annual) && annual > 0
    ? annual
    : Math.round(
        Number(settings.professionalPlanPriceUsd) *
          MONTHS_PER_BILLING_CYCLE *
          100,
      ) / 100;
};

// Both rates in one call for public endpoints that serve the pricing cards.
const getProfessionalPlanPricing = async () => {
  const settings = await getOrCreatePlanPricingSettings();
  const annual = Number(settings.professionalAnnualPlanPriceUsd);
  return {
    professionalPlanPriceUsd: settings.professionalPlanPriceUsd,
    // Number(null) is 0 and Number.isFinite(0) is true, so the > 0 guard is
    // what stops an unset (null) field from leaking "$0" to public pages.
    professionalAnnualPlanPriceUsd:
      Number.isFinite(annual) && annual > 0
        ? annual
        : settings.professionalPlanPriceUsd,
  };
};

// Multiplier applied to a monthly figure when billing annually.
const MONTHS_PER_BILLING_CYCLE = 12;

const buildCustomPlanPricingBreakdownFromRows = ({ moduleIds = [], settings, pricingRows }) => {
  const uniqueIds = new Set((Array.isArray(moduleIds) ? moduleIds : []).map(String));
  const departmentRows = pricingRows.filter((row) => row.itemType === "department");
  const moduleRows = pricingRows.filter((row) => row.itemType === "module");
  const moduleById = new Map(moduleRows.map((row) => [row.itemId, row]));

  const idsCoveredByDepartmentBundle = new Set();
  const lineItems = [];
  let total = Number(settings.professionalPlanPriceUsd || 0);

  for (const dept of departmentRows) {
    const bundleIds = dept.includesModuleIds || [];
    const isDirectlySelected = uniqueIds.has(dept.itemId);
    const isFullySelected = bundleIds.length > 0 && bundleIds.every((id) => uniqueIds.has(id));
    if (isDirectlySelected || isFullySelected) {
      lineItems.push({
        itemId: dept.itemId,
        label: dept.label || dept.itemId,
        itemType: "department",
        priceUsd: Number(dept.priceUsd || 0),
        includesModuleIds: bundleIds,
      });
      total += Number(dept.priceUsd || 0);
      bundleIds.forEach((id) => idsCoveredByDepartmentBundle.add(id));
      idsCoveredByDepartmentBundle.add(dept.itemId);
    }
  }

  for (const id of uniqueIds) {
    if (idsCoveredByDepartmentBundle.has(id)) continue;
    const row = moduleById.get(id);
    if (!row) continue;
    lineItems.push({
      itemId: row.itemId,
      label: row.label || row.itemId,
      itemType: "module",
      priceUsd: Number(row.priceUsd || 0),
      includesModuleIds: [],
    });
    total += Number(row.priceUsd || 0);
  }

  return {
    basePriceUsd: Number(settings.professionalPlanPriceUsd || 0),
    lineItems,
    totalMonthlyPriceUsd: Math.round(total * 100) / 100,
  };
};

// Computes a Custom plan's live monthly price: the SAME Professional plan
// price (Custom includes the full Professional module set, so it starts
// from that same number, never a separately-set "Custom base price") plus
// selected add-on modules, preferring a department's discounted bundle
// price over summing its individual module ids whenever every id in that
// bundle is selected. Always reads current staff-set prices from the DB —
// nothing is cached or hardcoded, so a mid-cycle price change (to either
// the Professional price or any add-on) is reflected the next time this is
// called (e.g. for the next renewal link), never retroactively on a
// payment link/invoice that's already been created.
const computeCustomPlanMonthlyPrice = async (moduleIds = []) => {
  const [settings, pricingRows] = await Promise.all([
    getOrCreatePlanPricingSettings(),
    ModulePricing.find().lean(),
  ]);

  return buildCustomPlanPricingBreakdownFromRows({ moduleIds, settings, pricingRows })
    .totalMonthlyPriceUsd;
};

const getCustomPlanPricingBreakdown = async (moduleIds = []) => {
  const [settings, pricingRows] = await Promise.all([
    getOrCreatePlanPricingSettings(),
    ModulePricing.find().lean(),
  ]);
  return buildCustomPlanPricingBreakdownFromRows({ moduleIds, settings, pricingRows });
};

// Total due for a single billing cycle of a Custom plan: the monthly figure
// for monthly billing, or 12× that when the host picked yearly billing.
const computeCustomPlanPrice = async (moduleIds = [], billingCycle = "monthly") => {
  const monthly = await computeCustomPlanMonthlyPrice(moduleIds);
  return String(billingCycle || "").toLowerCase() === "annual"
    ? Math.round(monthly * MONTHS_PER_BILLING_CYCLE * 100) / 100
    : monthly;
};

module.exports = {
  getOrCreatePlanPricingSettings,
  listModulePricing,
  upsertModulePricing,
  deleteModulePricing,
  updatePlanPricingSettings,
  getProfessionalPlanPriceUsd,
  getProfessionalAnnualPlanPriceUsd,
  getProfessionalPlanPricing,
  getCustomPlanPricingBreakdown,
  computeCustomPlanMonthlyPrice,
  computeCustomPlanPrice,
};
