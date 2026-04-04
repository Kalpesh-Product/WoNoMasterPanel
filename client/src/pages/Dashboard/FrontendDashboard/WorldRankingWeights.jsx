import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const WORLD_RANKING_ENDPOINT = "http://localhost:3000/api/world-ranking/all";

const toRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const fmtNumber = (value, digits = 2) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(digits);
};

const WorldRankingWeights = () => {
  const axios = useAxiosPrivate();

  const {
    data: rows = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["world-ranking-weights"],
    queryFn: async () => {
      const response = await axios.get(WORLD_RANKING_ENDPOINT);
      return toRows(response.data);
    },
  });

  const rowData = useMemo(
    () =>
      rows.map((item, index) => ({
        srNo: index + 1,
        ...item,
      })),
    [rows],
  );

  const columns = useMemo(
    () => [
      { field: "srNo", headerName: "Sr No", width: 90 },
      { field: "rank", headerName: "Rank", width: 90 },
      { field: "country", headerName: "Country", minWidth: 140 },
      {
        field: "destination",
        headerName: "State / Destination",
        minWidth: 170,
      },
      { field: "continent", headerName: "Continent", minWidth: 130 },
      {
        field: "overallScore",
        headerName: "Overall Score",
        minWidth: 130,
        valueFormatter: (params) => fmtNumber(params.value, 3),
      },
      {
        headerName: "Cost of Living Score",
        minWidth: 170,
        valueGetter: (params) => params.data?.scores?.costOfLiving,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Cost of Living Weight",
        minWidth: 170,
        valueGetter: (params) => params.data?.weights?.costOfLiving,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Internet Score",
        minWidth: 140,
        valueGetter: (params) => params.data?.scores?.internet,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Internet Weight",
        minWidth: 140,
        valueGetter: (params) => params.data?.weights?.internet,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Work Infra Score",
        minWidth: 150,
        valueGetter: (params) => params.data?.scores?.workInfrastructure,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Work Infra Weight",
        minWidth: 150,
        valueGetter: (params) => params.data?.weights?.workInfrastructure,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Safety Score",
        minWidth: 130,
        valueGetter: (params) => params.data?.scores?.safety,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Safety Weight",
        minWidth: 130,
        valueGetter: (params) => params.data?.weights?.safety,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Visa Flexibility Score",
        minWidth: 180,
        valueGetter: (params) => params.data?.scores?.visaFlexibility,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Visa Flexibility Weight",
        minWidth: 180,
        valueGetter: (params) => params.data?.weights?.visaFlexibility,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Nomad Community Score",
        minWidth: 190,
        valueGetter: (params) => params.data?.scores?.nomadCommunity,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Nomad Community Weight",
        minWidth: 190,
        valueGetter: (params) => params.data?.weights?.nomadCommunity,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Healthcare Cost Score",
        minWidth: 190,
        valueGetter: (params) => params.data?.scores?.healthcareCostIndex,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Healthcare Cost Weight",
        minWidth: 190,
        valueGetter: (params) => params.data?.weights?.healthcareCostIndex,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Startup Ecosystem Score",
        minWidth: 190,
        valueGetter: (params) => params.data?.scores?.startupEcosystemScore,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Startup Ecosystem Weight",
        minWidth: 190,
        valueGetter: (params) => params.data?.weights?.startupEcosystemScore,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
      {
        headerName: "Air Quality Score",
        minWidth: 150,
        valueGetter: (params) => params.data?.scores?.airQualityIndex,
        valueFormatter: (params) => fmtNumber(params.value),
      },
      {
        headerName: "Air Quality Weight",
        minWidth: 150,
        valueGetter: (params) => params.data?.weights?.airQualityIndex,
        valueFormatter: (params) => fmtNumber(params.value, 2),
      },
    ],
    [],
  );

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={rowData}
          columns={columns}
          search
          tableTitle="World Ranking Weights"
          tableHeight={550}
          loading={isPending}
        />
        {isError ? (
          <p className="pt-3 text-sm text-red-500">
            Could not load world ranking data. Please verify World Ranking API
            connectivity.
          </p>
        ) : null}
      </PageFrame>
    </div>
  );
};

export default WorldRankingWeights;
