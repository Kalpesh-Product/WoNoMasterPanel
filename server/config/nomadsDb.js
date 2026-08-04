const mongoose = require("mongoose");

// Separate connection to the Nomads project's own MongoDB cluster (a
// different deployment from this app's primary DB_URL) so the master panel
// can read collections like `nomadusers` directly, read-only.
let nomadsConnection = null;

const getNomadsConnection = () => {
  if (!nomadsConnection) {
    nomadsConnection = mongoose.createConnection(process.env.NOMADS_DB_URL);
    nomadsConnection.on("error", (error) => {
      console.error("[nomadsDb] connection error:", error.message);
    });
  }
  return nomadsConnection;
};

module.exports = { getNomadsConnection };
