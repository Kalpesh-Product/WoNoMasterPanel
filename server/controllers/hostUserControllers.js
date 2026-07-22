const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const HostCompany = require("../models/hostCompany/hostCompany");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const HostUser = require("../models/hostCompany/hostUser");
const TestHostUser = require("../models/hostCompany/TestHostUser");
const HostInviteStatus = require("../models/hostCompany/HostInviteStatus");
const BookingPaymentLink = require("../models/hostCompany/BookingPaymentLink");
const Workspace = require("../models/hostCompany/Workspace");
const WorkspaceMember = require("../models/hostCompany/WorkspaceMember");
const { sendMail } = require("../config/nodemailerConfig");
const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");
const {
  createModuleAccessLog,
  getActorFromRequest,
  resolveSourcePanel,
} = require("../utils/moduleAccessLogs");

const normalizeBaseUrl = (url) => (url || "").replace(/\/+$/, "");

const resolveHostPanelFrontendUrl = () => {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    return normalizeBaseUrl(
      process.env.HOST_PANEL_FRONTEND_URL || "https://wonohostfe.vercel.app",
    );
  }

  return normalizeBaseUrl(
    process.env.HOST_PANEL_FRONTEND_URL_DEV ||
      process.env.HOST_PANEL_FRONTEND_URL_LOCAL ||
      "http://localhost:3006",
  );
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCompanyIdPrefixRegex = (companyId = "") => {
  const normalized = String(companyId || "").trim();
  if (!normalized) return null;

  return new RegExp(`^${escapeRegex(normalized)}(?:$|-)`, "i");
};

const buildExactCaseInsensitiveRegex = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return new RegExp(`^${escapeRegex(normalized)}$`, "i");
};

const normalizeInviteStatus = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (normalized === "invite_sent") return "invite_sent";
  if (normalized === "registered") return "registered";
  if (normalized === "joined") return "joined";
  return "not_invited";
};

