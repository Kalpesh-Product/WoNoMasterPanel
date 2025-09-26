const mongoose = require("mongoose");

const hostCompanySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      unique: true,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    registeredEntityName: {
      type: String,
      trim: true,
    },

    industry: {
      type: String,
      trim: true,
    },
    companySize: {
      type: String,
      trim: true,
    },
    companyCity: {
      type: String,
      trim: true,
    },
    companyState: {
      type: String,
      trim: true,
    },
    companyCountry: {
      type: String,
      trim: true,
    },
    websiteLink: {
      type: String,
      trim: true,
    },
    linkedinURL: {
      type: String,
      trim: true,
    },
    selectedServices: {
      apps: {
        type: [
          {
            appName: { type: String },
            isActive: { type: Boolean, default: false },
            isRequested: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
      modules: {
        type: [
          {
            moduleName: { type: String },
            isActive: { type: Boolean, default: false },
            isRequested: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
      defaults: {
        type: [
          {
            name: { type: String, required: true },
            isActive: { type: Boolean, default: true },
            isRequested: { type: Boolean, default: true },
          },
        ],
        default: [
          { name: "websiteBuilder", isActive: true, isRequested: true },
          { name: "leadGeneration", isActive: true, isRequested: true },
          { name: "automatedGoogleSheets", isActive: true, isRequested: true },
        ],
      },
    },

    isRegistered: {
      type: Boolean,
      default: false,
    },
    isWebsiteTemplate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const HostCompany = mongoose.model("HostCompany", hostCompanySchema);
module.exports = HostCompany;
