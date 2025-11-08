const HostCompany = require("../models/hostCompany/hostCompany");
const HostUser = require("../models/hostCompany/hostUser");

const bulkInsertPoc = async (req, res, next) => {
  try {
    const { pocs } = req.body;
    // console.log("POCs received:", pocs?.length || 0);

    if (!pocs || !Array.isArray(pocs) || pocs.length === 0) {
      return res.status(400).json({
        message: "Please provide a valid array of POCs",
        receivedType: typeof pocs,
        receivedValue: pocs,
      });
    }

    // Fetch companies and map them
    const companies = await HostCompany.find().lean();
    // console.log("Found companies:", companies.length);

    const companyMap = new Map(
      companies.map((item) => [item.companyId?.trim(), item._id])
    );

    // Existing POCs for duplicate detection
    const existingPocs = await HostUser.find().select("name companyId");
    const existingPocSet = new Set(
      existingPocs.map(
        (poc) =>
          `${(poc.name || "").trim().toLowerCase()}|${poc.companyId?.trim()}`
      )
    );

    const validPocs = [];
    const seenInRequest = new Set();
    let skippedExisting = 0;
    let skippedDuplicate = 0;
    let skippedNoCompany = 0;

    for (const poc of pocs) {
      const companyId = poc.companyId?.trim();
      const pocName = poc.name?.trim() || ""; // allow empty string

      if (!companyId) {
        console.warn("❌ Skipping POC - missing companyId:", poc);
        skippedNoCompany++;
        continue;
      }

      const companyMongoId = companyMap.get(companyId);
      if (!companyMongoId) {
        console.warn(`❌ No HostCompany found for companyId: ${companyId}`);
        skippedNoCompany++;
        continue;
      }

      const pocKey = `${pocName.toLowerCase()}|${companyId}`;

      if (existingPocSet.has(pocKey)) {
        skippedExisting++;
        continue;
      }

      if (seenInRequest.has(pocKey)) {
        skippedDuplicate++;
        continue;
      }

      const pocData = {
        company: companyMongoId,
        companyId,
        name: pocName, // empty string allowed
        designation: poc.designation || "",
        email: poc.email?.toLowerCase() || "",
        phone: poc.phone || "",
        linkedInProfile: poc.linkedInProfile || "",
        languagesSpoken: poc.languagesSpoken || [],
        address: poc.address || "",
        profileImage: poc.profileImage || "",
        isActive: true,
      };

      seenInRequest.add(pocKey);
      validPocs.push(pocData);
    }

    // console.log("✅ Valid POCs to insert:", validPocs.length);

    if (validPocs.length === 0) {
      return res.status(400).json({
        message: "No valid POC data found.",
        skippedExisting,
        skippedDuplicate,
        skippedNoCompany,
      });
    }

    await HostUser.insertMany(validPocs);

    res.status(201).json({
      message: `${validPocs.length} POCs inserted successfully.`,
      inserted: validPocs.length,
      skippedExisting,
      skippedDuplicate,
      skippedNoCompany,
    });
  } catch (error) {
    console.error("Master panel error:", error);
    next(error);
  }
};

module.exports = { bulkInsertPoc };
