import React from "react";
import YearWiseTable from "../../../components/Tables/YearWiseTable";
import PageFrame from "../../../components/Pages/PageFrame";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";


const CompanyLeads = () => {
  const selectedCompany = useSelector((state) => state.company.selectedCompany);
  const axios = useAxiosPrivate()
  console.log("selected : sadas", selectedCompany);
  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["leadCompany"],
    enabled: !!selectedCompany,
    queryFn: async () => {
      const response = await axios.get(
        `/api/company/leads?companyId=${selectedCompany?._id}`
      );
      return response?.data;
    },
  });
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
  if (isPending) return <>Loading Leads</>;
  if (isError) return <span className="text-red-500">Error Loading Leads</span>;
  return (
    <div className="p-4">
      <PageFrame>
        <YearWiseTable tableTitle={"Leads"} columns={columns} />
      </PageFrame>
    </div>
  );
};

export default CompanyLeads;
