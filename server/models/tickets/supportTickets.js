const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      required: true,
    },
    ticketId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    workspace: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      trim: true,
      default: "",
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      default: null,
    },
    acceptedByName: {
      type: String,
      trim: true,
      default: "",
    },
    acceptedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      trim: true,
      enum: [
        "Open",
        "Accepted",
        "In Progress",
        "Pending",
        "Closed",
        "Rejected",
      ],
      default: "Open",
    },
    image: {
      id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    resolutionMessage: {
      type: String,
      trim: true,
      default: "",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserData",
      default: null,
    },
    resolvedByName: {
      type: String,
      trim: true,
      default: "",
    },
    resolvedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
module.exports = SupportTicket;
