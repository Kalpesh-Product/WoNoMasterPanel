const mongoose = require("mongoose");

const hostLeadCompanySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    leadId: {
      type: String,
      index: true,
      sparse: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    registeredEntityName: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    companySize: {
      type: String,
      trim: true,
    },
    companyCity: {
      type: String,
      trim: true,
    },
    companyState: {
      type: String,
      trim: true,
    },
    companyCountry: {
      type: String,
      trim: true,
    },
    companyContinent: {
      type: String,
      trim: true,
    },
    websiteLink: {
      type: String,
      trim: true,
    },
    linkedinURL: {
      type: String,
      trim: true,
    },
    logo: {
      type: { url: String, id: String },
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      trim: true,
    },
    plan: {
      type: String,
      trim: true,
    },
    requestedPlan: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: Boolean,
      default: false,
    },
    comment: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
      default: "signup-lead",
    },
    pocName: {
      type: String,
      trim: true,
    },
    pocEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    pocPhone: {
      type: String,
      trim: true,
    },
    invitedAt: {
      type: Date,
    },
    upgradeInviteSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "hostleadcompanies",
  },
);

const HostLeadCompany = mongoose.model(
  "HostLeadCompany",
  hostLeadCompanySchema,
);

module.exports = HostLeadCompany;
