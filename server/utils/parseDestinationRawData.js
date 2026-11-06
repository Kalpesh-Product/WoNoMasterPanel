// Parses a destination's raw business-listing workbook into plain business
// objects ready for server/utils/destinationListingScoring.js.
//
// The data team's workbooks aren't perfectly uniform — sheet name, column
// order, and a couple of header spellings vary file to file (confirmed by
// inspecting the real "Final_ Rawdata_Sheets" batch) — so columns are read
// by matching header text (case/whitespace-insensitive, with aliases),
// never by fixed index.

const { normalizeCategory } = require("./destinationListingScoring");

const VALID_CATEGORIES = new Set([
  "Coworking",
  "Coliving",
  "Cafe",
  "Hostel",
  "Meeting Room",
]);

const HEADER_ALIASES = {
  continent: ["continent"],
  country: ["country"],
  state: ["state"],
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

const COLUMN_WARNINGS = {
  website: 'No "Website" column — website links were left blank.',
  about: 'No "About"/"Description" column — category-fit text scoring may be lower.',
  rating: 'No "Rating" column — ratings defaulted to 0.',
  totalReviews: 'No "Total Reviews" column — review counts defaulted to 0.',
  inclusion: 'No "Inclusion" column — inclusion details were left blank.',
  hasWebsite: 'No "Website (Yes/No)" column — businesses were treated as missing a website.',
  hasInstagram: 'No "Instagram (Yes/No)" column — businesses were treated as missing Instagram.',
  hasFacebook: 'No "Facebook (Yes/No)" column — businesses were treated as missing Facebook.',
  nearAirport: 'No "Near to Airport" column — businesses were treated as not near an airport.',
  contact: 'No "Contact" column — contact values were left blank.',
  email: 'No "Email" column — email values were left blank.',
  linkedin: 'No "LinkedIn" column — LinkedIn values were left blank.',
  googleMapUrl: 'No "Google Map" column — map links were left blank.',
  airportName: 'No "Airport Name" column — airport names were left blank.',
  airportMapUrl: 'No "Airport Map Link" column — airport map links were left blank.',
  state: 'No "State" column — state values were left blank.',
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizeLocation = (value) => String(value || "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

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
const cellNum = (row, col) => (col ? Number(rawCellValue(row, col)) || 0 : 0);

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

// Browsers occasionally hand us a filename that's still percent-encoded
// (e.g. "Ho%20Chi%20Minh%20City_Analytics.xlsx") rather than the real
// characters — decode it defensively before cleaning it up.
const decodeIfEncoded = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const destinationFromFilename = (filename) => decodeIfEncoded(String(filename || ""))
  .replace(/\.(xlsx|xlsm)$/i, "")
  .replace(/^linked[_\s-]*wono[_\s-]*/i, "")
  .replace(/[_\s-]*analytics(?:[_\s-]*\d+(?:\.\d+)*)?$/i, "")
  .replace(/_/g, " ")
  .trim();

const workbookMatchesDestination = (parsed, selectedDestination) => {
  const selectedKey = normalizeLocation(selectedDestination);
  if (!selectedKey) return true;

  const filenameMatches = normalizeLocation(parsed?.destination) === selectedKey;
  const cityKey = normalizeLocation(parsed?.cityFromData);
  return filenameMatches || (Boolean(cityKey) && cityKey === selectedKey);
};

// Returns destination metadata, valid businesses, row failures, and warnings or
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
  const failures = [];
  const cities = [];
  const countries = [];
  const continents = [];
  let totalRows = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    totalRows += 1;

    const rawCategory = cellStr(row, columns.category);
    const category = normalizeCategory(rawCategory);
    const businessName = cellStr(row, columns.businessName);
    const issues = [];

    if (!rawCategory) {
      issues.push({
        column: "Type / Category",
        value: "Blank",
        reason: 'Missing "Type"/"Category" value.',
      });
    } else if (!VALID_CATEGORIES.has(category)) {
      issues.push({
        column: "Type / Category",
        value: rawCategory,
        reason: `Unsupported category "${rawCategory}".`,
      });
    }
    if (!businessName) {
      issues.push({
        column: "Business Name",
        value: "Blank",
        reason: 'Missing "Business Name" value.',
      });
    }

    if (issues.length) {
      failures.push({
        row: rowNumber,
        businessName: businessName || "—",
        category: rawCategory || "—",
        column: issues.map((issue) => issue.column).join(", "),
        value: issues.map((issue) => `${issue.column}: ${issue.value}`).join(" · "),
        reason: issues.map((issue) => issue.reason).join(" "),
      });
      return;
    }

    if (columns.city) cities.push(cellStr(row, columns.city));
    if (columns.country) countries.push(cellStr(row, columns.country));
    if (columns.continent) continents.push(cellStr(row, columns.continent));

    businesses.push({
      category,
      businessName,
      continent: cellStr(row, columns.continent),
      country: cellStr(row, columns.country),
      state: cellStr(row, columns.state),
      city: cellStr(row, columns.city),
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

  const warnings = [];
  Object.entries(COLUMN_WARNINGS).forEach(([field, warning]) => {
    if (!columns[field]) warnings.push(warning);
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
    cityFromData,
    businesses,
    totalRows,
    failures,
    warnings,
  };
};

module.exports = {
  parseDestinationRawData,
  destinationFromFilename,
  workbookMatchesDestination,
};
