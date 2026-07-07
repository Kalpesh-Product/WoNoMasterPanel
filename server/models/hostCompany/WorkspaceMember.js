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
    // Stored as an ObjectId pointing at the shared `roles` collection
    // (HostPanel's Role model: {name, workspaceId, permissions,
    // isSystemRole}) — matches how HostPanel itself writes this field.
    // Deliberately no `ref` here: master panel has its own unrelated
    // internal-staff Role model (models/roles/Roles.js) that happens to
    // share the same collection name/schema-less default, so populating via
    // Mongoose would resolve through the wrong model. Resolve the role name
    // via a raw `roles` collection lookup instead (see
    // resolveMemberRoleNames in hostUserControllers.js).
    role: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
