import { useEffect, useMemo } from "react"; // 🆕 added useMemo
import { Tabs } from "@mui/material";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useIsMobile from "../../hooks/useIsMobile"; // adjust the path
import { AnimatePresence, motion } from "motion/react";
import useAuth from "../../hooks/useAuth"; // 🆕 added

const TabLayout = ({
  basePath,
  tabs = [],
  defaultTabPath,
  hideTabsCondition = () => false,
  hideTabsOnPaths = [], // NEW PROP
  tabUiVariant = "default",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const { auth } = useAuth(); // 🆕 get user
  const userPermissions = auth?.user?.permissions?.permissions || []; // 🆕

  // 🧠 Filter tabs based on permissions
  const filteredTabs = useMemo(() => {
    return tabs.filter(
      (tab) => !tab.permission || userPermissions.includes(tab.permission),
    );
  }, [tabs, userPermissions]);

  // Redirect to default tab if on basePath
  useEffect(() => {
    if (
      location.pathname === basePath &&
      defaultTabPath &&
      filteredTabs.length > 0
    ) {
      navigate(`${basePath}/${filteredTabs[0].path}`, { replace: true }); // 🆕 use filteredTabs
    }
  }, [location, navigate, basePath, defaultTabPath, filteredTabs]); // 🆕

  const activeTab = filteredTabs.findIndex((tab) =>
    location.pathname.includes(tab.path),
  ); // 🆕 use filteredTabs
  const tabPercent = 100 / filteredTabs.length; // 🆕

  const showTabs =
    !hideTabsCondition(location.pathname) &&
    !hideTabsOnPaths.some((path) => location.pathname.includes(path));
  const isGlassVariant = tabUiVariant === "glass";

  return (
    <div className="lg:w-[80vw]">
      {showTabs && (
        <Tabs
          value={activeTab}
          // variant={isMobile ? "scrollable" : "fullWidth"}
          variant={isMobile ? "scrollable" : "scrollable"}
          scrollButtons={isMobile ? "auto" : false}
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{
            backgroundColor: isGlassVariant ? "#f1f5f9" : "white",
            borderRadius: isGlassVariant ? "9999px" : 2,
            border: isGlassVariant ? "1px solid #e2e8f0" : "1px solid #d1d5db",
            boxShadow: isGlassVariant
              ? "inset 0 1px 1px rgba(255,255,255,0.7)"
              : "none",
            p: isGlassVariant ? "4px" : 0,
            overflowX: isMobile ? "auto" : "hidden",
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: "medium",
              padding: isGlassVariant ? "8px 16px" : "12px 16px",
              borderRight: isGlassVariant ? "none" : "0.1px solid #d1d5db",
              minWidth: isMobile ? "fit-content" : "auto",
            },
            "& .Mui-selected": {
              backgroundColor: isGlassVariant ? "#ffffff" : "#1E3D73",
              color: isGlassVariant ? "#2563EB" : "white",
            },
          }}
        >
          {filteredTabs.map(
            (
              tab,
              index, // 🆕 use filteredTabs
            ) => (
              <NavLink
                key={index}
                className={isGlassVariant ? "" : "border-r-[1px] border-borderGray"}
                to={`${basePath}/${tab.path}`}
                style={({ isActive }) => ({
                  textDecoration: "none",
                  color: isActive
                    ? isGlassVariant
                      ? "#2563EB"
                      : "white"
                    : isGlassVariant
                      ? "#475569"
                      : "#1E3D73",
                  textAlign: "center",
                  padding: isGlassVariant ? "8px 16px" : "12px 16px",
                  display: "block",
                  backgroundColor: isActive
                    ? isGlassVariant
                      ? "#ffffff"
                      : "#1E3D73"
                    : isGlassVariant
                      ? "transparent"
                      : "white",
                  borderRadius: isGlassVariant ? "9999px" : 0,
                  fontWeight: 600,
                  boxShadow:
                    isActive && isGlassVariant
                      ? "0 1px 4px rgba(15,23,42,0.12)"
                      : "none",
                  // minWidth: isMobile ? "70%" : `${tabPercent}%`,
                  minWidth: isMobile ? "70%" : "30%",
                })}
              >
                {tab.label}
              </NavLink>
            ),
          )}
        </Tabs>
      )}

      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
};

export default TabLayout;
