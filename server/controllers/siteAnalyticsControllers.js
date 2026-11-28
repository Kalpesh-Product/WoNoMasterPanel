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

const UNKNOWN_GA_DIMENSION_VALUES = new Set(["", "(not set)", "not set", "unknown"]);

const cleanGaDimensionValue = (value) => String(value || "").trim();

const isKnownGaDimensionValue = (value) =>
  !UNKNOWN_GA_DIMENSION_VALUES.has(cleanGaDimensionValue(value).toLowerCase());

// GA4 dimension values for hour/dayOfWeek/date come back unordered (they're
// treated as plain strings, so a naive sort would put "10" before "2") —
// bucket them into fixed-size arrays by index instead of trusting row order.
const rowsToRankedLabel = (rows, buildLabel, options = {}) =>
  (rows || [])
    .filter((row) => {
      if (!options.onlyKnownDimensions) return true;
      return (row.dimensionValues || []).every((dimension) =>
        isKnownGaDimensionValue(dimension?.value),
      );
    })
    .map((row) => ({
      label: buildLabel(row.dimensionValues || []),
      value: Number(row.metricValues?.[0]?.value || 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, options.limit || Infinity);

const rowsToGeographicUsers = (rows, buildLabel) =>
  (rows || [])
    .filter((row) =>
      (row.dimensionValues || []).every((dimension) =>
        isKnownGaDimensionValue(dimension?.value),
      ),
    )
    .map((row) => ({
      label: buildLabel(row.dimensionValues || []),
      activeUsers: Number(row.metricValues?.[0]?.value || 0),
      newUsers: Number(row.metricValues?.[1]?.value || 0),
    }))
    .sort((a, b) => b.activeUsers - a.activeUsers);

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

const SUMMARY_METRICS = [
  "activeUsers",
  "sessions",
  "screenPageViews",
  "newUsers",
  "engagementRate",
  "averageSessionDuration",
];

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const resolveReportDate = (value, today) => {
  if (!value || value === "today") return new Date(today);
  const relativeMatch = String(value).match(/^(\d+)daysAgo$/);
  if (relativeMatch) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - Number(relativeMatch[1]));
    return date;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPreviousDateRange = (startDate, endDate) => {
  if (startDate === "2020-01-01") return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const currentStart = resolveReportDate(startDate, today);
  const currentEnd = resolveReportDate(endDate, today);
  if (!currentStart || !currentEnd || currentStart > currentEnd) return null;

  const durationMs = currentEnd.getTime() - currentStart.getTime() + 86400000;
  const previousEnd = new Date(currentStart.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 86400000);
  return { startDate: toIsoDate(previousStart), endDate: toIsoDate(previousEnd) };
};

const summaryFromReport = (report) => {
  const values = report?.rows?.[0]?.metricValues || [];
  return Object.fromEntries(
    SUMMARY_METRICS.map((metric, index) => [metric, Number(values[index]?.value || 0)]),
  );
};

const formatGaDateLabel = (value) => {
  const date = String(value || "");
  return date.length === 8
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    : date;
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
    const previousDateRange = getPreviousDateRange(startDate, endDate);
    const topMetricOrder = (metricName) => [{ metric: { metricName }, desc: true }];

    const client = getClient();
    const property = `properties/${propertyId}`;

    // GA4 caps batchRunReports at 5 requests per call, so geography, time
    // patterns, and traffic-quality reports are split into parallel batches.
    const qualityRequests = [
      {
        dateRanges,
        metrics: SUMMARY_METRICS.map((name) => ({ name })),
      },
      {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
      {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: topMetricOrder("sessions"),
        limit: 8,
      },
      {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: topMetricOrder("activeUsers"),
      },
    ];
    if (previousDateRange) {
      qualityRequests.push({
        dateRanges: [previousDateRange],
        metrics: SUMMARY_METRICS.map((name) => ({ name })),
      });
    }

    const [[geoBatch], [timeBatch], [qualityBatch]] = await Promise.all([
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
            metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 1000,
          },
          {
            dateRanges,
            dimensions: [{ name: "region" }, { name: "country" }],
            metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 1000,
          },
          {
            dateRanges,
            dimensions: [{ name: "city" }, { name: "region" }],
            metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
            orderBys: topMetricOrder("activeUsers"),
            limit: 1000,
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
      client.batchRunReports({ property, requests: qualityRequests }),
    ]);

    const [pagesR, countryR, regionR, cityR] = geoBatch.reports;
    const [hourR, dayR] = timeBatch.reports;
    const [summaryR, dailyR, channelR, deviceR, previousSummaryR] = qualityBatch.reports;

    const topPages = rowsToRankedLabel(pagesR.rows, (d) => d[0]?.value || "Unknown");
    const usersByCountry = rowsToGeographicUsers(
      countryR.rows,
      (d) => d[0]?.value || "Unknown",
    );
    const usersByState = rowsToGeographicUsers(
      regionR.rows,
      (d) => [d[0]?.value, d[1]?.value].filter(Boolean).join(", ") || "Unknown",
    );
    const usersByCity = rowsToGeographicUsers(
      cityR.rows,
      (d) => [d[0]?.value, d[1]?.value].filter(Boolean).join(", ") || "Unknown",
    );
    const byCountry = usersByCountry.slice(0, 10).map((item) => ({
      label: item.label,
      value: item.activeUsers,
    }));
    const byState = usersByState.slice(0, 10).map((item) => ({
      label: item.label,
      value: item.activeUsers,
    }));
    const byCity = usersByCity.slice(0, 10).map((item) => ({
      label: item.label,
      value: item.activeUsers,
    }));

    const byHour = bucketByIndex(hourR.rows, 24, (hour) => `${String(hour).padStart(2, "0")}:00`);
    const byDayOfWeek = bucketByIndex(dayR.rows, 7, (day) => DAY_NAMES[day]);
    const trendByDate = rowsToRankedLabel(
      dailyR.rows,
      (d) => formatGaDateLabel(d[0]?.value),
    ).sort((a, b) => a.label.localeCompare(b.label));
    const byChannel = rowsToRankedLabel(channelR.rows, (d) => d[0]?.value || "Unknown");
    const byDevice = rowsToRankedLabel(deviceR.rows, (d) => d[0]?.value || "Unknown");

    return res.status(200).json({
      range: { from: startDate, to: endDate },
      previousRange: previousDateRange
        ? { from: previousDateRange.startDate, to: previousDateRange.endDate }
        : null,
      summary: {
        current: summaryFromReport(summaryR),
        previous: previousSummaryR ? summaryFromReport(previousSummaryR) : null,
      },
      trendByDate,
      byChannel,
      byDevice,
      topPages,
      geographicUsers: {
        countries: usersByCountry,
        states: usersByState,
        cities: usersByCity,
      },
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
