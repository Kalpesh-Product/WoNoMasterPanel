const mongoose = require("mongoose");

const screenshotSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    width: { type: Number, min: 0, default: 0 },
    height: { type: Number, min: 0, default: 0 },
    format: { type: String, trim: true, default: "webp" },
  },
  { _id: false },
);

const websiteThemeCatalogSchema = new mongoose.Schema(
  {
    templateId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    vertical: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    swatch: {
      bg: { type: String, trim: true, default: "#ffffff" },
      fg: { type: String, trim: true, default: "#111111" },
      accent: { type: String, trim: true, default: "#0aa9ef" },
      font: { type: String, trim: true, default: "'Poppins', sans-serif" },
    },
    desktopScreenshot: { type: screenshotSchema, default: () => ({}) },
    mobileScreenshot: { type: screenshotSchema, default: () => ({}) },
    externalDemoUrl: { type: String, trim: true, default: "" },
    enabled: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    // Shown in the "free templates" teaser on host.wono.co's homepage —
    // admin picks which ones via the catalog instead of a hardcoded list.
    showOnHostHome: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, index: true },
    disabledReason: { type: String, trim: true, default: "Coming soon", maxlength: 200 },
    updatedBy: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: "website_theme_catalog",
  },
);

websiteThemeCatalogSchema.index({ visible: 1, sortOrder: 1, createdAt: 1 });

module.exports =
  mongoose.models.WebsiteThemeCatalog ||
  mongoose.model("WebsiteThemeCatalog", websiteThemeCatalogSchema);
