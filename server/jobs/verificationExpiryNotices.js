const schedule = require("node-schedule");
const axios = require("axios");
const { sendMail } = require("../config/nodemailerConfig");
const { buildVerificationExpiredEmail } = require("../utils/emailTemplates");

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

// Daily at 06:30 UTC (offset from the 06:00 renewal-reminder job so the two
// don't contend). Distinct from the 5-day-before reminder — this fires once
// verificationExpiresAt has actually passed and the badge has lapsed.
schedule.scheduleJob({ rule: "30 6 * * *", tz: "UTC" }, async () => {
  try {
    const { data } = await nomadsAdminClient.get("/expired-pending-notice");
    for (const request of data?.data || []) {
      try {
        await sendMail({
          to: request.email,
          ...buildVerificationExpiredEmail({
            customerName: request.fullName,
            companyName: request.companyName,
            manageUrl: `${NOMADS_FRONTEND_BASE_URL}/profile?tab=verification&requestId=${request._id}`,
          }),
        });
        await nomadsAdminClient.post(`/${request._id}/mark-expiry-notice-sent`);
      } catch (itemError) {
        console.error(
          `Verification expiry notice failed for ${request._id}:`,
          itemError.message,
        );
      }
    }
  } catch (error) {
    console.error("Verification expiry notice job failed:", error.message);
  }
});

module.exports = {}; // required for its scheduling side effect only
