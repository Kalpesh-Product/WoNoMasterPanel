const HostActivityLog = require("../models/HostActivityLog");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const HostUser = require("../models/hostCompany/hostUser");
const Workspace = require("../models/hostCompany/Workspace");

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

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pad2 = (value) => String(value).padStart(2, "0");

const cleanSetSize = (values, transform) => {
  const set = new Set();
  (values || []).forEach((value) => {
    if (value === null || value === undefined) return;
    const normalized = transform ? transform(value) : String(value).trim();
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

const companyLogMatch = (companyIds) => {
  const patterns = (Array.isArray(companyIds) ? companyIds : [companyIds])
    .filter(Boolean)
    .map((id) => `^${escapeRegex(id)}(-.*)?$`);
  return patterns.length ? { companyId: { $regex: patterns.join("|") } } : {};
};

const resolveCompanyStats = (aggList, companyId) => {
  const target = String(companyId || "").trim();
  if (!target) return null;
  const exact = aggList.find(
    (entry) => String(entry._id || "").trim() === target
  );
  if (exact) return exact;
  return (
    aggList.find((entry) => {
      const key = String(entry._id || "").trim();
      return (
        key &&
        (key.startsWith(`${target}-`) || target.startsWith(`${key}-`))
      );
    }) || null
  );
};

const mapById = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = String(row._id || "").trim();
    if (key) map.set(key, row);
  });
  return map;
};

const healthOf = (lastActivityAt) => {
  if (!lastActivityAt) return "none";
  const days = Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / DAY_MS);
  if (days <= 7) return "highly_active";
  if (days <= 30) return "active";
  if (days <= 90) return "low";
  return "dormant";
};

const getHostPanelAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const prev30Start = new Date(now.getTime() - 60 * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const trendBuckets = buildTrendBuckets();
    const trendStart = trendStartDate(trendBuckets);

    const companies = await HostLeadCompany.find({})
      .sort({ createdAt: -1 })
      .select(
        "companyId companyName companyCity companyState companyCountry companyContinent industry plan subscriptionStatus paymentStatus isRegistered logo.url createdAt"
      )
      .lean();

    const currentCompanyIds = companies
      .map((company) => String(company.companyId || "").trim())
      .filter(Boolean);
    const currentCompanyLogMatch = currentCompanyIds.length
      ? companyLogMatch(currentCompanyIds)
      : { companyId: "__no_current_host_company__" };

    const [
      perCompanyAgg,
      userCounts,
      workspaceCounts,
      rawTrend,
      moduleRows,
      userRows,
    ] = await Promise.all([
      HostActivityLog.aggregate([
        { $match: currentCompanyLogMatch },
        {
          $group: {
            _id: "$companyId",
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
            failedActivities: {
              $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] },
            },
            lastActivityAt: { $max: "$createdAt" },
            firstActivityAt: { $min: "$createdAt" },
            userKeys: { $addToSet: { $ifNull: ["$email", "$fullName"] } },
            workspaceIds: { $addToSet: "$workspaceId" },
            companyNames: { $addToSet: "$companyName" },
          },
        },
      ]),
      HostUser.aggregate([
        { $match: { companyId: { $in: currentCompanyIds } } },
        {
          $group: {
            _id: "$companyId",
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isActive", true] },
                      { $ne: ["$isDeleted", true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Workspace.aggregate([
        { $match: { companyId: { $in: currentCompanyIds } } },
        {
          $group: {
            _id: "$companyId",
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isActive", true] },
                      { $ne: ["$isDeleted", true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...currentCompanyLogMatch, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...currentCompanyLogMatch, module: { $nin: [null, ""] } } },
        { $group: { _id: "$module", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...currentCompanyLogMatch, fullName: { $nin: [null, ""] } } },
        { $group: { _id: "$fullName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const userCountMap = mapById(userCounts);
    const workspaceCountMap = mapById(workspaceCounts);

    const rows = companies.map((company) => {
      const stats = resolveCompanyStats(perCompanyAgg, company.companyId);
      const users = userCountMap.get(String(company.companyId).trim());
      const workspaces = workspaceCountMap.get(String(company.companyId).trim());
      const totalActivities = stats?.totalActivities || 0;
      return {
        companyId: company.companyId,
        companyName: company.companyName,
        companyCity: company.companyCity || "",
        companyCountry: company.companyCountry || "",
        companyContinent: company.companyContinent || "",
        industry: company.industry || "",
        logoUrl: company.logo?.url || "",
        plan: company.plan || "",
        subscriptionStatus: company.subscriptionStatus || "",
        paymentStatus: Boolean(company.paymentStatus),
        isRegistered: Boolean(company.isRegistered),
        onboardedAt: company.createdAt,
        totalActivities,
        activitiesLast30Days: stats?.activitiesLast30Days || 0,
        activitiesPrev30Days: stats?.activitiesPrev30Days || 0,
        activitiesThisMonth: stats?.activitiesThisMonth || 0,
        successRate: totalActivities
          ? Math.round(((totalActivities - (stats?.failedActivities || 0)) / totalActivities) * 100)
          : null,
        activeUsers: stats ? cleanSetSize(stats.userKeys) : 0,
        totalUsers: users?.total || 0,
        workspacesUsed: stats ? cleanSetSize(stats.workspaceIds) : 0,
        totalWorkspaces: workspaces?.total || 0,
        lastActivityAt: stats?.lastActivityAt || null,
        firstActivityAt: stats?.firstActivityAt || null,
        health: healthOf(stats?.lastActivityAt),
      };
    });


    const maxTotal = Math.max(...rows.map((r) => r.totalActivities), 0);
    const maxRecent = Math.max(...rows.map((r) => r.activitiesLast30Days), 0);
    const maxAdoption = Math.max(
      ...rows.map((r) => r.totalUsers + r.totalWorkspaces),
      0
    );

    const scored = rows.map((row) => {
      const activityPart = maxTotal ? (row.totalActivities / maxTotal) * 50 : 0;
      const recentPart = maxRecent ? (row.activitiesLast30Days / maxRecent) * 30 : 0;
      const adoptionPart = maxAdoption
        ? ((row.totalUsers + row.totalWorkspaces) / maxAdoption) * 20
        : 0;
      return {
        ...row,
        performanceScore: Math.min(100, Math.round(activityPart + recentPart + adoptionPart)),
      };
    });

    scored.sort((a, b) => {
      if (b.activitiesLast30Days !== a.activitiesLast30Days)
        return b.activitiesLast30Days - a.activitiesLast30Days;
      return b.totalActivities - a.totalActivities;
    });

    const trend = materializeTrend(trendBuckets, rawTrend);

    let topCompanies = scored
      .slice()
      .sort(
        (a, b) =>
          b.activitiesLast30Days - a.activitiesLast30Days ||
          b.totalActivities - a.totalActivities
      )
      .slice(0, 6)
      .map((row) => ({
        label: row.companyName,
        value: row.activitiesLast30Days > 0 ? row.activitiesLast30Days : row.totalActivities,
      }));

    if (topCompanies.every((item) => !item.value)) topCompanies = [];

    const stats = {
      totalCompanies: scored.length,
      registeredCompanies: scored.filter((r) => r.isRegistered).length,
      activeCompanies: scored.filter((r) =>
        ["highly_active", "active"].includes(r.health)
      ).length,
      dormantCompanies: scored.filter((r) =>
        ["dormant", "none"].includes(r.health)
      ).length,
      totalActivities: scored.reduce((sum, r) => sum + r.totalActivities, 0),
      activitiesLast30Days: scored.reduce((sum, r) => sum + r.activitiesLast30Days, 0),
      activitiesThisMonth: scored.reduce((sum, r) => sum + r.activitiesThisMonth, 0),
      totalUsers: scored.reduce((sum, r) => sum + r.totalUsers, 0),
      activeUsers: scored.reduce((sum, r) => sum + r.activeUsers, 0),
      totalWorkspaces: scored.reduce((sum, r) => sum + r.totalWorkspaces, 0),
    };

    return res.status(200).json({
      stats,
      trend,
      topCompanies,
      modules: moduleRows.map((m) => ({ label: m._id, value: m.count })),
      topUsers: userRows.map((u) => ({ label: u._id, value: u.count })),
      companies: scored,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

const getHostPanelCompanyAnalytics = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const trimmed = String(companyId || "").trim();
    if (!trimmed)
      return res.status(400).json({ message: "companyId is required" });

    let company = await HostLeadCompany.findOne({ companyId: trimmed })
      .select(
        "companyId companyName registeredEntityName companyCity companyState companyCountry companyContinent industry plan requestedPlan subscriptionStatus paymentStatus trialStartAt trialEndAt isTrialActive pocName pocEmail pocPhone logo.url createdAt"
      )
      .lean();

    if (!company) {
      company = await HostLeadCompany.findOne({
        companyId: { $regex: `^${escapeRegex(trimmed)}(-.*)?$` },
      }).lean();
    }

    const matchIds = [...new Set([trimmed, company?.companyId].filter(Boolean))];
    const logMatch = companyLogMatch(matchIds);

    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const prev30Start = new Date(now.getTime() - 60 * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const trendBuckets = buildTrendBuckets();
    const trendStart = trendStartDate(trendBuckets);

    const [
      metricsRows,
      rawTrend,
      topUsersRows,
      moduleRows,
      actionRows,
      workspaceRows,
      recentLogs,
      hostUsers,
      workspaces,
    ] = await Promise.all([
      HostActivityLog.aggregate([
        { $match: logMatch },
        {
          $group: {
            _id: null,
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
            failedActivities: {
              $sum: { $cond: [{ $eq: ["$success", false] }, 1, 0] },
            },
            avgResponseTime: { $avg: "$responseTime" },
            activeUsers: { $addToSet: { $ifNull: ["$email", "$fullName"] } },
            workspacesUsed: { $addToSet: "$workspaceId" },
            lastActivityAt: { $max: "$createdAt" },
            firstActivityAt: { $min: "$createdAt" },
          },
        },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...logMatch, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...logMatch, fullName: { $nin: [null, ""] } } },
        { $group: { _id: "$fullName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...logMatch, module: { $nin: [null, ""] } } },
        { $group: { _id: "$module", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...logMatch, action: { $nin: [null, ""] } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      HostActivityLog.aggregate([
        { $match: { ...logMatch, workspaceName: { $nin: [null, ""] } } },
        {
          $group: {
            _id: "$workspaceName",
            count: { $sum: 1 },
            lastActivityAt: { $max: "$createdAt" },
            users: { $addToSet: "$fullName" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      HostActivityLog.find(logMatch)
        .sort({ createdAt: -1 })
        .limit(15)
        .select(
          "action module fullName email workspaceName method success createdAt responseTime"
        )
        .lean(),
      HostUser.find({
        $or: [
          { companyId: { $in: matchIds } },
          ...(company?._id ? [{ company: company._id }] : []),
        ],
      })
        .select("name email inviteStatus isActive inviteSentAt registeredAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Workspace.find({
        $or: [
          { companyId: { $in: matchIds } },
          ...(company?._id ? [{ company: company._id }] : []),
        ],
        isDeleted: { $ne: true },
      })
        .select("workspaceId workspaceName businessName selectedPlan enabledModules isActive createdAt")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const metricsDoc = metricsRows[0] || {};
    const metrics = {
      totalActivities: metricsDoc.totalActivities || 0,
      activitiesLast30Days: metricsDoc.activitiesLast30Days || 0,
      activitiesPrev30Days: metricsDoc.activitiesPrev30Days || 0,
      activitiesThisMonth: metricsDoc.activitiesThisMonth || 0,
      successRate: metricsDoc.totalActivities
        ? Math.round(
            ((metricsDoc.totalActivities - (metricsDoc.failedActivities || 0)) /
              metricsDoc.totalActivities) *
              100
          )
        : null,
      avgResponseTimeMs: metricsDoc.avgResponseTime
        ? Math.round(metricsDoc.avgResponseTime)
        : null,
      activeUsers: cleanSetSize(metricsDoc.activeUsers),
      workspacesUsed: cleanSetSize(metricsDoc.workspacesUsed),
      lastActivityAt: metricsDoc.lastActivityAt || null,
      firstActivityAt: metricsDoc.firstActivityAt || null,
      health: healthOf(metricsDoc.lastActivityAt),
    };

    return res.status(200).json({
      company: company
        ? {
            ...company,
          }
        : {
            companyId: trimmed,
            companyName:
              (recentLogs.find((log) => log.companyName)?.companyName) ||
              (await HostActivityLog.findOne(logMatch).select("companyName").lean())
                ?.companyName ||
              trimmed,
          },
      metrics,
      trend: materializeTrend(trendBuckets, rawTrend),
      topUsers: topUsersRows.map((u) => ({ label: u._id, value: u.count })),
      modules: moduleRows.map((m) => ({ label: m._id, value: m.count })),
      actions: actionRows.map((a) => ({ label: a._id, value: a.count })),
      workspaces: workspaceRows.map((w) => ({
        label: w._id,
        value: w.count,
        lastActivityAt: w.lastActivityAt,
        users: cleanSetSize(w.users),
      })),
      recentLogs,
      hostUsers,
      workspacesList: workspaces.map((w) => ({
        _id: w._id,
        workspaceId: w.workspaceId,
        workspaceName: w.workspaceName,
        businessName: w.businessName,
        selectedPlan: w.selectedPlan,
        enabledModulesCount: Array.isArray(w.enabledModules)
          ? w.enabledModules.length
          : 0,
        isActive: Boolean(w.isActive),
        createdAt: w.createdAt,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHostPanelAnalytics, getHostPanelCompanyAnalytics };
