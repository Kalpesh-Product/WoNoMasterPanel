const { default: axios } = require("axios");
const Employee = require("../../models/hostCompany/employees");
const HostCompany = require("../../models/hostCompany/hostCompany");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const TestCompany = require("../../models/hostCompany/testCompany");

const createCompany = async (req, res, next) => {
  try {
    const payload = req.body;

    const lastCompany = await HostCompany.findOne()
      .sort({ createdAt: -1 })
      .lean();
    let newIdNumber = 1;

    if (lastCompany && lastCompany?.companyId) {
      const lastNumber = parseInt(lastCompany.companyId.replace("CMP", ""), 10);
      newIdNumber = lastNumber + 1;
    }

    const companyId = `CMP${String(newIdNumber).padStart(4, "0")}`;

    const formatCompanyName = (name) => {
      if (!name) return "";
      return name.toLowerCase().split("-")[0].replace(/\s+/g, "");
    };

    const searchKey = formatCompanyName(req.body.companyName);

    const isWebsiteTemplate = await WebsiteTemplate.findOne({ searchKey });

    const companyData = {
      companyId,
      companyName: payload.companyName,
      industry: payload.industry,
      companySize: payload.companySize,
      companyCity: payload.companyCity,
      companyState: payload.companyState,
      companyCountry: payload.companyCountry,
      websiteLink: payload.websiteURL,
      linkedinURL: payload.linkedinURL,
      selectedServices: payload.selectedServices || [],
      isRegistered: true,
      isWebsiteTemplate: isWebsiteTemplate ? true : false,
    };

    //Store company data in company collection (master panel)
    const newCompany = new HostCompany(companyData);
    const savedCompany = await newCompany.save();

    //Store employee in employee collection (master panel)

    const employee = await Employee.findOne({ email: payload.email });

    if (employee) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newEmployee = new Employee({
      name: payload.pocName,
      email: payload?.pocEmail,
      phone: payload?.pocPhone,
      linkedInProfile: payload?.pocLinkedInProfile,
      languages: payload?.pocLanguages || [],
      address: payload?.pocAddress,
      profileImage: payload?.pocProfileImage,
      designation: payload?.pocDesignation,
      isActive: payload?.isActive ?? true,
      company: savedCompany._id,
    });

    await newEmployee.save();

    //Store POC data in poc collection (nomads)
    await axios.post("https://wononomadsbe.vercel.app/api/poc/create-poc", {
      companyId: companyId,
      name: payload?.pocName,
      designation: payload?.pocDesignation,
      email: payload?.pocEmail,
      phone: payload?.pocPhone,
      linkedInProfile: payload?.pocLinkedInProfile,
      languages: payload?.pocLanguages || [],
      address: payload?.pocAddress,
      profileImage: payload?.pocProfileImage,
      isActive: payload?.isActive ?? true,
      availibilityTime: payload?.pocAvailabilityTime,
    });

    return res.status(201).json({
      message: "Company created successfully",
    });
  } catch (error) {
    next(error);
  }
};

const serviceOptions = [
  {
    items: [
      "Tickets",
      "Meetings",
      "Tasks",
      "Performance",
      "Visitors",
      "Assets",
    ],
  },
  {
    items: ["Finance", "Sales", "HR", "Admin", "Maintenance", "IT"],
  },
];

const validApps = new Set(serviceOptions[0].items);
const validModules = new Set(serviceOptions[1].items);

const updateServices = async (req, res, next) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const company = await HostCompany.findOne({ companyId });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // 🔹 Always flip isActive = true wherever isRequested = true
    company.selectedServices.apps.forEach((app) => {
      if (app.isRequested) {
        app.isActive = true;
      }
    });

    company.selectedServices.modules.forEach((mod) => {
      if (mod.isRequested) {
        mod.isActive = true;
      }
    });

    company.selectedServices.defaults.forEach((def) => {
      if (def.isRequested) {
        def.isActive = true;
      }
    });

    const updatedCompany = await company.save();

    return res.status(200).json({
      message: "Requested services activated successfully",
      company: updatedCompany,
    });
  } catch (error) {
    next(error);
  }
};

