const schedule = require("node-schedule");
const Workspace = require("../models/hostCompany/Workspace");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const { sendMail } = require("../config/nodemailerConfig");
const { buildPlanDowngradedEmail, buildTrialEndedEmail } = require("../utils/emailTemplates");
const { getDefaultEnabledModuleIdsForPlan, buildCatalogIndex } = require("../config/hostWorkspaceModuleCatalog");

const PLAN_LABELS = { professional: "Professional Plan", custom: "Custom Plan" };

const resolveModulesLost = (plan) => {
  const planIds = new Set(getDefaultEnabledModuleIdsForPlan(plan));
  const basicIds = new Set(getDefaultEnabledModuleIdsForPlan("basic"));
  const index = buildCatalogIndex();
  const lost = [];
  for (const id of planIds) {
    if (basicIds.has(id)) continue;
    lost.push(index.get(id)?.label || id);
  }
  return lost;
};

// Daily at 07:00 UTC (offset from the 06:00 reminder job so the two don't
// contend). Fires once planExpiryDate has actually passed with no renewal
// payment — a successful renewal (planPaymentControllers.js
// applyPaidPlanToWorkspace) always pushes planExpiryDate forward first, so a
// paid workspace never matches this query.
//
// Downgrade mechanics: resolveIsUnlocked() in HostPanel's
// workspaceModuleCatalog.ts unlocks any module id present in
// enabledModuleIds REGARDLESS of selectedPlan, so flipping selectedPlan
// alone would not actually lock anything — enabledModuleIds itself must be
// pruned back to Basic's default set. preDowngradeEnabledModuleIds keeps a
// snapshot so a later renewal can restore exactly what was there before,
// nothing else on the workspace (tenants, bookings, finance data, etc.) is
// touched.
schedule.scheduleJob({ rule: "0 7 * * *", tz: "UTC" }, async () => {
  try {
    const now = new Date();

    const workspaces = await Workspace.find({
      selectedPlan: { $in: ["professional", "custom"] },
      planExpiryDate: { $lt: now },
    });

    for (const workspace of workspaces) {
      try {
        const previousPlan = workspace.selectedPlan;
        const wasTrialing = Boolean(workspace.isTrialing);
        const modulesLost = resolveModulesLost(previousPlan);
        const basicDefaultIds = getDefaultEnabledModuleIdsForPlan("basic");

        await Workspace.updateOne(
          { _id: workspace._id },
          {
            $set: {
              selectedPlan: "basic",
              planStatus: "expired_downgraded",
              enabledModuleIds: basicDefaultIds,
              preDowngradeEnabledModuleIds: workspace.enabledModuleIds || [],
              isTrialing: false,
            },
          },
        );

        // hasUsedTrial is NOT touched here — it stays permanently true once a
        // trial has ever been claimed, so a company gets exactly one trial.
        await HostLeadCompany.updateOne(
          { companyId: workspace.companyId },
          wasTrialing
            ? { $set: { isTrialActive: false, subscriptionStatus: "" } }
            : { $set: { upgradeStatus: "downgraded" } },
        );

        const lead = await HostLeadCompany.findOne({ companyId: workspace.companyId }).lean();
        await sendMail({
          to: lead?.pocEmail,
          ...(wasTrialing
            ? buildTrialEndedEmail({
                customerName: lead?.pocName || workspace.businessName,
                companyName: workspace.businessName,
                modulesLost,
              })
            : buildPlanDowngradedEmail({
                customerName: lead?.pocName || workspace.businessName,
                companyName: workspace.businessName,
                previousPlanLabel: PLAN_LABELS[previousPlan] || previousPlan,
                modulesLost,
              })),
        });
      } catch (itemError) {
        console.error(
          `Plan downgrade failed for workspace ${workspace._id}:`,
          itemError.message,
        );
      }
    }
  } catch (error) {
    console.error("Plan downgrade job failed:", error.message);
  }
});

module.exports = {}; // required for its scheduling side effect only
