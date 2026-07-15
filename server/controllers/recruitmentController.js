const mongoose = require("mongoose");
const RecruitmentJobOpening = require(
  "../models/recruitment/RecruitmentJobOpening",
);

const clean = (value) => String(value ?? "").trim();

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
    const job = await RecruitmentJobOpening.findOneAndUpdate(
      { workspaceId, jobCode: currentJobCode },
      payload,
      { new: true, runValidators: true },
    );
    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }
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

module.exports = {
  getRecruitmentJobOpenings,
  getPublicRecruitmentJobOpenings,
  createRecruitmentJobOpening,
  updateRecruitmentJobOpening,
};
