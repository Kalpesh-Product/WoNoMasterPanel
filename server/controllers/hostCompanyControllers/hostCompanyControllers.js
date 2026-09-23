const { default: axios } = require("axios");
const Employee = require("../../models/hostCompany/employees");
const HostCompany = require("../../models/hostCompany/hostCompany");
const HostLeadCompany = require("../../models/hostCompany/hostLeadCompany");
const { Readable } = require("stream");
const csvParser = require("csv-parser");
// const { v4: uuidv4 } = require("uuid");
const { randomUUID } = require("crypto");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const TestCompany = require("../../models/hostCompany/testCompany");
const HostUser = require("../../models/hostCompany/hostUser");
const Workspace = require("../../models/hostCompany/Workspace");
const {
  uploadFileToS3,
  deleteFileFromS3ByUrl,
} = require("../../config/s3config");
const { getContinentForCountry } = require("../../utils/countryContinent");
const {
  patchNomadListingsCache,
  fetchAllNomadListings,
} = require("../hostListingControllers");

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

// Nomads backend for the claim flow. NOMADS_BASE_URL (already used by the lead
// controllers) is e.g. "http://localhost:3000/api"; falls back to local dev.
const nomadsCompanyApi = () =>
  `${String(process.env.NOMADS_BASE_URL || "http://localhost:3000/api").replace(/\/+$/, "")}/company`;

const reviewerName = (req) =>
  String(
    req.userData?.name || req.userData?.email || req.userData?._id || req.user?._id || "",
  );

// Plain copy of the current claim, appended to the history when it is
// approved or rejected.
const snapshotClaim = (claim) => ({
  status: claim.status,
  nomadsCompanyId: claim.nomadsCompanyId,
  nomadsCompanyName: claim.nomadsCompanyName,
  listingCount: claim.listingCount,
  fullName: claim.fullName,
  email: claim.email,
  mobile: claim.mobile,
  role: claim.role,
  registeredCompanyName: claim.registeredCompanyName,
  documents: (claim.documents || []).map((d) => ({ label: d.label, url: d.url, id: d.id })),
  requestedAt: claim.requestedAt,
  reviewedAt: claim.reviewedAt,
  reviewedBy: claim.reviewedBy,
  rejectionReason: claim.rejectionReason,
});

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeListingType = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeLogo = (logo) => {
  if (!logo) return null;

  if (typeof logo === "string") {
    const url = logo.trim();
    return url ? { url, id: "" } : null;
  }

  if (typeof logo === "object") {
    const url = typeof logo.url === "string" ? logo.url.trim() : "";
    const id = typeof logo.id === "string" ? logo.id : "";
    return url ? { url, id } : null;
  }

  return null;
};

// Same prefix-match convention getCompanyMembers uses in hostUserControllers.js
// (a workspace's companyId can be "<companyId>" or "<companyId>-<suffix>").
const buildCompanyIdPrefixRegex = (companyId = "") => {
  const normalized = String(companyId || "").trim();
  if (!normalized) return null;
  return new RegExp(`^${escapeRegex(normalized)}(?:$|-)`, "i");
};

// Same name-fallback convention getCompanyMembers uses — a workspace's
// companyId doesn't always line up with the lead record's companyId (e.g.
// duplicate/stray lead records), but its businessName usually still matches
// the lead's companyName.
const buildExactCaseInsensitiveRegex = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
};

const WORKSPACE_PLAN_VALUES = new Set(["basic", "professional", "custom"]);

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

const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }

  return "";
};

