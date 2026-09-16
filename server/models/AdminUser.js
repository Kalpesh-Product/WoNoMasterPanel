const mongoose = require("mongoose");

const adminUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  profilePicture: {
    id: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  password: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
  // Last 2 password hashes, used to reject password reuse on reset.
  passwordHistory: [
    {
      hash: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
    },
  ],
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  // Submenu keys this user can see in the Master Panel sidebar.
  // Ignored when isSuperAdmin is true. Keys must match masterPanelModules.js
  // and the `key` on each submenu in client/src/components/Sidebar.jsx.
  allowedModules: {
    type: [String],
    default: [],
  },
  // Login access switch. Superadmins can never be set to false — enforced
  // in adminAccessController.js, not here, since it depends on isSuperAdmin.
  isActive: {
    type: Boolean,
    default: true,
  },
  // When true, this admin's email is also granted special access on the
  // Nomads site (can see all countries/states and isPublic:false listings).
  // Kept in sync with the Nomads backend's SpecialAccessUser collection by
  // updateAdminUserAccess in adminAccessController.js.
  canViewPrivateNomadListings: {
    type: Boolean,
    default: false,
  },
  // Per-user progress for driver.js page guides, keyed by tour id.
  // See client/src/tours/usePageTour.js.
  tourProgress: {
    type: Map,
    of: new mongoose.Schema(
      {
        version: { type: Number, required: true, min: 1 },
        status: {
          type: String,
          enum: ["completed", "skipped"],
          required: true,
        },
        updatedAt: { type: Date, default: Date.now },
      },
      { _id: false },
    ),
    default: {},
  },
});

const AdminUser = mongoose.model("AdminUser", adminUserSchema);
module.exports = AdminUser;
