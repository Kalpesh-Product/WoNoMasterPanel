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

module.exports = { getHostInvoices };
