const { default: axios } = require("axios");
const { default: Employee } = require("../../models/hostCompany/employees");
const {
  default: HostCompany,
} = require("../../models/hostCompany/hostCompany");

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
      country: payload.country,
      state: payload.state,
      city: payload.city,
      companyName: payload.companyName,
      industry: payload.industry,
      companySize: payload.companySize,
      companyType: payload.companyType,
      companyCity: payload.companyCity,
      companyState: payload.companyState,
      websiteURL: payload.websiteURL,
      linkedinURL: payload.linkedinURL,
      selectedServices: payload.selectedServices || [],
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
      name: payload.name,
      email: payload.email,
      phone: payload.mobile,
      company: savedCompany._id,
    });

    await newEmployee.save();

    //Store POC data in poc collection (nomads)
    await axios.post("https://wononomadsbe.vercel.app/api/poc/create-poc", {
      companyId: companyId,
      name: payload?.name,
      designation: payload?.designation,
      email: payload?.email,
      phone: payload?.phone,
      linkedInProfile: payload?.linkedInProfile,
      languagesSpoken: payload?.languages || [],
      address: payload?.address,
      profileImage: payload?.profileImage,
      isActive: payload?.isActive ?? true,
      availibilityTime: payload?.availabilityTime,
    });

    return res.status(201).json({
      message: "Company created successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
};
