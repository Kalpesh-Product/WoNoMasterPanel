// Hand-synced with HostPanel's server/config/workspaceModuleCatalog.ts
// (MODULE_GROUPS, BASIC_DEFAULT_IDS, PROFESSIONAL_DEFAULT_IDS). Only the
// pieces the module-wise analytics engine needs are ported here: static
// labels/sections for display, and which modules a plan unlocks by default.
// The deep per-permission sub-ids (org_tab_users, visitors_tab_daily, etc.)
// and custom-department handling are intentionally left out — they don't
// have analytics providers and aren't needed for this view.
const PLAN_ORDER = ["basic", "professional", "custom"];

const MODULE_GROUPS = [
  {
    sectionId: "common-modules",
    sectionLabel: "Common Modules",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "customer-support", label: "Customer Support" },
      { id: "attendance", label: "Attendance" },
      { id: "tasks", label: "Tasks" },
      { id: "tickets", label: "Tickets" },
      { id: "leave-requests", label: "Leave Requests" },
      { id: "meeting-room-system", label: "Meeting Room Booking" },
      { id: "printouts", label: "Printouts" },
      { id: "calendar", label: "Calendar" },
    ],
  },
  {
    sectionId: "extra-common-modules",
    sectionLabel: "Extra Common Modules",
    items: [
      { id: "assets", label: "Assets" },
      { id: "inventory", label: "Inventory" },
      { id: "finance-management", label: "Finance Management" },
      { id: "team-management", label: "Team Management" },
      { id: "reports", label: "Reports" },
    ],
  },
  {
    sectionId: "key-apps",
    sectionLabel: "Key Apps",
    items: [
      { id: "website-builder", label: "Website Builder" },
      { id: "wono-nomad", label: "Nomad Listings" },
      { id: "website-leads", label: "All Leads" },
      { id: "visitor-management", label: "Visitor Management" },
    ],
  },
  {
    sectionId: "founder-core-modules",
    sectionLabel: "Core Modules",
    items: [
      { id: "organization-management", label: "Organization Management" },
      { id: "access-grants", label: "Access Grants" },
      { id: "workspace-settings", label: "Unit Settings" },
      { id: "workspace-management", label: "Unit Management" },
      { id: "analytics", label: "Analytics" },
    ],
  },
  {
    sectionId: "department-accesses",
    sectionLabel: "Department Accesses",
    items: [
      {
        id: "hr-department",
        label: "HR Department",
        tabs: [
          { id: "employee-management", label: "Company Management" },
          { id: "hr-documents", label: "Documents" },
          { id: "recruitment", label: "Recruitment" },
          { id: "leave-request-processing", label: "Leave Request Processing" },
          { id: "attendance-review", label: "Attendance Review" },
          { id: "payroll-management", label: "Payroll Management" },
          { id: "exit-management", label: "Resignation Management" },
        ],
      },
      {
        id: "administration-department",
        label: "Administration Department",
        tabs: [
          { id: "tenant-companies-admin", label: "Tenant Companies" },
          { id: "bookings", label: "Bookings" },
          { id: "visitors-management", label: "Visitors Management" },
          { id: "resource-management", label: "Resource Management" },
          { id: "house-keeping", label: "House Keeping" },
          { id: "printout-management", label: "Printout Management" },
        ],
      },
      {
        id: "sales-department",
        label: "Sales Department",
        tabs: [
          { id: "leads-management", label: "Leads Management" },
          { id: "tenant-companies-sales", label: "Tenant Companies" },
          { id: "virtual-office-sales", label: "Virtual Offices" },
          { id: "resource-pricing", label: "Resource & Pricing" },
          { id: "sales-architecture", label: "Sales Architecture" },
        ],
      },
      {
        id: "finance-department",
        label: "Finance Department",
        tabs: [
          { id: "finance-budget", label: "Finance & Budget" },
          { id: "billing-payments", label: "Billing & Payments" },
          { id: "accounting", label: "Accounting" },
        ],
      },
      {
        id: "maintenance-department",
        label: "Maintenance Department",
        tabs: [
          { id: "maintenance-repair-logs", label: "Maintenance Repair Logs" },
          { id: "amc-maintenance-scheduler", label: "AMC Maintenance Scheduler" },
        ],
      },
      {
        id: "tech-department",
        label: "Tech Department",
        tabs: [
          { id: "tech-website-builder", label: "Website Builder" },
          { id: "website-leads", label: "Website Leads" },
          { id: "website-review", label: "Website Review" },
        ],
      },
      {
        id: "it-department",
        label: "IT Department",
        tabs: [{ id: "it-repair-logs", label: "IT Repair Logs" }],
      },
    ],
  },
];

