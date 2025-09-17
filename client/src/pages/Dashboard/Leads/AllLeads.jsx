import React, { useState } from "react";
import { Tab, Tabs } from "@mui/material";

// Import your tab components

import AllEnquiryTable from "./AllEnquiryTable";
import AllPOCContactTable from "./AllPOCContactTable";
import ConnectWithUsTable from "./ConnectWithUsTable";
import SignUpTable from "./SignUpTable";
import JobApplicationsTable from "./JobApplicationsTable";

const AllLeads = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabItems = [
    { label: "All Enquiry", component: <AllEnquiryTable /> },
    { label: "All POC Contact", component: <AllPOCContactTable /> },
    { label: "Connect With Us", component: <ConnectWithUsTable /> },
    { label: "Sign Up", component: <SignUpTable /> },
    { label: "Job Applications", component: <JobApplicationsTable /> },
  ];

  return (
    <div className="p-4">
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newVal) => setActiveTab(newVal)}
        variant="fullWidth"
        TabIndicatorProps={{ style: { display: "none" } }}
        sx={{
          backgroundColor: "white",
          borderRadius: 2,
          border: "1px solid #d1d5db",
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: "medium",
            padding: "12px 16px",
            borderRight: "0.1px solid #d1d5db",
          },
          "& .Mui-selected": {
            backgroundColor: "#1E3D73",
            color: "white",
          },
        }}>
        {tabItems.map((tab, index) => (
          <Tab key={index} label={tab.label} />
        ))}
      </Tabs>

      {/* Tab Content */}
      <div className="py-4 bg-white rounded-b-md shadow-sm">
        {tabItems[activeTab]?.component}
      </div>
    </div>
  );
};

export default AllLeads;
