const mongoose = require("mongoose");
const Workspace = require("../models/hostCompany/Workspace");
const WebsiteCreditsSettings = require("../models/website/WebsiteCreditsSettings");

// Monthly website-edit credits per plan are NOT hardcoded — staff edit them
// on Master Panel -> Website Credits -> Plan Credit Limits, which writes the
// singleton WebsiteCreditsSettings document. The numbers below are only the
// seed/default values used before that document has been read (and the
// fallback if it can never be read), so a cold process still behaves like it
// always did.
const DEFAULT_PLAN_CREDITS = {
  basic: 5,
  "static-free": 5, // legacy label for the same plan as "basic"
  professional: 8,
  custom: 12,
};

// Legacy named exports — kept so existing imports/re-exports keep working.
// They are defaults, not the live values; use creditsForPlan() instead.
const MONTHLY_BASE_CREDITS = DEFAULT_PLAN_CREDITS.basic;
const PROFESSIONAL_MONTHLY_CREDITS = DEFAULT_PLAN_CREDITS.professional;
const CUSTOM_MONTHLY_CREDITS = DEFAULT_PLAN_CREDITS.custom;

const toNonNegativeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizePlan = (plan) => {
  const value = String(plan || "").trim().toLowerCase();
  return value === "static-free" ? "basic" : value;
};

// creditsForPlan() is called from synchronous places too (the WebsiteCredits
// model's virtuals), so the live values are served from this in-process cache
// and refreshed from Mongo at most once per TTL, plus immediately whenever
// this process saves a change.
const CACHE_TTL_MS = 30 * 1000;
let cachedPlanCredits = { ...DEFAULT_PLAN_CREDITS };
let cachedAt = 0;
let loadInFlight = null;

const applySettings = (settings) => {
  const basic = toNonNegativeNumber(
    settings?.basicCredits,
    DEFAULT_PLAN_CREDITS.basic,
  );
  cachedPlanCredits = {
    basic,
    "static-free": basic,
    professional: toNonNegativeNumber(
      settings?.professionalCredits,
      DEFAULT_PLAN_CREDITS.professional,
    ),
    custom: toNonNegativeNumber(
      settings?.customCredits,
      DEFAULT_PLAN_CREDITS.custom,
    ),
  };
  cachedAt = Date.now();
};

const getOrCreateCreditsSettings = async () => {
  let settings = await WebsiteCreditsSettings.findOne({ singletonKey: "default" });
  if (!settings) {
    settings = await WebsiteCreditsSettings.create({ singletonKey: "default" });
  }
  return settings;
};

// Reads the settings document (creating it with defaults if missing) and
// refreshes the cache, honoring the TTL unless `force` is set.
const loadCreditsSettings = async ({ force = false } = {}) => {
  if (!force && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedPlanCredits;
  }
  if (loadInFlight) return loadInFlight;

  loadInFlight = (async () => {
    try {
      const settings = await getOrCreateCreditsSettings();
      applySettings(settings);
    } catch (error) {
      // Never fail a credit check because the settings row couldn't be read;
      // keep the last known (or default) values and retry after the TTL.
      console.error("Failed to load website credit settings:", error?.message);
      cachedAt = Date.now();
    } finally {
      loadInFlight = null;
    }
    return cachedPlanCredits;
  })();

  return loadInFlight;
};

const getCreditsSettings = async () => {
  await loadCreditsSettings();
  return getOrCreateCreditsSettings();
};

const updateCreditsSettings = async ({
  basicCredits,
  professionalCredits,
  customCredits,
  updatedByEmail,
} = {}) => {
  const settings = await getOrCreateCreditsSettings();

  if (basicCredits !== undefined && basicCredits !== null && basicCredits !== "") {
    settings.basicCredits = toNonNegativeNumber(basicCredits, settings.basicCredits);
  }
  if (
    professionalCredits !== undefined &&
    professionalCredits !== null &&
    professionalCredits !== ""
  ) {
    settings.professionalCredits = toNonNegativeNumber(
      professionalCredits,
      settings.professionalCredits,
    );
  }
  if (customCredits !== undefined && customCredits !== null && customCredits !== "") {
    settings.customCredits = toNonNegativeNumber(customCredits, settings.customCredits);
  }
  if (updatedByEmail !== undefined) {
    settings.updatedByEmail = String(updatedByEmail || "").trim();
  }

  await settings.save();
  // This process sees the new numbers immediately; other processes pick them
  // up within CACHE_TTL_MS.
  applySettings(settings);
  return settings;
};

