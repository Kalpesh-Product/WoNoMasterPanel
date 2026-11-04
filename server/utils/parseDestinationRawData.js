// Parses a destination's raw business-listing workbook into plain business
// objects ready for server/utils/destinationListingScoring.js.
//
// The data team's workbooks aren't perfectly uniform — sheet name, column
// order, and a couple of header spellings vary file to file (confirmed by
// inspecting the real "Final_ Rawdata_Sheets" batch) — so columns are read
// by matching header text (case/whitespace-insensitive, with aliases),
// never by fixed index.

const { normalizeCategory } = require("./destinationListingScoring");

const HEADER_ALIASES = {
  continent: ["continent"],
  country: ["country"],
  city: ["city"],
  category: ["type", "category"],
  businessName: ["business name", "name"],
  website: ["website"],
  address: ["address"],
  about: ["about", "description"],
  googleMapUrl: ["google map", "google maps", "google map url"],
  rating: ["ratings", "rating"],
  totalReviews: ["total reviews", "reviews"],
  inclusion: ["inclusion", "inclusions"],
  hasWebsite: ["website (yes/no)", "website yes/no"],
  hasInstagram: ["instagram (yes/no)", "instagram yes/no"],
  hasFacebook: ["facebook (yes/no)", "facebook yes/no"],
  nearAirport: ["near to airport", "near airport", "near to airport (yes/no)", "near airport (yes/no)"],
  airportName: ["airport name", "nearest airport"],
  airportMapUrl: ["airport map link", "airport google map", "airport map"],
  contact: ["contact", "contact number", "phone"],
  email: ["email", "email id"],
  linkedin: ["linkedin"],
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const rawCellValue = (row, col) => {
  const v = row.getCell(col).value;
  if (v && typeof v === "object" && "hyperlink" in v) {
    const link = v.hyperlink || v.text || "";
    return String(link).replace(/^mailto:/i, "").replace(/^tel:/i, "");
  }
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return v;
};
const cellStr = (row, col) => {
  if (!col) return "";
  const v = rawCellValue(row, col);
  return v === null || v === undefined ? "" : String(v).trim();
};
const cellBool = (row, col) => cellStr(row, col).toLowerCase() === "yes";
const cellNum = (row, col) => Number(rawCellValue(row, col)) || 0;

// Picks the first sheet whose header row looks like a raw-data sheet
// (has a "Business Name" column) instead of relying on a fixed sheet name.
const findRawDataSheet = (workbook) => workbook.worksheets.find((sheet) => {
  const headerRow = sheet.getRow(1);
  for (let col = 1; col <= sheet.columnCount; col += 1) {
    if (normalizeHeader(headerRow.getCell(col).value) === "business name") return true;
  }
  return false;
});

const buildColumnMap = (headerRow, columnCount) => {
  const map = {};
  for (let col = 1; col <= columnCount; col += 1) {
    const header = normalizeHeader(headerRow.getCell(col).value);
    if (!header) continue;
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      if (!map[field] && aliases.includes(header)) map[field] = col;
    });
  }
  return map;
};

const mostCommon = (values) => {
  const counts = {};
  values.forEach((v) => { if (v) counts[v] = (counts[v] || 0) + 1; });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "";
};

const destinationFromFilename = (filename) => String(filename || "")
  .replace(/\.(xlsx|xlsm)$/i, "")
  .replace(/[_\s]*analytics$/i, "")
  .replace(/_/g, " ")
  .trim();

// Returns { destination, country, continent, businesses, warnings } or
// throws with a message naming what's missing, for the caller to report
// per file instead of failing the whole batch.
const parseDestinationRawData = (workbook, filename) => {
  const sheet = findRawDataSheet(workbook);
  if (!sheet) throw new Error('No sheet with a "Business Name" column found.');

  const columnCount = sheet.actualColumnCount || sheet.columnCount;
  const columns = buildColumnMap(sheet.getRow(1), columnCount);
  if (!columns.category || !columns.businessName) {
    throw new Error('Could not find "Type"/"Category" and "Business Name" columns.');
  }

  const businesses = [];
  const cities = [];
  const countries = [];
  const continents = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const category = normalizeCategory(cellStr(row, columns.category));
    const businessName = cellStr(row, columns.businessName);
    if (!category || !businessName) return;

    if (columns.city) cities.push(cellStr(row, columns.city));
    if (columns.country) countries.push(cellStr(row, columns.country));
    if (columns.continent) continents.push(cellStr(row, columns.continent));

    businesses.push({
      category,
      businessName,
      website: cellStr(row, columns.website),
      address: cellStr(row, columns.address),
      about: cellStr(row, columns.about),
      googleMapUrl: cellStr(row, columns.googleMapUrl),
      rating: cellNum(row, columns.rating),
      totalReviews: cellNum(row, columns.totalReviews),
      inclusion: cellStr(row, columns.inclusion),
      hasWebsite: cellBool(row, columns.hasWebsite),
      hasInstagram: cellBool(row, columns.hasInstagram),
      hasFacebook: cellBool(row, columns.hasFacebook),
      nearAirport: cellBool(row, columns.nearAirport),
      airportName: cellStr(row, columns.airportName),
      airportMapUrl: cellStr(row, columns.airportMapUrl),
      contact: cellStr(row, columns.contact),
      email: cellStr(row, columns.email),
      linkedin: cellStr(row, columns.linkedin),
    });
  });

  if (!businesses.length) throw new Error("No business rows found under the header row.");

  const warnings = [];
  ["contact", "email", "linkedin", "googleMapUrl", "airportName", "airportMapUrl"].forEach((field) => {
    if (!columns[field]) warnings.push(`No "${field}" column — left blank for every business.`);
  });

  // The filename is the reliable destination name (it's what the data team names
  // the file after); the "City" column can instead hold a sub-area — e.g. Bali's
  // sheet lists "Kuta", "Canggu", etc., not "Bali" — so it's only a cross-check.
  const destination = destinationFromFilename(filename);
  const cityFromData = mostCommon(cities);
  if (cityFromData && normalizeHeader(cityFromData) !== normalizeHeader(destination)) {
    warnings.push(`"City" column mostly says "${cityFromData}", not "${destination}" — used the filename as the destination name.`);
  }

  return {
    destination,
    country: mostCommon(countries),
    continent: mostCommon(continents),
    businesses,
    warnings,
  };
};

module.exports = { parseDestinationRawData, destinationFromFilename };
