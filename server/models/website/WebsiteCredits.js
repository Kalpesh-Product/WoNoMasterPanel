const mongoose = require("mongoose");

const websiteCreditsSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
      // The pool is per company (all units share the website builder). Legacy
      // rows sometimes stored "<companyId>-<timestamp>"; strip that suffix so
      // every variant of one company maps to the same document.
      set: (value) => {
        const normalized = String(value || "").trim();
        const match = normalized.match(/^(.*)-(\d{10,})$/);
        return match?.[1] || normalized;
      },
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

// ONE credit pool per company: every unit of a company (all created with the
// same companyId) shares one monthly limit, one usage counter and one add-on
// balance against the single website builder. workspaceId on the document is
// informational — the last unit that touched the shared pool.
websiteCreditsSchema.index({ companyId: 1 }, { unique: true });

// Monthly limit is plan-based and staff-editable (Master Panel -> Website
// Credits -> Plan Credit Limits): the live numbers come from
// WebsiteCreditsSettings through creditsForPlan(), never from constants in
// this file. creditsLimit is the snapshot written by syncSubscriptionPlan and
// is only used as a fallback for legacy rows that predate the plan field.
// Mirrors the host panel's WorkspaceSubscription virtuals so both panels
// report identical credit math for the shared website_credits collection.
const { creditsForPlan } = require("../../utils/websiteCredits");

const KNOWN_PLANS = ["basic", "static-free", "professional", "custom"];
const getMonthlyLimit = (doc) => {
  const plan = String(doc.plan || "")
    .trim()
    .toLowerCase();
  if (KNOWN_PLANS.includes(plan)) return creditsForPlan(plan);
  return Number(doc.creditsLimit || 0) > 0
    ? Number(doc.creditsLimit)
    : creditsForPlan("basic");
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