// Snapshot of the live per-plan limits (basic / professional / custom).
const getPlanCreditLimits = () => {
  const { basic, professional, custom } = cachedPlanCredits;
  return { basicCredits: basic, professionalCredits: professional, customCredits: custom };
};

const creditsForPlan = (plan) => {
  const key = normalizePlan(plan);
  const cached = cachedPlanCredits[key];
  if (Number.isFinite(cached)) return cached;
  return DEFAULT_PLAN_CREDITS[key] ?? DEFAULT_PLAN_CREDITS.basic;
};

// The website builder is shared by every unit/workspace of a company, so the
// monthly credit pool is company-scoped: ONE website_credits document per
// company holding one limit, one usage counter and one add-on balance.
// companyId is the only key; workspaceId on that document is informational
// (the last unit that touched the shared pool). Legacy rows sometimes carry a
// "<companyId>-<timestamp>" suffix, so normalize before matching.
const normalizeCompanyKey = (rawCompanyId = "") => {
  const normalized = String(rawCompanyId || "").trim();
  const match = normalized.match(/^(.*)-(\d{10,})$/);
  return match?.[1] || normalized;
};

// Filter for a company's shared pool. Falls back to the workspace only for
// legacy rows that predate companyId being the key.
const buildCompanyCreditsFilter = ({ companyId, workspaceId } = {}) => {
  const companyKey = normalizeCompanyKey(companyId);
  if (companyKey) return { companyId: companyKey };
  const workspaceKey = String(workspaceId || "").trim();
  return workspaceKey ? { workspaceId: workspaceKey } : null;
};

// Maps the workspace's selectedPlan onto the website_credits plan field.
const resolveWorkspacePlan = async ({ workspaceId, companyId } = {}) => {
  try {
    const clauses = [];
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    const normalizedCompanyId = String(companyId || "").trim();

    if (
      normalizedWorkspaceId &&
      mongoose.isValidObjectId(normalizedWorkspaceId)
    ) {
      clauses.push({ _id: normalizedWorkspaceId });
    }
    if (normalizedCompanyId) {
      clauses.push({ companyId: normalizedCompanyId });
    }
    if (!clauses.length) return "basic";

    const workspace = await Workspace.findOne({ $or: clauses })
      .select("selectedPlan")
      .lean()
      .exec();

    const selectedPlan = String(workspace?.selectedPlan || "").trim();
    return ["basic", "professional", "custom"].includes(selectedPlan)
      ? selectedPlan
      : "basic";
  } catch {
    return "basic";
  }
};

// Keeps a website_credits doc's plan + creditsLimit in sync with the
// workspace's current plan AND the current plan limits, so upgrades/downgrades
// and staff limit changes take effect immediately.
// Saves only when something changed; returns the subscription.
const syncSubscriptionPlan = async (subscription) => {
  if (!subscription) return subscription;

  await loadCreditsSettings();

  const plan = await resolveWorkspacePlan({
    workspaceId: subscription.workspaceId,
    companyId: subscription.companyId,
  });
  const limit = creditsForPlan(plan);

  if (
    subscription.plan !== plan ||
    Number(subscription.creditsLimit || 0) !== limit
  ) {
    subscription.plan = plan;
    subscription.creditsLimit = limit;
    await subscription.save();
  }

  return subscription;
};

module.exports = {
  DEFAULT_PLAN_CREDITS,
  MONTHLY_BASE_CREDITS,
  PROFESSIONAL_MONTHLY_CREDITS,
  CUSTOM_MONTHLY_CREDITS,
  creditsForPlan,
  loadCreditsSettings,
  getCreditsSettings,
  updateCreditsSettings,
  getPlanCreditLimits,
  resolveWorkspacePlan,
  syncSubscriptionPlan,
  normalizeCompanyKey,
  buildCompanyCreditsFilter,
};
