import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Modal,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import GroupsIcon from "@mui/icons-material/Groups";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CircularProgress from "@mui/material/CircularProgress";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";

const MODULE_SECTIONS = [
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
              { name: "Pages", children: [] },
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
          {
            name: "Nomad Listing",
            children: [
              { name: "List View", children: [] },
              { name: "Map View", children: [] },
              { name: "Details Page", children: [] },
            ],
          },
          {
            name: "Review",
            children: [
              { name: "Review List", children: [] },
              { name: "Moderation", children: [] },
            ],
          },
        ],
      },
      { name: "Website Leads", children: [] },
      {
        name: "Organization Management",
        children: [
          {
            name: "Users",
            children: [
              { name: "Invite Member", children: [] },
              { name: "Change Role", children: [] },
              { name: "Toggle Access", children: [] },
            ],
          },
          {
            name: "Departments",
            children: [
              { name: "Create Department", children: [] },
              { name: "Edit Department", children: [] },
              { name: "Assign Manager", children: [] },
              { name: "Assign Acting Manager", children: [] },
              { name: "Remove Acting Manager", children: [] },
            ],
          },
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
      { name: "Customer Support", children: [] },
    ],
  },
  {
    name: "KEY APPS",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    children: [
      {
        name: "Tickets",
        children: [
          { name: "Raise Ticket", children: [] },
          { name: "Manage Tickets", children: [] },
          { name: "Team Members", children: [] },
          { name: "Ticket Reports", children: [] },
          { name: "Department Wise Tickets", children: [] },
          { name: "Ticket Settings", children: [] },
        ],
      },
      {
        name: "Leave Requests",
        children: [
          { name: "Apply Leave", children: [] },
          { name: "Approve Leave", children: [] },
          { name: "Leave Policies", children: [] },
        ],
      },
      {
        name: "Meeting Room System",
        children: [
          { name: "Book Meetings", children: [] },
          {
            name: "Manage Meetings",
            children: [
              { name: "Internal Meetings", children: [] },
              { name: "External Clients", children: [] },
            ],
          },
          { name: "Meeting Settings", children: [] },
          { name: "Meeting Calendar", children: [] },
          { name: "Meeting Reports", children: [] },
          { name: "Meeting Reviews", children: [] },
        ],
      },
      { name: "Calendar", children: [] },
      {
        name: "Visitor Management",
        children: [
          { name: "Daily Visitors", children: [] },
          { name: "Bookings", children: [] },
          { name: "Clients", children: [] },
          { name: "Visitor History", children: [] },
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
      { name: "Attendance", children: [] },
      {
        name: "Assets",
        children: [
          {
            name: "View Assets",
            children: [
              { name: "Assets Categories", children: [] },
              { name: "Assets Sub Categories", children: [] },
              { name: "List Of Assets", children: [] },
            ],
          },
          {
            name: "Manage Assets",
            children: [
              { name: "Assign Assets", children: [] },
              { name: "Assigned Assets", children: [] },
              { name: "Approvals", children: [] },
            ],
          },
          { name: "Asset Reports", children: [] },
          { name: "Assets Settings", children: [{ name: "Bulk Upload", children: [] }] },
        ],
      },
      { name: "Inventory", children: [] },
      {
        name: "Finance Management",
        children: [
          { name: "Budget", children: [] },
          { name: "Collections", children: [] },
          { name: "Payments", children: [] },
        ],
      },
      { name: "Chat Bot", children: [] },
      { name: "Reports", children: [] },
      {
        name: "Tasks",
        children: [
          {
            name: "Department Tasks",
            children: [
              { name: "Department Tasks List", children: [] },
              { name: "Department Task Details", children: [] },
            ],
          },
          { name: "Project List", children: [] },
          { name: "My Tasks", children: [{ name: "Daily Tasks", children: [] }] },
          { name: "Task Team Members", children: [] },
          {
            name: "Task Reports",
            children: [
              { name: "My Task Reports", children: [] },
              { name: "Assigned Task Reports", children: [] },
              { name: "Department Task Reports", children: [] },
            ],
          },
          { name: "Task Calendar", children: [] },
        ],
      },
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
          { name: "Leave Requests", children: [] },
          { name: "Attendance", children: [] },
        ],
      },
      {
        name: "Administration Department",
        children: [
          { name: "Tenant Companies", children: [] },
          { name: "Bookings", children: [] },
          { name: "Workspace Layout", children: [] },
        ],
      },
      {
        name: "Sales Department",
        children: [
          { name: "Leads Management", children: [] },
          { name: "Plans & Pricing", children: [] },
        ],
      },
      {
        name: "Finance Department",
        children: [
          { name: "Finance & Budget", children: [] },
          { name: "Billing & Payments", children: [] },
          { name: "Accounting", children: [] },
        ],
      },
      {
        name: "Maintenance Department",
        children: [
          { name: "Maintenance Repair Logs", children: [] },
          { name: "AMC Scheduler", children: [] },
        ],
      },
      {
        name: "Tech Department",
        children: [{ name: "Website Builder", children: [] }],
      },
      {
        name: "IT Department",
        children: [{ name: "IT Repair Logs", children: [] }],
      },
    ],
  },
];

const DEFAULT_WORKSPACE_ID = "default-workspace";
const DEFAULT_WORKSPACE_NAME = "Main Workspace";
const CANONICAL_VISITOR_NODE = {
  name: "Visitor Management",
  moduleId: "visitor-management",
  children: [
    { name: "Daily Visitors", moduleId: "add_visitor", children: [] },
    { name: "Visitor History", moduleId: "visitors_tab_history", children: [] },
    { name: "Bookings", moduleId: "visitors_tab_bookings", children: [] },
    { name: "Clients", moduleId: "add_client", children: [] },
    {
      name: "New Frontdesk Action",
      moduleId: "visitors_frontdesk_action",
      children: [
        {
          name: "Standard Visitor",
          moduleId: "visitors_mode_standard",
          children: [
            {
              name: "Standard Visitor Tab",
              moduleId: "visitors_standard_type_standard",
              children: [],
            },
            {
              name: "Department Visitor Tab",
              moduleId: "visitors_standard_type_department",
              children: [],
            },
            {
              name: "Tenant Company Visitor Tab",
              moduleId: "visitors_standard_type_tenant",
              children: [],
            },
          ],
        },
        {
          name: "Workspace Tour",
          moduleId: "visitors_mode_workspace_tour",
          children: [],
        },
        {
          name: "Walk-In Booking",
          moduleId: "visitors_mode_walkin_booking",
          children: [],
        },
        {
          name: "Verify Booking ID",
          moduleId: "visitors_mode_verify_booking",
          children: [],
        },
      ],
    },
  ],
};
const CANONICAL_ORGANIZATION_NODE = {
  name: "Organization Management",
  moduleId: "organization-management",
  children: [
    {
      name: "Users",
      moduleId: "org_tab_users",
      children: [
        { name: "Invite Member", moduleId: "org_users_invite_member", children: [] },
        { name: "Change Role", moduleId: "org_users_change_role", children: [] },
        { name: "Toggle Access", moduleId: "org_users_toggle_access", children: [] },
      ],
    },
    {
      name: "Departments",
      moduleId: "org_tab_departments",
      children: [
        { name: "Create Department", moduleId: "org_departments_create", children: [] },
        { name: "Edit Department", moduleId: "org_departments_edit", children: [] },
        { name: "Assign Manager", moduleId: "org_departments_assign_manager", children: [] },
        {
          name: "Assign Acting Manager",
          moduleId: "org_departments_assign_acting_manager",
          children: [],
        },
        {
          name: "Remove Acting Manager",
          moduleId: "org_departments_remove_acting_manager",
          children: [],
        },
      ],
    },
  ],
};
const VISITOR_PATH_KEY_MAP = {
  "KEY APPS::Visitor Management": "visitor-management",
  "DEPARTMENT ACCESSES::Administration Department::Visitor Management":
    "administration-visitor-management",
  "KEY APPS::Visitor Management::Daily Visitors": "visitors_tab_daily",
  "KEY APPS::Visitor Management::Visitor History": "visitors_tab_history",
  "KEY APPS::Visitor Management::Bookings": "visitors_tab_bookings",
  "KEY APPS::Visitor Management::Clients": "visitors_tab_clients",
  "KEY APPS::Visitor Management::Add Visitor": "add_visitor",
  "KEY APPS::Visitor Management::Add Client": "add_client",
  "KEY APPS::Visitor Management::New Frontdesk Action::Standard Visitor":
    "visitors_mode_standard",
  "KEY APPS::Visitor Management::New Frontdesk Action::Workspace Tour":
    "visitors_mode_workspace_tour",
  "KEY APPS::Visitor Management::New Frontdesk Action::Walk-In Booking":
    "visitors_mode_walkin_booking",
  "KEY APPS::Visitor Management::New Frontdesk Action::Verify Booking ID":
    "visitors_mode_verify_booking",
  "KEY APPS::Visitor Management::New Frontdesk Action::Standard Visitor Tabs::Standard Visitor Tab":
    "visitors_standard_type_standard",
  "KEY APPS::Visitor Management::New Frontdesk Action::Standard Visitor Tabs::Department Visitor Tab":
    "visitors_standard_type_department",
  "KEY APPS::Visitor Management::New Frontdesk Action::Standard Visitor Tabs::Tenant Company Visitor Tab":
    "visitors_standard_type_tenant",
};

