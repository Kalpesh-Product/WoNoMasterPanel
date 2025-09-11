const { default: HostCompany } = require("../../models/host/hostCompany");

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
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile,
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

    const newCompany = new HostCompany(companyData);

    const savedCompany = newCompany.save();

    if (!savedCompany) {
      return res.status(400).json({ message: "Failed to onboard the company" });
    }

    return res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: newCompany,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key (email uniqueness violation)
      return res.status(400).json({
        success: false,
        message: "A company with this email already exists",
      });
    }
    next(error);
  }
};

module.exports = {
  createCompany,
};
