// Port of HostPanel's real per-module analytics engine
// (HostPanel/server/controllers/analyticsController.ts MODULE_STAT_PROVIDERS)
// so the Master Panel's "Host Panel Analytics" company view can show the
// exact same tickets/assets/tasks/etc. charts a company's own founder sees
// in Host Panel — computed straight from the shared collections, not
// reconstructed from activity logs.
//
// Generalized in one way HostPanel's original doesn't need: every provider
// here accepts `objectId`/`stringId` as either a single id (single-workspace
// view) or an array of ids (combined "All Units" view). `eqIn()` turns that
// into the right Mongo match value either way, so counts/rates/breakdowns
// computed with `$in` are already correct aggregates across every workspace
// — no separate per-workspace merge step needed.
const mongoose = require("mongoose");
const HostActivityLog = require("../models/HostActivityLog");
const {
  Ticket,
  SupportTicket,
  MeetingRoomBooking,
  Holiday,
  LeaveRequest,
  Department,
  EmployeeProfile,
  Asset,
  AssetRequest,
  HostWorkspaceMember: WorkspaceMember,
  MemberInvite,
  Role,
  VisitorLog,
  WebsiteLead,
  WebsiteReview,
  TenantCompany,
  Resource,
  ResignationRequest,
  Task,
  Attendance,
  Inventory,
  FinanceTransaction,
  FinanceExpense,
  FinanceVendor,
  Report,
  DepartmentDocument,
  RecruitmentJobOpening,
  RecruitmentCandidate,
  PayrollCycle,
  PayrollEntry,
  HousekeepingTask,
  HousekeepingStaff,
  DepartmentFinancePlan,
  AnnualFinanceRequest,
  ExtraFinanceRequest,
  TenantCreditRequest,
  RepairLog,
  MaintenanceSchedule,
  WebsiteTemplate,
} = require("../models/hostPanelAnalyticsModels");

const eqIn = (value) => (Array.isArray(value) ? { $in: value } : value);

const safeCount = async (model, filter) => {
  try {
    return await model.countDocuments(filter).lean().exec();
  } catch {
    return 0;
  }
};

const safeCountSum = async (queries) => {
  const results = await Promise.all(queries.map(({ model, filter }) => safeCount(model, filter)));
  return results.reduce((sum, value) => sum + (Number(value) || 0), 0);
};

const pct = (part, whole) => {
  const total = Number(whole) || 0;
  if (total <= 0) return null;
  return Math.round(((Number(part) || 0) / total) * 100);
};

const safeAvgHours = async (model, match, projectExpr) => {
  try {
    const rows = await model
      .aggregate([
        { $match: match },
        { $project: { diff: projectExpr } },
        { $match: { diff: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$diff" } } },
      ])
      .exec();
    if (!rows.length || !Number.isFinite(rows[0]?.avg)) return null;
    return Math.round((rows[0].avg / (1000 * 60 * 60)) * 10) / 10;
  } catch {
    return null;
  }
};

const computeActivityScore = ({ totalRecords, activeLast30Days }) => {
  const total = Number(totalRecords) || 0;
  const recent = Number(activeLast30Days) || 0;
  if (total <= 0) return 0;
  return Math.round(Math.min(60, recent * 6) + Math.min(40, Math.sqrt(total) * 6));
};

const buildMonthKeys = () => {
  const buckets = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-IN", { month: "short" }),
      count: 0,
    });
  }
  return buckets;
};

const TREND_SINCE = new Date(new Date().setMonth(new Date().getMonth() - 5, 1));

const mergeSeries = (seriesList) => {
  const monthKeys = buildMonthKeys();
  return monthKeys.map((bucket, index) => ({
    ...bucket,
    count: seriesList.reduce((sum, series) => sum + (Number(series?.[index]?.count) || 0), 0),
  }));
};

const monthlySeries = async (model, field, matchValue, extraMatch = {}) => {
  const monthKeys = buildMonthKeys();
  try {
    const rows = await model
      .aggregate([
        { $match: { [field]: eqIn(matchValue), createdAt: { $gte: TREND_SINCE }, ...extraMatch } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      ])
      .exec();
    const map = new Map(rows.map((row) => [row._id, row.count]));
    return monthKeys.map((bucket) => ({ ...bucket, count: Number(map.get(bucket.key)) || 0 }));
  } catch {
    return monthKeys;
  }
};

const leadEscalationFilter = (stringId) => ({
  isEscalated: true,
  escalatedWorkspaceId: eqIn(stringId),
});

const breakdownBy = async (model, base, field, labels) => {
  const values = await Promise.all(labels.map(({ value }) => safeCount(model, { ...base, [field]: value })));
  return labels
    .map(({ label, value }, index) => ({ label, value: Number(values[index]) || 0 }))
    .filter((segment) => segment.value > 0);
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INSIGHTS_SINCE = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

const hourLabel = (h) => {
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
};

const emptyInsights = () => ({
  byDay: DAY_LABELS.map((label) => ({ label, count: 0 })),
  byHour: Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), count: 0 })),
});

const finalizeInsights = (byDay, byHour) => ({ byDay, byHour });

const usageInsights = async (model, field, matchValue, extraMatch = {}) => {
  try {
    const rows = await model
      .aggregate([
        { $match: { [field]: eqIn(matchValue), createdAt: { $gte: INSIGHTS_SINCE }, ...extraMatch } },
        {
          $facet: {
            byDay: [{ $group: { _id: { $dayOfWeek: "$createdAt" }, count: { $sum: 1 } } }],
            byHour: [{ $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } }],
          },
        },
      ])
      .exec();
    const facet = rows[0] || {};
    const dayMap = new Map((facet.byDay ?? []).map((r) => [Number(r._id), Number(r.count) || 0]));
    const hourMap = new Map((facet.byHour ?? []).map((r) => [Number(r._id), Number(r.count) || 0]));
    return finalizeInsights(
      DAY_LABELS.map((label, i) => ({ label, count: dayMap.get(i + 1) || 0 })),
      Array.from({ length: 24 }, (_, h) => ({ label: hourLabel(h), count: hourMap.get(h) || 0 })),
    );
  } catch {
    return emptyInsights();
  }
};

const mergeInsights = (insightsList) => {
  const usable = (insightsList ?? []).filter(Boolean);
  if (!usable.length) return emptyInsights();
  return finalizeInsights(
    DAY_LABELS.map((label, i) => ({
      label,
      count: usable.reduce((sum, ins) => sum + (Number(ins.byDay?.[i]?.count) || 0), 0),
    })),
    Array.from({ length: 24 }, (_, h) => ({
      label: hourLabel(h),
      count: usable.reduce((sum, ins) => sum + (Number(ins.byHour?.[h]?.count) || 0), 0),
    })),
  );
};

