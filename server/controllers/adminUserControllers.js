const bcrypt = require("bcryptjs/dist/bcrypt");
const AdminUser = require("../models/AdminUser");
const { default: mongoose } = require("mongoose");
// const { default: axios } = require("axios");
const axios = require("axios");
const FormData = require("form-data");
const HostCompany = require("../models/hostCompany/hostCompany");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const HostUser = require("../models/hostCompany/hostUser");
const Workspace = require("../models/hostCompany/Workspace");
const WebsiteTemplate = require("../models/website/WebsiteTemplate");

const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing  user ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      },
    });
  } catch (error) {
    console.error("[updateProfile] error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const verifyPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required.",
      });
    }

    const user = await AdminUser.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password verified.",
    });
  } catch (error) {
    console.error("Password Verification Error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to verify password.",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing  user ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }
    if (newPassword.length > 72) {
      return res
        .status(400)
        .json({ message: "Password cannot exceed 72 characters" });
    }

    // must contain at least one lowercase and one uppercase letter
    const hasUpperAndLower = /(?=.*[a-z])(?=.*[A-Z])/;

    // must contain at least one number OR one special character
    const hasNumberAndSpecial = /(?=.*\d)(?=.*\W)/;

    if (!hasUpperAndLower.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must include both uppercase and lowercase letters.",
      });
    }

    if (!hasNumberAndSpecial.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must include at least one number and one special character.",
      });
    }

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required" });
    }

    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("[changePassword] error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const NOMADS_BASE =
  process.env.NOMADS_BASE_URL || "https://wononomadsbe.vercel.app/api";

const TYPE_MAP = {
  products: {
    api: `${NOMADS_BASE}/company/bulk-insert-companies`,
    formKey: "companies",
  },
  poc: { api: `${NOMADS_BASE}/poc/bulk-insert-poc`, formKey: "poc" },
  reviews: {
    api: `${NOMADS_BASE}/review/bulk-insert-reviews`,
    formKey: "reviews",
  },
};

const bulkUploadData = async (req, res) => {
  const { kind = "data" } = req.body;
  let file = req.file;

  if (!file) {
    return res.status(400).json({ message: "No file provided" });
  }

  if (!TYPE_MAP[kind]) {
    return res.status(400).json({ message: "Invalid upload kind" });
  }

  try {
    const formData = new FormData();
    formData.append(TYPE_MAP[kind].formKey, file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await axios.post(TYPE_MAP[kind].api, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    res.status(200).json({
      success: true,
      message: response.data,
    });
  } catch (err) {
    // const { error, message } = err.response?.data;
    // // console.log("Internal server error", err.response.data.error);
    // console.log("Internal server error", error || message);

    const status = err.response?.status || 500;
    const data = err.response?.data;

    console.error("=== Bulk Upload Error ===");
    console.error("Status:", status);
    console.error("Data:", data);
    console.error("Full Error:", err.toString());
    console.error("=========================");
    res.status(500).json({
      success: false,
      message: data,
    });
  }
};

const bulkUploadImages = async (req, res) => {
  try {
    const files = req.files;
    const { companyId } = req.body;

    console.log("bulkUploadImages hit");

    if (!files || !files.length) {
      return res.status(400).json({ message: "No image files provided" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "Missing companyId" });
    }

    // Build multipart form
    const formData = new FormData();
    formData.append("companyId", companyId);

    files.forEach((file) => {
      formData.append("images", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    // Forward to Nomads backend
    const response = await axios.post(
      `${NOMADS_BASE}/company/bulk-add-company-images`,
      formData,
      { headers: formData.getHeaders() },
    );

    return res.status(200).json({
      success: true,
      message: response.data?.message || "Images uploaded successfully",
    });
  } catch (err) {
    console.error("[bulkUploadImages] error:", err.message);
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      "Image upload failed";
    return res.status(500).json({ success: false, message });
  }
};

const bulkReuploadImages = async (req, res) => {
  try {
    const files = req.files;
    const { companyId, businessId, companyType } = req.body;

    console.log("bulkReuploadImages hit");

    if (!files || !files.length) {
      return res.status(400).json({ message: "No image files provided" });
    }
    if (!companyId || !businessId || !companyType) {
      return res.status(400).json({
        message: "Missing required fields (companyId, businessId, companyType)",
      });
    }

    // Build the FormData payload
    const formData = new FormData();
    formData.append("companyId", companyId);
    formData.append("businessId", businessId);
    formData.append("companyType", companyType);

    files.forEach((file) => {
      formData.append("images", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    // Forward to Nomads backend
    const response = await axios.patch(
      `${NOMADS_BASE}/company/bulk-edit-company-images`,
      formData,
      { headers: formData.getHeaders() },
    );

    return res.status(200).json({
      success: true,
      message: response.data?.message || "Images reuploaded successfully",
    });
  } catch (err) {
    console.error("[bulkReuploadImages] error:", err.message);
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      "Image reupload failed";
    return res.status(500).json({ success: false, message });
  }
};

const uploadCompanyLogo = async (req, res) => {
  try {
    const file = req.file;
    const { companyId, type } = req.body;

    console.log("uploadSingleImage hit");

    if (!file) {
      return res.status(400).json({ message: "No image provided" });
    }
    if (!companyId) {
      return res.status(400).json({ message: "Missing companyId" });
    }
    if (!type) {
      return res
        .status(400)
        .json({ message: "Missing image type (logo/image)" });
    }

    // Build FormData for Nomads
    const formData = new FormData();
    formData.append("companyId", companyId);
    formData.append("type", type);
    formData.append("image", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // Forward to Nomads backend
    const response = await axios.post(
      `${NOMADS_BASE}/company/add-company-image`,
      formData,
      { headers: formData.getHeaders() },
    );

    return res.status(200).json({
      success: true,
      message: response.data?.message || "Image uploaded successfully",
    });
  } catch (err) {
    console.error(
      "[uploadSingleImage] error:",
      err.response?.data || err.message,
    );
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      "Image upload failed";
    return res
      .status(err.response?.status || 500)
      .json({ success: false, message });
  }
};

// ---- Website leads / reviews helpers (mirrors HostPanel's controllers) ----

const sanitizeValue = (value) => String(value || "").trim();
const isSyntheticCompanyId = (value) => sanitizeValue(value).includes("-dev-");

const resolveCompanyIdFromWorkspace = async (workspaceId) => {
  const normalizedWorkspaceId = sanitizeValue(workspaceId);
  if (!normalizedWorkspaceId) return "";

  const template = await WebsiteTemplate.findOne({
    workspaceId: normalizedWorkspaceId,
  })
    .select("companyId")
    .lean()
    .exec();
  const templateCompanyId = sanitizeValue(template?.companyId);
  if (templateCompanyId && !isSyntheticCompanyId(templateCompanyId)) {
    return templateCompanyId;
  }

  const workspace = await Workspace.findById(normalizedWorkspaceId)
    .select("company companyId")
    .lean()
    .exec();
  if (workspace?.company) {
    const linkedCompany = await HostCompany.findById(workspace.company)
      .select("companyId")
      .lean()
      .exec();
    const linkedCompanyId = sanitizeValue(linkedCompany?.companyId);
    if (linkedCompanyId) return linkedCompanyId;
  }

  return sanitizeValue(workspace?.companyId);
};

const resolveTemplateFromRequest = async (req) => {
  const workspaceId = sanitizeValue(req.query?.workspaceId || req.body?.workspaceId);
  const companyId = sanitizeValue(req.query?.companyId || req.body?.companyId);
  const companyName = sanitizeValue(req.query?.companyName || req.body?.companyName);
  const searchKey = sanitizeValue(req.query?.searchKey || req.body?.searchKey);
  const filters = [];

  if (workspaceId) filters.push({ workspaceId });
  if (companyId) filters.push({ companyId });
  if (searchKey) filters.push({ searchKey: searchKey.toLowerCase() });
  if (companyName) {
    filters.push({
      companyName: {
        $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });
  }

  if (!filters.length) return null;
  return WebsiteTemplate.findOne({ $or: filters })
    .select("companyId workspaceId searchKey companyName")
    .lean()
    .exec();
};

const resolveCanonicalCompanyId = async (req) => {
  const requestedCompanyId = sanitizeValue(
    req.query?.companyId || req.body?.companyId,
  );
  const requestedWorkspaceId = sanitizeValue(
    req.query?.workspaceId || req.body?.workspaceId,
  );
  const template = await resolveTemplateFromRequest(req);
  const candidates = [
    sanitizeValue(template?.companyId),
    template?.workspaceId
      ? await resolveCompanyIdFromWorkspace(template.workspaceId)
      : "",
    requestedWorkspaceId
      ? await resolveCompanyIdFromWorkspace(requestedWorkspaceId)
      : "",
    requestedCompanyId,
  ].filter(Boolean);

  const stableCandidate = candidates.find(
    (value) => !isSyntheticCompanyId(value),
  );
  return stableCandidate || candidates[0] || "";
};

const parseReviewList = (response) => {
  const reviews =
    response?.data?.reviews ??
    response?.data?.data?.reviews ??
    response?.data?.data ??
    response?.data;
  return Array.isArray(reviews) ? reviews : [];
};

const parseListingList = (response) => {
  const listings =
    response?.data?.listings ?? response?.data?.data ?? response?.data;
  return Array.isArray(listings) ? listings : [];
};

const getReviewCompanyRecordId = (review) =>
  sanitizeValue(review?.company?._id || review?.company);

const isWebsiteReviewRecord = (review) => {
  const source = sanitizeValue(review?.source).toLowerCase();
  const reviewSource = sanitizeValue(review?.reviewSource).toLowerCase();

  if (reviewSource.includes("nomad")) return false;
  if (reviewSource === "website reviews") return true;

  return ["website", "website form", "website preview", "website reviews"].includes(
    source,
  );
};

const getWebsiteLeads = async (req, res, next) => {
  try {
    const companyId = await resolveCanonicalCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        message: "Company ID is required (or provide a valid workspaceId)",
      });
    }

    const leads = await axios.get(`${NOMADS_BASE}/company/leads`, {
      params: { companyId },
    });
    return res.status(200).json(Array.isArray(leads?.data) ? leads.data : []);
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      message:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch leads from Nomads",
    });
  }
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveLeadEscalationWorkspace = async ({ workspaceId, companyId, companyName }) => {
  const requestedWorkspaceId = sanitizeValue(workspaceId);
  if (requestedWorkspaceId && mongoose.Types.ObjectId.isValid(requestedWorkspaceId)) {
    const requestedWorkspace = await Workspace.findOne({
      _id: requestedWorkspaceId,
      isActive: { $ne: false },
    })
      .select("_id companyId businessName")
      .lean();
    if (requestedWorkspace) return requestedWorkspace;
  }

  const normalizedCompanyId = sanitizeValue(companyId);
  const normalizedCompanyName = sanitizeValue(companyName);
  const companyNameRegex = normalizedCompanyName
    ? new RegExp(`^${escapeRegex(normalizedCompanyName)}$`, "i")
    : null;
  const hostLeadFilters = [];
  if (normalizedCompanyId) {
    hostLeadFilters.push(
      { linkedNomadsCompanyId: normalizedCompanyId },
      { companyId: normalizedCompanyId },
    );
  }
  if (companyNameRegex) hostLeadFilters.push({ companyName: companyNameRegex });

  const hostLeadCompany = hostLeadFilters.length
    ? await HostLeadCompany.findOne({ $or: hostLeadFilters }).lean()
    : null;
  const candidateCompanyIds = Array.from(
    new Set(
      [hostLeadCompany?.companyId, normalizedCompanyId]
        .map(sanitizeValue)
        .filter(Boolean),
    ),
  );

  const hostCompanyFilters = candidateCompanyIds.map((value) => ({ companyId: value }));
  if (companyNameRegex) hostCompanyFilters.push({ companyName: companyNameRegex });
  const hostCompany = hostCompanyFilters.length
    ? await HostCompany.findOne({ $or: hostCompanyFilters }).select("_id companyId").lean()
    : null;

  const workspaceFilters = candidateCompanyIds.map((value) => ({ companyId: value }));
  if (hostCompany?._id) workspaceFilters.push({ company: hostCompany._id });
  if (companyNameRegex) workspaceFilters.push({ businessName: companyNameRegex });

  if (!workspaceFilters.length) return null;
  return Workspace.findOne({
    isActive: { $ne: false },
    $or: workspaceFilters,
  })
    .select("_id companyId businessName")
    .lean();
};

const escalateWebsiteLeadToHostPanel = async (req, res, next) => {
  try {
    const { leadId, companyId, companyName, workspaceId } = req.body || {};
    const normalizedLeadId = sanitizeValue(leadId);

    if (!mongoose.Types.ObjectId.isValid(normalizedLeadId)) {
      return res.status(400).json({ message: "A valid leadId is required" });
    }

    const workspace = await resolveLeadEscalationWorkspace({
      workspaceId,
      companyId,
      companyName,
    });

    if (!workspace?._id) {
      return res.status(409).json({
        message: "No active HostPanel workspace is linked to this lead's company",
      });
    }

    const response = await axios.patch(`${NOMADS_BASE}/company/escalate-lead`, {
      leadId: normalizedLeadId,
      workspaceId: String(workspace._id),
      hostCompanyId: sanitizeValue(workspace.companyId),
      escalatedBy: sanitizeValue(req.userData?._id || req.user?._id),
    });

    req.logContext = {
      ...(req.logContext || {}),
      action: "escalate-lead-to-host-panel",
      changes: [
        { field: "isEscalated", type: "boolean", change: "edited", to: true },
        {
          field: "escalatedWorkspaceId",
          type: "text",
          change: "edited",
          to: String(workspace._id),
        },
      ],
    };

    return res.status(200).json({
      message: response?.data?.message || "Lead escalated to HostPanel successfully",
      lead: response?.data?.lead,
    });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      message:
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to escalate lead to HostPanel",
    });
  }
};

const updateWebsiteLead = async (req, res, next) => {
  try {
    const { status = "", comment = "", leadId } = req.body;

    if (!leadId || (!sanitizeValue(status) && !sanitizeValue(comment))) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    try {
      const leads = await axios.patch(
        `${NOMADS_BASE}/company/update-lead`,
        req.body,
      );

      if (leads.status !== 200)
        return res.status(200).json({ message: "No leads found" });
    } catch (error) {
      return res.status(error.response?.status || 500).json({
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to update lead",
      });
    }

    req.logContext = {
      ...(req.logContext || {}),
      action: "update-website-lead",
      changes: [
        ...(sanitizeValue(status)
          ? [{ field: "status", type: "status", change: "edited", to: status }]
          : []),
        ...(sanitizeValue(comment)
          ? [{ field: "comment", type: "text", change: "edited", to: comment }]
          : []),
      ],
    };

    return res
      .status(200)
      .json({ message: `Lead ${comment ? "comment" : "status"} updated` });
  } catch (error) {
    next(error);
  }
};

const updateReviewStatus = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { status, isEnabled } = req.body || {};
    const hasStatusUpdate = typeof status === "string";
    const hasVisibilityUpdate = typeof isEnabled === "boolean";
    const data = {
      ...(hasStatusUpdate ? { status } : {}),
      ...(hasVisibilityUpdate ? { isEnabled } : {}),
      userType: "MASTER",
      userId: req.userData._id,
      date: new Date(),
    };

    if (!reviewId) {
      return res.status(400).json({ message: "Review id is required" });
    }

    if (!hasStatusUpdate && !hasVisibilityUpdate) {
      return res.status(400).json({
        message: "Review status or isEnabled value is required",
      });
    }

    const allowedStatuses = ["approved", "rejected"];
    if (hasStatusUpdate && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid review status" });
    }

    let response = {};
    try {
      response = await axios.patch(
        `${NOMADS_BASE}/review/website-review/${reviewId}`,
        data,
      );

      if (![200, 204].includes(response.status)) {
        return res
          .status(400)
          .json({ message: `Failed to update review status` });
      }
    } catch (err) {
      return res.status(err.response?.status || 500).json({
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to update review",
      });
    }

    const reviewScope = String(req.body?.reviewScope || "").toLowerCase();
    req.logContext = {
      ...(req.logContext || {}),
      action: "update-review-status",
      ...(reviewScope === "nomads"
        ? { module: "Nomad Reviews" }
        : reviewScope === "website"
          ? { module: "Website Reviews" }
          : {}),
      changes: [
        ...(hasStatusUpdate
          ? [{ field: "status", type: "status", change: "edited", to: status }]
          : []),
        ...(hasVisibilityUpdate
          ? [
              {
                field: "isEnabled",
                type: "status",
                change: "edited",
                to: isEnabled ? "enabled" : "disabled",
              },
            ]
          : []),
      ],
    };

    return res.status(200).json({
      message: hasVisibilityUpdate
        ? `Review ${isEnabled ? "enabled" : "disabled"} successfully`
        : `Review ${status} successfully`,
      review: response.data.review,
    });
  } catch (error) {
    next(error);
  }
};

const getReviewsByCompany = async (req, res, next) => {
  try {
    const {
      companyType = "",
      status,
      reviewScope = "",
    } = req.query;
    const normalizedReviewScope = sanitizeValue(reviewScope).toLowerCase();
    const companyId = await resolveCanonicalCompanyId(req);

    if (!companyId) {
      return res.status(400).json({ message: "Company Id is required" });
    }
    // Preserve the original default (pending) for the legacy nomads reviews
    // page; scoped requests (website/nomads) fetch every status like the
    // host panel does.
    const effectiveStatus =
      typeof status === "string"
        ? sanitizeValue(status)
        : normalizedReviewScope
          ? ""
          : "pending";

    let response;
    let enrichedReviews = [];
    try {
      response = await axios.get(`${NOMADS_BASE}/review`, {
        params: {
          companyId,
          companyType,
          ...(effectiveStatus ? { status: effectiveStatus } : {}),
        },
      });

      if (![200, 204].includes(response.status)) {
        return res.status(400).json({ message: `Failed to fetch reviews` });
      }

      const reviews = parseReviewList(response);

      const adminIds = new Set();
      const hostIds = new Set();

      for (const r of reviews) {
        if (r.approvedBy?.userId) {
          r.approvedBy.userType === "MASTER"
            ? adminIds.add(r.approvedBy.userId)
            : hostIds.add(r.approvedBy.userId);
        }

        if (r.rejectedBy?.userId) {
          r.rejectedBy.userType === "MASTER"
            ? adminIds.add(r.rejectedBy.userId)
            : hostIds.add(r.rejectedBy.userId);
        }
      }

      const [admins, hosts] = await Promise.all([
        AdminUser.find({ _id: { $in: [...adminIds] } })
          .select("_id firstName lastName email")
          .lean(),
        HostUser.find({ _id: { $in: [...hostIds] } })
          .select("_id name phone email")
          .lean(),
      ]);

      const adminMap = Object.fromEntries(
        admins.map((a) => [a._id.toString(), a]),
      );
      const hostMap = Object.fromEntries(
        hosts.map((h) => [h._id.toString(), h]),
      );

      enrichedReviews = reviews.map((r) => ({
        ...r,
        approvedBy: r.approvedBy
          ? {
              ...r.approvedBy,
              user:
                r.approvedBy.userType === "MASTER"
                  ? adminMap[r.approvedBy.userId]
                  : hostMap[r.approvedBy.userId],
            }
          : null,
        rejectedBy: r.rejectedBy
          ? {
              ...r.rejectedBy,
              user:
                r.rejectedBy.userType === "MASTER"
                  ? adminMap[r.rejectedBy.userId]
                  : hostMap[r.rejectedBy.userId],
            }
          : null,
      }));
    } catch (err) {
      return res.status(err.response?.status || 500).json({
        message:
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to fetch reviews from Nomads",
      });
    }

    if (!normalizedReviewScope) {
      return res.status(200).json({
        reviews: enrichedReviews,
      });
    }

    if (normalizedReviewScope === "website") {
      enrichedReviews = enrichedReviews.filter(isWebsiteReviewRecord);
    } else if (normalizedReviewScope === "nomads") {
      enrichedReviews = enrichedReviews.filter(
        (review) => !isWebsiteReviewRecord(review),
      );

      try {
        const listingsResponse = await axios.get(
          `${NOMADS_BASE}/company/get-listings/${encodeURIComponent(companyId)}`,
        );
        const listingTypeById = new Map(
          parseListingList(listingsResponse)
            .map((listing) => [
              sanitizeValue(listing?._id),
              sanitizeValue(listing?.companyType),
            ])
            .filter(([listingId]) => Boolean(listingId)),
        );

        enrichedReviews = enrichedReviews.map((review) => ({
          ...review,
          companyType:
            listingTypeById.get(getReviewCompanyRecordId(review)) ||
            sanitizeValue(review?.companyType),
        }));
      } catch {
        // Reviews still load if the Nomads listing lookup is unavailable.
      }
    }

    return res.status(200).json({
      reviews: enrichedReviews,
    });
  } catch (error) {
    next(error);
  }
};

const updateRegistrationStatus = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { status } = req.body;

    if (!companyId || typeof status !== "boolean") {
      return res
        .status(400)
        .json({ message: "Missing or invalid required fields" });
    }

    let updateCompany = await HostCompany.findOneAndUpdate(
      { companyId },
      { isRegistered: status },
      { new: true },
    ).lean();

    if (!updateCompany) {
      updateCompany = await HostLeadCompany.findOneAndUpdate(
        { companyId },
        { isRegistered: status },
        { new: true },
      ).lean();
    }

    if (!updateCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    return res.status(200).json({
      message: `Company ${status ? "registered" : "unregistered"} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  verifyPassword,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkReuploadImages,
  uploadCompanyLogo,
  updateReviewStatus,
  updateRegistrationStatus,
  getReviewsByCompany,
  getWebsiteLeads,
  escalateWebsiteLeadToHostPanel,
  updateWebsiteLead,
};
