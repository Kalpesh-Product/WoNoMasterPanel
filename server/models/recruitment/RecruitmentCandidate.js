const mongoose = require("mongoose");

const recruitmentStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, trim: true, default: "Applied" },
    note: { type: String, trim: true, default: "" },
    changedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      default: null,
    },
    changedByName: { type: String, trim: true, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recruitmentEmailHistorySchema = new mongoose.Schema(
  {
    templateType: { type: String, trim: true, default: "status_update" },
    subject: { type: String, trim: true, default: "" },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    sentByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      default: null,
    },
    sentByName: { type: String, trim: true, default: "" },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recruitmentResumeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    publicId: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recruitmentCandidateSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    candidateCode: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      index: true,
    },
    firstName: { type: String, trim: true, required: true, maxlength: 80 },
    middleName: { type: String, trim: true, default: "", maxlength: 80 },
    lastName: { type: String, trim: true, required: true, maxlength: 80 },
    fullName: {
      type: String,
      trim: true,
      required: true,
      maxlength: 180,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 160,
      index: true,
    },
    phone: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "", index: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    jobCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },
    positionApplied: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
      index: true,
    },
    sourceType: { type: String, trim: true, default: "Walk-in", index: true },
    sourceReference: { type: String, trim: true, default: "" },
    sourceNotes: { type: String, trim: true, default: "" },
    contactMethod: { type: String, trim: true, default: "" },
    currentCompany: { type: String, trim: true, default: "" },
    dateOfBirth: { type: Date, default: null },
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    currentAddress: { type: String, trim: true, default: "" },
    earliestStartDate: { type: Date, default: null, index: true },
    availability: { type: String, trim: true, default: "Full-time" },
    experience: { type: String, trim: true, default: "" },
    expectedSalary: { type: String, trim: true, default: "" },
    education: { type: String, trim: true, default: "" },
    employmentHistory: { type: String, trim: true, default: "" },
    skills: { type: String, trim: true, default: "" },
    certifications: { type: String, trim: true, default: "" },
    coverLetter: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    customFields: { type: String, trim: true, default: "" },
    status: { type: String, trim: true, default: "Applied", index: true },
    statusReason: { type: String, trim: true, default: "" },
    appliedAt: { type: Date, default: Date.now, index: true },
    statusUpdatedAt: { type: Date, default: Date.now },
    selectedAt: { type: Date, default: null },
    hiredAt: { type: Date, default: null },
    convertedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeeProfile",
      default: null,
      index: true,
    },
    resume: { type: recruitmentResumeSchema, default: () => ({}) },
    emailHistory: { type: [recruitmentEmailHistorySchema], default: [] },
    statusHistory: { type: [recruitmentStatusHistorySchema], default: [] },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      default: null,
    },
    createdByName: { type: String, trim: true, default: "" },
    updatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostUser",
      default: null,
    },
    updatedByName: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

recruitmentCandidateSchema.index(
  { workspaceId: 1, candidateCode: 1 },
  { unique: true },
);
recruitmentCandidateSchema.index({
  workspaceId: 1,
  email: 1,
  positionApplied: 1,
});
recruitmentCandidateSchema.index({
  workspaceId: 1,
  status: 1,
  updatedAt: -1,
});

const RecruitmentCandidate =
  mongoose.models.RecruitmentCandidate ||
  mongoose.model("RecruitmentCandidate", recruitmentCandidateSchema);

module.exports = RecruitmentCandidate;
