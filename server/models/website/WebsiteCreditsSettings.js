const mongoose = require("mongoose");

// Singleton document holding the monthly website-edit credit allowance per
// plan. Staff edit these from Master Panel -> Website Credits -> Plan Credit
// Limits; nothing here is a hardcoded constant in code. The website builder
// (credit gate + CreditsIndicator, via /api/subscription) resolves its limit
// from this document, so a change here takes effect on the next sync.
const websiteCreditsSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "default",
      unique: true,
    },
    basicCredits: {
      type: Number,
      default: 5,
      min: 0,
    },
    professionalCredits: {
      type: Number,
      default: 8,
      min: 0,
    },
    customCredits: {
      type: Number,
      default: 12,
      min: 0,
    },
    updatedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true, collection: "website_credits_settings" },
);

module.exports =
  mongoose.models.WebsiteCreditsSettings ||
  mongoose.model("WebsiteCreditsSettings", websiteCreditsSettingsSchema);
