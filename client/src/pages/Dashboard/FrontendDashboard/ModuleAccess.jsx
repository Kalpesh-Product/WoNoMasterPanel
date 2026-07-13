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
  Tooltip,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import FolderIcon from "@mui/icons-material/Folder";
import DescriptionIcon from "@mui/icons-material/Description";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";

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
  "visitors-management",
  "visitors_manage_internal_visitors",
  "visitors_tab_daily",
  "visitors_tab_history",
  "visitors_mode_standard",
  "visitors_standard_type_standard",
  "wono-nomad",
  "website-builder",
  "tech-website-builder",
  "website-leads",
  "organization-management",
  "org_tab_users",
  "org_tab_departments",
  "org_users_invite_member",
  "org_users_change_role",
  "org_users_toggle_access",
  "org_departments_create",
  "org_departments_edit",
  "org_departments_assign_manager",
  "org_departments_assign_acting_manager",
  "org_departments_remove_acting_manager",
  "access-grants",
];

const PROFESSIONAL_PLAN_MODULE_IDS = [
  ...BASIC_PLAN_MODULE_IDS,
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
  "calendar",
  "workspace-settings",
  "workspace-management",
  "tenant-companies-admin",
  "bookings",
  "resource-management",
  "leads-management",
  "tenant-companies-sales",
  "resource-pricing",
  "sales-architecture",
];

const PLAN_MODULE_ID_SETS = {
  basic: new Set(BASIC_PLAN_MODULE_IDS),
  professional: new Set(PROFESSIONAL_PLAN_MODULE_IDS),
  // Custom's baseline is identical to Professional's — see comment above.
  custom: new Set(PROFESSIONAL_PLAN_MODULE_IDS),
};

const PLAN_LABELS = { basic: "Basic", professional: "Professional", custom: "Custom" };

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

