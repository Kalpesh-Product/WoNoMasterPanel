const schedule = require("node-schedule");
const Workspace = require("../models/hostCompany/Workspace");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const { sendMail } = require("../config/nodemailerConfig");
const { buildPlanExpiryReminderEmail, buildTrialExpiryReminderEmail } = require("../utils/emailTemplates");
const { getDefaultEnabledModuleIdsForPlan, buildCatalogIndex } = require("../config/hostWorkspaceModuleCatalog");

const PLAN_LABELS = { professional: "Professional Plan", custom: "Custom Plan" };

const resolveModulesAtRisk = (plan) => {
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

// Daily at 06:00 UTC — explicit tz so "5 days before expiry" doesn't drift
// with the host machine's local timezone. Mirrors
// jobs/verificationRenewalReminders.js, but for the host's own core plan
// instead of the verification badge. planExpiryWarningSentAt is the same
// idempotency guard AND the flag HostPanel's dashboard banner reads — set
// once here, cleared on the next successful renewal payment
// (planPaymentControllers.js applyPaidPlanToWorkspace).
schedule.scheduleJob({ rule: "0 6 * * *", tz: "UTC" }, async () => {
  try {
    const now = new Date();
    const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const workspaces = await Workspace.find({
      planStatus: "active",
      selectedPlan: { $in: ["professional", "custom"] },
      planExpiryDate: { $lte: fiveDaysFromNow, $gte: now },
      planExpiryWarningSentAt: null,
    });

    for (const workspace of workspaces) {
      try {
        const lead = await HostLeadCompany.findOne({ companyId: workspace.companyId }).lean();
        const modulesAtRisk = resolveModulesAtRisk(workspace.selectedPlan);

        await sendMail({
          to: lead?.pocEmail,
          ...(workspace.isTrialing
            ? buildTrialExpiryReminderEmail({
                customerName: lead?.pocName || workspace.businessName,
                companyName: workspace.businessName,
                expiryDate: workspace.planExpiryDate,
                modulesAtRisk,
              })
            : buildPlanExpiryReminderEmail({
                customerName: lead?.pocName || workspace.businessName,
                companyName: workspace.businessName,
                planLabel: PLAN_LABELS[workspace.selectedPlan] || workspace.selectedPlan,
                expiryDate: workspace.planExpiryDate,
                modulesAtRisk,
              })),
        });

        await Workspace.updateOne(
          { _id: workspace._id },
          { $set: { planStatus: "expiring_soon", planExpiryWarningSentAt: now } },
        );
      } catch (itemError) {
        console.error(
          `Plan expiry reminder failed for workspace ${workspace._id}:`,
          itemError.message,
        );
      }
    }
  } catch (error) {
    console.error("Plan expiry reminder job failed:", error.message);
  }
});

module.exports = {}; // required for its scheduling side effect only
