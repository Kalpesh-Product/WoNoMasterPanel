const WebsiteCreditRequest = require("../../models/website/WebsiteCreditRequest");
const WebsiteCredits = require("../../models/website/WebsiteCredits");
const WebsiteCreditLedger = require("../../models/website/WebsiteCreditLedger");
const HostLeadCompany = require("../../models/hostCompany/hostLeadCompany");
const HostCompany = require("../../models/hostCompany/hostCompany");
const Workspace = require("../../models/hostCompany/Workspace");
const HostUser = require("../../models/hostCompany/hostUser");
const { sendMail } = require("../../config/nodemailerConfig");

const DEFAULT_TEST_PAYMENT_LINK = "https://example.com/test-payment-link";

const formatHostLoginUrl = () => {
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? process.env.HOST_PANEL_FRONTEND_URL || "https://wonohostfe.vercel.app"
      : process.env.HOST_PANEL_FRONTEND_URL_DEV ||
        process.env.HOST_PANEL_FRONTEND_URL_LOCAL ||
        "http://localhost:3006";

  return String(baseUrl).replace(/\/+$/, "") + "/login";
};

const resolveRequestedCredits = (requestDoc = {}) => {
  const fromPrimary = Number(requestDoc?.creditsRequested);
  if (!Number.isNaN(fromPrimary) && fromPrimary > 0) return fromPrimary;

  const fromLegacyRequested = Number(requestDoc?.requestedCredits);
  if (!Number.isNaN(fromLegacyRequested) && fromLegacyRequested > 0) {
    return fromLegacyRequested;
  }

  const fromLegacyCredits = Number(requestDoc?.credits);
  if (!Number.isNaN(fromLegacyCredits) && fromLegacyCredits > 0) {
    return fromLegacyCredits;
  }

  const fromLegacyCreditRequest = Number(requestDoc?.creditRequest);
  if (!Number.isNaN(fromLegacyCreditRequest) && fromLegacyCreditRequest > 0) {
    return fromLegacyCreditRequest;
  }

  return 0;
};

const getNextResetDate = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next;
};

const normalizeRoleTitles = (roles = []) => {
  const list = Array.isArray(roles) ? roles : [roles];
  const output = [];

  const pushValue = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized) output.push(normalized);
  };

  list.forEach((role) => {
    if (!role) return;

    if (typeof role === "string") {
      pushValue(role);
      return;
    }

    if (Array.isArray(role)) {
      role.forEach((item) => pushValue(item));
      return;
    }

    if (typeof role === "object") {
      pushValue(role.roleTitle);
      pushValue(role.title);
      pushValue(role.name);
      pushValue(role.role);
    }
  });

  return [...new Set(output)];
};

