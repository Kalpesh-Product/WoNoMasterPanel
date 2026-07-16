const mongoose = require("mongoose");
const RecruitmentJobOpening = require(
  "../models/recruitment/RecruitmentJobOpening",
);
const RecruitmentCandidate = require(
  "../models/recruitment/RecruitmentCandidate",
);
const { uploadFileToS3 } = require("../config/s3config");

const clean = (value) => String(value ?? "").trim();

// Company attribution for audit logs (jobs only carry a workspaceId).
const getWorkspaceCompanyInfo = async (workspaceId) => {
  try {
    const Workspace = require("../models/hostCompany/Workspace");
    const workspace = await Workspace.findById(workspaceId)
      .select("businessName companyId")
      .lean();
    return {
      companyName: workspace?.businessName || undefined,
      companyId: workspace?.companyId || String(workspaceId || ""),
    };
  } catch {
    return { companyId: String(workspaceId || "") };
  }
};

const buildJobPayload = (body = {}) => ({
  jobCode: clean(body.jobCode).toUpperCase(),
  title: clean(body.title || body.designation),
  designation: clean(body.designation || body.title),
  department: clean(body.department),
  employmentType: clean(body.employmentType) || "full_time",
  isPaid: body.employmentType === "intern" ? false : body.isPaid !== false,
  internshipDurationMonths:
    body.employmentType === "intern"
      ? Math.max(0, Number(body.internshipDurationMonths || 0))
      : 0,
  vacancyTotal: Math.max(1, Number(body.vacancyTotal || 1)),
  location: clean(body.location),
  workMode: clean(body.workMode) || "on_site",
  isActive: body.isActive !== false,
  isPostedOnWebsite: body.isPostedOnWebsite !== false,
  description: clean(body.description || body.aboutTheJob),
  aboutTheJob: clean(body.aboutTheJob || body.description),
  keyResponsibilities: clean(body.keyResponsibilities),
  requirements: clean(body.requirements),
  softSkills: clean(body.softSkills),
});

const generateJobCode = (title, department) => {
  const prefix = clean(department || title || "JOB")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase() || "JOB";
  return `${prefix}-${Date.now().toString().slice(-6)}`;
};

const getRecruitmentJobOpenings = async (req, res, next) => {
  try {
    const workspaceId = clean(req.query.workspaceId);
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ success: false, message: "A valid workspaceId is required" });
    }
    const jobs = await RecruitmentJobOpening.find({ workspaceId })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    return next(error);
  }
};

// Custom question definitions configured in the website builder careers form.
const parseCareersFormFields = (value) => {
  try {
    const raw = typeof value === "string" ? JSON.parse(value || "[]") : value;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((field, index) => ({
        id: String(field?.id || `field_${index}`),
        label: String(field?.label || "").trim(),
      }))
      .filter((field) => field.id);
  } catch {
    return [];
  }
};

const parseCandidateCustomFields = (value) => {
  try {
    const raw = typeof value === "string" ? JSON.parse(value || "{}") : value;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
};

const getRecruitmentCandidates = async (req, res, next) => {
  try {
    const workspaceId = clean(req.query.workspaceId);
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ success: false, message: "A valid workspaceId is required" });
    }
    const candidates = await RecruitmentCandidate.find({ workspaceId })
      .sort({ appliedAt: -1 })
      .lean();

    // Answers are stored keyed by field id; resolve labels from the website's
    // careers form so the panel shows the actual questions.
    const WebsiteTemplate = require("../models/website/WebsiteTemplate");
    const template = await WebsiteTemplate.findOne({
      workspaceId: String(workspaceId),
      isDeleted: { $ne: true },
    })
      .sort({ updatedAt: -1 })
      .select("careersFormFields")
      .lean();
    const formFields = parseCareersFormFields(template?.careersFormFields);
    const knownFieldIds = new Set(formFields.map((field) => field.id));

    const data = candidates.map((candidate) => {
      const answers = parseCandidateCustomFields(candidate.customFields);
      const customFieldAnswers = formFields
        .filter((field) => String(answers[field.id] ?? "").trim() !== "")
        .map((field) => ({
          id: field.id,
          label: field.label || field.id,
          value: String(answers[field.id]),
        }));
      Object.entries(answers).forEach(([id, value]) => {
        if (!knownFieldIds.has(id) && String(value ?? "").trim() !== "") {
          customFieldAnswers.push({ id, label: id, value: String(value) });
        }
      });
      return { ...candidate, customFieldAnswers };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const createRecruitmentJobOpening = async (req, res, next) => {
  try {
    const workspaceId = clean(req.body.workspaceId);
    const payload = buildJobPayload(req.body);
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ success: false, message: "A valid workspaceId is required" });
    }
    if (!payload.title || !payload.department) {
      return res.status(400).json({ success: false, message: "Role and department are required" });
    }
    payload.jobCode = payload.jobCode || generateJobCode(payload.title, payload.department);
    const job = await RecruitmentJobOpening.create({ workspaceId, ...payload });

    req.logContext = {
      ...(req.logContext || {}),
      action: "create-job-opening",
      ...(await getWorkspaceCompanyInfo(workspaceId)),
      changes: [
        {
          field: "jobOpening",
          type: "item",
          change: "added",
          to: `${job.jobCode} - ${job.title} (${job.department})`,
        },
      ],
    };

    return res.status(201).json({ success: true, data: job });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "This job code already exists" });
    }
    return next(error);
  }
};

