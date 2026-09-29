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
    // Billing cycle the host picked (or staff defaulted to) for the plan
    // request: monthly renews monthly; annual charges the discounted
    // monthly-equivalent rate × 12 upfront for a 12-month cycle.
    billingCycle: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
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
    // A staff-granted extra trial window for THIS company specifically —
    // separate from the normal one-time freeTrialEnabled/hasUsedTrial flow,
    // so it still works after hasUsedTrial is already permanently true.
    // Surfaced on the host's dashboard as a claimable offer while `active`
    // is true and `claimedAt` is unset; claiming extends trialEndAt by
    // `durationDays` and flips it back off so it can't be claimed twice.
    bonusTrialOffer: {
      active: { type: Boolean, default: false },
      durationDays: { type: Number, default: 30 },
      setAt: { type: Date, default: null },
      setByEmail: { type: String, trim: true, default: "" },
      claimedAt: { type: Date, default: null },
    },
    // Set the moment invite becomes eligible: at lead-approval time for
    // Basic (no payment required), at plan-payment-webhook time for
    // Professional/Custom. The invite gate checks THIS, not paymentStatus
    // directly, so Basic never needs a fake "paid" state.
    inviteUnlockedAt: {
      type: Date,
      default: null,
    },
    // Custom-plan module selection made before the workspace exists (staff
    // picks these pre-registration); carried over onto Workspace at
    // registration time (completeWorkspaceSetup, HostPanel).
    customPlanModuleIds: {
      type: [String],
      default: [],
    },
    // Per-line price overrides staff can enter for a Custom-plan quote
    // (e.g. HR bundle priced at $50 but negotiated down to $40) — keyed by
    // the same itemId used in customPlanModuleIds/ModulePricing. Plain
    // object (not Schema.Types.Map) so it survives .lean() reads unchanged.
    // Only affects THIS lead's payment link/invoice, never the shared Plan
    // Pricing settings.
    customPlanModulePriceOverrides: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Flat $ discount applied on top of the (already line-discounted)
    // subtotal for this lead's Custom-plan quote.
    customPlanOverallDiscountUsd: {
      type: Number,
      default: 0,
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
    // The wono.co company this lead asked to verify (from the listing's Verify
    // Business button). A suggestion only — linkedNomadsCompanyId is what links.
    suggestedNomadsCompanyId: { type: String, trim: true, default: "" },
    // Agreement PDF staff attached to the invite email. HostPanel shows it (with
    // an "I agree" checkbox) on the Create Business Location step, so it is the
    // agreement the host accepts — see agreementAcceptance below.
    agreementDocument: {
      url: { type: String, trim: true, default: "" },
      id: { type: String, trim: true, default: "" },
      name: { type: String, trim: true, default: "" },
      sentAt: { type: Date, default: null },
    },
    // Written by HostPanel's completeWorkspaceSetup when the host finishes
    // Create Business Location: the checkbox acceptance plus whatever they
    // uploaded (signed copy of the agreement, any business documents).
    agreementAcceptance: {
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
      acceptedByName: { type: String, trim: true, default: "" },
      acceptedByEmail: { type: String, trim: true, default: "" },
      agreementUrl: { type: String, trim: true, default: "" },
      signedDocument: {
        url: { type: String, trim: true, default: "" },
        id: { type: String, trim: true, default: "" },
        name: { type: String, trim: true, default: "" },
      },
      businessDocuments: {
        type: [{ url: String, id: String, name: String }],
        default: [],
      },
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
