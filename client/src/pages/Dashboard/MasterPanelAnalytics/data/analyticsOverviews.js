// Extended per-module analytics configs for the Master Panel Analytics page.
//
// The page mirrors the module-wise Dashboard (MainDashboard) — every sidebar
// dropdown item becomes a tab — but each tab shows MORE info graphs than the
// dashboard's limited overview. Charts render two per row so every module's
// data stays scannable.
//
// EXTRA_CHARTS below reuse the exact same API sources the dashboard already
// fetches (TAB_OVERVIEWS) and only add client-side aggregations on top, so
// the analytics view never adds new backend calls.
import { TAB_OVERVIEWS } from "../../MainDashboard/data/tabOverviews";
import {
  countBy,
  topN,
  sumBy,
  monthlyTrend,
  countSince,
  countToday,
  countVerticals,
  flatten,
  asArray,
} from "../../MainDashboard/data/aggregate";

// Today / Last 7 / Last 30 / Older breakdown for any dated list.
const recencyBreakdown = (items, dateKey = "createdAt") => {
  const rows = asArray(items);
  const total = rows.length;
  const today = countToday(rows, dateKey);
  const last7 = countSince(rows, dateKey, 7);
  const last30 = countSince(rows, dateKey, 30);
  return [
    { label: "Today", value: today },
    { label: "Last 7 Days", value: Math.max(0, last7 - today) },
    { label: "Last 30 Days", value: Math.max(0, last30 - last7) },
    { label: "Older", value: Math.max(0, total - last30) },
  ].filter((d) => d.value > 0);
};

const successVsFailed = (items) => {
  const failed = asArray(items).filter((item) => item?.success === false).length;
  const total = asArray(items).length;
  return [
    { label: "Success", value: total - failed },
    { label: "Failed", value: failed },
  ].filter((d) => d.value > 0);
};

