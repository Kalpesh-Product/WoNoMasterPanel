const schedule = require("node-schedule");
const axios = require("axios");
const { sendMail } = require("../config/nodemailerConfig");
const {
  buildVerificationTrialEndingEmail,
  formatLongDate,
} = require("../utils/emailTemplates");

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/verification-requests`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

// HostPanel is where a host renews (Verify Business page).
const hostPanelBaseUrl = () =>
  String(
    process.env.NODE_ENV === "production"
      ? process.env.HOST_PANEL_FRONTEND_URL || "https://hostpanel.wono.co"
      : process.env.HOST_PANEL_FRONTEND_URL_DEV ||
          process.env.HOST_PANEL_FRONTEND_URL_LOCAL ||
          "http://localhost:3006",
  ).replace(/\/+$/, "");

// Daily at 06:15 UTC (between the 06:00 renewal-reminder and 06:30 expiry
// jobs). Picks up free verified-badge periods with about a month left — i.e.
// after roughly 2 of the 3 free months — and emails the host once. The
// HostPanel dashboard shows the matching banner on its own.
schedule.scheduleJob({ rule: "15 6 * * *", tz: "UTC" }, async () => {
  try {
    const { data } = await nomadsAdminClient.get("/trial-ending-soon", {
      params: { withinDays: 30 },
    });
    for (const request of data?.data || []) {
      try {
        const daysLeft = Math.max(
          1,
          Math.ceil(
            (new Date(request.verificationExpiresAt).getTime() - Date.now()) /
              (24 * 60 * 60 * 1000),
          ),
        );
        await sendMail({
          to: request.email,
          ...buildVerificationTrialEndingEmail({
            customerName: request.fullName,
            companyName: request.companyName,
            startsOnLabel: formatLongDate(request.verificationStartsAt),
            expiresOnLabel: formatLongDate(request.verificationExpiresAt),
            daysLeft,
            manageUrl: `${hostPanelBaseUrl()}/key-apps/verify-business?requestId=${request._id}`,
          }),
        });
        await nomadsAdminClient.post(`/${request._id}/mark-trial-notice-sent`);
      } catch (itemError) {
        console.error(
          `Verification trial-ending notice failed for ${request._id}:`,
          itemError.message,
        );
      }
    }
  } catch (error) {
    console.error("Verification trial-ending notice job failed:", error.message);
  }
});

module.exports = {}; // required for its scheduling side effect only