const activateProduct = async (req, res, next) => {
  try {
    const { businessId, status } = req.body;

    if (!businessId) {
      return res.status(400).json({
        message: "Business Id missing",
      });
    }

    if (typeof status !== "boolean") {
      return res.status(400).json({
        message: "Status must be true/false",
      });
    }

    const response = await axios.patch(
      "https://wononomadsbe.vercel.app/api/company/activate-product",
      {
        businessId,
        status,
      }
    );

    if (response.status !== 200) {
      return res.status(400).json({ message: "Failed to activate product" });
    }

    const activeStatus = status ? "activated" : "inactivated";
    return res
      .status(200)
      .json({ message: `Product ${activeStatus} successfully` });
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const companies = await HostCompany.find();

    if (!companies || !companies.length) {
      return res.status(200).json([]);
    }

    return res.status(200).json(companies);
  } catch (error) {
    next(error);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    const company = await HostCompany.findOne({ companyId: companyId });

    if (!company) {
      return res.status(200).json([]);
    }

    return res.status(200).json(company);
  } catch (error) {
    next(error);
  }
};

// async function checkCompanyIds() {
//   try {
//     // 1️⃣ Count total documents
//     const totalCount = await HostCompany.countDocuments();

//     // 2️⃣ Find the max companyId
//     const maxCompany = await HostCompany.findOne()
//       .sort({ companyId: -1 })
//       .select("companyId companyName");

//     // 3️⃣ Check for duplicate companyIds
//     const duplicates = await HostCompany.aggregate([
//       { $group: { _id: "$companyId", count: { $sum: 1 } } },
//       { $match: { count: { $gt: 1 } } },
//     ]);

//     console.log("Total documents:", totalCount);
//     console.log("Highest companyId:", maxCompany?.companyId);
//     console.log("Company name with max ID:", maxCompany?.companyName);

//     if (duplicates.length > 0) {
//       console.log("\n⚠️ Found duplicate companyIds:");
//       duplicates.forEach((dup) => {
//         console.log(`- companyId: ${dup._id}, count: ${dup.count}`);
//       });
//     } else {
//       console.log("\n✅ No duplicate companyIds found");
//     }

//     // 🔹 Check for missing IDs with CMP prefix
//     const allIds = await HostCompany.find({}, "companyId").sort({
//       companyId: 1,
//     });
//     const numericIds = allIds.map((doc) =>
//       parseInt(doc.companyId.replace("CMP", ""), 10)
//     );

//     const missingIds = [];
//     const maxNumericId = Math.max(...numericIds);

//     for (let i = 1; i <= maxNumericId; i++) {
//       if (!numericIds.includes(i)) {
//         // re-add CMP prefix and zero-padding
//         missingIds.push(`CMP${i.toString().padStart(4, "0")}`);
//       }
//     }

//     if (missingIds.length) {
//       console.log("\n⚠️ Missing companyIds:", missingIds);
//     } else {
//       console.log("\n✅ No missing companyIds — sequence is continuous");
//     }

//     // await mongoose.disconnect();
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//   }
// }

// checkCompanyIds();

