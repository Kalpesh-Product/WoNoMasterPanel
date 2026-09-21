// Shared between CompanyVerificationLeads.jsx (the leads queue) and
// CompanyVerified.jsx (the post-verification tracking page). Keep in sync
// with VERIFICATION_TIER_AMOUNTS_USD in
// server/controllers/companyVerificationPaymentsControllers.js.
export const TIER_LABELS = {
  "1m": "1 Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

// Plans that can be chosen now. TIER_LABELS above still lists the retired
// 3m / 6m plans so existing records on them keep displaying properly.
export const TIER_OPTIONS = [
  { value: "1m", label: "1 Month — $10" },
  { value: "1y", label: "1 Year — $50" },
];

export const CHANGE_TYPE_LABELS = {
  initial: "Initial Activation",
  renewal: "Renewal",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
};

// A manual renew is only offered once a plan is close enough to (or past)
// expiry — mirrors the 5-day-before-expiry reminder window already used by
// the renewal cron, so admins can't "renew" a plan that isn't due yet.
export const RENEW_ENABLED_WITHIN_DAYS = 5;

export const daysUntil = (date) => {
  if (!date) return null;
  const diffMs = new Date(date).getTime() - Date.now();
  return diffMs / (1000 * 60 * 60 * 24);
};

// Builds a link to a listing's public Nomads page for a master-panel admin
// to check. companyName in the :company path segment is cosmetic/SEO only —
// businessId (unique per listing, unlike companyId which can cover several
// locations of the same company) is what actually resolves the right
// listing, via query params AiProduct.jsx reads and prioritizes over the
// path segment. See D:\Nomads\frontend\src\pages\AiProduct.jsx.
const NOMADS_PUBLIC_BASE_URL = "https://www.wono.co";
export const buildListingUrl = ({ businessId, companyType, companyName }) => {
  const path = encodeURIComponent(companyName || "listing");
  const params = new URLSearchParams();
  if (businessId) params.set("businessId", businessId);
  if (companyType) params.set("companyType", companyType);
  const query = params.toString();
  return `${NOMADS_PUBLIC_BASE_URL}/listings/${path}${query ? `?${query}` : ""}`;
};

export const formatDate = (value) => {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export const getInitials = (value) =>
  String(value || "CV")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export const getPaymentInfo = (lead) => {
  if (!lead.paymentStatus || lead.paymentStatus === "not_required") {
    return { label: "--", tone: "bg-slate-100 text-slate-500" };
  }
  if (lead.paymentStatus === "awaiting_payment") {
    return { label: "Pending", tone: "bg-amber-50 text-amber-600" };
  }
  const expired =
    lead.verificationExpiresAt &&
    new Date(lead.verificationExpiresAt) <= new Date();
  if (expired) {
    return { label: "Expired", tone: "bg-rose-50 text-rose-600" };
  }
  return {
    label: `Paid · until ${formatDate(lead.verificationExpiresAt)}`,
    tone: "bg-emerald-50 text-emerald-600",
  };
};
