const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's NomadListingView schema — records
// which specific company/listing a signed-in user opened.
const nomadListingViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "NomadUser" },
    companyId: String,
    businessId: String,
    companyName: String,
    city: String,
    state: String,
    country: String,
    continent: String,
  },
  { timestamps: true, strict: false, collection: "nomadlistingviews" },
);

const NomadListingView = getNomadsConnection().model(
  "NomadListingView",
  nomadListingViewSchema,
);

module.exports = NomadListingView;
