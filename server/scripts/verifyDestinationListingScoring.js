// One-off verification: recompute every business in the Dubai workbook with our
// own scoring engine and diff against the workbook's own stored values.
// Run: node scripts/verifyDestinationListingScoring.js

const path = require("path");
const ExcelJS = require("exceljs");
const { scoreListing } = require("../utils/destinationListingScoring");

const FILE = path.join(
  "C:\\Users\\BIZNest IT\\Documents\\Destination Data Sheets - Savita\\Destination Analytics\\Final Dashboards",
  "Linked_WoNo_Dubai_Analytics_2.0.xlsm",
);

const rawCellValue = (row, col) => {
  const v = row.getCell(col).value;
  if (v && typeof v === "object" && "hyperlink" in v) return (v.hyperlink || v.text || "").replace(/^mailto:/i, "").replace(/^tel:/i, "");
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return v;
};
const cellStr = (row, col) => {
  const v = rawCellValue(row, col);
  if (v === null || v === undefined) return "";
  return String(v).trim();
};
const cellBool = (row, col) => cellStr(row, col).toLowerCase() === "yes";
const cellNum = (row, col) => Number(rawCellValue(row, col)) || 0;

const run = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FILE);

  const rawSheet = workbook.getWorksheet("Raw Data");
  const scoredSheet = workbook.getWorksheet("Raw Data + Scoring Logic Weight");

  const businesses = [];
  // Raw Data columns: A SrNo, B Continent, C Country, D State, E City, F Type,
  // G Name, H Website URL, I Address, J About, K GoogleMap, L Rating, M Reviews,
  // N Inclusion, O WebsiteYN, P InstagramYN, Q FacebookYN, R NearAirport.
  rawSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const type = cellStr(row, 6);
    if (!type) return;
    businesses.push({
      rowNumber,
      srNo: cellNum(row, 1),
      category: type,
      name: cellStr(row, 7),
      about: cellStr(row, 10),
      inclusion: cellStr(row, 14),
      rating: cellNum(row, 12),
      totalReviews: cellNum(row, 13),
      hasWebsite: cellBool(row, 15),
      hasInstagram: cellBool(row, 16),
      hasFacebook: cellBool(row, 17),
    });
  });

  console.log(`Loaded ${businesses.length} businesses from Raw Data`);

  const byCategory = {};
  businesses.forEach((b) => {
    byCategory[b.category] = byCategory[b.category] || [];
    byCategory[b.category].push(b);
  });

  const EPS = 0.05;
  let mismatches = 0;
  let checked = 0;

  businesses.forEach((b) => {
    const computed = scoreListing(b, byCategory[b.category]);

    // Expected values from the scored sheet — same row number (srNo+1 header offset).
    const scoredRow = scoredSheet.getRow(b.srNo + 1);
    const expected = {
      need: cellNum(scoredRow, 27), // AA
      categoryFit: cellNum(scoredRow, 46), // AT
      activity: cellNum(scoredRow, 49), // AW
      finalScore: cellNum(scoredRow, 50), // AX
      priority: cellStr(scoredRow, 51), // AY
      digitalGaps: cellNum(scoredRow, 22), // V
      pitch: cellStr(scoredRow, 52), // AZ
    };

    checked += 1;
    const diffs = [];
    if (Math.abs(computed.need.score - expected.need) > EPS) diffs.push(`need ${computed.need.score} vs ${expected.need}`);
    if (Math.abs((computed.categoryFit.score || 0) - expected.categoryFit) > EPS) diffs.push(`categoryFit ${computed.categoryFit.score} vs ${expected.categoryFit}`);
    if (Math.abs(computed.activity.score - expected.activity) > EPS) diffs.push(`activity ${computed.activity.score} vs ${expected.activity}`);
    if (Math.abs(computed.finalScore - expected.finalScore) > EPS) diffs.push(`final ${computed.finalScore} vs ${expected.finalScore}`);
    if (computed.priority !== expected.priority) diffs.push(`priority ${computed.priority} vs ${expected.priority}`);
    if (computed.digitalGaps !== expected.digitalGaps) diffs.push(`digitalGaps ${computed.digitalGaps} vs ${expected.digitalGaps}`);
    if (computed.recommendedPitch !== expected.pitch) diffs.push(`pitch "${computed.recommendedPitch}" vs "${expected.pitch}"`);

    if (diffs.length) {
      mismatches += 1;
      console.log(`MISMATCH row ${b.srNo} (${b.category} / ${b.name}): ${diffs.join(" | ")}`);
    }
  });

  console.log(`\nChecked ${checked} rows, ${mismatches} mismatches, ${checked - mismatches} exact matches.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
