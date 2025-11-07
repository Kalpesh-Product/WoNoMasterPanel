const bcrypt = require("bcryptjs/dist/bcrypt");
const AdminUser = require("../models/AdminUser");
const { default: mongoose } = require("mongoose");

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

const { default: axios } = require("axios");

// const NOMADS_BASE = "https://wononomadsbe.vercel.app/api";
const NOMADS_BASE = "http://localhost:3000/api";

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
  const file = req.file;

  console.log("bulk upload hit");
  if (!file) {
    return res.status(400).json({ message: "No file provided" });
  }

  if (!TYPE_MAP[kind]) {
    return res.status(400).json({ message: "Invalid upload kind" });
  }

  try {
    const formData = new FormData();
    formData.append(TYPE_MAP[kind].formKey, file.buffer, file.originalname);

    const response = await axios.post(TYPE_MAP[kind].api, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    res.status(200).json({
      success: true,
      message: response.data.message,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: log.message || "Upload failed",
    });
  }
};

module.exports = {
  updateProfile,
  changePassword,
  bulkUploadData,
};
