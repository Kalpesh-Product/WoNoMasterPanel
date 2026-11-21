const WebsiteCredits = require("../models/website/WebsiteCredits");
const {
  MONTHLY_BASE_CREDITS,
  creditsForPlan,
  loadCreditsSettings,
  normalizeCompanyKey,
  resolveWorkspacePlan,
  syncSubscriptionPlan,
} = require("../utils/websiteCredits");

const getFirstDayOfNextMonthUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
};

const normalizeId = (value) => String(value || "").trim();

const buildCandidateClauses = ({ companyId, workspaceId, routeId }) => {
  const normalizedCompanyId = normalizeId(companyId);
  const normalizedWorkspaceId = normalizeId(workspaceId);
  const normalizedRouteId = normalizeId(routeId);
  const clauses = [];
  const seen = new Set();

  const pushClause = (clause) => {
    const key = JSON.stringify(clause);
    if (seen.has(key)) return;
    seen.add(key);
    clauses.push(clause);
  };

  // The website builder (and therefore its credit pool) is shared by every
  // unit of a company, so the company key is tried first and is authoritative;
  // workspaceId / routeId only cover legacy rows created before that.
  if (normalizedCompanyId) {
    pushClause({ companyId: normalizeCompanyKey(normalizedCompanyId) });
  }

  if (normalizedCompanyId && normalizedWorkspaceId) {
    pushClause({ companyId: normalizedCompanyId, workspaceId: normalizedWorkspaceId });
  }

  if (normalizedWorkspaceId) {
    pushClause({ workspaceId: normalizedWorkspaceId });
  }

  if (normalizedRouteId) {
    pushClause({ companyId: normalizeCompanyKey(normalizedRouteId) });
    pushClause({ workspaceId: normalizedRouteId });
  }

  return clauses;
};

const findWorkspaceSubscription = async ({ companyId, workspaceId, routeId }) => {
  const clauses = buildCandidateClauses({ companyId, workspaceId, routeId });

  for (const clause of clauses) {
    const subscription = await WebsiteCredits.findOne(clause)
      .sort({ addOnCreditsPurchased: -1, updatedAt: -1, createdAt: -1 })
      .exec();
    if (subscription) return subscription;
  }

  return null;
};

const renewMonthlyCreditsIfNeeded = async (subscription) => {
  if (!subscription) return subscription;

  // Plan (and its plan-based creditsLimit) is synced from the workspace's
  // selectedPlan and the staff-editable per-plan limits, so a changed limit
  // reaches the website builder on the next subscription read.
  await loadCreditsSettings();
  subscription = await syncSubscriptionPlan(subscription);

  const now = new Date();
  const resetDate = subscription.creditsResetDate ? new Date(subscription.creditsResetDate) : null;
  const resetExpired = !resetDate || Number.isNaN(resetDate.getTime()) || now >= resetDate;

  if (resetExpired) {
    subscription.creditsUsed = 0;
    subscription.creditsLimit = creditsForPlan(subscription.plan);
    subscription.creditsResetDate = getFirstDayOfNextMonthUtc();
    await subscription.save();
  }

  return subscription;
};

module.exports = {
  MONTHLY_BASE_CREDITS,
  creditsForPlan,
  loadCreditsSettings,
  resolveWorkspacePlan,
  getFirstDayOfNextMonthUtc,
  findWorkspaceSubscription,
  renewMonthlyCreditsIfNeeded,
};
