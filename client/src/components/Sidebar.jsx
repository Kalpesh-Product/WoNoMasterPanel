import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SideBarContext";
import { MASTER_PANEL_MODULES } from "../constants/masterPanelModules";
import { LuLayoutDashboard } from "react-icons/lu";
import useAuth from "../hooks/useAuth";

const Sidebar = ({ onCloseDrawer }) => {
  const { isSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedModules, setExpandedModules] = useState(new Set([0]));
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const { auth } = useAuth();

  const isSuperAdmin = auth?.user?.isSuperAdmin;
  const allowedModules = auth?.user?.allowedModules || [];

  const navigateFromSidebar = (route) => {
    navigate(route, { flushSync: true });
    if (onCloseDrawer) onCloseDrawer();
  };

  const handleMenuOpen = (item) => {
    navigateFromSidebar(item.route);
  };

  const toggleModule = (index) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleModuleClick = (module, index) => {
    if (module.categories?.length) {
      toggleModule(index);
    }
    if (module.route) {
      navigateFromSidebar(module.route);
    }
  };

  const toggleCategory = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const filteredModules = isSuperAdmin
    ? MASTER_PANEL_MODULES
    : MASTER_PANEL_MODULES.map((module) => ({
        ...module,
        categories: module.categories
          .map((category) => ({
            ...category,
            submenus: category.submenus
              .filter((submenu) => !submenu.superAdminOnly)
              .filter((submenu) => allowedModules.includes(submenu.key)),
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

        {isSidebarOpen && (
          <div className="px-4 pt-3">
            <div className="border-t border-black/10 pt-2">
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left transition-all hover:bg-white ${
                  location.pathname === "/dashboard" && !location.pathname.includes("/dashboard/")
                    ? "bg-white text-black shadow-sm"
                    : "text-black/80"
                }`}
                onClick={() => navigateFromSidebar("/dashboard")}
              >
                <LuLayoutDashboard
                  size={18}
                  className={`shrink-0 ${
                    location.pathname === "/dashboard" && !location.pathname.includes("/dashboard/")
                      ? "text-accent"
                      : "text-black/80"
                  }`}
                />
                <span className="font-['Poppins'] text-xs font-semibold uppercase tracking-wide">
                  Dashboard
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-0">
          {filteredModules.map((module, index) => (
            <div key={module.id} className="px-4 pt-3">
              <div className="border-t border-black/10 pt-2">
                {isSidebarOpen ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left font-['Poppins'] text-xs font-semibold uppercase tracking-wide text-black/80"
                      onClick={() => handleModuleClick(module, index)}
                    >
                      <span className="flex items-center gap-2">
                        <module.icon size={16} className="shrink-0" />
                        <span>{module.title}</span>
                      </span>
                      <span>
                        {expandedModules.has(index) ? (
                          <ChevronUp size={16} className="shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                        expandedModules.has(index) ? "max-h-[3200px]" : "max-h-0"
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
