const mongoose = require("mongoose");

// Read-only mirror of HostPanel's own SupportTicket model
// (Host Panel/HostPanel/server/models/SupportTicket.ts). Both apps share the
// same MongoDB Atlas database, and HostPanel writes these docs to the
// "supporttickets" collection. Master panel's own internal ticketing system
// (models/tickets/supportTickets.js) happens to default to the same
// collection name under an unrelated schema — that model is registered as
// "SupportTicket", so this one is registered under a different name
// ("HostSupportTicket") to avoid clashing with it, while still pointing at
// the same physical collection.
//
// "company" intentionally refs "HostLeadCompany" (models/hostCompany/hostLeadCompany.js,
// collection "hostleadcompanies") rather than the model registered as
// "HostCompany" in this app (models/hostCompany/hostCompany.js, collection
// "hostcompanies") — the latter is a different, legacy collection and would
// silently fail to populate the real company doc.
const hostSupportTicketSchema = new mongoose.Schema(
  {
    sr: { type: Number },
    ticketId: { type: String, trim: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true, default: "" },
    pageUrl: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Open", "Accepted", "In Progress", "Resolved", "Closed", "Pending", "Escalated", "Rejected"],
      default: "Open",
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "HostUser", default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "HostUser", default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "HostUser", default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "HostUser", default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "HostUser", default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "HostLeadCompany", default: null },
    requestedAt: { type: Date },
    role: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    requestedByName: { type: String, trim: true, default: "" },
    requestedByEmail: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    workspaceName: { type: String, trim: true, default: "" },
    image: {
      id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    resolutionMessage: { type: String, trim: true, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "supporttickets",
    strict: false,
  },
);

const HostSupportTicket =
  mongoose.models.HostSupportTicket ||
  mongoose.model("HostSupportTicket", hostSupportTicketSchema);

module.exports = HostSupportTicket;
