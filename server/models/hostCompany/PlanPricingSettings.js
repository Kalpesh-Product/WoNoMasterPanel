const mongoose = require("mongoose");

// Singleton document holding the editable Professional plan price. Staff
// can change it anytime from Master Panel — nothing here is a hardcoded
// constant in code. Custom plan has NO separate base price: it's always
// this same Professional price plus whatever individually-priced
// modules/department bundles are selected on top (see ModulePricing.js and
// modulePricingService.js's computeCustomPlanMonthlyPrice) — Custom
// literally includes the Professional module set, so it should cost
// Professional's price plus add-ons, never a second independent number.
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
