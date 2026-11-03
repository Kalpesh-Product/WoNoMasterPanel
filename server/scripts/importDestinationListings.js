// Imports one city's business listings from its "Linked_WoNo_<City>_Analytics_2.0.xlsm"
// workbook's "Raw Data" sheet, scores every business with our own scoring engine
// (server/utils/destinationListingScoring.js — verified to match the workbook's own
// numbers), and stores the result in the WonoDestinationListing collection.
//
// Usage: node scripts/importDestinationListings.js "<path to .xlsm>" "<Destination Name>"

require("dotenv").config();

const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const connectDb = require("../config/db");
const WonoDestinationListing = require("../models/WonoDestinationListing");
const { scoreListing, normalizeCategory } = require("../utils/destinationListingScoring");

const filePath = process.argv[2];
const destination = process.argv[3];
if (!filePath || !destination) {
  throw new Error('Usage: node importDestinationListings.js "<path to .xlsm>" "<Destination Name>"');
}

const rawCellValue = (row, col) => {
  const v = row.getCell(col).value;
  if (v && typeof v === "object" && "hyperlink" in v) {
    const link = v.hyperlink || v.text || "";
    return link.replace(/^mailto:/i, "").replace(/^tel:/i, "");
  }
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return v;
};
const cellStr = (row, col) => {
  const v = rawCellValue(row, col);
  return v === null || v === undefined ? "" : String(v).trim();
};
const cellBool = (row, col) => cellStr(row, col).toLowerCase() === "yes";
const cellNum = (row, col) => Number(rawCellValue(row, col)) || 0;

const run = async () => {
  await connectDb(process.env.DB_URL);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const rawSheet = workbook.getWorksheet("Raw Data");
  if (!rawSheet) throw new Error('No "Raw Data" sheet found in that workbook.');

  const businesses = [];
  rawSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const category = normalizeCategory(cellStr(row, 6));
    const businessName = cellStr(row, 7);
    if (!category || !businessName) return;
    businesses.push({
      category,
      businessName,
      website: cellStr(row, 8),
      address: cellStr(row, 9),
      about: cellStr(row, 10),
      googleMapUrl: cellStr(row, 11),
      rating: cellNum(row, 12),
      totalReviews: cellNum(row, 13),
      inclusion: cellStr(row, 14),
      hasWebsite: cellBool(row, 15),
      hasInstagram: cellBool(row, 16),
      hasFacebook: cellBool(row, 17),
      nearAirport: cellBool(row, 18),
      contact: cellStr(row, 19),
      email: cellStr(row, 20),
      linkedin: cellStr(row, 21),
    });
  });

  const byCategory = {};
  businesses.forEach((b) => {
    byCategory[b.category] = byCategory[b.category] || [];
    byCategory[b.category].push(b);
  });

  const docs = businesses.map((b) => {
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

  // Replace this destination's listings wholesale so re-imports stay clean.
  const deleted = await WonoDestinationListing.deleteMany({ destination });
  const inserted = await WonoDestinationListing.insertMany(docs);
  console.log(`Destination: ${destination}`);
  console.log(`Removed ${deleted.deletedCount} existing listings, inserted ${inserted.length}.`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
