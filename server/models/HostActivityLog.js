const mongoose = require("mongoose");

// Read-side model for host panel activity. Documents are written by the host
// panel backend (HostPanel/server/models/HostActivityLog.ts) into the shared
// database; keep the schema in sync with that file.
const hostActivityLogSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: "Unknown",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    module: {
      type: String,
      trim: true,
      default: "",
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
    method: {
      type: String,
    },
    statusCode: {
      type: Number,
    },
    success: {
      type: Boolean,
    },
    payload: {
      type: Object,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
    responseTime: {
      type: Number, // milliseconds
    },
  },
  { timestamps: true },
);

hostActivityLogSchema.index({ companyId: 1, createdAt: -1 });
hostActivityLogSchema.index({ workspaceId: 1, createdAt: -1 });
hostActivityLogSchema.index({ createdAt: -1 });

const HostActivityLog = mongoose.model(
  "HostActivityLog",
  hostActivityLogSchema,
);

module.exports = HostActivityLog;
