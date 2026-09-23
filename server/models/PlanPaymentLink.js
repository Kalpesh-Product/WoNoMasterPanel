const mongoose = require("mongoose");

// One document per Stripe Payment Link attempt (initial purchase, renewal,
// or plan change) for a host's core subscription plan. Mirrors
// models/VerificationPaymentLink.js, but keyed to the host's Workspace
// instead of a Nomads verification request.
const planPaymentLinkSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Null for the very first (pre-registration) payment — at that point the
    // host hasn't registered yet, so no Workspace document exists. Populated
    // once the workspace is created (completeWorkspaceSetup, HostPanel) and
    // always present for later renewal/upgrade payments.
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    // The signup lead this payment originated from, when applicable (not set
    // for later in-app renewals/upgrades of an already-onboarded workspace).
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostLeadCompany",
      default: null,
      index: true,
      sparse: true,
    },
    leadName: {
      type: String,
      trim: true,
    },
    leadEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    // Basic never generates a payment link (it's free) — only these two.
    plan: {
      type: String,
      enum: ["professional", "custom"],
      required: true,
    },
    // The plan active right before THIS payment (null for the very first
    // payment) — lets the invoice history show "Basic -> Professional" etc.
    previousPlan: {
      type: String,
      enum: ["basic", "professional", "custom", null],
      default: null,
    },
    // initial = first-ever paid plan purchase; renewal = same plan renewing
    // its monthly cycle; upgrade/downgrade = switched tier.
    changeType: {
      type: String,
      enum: ["initial", "renewal", "upgrade", "downgrade"],
      required: true,
    },
    // Snapshot of the modules priced into this specific link — custom plan
    // only, null for professional.
    customModuleIds: {
      type: [String],
      default: [],
    },
    customPricingBreakdown: {
      basePriceUsd: { type: Number, default: 0 },
      lineItems: {
        type: [
          {
            itemId: { type: String, trim: true },
            label: { type: String, trim: true },
            itemType: { type: String, enum: ["module", "department"], default: "module" },
            priceUsd: { type: Number, default: 0 },
            includesModuleIds: { type: [String], default: [] },
          },
        ],
        default: [],
      },
      totalMonthlyPriceUsd: { type: Number, default: 0 },
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "usd",
    },
    // The billing cycle this specific payment covers: monthly renews every
    // calendar month at the monthly rate; annual charges the (discounted)
    // monthly-equivalent rate × 12 upfront and covers a 12-month period.
    billingCycle: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
      index: true,
    },
    // The monthly cycle this specific payment covers.
    periodStart: {
      type: Date,
      default: null,
    },
    periodEnd: {
      type: Date,
      default: null,
    },
    stripePaymentLinkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripePaymentLinkUrl: {
      type: String,
      required: true,
      trim: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    // Populated from the Stripe Invoice created automatically for this
    // Payment Link (invoice_creation enabled at creation time) once the
    // webhook confirms payment.
    stripeInvoiceId: {
      type: String,
      trim: true,
      default: null,
    },
    invoicePdfUrl: {
      type: String,
      trim: true,
      default: null,
    },
    hostedInvoiceUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "planpaymentlinks",
  },
);

const PlanPaymentLink =
  mongoose.models.PlanPaymentLink || mongoose.model("PlanPaymentLink", planPaymentLinkSchema);

module.exports = PlanPaymentLink;
