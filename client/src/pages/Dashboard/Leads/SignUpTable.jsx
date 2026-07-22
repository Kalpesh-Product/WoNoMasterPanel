import React, { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

const SignUpTable = () => {
  const [search, setSearch] = useState("");

  const columns = [
    { field: "firstName", headerName: "First Name" },
    { field: "lastName", headerName: "Last Name" },
    { field: "email", headerName: "Email" },
    { field: "country", headerName: "Country" },
    { field: "mobile", headerName: "Mobile" },
    { field: "reasonForSignup", headerName: "Reason" },
    { field: "submittedAt", headerName: "Submitted" },
  ];

  const data = [];

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(row[col.field] ?? "").toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Search signups..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Users size={28} /></div>
            <p className="text-slate-400 font-semibold font-pmedium">No signups yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  {columns.map((col) => (
                    <th key={col.field} className="px-5 py-4">{col.headerName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {filtered.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                          {((row.firstName || "") + " " + (row.lastName || "")).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "SU"}
                        </div>
                        <span className="text-[12px] font-pmedium text-slate-900">{row.firstName || "--"} {row.lastName || ""}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600 truncate max-w-[180px]">{row.email || "--"}</td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.country || "--"}</td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.mobile || "--"}</td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-600 truncate max-w-[200px]" title={row.reasonForSignup}>{row.reasonForSignup || "--"}</td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">{row.submittedAt || "--"}</td>
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

export default SignUpTable;
