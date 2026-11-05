const mongoose = require("mongoose");

const wonoDestinationListingSchema = new mongoose.Schema(
  {
    destination: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: ["Coworking", "Coliving", "Cafe", "Hostel", "Meeting Room"] },
    businessName: { type: String, required: true, trim: true },
    continent: { type: String, trim: true },
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    website: { type: String, trim: true },
    address: { type: String, trim: true },
    about: { type: String, trim: true },
    googleMapUrl: { type: String, trim: true },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    inclusion: { type: String, trim: true },
    hasWebsite: { type: Boolean, default: false },
    hasInstagram: { type: Boolean, default: false },
    hasFacebook: { type: Boolean, default: false },
    nearAirport: { type: Boolean, default: false },
    airportName: { type: String, trim: true },
    airportMapUrl: { type: String, trim: true },
    email: { type: String, trim: true },
    contact: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    businessStatus: { type: String, default: "Active" },
    status: { type: String, default: "New" },
    owner: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    nextAction: { type: String, trim: true, default: "PENDING" },
    plan: { type: String, trim: true, default: "Select" },
    dateOfActivation: { type: Date, default: null },
    scoring: {
      needScore: { type: Number, default: 0 },
      categoryFitScore: { type: Number, default: 0 },
      businessActivityScore: { type: Number, default: 0 },
      finalScore: { type: Number, default: 0 },
      priority: { type: String, enum: ["High Opportunity", "Medium Opportunity", "Lower Opportunity"] },
      digitalGaps: { type: Number, default: 0 },
      recommendedPitch: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

wonoDestinationListingSchema.index({ destination: 1, category: 1 });

module.exports = mongoose.model("WonoDestinationListing", wonoDestinationListingSchema);
