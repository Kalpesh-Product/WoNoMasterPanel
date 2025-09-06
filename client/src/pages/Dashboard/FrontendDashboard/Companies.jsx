// src/pages/Dashboard/FrontendDashboard/Companies.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";

// ✅ Example data (replace with API later)
const companiesData = [
  { id: "1", name: "MeWo", type: "Cafe", location: "Goa" },
  { id: "2", name: "B Work Bali", type: "Coworking", location: "Bali" },
  { id: "3", name: "The Work Loft", type: "Meeting Room", location: "Bangkok" },
];

// optional helper to make slugs URL-safe
const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");

const Companies = () => {
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Company Name",
        flex: 1,
        cellRenderer: (params) => (
          <span
            onClick={() =>
              navigate(`/dashboard/companies/${slugify(params.data.name)}`)
            }
            className="text-blue-600 hover:underline cursor-pointer">
            {params.value}
          </span>
        ),
      },
      { field: "type", headerName: "Type", flex: 1 },
      { field: "location", headerName: "Location", flex: 1 },
    ],
    [navigate]
  );

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={companiesData}
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
