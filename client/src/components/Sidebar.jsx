import React, { useState } from "react";
import { FaAngleDown, FaChevronUp, FaBoxesStacked } from "react-icons/fa6";
import { FaChartLine } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SideBarContext";
import { MdHome } from "react-icons/md";
import { FaLaptopCode } from "react-icons/fa";
import { FaUserTie } from "react-icons/fa6";
import { VscPersonAdd } from "react-icons/vsc";
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
      icon: <MdHome />,
      title: "Dashboard",
      route: "/dashboard",
      submenus: [
        {
          id: 2,
          title: "Companies",
          icon: <FaLaptopCode />,
          route: "/dashboard/companies",
        },
        {
          id: 3,
          title: "All Leads",
          icon: <FaUserTie />,
          route: "/dashboard/all-leads",
        },
        {
          id: 4,
          title: "Value Adds Leads",
          icon: <FaUserTie />,
          route: "/dashboard/value-adds-leads",
        },
        {
          id: 5,
          title: "Host Companies",
          icon: <FaLaptopCode />,
          route: "/dashboard/host-companies",
        },
        {
          id: 6,
          title: "Signup Leads",
          icon: <VscPersonAdd />,
          route: "/dashboard/signup-leads",
        },
        {
          id: 7,
          title: "Customer Support",
          icon: <VscPersonAdd />,
          route: "/dashboard/customer-support",
        },
        {
          id: 8,
          title: "Requested Services",
          icon: <FaBoxesStacked />,
          route: "/dashboard/requested-services",
        },
        {
          id: 9,
          title: "Inactive Websites",
          icon: <FaBoxesStacked />,
          route: "/dashboard/inactive-websites",
        },
        {
          id: 10,
          title: "Data Upload",
          icon: <FaBoxesStacked />,
          route: "/dashboard/data-upload",
        },
        {
          id: 11,
          title: "Profile",
          icon: <FaBoxesStacked />,
          route: "/dashboard/profile/my-profile",
        },
        {
          id: 12,
          title: "Logs",
          icon: <FaBoxesStacked />,
          route: "/dashboard/logs-layout",
        },
        {
          id: 13,
          title: "Reviews",
          icon: <FaBoxesStacked />,
          route: "/dashboard/company-reviews",
        },
        {
          id: 14,
          title: "Blogs and news",
          icon: <FaBoxesStacked />,
          route: "/dashboard/BlogsAndNews",
        },
        {
          id: 15,
          title: "World Ranking Weights",
          icon: <FaChartLine />,
          route: "/dashboard/world-ranking-weights",
        },
        {
          id: 16,
          title: "Visa Countries",
          icon: <FaChartLine />,
          route: "/dashboard/visa-countries",
        },
        {
          id: 17,
          title: "Module Access Logs",
          icon: <FaBoxesStacked />,
          route: "/dashboard/module-access-logs",
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
    <div className="flex flex-col px-2 bg-gray">
      <div
        className={`${isSidebarOpen ? "w-60" : "w-16"} bg-white text-black flex flex-shrink-0 h-[90vh] hideScrollBar overflow-y-auto transition-all duration-100 z-[1]`}
      >
        <div className="flex relative w-full">
          <div className="p-0 flex flex-col gap-2 w-full">
            <div
              className={`rounded-md ${expandedModule === 0 ? "bg-gray-200" : "bg-white"}`}
            >
              {filteredModules.map((module, index) => (
                <div key={module.id}>
                  <div
                    className={`cursor-pointer text-gray-500 flex ${
                      expandedModule === null && isSidebarOpen
                        ? "justify-between pr-2"
                        : expandedModule === 0 && isSidebarOpen
                          ? "justify-between text-[#1E3D73] pr-2"
                          : "justify-center pr-0"
                    } items-center ${expandedModule === 0 && "bg-gray-200 rounded-t-md text-black"} ${
                      isActive(module.route)
                        ? "text-primary border-r-4 transition-all duration-100 rounded-tl-md rounded-bl-md "
                        : ""
                    }`}
                    onClick={() => navigate(module.route)}
                  >
                    <div className="flex justify-start items-center">
                      <div
                        className={`flex items-center justify-center text-sm h-9 w-9 ${
                          expandedModule === 0
                            ? "bg-primary text-white rounded-md"
                            : ""
                        }`}
                      >
                        {module.icon}
                      </div>
                      {isSidebarOpen && (
                        <span className="pl-5 text-sm">{module.title}</span>
                      )}
                    </div>
                    {isSidebarOpen && module.submenus && (
                      <span
                        onClick={() => module.submenus && toggleModule(index)}
                        className={`transition-transform duration-300 ease-in-out ${
                          expandedModule === index ? "rotate-180" : "rotate-0"
                        }`}
                      >
                        {expandedModule === index ? (
                          <FaChevronUp />
                        ) : (
                          <FaAngleDown />
                        )}
                      </span>
                    )}
                  </div>
                  <div
                    className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                      expandedModule === index ? "max-h-[2000px]" : "max-h-0"
                    }`}
                  >
                    {module.submenus && (
                      <div>
                        {module.submenus.map((submenu) => (
                          <div
                            key={submenu.id}
                            className={`cursor-pointer hover:text-[#1E3D73] transition-all duration-100 ${
                              isActive(submenu.route)
                                ? "text-[#1E3D73]"
                                : "text-gray-500"
                            } py-3`}
                            onClick={() => handleMenuOpen(submenu)}
                          >
                            <div
                              className={`flex items-center ${isSidebarOpen ? "justify-start" : "justify-center"}`}
                            >
                              <div className="flex justify-center items-center w-8 text-sm">
                                {submenu.icon}
                              </div>
                              {isSidebarOpen && (
                                <span className="pl-4 text-sm">
                                  {submenu.title}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
