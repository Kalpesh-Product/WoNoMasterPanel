const HostCompany = require("../models/hostCompany/hostCompany");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const HostUser = require("../models/hostCompany/hostUser");
const TestHostUser = require("../models/hostCompany/TestHostUser");
const HostInviteStatus = require("../models/hostCompany/HostInviteStatus");
const Workspace = require("../models/hostCompany/Workspace");
const WorkspaceMember = require("../models/hostCompany/WorkspaceMember");
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

const buildCompanyIdPrefixRegex = (companyId = "") => {
  const normalized = String(companyId || "").trim();
  if (!normalized) return null;

  return new RegExp(`^${escapeRegex(normalized)}(?:$|-)`, "i");
};

const buildExactCaseInsensitiveRegex = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
};

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

const flattenGrantedModulesFromTreeState = (treeState = {}) =>
  Object.entries(treeState || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => String(key || "").trim())
    .filter(Boolean);

const normalizeMemberWorkspaceAccess = (member, options = {}) => {
  const { allowFallback = true } = options;
  const workspaceAccess = Array.isArray(member?.workspaceAccess)
    ? member.workspaceAccess
    : [];

  if (!workspaceAccess.length) {
    if (!allowFallback) {
      return [];
    }

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

const normalizeWorkspaceModules = (rawModules = []) => {
  const source = Array.isArray(rawModules)
    ? rawModules
    : rawModules && typeof rawModules === "object"
      ? Object.values(rawModules)
      : [];

  return source
    .map((entry) => ({
      category: String(entry?.category || entry?.name || "").trim(),
      items: (Array.isArray(entry?.items) ? entry.items : []).map((item) => ({
        id: String(item?.id || item?.moduleId || "").trim(),
      })),
    }))
    .filter((entry) => entry.category || entry.items.length);
};

const getEnabledCommonModuleIds = (workspace = {}) => {
  const enabledIds = new Set(
    Array.isArray(workspace?.enabledModuleIds)
      ? workspace.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  );

  const commonGroups = normalizeWorkspaceModules(workspace?.modules).filter((group) =>
    String(group.category || "").toLowerCase().includes("common"),
  );

  if (!commonGroups.length) return Array.from(enabledIds);

  return commonGroups
    .flatMap((group) => group.items || [])
    .map((item) => String(item?.id || "").trim())
    .filter((id) => id && enabledIds.has(id));
};

const getDefaultMemberEnabledModules = ({ workspace = {}, designation = "" }) => {
  const role = String(designation || "").trim().toLowerCase();
  const enabledIds = Array.isArray(workspace?.enabledModuleIds)
    ? workspace.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!enabledIds.length) return [];
  if (role.includes("founder")) return enabledIds;
  return getEnabledCommonModuleIds(workspace);
};

const toModuleAccessState = (moduleIds = []) =>
  (Array.isArray(moduleIds) ? moduleIds : []).reduce((acc, id) => {
    const key = String(id || "").trim();
    if (key) acc[key] = true;
    return acc;
  }, {});

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
    const requestedCompanyName = String(req.query.companyName || "").trim();

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const companyIdRegex = buildCompanyIdPrefixRegex(companyId);
    const fallbackCompany =
      (await HostCompany.findOne({ companyId }).lean()) ||
      (await HostLeadCompany.findOne({ companyId }).lean());
    const scopedCompanyName =
      requestedCompanyName || String(fallbackCompany?.companyName || "").trim();
    const companyNameRegex = buildExactCaseInsensitiveRegex(scopedCompanyName);

    const [members, directWorkspaces, nameMatchedWorkspaces] = await Promise.all([
      HostUser.find({
        companyId: companyIdRegex
          ? { $regex: companyIdRegex }
          : companyId,
      })
        .select(
          "name email phone designation companyId isActive workspaceAccess createdAt updatedAt",
        )
        .lean(),
      Workspace.find({
        companyId: companyIdRegex
          ? { $regex: companyIdRegex }
          : companyId,
        isActive: true,
      })
        .select("_id workspaceName companyId modules enabledModules enabledModuleIds")
        .lean(),
      companyNameRegex
        ? Workspace.find({
            businessName: { $regex: companyNameRegex },
            isActive: true,
          })
            .select("_id workspaceName companyId businessName modules enabledModules enabledModuleIds")
            .lean()
        : Promise.resolve([]),
    ]);

    const memberIds = members
      .map((member) => member?._id)
      .filter(Boolean);

    const workspaceDocs = [
      ...directWorkspaces,
      ...nameMatchedWorkspaces.filter(
        (workspace) =>
          !directWorkspaces.some(
            (directWorkspace) =>
              String(directWorkspace?._id) === String(workspace?._id),
          ),
      ),
    ];

    const workspaceIds = workspaceDocs
      .map((workspace) => workspace?._id)
      .filter(Boolean);

    const memberships = workspaceIds.length
      ? await WorkspaceMember.find({
          workspace: { $in: workspaceIds },
          isActive: true,
        })
          .populate("user", "name email phone designation companyId isActive createdAt updatedAt")
          .lean()
      : [];

    const membershipWorkspaceIds = memberships
      .map((membership) => membership?.workspace)
      .filter(Boolean);

    const membershipWorkspaces = membershipWorkspaceIds.length
      ? await Workspace.find({
          _id: { $in: membershipWorkspaceIds },
          isActive: true,
        })
          .select("_id workspaceName companyId businessName modules enabledModules enabledModuleIds")
          .lean()
      : [];

    const allWorkspaceDocs = [
      ...workspaceDocs,
      ...membershipWorkspaces.filter(
        (workspace) =>
          !workspaceDocs.some(
            (existingWorkspace) =>
              String(existingWorkspace?._id) === String(workspace?._id),
          ),
      ),
    ];

    const workspaceMap = new Map();
    const memberMap = new Map();
    const hasRealWorkspaces = allWorkspaceDocs.length > 0;

    const ensureMemberRecord = (member = {}) => {
      const key =
        String(member?._id || "").trim() ||
        String(member?.email || "").trim().toLowerCase();

      if (!key) return null;

      const existing = memberMap.get(key) || {};
      const merged = {
        ...existing,
        ...member,
        _id: member?._id || existing?._id,
        designation: member?.designation || existing?.designation || "",
        isActive:
          typeof member?.isActive === "boolean"
            ? member.isActive
            : typeof existing?.isActive === "boolean"
              ? existing.isActive
              : true,
        workspaceAccess: normalizeMemberWorkspaceAccess(
          {
            ...existing,
            ...member,
            workspaceAccess: [
              ...(Array.isArray(existing?.workspaceAccess)
                ? existing.workspaceAccess
                : []),
              ...(Array.isArray(member?.workspaceAccess)
                ? member.workspaceAccess
                : []),
            ],
          },
          { allowFallback: !hasRealWorkspaces },
        ),
      };

      memberMap.set(key, merged);
      return merged;
    };

    members.forEach((member) => {
      ensureMemberRecord(member);
    });

    allWorkspaceDocs.forEach((workspace) => {
      const workspaceId = normalizeWorkspaceId(workspace?._id?.toString());
      workspaceMap.set(workspaceId, {
        workspaceId,
        workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
        modules: workspace?.modules || [],
        enabledModules: Array.isArray(workspace?.enabledModuleIds)
          ? workspace.enabledModuleIds
          : Array.isArray(workspace?.enabledModules)
            ? workspace.enabledModules
            : [],
        enabledModuleIds: Array.isArray(workspace?.enabledModuleIds)
          ? workspace.enabledModuleIds
          : [],
      });
    });

    memberships.forEach((membership) => {
      const workspaceDoc = allWorkspaceDocs.find(
        (workspace) => String(workspace._id) === String(membership?.workspace),
      );
      const workspaceId = normalizeWorkspaceId(
        workspaceDoc?._id?.toString() || membership?.workspace?.toString(),
      );
      const workspaceName = normalizeWorkspaceName(workspaceDoc?.workspaceName);

      workspaceMap.set(workspaceId, {
        workspaceId,
        workspaceName,
        modules: workspaceDoc?.modules || [],
        enabledModules: Array.isArray(workspaceDoc?.enabledModuleIds)
          ? workspaceDoc.enabledModuleIds
          : Array.isArray(workspaceDoc?.enabledModules)
            ? workspaceDoc.enabledModules
            : [],
        enabledModuleIds: Array.isArray(workspaceDoc?.enabledModuleIds)
          ? workspaceDoc.enabledModuleIds
          : [],
      });

      const populatedUser = membership?.user || {};
      const member = ensureMemberRecord({
        ...populatedUser,
        designation: populatedUser?.designation || membership?.role || "",
      });

      if (!member) return;

      const currentAccess = Array.isArray(member.workspaceAccess)
        ? member.workspaceAccess.filter(
            (item) => normalizeWorkspaceId(item?.workspaceId) !== workspaceId,
          )
        : [];

      const workspaceEnabledIds = Array.isArray(workspaceDoc?.enabledModuleIds)
        ? workspaceDoc.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const memberEnabledIds = Array.isArray(membership?.enabledModules)
        ? membership.enabledModules
        : Array.isArray(membership?.grantedModules)
          ? membership.grantedModules
          : [];
      const filteredMemberEnabledIds = memberEnabledIds
        .map((id) => String(id || "").trim())
        .filter((id) => id && workspaceEnabledIds.includes(id));
      const defaultMemberEnabledIds = getDefaultMemberEnabledModules({
        workspace: workspaceDoc || {},
        designation: member?.designation || membership?.role || "",
      });
      const effectiveMemberEnabledIds =
        filteredMemberEnabledIds.length > 0
          ? filteredMemberEnabledIds
          : defaultMemberEnabledIds;
      const grantedModules = toModuleAccessState(effectiveMemberEnabledIds);

      member.workspaceAccess = normalizeMemberWorkspaceAccess({
        ...member,
        workspaceAccess: [
          ...currentAccess,
          {
            workspaceId,
            workspaceName,
            moduleAccess: grantedModules,
          },
        ],
      });
    });

    const normalizedMembers = Array.from(memberMap.values()).map((member) => {
      const normalizedWorkspaces = normalizeMemberWorkspaceAccess(member, {
        allowFallback: !hasRealWorkspaces,
      });

      normalizedWorkspaces.forEach((workspace) => {
        const workspaceKey = normalizeWorkspaceId(workspace.workspaceId);
        if (!workspaceMap.has(workspaceKey)) {
          workspaceMap.set(workspaceKey, {
            workspaceId: workspaceKey,
            workspaceName: normalizeWorkspaceName(workspace.workspaceName),
            modules: workspace?.modules || [],
            enabledModules: Array.isArray(workspace?.enabledModules)
              ? workspace.enabledModules
              : [],
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
        company: fallbackCompany || null,
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
    const { workspaceId, workspaceName, moduleAccess, accessSource } = req.body || {};

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
    const grantedModules = flattenGrantedModulesFromTreeState(moduleAccess);
    const currentAccess = Array.isArray(member.workspaceAccess)
      ? member.workspaceAccess.filter(
          (item) => normalizeWorkspaceId(item?.workspaceId) !== nextWorkspaceId,
        )
      : [];

    currentAccess.push({
      workspaceId: nextWorkspaceId,
      workspaceName: nextWorkspaceName,
      moduleAccess,
      accessSource:
        String(accessSource || "").trim() === "plan_role_preset"
          ? "plan_role_preset"
          : "custom_workspace_grant",
    });

    member.workspaceAccess = currentAccess;
    await member.save();

    const workspaceDoc = await Workspace.findById(nextWorkspaceId)
      .select("_id enabledModuleIds")
      .lean();
    const workspaceEnabledIds = Array.isArray(workspaceDoc?.enabledModuleIds)
      ? workspaceDoc.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const filteredGrantedModules = workspaceEnabledIds.length
      ? grantedModules.filter((id) => workspaceEnabledIds.includes(id))
      : grantedModules;

    if (workspaceDoc?._id) {
      await WorkspaceMember.findOneAndUpdate(
        {
          user: member._id,
          workspace: workspaceDoc._id,
        },
        {
          $set: {
            grantedModules: filteredGrantedModules,
            enabledModules: filteredGrantedModules,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }

    return res.status(200).json({
      message: "Workspace access updated successfully",
      data: {
        member,
        workspaceId: nextWorkspaceId,
        workspaceName: nextWorkspaceName,
        grantedModules: filteredGrantedModules,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateWorkspaceEnabledModules = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { enabledModuleIds, enabledModules } = req.body || {};

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    const nextEnabled = Array.isArray(enabledModuleIds)
      ? enabledModuleIds
      : Array.isArray(enabledModules)
        ? enabledModules
        : [];

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      {
        $set: {
          enabledModuleIds: nextEnabled,
          enabledModules: nextEnabled,
        },
      },
      { new: true },
    ).lean();

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    return res.status(200).json({
      message: "Workspace enabled modules updated successfully",
      data: workspace,
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
  updateWorkspaceEnabledModules,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
};