const ORGANIZATION_PATH_KEY_MAP = {
  "COMPANY SETTINGS::Organization Management": "organization-management",
  "FOUNDER CORE MODULE::Organization Management": "organization-management",
  "COMPANY SETTINGS::Organization Management::Users": "org_tab_users",
  "FOUNDER CORE MODULE::Organization Management::Users": "org_tab_users",
  "COMPANY SETTINGS::Organization Management::Users::Invite Member":
    "org_users_invite_member",
  "FOUNDER CORE MODULE::Organization Management::Users::Invite Member":
    "org_users_invite_member",
  "COMPANY SETTINGS::Organization Management::Users::Change Role":
    "org_users_change_role",
  "FOUNDER CORE MODULE::Organization Management::Users::Change Role":
    "org_users_change_role",
  "COMPANY SETTINGS::Organization Management::Users::Toggle Access":
    "org_users_toggle_access",
  "FOUNDER CORE MODULE::Organization Management::Users::Toggle Access":
    "org_users_toggle_access",
  "COMPANY SETTINGS::Organization Management::Departments": "org_tab_departments",
  "FOUNDER CORE MODULE::Organization Management::Departments": "org_tab_departments",
  "COMPANY SETTINGS::Organization Management::Departments::Create Department":
    "org_departments_create",
  "FOUNDER CORE MODULE::Organization Management::Departments::Create Department":
    "org_departments_create",
  "COMPANY SETTINGS::Organization Management::Departments::Edit Department":
    "org_departments_edit",
  "FOUNDER CORE MODULE::Organization Management::Departments::Edit Department":
    "org_departments_edit",
  "COMPANY SETTINGS::Organization Management::Departments::Assign Manager":
    "org_departments_assign_manager",
  "FOUNDER CORE MODULE::Organization Management::Departments::Assign Manager":
    "org_departments_assign_manager",
  "COMPANY SETTINGS::Organization Management::Departments::Assign Acting Manager":
    "org_departments_assign_acting_manager",
  "FOUNDER CORE MODULE::Organization Management::Departments::Assign Acting Manager":
    "org_departments_assign_acting_manager",
  "COMPANY SETTINGS::Organization Management::Departments::Remove Acting Manager":
    "org_departments_remove_acting_manager",
  "FOUNDER CORE MODULE::Organization Management::Departments::Remove Acting Manager":
    "org_departments_remove_acting_manager",
};

const buildPathKey = (pathParts) => pathParts.join("::");
const toSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.values(value);
};

const parseWorkspaceModules = (rawModules) => {
  if (Array.isArray(rawModules)) return rawModules;
  if (rawModules && typeof rawModules === "object") return rawModules;
  if (typeof rawModules !== "string") return [];
  try {
    const parsed = JSON.parse(rawModules);
    return parsed || [];
  } catch {
    return [];
  }
};

const ensureVisitorModuleInTree = (rawModules = []) => {
  const source = Array.isArray(rawModules)
    ? JSON.parse(JSON.stringify(rawModules))
    : rawModules && typeof rawModules === "object"
      ? JSON.parse(JSON.stringify(Object.values(rawModules)))
      : [];

  const keyApps = source.find(
    (section) => String(section?.category || section?.name || "").trim().toLowerCase() === "key apps",
  );
  if (!keyApps) return source;

  const keyItems = Array.isArray(keyApps?.items)
    ? keyApps.items
    : Array.isArray(keyApps?.children)
      ? keyApps.children
      : Array.isArray(keyApps?.modules)
        ? keyApps.modules
        : [];

  const visitorIndex = keyItems.findIndex(
    (item) => String(item?.name || item?.moduleName || "").trim().toLowerCase() === "visitor management",
  );
  if (visitorIndex >= 0) {
    const existing = keyItems[visitorIndex];
    const existingChildren = Array.isArray(existing?.children)
      ? existing.children
      : Array.isArray(existing?.items)
        ? existing.items
        : Array.isArray(existing?.modules)
          ? existing.modules
          : Array.isArray(existing?.submodules)
            ? existing.submodules
            : [];
    if (!existingChildren.length) {
      const replacement = {
        ...CANONICAL_VISITOR_NODE,
        sectionName: existing?.sectionName,
      };
      if (Array.isArray(keyApps?.items)) {
        keyApps.items[visitorIndex] = replacement;
      } else if (Array.isArray(keyApps?.children)) {
        keyApps.children[visitorIndex] = replacement;
      } else if (Array.isArray(keyApps?.modules)) {
        keyApps.modules[visitorIndex] = replacement;
      }
    }
  } else {
    if (Array.isArray(keyApps?.items)) {
      keyApps.items = [...keyApps.items, CANONICAL_VISITOR_NODE];
    } else if (Array.isArray(keyApps?.children)) {
      keyApps.children = [...keyApps.children, CANONICAL_VISITOR_NODE];
    } else if (Array.isArray(keyApps?.modules)) {
      keyApps.modules = [...keyApps.modules, CANONICAL_VISITOR_NODE];
    } else {
      keyApps.items = [CANONICAL_VISITOR_NODE];
    }
  }

  const deptSection = source.find(
    (section) =>
      String(section?.category || section?.name || "").trim().toLowerCase() ===
      "department accesses",
  );
  if (deptSection) {
    const deptItems = Array.isArray(deptSection?.items)
      ? deptSection.items
      : Array.isArray(deptSection?.children)
        ? deptSection.children
        : Array.isArray(deptSection?.modules)
          ? deptSection.modules
          : [];
    const adminIndex = deptItems.findIndex(
      (item) =>
        String(item?.name || item?.moduleName || "").trim().toLowerCase() ===
        "administration department",
    );
    if (adminIndex >= 0) {
      const adminNode = deptItems[adminIndex];
      const adminChildren = Array.isArray(adminNode?.children) ? adminNode.children : [];
      const adminVisitorIndex = adminChildren.findIndex(
        (child) =>
          String(child?.name || "").trim().toLowerCase() === "visitor management",
      );
      if (adminVisitorIndex === -1) {
        adminNode.children = [
          ...adminChildren,
          {
            ...CANONICAL_VISITOR_NODE,
            moduleId: "administration-visitor-management",
            children: CANONICAL_VISITOR_NODE.children,
          },
        ];
      } else {
        const adminVisitor = adminChildren[adminVisitorIndex];
        if (!Array.isArray(adminVisitor?.children) || !adminVisitor.children.length) {
          adminChildren[adminVisitorIndex] = {
            ...adminVisitor,
            moduleId: "administration-visitor-management",
            children: CANONICAL_VISITOR_NODE.children,
          };
          adminNode.children = adminChildren;
        }
      }
      if (Array.isArray(deptSection?.items)) deptSection.items[adminIndex] = adminNode;
      if (Array.isArray(deptSection?.children)) deptSection.children[adminIndex] = adminNode;
      if (Array.isArray(deptSection?.modules)) deptSection.modules[adminIndex] = adminNode;
    }
  }

  const getChildRef = (node = {}) => {
    if (Array.isArray(node?.items)) return "items";
    if (Array.isArray(node?.children)) return "children";
    if (Array.isArray(node?.modules)) return "modules";
    if (Array.isArray(node?.submodules)) return "submodules";
    return "children";
  };
  const getChildren = (node = {}) => {
    const ref = getChildRef(node);
    return Array.isArray(node?.[ref]) ? node[ref] : [];
  };

  let founderCoreNode = null;
  let organizationNode = null;
  const visit = (nodes = []) => {
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      const nodeName = String(node?.name || node?.moduleName || "").trim().toLowerCase();
      if (nodeName === "founder core module") founderCoreNode = node;
      if (nodeName === "organization management") organizationNode = node;
      visit(getChildren(node));
    });
  };
  source.forEach((section) => visit(getChildren(section)));

  if (organizationNode) {
    const orgRef = getChildRef(organizationNode);
    organizationNode.name = CANONICAL_ORGANIZATION_NODE.name;
    organizationNode.moduleId = CANONICAL_ORGANIZATION_NODE.moduleId;
    organizationNode[orgRef] = CANONICAL_ORGANIZATION_NODE.children;
  } else if (founderCoreNode) {
    const founderRef = getChildRef(founderCoreNode);
    const founderChildren = getChildren(founderCoreNode);
    founderCoreNode[founderRef] = [...founderChildren, CANONICAL_ORGANIZATION_NODE];
  }

  return source;
};

