import React from "react";
import AgTable from "../../../components/AgTable";

const SignUpTable = () => {
  const columns = [
    { field: "firstName", headerName: "First Name" },
    { field: "lastName", headerName: "Last Name" },
    { field: "email", headerName: "Email" },
    { field: "password", headerName: "Password" },
    { field: "country", headerName: "Country" },
    { field: "mobile", headerName: "Mobile" },
    { field: "reasonForSignup", headerName: "Reason For Signup" },
    { field: "submittedAt", headerName: "Submitted At" },
  ];

  const data = []; // Replace with API data later

  return <AgTable data={data} columns={columns} search tableHeight={350} />;
};

export default SignUpTable;
