// src/pages/Dashboard/FrontendDashboard/Companies.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";

// ✅ helper to make slugs URL-safe
const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const Companies = () => {
  const navigate = useNavigate();
  const axiosPrivate = useAxiosPrivate();

  // ✅ fetch companies from API
  const {
    data: companies = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["companiesList"],
    queryFn: async () => {
      try {
        const response = await axiosPrivate.get(
          "/api/hosts/get-company-listings"
        );
        return response.data; // backend should return an array of companies
      } catch (error) {
        throw new Error(
          error.response?.data?.message || "Failed to fetch companies"
        );
      }
    },
  });

  // ✅ define columns with logo, name, type, location
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
                `/dashboard/companies/${slugify(params.data.companyName)}`
              )
            }
            className="text-blue-600 hover:underline cursor-pointer">
            {params.value}
          </span>
        ),
      },
      { field: "companyType", headerName: "Type", flex: 1 },
      {
        field: "location",
        headerName: "Location",
        flex: 1,
        valueGetter: (params) =>
          `${params.data.city || ""}, ${params.data.country || ""}`,
      },
    ],
    [navigate]
  );

  if (isLoading) return <div className="p-6">Loading companies…</div>;
  if (isError)
    return <div className="p-6 text-red-500">Failed to load companies.</div>;

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={companies}
          columns={columns}
          search={true}
          tableTitle={"Companies"}
          tableHeight={500}
        />
      </PageFrame>
    </div>
  );
};

export default Companies;
