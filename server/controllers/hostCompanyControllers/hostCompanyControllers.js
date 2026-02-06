const { default: axios } = require("axios");
const Employee = require("../../models/hostCompany/employees");
const HostCompany = require("../../models/hostCompany/hostCompany");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
// const { v4: uuidv4 } = require("uuid");
const { randomUUID } = require("crypto");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const TestCompany = require("../../models/hostCompany/testCompany");
const HostUser = require("../../models/hostCompany/hostUser");

const serviceOptions = [
  {
    items: [
      "tickets",
      "meetings",
      "tasks",
      "performance",
      "visitors",
      "assets",
    ],
  },
  {
    items: ["finance", "sales", "hr", "admin", "maintenance", "it"],
  },
  {
    items: ["websiteBuilder", "leadGeneration", "automatedGoogleSheets"],
  },
];

const validApps = new Set(serviceOptions[0].items);
const validModules = new Set(serviceOptions[1].items);
const validDefaults = new Set(serviceOptions[2].items);

const validateServices = (selectedServices = {}) => {
  const errors = [];

  const apps = selectedServices.apps || [];
  const modules = selectedServices.modules || [];
  const defaults = selectedServices.defaults || [];

  const invalidApps = apps.filter((a) => !validApps.has(a.appName));

  const invalidModules = modules.filter((m) => !validModules.has(m.moduleName));

  const invalidDefaults = defaults.filter((d) => !validDefaults.has(d.name));

  if (invalidApps.length) {
    errors.push({
      type: "apps",
      invalid: invalidApps.map((a) => a.appName),
    });
  }

  if (invalidModules.length) {
    errors.push({
      type: "modules",
      invalid: invalidModules.map((m) => m.moduleName),
    });
  }

  if (invalidDefaults.length) {
    errors.push({
      type: "defaults",
      invalid: invalidDefaults.map((d) => d.name),
    });
  }

  return errors;
};

const createCompany = async (req, res, next) => {
  try {
    const payload = req.body;

    const lastCompany = await HostCompany.findOne({
      companyName: payload.companyName,
    }).lean();

    if (lastCompany) {
      return res.status(400).json({ message: "Company already exists" });
    }

    // const companyId = `CMP${String(newIdNumber).padStart(4, "0")}`;

    const formatCompanyName = (name) => {
      if (!name) return "";
      return name.toLowerCase().split("-")[0].replace(/\s+/g, "");
    };

    const searchKey = formatCompanyName(req.body.companyName);

    const isWebsiteTemplate = await WebsiteTemplate.findOne({ searchKey });

    const validationErrors = validateServices(payload.selectedServices);

    if (validationErrors.length) {
      return res.status(400).json({
        message: "Invalid services provided",
        errors: validationErrors,
      });
    }

    payload.selectedServices?.apps?.forEach((app) => {
      app.isActive = true;
    });

    payload.selectedServices?.modules?.forEach((mod) => {
      mod.isActive = true;
    });

    payload.selectedServices?.defaults?.forEach((def) => {
      def.isActive = true;
    });

    const companyId = randomUUID();
    const companyData = {
      companyId,
      companyName: payload.companyName,
      registeredEntityName: payload.registeredEntityName,
      industry: payload.industry,
      companySize: payload.companySize,
      companyCity: payload.companyCity,
      companyState: payload.companyState,
      companyCountry: payload.companyCountry,
      companyContinent: payload.companyContinent,
      websiteLink: payload.websiteURL,
      linkedinURL: payload.linkedinURL,
      selectedServices: payload.selectedServices || [],
      isRegistered: true,
      isWebsiteTemplate: isWebsiteTemplate ? true : false,
      logo: isWebsiteTemplate ? { url: isWebsiteTemplate.logo, id: "" } : null,
    };

    //Store company data in company collection (master panel)
    const newCompany = new HostCompany(companyData);
    const savedCompany = await newCompany.save();

    //Store employee in employee collection (master panel)

    const employee = await HostUser.findOne({
      companyId,
    });

    if (employee) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const employeeObj = {
      name: payload?.pocName,
      email: payload?.pocEmail,
      phone: payload?.pocPhone,
      linkedInProfile: payload?.pocLinkedInProfile,
      languagesSpoken: payload?.pocLanguages || [],
      address: payload?.pocAddress,
      profileImage: payload?.pocProfileImage,
      designation: payload?.pocDesignation,
      isActive: payload?.isActive ?? true,
      company: savedCompany._id.toString(),
      companyId: companyId,
    };

    const newEmployee = new HostUser(employeeObj);

    await newEmployee.save();

    //Store POC data in poc collection (nomads)

    try {
      // await axios.post(
      //   "https://wononomadsbe.vercel.app/api/poc/create-poc",
      //   employeeObj,
      // );

      await axios.post("http://localhost:3000/api/poc/create-poc", employeeObj);
    } catch (err) {
      console.error(
        "❌ Remote update failed:",
        err.response?.data || err.message,
      );
      //Remote company update failed
      return res.status(err.response?.status || 500).json({
        message: err.response?.data.message || err.message,
      });
    }

    return res.status(201).json({
      message: "Company created successfully",
    });
  } catch (error) {
    next(error);
  }
};

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
      },
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

