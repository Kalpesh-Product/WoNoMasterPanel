import React from "react";
import AgTable from "../../../components/AgTable";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import dayjs from "dayjs";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const AllPOCContactTable = () => {
  const axios = useAxiosPrivate();

  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["poc"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/poc/poc`);
      return response?.data;
    },
  });

  const transformData = data.map((data) => ({
    ...data,
    companyName: data?.company?.companyName || "",
    name: data.name,
    submittedAt: dayjs(data.createdAt).format("DD-MM-YYYY"),
  }));

  const columns = [
    { field: "name", headerName: "POC Name" },
    { field: "companyName", headerName: "POC Company" },
    { field: "designation", headerName: "POC Designation" },
    // { field: "mobile", headerName: "Mobile" },
    { field: "email", headerName: "Email" },
    { field: "submittedAt", headerName: "Submitted At" },
  ];

  return (
    <AgTable
      tableTitle={"All POC Contact"}
      data={transformData}
      columns={columns}
      search
      tableHeight={350}
      loading={isPending}
    />
  );
};

export default AllPOCContactTable;
