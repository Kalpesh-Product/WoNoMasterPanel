import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip, TextField, Popover } from "@mui/material";
import { toast } from "sonner";
import dayjs from "dayjs";
import { DateRangePicker } from "react-date-range";
import { MdCalendarToday } from "react-icons/md";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import PrimaryButton from "../../../components/PrimaryButton";
import MuiModal from "../../../components/MuiModal";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import humanDate from "../../../utils/humanDateForamt";
import humanTime from "../../../utils/humanTime";
import { queryClient } from "../../../main";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

const WebsiteCreditsOverview = () => {
  const axiosPrivate = useAxiosPrivate();
  const [selectedRow, setSelectedRow] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [note, setNote] = useState("");

  // Month filter for the main table — same calendar as the logs table.
  const [dateRange, setDateRange] = useState([
    {
      startDate: dayjs().startOf("month").toDate(),
      endDate: dayjs().endOf("month").toDate(),
      key: "selection",
    },
  ]);
  const [calendarAnchorEl, setCalendarAnchorEl] = useState(null);
  const agGridRef = useRef(null);

  const handleExport = () => {
    if (agGridRef.current) {
      agGridRef.current.api.exportDataAsCsv({ fileName: "Website Credits.csv" });
    }
  };

  // Live counters reset monthly, so they represent the current month; any
  // other selected range is reconstructed from the ledger history.
  const isCurrentMonth =
    dayjs(dateRange[0]?.startDate).isSame(dayjs(), "month") &&
    dayjs(dateRange[0]?.endDate).isSame(dayjs(), "month");

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["website-credits-summary"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-credits/summary");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: ledger = [], isLoading: isLedgerLoading } = useQuery({
    queryKey: [
      "website-credit-ledger",
      selectedRow?.companyId,
      selectedRow?.workspaceId,
    ],
    enabled: isUsageModalOpen && Boolean(selectedRow),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRow?.companyId) params.set("companyId", selectedRow.companyId);
      if (selectedRow?.workspaceId)
        params.set("workspaceId", selectedRow.workspaceId);

      const response = await axiosPrivate.get(
        `/api/website-credits/ledger?${params.toString()}`,
      );
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Full ledger across companies, used to rebuild past months' usage totals.
  const { data: allLedger = [] } = useQuery({
    queryKey: ["website-credit-ledger-all"],
    queryFn: async () => {
      const response = await axiosPrivate.get("/api/website-credits/ledger");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // used/added totals per company row within the selected range. Entries are
  // bucketed by workspaceId and companyId (shared object, counted once).
  const rangeTotals = useMemo(() => {
    const map = new Map();
    if (!dateRange[0]) return map;

    const start = dayjs(dateRange[0].startDate).startOf("day");
    const end = dayjs(dateRange[0].endDate).endOf("day");

    allLedger.forEach((entry) => {
      const entryDate = dayjs(entry.createdAt);
      if (
        !entryDate.isValid() ||
        entryDate.isBefore(start) ||
        entryDate.isAfter(end)
      ) {
        return;
      }

      const workspaceKey = String(entry.workspaceId || "").trim();
      const companyKey = String(entry.companyId || "").trim();

      let bucket =
        (workspaceKey && map.get(workspaceKey)) ||
        (companyKey && map.get(companyKey)) ||
        null;
      if (!bucket) bucket = { used: 0, added: 0 };
      if (workspaceKey) map.set(workspaceKey, bucket);
      if (companyKey) map.set(companyKey, bucket);

      if (entry.type === "used") {
        bucket.used += Number(entry.credits) || 0;
      } else {
        bucket.added += Number(entry.credits) || 0;
      }
    });

    return map;
  }, [allLedger, dateRange]);

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
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to add credits"),
  });

  const handleAddSubmit = () => {
    const numeric = Number(creditsToAdd);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a valid number of credits");
      return;
    }
    const maxAddable = Number(selectedRow?.maxAddable ?? 0);
    if (numeric > maxAddable) {
      toast.error(
        `Only ${maxAddable} credit${maxAddable === 1 ? "" : "s"} can be added (plan limit is ${selectedRow?.monthlyLimit ?? 0})`,
      );
      return;
    }
    addCredits();
  };

  const rows = useMemo(
    () =>
      (isLoading ? [] : credits).map((item, index) => {
        const monthlyLimit = Number(item.monthlyCreditsLimit ?? 0);
        const remaining = Number(item.creditsRemaining ?? 0);
        const bucket =
          rangeTotals.get(String(item.workspaceId || "").trim()) ||
          rangeTotals.get(String(item.companyId || "").trim()) || {
            used: 0,
            added: 0,
          };
        return {
          ...item,
          srNo: index + 1,
          companyName: item.companyName || "-",
          workspaceName: item.workspaceName || "-",
          plan: item.plan || "static-free",
          totalLimit: Number(item.effectiveCreditsLimit ?? 0),
          used: isCurrentMonth ? Number(item.creditsUsed ?? 0) : bucket.used,
          remaining: isCurrentMonth ? remaining : "-",
          addOns: isCurrentMonth
            ? Number(item.addOnCreditsPurchased ?? 0)
            : bucket.added,
          monthlyLimit,
          // Top-ups can only refill up to the plan limit (professional 8, basic 5).
          maxAddable: Math.max(0, monthlyLimit - remaining),
        };
      }),
    [credits, isLoading, rangeTotals, isCurrentMonth],
  );

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
        remainingAfterDisplay:
          entry.remainingAfter === undefined || entry.remainingAfter === null
            ? "-"
            : entry.remainingAfter,
      })),
    [ledger, isLedgerLoading],
  );

  const ledgerColumns = [
    { headerName: "Date", field: "date", width: 110 },
    { headerName: "Time", field: "time", width: 100 },
    {
      headerName: "Credits",
      field: "movement",
      width: 90,
      cellRenderer: (params) => (
        <span
          className={
            String(params.value).startsWith("+")
              ? "font-semibold text-emerald-600"
              : "font-semibold text-red-600"
          }
        >
          {params.value}
        </span>
      ),
    },
    { headerName: "User", field: "user", flex: 1 },
    {
      headerName: "Panel",
      field: "panel",
      width: 130,
      cellRenderer: (params) => (
        <Chip
          size="small"
          label={params.value}
          color={params.value === "Host Panel" ? "primary" : "default"}
          variant="outlined"
        />
      ),
    },
    { headerName: "Details", field: "details", flex: 1 },
    { headerName: "Balance After", field: "remainingAfterDisplay", width: 120 },
  ];

  const columns = [
    {
      headerName: "Sr No",
      field: "srNo",
      lockPinned: true,
      pinned: "left",
      width: 90,
    },
    { headerName: "Company", field: "companyName", flex: 1 },
    { headerName: "Workspace", field: "workspaceName", flex: 1 },
    { headerName: "Plan", field: "plan", width: 120 },
    { headerName: "Total Limit", field: "totalLimit", width: 110 },
    { headerName: "Add-ons", field: "addOns", width: 100 },
    { headerName: "Used", field: "used", width: 90 },
    {
      headerName: "Remaining",
      field: "remaining",
      width: 110,
      cellRenderer: (params) =>
        params.value === "-" ? (
          <span>-</span>
        ) : (
          <span
            className={
              Number(params.value) <= 0
                ? "font-semibold text-red-600"
                : "font-semibold text-emerald-600"
            }
          >
            {params.value}
          </span>
        ),
    },
    {
      field: "actions",
      headerName: "Actions",
      pinned: "right",
      lockPinned: true,
      width: 175,
      cellStyle: { display: "flex", alignItems: "center" },
      cellRenderer: (params) => (
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-[22px] items-center rounded bg-[#2563EB] px-2 text-[11px] font-semibold leading-none text-white hover:bg-[#1d4ed8]"
            onClick={() => {
              setSelectedRow(params.data || {});
              setIsAddModalOpen(true);
            }}
          >
            Add
          </button>
          <button
            className="flex h-[22px] items-center rounded border border-slate-300 px-2 text-[11px] font-semibold leading-none text-slate-600 hover:bg-slate-100"
            onClick={() => {
              setSelectedRow(params.data || {});
              setIsUsageModalOpen(true);
            }}
          >
            View Usage
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageFrame>
      <div className="flex flex-col gap-3">
        {/* Header — title and export on top, like the logs tables */}
        <div className="flex w-full items-center justify-between gap-3 px-1">
          <span className="text-[24px] font-pbold uppercase tracking-wide text-slate-900">
            Website Credits
          </span>
          <PrimaryButton title="Export" handleSubmit={handleExport} />
        </div>

        {/* Month calendar filter — same control as the logs table */}
        <div className="flex items-center justify-center gap-2">
          <div className="rounded-md border-[1px] border-primary px-6 py-1">
            <span className="text-content font-pregular text-gray-600">
              {dayjs(dateRange[0]?.startDate).format("DD MMM YYYY")}
            </span>
          </div>
          <div className="rounded-md border-[1px] border-primary px-6 py-1">
            <span className="text-content font-pregular text-gray-600">
              {dayjs(dateRange[0]?.endDate).format("DD MMM YYYY")}
            </span>
          </div>
          <div
            className="cursor-pointer rounded-md bg-primary p-2 text-white hover:bg-primary"
            onClick={(e) => setCalendarAnchorEl(e.currentTarget)}
          >
            <MdCalendarToday size={17} />
          </div>
        </div>

        <Popover
          open={Boolean(calendarAnchorEl)}
          anchorEl={calendarAnchorEl}
          onClose={() => setCalendarAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <DateRangePicker
            onChange={(item) => setDateRange([item.selection])}
            moveRangeOnFirstSelection={false}
            ranges={dateRange}
            direction="vertical"
          />
        </Popover>

        <AgTable
          data={rows}
          columns={columns}
          tableRef={agGridRef}
          hideTitle={true}
          tableHeight={450}
          search={true}
          loading={isLoading}
        />
      </div>

      {/* Add credits */}
      <MuiModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Website Credits"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="font-semibold">Company:</span>{" "}
              {selectedRow?.companyName || "-"}
            </div>
            <div>
              <span className="font-semibold">Workspace:</span>{" "}
              {selectedRow?.workspaceName || "-"}
            </div>
            <div>
              <span className="font-semibold">Used:</span> {selectedRow?.used ?? 0}
            </div>
            <div>
              <span className="font-semibold">Remaining:</span>{" "}
              {selectedRow?.remaining ?? 0}
            </div>
            <div>
              <span className="font-semibold">Plan Limit:</span>{" "}
              {selectedRow?.monthlyLimit ?? 0}
            </div>
            <div>
              <span className="font-semibold">Max Addable:</span>{" "}
              {selectedRow?.maxAddable ?? 0}
            </div>
          </div>

          {Number(selectedRow?.maxAddable ?? 0) <= 0 ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Credits are already at the plan limit of{" "}
              {selectedRow?.monthlyLimit ?? 0}. No credits can be added right
              now.
            </div>
          ) : (
            <>
              <TextField
                label={`Credits to add (max ${selectedRow?.maxAddable ?? 0})`}
                type="number"
                size="small"
                fullWidth
                value={creditsToAdd}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return setCreditsToAdd("");
                  const numeric = Math.floor(Number(raw));
                  if (!Number.isFinite(numeric)) return;
                  const max = Number(selectedRow?.maxAddable ?? 0);
                  // Values above the plan-limit cap can't even be typed.
                  setCreditsToAdd(String(Math.min(Math.max(numeric, 1), max)));
                }}
                inputProps={{ min: 1, max: selectedRow?.maxAddable ?? 0 }}
              />
              <TextField
                label="Note (optional)"
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <PrimaryButton
                title="Add Credits"
                isLoading={isAdding}
                handleSubmit={handleAddSubmit}
              />
            </>
          )}
        </div>
      </MuiModal>

      {/* Usage history — full list; every entry carries its own date and time */}
      <MuiModal
        open={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        title={`Credit History — ${selectedRow?.companyName || ""}`}
      >
        {isLedgerLoading ? (
          <div className="py-6 text-center text-sm text-slate-500">
            Loading history...
          </div>
        ) : ledger.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No credit activity recorded yet
          </div>
        ) : (
          <AgTable
            data={ledgerRows}
            columns={ledgerColumns}
            tableHeight={320}
            search={true}
            hideTitle={true}
          />
        )}
      </MuiModal>
    </PageFrame>
  );
};

export default WebsiteCreditsOverview;
