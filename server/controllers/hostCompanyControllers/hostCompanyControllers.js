const { default: axios } = require("axios");
// const { default: Employee } = require("../../models/hostCompany/employees");
// const {
//   default: HostCompany,
// } = require("../../models/hostCompany/hostCompany");
// ✅ Use plain require for CommonJS models
const Employee = require("../../models/hostCompany/employees");
const HostCompany = require("../../models/hostCompany/hostCompany");

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

    const companyData = {
      companyId,
      companyName: payload.companyName,
      industry: payload.industry,
      companySize: payload.companySize,
      companyCity: payload.companyCity,
      companyState: payload.companyState,
      companyCountry: payload.companyCountry,
      websiteURL: payload.websiteURL,
      linkedinURL: payload.linkedinURL,
      selectedServices: payload.selectedServices || [],
      isRegistered: true,
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
    const company = await HostCompany.findOne(companyId);

    if (!company || !company.length) {
      return res.status(200).json([]);
    }

    return res.status(200).json(company);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompany,
};