const computeActivePlanTier = (enabledIdSet, selectedPlan) => {
  const meaningfulIds = Array.from(enabledIdSet).filter(
    (id) => !DEPARTMENT_GROUP_CONTAINER_IDS.has(id),
  );
  const meaningfulIdSet = new Set(meaningfulIds);
  const isExactMatch = (ids) =>
    ids.length === meaningfulIds.length && ids.every((id) => meaningfulIdSet.has(id));
  if (isExactMatch(BASIC_PLAN_MODULE_IDS)) return "basic";
  if (isExactMatch(PROFESSIONAL_PLAN_MODULE_IDS)) {
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

const TreeNodeCard = ({
  node,
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

  return (
    <div>
      <Tooltip
        title={isLocked || isFounderReadOnly ? lockedTooltip : ""}
        placement="top"
        arrow
        disableHoverListener={(!isLocked && !isFounderReadOnly) || isWorkspaceMode}
      >
        <div
          className={`flex items-center justify-between gap-3 rounded-lg pr-2 ${rowPadClass} transition-colors ${
            isLocked ? "opacity-50" : "hover:bg-slate-50"
          } ${level === 0 ? "bg-slate-50/60" : ""}`}
          style={{ marginLeft: level * 20, paddingLeft: 8 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && setIsOpen((prev) => !prev)}
            className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${hasChildren ? "cursor-pointer" : "cursor-default"}`}
          >
            {hasChildren ? (
              isOpen ? (
                <ExpandMoreIcon sx={{ fontSize: 18, color: "#94a3b8", flexShrink: 0 }} />
              ) : (
                <ChevronRightIcon sx={{ fontSize: 18, color: "#94a3b8", flexShrink: 0 }} />
              )
            ) : (
              <span className="ml-[3px] mr-[3px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
            )}
            {hasChildren ? (
              <FolderIcon sx={{ fontSize: 15, color: isLocked ? "#cbd5e1" : "#64748b", flexShrink: 0 }} />
            ) : (
              <DescriptionIcon sx={{ fontSize: 14, color: isLocked ? "#cbd5e1" : "#94a3b8", flexShrink: 0 }} />
            )}
            <span className={`truncate ${nameSizeClass} ${isLocked ? "text-slate-400" : "text-slate-800"}`}>
              {node.name}
            </span>
            {summary && (
              <span
                className={`ml-1 flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
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
            {isLocked ? (
              <LockIcon sx={{ fontSize: 13, color: "#cbd5e1", flexShrink: 0 }} />
            ) : !hasChildren ? (
              <LockOpenIcon sx={{ fontSize: 12, color: "#d1fae5", flexShrink: 0 }} />
            ) : null}
          </button>

          <FormControlLabel
            sx={{ m: 0 }}
            onClick={(event) => event.stopPropagation()}
            control={
              <Switch
                size="small"
                checked={isEnabled}
                disabled={!isWorkspaceMode && (isLocked || isFounderReadOnly)}
                onChange={(event) => onToggle(pathParts, event.target.checked)}
              />
            }
            label=""
          />
        </div>
      </Tooltip>

      {hasChildren && isOpen && (
        <div className="ml-2 flex flex-col border-l border-dashed border-slate-200 pl-1.5">
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
  onClose,
  onSave,
  isSaving,
  isPathLocked,
  isPathEnabled,
  isWorkspaceMode,
  isFounderReadOnly,
  activePlanTier,
  onPlanButtonClick,
  pendingRequestedPlan,
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

              {isWorkspaceMode && pendingRequestedPlan && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    Host requested {PLAN_LABELS[pendingRequestedPlan] || pendingRequestedPlan}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-amber-700">
                    Not yet applied here. Click {PLAN_LABELS[pendingRequestedPlan] || pendingRequestedPlan} below to give this workspace those modules.
                  </p>
                </div>
              )}

              {isWorkspaceMode && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
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
              )}

              <TextField
                value={treeSearch}
                onChange={(event) => setTreeSearch(event.target.value)}
                fullWidth
                size="small"
                placeholder="Search access nodes"
                className="!mt-3"
              />

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {isFounderReadOnly
                  ? "Founders always get everything this workspace has enabled — access can't be individually restricted here. Adjust it under Configure Workspace Modules instead."
                  : "Toggle modules, submodules, and nested tabs from this workspace-specific view."}
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
                  disabled={isSaving || isFounderReadOnly}
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
      return apiWorkspaces.map((workspace) => ({
        workspaceId: normalizeWorkspaceId(workspace.workspaceId),
        workspaceName: normalizeWorkspaceName(workspace.workspaceName),
        modules: workspace?.modules || [],
        enabledModuleIds: Array.isArray(workspace?.enabledModuleIds)
          ? workspace.enabledModuleIds
          : [],
        selectedPlan: String(workspace?.selectedPlan || "basic").trim().toLowerCase(),
      }));
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: DEFAULT_WORKSPACE_NAME,
        modules: [],
        enabledModuleIds: [],
        selectedPlan: "basic",
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

  const pendingRequestedPlan = useMemo(() => {
    const requested = String(hostLeadCompany?.requestedPlan || "").trim().toLowerCase();
    if (!requested) return "";
    const actualPlan = String(selectedWorkspace?.selectedPlan || "basic").trim().toLowerCase();
    return requested !== actualPlan ? requested : "";
  }, [hostLeadCompany?.requestedPlan, selectedWorkspace?.selectedPlan]);

  const activeModuleSections = useMemo(() => {
    const parsedModules = parseWorkspaceModules(selectedWorkspace?.modules);
    const fromWorkspace = normalizeModulesTree(parsedModules);
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

  const activePlanTier = useMemo(
    () => computeActivePlanTier(workspaceDraftEnabledIdSet, selectedWorkspace?.selectedPlan),
    [workspaceDraftEnabledIdSet, selectedWorkspace?.selectedPlan],
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
    const targetIds = Array.from(PLAN_MODULE_ID_SETS[tier] || []);
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
    setTreeState(initialState);
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
        isFounderReadOnly={isFounderReadOnly}
        activePlanTier={activePlanTier}
        onPlanButtonClick={handlePlanButtonClick}
        pendingRequestedPlan={pendingRequestedPlan}
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
