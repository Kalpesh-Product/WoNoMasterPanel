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
    previousPlan: {
      type: String,
      trim: true,
      default: "",
    },
    paymentStatus: {
      type: Boolean,
      default: false,
    },
    paymentLinkUrl: {
      type: String,
      trim: true,
      default: "",
    },
    paymentLinkSentAt: {
      type: Date,
      default: null,
    },
    paymentConfirmedAt: {
      type: Date,
      default: null,
    },
    upgradeSuccessSentAt: {
      type: Date,
      default: null,
    },
    upgradeStatus: {
      type: String,
      trim: true,
      default: "requested",
    },
    trialStartAt: {
      type: Date,
      default: null,
    },
    trialEndAt: {
      type: Date,
      default: null,
    },
    isTrialActive: {
      type: Boolean,
      default: false,
    },
    hasUsedTrial: {
      type: Boolean,
      default: false,
    },
    subscriptionStatus: {
      type: String,
      trim: true,
      default: "",
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
    linkedNomadsCompanyId: {
      type: String,
      trim: true,
      default: "",
    },
    // Set when the host requests staff to create a matching Companies-page
    // entry for the listing(s) they've already added themselves from HostPanel.
    companiesListingRequestedAt: {
      type: Date,
      default: null,
    },
    // Which product types (normalized, e.g. "coworking") the host asked to
    // have activated — approval activates listings of these types and
    // deactivates every other listing under the company.
    companiesListingRequestedTypes: {
      type: [String],
      default: [],
    },
    // Host-initiated request to be linked to an existing Companies-page
    // company (whole-company transfer). Approval happens through
    // transferNomadListing, which also flips this to "approved".
    existingCompanyClaim: {
      status: {
        type: String,
        enum: ["", "pending", "approved", "rejected"],
        default: "",
      },
      nomadsCompanyId: { type: String, trim: true, default: "" },
      nomadsCompanyName: { type: String, trim: true, default: "" },
      listingCount: { type: Number, default: 0 },
      fullName: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      mobile: { type: String, trim: true, default: "" },
      role: { type: String, trim: true, default: "" },
      registeredCompanyName: { type: String, trim: true, default: "" },
      documents: {
        type: [{ label: String, url: String, id: String }],
        default: [],
      },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: String, trim: true, default: "" },
      rejectionReason: { type: String, trim: true, default: "" },
    },
    // Every finished (approved / rejected) claim is kept here so staff can see
    // the full history even after a host resubmits a rejected one.
    existingCompanyClaimHistory: {
      type: [
        {
          status: String,
          nomadsCompanyId: String,
          nomadsCompanyName: String,
          listingCount: Number,
          fullName: String,
          email: String,
          mobile: String,
          role: String,
          registeredCompanyName: String,
          documents: [{ label: String, url: String, id: String }],
          requestedAt: Date,
          reviewedAt: Date,
          reviewedBy: String,
          rejectionReason: String,
        },
      ],
      default: [],
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
