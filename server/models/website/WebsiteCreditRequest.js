const mongoose = require("mongoose");

const websiteCreditRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      set: (value) => {
        const normalized = String(value || "").trim();
        const match = normalized.match(/^(.*)-(\d{10,})$/);
        return match?.[1] ? match[1] : normalized;
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
    creditsRequested: {
      type: Number,
      required: true,
      min: 1,
    },
    requestedCredits: {
      type: Number,
      default: null,
      min: 1,
    },
    pricePerCredit: {
      type: Number,
      default: 50,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    requestedBy: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      userId: { type: String, trim: true, default: "" },
    },
    requestedByName: {
      type: String,
      trim: true,
      default: "",
    },
    requestedByUserId: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewReason: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      userId: { type: String, trim: true, default: "" },
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      userId: { type: String, trim: true, default: "" },
    },
    paymentLinkUrl: {
      type: String,
      trim: true,
      default: "",
    },
    paymentLinkSentAt: {
      type: Date,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "unpaid", "failed"],
      default: "pending",
      index: true,
    },
    paymentMarkedAt: {
      type: Date,
      default: null,
    },
    creditsAddedAt: {
      type: Date,
      default: null,
    },
    creditsGrantProcessingAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "websitecreditsrequests",
  },
);

websiteCreditRequestSchema.pre("validate", function syncLegacyFields(next) {
  const credits = Number(this.creditsRequested || this.requestedCredits || 0);
  if (Number.isFinite(credits) && credits > 0) {
    this.creditsRequested = credits;
    this.requestedCredits = credits;
  }

  const safePrice = Number(this.pricePerCredit);
  const price = Number.isFinite(safePrice) && safePrice >= 0 ? safePrice : 0;
  this.pricePerCredit = price;
  this.totalAmount = Number(this.creditsRequested || 0) * price;

  this.requestedByName = String(this?.requestedBy?.name || this.requestedByName || "").trim();
  this.requestedByUserId = String(
    this?.requestedBy?.userId || this.requestedByUserId || "",
  ).trim();

  if (!this.requestedAt && this.createdAt) {
    this.requestedAt = this.createdAt;
  }

  next();
});

module.exports = mongoose.model(
  "WebsiteCreditRequest",
  websiteCreditRequestSchema,
);
