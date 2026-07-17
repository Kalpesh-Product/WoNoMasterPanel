const WebsiteCredits = require("../models/website/WebsiteCredits");
const {
  MONTHLY_BASE_CREDITS,
  creditsForPlan,
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

  if (normalizedCompanyId && normalizedWorkspaceId) {
    pushClause({ companyId: normalizedCompanyId, workspaceId: normalizedWorkspaceId });
  }

  if (normalizedCompanyId) {
    pushClause({ companyId: normalizedCompanyId });
  }

  if (normalizedWorkspaceId) {
    pushClause({ workspaceId: normalizedWorkspaceId });
  }

  if (normalizedRouteId) {
    pushClause({ companyId: normalizedRouteId });
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
  // selectedPlan — professional: 8, custom: 12, basic: 5.
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
  resolveWorkspacePlan,
  getFirstDayOfNextMonthUtc,
  findWorkspaceSubscription,
  renewMonthlyCreditsIfNeeded,
};
