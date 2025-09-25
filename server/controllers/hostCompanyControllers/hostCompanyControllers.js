const { default: axios } = require("axios");
const Employee = require("../../models/hostCompany/employees");
const HostCompany = require("../../models/hostCompany/hostCompany");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");

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
    const { companyId, selectedServices } = req.body;

    if (!companyId || !selectedServices) {
      return res.status(400).json({
        message: "companyId and services are required",
      });
    }

    // validate incoming apps/modules
    const invalidApps = selectedServices.apps.filter(
      (a) => !validApps.has(a.appName)
    );
    const invalidModules = selectedServices.modules.filter(
      (m) => !validModules.has(m.moduleName)
    );

    if (invalidApps.length || invalidModules.length) {
      return res.status(400).json({
        message: "Invalid app/module names provided",
        invalidApps: invalidApps.map((a) => a.appName),
        invalidModules: invalidModules.map((m) => m.moduleName),
      });
    }

    const company = await HostCompany.findOne({ companyId });
    if (!company) throw new Error("Company not found");

    const appsMap = new Map(
      company.selectedServices.apps.map((a) => [a.appName, a])
    );
    const modulesMap = new Map(
      company.selectedServices.modules.map((m) => [m.moduleName, m])
    );

    selectedServices.apps.forEach((app) => {
      if (appsMap.has(app.appName)) {
        appsMap.get(app.appName).isActive = app.isActive;
      } else {
        company.selectedServices.apps.push(app);
      }
    });

    selectedServices.modules.forEach((mod) => {
      if (modulesMap.has(mod.moduleName)) {
        modulesMap.get(mod.moduleName).isActive = mod.isActive;
      } else {
        company.selectedServices.modules.push(mod);
      }
    });

    const updatedCompany = await company.save();

    return res.status(200).json({
      message: "Services updated successfully",
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
      "http://localhost:3000/api/company/activate-product",
      {
        businessId,
        status,
      }
    );

    if (response.status !== 200) {
      return res.status(400).json({ message: "Failed to activate product" });
    }

    return res.status(200).json({ message: "Product activated successfully" });
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

const bulkInsertCompanies = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ message: "Please provide a valid CSV file" });
    }

    const companies = [];

    const lastCompany = await HostCompany.countDocuments();

    let newId = lastCompany + 1;

    const stream = Readable.from(file.buffer.toString("utf-8").trim());
    stream
      .pipe(csvParser())
      .on("data", (row) => {
        const companyId = `CMP${String(newId).padStart(4, "0")}`;
        const company = {
          companyName: row["Business Name"]?.trim(),
          companyId: companyId,
          registeredEntityName: row["Registered Entity name"]?.trim(),
          companyCity: row["Website"]?.trim() || null,
          address: row["Address"]?.trim(),
          companyState: row["City"]?.trim(),
          companyCountry: row["State"]?.trim(),
          websiteURL: row["Country"]?.trim(),
        };
        newId++;
        companies.push(company);
      })
      .on("end", async () => {
        try {
          const companySet = new Set();
          const uniqueCompanies = companies.filter((company) => {
            if (!company.companyName) return false; // skip empty names
            if (companySet.has(company.companyName)) {
              return false; // duplicate
            }
            companySet.add(company.companyName);
            return true;
          });

          const result = await HostCompany.insertMany(uniqueCompanies);

          const insertedCount = result.length;
          const failedCount = companies.length - insertedCount;

          res.status(200).json({
            message: "Bulk insert completed",
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

module.exports = {
  createCompany,
  activateProduct,
  updateServices,
  getCompanies,
  getCompany,
  bulkInsertCompanies,
};
