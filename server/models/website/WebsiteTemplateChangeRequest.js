const mongoose = require("mongoose");

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: null },
    note: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false },
);

const websiteTemplateChangeRequestSchema = new mongoose.Schema(
  {
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebsiteTemplate",
      required: true,
      index: true,
    },
    companyId: { type: String, required: true, trim: true, index: true },
    workspaceId: { type: String, required: true, trim: true, index: true },
    companyName: { type: String, trim: true, default: "" },
    currentTemplateId: { type: String, required: true, trim: true },
    requestedTemplateId: { type: String, required: true, trim: true },
    requestSource: {
      type: String,
      enum: ["host", "master"],
      default: "host",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    planAtRequest: {
      type: String,
      enum: ["basic", "professional", "custom"],
      default: "basic",
    },
    limitPeriodAtRequest: {
      type: String,
      enum: ["monthly", "lifetime"],
      default: "monthly",
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      default: null,
    },
    requestedByName: { type: String, trim: true, default: "", maxlength: 140 },
    requestedByEmail: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: "", maxlength: 500 },
    completedBy: { type: String, default: null },
    completedAt: { type: Date, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  {
    timestamps: true,
    collection: "website_template_change_requests",
  },
);

websiteTemplateChangeRequestSchema.index(
  { websiteId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "one_active_template_change_per_website",
  },
);
websiteTemplateChangeRequestSchema.index({ workspaceId: 1, createdAt: -1 });
websiteTemplateChangeRequestSchema.index({ companyId: 1, createdAt: -1 });

module.exports =
  mongoose.models.WebsiteTemplateChangeRequest ||
  mongoose.model("WebsiteTemplateChangeRequest", websiteTemplateChangeRequestSchema);
