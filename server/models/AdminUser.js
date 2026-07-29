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
  password: {
    type: String,
  },
  refreshToken: {
    type: String,
  },
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
});

const AdminUser = mongoose.model("AdminUser", adminUserSchema);
module.exports = AdminUser;
