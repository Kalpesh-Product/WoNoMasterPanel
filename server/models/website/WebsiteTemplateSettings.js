const mongoose = require("mongoose");

const templateAvailabilitySchema = new mongoose.Schema(
  {
    templateId: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    allowedPlans: {
      type: [String],
      enum: ["basic", "professional", "custom"],
      default: ["basic", "professional", "custom"],
    },
    disabledReason: { type: String, trim: true, default: "Coming soon" },
  },
  { _id: false },
);

const websiteTemplateSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true, trim: true },
    limitPeriod: {
      type: String,
      enum: ["monthly", "lifetime"],
      default: "monthly",
    },
    planChangeLimits: {
      basic: { type: Number, min: 0, default: 1 },
      professional: { type: Number, min: 0, default: 2 },
      custom: { type: Number, min: 0, default: 3 },
    },
    templates: { type: [templateAvailabilitySchema], default: [] },
    updatedBy: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: "website_template_settings",
  },
);

module.exports =
  mongoose.models.WebsiteTemplateSettings ||
  mongoose.model("WebsiteTemplateSettings", websiteTemplateSettingsSchema);
