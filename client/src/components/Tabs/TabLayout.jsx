import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import PageFrame from "../Pages/PageFrame";

const TabLayout = ({
  basePath,
  tabs = [],
  defaultTabPath,
  hideTabsCondition = () => false,
  hideTabsOnPaths = [],
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const userPermissions = auth?.user?.permissions?.permissions || [];

  const filteredTabs = useMemo(() => {
    return tabs.filter(
      (tab) => !tab.permission || userPermissions.includes(tab.permission),
    );
  }, [tabs, userPermissions]);

  useEffect(() => {
    if (
      location.pathname === basePath &&
      defaultTabPath &&
      filteredTabs.length > 0
    ) {
      navigate(`${basePath}/${filteredTabs[0].path}`, { replace: true });
    }
  }, [location, navigate, basePath, defaultTabPath, filteredTabs]);

  const showTabs =
    !hideTabsCondition(location.pathname) &&
    !hideTabsOnPaths.some((path) => location.pathname.includes(path));

  const activeTab = useMemo(() => {
    return filteredTabs.find((tab) => location.pathname.includes(tab.path));
  }, [filteredTabs, location.pathname]);

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          {showTabs && activeTab?.heading && (
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase">
                {activeTab.heading}
              </h2>
              {activeTab.description && (
                <p className="text-xs font-pmedium text-slate-500 mt-1">
                  {activeTab.description}
                </p>
              )}
            </div>
          )}

          {showTabs && (
            <div className="flex gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {filteredTabs.map((tab, index) => (
                <NavLink
                  key={`${tab.path}-${index}`}
                  to={`${basePath}/${tab.path}`}
                  className={({ isActive }) =>
                    `flex-1 shrink-0 rounded-xl px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest transition-all text-center whitespace-nowrap ${
                      isActive
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          )}

          <div>
            <Outlet />
          </div>
        </div>
      </PageFrame>
    </div>
  );
};

export default TabLayout;
