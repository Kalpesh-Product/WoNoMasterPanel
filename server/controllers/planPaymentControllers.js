const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const PlanPaymentLink = require("../models/PlanPaymentLink");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const Workspace = require("../models/hostCompany/Workspace");
const { sendMail } = require("../config/nodemailerConfig");
const {
  buildPlanPaymentEmail,
  buildPlanPaymentConfirmationEmail,
  buildPlanStartedEmail,
} = require("../utils/emailTemplates");
const {
  computeCustomPlanPrice,
  getCustomPlanPricingBreakdown,
  getProfessionalPlanPriceUsd,
  getProfessionalAnnualPlanPriceUsd,
} = require("../services/modulePricingService");
const { getDefaultEnabledModuleIdsForPlan } = require("../config/hostWorkspaceModuleCatalog");

const PLAN_LABELS = { professional: "Professional Plan", custom: "Custom Plan" };
const PLAN_RANK = { basic: 0, professional: 1, custom: 2 };

const normalizeBillingCycle = (value) =>
  ["monthly", "annual"].includes(String(value || "").trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : "monthly";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeIdList = (value = []) =>
  Array.from(new Set((Array.isArray(value) ? value : []).map((id) => String(id).trim()).filter(Boolean))).sort();

const sameIdList = (a = [], b = []) => {
  const first = normalizeIdList(a);
  const second = normalizeIdList(b);
  return first.length === second.length && first.every((id, index) => id === second[index]);
};

// Same prefix/name-fallback matching convention already used in
// hostCompanyControllers.js's updateUpgradePaymentStatus.
const resolveWorkspaceForCompany = async ({ companyId, companyName }) => {
  const orClauses = [];
  if (companyId) {
    orClauses.push({ companyId: { $regex: new RegExp(`^${escapeRegex(companyId)}(?:$|-)`, "i") } });
  }
  if (companyName) {
    orClauses.push({ businessName: { $regex: new RegExp(`^${escapeRegex(companyName)}$`, "i") } });
  }
  if (!orClauses.length) return null;
  return Workspace.findOne({ $or: orClauses, isActive: true });
};

// Where Stripe sends the host after a successful payment. Mirrors
// companyVerificationPaymentsControllers.js's resolveHostPanelFrontendUrl —
// duplicated locally rather than imported to avoid a circular require with
// hostUserControllers.js (which requires this file for the webhook branch).
const resolveHostPanelFrontendUrl = () => {
  if (process.env.HOST_PANEL_RETURN_BASE_URL) {
    return String(process.env.HOST_PANEL_RETURN_BASE_URL).replace(/\/+$/, "");
  }
  const base =
    process.env.NODE_ENV === "production"
      ? process.env.HOST_PANEL_FRONTEND_URL || "https://hostpanel.wono.co"
      : process.env.HOST_PANEL_FRONTEND_URL_DEV ||
        process.env.HOST_PANEL_FRONTEND_URL_LOCAL ||
        "http://localhost:3006";
  return String(base).replace(/\/+$/, "");
};

// initial = first-ever paid plan for this company; renewal = same plan
// renewing its monthly cycle; upgrade/downgrade = switched tier.
const computeChangeType = (previousPlan, newPlan) => {
  const prev = String(previousPlan || "").toLowerCase();
  if (!prev || prev === "basic") return "initial";
  if (prev === newPlan) return "renewal";
  return (PLAN_RANK[newPlan] ?? 0) > (PLAN_RANK[prev] ?? 0) ? "upgrade" : "downgrade";
};

// Used only to PREVIEW the new cycle's start/end dates in the payment-link
// email before the host has actually paid — the authoritative value is set
// on the webhook (or, for a pre-registration initial payment, when the
// workspace is actually created in completeWorkspaceSetup on HostPanel).
// Monthly covers +1 calendar month; annual covers +12 months (one full
// yearly cycle, matching the rate × 12 charged for it).
const computeProjectedPeriod = (currentExpiryDate, billingCycle = "monthly") => {
  const start =
    currentExpiryDate && new Date(currentExpiryDate) > new Date()
      ? new Date(currentExpiryDate)
      : new Date();
  const end = new Date(start);
  if (normalizeBillingCycle(billingCycle) === "annual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return { start, end };
};

// Shared by the signup-lead "Send Payment Link" action and the
// already-onboarded-workspace upgrade/renewal flow. Basic never calls this —
// it's free and skips payment entirely.
const createAndSendPlanPaymentLink = async ({
  leadId = null,
  companyId,
  companyName,
  leadName,
  leadEmail,
  plan,
  previousPlan = null,
  customModuleIds = [],
  billingCycle = "monthly",
}) => {
  const normalizedPlan = String(plan || "").toLowerCase();
  const cycle = normalizeBillingCycle(billingCycle);
  if (!["professional", "custom"].includes(normalizedPlan)) {
    throw new Error("plan must be 'professional' or 'custom'");
  }
  if (!leadEmail) throw new Error("leadEmail is required");

  const workspace = await resolveWorkspaceForCompany({ companyId, companyName });
  const changeType = computeChangeType(previousPlan, normalizedPlan);

  const customPricingBreakdown =
    normalizedPlan === "custom" ? await getCustomPlanPricingBreakdown(customModuleIds) : null;
  // monthly → the monthly rate once. annual → the annual total
  // (professionalAnnualPlanPriceUsd is the FULL yearly price, e.g. $1,999/yr
  // charged once for a single 12-month cycle) or the custom yearly total.
  const amount =
    normalizedPlan === "professional"
      ? cycle === "annual"
        ? await getProfessionalAnnualPlanPriceUsd()
        : await getProfessionalPlanPriceUsd()
      : await computeCustomPlanPrice(customModuleIds, cycle);

  const { start: projectedStart, end: projectedEnd } = computeProjectedPeriod(
    workspace?.planExpiryDate,
    cycle,
  );

  const planLabel = PLAN_LABELS[normalizedPlan];
  const cycleLabel = cycle === "annual" ? "Annual" : "Monthly";

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `${changeType === "renewal" ? `${planLabel} — ${cycleLabel} Renewal` : planLabel} (${companyName || leadName})`,
          },
        },
        quantity: 1,
      },
    ],
    // Produces a real Stripe Invoice (PDF + hosted page) we attach to the
    // confirmation email and show on the Plan & Billing tab — no local PDF
    // generation involved.
    invoice_creation: { enabled: true },
    after_completion: {
      type: "redirect",
      redirect: { url: `${resolveHostPanelFrontendUrl()}/profile/plan-billing/payment-result` },
    },
  });

  const checkoutUrl = `${paymentLink.url}?prefilled_email=${encodeURIComponent(leadEmail)}`;

  await PlanPaymentLink.create({
    companyId,
    workspaceId: workspace?._id || null,
    leadId,
    leadName,
    leadEmail,
    companyName,
    plan: normalizedPlan,
    previousPlan: previousPlan || null,
    changeType,
    billingCycle: cycle,
    customModuleIds: normalizedPlan === "custom" ? customModuleIds : [],
    customPricingBreakdown: customPricingBreakdown || undefined,
    amount,
    currency: "usd",
    periodStart: projectedStart,
    periodEnd: projectedEnd,
    stripePaymentLinkId: paymentLink.id,
    stripePaymentLinkUrl: paymentLink.url,
  });

  await sendMail({
    to: leadEmail,
    ...buildPlanPaymentEmail({
      customerName: leadName,
      companyName,
      planLabel,
      paymentLinkUrl: checkoutUrl,
      amount,
      changeType,
      billingCycle: cycle,
      projectedStart,
      projectedEnd,
      customPricingBreakdown,
    }),
  });

  return { paymentLinkUrl: checkoutUrl, amount, changeType, billingCycle: cycle };
};

