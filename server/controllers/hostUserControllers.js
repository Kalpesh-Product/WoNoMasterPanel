const HostCompany = require("../models/hostCompany/hostCompany");
const HostUser = require("../models/hostCompany/hostUser");

const bulkInsertPoc = async (req, res, next) => {
  try {
    const { pocs } = req.body;
    console.log("POCs received:", Array.isArray(pocs) ? pocs.length : 0);

    if (!Array.isArray(pocs) || pocs.length === 0) {
      return res.status(400).json({
        message: "Please provide a valid array of POCs",
        receivedType: typeof pocs,
        receivedValue: pocs,
      });
    }

    // Fetch companies and map them
    const companies = await HostCompany.find().lean();
    console.log("Found companies:", companies.length);

    const companyMap = new Map(
      companies.map((item) => [item.companyId?.trim(), item._id])
    );

    const validPocs = [];
    const skippedNoCompanyLogs = [];

    for (const poc of pocs) {
      const companyId = poc.companyId?.trim();
      const pocName = poc.name?.trim() || "";

      if (!companyId) {
        skippedNoCompanyLogs.push({
          name: pocName,
          reason: "Missing companyId",
        });
        continue;
      }

      const companyMongoId = companyMap.get(companyId);
      if (!companyMongoId) {
        skippedNoCompanyLogs.push({
          name: pocName,
          companyId,
          reason: "No matching HostCompany found",
        });
        continue;
      }

      validPocs.push({
        company: companyMongoId,
        companyId,
        name: pocName,
        designation: poc.designation || "",
        email: poc.email?.toLowerCase() || "",
        phone: poc.phone || "",
        linkedInProfile: poc.linkedInProfile || "",
        languagesSpoken: poc.languagesSpoken || [],
        address: poc.address || "",
        profileImage: poc.profileImage || "",
        isActive: true,
      });
    }

    // Log skipped for debugging
    if (skippedNoCompanyLogs.length) {
      console.log("\n=== SKIPPED POCs (NO COMPANY FOUND) ===");
      console.table(skippedNoCompanyLogs);
    }

    if (validPocs.length === 0) {
      return res.status(400).json({
        message: "No valid POC data found (all missing company references).",
        skippedNoCompany: skippedNoCompanyLogs.length,
        skippedNoCompanyLogs,
      });
    }

    console.log("Inserting POCs into HostUser...");
    const inserted = await HostUser.insertMany(validPocs);
    console.log(`Inserted ${inserted.length} POCs successfully.`);

    res.status(201).json({
      message: `${inserted.length} POCs inserted successfully.`,
      inserted: inserted.length,
      skippedNoCompany: skippedNoCompanyLogs.length,
      skippedNoCompanyLogs,
    });
  } catch (error) {
    console.error("Master panel bulkInsertPoc error:", error);
    next(error);
  }
};

module.exports = { bulkInsertPoc };
