const mongoose = require("mongoose");

const moduleAccessLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      trim: true,
      default: "",
    },
    actorName: {
      type: String,
      trim: true,
      default: "Unknown",
    },
    actorEmail: {
      type: String,
      trim: true,
      default: "",
    },
    sourcePanel: {
      type: String,
      enum: ["master_panel", "host_panel"],
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      enum: ["user", "workspace"],
      required: true,
    },
    targetId: {
      type: String,
      trim: true,
      default: "",
    },
    targetName: {
      type: String,
      trim: true,
      default: "",
    },
    companyId: {
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
    enabledModules: {
      type: [String],
      default: [],
    },
    disabledModules: {
      type: [String],
      default: [],
    },
    enabledCount: {
      type: Number,
      default: 0,
    },
    disabledCount: {
      type: Number,
      default: 0,
    },
    changes: {
      type: Object,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

const ModuleAccessLog = mongoose.model("ModuleAccessLog", moduleAccessLogSchema);

module.exports = ModuleAccessLog;