const createCompany = async (req, res, next) => {
  try {
    const payload = req.body;
    const normalizedPocEmail = String(payload?.pocEmail || "")
      .trim()
      .toLowerCase();
    const hostUser = normalizedPocEmail
      ? await HostUser.findOne({
          email: {
            $regex: `^${escapeRegex(normalizedPocEmail)}$`,
            $options: "i",
          },
        }).lean()
      : null;

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
      industry: pickFirstNonEmpty(
        payload.industry,
        hostUser?.verticalType?.[0],
      ),
      companySize: payload.companySize,
      companyCity: pickFirstNonEmpty(payload.companyCity, hostUser?.city),
      companyState: pickFirstNonEmpty(payload.companyState, hostUser?.state),
      companyCountry: pickFirstNonEmpty(
        payload.companyCountry,
        hostUser?.country,
      ),
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
      await axios.post("http://localhost:3000/api/poc/create-poc", employeeObj);

      // await axios.post("http://localhost:3000/api/poc/create-poc", employeeObj);
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

const editCompany = async (req, res, next) => {
  try {
    const parsedBody = req.body?.data
      ? JSON.parse(req.body.data)
      : req.body || {};
    const { companyId, selectedServices, ...payload } = parsedBody;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (typeof payload.logo !== "undefined") {
      return res.status(400).json({
        message:
          "Logo URL cannot be edited directly. Please upload logo file in 'logo' field",
      });
    }

    const company =
      (await HostCompany.findOne({ companyId })) ||
      (await HostLeadCompany.findOne({ companyId }));
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const CompanyModel =
      company.constructor.modelName === "HostLeadCompany"
        ? HostLeadCompany
        : HostCompany;

    if (
      payload.companyName &&
      payload.companyName.trim().toLowerCase() !==
        company.companyName?.trim().toLowerCase()
    ) {
      const existingCompany = await CompanyModel.findOne({
        companyName: payload.companyName,
        companyId: { $ne: companyId },
      }).lean();

      if (existingCompany) {
        return res.status(400).json({ message: "Company already exists" });
      }
    }

    if (selectedServices) {
      const parsedSelectedServices =
        typeof selectedServices === "string"
          ? JSON.parse(selectedServices)
          : selectedServices;

      const validationErrors = validateServices(parsedSelectedServices);

      if (validationErrors.length) {
        return res.status(400).json({
          message: "Invalid services provided",
          errors: validationErrors,
        });
      }

      payload.selectedServices = parsedSelectedServices;
    }

    const updateData = {
      companyName: payload.companyName,
      registeredEntityName: payload.registeredEntityName,
      industry: payload.industry,
      companySize: payload.companySize,
      companyCity: payload.companyCity,
      companyState: payload.companyState,
      companyCountry: payload.companyCountry,
      companyContinent: payload.companyContinent,
      websiteLink: payload.websiteURL ?? payload.websiteLink,
      linkedinURL: payload.linkedinURL,
      selectedServices: payload.selectedServices,
    };

    if (req.file) {
      const sanitizeFileName = (name) =>
        String(name || "logo")
          .replace(/[/\\?%*:|"<>]/g, "_")
          .replace(/\s+/g, "_");

      const logoKey = `hosts/companies/${payload.companyName.trim()}/logo/${sanitizeFileName(
        req.file.originalname,
      )}`;

      const uploadResult = await uploadFileToS3(logoKey, req.file);

      if (company.logo?.url && company.logo.url.includes(".amazonaws.com/")) {
        await deleteFileFromS3ByUrl(company.logo.url);
      }

      updateData.logo = {
        url: uploadResult.url,
        id: uploadResult.id,
      };
    }

    Object.keys(updateData).forEach((key) => {
      if (typeof updateData[key] === "undefined") {
        delete updateData[key];
      }
    });

    const updatedCompany = await CompanyModel.findOneAndUpdate(
      { companyId },
      { $set: updateData },
      { new: true },
    );

    return res.status(200).json({
      message: "Company updated successfully",
      company: updatedCompany,
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
      "http://localhost:3000/api/company/activate-product",
      {
        businessId,
        status,
      },
    );

    if (response.status !== 200) {
      return res.status(400).json({ message: "Failed to activate product" });
    }

    // isActive and isPublic are independent — activating/deactivating
    // doesn't touch isPublic.
    patchNomadListingsCache([businessId], { isActive: status });

    const activeStatus = status ? "activated" : "inactivated";
    return res
      .status(200)
      .json({ message: `Product ${activeStatus} successfully` });
  } catch (error) {
    next(error);
  }
};

const setListingPublicStatus = async (req, res, next) => {
  try {
    const { businessId, isPublic } = req.body;

    if (!businessId) {
      return res.status(400).json({
        message: "Business Id missing",
      });
    }

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({
        message: "isPublic must be true/false",
      });
    }

    const response = await axios.patch(
      "http://localhost:3000/api/company/set-public-status",
      { businessId, isPublic },
    );

    patchNomadListingsCache([businessId], { isPublic });
    return res.status(200).json(response.data);
  } catch (error) {
    if (error.response) {
      return res
        .status(error.response.status)
        .json(error.response.data || { message: "Failed to update listing visibility" });
    }
    next(error);
  }
};

// Country > state > city tree with listing counts, for the Data Upload
// "Bulk Publish Listings" tab's cascading location selects.
const getPublicLocationTree = async (req, res, next) => {
  try {
    const response = await axios.get(
      "http://localhost:3000/api/company/location-tree",
    );

    return res.status(200).json(response.data);
  } catch (error) {
    if (error.response) {
      return res
        .status(error.response.status)
        .json(error.response.data || { message: "Failed to load locations" });
    }
    next(error);
  }
};

// Bulk sibling of setListingPublicStatus: flips isPublic for every listing
// in a country (+ optional state/city) at once.
const bulkSetListingPublicStatus = async (req, res, next) => {
  try {
    const { country, state, city, isPublic } = req.body;

    if (!country || !state) {
      return res.status(400).json({
        message: "Country and state are required",
      });
    }

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({
        message: "isPublic must be true/false",
      });
    }

    // Resolve which businessIds this affects *before* calling upstream so we
    // can patch them in the cache directly afterwards, instead of
    // invalidating and forcing the next read to pay for a full re-crawl.
    // isActive/isPublic are independent — this only skips listings already
    // in the target isPublic state, regardless of isActive.
    const normalize = (value) => String(value || "").trim().toLowerCase();
    const trimmedCountry = normalize(country);
    const trimmedState = normalize(state);
    const trimmedCity = normalize(city);

    const allListings = await fetchAllNomadListings();
    const targetIds = allListings
      .filter((listing) => {
        if (!listing.businessId) return false;
        if (Boolean(listing.isPublic) === isPublic) return false;
        const matchesCountry = normalize(listing.country) === trimmedCountry;
        const matchesState = normalize(listing.state) === trimmedState;
        const matchesCity = !trimmedCity || normalize(listing.city) === trimmedCity;
        return matchesCountry && matchesState && matchesCity;
      })
      .map((listing) => listing.businessId);

    const response = await axios.patch(
      "http://localhost:3000/api/company/bulk-set-public-status",
      { country, state, city, isPublic },
    );

    patchNomadListingsCache(targetIds, { isPublic });
    return res.status(200).json(response.data);
  } catch (error) {
    if (error.response) {
      return res
        .status(error.response.status)
        .json(error.response.data || { message: "Failed to bulk update listing visibility" });
    }
    next(error);
  }
};

// Nomads has no bulk activate/inactivate endpoint like it does for
// public-status, so this resolves every matching listing locally (via the
// same aggregated listings source the Publish Listings table uses) and fans
// out individual activate-product calls across them.
const bulkSetListingActiveStatus = async (req, res, next) => {
  try {
    const { country, state, city, isActive } = req.body;

    if (!country || !state) {
      return res.status(400).json({
        message: "Country and state are required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true/false",
      });
    }

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const trimmedCountry = normalize(country);
    const trimmedState = normalize(state);
    const trimmedCity = normalize(city);

    const allListings = await fetchAllNomadListings();
    const targets = allListings.filter((listing) => {
      if (!listing.businessId) return false;
      if (Boolean(listing.isActive) === isActive) return false;
      const matchesCountry = normalize(listing.country) === trimmedCountry;
      const matchesState = normalize(listing.state) === trimmedState;
      const matchesCity = !trimmedCity || normalize(listing.city) === trimmedCity;
      return matchesCountry && matchesState && matchesCity;
    });

    const results = await Promise.allSettled(
      targets.map((listing) =>
        axios.patch("http://localhost:3000/api/company/activate-product", {
          businessId: listing.businessId,
          status: isActive,
        }),
      ),
    );

    const updatedCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - updatedCount;

    // isActive and isPublic are independent — this doesn't touch isPublic.
    patchNomadListingsCache(
      results
        .map((result, index) => (result.status === "fulfilled" ? targets[index].businessId : null))
        .filter(Boolean),
      { isActive },
    );

    return res.status(200).json({
      message: failedCount
        ? `${updatedCount} listing(s) marked ${isActive ? "active" : "inactive"}, ${failedCount} failed`
        : `${updatedCount} listing(s) marked ${isActive ? "active" : "inactive"}`,
      updatedCount,
      failedCount,
    });
  } catch (error) {
    next(error);
  }
};

const enrichCompaniesWithWorkspaceAndTemplate = async (companies) => {
  if (!companies || !companies.length) return [];

  const workspaces = await Workspace.find({ isActive: true })
    .select("_id company companyId businessName selectedPlan")
    .lean();
  const templates = await WebsiteTemplate.find({ isDeleted: { $ne: true } })
    .select("searchKey companyId companyName isActive isPublished")
    .lean();

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  return companies.map((company) => {
    const companyId = String(company?.companyId || "").trim();
    const companyName = normalize(company?.companyName);
    const workspace = workspaces.find(
      (item) =>
        String(item?.company || "") === String(company?._id || "") ||
        String(item?.companyId || "").trim() === companyId ||
        normalize(item?.businessName) === companyName,
    );
    const template = templates.find(
      (item) =>
        (companyId && String(item?.companyId || "").trim() === companyId) ||
        normalize(item?.companyName) === companyName,
    );

    return {
      ...company,
      workspaceId: workspace?._id ? String(workspace._id) : "",
      workspaceCompanyId: String(workspace?.companyId || "").trim(),
      selectedPlan: workspace?.selectedPlan || company?.selectedPlan || "",
      isWebsiteTemplate: Boolean(template),
      websiteTemplate: template || null,
    };
  });
};

const getCompanies = async (req, res, next) => {
  try {
    const { page, limit, search, status, country, state, city, lookupKeys } = req.query;

    if (lookupKeys !== undefined) {
      const keys = String(lookupKeys || "")
        .split("\n")
        .map((key) => key.trim().toLowerCase())
        .filter(Boolean);

      if (!keys.length) return res.status(200).json([]);

      const keySet = new Set(keys);
      const lookupFilter = {
        $or: keys
          .map((key) => {
            const [name, cityValue, stateValue, countryValue] = key.split("|");
            if (!name || !cityValue || !stateValue || !countryValue) return null;
            return {
              companyName: new RegExp(`^${escapeRegex(name)}$`, "i"),
              companyCity: new RegExp(`^${escapeRegex(cityValue)}$`, "i"),
              companyState: new RegExp(`^${escapeRegex(stateValue)}$`, "i"),
              companyCountry: new RegExp(`^${escapeRegex(countryValue)}$`, "i"),
            };
          })
          .filter(Boolean),
      };

      if (!lookupFilter.$or.length) return res.status(200).json([]);

      const companies = await HostCompany.find(lookupFilter)
        .select("companyId companyName companyCity companyState companyCountry")
        .lean();

      return res.status(200).json(
        companies.filter((company) => {
          const key = `${company.companyName?.trim().toLowerCase()}|${company.companyCity
            ?.trim()
            .toLowerCase()}|${company.companyState
            ?.trim()
            .toLowerCase()}|${company.companyCountry?.trim().toLowerCase()}`;
          return keySet.has(key);
        }),
      );
    }

    // No `page` param: existing full-list behavior, unchanged for the other
    // callers of this endpoint (RequestedServices, DestinationsData,
    // WorldRankingWeights) that expect a plain array.
    if (page === undefined) {
      const companies = await HostCompany.find().lean();
      const enrichedCompanies =
        await enrichCompaniesWithWorkspaceAndTemplate(companies);
      return res.status(200).json(enrichedCompanies);
    }

    const filter = {};
    if (status === "active") filter.isRegistered = true;
    else if (status === "inactive") filter.isRegistered = false;

    const trimmedCountry = String(country || "").trim();
    if (trimmedCountry) {
      filter.companyCountry = new RegExp(`^${escapeRegex(trimmedCountry)}$`, "i");
    }
    const trimmedState = String(state || "").trim();
    if (trimmedState) {
      filter.companyState = new RegExp(`^${escapeRegex(trimmedState)}$`, "i");
    }
    const trimmedCity = String(city || "").trim();
    if (trimmedCity) {
      filter.companyCity = new RegExp(`^${escapeRegex(trimmedCity)}$`, "i");
    }

    const trimmedSearch = String(search || "").trim();
    if (trimmedSearch) {
      const searchRegex = new RegExp(escapeRegex(trimmedSearch), "i");
      filter.$or = [
        { companyName: searchRegex },
        { industry: searchRegex },
        { companyCountry: searchRegex },
        { companyState: searchRegex },
        { companyCity: searchRegex },
      ];
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const [companies, total, totalCount, activeCount, inactiveCount] =
      await Promise.all([
        HostCompany.find(filter)
          .sort({ isRegistered: -1, companyName: 1 })
          .skip((pageNumber - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        HostCompany.countDocuments(filter),
        HostCompany.countDocuments({}),
        HostCompany.countDocuments({ isRegistered: true }),
        HostCompany.countDocuments({ isRegistered: false }),
      ]);

    const enrichedCompanies =
      await enrichCompaniesWithWorkspaceAndTemplate(companies);

    return res.status(200).json({
      items: enrichedCompanies,
      page: pageNumber,
      limit: pageSize,
      total,
      hasMore: pageNumber * pageSize < total,
      counts: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const sortDistinct = (values = []) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );

// Returns cascading location options: states are scoped to the selected
// country, cities to the selected state, so the Companies filter dropdowns
// only ever show combinations that exist in the data.
const getCompanyLocations = async (req, res, next) => {
  try {
    const { country, state } = req.query;

    const countryFilter = {};
    const trimmedCountry = String(country || "").trim();
    if (trimmedCountry) {
      countryFilter.companyCountry = new RegExp(`^${escapeRegex(trimmedCountry)}$`, "i");
    }

    const stateFilter = { ...countryFilter };
    const trimmedState = String(state || "").trim();
    if (trimmedState) {
      stateFilter.companyState = new RegExp(`^${escapeRegex(trimmedState)}$`, "i");
    }

    const [countries, states, cities] = await Promise.all([
      HostCompany.distinct("companyCountry", {}),
      HostCompany.distinct("companyState", countryFilter),
      HostCompany.distinct("companyCity", stateFilter),
    ]);

    return res.status(200).json({
      countries: sortDistinct(countries),
      states: sortDistinct(states),
      cities: sortDistinct(cities),
    });
  } catch (error) {
    next(error);
  }
};

const getHostLeadCompanies = async (req, res, next) => {
  try {
    const companies = await HostLeadCompany.find()
      .sort({ createdAt: -1 })
      .lean();

    if (!companies || !companies.length) {
      return res.status(200).json([]);
    }

    // Tell the Upgrade Plan page whether the requested plan has actually
    // been applied to a real workspace yet (via Module Access, or via this
    // controller's own updateUpgradePaymentStatus sync) — staff shouldn't be
    // able to send the "you've been upgraded" success email before that's
    // true, otherwise the host gets told they're upgraded while still
    // seeing their old plan (exactly today's duplicate-lead-record bug).
    const allWorkspaces = await Workspace.find({ isActive: true })
      .select(
        "_id companyId businessName selectedPlan purchasedPlan planStatus planStartDate planExpiryDate",
      )
      .lean();
    const templates = await WebsiteTemplate.find({ isDeleted: { $ne: true } })
      .select("searchKey companyId companyName isActive isPublished")
      .lean();

    const companiesWithPlanStatus = companies.map((company) => {
      const requestedPlan = String(company?.requestedPlan || "")
        .trim()
        .toLowerCase();
      const normalizedCompanyId = String(company.companyId || "").trim();
      const companyNameRegex = buildExactCaseInsensitiveRegex(
        company.companyName,
      );
      // The "<companyId>-<suffix>" prefix convention assumes every suffixed
      // id still belongs to *this* company's own extra workspaces. That
      // breaks when a suffixed id was independently registered as its own,
      // separate top-level company (seen in test data: several distinct
      // companies' workspace/template rows share one company's id as a
      // prefix), because the prefix regex then matches across companies and
      // .find() just grabs whichever one happens to come first — and this
      // company's mismatched workspaceId then flows straight into the
      // website builder (get-websites?workspaceId=...), so a wrong match
      // here silently opens a totally different company's website. Match on
      // exact companyId, or exact businessName as a fallback for workspaces
      // with no companyId — never on the prefix.
      const matchedWorkspace =
        (normalizedCompanyId &&
          allWorkspaces.find(
            (ws) => String(ws?.companyId || "").trim() === normalizedCompanyId,
          )) ||
        allWorkspaces.find(
          (ws) =>
            !String(ws?.companyId || "").trim() &&
            companyNameRegex &&
            companyNameRegex.test(String(ws?.businessName || "")),
        );
      // Unlike a workspace's companyId, a template's companyId is always set
      // directly to its owning company's own id at creation/edit time — it's
      // never legitimately a "<companyId>-<suffix>" variant. So the prefix
      // regex has no legitimate case to cover here, and only ever exists to
      // let an unrelated company's template (matched purely by a shared id
      // prefix, e.g. reused/stale test leadIds) get shown instead of the
      // correct "no template yet" state. Match on exact companyId, or exact
      // companyName as a fallback for legacy rows with no companyId at all —
      // never on the prefix.
      const matchedTemplate =
        (normalizedCompanyId &&
          templates.find(
            (template) =>
              String(template?.companyId || "").trim() === normalizedCompanyId,
          )) ||
        templates.find(
          (template) =>
            !String(template?.companyId || "").trim() &&
            companyNameRegex &&
            companyNameRegex.test(String(template?.companyName || "")),
        );
      const workspaceSelectedPlan = String(matchedWorkspace?.selectedPlan || "")
        .trim()
        .toLowerCase();
      return {
        ...company,
        workspaceId: matchedWorkspace?._id ? String(matchedWorkspace._id) : "",
        workspaceCompanyId: String(matchedWorkspace?.companyId || "").trim(),
        selectedPlan:
          matchedWorkspace?.selectedPlan ||
          company?.selectedPlan ||
          company?.plan ||
          "",
        workspacePlanApplied:
          Boolean(requestedPlan) &&
          Boolean(matchedWorkspace) &&
          workspaceSelectedPlan === requestedPlan,
        isWebsiteTemplate: Boolean(matchedTemplate),
        websiteTemplate: matchedTemplate || null,
        planStatus: matchedWorkspace?.planStatus || null,
        planStartDate: matchedWorkspace?.planStartDate || null,
        planExpiryDate: matchedWorkspace?.planExpiryDate || null,
      };
    });

    return res.status(200).json(companiesWithPlanStatus);
  } catch (error) {
    next(error);
  }
};

const sendUpgradePaymentLink = async (req, res, next) => {
  try {
    const { companyId, paymentLinkUrl } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (!String(paymentLinkUrl || "").trim()) {
      return res.status(400).json({ message: "paymentLinkUrl is required" });
    }

    const company = await HostLeadCompany.findOne({
      companyId: String(companyId).trim(),
    });

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    if (!String(company.requestedPlan || "").trim()) {
      return res.status(400).json({
        message: "requestedPlan is required before sending payment link",
      });
    }

    company.paymentLinkUrl = String(paymentLinkUrl).trim();
    company.paymentLinkSentAt = new Date();
    company.upgradeStatus = "payment_link_sent";
    await company.save();

    return res.status(200).json({
      message: "Upgrade payment link saved successfully",
      company,
    });
  } catch (error) {
    next(error);
  }
};

const requestUpgradePlan = async (req, res, next) => {
  try {
    const { companyId, requestedPlan, customModuleIds } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (!requestedPlan || !String(requestedPlan).trim()) {
      return res.status(400).json({ message: "requestedPlan is required" });
    }

    const normalizedRequestedPlan = String(requestedPlan).trim().toLowerCase();

    // A new upgrade request starts a fresh review cycle on this row — reset
    // the previous cycle's payment-link/paid/upgraded tracking so the
    // Upgrade Plan page shows this as a new pending request instead of
    // still displaying "Sent / Paid / Upgraded" left over from whatever was
    // requested and completed last time (e.g. Basic -> Professional fully
    // done, then the host separately requests Professional -> Custom).
    const company = await HostLeadCompany.findOneAndUpdate(
      { companyId: String(companyId).trim() },
      {
        $set: {
          requestedPlan: normalizedRequestedPlan,
          paymentLinkUrl: "",
          paymentLinkSentAt: null,
          paymentStatus: false,
          paymentConfirmedAt: null,
          upgradeSuccessSentAt: null,
          upgradeStatus: "requested",
          // The host's own module picks from HostPanel's Custom-plan
          // selection modal, when this is a Custom request — staff see
          // these pre-filled (and can still adjust) on the Upgrade Plan
          // page before sending the payment link. Left untouched for a
          // Professional request (no module selection involved).
          ...(normalizedRequestedPlan === "custom" && Array.isArray(customModuleIds)
            ? { customPlanModuleIds: customModuleIds }
            : {}),
        },
      },
      { new: true },
    );

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    return res.status(200).json({
      message: "Requested upgrade plan saved successfully",
      company,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/hosts/host-companies/:companyId/custom-plan-modules
// Lets staff remove modules from a Custom plan request the host submitted
// (e.g. if the host over-selected) without restarting the whole review
// cycle the way requestUpgradePlan does. Any already-sent payment link is
// invalidated since removing a module changes the price — staff must send
// a fresh one for the updated selection.
const updateRequestedPlanModules = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { customModuleIds } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    if (!Array.isArray(customModuleIds)) {
      return res.status(400).json({ message: "customModuleIds must be an array" });
    }

    const company = await HostLeadCompany.findOneAndUpdate(
      { companyId: String(companyId).trim() },
      {
        $set: {
          customPlanModuleIds: customModuleIds,
          paymentLinkUrl: "",
          paymentLinkSentAt: null,
        },
      },
      { new: true },
    );

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    return res.status(200).json({
      message: "Requested modules updated successfully",
      company,
    });
  } catch (error) {
    next(error);
  }
};

const updateUpgradePaymentStatus = async (req, res, next) => {
  try {
    const { companyId, paymentStatus } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (typeof paymentStatus !== "boolean") {
      return res
        .status(400)
        .json({ message: "paymentStatus must be true or false" });
    }

    const company = await HostLeadCompany.findOne({
      companyId: String(companyId).trim(),
    });

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    company.paymentStatus = paymentStatus;

    let workspacePlanUpdate = null;

    if (paymentStatus) {
      company.paymentConfirmedAt = new Date();
      company.upgradeStatus = "paid";

      const requestedPlan = String(company.requestedPlan || "")
        .trim()
        .toLowerCase();
      if (requestedPlan) {
        if (!company.previousPlan) {
          company.previousPlan = company.plan || "";
        }
        company.plan = requestedPlan;

        // Actually apply the upgrade to the live workspace, not just this
        // tracking record — this is the step that used to be missing:
        // "Mark As Paid" previously only updated HostLeadCompany.plan for
        // display here, leaving Workspace.selectedPlan (the field HostPanel
        // actually gates modules on, via canPlanAccess()) untouched. Master
        // panel and HostPanel share the same DB, so this writes directly
        // into HostPanel's Workspace collection, same pattern already used
        // by updateWorkspaceEnabledModules above. Module *visibility* is
        // computed live from selectedPlan on every HostPanel request
        // (buildWorkspaceModulesStructure), so no enabledModuleIds
        // recomputation is needed here for the plan's own defaults to
        // unlock.
        if (WORKSPACE_PLAN_VALUES.has(requestedPlan)) {
          const companyIdRegex = buildCompanyIdPrefixRegex(company.companyId);
          const companyNameRegex = buildExactCaseInsensitiveRegex(
            company.companyName,
          );
          const matchOr = [];
          if (companyIdRegex)
            matchOr.push({ companyId: { $regex: companyIdRegex } });
          if (companyNameRegex)
            matchOr.push({ businessName: { $regex: companyNameRegex } });
          if (matchOr.length) {
            workspacePlanUpdate = await Workspace.updateMany(
              { $or: matchOr, isActive: true },
              { $set: { selectedPlan: requestedPlan } },
            );
          }
        }
      }
    } else {
      company.paymentConfirmedAt = null;
      company.upgradeSuccessSentAt = null;
      company.upgradeStatus = company.paymentLinkSentAt
        ? "payment_link_sent"
        : "requested";
      // Deliberately not reverting Workspace.selectedPlan on un-marking
      // payment — downgrading a live workspace automatically here would be
      // a destructive side effect of what's meant as a status correction.
    }

    await company.save();

    return res.status(200).json({
      message: "Payment status updated successfully",
      company,
      workspacesUpgraded: workspacePlanUpdate?.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

const markUpgradeSuccessEmailSent = async (req, res, next) => {
  try {
    const { companyId } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const company = await HostLeadCompany.findOne({
      companyId: String(companyId).trim(),
    });

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    if (company.paymentStatus !== true) {
      return res.status(400).json({
        message:
          "Payment must be confirmed before sending upgrade success email",
      });
    }

    company.upgradeSuccessSentAt = new Date();
    company.upgradeStatus = "upgraded";
    await company.save();

    return res.status(200).json({
      message: "Upgrade success status saved successfully",
      company,
    });
  } catch (error) {
    next(error);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const { companyId } = req.query;

    const company =
      (await HostCompany.findOne({ companyId: companyId })) ||
      (await HostLeadCompany.findOne({ companyId: companyId }));

    if (!company) {
      return res.status(200).json({});
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

    if (!logo) {
      return res
        .status(400)
        .json({ message: "Please provide a valid logo string (URL)" });
    }

    let updatedCompany = await HostCompany.findOneAndUpdate(
      { companyId },
      {
        $set: {
          logo: {
            url: logo.url,
            id: logo.id,
          },
        },
      },
      { new: true },
    );

    if (!updatedCompany) {
      updatedCompany = await HostLeadCompany.findOneAndUpdate(
        { companyId },
        {
          $set: {
            logo: {
              url: logo.url,
              id: logo.id,
            },
          },
        },
        { new: true },
      );
    }

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
        const companyId = `${randomUUID()}-${Date.now()}`;

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
          // if (duplicateExistingLogs.length) {
          //   console.log("\n=== EXISTING COMPANIES IN DB ===");
          //   console.table(duplicateExistingLogs);
          // }
          // if (duplicateCSVLogs.length) {
          //   console.log("\n=== DUPLICATES FOUND IN SAME CSV ===");
          //   console.table(duplicateCSVLogs);
          // }

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
      "http://localhost:3000/api/company/companies",
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
          logo: normalizeLogo(companyMap.get(businessId)),
        };
        companies.push(company);
      })
      .on("end", async () => {
        try {
          const operations = companies.map((company) => ({
            updateOne: {
              filter: { companyName: company.companyName },
              update: company.logo
                ? { $set: { logo: company.logo } }
                : { $unset: { logo: "" } },
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

// Links ALL of a Nomads company's listings to a staff-selected Host Company —
// a reference only, no data is duplicated into our own DB.
const transferNomadListing = async (req, res, next) => {
  try {
    const { nomadsCompanyId, hostCompanyId } = req.body || {};

    if (!String(nomadsCompanyId || "").trim()) {
      return res.status(400).json({ message: "nomadsCompanyId is required" });
    }
    if (!String(hostCompanyId || "").trim()) {
      return res.status(400).json({ message: "hostCompanyId is required" });
    }

    const sourceCompany = await HostCompany.findOne({
      companyId: String(nomadsCompanyId).trim(),
    }).lean();

    if (!sourceCompany) {
      return res.status(404).json({ message: "Nomads company not found" });
    }

    const hostLeadCompany = await HostLeadCompany.findOne({
      companyId: String(hostCompanyId).trim(),
    });

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    const normalizedNomadsCompanyId = String(nomadsCompanyId).trim();

    // A Nomads company can only belong to one host account.
    const linkedElsewhere = await HostLeadCompany.exists({
      linkedNomadsCompanyId: normalizedNomadsCompanyId,
      companyId: { $ne: hostLeadCompany.companyId },
    });
    if (linkedElsewhere) {
      return res.status(409).json({
        message: "This company is already linked to another host account.",
      });
    }

    const NOMADS_COMPANY_API = nomadsCompanyApi();

    const fetchNomadListings = async (companyId) => {
      try {
        const response = await axios.get(
          `${NOMADS_COMPANY_API}/get-listings/${encodeURIComponent(companyId)}`,
        );
        return (Array.isArray(response.data) ? response.data : []).filter(
          (l) => l?.businessId && !l?.isDeleted,
        );
      } catch (error) {
        if (error?.response?.status === 404) return [];
        throw error;
      }
    };

    // Who owned what before the merge: the host's own listings already went
    // through staff approval (they hold the host's plan slots), so they keep
    // their enabled slot first when the plan can't hold everything.
    let ownListings = [];
    try {
      ownListings = await fetchNomadListings(hostLeadCompany.companyId);
    } catch (error) {
      return res.status(502).json({
        message: "Couldn't read the company's listings to transfer. Please try again.",
      });
    }

    // Fold the listings the host had already added under their own companyId
    // into the linked company, so host + transferred listings sit under one
    // companyId (listings, ownership checks and leads all key off it).
    try {
      await axios.patch(
        `${NOMADS_COMPANY_API}/reassign-listings`,
        {
          fromCompanyId: hostLeadCompany.companyId,
          toCompanyId: normalizedNomadsCompanyId,
        },
        { headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY } },
      );
    } catch (error) {
      return res.status(502).json({
        message:
          error?.response?.data?.message ||
          "Couldn't merge the host's own listings into the company. Nothing was linked; please try again.",
      });
    }

    hostLeadCompany.linkedNomadsCompanyId = normalizedNomadsCompanyId;
    if (hostLeadCompany.existingCompanyClaim?.status === "pending") {
      hostLeadCompany.existingCompanyClaim.status = "approved";
      hostLeadCompany.existingCompanyClaim.reviewedAt = new Date();
      hostLeadCompany.existingCompanyClaim.reviewedBy = reviewerName(req);
      hostLeadCompany.existingCompanyClaim.rejectionReason = "";
      hostLeadCompany.existingCompanyClaimHistory.push(
        snapshotClaim(hostLeadCompany.existingCompanyClaim),
      );
    }
    await hostLeadCompany.save();

    // The host's plan caps how many listings can be ENABLED (visible) at once,
    // not how many exist. If the merged set is over that, keep the host's own
    // enabled listings first (then the company's original ones) and switch the
    // rest off — the host can swap by disabling one to enable another.
    let disabledCount = 0;
    let capWarning = "";
    try {
      const workspace = await Workspace.findOne({
        companyId: hostLeadCompany.companyId,
      })
        .select("selectedPlan")
        .lean();
      const plan = String(workspace?.selectedPlan || "basic")
        .trim()
        .toLowerCase();
      const enabledLimit =
        plan === "professional" ? 9 : plan === "custom" ? null : 4;

      if (enabledLimit !== null) {
        const ownIds = new Set(ownListings.map((l) => l.businessId));
        const allListings = await fetchNomadListings(normalizedNomadsCompanyId);
        const enabled = allListings
          .filter((l) => l.isPublic)
          .sort(
            (a, b) =>
              Number(ownIds.has(b.businessId)) - Number(ownIds.has(a.businessId)),
          );
        const toDisable = enabled.slice(enabledLimit);
        const results = await Promise.allSettled(
          toDisable.map((l) =>
            axios.patch(`${NOMADS_COMPANY_API}/set-public-status`, {
              businessId: l.businessId,
              isPublic: false,
            }),
          ),
        );
        disabledCount = results.filter((r) => r.status === "fulfilled").length;
        if (disabledCount < toDisable.length) {
          capWarning = `${toDisable.length - disabledCount} listing(s) are still enabled beyond the host's plan limit — disable them manually.`;
        }
      }
    } catch (error) {
      console.error("Failed to enforce enabled-listing limit after transfer:", error.message);
      capWarning =
        "Linked, but couldn't apply the plan's enabled-listing limit — check the host's enabled listings.";
    }

    return res.status(200).json({
      message: `All products linked to Host Company "${hostLeadCompany.companyName}"${
        disabledCount ? ` — ${disabledCount} listing(s) left disabled to fit the host's plan` : ""
      }${capWarning ? `. ${capWarning}` : ""}`,
      hostCompanyId: hostLeadCompany.companyId,
      hostCompanyName: hostLeadCompany.companyName,
    });
  } catch (error) {
    next(error);
  }
};

// Tells the frontend which Nomads company (if any) is linked to this Host
// Company, so it can reuse the same Nomad-listings table/logic as the
// Companies page instead of a separate read-only view. Also reports whether
// a "list me in Companies" request is pending or already resolved, so the
// Host Company's own Nomad Listing tab can show the same data + status
// (and a "Transfer to Company" action) instead of a dead-end "not linked"
// message whenever the host has already added listings themselves.
const getLinkedNomadCompanyMeta = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const hostLeadCompany = await HostLeadCompany.findOne({ companyId }).lean();

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    let companyName = hostLeadCompany.companyName;

    if (hostLeadCompany.linkedNomadsCompanyId) {
      const sourceCompany = await HostCompany.findOne({
        companyId: hostLeadCompany.linkedNomadsCompanyId,
      }).lean();
      companyName = sourceCompany?.companyName || companyName;
    }

    const linkedCompaniesEntry = await HostCompany.findOne({
      linkedHostCompanyId: hostLeadCompany.companyId,
    })
      .select("companyId")
      .lean();

    return res.status(200).json({
      linkedNomadsCompanyId: hostLeadCompany.linkedNomadsCompanyId || "",
      ownCompanyId: hostLeadCompany.companyId,
      companyName,
      companyCity: hostLeadCompany.companyCity,
      companyState: hostLeadCompany.companyState,
      companyCountry: hostLeadCompany.companyCountry,
      companyContinent: hostLeadCompany.companyContinent,
      companiesListingRequestedAt:
        hostLeadCompany.companiesListingRequestedAt || null,
      alreadyInCompanies: !!linkedCompaniesEntry,
    });
  } catch (error) {
    next(error);
  }
};

// For a Companies-page entry, tells the frontend which Nomads companyId to
// actually fetch listings from. Usually that's just the entry's own
// companyId — but if this entry was created from a host's "request to be
// listed" (getCompaniesListingRequests/approveCompaniesListingRequest), the
// real Nomads data lives under the Host Company's own companyId instead.
const getEffectiveNomadSourceForCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const company = await HostCompany.findOne({ companyId }).lean();

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.status(200).json({
      effectiveNomadsCompanyId:
        company.linkedHostCompanyId || company.companyId,
    });
  } catch (error) {
    next(error);
  }
};

// Lists Host Companies that asked (from HostPanel) to have a matching
// Companies-page entry created for the listing(s) they already added
// themselves. Never auto-matched by name — companies can share a name, so
// staff must manually review and pick the right data before creating one.
const getCompaniesListingRequests = async (req, res, next) => {
  try {
    const pendingRequests = await HostLeadCompany.find({
      companiesListingRequestedAt: { $ne: null },
    })
      .sort({ companiesListingRequestedAt: -1 })
      .lean();

    if (!pendingRequests.length) {
      return res.status(200).json([]);
    }

    const requestedIds = pendingRequests.map((r) => r.companyId);
    const alreadyLinked = await HostCompany.find({
      linkedHostCompanyId: { $in: requestedIds },
    })
      .select("linkedHostCompanyId")
      .lean();
    const linkedIdSet = new Set(
      alreadyLinked.map((c) => c.linkedHostCompanyId),
    );

    const stillPending = pendingRequests.filter(
      (r) => !linkedIdSet.has(r.companyId),
    );

    return res.status(200).json(stillPending);
  } catch (error) {
    next(error);
  }
};

// Staff create the matching Companies-page entry for a Host Company, linking
// it back so the Nomad Listing tab can find the data that already exists in
// Nomads under the Host Company's own ID. Callable either from the Requests
// queue (a host asked to be listed) or directly from a Host Company's own
// Nomad Listing tab (staff-initiated, no prior request needed) — both are
// the same underlying action, just reached from different pages.
const approveCompaniesListingRequest = async (req, res, next) => {
  try {
    const { hostCompanyId } = req.params;
    const {
      companyName,
      companyCity,
      companyState,
      companyCountry,
      companyContinent,
    } = req.body || {};

    const hostLeadCompany = await HostLeadCompany.findOne({
      companyId: hostCompanyId,
    });

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    const existingLink = await HostCompany.findOne({
      linkedHostCompanyId: hostCompanyId,
    });
    if (existingLink) {
      return res.status(400).json({
        message: "A Companies entry is already linked to this host company",
      });
    }

    const finalCompanyName = String(
      companyName || hostLeadCompany.companyName || "",
    ).trim();
    if (!finalCompanyName) {
      return res.status(400).json({ message: "companyName is required" });
    }

    const finalCity = String(
      companyCity || hostLeadCompany.companyCity || "",
    ).trim();
    const finalState = String(
      companyState || hostLeadCompany.companyState || "",
    ).trim();
    const finalCountry = String(
      companyCountry || hostLeadCompany.companyCountry || "",
    ).trim();
    const finalContinent =
      String(
        companyContinent || hostLeadCompany.companyContinent || "",
      ).trim() || getContinentForCountry(finalCountry);

    if (!finalCity || !finalState || !finalCountry || !finalContinent) {
      return res.status(400).json({
        message:
          "City, state, country and continent are all required to create the Companies entry",
      });
    }

    const newCompany = new HostCompany({
      companyId: randomUUID(),
      companyName: finalCompanyName,
      companyCity: finalCity,
      companyState: finalState,
      companyCountry: finalCountry,
      companyContinent: finalContinent,
      logo: hostLeadCompany.logo || null,
      isRegistered: true,
      linkedHostCompanyId: hostCompanyId,
    });
    await newCompany.save();

    // If the host asked for specific product types to go live, activate
    // exactly those listings and deactivate everything else under this
    // company. Staff-initiated Transfers (no prior host request) leave
    // listing status untouched — nothing to reconcile against.
    const requestedTypes = Array.isArray(
      hostLeadCompany.companiesListingRequestedTypes,
    )
      ? hostLeadCompany.companiesListingRequestedTypes
          .map(normalizeListingType)
          .filter(Boolean)
      : [];

    if (requestedTypes.length) {
      try {
        const listingsResponse = await axios.get(
          `http://localhost:3000/api/company/get-listings/${encodeURIComponent(hostCompanyId)}`,
        );
        const existingListings = Array.isArray(listingsResponse.data)
          ? listingsResponse.data
          : [];

        await Promise.allSettled(
          existingListings
            .filter((listing) => listing?.businessId)
            .map((listing) => {
              const shouldBeActive = requestedTypes.includes(
                normalizeListingType(listing?.companyType),
              );
              if (Boolean(listing?.isActive) === shouldBeActive) {
                return Promise.resolve();
              }
              return axios.patch(
                "http://localhost:3000/api/company/activate-product",
                { businessId: listing.businessId, status: shouldBeActive },
              );
            }),
        );
      } catch (error) {
        if (error?.response?.status !== 404) {
          console.error(
            "⚠️ Failed to sync listing activation for approved company:",
            error?.response?.data || error.message,
          );
        }
      }
    }

    hostLeadCompany.companiesListingRequestedAt = null;
    hostLeadCompany.companiesListingRequestedTypes = [];
    await hostLeadCompany.save();

    return res.status(201).json({
      message: `Company "${finalCompanyName}" created and linked`,
      companyId: newCompany.companyId,
    });
  } catch (error) {
    next(error);
  }
};

// Staff dismiss a request without creating a Companies entry — the host can
// send another request later if needed.
const rejectCompaniesListingRequest = async (req, res, next) => {
  try {
    const { hostCompanyId } = req.params;

    const hostLeadCompany = await HostLeadCompany.findOne({
      companyId: hostCompanyId,
    });

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    hostLeadCompany.companiesListingRequestedAt = null;
    hostLeadCompany.companiesListingRequestedTypes = [];
    await hostLeadCompany.save();

    return res.status(200).json({ message: "Request dismissed" });
  } catch (error) {
    next(error);
  }
};


// HostPanel (service key): a host searching for the existing Companies-page
// company that already owns their listings. Skips companies that are host-
// request shells (linkedHostCompanyId) or already linked to a host.
const searchNomadCompaniesForClaim = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(200).json([]);
    }

    const alreadyLinked = await HostLeadCompany.distinct(
      "linkedNomadsCompanyId",
      { linkedNomadsCompanyId: { $ne: "" } },
    );

    const companies = await HostCompany.find({
      companyName: { $regex: escapeRegex(q), $options: "i" },
      companyId: { $nin: alreadyLinked },
      $or: [{ linkedHostCompanyId: "" }, { linkedHostCompanyId: null }, { linkedHostCompanyId: { $exists: false } }],
    })
      .select("companyId companyName companyCity companyState companyCountry")
      .limit(8)
      .lean();

    return res.status(200).json(companies);
  } catch (error) {
    next(error);
  }
};

// HostPanel (service key): the listings under one candidate company, shown
// to the host before they submit a claim.
const getNomadCompanyListingsForClaim = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const alreadyLinked = await HostLeadCompany.exists({
      linkedNomadsCompanyId: companyId,
    });
    if (alreadyLinked) {
      return res
        .status(409)
        .json({ message: "This company is already linked to a host account." });
    }

    const company = await HostCompany.findOne({ companyId })
      .select("companyId companyName")
      .lean();
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    let listings = [];
    try {
      const response = await axios.get(
        `${nomadsCompanyApi()}/get-listings/${encodeURIComponent(companyId)}`,
      );
      listings = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
    }

    return res.status(200).json({
      companyId: company.companyId,
      companyName: company.companyName,
      listings: listings
        .filter((l) => !l?.isDeleted)
        .map((l) => ({
          businessId: l.businessId,
          companyTitle: l.companyTitle || l.companyName || "",
          companyType: l.companyType || "",
          city: l.city || "",
          country: l.country || "",
          isActive: Boolean(l.isActive),
        })),
    });
  } catch (error) {
    next(error);
  }
};

// Staff decline a host's claim on an existing company; the host sees the
// reason and can resubmit.
const rejectExistingCompanyClaim = async (req, res, next) => {
  try {
    const { hostCompanyId } = req.params;
    const hostLeadCompany = await HostLeadCompany.findOne({
      companyId: hostCompanyId,
    });
    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }
    if (hostLeadCompany.existingCompanyClaim?.status !== "pending") {
      return res.status(400).json({ message: "No pending claim to reject" });
    }
    hostLeadCompany.existingCompanyClaim.status = "rejected";
    hostLeadCompany.existingCompanyClaim.reviewedAt = new Date();
    hostLeadCompany.existingCompanyClaim.reviewedBy = reviewerName(req);
    hostLeadCompany.existingCompanyClaim.rejectionReason = String(
      req.body?.reason || "",
    ).trim();
    hostLeadCompany.existingCompanyClaimHistory.push(
      snapshotClaim(hostLeadCompany.existingCompanyClaim),
    );
    await hostLeadCompany.save();
    return res.status(200).json({ message: "Claim rejected" });
  } catch (error) {
    next(error);
  }
};

// Staff: every host claim on an existing Companies-page company - pending
// ones plus the full approved / rejected history - newest first. Each row
// keeps the { companyId, companyName, existingCompanyClaim } shape; history
// rows carry their snapshot in existingCompanyClaim.
const getExistingCompanyClaims = async (req, res, next) => {
  try {
    const hosts = await HostLeadCompany.find({
      $or: [
        { "existingCompanyClaim.status": { $in: ["pending", "approved", "rejected"] } },
        { "existingCompanyClaimHistory.0": { $exists: true } },
      ],
    })
      .select(
        "companyId companyName companyCity companyState companyCountry logo existingCompanyClaim existingCompanyClaimHistory",
      )
      .lean();

    const rows = [];
    hosts.forEach((host) => {
      const { existingCompanyClaimHistory = [], existingCompanyClaim, ...base } = host;
      existingCompanyClaimHistory.forEach((entry, index) => {
        rows.push({
          ...base,
          _key: `${host.companyId}-h${index}`,
          existingCompanyClaim: entry,
        });
      });
      // The current claim is its own row while it's pending. Once decided it
      // already lives in the history - except claims decided before history
      // existed, which have no matching entry and would otherwise vanish.
      const currentTime = new Date(existingCompanyClaim?.requestedAt || 0).getTime();
      const inHistory = existingCompanyClaimHistory.some(
        (entry) => new Date(entry.requestedAt || 0).getTime() === currentTime,
      );
      if (
        existingCompanyClaim?.status === "pending" ||
        (["approved", "rejected"].includes(existingCompanyClaim?.status) && !inHistory)
      ) {
        rows.push({ ...base, _key: `${host.companyId}-current`, existingCompanyClaim });
      }
    });

    rows.sort(
      (a, b) =>
        new Date(b.existingCompanyClaim?.requestedAt || 0) -
        new Date(a.existingCompanyClaim?.requestedAt || 0),
    );
    return res.status(200).json(rows);
  } catch (error) {
    next(error);
  }
};

// Staff: the live listings under a claimed company. `nomadsCompanyId` in the
// query selects a history row's company; otherwise the host's current claim.
const getExistingCompanyClaimDetail = async (req, res, next) => {
  try {
    const hostLeadCompany = await HostLeadCompany.findOne({
      companyId: req.params.hostCompanyId,
    })
      .select("companyId companyName existingCompanyClaim linkedNomadsCompanyId")
      .lean();
    const nomadsCompanyId = String(
      req.query.nomadsCompanyId || hostLeadCompany?.existingCompanyClaim?.nomadsCompanyId || "",
    ).trim();
    if (!hostLeadCompany || !nomadsCompanyId) {
      return res.status(404).json({ message: "Claim not found" });
    }

    let listings = [];
    try {
      const response = await axios.get(
        `${nomadsCompanyApi()}/get-listings/${encodeURIComponent(nomadsCompanyId)}`,
      );
      listings = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
    }

    return res.status(200).json({
      hostCompanyId: hostLeadCompany.companyId,
      hostCompanyName: hostLeadCompany.companyName,
      alreadyLinked: Boolean(hostLeadCompany.linkedNomadsCompanyId),
      listings: listings
        .filter((l) => !l?.isDeleted)
        .map((l) => ({
          businessId: l.businessId,
          companyName: l.companyName || "",
          companyTitle: l.companyTitle || l.companyName || "",
          companyType: l.companyType || "",
          city: l.city || "",
          country: l.country || "",
          isActive: Boolean(l.isActive),
          isPublic: Boolean(l.isPublic),
        })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExistingCompanyClaims,
  getExistingCompanyClaimDetail,
  searchNomadCompaniesForClaim,
  getNomadCompanyListingsForClaim,
  rejectExistingCompanyClaim,
  createCompany,
  editCompany,
  activateProduct,
  setListingPublicStatus,
  getPublicLocationTree,
  bulkSetListingPublicStatus,
  bulkSetListingActiveStatus,
  updateServices,
  sendUpgradePaymentLink,
  requestUpgradePlan,
  updateRequestedPlanModules,
  updateUpgradePaymentStatus,
  markUpgradeSuccessEmailSent,
  getCompanies,
  getCompanyLocations,
  getHostLeadCompanies,
  getCompany,
  bulkInsertCompanies,
  bulkInsertLogos,
  uploadLogo,
  transferNomadListing,
  getLinkedNomadCompanyMeta,
  getEffectiveNomadSourceForCompany,
  getCompaniesListingRequests,
  approveCompaniesListingRequest,
  rejectCompaniesListingRequest,
};
