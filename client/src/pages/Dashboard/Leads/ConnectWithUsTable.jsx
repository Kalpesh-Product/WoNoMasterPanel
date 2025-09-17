import React from "react";
import AgTable from "../../../components/AgTable";

const ConnectWithUsTable = () => {
  const columns = [
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    { field: "mobile", headerName: "Mobile" },
    { field: "typeOfPartnership", headerName: "Type Of Partnership" },
    { field: "message", headerName: "Message" },
    { field: "submittedAt", headerName: "Submitted At" },
  ];

  const data = []; // Replace with API data later

  return <AgTable data={data} columns={columns} search tableHeight={350} />;
};

export default ConnectWithUsTable;
