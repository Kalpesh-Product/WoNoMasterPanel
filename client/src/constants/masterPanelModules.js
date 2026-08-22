// Single source of truth for Master Panel modules.
// Consumed by the Sidebar (client/src/components/Sidebar.jsx) and the
// module-wise dashboard (client/src/pages/Dashboard/MainDashboard/MainDashboard.jsx).
//
// NOTE: submenu `key`s must stay in sync with server/config/masterPanelModules.js.

import {
  LuLayoutDashboard,
  LuBuilding2,
  LuUsers,
  LuUserPlus,
  LuGlobe,
  LuUpload,
  LuUser,
  LuFileText,
  LuMessageSquareText,
  LuNewspaper,
  LuChartLine,
  LuPlane,
  LuShieldCheck,
  LuTicket,
  LuUserRound,
  LuPanelLeft,
  LuServer,
  LuLayoutTemplate,
  LuHandshake,
  LuMousePointerClick,
} from "react-icons/lu";

export const MASTER_PANEL_MODULES = [
  {
    id: 1,
    key: "dashboard",
    icon: LuPanelLeft,
    title: "Master Panel",
    route: "/dashboard",
    categories: [
      {
        id: "dashboard-leads-management",
        title: "Leads Management",
        submenus: [
          {
            id: 3,
            key: "dashboard.all-leads",
            title: "All Leads",
            icon: LuUsers,
            route: "/dashboard/all-leads",
          },
          {
            id: 4,
            key: "dashboard.value-adds-leads",
            title: "Value Adds Leads",
            icon: LuUsers,
            route: "/dashboard/value-adds-leads",
          },
          {
            id: 25,
            key: "dashboard.nomad-signup-leads",
            title: "Nomad Signup Leads",
            icon: LuUserRound,
            route: "/dashboard/nomad-signup-leads",
          },
        ],
      },
      {
        id: "dashboard-company-management",
        title: "Company Management",
        submenus: [
          {
            id: 2,
            key: "dashboard.companies",
            title: "Companies",
            icon: LuBuilding2,
            route: "/dashboard/companies",
          },
          {
            id: 24,
            key: "dashboard.publish-listings",
            title: "Publish Listings",
            icon: LuGlobe,
            route: "/dashboard/publish-listings",
          },
          {
            id: 14,
            key: "dashboard.reviews",
            title: "Reviews",
            icon: LuMessageSquareText,
            route: "/dashboard/company-reviews",
          },
          {
            id: 26,
            key: "dashboard.value-adds-partners",
            title: "Value Adds Partners",
            icon: LuHandshake,
            route: "/dashboard/value-adds-partners",
          },
        ],
      },
      {
        id: "dashboard-data-management",
        title: "Data Management",
        submenus: [
          {
            id: 11,
            key: "dashboard.data-upload",
            title: "Data Upload",
            icon: LuUpload,
            route: "/dashboard/data-upload",
          },
          {
            id: 15,
            key: "dashboard.destinations-data",
            title: "Destinations Data",
            icon: LuNewspaper,
            route: "/dashboard/destinations-data",
          },
          {
            id: 16,
            key: "dashboard.world-ranking-weights",
            title: "World Ranking Weights",
            icon: LuChartLine,
            route: "/dashboard/world-ranking-weights",
          },
          {
            id: 17,
            key: "dashboard.visa-countries",
            title: "Visa Countries",
            icon: LuPlane,
            route: "/dashboard/visa-countries",
          },
          {
            id: 27,
            key: "dashboard.nomad-click-analytics",
            title: "Nomad Click Analytics",
            icon: LuMousePointerClick,
            route: "/dashboard/nomad-click-analytics",
          },
        ],
      },
      {
        id: "dashboard-user-management",
        title: "User Management",
        submenus: [
          {
            id: 23,
            key: "dashboard.add-master-user",
            title: "Add Master User",
            icon: LuUserPlus,
            route: "/dashboard/add-master-user",
          },
          {
            id: 22,
            key: "dashboard.user-access",
            title: "User Access",
            icon: LuShieldCheck,
            route: "/dashboard/master-panel-users",
            superAdminOnly: true,
          },
          {
            id: 12,
            key: "dashboard.profile",
            title: "Profile",
            icon: LuUser,
            route: "/dashboard/profile/my-profile",
          },
        ],
      },
      {
        id: "dashboard-system-management",
        title: "System Management",
        submenus: [
          {
            id: 13,
            key: "dashboard.logs",
            title: "Logs",
            icon: LuFileText,
            route: "/dashboard/logs-layout",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    key: "hostpanel",
    icon: LuServer,
    title: "Host Panel",
    route: "/dashboard",
    categories: [
      {
        id: "hostpanel-company-management",
        title: "Company Management",
        submenus: [
          {
            id: 2,
            key: "hostpanel.companies",
            title: "Companies",
            icon: LuBuilding2,
            route: "/dashboard/companies",
          },
          {
            id: 6,
            key: "hostpanel.host-companies",
            title: "Host Companies",
            icon: LuBuilding2,
            route: "/dashboard/host-companies",
          },
        ],
      },
      {
        id: "hostpanel-support-leads",
        title: "Support & Leads",
        submenus: [
          {
            id: 8,
            key: "hostpanel.support-tickets",
            title: "Support Tickets",
            icon: LuTicket,
            route: "/dashboard/support-tickets",
          },
          {
            id: 5,
            key: "hostpanel.signup-leads",
            title: "Signup Leads",
            icon: LuUserPlus,
            route: "/dashboard/signup-leads",
          },
        ],
      },
      {
        id: "hostpanel-credits-access",
        title: "Credits & Access",
        submenus: [
          {
            id: 21,
            key: "hostpanel.website-credits",
            title: "Website Credits",
            icon: LuTicket,
            route: "/dashboard/website-credits",
          },
          {
            id: 27,
            key: "hostpanel.website-templates",
            title: "Website Templates",
            icon: LuLayoutTemplate,
            route: "/dashboard/website-templates",
          },
          {
            id: 7,
            key: "hostpanel.module-access-logs",
            title: "Module Access Logs",
            icon: LuShieldCheck,
            route: "/dashboard/module-access-logs",
          },
        ],
      },
      {
        id: "hostpanel-system-logs",
        title: "System Logs",
        submenus: [
          {
            id: 20,
            key: "hostpanel.host-panel-logs",
            title: "Host Panel Logs",
            icon: LuFileText,
            route: "/dashboard/host-panel-logs",
          },
          {
            id: 28,
            key: "hostpanel.host-panel-analytics",
            title: "Host Panel Analytics",
            icon: LuChartLine,
            route: "/dashboard/host-panel-analytics",
          },
        ],
      },
    ],
  },
];
