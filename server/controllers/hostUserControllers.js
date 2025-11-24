const HostCompany = require("../models/hostCompany/hostCompany");
const HostUser = require("../models/hostCompany/hostUser");
const TestHostUser = require("../models/hostCompany/TestHostUser");

//Duplicate & existing pocs check
//Currently can't implement coz diff company types of same company can have same POC and company type isn't stored in Master Panel

// const bulkInsertPoc = async (req, res, next) => {
//   try {
//     const { pocs } = req.body;
//     console.log("POCs received:", Array.isArray(pocs) ? pocs.length : 0);

//     console.log("poc data", pocs);
//     if (!Array.isArray(pocs) || pocs.length === 0) {
//       return res.status(400).json({
//         message: "Please provide a valid array of POCs",
//         receivedType: typeof pocs,
//         receivedValue: pocs,
//       });
//     }

//     // Fetch companies
//     const companies = await HostCompany.find().lean();
//     const companyMap = new Map(
//       companies.map((item) => [item.companyId?.trim(), item._id])
//     );

//     // Fetch existing POCs (HostUser)
//     const existingPocs = await HostUser.find().select("email companyId").lean();

//     const existingPocSet = new Set(
//       existingPocs.map(
//         (p) => `${p.email?.trim().toLowerCase()}|${p.companyId?.trim()}`
//       )
//     );

//     const validPocs = [];
//     const missingCompanyRows = [];
//     const duplicateExistingLogs = [];
//     const duplicateCSVLogs = [];
//     const seenInCSV = new Set();

//     // Iterate through incoming POCs
//     for (const poc of pocs) {
//       const companyId = poc.companyId?.trim();
//       const pocName = poc.name?.trim() || "";
//       const email = poc.email?.trim()?.toLowerCase() || "";

//       if (!companyId) {
//         missingCompanyRows.push({
//           name: pocName,
//           email,
//           reason: "Missing companyId",
//         });
//         continue;
//       }

//       const companyMongoId = companyMap.get(companyId);
//       if (!companyMongoId) {
//         missingCompanyRows.push({
//           name: pocName,
//           email,
//           companyId,
//           reason: "No matching HostCompany found",
//         });
//         continue;
//       }

//       // Build duplicate key
//       const pocKey = `${email}|${companyId}`;

//       // Check if exists in DB
//       if (existingPocSet.has(pocKey)) {
//         duplicateExistingLogs.push({
//           name: pocName,
//           email,
//           companyId,
//           reason: "Already exists in database",
//         });
//         continue;
//       }

//       // Check if duplicate within request
//       if (seenInCSV.has(pocKey)) {
//         duplicateCSVLogs.push({
//           name: pocName,
//           email,
//           companyId,
//           reason: "Duplicate within request",
//         });
//         continue;
//       }

//       seenInCSV.add(pocKey);

//       validPocs.push({
//         company: companyMongoId,
//         companyId,
//         name: pocName,
//         designation: poc.designation || "",
//         email,
//         phone: poc.phone || "",
//         linkedInProfile: poc.linkedInProfile || "",
//         languagesSpoken: poc.languagesSpoken || [],
//         address: poc.address || "",
//         profileImage: poc.profileImage || "",
//         isActive: true,
//       });
//     }

//     // No valid entries left
//     if (validPocs.length === 0) {
//       return res.status(400).json({
//         message:
//           "No valid POC entries left after validation. Check duplicates or missing company references.",
//         missingCompanyCount: missingCompanyRows.length,
//         missingCompanyRows,
//         skippedExisting: duplicateExistingLogs.length,
//         duplicateExistingLogs,
//         skippedDuplicateInCSV: duplicateCSVLogs.length,
//         duplicateCSVLogs,
//       });
//     }

//     try {
//       const inserted = await HostUser.insertMany(validPocs, { ordered: false });

//       console.log("inserted", inserted.length);
//       console.log("pocs", pocs.length);
//       let failedDocs;
//       if (inserted.length !== pocs.length) {
//         console.log("=== FAILED DOCUMENTS DURING INSERT ===");

