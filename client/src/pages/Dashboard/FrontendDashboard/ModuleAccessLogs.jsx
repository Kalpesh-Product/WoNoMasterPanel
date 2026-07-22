import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import { Search, Eye, X, Shield, Building2, UserCheck, Calendar } from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const ModuleAccessLogs = () => {
  const axios = useAxiosPrivate();
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["module-access-logs"],
    queryFn: async () => {
      const response = await axios.get("/api/logs/module-access-logs");
      return response.data || [];
    },
  });

  const rows = useMemo(
    () =>
      (data || []).map((item, index) => ({
        ...item,
        srNo: index + 1,
        panel: item.sourcePanel === "host_panel" ? "Host Panel" : "Master Panel",
        hostCompany: item.hostCompany || "-",
        givenBy: item.actorName || item.actorEmail || "-",
        target: item.targetName || item.targetId || "-",
        workspace: item.workspaceName || item.workspaceId || "-",
        enabledCount: Number(item?.enabledCount ?? item?.changes?.enabledCount ?? 0),
        disabledCount: Number(item?.disabledCount ?? item?.changes?.disabledCount ?? 0),
        enabledModules: item?.enabledModules || item?.changes?.enabledModules || [],
        disabledModules: item?.disabledModules || item?.changes?.disabledModules || [],
        date: humanDate(item.createdAt),
      })),
    [data],
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const companies = new Set(rows.map((r) => r.hostCompany).filter((v) => v && v !== "-")).size;
    const totalEnabled = rows.reduce((sum, r) => sum + r.enabledCount, 0);
    const totalDisabled = rows.reduce((sum, r) => sum + r.disabledCount, 0);
    return { total, companies, totalEnabled, totalDisabled };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || [row.panel, row.hostCompany, row.givenBy, row.target, row.workspace]
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
                <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Module Access Logs</h2>
                <p className="text-xs font-pmedium text-slate-500 mt-1">Monitor module access changes across host companies and workspaces.</p>
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
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Module Access Logs</h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">Monitor module access changes across host companies and workspaces.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {[
              { label: "Total Changes", value: stats.total, icon: Shield, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
              { label: "Companies", value: stats.companies, icon: Building2, accent: "border-l-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
              { label: "Enabled", value: stats.totalEnabled, icon: UserCheck, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
              { label: "Disabled", value: stats.totalDisabled, icon: Eye, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
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
                  <input type="text" placeholder="Search panel, company, target, workspace..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Shield size={28} /></div>
                <p className="text-slate-400 font-semibold font-pmedium">No logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[1100px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Panel</th>
                      <th className="px-5 py-4">Host Company</th>
                      <th className="px-5 py-4">Given By</th>
                      <th className="px-5 py-4">Target</th>
                      <th className="px-5 py-4">Workspace</th>
                      <th className="px-5 py-4 text-center">Enabled</th>
                      <th className="px-5 py-4 text-center">Disabled</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filtered.map((row) => (
                      <tr key={row._id || row.srNo} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{row.srNo}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${row.panel === "Host Panel" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {row.panel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]">{row.hostCompany}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]">{row.givenBy}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[140px]">{row.target}</td>
                        <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[140px]">{row.workspace}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-pmedium">{row.enabledCount}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-600 text-[11px] font-pmedium">{row.disabledCount}</span>
                        </td>
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-5 py-4 text-center">
                          <button type="button" onClick={() => setSelectedRow(row)}
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

      {selectedRow && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedRow(null)}>
          <div className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white"><Eye size={16} /></div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">Module Access Changes</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{selectedRow.hostCompany}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                {[
                  ["Panel", selectedRow.panel],
                  ["Host Company", selectedRow.hostCompany],
                  ["Given By", selectedRow.givenBy],
                  ["Target", selectedRow.target],
                  ["Workspace", selectedRow.workspace],
                  ["Date", selectedRow.createdAt ? humanDate(selectedRow.createdAt) : "-"],
                  ["Enabled Count", selectedRow.enabledCount],
                  ["Disabled Count", selectedRow.disabledCount],
                ].filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== "-")
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{label}</p>
                      <p className="text-[12px] font-pmedium text-slate-900">{value}</p>
                    </div>
                  ))}
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Enabled Modules</h3>
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[12px] font-pmedium text-slate-700">
                    {selectedRow.enabledModules?.length ? selectedRow.enabledModules.join(", ") : "None"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-red-600 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Disabled Modules</h3>
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[12px] font-pmedium text-slate-700">
                    {selectedRow.disabledModules?.length ? selectedRow.disabledModules.join(", ") : "None"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setSelectedRow(null)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleAccessLogs;
