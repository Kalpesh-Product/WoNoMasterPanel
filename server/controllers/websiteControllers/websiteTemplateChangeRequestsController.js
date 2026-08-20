const mongoose = require("mongoose");
const AdminUser = require("../../models/AdminUser");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const WebsiteTemplateVersion = require("../../models/website/WebsiteTemplateVersion");
const WebsiteTemplateChangeRequest = require("../../models/website/WebsiteTemplateChangeRequest");
const WebsiteTemplateSettings = require("../../models/website/WebsiteTemplateSettings");
const Workspace = require("../../models/hostCompany/Workspace");

const PLAN_KEYS = ["basic", "professional", "custom"];
const TEMPLATE_IDS = ["default", "fresh-studio", "warm-organic", "emerald-studio", "minimal-swiss"];
const DEFAULT_SETTINGS = {
  key: "global",
  limitPeriod: "monthly",
  planChangeLimits: { basic: 1, professional: 2, custom: 3 },
  templates: [
    { templateId: "default", enabled: true, visible: true, allowedPlans: [...PLAN_KEYS], disabledReason: "" },
    { templateId: "fresh-studio", enabled: true, visible: true, allowedPlans: [...PLAN_KEYS], disabledReason: "" },
    { templateId: "warm-organic", enabled: true, visible: true, allowedPlans: ["professional", "custom"], disabledReason: "" },
    { templateId: "emerald-studio", enabled: true, visible: true, allowedPlans: ["custom"], disabledReason: "" },
    { templateId: "minimal-swiss", enabled: false, visible: true, allowedPlans: [...PLAN_KEYS], disabledReason: "Coming soon" },
  ],
};

const text = (value) => String(value || "").trim();
const templateId = (value) => text(value).toLowerCase();

const getActor = async (req) => {
  const admin = await AdminUser.findById(req.user).select("firstName lastName email").lean();
  if (!admin) return { id: text(req.user), name: "Master Panel user", email: "" };
  return {
    id: text(admin._id),
    name: `${text(admin.firstName)} ${text(admin.lastName)}`.trim() || text(admin.email) || "Master Panel user",
    email: text(admin.email),
  };
};

const serializeRequest = (request) => {
  const value = request?.toObject ? request.toObject() : request;
  return {
    ...value,
    _id: text(value?._id),
    websiteId: text(value?.websiteId),
    currentTemplateId: templateId(value?.currentTemplateId) || "default",
    requestedTemplateId: templateId(value?.requestedTemplateId),
  };
};

const normalizeSettings = (settings) => {
  const value = settings?.toObject ? settings.toObject() : settings || {};
  const rows = Array.isArray(value.templates) && value.templates.length
    ? value.templates
    : DEFAULT_SETTINGS.templates;
  return {
    key: "global",
    limitPeriod: value.limitPeriod === "lifetime" ? "lifetime" : "monthly",
    planChangeLimits: {
      basic: Math.max(0, Math.floor(Number(value?.planChangeLimits?.basic ?? DEFAULT_SETTINGS.planChangeLimits.basic))),
      professional: Math.max(0, Math.floor(Number(value?.planChangeLimits?.professional ?? DEFAULT_SETTINGS.planChangeLimits.professional))),
      custom: Math.max(0, Math.floor(Number(value?.planChangeLimits?.custom ?? DEFAULT_SETTINGS.planChangeLimits.custom))),
    },
    templates: rows.map((row) => ({
      templateId: templateId(row.templateId),
      enabled: row.enabled === true,
      visible: row.visible !== false,
      allowedPlans: Array.isArray(row.allowedPlans)
        ? row.allowedPlans.map((plan) => text(plan).toLowerCase()).filter((plan) => PLAN_KEYS.includes(plan))
        : [...PLAN_KEYS],
      disabledReason: text(row.disabledReason),
    })),
    updatedAt: value.updatedAt || null,
  };
};

const getTemplateChangeRequests = async (req, res, next) => {
  try {
    const status = text(req.query.status).toLowerCase();
    const companyId = text(req.query.companyId);
    const filter = {};
    if (["pending", "approved", "rejected", "completed"].includes(status)) filter.status = status;
    if (companyId) filter.companyId = companyId;
    const requests = await WebsiteTemplateChangeRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(requests.map(serializeRequest));
  } catch (error) {
    next(error);
  }
};

