const AdminUser = require("../models/AdminUser");

// Mongoose Map keys cannot contain dots or dollar-prefixed path segments.
const TOUR_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const TOUR_STATUSES = new Set(["completed", "skipped"]);

const getTourProgress = async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.user).select("tourProgress");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const progress = {};
    for (const [tourKey, storedEntry] of user.tourProgress?.entries?.() || []) {
      progress[tourKey] = storedEntry?.toObject ? storedEntry.toObject() : storedEntry;
    }

    return res.status(200).json({
      message: "Tour progress fetched successfully.",
      data: { progress },
    });
  } catch (error) {
    next(error);
  }
};

const saveTourProgress = async (req, res, next) => {
  try {
    const tourKey = String(req.params?.tourKey || "").trim().toLowerCase();
    const version = Number(req.body?.version);
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!TOUR_KEY_PATTERN.test(tourKey)) {
      return res.status(400).json({ message: "Invalid tour key." });
    }
    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({ message: "Tour version must be a positive integer." });
    }
    if (!TOUR_STATUSES.has(status)) {
      return res.status(400).json({ message: "Tour status must be completed or skipped." });
    }

    const progressEntry = {
      version,
      status,
      updatedAt: new Date(),
    };
    const updatedUser = await AdminUser.findByIdAndUpdate(
      req.user,
      { $set: { [`tourProgress.${tourKey}`]: progressEntry } },
      { new: true, select: "tourProgress" },
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "Tour progress saved successfully.",
      data: {
        tourKey,
        progress: progressEntry,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTourProgress, saveTourProgress };
