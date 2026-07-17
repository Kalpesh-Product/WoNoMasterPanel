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

// Monthly limit is plan-based: professional 8, custom 12, basic (and the
// legacy "static-free" label) the base 5. creditsLimit is kept in sync by
// syncSubscriptionPlan and used as a fallback for legacy rows that predate
// the plan field. Mirrors the host panel's WorkspaceSubscription virtuals so
// both panels report identical credit math for the shared website_credits
// collection.
const MONTHLY_BASE_CREDITS = 5;
const PROFESSIONAL_MONTHLY_CREDITS = 8;
const CUSTOM_MONTHLY_CREDITS = 12;
const getMonthlyLimit = (doc) => {
  if (doc.plan === "professional") return PROFESSIONAL_MONTHLY_CREDITS;
  if (doc.plan === "custom") return CUSTOM_MONTHLY_CREDITS;
  return Number(doc.creditsLimit || 0) > 0
    ? Number(doc.creditsLimit)
    : MONTHLY_BASE_CREDITS;
};

websiteCreditsSchema.virtual("monthlyCreditsLimit").get(function () {
  return getMonthlyLimit(this);
});

websiteCreditsSchema.virtual("monthlyCreditsUsed").get(function () {
  return Math.max(0, Math.min(Number(this.creditsUsed || 0), getMonthlyLimit(this)));
});

websiteCreditsSchema.virtual("monthlyCreditsRemaining").get(function () {
  return Math.max(0, getMonthlyLimit(this) - Number(this.creditsUsed || 0));
});

websiteCreditsSchema.virtual("addOnCreditsUsed").get(function () {
  return Math.max(0, Number(this.creditsUsed || 0) - getMonthlyLimit(this));
});

websiteCreditsSchema.virtual("addOnCreditsRemaining").get(function () {
  const purchased = Number(this.addOnCreditsPurchased || 0);
  const consumed = Math.max(0, Number(this.creditsUsed || 0) - getMonthlyLimit(this));
  return Math.max(0, purchased - consumed);
});

websiteCreditsSchema.virtual("effectiveCreditsLimit").get(function () {
  return getMonthlyLimit(this) + Number(this.addOnCreditsPurchased || 0);
});

websiteCreditsSchema.virtual("creditsRemaining").get(function () {
  return Math.max(0, this.effectiveCreditsLimit - Number(this.creditsUsed || 0));
});

module.exports = mongoose.model("WebsiteCredits", websiteCreditsSchema);
