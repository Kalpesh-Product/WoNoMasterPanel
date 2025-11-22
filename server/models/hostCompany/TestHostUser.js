const mongoose = require("mongoose");

const testHostUserSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostCompany",
      required: true,
    },
    name: {
      type: String,
    },
    password: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    companyId: {
      type: String,
      // unique: true,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    linkedInProfile: {
      type: String,
    },
    languagesSpoken: {
      type: [String],
    },
    address: {
      type: String,
    },
    profileImage: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const TestHostUser = mongoose.model("TestHostUser", testHostUserSchema);
module.exports = TestHostUser;
