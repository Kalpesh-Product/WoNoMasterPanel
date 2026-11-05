// Dry-run check: parses every workbook in a folder with
// utils/parseDestinationRawData.js + scores every business with
// utils/destinationListingScoring.js, but writes nothing to the DB.
// Prints a one-line summary per file plus any warnings, so format quirks
// surface before the real bulk-import endpoint touches the database.
//
// Usage: node scripts/dryRunBulkImport.js "<folder of .xlsx/.xlsm files>"

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { parseDestinationRawData } = require("../utils/parseDestinationRawData");
const { scoreListing } = require("../utils/destinationListingScoring");

const folder = process.argv[2];
if (!folder) throw new Error('Usage: node dryRunBulkImport.js "<folder>"');

const run = async () => {
  const files = fs.readdirSync(folder).filter((f) => /\.(xlsx|xlsm)$/i.test(f));
  console.log(`Found ${files.length} workbook(s).\n`);

  for (const file of files) {
    const filePath = path.join(folder, file);
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const parsed = parseDestinationRawData(workbook, file);

      const byCategory = {};
      parsed.businesses.forEach((b) => {
        byCategory[b.category] = byCategory[b.category] || [];
        byCategory[b.category].push(b);
      });
      const scored = parsed.businesses.map((b) => scoreListing(b, byCategory[b.category]));
      const priorityCounts = scored.reduce((acc, s) => {
        acc[s.priority] = (acc[s.priority] || 0) + 1;
        return acc;
      }, {});

      console.log(`OK   ${file}`);
      console.log(`     destination="${parsed.destination}" country="${parsed.country}" continent="${parsed.continent}"`);
      console.log(`     businesses=${parsed.businesses.length} priorities=${JSON.stringify(priorityCounts)}`);
      if (parsed.warnings.length) parsed.warnings.forEach((w) => console.log(`     warn: ${w}`));
    } catch (error) {
      console.log(`FAIL ${file}`);
      console.log(`     ${error.message}`);
    }
    console.log("");
  }
};

run();
