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
const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      await axios.post(
        "https://wononomadsbe.vercel.app/api/poc/create-poc",
        employeeObj,
      );

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
    const companies = await HostCompany.find().lean();

    if (!companies || !companies.length) {
      return res.status(200).json([]);
    }

    const workspaces = await Workspace.find({ isActive: true })
      .select("_id company companyId businessName selectedPlan")
      .lean();
    const templates = await WebsiteTemplate.find({ isDeleted: { $ne: true } })
      .select("searchKey companyId companyName isActive isPublished")
      .lean();

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const enrichedCompanies = companies.map((company) => {
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

    return res.status(200).json(enrichedCompanies);
  } catch (error) {
    next(error);
  }
};

const getHostLeadCompanies = async (req, res, next) => {
  try {
    const companies = await HostLeadCompany.find().sort({ createdAt: -1 }).lean();

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
      .select("_id companyId businessName selectedPlan")
      .lean();
    const templates = await WebsiteTemplate.find({ isDeleted: { $ne: true } })
      .select("searchKey companyId companyName isActive isPublished")
      .lean();

    const companiesWithPlanStatus = companies.map((company) => {
      const requestedPlan = String(company?.requestedPlan || "").trim().toLowerCase();
      const normalizedCompanyId = String(company.companyId || "").trim();
      const companyNameRegex = buildExactCaseInsensitiveRegex(company.companyName);
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
      const workspaceSelectedPlan = String(matchedWorkspace?.selectedPlan || "").trim().toLowerCase();
      return {
        ...company,
        workspaceId: matchedWorkspace?._id ? String(matchedWorkspace._id) : "",
        workspaceCompanyId: String(matchedWorkspace?.companyId || "").trim(),
        selectedPlan: matchedWorkspace?.selectedPlan || company?.selectedPlan || company?.plan || "",
        workspacePlanApplied:
          Boolean(requestedPlan) &&
          Boolean(matchedWorkspace) &&
          workspaceSelectedPlan === requestedPlan,
        isWebsiteTemplate: Boolean(matchedTemplate),
        websiteTemplate: matchedTemplate || null,
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

    const company = await HostLeadCompany.findOne({ companyId: String(companyId).trim() });

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
    const { companyId, requestedPlan } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (!requestedPlan || !String(requestedPlan).trim()) {
      return res.status(400).json({ message: "requestedPlan is required" });
    }

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
          requestedPlan: String(requestedPlan).trim().toLowerCase(),
          paymentLinkUrl: "",
          paymentLinkSentAt: null,
          paymentStatus: false,
          paymentConfirmedAt: null,
          upgradeSuccessSentAt: null,
          upgradeStatus: "requested",
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

const updateUpgradePaymentStatus = async (req, res, next) => {
  try {
    const { companyId, paymentStatus } = req.body || {};

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (typeof paymentStatus !== "boolean") {
      return res.status(400).json({ message: "paymentStatus must be true or false" });
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
          const companyNameRegex = buildExactCaseInsensitiveRegex(company.companyName);
          const matchOr = [];
          if (companyIdRegex) matchOr.push({ companyId: { $regex: companyIdRegex } });
          if (companyNameRegex) matchOr.push({ businessName: { $regex: companyNameRegex } });
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

    const company = await HostLeadCompany.findOne({ companyId: String(companyId).trim() });

    if (!company) {
      return res.status(404).json({ message: "Host lead company not found" });
    }

    if (company.paymentStatus !== true) {
      return res.status(400).json({
        message: "Payment must be confirmed before sending upgrade success email",
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

    hostLeadCompany.linkedNomadsCompanyId = String(nomadsCompanyId).trim();
    await hostLeadCompany.save();

    return res.status(200).json({
      message: `All products linked to Host Company "${hostLeadCompany.companyName}"`,
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
      companiesListingRequestedAt: hostLeadCompany.companiesListingRequestedAt || null,
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
      effectiveNomadsCompanyId: company.linkedHostCompanyId || company.companyId,
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
    const linkedIdSet = new Set(alreadyLinked.map((c) => c.linkedHostCompanyId));

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
    const { companyName, companyCity, companyState, companyCountry, companyContinent } =
      req.body || {};

    const hostLeadCompany = await HostLeadCompany.findOne({ companyId: hostCompanyId });

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    const existingLink = await HostCompany.findOne({ linkedHostCompanyId: hostCompanyId });
    if (existingLink) {
      return res.status(400).json({
        message: "A Companies entry is already linked to this host company",
      });
    }

    const finalCompanyName = String(companyName || hostLeadCompany.companyName || "").trim();
    if (!finalCompanyName) {
      return res.status(400).json({ message: "companyName is required" });
    }

    const finalCity = String(companyCity || hostLeadCompany.companyCity || "").trim();
    const finalState = String(companyState || hostLeadCompany.companyState || "").trim();
    const finalCountry = String(companyCountry || hostLeadCompany.companyCountry || "").trim();
    const finalContinent =
      String(companyContinent || hostLeadCompany.companyContinent || "").trim() ||
      getContinentForCountry(finalCountry);

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

    hostLeadCompany.companiesListingRequestedAt = null;
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

    const hostLeadCompany = await HostLeadCompany.findOne({ companyId: hostCompanyId });

    if (!hostLeadCompany) {
      return res.status(404).json({ message: "Host company not found" });
    }

    hostLeadCompany.companiesListingRequestedAt = null;
    await hostLeadCompany.save();

    return res.status(200).json({ message: "Request dismissed" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  editCompany,
  activateProduct,
  updateServices,
  sendUpgradePaymentLink,
  requestUpgradePlan,
  updateUpgradePaymentStatus,
  markUpgradeSuccessEmailSent,
  getCompanies,
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
