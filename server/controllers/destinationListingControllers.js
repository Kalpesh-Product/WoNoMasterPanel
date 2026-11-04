const ExcelJS = require("exceljs");
const WonoDestinationListing = require("../models/WonoDestinationListing");
const { parseDestinationRawData } = require("../utils/parseDestinationRawData");
const { scoreListing } = require("../utils/destinationListingScoring");

const CATEGORIES = ["Coworking", "Coliving", "Cafe", "Hostel", "Meeting Room"];
const PRIORITIES = ["High Opportunity", "Medium Opportunity", "Lower Opportunity"];

const average = (values) => (values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : 0);

const getDestinationListingSummary = async (req, res, next) => {
  try {
    const destination = String(req.query.destination || "").trim();
    if (!destination) return res.status(400).json({ message: "destination is required." });

    const listings = await WonoDestinationListing.find({ destination }).lean();
    if (!listings.length) {
      return res.status(200).json({ exists: false, destination });
    }

    const priorityMix = PRIORITIES.map((priority) => ({
      priority,
      count: listings.filter((item) => item.scoring?.priority === priority).length,
    }));

    const categories = CATEGORIES.map((category) => {
      const rows = listings.filter((item) => item.category === category);
      const sorted = [...rows].sort((a, b) => (b.scoring?.finalScore || 0) - (a.scoring?.finalScore || 0));
      return {
        category,
        count: rows.length,
        averageScore: average(rows.map((item) => item.scoring?.finalScore || 0)),
        highOpportunityCount: rows.filter((item) => item.scoring?.priority === "High Opportunity").length,
        priorityCounts: PRIORITIES.reduce((counts, priority) => ({
          ...counts,
          [priority]: rows.filter((item) => item.scoring?.priority === priority).length,
        }), {}),
        digitalGapsAverage: average(rows.map((item) => item.scoring?.digitalGaps || 0)),
        topBusiness: sorted[0] ? { businessName: sorted[0].businessName, finalScore: sorted[0].scoring?.finalScore } : null,
      };
    });

    const digitalGapsBuckets = [0, 1, 2, 3].map((gaps) => ({
      gaps,
      count: listings.filter((item) => item.scoring?.digitalGaps === gaps).length,
    }));

    const priorityLeads = [...listings]
      .sort((a, b) => (b.scoring?.finalScore || 0) - (a.scoring?.finalScore || 0));

    const digitalPresence = [
      ["Website", "hasWebsite"],
      ["Instagram", "hasInstagram"],
      ["Facebook", "hasFacebook"],
    ].map(([channel, field]) => ({
      channel,
      present: listings.filter((item) => item[field]).length,
      missing: listings.filter((item) => !item[field]).length,
    }));

    return res.status(200).json({
      exists: true,
      destination,
      totalBusinesses: listings.length,
      averageScore: average(listings.map((item) => item.scoring?.finalScore || 0)),
      priorityMix,
      categories,
      digitalGapsBuckets,
      digitalPresence,
      priorityLeads,
      topLeads: priorityLeads.slice(0, 15),
    });
  } catch (error) {
    next(error);
  }
};

const getDestinationListings = async (req, res, next) => {
  try {
    const destination = String(req.query.destination || "").trim();
    const category = String(req.query.category || "").trim();
    if (!destination || !category) return res.status(400).json({ message: "destination and category are required." });

    const listings = await WonoDestinationListing.find({ destination, category })
      .sort({ "scoring.finalScore": -1 })
      .lean();

    const priorityMix = PRIORITIES.map((priority) => ({
      priority,
      count: listings.filter((item) => item.scoring?.priority === priority).length,
    }));

    const digitalPresence = [
      ["Website", "hasWebsite"],
      ["Instagram", "hasInstagram"],
      ["Facebook", "hasFacebook"],
    ].map(([channel, field]) => ({
      channel,
      present: listings.filter((item) => item[field]).length,
      missing: listings.filter((item) => !item[field]).length,
    }));

    return res.status(200).json({
      destination,
      category,
      total: listings.length,
      averageScore: average(listings.map((item) => item.scoring?.finalScore || 0)),
      priorityMix,
      digitalPresence,
      stats: {
        noWebsite: listings.filter((item) => !item.hasWebsite).length,
        twoPlusDigitalGaps: listings.filter((item) => (item.scoring?.digitalGaps || 0) >= 2).length,
        nearAirport: listings.filter((item) => item.nearAirport).length,
        averageRating: average(listings.map((item) => item.rating || 0)),
        averageCategoryFit: average(listings.map((item) => item.scoring?.categoryFitScore || 0)),
        totalReviews: listings.reduce((sum, item) => sum + (item.totalReviews || 0), 0),
      },
      items: listings,
    });
  } catch (error) {
    next(error);
  }
};