const bulkInsertCompanies = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ message: "Please provide a valid CSV file" });
    }

    const companies = [];

    const lastCompany = await HostCompany.findOne()
      .sort({ companyId: -1 }) // sort descending
      .select("companyId");

    // 2️⃣ Extract numeric part of the last ID
    let newId = 1;
    if (lastCompany && lastCompany.companyId) {
      const numericPart = parseInt(
        lastCompany.companyId.replace("CMP", ""),
        10
      );
      newId = numericPart + 1;
    }

    const stream = Readable.from(file.buffer.toString("utf-8").trim());
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        const companyId = `CMP${String(newId).padStart(4, "0")}`;
        const company = {
          companyName: row["Business Name"]?.trim(),
          companyId,
          registeredEntityName: row["Registered Entity Name"]?.trim(),
          websiteLink: row["Website"]?.trim(),
          address: row["Address"]?.trim(),
          companyCity: row["City"]?.trim(),
          companyState: row["State"]?.trim(),
          companyCountry: row["Country"]?.trim(),
          industry: row["Services"]?.trim(),
          companySize: row["Total Seats"]?.trim(),
          type: row["Type"]?.trim(),
        };
        newId++;
        companies.push(company);
      })
      .on("end", async () => {
        try {
          const seenCompanies = new Map(); // companyName -> set of types
          const uniqueCompanies = [];

          for (const company of companies) {
            if (!company.companyName || !company.type) continue;

            const name = company.companyName.toLowerCase();
            const type = company.type.toLowerCase();

            if (!seenCompanies.has(name)) {
              // first time seeing this company
              seenCompanies.set(name, new Set([type]));
              uniqueCompanies.push(company);
            } else {
              const types = seenCompanies.get(name);

              if (types.has(type)) {
                // same type -> allow duplicate
                uniqueCompanies.push(company);
              } else {
                // different type already exists → skip this one
                continue;
              }
            }
          }

          const result = await HostCompany.insertMany(uniqueCompanies);

          const insertedCount = result.length;
          const failedCount = companies.length - insertedCount;

          res.status(200).json({
            message:
              failedCount > 0
                ? "Bulk insert completed with partial failure"
                : "Bulk insert completed",
            total: companies.length,
            inserted: insertedCount,
            failed: failedCount,
          });
        } catch (insertError) {
          if (insertError.name === "BulkWriteError") {
            const insertedCount = insertError.result?.nInserted || 0;
            const failedCount = companies.length - insertedCount;

            res.status(200).json({
              message: "Bulk insert completed with partial failure",
              total: companies.length,
              inserted: insertedCount,
              failed: failedCount,
              writeErrors: insertError.writeErrors?.map((e) => ({
                index: e.index,
                errmsg: e.errmsg,
                code: e.code,
                op: e.op,
              })),
            });
          } else {
            res.status(500).json({
              message: "Unexpected error during bulk insert",
              error: insertError.message,
            });
          }
        }
      });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

const bulkInsertLogos = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ message: "Please provide a valid CSV file" });
    }

    const companies = [];

    //fetch companies from master panel
    const productCompanies = await axios.get(
      "https://wononomadsbe.vercel.app/api/company/companies"
    );

    const companyMap = new Map();
    productCompanies.data.forEach((company) => {
      companyMap.set(company.businessId, company.logo);
    });

    const stream = Readable.from(file.buffer.toString("utf-8").trim());
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        const businessId = row["Business ID"]?.trim();

        const company = {
          companyName: row["Business Name"]?.trim(),
          logo: companyMap.get(businessId) || "",
        };
        companies.push(company);
      })
      .on("end", async () => {
        try {
          const operations = companies.map((company) => ({
            updateOne: {
              filter: { companyName: company.companyName },
              update: { $set: { logo: company.logo } },
            },
          }));

          const result = await TestCompany.bulkWrite(operations);

          const updatedCount = result.length;
          const failedCount = companies.length - updatedCount;

          res.status(200).json({
            message:
              failedCount > 0
                ? "Bulk update completed with partial failure"
                : "Bulk update completed",
            total: companies.length,
            inserted: updatedCount,
            failed: failedCount,
          });
        } catch (insertError) {
          if (insertError.name === "BulkWriteError") {
            const updatedCount = insertError.result?.nInserted || 0;
            const failedCount = companies.length - updatedCount;

            res.status(200).json({
              message: "Bulk update completed with partial failure",
              total: companies.length,
              updated: updatedCount,
              failed: failedCount,
              writeErrors: insertError.writeErrors?.map((e) => ({
                index: e.index,
                errmsg: e.errmsg,
                code: e.code,
                op: e.op,
              })),
            });
          } else {
            res.status(500).json({
              message: "Unexpected error during bulk insert",
              error: insertError.message,
            });
          }
        }
      });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports = {
  createCompany,
  activateProduct,
  updateServices,
  getCompanies,
  getCompany,
  bulkInsertCompanies,
  bulkInsertLogos,
};
