const mongoose = require("mongoose");

const websiteTemplateVersionSchema = new mongoose.Schema(
  {
    searchKey: { type: String, required: true, index: true },
    companyName: { type: String, default: "" },
    companyId: { type: String, default: "" },
    version: { type: Number, required: true },
    isLatestPublished: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, required: true, default: Date.now },
    templateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    collection: "website_template_versions",
  },
);

websiteTemplateVersionSchema.index({ searchKey: 1, version: 1 }, { unique: true });
websiteTemplateVersionSchema.index(
  { searchKey: 1, isLatestPublished: 1, publishedAt: -1 },
  { name: "latest_published_lookup" },
);

module.exports = mongoose.model(
  "WebsiteTemplateVersion",
  websiteTemplateVersionSchema,
);
