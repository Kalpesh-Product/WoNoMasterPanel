const mongoose = require("mongoose");

const bookingPaymentLinkSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    leadEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    leadName: {
      type: String,
      trim: true,
    },
    bookingId: {
      type: String,
      trim: true,
      default: "",
    },
    registrationId: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    productType: {
      type: String,
      trim: true,
    },
    serviceType: {
      type: String,
      enum: ["meeting-room", "hostel", "co-living", "booking"],
      default: "booking",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    noOfPeople: {
      type: Number,
      default: null,
    },
    startTime: { type: String, trim: true, default: "" },
    endTime: { type: String, trim: true, default: "" },
    unitRate: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    durationUnit: { type: String, trim: true, default: "" },
    subtotalAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    baseAmount: { type: Number, default: 0, min: 0 },
    platformFeePercent: { type: Number, default: 0, min: 0 },
    platformFeeAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    // "booking" = a real coworking/meeting-room booking (All Enquiry page).
    // "plan_subscription" = a lead paying to subscribe to the HostPanel SaaS
    // platform (Signup Leads page) — these need different confirmation copy,
    // since a plan subscriber isn't "booking" anything.
    paymentType: {
      type: String,
      enum: ["booking", "plan_subscription"],
      default: "booking",
    },
    description: {
      type: String,
      trim: true,
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
    // A real Stripe Invoice object, created on-demand (idempotent — see
    // getBookingReceipt) and immediately marked paid out-of-band, since the
    // money was already collected through the Payment Link above. Gives a
    // genuine hosted_invoice_url/invoice_pdf, not just a Charge receipt.
    stripeInvoiceId: { type: String, trim: true, default: "" },
    stripeInvoiceUrl: { type: String, trim: true, default: "" },
    stripeInvoicePdf: { type: String, trim: true, default: "" },
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
  },
  {
    timestamps: true,
    collection: "bookingpaymentlinks",
  },
);

const BookingPaymentLink = mongoose.model(
  "BookingPaymentLink",
  bookingPaymentLinkSchema,
);

module.exports = BookingPaymentLink;
