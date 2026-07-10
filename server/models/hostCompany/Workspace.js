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
  },
  { timestamps: true },
);

const Workspace = mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);

module.exports = Workspace;