const normalizePlan = (value = "") => {
  const plan = String(value || "").trim().toLowerCase();
  return PLAN_ORDER.includes(plan) ? plan : "basic";
};

// "INC PLAN" sets, hand-synced from HostPanel's workspaceModuleCatalog.ts —
// see that file for the full rationale. "All" -> Basic (and therefore every
// higher tier). "Professional" -> added on top of Basic here. "Custom" has no
// default set of its own; those modules are only ever unlocked per-workspace.
const BASIC_DEFAULT_IDS = new Set([
  "dashboard",
  "customer-support",
  "visitor-management",
  "wono-nomad",
  "website-builder",
  "tech-website-builder",
  "website-leads",
  "website-review",
  "organization-management",
  "access-grants",
  "analytics",
]);

const PROFESSIONAL_DEFAULT_IDS = new Set([
  ...Array.from(BASIC_DEFAULT_IDS),
  "tickets",
  "meeting-room-system",
  "printouts",
  // "printout-management" (Administration Department admin console) is a
  // separate id from "printouts" (common self-service module) so this list
  // can toggle them independently — kept in sync with HostPanel's.
  "printout-management",
  "calendar",
  "workspace-settings",
  "workspace-management",
  // Administration Department is a Professional default — kept in sync with
  // HostPanel's PROFESSIONAL_DEFAULT_IDS (workspaceModuleCatalog.ts).
  "tenant-companies-admin",
  "bookings",
  "visitors-management",
  "resource-management",
  "house-keeping",
  "leads-management",
  "tenant-companies-sales",
  "virtual-office-sales",
  "resource-pricing",
  "sales-architecture",
]);

const canPlanAccess = (plan = "basic", moduleId = "") => {
  const normalizedPlan = normalizePlan(plan);
  if (normalizedPlan === "custom" || normalizedPlan === "professional") {
    return PROFESSIONAL_DEFAULT_IDS.has(moduleId);
  }
  return BASIC_DEFAULT_IDS.has(moduleId);
};

const collectLeafModules = (items = []) => {
  const result = [];
  for (const item of items) {
    if (Array.isArray(item.tabs) && item.tabs.length) {
      result.push(...item.tabs);
    } else {
      result.push(item);
    }
  }
  return result;
};

const getDefaultEnabledModuleIdsForPlan = (selectedPlan = "basic") => {
  const normalizedPlan = normalizePlan(selectedPlan);
  const ids = new Set();
  for (const section of MODULE_GROUPS) {
    for (const module of collectLeafModules(section.items || [])) {
      if (canPlanAccess(normalizedPlan, module.id)) ids.add(module.id);
    }
  }
  return Array.from(ids);
};

const planAvailabilityFor = (moduleId) => {
  if (BASIC_DEFAULT_IDS.has(moduleId)) return "All Plans";
  if (PROFESSIONAL_DEFAULT_IDS.has(moduleId)) return "Professional +";
  return "Custom";
};

// Same "first match wins by section priority" rule as HostPanel's
// buildCatalogIndex — the department tabs above legitimately repeat ids that
// also appear as top-level items (e.g. website-leads), so an explicit
// priority order keeps each id's label/section resolving to its primary home
// instead of whichever section happened to iterate last.
const SECTION_PRIORITY = {
  "common-modules": 0,
  "extra-common-modules": 1,
  "key-apps": 2,
  "founder-core-modules": 3,
  "department-accesses": 4,
};

