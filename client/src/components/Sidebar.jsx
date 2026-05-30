import React, { useState } from "react";
import { FaAngleDown, FaChevronUp } from "react-icons/fa6";
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
} from "react-icons/lu";
import useAuth from "../hooks/useAuth";

const Sidebar = ({ onCloseDrawer }) => {
  const { isSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedModule, setExpandedModule] = useState(0);
  const { auth } = useAuth();

  const userEmail = auth?.user?.email;

  const restrictedEmails = [
    "shawnsilveira.wono@gmail.com",
    "mehak.wono@gmail.com",
    "savita.wono@gmail.com",
    "gourish.wono@gmail.com",
  ];

  const companiesAccessAllowedEmails = [
    "gourish.wono@gmail.com",
    "savita.wono@gmail.com",
  ];

  const worldRankingWeightsAccessAllowedEmails = [
    "shawnsilveira.wono@gmail.com",
  ];

  const defaultModules = [
    {
      id: 1,
      icon: LuLayoutDashboard,
      title: "Dashboard",
      route: "/dashboard",
      submenus: [
        {
          id: 2,
          title: "Companies",
          icon: LuBuilding2,
          route: "/dashboard/companies",
        },
        {
          id: 3,
          title: "All Leads",
          icon: LuUsers,
          route: "/dashboard/all-leads",
        },
        {
          id: 4,
          title: "Value Adds Leads",
          icon: LuUsers,
          route: "/dashboard/value-adds-leads",
        },
        {
          id: 5,
          title: "Signup Leads",
          icon: LuUserPlus,
          route: "/dashboard/signup-leads",
        },
        {
          id: 6,
          title: "Host Companies",
          icon: LuBuilding2,
          route: "/dashboard/host-companies",
        },
        {
          id: 7,
          title: "Module Access Logs",
          icon: LuShieldCheck,
          route: "/dashboard/module-access-logs",
        },
        {
          id: 8,
          title: "Customer Support",
          icon: LuHeadset,
          route: "/dashboard/customer-support",
        },
        {
          id: 9,
          title: "Requested Services",
          icon: LuBoxes,
          route: "/dashboard/requested-services",
        },
        {
          id: 10,
          title: "Inactive Websites",
          icon: LuGlobe,
          route: "/dashboard/inactive-websites",
        },
        {
          id: 11,
          title: "Data Upload",
          icon: LuUpload,
          route: "/dashboard/data-upload",
        },
        {
          id: 12,
          title: "Profile",
          icon: LuUser,
          route: "/dashboard/profile/my-profile",
        },
        {
          id: 13,
          title: "Logs",
          icon: LuFileText,
          route: "/dashboard/logs-layout",
        },
        {
          id: 14,
          title: "Reviews",
          icon: LuMessageSquareText,
          route: "/dashboard/company-reviews",
        },
        {
          id: 15,
          title: "Blogs and news",
          icon: LuNewspaper,
          route: "/dashboard/BlogsAndNews",
        },
        {
          id: 16,
          title: "World Ranking Weights",
          icon: LuChartLine,
          route: "/dashboard/world-ranking-weights",
        },
        {
          id: 17,
          title: "Visa Countries",
          icon: LuPlane,
          route: "/dashboard/visa-countries",
        },
      ],
    },
  ];

  const handleMenuOpen = (item) => {
    navigate(item.route);
    if (onCloseDrawer) onCloseDrawer();
  };

  const toggleModule = (index) => {
    setExpandedModule((prev) => (prev === index ? null : index));
  };

  const handleModuleClick = (module, index) => {
    if (module.submenus?.length) {
      toggleModule(index);
      return;
    }
    navigate(module.route);
    if (onCloseDrawer) onCloseDrawer();
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const isRestrictedUser = restrictedEmails.includes(userEmail);
  const canAccessCompanies = companiesAccessAllowedEmails.includes(userEmail);
  const canAccessWorldRankingWeights =
    worldRankingWeightsAccessAllowedEmails.includes(userEmail);

  const restrictedVisibleSubmenuTitles = [
    "Data Upload",
    "Profile",
    "Blogs and news",
    ...(canAccessCompanies ? ["Companies"] : []),
    ...(canAccessWorldRankingWeights ? ["World Ranking Weights"] : []),
  ];

  const filteredModules = isRestrictedUser
    ? defaultModules.map((module) => ({
      ...module,
      submenus: module.submenus.filter((submenu) =>
        restrictedVisibleSubmenuTitles.includes(submenu.title),
      ),
    }))
    : defaultModules;

  return (
    <div
      className={`${isSidebarOpen ? "w-64" : "w-16"} h-[90vh] bg-[#f3f4f6] flex flex-col border-r border-gray-200 shadow-sm overflow-hidden transition-all duration-100`}
    >
      <div className="px-4 py-3 flex justify-center">
        <span className="text-[10px] font-bold tracking-wider text-gray-600 bg-gray-200 px-3 py-1 rounded-full uppercase">
          {isSidebarOpen ? "Master Panel" : "MP"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5 hideScrollBar">
        {!isSidebarOpen ? (
          <div className="px-2 pt-1 pb-2">
            <div className="text-[10px] font-pbold tracking-wider text-gray-500 uppercase text-center">
              MNU
            </div>
            <div className="mt-2 h-px bg-gray-300" />
          </div>
        ) : null}

        <div className="space-y-1">
          {filteredModules.map((module, index) => (
            <div key={module.id}>
              {isSidebarOpen ? (
                <button
                  type="button"
                  className="w-full mb-1 px-3 flex items-center justify-between text-left"
                  onClick={() => toggleModule(index)}
                >
                  <span className="text-[12px] font-pbold text-gray-500 tracking-wider uppercase">
                    {module.title}
                  </span>
                  <span
                    className={`text-gray-400 transition-transform duration-300 ${expandedModule === index ? "rotate-180" : "rotate-0"
                      }`}
                  >
                    {expandedModule === index ? <FaChevronUp size={12} /> : <FaAngleDown size={12} />}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  title={module.title}
                  className={`w-full flex items-center justify-center py-2.5 px-3 rounded-md transition-colors ${isActive(module.route) ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-200"
                    }`}
                  onClick={() => handleModuleClick(module, index)}
                >
                  <span className="text-gray-500">
                    <module.icon size={16} />
                  </span>
                </button>
              )}

              <div
                className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isSidebarOpen && expandedModule === index ? "max-h-[2600px]" : "max-h-0"
                  }`}
              >
                {isSidebarOpen && module.submenus?.map((submenu) => (
                  <button
                    type="button"
                    key={submenu.id}
                    title={!isSidebarOpen ? submenu.title : ""}
                    className={`w-full flex items-center ${isSidebarOpen ? "justify-start" : "justify-center"
                      } py-2.5 px-3 rounded-md transition-colors ${isActive(submenu.route) ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-200"
                      }`}
                    onClick={() => handleMenuOpen(submenu)}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-gray-500">
                        <submenu.icon size={15} />
                      </span>
                      {isSidebarOpen && (
                        <span className="text-[12px] font-pmedium truncate uppercase">
                          {submenu.title}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
