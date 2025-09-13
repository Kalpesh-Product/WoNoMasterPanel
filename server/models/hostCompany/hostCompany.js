import mongoose from "mongoose";

const hostCompanySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      unique: true,
      required: true,
    },
    country: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
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
    companyType: {
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
    websiteURL: {
      type: String,
      trim: true,
    },
    linkedinURL: {
      type: String,
      trim: true,
    },
    selectedServices: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const HostCompany = mongoose.model("HostCompany", hostCompanySchema);
export default HostCompany;
