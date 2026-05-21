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
      { name: "Organization Management", children: [] },
      { name: "Access Grants", children: [] },
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
          { name: "Ticket Reports", children: [] },
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
          { name: "Manage Meetings", children: [] },
          { name: "Meeting Reviews", children: [] },
        ],
      },
      {
        name: "Visitor Management",
        children: [
          { name: "Standard Visitor", children: [] },
          { name: "Workspace Tour", children: [] },
          { name: "Walk-In Booking", children: [] },
          { name: "Verify Booking ID", children: [] },
          { name: "Daily Visitors", children: [] },
          { name: "Bookings", children: [] },
          { name: "Clients", children: [] },
          { name: "Visitor History", children: [] },
        ],
      },
      {
        name: "Assets",
        children: [
          { name: "Asset List", children: [] },
          { name: "Categories", children: [] },
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

const buildPathKey = (pathParts) => pathParts.join("::");

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
      },
    ];
  }

  return access.map((workspace) => ({
    workspaceId: normalizeWorkspaceId(workspace?.workspaceId),
    workspaceName: normalizeWorkspaceName(workspace?.workspaceName),
    moduleAccess: workspace?.moduleAccess || {},
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

const TreeNodeCard = ({ node, pathParts, level, treeState, onToggle }) => {
  const key = buildPathKey(pathParts);
  const isEnabled = Boolean(treeState[key]);
  const hasChildren = (node.children || []).length > 0;

  return (
    <div
      className={`rounded-2xl border ${
        level === 0
          ? "border-slate-200 bg-slate-50/80"
          : "border-slate-100 bg-white"
      } p-4`}
      style={{ marginLeft: level * 16 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-slate-500 shadow-sm">
            {getNodeKind(level)}
          </div>
          <h3 className="mt-3 text-base font-pmedium text-slate-900">{node.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasChildren
              ? `${node.children.length} child ${node.children.length === 1 ? "node" : "nodes"}`
              : "Leaf access item"}
          </p>
        </div>

        <FormControlLabel
          sx={{ mr: 0 }}
          control={
            <Switch
              checked={isEnabled}
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
  treeState,
  treeSearch,
  setTreeSearch,
  onToggle,
  onClose,
  onSave,
  isSaving,
}) => {
  const filteredSections = useMemo(() => {
    const query = treeSearch.trim().toLowerCase();
    return filterTree(MODULE_SECTIONS, query);
  }, [treeSearch]);

  if (!employee || !workspace) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        className="max-h-[90vh] w-[min(1200px,96vw)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                Employee Access
              </p>
              <h2 className="mt-2 text-2xl font-pmedium text-slate-900">
                {employee.name || "Unnamed Employee"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Workspace: <span className="font-semibold text-slate-700">{workspace.workspaceName}</span>
              </p>
            </div>
            <IconButton onClick={onClose} size="small">
              <CloseIcon fontSize="small" sx={{ color: "#64748b" }} />
            </IconButton>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[360px_1fr]">
            <div className="border-b border-slate-100 bg-slate-50/80 p-6 lg:border-b-0 lg:border-r">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    {(employee.name || "E").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{employee.name || "Employee"}</p>
                    <p className="text-xs text-slate-500">{employee.designation || "Role not set"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Email</span>
                    <span className="font-medium text-slate-900">{employee.email || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <span className="font-medium text-slate-900">
                      {employee.isActive ? "Active" : "Inactive"}
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
                className="!mt-4"
              />

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Toggle modules, submodules, and nested tabs from this workspace-specific view.
              </p>
            </div>

            <div className="flex max-h-[90vh] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip label={workspace.workspaceName} size="small" />
                  <Chip
                    label={`${MODULE_SECTIONS.length} Groups`}
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
                  {isSaving ? "Saving..." : "Save Access"}
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {filteredSections.map((section) => (
                  <div
                    key={section.name}
                    className="mb-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
                  >
                    <div className={`h-2 bg-gradient-to-r ${section.accent}`} />
                    <div className="p-5">
                      <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                            Section
                          </p>
                          <h3 className="mt-1 text-xl font-pmedium text-slate-900">
                            {section.name}
                          </h3>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {section.children.length} modules
                        </span>
                      </div>

                      <div className="flex flex-col gap-4">
                        {section.children.map((module) => (
                          <TreeNodeCard
                            key={module.name}
                            node={module}
                            pathParts={[section.name, module.name]}
                            level={0}
                            treeState={treeState}
                            onToggle={onToggle}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredSections.length && (
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

    return String(companySlug || "").trim();
  }, [companySlug, location.state]);
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
  const [treeState, setTreeState] = useState(() => initializeTreeState(MODULE_SECTIONS));
  const [isModalOpen, setIsModalOpen] = useState(false);

  const pageTitle = useMemo(() => {
    if (companyName) return companyName;
    return String(companySlug || "Host Company").replace(/-/g, " ");
  }, [companyName, companySlug]);

  const normalizedPlan = useMemo(() => {
    const rawPlan = String(selectedPlan || "").trim();
    if (!rawPlan) return "Not Assigned";
    return rawPlan
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }, [selectedPlan]);

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
  const members = Array.isArray(companyMemberPayload?.members)
    ? companyMemberPayload.members
    : [];

  const workspaces = useMemo(() => {
    const apiWorkspaces = Array.isArray(companyMemberPayload?.workspaces)
      ? companyMemberPayload.workspaces
      : [];

    if (apiWorkspaces.length) {
      return apiWorkspaces.map((workspace) => ({
        workspaceId: normalizeWorkspaceId(workspace.workspaceId),
        workspaceName: normalizeWorkspaceName(workspace.workspaceName),
      }));
    }

    return [
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        workspaceName: DEFAULT_WORKSPACE_NAME,
      },
    ];
  }, [companyMemberPayload?.workspaces]);

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length) {
      setSelectedWorkspaceId(workspaces[0].workspaceId);
    }
  }, [selectedWorkspaceId, workspaces]);

  useEffect(() => {
    if (!workspaces.length) return;

    const exists = workspaces.some(
      (workspace) => normalizeWorkspaceId(workspace.workspaceId) === normalizeWorkspaceId(selectedWorkspaceId),
    );

    if (!exists) {
      setSelectedWorkspaceId(workspaces[0].workspaceId);
      setSelectedEmployee(null);
      setIsModalOpen(false);
      setTreeState(initializeTreeState(MODULE_SECTIONS));
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

    setSelectedEmployee({
      ...member,
      workspaceName: workspaceAccess.workspaceName,
      workspaceId: workspaceAccess.workspaceId,
      moduleAccess: workspaceAccess.moduleAccess || {},
    });
    setTreeState(
      hasSavedWorkspaceAccess
        ? workspaceAccess.moduleAccess
        : initializeTreeState(MODULE_SECTIONS),
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
          moduleAccess: treeState,
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

  const handleToggle = (pathParts, checked) => {
    setTreeState((prev) => toggleTreeNode(MODULE_SECTIONS, prev, pathParts, checked));
  };

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
                setTreeState(initializeTreeState(MODULE_SECTIONS));
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

              <TextField
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                fullWidth
                placeholder="Search employee, role, or email"
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" className="mr-2 text-slate-400" />,
                }}
              />

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
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
        </div>
      </div>

      <AccessEditorModal
        open={isModalOpen}
        employee={selectedEmployee}
        workspace={selectedWorkspace}
        treeState={treeState}
        treeSearch={treeSearch}
        setTreeSearch={setTreeSearch}
        onToggle={handleToggle}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSave={() => saveMutation.mutate()}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
};

export default ModuleAccess;
