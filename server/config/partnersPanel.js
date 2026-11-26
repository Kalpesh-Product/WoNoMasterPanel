// Partners Panel connection — base URL switches on NODE_ENV so the same code
// works against localhost in dev and the live hosted URL in production, once
// Partners Panel is deployed there (PARTNERS_PANEL_API_URL_PROD is filled in then).
const PARTNERS_PANEL_API_URL =
  process.env.NODE_ENV === "production"
    ? process.env.PARTNERS_PANEL_API_URL_PROD
    : process.env.PARTNERS_PANEL_API_URL_DEV || "http://localhost:5008/api";

const PARTNERS_PANEL_ADMIN_API_KEY = process.env.PARTNERS_PANEL_ADMIN_API_KEY;

module.exports = { PARTNERS_PANEL_API_URL, PARTNERS_PANEL_ADMIN_API_KEY };
