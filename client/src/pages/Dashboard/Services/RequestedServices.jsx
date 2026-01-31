// src/pages/Dashboard/FrontendDashboard/RequestedServices.jsx
import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import { Chip, CircularProgress, useMediaQuery } from "@mui/material";
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
  const location = useLocation(); // 👈 track current location
  const isPhone = useMediaQuery("(max-width:600px)");

  // ✅ fetch companies from backend
  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companies", location.key], // 👈 include location.key
    queryFn: async () => {
      const res = await axios.get("/api/hosts/companies");
      return res.data;
    },
    refetchOnWindowFocus: true,
  });

  // ✅ transform backend data for table
  // ✅ transform backend data for table
  const tableData = companies
    .map((c) => {
      const allServices = [
        ...(c?.selectedServices?.defaults || []),
        ...(c?.selectedServices?.apps || []),
        ...(c?.selectedServices?.modules || []),
      ];

      const requestedCount = allServices.filter(
        (s) => s.isRequested === true,
      ).length;
      const activeCount = allServices.filter((s) => s.isActive === true).length;

      // 🔹 check if this company has any service with BOTH true
      const hasBothTrue = allServices.some(
        (s) => s.isRequested === true && s.isActive === true,
      );

      // 🟢 Log only if BOTH true exists AND requestedCount > 3 AND requestedCount > activeCount
      if (hasBothTrue && requestedCount > 3 && requestedCount > activeCount) {
        console.log(
          `Company: ${c.companyName} (${c.companyId}) → Requested: ${requestedCount}, Active: ${activeCount}`,
        );
      }

      return {
        id: c._id,
        companyId: c.companyId,
        logo: c.logo,
        companyName: c.companyName,
        noOfServices: requestedCount - activeCount, // 👈 display as difference
        noOfActive: activeCount,
        registration: c.isRegistered ? "Active" : "Inactive",
        _requested: requestedCount, // 👈 keep raw values hidden
        _active: activeCount,
      };
    })
    // ✅ filter companies that satisfy BOTH conditions
    // .filter((c) => c.noOfServices > 3 && c.noOfServices > c.noOfActive);
    .filter((c) => c._requested > 3 && c._requested > c._active);

  // ✅ define table columns
  const columns = useMemo(
    () => [
      {
        field: "logo",
        headerName: "Logo",
        width: 80,
        minWidth: isPhone ? 80 : undefined,
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
        minWidth: isPhone ? 180 : undefined,
        cellRenderer: (params) => (
          <span
            onClick={() =>
              navigate(
                `/dashboard/requested-services/${params.data.companyId}`,
                {
                  state: { companyName: params.data.companyName },
                },
              )
            }
            className="text-blue-600 hover:underline cursor-pointer"
          >
            {params.value}
          </span>
        ),
      },
      {
        field: "noOfServices",
        headerName: "No of Requested Services",
        flex: 1,
        minWidth: isPhone ? 210 : undefined,
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
    [isPhone, navigate],
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
          filterExcludeColumns={["logo"]}
        />
      </PageFrame>
    </div>
  );
};

export default RequestedServices;
