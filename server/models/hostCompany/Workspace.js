const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostCompany",
      default: null,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
    workspaceName: {
      type: String,
      required: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    selectedPlan: {
      type: String,
      enum: ["basic", "professional", "custom"],
    },
    modules: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    enabledModules: {
      type: [String],
      default: [],
    },
    enabledModuleIds: {
      type: [String],
      default: [],
    },
    // Plan billing lifecycle fields, mirrored from HostPanel's real Workspace
    // schema (server/models/Workspace.ts) so master panel's cron/webhook
    // writes actually persist on the shared collection — Mongoose only
    // writes fields declared in the schema doing the write.
    purchasedPlan: {
      type: String,
      enum: ["basic", "professional", "custom", null],
      default: null,
    },
    planStatus: {
      type: String,
      enum: ["none", "active", "expiring_soon", "expired_downgraded"],
      default: "none",
    },
    planStartDate: {
      type: Date,
      default: null,
    },
    planExpiryDate: {
      type: Date,
      default: null,
    },
    planLastPaidAt: {
      type: Date,
      default: null,
    },
    // The billing cycle the current plan is on: monthly (renew every month
    // at the monthly rate) or annual (paid upfront for a 12-month period at
    // the discounted monthly-equivalent rate × 12).
    billingCycle: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    planExpiryWarningSentAt: {
      type: Date,
      default: null,
    },
    preDowngradeEnabledModuleIds: {
      type: [String],
      default: [],
    },
    customPlanModuleIds: {
      type: [String],
      default: [],
    },
    customPlanMonthlyPriceUsd: {
      type: Number,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Soft-delete fields, mirrored from HostPanel's real Workspace schema
    // (server/models/Workspace.ts) so the master panel can read/write them
    // directly on the shared collection.
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    recoveryRequestedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Workspace = mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);

module.exports = Workspace;