const ensureMasterRole = (roles = [], userData = {}) => {
  const normalizedRoles = normalizeRoleTitles(roles);

  if (!normalizedRoles.length) {
    // Some legacy tokens may not carry role titles; allow authenticated master-panel users.
    return Boolean(userData && Object.keys(userData).length);
  }

  return normalizedRoles.some((role) =>
    ["master admin", "super admin"].includes(role) ||
    role.includes("master") ||
    role.includes("super admin"),
  );
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCompanyId = (rawCompanyId = "") => {
  const normalized = String(rawCompanyId || "").trim();
  const match = normalized.match(/^(.*)-(\d{10,})$/);
  return match?.[1] ? match[1] : normalized;
};

const resolveCompanyDisplayName = async (requestDoc = {}) => {
  const rawCompanyId = String(requestDoc.companyId || "").trim();
  const normalizedCompanyId = normalizeCompanyId(rawCompanyId);
  const workspaceId = String(requestDoc.workspaceId || "").trim();

  const [workspace, leadCompany, hostCompany] = await Promise.all([
    workspaceId
      ? Workspace.findById(workspaceId).select("businessName workspaceName").lean()
      : Promise.resolve(null),
    HostLeadCompany.findOne({ companyId: normalizedCompanyId })
      .select("companyName")
      .lean(),
    HostCompany.findOne({ companyId: normalizedCompanyId })
      .select("companyName")
      .lean(),
  ]);

  const companyName = String(
    workspace?.businessName ||
    leadCompany?.companyName ||
    hostCompany?.companyName ||
    requestDoc.companyName ||
      requestDoc.company ||
      requestDoc.businessName ||
      "",
  ).trim();

  return companyName || "your company";
};

const resolveWorkspaceDisplayName = async (requestDoc = {}) => {
  const workspaceId = String(requestDoc.workspaceId || "").trim();
  if (!workspaceId) {
    return (
      String(
        requestDoc.workspaceName || requestDoc.workspace || requestDoc.workspaceTitle || "",
      ).trim() || "your workspace"
    );
  }

  const workspace = await Workspace.findById(workspaceId)
    .select("workspaceName")
    .lean();

  const workspaceName = String(
    workspace?.workspaceName ||
      requestDoc.workspaceName ||
      requestDoc.workspace ||
      requestDoc.workspaceTitle ||
      "",
  ).trim();

  return workspaceName || "your workspace";
};

const resolveRequesterForCreditEmail = async (requestDoc = {}) => {
  const explicitName = String(
    requestDoc?.requestedBy?.name ||
      requestDoc?.requestedByName ||
      requestDoc?.requestBy ||
      requestDoc?.userName ||
      "",
  ).trim();
  const explicitEmail = String(
    requestDoc?.requestedBy?.email ||
      requestDoc?.requestedByEmail ||
      requestDoc?.userEmail ||
      "",
  )
    .trim()
    .toLowerCase();

  if (explicitName && explicitEmail) {
    return { name: explicitName, email: explicitEmail };
  }

  const requesterId = String(
    requestDoc?.requestedBy?.userId || requestDoc?.requestedByUserId || "",
  ).trim();
  const workspaceId = String(requestDoc?.workspaceId || "").trim();

  let user = null;
  if (requesterId) {
    user = await HostUser.findById(requesterId).select("name email").lean();
  }

  if (!user && explicitEmail) {
    user = await HostUser.findOne({ email: explicitEmail })
      .select("name email")
      .lean();
  }

  if (!user && workspaceId) {
    const workspace = await Workspace.findById(workspaceId).select("owner").lean();
    const ownerId = String(workspace?.owner || "").trim();
    if (ownerId) {
      user = await HostUser.findById(ownerId).select("name email").lean();
    }
  }

  const name = String(explicitName || user?.name || "User").trim() || "User";
  const email = String(explicitEmail || user?.email || "")
    .trim()
    .toLowerCase();

  return { name, email };
};

const getWebsiteCreditRequests = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const {
      companyId,
      workspaceId,
      status,
      search,
      fromDate,
      toDate,
    } = req.query || {};
    const query = {};

    if (String(companyId || "").trim()) {
      const normalizedCompanyId = normalizeCompanyId(companyId);
      const regex = new RegExp(
        `^${escapeRegex(normalizedCompanyId)}(?:-\\d{10,})?$`,
        "i",
      );
      query.companyId = regex;
    }
    if (String(workspaceId || "").trim()) {
      query.workspaceId = String(workspaceId).trim();
    }
    if (String(status || "").trim()) query.status = String(status).trim().toLowerCase();

    if (String(fromDate || "").trim() || String(toDate || "").trim()) {
      query.createdAt = {};
      if (String(fromDate || "").trim()) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (String(toDate || "").trim()) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (String(search || "").trim()) {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { companyName: searchRegex },
        { workspaceName: searchRegex },
        { "requestedBy.name": searchRegex },
        { "requestedBy.email": searchRegex },
      ];
    }

    const rows = await WebsiteCreditRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const companyIds = [
      ...new Set(
        rows
          .map((row) => String(row?.companyId || "").trim())
          .filter(Boolean),
      ),
    ];
    const workspaceIds = [
      ...new Set(
        rows
          .map((row) => String(row?.workspaceId || "").trim())
          .filter(Boolean),
      ),
    ];
    const requestedByUserIds = [
      ...new Set(
        rows
          .map((row) => String(row?.requestedByUserId || row?.requestedBy?.userId || "").trim())
          .filter(Boolean),
      ),
    ];
    const requestedByEmails = [
      ...new Set(
        rows
          .map((row) =>
            String(
              row?.requestedByEmail ||
                row?.requestedBy?.email ||
                row?.userEmail ||
                "",
            )
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];

    const [hostLeadCompanies, hostCompanies, workspaces, usersById, usersByEmail] =
      await Promise.all([
        companyIds.length
          ? HostLeadCompany.find({ companyId: { $in: companyIds } })
              .select("companyId companyName")
              .lean()
          : Promise.resolve([]),
        companyIds.length
          ? HostCompany.find({ companyId: { $in: companyIds } })
              .select("companyId companyName")
              .lean()
          : Promise.resolve([]),
        workspaceIds.length
          ? Workspace.find({ _id: { $in: workspaceIds } })
              .select("_id workspaceName owner")
              .lean()
          : Promise.resolve([]),
        requestedByUserIds.length
          ? HostUser.find({ _id: { $in: requestedByUserIds } })
              .select("_id name email")
              .lean()
          : Promise.resolve([]),
        requestedByEmails.length
          ? HostUser.find({ email: { $in: requestedByEmails } })
              .select("_id name email")
              .lean()
          : Promise.resolve([]),
      ]);

    const companyNameMap = new Map();
    hostCompanies.forEach((company) => {
      companyNameMap.set(String(company.companyId || "").trim(), company.companyName || "");
    });
    hostLeadCompanies.forEach((company) => {
      const key = String(company.companyId || "").trim();
      if (!companyNameMap.get(key)) {
        companyNameMap.set(key, company.companyName || "");
      }
    });

    const workspaceNameMap = new Map();
    const workspaceOwnerIdMap = new Map();
    workspaces.forEach((workspace) => {
      workspaceNameMap.set(String(workspace?._id || "").trim(), workspace.workspaceName || "");
      workspaceOwnerIdMap.set(
        String(workspace?._id || "").trim(),
        String(workspace?.owner || "").trim(),
      );
    });

    const userByIdMap = new Map();
    usersById.forEach((user) => {
      userByIdMap.set(String(user?._id || "").trim(), user);
    });
    const userByEmailMap = new Map();
    usersByEmail.forEach((user) => {
      const key = String(user?.email || "").trim().toLowerCase();
      if (key) userByEmailMap.set(key, user);
    });

    const missingOwnerUserIds = [
      ...new Set(
        Array.from(workspaceOwnerIdMap.values())
          .filter(Boolean)
          .filter((id) => !userByIdMap.has(id)),
      ),
    ];

    if (missingOwnerUserIds.length) {
      const ownerUsers = await HostUser.find({ _id: { $in: missingOwnerUserIds } })
        .select("_id name email")
        .lean();

      ownerUsers.forEach((user) => {
        userByIdMap.set(String(user?._id || "").trim(), user);
      });
    }

    const enrichedRows = rows.map((row) => {
      const companyIdKey = String(row?.companyId || "").trim();
      const workspaceIdKey = String(row?.workspaceId || "").trim();
      const requesterIdKey = String(
        row?.requestedByUserId || row?.requestedBy?.userId || "",
      ).trim();
      const requesterEmailKey = String(
        row?.requestedByEmail || row?.requestedBy?.email || row?.userEmail || "",
      )
        .trim()
        .toLowerCase();

      const requesterById = requesterIdKey ? userByIdMap.get(requesterIdKey) : null;
      const requesterByEmail = requesterEmailKey
        ? userByEmailMap.get(requesterEmailKey)
        : null;
      const workspaceOwnerId = workspaceOwnerIdMap.get(workspaceIdKey) || "";
      const requesterByWorkspaceOwner = workspaceOwnerId
        ? userByIdMap.get(workspaceOwnerId)
        : null;
      const requester =
        requesterById || requesterByEmail || requesterByWorkspaceOwner || null;

      return {
        ...row,
        companyName:
          row?.companyName ||
          row?.company ||
          row?.businessName ||
          companyNameMap.get(companyIdKey) ||
          "",
        workspaceName:
          row?.workspaceName ||
          row?.workspace ||
          row?.workspaceTitle ||
          workspaceNameMap.get(workspaceIdKey) ||
          "",
        requestedByName:
          row?.requestedByName ||
          row?.requestedBy?.name ||
          row?.requestBy ||
          row?.userName ||
          requester?.name ||
          "",
        requestedByEmail:
          row?.requestedByEmail ||
          row?.requestedBy?.email ||
          row?.userEmail ||
          requester?.email ||
          "",
      };
    });

    const enrichedWithLimits = enrichedRows.map((row) => {
      const baseLimit = 5;
      const addOnCreditsPurchased = Number(row?.addOnCreditsPurchased || 0);
      const creditsUsed = Number(row?.creditsUsed || 0);
      const effectiveLimit = baseLimit + addOnCreditsPurchased;
      return {
        ...row,
        baseCreditsLimit: baseLimit,
        addOnCreditsPurchased,
        effectiveLimit,
        addOnCreditsRemaining: Math.max(0, effectiveLimit - creditsUsed),
      };
    });

    return res.status(200).json(enrichedWithLimits);
  } catch (error) {
    next(error);
  }
};

const createWebsiteCreditRequest = async (req, res, next) => {
  try {
    const {
      companyId,
      workspaceId,
      requestedCredits,
      pricePerCredit,
      companyName,
      workspaceName,
      requestedByName,
      requestedByUserId,
      requestedByEmail,
      notes,
    } = req.body || {};

    if (!String(companyId || "").trim() || !String(workspaceId || "").trim()) {
      return res.status(400).json({ message: "companyId and workspaceId are required" });
    }

    const numericCredits = Number(requestedCredits);
    if (!Number.isFinite(numericCredits) || numericCredits <= 0) {
      return res.status(400).json({ message: "requestedCredits must be a positive number" });
    }

    const requesterName = String(
      requestedByName ||
        req.userData?.name ||
        `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
    ).trim();
    const requesterUserId = String(requestedByUserId || req.user || "").trim();
    const requesterEmail = String(
      requestedByEmail || req.userData?.email || "",
    ).trim().toLowerCase();

    const doc = await WebsiteCreditRequest.create({
      companyId: String(companyId).trim(),
      companyName: String(companyName || "").trim(),
      workspaceId: String(workspaceId).trim(),
      workspaceName: String(workspaceName || "").trim(),
      creditsRequested: numericCredits,
      requestedCredits: numericCredits,
      pricePerCredit: Number(pricePerCredit || 50),
      status: "pending",
      paymentStatus: "pending",
      requestedAt: new Date(),
      requestedBy: {
        name: requesterName,
        email: requesterEmail,
        userId: requesterUserId,
      },
      requestedByName: requesterName,
      requestedByUserId: requesterUserId,
      notes: String(notes || "").trim(),
    });

    return res.status(201).json({
      message: "Website credit request created successfully",
      requestDoc: doc,
    });
  } catch (error) {
    next(error);
  }
};

const approveWebsiteCreditRequest = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { requestId } = req.params || {};
    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    const requestDoc = await WebsiteCreditRequest.findById(requestId).lean();
    if (!requestDoc) {
      return res.status(404).json({ message: "Website credit request not found" });
    }

    const updatedDoc = await WebsiteCreditRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: "approved",
          reviewReason: "",
          notes: "",
          reviewedAt: new Date(),
          reviewedBy: {
            userId: String(req.user || ""),
            email: String(req.userData?.email || "").trim().toLowerCase(),
            name: String(
              `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
            ).trim(),
          },
          approvedAt: new Date(),
          approvedBy: {
            userId: String(req.user || ""),
            email: String(req.userData?.email || "").trim().toLowerCase(),
            name: String(
              `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
            ).trim(),
          },
        },
      },
      { new: true },
    ).lean();

    return res
      .status(200)
      .json({ message: "Request approved successfully", requestDoc: updatedDoc });
  } catch (error) {
    next(error);
  }
};

const rejectWebsiteCreditRequest = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { requestId } = req.params || {};
    const { reason } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    if (!String(reason || "").trim()) {
      return res.status(400).json({ message: "reason is required" });
    }

    const requestDoc = await WebsiteCreditRequest.findById(requestId).lean();
    if (!requestDoc) {
      return res.status(404).json({ message: "Website credit request not found" });
    }

    const updatedDoc = await WebsiteCreditRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: "rejected",
          reviewReason: String(reason).trim(),
          notes: String(reason).trim(),
          reviewedAt: new Date(),
          reviewedBy: {
            userId: String(req.user || ""),
            email: String(req.userData?.email || "").trim().toLowerCase(),
            name: String(
              `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
            ).trim(),
          },
          approvedAt: null,
          approvedBy: {
            userId: "",
            email: "",
            name: "",
          },
        },
      },
      { new: true },
    ).lean();

    return res
      .status(200)
      .json({ message: "Request rejected successfully", requestDoc: updatedDoc });
  } catch (error) {
    next(error);
  }
};

