import React, { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const ProfileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { label: "Profile", path: "my-profile" },
    { label: "Change Password", path: "change-password" },
  ];

  useEffect(() => {
    if (
      location.pathname === "/profile" ||
      location.pathname === "/dashboard/profile"
    ) {
      navigate("my-profile", { replace: true });
    }
  }, [location.pathname, navigate]);

  const showTabs = !location.pathname.includes("budget/");

  return (
    <div className="p-4">
      {showTabs && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex-1 rounded-xl px-4 py-2 text-center text-[10px] font-pmedium uppercase tracking-widest transition-all ${
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

      <div className="py-4">
        <Outlet />
      </div>
    </div>
  );
};

export default ProfileLayout;
