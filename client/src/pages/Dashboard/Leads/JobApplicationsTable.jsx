import React, { useMemo, useState } from "react";
import { Search, Briefcase, Users, FileText } from "lucide-react";

const JobApplicationsTable = () => {
  const [search, setSearch] = useState("");

  const columns = [
    { field: "jobPosition", headerName: "Position" },
    { field: "name", headerName: "Name" },
    { field: "email", headerName: "Email" },
    { field: "mobileNumber", headerName: "Phone" },
    { field: "location", headerName: "Location" },
    { field: "experience", headerName: "Experience" },
    { field: "resumeLink", headerName: "Resume" },
    { field: "submissionDate", headerName: "Submitted" },
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
        {[
          { label: "Total Applications", value: data.length, icon: Briefcase, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
          { label: "Showing", value: filtered.length, icon: Users, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
          { label: "With Resume", value: data.filter((r) => r.resumeLink).length, icon: FileText, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
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

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Search applications..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Briefcase size={28} /></div>
            <p className="text-slate-400 font-semibold font-pmedium">No job applications yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-4">Position</th>
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Experience</th>
                  <th className="px-5 py-4">Resume</th>
                  <th className="px-5 py-4">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {filtered.map((row, ri) => (
                  <tr key={ri} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-900">{row.jobPosition || "--"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                          {(row.name || "J").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-pmedium text-slate-900">{row.name || "--"}</p>
                          <p className="text-[10px] font-pmedium text-slate-500">{row.email || "--"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.mobileNumber || "--"}</td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.location || "--"}</td>
                    <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.experience ? `${row.experience} yrs` : "--"}</td>
                    <td className="px-5 py-4">
                      {row.resumeLink ? (
                        <a href={row.resumeLink} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-pmedium text-blue-600 hover:text-blue-800 underline">View</a>
                      ) : (
                        <span className="text-[11px] font-pmedium text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">{row.submissionDate || "--"}</td>
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

export default JobApplicationsTable;