//         const successfulIds = new Set(
//           inserted.map((i) => i.email + "|" + i.companyId)
//         );

//         failedDocs = pocs.filter(
//           (doc) => !successfulIds.has(doc.email + "|" + doc.companyId)
//         );

//         console.table(failedDocs);
//       }

//       console.log({
//         totalIncoming: pocs.length,
//         validPocs: validPocs.length,
//         missingCompanyCount: missingCompanyRows.length,
//         missingCompany: missingCompanyRows,
//         duplicateExistingCount: duplicateExistingLogs.length,
//         duplicateExisting: duplicateExistingLogs,
//         duplicateCSVCount: duplicateCSVLogs.length,
//         duplicateCSV: duplicateCSVLogs,

//         sumLost:
//           missingCompanyRows.length +
//           duplicateExistingLogs.length +
//           duplicateCSVLogs.length,
//       });

//       return res.status(201).json({
//         message: `${inserted.length} POCs inserted successfully.`,
//         inserted: inserted.length,
//         failedInsertCount: validPocs.length - inserted.length,
//         failedInsertLogs: failedDocs,
//         missingCompanyCount: missingCompanyRows.length,
//         missingCompanyRows,
//         skippedExisting: duplicateExistingLogs.length,
//         duplicateExistingLogs,
//         skippedDuplicateInCSV: duplicateCSVLogs.length,
//         duplicateCSVLogs,
//       });
//     } catch (err) {
//       console.error("HostUser insert error:", err);
//       throw err;
//     }
//   } catch (error) {
//     console.error("Master panel bulkInsertPoc error:", error);
//     next(error);
//   }
// };

const bulkInsertPoc = async (req, res, next) => {
  try {
    const { pocs } = req.body;

    if (!Array.isArray(pocs) || pocs.length === 0) {
      return res.status(400).json({
        message: "Please provide a valid array of POCs",
        receivedType: typeof pocs,
        receivedValue: pocs,
      });
    }

    // Fetch companies
    const companies = await HostCompany.find().lean();
    const companyMap = new Map(
      companies.map((item) => [item.companyId?.trim(), item._id])
    );

    const missingCompanyRows = [];
    const finalPocs = [];

    for (const poc of pocs) {
      const companyId = poc.companyId?.trim();
      const companyMongoId = companyMap.get(companyId);

      if (!companyMongoId) {
        missingCompanyRows.push({
          name: poc.name?.trim(),
          email: poc.email?.trim(),
          companyId,
          reason: "No matching HostCompany found",
        });
        continue;
      }

      finalPocs.push({
        company: companyMongoId,
        companyId,
        name: poc.name?.trim() || "",
        designation: poc.designation || "",
        email: poc.email?.trim()?.toLowerCase() || "",
        phone: poc.phone || "",
        linkedInProfile: poc.linkedInProfile || "",
        languagesSpoken: poc.languagesSpoken || [],
        address: poc.address || "",
        profileImage: poc.profileImage || "",
        isActive: true,
      });
    }

    // Insert EVERYTHING that reached this line
    let inserted = [];
    let failedDocs = [];

    try {
      inserted = await TestHostUser.insertMany(finalPocs, { ordered: false });

      const successfulKeys = new Set(
        inserted.map((i) => `${i.email}|${i.companyId}`)
      );

      failedDocs = finalPocs.filter(
        (doc) => !successfulKeys.has(`${doc.email}|${doc.companyId}`)
      );
    } catch (err) {
      console.error("Insert error:", err);
      return res.status(500).json({
        message: "Insertion failed for some records.",
        error: err.message,
      });
    }

    return res.status(201).json({
      message: `${inserted.length} POCs inserted successfully.`,
      totalIncoming: pocs.length,
      attemptedInsert: finalPocs.length,
      inserted: inserted.length,
      failedInsertCount: failedDocs.length,
      failedInsertLogs: failedDocs,
      missingCompanyCount: missingCompanyRows.length,
      missingCompanyRows,
    });
  } catch (error) {
    console.error("bulkInsertPoc error:", error);
    next(error);
  }
};

module.exports = { bulkInsertPoc };
