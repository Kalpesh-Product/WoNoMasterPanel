const mongoose = require("mongoose");
const Workspace = require("../models/hostCompany/Workspace");

// Monthly website-edit credits per plan. "basic" replaces the legacy
// "static-free" label (same 5 credits); custom is 12 for now and can be
// adjusted here later.
const MONTHLY_BASE_CREDITS = 5;
const PROFESSIONAL_MONTHLY_CREDITS = 8;
const CUSTOM_MONTHLY_CREDITS = 12;

const PLAN_CREDITS = {
  basic: MONTHLY_BASE_CREDITS,
  "static-free": MONTHLY_BASE_CREDITS, // legacy rows not yet migrated to "basic"
  professional: PROFESSIONAL_MONTHLY_CREDITS,
  custom: CUSTOM_MONTHLY_CREDITS,
};

const creditsForPlan = (plan) =>
  PLAN_CREDITS[String(plan || "").trim()] ?? MONTHLY_BASE_CREDITS;

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
// workspace's current plan, so upgrades/downgrades take effect immediately.
// Saves only when something changed; returns the subscription.
const syncSubscriptionPlan = async (subscription) => {
  if (!subscription) return subscription;

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
  MONTHLY_BASE_CREDITS,
  PROFESSIONAL_MONTHLY_CREDITS,
  CUSTOM_MONTHLY_CREDITS,
  creditsForPlan,
  resolveWorkspacePlan,
  syncSubscriptionPlan,
};
