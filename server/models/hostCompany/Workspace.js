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
