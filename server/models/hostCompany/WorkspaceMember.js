const mongoose = require("mongoose");

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      required: true,
    },
    role: {
      type: String,
      default: "founder",
      trim: true,
    },
    status: {
      type: String,
      default: "active",
      trim: true,
    },
    departments: {
      type: [String],
      default: [],
    },
    grantedModules: {
      type: [String],
      default: [],
    },
    enabledModules: {
      type: [String],
      default: [],
    },
    isPrimary: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });

const WorkspaceMember =
  mongoose.models.WorkspaceMember ||
  mongoose.model("WorkspaceMember", workspaceMemberSchema);

module.exports = WorkspaceMember;
