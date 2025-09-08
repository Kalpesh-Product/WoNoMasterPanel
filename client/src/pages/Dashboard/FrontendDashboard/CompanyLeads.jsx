import React from "react";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import PageFrame from "../../../components/Pages/PageFrame";

const CompanyLeads = () => {
  const columns = [
    {
      field: "srNo",
      headerName: "SrNo",
      flex: 1,
    },
    {
      field: "leadName",
      headerName: "Lead Name",
      flex: 1,
    },
    {
      field: "noOfPeople",
      headerName: "People Count",
      flex: 1,
    },
    {
      field: "mobileNumber",
      headerName: "People Count",
      flex: 1,
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1,
    },
    {
      field: "startDate",
      headerName: "Start Date",
      flex: 1,
    },
    {
      field: "endDate",
      headerName: "End Date",
      flex: 1,
    },
    {
      field: "recievedDate",
      headerName: "Recieved Date",
      flex: 1,
    },
  ];
  return (
    <div className="p-4">
      <PageFrame>
        <YearWiseTable  tableTitle={"Leads"} columns={columns} />
      </PageFrame>
    </div>
  );
};

export default CompanyLeads;