const approveTemplateChangeRequest = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    const request = await WebsiteTemplateChangeRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: "pending", isActive: true },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: actor.id,
          rejectionReason: "",
        },
        $push: {
          statusHistory: {
            status: "approved",
            changedAt: new Date(),
            changedBy: actor.id,
            note: `Approved by ${actor.name}`,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!request) return res.status(409).json({ message: "Only an active pending request can be approved" });
    return res.status(200).json({ message: "Template change request approved", request: serializeRequest(request) });
  } catch (error) {
    next(error);
  }
};

const rejectTemplateChangeRequest = async (req, res, next) => {
  try {
    const reason = text(req.body.reason);
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });
    if (reason.length > 500) return res.status(400).json({ message: "Rejection reason is too long" });
    const actor = await getActor(req);
    const request = await WebsiteTemplateChangeRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: "pending", isActive: true },
      {
        $set: {
          status: "rejected",
          isActive: false,
          reviewedAt: new Date(),
          reviewedBy: actor.id,
          rejectionReason: reason,
        },
        $push: {
          statusHistory: {
            status: "rejected",
            changedAt: new Date(),
            changedBy: actor.id,
            note: reason,
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!request) return res.status(409).json({ message: "Only an active pending request can be rejected" });
    return res.status(200).json({ message: "Template change request rejected", request: serializeRequest(request) });
  } catch (error) {
    next(error);
  }
};

