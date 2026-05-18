import React, { useMemo, useState } from "react";
import { FormControlLabel, Switch } from "@mui/material";
import { useLocation, useParams } from "react-router-dom";

const MODULE_SECTIONS = [
  {
    title: "Common Modules",
    modules: [
      {
        name: "Attendance",
        submodules: ["Clock In / Out", "Attendance Review", "Shift Planning"],
      },
      {
        name: "Tasks",
        submodules: ["My Tasks", "Department Tasks", "Task Reports"],
      },
      {
        name: "Tickets",
        submodules: ["Raise Ticket", "Manage Tickets", "Ticket Reports"],
      },
      {
        name: "Leave Requests",
        submodules: ["Apply Leave", "Approve Leave", "Leave Policies"],
      },
      {
        name: "Meeting Room System",
        submodules: ["Book Meetings", "Manage Meetings", "Meeting Reviews"],
      },
      {
        name: "Reports",
        submodules: ["Overview Reports", "Exports", "Analytics"],
      },
    ],
  },
  {
    title: "Department Modules",
    modules: [
      {
        name: "HR Department",
        submodules: [
          "Employee Management",
          "Documents",
          "Recruitment",
          "Leave Request Processing",
          "Attendance Review",
          "Payroll Management",
          "Exit Management",
        ],
      },
      {
        name: "Administration Department",
        submodules: [
          "Tenant Companies",
          "Bookings",
          "Visitors Management",
          "Resource Management",
          "House Keeping",
          "Workspace Layout",
        ],
      },
      {
        name: "Sales Department",
        submodules: [
          "Leads Management",
          "Tenant Companies",
          "Plans & Pricing",
          "Sales Architecture",
        ],
      },
      {
        name: "Finance Department",
        submodules: ["Finance & Budget", "Billing & Payments", "Accounting"],
      },
      {
        name: "Maintenance Department",
        submodules: ["Maintenance Repair Logs", "AMC Maintenance Scheduler"],
      },
      {
        name: "Tech Department",
        submodules: ["Website Builder"],
      },
      {
        name: "IT Department",
        submodules: ["IT Repair Logs"],
      },
    ],
  },
];

const makeInitialState = () => {
  const initialState = {};

  MODULE_SECTIONS.forEach((section) => {
    section.modules.forEach((module) => {
      initialState[module.name] = true;
      module.submodules.forEach((submodule) => {
        initialState[`${module.name}::${submodule}`] = true;
      });
    });
  });

  return initialState;
};

const ModuleAccess = () => {
  const { companyId: companySlug } = useParams();
  const location = useLocation();
  const { companyName, selectedPlan } = location.state || {};
  const [toggleState, setToggleState] = useState(makeInitialState);

  const pageTitle = useMemo(() => {
    if (companyName) return companyName;
    return String(companySlug || "Host Company").replace(/-/g, " ");
  }, [companyName, companySlug]);

  const normalizedPlan = useMemo(() => {
    const rawPlan = String(selectedPlan || "").trim();
    if (!rawPlan) return "Not Assigned";
    return rawPlan
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }, [selectedPlan]);

  const handleModuleToggle = (moduleName, checked, submodules) => {
    setToggleState((prev) => {
      const next = { ...prev, [moduleName]: checked };

      submodules.forEach((submodule) => {
        next[`${moduleName}::${submodule}`] = checked;
      });

      return next;
    });
  };

  const handleSubmoduleToggle = (moduleName, submodule, checked, submodules) => {
    setToggleState((prev) => {
      const next = { ...prev, [`${moduleName}::${submodule}`]: checked };
      const hasEnabledSubmodule = submodules.some(
        (item) => next[`${moduleName}::${item}`],
      );
      next[moduleName] = hasEnabledSubmodule;
      return next;
    });
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <p className="text-content font-pmedium text-gray-500 uppercase tracking-wide">
          Host Companies
        </p>
        <div className="flex justify-between">
          <h1 className="mt-2 text-title font-pmedium text-primary uppercase">
            Module Access
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-content font-pmedium text-gray-600">Plan :</span>
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-pmedium text-primary">
              {normalizedPlan}
            </span>
          </div>
        </div>
        <p className="mt-2 text-content text-gray-600">
          Manage visible modules and submodules for{" "}
          <span className="font-pmedium text-gray-800">{pageTitle}</span>.
        </p>

      </div>

      {MODULE_SECTIONS.map((section) => (
        <div
          key={section.title}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow"
        >
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-subtitle font-pmedium text-gray-800">
                {section.title}
              </h2>
              <p className="mt-1 text-content text-gray-500">
                Enable or disable module access at module and submodule level.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {section.modules.map((module) => (
              <div
                key={module.name}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-subtitle font-pmedium text-gray-800">
                      {module.name}
                    </h3>
                    <p className="mt-1 text-sm font-pregular text-gray-500">
                      {module.submodules.length} submodules
                    </p>
                  </div>
                  <FormControlLabel
                    sx={{ mr: 0 }}
                    control={
                      <Switch
                        checked={Boolean(toggleState[module.name])}
                        onChange={(event) =>
                          handleModuleToggle(
                            module.name,
                            event.target.checked,
                            module.submodules,
                          )
                        }
                      />
                    }
                    label=""
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {module.submodules.map((submodule) => (
                    <div
                      key={submodule}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-content font-pmedium text-gray-800">
                          {submodule}
                        </span>
                        <span className="text-sm font-pregular text-gray-500">
                          Toggle access for this submodule
                        </span>
                      </div>
                      <Switch
                        checked={Boolean(toggleState[`${module.name}::${submodule}`])}
                        onChange={(event) =>
                          handleSubmoduleToggle(
                            module.name,
                            submodule,
                            event.target.checked,
                            module.submodules,
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ModuleAccess;
