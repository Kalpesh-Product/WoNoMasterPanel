const Workspace = require("../models/hostCompany/Workspace");

// Kept in lockstep with HostPanel's server/utils/accountPlan.ts — same plan
// tiers/caps, ported to CommonJS so the master panel can enforce the same
// rules when it manages units directly on the shared workspaces collection.
const PLAN_RANK = { basic: 1, professional: 2, custom: 3 };
const VALID_PLANS = ["basic", "professional", "custom"];

const WORKSPACE_ACTIVE_LIMIT_BY_PLAN = {
  basic: 1,
  professional: 3,
  custom: Infinity,
};
const WORKSPACE_LIMIT_BY_PLAN = {
  basic: 1,
  professional: 5,
  custom: Infinity,
};

const rankPlan = (plan) => PLAN_RANK[String(plan || "").trim().toLowerCase()] || 0;

const normalizeAccountPlan = (plan) => {
  const value = String(plan || "").trim().toLowerCase();
  return VALID_PLANS.includes(value) ? value : "";
};

const getWorkspaceLimitForPlan = (plan) => {
  const key = normalizeAccountPlan(plan) || "basic";
  return WORKSPACE_LIMIT_BY_PLAN[key] ?? 1;
};

const getActiveWorkspaceLimitForPlan = (plan) => {
  const key = normalizeAccountPlan(plan) || "basic";
  return WORKSPACE_ACTIVE_LIMIT_BY_PLAN[key] ?? 1;
};

const countActiveAccountWorkspaces = async (ownerId) => {
  if (!ownerId) return 0;
  return Workspace.countDocuments({
    owner: ownerId,
    isActive: true,
    isDeleted: { $ne: true },
  }).exec();
};

const countAccountWorkspaces = async (ownerId) => {
  if (!ownerId) return 0;
  return Workspace.countDocuments({
    owner: ownerId,
    isDeleted: { $ne: true },
  }).exec();
};

const resolveMainWorkspaceId = async (ownerId) => {
  if (!ownerId) return "";
  const main = await Workspace.findOne({ owner: ownerId, isDeleted: { $ne: true } })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean()
    .exec();
  return main?._id ? String(main._id) : "";
};

const resolveAccountPlan = async (ownerId) => {
  if (!ownerId) return "";
  const workspaces = await Workspace.find({ owner: ownerId, isActive: true })
    .select("selectedPlan")
    .lean()
    .exec();
  return workspaces.reduce(
    (best, ws) =>
      rankPlan(ws?.selectedPlan) > rankPlan(best) ? normalizeAccountPlan(ws.selectedPlan) : best,
    "",
  );
};

module.exports = {
  WORKSPACE_ACTIVE_LIMIT_BY_PLAN,
  WORKSPACE_LIMIT_BY_PLAN,
  rankPlan,
  normalizeAccountPlan,
  getWorkspaceLimitForPlan,
  getActiveWorkspaceLimitForPlan,
  countActiveAccountWorkspaces,
  countAccountWorkspaces,
  resolveMainWorkspaceId,
  resolveAccountPlan,
};
