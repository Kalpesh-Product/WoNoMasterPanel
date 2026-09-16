const schedule = require("node-schedule");
const axios = require("axios");
const { sendMail } = require("../config/nodemailerConfig");
const {
  buildVerificationRenewalReminderEmail,
  formatLongDate,
} = require("../utils/emailTemplates");

const VERIFICATION_TIER_LABELS = {
  "1m": "1 Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");
const NOMADS_FRONTEND_BASE_URL = String(
  process.env.NOMADS_FRONTEND_BASE_URL || "https://www.wono.co",
).replace(/\/+$/, "");

const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/verification-requests`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

// Daily at 06:00 UTC — explicit tz so "5 days before expiry" doesn't drift
// with the host machine's local timezone. Unlike the initial/change-plan
// payment email, this can't pre-generate a Stripe link — the owner hasn't
// chosen a tier yet (renew same plan vs. change plan), so it links to the
// self-serve "Verification" tab instead, which creates the link once they
// choose.
schedule.scheduleJob({ rule: "0 6 * * *", tz: "UTC" }, async () => {
  try {
    const { data } = await nomadsAdminClient.get("/renewals-due", {
      params: { withinDays: 5 },
    });
    for (const request of data?.data || []) {
      try {
        const tier = request.activeTier || request.requestedTier;
        await sendMail({
          to: request.email,
          ...buildVerificationRenewalReminderEmail({
            customerName: request.fullName,
            companyName: request.companyName,
            tierLabel: VERIFICATION_TIER_LABELS[tier] || tier,
            expiresOnLabel: formatLongDate(request.verificationExpiresAt),
            manageUrl: `${NOMADS_FRONTEND_BASE_URL}/profile?tab=verification&requestId=${request._id}`,
          }),
        });
        await nomadsAdminClient.post(`/${request._id}/mark-reminder-sent`);
      } catch (itemError) {
        console.error(
          `Verification renewal reminder failed for ${request._id}:`,
          itemError.message,
        );
      }
    }
  } catch (error) {
    console.error("Verification renewal reminder job failed:", error.message);
  }
});

module.exports = {}; // required for its scheduling side effect only