const sendWebsiteCreditPaymentLink = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { requestId } = req.params || {};
    const { paymentLinkUrl } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    const requestDoc = await WebsiteCreditRequest.findById(requestId).lean();
    if (!requestDoc) {
      return res.status(404).json({ message: "Website credit request not found" });
    }

    const companyNameForEmail = await resolveCompanyDisplayName(requestDoc);
    const requester = await resolveRequesterForCreditEmail(requestDoc);
    const email = requester.email;
    const name = requester.name;

    if (!email) {
      return res.status(400).json({ message: "Requested user email not found" });
    }

    const finalLink = String(paymentLinkUrl || "").trim() || DEFAULT_TEST_PAYMENT_LINK;

    await sendMail({
      to: email,
      subject: "Website credit payment link",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 16px;">Website credit request payment</h2>
        <p>Hello ${name},</p>
        <p>Your website credit request for <strong>${companyNameForEmail}</strong> has been approved.</p>
        <p>Please complete payment for <strong>${resolveRequestedCredits(requestDoc)}</strong> credits.</p>
        <p>
          <a href="${finalLink}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
            Pay Now
          </a>
        </p>
        <p>Regards,<br />Wono</p>
      </div>
      `,
    });

    const updatedDoc = await WebsiteCreditRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          paymentLinkUrl: finalLink,
          paymentLinkSentAt: new Date(),
        },
      },
      { new: true },
    ).lean();

    return res
      .status(200)
      .json({ message: "Payment link sent successfully", requestDoc: updatedDoc });
  } catch (error) {
    next(error);
  }
};

const updateWebsiteCreditPaymentStatus = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { requestId } = req.params || {};
    const { paymentStatus } = req.body || {};

    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    if (!["paid", "unpaid"].includes(String(paymentStatus || "").trim().toLowerCase())) {
      return res.status(400).json({ message: "paymentStatus must be paid/unpaid" });
    }

    const requestDoc = await WebsiteCreditRequest.findById(requestId).lean();
    if (!requestDoc) {
      return res.status(404).json({ message: "Website credit request not found" });
    }

    const normalized = String(paymentStatus).trim().toLowerCase();
    const updatedDoc = await WebsiteCreditRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          paymentStatus: normalized,
          paymentMarkedAt: normalized === "paid" ? new Date() : null,
        },
      },
      { new: true },
    ).lean();

    return res
      .status(200)
      .json({ message: "Payment status updated successfully", requestDoc: updatedDoc });
  } catch (error) {
    next(error);
  }
};

const addWebsiteCredits = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { requestId } = req.params || {};
    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }

    const requestDoc = await WebsiteCreditRequest.findById(requestId).lean();
    if (!requestDoc) {
      return res.status(404).json({ message: "Website credit request not found" });
    }

    const lockDoc = await WebsiteCreditRequest.findOneAndUpdate(
      {
        _id: requestId,
        creditsAddedAt: null,
        creditsGrantProcessingAt: null,
      },
      { $set: { creditsGrantProcessingAt: new Date() } },
      { new: true },
    ).lean();

    if (!lockDoc) {
      const latestDoc = await WebsiteCreditRequest.findById(requestId)
        .select("creditsAddedAt creditsGrantProcessingAt")
        .lean();

      if (!latestDoc) {
        return res.status(404).json({ message: "Website credit request not found" });
      }

      if (latestDoc.creditsAddedAt) {
        return res.status(400).json({ message: "Credits are already added" });
      }

      return res.status(409).json({
        message:
          "Credits grant is already in progress for this request. Please retry in a moment.",
      });
    }

    try {
      const creditsToAdd = resolveRequestedCredits(lockDoc);
      if (creditsToAdd <= 0) {
        return res.status(400).json({
          message:
            "Requested credits are missing in this request. Please update request credits first.",
        });
      }

      const workspaceId = String(lockDoc.workspaceId || "").trim();
      const companyId = normalizeCompanyId(lockDoc.companyId);
      const approvalMeta = {
        userId: String(req.user || ""),
        email: String(req.userData?.email || "").trim().toLowerCase(),
        name: String(
          `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
        ).trim(),
      };

      // Finalize review+payment confirmation at add-on grant step.
      const requestStatusUpdate = await WebsiteCreditRequest.findByIdAndUpdate(
        requestId,
        {
          $set: {
            status: "approved",
            paymentStatus: "paid",
            reviewedAt: lockDoc.reviewedAt || new Date(),
            reviewedBy: {
              userId: approvalMeta.userId,
              email: approvalMeta.email,
              name: approvalMeta.name,
            },
            approvedAt: lockDoc.approvedAt || new Date(),
            approvedBy: {
              userId: approvalMeta.userId,
              email: approvalMeta.email,
              name: approvalMeta.name,
            },
            paymentMarkedAt: lockDoc.paymentMarkedAt || new Date(),
          },
        },
        { new: true },
      ).lean();
      let creditsDoc = null;

      // 1) Prefer updating the exact workspace row already used by website builder.
      if (workspaceId) {
        creditsDoc = await WebsiteCredits.findOneAndUpdate(
          { workspaceId },
          {
            $set: {
              companyId: companyId || undefined,
              companyName: lockDoc.companyName || undefined,
              workspaceName: lockDoc.workspaceName || undefined,
              creditsLimit: 5,
              updatedAtSource: "master-panel",
            },
            $inc: {
              addOnCreditsPurchased: creditsToAdd,
            },
          },
          { new: true },
        );
      }

      // 2) Fallback to company-level row (legacy index/data shape).
      if (!creditsDoc && companyId) {
        creditsDoc = await WebsiteCredits.findOneAndUpdate(
          { companyId },
          {
            $set: {
              companyName: lockDoc.companyName || undefined,
              workspaceId: workspaceId || undefined,
              workspaceName: lockDoc.workspaceName || undefined,
              creditsLimit: 5,
              updatedAtSource: "master-panel",
            },
            $inc: {
              addOnCreditsPurchased: creditsToAdd,
            },
          },
          { new: true },
        );
      }

      // 3) If nothing exists, upsert one row in website_credits.
      if (!creditsDoc) {
        const upsertFilter = {
          companyId: companyId || `company-${Date.now()}`,
          workspaceId: workspaceId || "default-workspace",
        };
        creditsDoc = await WebsiteCredits.findOneAndUpdate(
          upsertFilter,
          {
            $set: {
              companyName: lockDoc.companyName || "",
              workspaceName: lockDoc.workspaceName || "Main Workspace",
              creditsLimit: 5,
              updatedAtSource: "master-panel",
              creditsResetDate: getNextResetDate(),
            },
            $setOnInsert: {
              creditsUsed: 0,
              addOnCreditsPurchased: 0,
            },
            $inc: {
              addOnCreditsPurchased: creditsToAdd,
            },
          },
          { new: true, upsert: true },
        );
      }

      const companyNameForEmail = await resolveCompanyDisplayName(lockDoc);
      const workspaceNameForEmail = await resolveWorkspaceDisplayName(lockDoc);
      const requester = await resolveRequesterForCreditEmail(lockDoc);
      const email = requester.email;
      const name = requester.name;

      if (email) {
        await sendMail({
          to: email,
          subject: "Website credits added successfully",
          html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2 style="margin-bottom: 16px;">Credits added successfully</h2>
            <p>Hello ${name},</p>
            <p><strong>${creditsToAdd}</strong> website credits were added for <strong>${companyNameForEmail}</strong> in workspace <strong>${workspaceNameForEmail}</strong>.</p>
            <p>
              <a href="${formatHostLoginUrl()}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
                Login
              </a>
            </p>
            <p>Regards,<br />Wono</p>
          </div>
          `,
        });
      }

      // Fire-and-forget: record the grant in the credits ledger.
      WebsiteCreditLedger.create({
        type: "added",
        credits: creditsToAdd,
        sourcePanel: "master_panel",
        companyId: companyId || String(creditsDoc?.companyId || ""),
        companyName: lockDoc.companyName || creditsDoc?.companyName || "",
        workspaceId: workspaceId || String(creditsDoc?.workspaceId || ""),
        workspaceName: lockDoc.workspaceName || creditsDoc?.workspaceName || "",
        performedById: approvalMeta.userId,
        performedByName: approvalMeta.name,
        performedByEmail: approvalMeta.email,
        description: "Credits added via approved credit request",
      }).catch((error) =>
        console.error("Failed to record credit grant:", error?.message),
      );

      const updatedDoc = await WebsiteCreditRequest.findByIdAndUpdate(
        requestId,
        {
          $set: {
            creditsAddedAt: new Date(),
          },
        },
        { new: true },
      ).lean();

      const effectiveLimit =
        Number(creditsDoc?.creditsLimit || 5) +
        Number(creditsDoc?.addOnCreditsPurchased || 0);
      const creditsUsed = Number(creditsDoc?.creditsUsed || 0);

      return res.status(200).json({
        message: "Website credits added successfully",
        requestDoc: updatedDoc || requestStatusUpdate,
        websiteCredits: {
          ...creditsDoc?.toObject?.(),
          ...(creditsDoc || {}),
          creditsLimit: 5,
          effectiveLimit,
          addOnCreditsRemaining: Math.max(0, effectiveLimit - creditsUsed),
        },
      });
    } finally {
      await WebsiteCreditRequest.findByIdAndUpdate(requestId, {
        $set: { creditsGrantProcessingAt: null },
      });
    }
  } catch (error) {
    next(error);
  }
};

const resetMonthlyWebsiteCredits = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const now = new Date();
    const dueDocs = await WebsiteCredits.find({
      creditsResetDate: { $ne: null, $lte: now },
    }).lean();

    if (!dueDocs.length) {
      return res.status(200).json({
        message: "No website credits are due for reset",
        updatedCount: 0,
      });
    }

    const operations = dueDocs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            creditsUsed: 0,
            creditsLimit: 5,
            addOnCreditsPurchased: 0, // default policy: no carry-forward
            creditsResetDate: getNextResetDate(now),
            updatedAtSource: "master-panel",
          },
        },
      },
    }));

    const result = await WebsiteCredits.bulkWrite(operations);
    return res.status(200).json({
      message: "Monthly website credits reset completed",
      updatedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

// All host companies' credit balances for the master panel Website Credits
// page. Company/workspace names are stored on the rows; fill any blanks from
// the host company / workspace collections.
const getWebsiteCreditsSummary = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const docs = await WebsiteCredits.find().sort({ updatedAt: -1 });
    const rows = docs.map((doc) => doc.toObject({ virtuals: true }));

    const companyIds = [
      ...new Set(
        rows
          .map((row) => normalizeCompanyId(row.companyId))
          .filter(Boolean),
      ),
    ];
    // Some legacy rows store the HostCompany ObjectId in companyId.
    const companyObjectIds = companyIds.filter((id) =>
      /^[a-f0-9]{24}$/i.test(id),
    );
    const workspaceIds = [
      ...new Set(
        rows
          .map((row) => String(row.workspaceId || "").trim())
          .filter((id) => /^[a-f0-9]{24}$/i.test(id)),
      ),
    ];

    const [hostCompanies, leadCompanies, hostCompaniesById, workspaces] =
      await Promise.all([
        companyIds.length
          ? HostCompany.find({ companyId: { $in: companyIds } })
              .select("companyId companyName")
              .lean()
          : Promise.resolve([]),
        companyIds.length
          ? HostLeadCompany.find({ companyId: { $in: companyIds } })
              .select("companyId companyName")
              .lean()
          : Promise.resolve([]),
        companyObjectIds.length
          ? HostCompany.find({ _id: { $in: companyObjectIds } })
              .select("_id companyName")
              .lean()
          : Promise.resolve([]),
        workspaceIds.length
          ? Workspace.find({ _id: { $in: workspaceIds } })
              .select("_id workspaceName businessName")
              .lean()
          : Promise.resolve([]),
      ]);

    const companyNameMap = new Map();
    hostCompanies.forEach((company) => {
      companyNameMap.set(String(company.companyId || "").trim(), company.companyName || "");
    });
    leadCompanies.forEach((company) => {
      const key = String(company.companyId || "").trim();
      if (!companyNameMap.get(key)) {
        companyNameMap.set(key, company.companyName || "");
      }
    });
    hostCompaniesById.forEach((company) => {
      const key = String(company._id || "").trim();
      if (!companyNameMap.get(key)) {
        companyNameMap.set(key, company.companyName || "");
      }
    });

    const workspaceNameMap = new Map();
    const workspaceBusinessNameMap = new Map();
    workspaces.forEach((workspace) => {
      const key = String(workspace._id || "").trim();
      workspaceNameMap.set(key, workspace.workspaceName || "");
      workspaceBusinessNameMap.set(key, workspace.businessName || "");
    });

    const enriched = rows.map((row) => {
      const workspaceKey = String(row.workspaceId || "").trim();
      return {
        ...row,
        // Legacy rows still carry the old "static-free" label until their
        // next plan sync; it is the same plan as "basic".
        plan: row.plan === "static-free" ? "basic" : row.plan || "basic",
        companyName:
          row.companyName ||
          companyNameMap.get(normalizeCompanyId(row.companyId)) ||
          workspaceBusinessNameMap.get(workspaceKey) ||
          "",
        workspaceName:
          row.workspaceName || workspaceNameMap.get(workspaceKey) || "",
      };
    });

    return res.status(200).json(enriched);
  } catch (error) {
    next(error);
  }
};

// Direct credit grant from the Website Credits page (no request involved).
const addWebsiteCreditsToCompany = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { companyId, workspaceId, credits, note } = req.body || {};
    const numericCredits = Number(credits);

    if (!Number.isFinite(numericCredits) || numericCredits <= 0) {
      return res.status(400).json({ message: "credits must be a positive number" });
    }
    if (!String(companyId || "").trim() && !String(workspaceId || "").trim()) {
      return res.status(400).json({ message: "companyId or workspaceId is required" });
    }

    const lookupClauses = [];
    if (String(workspaceId || "").trim()) {
      lookupClauses.push({ workspaceId: String(workspaceId).trim() });
    }
    if (String(companyId || "").trim()) {
      lookupClauses.push({ companyId: normalizeCompanyId(companyId) });
    }

    const existingDoc = await WebsiteCredits.findOne({ $or: lookupClauses });
    if (!existingDoc) {
      return res
        .status(404)
        .json({ message: "No credits record found for this company/workspace" });
    }

    // Top-ups are capped by the plan limit: remaining after adding can never
    // exceed the monthly limit (professional 8, basic 5). E.g. 6 of 8 used
    // means at most 6 can be added; all used means the full 8.
    const existingRow = existingDoc.toObject({ virtuals: true });
    const monthlyLimit = Number(existingRow.monthlyCreditsLimit || 0);
    const remaining = Number(existingRow.creditsRemaining || 0);
    const maxAddable = Math.max(0, monthlyLimit - remaining);

    if (maxAddable <= 0) {
      return res.status(400).json({
        message: `Credits are already at the plan limit of ${monthlyLimit}`,
      });
    }
    if (numericCredits > maxAddable) {
      return res.status(400).json({
        message: `Only ${maxAddable} credit${maxAddable === 1 ? "" : "s"} can be added (plan limit is ${monthlyLimit})`,
      });
    }

    const creditsDoc = await WebsiteCredits.findByIdAndUpdate(
      existingDoc._id,
      {
        $set: { updatedAtSource: "master-panel" },
        $inc: { addOnCreditsPurchased: numericCredits },
      },
      { new: true },
    );

    const creditsRow = creditsDoc.toObject({ virtuals: true });

    // Fire-and-forget: record the grant in the credits ledger.
    WebsiteCreditLedger.create({
      type: "added",
      credits: numericCredits,
      sourcePanel: "master_panel",
      companyId: String(creditsRow.companyId || ""),
      companyName: creditsRow.companyName || "",
      workspaceId: String(creditsRow.workspaceId || ""),
      workspaceName: creditsRow.workspaceName || "",
      performedById: String(req.user || ""),
      performedByName: String(
        `${req.userData?.firstName || ""} ${req.userData?.lastName || ""}`,
      ).trim(),
      performedByEmail: String(req.userData?.email || "").trim().toLowerCase(),
      description: String(note || "").trim() || "Credits added from master panel",
      remainingAfter: creditsRow.creditsRemaining,
    }).catch((error) =>
      console.error("Failed to record credit grant:", error?.message),
    );

    return res.status(200).json({
      message: "Credits added successfully",
      websiteCredits: creditsRow,
    });
  } catch (error) {
    next(error);
  }
};

// Usage/grant history for one credits row (or everything when unfiltered).
const getWebsiteCreditLedger = async (req, res, next) => {
  try {
    if (!ensureMasterRole(req.roles, req.userData)) {
      return res.status(403).json({ message: "Master access required" });
    }

    const { companyId, workspaceId } = req.query || {};

    const clauses = [];
    if (String(workspaceId || "").trim()) {
      clauses.push({ workspaceId: String(workspaceId).trim() });
    }
    if (String(companyId || "").trim()) {
      clauses.push({
        companyId: {
          $in: [String(companyId).trim(), normalizeCompanyId(companyId)],
        },
      });
    }

    const filter = clauses.length ? { $or: clauses } : {};
    const entries = await WebsiteCreditLedger.find(filter)
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();

    return res.status(200).json(entries);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWebsiteCreditRequest,
  getWebsiteCreditRequests,
  approveWebsiteCreditRequest,
  rejectWebsiteCreditRequest,
  sendWebsiteCreditPaymentLink,
  updateWebsiteCreditPaymentStatus,
  addWebsiteCredits,
  resetMonthlyWebsiteCredits,
  getWebsiteCreditsSummary,
  addWebsiteCreditsToCompany,
  getWebsiteCreditLedger,
};
