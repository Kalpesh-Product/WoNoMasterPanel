import React from "react";
import AgTable from "../../../components/AgTable";

const AllEnquiryTable = () => {
  const columns = [
    { field: "companyName", headerName: "Company Name" },
    { field: "verticalType", headerName: "Vertical Type" },
    { field: "country", headerName: "Country" },
    { field: "state", headerName: "State" },
    { field: "fullName", headerName: "Full Name" },
    { field: "noOfPeople", headerName: "No. Of People" },
    { field: "mobileNumber", headerName: "Mobile Number" },
    { field: "email", headerName: "Email" },
    { field: "startDate", headerName: "Start Date" },
    { field: "endDate", headerName: "End Date" },
    { field: "source", headerName: "Source" },
    { field: "productType", headerName: "Product Type" },
    { field: "submittedAt", headerName: "Submitted At" },
  ];

  const data = []; // Replace with API data later

  return <AgTable data={data} columns={columns} search tableHeight={350} />;
};

export default AllEnquiryTable;
