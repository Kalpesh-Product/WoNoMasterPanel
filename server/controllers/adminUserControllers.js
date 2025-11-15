const bcrypt = require("bcryptjs/dist/bcrypt");
const AdminUser = require("../models/AdminUser");
const { default: mongoose } = require("mongoose");
const { default: axios } = require("axios");
const FormData = require("form-data");

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

const NOMADS_BASE = "https://wononomadsbe.vercel.app/api";
// const NOMADS_BASE = "http://localhost:3000/api";

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

  console.log("bulk upload hit");
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
      { headers: formData.getHeaders() }
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
      { headers: formData.getHeaders() }
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
      { headers: formData.getHeaders() }
    );

    return res.status(200).json({
      success: true,
      message: response.data?.message || "Image uploaded successfully",
    });
  } catch (err) {
    console.error("[uploadSingleImage] error:", err.message);
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      "Image upload failed";
    return res.status(500).json({ success: false, message });
  }
};

module.exports = {
  updateProfile,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkReuploadImages,
  uploadCompanyLogo,
};