const EXTRA_CHARTS = {
  "dashboard.all-leads": [
    {
      title: "Lead Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.enquiries),
    },
    {
      title: "Enquiries vs POC Contacts",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Enquiry Leads", value: data.enquiries.length },
          { label: "POC Contacts", value: data.poc.length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Monthly POC Growth",
      type: "bars",
      build: ({ data }) => monthlyTrend(data.poc),
    },
  ],

  "dashboard.value-adds-leads": [
    {
      title: "Lead Recency",
      type: "donut",
      build: ({ data }) =>
        recencyBreakdown(
          flatten(data.visa, data.activation, data.companySetup, data.consultation, data.workation, data.contributor),
        ),
    },
    {
      title: "Activation vs Company Setup",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Activation Support", value: data.activation.length },
          { label: "New Company Setup", value: data.companySetup.length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Contributors",
      type: "donut",
      build: ({ data }) =>
        [{ label: "Become Contributor", value: data.contributor.length }].filter(
          (d) => d.value > 0,
        ),
    },
  ],

  "dashboard.nomad-signup-leads": [
    {
      title: "Signup Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.leads),
    },
    {
      title: "6-Month Signup Trend",
      type: "line",
      build: ({ data }) => monthlyTrend(data.leads, "createdAt", 6),
    },
  ],

  "dashboard.companies": [
    {
      title: "Industry Mix",
      type: "donut",
      build: ({ data }) => topN(countBy(data.companies.items, "industry"), 6),
    },
    {
      title: "Registration Split",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Registered", value: data.companies.items.filter((c) => c.isRegistered).length },
          { label: "Not Registered", value: data.companies.items.filter((c) => !c.isRegistered).length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Payment Status",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Payment Active", value: data.companies.items.filter((c) => c.paymentStatus).length },
          { label: "Payment Inactive", value: data.companies.items.filter((c) => !c.paymentStatus).length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Company Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.companies.items),
    },
  ],

  "hostpanel.companies": [
    {
      title: "Industry Mix",
      type: "donut",
      build: ({ data }) => topN(countBy(data.companies.items, "industry"), 6),
    },
    {
      title: "Registration Split",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Registered", value: data.companies.items.filter((c) => c.isRegistered).length },
          { label: "Not Registered", value: data.companies.items.filter((c) => !c.isRegistered).length },
        ].filter((d) => d.value > 0),
    },
    {
      title: "Company Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.companies.items),
    },
  ],

  "dashboard.publish-listings": [
    {
      title: "Category Breakdown",
      type: "bars",
      build: ({ data }) =>
        topN(
          (data.listings.categoryCounts || []).map((c) => ({
            label: c.key || "Unknown",
            value: c.count || 0,
          })),
          8,
        ),
    },
    {
      title: "Listing Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.listings.items),
    },
  ],

  "dashboard.reviews": [
    {
      title: "Review Recency",
      type: "donut",
      build: ({ data }) =>
        recencyBreakdown(flatten(data.nomadReviews, data.eventReviews, data.placeReviews)),
    },
    {
      title: "6-Month Review Trend",
      type: "line",
      build: ({ data }) =>
        monthlyTrend(flatten(data.nomadReviews, data.eventReviews, data.placeReviews), "createdAt", 6),
    },
    {
      title: "Nomads vs Places Rating",
      type: "donut",
      build: ({ data }) =>
        [
          {
            label: "Nomad Avg ★",
            value:
              Math.round(
                (data.nomadReviews.reduce((sum, r) => sum + (Number(r?.rating) || 0), 0) /
                  Math.max(data.nomadReviews.length, 1)) *
                  10,
              ) / 10,
          },
          {
            label: "Events Avg ★",
            value:
              Math.round(
                (data.eventReviews.reduce((sum, r) => sum + (Number(r?.rating) || 0), 0) /
                  Math.max(data.eventReviews.length, 1)) *
                  10,
              ) / 10,
          },
          {
            label: "Places Avg ★",
            value:
              Math.round(
                (data.placeReviews.reduce((sum, r) => sum + (Number(r?.rating) || 0), 0) /
                  Math.max(data.placeReviews.length, 1)) *
                  10,
              ) / 10,
          },
        ].filter((d) => d.value > 0),
    },
  ],

  "dashboard.destinations-data": [
    {
      title: "Blogs per Destination",
      type: "bars",
      build: ({ data }) =>
        topN(
          data.rows.map((r) => ({
            label: r.destination || r.country || "Unknown",
            value: Number(r.blogCount) || 0,
          })),
          8,
        ),
    },
    {
      title: "Events per Destination",
      type: "bars",
      build: ({ data }) =>
        topN(
          data.rows.map((r) => ({
            label: r.destination || r.country || "Unknown",
            value: Number(r.eventCount) || 0,
          })),
          8,
        ),
    },
    {
      title: "Restaurants per Destination",
      type: "bars",
      build: ({ data }) =>
        topN(
          data.rows.map((r) => ({
            label: r.destination || r.country || "Unknown",
            value: Number(r.restaurantCount) || 0,
          })),
          8,
        ),
    },
  ],

  "dashboard.world-ranking-weights": [
    {
      title: "Active Entries by Continent",
      type: "bars",
      build: ({ data }) =>
        topN(countBy(data.weights.filter((w) => w.isActive), "continent"), 6),
    },
    {
      title: "Active Entries by Country",
      type: "bars",
      build: ({ data }) =>
        topN(countBy(data.weights.filter((w) => w.isActive), "country"), 8),
    },
  ],

  "dashboard.logs": [
    {
      title: "Top Actions",
      type: "donut",
      build: ({ data }) => topN(countBy(data.logs.items, "action"), 6),
    },
    {
      title: "Request Methods",
      type: "donut",
      build: ({ data }) => countBy(data.logs.items, "method"),
    },
    {
      title: "Success vs Failed",
      type: "donut",
      build: ({ data }) => successVsFailed(data.logs.items),
    },
    {
      title: "Top Pages",
      type: "bars",
      build: ({ data }) => topN(countBy(data.logs.items, "page"), 6),
    },
    {
      title: "Activity Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.logs.items),
    },
    {
      title: "Top Companies Touched",
      type: "donut",
      build: ({ data }) => topN(countBy(data.logs.items, "companyName"), 6),
    },
  ],

  "dashboard.master-panel-analytics": [
    {
      title: "Weekday Activity",
      type: "bars",
      build: ({ data }) => data.analytics.weekdayActivity ?? [],
    },
    {
      title: "Hourly Activity",
      type: "bars",
      build: ({ data }) => data.analytics.hourlyActivity ?? [],
    },
    {
      title: "Method Distribution",
      type: "donut",
      build: ({ data }) => data.analytics.methodBreakdown ?? [],
    },
    {
      title: "Status Distribution",
      type: "donut",
      build: ({ data }) => data.analytics.statusBreakdown ?? [],
    },
    {
      title: "Top Actions",
      type: "donut",
      build: ({ data }) => (data.analytics.topActions ?? []).slice(0, 6),
    },
    {
      title: "Top Companies Touched",
      type: "donut",
      build: ({ data }) => (data.analytics.topCompanies ?? []).slice(0, 6),
    },
  ],

  "hostpanel.host-companies": [
    {
      title: "Top Industries",
      type: "bars",
      build: ({ data }) => topN(countVerticals(data.hostCompanies, "industry"), 6),
    },
    {
      title: "Company Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.hostCompanies),
    },
    {
      title: "Subscription Health",
      type: "donut",
      build: ({ data }) =>
        [
          {
            label: "Active Subscription",
            value: data.hostCompanies.filter((c) =>
              String(c.subscriptionStatus || "").toLowerCase().includes("active"),
            ).length,
          },
          {
            label: "Other",
            value: data.hostCompanies.filter(
              (c) => !String(c.subscriptionStatus || "").toLowerCase().includes("active"),
            ).length,
          },
        ].filter((d) => d.value > 0),
    },
  ],

  "hostpanel.support-tickets": [
    {
      title: "Ticket Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.tickets),
    },
    {
      title: "6-Month Ticket Trend",
      type: "line",
      build: ({ data }) => monthlyTrend(data.tickets, "createdAt", 6),
    },
  ],

  "hostpanel.signup-leads": [
    {
      title: "Lead Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.leads),
    },
    {
      title: "6-Month Lead Trend",
      type: "line",
      build: ({ data }) => monthlyTrend(data.leads, "createdAt", 6),
    },
  ],

  "hostpanel.website-credits": [
    {
      title: "Credit Utilization by Company",
      type: "bars",
      build: ({ data }) => {
        const limits = new Map(
          data.summary.map((s) => [
            String(s.companyName || s.companyId || "Unknown"),
            Number(s.monthlyCreditsLimit) || 0,
          ]),
        );
        const used = new Map();
        data.ledger
          .filter((e) => String(e?.type || "").toLowerCase() === "used")
          .forEach((e) => {
            const key = String(e.companyName || e.companyId || "Unknown");
            used.set(key, (used.get(key) || 0) + (Number(e.credits) || 0));
          });
        return topN(
          Array.from(used.entries()).map(([company, usedCredits]) => {
            const limit = limits.get(company) || 0;
            return {
              label: company,
              value: limit ? Math.min(100, Math.round((usedCredits / limit) * 100)) : 0,
            };
          }),
          8,
        );
      },
    },
    {
      title: "Ledger Entries by Company",
      type: "donut",
      build: ({ data }) => topN(countBy(data.ledger, "companyName"), 6),
    },
  ],

  "hostpanel.module-access-logs": [
    {
      title: "Enabled vs Disabled Modules",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Enabled", value: sumBy(data.logs, "enabledCount") },
          { label: "Disabled", value: sumBy(data.logs, "disabledCount") },
        ].filter((d) => d.value > 0),
    },
    {
      title: "6-Month Event Trend",
      type: "line",
      build: ({ data }) => monthlyTrend(data.logs, "createdAt", 6),
    },
  ],

  "hostpanel.host-panel-logs": [
    {
      title: "Top Modules",
      type: "donut",
      build: ({ data }) => topN(countBy(data.logs, "module"), 6),
    },
    {
      title: "Top Actions",
      type: "donut",
      build: ({ data }) => topN(countBy(data.logs, "action"), 6),
    },
    {
      title: "Request Methods",
      type: "donut",
      build: ({ data }) => countBy(data.logs, "method"),
    },
    {
      title: "Success vs Failed",
      type: "donut",
      build: ({ data }) => successVsFailed(data.logs),
    },
    {
      title: "Workspace Activity",
      type: "bars",
      build: ({ data }) => topN(countBy(data.logs, "workspaceName"), 6),
    },
    {
      title: "Activity Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.logs),
    },
  ],

  "dashboard.data-upload": [
    {
      title: "Upload Recency",
      type: "donut",
      build: ({ data }) => recencyBreakdown(data.uploads.recentUploads ?? []),
    },
    {
      title: "Upload Method",
      type: "donut",
      build: ({ data }) => countBy(data.uploads.recentUploads ?? [], "method"),
    },
  ],

  "dashboard.nomad-click-analytics": [
    {
      title: "Click Freshness",
      type: "donut",
      build: ({ data }) =>
        recencyBreakdown(asArray(data.clicks.items), "lastClickedAt"),
    },
    {
      title: "Visitors by City",
      type: "bars",
      build: ({ data }) =>
        topN(
          asArray(data.locations?.cities).map((item) => ({
            label: item.label || "Unknown",
            value: Number(item.value) || 0,
          })),
          8,
        ),
    },
    {
      title: "Visitors by State",
      type: "bars",
      build: ({ data }) =>
        topN(
          asArray(data.locations?.states).map((item) => ({
            label: item.label || "Unknown",
            value: Number(item.value) || 0,
          })),
          8,
        ),
    },
    {
      title: "Visitor Location Resolution",
      type: "donut",
      build: ({ data }) =>
        [
          { label: "Located", value: data.locations?.totals?.resolvedClicks ?? 0 },
          { label: "Local Network", value: data.locations?.totals?.localNetworkClicks ?? 0 },
          { label: "Unknown", value: data.locations?.totals?.unknownClicks ?? 0 },
        ].filter((d) => d.value > 0),
    },
  ],
};

export const ANALYTICS_OVERVIEWS = Object.fromEntries(
  Object.entries(TAB_OVERVIEWS).map(([key, config]) => {
    if (!config) return [key, null];
    const extras = EXTRA_CHARTS[key] || [];
    return [key, { ...config, charts: [...config.charts, ...extras] }];
  }),
);
