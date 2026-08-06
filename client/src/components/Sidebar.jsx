import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SideBarContext";
import {
  LuLayoutDashboard,
  LuBuilding2,
  LuUsers,
  LuUserPlus,
  LuHeadset,
  LuBoxes,
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
} from "react-icons/lu";
import useAuth from "../hooks/useAuth";

const Sidebar = ({ onCloseDrawer }) => {
  const { isSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedModule, setExpandedModule] = useState(0);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const { auth } = useAuth();

  const isSuperAdmin = auth?.user?.isSuperAdmin;
  const allowedModules = auth?.user?.allowedModules || [];

  // Submenu `key`s must stay in sync with server/config/masterPanelModules.js
  const defaultModules = [
    {
      id: 1,
      key: "dashboard",
      icon: LuLayoutDashboard,
      title: "Dashboard",
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
            ...(isSuperAdmin
              ? [
                  {
                    id: 22,
                    key: "dashboard.user-access",
                    title: "User Access",
                    icon: LuShieldCheck,
                    route: "/dashboard/master-panel-users",
                  },
                ]
              : []),
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
      icon: LuLayoutDashboard,
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
          ],
        },
      ],
    },
  ];

  const navigateFromSidebar = (route) => {
    navigate(route, { flushSync: true });
    if (onCloseDrawer) onCloseDrawer();
  };

  const handleMenuOpen = (item) => {
    navigateFromSidebar(item.route);
  };

  const toggleModule = (index) => {
    setExpandedModule((prev) => (prev === index ? null : index));
  };

  const handleModuleClick = (module, index) => {
    if (module.categories?.length) {
      toggleModule(index);
      return;
    }
    navigateFromSidebar(module.route);
  };

  const toggleCategory = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const filteredModules = isSuperAdmin
    ? defaultModules
    : defaultModules
        .map((module) => ({
          ...module,
          categories: module.categories
            .map((category) => ({
              ...category,
              submenus: category.submenus.filter((submenu) =>
                allowedModules.includes(submenu.key),
              ),
            }))
            .filter((category) => category.submenus.length > 0),
        }))
        .filter((module) => module.categories.length > 0);

  return (
    <div
      className={`${isSidebarOpen ? "w-64" : "w-16"} flex h-full flex-col overflow-hidden border-r border-black/10 bg-[#efefef] transition-all duration-300`}
    >
      <div className="px-4 py-3 flex justify-center">
        <span className="text-[10px] font-semibold tracking-wide text-black/70 bg-white px-3 py-1 rounded-full uppercase">
          {isSidebarOpen ? "Master Panel" : "MP"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-3 space-y-0 hideScrollBar">
        {!isSidebarOpen ? (
          <div className="px-4 pt-3">
            <div className="border-t border-black/10 pt-2">
              <div className="text-[10px] font-pbold tracking-wide text-black/80 uppercase text-center">
                MNU
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-0">
          {filteredModules.map((module, index) => (
            <div key={module.id} className="px-4 pt-3">
              <div className="border-t border-black/10 pt-2">
                {isSidebarOpen ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left font-['Poppins'] text-xs font-semibold uppercase tracking-wide text-black/80"
                      onClick={() => toggleModule(index)}
                    >
                      <span className="flex items-center gap-2">
                        <module.icon size={16} className="shrink-0" />
                        <span>{module.title}</span>
                      </span>
                      <span>
                        {expandedModule === index ? (
                          <ChevronUp size={16} className="shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                        expandedModule === index ? "max-h-[3200px]" : "max-h-0"
                      }`}
                    >
                      {module.categories?.map((category) => {
                        const isCategoryOpen = !collapsedCategories[category.id];
                        return (
                          <div key={category.id}>
                            <button
                              type="button"
                              className={`w-full mt-2 mb-1 px-2 py-1.5 flex items-center justify-between text-left rounded-md transition-colors ${
                                isCategoryOpen
                                  ? "text-black/80"
                                  : "text-black/60 hover:text-black/80"
                              }`}
                              onClick={() => toggleCategory(category.id)}
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {category.title}
                              </span>
                              <span>
                                {isCategoryOpen ? (
                                  <ChevronUp size={14} className="shrink-0 text-black/50" />
                                ) : (
                                  <ChevronDown size={14} className="shrink-0 text-black/50" />
                                )}
                              </span>
                            </button>

                            <div
                              className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                                isCategoryOpen ? "max-h-[1200px]" : "max-h-0"
                              }`}
                            >
                              <div className="mt-1 flex flex-col gap-1">
                                {category.submenus.map((submenu) => (
                                  <button
                                    type="button"
                                    key={submenu.id}
                                    className={`group relative flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left transition-all hover:bg-white ${
                                      isActive(submenu.route)
                                        ? "bg-white text-black shadow-sm"
                                        : "text-black/80"
                                    }`}
                                    onClick={() => handleMenuOpen(submenu)}
                                  >
                                    <submenu.icon
                                      size={18}
                                      className={`shrink-0 ${
                                        isActive(submenu.route)
                                          ? "text-accent"
                                          : "text-black/80"
                                      }`}
                                    />
                                    <span
                                      className={`truncate font-['Poppins'] text-xs font-medium ${
                                        isActive(submenu.route) ? "font-semibold" : ""
                                      }`}
                                    >
                                      {submenu.title}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    title={module.title}
                    className={`group relative flex w-full items-center justify-center rounded-md px-3 py-2.5 text-left transition-all hover:bg-white ${
                      isActive(module.route)
                        ? "bg-white text-black shadow-sm"
                        : "text-black/80"
                    }`}
                    onClick={() => handleModuleClick(module, index)}
                  >
                    <module.icon
                      size={18}
                      className={`shrink-0 ${
                        isActive(module.route) ? "text-accent" : "text-black/80"
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
