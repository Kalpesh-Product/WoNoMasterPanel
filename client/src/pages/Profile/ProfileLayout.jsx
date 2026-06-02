import { Tabs } from "@mui/material";
import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const ProfileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Map routes to tabs
  const tabs = [
    { label: "Profile", path: "my-profile" },
    { label: "Change Password", path: "change-password" },
    // { label: "Permissions", path: "permissions" },
    // { label: "HR", path: "HR" },
    // { label: "Assets", path: "my-assets" },
    // { label: "Meetings", path: "my-meetings" },
    // { label: "Ticket History", path: "tickets-history" },
  ];

  // Redirect to "first tab" if the current path is "/module/first-page"
  useEffect(() => {
    if (location.pathname === "/profile") {
      navigate("/profile/my-profile", {
        replace: true,
      });
    }
  }, [location, navigate]);

  // Determine whether to show the tabs
  const showTabs = !location.pathname.includes("budget/");

  // Determine active tab based on location
  const activeTab = tabs.findIndex((tab) =>
    location.pathname.includes(tab.path)
  );

  return (
    <div className="p-4">
      {/* Render tabs only if the current route is not EmployeeDetails */}
      {showTabs && (
        <Tabs
          value={activeTab}
          variant="fullWidth"
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{
            backgroundColor: "#f1f5f9",
            borderRadius: "9999px",
            border: "1px solid #e2e8f0",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.7)",
            p: "4px",
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              padding: "8px 16px",
              borderRight: "none",
            },
            "& .Mui-selected": {
              backgroundColor: "#ffffff",
              color: "#2563EB",
            },
          }}>
          {tabs.map((tab, index) => (
            <NavLink
              key={index}
              className={""}
              to={tab.path}
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "#2563EB" : "#475569",
                flex: 1,
                textAlign: "center",
                padding: "8px 16px",
                display: "block",
                backgroundColor: isActive ? "#ffffff" : "transparent",
                borderRadius: "9999px",
                fontWeight: 600,
                boxShadow: isActive ? "0 1px 4px rgba(15,23,42,0.12)" : "none",
              })}>
              {tab.label}
            </NavLink>
          ))}
        </Tabs>
      )}

      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
};

export default ProfileLayout;