let cachedCatalogIndex = null;
const buildCatalogIndex = () => {
  if (cachedCatalogIndex) return cachedCatalogIndex;
  const index = new Map();
  // `order` is a running counter over the exact walk order below — i.e. the
  // real Host Panel sidebar flow: Common Modules, then Extra Common Modules,
  // then Key Apps, then Core Modules, then each department one by one (HR,
  // Administration, Sales, Finance, Maintenance, Tech, IT) in that order.
  // Sorting modules by `order` reproduces that flow directly, no separate
  // section-ordering step needed on the caller's side.
  let orderCounter = 0;
  const consider = (id, payload, priority) => {
    const order = orderCounter++;
    if (!id) return;
    const existing = index.get(id);
    if (!existing || priority < existing.priority) {
      index.set(id, { ...payload, priority, order });
    }
  };

  MODULE_GROUPS.forEach((section) => {
    const priority = SECTION_PRIORITY[section.sectionId] ?? 99;
    (section.items || []).forEach((item) => {
      if (Array.isArray(item.tabs) && item.tabs.length) {
        item.tabs.forEach((tab) => {
          consider(tab.id, { label: tab.label || tab.id, sectionLabel: item.label || section.sectionLabel }, priority);
        });
        return;
      }
      consider(item.id, { label: item.label || item.id, sectionLabel: section.sectionLabel }, priority);
    });
  });

  cachedCatalogIndex = index;
  return index;
};

// Real modules/departments staff can actually price as Custom-plan add-ons —
// anything NOT already included free at Professional (PROFESSIONAL_DEFAULT_IDS)
// — derived straight from MODULE_GROUPS instead of staff typing ids by hand
// on the Plan Pricing settings page.
//
// A department's chargeable tabs are ALWAYS exposed BOTH ways at once, never
// either/or:
//   1. individually, as their own "module" entries — so a Custom workspace
//      that only wants e.g. 2 of HR Department's 7 tabs can be priced for
//      exactly those 2, and
//   2. (when there are 2+ chargeable tabs) ALSO as a "department" bundle
//      covering all of them at one discounted flat rate, for when a
//      workspace wants the whole department.
// computeCustomPlanMonthlyPrice (modulePricingService.js) already prefers
// the bundle price only when every one of its ids is selected, and falls
// back to summing individual module prices otherwise — this catalog just
// needs to offer both options for staff to price.
//
// A department already fully covered by Professional (e.g. Administration,
// Sales) has zero chargeable tabs and is excluded entirely; nothing
// already-free is ever priced.
const getPriceableCatalog = () => {
  const modules = [];
  const departments = [];

  for (const section of MODULE_GROUPS) {
    for (const item of section.items || []) {
      if (Array.isArray(item.tabs) && item.tabs.length) {
        const chargeableTabs = item.tabs.filter((tab) => !PROFESSIONAL_DEFAULT_IDS.has(tab.id));
        if (!chargeableTabs.length) continue;

        for (const tab of chargeableTabs) {
          modules.push({
            itemId: tab.id,
            label: `${item.label || item.id} — ${tab.label || tab.id}`,
            sectionLabel: section.sectionLabel,
          });
        }

        // A "bundle" of a single tab is just that module's own price, so
        // only offer the whole-department option once there's actually
        // something to bundle.
        if (chargeableTabs.length > 1) {
          departments.push({
            itemId: item.id,
            label: item.label || item.id,
            sectionLabel: section.sectionLabel,
            includesModuleIds: chargeableTabs.map((tab) => tab.id),
          });
        }
        continue;
      }

      if (!PROFESSIONAL_DEFAULT_IDS.has(item.id)) {
        modules.push({ itemId: item.id, label: item.label || item.id, sectionLabel: section.sectionLabel });
      }
    }
  }

  return { modules, departments };
};

module.exports = {
  MODULE_GROUPS,
  normalizePlan,
  getDefaultEnabledModuleIdsForPlan,
  planAvailabilityFor,
  buildCatalogIndex,
  getPriceableCatalog,
};
