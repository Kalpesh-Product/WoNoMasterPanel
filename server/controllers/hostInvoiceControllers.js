const HostInvoiceRequest = require("../models/hostCompany/HostInvoiceRequest");

// GET /api/hosts/host-companies/:companyId/invoices — every "send invoice to
// WONO" request a host has made for their finalized, paid website bookings
// (meeting room or co-living/hostel stay). Read-only for now — HostPanel is
// the only side that creates these rows.
const getHostInvoices = async (req, res, next) => {
  try {
    const companyId = String(req.params?.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    const invoices = await HostInvoiceRequest.find({ companyId })
      .sort({ requestedAt: -1 })
      .lean();
    return res.status(200).json({ invoices });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/hosts/host-companies/:companyId/invoices/:invoiceId/mark-paid —
// staff confirms the bank transfer actually went out (no payment webhook
// exists for this; it's a manual wire). Checker side of request → pay
// maker-checker: only a "Requested" invoice can move to "Paid", once.
const markHostInvoiceAsPaid = async (req, res, next) => {
  try {
    const { companyId, invoiceId } = req.params || {};
    const paymentReference = String(req.body?.paymentReference || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!paymentReference) {
      return res.status(400).json({ message: "paymentReference is required" });
    }

    const invoice = await HostInvoiceRequest.findOne({ _id: invoiceId, companyId: String(companyId || "").trim() });
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    if (invoice.status !== "Requested") {
      return res.status(409).json({ message: `Invoice is already ${invoice.status}` });
    }

    invoice.status = "Paid";
    invoice.paidAt = new Date();
    invoice.paymentReference = paymentReference;
    invoice.paidBy = req.user || null;
    if (notes) invoice.notes = notes;
    await invoice.save();

    return res.status(200).json({ invoice });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHostInvoices, markHostInvoiceAsPaid };
