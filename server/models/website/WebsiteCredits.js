const mongoose = require("mongoose");

const websiteCreditsSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      default: "default-workspace",
      index: true,
    },
    workspaceName: {
      type: String,
      trim: true,
      default: "Main Workspace",
    },
    creditsLimit: {
      type: Number,
      default: 5,
      min: 0,
    },
    addOnCreditsPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditsResetDate: {
      type: Date,
      default: null,
    },
    plan: {
      type: String,
      trim: true,
      default: "",
    },
    publishedProjectId: {
      type: String,
      trim: true,
      default: "",
    },
    publishedProjectUrl: {
      type: String,
      trim: true,
      default: "",
    },
    credits: {
      type: Number,
      default: 0,
      min: 0,
    },
    updatedAtSource: {
      type: String,
      trim: true,
      default: "master-panel",
    },
  },
  {
    timestamps: true,
    collection: "website_credits",
  },
);

websiteCreditsSchema.index({ companyId: 1, workspaceId: 1 }, { unique: true });

module.exports = mongoose.model("WebsiteCredits", websiteCreditsSchema);