// POST /api/hosts/plan-payments/send  { companyId, plan, customModuleIds?, companyName?, email?, name? }
// Staff-triggered: works both for a signup lead pre-registration (no
// Workspace yet — companyId is the Nomads lead id at this stage, matching
// PlanPaymentLink's identifier the same way BookingPaymentLink used to key
// off leadId) and for an already-onboarded workspace requesting an
// upgrade/renewal (companyId is the real HostLeadCompany/Workspace
// companyId there).
const sendPlanPaymentLink = async (req, res, next) => {
  try {
    const { companyId, plan, customModuleIds, companyName, email, name, billingCycle } =
      req.body || {};
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    if (!["professional", "custom"].includes(String(plan || "").toLowerCase())) {
      return res.status(400).json({ message: "plan must be 'professional' or 'custom'" });
    }

    const resolvedCompanyId = String(companyId).trim();
    let lead = await HostLeadCompany.findOne({ companyId: resolvedCompanyId });
    if (!lead) {
      // First time this lead is being sent a plan payment link — no
      // HostLeadCompany row exists yet at this early stage, so create one
      // (mirrors the upsert createHostInvite does later at invite time).
      if (!email) {
        return res.status(400).json({ message: "email is required to create a new lead record" });
      }
      lead = await HostLeadCompany.create({
        companyId: resolvedCompanyId,
        companyName: companyName || "",
        pocEmail: String(email).trim().toLowerCase(),
        pocName: name || "",
        plan: "basic",
        status: "closed",
        source: "signup-lead",
      });
    }

    const normalizedPlan = String(plan).toLowerCase();
    // Cycle from the request; falls back to the lead's remembered cycle
    // (set from their HostUser submission or a prior link send), guaranteed
    // "monthly" otherwise.
    const cycle = normalizeBillingCycle(billingCycle || lead.billingCycle);
    const resolvedCustomModuleIds =
      normalizedPlan === "custom"
        ? Array.isArray(customModuleIds) && customModuleIds.length
          ? customModuleIds
          : lead.customPlanModuleIds || []
        : [];

    // Reuse an already-outstanding pending link for this exact company+plan
    // instead of minting a new Stripe Payment Link on every click — without
    // this, a double-click (or staff re-clicking "Send Payment Link" before
    // the first email lands) creates multiple live links for the same
    // request, and only one of them ever actually gets paid.
    const pendingCandidates = await PlanPaymentLink.find({
      companyId: lead.companyId,
      plan: normalizedPlan,
      billingCycle: cycle,
      status: "pending",
    }).sort({ createdAt: -1 });
    const existingPending = pendingCandidates.find((link) =>
      normalizedPlan === "custom"
        ? sameIdList(link.customModuleIds, resolvedCustomModuleIds)
        : true,
    );

    let paymentLinkUrl;
    let amount;
    let changeType;
    if (existingPending) {
      paymentLinkUrl = `${existingPending.stripePaymentLinkUrl}?prefilled_email=${encodeURIComponent(lead.pocEmail)}`;
      amount = existingPending.amount;
      changeType = existingPending.changeType;
      // Still resend the email (staff clicking "Send" again usually means
      // the host lost/never got it) — just reusing the same live Stripe
      // link instead of minting a new one.
      await sendMail({
        to: lead.pocEmail,
        ...buildPlanPaymentEmail({
          customerName: lead.pocName,
          companyName: lead.companyName,
          planLabel: PLAN_LABELS[normalizedPlan],
          paymentLinkUrl,
          amount,
          changeType,
          billingCycle: existingPending.billingCycle || cycle,
          projectedStart: existingPending.periodStart,
          projectedEnd: existingPending.periodEnd,
          customPricingBreakdown: existingPending.customPricingBreakdown,
        }),
      });
    } else {
      ({ paymentLinkUrl, amount, changeType } = await createAndSendPlanPaymentLink({
        leadId: lead._id,
        companyId: lead.companyId,
        companyName: lead.companyName,
        leadName: lead.pocName,
        leadEmail: lead.pocEmail,
        plan: normalizedPlan,
        previousPlan: lead.plan || null,
        customModuleIds: resolvedCustomModuleIds,
        billingCycle: cycle,
      }));
    }

    lead.requestedPlan = normalizedPlan;
    lead.billingCycle = cycle;
    if (normalizedPlan === "custom" && resolvedCustomModuleIds.length) {
      lead.customPlanModuleIds = resolvedCustomModuleIds;
    }
    lead.paymentLinkUrl = paymentLinkUrl;
    lead.paymentLinkSentAt = new Date();
    // Deliberately NOT touching paymentStatus/paymentConfirmedAt here —
    // those reflect whether the plan has actually been paid for, which only
    // the payment webhook (handlePlanPaymentWebhookEvent) is allowed to set.
    // Sending/resending a link (including a legitimate renewal request for
    // an already-active plan) must never silently "unpay" it.
    lead.upgradeStatus = lead.paymentStatus ? lead.upgradeStatus : "payment_link_sent";
    await lead.save();

    return res.status(200).json({
      message: existingPending
        ? "Reused the already-pending payment link for this plan"
        : "Plan payment link sent successfully",
      paymentLinkUrl,
      amount,
      changeType,
      billingCycle: cycle,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/hosts/plan-payments  -> latest payment-link status per companyId,
// for the Signup Leads / Upgrade Plan tables' Payment Status columns.
const getPlanPaymentStatuses = async (req, res, next) => {
  try {
    const links = await PlanPaymentLink.find()
      .sort({ createdAt: -1 })
      .select("companyId status amount currency plan billingCycle paidAt createdAt hostedInvoiceUrl")
      .lean();

    // Prefer a PAID link over a pending one for the same company — a
    // newer pending duplicate/renewal link must never visually undo an
    // already-successful payment (this is what caused "payment done, email
    // received, but status still shows Pending": a stray newer pending
    // link was masking the real paid one). Within the same paid-ness, the
    // newest link wins.
    const statusByCompanyId = {};
    for (const link of links) {
      const key = String(link.companyId || "");
      if (!key) continue;
      const existing = statusByCompanyId[key];
      if (!existing || (existing.status !== "paid" && link.status === "paid")) {
        statusByCompanyId[key] = link;
      }
    }
    return res.status(200).json(statusByCompanyId);
  } catch (error) {
    next(error);
  }
};

// GET /api/hosts/host-companies/:companyId/plan-history — every plan
// payment attempt ever made for this company (not just the latest, unlike
// getPlanPaymentStatuses above), newest first, for the Host Companies view
// modal's plan history section.
const getHostCompanyPlanHistory = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const history = await PlanPaymentLink.find({ companyId })
      .sort({ createdAt: -1 })
      .select(
        "plan previousPlan changeType customModuleIds billingCycle amount currency status paidAt periodStart periodEnd hostedInvoiceUrl invoicePdfUrl createdAt",
      )
      .lean();
    return res.status(200).json({ history });
  } catch (error) {
    next(error);
  }
};

// Applies a paid PlanPaymentLink onto its Workspace (plan lifecycle fields +
// module restoration if it had been downgraded) and onto the HostLeadCompany
// tracking row. Shared by the webhook and, for symmetry, could be reused by
// a manual "resync" action later if ever needed.
const applyPaidPlanToWorkspace = async (link) => {
  const defaultModuleIds = getDefaultEnabledModuleIdsForPlan(link.plan);

  if (link.workspaceId) {
    const workspace = await Workspace.findById(link.workspaceId);
    if (workspace) {
      const restoredModuleIds = Array.from(
        new Set([...defaultModuleIds, ...(workspace.preDowngradeEnabledModuleIds || [])]),
      );
      await Workspace.updateOne(
        { _id: workspace._id },
        {
          $set: {
            selectedPlan: link.plan,
            purchasedPlan: link.plan,
            billingCycle: link.billingCycle || "monthly",
            planStatus: "active",
            planStartDate: workspace.planStartDate || link.periodStart || new Date(),
            planExpiryDate: link.periodEnd,
            planLastPaidAt: link.paidAt || new Date(),
            planExpiryWarningSentAt: null,
            enabledModuleIds: restoredModuleIds,
            preDowngradeEnabledModuleIds: [],
            ...(link.plan === "custom" && link.customModuleIds?.length
              ? { customPlanModuleIds: link.customModuleIds }
              : {}),
          },
        },
      );
    }
  }
  // No workspace yet (pre-registration initial payment) — nothing to update
  // here. completeWorkspaceSetup (HostPanel) reads HostLeadCompany's
  // paymentStatus/paymentConfirmedAt/plan when the Workspace is actually
  // created and initializes the same lifecycle fields at that point.

  await HostLeadCompany.updateOne(
    { companyId: link.companyId },
    {
      $set: {
        plan: link.plan,
        previousPlan: link.previousPlan || undefined,
        billingCycle: link.billingCycle || "monthly",
        paymentStatus: true,
        paymentConfirmedAt: link.paidAt || new Date(),
        upgradeStatus: "active",
      },
      // Only set inviteUnlockedAt if not already set — a company that pays,
      // gets invited, then later renews should not have its original
      // unlock timestamp overwritten.
      $setOnInsert: {},
    },
  );
  await HostLeadCompany.updateOne(
    { companyId: link.companyId, inviteUnlockedAt: null },
    { $set: { inviteUnlockedAt: link.paidAt || new Date() } },
  );
};

// Called from hostUserControllers.js's handleStripeWebhook dispatcher once
// it's confirmed session.payment_link belongs to a PlanPaymentLink.
const handlePlanPaymentWebhookEvent = async (session) => {
  // Atomic "transition once" — a Stripe redelivery finds nothing left to
  // update on the second call.
  const updated = await PlanPaymentLink.findOneAndUpdate(
    { stripePaymentLinkId: session.payment_link, status: { $ne: "paid" } },
    { status: "paid", paidAt: new Date(), stripeCheckoutSessionId: session.id },
    { new: true },
  );
  const link =
    updated || (await PlanPaymentLink.findOne({ stripePaymentLinkId: session.payment_link }));
  if (!link) return;
  // If this event was already fully processed (invoice populated), a
  // redelivery is a safe no-op.
  if (!updated && link.stripeInvoiceId) return;

  let stripeInvoiceId = null;
  let invoicePdfUrl = null;
  let hostedInvoiceUrl = null;
  if (session.invoice) {
    try {
      const invoice = await stripe.invoices.retrieve(session.invoice);
      stripeInvoiceId = invoice.id;
      invoicePdfUrl = invoice.invoice_pdf || null;
      hostedInvoiceUrl = invoice.hosted_invoice_url || null;
    } catch (error) {
      console.error("Failed to retrieve Stripe invoice for plan payment:", error.message);
    }
  }

  // Recompute the real cycle from the workspace's current state right before
  // applying it (module changes/plan changes between link creation and
  // actual payment are rare but possible) — falls back to the projected
  // values stored at link-creation time if no workspace exists yet.
  let periodStart = link.periodStart;
  let periodEnd = link.periodEnd;
  if (link.workspaceId) {
    const workspace = await Workspace.findById(link.workspaceId).select("planExpiryDate").lean();
    const { start, end } = computeProjectedPeriod(workspace?.planExpiryDate);
    periodStart = start;
    periodEnd = end;
  }

  const claimed = await PlanPaymentLink.findOneAndUpdate(
    { _id: link._id },
    { stripeInvoiceId, invoicePdfUrl, hostedInvoiceUrl, periodStart, periodEnd },
    { new: true },
  );

  await applyPaidPlanToWorkspace(claimed);

  if (claimed.changeType === "initial") {
    await sendMail({
      to: claimed.leadEmail,
      ...buildPlanStartedEmail({
        customerName: claimed.leadName,
        companyName: claimed.companyName,
        planLabel: PLAN_LABELS[claimed.plan],
        startDate: claimed.periodStart,
      }),
    });
  }

  await sendMail({
    to: claimed.leadEmail,
    ...buildPlanPaymentConfirmationEmail({
      customerName: claimed.leadName,
      companyName: claimed.companyName,
      planLabel: PLAN_LABELS[claimed.plan],
      amount: claimed.amount,
      paidAt: claimed.paidAt,
      periodEnd: claimed.periodEnd,
      changeType: claimed.changeType,
      invoiceUrl: claimed.hostedInvoiceUrl || claimed.invoicePdfUrl,
      customPricingBreakdown: claimed.customPricingBreakdown,
    }),
    attachments: claimed.invoicePdfUrl
      ? [
          {
            filename: `invoice-${PLAN_LABELS[claimed.plan]?.replace(/\s+/g, "-") || claimed.plan}.pdf`,
            path: claimed.invoicePdfUrl,
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });
};

// GET /api/hostpanel/plan/:companyId/invoices — called by HostPanel's own
// planBillingControllers.ts proxy (same service-key convention as the
// verification-requests endpoints on this router) for the Plan & Billing tab.
const getHostPanelPlanInvoices = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const links = await PlanPaymentLink.find({ companyId, status: "paid" })
      .sort({ paidAt: -1 })
      .select("plan amount currency paidAt hostedInvoiceUrl invoicePdfUrl changeType periodStart periodEnd")
      .lean();
    return res.status(200).json({ invoices: links });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAndSendPlanPaymentLink,
  sendPlanPaymentLink,
  getPlanPaymentStatuses,
  getHostCompanyPlanHistory,
  handlePlanPaymentWebhookEvent,
  resolveWorkspaceForCompany,
  getHostPanelPlanInvoices,
};
