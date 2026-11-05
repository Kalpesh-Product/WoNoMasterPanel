const mongoose = require("mongoose");

// Read-only mirror of HostPanel's HostInvoiceRequest model (same shared DB,
// same default "hostinvoicerequests" collection) — a host's "pay me out"
// request for a finalized website booking's net amount (base amount, after
// WONO's platform/Stripe fees are already excluded). MasterPanel only reads
// and updates status here; HostPanel is the one that creates these.
const hostInvoiceRequestSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId },
    companyId: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    leadId: { type: mongoose.Schema.Types.ObjectId },
    bookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    bookingCode: { type: String, trim: true },
    bookingType: { type: String, enum: ["MeetingRoom", "CoLiving", "Hostel"] },
    amount: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: "USD" },
    status: { type: String, enum: ["Requested", "Paid", "Rejected"], default: "Requested" },
    invoicePdfUrl: { type: String, trim: true, default: "" },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    requestedAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.HostInvoiceRequest ||
  mongoose.model("HostInvoiceRequest", hostInvoiceRequestSchema);
