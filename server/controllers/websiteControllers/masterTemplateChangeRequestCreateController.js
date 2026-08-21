const mongoose = require("mongoose");
const AdminUser = require("../../models/AdminUser");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const WebsiteTemplateChangeRequest = require("../../models/website/WebsiteTemplateChangeRequest");
const WebsiteTemplateSettings = require("../../models/website/WebsiteTemplateSettings");
const { resolveWorkspacePlan } = require("../subscriptionHelpers");

const PLAN_KEYS = ["basic", "professional", "custom"];
const DEFAULT_SETTINGS = {
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
const normalizeTemplateId = (value) => text(value).toLowerCase();

const getActor = async (req) => {
  const admin = await AdminUser.findById(req.user).select("firstName lastName email").lean();
  if (!admin) return { id: text(req.user), name: "Master Panel user", email: "" };
  return {
    id: text(admin._id),
    name: `${text(admin.firstName)} ${text(admin.lastName)}`.trim() || text(admin.email) || "Master Panel user",
    email: text(admin.email),
  };
};

const normalizeSettings = (stored) => {
  const templates = Array.isArray(stored?.templates) && stored.templates.length
    ? stored.templates
    : DEFAULT_SETTINGS.templates;
  return {
    limitPeriod: stored?.limitPeriod === "lifetime" ? "lifetime" : "monthly",
    planChangeLimits: {
      basic: Number(stored?.planChangeLimits?.basic ?? DEFAULT_SETTINGS.planChangeLimits.basic),
      professional: Number(stored?.planChangeLimits?.professional ?? DEFAULT_SETTINGS.planChangeLimits.professional),
      custom: Number(stored?.planChangeLimits?.custom ?? DEFAULT_SETTINGS.planChangeLimits.custom),
    },
    templates: templates.map((row) => ({
      templateId: normalizeTemplateId(row.templateId),
      enabled: row.enabled === true,
      visible: row.visible !== false,
      allowedPlans: Array.isArray(row.allowedPlans)
        ? row.allowedPlans.map((plan) => text(plan).toLowerCase()).filter((plan) => PLAN_KEYS.includes(plan))
        : [...PLAN_KEYS],
      disabledReason: text(row.disabledReason) || "Coming soon",
    })),
  };
};

const getSettings = async () =>
  normalizeSettings(await WebsiteTemplateSettings.findOne({ key: "global" }).lean());

const findWebsite = async ({ websiteId, companyId, workspaceId }) => {
  const clauses = [];
  if (websiteId && mongoose.isValidObjectId(websiteId)) clauses.push({ _id: websiteId });
  if (companyId) clauses.push({ companyId });
  if (workspaceId) clauses.push({ workspaceId });
  if (!clauses.length) return null;
  return WebsiteTemplate.findOne({ isDeleted: { $ne: true }, $or: clauses })
    .sort({ updatedAt: -1 })
    .lean();
};

const getQuota = async ({ websiteId, plan, settings }) => {
  const rawLimit = Number(settings.planChangeLimits?.[plan] ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.max(0, Math.floor(rawLimit)) : 0;
  const completedFilter = { websiteId, status: "completed" };
  if (settings.limitPeriod === "monthly") {
    const now = new Date();
    completedFilter.completedAt = {
      $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)),
    };
  }
  const used = await WebsiteTemplateChangeRequest.countDocuments(completedFilter);
  return {
    period: settings.limitPeriod,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
};

const serializeRequest = (request) => {
  if (!request) return null;
  const value = request?.toObject ? request.toObject() : request;
  return {
    ...value,
    _id: text(value._id),
    websiteId: text(value.websiteId),
    companyId: text(value.companyId),
    workspaceId: text(value.workspaceId),
    currentTemplateId: normalizeTemplateId(value.currentTemplateId) || "default",
    requestedTemplateId: normalizeTemplateId(value.requestedTemplateId),
    requestSource: value.requestSource === "master" ? "master" : "host",
  };
};

const getMasterTemplateChangeSummary = async (req, res, next) => {
  try {
    const websiteId = text(req.query.websiteId);
    const companyId = text(req.query.companyId);
    const workspaceId = text(req.query.workspaceId);
    const website = await findWebsite({ websiteId, companyId, workspaceId });
    if (!website) return res.status(404).json({ message: "Website not found" });

    const resolvedCompanyId = text(website.companyId || companyId);
    const resolvedWorkspaceId = text(website.workspaceId || workspaceId);
    const [settings, plan] = await Promise.all([
      getSettings(),
      resolveWorkspacePlan({ workspaceId: resolvedWorkspaceId, companyId: resolvedCompanyId }),
    ]);
    const [quota, activeRequest, history] = await Promise.all([
      getQuota({ websiteId: website._id, plan, settings }),
      WebsiteTemplateChangeRequest.findOne({ websiteId: website._id, isActive: true }).sort({ createdAt: -1 }).lean(),
      WebsiteTemplateChangeRequest.find({ websiteId: website._id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    return res.status(200).json({
      websiteId: text(website._id),
      companyId: resolvedCompanyId,
      workspaceId: resolvedWorkspaceId,
      plan,
      currentTemplateId: normalizeTemplateId(website.themeVariant) || "default",
      quota,
      templates: settings.templates.map((row) => ({
        ...row,
        allowedForPlan: row.allowedPlans.includes(plan),
      })),
      activeRequest: serializeRequest(activeRequest),
      history: history.map(serializeRequest),
    });
  } catch (error) {
    next(error);
  }
};

const createMasterTemplateChangeRequest = async (req, res, next) => {
  try {
    const websiteId = text(req.body.websiteId);
    const companyId = text(req.body.companyId);
    const workspaceId = text(req.body.workspaceId);
    const requestedTemplateId = normalizeTemplateId(req.body.requestedTemplateId);
    if (!requestedTemplateId) {
      return res.status(400).json({ message: "requestedTemplateId is required" });
    }

    const website = await findWebsite({ websiteId, companyId, workspaceId });
    if (!website) return res.status(404).json({ message: "Website not found" });
    const currentTemplateId = normalizeTemplateId(website.themeVariant) || "default";
    if (currentTemplateId === requestedTemplateId) {
      return res.status(400).json({ message: "Choose a template different from the current template" });
    }

    const resolvedCompanyId = text(website.companyId || companyId);
    const resolvedWorkspaceId = text(website.workspaceId || workspaceId || resolvedCompanyId);
    const [settings, plan, actor] = await Promise.all([
      getSettings(),
      resolveWorkspacePlan({ workspaceId: resolvedWorkspaceId, companyId: resolvedCompanyId }),
      getActor(req),
    ]);
    const target = settings.templates.find((row) => row.templateId === requestedTemplateId);
    if (!target || target.visible === false) {
      return res.status(400).json({ message: "That template is not available" });
    }
    if (!target.enabled) {
      return res.status(400).json({ message: target.disabledReason || "That template is not ready yet" });
    }
    if (!target.allowedPlans.includes(plan)) {
      return res.status(403).json({ message: `That template is not included in the ${plan} plan` });
    }

    const activeRequest = await WebsiteTemplateChangeRequest.findOne({
      websiteId: website._id,
      isActive: true,
    }).lean();
    if (activeRequest) {
      return res.status(409).json({ message: "A template change request is already pending for this website" });
    }

    const quota = await getQuota({ websiteId: website._id, plan, settings });
    if (quota.remaining <= 0) {
      return res.status(403).json({
        message: `The ${plan} plan template-change limit has been reached`,
        quota,
      });
    }

    const created = await WebsiteTemplateChangeRequest.create({
      websiteId: website._id,
      companyId: resolvedCompanyId,
      workspaceId: resolvedWorkspaceId,
      companyName: text(website.companyName),
      currentTemplateId,
      requestedTemplateId,
      requestSource: "master",
      status: "pending",
      isActive: true,
      planAtRequest: plan,
      limitPeriodAtRequest: settings.limitPeriod,
      requestedByUserId: null,
      requestedByName: actor.name,
      requestedByEmail: actor.email,
      statusHistory: [{
        status: "pending",
        changedAt: new Date(),
        changedBy: actor.id,
        note: `Template change requested from Master Panel by ${actor.name}`,
      }],
    });

    return res.status(201).json({
      message: "Template change request submitted",
      request: serializeRequest(created),
      quota,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A template change request is already pending for this website" });
    }
    next(error);
  }
};

module.exports = {
  getMasterTemplateChangeSummary,
  createMasterTemplateChangeRequest,
};
