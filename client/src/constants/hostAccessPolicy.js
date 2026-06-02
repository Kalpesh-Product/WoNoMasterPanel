export const DEFAULT_WORKSPACE_ID = "default-workspace";
export const DEFAULT_WORKSPACE_NAME = "Main Workspace";

export const MODULE_SECTIONS = [
  {
    name: "COMPANY SETTINGS",
    accent: "from-sky-500 via-blue-500 to-indigo-500",
    children: [
      {
        name: "Website Builder",
        children: [
          {
            name: "Static Website",
            children: [
              { name: "Create Website", children: [] },
              { name: "Templates", children: [] },
              { name: "Sections", children: [] },
            ],
          },
          {
            name: "Dynamic Website",
            children: [
              { name: "Forms", children: [] },
              { name: "Automation", children: [] },
              { name: "Integrations", children: [] },
            ],
          },
        ],
      },
      {
        name: "Wono Nomad",
        children: [
          { name: "Nomad Listing", children: [] },
          { name: "Review", children: [] },
        ],
      },
      { name: "Website Leads", children: [] },
      {
        name: "Organization Management",
        children: [
          { name: "User Count", children: [] },
          { name: "Departments Tab", children: [] },
          { name: "Add User", children: [] },
        ],
      },
      {
        name: "Access Grants",
        children: [
          { name: "Transfer Ownership", children: [] },
          { name: "Access Button", children: [] },
          { name: "Promote / Demote", children: [] },
          { name: "Transfer Workspace", children: [] },
          { name: "Add Workspace Access", children: [] },
        ],
      },
      { name: "Workspace Settings", children: [] },
      { name: "Analytics", children: [] },
      { name: "Customer Support", children: [] },
    ],
  },
  {
    name: "KEY APPS",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    children: [
      {
        name: "Visitor Management",
        children: [
          { name: "Daily Visitors", children: [] },
          { name: "Visitor History", children: [] },
          { name: "Bookings", children: [] },
          { name: "Clients", children: [] },
          {
            name: "New Frontdesk Action",
            children: [
              { name: "Standard Visitor", children: [] },
              { name: "Workspace Tour", children: [] },
              { name: "Walk-In Booking", children: [] },
              { name: "Verify Booking ID", children: [] },
              {
                name: "Standard Visitor Tabs",
                children: [
                  { name: "Standard Visitor Tab", children: [] },
                  { name: "Department Visitor Tab", children: [] },
                  { name: "Tenant Company Visitor Tab", children: [] },
                ],
              },
            ],
          },
        ],
      },
      { name: "Meeting Room System", children: [] },
      { name: "Tickets", children: [] },
      { name: "Calendar", children: [] },
      { name: "Attendance", children: [] },
      { name: "Tasks", children: [] },
      { name: "Leave Requests", children: [] },
      { name: "Assets", children: [] },
      { name: "Inventory", children: [] },
      { name: "Finance Management", children: [] },
      { name: "Reports", children: [] },
    ],
  },
  {
    name: "DEPARTMENT ACCESSES",
    accent: "from-amber-500 via-orange-500 to-rose-500",
    children: [
      {
        name: "HR Department",
        children: [
          { name: "Employee Management", children: [] },
          { name: "Documents", children: [] },
          { name: "Recruitment", children: [] },
          { name: "Leave Processing", children: [] },
          { name: "Attendance Review", children: [] },
          { name: "Payroll", children: [] },
          { name: "Exit Management", children: [] },
        ],
      },
      {
        name: "Administration Department",
        children: [
          { name: "Tenant Companies", children: [] },
          { name: "Bookings", children: [] },
          { name: "Visitors Management", children: [] },
          { name: "Resource Management", children: [] },
          { name: "Housekeeping", children: [] },
          { name: "Workspace Layout", children: [] },
        ],
      },
      {
        name: "Sales Department",
        children: [
          { name: "Leads Management", children: [] },
          { name: "Pricing Packages", children: [] },
          { name: "Sales Architecture", children: [] },
          { name: "Tenant Companies", children: [] },
        ],
      },
      {
        name: "Finance Department",
        children: [
          { name: "Expenses & Budget", children: [] },
          { name: "Billing & Payments", children: [] },
          { name: "Accounting", children: [] },
        ],
      },
      {
        name: "Maintenance Department",
        children: [
          { name: "Repair Logs", children: [] },
          { name: "AMC Scheduler", children: [] },
        ],
      },
      { name: "Tech Department", children: [{ name: "Website Builder", children: [] }] },
      {
        name: "IT Department",
        children: [
          { name: "System Access Management", children: [] },
          { name: "Repair Logs", children: [] },
        ],
      },
    ],
  },
];

export const buildPathKey = (pathParts) => pathParts.join("::");

export const initializeTreeState = (nodes, pathParts = [], state = {}) => {
  nodes.forEach((node) => {
    const nextPath = [...pathParts, node.name];
    state[buildPathKey(nextPath)] = true;
    if (node.children?.length) {
      initializeTreeState(node.children, nextPath, state);
    }
  });
  return state;
};

