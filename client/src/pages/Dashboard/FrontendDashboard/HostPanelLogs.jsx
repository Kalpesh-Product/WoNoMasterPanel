import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import humanTime from "../../../utils/humanTime";
import { Search, Eye, X, Activity, Building2, Users, FileText, Calendar } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const HostPanelLogs = () => {
  const axios = useAxiosPrivate();
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["host-activity-logs"],
    queryFn: async () => {
      const response = await axios.get("/api/logs/host-activity-logs");
      return response.data || [];
    },
  });

  const rows = useMemo(
    () =>
      (data || []).map((item, index) => ({
        ...item,
        srNo: index + 1,
        companyName: item.companyName || "-",
        workspaceName: item.workspaceName || "-",
        user: item.fullName || item.email || "-",
        date: humanDate(item.createdAt),
        time: humanTime(item.createdAt),
      })),
    [data],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const companies = new Set(rows.map((r) => r.companyName).filter((v) => v && v !== "-")).size;
    const users = new Set(rows.map((r) => r.user).filter((v) => v && v !== "-")).size;
    const modules = new Set(rows.map((r) => r.module).filter(Boolean)).size;
    return { total, companies, users, modules };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || [row.action, row.module, row.companyName, row.workspaceName, row.user, row.email]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      const rowDate = dayjs(row.createdAt);
      const matchesFrom = !dateFrom || rowDate.isSameOrAfter(dayjs(dateFrom).startOf("day"));
      const matchesTo = !dateTo || rowDate.isSameOrBefore(dayjs(dateTo).endOf("day"));
      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [rows, search, dateFrom, dateTo]);

  if (isLoading) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
              <div>
                <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Host Panel Logs</h2>
                <p className="text-xs font-pmedium text-slate-500 mt-1">Track all host panel activity and user actions across workspaces.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
                  <div className="h-5 w-10 bg-slate-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded-full w-16" />
                  <div className="h-3 bg-slate-200 rounded-full w-24" />
                  <div className="h-3 bg-slate-200 rounded-full w-32" />
                  <div className="h-3 bg-slate-200 rounded-full w-20" />
                </div>
              ))}
            </div>
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Host Panel Logs</h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">Track all host panel activity and user actions across workspaces.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {[
              { label: "Total Logs", value: stats.total, icon: Activity, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
              { label: "Companies", value: stats.companies, icon: Building2, accent: "border-l-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
              { label: "Users", value: stats.users, icon: Users, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
              { label: "Modules", value: stats.modules, icon: FileText, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}>
                  <div>
                    <p className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${s.textColor}`}>{s.label}</p>
                    <p className="text-[15px] font-pmedium text-slate-900">{s.value}</p>
                  </div>
                  <div className={`rounded-2xl p-2 ${s.bgColor} ${s.textColor}`}><Icon size={16} /></div>
                </div>
              );
            })}
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input type="text" placeholder="Search action, module, company, user..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-8 pr-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[11px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all" />
                  </div>
                  <span className="text-slate-400 text-[11px]">to</span>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="pl-8 pr-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[11px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all" />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                      className="px-2.5 py-1.5 text-[10px] font-pmedium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Clear</button>
                  )}
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Activity size={28} /></div>
                <p className="text-slate-400 font-semibold font-pmedium">No logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Action</th>
                      <th className="px-5 py-4">Module</th>
                      <th className="px-5 py-4">Company</th>
                      <th className="px-5 py-4">Workspace</th>
                      <th className="px-5 py-4">User</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filtered.map((row) => (
                      <tr key={row._id || row.srNo} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{row.srNo}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedLog(row)}>{row.action || "-"}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.module || "-"}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]">{row.companyName}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[140px]">{row.workspaceName}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.user}</td>
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-5 py-4 text-center">
                          <button type="button" onClick={() => setSelectedLog(row)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all">
                            <Eye size={15} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>

      {selectedLog && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white"><Eye size={16} /></div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">View Host Activity</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{selectedLog.action}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedLog(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                {[
                  ["Action", selectedLog.action],
                  ["Module", selectedLog.module],
                  ["Company", selectedLog.companyName],
                  ["Workspace", selectedLog.workspaceName],
                  ["User", selectedLog.user || selectedLog.fullName],
                  ["Email", selectedLog.email],
                  ["Method", selectedLog.method],
                  ["Status", selectedLog.success === undefined ? null : selectedLog.success ? "Success" : "Failed"],
                  ["Date", selectedLog.createdAt ? `${humanDate(selectedLog.createdAt)} ${humanTime(selectedLog.createdAt)}` : null],
                ]
                  .filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== "-")
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{label}</p>
                      <p className={`text-[12px] font-pmedium ${label === "Status" ? (value === "Success" ? "text-emerald-600" : "text-red-600") : "text-slate-900"}`}>{value}</p>
                    </div>
                  ))}
              </div>

              {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Submitted Data</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                    {Object.entries(selectedLog.payload)
                      .filter(([key]) => !["__v", "_id", "refreshToken", "password"].includes(key))
                      .map(([key, value]) => {
                        if (value === null || value === undefined || value === "") return null;
                        if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value)) return null;
                        const formatted = Array.isArray(value)
                          ? value.filter((v) => !(typeof v === "string" && /^[a-f\d]{24}$/i.test(v))).map((v) => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ")
                          : typeof value === "object" ? JSON.stringify(value) : String(value);
                        if (!formatted) return null;
                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
                        return (
                          <div key={label}>
                            <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{label}</p>
                            <p className="text-[12px] font-pmedium text-slate-900 break-all">{formatted}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setSelectedLog(null)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostPanelLogs;
