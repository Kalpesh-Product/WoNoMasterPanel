const mongoose = require("mongoose");

const TIER_VALUES = [94, 82, 68, 55, 40];

const wonoDestinationRankingSchema = new mongoose.Schema(
  {
    rank: { type: Number, default: null },
    priority: { type: String, enum: ["P1", "P2", "P3", "P4", null], default: null },
    destination: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    continent: { type: String, required: true, trim: true },
    score: { type: Number, default: null },
    isActive: { type: Boolean, default: false },
    factors: {
      targetBusinessSupply: { type: Number, min: 0, max: 100 },
      tourismAccommodationBase: { type: Number, min: 0, max: 100 },
      marketScale: { type: Number, min: 0, max: 100 },
      nomadDemandCommunity: { type: Number, min: 0, max: 100 },
      remoteWorkInfrastructure: { type: Number, min: 0, max: 100 },
      businessJobsEcosystem: { type: Number, min: 0, max: 100 },
      flightConnectivity: { type: Number, min: 0, max: 100 },
      affordability: { type: Number, min: 0, max: 100 },
      visaEntryAccessibility: { type: Number, min: 0, max: 100 },
      safetyHealthcare: { type: Number, min: 0, max: 100 },
    },
  },
  { timestamps: true },
);

wonoDestinationRankingSchema.statics.TIER_VALUES = TIER_VALUES;
wonoDestinationRankingSchema.statics.FACTOR_KEYS = [
  "targetBusinessSupply",
  "tourismAccommodationBase",
  "marketScale",
  "nomadDemandCommunity",
  "remoteWorkInfrastructure",
  "businessJobsEcosystem",
  "flightConnectivity",
  "affordability",
  "visaEntryAccessibility",
  "safetyHealthcare",
];

module.exports = mongoose.model("WonoDestinationRanking", wonoDestinationRankingSchema);
