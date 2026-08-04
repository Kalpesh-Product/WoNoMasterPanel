const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's own NomadUser schema (defined in the
// separate Nomads backend repo). `strict: false` so any field present on the
// document surfaces here even if this list drifts from that schema.
const nomadUserSchema = new mongoose.Schema(
  {
    fullName: String,
    firstName: String,
    lastName: String,
    email: String,
    country: String,
    countryOfResidence: String,
    state: String,
    mobile: String,
    salary: String,
    designation: String,
    contactCode: String,
    contactNumber: String,
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "Company" }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Company" }],
    favoriteDestination: [{ type: mongoose.Schema.Types.ObjectId, ref: "StateWiseWeight" }],
  },
  { timestamps: true, strict: false, collection: "nomadusers" },
);

const NomadUser = getNomadsConnection().model("NomadUser", nomadUserSchema);

module.exports = NomadUser;
