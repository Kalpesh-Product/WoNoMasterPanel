const HostCompany = require("../../models/hostCompany/hostCompany");
const HostLeadCompany = require("../../models/hostCompany/hostLeadCompany");
const HostUser = require("../../models/hostCompany/hostUser");
const Workspace = require("../../models/hostCompany/Workspace");
const WorkspaceMember = require("../../models/hostCompany/WorkspaceMember");
const {
  getWorkspaceLimitForPlan,
  getActiveWorkspaceLimitForPlan,
  countActiveAccountWorkspaces,
  countAccountWorkspaces,
  resolveMainWorkspaceId,
  resolveAccountPlan,
} = require("../../utils/hostWorkspacePlan");

// Same prefix/name-match convention used by getCompanyMembers
// (hostUserControllers.js) and hostCompanyControllers.js — a workspace's
// companyId can be "<companyId>" or "<companyId>-<suffix>".
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

// Resolve every workspace belonging to a company, active or not — the
// existing per-controller helpers (getCompanyMembers, getHostLeadCompanies)
// all filter isActive:true because they only care about the live unit; unit
// management needs the disabled/deleted ones too.
const findCompanyWorkspaces = async (companyId, companyName) => {
  const normalizedCompanyId = String(companyId || "").trim();
  const companyIdRegex = buildCompanyIdPrefixRegex(normalizedCompanyId);
  const companyNameRegex = buildExactCaseInsensitiveRegex(companyName);

  const [byCompanyId, byName] = await Promise.all([
    companyIdRegex
      ? Workspace.find({ companyId: { $regex: companyIdRegex } }).lean()
      : Promise.resolve([]),
    companyNameRegex
      ? Workspace.find({ businessName: { $regex: companyNameRegex } }).lean()
      : Promise.resolve([]),
  ]);

  const merged = [...byCompanyId];
  byName.forEach((workspace) => {
    if (!merged.some((existing) => String(existing._id) === String(workspace._id))) {
      merged.push(workspace);
    }
  });

  return merged.sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  );
};

const resolveCompanyName = async (companyId) => {
  const normalizedCompanyId = String(companyId || "").trim();
  if (!normalizedCompanyId) return "";
  const company =
    (await HostCompany.findOne({ companyId: normalizedCompanyId }).select("companyName").lean()) ||
    (await HostLeadCompany.findOne({ companyId: normalizedCompanyId }).select("companyName").lean());
  return String(company?.companyName || "").trim();
};

// Build the per-owner plan context + flag derivation, mirroring HostPanel's
// getWorkspaceManagementOverview (workspaceControllers.ts:439-720).
const buildUnitPayload = async (workspaces) => {
  const ownerIds = [...new Set(workspaces.map((ws) => String(ws.owner || "")).filter(Boolean))];

  const ownerContext = new Map();
  for (const ownerId of ownerIds) {
    const [mainWorkspaceId, accountPlan] = await Promise.all([
      resolveMainWorkspaceId(ownerId),
      resolveAccountPlan(ownerId),
    ]);
    const ownerWorkspaces = workspaces.filter((ws) => String(ws.owner) === ownerId);
    const fallbackPlan = accountPlan || String(ownerWorkspaces[0]?.selectedPlan || "basic");
    const keptLimit = getWorkspaceLimitForPlan(fallbackPlan);
    const activeLimit = getActiveWorkspaceLimitForPlan(fallbackPlan);
    const keptCount = ownerWorkspaces.filter((ws) => ws.isDeleted !== true).length;
    const activeCount = ownerWorkspaces.filter(
      (ws) => ws.isDeleted !== true && ws.isActive !== false,
    ).length;
    const disabledCount = ownerWorkspaces.filter(
      (ws) => ws.isDeleted !== true && ws.isActive === false,
    ).length;
    const deletedCount = ownerWorkspaces.filter((ws) => ws.isDeleted === true).length;

    ownerContext.set(ownerId, {
      mainWorkspaceId,
      accountPlan: fallbackPlan,
      workspaceLimit: Number.isFinite(keptLimit) ? keptLimit : null,
      activeWorkspaceLimit: Number.isFinite(activeLimit) ? activeLimit : null,
      keptCount,
      activeCount,
      disabledCount,
      deletedCount,
    });
  }

  const owners = await HostUser.find({ _id: { $in: ownerIds } })
    .select("name email")
    .lean()
    .exec();
  const ownerNameById = new Map(owners.map((owner) => [String(owner._id), owner]));

  const units = workspaces.map((ws) => {
    const ownerId = String(ws.owner || "");
    const context = ownerContext.get(ownerId) || {};
    const workspaceId = String(ws._id);
    const isMain = workspaceId === context.mainWorkspaceId;
    return {
      id: workspaceId,
      owner: ownerId,
      ownerName: ownerNameById.get(ownerId)?.name || "",
      ownerEmail: ownerNameById.get(ownerId)?.email || "",
      companyId: ws.companyId || "",
      workspaceName: ws.workspaceName || "",
      businessName: ws.businessName || "",
      selectedPlan: String(ws.selectedPlan || "basic").trim().toLowerCase(),
      isActive: ws.isActive !== false,
      isDeleted: ws.isDeleted === true,
      isMain,
      deletedAt: ws.deletedAt || null,
      recoveryRequestedAt: ws.recoveryRequestedAt || null,
      createdAt: ws.createdAt,
      canDisable: ws.isDeleted !== true && !isMain && ws.isActive !== false,
      canEnable: ws.isDeleted !== true && ws.isActive === false,
      canDelete: ws.isDeleted !== true && !isMain,
      canRecover: ws.isDeleted === true,
    };
  });

  const accounts = ownerIds.map((ownerId) => ({
    owner: ownerId,
    ownerName: ownerNameById.get(ownerId)?.name || "",
    ownerEmail: ownerNameById.get(ownerId)?.email || "",
    ...ownerContext.get(ownerId),
  }));

  return { units, accounts };
};

