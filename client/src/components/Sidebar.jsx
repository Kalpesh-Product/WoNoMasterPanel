import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "../context/SideBarContext";
import { MASTER_PANEL_MODULES, hasModuleAccess } from "../constants/masterPanelModules";
import { LuLayoutDashboard } from "react-icons/lu";
import useAuth from "../hooks/useAuth";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import {
  DEFAULT_COMPANY_REVIEWS_PATH,
  NOMAD_LISTING_REVIEWS_PATH,
  nomadReviewQueryOptions,
} from "../pages/Dashboard/CompanyReviews/nomadReviewQuery";
import { destinationReviewQueries } from "../pages/Dashboard/CompanyReviews/destinationReviewQueries";
import {
  DESTINATIONS_DATA_BASE_PATH,
  destinationSummaryQueryOptions,
} from "../pages/Dashboard/FrontendDashboard/destinationSummaryQuery";
import "./Sidebar.css";

const Sidebar = ({ onCloseDrawer }) => {
  const { isSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedModules, setExpandedModules] = useState(new Set([0]));
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [moduleSearch, setModuleSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { auth } = useAuth();
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();

  const isSuperAdmin = auth?.user?.isSuperAdmin;
  const allowedModules = auth?.user?.allowedModules || [];

  // Browsers (including Chrome's password manager) autofill any usable text
  // input when credentials are filled elsewhere on the page. Keeping this box
  // read-only unless the user is actually typing in it makes it ineligible for
  // autofill altogether; the focus check also rejects injected values.
  const handleModuleSearchChange = (event) => {
    if (!isSearchFocused || document.activeElement !== event.currentTarget) {
      event.target.value = moduleSearch;
      return;
    }
    setModuleSearch(event.target.value);
  };

  const navigateFromSidebar = (route) => {
    navigate(route, { flushSync: true });
    if (onCloseDrawer) onCloseDrawer();
  };

  const prefetchSidebarRoute = (route) => {
    if (!auth?.accessToken) return;
    if (route === DEFAULT_COMPANY_REVIEWS_PATH || route === NOMAD_LISTING_REVIEWS_PATH) {
      queryClient.prefetchInfiniteQuery(nomadReviewQueryOptions(axiosPrivate, auth.user?.email));
      for (const options of destinationReviewQueries) queryClient.prefetchQuery(options);
    }
    if (route === DESTINATIONS_DATA_BASE_PATH) {
      for (const tab of ["listings", "content"]) {
        queryClient.prefetchInfiniteQuery(destinationSummaryQueryOptions(axiosPrivate, tab));
      }
    }
  };

  const handleMenuOpen = (item) => {
    prefetchSidebarRoute(item.route);
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

  // Exact match, or a genuine nested child route (path + "/...") — plain
  // startsWith would also match unrelated sibling routes that merely share a
  // prefix, e.g. "/dashboard/companies-verified" starting with
  // "/dashboard/companies".
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const filteredModules = isSuperAdmin
    ? MASTER_PANEL_MODULES
    : MASTER_PANEL_MODULES.map((module) => ({
        ...module,
        categories: module.categories
          .map((category) => ({
            ...category,
            submenus: category.submenus
              .filter((submenu) => !submenu.superAdminOnly)
              .filter((submenu) => hasModuleAccess(allowedModules, submenu.key)),
          }))
          .filter((category) => category.submenus.length > 0),
      }))
        .filter((module) => module.categories.length > 0);

  const searchQuery = moduleSearch.trim().toLocaleLowerCase();

  const displayModules = useMemo(() => {
    if (!searchQuery) return filteredModules;

    return filteredModules
      .map((module) => ({
        ...module,
        categories: module.categories
          .map((category) => ({
            ...category,
            submenus: category.submenus.filter((submenu) =>
              submenu.title.toLocaleLowerCase().includes(searchQuery)
            ),
          }))
          .filter((category) => category.submenus.length > 0),
      }))
      .filter((module) => module.categories.length > 0);
  }, [filteredModules, searchQuery]);

  return (
    <div
      data-tour="sidebar-nav"
      className={`sidebar-navigation ${isSidebarOpen ? "w-64" : "w-16"} flex h-full flex-col overflow-hidden border-r border-black/10 bg-[#efefef] transition-all duration-300`}
    >
      <div className="px-4 py-3 flex justify-center">
        <span className="text-[10px] font-semibold tracking-wide text-black/70 bg-white px-3 py-1 rounded-full uppercase">
          {isSidebarOpen ? "Master Panel" : "MP"}
        </span>
      </div>

      {isSidebarOpen && (
        <div data-tour="sidebar-search" className="px-4 pb-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <input
              type="search"
              value={moduleSearch}
              onChange={handleModuleSearchChange}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              readOnly={!isSearchFocused}
              placeholder="Search modules"
              aria-label="Search modules"
              autoComplete="off"
              className="h-9 w-full rounded-md border border-black/15 bg-white pl-9 pr-8 font-semibold text-xs text-black placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
            />
            {moduleSearch ? (
              <button
                type="button"
                onClick={() => setModuleSearch("")}
                aria-label="Clear module search"
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-3 space-y-0 hideScrollBar">
        {!isSidebarOpen ? (
          <div className="px-4 pt-3">
            <div className="border-t border-black/10 pt-2">
              <div className="text-[10px] font-bold tracking-wide text-black/80 uppercase text-center">
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
                data-tour="sidebar-open-page"
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
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Dashboard
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-0">
          {displayModules.map((module, index) => (
            <div key={module.id} className="px-4 pt-3">
              <div className="border-t border-black/10 pt-2">
                {isSidebarOpen ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-black/80"
                      onClick={() => handleModuleClick(module, index)}
                    >
                      <span className="flex items-center gap-2">
                        <module.icon size={16} className="shrink-0" />
                        <span>{module.title}</span>
                      </span>
                      <span>
                        {Boolean(searchQuery) || expandedModules.has(index) ? (
                          <ChevronUp size={16} className="shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                        Boolean(searchQuery) || expandedModules.has(index) ? "max-h-[3200px]" : "max-h-0"
                      }`}
                    >
                      {module.categories?.map((category) => {
                        const isCategoryOpen = Boolean(searchQuery) || !collapsedCategories[category.id];
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
                                    onPointerEnter={() => prefetchSidebarRoute(submenu.route)}
                                    onFocus={() => prefetchSidebarRoute(submenu.route)}
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
                                      className={`truncate text-xs ${
                                        isActive(submenu.route) ? "font-semibold" : "font-medium"
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
