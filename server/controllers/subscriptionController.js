const WebsiteCredits = require("../models/website/WebsiteCredits");
const {
  creditsForPlan,
  findWorkspaceSubscription,
  getFirstDayOfNextMonthUtc,
  renewMonthlyCreditsIfNeeded,
  resolveWorkspacePlan,
} = require("./subscriptionHelpers");

// Mirrors the host panel's GET /api/subscription/:id so the ported website
// builder's CreditsIndicator reads the same credit math from the shared
// website_credits collection.
const getSubscription = async (req, res, next) => {
  try {
    const routeId = String(
      req.params?.companyId || req.params?.workspaceId || "",
    ).trim();
    const queryCompanyId = String(req.query?.companyId || "").trim();
    const queryWorkspaceId = String(req.query?.workspaceId || "").trim();
    const companyId = queryCompanyId || routeId;
    const workspaceId = queryWorkspaceId || routeId;

    if (!routeId && !companyId && !workspaceId) {
      return res.status(400).json({ error: "companyId or workspaceId is required" });
    }

    let subscription = await findWorkspaceSubscription({
      companyId,
      workspaceId,
      routeId,
    });

    if (!subscription) {
      const plan = await resolveWorkspacePlan({ workspaceId, companyId });
      subscription = await WebsiteCredits.create({
        companyId: companyId || workspaceId || routeId || undefined,
        workspaceId: workspaceId || companyId || routeId || undefined,
        plan,
        creditsLimit: creditsForPlan(plan),
        creditsUsed: 0,
        addOnCreditsPurchased: 0,
        creditsResetDate: getFirstDayOfNextMonthUtc(),
      });
    }

    subscription = await renewMonthlyCreditsIfNeeded(subscription);

    const doc = subscription.toObject({ virtuals: true });
    return res.status(200).json(doc);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getSubscription };
