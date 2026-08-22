import { useMemo, useState } from "react";
import { BriefcaseBusiness, Calendar, Eye, Mail, Phone, Search, Target, Users, X } from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";
import { ValueAddsLeadsTableSkeleton } from "../../../components/ui/Skeleton";

const formatDateLabel = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const initials = (value) =>
  String(value || "VP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const ValueAddsPartnersTable = ({
  title,
  rows = [],
  columns = [],
  isLoading = false,
  isError = false,
  errorMessage = "",
  emptyMessage = "No matching partners found.",
  tableLabels = {},
  locationColumns,
  splitContact = false,
  companyAfterContact = false,
  tableColumns,
}) => {
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);

  const exactTableColumns = Array.isArray(tableColumns) && tableColumns.length ? tableColumns : null;
  const locationColumnDefs = locationColumns || [
    { field: "region", headerName: tableLabels.region || "Region" },
  ];
  const contactColumnCount = splitContact ? 2 : 1;
  const tableColumnCount = exactTableColumns
    ? exactTableColumns.length + 1
    : 5 + locationColumnDefs.length + contactColumnCount;

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const query = search.toLowerCase();
    return rows.filter((row) =>
      columns.some((column) =>
        String(row[column.field] ?? "").toLowerCase().includes(query),
      ),
    );
  }, [columns, rows, search]);

  const activeCount = rows.filter((row) => row.status === "Active").length;
  const pendingCount = rows.filter((row) => row.status === "Pending").length;

  if (isLoading) {
    return <ValueAddsLeadsTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 text-slate-700 font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-1 shrink-0">
        {[
          { label: `Total ${title}`, value: rows.length, icon: Target, accent: "border-l-slate-400", textColor: "text-slate-500", bgColor: "bg-slate-50" },
          { label: "Active", value: activeCount, icon: Users, accent: "border-l-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
          { label: "Pending", value: pendingCount, icon: Calendar, accent: "border-l-amber-500", textColor: "text-amber-600", bgColor: "bg-amber-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 shadow-sm flex justify-between items-center transition-all hover:shadow-md ${item.accent}`}
            >
              <div className="min-w-0">
                <p className={`text-[10px] font-pmedium uppercase tracking-widest mb-1 ${item.textColor}`}>
                  {item.label}
                </p>
                <p className="text-[15px] font-pmedium text-slate-900">{item.value}</p>
              </div>
              <div className={`p-2 rounded-2xl ${item.bgColor} ${item.textColor} shrink-0`}>
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
              placeholder={`Search ${title.toLowerCase()} partners...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-400">
              <Target size={28} />
            </div>
            <p className="font-pmedium text-sm text-rose-500">Unable to load {title.toLowerCase()} partners.</p>
            {errorMessage ? (
              <p className="mt-1 max-w-xl text-[11px] font-pmedium text-slate-400">{errorMessage}</p>
            ) : null}
          </div>
        ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
              {exactTableColumns ? (
                <tr>
                  {exactTableColumns.map((column) => (
                    <th key={column.field} className="px-5 py-4">{column.headerName}</th>
                  ))}
                  <th className="px-5 py-4 text-center">Action</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-5 py-4">Partner</th>
                  {!companyAfterContact ? (
                    <th className="px-5 py-4">{tableLabels.company || "Company"}</th>
                  ) : null}
                  {locationColumnDefs.map((column) => (
                    <th key={column.field} className="px-5 py-4">{column.headerName}</th>
                  ))}
                  {splitContact ? (
                    <>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Contact</th>
                    </>
                  ) : (
                    <th className="px-5 py-4">Contact</th>
                  )}
                  {companyAfterContact ? (
                    <th className="px-5 py-4">{tableLabels.company || "Company"}</th>
                  ) : null}
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4">Last Updated</th>
                  <th className="px-5 py-4 text-center">Action</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="text-center py-20 text-slate-400 font-pmedium">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                    {exactTableColumns ? (
                      <>
                        {exactTableColumns.map((column, index) => (
                          <td
                            key={column.field}
                            className={`px-5 py-4 text-[12px] font-pmedium text-slate-700 ${column.className || ""}`}
                          >
                            {index === 0 ? (
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                                  {initials(row[column.field])}
                                </div>
                                <span className="text-[12px] font-pmedium text-slate-900 truncate max-w-[190px]">
                                  {row[column.field] || "--"}
                                </span>
                              </div>
                            ) : column.field === "email" ? (
                              <span className="flex items-center gap-1">
                                <Mail size={10} className="text-slate-400" />
                                {row.email || "--"}
                              </span>
                            ) : column.field === "contact" || column.field === "phone" ? (
                              <span className="flex items-center gap-1">
                                <Phone size={10} className="text-slate-400" />
                                {row[column.field] || "--"}
                              </span>
                            ) : column.field === "lastUpdated" ? (
                              formatDateLabel(row[column.field])
                            ) : (
                              String(row[column.field] ?? "--")
                            )}
                          </td>
                        ))}
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
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-[10px] font-pmedium text-white shadow-sm">
                              {initials(row.partnerName)}
                            </div>
                            <span className="text-[12px] font-pmedium text-slate-900 truncate max-w-[170px]">
                              {row.partnerName || "--"}
                            </span>
                          </div>
                        </td>
                        {!companyAfterContact ? (
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row.companyName || "--"}
                          </td>
                        ) : null}
                        {locationColumnDefs.map((column) => (
                          <td key={column.field} className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row[column.field] || "--"}
                          </td>
                        ))}
                        {splitContact ? (
                          <>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                              <span className="flex items-center gap-1">
                                <Mail size={10} className="text-slate-400" />
                                {row.email || "--"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                              <span className="flex items-center gap-1">
                                <Phone size={10} className="text-slate-400" />
                                {row.phone || "--"}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="px-5 py-4">
                            <div className="text-[11px] font-pmedium text-slate-600 space-y-0.5">
                              <p className="flex items-center gap-1">
                                <Phone size={10} className="text-slate-400" />
                                {row.phone || "--"}
                              </p>
                              <p className="flex items-center gap-1">
                                <Mail size={10} className="text-slate-400" />
                                {row.email || "--"}
                              </p>
                            </div>
                          </td>
                        )}
                        {companyAfterContact ? (
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row.companyName || "--"}
                          </td>
                        ) : null}
                        <td className="px-5 py-4 text-center">
                          <span className={statusPillClass(row.status || "Pending")}>
                            {row.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                          {formatDateLabel(row.lastUpdated)}
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
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setSelectedRow(null)}>
          <div
            className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  {initials(selectedRow.partnerName)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">
                    {selectedRow.partnerName}
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{title} Partner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                  <BriefcaseBusiness size={14} /> Partner Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  {columns.map((column) => (
                    <div key={column.field}>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">
                        {column.headerName}
                      </p>
                      <p className="text-[12px] font-pmedium text-slate-900 break-words">
                        {column.field === "lastUpdated"
                          ? formatDateLabel(selectedRow[column.field])
                          : String(selectedRow[column.field] ?? "--")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Notes
                </h3>
                <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[12px] font-pmedium leading-5 text-slate-700">
                    {selectedRow.notes || "--"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ValueAddsPartnersTable;
