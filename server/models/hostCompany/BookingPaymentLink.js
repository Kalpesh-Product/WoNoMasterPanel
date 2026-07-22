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
    companyName: {
      type: String,
      trim: true,
    },
    productType: {
      type: String,
      trim: true,
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
