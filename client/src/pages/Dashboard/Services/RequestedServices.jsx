// src/pages/Dashboard/FrontendDashboard/RequestedServices.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import { Chip, CircularProgress } from "@mui/material";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

// ✅ helper to make slugs URL-safe (kept, if needed later)
const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const RequestedServices = () => {
  const navigate = useNavigate();
  const axios = useAxiosPrivate();

  // ✅ fetch companies from backend
  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await axios.get("/api/hosts/companies");
      return res.data;
    },
  });

  // ✅ transform backend data for table
  const tableData = companies.map((c) => {
    const noOfServices = [
      ...(c?.selectedServices?.defaults || []),
      ...(c?.selectedServices?.apps || []),
      ...(c?.selectedServices?.modules || []),
    ].filter((s) => s.isRequested).length; // ✅ count only active

    return {
      id: c._id, // still needed for React key
      companyId: c.companyId, // ✅ for navigation + API
      logo: c.logo,
      companyName: c.companyName,
      noOfServices,
      registration: c.isRegistered ? "Active" : "Inactive",
    };
  });

  // ✅ define table columns
  const columns = useMemo(
    () => [
      {
        field: "logo",
        headerName: "Logo",
        width: 80,
        cellRenderer: (params) =>
          params.value ? (
            <img
              src={params.value}
              alt="logo"
              className="h-10 w-10 object-contain rounded"
            />
          ) : (
            "-"
          ),
      },
      {
        field: "companyName",
        headerName: "Company Name",
        flex: 1,
        cellRenderer: (params) => (
          <span
            onClick={() =>
              navigate(
                `/dashboard/requested-services/${params.data.companyId}`,
                {
                  state: { companyName: params.data.companyName },
                }
              )
            }
            className="text-blue-600 hover:underline cursor-pointer">
            {params.value}
          </span>
        ),
      },
      {
        field: "noOfServices",
        headerName: "No of Services",
        flex: 1,
      },
      // {
      //   field: "registration",
      //   headerName: "Registration",
      //   flex: 1,
      //   cellRenderer: (params) => {
      //     const value = params.value;
      //     const statusColorMap = {
      //       Active: { backgroundColor: "#90EE90", color: "#006400" },
      //       Inactive: { backgroundColor: "#FFC5C5", color: "#8B0000" },
      //     };
      //     const { backgroundColor, color } = statusColorMap[value] || {
      //       backgroundColor: "gray",
      //       color: "white",
      //     };

      //     return (
      //       <Chip
      //         label={value}
      //         style={{ backgroundColor, color }}
      //         size="small"
      //       />
      //     );
      //   },
      // },
    ],
    [navigate]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress />
      </div>
    );
  }

  if (isError) {
    return <div className="p-4 text-red-500">Failed to load companies</div>;
  }

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={tableData}
          columns={columns}
          search={true}
          tableTitle={"Requested Services"}
          tableHeight={500}
          // buttonTitle={"Add Request"}
          handleClick={() => navigate("add-request")}
        />
      </PageFrame>
    </div>
  );
};

export default RequestedServices;
