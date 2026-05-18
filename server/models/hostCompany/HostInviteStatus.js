const mongoose = require("mongoose");

const hostInviteStatusSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    inviteStatus: {
      type: String,
      enum: ["not_invited", "invite_sent", "registered", "joined"],
      default: "not_invited",
    },
    inviteSentAt: {
      type: Date,
      default: null,
    },
    registeredAt: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const HostInviteStatus = mongoose.model(
  "HostInviteStatus",
  hostInviteStatusSchema,
);
module.exports = HostInviteStatus;