const EDITABLE_INFO_FIELDS = ["website", "email", "contact", "linkedin", "businessStatus", "status", "owner", "notes", "nextAction", "plan"];

const updateDestinationListingInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};
    EDITABLE_INFO_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = String(req.body[field]).trim();
    });
    if (req.body.dateOfActivation !== undefined) {
      updates.dateOfActivation = req.body.dateOfActivation ? new Date(req.body.dateOfActivation) : null;
    }

    const listing = await WonoDestinationListing.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!listing) return res.status(404).json({ message: "Listing not found." });

    return res.status(200).json(listing);
  } catch (error) {
    next(error);
  }
};

// Every destination that already has at least one listing uploaded, with its
// business count and when it was last touched — for the Reupload tab, and for
// disabling already-added destinations on the Add New tab.
const getUploadedDestinations = async (req, res, next) => {
  try {
    const rows = await WonoDestinationListing.aggregate([
      {
        $group: {
          _id: "$destination",
          count: { $sum: 1 },
          lastUpdated: { $max: "$updatedAt" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return res.status(200).json({
      destinations: rows.map((row) => ({ destination: row._id, count: row.count, lastUpdated: row.lastUpdated })),
    });
  } catch (error) {
    next(error);
  }
};

// Imports one or more city business-listing workbooks (.xlsx/.xlsm), scoring
// every business and replacing that destination's listings wholesale — the
// UI equivalent of scripts/importDestinationListings.js, run per uploaded file.
const bulkImportDestinationListings = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: "Upload at least one .xlsx/.xlsm file." });
    // Set when the caller already knows the destination (e.g. picked from a
    // dropdown on the Add New / Reupload tabs) — overrides the filename guess.
    const destinationOverride = String(req.body.destination || "").trim();

    const results = [];
    for (const file of files) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        const parsed = parseDestinationRawData(workbook, file.originalname);
        const destination = destinationOverride || parsed.destination;

        const byCategory = {};
        parsed.businesses.forEach((b) => {
          byCategory[b.category] = byCategory[b.category] || [];
          byCategory[b.category].push(b);
        });

        const docs = parsed.businesses.map((b) => {
          const scored = scoreListing(b, byCategory[b.category]);
          return {
            destination,
            category: b.category,
            businessName: b.businessName,
            website: b.website,
            address: b.address,
            about: b.about,
            googleMapUrl: b.googleMapUrl,
            rating: b.rating,
            totalReviews: b.totalReviews,
            inclusion: b.inclusion,
            hasWebsite: b.hasWebsite,
            hasInstagram: b.hasInstagram,
            hasFacebook: b.hasFacebook,
            nearAirport: b.nearAirport,
            airportName: b.airportName,
            airportMapUrl: b.airportMapUrl,
            email: b.email,
            contact: b.contact,
            linkedin: b.linkedin,
            businessStatus: "Active",
            scoring: {
              needScore: scored.need.score,
              categoryFitScore: scored.categoryFit.score,
              businessActivityScore: scored.activity.score,
              finalScore: scored.finalScore,
              priority: scored.priority,
              digitalGaps: scored.digitalGaps,
              recommendedPitch: scored.recommendedPitch,
            },
          };
        });

        const deleted = await WonoDestinationListing.deleteMany({ destination });
        const inserted = await WonoDestinationListing.insertMany(docs);

        results.push({
          filename: file.originalname,
          success: true,
          destination,
          removed: deleted.deletedCount,
          imported: inserted.length,
          warnings: parsed.warnings,
        });
      } catch (fileError) {
        results.push({ filename: file.originalname, success: false, error: fileError.message });
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDestinationListingSummary,
  getDestinationListings,
  updateDestinationListingInfo,
  bulkImportDestinationListings,
  getUploadedDestinations,
};
