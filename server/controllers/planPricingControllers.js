const Workspace = require("../models/hostCompany/Workspace");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const {
  listModulePricing,
  upsertModulePricing,
  deleteModulePricing,
  updatePlanPricingSettings,
  getOrCreatePlanPricingSettings,
  computeCustomPlanMonthlyPrice,
} = require("../services/modulePricingService");
const { resolveWorkspaceForCompany } = require("./planPaymentControllers");
const { getPriceableCatalog } = require("../config/hostWorkspaceModuleCatalog");

// GET /api/hosts/plan-pricing/catalog — the real modules/departments staff
// can price as Custom-plan add-ons, derived from the actual module catalog
// (hostWorkspaceModuleCatalog.js) rather than typed by hand. Cross-referenced
// against already-priced rows so the settings page can grey those out.
const getPricingCatalog = async (req, res, next) => {
  try {
    const [{ modules, departments }, existingRows] = await Promise.all([
      Promise.resolve(getPriceableCatalog()),
      listModulePricing(),
    ]);
    const pricedIds = new Set(existingRows.map((row) => row.itemId));
    return res.status(200).json({
      modules: modules.map((m) => ({ ...m, alreadyPriced: pricedIds.has(m.itemId) })),
      departments: departments.map((d) => ({ ...d, alreadyPriced: pricedIds.has(d.itemId) })),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/hosts/plan-pricing — staff Plan Pricing settings page: base
// prices + every module/department pricing row, all live-editable, nothing
// hardcoded in code.
const getPlanPricing = async (req, res, next) => {
  try {
    const [settings, rows] = await Promise.all([
      getOrCreatePlanPricingSettings(),
      listModulePricing(),
    ]);
    return res.status(200).json({ settings, rows });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/hosts/plan-pricing/settings  { professionalPlanPriceUsd }
// Custom has no separate base price — it's always this same Professional
// price plus whatever add-on modules/departments are priced below.
const updateBasePricing = async (req, res, next) => {
  try {
    const { professionalPlanPriceUsd } = req.body || {};
    const settings = await updatePlanPricingSettings({
      professionalPlanPriceUsd:
        professionalPlanPriceUsd != null ? Number(professionalPlanPriceUsd) : undefined,
      updatedByEmail: req.user?.email || req.body?.updatedByEmail || "",
    });
    return res.status(200).json({ message: "Base plan pricing updated", settings });
  } catch (error) {
    next(error);
  }
};

// PUT /api/hosts/plan-pricing/:itemId  { itemType, label, priceUsd, includesModuleIds? }
// Staff can change any module/department price anytime — this is the only
// place a Custom-plan add-on's amount is set.
const upsertPricingItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { itemType, label, priceUsd, includesModuleIds } = req.body || {};
    if (!["module", "department"].includes(itemType)) {
      return res.status(400).json({ message: "itemType must be 'module' or 'department'" });
    }
    if (!Number.isFinite(Number(priceUsd)) || Number(priceUsd) < 0) {
      return res.status(400).json({ message: "priceUsd must be a non-negative number" });
    }
    const row = await upsertModulePricing({
      itemType,
      itemId,
      label,
      priceUsd: Number(priceUsd),
      includesModuleIds,
      updatedByEmail: req.user?.email || req.body?.updatedByEmail || "",
    });
    return res.status(200).json({ message: "Pricing saved", row });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/hosts/plan-pricing/:itemId
const removePricingItem = async (req, res, next) => {
  try {
    await deleteModulePricing(req.params.itemId);
    return res.status(200).json({ message: "Pricing item removed" });
  } catch (error) {
    next(error);
  }
};

// POST /api/hosts/custom-plan-modules  { companyId, customModuleIds }
// Staff sets/edits a Custom workspace's module selection. This recomputes
// and stores the DISPLAY price for the next renewal — it never charges
// anything by itself; the amount actually charged is whatever
// createAndSendPlanPaymentLink computes at the moment a payment link is
// generated for that next cycle.
const setCustomPlanModules = async (req, res, next) => {
  try {
    const { companyId, companyName, customModuleIds } = req.body || {};
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    if (!Array.isArray(customModuleIds)) {
      return res.status(400).json({ message: "customModuleIds must be an array" });
    }

    const price = await computeCustomPlanMonthlyPrice(customModuleIds);
    const workspace = await resolveWorkspaceForCompany({ companyId, companyName });
    if (workspace) {
      await Workspace.updateOne(
        { _id: workspace._id },
        { $set: { customPlanModuleIds: customModuleIds, customPlanMonthlyPriceUsd: price } },
      );
    } else {
      // Not registered yet — remember the selection on the lead row so it
      // carries over once the workspace is actually created.
      await HostLeadCompany.updateOne(
        { companyId: String(companyId).trim() },
        { $set: { customPlanModuleIds: customModuleIds } },
      );
    }

    return res.status(200).json({
      message: "Custom plan modules updated",
      customModuleIds,
      nextRenewalPriceUsd: price,
      appliedToWorkspace: Boolean(workspace),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/plan-pricing — fully public, no auth. Just the one number
// public marketing pages (Nomads' AiHostPricing card, HostPanel's
// workspace-setup cards) need to stay in sync with what staff set here,
// without exposing anything else in the pricing model.
const getPublicPlanPricing = async (req, res, next) => {
  try {
    const settings = await getOrCreatePlanPricingSettings();
    return res.status(200).json({ professionalPlanPriceUsd: settings.professionalPlanPriceUsd });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlanPricing,
  getPricingCatalog,
  getPublicPlanPricing,
  updateBasePricing,
  upsertPricingItem,
  removePricingItem,
  setCustomPlanModules,
};
