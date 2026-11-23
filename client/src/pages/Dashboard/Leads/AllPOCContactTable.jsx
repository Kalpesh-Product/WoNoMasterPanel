import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { Users, Mail, Building2 } from "lucide-react";
import dayjs from "dayjs";
import { AllPOCContactTableSkeleton } from "../../../components/ui/Skeleton";
import DataTable from "../../../components/Tables/DataTable";

const AllPOCContactTable = () => {
  const axios = useAxiosPrivate();
  const [search, setSearch] = useState("");

  const { data = [], isPending } = useQuery({
    queryKey: ["poc"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/poc/poc`);
      return response?.data || [];
    },
  });

  const transformed = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        companyName: item?.company?.companyName || "--",
        submittedAt: dayjs(item.createdAt).format("MMM DD, YYYY"),
      })),
    [data],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return transformed;
    const q = search.toLowerCase();
    return transformed.filter((row) =>
      [row.name, row.companyName, row.designation, row.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [transformed, search]);

  if (isPending) {
    return <AllPOCContactTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div data-tour="poc-quick-stats" className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
        {[
          { label: "Total POCs", value: data.length, icon: Users, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
          { label: "Companies", value: new Set(transformed.map((r) => r.companyName).filter((v) => v && v !== "--")).size, icon: Building2, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
          { label: "Showing", value: filtered.length, icon: Mail, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}>
              <div className="min-w-0">
                <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${s.textColor}`}>{s.label}</p>
                <p className="text-[15px] font-pmedium text-slate-900">{s.value}</p>
              </div>
              <div className={`p-2 rounded-2xl ${s.bgColor} ${s.textColor} shrink-0`}><Icon size={16} /></div>
            </div>
          );
        })}
      </div>

      <DataTable
        rows={filtered}
        rowKey={(row, index) => row._id || index}
        minWidth={900}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search POCs..."
        searchWrapperProps={{ "data-tour": "poc-search" }}
        emptyText="No POC contacts found."
        emptyIcon={Users}
        tableProps={{ "data-tour": "poc-table" }}
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                  {(row.name || "P").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                </div>
                <span className="max-w-[160px] truncate text-[12px] font-pmedium text-slate-900">
                  {row.name || "--"}
                </span>
              </div>
            ),
          },
          {
            key: "companyName",
            header: "Company",
            render: (row) => (
              <span className="block max-w-[180px] truncate text-slate-700" title={row.companyName}>
                {row.companyName}
              </span>
            ),
          },
          {
            key: "designation",
            header: "Designation",
            render: (row) => row.designation || "--",
          },
          {
            key: "email",
            header: "Email",
            render: (row) => (
              <span className="block max-w-[200px] truncate text-[11px] text-slate-600" title={row.email}>
                {row.email || "--"}
              </span>
            ),
          },
          {
            key: "submittedAt",
            header: "Submitted",
            render: (row) => (
              <span className="text-[11px] text-slate-500">{row.submittedAt}</span>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AllPOCContactTable;