const completeTemplateChangeRequest = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const actor = await getActor(req);
    const request = await WebsiteTemplateChangeRequest.findOne({
      _id: req.params.requestId,
      status: "approved",
      isActive: true,
    }).session(session);
    if (!request) {
      await session.abortTransaction();
      return res.status(409).json({ message: "Only an active approved request can be completed" });
    }

    const website = await WebsiteTemplate.findOne({
      _id: request.websiteId,
      isDeleted: { $ne: true },
    }).session(session);
    if (!website) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Website template not found" });
    }

    const authoritativeCurrent = templateId(website.themeVariant) || "default";
    if (authoritativeCurrent !== templateId(request.currentTemplateId)) {
      await session.abortTransaction();
      return res.status(409).json({
        message: `The website template changed after this request was submitted. It is currently ${authoritativeCurrent}.`,
      });
    }

    const requested = templateId(request.requestedTemplateId);
    const settings = normalizeSettings(await WebsiteTemplateSettings.findOne({ key: "global" }).session(session));
    const availability = settings.templates.find((row) => row.templateId === requested);
    if (!availability?.enabled || availability.visible === false) {
      await session.abortTransaction();
      return res.status(409).json({ message: "The requested template is currently disabled" });
    }
    const workspaceClauses = [];
    if (request.workspaceId && mongoose.isValidObjectId(request.workspaceId)) {
      workspaceClauses.push({ _id: request.workspaceId });
    }
    if (request.companyId) workspaceClauses.push({ companyId: request.companyId });
    const currentWorkspace = workspaceClauses.length
      ? await Workspace.findOne({ $or: workspaceClauses }).select("selectedPlan").session(session).lean()
      : null;
    const resolvedPlan = PLAN_KEYS.includes(text(currentWorkspace?.selectedPlan).toLowerCase())
      ? text(currentWorkspace.selectedPlan).toLowerCase()
      : request.planAtRequest;
    if (!availability.allowedPlans.includes(resolvedPlan)) {
      await session.abortTransaction();
      return res.status(409).json({ message: `The requested template is no longer enabled for the ${resolvedPlan} plan` });
    }

    const latestVersion = await WebsiteTemplateVersion.findOne({
      searchKey: website.searchKey,
    })
      .sort({ publishedAt: -1, version: -1 })
      .session(session)
      .lean();
    const changedAt = new Date();
    const nextVersion = Math.max(
      Number(website.publishedVersion || 0),
      Number(latestVersion?.version || 0),
    ) + 1;
    website.themeVariant = requested;
    if (website.publishedData && typeof website.publishedData === "object") {
      website.publishedData = { ...website.publishedData, themeVariant: requested };
      website.markModified("publishedData");
    }
    if (website.draftData && typeof website.draftData === "object") {
      website.draftData = { ...website.draftData, themeVariant: requested };
      website.markModified("draftData");
    }
    website.publishedVersion = nextVersion;
    website.publishedAt = changedAt;

    const baseSnapshot = latestVersion?.templateSnapshot && typeof latestVersion.templateSnapshot === "object"
      ? latestVersion.templateSnapshot
      : website.publishedData && typeof website.publishedData === "object"
        ? website.publishedData
        : website.toObject();
    const nextSnapshot = {
      ...baseSnapshot,
      themeVariant: requested,
      isPublished: website.isPublished === true,
      publishedVersion: nextVersion,
      publishedAt: changedAt,
    };

    await WebsiteTemplateVersion.updateMany(
      { searchKey: website.searchKey, isLatestPublished: true },
      { $set: { isLatestPublished: false } },
      { session },
    );
    await WebsiteTemplateVersion.create(
      [{
        searchKey: website.searchKey,
        companyName: website.companyName || request.companyName || "",
        companyId: website.companyId || request.companyId || "",
        version: nextVersion,
        isLatestPublished: true,
        publishedAt: changedAt,
        templateSnapshot: nextSnapshot,
      }],
      { session },
    );
    await website.save({ session });

    request.status = "completed";
    request.isActive = false;
    request.completedAt = changedAt;
    request.completedBy = actor.id;
    request.statusHistory.push({
      status: "completed",
      changedAt,
      changedBy: actor.id,
      note: `Template changed from ${authoritativeCurrent} to ${requested} by ${actor.name}`,
    });
    await request.save({ session });

    await session.commitTransaction();
    return res.status(200).json({
      message: "Website template changed successfully",
      request: serializeRequest(request),
      website: {
        _id: text(website._id),
        searchKey: website.searchKey,
        previousTemplateId: authoritativeCurrent,
        themeVariant: requested,
        publishedVersion: nextVersion,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

const getTemplateChangeSettings = async (_req, res, next) => {
  try {
    const settings = await WebsiteTemplateSettings.findOne({ key: "global" }).lean();
    return res.status(200).json(normalizeSettings(settings));
  } catch (error) {
    next(error);
  }
};

const updateTemplateChangeSettings = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    const limitPeriod = req.body.limitPeriod === "lifetime" ? "lifetime" : "monthly";
    const incomingLimits = req.body.planChangeLimits || {};
    const planChangeLimits = {};
    for (const plan of PLAN_KEYS) {
      const value = Number(incomingLimits[plan]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({ message: `Enter a valid ${plan} plan limit between 0 and 100` });
      }
      planChangeLimits[plan] = Math.floor(value);
    }

    const incomingTemplates = Array.isArray(req.body.templates) ? req.body.templates : [];
    const templateMap = new Map(incomingTemplates.map((row) => [templateId(row.templateId), row]));
    const templates = TEMPLATE_IDS.map((id) => {
      const row = templateMap.get(id) || DEFAULT_SETTINGS.templates.find((item) => item.templateId === id) || {};
      const allowedPlans = Array.isArray(row.allowedPlans)
        ? [...new Set(row.allowedPlans.map((plan) => text(plan).toLowerCase()).filter((plan) => PLAN_KEYS.includes(plan)))]
        : [];
      return {
        templateId: id,
        enabled: row.enabled === true,
        visible: row.visible !== false,
        allowedPlans,
        disabledReason: text(row.disabledReason).slice(0, 200),
      };
    });

    const settings = await WebsiteTemplateSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { key: "global", limitPeriod, planChangeLimits, templates, updatedBy: actor.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(200).json({
      message: "Website template settings updated",
      settings: normalizeSettings(settings),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplateChangeRequests,
  approveTemplateChangeRequest,
  rejectTemplateChangeRequest,
  completeTemplateChangeRequest,
  getTemplateChangeSettings,
  updateTemplateChangeSettings,
};
