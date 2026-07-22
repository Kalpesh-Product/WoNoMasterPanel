import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { Search, Users, Mail, Building2 } from "lucide-react";
import dayjs from "dayjs";

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

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
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
                <p className="text-[15px] font-pmedium text-slate-900">
                  {isPending ? <span className="inline-block h-5 w-12 bg-slate-200 rounded-lg animate-pulse" /> : s.value}
                </p>
              </div>
              <div className={`p-2 rounded-2xl ${s.bgColor} ${s.textColor} shrink-0`}><Icon size={16} /></div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Search POCs..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
          </div>
        </div>

        {isPending ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-9 w-9 bg-slate-200 rounded-2xl shrink-0" />
                {Array.from({ length: 3 }).map((_, ci) => (
                  <div key={ci} className="h-3 bg-slate-200 rounded-full" style={{ width: `${60 + ci * 24}px` }} />
                ))}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Users size={28} /></div>
            <p className="text-slate-400 font-semibold font-pmedium">No POC contacts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Company</th>
                  <th className="px-5 py-4">Designation</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {filtered.map((row, ri) => (
                  <tr key={row._id || ri} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                          {(row.name || "P").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                        </div>
                        <span className="text-[12px] font-pmedium text-slate-900 truncate max-w-[160px]">{row.name || "--"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]" title={row.companyName}>{row.companyName}</td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.designation || "--"}</td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600 truncate max-w-[180px]" title={row.email}>{row.email || "--"}</td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">{row.submittedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllPOCContactTable;
