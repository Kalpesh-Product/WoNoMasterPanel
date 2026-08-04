const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's StateWiseWeight (destination) schema —
// only the fields this panel needs to label a user's favorite destinations.
const stateWiseWeightSchema = new mongoose.Schema(
  {
    title: String,
    state: String,
    country: String,
    continent: String,
  },
  { strict: false, collection: "statewiseweights" },
);

const StateWiseWeight = getNomadsConnection().model("StateWiseWeight", stateWiseWeightSchema);

module.exports = StateWiseWeight;
