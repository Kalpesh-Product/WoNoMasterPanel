const Workspace = require("../models/hostCompany/Workspace");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const {
  listModulePricing,
  upsertModulePricing,
  deleteModulePricing,
  updatePlanPricingSettings,
  getOrCreatePlanPricingSettings,
  getProfessionalPlanPricing,
  getBasicPlanPricing,
  getFreeTrialConfig,
  computeCustomPlanMonthlyPrice,
} = require("../services/modulePricingService");
const { resolveWorkspaceForCompany } = require("./planPaymentControllers");
const { getPriceableCatalog } = require("../config/hostWorkspaceModuleCatalog");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

// PATCH /api/hosts/plan-pricing/settings  { professionalPlanPriceUsd, professionalAnnualPlanPriceUsd, basicPlanPriceUsd?, basicPlanAnnualPriceUsd?, freeTrialEnabled?, freeTrialDurationDays? }
// professionalAnnualPlanPriceUsd is the FULL yearly total (e.g. $1,999/yr)
// for yearly billing (e.g. $165 → the host is charged $1,980 upfront for a
// 12-month cycle). Custom has no separate base price — it's always this
// same Professional price plus whatever add-on modules/departments are
// priced below. freeTrialEnabled/freeTrialDurationDays control the
// Professional free-trial offer (see hostCompanyControllers.startTrial) —
// changing the day count only affects trials started after the change.
const updateBasePricing = async (req, res, next) => {
  try {
    const {
      professionalPlanPriceUsd,
      professionalAnnualPlanPriceUsd,
      basicPlanPriceUsd,
      basicPlanAnnualPriceUsd,
      basicFreeDurationMonths,
      freeTrialEnabled,
      freeTrialDurationDays,
      activeTrialPromotionCodeId,
    } = req.body || {};
    const settings = await updatePlanPricingSettings({
      professionalPlanPriceUsd:
        professionalPlanPriceUsd != null ? Number(professionalPlanPriceUsd) : undefined,
      professionalAnnualPlanPriceUsd:
        professionalAnnualPlanPriceUsd != null
          ? Number(professionalAnnualPlanPriceUsd)
          : undefined,
      basicPlanPriceUsd: basicPlanPriceUsd != null ? Number(basicPlanPriceUsd) : undefined,
      basicPlanAnnualPriceUsd:
        basicPlanAnnualPriceUsd != null ? Number(basicPlanAnnualPriceUsd) : undefined,
      basicFreeDurationMonths:
        basicFreeDurationMonths != null ? Number(basicFreeDurationMonths) : undefined,
      freeTrialEnabled: freeTrialEnabled != null ? Boolean(freeTrialEnabled) : undefined,
      activeTrialPromotionCodeId,
      freeTrialDurationDays:
        freeTrialDurationDays != null ? Number(freeTrialDurationDays) : undefined,
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

// GET /api/hosts/promo-codes — every Stripe Promotion Code on this
// account (test/live matches whichever STRIPE_SECRET_KEY is configured),
// each with its Coupon's discount shape, for the Plan Pricing settings
// page's Trial Promo Code card. Uses the same Stripe secret key already
// configured for every other Stripe call in this app — nothing new to set
// up, and the key never reaches the browser.
const listPromotionCodes = async (req, res, next) => {
  try {
    // The coupon now lives at promotion.coupon, not a top-level `coupon`
    // field — same API change noted in createPromotionCode above.
    const list = await stripe.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] });
    const codes = list.data
      // Deleting a code (deletePromotionCode) removes its Coupon, but the
      // Promotion Code record itself can never be removed from Stripe's
      // list — filter those out so "Delete" actually makes it disappear
      // from this screen instead of lingering as a defunct entry.
      .filter((promotionCode) => promotionCode.promotion?.coupon && !promotionCode.promotion.coupon.deleted)
      .map((promotionCode) => {
        const coupon = promotionCode.promotion.coupon;
        return {
          id: promotionCode.id,
          code: promotionCode.code,
          active: promotionCode.active,
          percentOff: coupon.percent_off ?? null,
          amountOffUsd: coupon.amount_off != null ? coupon.amount_off / 100 : null,
          duration: coupon.duration,
          durationInMonths: coupon.duration_in_months ?? null,
        };
      });
    return res.status(200).json({ codes });
  } catch (error) {
    next(error);
  }
};

// POST /api/hosts/promo-codes  { code, percentOff?, amountOffUsd?, duration?, durationInMonths? }
// Creates the Stripe Coupon (the actual discount rule) and the
// customer-facing Promotion Code together — Stripe requires both; a
// Coupon alone can't be typed into (or auto-applied on) a Checkout page.
const createPromotionCode = async (req, res, next) => {
  try {
    const { code, percentOff, amountOffUsd, duration, durationInMonths } = req.body || {};
    const trimmedCode = String(code || "").trim().toUpperCase();
    if (!trimmedCode) return res.status(400).json({ message: "code is required" });
    const resolvedPercentOff = Number(percentOff);
    const resolvedAmountOffUsd = Number(amountOffUsd);
    const hasPercentOff = Number.isFinite(resolvedPercentOff) && resolvedPercentOff > 0;
    const hasAmountOff = Number.isFinite(resolvedAmountOffUsd) && resolvedAmountOffUsd > 0;
    if (!hasPercentOff && !hasAmountOff) {
      return res.status(400).json({ message: "percentOff or amountOffUsd is required" });
    }

    const resolvedDuration = ["once", "repeating", "forever"].includes(duration) ? duration : "once";
    const coupon = await stripe.coupons.create({
      percent_off: hasPercentOff ? resolvedPercentOff : undefined,
      amount_off: hasAmountOff ? Math.round(resolvedAmountOffUsd * 100) : undefined,
      currency: hasAmountOff ? "usd" : undefined,
      duration: resolvedDuration,
      duration_in_months:
        resolvedDuration === "repeating" ? Math.max(1, Number(durationInMonths) || 1) : undefined,
    });

    // Stripe's promotion_codes endpoint now takes a nested `promotion`
    // object rather than a flat `coupon` field — confirmed against this
    // account's current API version (the flat shape is rejected with
    // "unknown parameter: coupon").
    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: trimmedCode,
    });

    return res.status(200).json({
      message: "Promo code created",
      id: promotionCode.id,
      code: promotionCode.code,
    });
  } catch (error) {
    if (error?.type === "StripeInvalidRequestError") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

// DELETE /api/hosts/promo-codes/:id
// Stripe has no delete for Promotion Codes themselves (by design — a past
// invoice's discount record must never become meaningless), only for the
// Coupon behind one. Deleting that coupon is the practical equivalent:
// the code becomes permanently unusable everywhere, which is as close to
// "delete" as Stripe allows, and matches deleting a coupon already used
// on a past invoice — that invoice's own discount record is a snapshot
// and stays intact either way.
const deletePromotionCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promotionCode = await stripe.promotionCodes.retrieve(id, { expand: ["promotion.coupon"] });
    const couponId = promotionCode.promotion?.coupon?.id;
    if (couponId) {
      try {
        await stripe.coupons.del(couponId);
      } catch (error) {
        // Two promotion codes can share one coupon (e.g. duplicated test
        // codes) — if it's already gone, the goal of this delete (the
        // code is non-functional) is already met, so this isn't a failure.
        if (error?.code !== "resource_missing") throw error;
      }
    }

    const settings = await getOrCreatePlanPricingSettings();
    if (settings.activeTrialPromotionCodeId === id) {
      await updatePlanPricingSettings({ activeTrialPromotionCodeId: "" });
    }
    return res.status(200).json({ message: "Promo code deleted" });
  } catch (error) {
    if (error?.type === "StripeInvalidRequestError") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

// PATCH /api/hosts/promo-codes/:id/active  { active }
// Deactivating (rather than deleting — Stripe Promotion Codes can't be
// deleted) stops it from being applied to any new checkout, auto or typed
// in; it never touches a subscription that already used it.
const setPromotionCodeActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promotionCode = await stripe.promotionCodes.update(id, {
      active: Boolean(req.body?.active),
    });
    // A promo code just turned off should never stay selected as the
    // auto-apply default — leaving it would silently break the next trial
    // checkout (Stripe rejects an inactive promotion code).
    if (!promotionCode.active) {
      const settings = await getOrCreatePlanPricingSettings();
      if (settings.activeTrialPromotionCodeId === id) {
        await updatePlanPricingSettings({ activeTrialPromotionCodeId: "" });
      }
    }
    return res.status(200).json({ message: "Updated", active: promotionCode.active });
  } catch (error) {
    next(error);
  }
};

// GET /api/public/plan-pricing — fully public, no auth. Just the numbers
// public marketing pages (Nomads' AiHostPricing card, HostPanel's
// workspace-setup cards) need to stay in sync with what staff set here,
// without exposing anything else in the pricing model. Returns both rates:
// monthly, plus the full yearly rate for annual billing. Also returns the
// free-trial toggle/duration so HostPanel's upgrade modal can show or hide
// the "Start Free Trial" action without a second round trip.
const getPublicPlanPricing = async (req, res, next) => {
  try {
    const [
      { professionalPlanPriceUsd, professionalAnnualPlanPriceUsd },
      { basicPlanPriceUsd, basicPlanAnnualPriceUsd },
      freeTrialConfig,
    ] = await Promise.all([getProfessionalPlanPricing(), getBasicPlanPricing(), getFreeTrialConfig()]);
    return res.status(200).json({
      professionalPlanPriceUsd,
      professionalAnnualPlanPriceUsd,
      basicPlanPriceUsd,
      basicPlanAnnualPriceUsd,
      ...freeTrialConfig,
    });
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
  listPromotionCodes,
  createPromotionCode,
  setPromotionCodeActive,
  deletePromotionCode,
};
