const mongoose = require("mongoose");

// Single settings document for the invite flow. Holds the default agreement
// PDF that Signup Leads attaches to every invite, so staff upload it once and
// replace it only when it changes.
const hostInviteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    agreement: {
      url: { type: String, trim: true, default: "" },
      id: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "hostinvitesettings" },
);

module.exports =
  mongoose.models.HostInviteSettings ||
  mongoose.model("HostInviteSettings", hostInviteSettingsSchema);
