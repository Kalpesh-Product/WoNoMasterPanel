const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    module: {
      type: String,
    },
    page: {
      type: String,
    },
    changes: {
      type: [Object],
      default: undefined,
    },
    creditsUsed: {
      type: Number,
    },
    creditsRemaining: {
      type: Number,
    },
    publishState: {
      type: String, // "draft" | "published"
    },
    companyName: {
      type: String,
    },
    companyId: {
      type: String,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    payload: {
      type: Object,
    },
    ipAddress: {
      type: String,
    },
    statusCode: {
      type: String,
    },
    method: {
      type: String,
    },
    success: {
      type: Boolean,
    },
    responseTime: {
      type: Number, //milliseconds
    },
  },
  {
    timestamps: true,
  }
);

const Log = mongoose.model("Log", logSchema);
module.exports = Log;
