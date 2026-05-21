const mongoose = require("mongoose");

const workspaceAccessSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      trim: true,
      default: "",
    },
    workspaceName: {
      type: String,
      trim: true,
      default: "Main Workspace",
    },
    moduleAccess: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: false,
  },
);

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
    country: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    verticalType: {
      type: [String],
      default: [],
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
    workspaceAccess: {
      type: [workspaceAccessSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const HostUser = mongoose.model("HostUser", hostUserSchema);
module.exports = HostUser;
