// src/pages/Dashboard/FrontendDashboard/RequestedServices.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import { Chip } from "@mui/material";

// ✅ helper to make slugs URL-safe
const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

// ✅ hardcoded data
const requestedServicesData = [
  {
    id: 1,
    logo: "https://via.placeholder.com/40",
    companyName: "Alpha Tech",
    noOfServices: 5,
    registration: "Active",
  },
  {
    id: 2,
    logo: "https://via.placeholder.com/40",
    companyName: "Beta Solutions",
    noOfServices: 8,
    registration: "Inactive",
  },
  {
    id: 3,
    logo: "https://via.placeholder.com/40",
    companyName: "Gamma Group",
    noOfServices: 3,
    registration: "Active",
  },
  {
    id: 4,
    logo: "https://via.placeholder.com/40",
    companyName: "Delta Enterprises",
    noOfServices: 10,
    registration: "Inactive",
  },
];

const RequestedServices = () => {
  const navigate = useNavigate();

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
              navigate(`/dashboard/requested-services/${params.data.id}`, {
                state: { companyName: params.data.companyName },
              })
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

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={requestedServicesData}
          columns={columns}
          search={true}
          tableTitle={"Requested Services"}
          tableHeight={500}
          //   buttonTitle={"Add Request"}
          handleClick={() => navigate("add-request")}
        />
      </PageFrame>
    </div>
  );
};

export default RequestedServices;
