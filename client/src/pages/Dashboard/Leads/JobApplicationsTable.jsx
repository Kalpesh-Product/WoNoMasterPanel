import React from "react";
import AgTable from "../../../components/AgTable";

const JobApplicationsTable = () => {
  const columns = [
    { field: "jobPosition", headerName: "Job Position" },
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    { field: "dob", headerName: "Date of Birth" },
    { field: "mobileNumber", headerName: "Mobile Number" },
    { field: "location", headerName: "Location" },
    { field: "experience", headerName: "Experience (in years)" },
    { field: "linkedin", headerName: "LinkedIn Profile URL" },
    { field: "currentSalary", headerName: "Current Monthly Salary" },
    { field: "expectedSalary", headerName: "Expected Monthly Salary" },
    { field: "joiningTime", headerName: "How Soon You Can Join (Days)" },
    { field: "relocate", headerName: "Will You Relocate to Goa (Yes/No)" },
    { field: "personality", headerName: "Who are you as a person" },
    { field: "skills", headerName: "What skill sets do you have" },
    { field: "whyConsider", headerName: "Why should we consider you" },
    { field: "bootstrap", headerName: "Are you willing to bootstrap" },
    { field: "message", headerName: "Message" },
    { field: "submissionDate", headerName: "Submission Date" },
    { field: "submissionTime", headerName: "Submission Time" },
    { field: "resumeLink", headerName: "Resume Link" },
    { field: "remarks", headerName: "Remarks" },
  ];

  const data = []; // Replace with API data later

  return <AgTable data={data} columns={columns} search tableHeight={350} />;
};

export default JobApplicationsTable;
