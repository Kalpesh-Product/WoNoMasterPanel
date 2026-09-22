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

const updatePlanPricingSettings = async ({ professionalPlanPriceUsd, updatedByEmail }) => {
  const settings = await getOrCreatePlanPricingSettings();
  if (professionalPlanPriceUsd != null) settings.professionalPlanPriceUsd = professionalPlanPriceUsd;
  if (updatedByEmail) settings.updatedByEmail = updatedByEmail;
  await settings.save();
  return settings;
};

const getProfessionalPlanPriceUsd = async () => {
  const settings = await getOrCreatePlanPricingSettings();
  return settings.professionalPlanPriceUsd;
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
  const uniqueIds = new Set((Array.isArray(moduleIds) ? moduleIds : []).map(String));
  const [settings, pricingRows] = await Promise.all([
    getOrCreatePlanPricingSettings(),
    ModulePricing.find().lean(),
  ]);

  const departmentRows = pricingRows.filter((row) => row.itemType === "department");
  const moduleRows = pricingRows.filter((row) => row.itemType === "module");
  const modulePriceById = new Map(moduleRows.map((row) => [row.itemId, row.priceUsd]));

  const idsCoveredByDepartmentBundle = new Set();
  let total = settings.professionalPlanPriceUsd;

  for (const dept of departmentRows) {
    const bundleIds = dept.includesModuleIds || [];
    const isFullySelected = bundleIds.length > 0 && bundleIds.every((id) => uniqueIds.has(id));
    if (isFullySelected) {
      total += dept.priceUsd;
      bundleIds.forEach((id) => idsCoveredByDepartmentBundle.add(id));
      idsCoveredByDepartmentBundle.add(dept.itemId);
    }
  }

  for (const id of uniqueIds) {
    if (idsCoveredByDepartmentBundle.has(id)) continue;
    total += modulePriceById.get(id) || 0;
  }

  return Math.round(total * 100) / 100;
};

module.exports = {
  getOrCreatePlanPricingSettings,
  listModulePricing,
  upsertModulePricing,
  deleteModulePricing,
  updatePlanPricingSettings,
  getProfessionalPlanPriceUsd,
  computeCustomPlanMonthlyPrice,
};