const updateRecruitmentJobOpening = async (req, res, next) => {
  try {
    const workspaceId = clean(req.body.workspaceId);
    const currentJobCode = clean(req.params.jobCode).toUpperCase();
    const payload = buildJobPayload(req.body);
    if (!mongoose.Types.ObjectId.isValid(workspaceId) || !currentJobCode) {
      return res.status(400).json({ success: false, message: "Workspace and job code are required" });
    }
    if (!payload.title || !payload.department) {
      return res.status(400).json({ success: false, message: "Role and department are required" });
    }
    payload.jobCode = payload.jobCode || currentJobCode;
    const existingJob = await RecruitmentJobOpening.findOne({
      workspaceId,
      jobCode: currentJobCode,
    }).lean();
    if (!existingJob) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }
    const job = await RecruitmentJobOpening.findOneAndUpdate(
      { workspaceId, jobCode: currentJobCode },
      payload,
      { new: true, runValidators: true },
    );
    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }

    const changes = Object.keys(payload)
      .filter((key) => String(existingJob[key] ?? "") !== String(payload[key] ?? ""))
      .map((key) => ({
        field: key,
        type: "text",
        change: "edited",
        from: String(existingJob[key] ?? "").slice(0, 300),
        to: String(payload[key] ?? "").slice(0, 300),
      }));
    req.logContext = {
      ...(req.logContext || {}),
      action: "update-job-opening",
      ...(await getWorkspaceCompanyInfo(workspaceId)),
      changes,
    };

    return res.status(200).json({ success: true, data: job });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "This job code already exists" });
    }
    return next(error);
  }
};

const getPublicRecruitmentJobOpenings = async (req, res, next) => {
  try {
    const workspaceId = String(req.query.workspaceId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "A valid workspaceId is required",
      });
    }

    const jobs = await RecruitmentJobOpening.find({
      workspaceId,
      isPostedOnWebsite: true,
      isActive: { $ne: false },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    return next(error);
  }
};

const applyRecruitmentJob = async (req, res, next) => {
  try {
    const {
      workspaceId,
      jobCode,
      jobTitle,
      fullName,
      email,
      phone,
      dateOfBirth,
      country,
      state,
      city,
      experience,
      linkedinProfileUrl,
      currentSalary,
      expectedSalary,
      joinAvailability,
      relocateToGoa,
      personality,
      skills,
      whyConsiderYou,
      bootstrapStartup,
      personalMessage,
      message,
      customFields,
    } = req.body || {};

    if (!workspaceId || !fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "workspaceId, fullName, and email are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspaceId",
      });
    }

    const nameParts = String(fullName).trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    const candidateCount = await RecruitmentCandidate.countDocuments({
      workspaceId,
    });

    const candidateCode = `RC-${String(candidateCount + 1).padStart(4, "0")}`;

    let resume;

    if (req.file?.buffer?.length) {
      const fileName = String(req.file.originalname || "resume").replace(
        /\s+/g,
        "-",
      );

      const uploadResult = await uploadFileToS3(
        `hr/recruitment/public-applications/${candidateCode}-${Date.now()}-${fileName}`,
        req.file,
      );

      resume = {
        name: req.file.originalname || "Resume",
        url: uploadResult.url,
        publicId: uploadResult.id,
        mimeType: req.file.mimetype || "",
        uploadedAt: new Date(),
      };
    }

    const candidate = await RecruitmentCandidate.create({
      workspaceId,
      candidateCode,
      firstName,
      lastName,
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone || "").trim(),
      jobCode: String(jobCode || "").trim().toUpperCase(),
      positionApplied: String(jobTitle || "").trim() || "General Application",
      sourceType: "Website",
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      country: String(country || "").trim(),
      state: String(state || "").trim(),
      city: String(city || "").trim(),
      currentAddress: [country, state, city].filter(Boolean).join(", "),
      experience: String(experience || "").trim(),
      sourceReference: String(linkedinProfileUrl || "").trim(),
      expectedSalary: String(expectedSalary || currentSalary || "").trim(),
      availability: String(joinAvailability || "").trim() || "Full-time",
      employmentHistory: String(whyConsiderYou || "").trim(),
      skills: String(skills || "").trim(),
      certifications: String(bootstrapStartup || "").trim(),
      coverLetter: String(personality || "").trim(),
      notes: [message, personalMessage, relocateToGoa]
        .filter(Boolean)
        .join("\n\n"),
      customFields:
        typeof customFields === "string"
          ? customFields
          : JSON.stringify(customFields || {}),
      status: "New",
      appliedAt: new Date(),
      resume,
    });

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: {
        candidateCode: candidate.candidateCode,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRecruitmentJobOpenings,
  getPublicRecruitmentJobOpenings,
  getRecruitmentCandidates,
  createRecruitmentJobOpening,
  updateRecruitmentJobOpening,
  applyRecruitmentJob,
};
