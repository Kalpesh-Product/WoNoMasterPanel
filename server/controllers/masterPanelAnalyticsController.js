// Master Panel Analytics — activity analytics for the Master Panel itself,
// computed from the same Log collection that powers /api/logs/get-logs.
// Mirrors hostPanelAnalyticsController (overview -> drill-down) but adds
// richer slices on top: weekday/hourly distribution, method + status
// breakdowns, response-time stats and per-module health rows.
const Log = require("../models/Log");
const AdminUser = require("../models/AdminUser");

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
]; // $dayOfWeek: 1 = Sunday

const pad2 = (value) => String(value).padStart(2, "0");

const cleanSetSize = (values) => {
  const set = new Set();
  (values || []).forEach((value) => {
    if (value === null || value === undefined) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    set.add(normalized.toLowerCase());
  });
  return set.size;
};

const buildTrendBuckets = () => {
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      label: MONTH_LABELS[d.getMonth()],
      value: 0,
    });
  }
  return buckets;
};

const trendStartDate = (buckets) => {
  const [year, month] = buckets[0].key.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const materializeTrend = (buckets, rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    map.set(`${row._id.y}-${pad2(row._id.m)}`, row.count);
  });
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: map.get(bucket.key) || 0,
  }));
};

const materializeWeekday = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    map.set(Number(row._id), row.count);
  });
  // Order Mon..Sun for a working-week reading of the data.
  const order = [2, 3, 4, 5, 6, 7, 1];
  return order.map((day) => ({
    label: WEEKDAY_LABELS[day - 1],
    value: map.get(day) || 0,
  }));
};

const materializeHourly = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    map.set(Number(row._id), row.count);
  });
  return Array.from({ length: 24 }, (_, hour) => ({
    label: `${pad2(hour)}h`,
    value: map.get(hour) || 0,
  }));
};

const healthOf = (lastActivityAt) => {
  if (!lastActivityAt) return "none";
  const days = Math.floor(
    (Date.now() - new Date(lastActivityAt).getTime()) / DAY_MS
  );
  if (days <= 7) return "highly_active";
  if (days <= 30) return "active";
  if (days <= 90) return "low";
  return "dormant";
};

const successRateOf = (totalActivities, failedActivities) =>
  totalActivities
    ? Math.round(((totalActivities - (failedActivities || 0)) / totalActivities) * 100)
    : null;

// Shared aggregation pipeline pieces so the overview and the per-module
// drill-down always compute their numbers the exact same way.
const periodConds = () => {
  const now = new Date();
  return {
    since30: new Date(now.getTime() - 30 * DAY_MS),
    prev30Start: new Date(now.getTime() - 60 * DAY_MS),
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
};

const metricsGroupStage = ({ since30, prev30Start, monthStart, todayStart }) => ({
  totalActivities: { $sum: 1 },
  activitiesLast30Days: {
    $sum: { $cond: [{ $gte: ["$createdAt", since30] }, 1, 0] },
  },
  activitiesPrev30Days: {
    $sum: {
      $cond: [
        {
          $and: [
            { $gte: ["$createdAt", prev30Start] },
            { $lt: ["$createdAt", since30] },
          ],
        },
        1,
        0,
      ],
    },
  },
  activitiesThisMonth: {
    $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0] },
  },
  todayActivities: {
    $sum: { $cond: [{ $gte: ["$createdAt", todayStart] }, 1, 0] },
  },
  failedActivities: {
    $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] },
  },
  avgResponseTime: { $avg: "$responseTime" },
});

const shapeMetrics = (doc = {}) => ({
  totalActivities: doc.totalActivities || 0,
  activitiesLast30Days: doc.activitiesLast30Days || 0,
  activitiesPrev30Days: doc.activitiesPrev30Days || 0,
  activitiesThisMonth: doc.activitiesThisMonth || 0,
  todayActivities: doc.todayActivities || 0,
  successRate: successRateOf(doc.totalActivities, doc.failedActivities),
  avgResponseTimeMs:
    doc.avgResponseTime === null || doc.avgResponseTime === undefined
      ? null
      : Math.round(doc.avgResponseTime),
  lastActivityAt: doc.lastActivityAt || null,
  firstActivityAt: doc.firstActivityAt || null,
  health: healthOf(doc.lastActivityAt),
});

