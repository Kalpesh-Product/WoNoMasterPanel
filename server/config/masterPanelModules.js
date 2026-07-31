// Catalog of Master Panel sidebar submenus that a superadmin can grant/revoke
// per AdminUser via /api/admin-access. Keys here MUST stay in sync with the
// `key` on each submenu in client/src/components/Sidebar.jsx.
const masterPanelModules = [
  {
    key: "dashboard",
    label: "Dashboard",
    submenus: [
      { key: "dashboard.companies", label: "Companies" },
      { key: "dashboard.all-leads", label: "All Leads" },
      { key: "dashboard.value-adds-leads", label: "Value Adds Leads" },
      { key: "dashboard.data-upload", label: "Data Upload" },
      { key: "dashboard.publish-listings", label: "Publish Listings" },
      { key: "dashboard.profile", label: "Profile" },
      { key: "dashboard.logs", label: "Logs" },
      { key: "dashboard.reviews", label: "Reviews" },
      { key: "dashboard.destinations-data", label: "Destinations Data" },
      { key: "dashboard.world-ranking-weights", label: "World Ranking Weights" },
      { key: "dashboard.visa-countries", label: "Visa Countries" },
      { key: "dashboard.add-master-user", label: "Add Master User" },
    ],
  },
  {
    key: "hostpanel",
    label: "Host Panel",
    submenus: [
      { key: "hostpanel.companies", label: "Companies" },
      { key: "hostpanel.support-tickets", label: "Support Tickets" },
      { key: "hostpanel.signup-leads", label: "Signup Leads" },
      { key: "hostpanel.website-credits", label: "Website Credits" },
      { key: "hostpanel.host-companies", label: "Host Companies" },
      { key: "hostpanel.module-access-logs", label: "Module Access Logs" },
      { key: "hostpanel.host-panel-logs", label: "Host Panel Logs" },
    ],
  },
];

const allModuleKeys = masterPanelModules.flatMap((m) =>
  m.submenus.map((s) => s.key)
);

module.exports = { masterPanelModules, allModuleKeys };
