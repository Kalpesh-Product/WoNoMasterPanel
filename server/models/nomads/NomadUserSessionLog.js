const mongoose = require("mongoose");
const { getNomadsConnection } = require("../../config/nomadsDb");

// Read-only mirror of the Nomads app's NomadUserSessionLog schema — records
// every login/logout event for a Nomad user.
const nomadUserSessionLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "NomadUser" },
    event: { type: String, enum: ["login", "logout"] },
  },
  { timestamps: true, strict: false, collection: "nomadusersessionlogs" },
);

const NomadUserSessionLog = getNomadsConnection().model(
  "NomadUserSessionLog",
  nomadUserSessionLogSchema,
);

module.exports = NomadUserSessionLog;
