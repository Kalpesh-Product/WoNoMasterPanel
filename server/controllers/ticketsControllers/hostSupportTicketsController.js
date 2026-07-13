const jwt = require("jsonwebtoken");
const HostSupportTicket = require("../../models/hostCompany/HostSupportTicket");
const { resolveHostPanelFrontendUrl } = require("../hostUserControllers");
const {
  createModuleAccessLog,
  getActorFromRequest,
  resolveSourcePanel,
} = require("../../utils/moduleAccessLogs");

// HostPanel's own tickets and master panel's internal tickets share the same
// physical "supporttickets" collection under unrelated schemas (see
// HostSupportTicket.js for details). HostPanel always sets `workspace` to a
// real ObjectId; master panel's internal ticket schema stores `workspace` as
// a plain string. Filtering on the actual BSON type is what reliably tells
// the two apart, since there's no explicit discriminator field.
const HOST_TICKET_FILTER = { workspace: { $type: "objectId" } };

const getHostSupportTickets = async (req, res, next) => {
  try {
    const tickets = await HostSupportTicket.find(HOST_TICKET_FILTER)
      .sort({ createdAt: -1 })
      .populate("requestedBy", "name firstName lastName email")
      .populate("workspace", "workspaceName businessName")
      .populate("company", "companyName")
      .lean()
      .exec();

    return res.status(200).json({ data: tickets });
  } catch (error) {
    next(error);
  }
};

const getHostSupportTicketById = async (req, res, next) => {
  try {
    const ticket = await HostSupportTicket.findOne({
      _id: req.params.ticketId,
      ...HOST_TICKET_FILTER,
    })
      .populate("requestedBy", "name firstName lastName email")
      .populate("workspace", "workspaceName businessName")
      .populate("company", "companyName")
      .lean()
      .exec();

    if (!ticket) {
      return res.status(404).json({ message: "Host support ticket not found." });
    }

    return res.status(200).json({ data: ticket });
  } catch (error) {
    next(error);
  }
};

// A ticket's pageUrl is free text the host user typed in themselves — only
// accept it as a redirect target if it's a plain relative path within the
// app, never a full/protocol-relative URL, to avoid an open redirect.
const isSafeRelativePath = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  return true;
};

const generateTicketViewAsLink = async (req, res, next) => {
  try {
    const ticket = await HostSupportTicket.findOne({
      _id: req.params.ticketId,
      ...HOST_TICKET_FILTER,
    }).exec();

    if (!ticket) {
      return res.status(404).json({ message: "Host support ticket not found." });
    }
    if (!ticket.requestedBy || !ticket.workspace) {
      return res.status(400).json({
        message: "This ticket has no linked host user/workspace to view as.",
      });
    }

    const redirectPath = isSafeRelativePath(ticket.pageUrl) ? ticket.pageUrl : "/dashboard";

    const token = jwt.sign(
      {
        purpose: "staff-view",
        hostUserId: String(ticket.requestedBy),
        workspaceId: String(ticket.workspace),
      },
      process.env.STAFF_VIEW_TOKEN_SECRET,
      { expiresIn: process.env.STAFF_VIEW_TOKEN_EXPIRY || "20m" },
    );

    const actor = getActorFromRequest(req);
    await createModuleAccessLog({
      ...actor,
      sourcePanel: resolveSourcePanel(req, "master_panel"),
      action: "staff_view_generated",
      targetType: "workspace",
      targetId: String(ticket.workspace),
      targetName: ticket.companyName || "",
      companyId: ticket.company ? String(ticket.company) : "",
      workspaceId: String(ticket.workspace),
      workspaceName: ticket.workspaceName || "",
      changes: { ticketId: String(ticket._id), redirectPath },
    });

    const link = `${resolveHostPanelFrontendUrl()}/staff-view/${token}?redirect=${encodeURIComponent(redirectPath)}`;

    return res.status(200).json({ link });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHostSupportTickets, getHostSupportTicketById, generateTicketViewAsLink };