export const initializeDisabledTreeState = (nodes, pathParts = [], state = {}) => {
  nodes.forEach((node) => {
    const nextPath = [...pathParts, node.name];
    state[buildPathKey(nextPath)] = false;
    if (node.children?.length) {
      initializeDisabledTreeState(node.children, nextPath, state);
    }
  });
  return state;
};

const enableBranch = (state, branchPath) => {
  const branchKey = buildPathKey(branchPath);
  Object.keys(state).forEach((key) => {
    if (key === branchKey || key.startsWith(`${branchKey}::`)) {
      state[key] = true;
    }
  });
};

const withEnabledBranches = (branches) => {
  const state = initializeDisabledTreeState(MODULE_SECTIONS);
  branches.forEach((branch) => enableBranch(state, branch));
  return state;
};

const BASIC_BRANCHES = [
  ["COMPANY SETTINGS", "Website Builder", "Static Website"],
  ["COMPANY SETTINGS", "Wono Nomad"],
  ["COMPANY SETTINGS", "Website Leads"],
  ["COMPANY SETTINGS", "Organization Management", "User Count"],
  ["COMPANY SETTINGS", "Organization Management", "Add User"],
  ["COMPANY SETTINGS", "Access Grants", "Transfer Ownership"],
  ["COMPANY SETTINGS", "Access Grants", "Access Button"],
  ["COMPANY SETTINGS", "Customer Support"],
  ["KEY APPS", "Visitor Management", "Daily Visitors"],
  ["KEY APPS", "Visitor Management", "Visitor History"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor Tabs", "Standard Visitor Tab"],
];

const PROFESSIONAL_ADDITIONAL_BRANCHES = [
  ["COMPANY SETTINGS", "Workspace Settings"],
  ["COMPANY SETTINGS", "Organization Management", "Departments Tab"],
  ["COMPANY SETTINGS", "Access Grants", "Promote / Demote"],
  ["COMPANY SETTINGS", "Access Grants", "Transfer Workspace"],
  ["COMPANY SETTINGS", "Access Grants", "Add Workspace Access"],
  ["COMPANY SETTINGS", "Website Builder", "Dynamic Website"],
  ["KEY APPS", "Visitor Management", "Bookings"],
  ["KEY APPS", "Visitor Management", "Clients"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Workspace Tour"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Walk-In Booking"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Verify Booking ID"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor Tabs", "Department Visitor Tab"],
  ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor Tabs", "Tenant Company Visitor Tab"],
  ["KEY APPS", "Meeting Room System"],
  ["KEY APPS", "Tickets"],
  ["KEY APPS", "Calendar"],
  ["DEPARTMENT ACCESSES", "Sales Department"],
];

const CUSTOMIZE_ADDITIONAL_BRANCHES = [
  ["COMPANY SETTINGS", "Analytics"],
  ["KEY APPS", "Attendance"],
  ["KEY APPS", "Tasks"],
  ["KEY APPS", "Leave Requests"],
  ["KEY APPS", "Assets"],
  ["KEY APPS", "Inventory"],
  ["KEY APPS", "Finance Management"],
  ["KEY APPS", "Reports"],
  ["DEPARTMENT ACCESSES", "HR Department"],
  ["DEPARTMENT ACCESSES", "Administration Department"],
  ["DEPARTMENT ACCESSES", "Finance Department"],
  ["DEPARTMENT ACCESSES", "Maintenance Department"],
  ["DEPARTMENT ACCESSES", "Tech Department"],
  ["DEPARTMENT ACCESSES", "IT Department"],
];

export const resolvePlanKey = (rawPlan) => {
  const value = String(rawPlan || "").trim().toLowerCase();
  if (!value) return "basic";
  if (value.includes("custom")) return "customize";
  if (value.includes("pro")) return "professional";
  return "basic";
};

export const buildPlanState = (rawPlan) => {
  const planKey = resolvePlanKey(rawPlan);
  if (planKey === "basic") {
    return withEnabledBranches(BASIC_BRANCHES);
  }

  if (planKey === "professional") {
    return withEnabledBranches([...BASIC_BRANCHES, ...PROFESSIONAL_ADDITIONAL_BRANCHES]);
  }

  return withEnabledBranches([
    ...BASIC_BRANCHES,
    ...PROFESSIONAL_ADDITIONAL_BRANCHES,
    ...CUSTOMIZE_ADDITIONAL_BRANCHES,
  ]);
};

const roleIncludes = (designation = "", tokens = []) => {
  const normalized = String(designation || "").toLowerCase();
  return tokens.some((token) => normalized.includes(token));
};

export const buildRoleStateFromPlan = ({ planState, designation = "" }) => {
  const fullState = { ...planState };

  if (roleIncludes(designation, ["founder", "super admin"])) {
    return fullState;
  }

  const restricted = initializeDisabledTreeState(MODULE_SECTIONS);
  enableBranch(restricted, ["KEY APPS"]);

  if (roleIncludes(designation, ["admin", "manager"])) {
    enableBranch(restricted, ["DEPARTMENT ACCESSES"]);
  }

  const next = { ...restricted };
  Object.keys(next).forEach((key) => {
    next[key] = Boolean(next[key]) && Boolean(planState[key]);
  });
  return next;
};

