const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's Company schema — only the fields this
// panel needs to label a user's saved/liked listings.
const companySchema = new mongoose.Schema(
  {
    companyName: String,
    city: String,
    state: String,
    country: String,
  },
  { strict: false, collection: "companies" },
);

const Company = getNomadsConnection().model("Company", companySchema);

module.exports = Company;
