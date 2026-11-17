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
// paid workspace never matches this query. For a card-backed subscription
// (startTrialCheckout), this is only a safety net — see the past_due gate
// below — not the primary downgrade path.
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

    // Card-backed companies (started their trial through startTrialCheckout)
    // are normally downgraded immediately by handleSubscriptionCanceled the
    // moment Stripe confirms the subscription is truly over
    // (customer.subscription.deleted) — this cron is only a safety net for
    // them, for the case that event never arrives (e.g. the Stripe account
    // is configured to mark a subscription "unpaid" instead of canceling
    // it after exhausting retries). subscriptionStatus keyed by companyId
    // below, so each workspace can be checked cheaply.
    const cardBackedStatusByCompanyId = new Map(
      (await HostLeadCompany.find({ stripeCustomerId: { $ne: "" } }).select("companyId subscriptionStatus").lean()).map(
        (c) => [c.companyId, c.subscriptionStatus],
      ),
    );

    for (const workspace of workspaces) {
      try {
        // Our planExpiryDate is only an ESTIMATE for a card-backed company
        // (computed from freeTrialDurationDays, not Stripe's own billing
        // cycle) — it can drift a day or two from when Stripe actually
        // attempts the charge. Downgrading just because that estimate
        // passed would risk locking out someone Stripe hasn't even tried
        // to charge yet. Only act once a charge attempt has actually
        // failed (subscriptionStatus "past_due", set by
        // handleSubscriptionPaymentFailed) — otherwise wait for Stripe's
        // own webhooks (invoice.paid extends the date; invoice.payment_failed
        // sets past_due; customer.subscription.deleted downgrades directly).
        if (cardBackedStatusByCompanyId.has(workspace.companyId)) {
          if (cardBackedStatusByCompanyId.get(workspace.companyId) !== "past_due") continue;
        }
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
