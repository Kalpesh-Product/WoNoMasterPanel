import React from "react";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { useQuery } from "@tanstack/react-query";

const AllEnquiryTable = () => {
  const axios = useAxiosPrivate();

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["leadCompany"],
    queryFn: async () => {
      const response = await axios.get(
        `https://wononomadsbe.vercel.app/api/company/all-leads`,
      );
      return response?.data;
    },
  });

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
    // { field: "submittedAt", headerName: "Submitted At" },
    { field: "createdAt", headerName: "Submitted At" },
  ];

  return (
    <AgTable
      data={data}
      columns={columns}
      search
      tableHeight={350}
      loading={isPending}
    />
  );
};

export default AllEnquiryTable;
