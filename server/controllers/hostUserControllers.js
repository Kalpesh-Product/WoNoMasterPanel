const HostCompany = require("../models/hostCompany/hostCompany");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const HostUser = require("../models/hostCompany/hostUser");
const TestHostUser = require("../models/hostCompany/TestHostUser");
const HostInviteStatus = require("../models/hostCompany/HostInviteStatus");
const { sendMail } = require("../config/nodemailerConfig");
const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");

const normalizeBaseUrl = (url) => (url || "").replace(/\/+$/, "");

const resolveHostPanelFrontendUrl = () => {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    return normalizeBaseUrl(
      process.env.HOST_PANEL_FRONTEND_URL || "https://wonohostfe.vercel.app",
    );
  }

  return normalizeBaseUrl(
    process.env.HOST_PANEL_FRONTEND_URL_DEV ||
      process.env.HOST_PANEL_FRONTEND_URL_LOCAL ||
      "http://localhost:3006",
  );
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeInviteStatus = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized === "invite_sent") return "invite_sent";
  if (normalized === "registered") return "registered";
  if (normalized === "joined") return "joined";
  return "not_invited";
};

const normalizeVerticalType = (verticalType) => {
  if (Array.isArray(verticalType)) {
    return verticalType
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const value = String(verticalType || "").trim();
  return value ? [value] : [];
};

const deriveInviteStatus = (hostUser) => {
  if (hostUser?.joinedAt || hostUser?.refreshToken) {
    return "joined";
  }

  if (hostUser?.registeredAt || hostUser?.password) {
    return "registered";
  }

  if (hostUser?.inviteSentAt || hostUser?.inviteStatus === "invite_sent") {
    return "invite_sent";
  }

  return normalizeInviteStatus(hostUser?.inviteStatus);
};

const inviteStatusPriority = {
  not_invited: 0,
  invite_sent: 1,
  registered: 2,
  joined: 3,
};

const mergeInviteRecords = (base = {}, incoming = {}) => {
  const baseStatus = deriveInviteStatus(base);
  const incomingStatus = deriveInviteStatus(incoming);

  const chosen =
    (inviteStatusPriority[incomingStatus] || 0) >=
    (inviteStatusPriority[baseStatus] || 0)
      ? { ...base, ...incoming }
      : { ...incoming, ...base };

  return {
    ...chosen,
    inviteStatus:
      (inviteStatusPriority[incomingStatus] || 0) >=
      (inviteStatusPriority[baseStatus] || 0)
        ? incomingStatus
        : baseStatus,
  };
};

const syncInviteLifecycle = async (hostUser) => {
  if (!hostUser) return "not_invited";

  const derivedStatus = deriveInviteStatus(hostUser);
  const updates = {};

  if (derivedStatus !== normalizeInviteStatus(hostUser.inviteStatus)) {
    updates.inviteStatus = derivedStatus;
  }

  if (derivedStatus === "registered" && !hostUser.registeredAt) {
    updates.registeredAt = hostUser.updatedAt || new Date();
  }

  if (derivedStatus === "joined" && !hostUser.joinedAt) {
    updates.joinedAt = hostUser.updatedAt || new Date();
  }

  if (Object.keys(updates).length) {
    await HostUser.updateOne({ _id: hostUser._id }, { $set: updates });
    Object.assign(hostUser, updates);
  }

  return deriveInviteStatus(hostUser);
};

const getMailButton = (href, label) => `
  <a
    href="${href}"
    style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
  >
    ${label}
  </a>
`;

const buildSignupInviteEmail = ({ name, companyName, inviteLink }) => ({
  subject: "Your Wono invite",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">You're invited to Wono</h2>
      <p>Hello ${name},</p>
      <p>Your signup request for ${companyName || "your company"} has been approved.</p>
      <p>You can now proceed with the next step using the Wono platform.</p>
      <p>${getMailButton(inviteLink, "Continue Signup")}</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const buildUpgradePaymentEmail = ({
  name,
  companyName,
  selectedPlan,
  paymentLinkUrl,
}) => ({
  subject: "Complete your Wono plan upgrade payment",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Upgrade payment link</h2>
      <p>Hello ${name},</p>
      <p>Your request to upgrade <strong>${companyName || "your company"}</strong> to the <strong>${selectedPlan}</strong> plan is ready for payment.</p>
      <p>Please complete your payment using the link below. Access will be upgraded after our team confirms the payment.</p>
      <p>${getMailButton(paymentLinkUrl, "Pay Now")}</p>
      <p>If you already paid, please wait for confirmation from our team.</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const buildUpgradeSuccessEmail = ({ name, companyName, selectedPlan, loginUrl }) => ({
  subject: "Your Wono plan has been upgraded successfully",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Plan upgraded successfully</h2>
      <p>Hello ${name},</p>
      <p>Your plan for <strong>${companyName || "your company"}</strong> has been upgraded successfully to <strong>${selectedPlan}</strong>.</p>
      <p>You can now log in and start using the upgraded access.</p>
      <p>${getMailButton(loginUrl, "Login")}</p>
      <p>If you face any issue logging in, please contact our support team.</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const DEFAULT_WORKSPACE_ID = "default-workspace";

const normalizeWorkspaceName = (workspaceName = "") => {
  const normalized = String(workspaceName || "").trim();
  return normalized || "Main Workspace";
};

const normalizeWorkspaceId = (workspaceId = "") => {
  const normalized = String(workspaceId || "").trim();
  return normalized || DEFAULT_WORKSPACE_ID;
};

const buildFallbackWorkspace = () => ({
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspaceName: "Main Workspace",
});

const normalizeMemberWorkspaceAccess = (member) => {
  const workspaceAccess = Array.isArray(member?.workspaceAccess)
    ? member.workspaceAccess
    : [];

  if (!workspaceAccess.length) {
    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: "Main Workspace",
        moduleAccess: member?.moduleAccess || {},
      },
    ];
  }

  return workspaceAccess.map((workspace) => ({
    workspaceId: normalizeWorkspaceId(workspace?.workspaceId),
    workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
    moduleAccess: workspace?.moduleAccess || {},
  }));
};

const bulkInsertPoc = async (req, res, next) => {
  try {
    const { pocs } = req.body;

    if (!Array.isArray(pocs) || pocs.length === 0) {
      return res.status(400).json({
        message: "Please provide a valid array of POCs",
        receivedType: typeof pocs,
        receivedValue: pocs,
      });
    }

    // Fetch companies
    const companies = await HostCompany.find().lean();
    const companyMap = new Map(
      companies.map((item) => [item.companyId?.trim(), item._id]),
    );

    const missingCompanyRows = [];
    const finalPocs = [];

    for (const poc of pocs) {
      const companyId = poc.companyId?.trim();
      const companyMongoId = companyMap.get(companyId);

      if (!companyMongoId) {
        missingCompanyRows.push({
          name: poc.name?.trim(),
          email: poc.email?.trim(),
          companyId,
          reason: "No matching HostCompany found",
        });
        continue;
      }

      finalPocs.push({
        company: companyMongoId,
        companyId,
        name: poc.name?.trim() || "",
        designation: poc.designation || "",
        email: poc.email?.trim()?.toLowerCase() || "",
        phone: poc.phone || "",
        linkedInProfile: poc.linkedInProfile || "",
        languagesSpoken: poc.languagesSpoken || [],
        address: poc.address || "",
        profileImage: poc.profileImage || "",
        country: poc.country || "",
        state: poc.state || "",
        city: poc.city || "",
        verticalType: normalizeVerticalType(poc.verticalType),
        inviteStatus: "not_invited",
        isActive: true,
      });
    }

    // Insert EVERYTHING that reached this line
    let inserted = [];
    let failedDocs = [];

    try {
      inserted = await HostUser.insertMany(finalPocs, { ordered: false });

      const successfulKeys = new Set(
        inserted.map((i) => `${i.email}|${i.companyId}`),
      );

      failedDocs = finalPocs.filter(
        (doc) => !successfulKeys.has(`${doc.email}|${doc.companyId}`),
      );
    } catch (err) {
      console.error("Insert error:", err);
      return res.status(500).json({
        message: "Insertion failed for some records.",
        error: err.message,
      });
    }

    return res.status(201).json({
      message: `${inserted.length} POCs inserted successfully.`,
      totalIncoming: pocs.length,
      attemptedInsert: finalPocs.length,
      inserted: inserted.length,
      failedInsertCount: failedDocs.length,
      failedInsertLogs: failedDocs,
      missingCompanyCount: missingCompanyRows.length,
      missingCompanyRows,
    });
  } catch (error) {
    console.error("bulkInsertPoc error:", error);
    next(error);
  }
};

const getInviteStatuses = async (req, res, next) => {
  try {
    const emails = String(req.query.emails || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const query = emails.length
      ? {
          $or: emails.map((email) => ({
            email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
          })),
        }
      : {};

    const hostUsers = await HostUser.find(query)
      .select(
        "email inviteStatus inviteSentAt registeredAt joinedAt password refreshToken updatedAt",
      )
      .lean();

    const inviteStatusDocs = await HostInviteStatus.find(query)
      .select("email inviteStatus inviteSentAt registeredAt joinedAt updatedAt")
      .lean();

    const statusSource = new Map();

    for (const hostUser of hostUsers) {
      const derivedStatus = deriveInviteStatus(hostUser);
      const updates = {};

      if (derivedStatus !== normalizeInviteStatus(hostUser.inviteStatus)) {
        updates.inviteStatus = derivedStatus;
      }

      if (derivedStatus === "registered" && !hostUser.registeredAt) {
        updates.registeredAt = hostUser.updatedAt || new Date();
      }

      if (derivedStatus === "joined" && !hostUser.joinedAt) {
        updates.joinedAt = hostUser.updatedAt || new Date();
      }

      if (Object.keys(updates).length) {
        await HostUser.updateOne({ _id: hostUser._id }, { $set: updates });
        Object.assign(hostUser, updates);
      }

      const key = String(hostUser.email || "").trim().toLowerCase();
      statusSource.set(key, {
        inviteStatus: deriveInviteStatus(hostUser),
        inviteSentAt: hostUser.inviteSentAt,
        registeredAt: hostUser.registeredAt,
        joinedAt: hostUser.joinedAt,
      });
    }

    for (const doc of inviteStatusDocs) {
      const key = String(doc.email || "").trim().toLowerCase();
      const existing = statusSource.get(key);
      statusSource.set(key, mergeInviteRecords(existing, doc));
    }

    const statuses = {};
    for (const [email, data] of statusSource.entries()) {
      statuses[email] = {
        inviteStatus: deriveInviteStatus(data),
        inviteSentAt: data.inviteSentAt || null,
        registeredAt: data.registeredAt || null,
        joinedAt: data.joinedAt || null,
      };
    }

    return res.status(200).json({ data: statuses });
  } catch (error) {
    next(error);
  }
};

const sendInviteEmail = async (req, res, next) => {
  try {
    const {
      leadId,
      email,
      name,
      mobile,
      companyName,
      status,
      fullName,
      selectedPlan,
      country,
      state,
      city,
      verticalType,
      source,
      goals,
      comment,
      isUpgradeRequest,
    } = req.body;

    const normalizeMultiValue = (value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              return String(item.label || item.value || item.name || "").trim();
            }
            return "";
          })
          .filter(Boolean)
          .join(", ");
      }

      if (typeof value === "string") {
        return value.trim();
      }

      if (value && typeof value === "object") {
        return String(value.label || value.value || value.name || "").trim();
      }

      return "";
    };

    if (!email || !name) {
      return res
        .status(400)
        .json({ message: "Lead email and name are required" });
    }

    if ((status || "").toLowerCase() !== "closed") {
      return res.status(400).json({
        message: "Invite can only be sent when the lead status is closed",
      });
    }

    const companyId = leadId?.trim() || `lead-${randomUUID()}`;
    const normalizedVerticals = normalizeVerticalType(verticalType);
    const normalizedPlan = String(selectedPlan || goals || "basic")
      .trim()
      .toLowerCase();

    await HostLeadCompany.findOneAndUpdate(
      { companyId },
      {
        $set: {
          leadId: leadId?.trim() || undefined,
          companyId,
          companyName: companyName?.trim() || "Unknown Company",
          industry: normalizeMultiValue(verticalType),
          companyCountry: country?.trim() || "",
          companyState: state?.trim() || "",
          companyCity: city?.trim() || "",
          isRegistered: true,
          status: status?.trim()?.toLowerCase() || "closed",
          plan: normalizedPlan,
          comment: comment?.trim() || "",
          source: source?.trim() || "signup-lead",
          pocName: name?.trim() || "",
          pocEmail: email?.trim()?.toLowerCase() || "",
          pocPhone: mobile?.trim() || "",
          invitedAt: new Date(),
          ...(isUpgradeRequest
            ? {
                upgradeInviteSentAt: new Date(),
                upgradeStatus: "payment_link_sent",
              }
            : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const invitePayload = {
      fullName: fullName || name,
      name: fullName || name,
      email,
      selectedPlan: normalizedPlan,
      goals: normalizedPlan,
      companyName: companyName || "",
      businessName: companyName || "",
      country: country || "",
      state: state || "",
      city: city || "",
      verticalType: normalizedVerticals,
      businessType: normalizedVerticals,
    };

    const inviteToken = jwt.sign(
      invitePayload,
      process.env.HOST_INVITE_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.HOST_INVITE_TOKEN_EXPIRY || "7d" },
    );

    const hostPanelBaseUrl = resolveHostPanelFrontendUrl();
    const inviteLink = `${hostPanelBaseUrl}/register/${inviteToken}`;
    const signupMail = buildSignupInviteEmail({
      name,
      companyName,
      inviteLink,
    });
    await sendMail({ to: email, ...signupMail });

    const normalizedEmail = String(email).trim().toLowerCase();
    const hostUser = await HostUser.findOne({
      email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: "i" },
    });

    if (hostUser) {
      const currentStatus = await syncInviteLifecycle(hostUser);

      hostUser.country = country || hostUser.country || "";
      hostUser.state = state || hostUser.state || "";
      hostUser.city = city || hostUser.city || "";
      hostUser.verticalType = normalizedVerticals.length
        ? normalizedVerticals
        : hostUser.verticalType || [];

      if (!["registered", "joined"].includes(currentStatus)) {
        hostUser.inviteStatus = "invite_sent";
        hostUser.inviteSentAt = new Date();
      }

      await hostUser.save();
    }

    const inviteStatusDoc = await HostInviteStatus.findOne({
      email: normalizedEmail,
    }).lean();
    const docStatus = normalizeInviteStatus(inviteStatusDoc?.inviteStatus);
    const shouldKeepHigherStatus =
      docStatus === "registered" || docStatus === "joined";

    await HostInviteStatus.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          inviteStatus: shouldKeepHigherStatus ? docStatus : "invite_sent",
          inviteSentAt:
            inviteStatusDoc?.inviteSentAt || inviteStatusDoc?.joinedAt
              ? inviteStatusDoc?.inviteSentAt || new Date()
              : new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({ message: "Invite email sent successfully" });
  } catch (error) {
    next(error);
  }
};

const getCompanyMembers = async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId || "").trim();

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const [company, members] = await Promise.all([
      HostCompany.findOne({ companyId }).lean(),
      HostUser.find({ companyId })
        .select(
          "name email phone designation companyId isActive workspaceAccess createdAt updatedAt",
        )
        .lean(),
    ]);

    const workspaceMap = new Map();

    const normalizedMembers = (members || []).map((member) => {
      const normalizedWorkspaces = normalizeMemberWorkspaceAccess(member);

      normalizedWorkspaces.forEach((workspace) => {
        const workspaceKey = normalizeWorkspaceId(workspace.workspaceId);
        if (!workspaceMap.has(workspaceKey)) {
          workspaceMap.set(workspaceKey, {
            workspaceId: workspaceKey,
            workspaceName: normalizeWorkspaceName(workspace.workspaceName),
          });
        }
      });

      const activeWorkspace = normalizedWorkspaces[0] || buildFallbackWorkspace();

      return {
        ...member,
        workspaceAccess: normalizedWorkspaces,
        activeWorkspaceId: activeWorkspace.workspaceId,
        activeWorkspaceName: activeWorkspace.workspaceName,
        moduleAccess: activeWorkspace.moduleAccess || {},
      };
    });

    if (!workspaceMap.size) {
      workspaceMap.set(DEFAULT_WORKSPACE_ID, buildFallbackWorkspace());
    }

    return res.status(200).json({
      data: {
        company: company || null,
        members: normalizedMembers,
        workspaces: Array.from(workspaceMap.values()),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateMemberWorkspaceAccess = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { workspaceId, workspaceName, moduleAccess } = req.body || {};

    if (!memberId) {
      return res.status(400).json({ message: "memberId is required" });
    }

    if (!workspaceName || typeof moduleAccess !== "object") {
      return res.status(400).json({
        message: "workspaceName and moduleAccess are required",
      });
    }

    const member = await HostUser.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: "Host user not found" });
    }

    const nextWorkspaceId = normalizeWorkspaceId(workspaceId);
    const nextWorkspaceName = normalizeWorkspaceName(workspaceName);
    const currentAccess = Array.isArray(member.workspaceAccess)
      ? member.workspaceAccess.filter(
          (item) => normalizeWorkspaceId(item?.workspaceId) !== nextWorkspaceId,
        )
      : [];

    currentAccess.push({
      workspaceId: nextWorkspaceId,
      workspaceName: nextWorkspaceName,
      moduleAccess,
    });

    member.workspaceAccess = currentAccess;
    await member.save();

    return res.status(200).json({
      message: "Workspace access updated successfully",
      member,
    });
  } catch (error) {
    next(error);
  }
};

const sendUpgradePaymentLinkEmail = async (req, res, next) => {
  try {
    const { email, name, companyName, selectedPlan, paymentLinkUrl } = req.body || {};

    if (!email || !name || !paymentLinkUrl) {
      return res.status(400).json({
        message: "email, name and paymentLinkUrl are required",
      });
    }

    const paymentMail = buildUpgradePaymentEmail({
      name,
      companyName,
      selectedPlan: String(selectedPlan || "requested").trim(),
      paymentLinkUrl: String(paymentLinkUrl).trim(),
    });

    await sendMail({
      to: email,
      ...paymentMail,
    });

    return res.status(200).json({
      message: "Upgrade payment email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

const sendUpgradeSuccessEmail = async (req, res, next) => {
  try {
    const { email, name, companyName, selectedPlan } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({
        message: "email and name are required",
      });
    }

    const loginUrl = `${resolveHostPanelFrontendUrl()}/login`;
    const successMail = buildUpgradeSuccessEmail({
      name,
      companyName,
      selectedPlan: String(selectedPlan || "requested").trim(),
      loginUrl,
    });

    await sendMail({
      to: email,
      ...successMail,
    });

    return res.status(200).json({
      message: "Upgrade success email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bulkInsertPoc,
  getInviteStatuses,
  getCompanyMembers,
  sendInviteEmail,
  updateMemberWorkspaceAccess,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
};
