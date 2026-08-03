import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import useAxiosPrivate from "../hooks/useAxiosPrivate";
import humanDate from "../utils/humanDateForamt";
import humanTime from "../utils/humanTime";
import { Search, Eye, X, Activity, FileText, Building2, Users, Calendar } from "lucide-react";
import PageFrame from "../components/Pages/PageFrame";
import dayjs from "dayjs";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 700;

const LogsPageSkeleton = () => (
  <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
    <PageFrame>
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="mb-3 space-y-2">
          <div className="h-5 w-32 rounded-lg bg-slate-200" />
          <div className="h-3 w-full max-w-sm rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="h-2.5 w-20 rounded-full bg-slate-200 mb-3" />
              <div className="h-4 w-10 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row gap-2.5">
              <div className="h-10 min-w-[170px] rounded-lg bg-slate-200" />
              <div className="h-10 min-w-[240px] flex-1 rounded-lg bg-slate-200" />
              <div className="h-10 min-w-[150px] rounded-lg bg-slate-200" />
              <div className="h-10 min-w-[150px] rounded-lg bg-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-2.5 rounded-full bg-slate-200" />
            ))}
          </div>
          <div className="divide-y divide-slate-100/60 px-5">
            {Array.from({ length: 9 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-7 gap-4 py-4">
                {Array.from({ length: 7 }).map((_, columnIndex) => (
                  <div key={columnIndex} className="h-3 w-3/4 rounded-full bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageFrame>
  </div>
);

const LogPage = () => {
  const axios = useAxiosPrivate();
  const [openModal, setOpenModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [search]);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "logs",
      debouncedSearch,
      selectedMonth,
      dateFrom,
      dateTo,
    ],
    initialPageParam: 1,
    placeholderData: (previousData) => previousData,
    queryFn: async ({ pageParam }) => {
      const response = await axios.get("/api/logs/get-logs", {
        params: {
          page: pageParam,
          limit: PAGE_SIZE,
          search: debouncedSearch,
          month: selectedMonth,
          dateFrom,
          dateTo,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const rows = useMemo(
    () =>
      (data?.pages.flatMap((page) => page.items) || []).map((item, index) => ({
        ...item,
        srNo: item.srNo || index + 1,
        user:
          item.fullName ||
          (item.performedBy
            ? `${item.performedBy.firstName ?? ""} ${item.performedBy.lastName ?? ""}`.trim()
            : "-"),
        path: item.path ? item.path.split("/").splice(2).join(" > ") : "-",
        date: humanDate(item.createdAt),
        time: humanTime(item.createdAt),
        monthKey: dayjs(item.createdAt).format("YYYY-MM"),
        monthLabel: dayjs(item.createdAt).format("MMMM YYYY"),
      })),
    [data],
  );

  const firstPage = data?.pages?.[0];
  const stats = firstPage?.counts ?? {
    total: 0,
    companies: 0,
    users: 0,
    modules: 0,
  };
  const totalMatching = firstPage?.total ?? 0;
  const monthOptions = firstPage?.monthOptions ?? [];

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "250px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const handleMonthChange = (value) => {
    setSelectedMonth(value);
    if (value) {
      setDateFrom("");
      setDateTo("");
    }
  };

  const handleCustomDateChange = (setter) => (event) => {
    setter(event.target.value);
    setSelectedMonth("");
  };

  const clearCustomDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  const handleViewLog = (log) => {
    setSelectedLog(log);
    setOpenModal(true);
  };

  const skipKeys = ["__v", "_id", "refreshToken", "password"];

  const formatKey = (key) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());

  const isMongoId = (value) =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

  const shouldSkipField = (key, value) => {
    if (skipKeys.includes(key)) return true;
    if (typeof value === "string" && isMongoId(value)) return true;
    if (Array.isArray(value)) return value.every((item) => isMongoId(item));
    return false;
  };

  const formatValue = (key, value) => {
    if (shouldSkipField(key, value)) return null;
    if (isMongoId(value)) return null;

    if (Array.isArray(value)) {
      const cleanList = value.filter((item) => !isMongoId(item) && typeof item !== "object");
      const cleanedObjects = value
        .filter((item) => typeof item === "object" && item !== null)
        .map((obj) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => !shouldSkipField(k, v))));
      const finalList = [...cleanList, ...cleanedObjects].filter(Boolean);
      if (finalList.length === 0) return "-";
      return finalList.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
    }

    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value).filter(([subKey, subVal]) => !shouldSkipField(subKey, subVal));
      if (entries.length === 0) return null;
      return entries.map(([k, v]) => `${formatKey(k)}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("; ");
    }

    if (key.toLowerCase().includes("date")) return humanDate(value);
    if (key.toLowerCase().includes("time")) return humanTime(value);
    return value ?? "-";
  };

  if (isLoading && !data) {
    return <LogsPageSkeleton />;
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">Logs Table</h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">Review all system activity logs and audit trails.</p>
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
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 bg-slate-50/50">
              <div className="flex flex-col xl:flex-row items-stretch gap-2.5">
                <select
                  value={selectedMonth}
                  onChange={(event) => handleMonthChange(event.target.value)}
                  className="min-w-[180px] px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all"
                >
                  <option value="">All Months - Recent First</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search action, module, company, user..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="date"
                      aria-label="Logs from date"
                      value={dateFrom}
                      onChange={handleCustomDateChange(setDateFrom)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[11px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all"
                    />
                  </div>
                  <span className="text-slate-400 text-[11px]">to</span>
                  <div className="relative flex-1 sm:flex-none">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="date"
                      aria-label="Logs to date"
                      value={dateTo}
                      onChange={handleCustomDateChange(setDateTo)}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[11px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all"
                    />
                  </div>
                  {(dateFrom || dateTo) ? (
                    <button
                      type="button"
                      onClick={clearCustomDates}
                      className="px-2.5 py-2 text-[10px] font-pmedium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
              {data ? (
                <p className="mt-2 text-[10px] font-pmedium text-slate-400 uppercase tracking-widest">
                  Showing {rows.length} of {totalMatching} logs
                </p>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400"><Activity size={28} /></div>
                <p className="text-slate-400 font-semibold font-pmedium">{isError ? "Failed to load logs." : "No logs found."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Action</th>
                      <th className="px-5 py-4">Module</th>
                      <th className="px-5 py-4">Company</th>
                      <th className="px-5 py-4">User</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {rows.map((row, index) => {
                      const showMonthHeading =
                        index === 0 || rows[index - 1]?.monthKey !== row.monthKey;

                      return (
                        <Fragment key={row._id || row.srNo}>
                          {showMonthHeading ? (
                            <tr className="bg-slate-50/70">
                              <td
                                colSpan={7}
                                className="px-5 py-2.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-500"
                              >
                                {row.monthLabel}
                              </td>
                            </tr>
                          ) : null}
                          <tr className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">{row.srNo}</td>
                            <td
                              className="px-5 py-4 text-[12px] font-pmedium text-blue-600 cursor-pointer hover:underline"
                              onClick={() => handleViewLog(row)}
                            >
                              {row.action || "-"}
                            </td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.module || "-"}</td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[160px]">{row.companyName || "-"}</td>
                            <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">{row.user}</td>
                            <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500 whitespace-nowrap">
                              <span className="block">{row.date}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-400">{row.time}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                title="View log"
                                onClick={() => handleViewLog(row)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                              >
                                <Eye size={15} strokeWidth={2.5} />
                              </button>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                    {hasNextPage ? (
                      <tr ref={loadMoreRef}>
                        <td colSpan={7} className="py-4 text-center">
                          {isFetchingNextPage ? (
                            <span className="text-[11px] font-pmedium uppercase tracking-widest text-slate-400">
                              Loading older logs...
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>

      {openModal && selectedLog && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={() => setOpenModal(false)}>
          <div className="bg-white rounded-[2rem] max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white"><Eye size={16} /></div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">View Log</h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">{selectedLog.action}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpenModal(false)} className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"><X size={16} /></button>
            </div>
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                {[
                  ["Action", selectedLog.action],
                  ["Module", selectedLog.module],
                  ["Company", selectedLog.companyName],
                  ["Company ID", selectedLog.companyId],
                  ["User", selectedLog.user || selectedLog.fullName],
                  ["Page", selectedLog.page],
                  ["Publish State", selectedLog.publishState ? selectedLog.publishState.toUpperCase() : null],
                  ["Credits Used", selectedLog.creditsUsed !== undefined ? String(selectedLog.creditsUsed) : null],
                  ["Credits Remaining", selectedLog.creditsRemaining !== undefined ? String(selectedLog.creditsRemaining) : null],
                  ["Status", selectedLog.success === undefined ? null : selectedLog.success ? "Success" : "Failed"],
                  ["Date", selectedLog.createdAt ? `${humanDate(selectedLog.createdAt)} ${humanTime(selectedLog.createdAt)}` : null],
                ]
                  .filter(([, value]) => value !== null && value !== undefined && value !== "")
                  .map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{label}</p>
                      <p className={`text-[12px] font-pmedium ${label === "Status" ? (value === "Success" ? "text-emerald-600" : "text-red-600") : "text-slate-900"}`}>{value}</p>
                    </div>
                  ))}
              </div>

              {Array.isArray(selectedLog.changes) && selectedLog.changes.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Changes ({selectedLog.changes.length})</h3>
                  <div className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                    {selectedLog.changes.map((change, index) => (
                      <div key={index} className="py-2.5">
                        {(change.page || change.section) && (
                          <p className="text-[10px] font-pmedium uppercase tracking-wider text-blue-600">
                            {[change.page, change.section].filter(Boolean).join(" / ")}
                          </p>
                        )}
                        <p className="mt-0.5 text-[12px] font-pmedium text-slate-800">
                          <span className="font-semibold">{change.field || "-"}</span>
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">{change.change || change.type || "changed"}</span>
                        </p>
                        {(change.from !== undefined || change.to !== undefined) && (
                          <p className="mt-1 break-words text-[11px] font-pmedium">
                            {change.from !== undefined && <span className="text-red-500 line-through">{String(change.from)}</span>}
                            {change.from !== undefined && change.to !== undefined && <span className="mx-1.5 text-slate-400">&rarr;</span>}
                            {change.to !== undefined && <span className="font-medium text-emerald-600">{String(change.to)}</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.payload && Object.keys(selectedLog.payload).length > 0 && (
                <div>
                  <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">Submitted Data</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                    {Object.entries(selectedLog.payload)
                      .filter(([key]) => !skipKeys.includes(key))
                      .map(([key, value], index) => {
                        const formattedValue = formatValue(key, value);
                        if (formattedValue === null) return null;
                        return (
                          <div key={index}>
                            <p className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest mb-1">{formatKey(key)}</p>
                            <p className="text-[12px] font-pmedium text-slate-900 break-all">{formattedValue}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setOpenModal(false)} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogPage;
