import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_BACKEND_URL } from "../../../constants/api";
import { Search, Target, Clock, Users, Eye, X, Phone, Mail, MessageSquare, Calendar } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_VALUE_ADDS_API_BASE_URL || NOMADS_BACKEND_URL;

function formatDateLabel(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const ValueAddsLeadsTable = ({ endpoint, queryKey, columns }) => {
  const axios = useAxiosPrivate();
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  const { data = [], isPending } = useQuery({
    queryKey: ["valueAddsLeads", queryKey],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`);
      return response?.data?.data || [];
    },
  });

  const title = queryKey
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        String(row[col.field] ?? "").toLowerCase().includes(q),
      ),
    );
  }, [data, search, columns]);

  const thisWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return data.filter((r) => r.createdAt && new Date(r.createdAt) >= d).length;
  }, [data]);

  const displayColumns = useMemo(() => {
    if (columns.length <= 5) return columns;
    const skip = ["contactCode", "comments", "message"];
    const shown = columns.filter((c) => !skip.includes(c.field));
    return shown.length >= 3 ? shown.slice(0, 5) : columns.slice(0, 5);
  }, [columns]);

  const getName = (row) => row.fullName || row.name || "--";
  const getEmail = (row) => row.email || "--";
  const getPhone = (row) => row.contactNumber || row.mobileNumber || "--";

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
        {[
          { label: `Total ${title}`, value: data.length, icon: Target, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
          { label: "This Week", value: thisWeek, icon: Clock, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
          { label: "Showing", value: filtered.length, icon: Users, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}
            >
              <div className="min-w-0">
                <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${s.textColor || "text-slate-400"}`}>
                  {s.label}
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">
                  {isPending ? (
                    <span className="inline-block h-5 w-12 bg-slate-200 rounded-lg animate-pulse" />
                  ) : (
                    s.value
                  )}
                </p>
              </div>
              <div className={`p-2 rounded-2xl ${s.bgColor || "bg-slate-50"} ${s.textColor || "text-slate-600"} shrink-0`}>
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50/50">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {isPending ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-9 w-9 bg-slate-200 rounded-2xl shrink-0" />
                {Array.from({ length: 4 }).map((_, ci) => (
                  <div key={ci} className="h-3 bg-slate-200 rounded-full" style={{ width: `${50 + ci * 16}px` }} />
                ))}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <Target size={28} />
            </div>
            <p className="text-slate-400 font-semibold font-pmedium">No matching leads found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Contact</th>
                  {displayColumns.filter((c) => !["fullName", "email", "contactNumber", "mobileNumber", "contactCode", "comments", "message"].includes(c.field)).slice(0, 2).map((col) => (
                    <th key={col.field} className="px-5 py-4">{col.headerName}</th>
                  ))}
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {filtered.map((row, ri) => (
                  <tr key={row.id || ri} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                          {getName(row).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "LD"}
                        </div>
                        <span className="text-[12px] font-pmedium text-slate-900 truncate max-w-[160px]">{getName(row)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[11px] font-pmedium text-slate-600 space-y-0.5">
                        <p className="flex items-center gap-1"><Phone size={10} className="text-slate-400" />{getPhone(row)}</p>
                        <p className="flex items-center gap-1"><Mail size={10} className="text-slate-400" />{getEmail(row)}</p>
                      </div>
                    </td>
                    {displayColumns.filter((c) => !["fullName", "email", "contactNumber", "mobileNumber", "contactCode", "comments", "message"].includes(c.field)).slice(0, 2).map((col) => (
                      <td key={col.field} className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]" title={String(row[col.field] ?? "")}>
                        {row[col.field] ?? "--"}
                      </td>
                    ))}
                    <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                      {formatDateLabel(row.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRow(row)}
                        title="View details"
                        className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                      >
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

      {selectedRow && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedRow(null)}>
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  {getName(selectedRow).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "LD"}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">{getName(selectedRow)}</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{title}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <Phone size={14} /> Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1 flex items-center gap-1"><Phone size={10} /> Phone</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{getPhone(selectedRow)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1 flex items-center gap-1"><Mail size={10} /> Email</p>
                    <p className="text-[12px] font-pmedium text-slate-900 break-all">{getEmail(selectedRow)}</p>
                  </div>
                </div>
              </div>

              {(() => {
                const relevantCols = columns.filter((c) => !["fullName", "email", "contactNumber", "mobileNumber", "contactCode", "name"].includes(c.field));
                if (!relevantCols.length) return null;
                return (
                  <div>
                    <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <Calendar size={14} /> Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      {relevantCols.map((col) => (
                        <div key={col.field}>
                          <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{col.headerName}</p>
                          <p className="text-[12px] font-pmedium text-slate-900">
                            {col.field === "createdAt" ? formatDateLabel(selectedRow[col.field]) : String(selectedRow[col.field] ?? "--")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const msg = selectedRow.comments || selectedRow.message;
                if (!msg) return null;
                return (
                  <div>
                    <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <MessageSquare size={14} /> Message
                    </h3>
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[12px] font-pmedium leading-5 text-slate-700">{msg}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setSelectedRow(null)}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValueAddsLeadsTable;
