import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Modal,
  Popover,
  Tooltip,
} from "@mui/material";
import { useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";
import CircularProgress from "@mui/material/CircularProgress";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import { STATUS_PILL_BASE, statusPillClass } from "../../../lib/status-pill";
import PageFrame from "../../../components/Pages/PageFrame";

// This screen no longer keeps its own hand-built module tree. The rendered
// tree (`activeModuleSections`, below) comes straight from each workspace's
// stored `modules` snapshot, which the backend now reconciles against a
// single canonical reference (`CANONICAL_SECTION_BLUEPRINTS` in
// hostUserControllers.js, hand-synced from HostPanel's real catalog) before
// it's ever sent here — so there's nothing to duplicate on the client.

// Hand-synced with BASIC_DEFAULT_IDS / PROFESSIONAL_DEFAULT_IDS in
// HostPanel's server/config/workspaceModuleCatalog.ts. "Custom" has no
// distinct id set of its own — it's Professional's set plus whatever gets
// added on top per workspace, matching HostPanel's own model.
const BASIC_PLAN_MODULE_IDS = [
  "dashboard",
  "customer-support",
  "visitor-management",
  // NOT "visitors-management" (plural) — duplicate id for the same page,
  // used only as the Administration Department tab, which is a
  // Professional+ default rather than a Basic one. See the matching note
  // in HostPanel's server/config/workspaceModuleCatalog.ts.
  "visitors_manage_internal_visitors",
  "visitors_tab_daily",
  "visitors_tab_history",
  "visitors_mode_standard",
  "visitors_standard_type_standard",
  "wono-nomad",
  "website-builder",
  // Basic has no department access at all, so neither the Tech Department's
  // Website Builder ("tech-website-builder") nor the Organization Management
  // Departments tab (and its actions) belong here — both are Professional+.
  "website-leads",
  "organization-management",
  "org_tab_users",
  "org_users_invite_member",
  "org_users_change_role",
  "org_users_toggle_access",
  "access-grants",
];

const PROFESSIONAL_PLAN_MODULE_IDS = [
  ...BASIC_PLAN_MODULE_IDS,
  "tech-website-builder",
  "org_tab_departments",
  "org_departments_create",
  "org_departments_edit",
  "org_departments_assign_manager",
  "org_departments_assign_acting_manager",
  "org_departments_remove_acting_manager",
  "visitors_manage_external_clients",
  "visitors_tab_bookings",
  "visitors_tab_clients",
  "visitors_mode_workspace_tour",
  "visitors_mode_walkin_booking",
  "visitors_mode_verify_booking",
  "visitors_standard_type_department",
  "visitors_standard_type_tenant",
  "tickets",
  "meeting-room-system",
  "printouts",
  // "printout-management" (Administration Department admin console) is a
  // separate id from "printouts" (common self-service module) so it can be
  // toggled independently — kept in sync with HostPanel's.
  "printout-management",
  "calendar",
  "workspace-settings",
  "workspace-management",
  // Administration Department is a Professional default — kept in sync with
  // HostPanel's PROFESSIONAL_DEFAULT_IDS (workspaceModuleCatalog.ts).
  "bookings",
  "visitors-management",
  "house-keeping",
  "leads-management",
  "tenant-companies-sales",
  "virtual-office-sales",
  "sales-architecture",
];

const PLAN_MODULE_ID_SETS = {
  basic: new Set(BASIC_PLAN_MODULE_IDS),
  professional: new Set(PROFESSIONAL_PLAN_MODULE_IDS),
  // Custom's baseline is identical to Professional's — see comment above.
  custom: new Set(PROFESSIONAL_PLAN_MODULE_IDS),
};

const PLAN_LABELS = { basic: "Basic", professional: "Professional", custom: "Custom" };

// Canonical vertical labels staff can tick on a workspace. Stored verbatim on
// Workspace.businessTypes; each maps to a key in the server's
// VERTICAL_KEY_BY_BUSINESS_TYPE (hostWorkspaceModuleCatalog.js).
const WORKSPACE_VERTICALS = [
  "Co-Working",
  "Co-Living",
  "Hostels",
  "Workation",
  "Meeting Rooms",
  "Cafe",
];

const normalizeVerticalLabel = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");

const toCanonicalVerticalLabel = (value = "") => {
  const normalized = normalizeVerticalLabel(value);
  // Older workspaces were written with the singular "hostel".
  return normalized === "hostel" ? "hostels" : normalized;
};

// Reads whatever casing/spelling a workspace already has ("cafe", "Cafe",
// "hostel", "meeting-rooms") and returns only the canonical labels offered in
// the editor, so the chips and the checkboxes always agree.
const getWorkspaceVerticalLabels = (businessTypes = []) => {
  const stored = new Set(
    (Array.isArray(businessTypes) ? businessTypes : []).map(toCanonicalVerticalLabel),
  );
  return WORKSPACE_VERTICALS.filter((label) => stored.has(normalizeVerticalLabel(label)));
};

const getWorkspaceVerticalKeys = (businessTypes = []) => {
  const keys = new Set();
  (Array.isArray(businessTypes) ? businessTypes : []).forEach((businessType) => {
    const value = String(businessType || "").trim().toLowerCase();
    if (value === "co-working") keys.add("co-working");
    if (value === "co-living") keys.add("co-living");
    if (value === "hostel" || value === "hostels") keys.add("hostel");
  });
  return keys;
};

// Employee records only carry a free-text `designation`, so the role filters
// and pills are derived from it. This is presentation-only — it never changes
// the stored grant or the founder check used by the access editor.
const ROLE_PILL_CLASSES = {
  Founder: "border-violet-200 bg-violet-50 text-violet-700",
  Staff: "border-slate-200 bg-slate-100 text-slate-600",
  Finance: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Reception: "border-sky-200 bg-sky-50 text-sky-700",
  Sales: "border-amber-200 bg-amber-50 text-amber-700",
  IT: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const getMemberRoleCategory = (designation = "") => {
  const value = String(designation || "").trim().toLowerCase();
  if (value.includes("founder")) return "Founder";
  if (/(finance|account|billing|bookkeeper)/.test(value)) return "Finance";
  if (/(reception|front desk|front office)/.test(value)) return "Reception";
  if (/(sales|business development|marketing)/.test(value)) return "Sales";
  if (/\bit\b|tech|developer|engineer|support/.test(value)) return "IT";
  return "Staff";
};

const getMemberStatus = (member) => {
  if (member?.isDeleted) return "Deleted";
  return member?.isActive ? "Active" : "Inactive";
};

const getMemberAccessCount = (member, workspaceId, allowFallback) => {
  const access = getWorkspaceAccessForMember(member, workspaceId, { allowFallback });
  const granted = Array.isArray(access?.grantedModules) ? access.grantedModules : [];
  if (granted.length) return granted.length;
  const moduleAccess = access?.moduleAccess || {};
  return Object.values(moduleAccess).filter(Boolean).length;
};

const getPlanModuleIds = (tier, businessTypes = []) => {
  const ids = new Set(PLAN_MODULE_ID_SETS[tier] || []);
  if (tier === "basic") return Array.from(ids);

  const verticalKeys = getWorkspaceVerticalKeys(businessTypes);
  if (verticalKeys.has("co-working")) ids.add("tenant-companies-admin");
  if (["hostel", "co-living", "co-working"].some((key) => verticalKeys.has(key))) {
    ids.add("resource-management");
  }
  if (verticalKeys.size > 1) ids.add("resource-pricing");
  return Array.from(ids);
};

// Custom and Professional share the same id set, so an exact match against
// that set is ambiguous by ids alone — break the tie using the workspace's
// actual assigned plan. Anything that isn't an exact match to either set
// (i.e. has extras or a different mix) counts as Custom.
// Enabling a department tab (e.g. "visitors-management") also marks its
// parent department group (e.g. "administration-department") as enabled,
// for tree consistency — that group has its own real id, which otherwise
// leaks into the enabled-id set and breaks an exact match against the plan
// lists below (which only list actual modules, not group containers).
const DEPARTMENT_GROUP_CONTAINER_IDS = new Set([
  "hr-department",
  "administration-department",
  "sales-department",
  "finance-department",
  "maintenance-department",
  "tech-department",
  "it-department",
]);

const computeActivePlanTier = (enabledIdSet, selectedPlan, businessTypes = []) => {
  const meaningfulIds = Array.from(enabledIdSet).filter(
    (id) => !DEPARTMENT_GROUP_CONTAINER_IDS.has(id),
  );
  const meaningfulIdSet = new Set(meaningfulIds);
  const isExactMatch = (ids) =>
    ids.length === meaningfulIds.length && ids.every((id) => meaningfulIdSet.has(id));
  if (isExactMatch(BASIC_PLAN_MODULE_IDS)) return "basic";
  if (isExactMatch(getPlanModuleIds("professional", businessTypes))) {
    return String(selectedPlan || "").trim().toLowerCase() === "custom" ? "custom" : "professional";
  }
  return "custom";
};

const DEFAULT_WORKSPACE_ID = "default-workspace";
const DEFAULT_WORKSPACE_NAME = "Main Workspace";
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

const normalizeModulesTree = (nodes = [], parentPath = []) => {
  const nodeList = toArray(nodes);
  return nodeList
    .map((node, index) => {
      const categoryName = String(
        node?.category || node?.departmentName || node?.groupName || "",
      ).trim();
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

// Recursively counts how many leaf-ish descendants (nodes without children,
// the actual toggleable access items) sit under a node, and how many of
// those are currently enabled — powers the "3/7 enabled" summary shown on
// collapsed module/submodule rows so you can tell at a glance which branch
// has restrictions without expanding it.
const countSubtreeAccess = (node, pathParts, isPathEnabled, treeState) => {
  const children = node?.children || [];
  if (!children.length) {
    const key = buildPathKey(pathParts);
    const enabled = isPathEnabled ? isPathEnabled(pathParts) : Boolean(treeState[key]);
    return { total: 1, enabled: enabled ? 1 : 0 };
  }
  return children.reduce(
    (acc, child) => {
      const childResult = countSubtreeAccess(
        child,
        [...pathParts, child.name],
        isPathEnabled,
        treeState,
      );
      return { total: acc.total + childResult.total, enabled: acc.enabled + childResult.enabled };
    },
    { total: 0, enabled: 0 },
  );
};

// A "category" in the modal is a top-level section from the workspace's own
// module tree. Summarising its leaves lets the category card show a real
// enabled count and drive its master switch without flattening away nested
// sub-permissions.
const getGroupAccessSummary = (group, treeNodes, isPathEnabled, treeState) => {
  const children = Array.isArray(group?.children) ? group.children : [];
  return children.reduce(
    (acc, module) => {
      const pathParts = [String(module?.sectionName || group?.name || "").trim(), module.name];
      const node = findNodeByPath(treeNodes, pathParts);
      if (!node) return acc;
      const summary = countSubtreeAccess(node, pathParts, isPathEnabled, treeState);
      return {
        total: acc.total + summary.total,
        enabled: acc.enabled + summary.enabled,
      };
    },
    { total: 0, enabled: 0 },
  );
};

// Same switch language as the HostPanel access dialog: 44x24 track, white knob.
const ToggleSwitch = ({ checked, disabled = false, onChange, label = "Toggle" }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onChange?.(!checked);
    }}
    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
      checked ? "bg-[#2563EB]" : "bg-slate-300"
    } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
        checked ? "left-[22px]" : "left-0.5"
      }`}
    />
  </button>
);

const TreeNodeCard = ({
  node,
  parentLabel,
  pathParts,
  level,
  treeState,
  onToggle,
  isPathLocked,
  isPathEnabled,
  isWorkspaceMode,
  isFounderReadOnly,
}) => {
  const key = buildPathKey(pathParts);
  const isEnabled = isPathEnabled ? isPathEnabled(pathParts) : Boolean(treeState[key]);
  const isLocked = isPathLocked(pathParts);
  const hasChildren = (node.children || []).length > 0;
  // Top-level modules start expanded so you immediately see what exists;
  // submodules/tabs start collapsed so the tree doesn't dump everything on
  // screen at once — expand only where you actually need to drill in.
  const [isOpen, setIsOpen] = useState(level < 1);

  const summary = hasChildren
    ? countSubtreeAccess(node, pathParts, isPathEnabled, treeState)
    : null;

  const nameSizeClass =
    level === 0 ? "text-[13.5px] font-bold" : level === 1 ? "text-[12.5px] font-semibold" : "text-[12px] font-medium";
  const rowPadClass = level === 0 ? "py-2.5" : "py-1.5";

  const lockedTooltip = isWorkspaceMode
    ? undefined
    : isLocked
      ? "Not enabled at workspace level yet — enable it under Configure Workspace Module first."
      : isFounderReadOnly
        ? "Founders always get everything the workspace has enabled — adjust access at the workspace level instead."
        : undefined;

  const subtitle = node.sectionName || parentLabel || "";

  return (
    <div>
      <Tooltip
        title={isLocked || isFounderReadOnly ? lockedTooltip : ""}
        placement="top"
        arrow
        disableHoverListener={(!isLocked && !isFounderReadOnly) || isWorkspaceMode}
      >
        <div
          className={`border border-slate-100 bg-white transition-colors ${
            level === 0 ? "rounded-lg px-2.5 py-2" : "rounded-md px-2 py-1.5"
          } ${isLocked ? "opacity-60" : "hover:bg-slate-50/60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => hasChildren && setIsOpen((prev) => !prev)}
              className={`flex min-w-0 flex-1 items-start gap-1.5 text-left ${
                hasChildren ? "cursor-pointer" : "cursor-default"
              }`}
            >
              {hasChildren ? (
                <ExpandMoreIcon
                  sx={{
                    fontSize: 16,
                    color: "#94a3b8",
                    flexShrink: 0,
                    mt: "1px",
                    transform: isOpen ? "none" : "rotate(-90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
              ) : null}
              <span className="min-w-0">
                <span
                  className={`flex items-center gap-1 truncate font-pmedium ${
                    level === 0 ? "text-[12.5px]" : "text-[11.5px]"
                  } ${isLocked ? "text-slate-400" : "text-slate-700"}`}
                >
                  {node.name}
                  {isLocked ? (
                    <LockIcon sx={{ fontSize: 12, color: "#cbd5e1", flexShrink: 0 }} />
                  ) : null}
                </span>
                {subtitle ? (
                  <span className="block truncate text-[10px] font-pmedium text-slate-500">
                    {subtitle}
                  </span>
                ) : null}
              </span>
            </button>

            <div className="flex flex-shrink-0 items-center gap-1.5">
              {summary && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    summary.enabled === 0
                      ? "bg-slate-100 text-slate-400"
                      : summary.enabled === summary.total
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {summary.enabled}/{summary.total}
                </span>
              )}
              <ToggleSwitch
                checked={isEnabled}
                disabled={!isWorkspaceMode && (isLocked || isFounderReadOnly)}
                onChange={(next) => onToggle(pathParts, next)}
                label={`Toggle ${node.name}`}
              />
            </div>
          </div>
        </div>
      </Tooltip>

      {hasChildren && isOpen && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 pl-4">
          {node.children.map((child) => (
            <TreeNodeCard
              key={child.name}
              node={child}
              parentLabel={node.name}
              pathParts={[...pathParts, child.name]}
              level={level + 1}
              treeState={treeState}
              onToggle={onToggle}
              isPathLocked={isPathLocked}
              isPathEnabled={isPathEnabled}
              isWorkspaceMode={isWorkspaceMode}
              isFounderReadOnly={isFounderReadOnly}
            />
          ))}
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
  onToggleGroup,
  onClose,
  onSave,
  isSaving,
  isPathLocked,
  isPathEnabled,
  isWorkspaceMode,
  isFounderReadOnly,
  activePlanTier,
  onPlanButtonClick,
  verticalLabels,
  selectedVerticals,
  isEditingVerticals,
  onToggleVertical,
  onEditVerticals,
  onCancelVerticals,
  onSaveVerticals,
  isSavingVerticals,
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

  const modalInitials =
    (isWorkspaceMode ? workspace.workspaceName : employee?.name || "W")
      .charAt(0)
      .toUpperCase() || "W";
  const grantSummary = mainDropdownGroups.reduce(
    (totals, group) => {
      const summary = getGroupAccessSummary(
        group,
        moduleSections,
        isPathEnabled,
        treeState,
      );
      return {
        enabled: totals.enabled + summary.enabled,
        total: totals.total + summary.total,
        categories: totals.categories + (summary.total > 0 && summary.enabled === summary.total ? 1 : 0),
      };
    },
    { enabled: 0, total: 0, categories: 0 },
  );

  if (!workspace) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(2, 6, 23, 0.45)",
            backdropFilter: "blur(4px)",
          },
        },
      }}
    >
      <Box
        data-tour="module-access-editor-modal"
        className={`flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white font-sans text-[12px] text-[#0F172A] shadow-2xl ${
          isWorkspaceMode ? "max-w-4xl" : "max-w-2xl"
        }`}
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          outline: "none",
        }}
      >
        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-blue-50/40 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-pmedium text-white">
                {modalInitials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[15px] font-pmedium text-slate-900">
                    {isWorkspaceMode ? workspace.workspaceName : employee?.name || "Unnamed Employee"}
                  </h2>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-[2px] text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    {isWorkspaceMode ? "Workspace Modules" : "Employee Access"}
                  </span>
                  {!isWorkspaceMode && employee?.designation && (
                    <span className={`rounded-full border px-2 py-[2px] text-[10px] font-pmedium ${ROLE_PILL_CLASSES[getMemberRoleCategory(employee.designation)] || ROLE_PILL_CLASSES.Staff}`}>
                      {employee.designation}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                  {isWorkspaceMode ? (
                    <>
                      <span>Workspace baseline</span>
                      <span className="text-slate-300">&middot;</span>
                      <span>{workspace.workspaceName}</span>
                    </>
                  ) : (
                    <>
                      <span className="truncate">{employee?.email || "-"}</span>
                      <span className="text-slate-300">&middot;</span>
                      <span className={employee?.isActive ? "text-emerald-600" : "text-slate-500"}>
                        {employee?.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="text-slate-300">&middot;</span>
                      <span>{workspace.workspaceName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:text-slate-700"
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </button>
          </div>

          <div
            className={`grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden ${
              isWorkspaceMode ? "lg:grid-cols-[272px_1fr]" : ""
            }`}
          >
            {isWorkspaceMode && (
              <div className="overflow-y-auto border-b border-slate-100 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
              {/*{isWorkspaceMode && (
                <div data-tour="module-access-plan-tier" className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Plan Module Set
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["basic", "professional", "custom"].map((tier) => (
                      <Button
                        key={tier}
                        size="small"
                        variant={activePlanTier === tier ? "contained" : "outlined"}
                        onClick={() => onPlanButtonClick?.(tier)}
                        sx={{
                          textTransform: "none",
                          borderRadius: "10px",
                          fontWeight: 700,
                          minWidth: 0,
                          px: 1.5,
                          ...(activePlanTier === tier
                            ? { backgroundColor: "#0F172A", "&:hover": { backgroundColor: "#111827" } }
                            : {}),
                        }}
                      >
                        {PLAN_LABELS[tier]}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">
                    Applies that plan's module set to this workspace. Doesn't change the workspace's
                    actual assigned plan — only which modules are enabled.
                  </p>
                </div>
              )} */}

              {isWorkspaceMode && (
                <div data-tour="module-access-verticals-editor" className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Workspace Verticals
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Saved: {verticalLabels?.length ? verticalLabels.join(", ") : "None"}
                  </p>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {WORKSPACE_VERTICALS.map((label) => (
                      <FormControlLabel
                        key={label}
                        disabled={!isEditingVerticals}
                        control={
                          <Checkbox
                            size="small"
                            disabled={!isEditingVerticals}
                            checked={(selectedVerticals || []).includes(label)}
                            onChange={() => onToggleVertical?.(label)}
                          />
                        }
                        label={
                          <span
                            className={`text-xs ${isEditingVerticals ? "text-slate-700" : "text-slate-500"}`}
                          >
                            {label}
                          </span>
                        }
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">
                    {isEditingVerticals
                      ? "Ticking a vertical enables its modules. Already-granted modules stay enabled when one is unticked."
                      : "Read-only. Click Edit Verticals to change them."}
                  </p>
                  {isEditingVerticals ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        onClick={onCancelVerticals}
                        disabled={isSavingVerticals}
                        sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        fullWidth
                        onClick={onSaveVerticals}
                        disabled={isSavingVerticals}
                        sx={{
                          textTransform: "none",
                          borderRadius: "10px",
                          fontWeight: 700,
                          backgroundColor: "#0F172A",
                          "&:hover": { backgroundColor: "#111827" },
                        }}
                      >
                        {isSavingVerticals ? "Saving..." : "Save Verticals"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      className="!mt-2"
                      onClick={onEditVerticals}
                      sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}
                    >
                      Edit Verticals
                    </Button>
                  )}
                </div>
              )}

              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                    {mainDropdownGroups.length} Categories
                  </p>
                  <span className="text-[10px] font-pmedium uppercase tracking-wider text-slate-400">
                    {isWorkspaceMode ? "Workspace baseline" : "Individual grant"}
                  </span>
                </div>
                <div className="relative">
                  <SearchIcon
                    sx={{ fontSize: 16 }}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={treeSearch}
                    onChange={(event) => setTreeSearch(event.target.value)}
                    placeholder="Search modules, submodules, or tabs"
                    data-tour="module-access-tree-search"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div data-tour="module-access-tree" className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
                {mainDropdownGroups.map((group, index) => {
                  const summary = getGroupAccessSummary(
                    group,
                    moduleSections,
                    isPathEnabled,
                    treeState,
                  );
                  const allEnabled = summary.total > 0 && summary.enabled === summary.total;
                  const groupDisabled = !isWorkspaceMode || isFounderReadOnly;
                  return (
                    <div
                      key={group.name}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenGroups((prev) => ({
                                ...prev,
                                [group.name]: !prev[group.name],
                              }))
                            }
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-[11px] font-pmedium uppercase tracking-wider text-slate-600">
                              {group.name}
                            </p>
                          </button>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <span className="text-[10px] font-pmedium text-slate-400">
                            {summary.enabled}/{summary.total}
                          </span>
                          <Tooltip
                            title={
                              groupDisabled
                                ? "Available in workspace mode only."
                                : allEnabled
                                  ? "Turn this category off for every item"
                                  : "Turn this category on for every item"
                            }
                          >
                            <span>
                              <button
                                type="button"
                                disabled={groupDisabled}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleGroup?.(group, !allEnabled);
                                }}
                                className="text-[10px] font-pmedium uppercase tracking-wider text-[#2563eb] transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                {allEnabled ? "Deselect All" : "Select All"}
                              </button>
                            </span>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setOpenGroups((prev) => ({
                                ...prev,
                                [group.name]: !prev[group.name],
                              }))
                            }
                          >
                            {openGroups[group.name] ? (
                              <ExpandMoreIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                            ) : (
                              <ChevronRightIcon fontSize="small" sx={{ color: "#94a3b8" }} />
                            )}
                          </IconButton>
                        </div>
                      </div>

                      {openGroups[group.name] && (
                        <div className="space-y-2">
                          {(
                            // Department Accesses' items already arrive as
                            // department group nodes (HR Department, etc.) with
                            // their own nested children from the backend's
                            // canonical merge — no client-side re-bucketing
                            // needed, same rendering as any other section.
                            Array.isArray(group.children) ? group.children : []
                          ).map((module) => (
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
                              isFounderReadOnly={isFounderReadOnly}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!mainDropdownGroups.length && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
                    No access nodes match your search.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
            <p className="hidden text-[11px] leading-4 text-slate-500 sm:block">
              {isFounderReadOnly
                ? "Founders always get everything the workspace has enabled — adjust it under Configure Workspace Modules instead."
                : `${grantSummary.enabled} of ${grantSummary.total} modules enabled · ${grantSummary.categories} of ${mainDropdownGroups.length} categories fully on. Category switches apply to every item beneath them.`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                onClick={onClose}
                size="small"
                sx={{
                  textTransform: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  px: 2,
                  borderColor: "#e2e8f0",
                  color: "#475569",
                  "&:hover": { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                variant="contained"
                data-tour="module-access-save"
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />}
                disabled={isSaving || isFounderReadOnly}
                size="small"
                sx={{
                  borderRadius: "10px",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  px: 2,
                  backgroundColor: "#2563eb",
                  "&:hover": { backgroundColor: "#1d4ed8" },
                }}
              >
                {isSaving ? "Saving..." : isWorkspaceMode ? "Save Enabled Modules" : "Save Access"}
              </Button>
            </div>
          </div>
        </div>
      </Box>
    </Modal>
  );
};

// Custom workspace picker — the MUI select didn't match the rest of this
// screen, and the main workspace needs a visible "- Main" marker so staff
// don't pick a unit by mistake.
const WorkspaceSelect = ({ workspaces = [], value, mainWorkspaceId, onChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const selected =
    workspaces.find((workspace) => workspace.workspaceId === value) || workspaces[0] || null;
  const isMainWorkspace = (workspace) =>
    Boolean(workspace) && workspace.workspaceId === mainWorkspaceId;

  return (
    <>
      <button
        type="button"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-pbold text-white">
            {(selected?.workspaceName || "W").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
              Workspace
            </span>
            <span className="block truncate text-[13px] font-pmedium text-slate-900">
              {selected
                ? `${selected.workspaceName}${isMainWorkspace(selected) ? " - Main" : ""}`
                : "Select workspace"}
            </span>
          </span>
        </span>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            flexShrink: 0,
            color: "#94a3b8",
            transition: "transform 150ms ease",
            transform: anchorEl ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            mt: 1,
            width: anchorEl?.clientWidth ? Math.max(anchorEl.clientWidth, 280) : 280,
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 18px 36px rgba(15, 23, 42, 0.14)",
            overflow: "hidden",
            backgroundColor: "#fff",
          },
        }}
      >
        <div className="border-b border-slate-100 px-3 py-2 text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
          Switch workspace
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {workspaces.map((workspace) => {
            const active = workspace.workspaceId === value;
            return (
              <button
                key={workspace.workspaceId}
                type="button"
                onClick={() => {
                  onChange?.(workspace.workspaceId);
                  setAnchorEl(null);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
                  active ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0 truncate">
                  <span className={`font-pmedium ${active ? "text-slate-900" : "text-slate-600"}`}>
                    {workspace.workspaceName}
                  </span>
                  {isMainWorkspace(workspace) && (
                    <span className="text-slate-400"> - Main</span>
                  )}
                </span>
                {active && <CheckIcon sx={{ fontSize: 16, color: "#2563eb", flexShrink: 0 }} />}
              </button>
            );
          })}
          {!workspaces.length && (
            <div className="px-3 py-3 text-[12px] text-slate-500">No workspaces</div>
          )}
        </div>
      </Popover>
    </>
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
  const [treeSearch, setTreeSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [treeState, setTreeState] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVerticals, setSelectedVerticals] = useState([]);
  const [isEditingVerticals, setIsEditingVerticals] = useState(false);

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

  // `company` above (getCompanyMembers) prefers the HostCompany model once a
  // host is onboarded, which has no requestedPlan/upgradeStatus fields — so
  // it silently loses the pending-upgrade-request context for exactly the
  // companies staff are configuring modules for here. Fetch the
  // HostLeadCompany record directly instead (same source UpgradePlan.jsx
  // reads) so the "host requested X" banner below is reliable.
  const { data: hostLeadCompanies = [] } = useQuery({
    queryKey: ["host-lead-companies-for-module-access", resolvedCompanyId],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/host-companies");
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: Boolean(resolvedCompanyId),
  });

  const hostLeadCompany = useMemo(
    () => hostLeadCompanies.find((item) => String(item?.companyId || "").trim() === resolvedCompanyId) || null,
    [hostLeadCompanies, resolvedCompanyId],
  );

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
      const mapped = apiWorkspaces.map((workspace) => ({
        workspaceId: normalizeWorkspaceId(workspace.workspaceId),
        workspaceName: normalizeWorkspaceName(workspace.workspaceName),
        modules: workspace?.modules || [],
        enabledModuleIds: Array.isArray(workspace?.enabledModuleIds)
          ? workspace.enabledModuleIds
          : [],
        businessTypes: Array.isArray(workspace?.businessTypes)
          ? workspace.businessTypes
          : [],
        selectedPlan: String(workspace?.selectedPlan || "basic").trim().toLowerCase(),
      }));

      // The company's main workspace is the unsuffixed one (workspaceId ===
      // companyId) — same prefix convention the server uses to tell a parent
      // workspace from its units. It gets listed first so it's also the
      // default selection; fall back to the "Main Workspace" name.
      const companyKey = String(resolvedCompanyId || "").trim().toLowerCase();
      const rankWorkspace = (workspace) => {
        const id = String(workspace.workspaceId || "").trim().toLowerCase();
        if (companyKey && id === companyKey) return 0;
        if (String(workspace.workspaceName || "").trim().toLowerCase() === "main workspace") {
          return 1;
        }
        return 2;
      };

      return mapped.sort((a, b) => rankWorkspace(a) - rankWorkspace(b));
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: DEFAULT_WORKSPACE_NAME,
        modules: [],
        enabledModuleIds: [],
        businessTypes: [],
        selectedPlan: "basic",
      },
    ];
  }, [companyMemberPayload?.workspaces, resolvedCompanyId]);

  // Which workspace is the company's main one. Drives the "- Main" marker in
  // the workspace picker (see WorkspaceSelect).
  const mainWorkspaceId = useMemo(() => {
    if (!workspaces.length) return "";
    const companyKey = String(resolvedCompanyId || "").trim().toLowerCase();
    const byId = workspaces.find(
      (workspace) =>
        companyKey && String(workspace.workspaceId || "").trim().toLowerCase() === companyKey,
    );
    if (byId) return byId.workspaceId;
    const byName = workspaces.find(
      (workspace) => String(workspace.workspaceName || "").trim().toLowerCase() === "main workspace",
    );
    return (byName || workspaces[0]).workspaceId;
  }, [workspaces, resolvedCompanyId]);

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

  const activeVerticalLabels = useMemo(
    () => getWorkspaceVerticalLabels(selectedWorkspace?.businessTypes),
    [selectedWorkspace?.businessTypes],
  );

  const pendingRequestedPlan = useMemo(() => {
    const requested = String(hostLeadCompany?.requestedPlan || "").trim().toLowerCase();
    if (!requested) return "";
    const actualPlan = String(selectedWorkspace?.selectedPlan || "basic").trim().toLowerCase();
    return requested !== actualPlan ? requested : "";
  }, [hostLeadCompany?.requestedPlan, selectedWorkspace?.selectedPlan]);

  const activeModuleSections = useMemo(() => {
    const parsedModules = parseWorkspaceModules(selectedWorkspace?.modules);
    const fromWorkspace = normalizeModulesTree(parsedModules);
    if (!fromWorkspace.length) return [];
    // Basic has no department access, so the Tech Department group isn't
    // shown at all for Basic workspaces.
    if (String(selectedWorkspace?.selectedPlan || "basic").trim().toLowerCase() !== "basic") {
      return fromWorkspace;
    }
    return fromWorkspace.map((section) => ({
      ...section,
      children: (section.children || []).filter(
        (child) => child.moduleId !== "tech-department",
      ),
    }));
  }, [selectedWorkspace?.modules, selectedWorkspace?.selectedPlan]);

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

  const activeModulesCount = useMemo(
    () => collectEnabledModuleIds(activeModuleSections, workspaceEnabledPlanState).size,
    [activeModuleSections, workspaceEnabledPlanState],
  );

  const activePlanTier = useMemo(
    () => computeActivePlanTier(
      workspaceDraftEnabledIdSet,
      selectedWorkspace?.selectedPlan,
      selectedWorkspace?.businessTypes,
    ),
    [workspaceDraftEnabledIdSet, selectedWorkspace?.selectedPlan, selectedWorkspace?.businessTypes],
  );

  // Founders bypass per-member grants entirely in HostPanel (they always get
  // everything the workspace itself has enabled) — so toggling their
  // Employee Access off wouldn't actually restrict anything. Lock the
  // switches on instead of letting staff toggle something that has no real
  // effect.
  const isFounderReadOnly =
    !isWorkspaceMode &&
    String(selectedEmployee?.designation || "").trim().toLowerCase().includes("founder");

  const [pendingPlanTier, setPendingPlanTier] = useState(null);

  const applyPlanPreset = (tier) => {
    const targetIds = getPlanModuleIds(tier, selectedWorkspace?.businessTypes);
    setTreeState(buildStateFromEnabledKeys(activeModuleSections, targetIds));
  };

  const handlePlanButtonClick = (tier) => {
    const actualPlan = String(selectedWorkspace?.selectedPlan || "basic").trim().toLowerCase();
    if (tier === actualPlan) {
      applyPlanPreset(tier);
      return;
    }
    setPendingPlanTier(tier);
  };

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

  // Draft verticals follow the saved ones whenever the editor is closed —
  // including right after a successful save invalidates the workspaces query.
  useEffect(() => {
    if (!isModalOpen) {
      setSelectedVerticals(activeVerticalLabels);
      setIsEditingVerticals(false);
    }
  }, [isModalOpen, activeVerticalLabels]);

  const hasRealWorkspaces = useMemo(() => {
    return workspaces.some(
      (workspace) =>
        normalizeWorkspaceId(workspace.workspaceId) !== DEFAULT_WORKSPACE_ID ||
        normalizeWorkspaceName(workspace.workspaceName) !== DEFAULT_WORKSPACE_NAME,
    );
  }, [workspaces]);

  const filteredMembers = useMemo(() => {
    const workspaceId = normalizeWorkspaceId(selectedWorkspace?.workspaceId);

    return members.filter((member) => {
      const memberWorkspaces = getMemberWorkspaces(member, {
        allowFallback: !hasRealWorkspaces,
      });
      const inWorkspace = memberWorkspaces.some(
        (workspace) => normalizeWorkspaceId(workspace.workspaceId) === workspaceId,
      );
      return inWorkspace;
    });
  }, [hasRealWorkspaces, members, selectedWorkspace]);

  const tableRows = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    return filteredMembers
      .map((member) => ({
        ...member,
        searchText: [
          member?.name,
          member?.email,
          member?.designation,
          getMemberRoleCategory(member?.designation),
          getMemberStatus(member),
          ...getMemberWorkspaces(member, { allowFallback: !hasRealWorkspaces }).map(
            (workspace) => workspace.workspaceName,
          ),
        ]
          .filter(Boolean)
          .join(" "),
      }))
      .filter((member) => !query || member.searchText.toLowerCase().includes(query));
  }, [employeeSearch, filteredMembers, hasRealWorkspaces]);

  const openEmployeeAccess = useCallback((member) => {
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
    setTreeState(initialState);
    setTreeSearch("");
    setIsModalOpen(true);
  }, [activeModuleSections, hasRealWorkspaces, selectedWorkspace, workspaceEnabledPlanState]);

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
            collectEnabledModuleIds(activeModuleSections, treeState),
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

  const bulkAccountStatusMutation = useMutation({
    mutationFn: async ({ isDeleted }) => {
      const response = await axios.patch(
        `/api/host-user/workspace/${encodeURIComponent(selectedWorkspace?.workspaceId)}/bulk-account-status`,
        { isDeleted },
      );
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["host-company-members", resolvedCompanyId],
      });
      toast.success(data?.message || "Workspace account status updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update workspace account status.");
    },
  });

  const handleBulkAccountStatus = (isDeleted) => {
    const workspaceLabel = selectedWorkspace?.workspaceName || "this workspace";
    const confirmMessage = isDeleted
      ? `Delete ALL employee accounts in ${workspaceLabel}? Every employee will be logged out and marked deleted.`
      : `Reactivate ALL employee accounts in ${workspaceLabel}?`;
    if (window.confirm(confirmMessage)) {
      bulkAccountStatusMutation.mutate({ isDeleted });
    }
  };

  const toggleAccountStatusMutation = useMutation({
    mutationFn: async ({ memberId, isDeleted }) => {
      const response = await axios.patch(
        `/api/host-user/${memberId}/account-status`,
        { isDeleted },
      );
      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["host-company-members", resolvedCompanyId],
      });
      toast.success(data?.message || "Account status updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update account status.");
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

  const verticalsMutation = useMutation({
    mutationFn: async ({ verticals }) => {
      const response = await axios.patch(
        `/api/host-user/workspace/${selectedWorkspace?.workspaceId}/verticals`,
        { businessTypes: verticals },
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["host-company-members", resolvedCompanyId],
      });
      toast.success("Workspace verticals and features updated successfully.");
      setIsEditingVerticals(false);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update workspace verticals.");
    },
  });

  const toggleVertical = (label) => {
    setSelectedVerticals((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const startEditingVerticals = () => {
    setSelectedVerticals(activeVerticalLabels);
    setIsEditingVerticals(true);
  };

  const cancelEditingVerticals = () => {
    setSelectedVerticals(activeVerticalLabels);
    setIsEditingVerticals(false);
  };

  const handleToggle = (pathParts, checked) => {
    setTreeState((prev) => toggleTreeNode(activeModuleSections, prev, pathParts, checked));
  };

  const handleToggleGroup = (group, checked) => {
    setTreeState((prev) => {
      let next = prev;
      (Array.isArray(group?.children) ? group.children : []).forEach((module) => {
        const pathParts = [String(module?.sectionName || group?.name || "").trim(), module.name];
        next = toggleTreeNode(activeModuleSections, next, pathParts, checked);
      });
      return next;
    });
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
  return (
    <div className="min-h-full p-2 font-sans text-[12px] text-[#0F172A] lg:p-2.5">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-title font-pmedium uppercase text-primary">Module Access</h1>
            <p className="mt-1 text-xs font-pmedium text-slate-500">
              Select a workspace, manage verticals, and configure platform module access from the
              same panel.
            </p>
          </div>

          <div
            data-tour="module-access-stats"
            className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <div className="flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                  Current Plan
                </p>
                <p className="truncate text-[15px] font-pbold capitalize text-slate-900">
                  {normalizedPlan}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 border-l-blue-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-blue-600">
                  Workspaces
                </p>
                <p className="text-[15px] font-pbold text-slate-900">{workspaces.length}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 border-l-emerald-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-emerald-600">
                  Total Employees
                </p>
                <p className="text-[15px] font-pbold text-slate-900">{filteredMembers.length}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 border-l-indigo-500 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-pmedium uppercase tracking-widest text-indigo-600">
                  Active Modules
                </p>
                <p className="text-[15px] font-pbold text-slate-900">{activeModulesCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div data-tour="module-access-workspace-select" className="w-full lg:w-[300px] lg:shrink-0">
                <WorkspaceSelect
                  workspaces={workspaces}
                  value={selectedWorkspace?.workspaceId || ""}
                  mainWorkspaceId={mainWorkspaceId}
                  onChange={(workspaceId) => {
                    setSelectedWorkspaceId(workspaceId);
                    setSelectedEmployee(null);
                    setIsModalOpen(false);
                    setTreeState(workspaceEnabledPlanState);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto">
                <Button
                  variant="contained"
                  data-tour="module-access-configure-modules"
                  onClick={() => {
                    setIsWorkspaceMode(true);
                    setSelectedEmployee(null);
                    setSelectedVerticals(activeVerticalLabels);
                    setTreeState(workspaceEnabledPlanState);
                    setIsModalOpen(true);
                  }}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    px: 2,
                    backgroundColor: "#2563eb",
                    "&:hover": { backgroundColor: "#1d4ed8" },
                  }}
                >
                  Configure Workspace Modules
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  data-tour="module-access-reactivate-all"
                  onClick={() => handleBulkAccountStatus(false)}
                  disabled={bulkAccountStatusMutation.isPending || !hasRealWorkspaces}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    px: 2,
                  }}
                >
                  Reactivate All Employees
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  data-tour="module-access-delete-all"
                  onClick={() => handleBulkAccountStatus(true)}
                  disabled={bulkAccountStatusMutation.isPending || !hasRealWorkspaces}
                  sx={{
                    textTransform: "none",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    px: 2,
                  }}
                >
                  Delete All Employees
                </Button>
              </div>
            </div>
          </div>

          <div
            data-tour="module-access-employee-table"
            className="flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white/80 shadow-sm"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 xl:flex-row xl:items-center xl:justify-between">
              {/* <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                Employee List
              </p> */}
              <div className="relative w-full xl:w-[320px]">
                <SearchIcon
                  sx={{ fontSize: 16 }}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Search name, role, email..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <CircularProgress size={22} sx={{ color: "#2563eb" }} />
              </div>
            ) : tableRows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-slate-400">
                <SearchIcon sx={{ fontSize: 28 }} />
                <p className="mt-3 font-pmedium">
                  {employeeSearch.trim()
                    ? "No matching employees found."
                    : "No employees in this workspace yet."}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full table-fixed text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="w-[30%] px-3 py-4 text-left">Employee</th>
                      <th className="w-[16%] px-3 py-4 text-left">Role</th>
                      <th className="w-[20%] px-3 py-4 text-left">Access Level</th>
                      <th className="w-[16%] px-3 py-4 text-left">Status</th>
                      <th className="w-[18%] px-3 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((member) => {
                      const isFounder =
                        getMemberRoleCategory(member.designation) === "Founder";
                      const initials =
                        (member.name || member.email || "?")
                          .split(/[\s@._-]+/)
                          .filter(Boolean)
                          .map((part) => part.charAt(0))
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "?";
                      const accessCount = getMemberAccessCount(
                        member,
                        selectedWorkspace?.workspaceId,
                        !hasRealWorkspaces,
                      );
                      const status = getMemberStatus(member);
                      return (
                        <tr key={member._id} className="transition hover:bg-slate-50/60">
                          <td className="px-3 py-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[9px] font-pmedium text-white">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="truncate whitespace-nowrap font-pmedium text-slate-900"
                                  title={member.name || "-"}
                                >
                                  {member.name || "-"}
                                </p>
                                <p
                                  className="truncate text-[10px] text-slate-400"
                                  title={member.email || "-"}
                                >
                                  {member.email || "-"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            className="truncate px-3 py-4 font-pmedium text-slate-700"
                            title={member.designation || "-"}
                          >
                            {String(member.designation || "").trim() || "-"}
                          </td>
                          <td className="px-3 py-4">
                            {isFounder ? (
                              <span className={`${STATUS_PILL_BASE} gap-1 bg-emerald-50 text-emerald-700`}>
                                <SecurityIcon sx={{ fontSize: 12 }} />
                                Full Access
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] font-semibold ${
                                  accessCount ? "text-slate-700" : "text-slate-400"
                                }`}
                              >
                                {accessCount} Modules Enabled
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <span className={statusPillClass(status)}>{status}</span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <Tooltip
                                title={
                                  isFounder
                                    ? "Founder has full access to all workspace features"
                                    : "Configure module access"
                                }
                              >
                                <span
                                  data-tour="module-access-open-employee"
                                  className="inline-flex"
                                >
                                  <button
                                    type="button"
                                    disabled={isFounder}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEmployeeAccess(member);
                                    }}
                                    aria-label={`Configure module access for ${member.name || "employee"}`}
                                    title="Configure module access"
                                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
                                  >
                                    <SecurityIcon sx={{ fontSize: 14 }} />
                                  </button>
                                </span>
                              </Tooltip>
                              <span
                                data-tour="module-access-row-menu"
                                className="inline-flex"
                              >
                                <ThreeDotMenu
                                  rowId={member._id}
                                  menuItems={[
                                    member.isDeleted
                                      ? {
                                          label: "Reactivate",
                                          onClick: () =>
                                            toggleAccountStatusMutation.mutate({
                                              memberId: member._id,
                                              isDeleted: false,
                                            }),
                                        }
                                      : {
                                          label: "Delete Account",
                                          onClick: () =>
                                            toggleAccountStatusMutation.mutate({
                                              memberId: member._id,
                                              isDeleted: true,
                                            }),
                                        },
                                  ]}
                                />
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>

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
        onToggleGroup={handleToggleGroup}
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
        isFounderReadOnly={isFounderReadOnly}
        activePlanTier={activePlanTier}
        onPlanButtonClick={handlePlanButtonClick}
        verticalLabels={activeVerticalLabels}
        selectedVerticals={selectedVerticals}
        isEditingVerticals={isEditingVerticals}
        onToggleVertical={toggleVertical}
        onEditVerticals={startEditingVerticals}
        onCancelVerticals={cancelEditingVerticals}
        onSaveVerticals={() => verticalsMutation.mutate({ verticals: selectedVerticals })}
        isSavingVerticals={verticalsMutation.isPending}
      />

      {pendingPlanTier && (
        <Modal open onClose={() => setPendingPlanTier(null)}>
          <Box
            className="w-[min(420px,90vw)] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.18)]"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {pendingRequestedPlan === pendingPlanTier ? (
              <>
                <p className="text-base font-semibold text-slate-900">
                  Host requested {PLAN_LABELS[pendingPlanTier]}.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Apply {PLAN_LABELS[pendingPlanTier]}'s modules to this workspace now? This won't
                  change the workspace's actual assigned plan — that's set separately from the
                  Upgrade Plan page once payment is confirmed.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-slate-900">
                  This workspace has a {PLAN_LABELS[String(selectedWorkspace?.selectedPlan || "basic").trim().toLowerCase()] || "Basic"} plan.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Do you still want to give it {PLAN_LABELS[pendingPlanTier]} modules? This won't change
                  the workspace's actual assigned plan — only which modules are enabled here.
                </p>
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => setPendingPlanTier(null)}
                sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700 }}
              >
                No
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  applyPlanPreset(pendingPlanTier);
                  setPendingPlanTier(null);
                }}
                sx={{
                  textTransform: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  backgroundColor: "#0F172A",
                  "&:hover": { backgroundColor: "#111827" },
                }}
              >
                Yes
              </Button>
            </div>
          </Box>
        </Modal>
      )}
    </div>
  );
};

export default ModuleAccess;
