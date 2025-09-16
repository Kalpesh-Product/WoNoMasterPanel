import React from "react";
import AgTable from "../../../components/AgTable";

const AllPOCContactTable = () => {
  const columns = [
    { field: "pocName", headerName: "POC Name" },
    { field: "pocCompany", headerName: "POC Company" },
    { field: "pocDesignation", headerName: "POC Designation" },
    { field: "fullName", headerName: "Full Name" },
    { field: "mobile", headerName: "Mobile" },
    { field: "email", headerName: "Email" },
    { field: "submittedAt", headerName: "Submitted At" },
  ];

  const data = []; // Replace with API data later

  return <AgTable data={data} columns={columns} search tableHeight={350} />;
};

export default AllPOCContactTable;