const normalizeModulesTree = (nodes = [], parentPath = []) => {
  const nodeList = toArray(nodes);
  return nodeList
    .map((node, index) => {
      const rawCategoryName = String(
        node?.category || node?.departmentName || node?.groupName || "",
      ).trim();
      const categoryName =
        rawCategoryName.toLowerCase() === "company settings"
          ? "FOUNDER CORE MODULE"
          : rawCategoryName;
      if (categoryName) {
        const categoryChildren = normalizeModulesTree(
          node?.items || node?.children || node?.modules || node?.submodules || [],
          [...parentPath, categoryName],
        );
        return {
          name: categoryName,
          moduleId: String(node?.id || node?.moduleId || "").trim() ||
            `idx::${[...parentPath, categoryName].map(toSlug).filter(Boolean).join("::") || `node-${index}`}`,
          accent: node?.accent,
          children: categoryChildren,
        };
      }

      const name = String(
        node?.name ||
        node?.title ||
        node?.dropdownTitle ||
        node?.label ||
        node?.moduleName ||
        node?.submoduleName ||
        "",
      ).trim();
      if (!name) return null;

      const nested =
        node?.children ||
        node?.items ||
        node?.modules ||
        node?.submodules ||
        node?.tabs ||
        [];

      const currentPath = [...parentPath, name];
      const children = normalizeModulesTree(nested, currentPath);
      return {
        name,
        moduleId:
          String(node?.id || node?.moduleId || "").trim() ||
          `idx::${currentPath.map(toSlug).filter(Boolean).join("::") || `node-${index}`}`,
        accent: node?.accent,
        children,
      };
    })
    .filter(Boolean);
};

const reshapeVisitorHierarchy = (nodes = []) =>
  (Array.isArray(nodes) ? nodes : []).map((node) => {
    const nextNode = {
      ...node,
      children: reshapeVisitorHierarchy(node?.children || []),
    };

    if (
      String(nextNode?.name || "").trim().toLowerCase() === "new frontdesk action" &&
      Array.isArray(nextNode.children)
    ) {
      const standardTabs = nextNode.children.find(
        (child) =>
          String(child?.name || "").trim().toLowerCase() === "standard visitor tabs",
      );
      const standardMode = nextNode.children.find(
        (child) =>
          String(child?.name || "").trim().toLowerCase() === "standard visitor",
      );

      if (standardTabs && standardMode) {
        const mergedStandard = {
          ...standardMode,
          children: standardTabs.children || [],
        };
        nextNode.children = nextNode.children
          .filter((child) => child !== standardTabs && child !== standardMode);
        nextNode.children.unshift(mergedStandard);
      }
    }

    return nextNode;
  });

const flattenSectionModules = (sections = []) =>
  (Array.isArray(sections) ? sections : []).flatMap((section) => {
    const sectionName = String(section?.name || "").trim();
    const modules = Array.isArray(section?.children) ? section.children : [];
    if (!sectionName) return modules;

    return modules.map((module) => {
      if (!module?.children?.length) return { ...module, sectionName };
      return {
        ...module,
        sectionName,
        children: module.children.map((child) => ({
          ...child,
          sectionName,
        })),
      };
    });
  });

const buildMainDropdownGroups = (sections = []) => {
  const safeSections = Array.isArray(sections) ? sections : [];
  const withSectionContext = safeSections.map((section) => ({
    ...section,
    children: (Array.isArray(section?.children) ? section.children : []).map((child) => ({
      ...child,
      sectionName: String(section?.name || "").trim(),
    })),
  }));

  if (withSectionContext.length <= 5) return withSectionContext;

  const primary = withSectionContext.slice(0, 4);
  const remaining = withSectionContext.slice(4);
  const mergedChildren = remaining.flatMap((section) =>
    Array.isArray(section?.children) ? section.children : [],
  );

  return [
    ...primary,
    {
      name: "MORE MODULES",
      accent: "from-slate-500 via-slate-600 to-slate-700",
      children: mergedChildren,
    },
  ];
};

const collectEnabledModuleIds = (nodes = [], treeState = {}, path = [], enabled = new Set()) => {
  nodes.forEach((node) => {
    const currentPath = [...path, node.name];
    const key = buildPathKey(currentPath);
    const moduleId = String(node?.moduleId || "").trim();
    const isSyntheticId = moduleId.startsWith("idx::");
    const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
    if (moduleId && !isSyntheticId && treeState[key]) {
      enabled.add(moduleId);
    }
    if (hasChildren) {
      collectEnabledModuleIds(node.children, treeState, currentPath, enabled);
    }
  });
  return enabled;
};

