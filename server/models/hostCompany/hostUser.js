const mongoose = require("mongoose");

const hostUserSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostCompany",
      required: true,
    },
    name: {
      type: String,
    },
    password: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    companyId: {
      type: String,
      // unique: true,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    linkedInProfile: {
      type: String,
    },
    languagesSpoken: {
      type: [String],
    },
    address: {
      type: String,
    },
    profileImage: {
      type: String,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const HostUser = mongoose.model("HostUser", hostUserSchema);
module.exports = HostUser;
