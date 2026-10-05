const mongoose = require("mongoose");

// Singleton document holding the editable Professional plan prices. Staff
// can change them anytime from Master Panel — nothing here is a hardcoded
// constant in code. Custom plan has NO separate base price: it's always
// this same Professional price plus whatever individually-priced
// modules/department bundles are selected on top (see ModulePricing.js and
// modulePricingService.js's computeCustomPlanMonthlyPrice) — Custom
// literally includes the Professional module set, so it should cost
// Professional's price plus add-ons, never a second independent number.
//
// professionalPlanPriceUsd = monthly rate (e.g. $199).
// professionalAnnualPlanPriceUsd = the discounted PER-MONTH-equivalent rate
// a host pays when they choose yearly billing (e.g. $165). The amount
// actually charged for an annual cycle is this × 12, upfront, for a
// 12-month period. Left null/unset, annual falls back to the monthly price
// (no discount) everywhere it's displayed or charged.
const planPricingSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "default",
      unique: true,
    },
    professionalPlanPriceUsd: {
      type: Number,
      required: true,
      default: 199,
      min: 0,
    },
    professionalAnnualPlanPriceUsd: {
      type: Number,
      default: null,
      min: 0,
    },
    // Master switch for the Professional free-trial offer, plus how long a
    // newly-started trial runs. Changing freeTrialDurationDays only affects
    // trials started after the change — a trial already in progress keeps
    // the day count it started with (its planExpiryDate/trialEndAt were
    // already computed and stored on that start-trial call).
    freeTrialEnabled: {
      type: Boolean,
      default: false,
    },
    freeTrialDurationDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    updatedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.PlanPricingSettings ||
  mongoose.model("PlanPricingSettings", planPricingSettingsSchema);