const collectEnabledAccessModules = (nodes = [], treeState = {}, path = [], enabled = new Set()) => {
  const ACCESS_PATH_KEY_MAP = { ...VISITOR_PATH_KEY_MAP, ...ORGANIZATION_PATH_KEY_MAP };
  nodes.forEach((node) => {
    const currentPath = [...path, node.name];
    const key = buildPathKey(currentPath);
    const moduleId = String(node?.moduleId || "").trim();
    const mappedAccessKey = ACCESS_PATH_KEY_MAP[key];

    if (treeState[key]) {
      if (moduleId && !moduleId.startsWith("idx::")) {
        enabled.add(moduleId);
      }
      if (mappedAccessKey) {
        enabled.add(mappedAccessKey);
      }
    }

    if (Array.isArray(node?.children) && node.children.length) {
      collectEnabledAccessModules(node.children, treeState, currentPath, enabled);
    }
  });
  return enabled;
};

const applyAccessModulesToTreeState = (baseState = {}, accessModules = []) => {
  const next = { ...(baseState || {}) };
  const ACCESS_PATH_KEY_MAP = { ...VISITOR_PATH_KEY_MAP, ...ORGANIZATION_PATH_KEY_MAP };
  const accessSet = new Set(
    (Array.isArray(accessModules) ? accessModules : [])
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );

  Object.entries(ACCESS_PATH_KEY_MAP).forEach(([pathKey, moduleKey]) => {
    if (accessSet.has(moduleKey)) {
      const parts = pathKey.split("::").filter(Boolean);
      for (let i = 1; i <= parts.length; i += 1) {
        const ancestor = parts.slice(0, i).join("::");
        if (Object.prototype.hasOwnProperty.call(next, ancestor)) {
          next[ancestor] = true;
        }
      }
    }
  });

  return next;
};

const DEPARTMENT_ID_GROUPS = {
  "HR Department": new Set([
    "employee-management",
    "documents",
    "recruitment",
    "leave-processing",
    "attendance-review",
    "payroll",
    "exit-management",
  ]),
  "Administration Department": new Set([
    "administration-tenant-companies",
    "administration-bookings-management",
    "administration-visitor-management",
    "resource-management",
    "housekeeping",
    "workspace-layout",
  ]),
  "Sales Department": new Set([
    "leads-management",
    "sales-tenant-companies",
    "pricing-packages",
    "sales-architecture",
  ]),
  "Finance Department": new Set([
    "expenses-budget",
    "billing-payments",
    "accounting",
  ]),
  "Tech Department": new Set(["tech-website-builder"]),
  "IT Department": new Set(["system-access-management", "repair-logs"]),
  "Maintenance Department": new Set(["amc-scheduler", "maintenance-repair-logs"]),
};

const groupDepartmentModules = (modules = []) => {
  const buckets = Object.keys(DEPARTMENT_ID_GROUPS).reduce((acc, dept) => {
    acc[dept] = [];
    return acc;
  }, {});
  const others = [];

  modules.forEach((module) => {
    const moduleId = String(module?.moduleId || "").trim().toLowerCase();
    let assigned = false;
    Object.entries(DEPARTMENT_ID_GROUPS).forEach(([dept, idSet]) => {
      if (assigned) return;
      if (moduleId && idSet.has(moduleId)) {
        buckets[dept].push(module);
        assigned = true;
      }
    });
    if (!assigned) others.push(module);
  });

  const grouped = Object.entries(buckets)
    .map(([dept, items]) => ({ name: dept, items }))
    .filter((entry) => entry.items.length);

  if (others.length) grouped.push({ name: "Other Department Access", items: others });
  return grouped;
};

const initializeTreeState = (nodes, pathParts = [], state = {}) => {
  nodes.forEach((node) => {
    const nextPath = [...pathParts, node.name];
    state[buildPathKey(nextPath)] = true;
    if (node.children?.length) {
      initializeTreeState(node.children, nextPath, state);
    }
  });

  return state;
};

