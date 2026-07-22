import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import humanTime from "../../../utils/humanTime";
import { queryClient } from "../../../main";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WebsiteCreditsOverview = () => {
  const axiosPrivate = useAxiosPrivate();
  const [selectedRow, setSelectedRow] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const now = dayjs();
  const [selectedMonth, setSelectedMonth] = useState(now.month());
  const [selectedYear, setSelectedYear] = useState(now.year());

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const isCurrentMonth = selectedMonth === now.month() && selectedYear === now.year();

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["website-credits-summary"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-credits/summary");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: ledger = [], isLoading: isLedgerLoading } = useQuery({
    queryKey: ["website-credit-ledger", selectedRow?.companyId, selectedRow?.workspaceId],
    enabled: isUsageModalOpen && Boolean(selectedRow),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRow?.companyId) params.set("companyId", selectedRow.companyId);
      if (selectedRow?.workspaceId) params.set("workspaceId", selectedRow.workspaceId);
      const response = await axiosPrivate.get(`/api/website-credits/ledger?${params.toString()}`);
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: allLedger = [] } = useQuery({
    queryKey: ["website-credit-ledger-all"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-credits/ledger");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const rangeTotals = useMemo(() => {
    const map = new Map();
    const start = dayjs().year(selectedYear).month(selectedMonth).startOf("month");
    const end = dayjs().year(selectedYear).month(selectedMonth).endOf("month");
    allLedger.forEach((entry) => {
      const entryDate = dayjs(entry.createdAt);
      if (!entryDate.isValid() || entryDate.isBefore(start) || entryDate.isAfter(end)) return;
      const workspaceKey = String(entry.workspaceId || "").trim();
      const companyKey = String(entry.companyId || "").trim();
      let bucket = (workspaceKey && map.get(workspaceKey)) || (companyKey && map.get(companyKey)) || null;
      if (!bucket) bucket = { used: 0, added: 0 };
      if (workspaceKey) map.set(workspaceKey, bucket);
      if (companyKey) map.set(companyKey, bucket);
      if (entry.type === "used") bucket.used += Number(entry.credits) || 0;
      else bucket.added += Number(entry.credits) || 0;
    });
    return map;
  }, [allLedger, selectedMonth, selectedYear]);

  const { mutate: addCredits, isPending: isAdding } = useMutation({
    mutationFn: async () =>
      axiosPrivate.post("/api/website-credits/add", {
        companyId: selectedRow?.companyId,
        workspaceId: selectedRow?.workspaceId,
        credits: Number(creditsToAdd),
        note,
      }),
    onSuccess: () => {
      toast.success("Credits added successfully");
      setIsAddModalOpen(false);
      setCreditsToAdd("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["website-credits-summary"] });
      queryClient.invalidateQueries({ queryKey: ["website-credit-ledger"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to add credits"),
  });

  const handleAddSubmit = () => {
    const numeric = Number(creditsToAdd);
    if (!Number.isFinite(numeric) || numeric <= 0) { toast.error("Enter a valid number of credits"); return; }
    const maxAddable = Number(selectedRow?.maxAddable ?? 0);
    if (numeric > maxAddable) {
      toast.error(`Only ${maxAddable} credit${maxAddable === 1 ? "" : "s"} can be added (plan limit is ${selectedRow?.monthlyLimit ?? 0})`);
      return;
    }
    addCredits();
  };

  const rows = useMemo(
    () =>
      (isLoading ? [] : credits).map((item, index) => {
        const monthlyLimit = Number(item.monthlyCreditsLimit ?? 0);
        const remaining = Number(item.creditsRemaining ?? 0);
        const bucket = rangeTotals.get(String(item.workspaceId || "").trim()) || rangeTotals.get(String(item.companyId || "").trim()) || { used: 0, added: 0 };
        return {
          ...item,
          srNo: index + 1,
          companyName: item.companyName || "-",
          workspaceName: item.workspaceName || "-",
          plan: item.plan === "static-free" ? "basic" : item.plan || "basic",
          totalLimit: Number(item.effectiveCreditsLimit ?? 0),
          used: isCurrentMonth ? Number(item.creditsUsed ?? 0) : bucket.used,
          remaining: isCurrentMonth ? remaining : "-",
          addOns: isCurrentMonth ? Number(item.addOnCreditsPurchased ?? 0) : bucket.added,
          monthlyLimit,
          maxAddable: Math.max(0, monthlyLimit - remaining),
        };
      }),
    [credits, isLoading, rangeTotals, isCurrentMonth],
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (!query) return true;
      return (r.companyName || "").toLowerCase().includes(query) || (r.workspaceName || "").toLowerCase().includes(query);
    });
  }, [rows, searchQuery]);

  const ledgerRows = useMemo(
    () =>
      (isLedgerLoading ? [] : ledger).map((entry) => ({
        ...entry,
        movement: `${entry.type === "added" ? "+" : "-"}${entry.credits}`,
        user: entry.performedByName || entry.performedByEmail || "Unknown",
        panel: entry.sourcePanel === "host_panel" ? "Host Panel" : "Master Panel",
        date: humanDate(entry.createdAt),
        time: humanTime(entry.createdAt),
        details: entry.description || "-",
        remainingAfterDisplay: entry.remainingAfter === undefined || entry.remainingAfter === null ? "-" : entry.remainingAfter,
      })),
    [ledger, isLedgerLoading],
  );

  const totalLimit = rows.reduce((sum, r) => sum + (r.totalLimit || 0), 0);
  const totalUsed = rows.reduce((sum, r) => sum + (r.used || 0), 0);
  const totalAddOns = rows.reduce((sum, r) => sum + (r.addOns || 0), 0);

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
          <div>
            <h2 className="text-title font-pmedium text-primary uppercase">Website Credits</h2>
            <p className="text-xs font-pmedium text-slate-500 mt-1">Track and manage website credits across all companies.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-1 shrink-0">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 border-l-4 border-l-slate-400 shadow-sm flex justify-between items-center transition-all hover:shadow-md">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-slate-400 uppercase tracking-widest mb-1">Total Companies</p>
              <p className="text-[15px] font-pmedium text-slate-900">{rows.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-blue-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-blue-600 uppercase tracking-widest mb-1">Total Limit</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalLimit}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-amber-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-amber-600 uppercase tracking-widest mb-1">Total Used</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalUsed}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center transition-all hover:shadow-md border-l-4 border-l-emerald-500">
            <div className="min-w-0">
              <p className="text-[10px] font-pmedium text-emerald-600 uppercase tracking-widest mb-1">Total Add-ons</p>
              <p className="text-[15px] font-pmedium text-slate-900">{totalAddOns}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search companies..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                <tr>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Company</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Workspace</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Plan</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-right">Total Limit</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-right">Add-ons</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-right">Used</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-right">Remaining</th>
                  <th className="px-5 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-20 text-slate-400 font-pmedium">Loading...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-20 text-slate-400 font-pmedium">No credits found.</td></tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.companyId + row.workspaceId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs font-pmedium text-[#0F172A]">{row.companyName}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.workspaceName}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600">{row.plan}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600 text-right">{row.totalLimit}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600 text-right">{row.addOns}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-slate-600 text-right">{row.used}</td>
                      <td className="px-5 py-4 text-xs font-pmedium text-right">
                        {row.remaining === "-" ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span className={Number(row.remaining) <= 0 ? "font-pmedium text-red-600" : "font-pmedium text-emerald-600"}>
                            {row.remaining}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Add Credits"
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                            onClick={() => { setSelectedRow(row); setIsAddModalOpen(true); }}
                          >
                            <Plus size={15} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            title="View Usage"
                            className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                            onClick={() => { setSelectedRow(row); setIsUsageModalOpen(true); }}
                          >
                            <Eye size={15} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] w-[min(500px,92vw)] max-h-[84vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10">
                  <Plus size={18} className="text-[#2563EB]" />
                </div>
                <h2 className="text-base font-pmedium text-slate-900">Add Website Credits</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Company</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.companyName || "-"}</p>
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Workspace</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.workspaceName || "-"}</p>
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Used</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.used ?? 0}</p>
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Remaining</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.remaining ?? 0}</p>
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Plan Limit</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.monthlyLimit ?? 0}</p>
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
                    <p className="text-[9px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Max Addable</p>
                    <p className="text-[12px] font-pmedium text-slate-900">{selectedRow?.maxAddable ?? 0}</p>
                  </div>
                </div>
                {Number(selectedRow?.maxAddable ?? 0) <= 0 ? (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 border border-amber-100">
                    Credits are already at the plan limit of {selectedRow?.monthlyLimit ?? 0}. No credits can be added right now.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5">Credits to add (max {selectedRow?.maxAddable ?? 0})</label>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-pmedium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none"
                        value={creditsToAdd}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") return setCreditsToAdd("");
                          const numeric = Math.floor(Number(raw));
                          if (!Number.isFinite(numeric)) return;
                          const max = Number(selectedRow?.maxAddable ?? 0);
                          setCreditsToAdd(String(Math.min(Math.max(numeric, 1), max)));
                        }}
                        min={1}
                        max={selectedRow?.maxAddable ?? 0}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1.5">Note (optional)</label>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-pmedium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none"
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <button
                      className="w-full rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-pmedium text-white hover:bg-[#1d4ed8] transition-all disabled:opacity-50"
                      onClick={handleAddSubmit}
                      disabled={isAdding}
                    >
                      {isAdding ? "Adding..." : "Add Credits"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isUsageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsUsageModalOpen(false)}>
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] w-[min(800px,92vw)] max-h-[84vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10">
                  <Eye size={18} className="text-[#2563EB]" />
                </div>
                <h2 className="text-base font-pmedium text-slate-900">Credit History — {selectedRow?.companyName || ""}</h2>
              </div>
              <button onClick={() => setIsUsageModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLedgerLoading ? (
                <div className="py-6 text-center text-sm text-slate-500">Loading history...</div>
              ) : ledger.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">No credit activity recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Date</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Time</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Credits</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">User</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Panel</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Details</th>
                        <th className="px-4 py-3 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerRows.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">{entry.date}</td>
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">{entry.time}</td>
                          <td className="px-4 py-3 text-xs font-pmedium">
                            <span className={String(entry.movement).startsWith("+") ? "font-pmedium text-emerald-600" : "font-pmedium text-red-600"}>
                              {entry.movement}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">{entry.user}</td>
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-pmedium ${entry.panel === "Host Panel" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {entry.panel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">{entry.details}</td>
                          <td className="px-4 py-3 text-xs font-pmedium text-slate-600">{entry.remainingAfterDisplay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
};

export default WebsiteCreditsOverview;
