const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const axios = require("axios");
const VerificationPaymentLink = require("../models/VerificationPaymentLink");
const HostUser = require("../models/hostCompany/hostUser");
const { sendMail } = require("../config/nodemailerConfig");
const {
  buildVerificationPaymentEmail,
  buildVerificationConfirmationEmail,
} = require("../utils/emailTemplates");

// Mirrors D:\Nomads\backend\controllers\verificationControllers.js
// VERIFICATION_TIER_AMOUNTS_USD — keep both in sync if pricing changes.
const VERIFICATION_TIER_AMOUNTS_USD = { "1m": 10, "3m": 25, "6m": 45, "1y": 80 };
const VERIFICATION_TIER_MONTHS = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 };
const VERIFICATION_TIER_LABELS = {
  "1m": "1 Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

// initial = first-ever payment for this request; renewal = same tier as the
// currently active one; upgrade/downgrade = a different (longer/shorter) tier.
const computeChangeType = (priorTier, newTier) => {
  if (!priorTier) return "initial";
  if (priorTier === newTier) return "renewal";
  return VERIFICATION_TIER_MONTHS[newTier] > VERIFICATION_TIER_MONTHS[priorTier]
    ? "upgrade"
    : "downgrade";
};

// Mirrors D:\Nomads\backend\controllers\verificationControllers.js
// computeExtendedExpiry — used here only to PREVIEW the new plan's
// start/end dates in the payment-link email before the user has actually
// paid; the authoritative value is whatever Nomads computes for real in
// markVerificationRequestPaid once payment succeeds.
const computeProjectedPeriod = (currentExpiresAt, tier) => {
  const months = VERIFICATION_TIER_MONTHS[tier] || 1;
  const start =
    currentExpiresAt && new Date(currentExpiresAt) > new Date()
      ? new Date(currentExpiresAt)
      : new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return { start, end };
};

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/verification-requests`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

// Shared by the HTTP route (admin send/resend/change-plan), the renewal
// cron, and the internal self-serve endpoint the Nomads backend calls.
const createAndSendVerificationPaymentLink = async ({ nomadsRequestId, tier }) => {
  const {
    data: { data: request },
  } = await nomadsAdminClient.get(`/${nomadsRequestId}`);

  const amount = VERIFICATION_TIER_AMOUNTS_USD[tier];
  if (!amount) throw new Error("Invalid tier");

  const changeType = computeChangeType(request.activeTier, tier);
  const isRenewal = changeType !== "initial";
  const { start: projectedStart, end: projectedEnd } = computeProjectedPeriod(
    request.verificationExpiresAt,
    tier,
  );

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `${isRenewal ? "Verification Renewal" : "Business Verification"} — ${VERIFICATION_TIER_LABELS[tier]} (${request.companyName})`,
          },
        },
        quantity: 1,
      },
    ],
    // So paying this link produces a real Stripe Invoice (PDF + hosted page)
    // we can attach to the confirmation email and show in payment history,
    // instead of only a bare Checkout Session/Charge.
    invoice_creation: { enabled: true },
  });

  await VerificationPaymentLink.create({
    nomadsRequestId,
    companyId: request.companyId,
    companyName: request.companyName,
    leadName: request.fullName,
    leadEmail: request.email,
    tier,
    previousTier: request.activeTier || null,
    isRenewal,
    changeType,
    amount,
    currency: "usd",
    stripePaymentLinkId: paymentLink.id,
    stripePaymentLinkUrl: paymentLink.url,
  });

  await sendMail({
    to: request.email,
    ...buildVerificationPaymentEmail({
      customerName: request.fullName,
      companyName: request.companyName,
      tierLabel: VERIFICATION_TIER_LABELS[tier],
      paymentLinkUrl: paymentLink.url,
      amount,
      changeType,
      projectedStart,
      projectedEnd,
    }),
  });

  return { paymentLinkUrl: paymentLink.url };
};

// POST /api/company-verification-leads/:id/send-payment-link
const sendVerificationPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier } = req.body || {};
    if (!["1m", "3m", "6m", "1y"].includes(tier)) {
      return res
        .status(400)
        .json({ message: "tier must be one of 1m, 3m, 6m, 1y" });
    }
    const result = await createAndSendVerificationPaymentLink({
      nomadsRequestId: id,
      tier,
    });
    return res
      .status(200)
      .json({ message: "Payment link email sent successfully", ...result });
  } catch (error) {
    const status = error.response?.status || 500;
    return res
      .status(status)
      .json({ message: error.response?.data?.message || error.message });
  }
};

// POST /api/internal/verification-payments/:nomadsRequestId/create-link
// Called by the Nomads backend (server-to-server, verifyNomadsServiceKey) for
// self-serve renew/change-plan initiated by the business owner themselves.
const createVerificationPaymentLinkInternal = async (req, res) => {
  try {
    const { nomadsRequestId } = req.params;
    const { tier } = req.body || {};
    if (!["1m", "3m", "6m", "1y"].includes(tier)) {
      return res
        .status(400)
        .json({ message: "tier must be one of 1m, 3m, 6m, 1y" });
    }
    const result = await createAndSendVerificationPaymentLink({
      nomadsRequestId,
      tier,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("createVerificationPaymentLinkInternal failed:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to create payment link" });
  }
};

// GET /api/company-verification-leads/:id/history — every payment attempt
// (initial, renewals, upgrades/downgrades) for one verification request.
const getVerificationLeadHistory = async (req, res) => {
  const rows = await VerificationPaymentLink.find({
    nomadsRequestId: req.params.id,
  })
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ data: rows });
};

// GET /api/company-verification-leads/payment-history — every successfully
// paid attempt across all requests, for the Master Panel stats dashboard.
const getVerificationPaymentHistory = async (req, res) => {
  const rows = await VerificationPaymentLink.find({ status: "paid" })
    .sort({ createdAt: -1 })
    .lean();
  return res.status(200).json({ data: rows });
};

// Called from hostUserControllers.handleStripeWebhook when the paid Payment
// Link isn't a BookingPaymentLink. Not an HTTP handler.
const handleVerificationPaymentWebhookEvent = async (session) => {
  // The { status: { $ne: "paid" } } filter makes this an atomic "transition
  // once" — if Stripe redelivers this event, the second call finds nothing
  // left to update.
  const updated = await VerificationPaymentLink.findOneAndUpdate(
    { stripePaymentLinkId: session.payment_link, status: { $ne: "paid" } },
    { status: "paid", paidAt: new Date(), stripeCheckoutSessionId: session.id },
    { new: true },
  );
  // Whether or not this call performed the transition, look the record up —
  // a redelivery must still retry the Nomads sync + email if it failed
  // last time (nomadsSyncedAt still null).
  const link =
    updated ||
    (await VerificationPaymentLink.findOne({
      stripePaymentLinkId: session.payment_link,
    }));
  if (!link || link.nomadsSyncedAt) return;

  let verificationExpiresAt;
  try {
    const { data } = await nomadsAdminClient.post(
      `/${link.nomadsRequestId}/mark-paid`,
      {
        tier: link.tier,
        amountUsd: link.amount,
        paidAt: link.paidAt,
        paymentReference: session.id,
      },
    );
    verificationExpiresAt = data?.data?.verificationExpiresAt;
  } catch (error) {
    console.error(
      "Nomads mark-paid sync failed, will retry on next webhook redelivery:",
      error.message,
    );
    return; // nomadsSyncedAt stays null so a Stripe retry tries again
  }

  // Stripe created a real Invoice for this Checkout Session (invoice_creation
  // was enabled on the Payment Link) — fetch it so its PDF/hosted page can be
  // attached/linked in the confirmation email and shown in payment history.
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
      console.error(
        "Failed to retrieve Stripe invoice for verification payment:",
        error.message,
      );
      // Non-fatal — the confirmation email still sends without an invoice link.
    }
  }

  const claimed = await VerificationPaymentLink.findOneAndUpdate(
    { _id: link._id, nomadsSyncedAt: null },
    {
      nomadsSyncedAt: new Date(),
      verificationExpiresAt,
      stripeInvoiceId,
      invoicePdfUrl,
      hostedInvoiceUrl,
    },
    { new: true },
  );
  if (!claimed) return; // a concurrent/duplicate delivery already sent the email

  // "Become a Host" nudge — only on the very first verification payment for
  // this business, and only when they don't already have a HostPanel
  // account. Lazily required to avoid a circular require: hostUserControllers.js
  // itself requires this file (for handleVerificationPaymentWebhookEvent), so
  // requiring it back at module-top-level here would see a half-populated
  // module.exports at load time.
  let becomeHostUrl;
  if (claimed.changeType === "initial") {
    try {
      const existingHostUser = await HostUser.findOne({
        email: { $regex: `^${claimed.leadEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      }).lean();
      const alreadyAHost = ["registered", "joined"].includes(
        existingHostUser?.inviteStatus,
      );
      if (!alreadyAHost) {
        const { createHostInvite } = require("./hostUserControllers");
        const { inviteLink } = await createHostInvite({
          email: claimed.leadEmail,
          name: claimed.leadName,
          fullName: claimed.leadName,
          companyName: claimed.companyName,
          source: "nomads-verification",
          nomadsCompanyId: claimed.companyId,
        });
        becomeHostUrl = inviteLink;
      }
    } catch (error) {
      console.error(
        "Failed to send Become-a-Host invite after verification payment:",
        error.message,
      );
      // Non-fatal — the verification confirmation email below still sends.
    }
  }

  await sendMail({
    to: claimed.leadEmail,
    ...buildVerificationConfirmationEmail({
      customerName: claimed.leadName,
      companyName: claimed.companyName,
      tierLabel: VERIFICATION_TIER_LABELS[claimed.tier],
      amount: claimed.amount,
      paidAt: claimed.paidAt,
      verificationExpiresAt: claimed.verificationExpiresAt,
      changeType: claimed.changeType,
      becomeHostUrl,
      // Stripe's hosted page for a paid invoice shows a proper receipt
      // (invoice #, payment method, Download invoice + Download receipt) —
      // nicer to land on than the bare PDF, which is still attached below.
      invoiceUrl: claimed.hostedInvoiceUrl || claimed.invoicePdfUrl,
    }),
    // Streams the PDF straight from Stripe's own hosted URL — nodemailer
    // fetches whatever `path` points to, no local generation involved.
    attachments: claimed.invoicePdfUrl
      ? [
          {
            filename: `invoice-${VERIFICATION_TIER_LABELS[claimed.tier]?.replace(/\s+/g, "-") || claimed.tier}.pdf`,
            path: claimed.invoicePdfUrl,
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });
};

module.exports = {
  sendVerificationPaymentLink,
  createVerificationPaymentLinkInternal,
  getVerificationLeadHistory,
  getVerificationPaymentHistory,
  createAndSendVerificationPaymentLink,
  handleVerificationPaymentWebhookEvent,
};