const uploadLogo = async (req, res, next) => {
  try {
    const { companyId, logo } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "company Id is required" });
    }

    if (!logo || typeof logo !== "string" || logo.trim() === "") {
      return res
        .status(400)
        .json({ message: "Please provide a valid logo string (URL)" });
    }

    const updatedCompany = await HostCompany.findOneAndUpdate(
      { companyId },
      { $set: { logo: logo.trim() } },
      { new: true },
    );

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.status(200).json({
      message: "Logo uploaded successfully",
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Error updating logo:", error);
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

// const bulkInsertCompanies = async (req, res, next) => {
//   try {
//     const file = req.file;
//     if (!file) {
//       return res
//         .status(400)
//         .json({ message: "Please provide a valid CSV file" });
//     }

//     const companies = [];

//     // Get the last company ID
//     const lastCompany = await HostCompany.findOne()
//       .sort({ companyId: -1 })
//       .select("companyId");

//     let newId = 1;
//     if (lastCompany && lastCompany.companyId) {
//       const numericPart = parseInt(
//         lastCompany.companyId.replace("CMP", ""),
//         10
//       );
//       newId = numericPart + 1;
//     }

//     // Fetch ALL existing company names to check for duplicates
//     const existingCompanies = await HostCompany.find().select("companyName");
//     const existingNames = new Set(
//       existingCompanies.map((c) => c.companyName?.toLowerCase()).filter(Boolean)
//     );

//     const stream = Readable.from(file.buffer.toString("utf-8").trim());
//     stream
//       .pipe(csvParser())
//       .on("data", (row) => {
//         const companyId = `CMP${String(newId).padStart(4, "0")}`;

//         const company = {
//           companyName: row["Business Name"]?.trim(),
//           companyId,
//           registeredEntityName: row["Registered Entity Name"]?.trim(),
//           websiteLink: row["Website"]?.trim(),
//           address: row["Address"]?.trim(),
//           companyCity: row["City"]?.trim(),
//           companyState: row["State"]?.trim(),
//           companyCountry: row["Country"]?.trim(),
//           companyContinent: row["Continent"]?.trim(),
//           companySize: row["Total Seats"]?.trim(),
//         };
//         newId++;
//         companies.push(company);
//       })
//       .on("end", async () => {
//         try {
//           const seenInCSV = new Set();
//           const uniqueCompanies = [];
//           let skippedExisting = 0;
//           let skippedDuplicateInCSV = 0;

//           for (const company of companies) {
//             if (!company.companyName) continue;

//             const name = company.companyName.toLowerCase();

//             // Check if this company already exists in DB
//             if (existingNames.has(name)) {
//               skippedExisting++;
//               continue;
//             }

//             // Check for duplicates within the CSV
//             if (!seenInCSV.has(name)) {
//               seenInCSV.add(name);
//               uniqueCompanies.push(company);
//             } else {
//               // Duplicate company name in CSV → skip
//               skippedDuplicateInCSV++;
//               continue;
//             }
//           }

//           const result = await HostCompany.insertMany(uniqueCompanies);

//           const insertedCount = result.length;

//           res.status(200).json({
//             message: "Bulk insert completed",
//             total: companies.length,
//             inserted: insertedCount,
//             skippedExisting,
//             skippedDuplicateInCSV,
//           });
//         } catch (insertError) {
//           if (insertError.name === "BulkWriteError") {
//             const insertedCount = insertError.result?.nInserted || 0;

//             res.status(200).json({
//               message: "Bulk insert completed with partial failure",
//               total: companies.length,
//               inserted: insertedCount,
//               writeErrors: insertError.writeErrors?.map((e) => ({
//                 index: e.index,
//                 errmsg: e.errmsg,
//                 code: e.code,
//               })),
//             });
//           } else {
//             res.status(500).json({
//               message: "Unexpected error during bulk insert",
//               error: insertError.message,
//             });
//           }
//         }
//       });
//   } catch (error) {
//     console.log(error);
//     next(error);
//   }
// };

const bulkInsertCompanies = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ message: "Please provide a valid CSV file" });
    }

    const companies = [];

    // Get the last company ID
    // const lastCompany = await HostCompany.findOne()
    //   .sort({ companyId: -1 })
    //   .select("companyId");

    // let newId = 1;
    // if (lastCompany && lastCompany.companyId) {
    //   const numericPart = parseInt(
    //     lastCompany.companyId.replace("CMP", ""),
    //     10,
    //   );
    //   newId = numericPart + 1;
    // }

    // Fetch existing companies from DB to check for duplicates
    const existingCompanies = await HostCompany.find().select(
      "companyName companyCity companyState companyCountry",
    );

    // Create a Set of composite keys for existing companies
    const existingKeys = new Set(
      existingCompanies.map(
        (c) =>
          `${c.companyName?.trim().toLowerCase()}|${c.companyCity
            ?.trim()
            .toLowerCase()}|${c.companyState
            ?.trim()
            .toLowerCase()}|${c.companyCountry?.trim().toLowerCase()}`,
      ),
    );

    // Parse CSV
    const stream = Readable.from(file.buffer.toString("utf-8").trim());
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        // const companyId = `CMP${String(newId).padStart(4, "0")}`;
        const companyId = randomUUID();

        const company = {
          companyId,
          companyName: row["Business Name"]?.trim(),
          registeredEntityName: row["Registered Entity Name"]?.trim(),
          websiteLink: row["Website"]?.trim(),
          address: row["Address"]?.trim(),
          companyCity: row["City"]?.trim(),
          companyState: row["State"]?.trim(),
          companyCountry: row["Country"]?.trim(),
          companyContinent: row["Continent"]?.trim(),
          companySize: row["Total Seats"]?.trim(),
        };
        // newId++;
        companies.push(company);
      })
      .on("end", async () => {
        try {
          const seenInCSV = new Set();
          const uniqueCompanies = [];
          const duplicateExistingLogs = [];
          const duplicateCSVLogs = [];

          for (const company of companies) {
            const name = company.companyName?.trim()?.toLowerCase();
            const city = company.companyCity?.trim()?.toLowerCase();
            const state = company.companyState?.trim()?.toLowerCase();
            const country = company.companyCountry?.trim()?.toLowerCase();

            if (!name || !city || !state || !country) continue;

            const key = `${name}|${city}|${state}|${country}`;

            // 1️⃣ Check if already exists in DB
            if (existingKeys.has(key)) {
              duplicateExistingLogs.push({
                companyId: company.companyId,
                companyName: company.companyName,
                city: company.companyCity,
                state: company.companyState,
                country: company.companyCountry,
                reason: "Already exists in DB",
              });
              continue;
            }

            // 2️⃣ Check for duplicates within the same CSV
            if (seenInCSV.has(key)) {
              duplicateCSVLogs.push({
                companyId: company.companyId,
                companyName: company.companyName,
                city: company.companyCity,
                state: company.companyState,
                country: company.companyCountry,
                reason: "Duplicate within same CSV",
              });
              continue;
            }

            seenInCSV.add(key);
            uniqueCompanies.push(company);
          }

          // Optional: print duplicate tables in console
          if (duplicateExistingLogs.length) {
            console.log("\n=== EXISTING COMPANIES IN DB ===");
            console.table(duplicateExistingLogs);
          }
          if (duplicateCSVLogs.length) {
            console.log("\n=== DUPLICATES FOUND IN SAME CSV ===");
            console.table(duplicateCSVLogs);
          }

          const result = await HostCompany.insertMany(uniqueCompanies);
          const insertedCount = result.length;

          res.status(200).json({
            message: "Bulk insert completed",
            total: companies.length,
            inserted: insertedCount,
            skippedExisting: duplicateExistingLogs.length,
            skippedDuplicateInCSV: duplicateCSVLogs.length,
            duplicateExistingLogs,
            duplicateCSVLogs,
          });
        } catch (insertError) {
          if (insertError.name === "BulkWriteError") {
            const insertedCount = insertError.result?.nInserted || 0;

            res.status(200).json({
              message: "Bulk insert completed with partial failure",
              total: companies.length,
              inserted: insertedCount,
              writeErrors: insertError.writeErrors?.map((e) => ({
                index: e.index,
                errmsg: e.errmsg,
                code: e.code,
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
    console.error("Unexpected error:", error);
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
      "https://wononomadsbe.vercel.app/api/company/companies",
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

          const result = await HostCompany.bulkWrite(operations);

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
  uploadLogo,
};
