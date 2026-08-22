// Read-only passthrough models for collections owned by the HostPanel
// codebase (same shared MongoDB database — see server/.env DB_URL, which
// points at the same cluster/db as HostPanel's server/.env). These exist so
// the master panel can compute the exact same per-module analytics HostPanel
// shows its own users (server/controllers/analyticsController.ts over there),
// without depending on — or risking drift from — master panel's own
// same-domain models, which serve different screens and may not track every
// field HostPanel's analytics engine reads.
//
// Each schema is intentionally `{ strict: false }`: we only ever read from
// these collections here, so there is no need to declare (and keep in sync)
// every field HostPanel's real schema has. Collection names below were
// confirmed against the live database, not guessed from pluralization.
const mongoose = require("mongoose");

const passthrough = (modelName, collectionName) => {
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const schema = new mongoose.Schema({}, { strict: false });
  return mongoose.model(modelName, schema, collectionName);
};

module.exports = {
  Ticket: passthrough("HPA_Ticket", "tickets"),
  SupportTicket: passthrough("HPA_SupportTicket", "supporttickets"),
  MeetingRoomBooking: passthrough("HPA_MeetingRoomBooking", "meetingroombookings"),
  Holiday: passthrough("HPA_Holiday", "holidays"),
  LeaveRequest: passthrough("HPA_LeaveRequest", "leaverequests"),
  Department: passthrough("HPA_Department", "departments"),
  EmployeeProfile: passthrough("HPA_EmployeeProfile", "employeeprofiles"),
  Asset: passthrough("HPA_Asset", "assets"),
  AssetRequest: passthrough("HPA_AssetRequest", "assetrequests"),
  HostWorkspaceMember: passthrough("HPA_WorkspaceMember", "workspacemembers"),
  MemberInvite: passthrough("HPA_MemberInvite", "memberinvites"),
  Role: passthrough("HPA_Role", "roles"),
  VisitorLog: passthrough("HPA_VisitorLog", "visitorlogs"),
  WebsiteLead: passthrough("HPA_WebsiteLead", "websiteleads"),
  WebsiteReview: passthrough("HPA_WebsiteReview", "websitereviews"),
  TenantCompany: passthrough("HPA_TenantCompany", "tenantcompanies"),
  Resource: passthrough("HPA_Resource", "resources"),
  ResignationRequest: passthrough("HPA_ResignationRequest", "exitrequests"),
  Task: passthrough("HPA_Task", "tasks"),
  Attendance: passthrough("HPA_Attendance", "attendances"),
  Inventory: passthrough("HPA_Inventory", "inventories"),
  FinanceTransaction: passthrough("HPA_FinanceTransaction", "financetransactions"),
  FinanceExpense: passthrough("HPA_FinanceExpense", "financeexpenses"),
  FinanceVendor: passthrough("HPA_FinanceVendor", "financevendors"),
  Report: passthrough("HPA_Report", "reports"),
  DepartmentDocument: passthrough("HPA_DepartmentDocument", "departmentdocuments"),
  RecruitmentJobOpening: passthrough("HPA_RecruitmentJobOpening", "recruitmentjobopenings"),
  RecruitmentCandidate: passthrough("HPA_RecruitmentCandidate", "recruitmentcandidates"),
  PayrollCycle: passthrough("HPA_PayrollCycle", "payrollcycles"),
  PayrollEntry: passthrough("HPA_PayrollEntry", "payrollentries"),
  HousekeepingTask: passthrough("HPA_HousekeepingTask", "housekeepingtasks"),
  HousekeepingStaff: passthrough("HPA_HousekeepingStaff", "housekeepingstaffs"),
  DepartmentFinancePlan: passthrough("HPA_DepartmentFinancePlan", "departmentfinanceplans"),
  AnnualFinanceRequest: passthrough("HPA_AnnualFinanceRequest", "annualfinancerequests"),
  ExtraFinanceRequest: passthrough("HPA_ExtraFinanceRequest", "extrafinancerequests"),
  TenantCreditRequest: passthrough("HPA_TenantCreditRequest", "tenantcreditrequests"),
  RepairLog: passthrough("HPA_RepairLog", "repairlogs"),
  MaintenanceSchedule: passthrough("HPA_MaintenanceSchedule", "maintenanceschedules"),
  WebsiteTemplate: passthrough("HPA_WebsiteTemplate", "websitetemplates"),
};
