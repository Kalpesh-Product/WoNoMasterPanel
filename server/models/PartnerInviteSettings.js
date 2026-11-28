const mongoose = require("mongoose");

// Single settings document for the Value Adds Partner invite flow — same
// one-PDF-reused-for-every-invite pattern as HostInviteSettings.
const partnerInviteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    agreement: {
      url: { type: String, trim: true, default: "" },
      id: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, collection: "partnerinvitesettings" },
);

module.exports =
  mongoose.models.PartnerInviteSettings ||
  mongoose.model("PartnerInviteSettings", partnerInviteSettingsSchema);