const deptBreakdownBy = async (model, base, field, unwindArray = false) => {
  try {
    const pipeline = [{ $match: base }];
    if (unwindArray) pipeline.push({ $unwind: `$${field}` });
    pipeline.push({ $group: { _id: `$${field}`, count: { $sum: 1 } } });
    const rows = await model.aggregate(pipeline).exec();
    const filtered = rows.filter((row) => row._id !== null && row._id !== undefined && String(row._id).trim() !== "");
    if (!filtered.length) return [];
    const objectIds = filtered.map((row) => String(row._id)).filter((value) => mongoose.isValidObjectId(value));
    let nameMap = new Map();
    if (objectIds.length) {
      const depts = await Department.find({ _id: { $in: objectIds } }).select("name").lean().exec();
      nameMap = new Map(depts.map((dept) => [String(dept._id), dept.name || "Unnamed"]));
    }
    return filtered
      .map((row) => ({ label: nameMap.get(String(row._id)) || String(row._id), value: Number(row.count) || 0 }))
      .filter((segment) => segment.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  } catch {
    return [];
  }
};

const ACTIVITY_LOG_MODULE_NAMES = {
  tickets: "Tickets",
  "customer-support": "Customer Support",
  "meeting-room-system": "Meeting Rooms",
  calendar: "Calendar",
  assets: "Assets",
  "website-builder": "Website Builder",
  "website-leads": "Leads",
  "website-review": "Reviews",
  organization: "Organization",
  "visitors-management": "Visitors",
  "leads-management": "Leads",
  "tenant-companies-sales": "Tenant Companies",
  "resource-pricing": "Resources",
  "exit-management": "HR",
};

const activityEdits = async (workspaceStringId, moduleId, since = null) => {
  const moduleName = ACTIVITY_LOG_MODULE_NAMES[moduleId];
  if (!moduleName) return null;
  const filter = { workspaceId: eqIn(workspaceStringId), module: moduleName, success: true };
  if (since) filter.createdAt = { $gte: since };
  return safeCount(HostActivityLog, filter);
};

const MODULE_STAT_PROVIDERS = {
  tickets: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, open, inProgress, resolved, closed, avgResolutionHours, editsTotal, edits30, monthly, prioritySplit] =
      await Promise.all([
        safeCount(Ticket, base),
        safeCount(Ticket, { ...base, createdAt: { $gte: since30 } }),
        safeCount(Ticket, { ...base, status: "Open" }),
        safeCount(Ticket, { ...base, status: "In Progress" }),
        safeCount(Ticket, { ...base, status: "Resolved" }),
        safeCount(Ticket, { ...base, status: "Closed" }),
        safeAvgHours(Ticket, { workspaceId: eqIn(objectId), status: { $in: ["Resolved", "Closed"] } }, { $subtract: ["$updatedAt", "$createdAt"] }),
        activityEdits(objectId, "tickets"),
        activityEdits(objectId, "tickets", since30),
        monthlySeries(Ticket, "workspaceId", objectId),
        breakdownBy(Ticket, base, "priority", [
          { label: "Low", value: "Low" },
          { label: "Medium", value: "Medium" },
          { label: "High", value: "High" },
        ]),
      ]);
    const done = resolved + closed;
    return {
      totalRecords,
      activeLast30Days,
      openItems: open + inProgress,
      completionRate: pct(done, totalRecords),
      kpis: [
        { label: "Raised", value: totalRecords },
        { label: "Resolved", value: done },
        { label: "In queue", value: open + inProgress },
        { label: "Avg resolution", value: avgResolutionHours ?? "--", suffix: avgResolutionHours !== null ? "h" : "" },
        { label: "Updates logged", value: editsTotal ?? 0 },
        { label: "Updates (30d)", value: edits30 ?? 0 },
      ],
      breakdown: await breakdownBy(Ticket, base, "status", [
        { label: "Open", value: "Open" },
        { label: "In Progress", value: "In Progress" },
        { label: "Resolved", value: "Resolved" },
        { label: "Closed", value: "Closed" },
      ]),
      secondaryBreakdown: prioritySplit,
      monthly,
    };
  },

  "customer-support": async ({ objectId, since30 }) => {
    const base = { workspace: eqIn(objectId) };
    const [totalRecords, activeLast30Days, openItems, resolved, closed, avgResolutionHours, monthly] = await Promise.all([
      safeCount(SupportTicket, base),
      safeCount(SupportTicket, { ...base, createdAt: { $gte: since30 } }),
      safeCount(SupportTicket, { ...base, status: { $in: ["Open", "Accepted", "In Progress", "Pending", "Escalated"] } }),
      safeCount(SupportTicket, { ...base, status: "Resolved" }),
      safeCount(SupportTicket, { ...base, status: "Closed" }),
      safeAvgHours(SupportTicket, { workspace: eqIn(objectId), resolvedAt: { $ne: null } }, { $subtract: ["$resolvedAt", "$createdAt"] }),
      monthlySeries(SupportTicket, "workspace", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems,
      completionRate: pct(resolved + closed, totalRecords),
      kpis: [
        { label: "Raised", value: totalRecords },
        { label: "Resolved", value: resolved + closed },
        { label: "Pending", value: openItems },
        { label: "Avg resolution", value: avgResolutionHours ?? "--", suffix: avgResolutionHours !== null ? "h" : "" },
      ],
      breakdown: await breakdownBy(SupportTicket, base, "status", [
        { label: "Open", value: "Open" },
        { label: "Accepted", value: "Accepted" },
        { label: "In Progress", value: "In Progress" },
        { label: "Pending", value: "Pending" },
        { label: "Escalated", value: "Escalated" },
        { label: "Resolved", value: "Resolved" },
        { label: "Closed", value: "Closed" },
      ]),
      monthly,
    };
  },

  "meeting-room-system": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, upcoming, completed, cancelled, internal, external, tenant, monthly, statusSplit] = await Promise.all([
      safeCount(MeetingRoomBooking, base),
      safeCount(MeetingRoomBooking, { ...base, createdAt: { $gte: since30 } }),
      safeCount(MeetingRoomBooking, { ...base, status: { $in: ["pending", "confirmed", "in-progress"] } }),
      safeCount(MeetingRoomBooking, { ...base, status: "completed" }),
      safeCount(MeetingRoomBooking, { ...base, status: "cancelled" }),
      safeCount(MeetingRoomBooking, { ...base, bookingType: "Internal" }),
      safeCount(MeetingRoomBooking, { ...base, bookingType: "External" }),
      safeCount(MeetingRoomBooking, { ...base, bookingType: "Tenant" }),
      monthlySeries(MeetingRoomBooking, "workspaceId", objectId),
      breakdownBy(MeetingRoomBooking, base, "status", [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "In Progress", value: "in-progress" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Rescheduled", value: "rescheduled" },
      ]),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: upcoming,
      completionRate: pct(completed, totalRecords),
      kpis: [
        { label: "Bookings", value: totalRecords },
        { label: "Completed", value: completed },
        { label: "Upcoming", value: upcoming },
        { label: "Cancelled", value: cancelled },
      ],
      breakdown: [
        { label: "Internal", value: internal },
        { label: "External", value: external },
        { label: "Tenant", value: tenant },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: statusSplit,
      monthly,
    };
  },

  calendar: async ({ objectId }) => {
    const holidayBase = { workspaceId: eqIn(objectId), isActive: true };
    const leaveBase = { workspaceId: eqIn(objectId) };
    const [holidays, leaves, pendingLeaves, approvedLeaves, rejectedLeaves, monthlyLeaves, monthlyHolidays, durationSplit] = await Promise.all([
      safeCount(Holiday, holidayBase),
      safeCount(LeaveRequest, leaveBase),
      safeCount(LeaveRequest, { ...leaveBase, status: "pending" }),
      safeCount(LeaveRequest, { ...leaveBase, status: "approved" }),
      safeCount(LeaveRequest, { ...leaveBase, status: "rejected" }),
      monthlySeries(LeaveRequest, "workspaceId", objectId),
      monthlySeries(Holiday, "workspaceId", objectId, { isActive: true }),
      breakdownBy(LeaveRequest, leaveBase, "durationType", [
        { label: "Full Day", value: "full_day" },
        { label: "Half Day", value: "half_day" },
        { label: "Hours", value: "hours" },
      ]),
    ]);
    return {
      totalRecords: holidays + leaves,
      activeLast30Days: 0,
      openItems: pendingLeaves,
      completionRate: pct(approvedLeaves + rejectedLeaves, leaves),
      kpis: [
        { label: "Holidays", value: holidays },
        { label: "Leave requests", value: leaves },
        { label: "Pending leaves", value: pendingLeaves },
        { label: "Approved leaves", value: approvedLeaves },
      ],
      breakdown: [
        { label: "Approved", value: approvedLeaves },
        { label: "Rejected", value: rejectedLeaves },
        { label: "Pending", value: pendingLeaves },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: durationSplit,
      monthly: mergeSeries([monthlyLeaves, monthlyHolidays]),
    };
  },

  assets: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, repair, disposed, inactive, pendingRequests, hardware, infrastructure, software, furniture, other, monthly, statusSplit] =
      await Promise.all([
        safeCount(Asset, base),
        safeCount(Asset, { ...base, createdAt: { $gte: since30 } }),
        safeCount(Asset, { ...base, status: "Repair" }),
        safeCount(Asset, { ...base, status: "Disposed" }),
        safeCount(Asset, { ...base, status: "Inactive" }),
        safeCount(AssetRequest, { ...base, status: "Pending" }),
        safeCount(Asset, { ...base, category: "Hardware" }),
        safeCount(Asset, { ...base, category: "Infrastructure" }),
        safeCount(Asset, { ...base, category: "Software" }),
        safeCount(Asset, { ...base, category: "Furniture" }),
        safeCount(Asset, { ...base, category: "Other" }),
        monthlySeries(Asset, "workspaceId", objectId),
        breakdownBy(Asset, base, "status", [
          { label: "Active", value: "Active" },
          { label: "Inactive", value: "Inactive" },
          { label: "Repair", value: "Repair" },
          { label: "Disposed", value: "Disposed" },
        ]),
      ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pendingRequests,
      completionRate: null,
      kpis: [
        { label: "Assets", value: totalRecords },
        { label: "Under repair", value: repair },
        { label: "Disposed", value: disposed },
        { label: "Pending requests", value: pendingRequests },
      ],
      breakdown: [
        { label: "Hardware", value: hardware },
        { label: "Infrastructure", value: infrastructure },
        { label: "Software", value: software },
        { label: "Furniture", value: furniture },
        { label: "Other", value: other },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: statusSplit,
      monthly,
    };
  },

  "team-management": async ({ objectId, since30 }) => {
    const memberBase = { workspace: eqIn(objectId) };
    const [members, activeMembers, inactiveMembers, recentMembers, sops, policies, recentDocs, monthlyMembers, monthlyDocs] = await Promise.all([
      safeCount(WorkspaceMember, memberBase),
      safeCount(WorkspaceMember, { ...memberBase, status: "active", isActive: true }),
      safeCount(WorkspaceMember, { workspace: eqIn(objectId), $or: [{ status: { $ne: "active" } }, { isActive: false }] }),
      safeCount(WorkspaceMember, { ...memberBase, createdAt: { $gte: since30 } }),
      safeCount(DepartmentDocument, { workspaceId: eqIn(objectId), docType: "sop" }),
      safeCount(DepartmentDocument, { workspaceId: eqIn(objectId), docType: "policy" }),
      safeCountSum([
        { model: DepartmentDocument, filter: { workspaceId: eqIn(objectId), docType: "sop", createdAt: { $gte: since30 } } },
        { model: DepartmentDocument, filter: { workspaceId: eqIn(objectId), docType: "policy", createdAt: { $gte: since30 } } },
      ]),
      monthlySeries(WorkspaceMember, "workspace", objectId),
      monthlySeries(DepartmentDocument, "workspaceId", objectId, { docType: { $in: ["sop", "policy"] } }),
    ]);
    const documents = sops + policies;
    return {
      totalRecords: members + documents,
      activeLast30Days: recentMembers + recentDocs,
      openItems: inactiveMembers,
      completionRate: null,
      kpis: [
        { label: "Team members", value: members },
        { label: "Active", value: activeMembers },
        { label: "SOPs & policies", value: documents },
        { label: "New members (30d)", value: recentMembers },
      ],
      breakdown: [
        { label: "Active", value: activeMembers },
        { label: "Inactive", value: inactiveMembers },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "SOPs", value: sops },
        { label: "Policies", value: policies },
      ].filter((segment) => segment.value > 0),
      monthly: mergeSeries([monthlyMembers, monthlyDocs]),
    };
  },

  "employee-management": async ({ objectId, since30 }) => {
    const deptBase = { workspaceId: eqIn(objectId) };
    const profileBase = { workspaceId: eqIn(objectId) };
    const [departments, profiles, recent, onboarding, activeStaff, probation, inactiveStaff, monthlyProfiles, monthlyDepartments] = await Promise.all([
      safeCount(Department, deptBase),
      safeCount(EmployeeProfile, profileBase),
      safeCountSum([
        { model: Department, filter: { ...deptBase, createdAt: { $gte: since30 } } },
        { model: EmployeeProfile, filter: { ...profileBase, createdAt: { $gte: since30 } } },
      ]),
      safeCount(EmployeeProfile, { ...profileBase, status: { $in: ["pending", "invite_sent", "registered"] } }),
      safeCount(EmployeeProfile, { ...profileBase, status: { $in: ["active", "joined"] } }),
      safeCount(EmployeeProfile, { ...profileBase, status: "probation" }),
      safeCount(EmployeeProfile, { ...profileBase, status: { $in: ["inactive", "terminated"] } }),
      monthlySeries(EmployeeProfile, "workspaceId", objectId),
      monthlySeries(Department, "workspaceId", objectId),
    ]);
    return {
      totalRecords: departments + profiles,
      activeLast30Days: recent,
      openItems: onboarding,
      completionRate: null,
      kpis: [
        { label: "Departments", value: departments },
        { label: "Employees", value: profiles },
        { label: "Active staff", value: activeStaff },
        { label: "Onboarding", value: onboarding },
      ],
      breakdown: [
        { label: "Active", value: activeStaff },
        { label: "Probation", value: probation },
        { label: "Onboarding", value: onboarding },
        { label: "Inactive", value: inactiveStaff },
      ].filter((segment) => segment.value > 0),
      monthly: mergeSeries([monthlyProfiles, monthlyDepartments]),
    };
  },

  "website-builder": async ({ objectId, stringId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, published, editsTotal, edits30, monthly] = await Promise.all([
      safeCount(WebsiteTemplate, base),
      safeCount(WebsiteTemplate, { ...base, createdAt: { $gte: since30 } }),
      safeCount(WebsiteTemplate, { ...base, isPublished: true }),
      activityEdits(stringId, "website-builder"),
      activityEdits(stringId, "website-builder", since30),
      monthlySeries(WebsiteTemplate, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: Math.max(0, totalRecords - published),
      completionRate: pct(published, totalRecords),
      kpis: [
        { label: "Websites", value: totalRecords },
        { label: "Published", value: published },
        { label: "Drafts", value: Math.max(0, totalRecords - published) },
        { label: "Edits / pushes", value: editsTotal ?? 0 },
        { label: "Edits (30d)", value: edits30 ?? 0 },
      ],
      breakdown: [
        { label: "Published", value: published },
        { label: "Draft", value: Math.max(0, totalRecords - published) },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "website-leads": async ({ stringId, since30 }) => {
    const base = { workspaceId: eqIn(stringId), isEscalated: true, escalatedWorkspaceId: eqIn(stringId) };
    const [totalRecords, activeLast30Days, openItems, closed, monthly] = await Promise.all([
      safeCount(WebsiteLead, base),
      safeCount(WebsiteLead, { ...base, createdAt: { $gte: since30 } }),
      safeCount(WebsiteLead, { ...base, hostPanelStatus: { $ne: "Closed" } }),
      safeCount(WebsiteLead, { ...base, hostPanelStatus: "Closed" }),
      monthlySeries(WebsiteLead, "workspaceId", stringId, leadEscalationFilter(stringId)),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems,
      completionRate: pct(closed, totalRecords),
      kpis: [
        { label: "Leads", value: totalRecords },
        { label: "New / open", value: openItems },
        { label: "Closed", value: closed },
        { label: "Conversion", value: pct(closed, totalRecords) ?? "--", suffix: "%" },
      ],
      breakdown: [
        { label: "Pending", value: openItems },
        { label: "Closed", value: closed },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "website-review": async ({ stringId, since30 }) => {
    const base = { workspaceId: eqIn(stringId) };
    const [totalRecords, activeLast30Days, pending, approved, fiveStars, fourStars, threeStars, lowStars, avgRatingRows, monthly] = await Promise.all([
      safeCount(WebsiteReview, base),
      safeCount(WebsiteReview, { ...base, createdAt: { $gte: since30 } }),
      safeCount(WebsiteReview, { ...base, status: "pending" }),
      safeCount(WebsiteReview, { ...base, status: { $nin: ["pending"] } }),
      safeCount(WebsiteReview, { ...base, rating: 5 }),
      safeCount(WebsiteReview, { ...base, rating: 4 }),
      safeCount(WebsiteReview, { ...base, rating: 3 }),
      safeCount(WebsiteReview, { ...base, rating: { $lte: 2 } }),
      (async () => {
        try {
          const rows = await WebsiteReview.aggregate([
            { $match: { workspaceId: eqIn(stringId), rating: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: "$rating" } } },
          ]).exec();
          return rows.length ? Math.round(rows[0].avg * 10) / 10 : null;
        } catch {
          return null;
        }
      })(),
      monthlySeries(WebsiteReview, "workspaceId", stringId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pending,
      completionRate: pct(approved, totalRecords),
      kpis: [
        { label: "Reviews", value: totalRecords },
        { label: "Awaiting action", value: pending },
        { label: "Published", value: approved },
        { label: "Avg rating", value: avgRatingRows ?? "--", suffix: avgRatingRows !== null ? "★" : "" },
      ],
      breakdown: [
        { label: "5 star", value: fiveStars },
        { label: "4 star", value: fourStars },
        { label: "3 star", value: threeStars },
        { label: "≤ 2 star", value: lowStars },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "Pending", value: pending },
        { label: "Published", value: approved },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "organization-management": async ({ objectId, stringId, since30 }) => {
    const memberBase = { workspace: eqIn(objectId), isActive: true };
    const deptBase = { workspaceId: eqIn(objectId) };
    const logBase = { workspaceId: eqIn(stringId), module: "Organization", success: true };
    const [members, departments, recentMembers, recentDepartments, notActive, monthlyMembers, monthlyDepartments, pendingInvites, invites30, accessChanges30, roleChanges30, transfers30] =
      await Promise.all([
        safeCount(WorkspaceMember, memberBase),
        safeCount(Department, deptBase),
        safeCount(WorkspaceMember, { ...memberBase, createdAt: { $gte: since30 } }),
        safeCount(Department, { ...deptBase, createdAt: { $gte: since30 } }),
        safeCount(WorkspaceMember, { workspace: eqIn(objectId), status: { $ne: "active" } }),
        monthlySeries(WorkspaceMember, "workspace", objectId),
        monthlySeries(Department, "workspaceId", objectId),
        safeCount(MemberInvite, { workspaceId: eqIn(objectId), contextType: "workspace", status: "pending" }),
        safeCount(HostActivityLog, { ...logBase, action: "invite", createdAt: { $gte: since30 } }),
        safeCount(HostActivityLog, { ...logBase, action: "access", createdAt: { $gte: since30 } }),
        safeCount(HostActivityLog, { ...logBase, action: "role", createdAt: { $gte: since30 } }),
        safeCount(HostActivityLog, { ...logBase, action: "transfer", createdAt: { $gte: since30 } }),
      ]);
    return {
      totalRecords: members + departments,
      activeLast30Days: recentMembers + recentDepartments,
      openItems: notActive + pendingInvites,
      completionRate: null,
      kpis: [
        { label: "Members", value: members },
        { label: "Departments", value: departments },
        { label: "Pending invites", value: pendingInvites },
        { label: "Access changes (30d)", value: accessChanges30 },
      ],
      breakdown: [
        { label: "Active members", value: Math.max(0, members - notActive) },
        { label: "Not active", value: notActive },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "Invites sent", value: invites30 },
        { label: "Access toggles", value: accessChanges30 },
        { label: "Role changes", value: roleChanges30 },
        { label: "Unit transfers", value: transfers30 },
      ].filter((segment) => segment.value > 0),
      monthly: mergeSeries([monthlyMembers, monthlyDepartments]),
    };
  },

  "access-grants": async ({ objectId, stringId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, systemRoles, customRoles, totalMembers, membersWithExtraAccess, accessToggles30] = await Promise.all([
      safeCount(Role, base),
      safeCount(Role, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Role, { ...base, isSystemRole: true }),
      safeCount(Role, { ...base, isSystemRole: { $ne: true } }),
      safeCount(WorkspaceMember, { workspace: eqIn(objectId) }),
      safeCount(WorkspaceMember, { workspace: eqIn(objectId), grantedModules: { $exists: true, $ne: [] } }),
      safeCount(HostActivityLog, {
        workspaceId: eqIn(stringId),
        module: "Organization",
        action: "access",
        success: true,
        createdAt: { $gte: since30 },
      }),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: 0,
      completionRate: null,
      kpis: [
        { label: "Roles", value: totalRecords },
        { label: "Custom roles", value: customRoles },
        { label: "Members w/ extra access", value: membersWithExtraAccess },
        { label: "Access toggles (30d)", value: accessToggles30 },
      ],
      breakdown: [
        { label: "System", value: systemRoles },
        { label: "Custom", value: customRoles },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "With extra access", value: membersWithExtraAccess },
        { label: "Standard access", value: Math.max(0, totalMembers - membersWithExtraAccess) },
      ].filter((segment) => segment.value > 0),
      monthly: await monthlySeries(Role, "workspaceId", objectId),
    };
  },

  "workspace-management": async ({ objectId, stringId, since30 }) => {
    const [linkedMembers, mainUnitMembers, transfersIn, transfersOut, recentTransfers, transferActions30] = await Promise.all([
      safeCount(WorkspaceMember, { workspace: eqIn(objectId) }),
      safeCount(WorkspaceMember, { workspace: eqIn(objectId), isMainUnit: true }),
      safeCount(WorkspaceMember, { transferHistory: { $elemMatch: { toWorkspaceId: eqIn(objectId) } } }),
      safeCount(WorkspaceMember, { transferHistory: { $elemMatch: { fromWorkspaceId: eqIn(objectId) } } }),
      safeCount(WorkspaceMember, {
        transferHistory: {
          $elemMatch: {
            transferredAt: { $gte: since30 },
            $or: [{ toWorkspaceId: eqIn(objectId) }, { fromWorkspaceId: eqIn(objectId) }],
          },
        },
      }),
      safeCount(HostActivityLog, {
        workspaceId: eqIn(stringId),
        module: "Organization",
        action: "transfer",
        success: true,
        createdAt: { $gte: since30 },
      }),
    ]);
    return {
      totalRecords: linkedMembers,
      activeLast30Days: recentTransfers + transferActions30,
      openItems: 0,
      completionRate: null,
      kpis: [
        { label: "Linked members", value: linkedMembers },
        { label: "Main-unit members", value: mainUnitMembers },
        { label: "Transferred in", value: transfersIn },
        { label: "Transferred out", value: transfersOut },
      ],
      breakdown: [
        { label: "Transferred in", value: transfersIn },
        { label: "Transferred out", value: transfersOut },
      ].filter((segment) => segment.value > 0),
      monthly: await monthlySeries(HostActivityLog, "workspaceId", stringId, { module: "Organization", action: "transfer", success: true }),
    };
  },

  "visitors-management": async ({ objectId, since30 }) => {
    const base = { workspace: eqIn(objectId) };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [totalRecords, activeLast30Days, standard, departmentV, tenantV, checkedIn, visitsToday, monthly, statusSplit] = await Promise.all([
      safeCount(VisitorLog, base),
      safeCount(VisitorLog, { ...base, createdAt: { $gte: since30 } }),
      safeCount(VisitorLog, { ...base, visitorType: "standard" }),
      safeCount(VisitorLog, { ...base, visitorType: "department" }),
      safeCount(VisitorLog, { ...base, visitorType: "tenant" }),
      safeCount(VisitorLog, { ...base, status: "checked_in" }),
      safeCount(VisitorLog, { ...base, createdAt: { $gte: startOfToday } }),
      monthlySeries(VisitorLog, "workspace", objectId),
      breakdownBy(VisitorLog, base, "status", [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Checked In", value: "checked_in" },
        { label: "Checked Out", value: "checked_out" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Rejected", value: "rejected" },
      ]),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: checkedIn,
      completionRate: null,
      kpis: [
        { label: "Visitors", value: totalRecords },
        { label: "Standard visitors", value: standard },
        { label: "Checked in now", value: checkedIn },
        { label: "Today", value: visitsToday },
      ],
      breakdown: [
        { label: "Standard", value: standard },
        { label: "Department", value: departmentV },
        { label: "Tenant", value: tenantV },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: statusSplit,
      monthly,
    };
  },

  "leads-management": async ({ stringId, since30 }) => {
    const base = { workspaceId: eqIn(stringId), isEscalated: true, escalatedWorkspaceId: eqIn(stringId) };
    const [totalRecords, activeLast30Days, openItems, closed, monthly] = await Promise.all([
      safeCount(WebsiteLead, base),
      safeCount(WebsiteLead, { ...base, createdAt: { $gte: since30 } }),
      safeCount(WebsiteLead, { ...base, hostPanelStatus: { $ne: "Closed" } }),
      safeCount(WebsiteLead, { ...base, hostPanelStatus: "Closed" }),
      monthlySeries(WebsiteLead, "workspaceId", stringId, leadEscalationFilter(stringId)),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems,
      completionRate: pct(closed, totalRecords),
      kpis: [
        { label: "Pipeline", value: totalRecords },
        { label: "Open", value: openItems },
        { label: "Won / closed", value: closed },
        { label: "Conversion", value: pct(closed, totalRecords) ?? "--", suffix: "%" },
      ],
      breakdown: [
        { label: "Open", value: openItems },
        { label: "Closed", value: closed },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "tenant-companies-sales": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, active, inactive, monthly] = await Promise.all([
      safeCount(TenantCompany, base),
      safeCount(TenantCompany, { ...base, createdAt: { $gte: since30 } }),
      safeCount(TenantCompany, { ...base, status: "Active" }),
      safeCount(TenantCompany, { ...base, status: "Inactive" }),
      monthlySeries(TenantCompany, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: 0,
      completionRate: pct(active, totalRecords),
      kpis: [
        { label: "Companies", value: totalRecords },
        { label: "Active", value: active },
        { label: "Inactive", value: inactive },
        { label: "New (30d)", value: activeLast30Days },
      ],
      breakdown: [
        { label: "Active", value: active },
        { label: "Inactive", value: inactive },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "resource-pricing": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, active, maintenance, disabled, monthly] = await Promise.all([
      safeCount(Resource, base),
      safeCount(Resource, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Resource, { ...base, status: "Active" }),
      safeCount(Resource, { ...base, status: "Under Maintenance" }),
      safeCount(Resource, { ...base, status: "Disabled" }),
      monthlySeries(Resource, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: maintenance,
      completionRate: pct(active, totalRecords),
      kpis: [
        { label: "Resources", value: totalRecords },
        { label: "Active", value: active },
        { label: "Under maintenance", value: maintenance },
        { label: "Disabled", value: disabled },
      ],
      breakdown: [
        { label: "Active", value: active },
        { label: "Maintenance", value: maintenance },
        { label: "Disabled", value: disabled },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "exit-management": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, pending, approved, rejected, completed, monthly] = await Promise.all([
      safeCount(ResignationRequest, base),
      safeCount(ResignationRequest, { ...base, createdAt: { $gte: since30 } }),
      safeCount(ResignationRequest, { ...base, status: "pending" }),
      safeCount(ResignationRequest, { ...base, status: "approved" }),
      safeCount(ResignationRequest, { ...base, status: "rejected" }),
      safeCount(ResignationRequest, { ...base, status: "completed" }),
      monthlySeries(ResignationRequest, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pending,
      completionRate: pct(approved + completed, totalRecords),
      kpis: [
        { label: "Exit requests", value: totalRecords },
        { label: "Pending", value: pending },
        { label: "Approved", value: approved },
        { label: "Completed", value: completed },
      ],
      breakdown: [
        { label: "Pending", value: pending },
        { label: "Approved", value: approved },
        { label: "Rejected", value: rejected },
        { label: "Completed", value: completed },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  tasks: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, pending, inProgress, completed, approved, rejected, low, medium, high, monthly] = await Promise.all([
      safeCount(Task, base),
      safeCount(Task, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Task, { ...base, status: "Pending" }),
      safeCount(Task, { ...base, status: "In Progress" }),
      safeCount(Task, { ...base, status: "Completed" }),
      safeCount(Task, { ...base, status: "Approved" }),
      safeCount(Task, { ...base, status: "Rejected" }),
      safeCount(Task, { ...base, priority: "Low" }),
      safeCount(Task, { ...base, priority: "Medium" }),
      safeCount(Task, { ...base, priority: "High" }),
      monthlySeries(Task, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pending + inProgress,
      completionRate: pct(completed + approved, totalRecords),
      kpis: [
        { label: "Tasks", value: totalRecords },
        { label: "Completed", value: completed + approved },
        { label: "In progress", value: inProgress },
        { label: "Pending", value: pending },
      ],
      breakdown: [
        { label: "Pending", value: pending },
        { label: "In Progress", value: inProgress },
        { label: "Completed", value: completed },
        { label: "Approved", value: approved },
        { label: "Rejected", value: rejected },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "Low", value: low },
        { label: "Medium", value: medium },
        { label: "High", value: high },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  attendance: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, pendingA, approvedA, rejectedA, monthly] = await Promise.all([
      safeCount(Attendance, base),
      safeCount(Attendance, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Attendance, { ...base, status: "pending" }),
      safeCount(Attendance, { ...base, status: "approved" }),
      safeCount(Attendance, { ...base, status: "rejected" }),
      monthlySeries(Attendance, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pendingA,
      completionRate: pct(approvedA, totalRecords),
      kpis: [
        { label: "Entries", value: totalRecords },
        { label: "Approved", value: approvedA },
        { label: "Pending review", value: pendingA },
        { label: "New (30d)", value: activeLast30Days },
      ],
      breakdown: [
        { label: "Pending", value: pendingA },
        { label: "Approved", value: approvedA },
        { label: "Rejected", value: rejectedA },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "leave-requests": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, pendingL, approvedL, rejectedL, durationSplit, monthly] = await Promise.all([
      safeCount(LeaveRequest, base),
      safeCount(LeaveRequest, { ...base, createdAt: { $gte: since30 } }),
      safeCount(LeaveRequest, { ...base, status: "pending" }),
      safeCount(LeaveRequest, { ...base, status: "approved" }),
      safeCount(LeaveRequest, { ...base, status: "rejected" }),
      breakdownBy(LeaveRequest, base, "durationType", [
        { label: "Full Day", value: "full_day" },
        { label: "Half Day", value: "half_day" },
        { label: "Hours", value: "hours" },
      ]),
      monthlySeries(LeaveRequest, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: pendingL,
      completionRate: pct(approvedL + rejectedL, totalRecords),
      kpis: [
        { label: "Requests", value: totalRecords },
        { label: "Approved", value: approvedL },
        { label: "Pending", value: pendingL },
        { label: "Rejected", value: rejectedL },
      ],
      breakdown: [
        { label: "Pending", value: pendingL },
        { label: "Approved", value: approvedL },
        { label: "Rejected", value: rejectedL },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: durationSplit,
      monthly,
    };
  },

  inventory: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, activeI, maintenanceI, retiredI, consumable, returnable, monthly] = await Promise.all([
      safeCount(Inventory, base),
      safeCount(Inventory, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Inventory, { ...base, status: "active" }),
      safeCount(Inventory, { ...base, status: "maintenance" }),
      safeCount(Inventory, { ...base, status: "retired" }),
      safeCount(Inventory, { ...base, trackingType: "Consumable" }),
      safeCount(Inventory, { ...base, trackingType: "Returnable Asset" }),
      monthlySeries(Inventory, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: maintenanceI,
      completionRate: pct(activeI, totalRecords),
      kpis: [
        { label: "Items", value: totalRecords },
        { label: "Active", value: activeI },
        { label: "Maintenance", value: maintenanceI },
        { label: "Retired", value: retiredI },
      ],
      breakdown: [
        { label: "Active", value: activeI },
        { label: "Maintenance", value: maintenanceI },
        { label: "Retired", value: retiredI },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "Consumable", value: consumable },
        { label: "Returnable", value: returnable },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  "finance-management": async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [transactions, expenses, vendors, recentTx, recentExp, statusSplit, monthlyTx, monthlyExp] = await Promise.all([
      safeCount(FinanceTransaction, base),
      safeCount(FinanceExpense, base),
      safeCount(FinanceVendor, base),
      safeCount(FinanceTransaction, { ...base, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      safeCount(FinanceExpense, { ...base, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      deptBreakdownBy(FinanceTransaction, base, "status"),
      monthlySeries(FinanceTransaction, "workspaceId", objectId),
      monthlySeries(FinanceExpense, "workspaceId", objectId),
    ]);
    return {
      totalRecords: transactions + expenses,
      activeLast30Days: recentTx + recentExp,
      openItems: 0,
      completionRate: null,
      kpis: [
        { label: "Transactions", value: transactions },
        { label: "Expenses", value: expenses },
        { label: "Vendors", value: vendors },
        { label: "New (30d)", value: recentTx + recentExp },
      ],
      breakdown: [
        { label: "Transactions", value: transactions },
        { label: "Expenses", value: expenses },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: statusSplit,
      monthly: mergeSeries([monthlyTx, monthlyExp]),
    };
  },

  reports: async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, completedR, failedR, categorySplit, statusSplit, monthly] = await Promise.all([
      safeCount(Report, base),
      safeCount(Report, { ...base, createdAt: { $gte: since30 } }),
      safeCount(Report, { ...base, status: "completed" }),
      safeCount(Report, { ...base, status: "failed" }),
      breakdownBy(Report, base, "category", [
        { label: "Attendance", value: "Attendance" },
        { label: "Employee", value: "Employee" },
        { label: "Financial", value: "Financial" },
        { label: "Task", value: "Task" },
        { label: "Ticket", value: "Ticket" },
        { label: "Other", value: "Other" },
      ]),
      breakdownBy(Report, base, "status", [
        { label: "Completed", value: "completed" },
        { label: "Generating", value: "generating" },
        { label: "Failed", value: "failed" },
      ]),
      monthlySeries(Report, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: Math.max(0, totalRecords - completedR - failedR),
      completionRate: pct(completedR, totalRecords),
      kpis: [
        { label: "Reports", value: totalRecords },
        { label: "Completed", value: completedR },
        { label: "Failed", value: failedR },
        { label: "New (30d)", value: activeLast30Days },
      ],
      breakdown: categorySplit,
      secondaryBreakdown: statusSplit,
      monthly,
    };
  },

  "hr-documents": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, sops, policies, companyScope, deptScope, monthly] = await Promise.all([
      safeCount(DepartmentDocument, base),
      safeCount(DepartmentDocument, { ...base, createdAt: { $gte: since30 } }),
      safeCount(DepartmentDocument, { ...base, docType: "sop" }),
      safeCount(DepartmentDocument, { ...base, docType: "policy" }),
      safeCount(DepartmentDocument, { ...base, scope: "company" }),
      safeCount(DepartmentDocument, { ...base, scope: "department" }),
      monthlySeries(DepartmentDocument, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: 0,
      completionRate: null,
      kpis: [
        { label: "Documents", value: totalRecords },
        { label: "SOPs", value: sops },
        { label: "Policies", value: policies },
        { label: "New (30d)", value: activeLast30Days },
      ],
      breakdown: [
        { label: "SOP", value: sops },
        { label: "Policy", value: policies },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: [
        { label: "Company", value: companyScope },
        { label: "Department", value: deptScope },
      ].filter((segment) => segment.value > 0),
      monthly,
    };
  },

  recruitment: async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [openings, activeOpenings, candidates, recentCandidates, candidateStatusSplit, monthlyOpenings, monthlyCandidates] = await Promise.all([
      safeCount(RecruitmentJobOpening, base),
      safeCount(RecruitmentJobOpening, { ...base, isActive: true }),
      safeCount(RecruitmentCandidate, base),
      safeCount(RecruitmentCandidate, { ...base, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      deptBreakdownBy(RecruitmentCandidate, base, "status"),
      monthlySeries(RecruitmentJobOpening, "workspaceId", objectId),
      monthlySeries(RecruitmentCandidate, "workspaceId", objectId),
    ]);
    return {
      totalRecords: openings + candidates,
      activeLast30Days: recentCandidates,
      openItems: activeOpenings,
      completionRate: null,
      kpis: [
        { label: "Openings", value: openings },
        { label: "Active openings", value: activeOpenings },
        { label: "Candidates", value: candidates },
        { label: "New candidates (30d)", value: recentCandidates },
      ],
      breakdown: [
        { label: "Openings", value: openings },
        { label: "Candidates", value: candidates },
      ].filter((segment) => segment.value > 0),
      secondaryBreakdown: candidateStatusSplit,
      monthly: mergeSeries([monthlyOpenings, monthlyCandidates]),
    };
  },

  "payroll-management": async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [cycles, paidCycles, pendingCycles, entries, statusSplit, monthly] = await Promise.all([
      safeCount(PayrollCycle, base),
      safeCount(PayrollCycle, { ...base, status: "Paid" }),
      safeCount(PayrollCycle, { ...base, status: { $in: ["Pending", "Prepared", "Sent to Finance"] } }),
      safeCount(PayrollEntry, base),
      breakdownBy(PayrollCycle, base, "status", [
        { label: "Pending", value: "Pending" },
        { label: "Prepared", value: "Prepared" },
        { label: "Sent to Finance", value: "Sent to Finance" },
        { label: "Paid", value: "Paid" },
      ]),
      monthlySeries(PayrollCycle, "workspaceId", objectId),
    ]);
    return {
      totalRecords: cycles + entries,
      activeLast30Days: 0,
      openItems: pendingCycles,
      completionRate: pct(paidCycles, cycles),
      kpis: [
        { label: "Cycles", value: cycles },
        { label: "Paid", value: paidCycles },
        { label: "In pipeline", value: pendingCycles },
        { label: "Payslips / entries", value: entries },
      ],
      breakdown: statusSplit,
      monthly,
    };
  },

  "house-keeping": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [tasksT, activeLast30Days, completedH, openTasks, cancelledH, staff, presentStaff, statusSplit, attendanceSplit, monthly] = await Promise.all([
      safeCount(HousekeepingTask, base),
      safeCount(HousekeepingTask, { ...base, createdAt: { $gte: since30 } }),
      safeCount(HousekeepingTask, { ...base, status: "Completed" }),
      safeCount(HousekeepingTask, { ...base, status: { $in: ["Pending", "Assigned", "In Progress"] } }),
      safeCount(HousekeepingTask, { ...base, status: "Cancelled" }),
      safeCount(HousekeepingStaff, base),
      safeCount(HousekeepingStaff, { ...base, attendanceStatus: "Present" }),
      breakdownBy(HousekeepingTask, base, "status", [
        { label: "Pending", value: "Pending" },
        { label: "Assigned", value: "Assigned" },
        { label: "In Progress", value: "In Progress" },
        { label: "Completed", value: "Completed" },
        { label: "Cancelled", value: "Cancelled" },
      ]),
      breakdownBy(HousekeepingStaff, base, "attendanceStatus", [
        { label: "Present", value: "Present" },
        { label: "Absent", value: "Absent" },
      ]),
      monthlySeries(HousekeepingTask, "workspaceId", objectId),
    ]);
    return {
      totalRecords: tasksT + staff,
      activeLast30Days,
      openItems: openTasks,
      completionRate: pct(completedH, tasksT),
      kpis: [
        { label: "Tasks", value: tasksT },
        { label: "Completed", value: completedH },
        { label: "Open", value: openTasks },
        { label: "Staff on duty", value: presentStaff },
      ],
      breakdown: statusSplit,
      secondaryBreakdown: attendanceSplit.length ? attendanceSplit : [{ label: "Staff", value: staff }],
      monthly,
    };
  },

  "finance-budget": async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [plans, annualReqs, extraReqs, pendingApprovals, monthlyPlans, monthlyAnnual, monthlyExtra] = await Promise.all([
      safeCount(DepartmentFinancePlan, base),
      safeCount(AnnualFinanceRequest, base),
      safeCount(ExtraFinanceRequest, base),
      safeCountSum([
        { model: DepartmentFinancePlan, filter: { ...base, status: { $in: ["Pending", "Discuss"] } } },
        { model: AnnualFinanceRequest, filter: { ...base, status: { $in: ["Pending", "Discuss"] } } },
        { model: ExtraFinanceRequest, filter: { ...base, status: { $in: ["Pending", "Discuss"] } } },
      ]),
      monthlySeries(DepartmentFinancePlan, "workspaceId", objectId),
      monthlySeries(AnnualFinanceRequest, "workspaceId", objectId),
      monthlySeries(ExtraFinanceRequest, "workspaceId", objectId),
    ]);
    const statusLabels = [
      { label: "Pending", value: "Pending" },
      { label: "Approved", value: "Approved" },
      { label: "Rejected", value: "Rejected" },
      { label: "Discuss", value: "Discuss" },
    ];
    const parts = await Promise.all([
      breakdownBy(DepartmentFinancePlan, base, "status", statusLabels),
      breakdownBy(AnnualFinanceRequest, base, "status", statusLabels),
      breakdownBy(ExtraFinanceRequest, base, "status", statusLabels),
    ]);
    const merged = new Map();
    parts.flat().forEach(({ label, value }) => merged.set(label, (merged.get(label) || 0) + value));
    const statusSplit = Array.from(merged.entries()).map(([label, value]) => ({ label, value })).filter((s) => s.value > 0);
    return {
      totalRecords: plans + annualReqs + extraReqs,
      activeLast30Days: 0,
      openItems: pendingApprovals,
      completionRate: null,
      kpis: [
        { label: "Budget plans", value: plans },
        { label: "Annual requests", value: annualReqs },
        { label: "Extra requests", value: extraReqs },
        { label: "Awaiting approval", value: pendingApprovals },
      ],
      breakdown: statusSplit,
      monthly: mergeSeries([monthlyPlans, monthlyAnnual, monthlyExtra]),
    };
  },

  "billing-payments": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, paidB, failedB, invoiceSplit, monthly] = await Promise.all([
      safeCount(TenantCreditRequest, base),
      safeCount(TenantCreditRequest, { ...base, createdAt: { $gte: since30 } }),
      safeCount(TenantCreditRequest, { ...base, invoiceStatus: "Paid" }),
      safeCount(TenantCreditRequest, { ...base, invoiceStatus: "Failed" }),
      breakdownBy(TenantCreditRequest, base, "invoiceStatus", [
        { label: "Pending", value: "Pending" },
        { label: "Generated", value: "Generated" },
        { label: "Sent", value: "Sent" },
        { label: "Paid", value: "Paid" },
        { label: "Failed", value: "Failed" },
      ]),
      monthlySeries(TenantCreditRequest, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: Math.max(0, totalRecords - paidB - failedB),
      completionRate: pct(paidB, totalRecords),
      kpis: [
        { label: "Credit requests", value: totalRecords },
        { label: "Paid", value: paidB },
        { label: "Failed", value: failedB },
        { label: "New (30d)", value: activeLast30Days },
      ],
      breakdown: invoiceSplit,
      monthly,
    };
  },

  accounting: async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [transactions, expenses, vendors, recentTx, recentExp, monthlyTx, monthlyExp] = await Promise.all([
      safeCount(FinanceTransaction, base),
      safeCount(FinanceExpense, base),
      safeCount(FinanceVendor, base),
      safeCount(FinanceTransaction, { ...base, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      safeCount(FinanceExpense, { ...base, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      monthlySeries(FinanceTransaction, "workspaceId", objectId),
      monthlySeries(FinanceExpense, "workspaceId", objectId),
    ]);
    return {
      totalRecords: transactions + expenses + vendors,
      activeLast30Days: recentTx + recentExp,
      openItems: 0,
      completionRate: null,
      kpis: [
        { label: "Transactions", value: transactions },
        { label: "Expenses", value: expenses },
        { label: "Vendors", value: vendors },
        { label: "New (30d)", value: recentTx + recentExp },
      ],
      breakdown: [
        { label: "Transactions", value: transactions },
        { label: "Expenses", value: expenses },
        { label: "Vendors", value: vendors },
      ].filter((segment) => segment.value > 0),
      monthly: mergeSeries([monthlyTx, monthlyExp]),
    };
  },

  "maintenance-repair-logs": async ({ objectId }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [repairs, repairOpen, repairDone, schedules, overdueS, completedS, repairSplit, scheduleSplit, monthlyRepairs, monthlySchedules] = await Promise.all([
      safeCount(RepairLog, base),
      safeCount(RepairLog, { ...base, status: { $in: ["Open", "In Progress"] } }),
      safeCount(RepairLog, { ...base, status: { $in: ["Resolved", "Closed"] } }),
      safeCount(MaintenanceSchedule, base),
      safeCount(MaintenanceSchedule, { ...base, status: "Overdue" }),
      safeCount(MaintenanceSchedule, { ...base, status: "Completed" }),
      breakdownBy(RepairLog, base, "status", [
        { label: "Open", value: "Open" },
        { label: "In Progress", value: "In Progress" },
        { label: "Resolved", value: "Resolved" },
        { label: "Closed", value: "Closed" },
      ]),
      breakdownBy(MaintenanceSchedule, base, "status", [
        { label: "Scheduled", value: "Scheduled" },
        { label: "Due Soon", value: "Due Soon" },
        { label: "Overdue", value: "Overdue" },
        { label: "Completed", value: "Completed" },
      ]),
      monthlySeries(RepairLog, "workspaceId", objectId),
      monthlySeries(MaintenanceSchedule, "workspaceId", objectId),
    ]);
    return {
      totalRecords: repairs + schedules,
      activeLast30Days: 0,
      openItems: repairOpen + overdueS,
      completionRate: pct(repairDone, repairs),
      kpis: [
        { label: "Repair logs", value: repairs },
        { label: "Resolved", value: repairDone },
        { label: "Open repairs", value: repairOpen },
        { label: "Overdue services", value: overdueS },
      ],
      breakdown: repairSplit,
      secondaryBreakdown: scheduleSplit,
      monthly: mergeSeries([monthlyRepairs, monthlySchedules]),
    };
  },

  "amc-maintenance-scheduler": async ({ objectId, since30 }) => {
    const base = { workspaceId: eqIn(objectId) };
    const [totalRecords, activeLast30Days, scheduledS, dueSoonS, overdueS, completedS, statusSplit, monthly] = await Promise.all([
      safeCount(MaintenanceSchedule, base),
      safeCount(MaintenanceSchedule, { ...base, createdAt: { $gte: since30 } }),
      safeCount(MaintenanceSchedule, { ...base, status: "Scheduled" }),
      safeCount(MaintenanceSchedule, { ...base, status: "Due Soon" }),
      safeCount(MaintenanceSchedule, { ...base, status: "Overdue" }),
      safeCount(MaintenanceSchedule, { ...base, status: "Completed" }),
      breakdownBy(MaintenanceSchedule, base, "status", [
        { label: "Scheduled", value: "Scheduled" },
        { label: "Due Soon", value: "Due Soon" },
        { label: "Overdue", value: "Overdue" },
        { label: "Completed", value: "Completed" },
      ]),
      monthlySeries(MaintenanceSchedule, "workspaceId", objectId),
    ]);
    return {
      totalRecords,
      activeLast30Days,
      openItems: scheduledS + dueSoonS + overdueS,
      completionRate: pct(completedS, totalRecords),
      kpis: [
        { label: "Schedules", value: totalRecords },
        { label: "Completed", value: completedS },
        { label: "Overdue", value: overdueS },
        { label: "Upcoming", value: scheduledS + dueSoonS },
      ],
      breakdown: statusSplit,
      monthly,
    };
  },
};

MODULE_STAT_PROVIDERS["visitor-management"] = MODULE_STAT_PROVIDERS["visitors-management"];
MODULE_STAT_PROVIDERS["leave-request-processing"] = MODULE_STAT_PROVIDERS["leave-requests"];
MODULE_STAT_PROVIDERS["attendance-review"] = MODULE_STAT_PROVIDERS["attendance"];
MODULE_STAT_PROVIDERS["tenant-companies-admin"] = MODULE_STAT_PROVIDERS["tenant-companies-sales"];
MODULE_STAT_PROVIDERS["bookings"] = MODULE_STAT_PROVIDERS["meeting-room-system"];
MODULE_STAT_PROVIDERS["resource-management"] = MODULE_STAT_PROVIDERS["resource-pricing"];
MODULE_STAT_PROVIDERS["tech-website-builder"] = MODULE_STAT_PROVIDERS["website-builder"];
MODULE_STAT_PROVIDERS["it-repair-logs"] = MODULE_STAT_PROVIDERS["maintenance-repair-logs"];

const INSIGHT_SOURCES = {
  tickets: [{ model: Ticket, field: "workspaceId", type: "objectId" }],
  "customer-support": [{ model: SupportTicket, field: "workspace", type: "objectId" }],
  "meeting-room-system": [{ model: MeetingRoomBooking, field: "workspaceId", type: "objectId" }],
  calendar: [
    { model: LeaveRequest, field: "workspaceId", type: "objectId" },
    { model: Holiday, field: "workspaceId", type: "objectId" },
  ],
  assets: [{ model: Asset, field: "workspaceId", type: "objectId" }],
  "team-management": [
    { model: WorkspaceMember, field: "workspace", type: "objectId" },
    { model: DepartmentDocument, field: "workspaceId", type: "objectId" },
  ],
  "employee-management": [
    { model: EmployeeProfile, field: "workspaceId", type: "objectId" },
    { model: Department, field: "workspaceId", type: "objectId" },
  ],
  "website-builder": [{ model: WebsiteTemplate, field: "workspaceId", type: "objectId" }],
  "website-leads": [{ model: WebsiteLead, field: "workspaceId", type: "string", escalatedOnly: true }],
  "website-review": [{ model: WebsiteReview, field: "workspaceId", type: "string" }],
  "organization-management": [
    { model: WorkspaceMember, field: "workspace", type: "objectId" },
    { model: Department, field: "workspaceId", type: "objectId" },
  ],
  "access-grants": [{ model: Role, field: "workspaceId", type: "objectId" }],
  "workspace-management": [{ model: WorkspaceMember, field: "workspace", type: "objectId" }],
  "visitors-management": [{ model: VisitorLog, field: "workspace", type: "objectId" }],
  "leads-management": [{ model: WebsiteLead, field: "workspaceId", type: "string", escalatedOnly: true }],
  "tenant-companies-sales": [{ model: TenantCompany, field: "workspaceId", type: "objectId" }],
  "resource-pricing": [{ model: Resource, field: "workspaceId", type: "objectId" }],
  "exit-management": [{ model: ResignationRequest, field: "workspaceId", type: "objectId" }],
  tasks: [{ model: Task, field: "workspaceId", type: "objectId" }],
  attendance: [{ model: Attendance, field: "workspaceId", type: "objectId" }],
  "leave-requests": [{ model: LeaveRequest, field: "workspaceId", type: "objectId" }],
  inventory: [{ model: Inventory, field: "workspaceId", type: "objectId" }],
  "finance-management": [
    { model: FinanceTransaction, field: "workspaceId", type: "objectId" },
    { model: FinanceExpense, field: "workspaceId", type: "objectId" },
  ],
  reports: [{ model: Report, field: "workspaceId", type: "objectId" }],
  "hr-documents": [{ model: DepartmentDocument, field: "workspaceId", type: "objectId" }],
  recruitment: [
    { model: RecruitmentJobOpening, field: "workspaceId", type: "objectId" },
    { model: RecruitmentCandidate, field: "workspaceId", type: "objectId" },
  ],
  "payroll-management": [
    { model: PayrollCycle, field: "workspaceId", type: "objectId" },
    { model: PayrollEntry, field: "workspaceId", type: "objectId" },
  ],
  "house-keeping": [
    { model: HousekeepingTask, field: "workspaceId", type: "objectId" },
    { model: HousekeepingStaff, field: "workspaceId", type: "objectId" },
  ],
  "finance-budget": [
    { model: DepartmentFinancePlan, field: "workspaceId", type: "objectId" },
    { model: AnnualFinanceRequest, field: "workspaceId", type: "objectId" },
    { model: ExtraFinanceRequest, field: "workspaceId", type: "objectId" },
  ],
  "billing-payments": [{ model: TenantCreditRequest, field: "workspaceId", type: "objectId" }],
  accounting: [
    { model: FinanceTransaction, field: "workspaceId", type: "objectId" },
    { model: FinanceExpense, field: "workspaceId", type: "objectId" },
    { model: FinanceVendor, field: "workspaceId", type: "objectId" },
  ],
  "maintenance-repair-logs": [
    { model: RepairLog, field: "workspaceId", type: "objectId" },
    { model: MaintenanceSchedule, field: "workspaceId", type: "objectId" },
  ],
  "amc-maintenance-scheduler": [{ model: MaintenanceSchedule, field: "workspaceId", type: "objectId" }],
};
INSIGHT_SOURCES["visitor-management"] = INSIGHT_SOURCES["visitors-management"];
INSIGHT_SOURCES["leave-request-processing"] = INSIGHT_SOURCES["leave-requests"];
INSIGHT_SOURCES["attendance-review"] = INSIGHT_SOURCES["attendance"];
INSIGHT_SOURCES["tenant-companies-admin"] = INSIGHT_SOURCES["tenant-companies-sales"];
INSIGHT_SOURCES["bookings"] = INSIGHT_SOURCES["meeting-room-system"];
INSIGHT_SOURCES["resource-management"] = INSIGHT_SOURCES["resource-pricing"];
INSIGHT_SOURCES["tech-website-builder"] = INSIGHT_SOURCES["website-builder"];
INSIGHT_SOURCES["it-repair-logs"] = INSIGHT_SOURCES["maintenance-repair-logs"];

const DEPT_BREAKDOWN_SOURCES = {
  tickets: { model: Ticket, match: "workspaceId", field: "departmentId" },
  tasks: { model: Task, match: "workspaceId", field: "departmentId" },
  attendance: { model: Attendance, match: "workspaceId", field: "department" },
  "leave-requests": { model: LeaveRequest, match: "workspaceId", field: "department" },
  inventory: { model: Inventory, match: "workspaceId", field: "departmentName" },
  reports: { model: Report, match: "workspaceId", field: "departmentId" },
  recruitment: { model: RecruitmentCandidate, match: "workspaceId", field: "departmentId" },
  "payroll-management": { model: PayrollEntry, match: "workspaceId", field: "departmentId" },
  "hr-documents": { model: DepartmentDocument, match: "workspaceId", field: "departmentId" },
  "maintenance-repair-logs": { model: RepairLog, match: "workspaceId", field: "departmentId" },
  "amc-maintenance-scheduler": { model: MaintenanceSchedule, match: "workspaceId", field: "departmentId" },
  "finance-budget": { model: DepartmentFinancePlan, match: "workspaceId", field: "department" },
  "team-management": { model: WorkspaceMember, match: "workspace", field: "departments", array: true },
};
DEPT_BREAKDOWN_SOURCES["it-repair-logs"] = DEPT_BREAKDOWN_SOURCES["maintenance-repair-logs"];

// Modules enabled in a workspace but with no trackable operational data
// (config screens, external integrations, orchestration pages).
const NON_TRACKABLE_MODULE_IDS = new Set(["dashboard", "workspace-settings", "wono-nomad", "sales-architecture"]);

const MODULE_DESCRIPTIONS = {
  tickets: "Internal support queue — volume, resolution speed and priority mix.",
  "customer-support": "Customer-facing helpdesk tickets and resolution pipeline health.",
  "meeting-room-system": "Room bookings across internal, external and tenant guests.",
  calendar: "Holidays and leave requests driving the workspace calendar.",
  assets: "Physical asset inventory, category mix and repair lifecycle.",
  "team-management": "Team roster and sidebar access, plus department SOPs and policies.",
  "website-builder": "Published websites plus every edit/push logged by the builder.",
  "website-leads": "Leads captured from the public website pipeline.",
  "website-review": "Guest reviews with rating spread and moderation queue.",
  "organization-management": "Workspace membership growth and department structure.",
  "access-grants": "Roles shaping who can access what inside the unit.",
  "visitors-management": "Visitor passes by type with live check-in status.",
  "leads-management": "Sales CRM lead pipeline and conversion rate.",
  "tenant-companies-sales": "Tenant companies managed by the sales desk.",
  "resource-pricing": "Bookable resources and their availability state.",
  "exit-management": "Resignation requests moving through the exit pipeline.",
  tasks: "Task board throughput across departments and priorities.",
  attendance: "Attendance entries and their review approvals.",
  "leave-requests": "Leave requests with duration patterns.",
  inventory: "Inventory items split into consumables and returnables.",
  "finance-management": "Finance transactions, expenses and vendor records.",
  reports: "Generated reports by category and outcome.",
  "hr-documents": "SOP and policy documents by scope.",
  recruitment: "Job openings and the candidate pipeline.",
  "payroll-management": "Payroll cycles and payslip processing stages.",
  "house-keeping": "Housekeeping task flow and staff attendance.",
  "finance-budget": "Department budget plans and approval flow.",
  "billing-payments": "Tenant credit requests and invoice outcomes.",
  accounting: "Accounting transactions, expenses and vendors.",
  "maintenance-repair-logs": "Repair logs and preventive maintenance schedules.",
  "amc-maintenance-scheduler": "AMC service schedule adherence and overdue work.",
  "employee-management": "Company Management — employees, departments and the onboarding pipeline.",
};

const BREAKDOWN_TITLES = {
  tickets: ["By Status", "By Priority"],
  "customer-support": ["By Status", "Resolution"],
  "meeting-room-system": ["By Booking Type", "By Status"],
  calendar: ["Leave Status", "Leave Duration"],
  assets: ["By Category", "By Status"],
  "team-management": ["Member Status", "SOPs & Policies"],
  "website-builder": ["Publish State", "Coverage"],
  "website-leads": ["Pipeline", "Conversion"],
  "website-review": ["Rating Spread", "Moderation"],
  "organization-management": ["Membership", "Engagement"],
  "access-grants": ["Role Mix", "Freshness"],
  "visitors-management": ["Visitor Types", "Pass Status"],
  "leads-management": ["Pipeline", "Conversion"],
  "tenant-companies-sales": ["Company Status", "Growth"],
  "resource-pricing": ["Resource Status", "Utilisation"],
  "exit-management": ["Exit Pipeline", "Outcomes"],
  tasks: ["By Status", "By Priority"],
  attendance: ["Review Status", "Trend"],
  "leave-requests": ["Request Status", "Duration"],
  inventory: ["Item Status", "Tracking Type"],
  "finance-management": ["Record Types", "Transaction Status"],
  reports: ["By Category", "By Outcome"],
  "hr-documents": ["By Type", "By Scope"],
  recruitment: ["Volume Split", "Candidate Stages"],
  "payroll-management": ["Cycle Status", "Volume"],
  "house-keeping": ["Task Status", "Staff Attendance"],
  "finance-budget": ["Approval Status", "Requests"],
  "billing-payments": ["Invoice Status", "Flow"],
  accounting: ["Record Types", "Movement"],
  "maintenance-repair-logs": ["Repair Status", "Service Schedule"],
  "amc-maintenance-scheduler": ["Schedule Status", "Adherence"],
  "employee-management": ["Employee Status", "Onboarding"],
};

module.exports = {
  eqIn,
  computeActivityScore,
  buildMonthKeys,
  usageInsights,
  mergeInsights,
  deptBreakdownBy,
  leadEscalationFilter,
  MODULE_STAT_PROVIDERS,
  INSIGHT_SOURCES,
  DEPT_BREAKDOWN_SOURCES,
  NON_TRACKABLE_MODULE_IDS,
  MODULE_DESCRIPTIONS,
  BREAKDOWN_TITLES,
};