const trendAgg = (match, trendStart) =>
  Log.aggregate([
    { $match: { ...match, createdAt: { $gte: trendStart } } },
    {
      $group: {
        _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
  ]);

const weekdayAgg = (match) =>
  Log.aggregate([
    { $match: match },
    { $group: { _id: { $dayOfWeek: "$createdAt" }, count: { $sum: 1 } } },
  ]);

const hourlyAgg = (match) =>
  Log.aggregate([
    { $match: match },
    { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
  ]);

const topListAgg = (match, field, limit) =>
  Log.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ""] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

const recentLogsQuery = (match, limit) =>
  Log.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "action module page companyName fullName method success createdAt responseTime"
    )
    .lean();

const getMasterPanelAnalytics = async (req, res, next) => {
  try {
    const periods = periodConds();
    const trendBuckets = buildTrendBuckets();
    const trendStart = trendStartDate(trendBuckets);
    const match = {}; // every master panel log belongs to this panel

    const [
      metricsRows,
      rawTrend,
      rawWeekday,
      rawHourly,
      topModuleRows,
      topUserRows,
      topActionRows,
      topCompanyRows,
      moduleRows,
      methodRows,
      recentLogs,
      totalMasterUsers,
    ] = await Promise.all([
      Log.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            ...metricsGroupStage(periods),
            activeUsers: { $addToSet: "$fullName" },
            companiesTouched: { $addToSet: "$companyName" },
            trackedModules: { $addToSet: "$module" },
            lastActivityAt: { $max: "$createdAt" },
            firstActivityAt: { $min: "$createdAt" },
          },
        },
      ]),
      trendAgg(match, trendStart),
      weekdayAgg(match),
      hourlyAgg(match),
      topListAgg(match, "module", 8),
      topListAgg(match, "fullName", 8),
      topListAgg(match, "action", 6),
      topListAgg(match, "companyName", 6),
      Log.aggregate([
        { $match: { ...match, module: { $nin: [null, ""] } } },
        {
          $group: {
            _id: "$module",
            totalActivities: { $sum: 1 },
            activitiesLast30Days: {
              $sum: { $cond: [{ $gte: ["$createdAt", periods.since30] }, 1, 0] },
            },
            activitiesPrev30Days: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$createdAt", periods.prev30Start] },
                      { $lt: ["$createdAt", periods.since30] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            activitiesThisMonth: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", periods.monthStart] }, 1, 0],
              },
            },
            failedActivities: {
              $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] },
            },
            users: { $addToSet: "$fullName" },
            companiesTouched: { $addToSet: "$companyName" },
            actionsUsed: { $addToSet: "$action" },
            lastActivityAt: { $max: "$createdAt" },
            firstActivityAt: { $min: "$createdAt" },
          },
        },
        { $sort: { totalActivities: -1 } },
      ]),
      Log.aggregate([
        { $match: { ...match, method: { $nin: [null, ""] } } },
        { $group: { _id: "$method", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      recentLogsQuery(match, 15),
      AdminUser.countDocuments({}),
    ]);

    const metricsDoc = metricsRows[0] || {};
    const stats = {
      ...shapeMetrics(metricsDoc),
      activeUsers: cleanSetSize(metricsDoc.activeUsers),
      totalUsers: totalMasterUsers,
      trackedModules: cleanSetSize(metricsDoc.trackedModules),
      companiesTouched: cleanSetSize(metricsDoc.companiesTouched),
    };

    const modules = moduleRows.map((row) => ({
      module: row._id,
      totalActivities: row.totalActivities,
      activitiesLast30Days: row.activitiesLast30Days,
      activitiesPrev30Days: row.activitiesPrev30Days,
      activitiesThisMonth: row.activitiesThisMonth,
      successRate: successRateOf(row.totalActivities, row.failedActivities),
      users: cleanSetSize(row.users),
      companiesTouched: cleanSetSize(row.companiesTouched),
      actionsCount: cleanSetSize(row.actionsUsed),
      firstActivityAt: row.firstActivityAt,
      lastActivityAt: row.lastActivityAt,
      health: healthOf(row.lastActivityAt),
    }));

    // Anything not explicitly failed counts as success — same convention as
    // the success-rate math above.
    const failedCount = metricsDoc.totalActivities
      ? Math.min(metricsDoc.failedActivities || 0, metricsDoc.totalActivities)
      : 0;
    const statusBreakdown = [
      {
        label: "Success",
        value: (metricsDoc.totalActivities || 0) - failedCount,
      },
      { label: "Failed", value: failedCount },
    ].filter((item) => item.value > 0);

    return res.status(200).json({
      stats,
      trend: materializeTrend(trendBuckets, rawTrend),
      weekdayActivity: materializeWeekday(rawWeekday),
      hourlyActivity: materializeHourly(rawHourly),
      methodBreakdown: methodRows.map((m) => ({ label: m._id, value: m.count })),
      statusBreakdown,
      topModules: topModuleRows.map((m) => ({ label: m._id, value: m.count })),
      topUsers: topUserRows.map((u) => ({ label: u._id, value: u.count })),
      topActions: topActionRows.map((a) => ({ label: a._id, value: a.count })),
      topCompanies: topCompanyRows.map((c) => ({ label: c._id, value: c.count })),
      modules,
      recentLogs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// Data Upload analytics — who is using the Data Upload module, which upload
// tab they used, when, and whether it succeeded. Computed from the same Log
// collection: every upload endpoint writes an audit log whose `action` is the
// URL's last segment, so matching those actions gives full attribution.
const UPLOAD_ACTION_TABS = {
  "bulk-insert-companies": "Company Upload",
  "bulk-add-company-images": "Product Images Upload",
  "bulk-upload-data": "Products Upload",
  "bulk-upload-images": "Bulk Upload Images",
  "bulk-reupload-images": "Bulk Reupload Images",
  "upload-single-image": "Upload Single Image",
  "upload-restaurant-logo": "Restaurant Logo Upload",
  "bulk-upload-restaurant-images": "Bulk Restaurant Images Upload",
};

const fileNamesOf = (payload) => {
  const names = [];
  if (payload?.uploadedFile?.originalName) {
    names.push(payload.uploadedFile.originalName);
  }
  if (Array.isArray(payload?.uploadedFiles)) {
    payload.uploadedFiles.forEach((file) => {
      if (file?.originalName) names.push(file.originalName);
    });
  }
  return names.slice(0, 3);
};

const getDataUploadAnalytics = async (req, res, next) => {
  try {
    const periods = periodConds();
    const trendBuckets = buildTrendBuckets();
    const trendStart = trendStartDate(trendBuckets);
    const match = { action: { $in: Object.keys(UPLOAD_ACTION_TABS) } };

    const [
      metricsRows,
      rawTrend,
      tabRows,
      userRows,
      recentUploads,
      totalUploads,
    ] = await Promise.all([
      Log.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            failedUploads: { $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] } },
            uploadsLast30Days: {
              $sum: { $cond: [{ $gte: ["$createdAt", periods.since30] }, 1, 0] },
            },
            uploadsThisMonth: {
              $sum: { $cond: [{ $gte: ["$createdAt", periods.monthStart] }, 1, 0] },
            },
            todayUploads: {
              $sum: { $cond: [{ $gte: ["$createdAt", periods.todayStart] }, 1, 0] },
            },
            users: { $addToSet: "$fullName" },
            lastUploadAt: { $max: "$createdAt" },
          },
        },
      ]),
      Log.aggregate([
        { $match: { ...match, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      Log.aggregate([
        { $match: match },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Log.aggregate([
        { $match: { ...match, fullName: { $nin: [null, ""] } } },
        {
          $group: {
            _id: "$fullName",
            count: { $sum: 1 },
            lastUploadAt: { $max: "$createdAt" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Log.find(match)
        .sort({ createdAt: -1 })
        .limit(25)
        .select("action fullName method success createdAt responseTime payload")
        .lean(),
      Log.countDocuments(match),
    ]);

    const metricsDoc = metricsRows[0] || {};
    const failedCount = Math.min(metricsDoc.failedUploads || 0, totalUploads);

    return res.status(200).json({
      stats: {
        totalUploads,
        uploadsThisMonth: metricsDoc.uploadsThisMonth || 0,
        uploadsLast30Days: metricsDoc.uploadsLast30Days || 0,
        todayUploads: metricsDoc.todayUploads || 0,
        failedUploads: failedCount,
        activeUsers: cleanSetSize(metricsDoc.users),
        lastUploadAt: metricsDoc.lastUploadAt || null,
      },
      trend: materializeTrend(trendBuckets, rawTrend),
      // Which Data Upload tab was used and how often.
      tabBreakdown: tabRows.map((row) => ({
        label: UPLOAD_ACTION_TABS[row._id] || row._id,
        value: row.count,
      })),
      // Who is doing the uploads.
      topUsers: userRows.map((row) => ({
        label: row._id,
        value: row.count,
        lastUploadAt: row.lastUploadAt,
      })),
      successBreakdown: [
        { label: "Success", value: totalUploads - failedCount },
        { label: "Failed", value: failedCount },
      ].filter((item) => item.value > 0),
      // Most recent uploads: who did what, when, with which files.
      recentUploads: recentUploads.map((log) => ({
        id: log._id,
        action: log.action,
        tab: UPLOAD_ACTION_TABS[log.action] || log.action,
        fullName: log.fullName,
        method: log.method,
        success: log.success !== false,
        createdAt: log.createdAt,
        responseTime: log.responseTime,
        files: fileNamesOf(log.payload),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMasterPanelAnalytics, getDataUploadAnalytics };
