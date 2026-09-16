const mongoose = require("mongoose");

// One document per Stripe Payment Link attempt (initial payment or a later
// renewal) for a Nomads company-verification request. Mirrors
// models/hostCompany/BookingPaymentLink.js, but keyed to the Nomads
// BusinessVerificationRequest's _id instead of a WoMP-local lead id, since
// the actual lead/company data lives in the sibling Nomads backend.
const verificationPaymentLinkSchema = new mongoose.Schema(
  {
    nomadsRequestId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
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
    tier: {
      type: String,
      enum: ["1m", "3m", "6m", "1y"],
      required: true,
    },
    // The tier that was active right before THIS payment (null for the very
    // first/"initial" payment) — lets the history view show "Existing Plan
    // -> New Plan" per entry without needing to infer it from array order.
    previousTier: {
      type: String,
      enum: ["1m", "3m", "6m", "1y", null],
      default: null,
    },
    isRenewal: {
      type: Boolean,
      default: false,
    },
    // initial = first-ever payment for this request; renewal = same tier as
    // what was active before; upgrade/downgrade = switched to a longer/
    // shorter tier. Drives Master Panel's verified/expired/renewed/
    // changed-plan stats and the payment/confirmation email copy.
    changeType: {
      type: String,
      enum: ["initial", "renewal", "upgrade", "downgrade"],
      required: true,
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
    // The resulting verificationExpiresAt on Nomads' BusinessVerificationRequest
    // after THIS payment was applied (captured from the mark-paid response) —
    // together with paidAt, this is the "start/end date of this specific plan"
    // shown in the confirmation email and the self-serve plan-history list.
    verificationExpiresAt: {
      type: Date,
      default: null,
    },
    // Set only once the Nomads mark-paid call has actually succeeded — kept
    // separate from `status` so the webhook can retry the Nomads sync + the
    // confirmation email independently of Stripe redelivering the event.
    nomadsSyncedAt: {
      type: Date,
      default: null,
    },
    // Populated from the Stripe Invoice created automatically for this
    // Payment Link (invoice_creation enabled at creation time) once the
    // webhook confirms payment — the actual invoice PDF, not a self-generated
    // one, so these come straight from Stripe's own hosted files.
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
    collection: "verificationpaymentlinks",
  },
);

const VerificationPaymentLink = mongoose.model(
  "VerificationPaymentLink",
  verificationPaymentLinkSchema,
);

module.exports = VerificationPaymentLink;
