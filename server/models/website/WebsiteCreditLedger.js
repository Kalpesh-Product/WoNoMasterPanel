const mongoose = require("mongoose");

// History of website credit movements (used on publish, added via grants).
// Written by both panels into the shared database; keep the schema in sync
// with HostPanel/server/models/WebsiteCreditLedger.ts.
const websiteCreditLedgerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["used", "added"],
      required: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
    },
    sourcePanel: {
      type: String,
      enum: ["master_panel", "host_panel"],
      required: true,
    },
    companyId: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    workspaceId: {
      type: String,
      trim: true,
      default: "",
    },
    workspaceName: {
      type: String,
      trim: true,
      default: "",
    },
    performedById: {
      type: String,
      trim: true,
      default: "",
    },
    performedByName: {
      type: String,
      trim: true,
      default: "",
    },
    performedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    remainingAfter: {
      type: Number,
      default: undefined,
    },
  },
  { timestamps: true, collection: "website_credit_ledger" },
);

websiteCreditLedgerSchema.index({ companyId: 1, createdAt: -1 });
websiteCreditLedgerSchema.index({ workspaceId: 1, createdAt: -1 });
websiteCreditLedgerSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WebsiteCreditLedger", websiteCreditLedgerSchema);
