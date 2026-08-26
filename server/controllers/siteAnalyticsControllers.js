const path = require("path");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");

// GA4 property for wono.co, read via a service account that only has Viewer
// access on that property (see server/credentials/, gitignored). Key
// creation is blocked by org policy so this file was hand-delivered rather
// than generated through gcloud — do not rename/move without updating
// GA4_SERVICE_ACCOUNT_KEY_PATH in .env.
const propertyId = process.env.GA4_PROPERTY_ID;
const keyPath = process.env.GA4_SERVICE_ACCOUNT_KEY_PATH
  ? path.join(__dirname, "..", process.env.GA4_SERVICE_ACCOUNT_KEY_PATH)
  : null;

let analyticsClient = null;
const getClient = () => {
  if (!analyticsClient) {
    if (!keyPath) {
      throw new Error("GA4_SERVICE_ACCOUNT_KEY_PATH is not configured");
    }
    analyticsClient = new BetaAnalyticsDataClient({ keyFilename: keyPath });
  }
  return analyticsClient;
};

const sumRows = (rows) =>
  (rows || []).reduce((sum, row) => sum + Number(row.metricValues?.[0]?.value || 0), 0);

const rankedByDimension = (rows) =>
  (rows || [])
    .map((row) => ({
      label: row.dimensionValues?.[0]?.value || "Unknown",
      value: Number(row.metricValues?.[0]?.value || 0),
    }))
    .sort((a, b) => b.value - a.value);

// GA4's realtime API only reports the last ~30 minutes and refreshes on its
// own cadence (roughly every 30-60s) — polling this endpoint faster than
// that gains nothing.
//
// The headline count MUST come from its own dimension-less query: a single
// GA4 report row is a count of active users *for that dimension combination*
// (e.g. one country x one page), not a slice of a fixed total. Summing rows
// across a report that breaks down by both country and page double/triple
// counts anyone who visited more than one page, so byCountry/byPage are
// fetched as separate queries and used only for their own breakdown, never
// added together for the total.
const getRealtimeActiveUsers = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({ message: "GA4_PROPERTY_ID is not configured" });
    }

    const client = getClient();
    const property = `properties/${propertyId}`;

    const [[totalResponse], [countryResponse], [pageResponse]] = await Promise.all([
      client.runRealtimeReport({ property, metrics: [{ name: "activeUsers" }] }),
      client.runRealtimeReport({
        property,
        metrics: [{ name: "activeUsers" }],
        dimensions: [{ name: "country" }],
      }),
      client.runRealtimeReport({
        property,
        metrics: [{ name: "activeUsers" }],
        dimensions: [{ name: "unifiedScreenName" }],
      }),
    ]);

    const activeUsers = sumRows(totalResponse.rows);

    return res.status(200).json({
      activeUsers,
      byCountry: rankedByDimension(countryResponse.rows),
      byPage: rankedByDimension(pageResponse.rows),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GA4 realtime report failed:", error.message);
    return res.status(502).json({ message: "Failed to fetch realtime analytics" });
  }
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// GA4 dimension values for hour/dayOfWeek/date come back unordered (they're
// treated as plain strings, so a naive sort would put "10" before "2") —
// bucket them into fixed-size arrays by index instead of trusting row order.
const rowsToRankedLabel = (rows, buildLabel) =>
  (rows || [])
    .map((row) => ({
      label: buildLabel(row.dimensionValues || []),
      value: Number(row.metricValues?.[0]?.value || 0),
    }))
    .sort((a, b) => b.value - a.value);

const bucketByIndex = (rows, size, mapLabel) => {
  const buckets = Array.from({ length: size }, (_, index) => ({
    label: mapLabel(index),
    value: 0,
  }));
  (rows || []).forEach((row) => {
    const index = Number(row.dimensionValues?.[0]?.value);
    if (Number.isInteger(index) && buckets[index]) {
      buckets[index].value = Number(row.metricValues?.[0]?.value || 0);
    }
  });
  return buckets;
};

// Historical analytics (top pages, geography, traffic rhythm) — distinct
// from the realtime endpoint above, this uses GA4's standard reporting API
// with an explicit date range rather than the last-30-minutes realtime one.
// The 6 breakdowns are split across two batchRunReports calls (GA4 caps a
// batch at 5 requests) run in parallel.
const getHistoricalAnalytics = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({ message: "GA4_PROPERTY_ID is not configured" });
    }

    // "Overall" has no native GA4 preset — 2020-01-01 predates GA4's own
    // launch, so it's a safe stand-in for "since data collection began."
    const startDate = req.query.from === "overall" ? "2020-01-01" : req.query.from || "29daysAgo";
    const endDate = req.query.to || "today";
    const dateRanges = [{ startDate, endDate }];
    const topMetricOrder = (metricName) => [{ metric: { metricName }, desc: true }];

    const client = getClient();
    const property = `properties/${propertyId}`;

    // GA4 caps batchRunReports at 5 requests per call, so this is split into
    // two batches (geo/pages, then time patterns) and run in parallel.
    const [[geoBatch], [timeBatch]] = await Promise.all([
      client.batchRunReports({
        property,
        requests: [
          {
            dateRanges,
            dimensions: [{ name: "pageTitle" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 10,
          },
          {
            dateRanges,
            dimensions: [{ name: "country" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 10,
          },
          {
            dateRanges,
            dimensions: [{ name: "region" }, { name: "country" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 10,
          },
          {
            dateRanges,
            dimensions: [{ name: "city" }, { name: "region" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 10,
          },
        ],
      }),
      client.batchRunReports({
        property,
        requests: [
          { dateRanges, dimensions: [{ name: "hour" }], metrics: [{ name: "activeUsers" }] },
          { dateRanges, dimensions: [{ name: "dayOfWeek" }], metrics: [{ name: "activeUsers" }] },
        ],
      }),
    ]);

    const [pagesR, countryR, regionR, cityR] = geoBatch.reports;
    const [hourR, dayR] = timeBatch.reports;

    const topPages = rowsToRankedLabel(pagesR.rows, (d) => d[0]?.value || "Unknown");
    const byCountry = rowsToRankedLabel(countryR.rows, (d) => d[0]?.value || "Unknown");
    const byState = rowsToRankedLabel(
      regionR.rows,
      (d) => [d[0]?.value, d[1]?.value].filter(Boolean).join(", ") || "Unknown",
    );
    const byCity = rowsToRankedLabel(
      cityR.rows,
      (d) => [d[0]?.value, d[1]?.value].filter(Boolean).join(", ") || "Unknown",
    );

    const byHour = bucketByIndex(hourR.rows, 24, (hour) => `${String(hour).padStart(2, "0")}:00`);
    const byDayOfWeek = bucketByIndex(dayR.rows, 7, (day) => DAY_NAMES[day]);

    return res.status(200).json({
      range: { from: startDate, to: endDate },
      topPages,
      byCountry,
      byState,
      byCity,
      byHour,
      byDayOfWeek,
    });
  } catch (error) {
    console.error("GA4 historical report failed:", error.message);
    return res.status(502).json({ message: "Failed to fetch historical analytics" });
  }
};

module.exports = { getRealtimeActiveUsers, getHistoricalAnalytics };
