import React from "react";
import { useQuery } from "@tanstack/react-query";
import AgTable from "../../../components/AgTable";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";

const API_BASE_URL =
  import.meta.env.VITE_VALUE_ADDS_API_BASE_URL ||
  "https://wononomadsbe.vercel.app";

const ValueAddsLeadsTable = ({ endpoint, queryKey, columns }) => {
  const axios = useAxiosPrivate();

  const { data = [], isPending } = useQuery({
    queryKey: ["valueAddsLeads", queryKey],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`);
      return response?.data?.data || [];
    },
  });

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

export default ValueAddsLeadsTable;
