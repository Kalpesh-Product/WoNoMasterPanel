import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ArrowUpRight } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import { MASTER_PANEL_MODULES } from "../../../constants/masterPanelModules";
import useAuth from "../../../hooks/useAuth";
import TabCharts from "./TabCharts";

const useFilteredModules = () => {
  const { auth } = useAuth();
  const isSuperAdmin = auth?.user?.isSuperAdmin;

  return useMemo(() => {
    const allowedModules = auth?.user?.allowedModules || [];

    if (isSuperAdmin) return MASTER_PANEL_MODULES;

    return MASTER_PANEL_MODULES.map((module) => ({
      ...module,
      categories: module.categories
        .map((category) => ({
          ...category,
          submenus: category.submenus
            .filter((submenu) => !submenu.superAdminOnly)
            .filter((submenu) => allowedModules.includes(submenu.key)),
        }))
        .filter((category) => category.submenus.length > 0),
    })).filter((module) => module.categories.length > 0);
  }, [isSuperAdmin, auth]);
};

const MainDashboard = () => {
  const navigate = useNavigate();
  const filteredModules = useFilteredModules();
  const [expandedModules, setExpandedModules] = useState(
    () => new Set(filteredModules.length > 0 ? [filteredModules[0].key] : []),
  );
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const init = {};
    filteredModules.forEach((m) => {
      if (m.categories[0]) {
        init[m.key] = new Set([m.categories[0].id]);
      }
    });
    return init;
  });
  const [activeTabKey, setActiveTabKey] = useState({});

  const toggleModule = (key) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const toggleCategory = (moduleKey, categoryId) =>
    setExpandedCategories((prev) => {
      const current = prev[moduleKey] ?? new Set();
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...prev, [moduleKey]: next };
    });

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">
              Dashboard
            </h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">
              Module-wise overview with live data. Expand a module, pick a
              section, then a tab to see cumulative stat cards and charts.
            </p>
          </div>

          {filteredModules.map((module) => {
            const isModuleOpen = expandedModules.has(module.key);
            const openCategoryIds = expandedCategories[module.key] ?? new Set();

            return (
              <div
                key={module.key}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleModule(module.key)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50/50 ${
                    isModuleOpen ? "border-b border-slate-100 bg-slate-50/50" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-slate-100/70 text-slate-600 shrink-0">
                      <module.icon size={16} />
                    </span>
                    <span className="text-sm font-pmedium text-slate-900 uppercase tracking-wide">
                      {module.title}
                    </span>
                    <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] font-pmedium px-2 py-0.5 uppercase tracking-widest">
                      {module.categories.length} sections
                    </span>
                  </span>
                  {isModuleOpen ? (
                    <ChevronUp size={16} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {isModuleOpen && (
                  <div className="p-4 flex flex-col gap-3">
                    {module.categories.map((category) => {
                      const isCategoryOpen = openCategoryIds.has(category.id);
                      const tabs = category.submenus;
                      const activeTab =
                        tabs.find(
                          (tab) => tab.key === activeTabKey[module.key],
                        ) ?? tabs[0];

                      return (
                        <div
                          key={category.id}
                          className="rounded-2xl border border-slate-100 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleCategory(module.key, category.id)
                            }
                            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                              isCategoryOpen
                                ? "bg-[#F7F8FA] border-b border-slate-100"
                                : "bg-white hover:bg-slate-50/50"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-[13px] font-pmedium text-slate-900">
                                {category.title}
                              </span>
                              <span className="rounded-full bg-white text-slate-500 text-[10px] font-pmedium px-2 py-0.5 uppercase tracking-widest border border-slate-100">
                                {tabs.length} tabs
                              </span>
                            </span>
                            {isCategoryOpen ? (
                              <ChevronUp size={14} className="text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400 shrink-0" />
                            )}
                          </button>

                          {isCategoryOpen && (
                            <div className="p-4 flex flex-col gap-4 bg-white">
                              <div className="flex gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm overflow-x-auto [&::-webkit-scrollbar]:hidden">
                                {tabs.map((tab) => {
                                  const isTabActive = activeTab.key === tab.key;
                                  return (
                                    <button
                                      type="button"
                                      key={tab.key}
                                      onClick={() =>
                                        setActiveTabKey((prev) => ({
                                          ...prev,
                                          [module.key]: tab.key,
                                        }))
                                      }
                                      className={`flex-1 shrink-0 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all text-center whitespace-nowrap flex items-center justify-center gap-1.5 ${
                                        isTabActive
                                          ? "bg-[#2563EB] text-white shadow-sm"
                                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                      }`}
                                    >
                                      <tab.icon size={13} />
                                      {tab.title}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
                                <div>
                                  <h3 className="text-[15px] font-pmedium text-slate-900 uppercase">
                                    {activeTab.title}
                                  </h3>
                                  <p className="text-xs font-pmedium text-slate-500 mt-1">
                                    Live overview for {activeTab.title}.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => navigate(activeTab.route)}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[10px] font-pmedium uppercase tracking-widest shadow-sm shadow-blue-200 transition-all hover:opacity-90 shrink-0"
                                >
                                  Open Page <ArrowUpRight size={13} />
                                </button>
                              </div>

                              <TabCharts tab={activeTab} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PageFrame>
    </div>
  );
};

export default MainDashboard;