const initializeDisabledTreeState = (nodes, pathParts = [], state = {}) => {
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

const withEnabledBranches = (branches = []) => {
  const state = initializeDisabledTreeState(MODULE_SECTIONS);
  branches.forEach((branch) => enableBranch(state, branch));
  return state;
};

const buildStateFromEnabledKeys = (nodes = [], enabledKeys = []) => {
  const baseState = initializeDisabledTreeState(nodes);
  const keys = Array.isArray(enabledKeys) ? enabledKeys : [];

  const enablePathWithAncestors = (pathKey, options = {}) => {
    const { includeDescendants = false } = options;
    const parts = String(pathKey || "").split("::").filter(Boolean);
    for (let i = 1; i <= parts.length; i += 1) {
      const ancestorKey = parts.slice(0, i).join("::");
      if (Object.prototype.hasOwnProperty.call(baseState, ancestorKey)) {
        baseState[ancestorKey] = true;
      }
    }
    if (includeDescendants) {
      Object.keys(baseState).forEach((candidate) => {
        if (candidate === pathKey || candidate.startsWith(`${pathKey}::`)) {
          baseState[candidate] = true;
        }
      });
    }
  };

  const idPathMap = new Map();
  const collectIdPaths = (treeNodes = [], path = []) => {
    treeNodes.forEach((node) => {
      const currentPath = [...path, node.name];
      const moduleId = String(node?.moduleId || "").trim();
      if (moduleId) {
        const existing = idPathMap.get(moduleId) || [];
        existing.push(buildPathKey(currentPath));
        idPathMap.set(moduleId, existing);
      }
      if (Array.isArray(node?.children) && node.children.length) {
        collectIdPaths(node.children, currentPath);
      }
    });
  };
  collectIdPaths(nodes);

  keys.forEach((rawKey) => {
    const raw = String(rawKey || "").trim();
    if (!raw) return;

    const pathKeys = idPathMap.get(raw);
    if (Array.isArray(pathKeys) && pathKeys.length) {
      // ID-based grants should enable only that node and its ancestors.
      // Descendants remain independent and can stay locked/off.
      pathKeys.forEach((pathKey) => enablePathWithAncestors(pathKey, { includeDescendants: false }));
      return;
    }

    // Legacy path-based grants may represent a branch key; preserve prior behavior.
    enablePathWithAncestors(raw, { includeDescendants: true });
  });
  return baseState;
};

const resolvePlanKey = (rawPlan) => {
  const value = String(rawPlan || "").trim().toLowerCase();
  if (!value) return "basic";
  if (value.includes("custom")) return "customize";
  if (value.includes("pro")) return "professional";
  return "basic";
};

const buildPlanState = (rawPlan) => {
  const basic = [
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
  const professional = [
    ["COMPANY SETTINGS", "Workspace Settings"],
    ["COMPANY SETTINGS", "Organization Management", "Departments Tab"],
    ["COMPANY SETTINGS", "Organization Management", "Global Count Card"],
    ["COMPANY SETTINGS", "Access Grants", "Promote / Demote"],
    ["COMPANY SETTINGS", "Access Grants", "Transfer Workspace"],
    ["COMPANY SETTINGS", "Access Grants", "Add Workspace Access"],
    ["COMPANY SETTINGS", "Website Builder", "Dynamic Website"],
    ["KEY APPS", "Meeting Room System"],
    ["KEY APPS", "Tickets"],
    ["KEY APPS", "Calendar"],
    ["KEY APPS", "Visitor Management"],
    ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor Tabs", "Department Visitor Tab"],
    ["KEY APPS", "Visitor Management", "New Frontdesk Action", "Standard Visitor Tabs", "Tenant Company Visitor Tab"],
    ["DEPARTMENT ACCESSES", "Sales Department"],
  ];
  const customize = [
    ["COMPANY SETTINGS", "Analytics"],
    ["KEY APPS", "Attendance"],
    ["KEY APPS", "Tasks"],
    ["KEY APPS", "Leave Requests"],
    ["KEY APPS", "Assets"],
    ["KEY APPS", "Inventory"],
    ["KEY APPS", "Finance Management"],
    ["KEY APPS", "Reports"],
    ["DEPARTMENT ACCESSES"],
  ];

  const planKey = resolvePlanKey(rawPlan);
  if (planKey === "basic") return withEnabledBranches(basic);
  if (planKey === "professional") return withEnabledBranches([...basic, ...professional]);
  return withEnabledBranches([...basic, ...professional, ...customize]);
};

const buildRoleStateFromWorkspace = ({
  moduleSections = [],
  enabledModuleIds = [],
  designation = "",
}) => {
  const role = String(designation || "").trim().toLowerCase();
  const planState = buildStateFromEnabledKeys(moduleSections, enabledModuleIds);
  if (role.includes("founder")) {
    return planState;
  }

  const commonOnly = initializeDisabledTreeState(moduleSections);
  const applyCommonBranch = (nodes = [], path = []) => {
    nodes.forEach((node) => {
      const currentPath = [...path, node.name];
      const key = buildPathKey(currentPath);
      const topCategory = String(currentPath[0] || "").toLowerCase();
      const inCommonCategory = topCategory.includes("common");

      if (inCommonCategory && planState[key]) {
        commonOnly[key] = true;
      }
      if (Array.isArray(node?.children) && node.children.length) {
        applyCommonBranch(node.children, currentPath);
      }
    });
  };

  applyCommonBranch(moduleSections);
  return commonOnly;
};

const clampStateToPlan = (state = {}, planState = {}) => {
  const next = { ...state };
  Object.keys(next).forEach((key) => {
    if (!planState[key]) {
      next[key] = false;
    }
  });
  return next;
};

const findNodeByPath = (nodes, pathParts, depth = 0) => {
  if (!Array.isArray(nodes) || !pathParts?.length) return null;

  const current = nodes.find((node) => node.name === pathParts[depth]);
  if (!current) return null;
  if (depth === pathParts.length - 1) return current;

  return findNodeByPath(current.children || [], pathParts, depth + 1);
};

const hasEnabledDescendant = (node, pathParts, state) => {
  if (!node) return false;

  const key = buildPathKey(pathParts);
  if (state[key]) return true;

  return (node.children || []).some((child) =>
    hasEnabledDescendant(child, [...pathParts, child.name], state),
  );
};

const toggleTreeNode = (tree, prevState, pathParts, checked) => {
  const nextState = { ...prevState };
  const targetNode = findNodeByPath(tree, pathParts);
  if (!targetNode) return prevState;

  const applyToSubtree = (node, currentPath) => {
    const key = buildPathKey(currentPath);
    nextState[key] = checked;
    (node.children || []).forEach((child) =>
      applyToSubtree(child, [...currentPath, child.name]),
    );
  };

  applyToSubtree(targetNode, pathParts);

  for (let depth = pathParts.length - 1; depth >= 1; depth -= 1) {
    const ancestorPath = pathParts.slice(0, depth);
    const ancestorNode = findNodeByPath(tree, ancestorPath);
    if (!ancestorNode) continue;

    const ancestorKey = buildPathKey(ancestorPath);
    nextState[ancestorKey] =
      Boolean(nextState[ancestorKey]) ||
      hasEnabledDescendant(ancestorNode, ancestorPath, nextState);
  }

  return nextState;
};

const filterTree = (nodes, query) => {
  if (!query) return nodes;

  return nodes
    .map((node) => {
      const matches = node.name.toLowerCase().includes(query);
      const children = filterTree(node.children || [], query);

      if (matches || children.length) {
        return { ...node, children };
      }

      return null;
    })
    .filter(Boolean);
};

const filterTreeByState = (nodes, state, path = []) =>
  (Array.isArray(nodes) ? nodes : [])
    .map((node) => {
      const currentPath = [...path, node.name];
      const key = buildPathKey(currentPath);
      const children = filterTreeByState(node.children || [], state, currentPath);
      const isEnabled = Boolean(state?.[key]);

      if (isEnabled || children.length) {
        return { ...node, children };
      }

      return null;
    })
    .filter(Boolean);

const getNodeKind = (level) => {
  if (level === 0) return "MODULE";
  if (level === 1) return "SUBMODULE";
  return "TAB";
};

const normalizeWorkspaceId = (workspaceId = "") =>
  String(workspaceId || "").trim() || DEFAULT_WORKSPACE_ID;

const normalizeWorkspaceName = (workspaceName = "") =>
  String(workspaceName || "").trim() || DEFAULT_WORKSPACE_NAME;

const getMemberWorkspaces = (member, options = {}) => {
  const { allowFallback = true } = options;
  const access = Array.isArray(member?.workspaceAccess)
    ? member.workspaceAccess
    : [];

  if (!access.length) {
    if (!allowFallback) {
      return [];
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: DEFAULT_WORKSPACE_NAME,
        moduleAccess: member?.moduleAccess || {},
        grantedModules: Array.isArray(member?.grantedModules) ? member.grantedModules : [],
      },
    ];
  }

  return access.map((workspace) => ({
    workspaceId: normalizeWorkspaceId(workspace?.workspaceId),
    workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
    moduleAccess: workspace?.moduleAccess || {},
    grantedModules: Array.isArray(workspace?.grantedModules) ? workspace.grantedModules : [],
  }));
};

const getWorkspaceAccessForMember = (member, workspaceId, options = {}) => {
  const workspaces = getMemberWorkspaces(member, options);
  const currentWorkspaceId = normalizeWorkspaceId(workspaceId);
  return (
    workspaces.find(
      (workspace) => normalizeWorkspaceId(workspace.workspaceId) === currentWorkspaceId,
    ) || workspaces[0]
  );
};

const hasWorkspaceAccessEntry = (member, workspaceId, options = {}) => {
  const workspaces = getMemberWorkspaces(member, options);
  const currentWorkspaceId = normalizeWorkspaceId(workspaceId);
  return workspaces.some(
    (workspace) => normalizeWorkspaceId(workspace.workspaceId) === currentWorkspaceId,
  );
};

const TreeNodeCard = ({
  node,
  pathParts,
  level,
  treeState,
  onToggle,
  isPathLocked,
  isPathEnabled,
  isWorkspaceMode,
}) => {
  const key = buildPathKey(pathParts);
  const isEnabled = isPathEnabled ? isPathEnabled(pathParts) : Boolean(treeState[key]);
  const isLocked = isPathLocked(pathParts);
  const hasChildren = (node.children || []).length > 0;

  return (
    <div
      className={`rounded-xl border ${level === 0
        ? "border-slate-200 bg-slate-50/70"
        : "border-slate-100 bg-white"
        } p-3.5`}
      style={{ marginLeft: level * 16 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-500 shadow-sm">
            {getNodeKind(level)}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-slate-900">{node.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasChildren
              ? `${node.children.length} child ${node.children.length === 1 ? "node" : "nodes"}`
              : "Leaf access item"}
          </p>
          {isLocked && <p className="mt-1 text-xs font-semibold text-rose-500">Locked</p>}
        </div>

        <FormControlLabel
          sx={{ mr: 0 }}
          onClick={(event) => event.stopPropagation()}
          control={
            <Switch
              checked={isEnabled}
              disabled={!isWorkspaceMode && isLocked}
              onChange={(event) => onToggle(pathParts, event.target.checked)}
            />
          }
          label=""
        />
      </div>

      {hasChildren && (
        <div className="mt-4 border-l-2 border-dashed border-slate-200 pl-4">
          <div className="flex flex-col gap-3">
            {node.children.map((child) => (
              <TreeNodeCard
                key={child.name}
                node={child}
                pathParts={[...pathParts, child.name]}
                level={level + 1}
                treeState={treeState}
                onToggle={onToggle}
                isPathLocked={isPathLocked}
                isPathEnabled={isPathEnabled}
                isWorkspaceMode={isWorkspaceMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AccessEditorModal = ({
  open,
  employee,
  workspace,
  moduleSections,
  visibleModuleSections,
  treeState,
  treeSearch,
  setTreeSearch,
  onToggle,
  onClose,
  onSave,
  isSaving,
  isPathLocked,
  isPathEnabled,
  isWorkspaceMode,
}) => {
  const filteredSections = useMemo(() => {
    const query = treeSearch.trim().toLowerCase();
    return filterTree(visibleModuleSections || moduleSections, query);
  }, [moduleSections, treeSearch, visibleModuleSections]);
  const mainDropdownGroups = useMemo(
    () => buildMainDropdownGroups(filteredSections),
    [filteredSections],
  );
  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...(prev || {}) };
      mainDropdownGroups.forEach((group, index) => {
        if (!Object.prototype.hasOwnProperty.call(next, group.name)) {
          next[group.name] = index < 2;
        }
      });
      Object.keys(next).forEach((groupName) => {
        if (!mainDropdownGroups.some((group) => group.name === groupName)) {
          delete next[groupName];
        }
      });
      return next;
    });
  }, [mainDropdownGroups]);

  if (!workspace) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        className="max-h-[84vh] w-[min(980px,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_52px_rgba(15,23,42,0.18)]"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="flex max-h-[84vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                {isWorkspaceMode ? "Workspace Modules" : "Employee Access"}
              </p>
              <h2 className="mt-1.5 text-xl font-pmedium text-slate-900">
                {isWorkspaceMode ? workspace.workspaceName : employee?.name || "Unnamed Employee"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Workspace: <span className="font-semibold text-slate-700">{workspace.workspaceName}</span>
              </p>
            </div>
            <IconButton onClick={onClose} size="small">
              <CloseIcon fontSize="small" sx={{ color: "#64748b" }} />
            </IconButton>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[300px_1fr]">
            <div className="border-b border-slate-100 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    {(isWorkspaceMode ? workspace.workspaceName : employee?.name || "W")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {isWorkspaceMode ? "Workspace Control" : employee?.name || "Employee"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isWorkspaceMode ? "Master Panel" : employee?.designation || "Role not set"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Email</span>
                    <span className="font-medium text-slate-900">
                      {isWorkspaceMode ? "Workspace Scope" : employee?.email || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <span className="font-medium text-slate-900">
                      {isWorkspaceMode ? "Active" : employee?.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Workspace</span>
                    <span className="font-medium text-slate-900">{workspace.workspaceName}</span>
                  </div>
                </div>
              </div>

              <TextField
                value={treeSearch}
                onChange={(event) => setTreeSearch(event.target.value)}
                fullWidth
                size="small"
                placeholder="Search access nodes"
                className="!mt-3"
              />

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Toggle modules, submodules, and nested tabs from this workspace-specific view.
              </p>

            </div>

            <div className="flex max-h-[84vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip label={workspace.workspaceName} size="small" />
                  <Chip
                    label={`${mainDropdownGroups.length} Main Groups`}
                    size="small"
                    sx={{ backgroundColor: "rgba(15, 23, 42, 0.06)", fontWeight: 700 }}
                  />
                </div>
                <Button
                  onClick={onSave}
                  variant="contained"
                  startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
                  disabled={isSaving}
                  sx={{
                    borderRadius: "14px",
                    textTransform: "none",
                    fontWeight: 700,
                    backgroundColor: "#0F172A",
                    "&:hover": { backgroundColor: "#111827" },
                  }}
                >
                  {isSaving ? "Saving..." : isWorkspaceMode ? "Save Enabled Modules" : "Save Access"}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {mainDropdownGroups.map((group) => (
                  <div
                    key={group.name}
                    className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [group.name]: !prev[group.name],
                        }))
                      }
                      className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Workspace Control
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{group.name}</p>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        {Array.isArray(group.children) ? `${group.children.length} modules` : "0 modules"}
                      </div>
                    </button>

                    {openGroups[group.name] && (
                      <div className="space-y-3 px-4 py-3">
                        {String(group.name || "").toLowerCase().includes("department access") ? (
                          groupDepartmentModules(Array.isArray(group.children) ? group.children : []).map((deptGroup) => (
                            <div key={`${group.name}::${deptGroup.name}`} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {deptGroup.name}
                              </p>
                              <div className="space-y-2">
                                {deptGroup.items.map((module) => (
                                  <TreeNodeCard
                                    key={`${group.name}::${deptGroup.name}::${module.name}`}
                                    node={module}
                                    pathParts={[
                                      String(module?.sectionName || group.name).trim(),
                                      module.name,
                                    ]}
                                    level={0}
                                    treeState={treeState}
                                    onToggle={onToggle}
                                    isPathLocked={isPathLocked}
                                    isPathEnabled={isPathEnabled}
                                    isWorkspaceMode={isWorkspaceMode}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          (Array.isArray(group.children) ? group.children : []).map((module) => (
                            <TreeNodeCard
                              key={`${group.name}::${module.name}`}
                              node={module}
                              pathParts={[
                                String(module?.sectionName || group.name).trim(),
                                module.name,
                              ]}
                              level={0}
                              treeState={treeState}
                              onToggle={onToggle}
                              isPathLocked={isPathLocked}
                              isPathEnabled={isPathEnabled}
                              isWorkspaceMode={isWorkspaceMode}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {!mainDropdownGroups.length && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                    No access nodes match your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Box>
    </Modal>
  );
};

const ModuleAccess = () => {
  const axios = useAxiosPrivate();
  const queryClient = useQueryClient();
  const { companyId: companySlug } = useParams();
  const location = useLocation();
  const { companyName, selectedPlan } = location.state || {};
  const resolvedCompanyId = useMemo(() => {
    const stateCompanyId = String(location.state?.companyId || "").trim();
    if (stateCompanyId) return stateCompanyId;

    const storedCompanyId = String(sessionStorage.getItem("companyId") || "").trim();
    if (storedCompanyId) return storedCompanyId;

    return "";
  }, [location.state]);
  const resolvedCompanyName = useMemo(() => {
    const stateCompanyName = String(location.state?.companyName || "").trim();
    if (stateCompanyName) return stateCompanyName;

    const storedCompanyName = String(sessionStorage.getItem("companyName") || "").trim();
    if (storedCompanyName) return storedCompanyName;

    return String(companyName || companySlug || "").replace(/-/g, " ").trim();
  }, [companyName, companySlug, location.state]);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [treeSearch, setTreeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [treeState, setTreeState] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pageTitle = useMemo(() => {
    if (companyName) return companyName;
    return String(companySlug || "Host Company").replace(/-/g, " ");
  }, [companyName, companySlug]);

  const { data: companyMemberPayload, isLoading } = useQuery({
    queryKey: ["host-company-members", resolvedCompanyId],
    queryFn: async () => {
      const response = await axios.get(
        `/api/host-user/company-members?companyId=${encodeURIComponent(
          resolvedCompanyId,
        )}&companyName=${encodeURIComponent(resolvedCompanyName)}`,
      );
      return response.data?.data || { company: null, members: [], workspaces: [] };
    },
    enabled: Boolean(resolvedCompanyId),
  });

  const company = companyMemberPayload?.company || null;
  const members = useMemo(
    () =>
      Array.isArray(companyMemberPayload?.members)
        ? companyMemberPayload.members
        : [],
    [companyMemberPayload?.members],
  );

  const effectiveRawPlan = useMemo(() => {
    const fromCompany = String(company?.plan || company?.requestedPlan || "").trim();
    if (fromCompany) return fromCompany;
    return String(selectedPlan || "").trim();
  }, [company?.plan, company?.requestedPlan, selectedPlan]);

  const normalizedPlan = useMemo(() => {
    const rawPlan = String(effectiveRawPlan || "").trim();
    if (!rawPlan) return "Not Assigned";
    return rawPlan
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }, [effectiveRawPlan]);

  const workspaces = useMemo(() => {
    const apiWorkspaces = Array.isArray(companyMemberPayload?.workspaces)
      ? companyMemberPayload.workspaces
      : [];

    if (apiWorkspaces.length) {
      return apiWorkspaces.map((workspace) => ({
        workspaceId: normalizeWorkspaceId(workspace.workspaceId),
        workspaceName: normalizeWorkspaceName(workspace.workspaceName),
        modules: workspace?.modules || [],
        enabledModuleIds: Array.isArray(workspace?.enabledModuleIds)
          ? workspace.enabledModuleIds
          : [],
      }));
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: DEFAULT_WORKSPACE_NAME,
        modules: [],
        enabledModuleIds: [],
      },
    ];
  }, [companyMemberPayload?.workspaces]);

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length) {
      setSelectedWorkspaceId(workspaces[0].workspaceId);
    }
  }, [selectedWorkspaceId, workspaces]);

  const selectedWorkspace = useMemo(() => {
    return (
      workspaces.find(
        (workspace) =>
          normalizeWorkspaceId(workspace.workspaceId) === normalizeWorkspaceId(selectedWorkspaceId),
      ) || workspaces[0]
    );
  }, [selectedWorkspaceId, workspaces]);

  const activeModuleSections = useMemo(() => {
    const parsedModules = ensureVisitorModuleInTree(
      parseWorkspaceModules(selectedWorkspace?.modules),
    );
    const fromWorkspace = reshapeVisitorHierarchy(normalizeModulesTree(parsedModules));
    return fromWorkspace.length ? fromWorkspace : [];
  }, [selectedWorkspace?.modules]);

  const workspaceEnabledPlanState = useMemo(() => {
    if (!activeModuleSections.length) return {};
    const enabledKeys = Array.isArray(selectedWorkspace?.enabledModuleIds)
      ? selectedWorkspace.enabledModuleIds
      : [];
    if (!enabledKeys.length) return {};
    return buildStateFromEnabledKeys(activeModuleSections, enabledKeys);
  }, [activeModuleSections, selectedWorkspace?.enabledModuleIds]);

  const workspaceDraftEnabledIdSet = useMemo(
    () => collectEnabledModuleIds(activeModuleSections, treeState),
    [activeModuleSections, treeState],
  );

  useEffect(() => {
    if (!workspaces.length) return;

    const exists = workspaces.some(
      (workspace) => normalizeWorkspaceId(workspace.workspaceId) === normalizeWorkspaceId(selectedWorkspaceId),
    );

    if (!exists) {
      setSelectedWorkspaceId(workspaces[0].workspaceId);
      setSelectedEmployee(null);
      setIsModalOpen(false);
      setTreeState(workspaceEnabledPlanState);
    }
  }, [selectedWorkspaceId, workspaceEnabledPlanState, workspaces]);

  useEffect(() => {
    if (!isModalOpen) {
      setTreeState(workspaceEnabledPlanState);
    }
  }, [isModalOpen, workspaceEnabledPlanState]);

  const hasRealWorkspaces = useMemo(() => {
    return workspaces.some(
      (workspace) =>
        normalizeWorkspaceId(workspace.workspaceId) !== DEFAULT_WORKSPACE_ID ||
        normalizeWorkspaceName(workspace.workspaceName) !== DEFAULT_WORKSPACE_NAME,
    );
  }, [workspaces]);

  const filteredMembers = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    const workspaceId = normalizeWorkspaceId(selectedWorkspace?.workspaceId);

    return members.filter((member) => {
      const memberWorkspaces = getMemberWorkspaces(member, {
        allowFallback: !hasRealWorkspaces,
      });
      const inWorkspace = memberWorkspaces.some(
        (workspace) => normalizeWorkspaceId(workspace.workspaceId) === workspaceId,
      );
      const matchesQuery =
        !query ||
        String(member.name || "").toLowerCase().includes(query) ||
        String(member.email || "").toLowerCase().includes(query) ||
        String(member.designation || "").toLowerCase().includes(query);

      return inWorkspace && matchesQuery;
    });
  }, [employeeSearch, hasRealWorkspaces, members, selectedWorkspace]);

  const openEmployeeAccess = (member) => {
    setIsWorkspaceMode(false);
    const workspaceAccess = getWorkspaceAccessForMember(
      member,
      selectedWorkspace?.workspaceId,
      { allowFallback: !hasRealWorkspaces },
    );
    const hasSavedWorkspaceAccess = hasWorkspaceAccessEntry(
      member,
      selectedWorkspace?.workspaceId,
      { allowFallback: !hasRealWorkspaces },
    );

    const rolePresetState = buildRoleStateFromWorkspace({
      moduleSections: activeModuleSections,
      enabledModuleIds: Array.isArray(selectedWorkspace?.enabledModuleIds)
        ? selectedWorkspace.enabledModuleIds
        : [],
      designation: member?.designation,
    });

    setSelectedEmployee({
      ...member,
      workspaceName: workspaceAccess.workspaceName,
      workspaceId: workspaceAccess.workspaceId,
      moduleAccess: workspaceAccess.moduleAccess || {},
      grantedModules: Array.isArray(workspaceAccess?.grantedModules)
        ? workspaceAccess.grantedModules
        : [],
      hasSavedWorkspaceAccess,
    });
    const initialState =
      hasSavedWorkspaceAccess
        ? clampStateToPlan(workspaceAccess.moduleAccess || {}, workspaceEnabledPlanState)
        : clampStateToPlan(rolePresetState, workspaceEnabledPlanState);
    setTreeState(
      applyAccessModulesToTreeState(
        initialState,
        Array.isArray(workspaceAccess?.grantedModules) ? workspaceAccess.grantedModules : [],
      ),
    );
    setTreeSearch("");
    setIsModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) return null;

      const response = await axios.patch(
        `/api/host-user/${selectedEmployee._id}/workspace-access`,
        {
          workspaceId: selectedWorkspace?.workspaceId,
          workspaceName: selectedWorkspace?.workspaceName,
          moduleAccess: clampStateToPlan(
            treeState,
            workspaceEnabledPlanState,
          ),
          accessModules: Array.from(
            collectEnabledAccessModules(activeModuleSections, treeState),
          ),
          accessFeatures: [],
          accessSource: selectedEmployee?.hasSavedWorkspaceAccess
            ? "custom_workspace_grant"
            : "plan_role_preset",
        },
      );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["host-company-members", resolvedCompanyId],
      });
      toast.success("Access saved successfully.");
      setIsModalOpen(false);
      setSelectedEmployee(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to save access.");
    },
  });

  const saveWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const enabledIds = Array.from(
        collectEnabledModuleIds(activeModuleSections, treeState),
      );
      const response = await axios.patch(
        `/api/host-user/workspace/${selectedWorkspace?.workspaceId}/enabled-modules`,
        { enabledModuleIds: enabledIds },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["host-company-members", resolvedCompanyId],
      });
      toast.success("Workspace enabled modules updated.");
      setIsModalOpen(false);
      setIsWorkspaceMode(false);
      setSelectedEmployee(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update workspace modules.");
    },
  });

  const handleToggle = (pathParts, checked) => {
    setTreeState((prev) => toggleTreeNode(activeModuleSections, prev, pathParts, checked));
  };

  const isPathEnabled = (pathParts) => {
    const key = buildPathKey(pathParts);
    if (!isWorkspaceMode) return Boolean(treeState[key]);

    const node = findNodeByPath(activeModuleSections, pathParts);
    const moduleId = String(node?.moduleId || "").trim();
    if (moduleId && !moduleId.startsWith("idx::")) {
      return workspaceDraftEnabledIdSet.has(moduleId);
    }
    return Boolean(treeState[key]);
  };

  const isPathLocked = (pathParts) => {
    const key = buildPathKey(pathParts);
    if (isWorkspaceMode) {
      const node = findNodeByPath(activeModuleSections, pathParts);
      const moduleId = String(node?.moduleId || "").trim();
      if (!moduleId || moduleId.startsWith("idx::")) {
        return !treeState[key];
      }
      return !workspaceDraftEnabledIdSet.has(moduleId);
    }
    return !workspaceEnabledPlanState[key];
  };

  const employeeVisibleModuleSections = useMemo(
    () => filterTreeByState(activeModuleSections, workspaceEnabledPlanState),
    [activeModuleSections, workspaceEnabledPlanState],
  );
  const Columns = useMemo(
    () => [
      {
        headerName: "Employee",
        field: "name",
        flex: 1.5,
        cellRenderer: (params) => {
          const member = params.data;
          if (!member) return null;
          return (
            <div>
              {member.name || "-"}
            </div>
          );
        }
      },
      {
        headerName: "Employee Email",
        field: "email",
        flex: 1.5,
        cellRenderer: (params) => {
          const member = params.data;
          if (!member) return null;
          return (
            <div>
              {member.email || "-"}
            </div >
          );
        }
      },

      {
        headerName: "Role",
        field: "designation",
        flex: 1,
        valueFormatter: (params) => params.value || "-",
      },
      {
        headerName: "Workspace",
        field: "workspaces",
        flex: 2,
        cellRenderer: (params) => {
          const member = params.data;
          if (!member) return null;
          const memberWorkspaces = getMemberWorkspaces(member, {
            allowFallback: !hasRealWorkspaces,
          });
          return (
            <div>
              {memberWorkspaces.map((workspace) => (
                <Chip
                  key={`${member._id}-${workspace.workspaceId}`}
                  label={workspace.workspaceName}
                  size="small"
                  sx={{ fontSize: "10px", height: "20px" }}
                />
              ))}
            </div>
          );
        }
      },
      {
        headerName: "Status",
        field: "isActive",
        flex: 1,
        cellRenderer: (params) => {
          const member = params.data;
          if (!member) return null;
          return (
            <Chip
              label={member.isActive ? "Active" : "Inactive"}
              size="small"
              color={member.isActive ? "success" : "default"}
              variant="outlined"
              sx={{ height: "20px", fontSize: "10px" }}
            />
          );
        }
      },
      {
        headerName: "Action",
        field: "action",
        pinned: "right",
        lockPinned: true,
        width: 100,
        cellRenderer: (params) => {
          const member = params.data;
          if (!member) return null;
          return (
            <div>
              <IconButton
                onClick={(event) => {
                  event.stopPropagation();
                  openEmployeeAccess(member);
                }}
                size="small"
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </div>
          );
        }
      },
    ],
    [hasRealWorkspaces]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="flex flex-col gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-pmedium uppercase tracking-[0.24em] text-gray-500">
                Host Company Access
              </p>
              <h1 className="mt-2 text-4xl font-pmedium uppercase tracking-tight text-primary">
                Module Access
              </h1>
              <p className="mt-3 max-w-3xl text-content text-gray-600">
                Select a workspace, pick an employee, and edit page access from the same screen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Chip
                label={normalizedPlan}
                size="small"
                sx={{
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  color: "#2563EB",
                  fontWeight: 700,
                }}
              />
              <Chip
                label={`${workspaces.length} Workspaces`}
                size="small"
                sx={{
                  backgroundColor: "rgba(15, 23, 42, 0.08)",
                  color: "#0F172A",
                  fontWeight: 700,
                }}
              />
              <Chip
                icon={<GroupsIcon fontSize="small" />}
                label={`${filteredMembers.length} Employees`}
                size="small"
                sx={{
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "#047857",
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TextField
              select
              label="Workspace"
              value={selectedWorkspace?.workspaceId || ""}
              onChange={(event) => {
                setSelectedWorkspaceId(event.target.value);
                setSelectedEmployee(null);
                setIsModalOpen(false);
                setTreeState(workspaceEnabledPlanState);
              }}
              fullWidth
              size="small"
            >
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.workspaceId} value={workspace.workspaceId}>
                  {workspace.workspaceName}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              onClick={() => {
                setIsWorkspaceMode(true);
                setSelectedEmployee(null);
                setTreeState(workspaceEnabledPlanState);
                setIsModalOpen(true);
              }}
              sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}
            >
              Configure Workspace Modules
            </Button>

            {/* <TextField
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                fullWidth
                placeholder="Search employee, role, or email"
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" className="mr-2 text-slate-400" />,
                }}
              /> */}

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-1">
              <BusinessIcon fontSize="small" sx={{ color: "#64748b" }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{pageTitle}</p>
                <p className="text-xs text-slate-500">
                  {selectedWorkspace?.workspaceName ||
                    company?.companyCity ||
                    company?.companyState ||
                    "Company access source"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-pmedium text-slate-900">Employee List</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Click an employee to open the access editor for the selected workspace.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <SearchIcon fontSize="small" />
                <span>Filtered by workspace and search</span>
              </div>
            </div>
          </div>

          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Workspace</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
                        <CircularProgress size={16} color="inherit" />
                        Loading employees...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length ? (
                  filteredMembers.map((member) => {
                    const memberWorkspaces = getMemberWorkspaces(member, {
                      allowFallback: !hasRealWorkspaces,
                    });
                    return (
                      <TableRow
                        key={member._id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => openEmployeeAccess(member)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900">{member.name || "-"}</p>
                            <p className="text-xs text-slate-500">{member.email || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{member.designation || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {memberWorkspaces.map((workspace) => (
                              <Chip
                                key={`${member._id}-${workspace.workspaceId}`}
                                label={workspace.workspaceName}
                                size="small"
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={member.isActive ? "Active" : "Inactive"}
                            size="small"
                            color={member.isActive ? "success" : "default"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              openEmployeeAccess(member);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="py-10 text-center text-slate-500">
                        No employees found for this workspace.
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </div> */}

        <AgTable
          data={filteredMembers}
          columns={Columns}
          search
          tableTitle="Employee List"
          tableHeight={500}
          loading={isLoading}
        />
      </div>

      <AccessEditorModal
        open={isModalOpen}
        employee={selectedEmployee}
        workspace={selectedWorkspace}
        moduleSections={activeModuleSections}
        visibleModuleSections={
          isWorkspaceMode
            ? activeModuleSections
            : employeeVisibleModuleSections
        }
        treeState={treeState}
        treeSearch={treeSearch}
        setTreeSearch={setTreeSearch}
        onToggle={handleToggle}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSave={() =>
          isWorkspaceMode ? saveWorkspaceMutation.mutate() : saveMutation.mutate()
        }
        isSaving={isWorkspaceMode ? saveWorkspaceMutation.isPending : saveMutation.isPending}
        isPathLocked={isPathLocked}
        isPathEnabled={isPathEnabled}
        isWorkspaceMode={isWorkspaceMode}
      />
    </div>
  );
};

export default ModuleAccess;
