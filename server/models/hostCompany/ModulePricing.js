const mongoose = require("mongoose");

// Staff-editable pricing for Custom-plan add-ons — no amount here is
// hardcoded in code; every row is a document staff can change anytime from
// Master Panel's Plan Pricing settings page.
//
// itemType "module": a single module id priced on its own.
// itemType "department": a whole department bundle (e.g. HR Department),
// priced at a flat (usually discounted) rate that's charged ONCE instead of
// summing every module/tab id in `includesModuleIds` individually, whenever
// a Custom workspace has all of those ids selected.
const modulePricingSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["module", "department"],
      required: true,
    },
    itemId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    priceUsd: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Department bundles only — the individual module/tab ids this price
    // covers. Left empty for itemType "module".
    includesModuleIds: {
      type: [String],
      default: [],
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
  mongoose.models.ModulePricing || mongoose.model("ModulePricing", modulePricingSchema);
