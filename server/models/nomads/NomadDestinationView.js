const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's NomadDestinationView schema — records
// which destination (continent/country/state) a signed-in user viewed.
const nomadDestinationViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "NomadUser" },
    continent: String,
    country: String,
    state: String,
    title: String,
  },
  { timestamps: true, strict: false, collection: "nomaddestinationviews" },
);

const NomadDestinationView = getNomadsConnection().model(
  "NomadDestinationView",
  nomadDestinationViewSchema,
);

module.exports = NomadDestinationView;