const getCompanyUnits = async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const companyName =
      String(req.query.companyName || "").trim() || (await resolveCompanyName(companyId));
    const workspaces = await findCompanyWorkspaces(companyId, companyName);
    const { units, accounts } = await buildUnitPayload(workspaces);

    return res.status(200).json({
      message: "Units loaded successfully.",
      data: { companyId, companyName, units, accounts },
    });
  } catch (error) {
    next(error);
  }
};

const getCompanyRecoveryQueue = async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const companyName =
      String(req.query.companyName || "").trim() || (await resolveCompanyName(companyId));
    const workspaces = await findCompanyWorkspaces(companyId, companyName);
    const pending = workspaces
      .filter((ws) => ws.isDeleted === true && ws.recoveryRequestedAt)
      .sort(
        (a, b) => new Date(a.recoveryRequestedAt).getTime() - new Date(b.recoveryRequestedAt).getTime(),
      );

    const { units } = await buildUnitPayload(pending);

    return res.status(200).json({
      message: "Recovery queue loaded successfully.",
      data: { companyId, companyName, units },
    });
  } catch (error) {
    next(error);
  }
};

const setUnitActiveStatus = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const desiredActive = Boolean(req.body?.isActive);

    const target = await Workspace.findOne({ _id: workspaceId, isDeleted: { $ne: true } });
    if (!target) {
      return res.status(404).json({ message: "Unit not found." });
    }

    const mainWorkspaceId = await resolveMainWorkspaceId(target.owner);
    const isMainWorkspace = String(target._id) === mainWorkspaceId;

    if (isMainWorkspace && !desiredActive) {
      return res.status(400).json({
        message: "The main unit created at registration cannot be disabled.",
      });
    }

    if (Boolean(target.isActive) === desiredActive) {
      return res.status(200).json({
        message: `Unit is already ${desiredActive ? "enabled" : "disabled"}.`,
        data: { workspaceId: String(target._id), isActive: Boolean(target.isActive) },
      });
    }

    if (desiredActive) {
      const accountPlan = (await resolveAccountPlan(target.owner)) || target.selectedPlan;
      const activeLimit = getActiveWorkspaceLimitForPlan(accountPlan);
      const activeCount = await countActiveAccountWorkspaces(target.owner);
      if (activeCount >= activeLimit) {
        return res.status(403).json({
          code: "ACTIVE_WORKSPACE_LIMIT_REACHED",
          message: `Only ${activeLimit} unit${
            activeLimit === 1 ? "" : "s"
          } can be active at a time on the ${accountPlan} plan. Disable another active unit first.`,
        });
      }
    }

    target.isActive = desiredActive;
    await target.save();

    return res.status(200).json({
      message: desiredActive ? "Unit enabled successfully." : "Unit disabled successfully.",
      data: { workspaceId: String(target._id), isActive: desiredActive },
    });
  } catch (error) {
    next(error);
  }
};

const deleteUnit = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const target = await Workspace.findOne({ _id: workspaceId, isDeleted: { $ne: true } });
    if (!target) {
      return res.status(404).json({ message: "Unit not found." });
    }

    const mainWorkspaceId = await resolveMainWorkspaceId(target.owner);
    if (String(target._id) === mainWorkspaceId) {
      return res.status(400).json({
        message: "The main unit created at registration cannot be deleted.",
      });
    }

    target.isActive = false;
    target.isDeleted = true;
    target.deletedAt = new Date();
    target.recoveryRequestedAt = null;
    await target.save();

    await WorkspaceMember.updateMany({ workspace: target._id }, { $set: { isActive: false } });

    return res.status(200).json({
      message: "Unit deleted successfully.",
      data: { workspaceId: String(target._id) },
    });
  } catch (error) {
    next(error);
  }
};

const recoverUnit = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const target = await Workspace.findOne({ _id: workspaceId, isDeleted: true });
    if (!target) {
      return res.status(404).json({ message: "Deleted unit not found." });
    }

    const accountPlan = (await resolveAccountPlan(target.owner)) || target.selectedPlan;
    const keptLimit = getWorkspaceLimitForPlan(accountPlan);
    const keptCount = await countAccountWorkspaces(target.owner);
    if (keptCount >= keptLimit) {
      return res.status(403).json({
        code: "KEPT_WORKSPACE_LIMIT_REACHED",
        message: `This account is already at the ${keptLimit} kept-unit limit for the ${accountPlan} plan. Delete another unit before recovering this one.`,
      });
    }

    target.isDeleted = false;
    target.isActive = false;
    target.deletedAt = null;
    target.recoveryRequestedAt = null;
    await target.save();

    await WorkspaceMember.updateOne(
      { workspace: target._id, user: target.owner },
      { $set: { isActive: true } },
    );

    return res.status(200).json({
      message: "Unit recovered successfully. It is disabled until re-enabled.",
      data: { workspaceId: String(target._id) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyUnits,
  getCompanyRecoveryQueue,
  setUnitActiveStatus,
  deleteUnit,
  recoverUnit,
};
