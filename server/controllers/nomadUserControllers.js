const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const NomadUser = require("../models/nomads/NomadUser");
const NomadDestinationView = require("../models/nomads/NomadDestinationView");
const NomadListingView = require("../models/nomads/NomadListingView");
const NomadUserSessionLog = require("../models/nomads/NomadUserSessionLog");
// Registers "Company" and "StateWiseWeight" on the Nomads connection so
// `.populate()` below can resolve NomadUser's saves/likes/favoriteDestination
// refs; not referenced directly otherwise.
require("../models/nomads/Company");
require("../models/nomads/StateWiseWeight");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Never surface auth secrets even though the source schema is read with
// `strict: false`.
const SENSITIVE_FIELDS = "-password -resetPasswordToken -resetPasswordExpire -refreshToken";

const POPULATE_OPTIONS = [
  { path: "saves", select: "companyName city state country" },
  { path: "likes", select: "companyName city state country" },
  { path: "favoriteDestination", select: "title state country continent" },
];

const getNomadUsers = async (req, res, next) => {
  try {
    const { page, search } = req.query;

    const filter = {};
    const trimmedSearch = String(search || "").trim();
    if (trimmedSearch) {
      const searchRegex = new RegExp(escapeRegex(trimmedSearch), "i");
      filter.$or = [
        { fullName: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { country: searchRegex },
        { state: searchRegex },
      ];
    }

    if (page === undefined) {
      const users = await NomadUser.find(filter)
        .select(SENSITIVE_FIELDS)
        .populate(POPULATE_OPTIONS)
        .sort({ createdAt: -1 })
        .lean();
      return res.status(200).json({ items: users, total: users.length });
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const [users, total, totalCount] = await Promise.all([
      NomadUser.find(filter)
        .select(SENSITIVE_FIELDS)
        .populate(POPULATE_OPTIONS)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      NomadUser.countDocuments(filter),
      NomadUser.countDocuments({}),
    ]);

    return res.status(200).json({
      items: users,
      page: pageNumber,
      limit: pageSize,
      total,
      hasMore: pageNumber * pageSize < total,
      counts: { total: totalCount },
    });
  } catch (error) {
    next(error);
  }
};

// `from`/`to` are optional ISO date strings scoping any per-user history
// query (list view or export) to a date range on `createdAt`.
const buildDateRangeFilter = (req) => {
  const { from, to } = req.query;
  const range = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) range.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) range.$lte = toDate;
  }
  return Object.keys(range).length ? { createdAt: range } : {};
};

// Every per-user sub-resource (destination views, listing views, session
// logs) is paginated, date-filterable, and sorted the same way — factor the
// shared shape once instead of repeating it per endpoint.
const paginatedUserHistory = (Model) => async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = { userId, ...buildDateRangeFilter(req) };

    const [items, total] = await Promise.all([
      Model.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Model.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      page,
      limit: pageSize,
      total,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    next(error);
  }
};

const getNomadUserDestinationViews = paginatedUserHistory(NomadDestinationView);
const getNomadUserListingViews = paginatedUserHistory(NomadListingView);
const getNomadUserSessionLogs = paginatedUserHistory(NomadUserSessionLog);

const EXPORT_ROW_LIMIT = 20000;

const formatExportDate = (value) => (value ? new Date(value).toLocaleString("en-US") : "");

const exportNomadUserActivity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const filter = { userId, ...buildDateRangeFilter(req) };

    const [user, destinations, listings, sessions] = await Promise.all([
      NomadUser.findById(userId).select("fullName firstName lastName email").lean(),
      NomadDestinationView.find(filter).sort({ createdAt: -1 }).limit(EXPORT_ROW_LIMIT).lean(),
      NomadListingView.find(filter).sort({ createdAt: -1 }).limit(EXPORT_ROW_LIMIT).lean(),
      NomadUserSessionLog.find(filter).sort({ createdAt: -1 }).limit(EXPORT_ROW_LIMIT).lean(),
    ]);

    const workbook = new ExcelJS.Workbook();

    const destinationsSheet = workbook.addWorksheet("Destinations");
    destinationsSheet.columns = [
      { header: "Title", key: "title", width: 24 },
      { header: "State", key: "state", width: 18 },
      { header: "Country", key: "country", width: 18 },
      { header: "Continent", key: "continent", width: 16 },
      { header: "Viewed At", key: "createdAt", width: 22 },
    ];
    destinations.forEach((entry) =>
      destinationsSheet.addRow({
        title: entry.title || "",
        state: entry.state || "",
        country: entry.country || "",
        continent: entry.continent || "",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    const listingsSheet = workbook.addWorksheet("Listings");
    listingsSheet.columns = [
      { header: "Company Name", key: "companyName", width: 28 },
      { header: "City", key: "city", width: 18 },
      { header: "State", key: "state", width: 18 },
      { header: "Country", key: "country", width: 18 },
      { header: "Continent", key: "continent", width: 16 },
      { header: "Viewed At", key: "createdAt", width: 22 },
    ];
    listings.forEach((entry) =>
      listingsSheet.addRow({
        companyName: entry.companyName || "",
        city: entry.city || "",
        state: entry.state || "",
        country: entry.country || "",
        continent: entry.continent || "",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    const sessionsSheet = workbook.addWorksheet("Sign In-Out");
    sessionsSheet.columns = [
      { header: "Event", key: "event", width: 14 },
      { header: "Date & Time", key: "createdAt", width: 22 },
    ];
    sessions.forEach((entry) =>
      sessionsSheet.addRow({
        event: entry.event === "login" ? "Signed In" : "Signed Out",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    [destinationsSheet, listingsSheet, sessionsSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
    });

    const userLabel =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email ||
      userId;
    const safeFileName = String(userLabel).trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "nomad-user";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nomad-activity-${safeFileName}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNomadUsers,
  getNomadUserDestinationViews,
  getNomadUserListingViews,
  getNomadUserSessionLogs,
  exportNomadUserActivity,
};