const normalizeVerticalType = (verticalType) => {
  if (Array.isArray(verticalType)) {
    return verticalType
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const value = String(verticalType || "").trim();
  return value ? [value] : [];
};

const deriveInviteStatus = (hostUser) => {
  if (hostUser?.joinedAt || hostUser?.refreshToken) {
    return "joined";
  }

  if (hostUser?.registeredAt || hostUser?.password) {
    return "registered";
  }

  if (hostUser?.inviteSentAt || hostUser?.inviteStatus === "invite_sent") {
    return "invite_sent";
  }

  return normalizeInviteStatus(hostUser?.inviteStatus);
};

const inviteStatusPriority = {
  not_invited: 0,
  invite_sent: 1,
  registered: 2,
  joined: 3,
};

const mergeInviteRecords = (base = {}, incoming = {}) => {
  const baseStatus = deriveInviteStatus(base);
  const incomingStatus = deriveInviteStatus(incoming);

  const chosen =
    (inviteStatusPriority[incomingStatus] || 0) >=
    (inviteStatusPriority[baseStatus] || 0)
      ? { ...base, ...incoming }
      : { ...incoming, ...base };

  return {
    ...chosen,
    inviteStatus:
      (inviteStatusPriority[incomingStatus] || 0) >=
      (inviteStatusPriority[baseStatus] || 0)
        ? incomingStatus
        : baseStatus,
  };
};

const syncInviteLifecycle = async (hostUser) => {
  if (!hostUser) return "not_invited";

  const derivedStatus = deriveInviteStatus(hostUser);
  const updates = {};

  if (derivedStatus !== normalizeInviteStatus(hostUser.inviteStatus)) {
    updates.inviteStatus = derivedStatus;
  }

  if (derivedStatus === "registered" && !hostUser.registeredAt) {
    updates.registeredAt = hostUser.updatedAt || new Date();
  }

  if (derivedStatus === "joined" && !hostUser.joinedAt) {
    updates.joinedAt = hostUser.updatedAt || new Date();
  }

  if (Object.keys(updates).length) {
    await HostUser.updateOne({ _id: hostUser._id }, { $set: updates });
    Object.assign(hostUser, updates);
  }

  return deriveInviteStatus(hostUser);
};

const getMailButton = (href, label) => `
  <a
    href="${href}"
    style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
  >
    ${label}
  </a>
`;

const buildSignupInviteEmail = ({ name, companyName, inviteLink }) => ({
  subject: "Your Wono invite",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">You're invited to Wono</h2>
      <p>Hello ${name},</p>
      <p>Your signup request for ${companyName || "your company"} has been approved.</p>
      <p>You can now proceed with the next step using the Wono platform.</p>
      <p>${getMailButton(inviteLink, "Continue Signup")}</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const buildUpgradePaymentEmail = ({
  name,
  companyName,
  selectedPlan,
  paymentLinkUrl,
}) => ({
  subject: "Complete your Wono plan upgrade payment",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Upgrade payment link</h2>
      <p>Hello ${name},</p>
      <p>Your request to upgrade <strong>${companyName || "your company"}</strong> to the <strong>${selectedPlan}</strong> plan is ready for payment.</p>
      <p>Please complete your payment using the link below. Access will be upgraded after our team confirms the payment.</p>
      <p>${getMailButton(paymentLinkUrl, "Pay Now")}</p>
      <p>If you already paid, please wait for confirmation from our team.</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const buildUpgradeSuccessEmail = ({ name, companyName, selectedPlan, loginUrl }) => ({
  subject: "Your Wono plan has been upgraded successfully",
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 16px;">Plan upgraded successfully</h2>
      <p>Hello ${name},</p>
      <p>Your plan for <strong>${companyName || "your company"}</strong> has been upgraded successfully to <strong>${selectedPlan}</strong>.</p>
      <p>You can now log in and start using the upgraded access.</p>
      <p>${getMailButton(loginUrl, "Login")}</p>
      <p>If you face any issue logging in, please contact our support team.</p>
      <p>Regards,<br />Wono</p>
    </div>
  `,
});

const buildBookingPaymentEmail = ({
  customerName,
  companyName,
  productType,
  startDate,
  endDate,
  noOfPeople,
  paymentLinkUrl,
  amount,
  currency,
}) => {
  const formattedAmount =
    amount === undefined || amount === null
      ? null
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: String(currency || "INR").toUpperCase(),
          maximumFractionDigits: 2,
        }).format(amount);

  return {
    subject: `Complete your ${productType || "booking"} payment`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #1f2937;">
        <h2 style="color: #2563eb;">Complete Your Booking Payment</h2>

        <p>Hello ${customerName},</p>

        <p>
          Thank you for choosing WONO. Your booking details have been confirmed.
          Please complete the payment using the link below.
        </p>

        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Company:</strong> ${companyName || "N/A"}</p>
          <p><strong>Booking type:</strong> ${productType || "N/A"}</p>
          <p><strong>Number of people:</strong> ${noOfPeople || "N/A"}</p>
          <p><strong>Start date:</strong> ${startDate || "N/A"}</p>
          <p><strong>End date:</strong> ${endDate || "N/A"}</p>
          ${formattedAmount ? `<p><strong>Amount due:</strong> ${formattedAmount}</p>` : ""}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a
            href="${paymentLinkUrl}"
            target="_blank"
            style="
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              display: inline-block;
              font-weight: 600;
            "
          >
            Pay Now
          </a>
        </div>

        <p>
          If the button does not work, copy and paste this URL into your browser:
        </p>

        <p>
          <a href="${paymentLinkUrl}">${paymentLinkUrl}</a>
        </p>

        <p>Regards,<br />WONO Team</p>
      </div>
    `,
  };
};

const DEFAULT_WORKSPACE_ID = "default-workspace";

const normalizeWorkspaceName = (workspaceName = "") => {
  const normalized = String(workspaceName || "").trim();
  return normalized || "Main Workspace";
};

const normalizeWorkspaceId = (workspaceId = "") => {
  const normalized = String(workspaceId || "").trim();
  return normalized || DEFAULT_WORKSPACE_ID;
};

// Canonical ids/labels below are hand-synced from HostPanel's real catalog
// (Host Panel/HostPanel/server/config/workspaceModuleCatalog.ts MODULE_GROUPS,
// excluding its "add-ons" section which is just a flattened duplicate used
// only for HostPanel's sidebar upsell tray, not a real category). Keeping
// these ids identical to HostPanel's is what lets a workspace's stored
// modules snapshot actually match what HostPanel enforces.
const DEPARTMENT_ACCESS_CATEGORY = "DEPARTMENT ACCESSES";
const DEPARTMENT_ACCESS_BLUEPRINT = [
  {
    id: "hr-department",
    name: "HR Department",
    children: [
      { id: "employee-management", name: "Employee Management" },
      { id: "hr-documents", name: "Documents" },
      { id: "recruitment", name: "Recruitment" },
      { id: "attendance-review", name: "Attendance Review" },
      { id: "leave-request-processing", name: "Leave Request Processing" },
      { id: "payroll-management", name: "Payroll Management" },
      { id: "exit-management", name: "Exit Management" },
    ],
  },
  {
    id: "administration-department",
    name: "Administration Department",
    children: [
      { id: "tenant-companies-admin", name: "Tenant Companies" },
      { id: "bookings", name: "Bookings" },
      { id: "visitors-management", name: "Visitors Management" },
      { id: "resource-management", name: "Resource Management" },
      { id: "house-keeping", name: "House Keeping" },
    ],
  },
  {
    id: "sales-department",
    name: "Sales Department",
    children: [
      { id: "leads-management", name: "Leads Management" },
      { id: "tenant-companies-sales", name: "Tenant Companies" },
      { id: "resource-pricing", name: "Resource & Pricing" },
      { id: "sales-architecture", name: "Sales Architecture" },
    ],
  },
  {
    id: "finance-department",
    name: "Finance Department",
    children: [
      { id: "finance-budget", name: "Finance & Budget" },
      { id: "billing-payments", name: "Billing & Payments" },
      { id: "accounting", name: "Accounting" },
    ],
  },
  {
    id: "maintenance-department",
    name: "Maintenance Department",
    children: [
      { id: "maintenance-repair-logs", name: "Maintenance Repair Logs" },
      { id: "amc-maintenance-scheduler", name: "AMC Maintenance Scheduler" },
    ],
  },
  {
    id: "tech-department",
    name: "Tech Department",
    children: [
      {
        id: "tech-website-builder",
        name: "Website Builder",
        mirrorFromId: "website-builder",
      },
    ],
  },
  {
    id: "it-department",
    name: "IT Department",
    children: [{ id: "it-repair-logs", name: "IT Repair Logs" }],
  },
];

const COMMON_MODULES_BLUEPRINT = {
  category: "COMMON MODULES",
  items: [
    { id: "dashboard", name: "Dashboard" },
    { id: "customer-support", name: "Customer Support" },
    { id: "attendance", name: "Attendance" },
    { id: "tasks", name: "Tasks" },
    { id: "tickets", name: "Tickets" },
    { id: "leave-requests", name: "Leave Requests" },
    { id: "meeting-room-system", name: "Meeting Room Booking" },
    { id: "calendar", name: "Calendar" },
  ],
};

const EXTRA_COMMON_MODULES_BLUEPRINT = {
  category: "EXTRA COMMON MODULES",
  items: [
    { id: "assets", name: "Assets" },
    { id: "inventory", name: "Inventory" },
    { id: "finance-management", name: "Finance Management" },
    { id: "reports", name: "Reports" },
  ],
};

const KEY_APPS_BLUEPRINT = {
  category: "KEY APPS",
  items: [
    {
      id: "visitor-management",
      name: "Visitor Management",
      children: [
        { id: "visitors_manage_internal_visitors", name: "Standard/Internal Visitors (Manage Visitors)" },
        { id: "visitors_manage_external_clients", name: "External Clients (Manage Visitors)" },
        { id: "visitors_tab_daily", name: "Daily Visitors Tab" },
        { id: "visitors_tab_history", name: "Visitor History Tab" },
        { id: "visitors_tab_bookings", name: "Bookings Tab" },
        { id: "visitors_tab_clients", name: "Clients Tab" },
        {
          id: "visitors_mode_standard",
          name: "New Frontdesk Action — Standard Visitor",
          children: [
            { id: "visitors_standard_type_standard", name: "Standard Subtab" },
            { id: "visitors_standard_type_department", name: "Department Subtab" },
            { id: "visitors_standard_type_tenant", name: "Tenant Subtab" },
          ],
        },
        { id: "visitors_mode_workspace_tour", name: "New Frontdesk Action — Unit Tour" },
        { id: "visitors_mode_walkin_booking", name: "New Frontdesk Action — Walk-in Booking" },
        { id: "visitors_mode_verify_booking", name: "New Frontdesk Action — Verify Booking" },
      ],
    },
    { id: "website-builder", name: "Website Builder" },
    { id: "wono-nomad", name: "Wono Nomad" },
    { id: "website-leads", name: "Website Leads" },
  ],
};

const FOUNDER_CORE_MODULES_BLUEPRINT = {
  category: "FOUNDER CORE MODULES",
  items: [
    {
      id: "organization-management",
      name: "Organization Management",
      children: [
        {
          id: "org_tab_users",
          name: "Users",
          children: [
            { id: "org_users_invite_member", name: "Invite Member" },
            { id: "org_users_change_role", name: "Change Role" },
            { id: "org_users_toggle_access", name: "Toggle Access" },
          ],
        },
        {
          id: "org_tab_departments",
          name: "Departments",
          children: [
            { id: "org_departments_create", name: "Create Department" },
            { id: "org_departments_edit", name: "Edit Department" },
            { id: "org_departments_assign_manager", name: "Assign Manager" },
            { id: "org_departments_assign_acting_manager", name: "Assign Acting Manager" },
            { id: "org_departments_remove_acting_manager", name: "Remove Acting Manager" },
          ],
        },
      ],
    },
    { id: "access-grants", name: "Access Grants" },
    { id: "workspace-settings", name: "Unit Settings" },
    { id: "workspace-management", name: "Unit Management" },
    { id: "analytics", name: "Analytics" },
  ],
};

// One entry per real HostPanel section — the single source every workspace's
// stored `modules` snapshot gets reconciled against (see
// mergeCanonicalModulesIntoWorkspace below). Add a module here once, in one
// place, and every workspace self-heals to include it on its next read/save.
const CANONICAL_SECTION_BLUEPRINTS = [
  { category: COMMON_MODULES_BLUEPRINT.category, items: COMMON_MODULES_BLUEPRINT.items },
  { category: EXTRA_COMMON_MODULES_BLUEPRINT.category, items: EXTRA_COMMON_MODULES_BLUEPRINT.items },
  { category: KEY_APPS_BLUEPRINT.category, items: KEY_APPS_BLUEPRINT.items },
  { category: FOUNDER_CORE_MODULES_BLUEPRINT.category, items: FOUNDER_CORE_MODULES_BLUEPRINT.items },
  { category: DEPARTMENT_ACCESS_CATEGORY, items: DEPARTMENT_ACCESS_BLUEPRINT },
];

const buildFallbackWorkspace = () => ({
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspaceName: "Main Workspace",
  selectedPlan: "basic",
});

const flattenGrantedModulesFromTreeState = (treeState = {}) =>
  Object.entries(treeState || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => String(key || "").trim())
    .filter(Boolean);

const normalizeMemberWorkspaceAccess = (member, options = {}) => {
  const { allowFallback = true } = options;
  const workspaceAccess = Array.isArray(member?.workspaceAccess)
    ? member.workspaceAccess
    : [];

  if (!workspaceAccess.length) {
    if (!allowFallback) {
      return [];
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: "Main Workspace",
        moduleAccess: member?.moduleAccess || {},
        grantedModules: Array.isArray(member?.grantedModules) ? member.grantedModules : [],
      },
    ];
  }

  return workspaceAccess.map((workspace) => ({
    workspaceId: normalizeWorkspaceId(workspace?.workspaceId),
    workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
    moduleAccess: workspace?.moduleAccess || {},
    grantedModules: Array.isArray(workspace?.grantedModules) ? workspace.grantedModules : [],
  }));
};

const normalizeWorkspaceModules = (rawModules = []) => {
  const source = Array.isArray(rawModules)
    ? rawModules
    : rawModules && typeof rawModules === "object"
      ? Object.values(rawModules)
      : [];

  return source
    .map((entry) => ({
      category: String(entry?.category || entry?.name || "").trim(),
      items: (Array.isArray(entry?.items) ? entry.items : []).map((item) => ({
        id: String(item?.id || item?.moduleId || "").trim(),
      })),
    }))
    .filter((entry) => entry.category || entry.items.length);
};

const indexWorkspaceModuleIds = (rawModules = []) => {
  const modules = Array.isArray(rawModules)
    ? rawModules
    : rawModules && typeof rawModules === "object"
      ? Object.values(rawModules)
      : [];

  const pathToId = new Map();
  const idToPath = new Map();
  const idSet = new Set();

  const visit = (nodes = [], path = []) => {
    const list = Array.isArray(nodes) ? nodes : [];
    list.forEach((node) => {
      const name = String(
        node?.name ||
          node?.title ||
          node?.dropdownTitle ||
          node?.label ||
          node?.moduleName ||
          node?.submoduleName ||
          "",
      ).trim();
      if (!name) return;

      const currentPath = [...path, name];
      const pathKey = currentPath.join("::");
      const moduleId = String(node?.id || node?.moduleId || "").trim();
      if (moduleId) {
        pathToId.set(pathKey, moduleId);
        idToPath.set(moduleId, pathKey);
        idSet.add(moduleId);
      }

      visit(getNodeChildren(node), currentPath);
    });
  };

  modules.forEach((category) => {
    const categoryName = String(category?.category || category?.name || "").trim();
    const startPath = categoryName ? [categoryName] : [];
    visit(getNodeChildren(category), startPath);
  });

  return { pathToId, idToPath, idSet };
};

const collectWorkspaceModuleIds = (rawModules = []) => {
  const modules = Array.isArray(rawModules)
    ? rawModules
    : rawModules && typeof rawModules === "object"
      ? Object.values(rawModules)
      : [];
  const ids = new Set();

  const visit = (nodes = []) => {
    const list = Array.isArray(nodes) ? nodes : [];
    list.forEach((node) => {
      const children = getNodeChildren(node);
      const moduleId = String(node?.id || node?.moduleId || "").trim();
      if (moduleId && !moduleId.startsWith("idx::")) {
        ids.add(moduleId);
      }
      if (children.length) {
        visit(children);
      }
    });
  };

  modules.forEach((category) => visit(getNodeChildren(category)));
  return Array.from(ids);
};

const sanitizeEnabledModuleIds = (enabledIds = [], workspaceModules = []) => {
  // Allow any real module id regardless of whether it's a leaf or a group
  // in master panel's own tree (e.g. "organization-management" is a group
  // here, wrapping its Users/Departments sub-permissions, but it's still a
  // genuine standalone module id HostPanel checks directly — filtering it
  // out because it happens to have children was silently stripping it from
  // enabledModuleIds on every save).
  const allowed = new Set(collectWorkspaceModuleIds(workspaceModules));
  return (Array.isArray(enabledIds) ? enabledIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && allowed.has(id));
};

// Previously linked ["visitor-management", "visitors-management"] so
// toggling either kept both in sync (they're the same underlying
// /visitors/visitor-management page). Removed: "visitors-management" is now
// deliberately Custom-only (Administration Department), while
// "visitor-management" (Key Apps) stays on at every plan — linking them
// meant enabling the always-on Key Apps entry silently re-enabled the
// Administration Department tab on every read/save, undoing that
// restriction. Empty for now; add groups back here only for ids that should
// genuinely always move together.
const LINKED_MODULE_ID_GROUPS = [];

// Hand-synced with HostPanel's server/config/workspaceModuleCatalog.ts
// (visitors_manage_* ids), server/config/visitorPermissionMap.ts (module +
// manage-visitors tabs), and constants/permissions.ts VISITORS_TAB_*/
// VISITORS_MODE_*/VISITORS_STANDARD_TYPE_* (the separate VisitorManagement.tsx
// start-page + New Frontdesk Action permission scheme). Same
// module/tabs/actions split as ORGANIZATION_PERMISSION_MAP below, so it gets
// the same "only usable while the parent module is enabled" gating.
const VISITOR_PERMISSION_MAP = {
  module: "visitor-management",
  tabs: [
    "visitors_manage_internal_visitors",
    "visitors_manage_external_clients",
    "visitors_tab_daily",
    "visitors_tab_history",
    "visitors_tab_bookings",
    "visitors_tab_clients",
  ],
  actions: [
    "visitors_mode_standard",
    "visitors_mode_workspace_tour",
    "visitors_mode_walkin_booking",
    "visitors_mode_verify_booking",
    "visitors_standard_type_standard",
    "visitors_standard_type_department",
    "visitors_standard_type_tenant",
  ],
};

const VISITOR_ACCESS_KEYS = new Set([
  "visitor-management",
  "visitors-management",
  ...VISITOR_PERMISSION_MAP.tabs,
  ...VISITOR_PERMISSION_MAP.actions,
]);

const ORGANIZATION_PERMISSION_MAP = {
  module: "organization-management",
  tabs: ["org_tab_users", "org_tab_departments"],
  actions: [
    "org_users_invite_member",
    "org_users_change_role",
    "org_users_toggle_access",
    "org_departments_create",
    "org_departments_edit",
    "org_departments_assign_manager",
    "org_departments_assign_acting_manager",
    "org_departments_remove_acting_manager",
  ],
};

const ORGANIZATION_ACCESS_KEYS = new Set([
  ORGANIZATION_PERMISSION_MAP.module,
  ...ORGANIZATION_PERMISSION_MAP.tabs,
  ...ORGANIZATION_PERMISSION_MAP.actions,
]);

const expandLinkedModuleIds = (enabledIds = [], workspaceModules = []) => {
  const allowed = new Set(collectWorkspaceModuleIds(workspaceModules));
  const enabled = new Set(
    (Array.isArray(enabledIds) ? enabledIds : [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && allowed.has(id)),
  );

  LINKED_MODULE_ID_GROUPS.forEach((group) => {
    const hasAny = group.some((id) => enabled.has(id));
    if (!hasAny) return;
    group.forEach((id) => {
      if (allowed.has(id)) enabled.add(id);
    });
  });

  return Array.from(enabled);
};

const getChildrenRef = (node = {}) => {
  if (Array.isArray(node?.items)) return "items";
  if (Array.isArray(node?.children)) return "children";
  if (Array.isArray(node?.modules)) return "modules";
  if (Array.isArray(node?.submodules)) return "submodules";
  return "children";
};

const deepCloneJson = (value) => JSON.parse(JSON.stringify(value));

const resolveGrantedModuleIdsFromTreeState = ({
  moduleAccess = {},
  workspaceModules = [],
  workspaceEnabledIds = [],
}) => {
  const enabledSet = new Set(
    (Array.isArray(workspaceEnabledIds) ? workspaceEnabledIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const { pathToId, idSet } = indexWorkspaceModuleIds(workspaceModules);
  const granted = new Set();

  Object.entries(moduleAccess || {}).forEach(([rawKey, isEnabled]) => {
    if (!isEnabled) return;
    const key = String(rawKey || "").trim();
    if (!key) return;

    const fromPath = pathToId.get(key);
    if (fromPath && enabledSet.has(fromPath)) {
      granted.add(fromPath);
      return;
    }

    if (idSet.has(key) && enabledSet.has(key)) {
      granted.add(key);
    }
  });

  return Array.from(granted);
};

const clampModuleAccessStateToWorkspace = ({
  moduleAccess = {},
  workspaceModules = [],
  workspaceEnabledIds = [],
}) => {
  const enabledSet = new Set(
    (Array.isArray(workspaceEnabledIds) ? workspaceEnabledIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const { pathToId, idSet } = indexWorkspaceModuleIds(workspaceModules);
  const clamped = {};

  Object.entries(moduleAccess || {}).forEach(([rawKey, isEnabled]) => {
    const key = String(rawKey || "").trim();
    if (!key) return;
    if (!isEnabled) {
      clamped[key] = false;
      return;
    }

    if (idSet.has(key)) {
      clamped[key] = enabledSet.has(key);
      return;
    }

    const mappedId = pathToId.get(key);
    if (!mappedId) {
      clamped[key] = false;
      return;
    }
    clamped[key] = enabledSet.has(mappedId);
  });

  return clamped;
};

// WorkspaceMember.role is an ObjectId into the shared `roles` collection
// (HostPanel's Role model), not a plain string — see the schema comment in
// WorkspaceMember.js for why we deliberately query the raw collection
// instead of going through any Mongoose model.
const isObjectIdLike = (value) => {
  if (!value) return false;
  if (typeof value === "object") return true;
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
};

let cachedFounderRoleId = null;
const resolveFounderRoleId = async () => {
  if (cachedFounderRoleId) return cachedFounderRoleId;

  const rolesCollection = mongoose.connection.db.collection("roles");
  let founderRole = await rolesCollection.findOne({ name: "founder", isSystemRole: true });
  if (!founderRole) {
    const insertResult = await rolesCollection.insertOne({
      name: "founder",
      workspaceId: null,
      permissions: ["*"],
      isSystemRole: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    cachedFounderRoleId = insertResult.insertedId;
    return cachedFounderRoleId;
  }

  cachedFounderRoleId = founderRole._id;
  return cachedFounderRoleId;
};

// Batch-resolves a list of raw `role` values (ObjectId or legacy plain
// string) to their real role names in one query, keyed by the raw value's
// string form — avoids one `roles` lookup per member in a list endpoint.
const resolveMemberRoleNames = async (rawRoles = []) => {
  const objectIdKeys = new Set();
  rawRoles.forEach((raw) => {
    if (isObjectIdLike(raw)) objectIdKeys.add(String(raw?._id || raw));
  });
  if (!objectIdKeys.size) return new Map();

  const roleDocs = await mongoose.connection.db
    .collection("roles")
    .find({ _id: { $in: Array.from(objectIdKeys).map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ name: 1 })
    .toArray();

  const map = new Map();
  roleDocs.forEach((doc) => map.set(String(doc._id), String(doc?.name || "").trim()));
  return map;
};

const resolveMemberRoleName = (rawRole, roleNameMap) => {
  if (!isObjectIdLike(rawRole)) return String(rawRole || "").trim();
  return roleNameMap?.get(String(rawRole?._id || rawRole)) || "";
};

const upsertFounderWorkspaceMembership = async ({
  workspaceId,
  founderUserId,
  enabledModuleIds = [],
}) => {
  if (!workspaceId || !founderUserId) return null;

  const normalizedEnabled = (Array.isArray(enabledModuleIds) ? enabledModuleIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const founderRoleId = await resolveFounderRoleId();

  return WorkspaceMember.findOneAndUpdate(
    {
      workspace: workspaceId,
      user: founderUserId,
    },
    {
      $set: {
        role: founderRoleId,
        status: "active",
        isPrimary: true,
        isActive: true,
        grantedModules: normalizedEnabled,
        enabledModules: normalizedEnabled,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const normalizeNodeName = (node = {}) =>
  String(
    node?.name ||
      node?.title ||
      node?.dropdownTitle ||
      node?.label ||
      node?.moduleName ||
      node?.submoduleName ||
      "",
  )
    .trim()
    .toLowerCase();

const getNodeChildren = (node = {}) => {
  if (Array.isArray(node?.children)) return node.children;
  if (Array.isArray(node?.items)) return node.items;
  if (Array.isArray(node?.modules)) return node.modules;
  if (Array.isArray(node?.submodules)) return node.submodules;
  return [];
};

const findNodeByModuleId = (nodes = [], moduleId = "") => {
  const target = String(moduleId || "").trim().toLowerCase();
  if (!target || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    const currentId = String(node?.id || node?.moduleId || "").trim().toLowerCase();
    if (currentId && currentId === target) return node;
    const inChildren = findNodeByModuleId(getNodeChildren(node), target);
    if (inChildren) return inChildren;
  }
  return null;
};

// Builds one blueprint node (recursively, so it covers Organization
// Management's 3-level nesting as well as flat leaves) against whatever
// mirror source already exists in the workspace's current raw modules.
const buildBlueprintNode = (entry, allRootNodes) => {
  if (entry.mirrorFromId) {
    const mirroredNode = findNodeByModuleId(allRootNodes, entry.mirrorFromId);
    if (mirroredNode) {
      return {
        ...deepClone(mirroredNode),
        id: entry.id,
        moduleId: entry.id,
        name: entry.name,
      };
    }
  }
  return {
    id: entry.id,
    moduleId: entry.id,
    name: entry.name,
    children: (entry.children || []).map((child) => buildBlueprintNode(child, allRootNodes)),
  };
};

// Recursively reconciles a blueprint's nodes against whatever's already
// stored for that branch — keeps existing node data (so manual per-node
// edits aren't clobbered) but corrects id/name and appends any blueprint
// node missing from the existing set, at any depth.
const mergeBlueprintNodes = (blueprintNodes = [], existingNodes = []) => {
  const itemMapByName = new Map(
    (existingNodes || []).map((item) => [normalizeNodeName(item), item]).filter(([key]) => key),
  );

  let changed = existingNodes.length !== blueprintNodes.length;
  const mergedNodes = blueprintNodes.map((blueprintNode) => {
    const existingItem = itemMapByName.get(normalizeNodeName(blueprintNode));
    if (!existingItem) {
      changed = true;
      return blueprintNode;
    }

    const hasBlueprintChildren = Array.isArray(blueprintNode.children) && blueprintNode.children.length;
    if (!hasBlueprintChildren) {
      return {
        ...deepClone(existingItem),
        id: blueprintNode.id,
        moduleId: blueprintNode.id,
        name: blueprintNode.name,
      };
    }

    const existingChildren = getNodeChildren(existingItem);
    const { mergedNodes: mergedChildren, changed: childrenChanged } = mergeBlueprintNodes(
      blueprintNode.children,
      existingChildren,
    );
    if (childrenChanged) changed = true;

    return {
      ...deepClone(existingItem),
      id: blueprintNode.id,
      moduleId: blueprintNode.id,
      name: blueprintNode.name,
      children: mergedChildren,
    };
  });

  return { mergedNodes, changed };
};

// Reconciles a workspace's stored `modules` snapshot against
// CANONICAL_SECTION_BLUEPRINTS (the single copy of HostPanel's real catalog
// kept in this file) — adds any section/module/tab missing from the stored
// snapshot, at any depth, and corrects ids/labels that drifted. Replaces the
// old department-only merge plus the separate visitor/organization patch
// functions, which duplicated this same reconciliation three different ways.
const mergeCanonicalModulesIntoWorkspace = (rawModules = []) => {
  const sourceModules = Array.isArray(rawModules)
    ? deepClone(rawModules)
    : rawModules && typeof rawModules === "object"
      ? deepClone(Object.values(rawModules))
      : [];

  const allRootNodes = sourceModules.flatMap((category) => getNodeChildren(category));
  let changed = false;

  // Rebuilds the modules array from scratch as exactly the 5 real canonical
  // sections — this both adds anything missing AND drops anything that
  // shouldn't be there (e.g. an "Add-ons" category some workspaces were
  // written with at creation time: HostPanel's own catalog still includes
  // an "add-ons" section that's just a flattened duplicate of every other
  // section, used only for its sidebar's locked-items upsell tray — never a
  // real category here).
  const nextModules = CANONICAL_SECTION_BLUEPRINTS.map(({ category, items }) => {
    const blueprintItems = items.map((entry) => buildBlueprintNode(entry, allRootNodes));

    const existingCategory = sourceModules.find((candidate) => {
      const name = String(candidate?.category || candidate?.name || "").trim().toLowerCase();
      return name === category.toLowerCase();
    });

    if (!existingCategory) {
      changed = true;
      return { category, items: blueprintItems };
    }

    const existingItems = getNodeChildren(existingCategory);
    const { mergedNodes: mergedItems, changed: categoryChanged } = mergeBlueprintNodes(
      blueprintItems,
      existingItems,
    );
    if (categoryChanged) changed = true;

    return {
      ...existingCategory,
      category,
      items: mergedItems,
    };
  });

  if (sourceModules.length !== nextModules.length) changed = true;

  return { modules: nextModules, changed };
};

const getEnabledCommonModuleIds = (workspace = {}) => {
  const enabledIds = new Set(
    Array.isArray(workspace?.enabledModuleIds)
      ? workspace.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [],
  );

  const commonGroups = normalizeWorkspaceModules(workspace?.modules).filter((group) =>
    String(group.category || "").toLowerCase().includes("common"),
  );

  if (!commonGroups.length) return Array.from(enabledIds);

  return commonGroups
    .flatMap((group) => group.items || [])
    .map((item) => String(item?.id || "").trim())
    .filter((id) => id && enabledIds.has(id));
};

const getDefaultMemberEnabledModules = ({ workspace = {}, designation = "" }) => {
  const role = String(designation || "").trim().toLowerCase();
  const enabledIds = Array.isArray(workspace?.enabledModuleIds)
    ? workspace.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  if (!enabledIds.length) return [];
  if (role.includes("founder")) return enabledIds;
  return getEnabledCommonModuleIds(workspace);
};

const toModuleAccessState = (moduleIds = []) =>
  (Array.isArray(moduleIds) ? moduleIds : []).reduce((acc, id) => {
    const key = String(id || "").trim();
    if (key) acc[key] = true;
    return acc;
  }, {});

const buildModuleAccessTreeStateFromIds = ({
  workspaceModules = [],
  enabledModuleIds = [],
}) => {
  const enabledSet = new Set(
    (Array.isArray(enabledModuleIds) ? enabledModuleIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const state = {};
  const modules = Array.isArray(workspaceModules)
    ? workspaceModules
    : workspaceModules && typeof workspaceModules === "object"
      ? Object.values(workspaceModules)
      : [];

  const markPath = (parts = []) => {
    for (let i = 1; i <= parts.length; i += 1) {
      const key = parts.slice(0, i).join("::");
      if (key) state[key] = true;
    }
  };

  const visit = (nodes = [], path = []) => {
    const list = Array.isArray(nodes) ? nodes : [];
    list.forEach((node) => {
      const name = String(
        node?.name ||
          node?.title ||
          node?.dropdownTitle ||
          node?.label ||
          node?.moduleName ||
          node?.submoduleName ||
          "",
      ).trim();
      if (!name) return;
      const currentPath = [...path, name];
      const moduleId = String(node?.id || node?.moduleId || "").trim();
      if (moduleId && enabledSet.has(moduleId)) {
        markPath(currentPath);
      }
      visit(getNodeChildren(node), currentPath);
    });
  };

  modules.forEach((category) => {
    const categoryName = String(category?.category || category?.name || "").trim();
    const rootPath = categoryName ? [categoryName] : [];
    visit(getNodeChildren(category), rootPath);
  });

  return state;
};

const extractNormalizedRoleTokens = (rolesInput = []) => {
  const list = Array.isArray(rolesInput) ? rolesInput : [rolesInput];
  const tokens = new Set();

  list.forEach((role) => {
    if (role === undefined || role === null) return;
    if (typeof role === "string") {
      const normalized = role.trim().toLowerCase();
      if (normalized) tokens.add(normalized);
      return;
    }
    if (typeof role === "object") {
      [
        role.roleID,
        role.roleId,
        role.roleTitle,
        role.roleName,
        role.name,
        role.value,
      ].forEach((value) => {
        const normalized = String(value || "").trim().toLowerCase();
        if (normalized) tokens.add(normalized);
      });
    }
  });

  return tokens;
};

const hasOrganizationAccess = async ({
  actorUserId,
  actorRoles = [],
  companyId,
  workspaceId,
  requiredKey,
}) => {
  const roleSet = extractNormalizedRoleTokens(actorRoles);
  const privilegedRoleTokens = new Set([
    "super admin",
    "master admin",
    "founder",
    "role_super_admin",
    "role_master_admin",
    "role_founder",
  ]);
  if ([...privilegedRoleTokens].some((token) => roleSet.has(token))) {
    return true;
  }

  const required = String(requiredKey || "").trim();
  if (!required || !ORGANIZATION_ACCESS_KEYS.has(required)) return false;
  if (!actorUserId) return false;

  const actor = await HostUser.findById(actorUserId).select("designation").lean();
  const designation = String(actor?.designation || "").trim().toLowerCase();
  if (
    designation.includes("founder") ||
    designation.includes("super admin") ||
    designation.includes("master admin")
  ) {
    return true;
  }

  const requestedWorkspaceId = String(workspaceId || "").trim();
  if (requestedWorkspaceId) {
    const membership = await WorkspaceMember.findOne({
      user: actorUserId,
      workspace: requestedWorkspaceId,
      isActive: true,
    })
      .select("grantedModules enabledModules role isPrimary")
      .lean();
    if (membership?.isPrimary === true) {
      return true;
    }
    if (isObjectIdLike(membership?.role)) {
      const roleNameMap = await resolveMemberRoleNames([membership.role]);
      if (resolveMemberRoleName(membership.role, roleNameMap).toLowerCase() === "founder") {
        return true;
      }
    } else if (String(membership?.role || "").trim().toLowerCase() === "founder") {
      return true;
    }
    const granted = Array.isArray(membership?.grantedModules)
      ? membership.grantedModules
      : Array.isArray(membership?.enabledModules)
        ? membership.enabledModules
        : [];
    return granted.map((id) => String(id || "").trim()).includes(required);
  }

  const normalizedCompanyId = String(companyId || "").trim();
  if (!normalizedCompanyId) return false;

  const companyRegex = buildCompanyIdPrefixRegex(normalizedCompanyId);
  const workspaces = await Workspace.find({
    companyId: companyRegex ? { $regex: companyRegex } : normalizedCompanyId,
    isActive: true,
  })
    .select("_id")
    .lean();
  const workspaceIds = workspaces.map((workspace) => workspace?._id).filter(Boolean);
  if (!workspaceIds.length) return false;

  const memberships = await WorkspaceMember.find({
    user: actorUserId,
    workspace: { $in: workspaceIds },
    isActive: true,
  })
    .select("grantedModules enabledModules")
    .lean();

  return memberships.some((membership) => {
    const granted = Array.isArray(membership?.grantedModules)
      ? membership.grantedModules
      : Array.isArray(membership?.enabledModules)
        ? membership.enabledModules
        : [];
    return granted.map((id) => String(id || "").trim()).includes(required);
  });
};

const bulkInsertPoc = async (req, res, next) => {
  try {
    const { pocs } = req.body;

    if (!Array.isArray(pocs) || pocs.length === 0) {
      return res.status(400).json({
        message: "Please provide a valid array of POCs",
        receivedType: typeof pocs,
        receivedValue: pocs,
      });
    }

    // Fetch companies
    const companies = await HostCompany.find().lean();
    const companyMap = new Map(
      companies.map((item) => [item.companyId?.trim(), item._id]),
    );

    const missingCompanyRows = [];
    const finalPocs = [];

    for (const poc of pocs) {
      const companyId = poc.companyId?.trim();
      const companyMongoId = companyMap.get(companyId);

      if (!companyMongoId) {
        missingCompanyRows.push({
          name: poc.name?.trim(),
          email: poc.email?.trim(),
          companyId,
          reason: "No matching HostCompany found",
        });
        continue;
      }

      finalPocs.push({
        company: companyMongoId,
        companyId,
        name: poc.name?.trim() || "",
        designation: poc.designation || "",
        email: poc.email?.trim()?.toLowerCase() || "",
        phone: poc.phone || "",
        linkedInProfile: poc.linkedInProfile || "",
        languagesSpoken: poc.languagesSpoken || [],
        address: poc.address || "",
        profileImage: poc.profileImage || "",
        country: poc.country || "",
        state: poc.state || "",
        city: poc.city || "",
        verticalType: normalizeVerticalType(poc.verticalType),
        inviteStatus: "not_invited",
        isActive: true,
      });
    }

    // Insert EVERYTHING that reached this line
    let inserted = [];
    let failedDocs = [];

    try {
      inserted = await HostUser.insertMany(finalPocs, { ordered: false });

      const successfulKeys = new Set(
        inserted.map((i) => `${i.email}|${i.companyId}`),
      );

      failedDocs = finalPocs.filter(
        (doc) => !successfulKeys.has(`${doc.email}|${doc.companyId}`),
      );
    } catch (err) {
      console.error("Insert error:", err);
      return res.status(500).json({
        message: "Insertion failed for some records.",
        error: err.message,
      });
    }

    return res.status(201).json({
      message: `${inserted.length} POCs inserted successfully.`,
      totalIncoming: pocs.length,
      attemptedInsert: finalPocs.length,
      inserted: inserted.length,
      failedInsertCount: failedDocs.length,
      failedInsertLogs: failedDocs,
      missingCompanyCount: missingCompanyRows.length,
      missingCompanyRows,
    });
  } catch (error) {
    console.error("bulkInsertPoc error:", error);
    next(error);
  }
};

const getInviteStatuses = async (req, res, next) => {
  try {
    const emails = String(req.query.emails || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const query = emails.length
      ? {
          $or: emails.map((email) => ({
            email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
          })),
        }
      : {};

    const hostUsers = await HostUser.find(query)
      .select(
        "email inviteStatus inviteSentAt registeredAt joinedAt password refreshToken updatedAt",
      )
      .lean();

    const inviteStatusDocs = await HostInviteStatus.find(query)
      .select("email inviteStatus inviteSentAt registeredAt joinedAt updatedAt")
      .lean();

    const statusSource = new Map();

    for (const hostUser of hostUsers) {
      const derivedStatus = deriveInviteStatus(hostUser);
      const updates = {};

      if (derivedStatus !== normalizeInviteStatus(hostUser.inviteStatus)) {
        updates.inviteStatus = derivedStatus;
      }

      if (derivedStatus === "registered" && !hostUser.registeredAt) {
        updates.registeredAt = hostUser.updatedAt || new Date();
      }

      if (derivedStatus === "joined" && !hostUser.joinedAt) {
        updates.joinedAt = hostUser.updatedAt || new Date();
      }

      if (Object.keys(updates).length) {
        await HostUser.updateOne({ _id: hostUser._id }, { $set: updates });
        Object.assign(hostUser, updates);
      }

      const key = String(hostUser.email || "").trim().toLowerCase();
      statusSource.set(key, {
        inviteStatus: deriveInviteStatus(hostUser),
        inviteSentAt: hostUser.inviteSentAt,
        registeredAt: hostUser.registeredAt,
        joinedAt: hostUser.joinedAt,
      });
    }

    for (const doc of inviteStatusDocs) {
      const key = String(doc.email || "").trim().toLowerCase();
      const existing = statusSource.get(key);
      statusSource.set(key, mergeInviteRecords(existing, doc));
    }

    const statuses = {};
    for (const [email, data] of statusSource.entries()) {
      statuses[email] = {
        inviteStatus: deriveInviteStatus(data),
        inviteSentAt: data.inviteSentAt || null,
        registeredAt: data.registeredAt || null,
        joinedAt: data.joinedAt || null,
      };
    }

    return res.status(200).json({ data: statuses });
  } catch (error) {
    next(error);
  }
};

const sendInviteEmail = async (req, res, next) => {
  try {
    const {
      leadId,
      email,
      name,
      mobile,
      companyName,
      status,
      fullName,
      selectedPlan,
      country,
      state,
      city,
      verticalType,
      source,
      goals,
      comment,
      isUpgradeRequest,
    } = req.body;

    const normalizeMultiValue = (value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object") {
              return String(item.label || item.value || item.name || "").trim();
            }
            return "";
          })
          .filter(Boolean)
          .join(", ");
      }

      if (typeof value === "string") {
        return value.trim();
      }

      if (value && typeof value === "object") {
        return String(value.label || value.value || value.name || "").trim();
      }

      return "";
    };

    if (!email || !name) {
      return res
        .status(400)
        .json({ message: "Lead email and name are required" });
    }

    if ((status || "").toLowerCase() !== "closed") {
      return res.status(400).json({
        message: "Invite can only be sent when the lead status is closed",
      });
    }

    const companyId = leadId?.trim() || `lead-${randomUUID()}`;
    const normalizedVerticals = normalizeVerticalType(verticalType);
    const normalizedPlan = String(selectedPlan || goals || "basic")
      .trim()
      .toLowerCase();

    await HostLeadCompany.findOneAndUpdate(
      { companyId },
      {
        $set: {
          leadId: leadId?.trim() || undefined,
          companyId,
          companyName: companyName?.trim() || "Unknown Company",
          industry: normalizeMultiValue(verticalType),
          companyCountry: country?.trim() || "",
          companyState: state?.trim() || "",
          companyCity: city?.trim() || "",
          isRegistered: true,
          status: status?.trim()?.toLowerCase() || "closed",
          plan: normalizedPlan,
          comment: comment?.trim() || "",
          source: source?.trim() || "signup-lead",
          pocName: name?.trim() || "",
          pocEmail: email?.trim()?.toLowerCase() || "",
          pocPhone: mobile?.trim() || "",
          invitedAt: new Date(),
          ...(isUpgradeRequest
            ? {
                upgradeInviteSentAt: new Date(),
                upgradeStatus: "payment_link_sent",
              }
            : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const invitePayload = {
      fullName: fullName || name,
      name: fullName || name,
      email,
      selectedPlan: normalizedPlan,
      goals: normalizedPlan,
      companyName: companyName || "",
      businessName: companyName || "",
      country: country || "",
      state: state || "",
      city: city || "",
      verticalType: normalizedVerticals,
      businessType: normalizedVerticals,
    };

    const inviteToken = jwt.sign(
      invitePayload,
      process.env.HOST_INVITE_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.HOST_INVITE_TOKEN_EXPIRY || "7d" },
    );

    const hostPanelBaseUrl = resolveHostPanelFrontendUrl();
    const inviteLink = `${hostPanelBaseUrl}/register/${inviteToken}`;
    const signupMail = buildSignupInviteEmail({
      name,
      companyName,
      inviteLink,
    });
    await sendMail({ to: email, ...signupMail });

    const normalizedEmail = String(email).trim().toLowerCase();
    const hostUser = await HostUser.findOne({
      email: { $regex: `^${escapeRegex(normalizedEmail)}$`, $options: "i" },
    });

    if (hostUser) {
      const currentStatus = await syncInviteLifecycle(hostUser);

      hostUser.country = country || hostUser.country || "";
      hostUser.state = state || hostUser.state || "";
      hostUser.city = city || hostUser.city || "";
      hostUser.verticalType = normalizedVerticals.length
        ? normalizedVerticals
        : hostUser.verticalType || [];

      if (!["registered", "joined"].includes(currentStatus)) {
        hostUser.inviteStatus = "invite_sent";
        hostUser.inviteSentAt = new Date();
      }

      await hostUser.save();
    }

    const inviteStatusDoc = await HostInviteStatus.findOne({
      email: normalizedEmail,
    }).lean();
    const docStatus = normalizeInviteStatus(inviteStatusDoc?.inviteStatus);
    const shouldKeepHigherStatus =
      docStatus === "registered" || docStatus === "joined";

    await HostInviteStatus.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          inviteStatus: shouldKeepHigherStatus ? docStatus : "invite_sent",
          inviteSentAt:
            inviteStatusDoc?.inviteSentAt || inviteStatusDoc?.joinedAt
              ? inviteStatusDoc?.inviteSentAt || new Date()
              : new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({ message: "Invite email sent successfully" });
  } catch (error) {
    next(error);
  }
};

const getCompanyMembers = async (req, res, next) => {
  try {
    const companyId = String(req.query.companyId || "").trim();
    const requestedCompanyName = String(req.query.companyName || "").trim();

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const companyIdRegex = buildCompanyIdPrefixRegex(companyId);
    const fallbackCompany =
      (await HostCompany.findOne({ companyId }).lean()) ||
      (await HostLeadCompany.findOne({ companyId }).lean());
    const scopedCompanyName =
      requestedCompanyName || String(fallbackCompany?.companyName || "").trim();
    const companyNameRegex = buildExactCaseInsensitiveRegex(scopedCompanyName);

    const [members, directWorkspaces, nameMatchedWorkspaces] = await Promise.all([
      HostUser.find({
        companyId: companyIdRegex
          ? { $regex: companyIdRegex }
          : companyId,
      })
        .select(
          "name email phone designation companyId isActive isDeleted deletedAt workspaceAccess createdAt updatedAt",
        )
        .lean(),
      Workspace.find({
        companyId: companyIdRegex
          ? { $regex: companyIdRegex }
          : companyId,
        isActive: true,
      })
        .select("_id workspaceName companyId modules enabledModuleIds selectedPlan")
        .lean(),
      companyNameRegex
        ? Workspace.find({
            businessName: { $regex: companyNameRegex },
            isActive: true,
          })
            .select("_id workspaceName companyId businessName modules enabledModuleIds selectedPlan")
            .lean()
        : Promise.resolve([]),
    ]);

    const memberIds = members
      .map((member) => member?._id)
      .filter(Boolean);

    const workspaceDocs = [
      ...directWorkspaces,
      ...nameMatchedWorkspaces.filter(
        (workspace) =>
          !directWorkspaces.some(
            (directWorkspace) =>
              String(directWorkspace?._id) === String(workspace?._id),
          ),
      ),
    ];

    const workspaceIds = workspaceDocs
      .map((workspace) => workspace?._id)
      .filter(Boolean);

    // Deliberately not filtering by isActive here — a deactivated/deleted
    // member should still surface in this list (with the Deleted/Inactive
    // status badge), not vanish from the table entirely. The {workspace,
    // user} unique index means this can't return duplicate rows per member.
    const memberships = workspaceIds.length
      ? await WorkspaceMember.find({
          workspace: { $in: workspaceIds },
        })
          .populate("user", "name email phone designation companyId isActive isDeleted deletedAt createdAt updatedAt")
          .lean()
      : [];

    const membershipWorkspaceIds = memberships
      .map((membership) => membership?.workspace)
      .filter(Boolean);

    const membershipWorkspaces = membershipWorkspaceIds.length
      ? await Workspace.find({
          _id: { $in: membershipWorkspaceIds },
          isActive: true,
        })
          .select("_id workspaceName companyId businessName modules enabledModuleIds selectedPlan")
          .lean()
      : [];

    const allWorkspaceDocs = [
      ...workspaceDocs,
      ...membershipWorkspaces.filter(
        (workspace) =>
          !workspaceDocs.some(
            (existingWorkspace) =>
              String(existingWorkspace?._id) === String(workspace?._id),
          ),
      ),
    ];

    const workspaceDocsWithDepartmentAccess = allWorkspaceDocs.map((workspace) => {
      const merged = mergeCanonicalModulesIntoWorkspace(workspace?.modules || []);
      return {
        ...workspace,
        modules: merged.modules,
        __departmentModulesChanged: merged.changed,
      };
    });

    const workspaceModuleUpdates = workspaceDocsWithDepartmentAccess
      .filter((workspace) => workspace?.__departmentModulesChanged && workspace?._id)
      .map((workspace) => ({
        updateOne: {
          filter: { _id: workspace._id },
          update: { $set: { modules: workspace.modules } },
        },
      }));

    if (workspaceModuleUpdates.length) {
      await Workspace.bulkWrite(workspaceModuleUpdates);
    }

    const workspaceMap = new Map();
    const memberMap = new Map();
    const hasRealWorkspaces = workspaceDocsWithDepartmentAccess.length > 0;

    const ensureMemberRecord = (member = {}) => {
      const key =
        String(member?._id || "").trim() ||
        String(member?.email || "").trim().toLowerCase();

      if (!key) return null;

      const existing = memberMap.get(key) || {};
      const merged = {
        ...existing,
        ...member,
        _id: member?._id || existing?._id,
        designation: member?.designation || existing?.designation || "",
        isActive:
          typeof member?.isActive === "boolean"
            ? member.isActive
            : typeof existing?.isActive === "boolean"
              ? existing.isActive
              : true,
        isDeleted:
          typeof member?.isDeleted === "boolean"
            ? member.isDeleted
            : typeof existing?.isDeleted === "boolean"
              ? existing.isDeleted
              : false,
        deletedAt: member?.deletedAt ?? existing?.deletedAt ?? null,
        workspaceAccess: normalizeMemberWorkspaceAccess(
          {
            ...existing,
            ...member,
            workspaceAccess: [
              ...(Array.isArray(existing?.workspaceAccess)
                ? existing.workspaceAccess
                : []),
              ...(Array.isArray(member?.workspaceAccess)
                ? member.workspaceAccess
                : []),
            ],
          },
          { allowFallback: !hasRealWorkspaces },
        ),
      };

      memberMap.set(key, merged);
      return merged;
    };

    members.forEach((member) => {
      ensureMemberRecord(member);
    });

    workspaceDocsWithDepartmentAccess.forEach((workspace) => {
      const workspaceId = normalizeWorkspaceId(workspace?._id?.toString());
      const sanitizedEnabled = expandLinkedModuleIds(
        sanitizeEnabledModuleIds(
          Array.isArray(workspace?.enabledModuleIds) ? workspace.enabledModuleIds : [],
          workspace?.modules || [],
        ),
        workspace?.modules || [],
      );
      workspaceMap.set(workspaceId, {
        workspaceId,
        workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
        modules: workspace?.modules || [],
        enabledModuleIds: sanitizedEnabled,
        selectedPlan: String(workspace?.selectedPlan || "basic").trim().toLowerCase(),
      });
    });

    const membershipRoleNameMap = await resolveMemberRoleNames(
      memberships.map((membership) => membership?.role),
    );

    memberships.forEach((membership) => {
      const workspaceDoc = workspaceDocsWithDepartmentAccess.find(
        (workspace) => String(workspace._id) === String(membership?.workspace),
      );
      const workspaceId = normalizeWorkspaceId(
        workspaceDoc?._id?.toString() || membership?.workspace?.toString(),
      );
      const workspaceName = normalizeWorkspaceName(workspaceDoc?.workspaceName);
      const sanitizedEnabled = expandLinkedModuleIds(
        sanitizeEnabledModuleIds(
          Array.isArray(workspaceDoc?.enabledModuleIds) ? workspaceDoc.enabledModuleIds : [],
          workspaceDoc?.modules || [],
        ),
        workspaceDoc?.modules || [],
      );

      workspaceMap.set(workspaceId, {
        workspaceId,
        workspaceName,
        modules: workspaceDoc?.modules || [],
        enabledModuleIds: sanitizedEnabled,
        selectedPlan: String(workspaceDoc?.selectedPlan || "basic").trim().toLowerCase(),
      });

      const populatedUser = membership?.user || {};
      const member = ensureMemberRecord({
        ...populatedUser,
        designation:
          populatedUser?.designation ||
          resolveMemberRoleName(membership?.role, membershipRoleNameMap) ||
          "",
      });

      if (!member) return;

      const currentAccess = Array.isArray(member.workspaceAccess)
        ? member.workspaceAccess.filter(
            (item) => normalizeWorkspaceId(item?.workspaceId) !== workspaceId,
          )
        : [];

      const workspaceEnabledIds = expandLinkedModuleIds(
        sanitizeEnabledModuleIds(
          Array.isArray(workspaceDoc?.enabledModuleIds) ? workspaceDoc.enabledModuleIds : [],
          workspaceDoc?.modules || [],
        ),
        workspaceDoc?.modules || [],
      );
      const memberGrantedIds = Array.isArray(membership?.grantedModules)
        ? membership.grantedModules
        : [];
      const filteredMemberGrantedIds = memberGrantedIds
        .map((id) => String(id || "").trim())
        .filter((id) => id && workspaceEnabledIds.includes(id));
      // Founders (isPrimary) never get explicit per-member grants — their
      // real access is "everything this workspace has enabled" (HostPanel's
      // sidebar bypasses the grant check for them). Without this, their
      // normally-empty grantedModules would synthesize an empty "saved
      // access" entry below, which the frontend then shows instead of
      // falling back to the founder preset — i.e. every toggle looks off
      // even though the founder actually has full workspace access.
      const effectiveMemberGrantedIds =
        membership?.isPrimary === true ? workspaceEnabledIds : filteredMemberGrantedIds;
      const grantedModules = buildModuleAccessTreeStateFromIds({
        workspaceModules: workspaceDoc?.modules || [],
        enabledModuleIds: effectiveMemberGrantedIds,
      });

      member.workspaceAccess = normalizeMemberWorkspaceAccess({
        ...member,
        workspaceAccess: [
          ...currentAccess,
          {
            workspaceId,
            workspaceName,
            moduleAccess: grantedModules,
            grantedModules: effectiveMemberGrantedIds,
          },
        ],
      });
    });

    const normalizedMembers = Array.from(memberMap.values()).map((member) => {
      const normalizedWorkspaces = normalizeMemberWorkspaceAccess(member, {
        allowFallback: !hasRealWorkspaces,
      });

      normalizedWorkspaces.forEach((workspace) => {
        const workspaceKey = normalizeWorkspaceId(workspace.workspaceId);
        if (!workspaceMap.has(workspaceKey)) {
          workspaceMap.set(workspaceKey, {
            workspaceId: workspaceKey,
            workspaceName: normalizeWorkspaceName(workspace.workspaceName),
            modules: workspace?.modules || [],
            enabledModuleIds: Array.isArray(workspace?.enabledModuleIds)
              ? workspace.enabledModuleIds
              : [],
            selectedPlan: "basic",
          });
        }
      });

      const activeWorkspace = normalizedWorkspaces[0] || buildFallbackWorkspace();

      return {
        ...member,
        workspaceAccess: normalizedWorkspaces,
        activeWorkspaceId: activeWorkspace.workspaceId,
        activeWorkspaceName: activeWorkspace.workspaceName,
        moduleAccess: activeWorkspace.moduleAccess || {},
      };
    });

    if (!workspaceMap.size) {
      workspaceMap.set(DEFAULT_WORKSPACE_ID, buildFallbackWorkspace());
    }

    return res.status(200).json({
      data: {
        company: fallbackCompany || null,
        members: normalizedMembers,
        workspaces: Array.from(workspaceMap.values()),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateWorkspaceAccountStatus = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { isDeleted } = req.body || {};

    if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "A valid workspaceId is required" });
    }

    if (typeof isDeleted !== "boolean") {
      return res.status(400).json({ message: "isDeleted must be true or false" });
    }

    // Scoped strictly to this one real workspace _id — deliberately not
    // re-deriving "company" via the companyId prefix-regex used elsewhere
    // in this file. That prefix is shared across multiple unrelated
    // dev/test workspaces here (they all descend from one reused base id
    // with different "-dev-xxxxx" suffixes), so a company-wide bulk WRITE
    // via regex could silently touch other companies' accounts. Matching
    // on the exact workspace _id keeps the blast radius to exactly the
    // members shown in this page's Employee List.
    const memberships = await WorkspaceMember.find({ workspace: workspaceId })
      .select("user")
      .lean();
    const memberIds = memberships.map((membership) => membership.user).filter(Boolean);

    if (!memberIds.length) {
      return res.status(404).json({ message: "No employees found for this workspace" });
    }

    const now = new Date();
    const userUpdate = isDeleted
      ? { isDeleted: true, deletedAt: now, refreshToken: "" }
      : { isDeleted: false, deletedAt: null };

    await HostUser.updateMany({ _id: { $in: memberIds } }, userUpdate);
    await WorkspaceMember.updateMany({ workspace: workspaceId }, { isActive: !isDeleted });

    return res.status(200).json({
      message: isDeleted
        ? `Deleted ${memberIds.length} host user account(s) for this workspace.`
        : `Reactivated ${memberIds.length} host user account(s) for this workspace.`,
      data: { affectedCount: memberIds.length },
    });
  } catch (error) {
    next(error);
  }
};

const updateHostUserAccountStatus = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { isDeleted } = req.body || {};

    if (!memberId) {
      return res.status(400).json({ message: "memberId is required" });
    }

    if (typeof isDeleted !== "boolean") {
      return res.status(400).json({ message: "isDeleted must be true or false" });
    }

    const member = await HostUser.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: "Host user not found" });
    }

    member.isDeleted = isDeleted;
    member.deletedAt = isDeleted ? new Date() : null;

    if (isDeleted) {
      member.refreshToken = "";
    }

    await member.save();

    return res.status(200).json({
      message: isDeleted ? "Host user account deleted." : "Host user account reactivated.",
      data: {
        _id: member._id,
        isDeleted: member.isDeleted,
        deletedAt: member.deletedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateMemberWorkspaceAccess = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { workspaceId, workspaceName, moduleAccess, accessModules, accessSource } = req.body || {};
    const requestedAccessModules = Array.isArray(accessModules)
      ? accessModules.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const organizationActionKey =
      requestedAccessModules.find((key) =>
        ORGANIZATION_PERMISSION_MAP.actions.includes(key),
      ) || "org_users_toggle_access";

    if (!memberId) {
      return res.status(400).json({ message: "memberId is required" });
    }

    if (!workspaceName || typeof moduleAccess !== "object") {
      return res.status(400).json({
        message: "workspaceName and moduleAccess are required",
      });
    }

    const member = await HostUser.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: "Host user not found" });
    }

    const nextWorkspaceId = normalizeWorkspaceId(workspaceId);
    const requestedTreeState =
      moduleAccess && typeof moduleAccess === "object" ? moduleAccess : {};
    let workspaceDocRaw = await Workspace.findById(nextWorkspaceId)
      .select("_id workspaceName companyId modules enabledModuleIds")
      .lean();

    if (!workspaceDocRaw?._id) {
      const memberCompanyId = String(member?.companyId || "").trim();
      const companyRegex = buildCompanyIdPrefixRegex(memberCompanyId);
      const workspaceNameRegex = buildExactCaseInsensitiveRegex(workspaceName);

      if (workspaceNameRegex) {
        workspaceDocRaw = await Workspace.findOne({
          isActive: true,
          ...(memberCompanyId
            ? { companyId: companyRegex ? { $regex: companyRegex } : memberCompanyId }
            : {}),
          workspaceName: { $regex: workspaceNameRegex },
        })
          .select("_id workspaceName companyId modules enabledModuleIds")
          .lean();
      }

      if (!workspaceDocRaw?._id && memberCompanyId) {
        workspaceDocRaw = await Workspace.findOne({
          isActive: true,
          companyId: companyRegex ? { $regex: companyRegex } : memberCompanyId,
        })
          .sort({ createdAt: 1 })
          .select("_id workspaceName companyId modules enabledModuleIds")
          .lean();
      }
    }

    const effectiveWorkspaceId = normalizeWorkspaceId(
      workspaceDocRaw?._id?.toString() || nextWorkspaceId,
    );
    const nextWorkspaceName = normalizeWorkspaceName(
      workspaceDocRaw?.workspaceName || workspaceName,
    );
      const previousWorkspaceAccess = normalizeMemberWorkspaceAccess(member, {
        allowFallback: true,
      }).find((entry) => {
      const entryWorkspaceId = normalizeWorkspaceId(entry?.workspaceId);
      const entryWorkspaceName = normalizeWorkspaceName(entry?.workspaceName);
      return (
        entryWorkspaceId === effectiveWorkspaceId ||
        entryWorkspaceName === nextWorkspaceName
      );
      });
      let previousGrantedModules = Array.isArray(previousWorkspaceAccess?.grantedModules)
        ? previousWorkspaceAccess.grantedModules
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        : [];
      if (
        !previousGrantedModules.length &&
        previousWorkspaceAccess?.moduleAccess &&
        typeof previousWorkspaceAccess.moduleAccess === "object"
      ) {
        previousGrantedModules = Object.entries(previousWorkspaceAccess.moduleAccess)
          .filter(([, isEnabled]) => Boolean(isEnabled))
          .map(([moduleKey]) => String(moduleKey || "").trim())
          .filter(Boolean);
      }
    const hasWorkspaceDoc = Boolean(workspaceDocRaw?._id);
    const ensuredCanonical = mergeCanonicalModulesIntoWorkspace(workspaceDocRaw?.modules || []);
    const workspaceDoc = {
      ...workspaceDocRaw,
      modules: ensuredCanonical.modules,
    };
    const workspaceEnabledIds = hasWorkspaceDoc
      ? expandLinkedModuleIds(
          sanitizeEnabledModuleIds(
            Array.isArray(workspaceDoc?.enabledModuleIds)
              ? workspaceDoc.enabledModuleIds
              : [],
            workspaceDoc?.modules || [],
          ),
          workspaceDoc?.modules || [],
        )
      : [];
    const clampedModuleAccess = hasWorkspaceDoc
      ? clampModuleAccessStateToWorkspace({
          moduleAccess: requestedTreeState,
          workspaceModules: workspaceDoc?.modules || [],
          workspaceEnabledIds: workspaceEnabledIds,
        })
      : requestedTreeState;
    const derivedGrantedModules = hasWorkspaceDoc
      ? resolveGrantedModuleIdsFromTreeState({
          moduleAccess: clampedModuleAccess,
          workspaceModules: workspaceDoc?.modules || [],
          workspaceEnabledIds: workspaceEnabledIds,
        })
      : flattenGrantedModulesFromTreeState(clampedModuleAccess);
    const hasVisitorModuleEnabled =
      !hasWorkspaceDoc ||
      workspaceEnabledIds.includes(VISITOR_PERMISSION_MAP.module) ||
      workspaceEnabledIds.includes("visitors-management") ||
      VISITOR_PERMISSION_MAP.tabs.some((key) => workspaceEnabledIds.includes(key)) ||
      VISITOR_PERMISSION_MAP.actions.some((key) => workspaceEnabledIds.includes(key));
    const hasOrganizationModuleEnabled =
      !hasWorkspaceDoc ||
      workspaceEnabledIds.includes(ORGANIZATION_PERMISSION_MAP.module) ||
      ORGANIZATION_PERMISSION_MAP.tabs.some((key) => workspaceEnabledIds.includes(key)) ||
      ORGANIZATION_PERMISSION_MAP.actions.some((key) => workspaceEnabledIds.includes(key));

    const explicitAccessModules = requestedAccessModules.length
      ? requestedAccessModules
      : null;
    const grantedModulesRaw =
      explicitAccessModules && explicitAccessModules.length
        ? Array.from(
            new Set(
              explicitAccessModules
                .filter((key) => {
                  if (!VISITOR_ACCESS_KEYS.has(key)) return true;
                  if (!hasVisitorModuleEnabled) return false;
                  return true;
                })
                .filter((key) => {
                  if (!ORGANIZATION_ACCESS_KEYS.has(key)) return true;
                  if (!hasOrganizationModuleEnabled) return false;
                  return true;
                }),
            ),
          )
        : derivedGrantedModules;
    const workspaceEnabledSet = new Set(
      (Array.isArray(workspaceEnabledIds) ? workspaceEnabledIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    );
    const grantedModules = hasWorkspaceDoc
      ? grantedModulesRaw.filter((key) => workspaceEnabledSet.has(String(key || "").trim()))
      : grantedModulesRaw;
    const currentAccess = Array.isArray(member.workspaceAccess)
      ? member.workspaceAccess.filter(
          (item) => normalizeWorkspaceId(item?.workspaceId) !== effectiveWorkspaceId,
        )
      : [];

    currentAccess.push({
      workspaceId: effectiveWorkspaceId,
      workspaceName: nextWorkspaceName,
      moduleAccess: clampedModuleAccess,
      grantedModules: grantedModules,
      accessSource:
        String(accessSource || "").trim() === "plan_role_preset"
          ? "plan_role_preset"
          : "custom_workspace_grant",
    });

    member.workspaceAccess = currentAccess;
    await member.save();

      const filteredGrantedModules = grantedModules;

      if (workspaceDoc?._id) {
        const existingWorkspaceMember = await WorkspaceMember.findOne({
          user: member._id,
          workspace: workspaceDoc._id,
        })
          .select("grantedModules")
          .lean();
        if (Array.isArray(existingWorkspaceMember?.grantedModules)) {
          previousGrantedModules = existingWorkspaceMember.grantedModules
            .map((id) => String(id || "").trim())
            .filter(Boolean);
        }

        await WorkspaceMember.findOneAndUpdate(
          {
            user: member._id,
          workspace: workspaceDoc._id,
        },
        {
          $set: {
            grantedModules: filteredGrantedModules,
            enabledModules: workspaceEnabledIds,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }

    const actor = getActorFromRequest(req);
    const previousGrantedSet = new Set(previousGrantedModules);
    const nextGrantedSet = new Set(filteredGrantedModules);
    const enabledModules = filteredGrantedModules.filter((id) => !previousGrantedSet.has(id));
    const disabledModules = previousGrantedModules.filter((id) => !nextGrantedSet.has(id));
    await createModuleAccessLog({
      ...actor,
      sourcePanel: resolveSourcePanel(req, "host_panel"),
      action: "host_member_workspace_access_updated",
      targetType: "user",
      targetId: String(member._id || ""),
      targetName: String(member?.name || member?.email || "").trim(),
      companyId: String(member?.companyId || workspaceDoc?.companyId || ""),
      workspaceId: String(effectiveWorkspaceId || ""),
      workspaceName: String(nextWorkspaceName || ""),
      enabledModules,
      disabledModules,
      enabledCount: enabledModules.length,
      disabledCount: disabledModules.length,
      changes: {
        previousGrantedModules,
        grantedModules: filteredGrantedModules,
        enabledModules,
        disabledModules,
        enabledCount: enabledModules.length,
        disabledCount: disabledModules.length,
        accessSource:
          String(accessSource || "").trim() === "plan_role_preset"
            ? "plan_role_preset"
            : "custom_workspace_grant",
      },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      message: "Workspace access updated successfully",
      data: {
        member,
        workspaceId: effectiveWorkspaceId,
        workspaceName: nextWorkspaceName,
        grantedModules: filteredGrantedModules,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateWorkspaceEnabledModules = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { enabledModuleIds } = req.body || {};

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    const requestedEnabled = Array.isArray(enabledModuleIds) ? enabledModuleIds : [];

    const currentWorkspaceRaw = await Workspace.findById(workspaceId)
      .select("_id workspaceName companyId modules enabledModuleIds")
      .lean();
    if (!currentWorkspaceRaw?._id) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    const ensuredCanonical = mergeCanonicalModulesIntoWorkspace(currentWorkspaceRaw?.modules || []);
    const currentWorkspace = {
      ...currentWorkspaceRaw,
      modules: ensuredCanonical.modules,
    };

    const sanitizedRequested = sanitizeEnabledModuleIds(
      requestedEnabled,
      currentWorkspace?.modules || [],
    );
    const previousEnabled = expandLinkedModuleIds(
      sanitizeEnabledModuleIds(
        Array.isArray(currentWorkspaceRaw?.enabledModuleIds)
          ? currentWorkspaceRaw.enabledModuleIds
          : [],
        currentWorkspace?.modules || [],
      ),
      currentWorkspace?.modules || [],
    );
    const nextEnabled = expandLinkedModuleIds(
      sanitizedRequested,
      currentWorkspace?.modules || [],
    );

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      {
        $set: {
          modules: currentWorkspace.modules,
          enabledModuleIds: nextEnabled,
        },
        $unset: { enabledModules: 1 },
      },
      { new: true },
    ).lean();

    await upsertFounderWorkspaceMembership({
      workspaceId: workspace._id,
      founderUserId: workspace?.owner,
      enabledModuleIds: nextEnabled,
    });

    const workspaceEnabledSet = new Set(
      nextEnabled.map((id) => String(id || "").trim()).filter(Boolean),
    );

    const members = await WorkspaceMember.find({
      workspace: workspace._id,
      isActive: true,
    })
      .select("_id user grantedModules enabledModules")
      .lean();

    if (members.length) {
      const memberOps = members.map((membership) => {
        const current = Array.isArray(membership?.grantedModules)
          ? membership.grantedModules
          : [];
        const filtered = current
          .map((id) => String(id || "").trim())
          .filter((id) => id && workspaceEnabledSet.has(id));

        return {
          updateOne: {
            filter: { _id: membership._id },
            update: {
              $set: {
                grantedModules: filtered,
                enabledModules: nextEnabled,
              },
            },
          },
        };
      });

      if (memberOps.length) {
        await WorkspaceMember.bulkWrite(memberOps);
      }

      const users = await HostUser.find({
        _id: { $in: members.map((m) => m.user).filter(Boolean) },
      })
        .select("_id workspaceAccess")
        .lean();

      const userOps = users.map((userDoc) => {
        const access = Array.isArray(userDoc?.workspaceAccess) ? userDoc.workspaceAccess : [];
        const updatedAccess = access.map((entry) => {
          if (normalizeWorkspaceId(entry?.workspaceId) !== normalizeWorkspaceId(workspaceId)) {
            return entry;
          }
          return {
            ...entry,
            moduleAccess: clampModuleAccessStateToWorkspace({
              moduleAccess: entry?.moduleAccess || {},
              workspaceModules: workspace?.modules || [],
              workspaceEnabledIds: nextEnabled,
            }),
          };
        });
        return {
          updateOne: {
            filter: { _id: userDoc._id },
            update: { $set: { workspaceAccess: updatedAccess } },
          },
        };
      });

      if (userOps.length) {
        await HostUser.bulkWrite(userOps);
      }
    }

    const actor = getActorFromRequest(req);
    const previousSet = new Set(previousEnabled);
    const nextSet = new Set(nextEnabled);
    const enabledModules = nextEnabled.filter((id) => !previousSet.has(id));
    const disabledModules = previousEnabled.filter((id) => !nextSet.has(id));
    await createModuleAccessLog({
      ...actor,
      sourcePanel: resolveSourcePanel(req, "host_panel"),
      action: "host_workspace_enabled_modules_updated",
      targetType: "workspace",
      targetId: String(workspace?._id || workspaceId || ""),
      targetName: String(workspace?.workspaceName || "").trim(),
      companyId: String(workspace?.companyId || ""),
      workspaceId: String(workspace?._id || workspaceId || ""),
      workspaceName: String(workspace?.workspaceName || ""),
      enabledModules,
      disabledModules,
      enabledCount: enabledModules.length,
      disabledCount: disabledModules.length,
      changes: {
        previousEnabledModuleIds: previousEnabled,
        enabledModuleIds: Array.isArray(nextEnabled) ? nextEnabled : [],
        enabledModules,
        disabledModules,
        enabledCount: enabledModules.length,
        disabledCount: disabledModules.length,
      },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      message: "Workspace enabled modules updated successfully",
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
};

const syncWorkspaceDepartmentModules = async (req, res, next) => {
  try {
    const companyId = String(req.query?.companyId || req.body?.companyId || "").trim();
    const query = { isActive: true };
    if (companyId) {
      const regex = buildCompanyIdPrefixRegex(companyId);
      query.companyId = regex ? { $regex: regex } : companyId;
    }

    const workspaces = await Workspace.find(query)
      .select("_id owner modules enabledModuleIds")
      .lean();

    const moduleOps = [];
    const memberOps = [];

    for (const workspace of workspaces) {
      const merged = mergeCanonicalModulesIntoWorkspace(workspace?.modules || []);
      const modules = merged.modules;
      const changed = merged.changed;
      const rawWorkspaceEnabled = Array.isArray(workspace?.enabledModuleIds)
        ? workspace.enabledModuleIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const workspaceEnabled = expandLinkedModuleIds(
        sanitizeEnabledModuleIds(rawWorkspaceEnabled, modules),
        modules,
      );

      await upsertFounderWorkspaceMembership({
        workspaceId: workspace._id,
        founderUserId: workspace?.owner,
        enabledModuleIds: workspaceEnabled,
      });

      if (changed || workspaceEnabled.length !== rawWorkspaceEnabled.length) {
        moduleOps.push({
          updateOne: {
            filter: { _id: workspace._id },
            update: {
              $set: {
                modules,
                enabledModuleIds: workspaceEnabled,
              },
              $unset: { enabledModules: 1 },
            },
          },
        });
      }

      const memberships = await WorkspaceMember.find({
        workspace: workspace._id,
        isActive: true,
      })
        .select("_id grantedModules enabledModules")
        .lean();

      memberships.forEach((membership) => {
        const current = Array.isArray(membership?.grantedModules)
          ? membership.grantedModules
          : [];
        const filtered = current
          .map((id) => String(id || "").trim())
          .filter((id) => id && workspaceEnabled.includes(id));
        memberOps.push({
          updateOne: {
            filter: { _id: membership._id },
            update: { $set: { grantedModules: filtered, enabledModules: workspaceEnabled } },
          },
        });
      });
    }

    if (moduleOps.length) await Workspace.bulkWrite(moduleOps);
    if (memberOps.length) await WorkspaceMember.bulkWrite(memberOps);

    return res.status(200).json({
      message: "Workspace department modules synced successfully",
      data: {
        scannedWorkspaces: workspaces.length,
        updatedWorkspaces: moduleOps.length,
        updatedWorkspaceMembers: memberOps.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

const sendUpgradePaymentLinkEmail = async (req, res, next) => {
  try {
    const { email, name, companyName, selectedPlan, paymentLinkUrl } = req.body || {};

    if (!email || !name || !paymentLinkUrl) {
      return res.status(400).json({
        message: "email, name and paymentLinkUrl are required",
      });
    }

    const paymentMail = buildUpgradePaymentEmail({
      name,
      companyName,
      selectedPlan: String(selectedPlan || "requested").trim(),
      paymentLinkUrl: String(paymentLinkUrl).trim(),
    });

    await sendMail({
      to: email,
      ...paymentMail,
    });

    return res.status(200).json({
      message: "Upgrade payment email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

const sendUpgradeSuccessEmail = async (req, res, next) => {
  try {
    const { email, name, companyName, selectedPlan } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({
        message: "email and name are required",
      });
    }

    const loginUrl = `${resolveHostPanelFrontendUrl()}/login`;
    const successMail = buildUpgradeSuccessEmail({
      name,
      companyName,
      selectedPlan: String(selectedPlan || "requested").trim(),
      loginUrl,
    });

    await sendMail({
      to: email,
      ...successMail,
    });

    return res.status(200).json({
      message: "Upgrade success email sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

const sendBookingPaymentLinkEmail = async (req, res, next) => {
  try {
    const {
      customerName,
      customerEmail,
      companyName,
      productType,
      startDate,
      endDate,
      noOfPeople,
      amount,
      currency,
      description,
    } = req.body || {};

    const numericAmount = Number(amount);

    if (!customerName || !customerEmail) {
      return res.status(400).json({
        message: "customerName and customerEmail are required",
      });
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "amount is required and must be a positive number",
      });
    }

    const resolvedCurrency = String(currency || "inr").toLowerCase();

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: resolvedCurrency,
            unit_amount: Math.round(numericAmount * 100),
            product_data: {
              name: description || `${productType || "Booking"} payment — ${companyName || customerName}`,
            },
          },
          quantity: 1,
        },
      ],
    });

    await BookingPaymentLink.create({
      leadEmail: customerEmail,
      leadName: customerName,
      companyName,
      productType,
      description,
      amount: numericAmount,
      currency: resolvedCurrency,
      stripePaymentLinkId: paymentLink.id,
      stripePaymentLinkUrl: paymentLink.url,
    });

    const paymentEmail = buildBookingPaymentEmail({
      customerName,
      companyName,
      productType,
      startDate,
      endDate,
      noOfPeople,
      paymentLinkUrl: paymentLink.url,
      amount: numericAmount,
      currency: resolvedCurrency,
    });

    await sendMail({
      to: customerEmail,
      ...paymentEmail,
    });

    return res.status(200).json({
      message: "Payment link email sent successfully",
      paymentLinkUrl: paymentLink.url,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/host-user/booking-payment-links
// Returns the latest payment status per lead email, for the All Enquiry
// table's Payment Status column. "Paid" wins if any link for that email was
// ever paid, otherwise "Pending" if a link was sent but not yet paid.
const getBookingPaymentStatuses = async (req, res, next) => {
  try {
    const links = await BookingPaymentLink.find()
      .sort({ createdAt: -1 })
      .select("leadEmail status amount currency paidAt createdAt")
      .lean();

    const statusByEmail = {};
    for (const link of links) {
      const email = String(link.leadEmail || "").toLowerCase();
      if (!email) continue;
      const existing = statusByEmail[email];
      if (!existing || (link.status === "paid" && existing.status !== "paid")) {
        statusByEmail[email] = link;
      }
    }

    return res.status(200).json(statusByEmail);
  } catch (error) {
    next(error);
  }
};

// POST /api/host-user/stripe-webhook
// Stripe calls this directly whenever a payment link is paid. Must receive the
// raw (unparsed) request body — see the express.raw() wiring in server.js —
// so the signature below can be verified.
const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_link) {
      try {
        await BookingPaymentLink.findOneAndUpdate(
          { stripePaymentLinkId: session.payment_link },
          { status: "paid", paidAt: new Date(), stripeCheckoutSessionId: session.id },
        );
      } catch (error) {
        console.error("Failed to mark BookingPaymentLink as paid:", error);
      }
    }
  }

  res.json({ received: true });
};

module.exports = {
  bulkInsertPoc,
  getInviteStatuses,
  getCompanyMembers,
  sendInviteEmail,
  updateHostUserAccountStatus,
  updateWorkspaceAccountStatus,
  updateMemberWorkspaceAccess,
  updateWorkspaceEnabledModules,
  syncWorkspaceDepartmentModules,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
  sendBookingPaymentLinkEmail,
  getBookingPaymentStatuses,
  handleStripeWebhook,
  resolveHostPanelFrontendUrl,
};
