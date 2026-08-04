const mongoose = require("mongoose");
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

// Every per-user sub-resource (destination views, listing views, session
// logs) is paginated and sorted the same way — factor the shared shape once
// instead of repeating it per endpoint.
const paginatedUserHistory = (Model) => async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = { userId };

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

module.exports = {
  getNomadUsers,
  getNomadUserDestinationViews,
  getNomadUserListingViews,
  getNomadUserSessionLogs,
};
