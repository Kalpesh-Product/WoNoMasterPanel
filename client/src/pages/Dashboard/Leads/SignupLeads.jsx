import React from "react";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const SignupLeads = () => {
  const axios = useAxiosPrivate();

  const {
    data: leads = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["signup-leads"],
    queryFn: async () => {
      //   const response = await axios.get("/api/forms/host-users");
      const response = await axios.get(
        "http://localhost:3000/api/forms/host-users",
      );
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    },
  });

  const columns = [
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    { field: "mobile", headerName: "Mobile" },
    { field: "role", headerName: "Role" },
    { field: "goals", headerName: "Goals" },
    { field: "companyName", headerName: "Company" },
    { field: "verticalType", headerName: "Vertical" },
    { field: "country", headerName: "Country" },
    { field: "state", headerName: "State" },
    { field: "city", headerName: "City" },
    { field: "source", headerName: "Source" },
    { field: "formName", headerName: "Form" },
    {
      field: "createdAt",
      headerName: "Created At",
      valueGetter: (params) =>
        params.data?.createdAt
          ? new Date(params.data.createdAt).toLocaleString()
          : "-",
    },
  ];

  return (
    <AgTable
      data={leads}
      columns={columns}
      search
      tableHeight={500}
      loading={isPending}
      error={isError}
      tableTitle="Signup Leads"
    />
  );
};

export default SignupLeads;
