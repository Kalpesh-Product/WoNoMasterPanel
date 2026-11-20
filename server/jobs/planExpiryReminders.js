const schedule = require("node-schedule");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Workspace = require("../models/hostCompany/Workspace");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const { sendMail } = require("../config/nodemailerConfig");
const {
  buildPlanExpiryReminderEmail,
  buildTrialExpiryReminderEmail,
  buildAutopayUpcomingChargeEmail,
} = require("../utils/emailTemplates");
const { getDefaultEnabledModuleIdsForPlan, buildCatalogIndex } = require("../config/hostWorkspaceModuleCatalog");
const { getProfessionalPlanPriceUsd } = require("../services/modulePricingService");
const { resolveHostPanelFrontendUrl } = require("../controllers/planPaymentControllers");

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

    // Card-backed companies (started their trial through startTrialCheckout)
    // auto-charge on their own — "renew now" is the wrong message for them.
    // Keyed by companyId so each workspace below can check it cheaply.
    const cardBackedCompanyIds = new Set(
      (await HostLeadCompany.find({ stripeCustomerId: { $ne: "" } }).select("companyId").lean()).map(
        (c) => c.companyId,
      ),
    );

    for (const workspace of workspaces) {
      try {
        const lead = await HostLeadCompany.findOne({ companyId: workspace.companyId }).lean();
        const modulesAtRisk = resolveModulesAtRisk(workspace.selectedPlan);
        const isCardBacked = cardBackedCompanyIds.has(workspace.companyId);

        let emailPayload;
        if (isCardBacked) {
          let billingPortalUrl = null;
          try {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: lead.stripeCustomerId,
              return_url: `${resolveHostPanelFrontendUrl()}/profile/plan-billing`,
            });
            billingPortalUrl = portalSession.url;
          } catch (portalError) {
            console.error("Failed to create billing portal session for reminder email:", portalError.message);
          }
          emailPayload = buildAutopayUpcomingChargeEmail({
            customerName: lead?.pocName || workspace.businessName,
            companyName: workspace.businessName,
            planLabel: PLAN_LABELS[workspace.selectedPlan] || workspace.selectedPlan,
            chargeDate: workspace.planExpiryDate,
            amount: await getProfessionalPlanPriceUsd(),
            billingPortalUrl,
          });
        } else {
          emailPayload = workspace.isTrialing
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
              });
        }

        await sendMail({ to: lead?.pocEmail, ...emailPayload });

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
