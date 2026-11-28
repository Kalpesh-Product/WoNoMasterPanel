import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileDown,
  Plus,
  X,
} from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../../main";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";
import { downloadCsv } from "../../../../utils/csvExport";
import {
  exportDryRunPdf,
  readDryRunReportError,
} from "../../../../utils/dryRunReport";
import {
  FileDropzone,
  UploadActions,
  UploadCard,
  UploadPanel,
} from "./UploadUI";

// Passport-rows × destination-columns matrix — two files (requirement grid +
// duration grid), matching how the source data is actually maintained
// upstream (e.g. the "Visa Type" / "Visa Duration" tabs in the master
// spreadsheet). Same endpoint handles both dry-run and commit.
const VISA_MATRIX_IMPORT_ENDPOINT = `${NOMADS_API_BASE_URL}/visa-rules-v2/import-csv`;

// Row-per-pair alternative — one CSV, columns Passport,Destination,Requirement,
// DurationDays. Simpler to hand-edit a few rows than the matrix format.
const VISA_ROW_IMPORT_ENDPOINT = `${NOMADS_API_BASE_URL}/visa-rules-v2/import-rows-csv`;
const VISA_ROW_IMPORT_FIELD = "visa-rules-file";

const isCsv = (file) => /\.csv$/i.test(file.name);

const FIELD_LABELS = {
  requirement: "Requirement",
  durationDays: "Duration",
};

const formatRequirement = (value) =>
  value === null || value === undefined || value === ""
    ? "— (blank)"
    : String(value);

const formatDays = (value) =>
  value === null || value === undefined || value === ""
    ? "— (blank)"
    : `${value} days`;

const formatFieldValue = (field, value) =>
  field === "durationDays" ? formatDays(value) : formatRequirement(value);

const StatGrid = ({ items }) => (
  <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4">
    {items.map((item) => (
      <div key={item.label} className="px-3 py-3 text-center">
        <p
          className={`text-[9px] font-pmedium uppercase tracking-widest ${
            item.labelTone || "text-slate-400"
          }`}
        >
          {item.label}
        </p>
        <p className={`mt-1 text-lg font-pmedium ${item.tone || "text-slate-800"}`}>
          {item.value ?? 0}
        </p>
      </div>
    ))}
  </div>
);

// Rows the backend refused before touching the database (missing keys, bad
// duration numbers, both cells blank). They are skipped, never fatal.
const RowIssues = ({ rowErrors = [] }) => {
  if (!rowErrors.length) return null;

  return (
    <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
        <AlertTriangle size={12} /> {rowErrors.length} row
        {rowErrors.length === 1 ? "" : "s"} skipped
      </p>
      <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
        {rowErrors.slice(0, 50).map((entry) => (
          <li
            key={`${entry.rowNumber}-${entry.reason}`}
            className="text-[10px] font-pmedium text-amber-800"
          >
            Row {entry.rowNumber}: {entry.reason}
          </li>
        ))}
      </ul>
      {rowErrors.length > 50 && (
        <p className="mt-1 text-[10px] font-pmedium text-amber-700">
          +{rowErrors.length - 50} more
        </p>
      )}
    </div>
  );
};

const ChangedFields = ({ changedFields = [] }) => (
  <div className="mt-1.5 space-y-1 pl-1">
    {changedFields.map((change) => (
      <div
        key={change.field}
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-pmedium"
      >
        <span className="min-w-[74px] text-slate-400">
          {FIELD_LABELS[change.field] || change.field}
        </span>
        <span className="text-slate-400 line-through decoration-slate-300">
          {formatFieldValue(change.field, change.oldValue)}
        </span>
        <ArrowRight size={10} className="shrink-0 text-slate-300" />
        <span className="rounded bg-white px-1 py-0.5 text-slate-900 ring-1 ring-slate-200">
          {formatFieldValue(change.field, change.newValue)}
        </span>
      </div>
    ))}
  </div>
);

const PreviewGroup = ({ title, description, rows, tone }) => {
  if (!rows.length) return null;

  const isInsert = tone === "insert";

  return (
    <div className="border-t border-slate-100">
      <div className="flex items-center gap-2 px-4 pt-3">
        {isInsert ? (
          <Plus size={12} className="text-[#2563EB]" />
        ) : (
          <ArrowRight size={12} className="text-slate-400" />
        )}
        <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
          {title} ({rows.length})
        </p>
      </div>
      {description && (
        <p className="px-4 pt-1 text-[10px] font-pmedium text-slate-400">
          {description}
        </p>
      )}
      <div className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
        {rows.map((row) => (
          <div
            key={`${row.action}-${row.passport}-${row.destination}`}
            className="flex items-start gap-2 px-4 py-2"
          >
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-pmedium uppercase tracking-wider ${
                isInsert
                  ? "bg-blue-50 text-[#2563EB] ring-1 ring-blue-100"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {isInsert ? "New row" : "Update"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-pmedium text-slate-800">
                {row.passport}
                <span className="mx-1.5 text-slate-300">→</span>
                {row.destination}
              </p>
              <ChangedFields changedFields={row.changedFields} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DryRunPanel = ({
  result,
  onConfirm,
  onDiscard,
  isCommitting,
  onExportPdf,
  isExporting,
}) => {
  const preview = result.preview || [];
  const inserts = preview.filter((row) => row.action === "insert");
  const updates = preview.filter((row) => row.action !== "insert");
  const hasChanges = preview.length > 0;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        {hasChanges ? (
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-pmedium text-slate-800">
            {hasChanges
              ? `Dry run — ${preview.length} rule${
                  preview.length === 1 ? "" : "s"
                } will change`
              : "Dry run — the sheet already matches the database"}
          </p>
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">
            Nothing has been written yet. Rows that resolve to the current
            values are only counted — only new pairs and real corrections are
            listed below.
          </p>
          {inserts.length > 0 && (
            <p className="mt-1 text-[10px] font-pmedium text-slate-400">
              {inserts.length} of these are brand-new passport → destination
              pairs that do not exist yet; the rest correct existing rules.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExporting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition hover:border-[#2563EB]/40 hover:text-[#2563EB] disabled:opacity-50"
        >
          <FileDown size={12} />
          {isExporting ? "Exporting…" : "Export PDF"}
        </button>
      </div>

      <StatGrid
        items={[
          { label: "Rows read", value: result.processedRows },
          {
            label: "New rows",
            value: result.willInsertCount,
            tone: "text-[#2563EB]",
            labelTone: "text-[#2563EB]",
          },
          {
            label: "Will update",
            value: result.willUpdateCount,
            tone: "text-amber-700",
            labelTone: "text-amber-600",
          },
          {
            label: "No change",
            value: result.unchangedCount,
            tone: "text-emerald-700",
            labelTone: "text-emerald-600",
          },
        ]}
      />

      <RowIssues rowErrors={result.rowErrors} />

      <PreviewGroup
        tone="insert"
        title="New rules to insert"
        description="These pairs have no row in the database yet — confirming will create them."
        rows={inserts}
      />

      <PreviewGroup
        tone="update"
        title="Existing rules to update"
        rows={updates}
      />

      <div className="border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          disabled={!hasChanges || isCommitting}
          onClick={onConfirm}
          className="w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {isCommitting
            ? "Importing..."
            : `Confirm import (${preview.length} rule${
                preview.length === 1 ? "" : "s"
              })`}
        </button>
        <p className="mt-2 text-[10px] font-pmedium text-slate-400">
          Import upserts by passport + destination. Blank cells leave that field
          untouched, -1 clears it, and an unknown pair is inserted as a new row.
        </p>
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isCommitting}
            className="text-[10px] font-pmedium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard preview
          </button>
        </div>
      </div>
    </section>
  );
};

const CommitPanel = ({ result }) => (
  <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
      <div>
        <p className="text-xs font-pmedium text-slate-800">
          {result.message || "Visa rules (v2) imported successfully."}
        </p>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Re-open Visa Countries V2 to see the updated matrix.
        </p>
      </div>
    </div>

    <StatGrid
      items={[
        { label: "Rows read", value: result.processedRows },
        {
          label: "Matched",
          value: result.matchedCount,
          tone: "text-slate-800",
        },
        {
          label: "Modified",
          value: result.modifiedCount,
          tone: "text-amber-700",
          labelTone: "text-amber-600",
        },
        {
          label: "New rows",
          value: result.upsertedCount,
          tone: "text-[#2563EB]",
          labelTone: "text-[#2563EB]",
        },
      ]}
    />

    <RowIssues rowErrors={result.rowErrors} />
  </section>
);

const ErrorPanel = ({ message, rowErrors = [] }) => (
  <section className="mt-3 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/60">
    <div className="flex items-start gap-2 px-4 py-3">
      <X size={15} className="mt-0.5 shrink-0 text-rose-600" />
      <div>
        <p className="text-xs font-pmedium text-rose-700">
          {message || "The import could not be processed."}
        </p>
        <p className="mt-1 text-[10px] font-pmedium text-rose-600">
          No rows were written. Fix the sheet and upload it again.
        </p>
      </div>
    </div>
    <RowIssues rowErrors={rowErrors} />
  </section>
);

const VisaRulesV2Upload = () => {
  const axios = useAxiosPrivate();
  const [requirementFile, setRequirementFile] = useState(null);
  const [durationFile, setDurationFile] = useState(null);
  const [matrixExportProgress, setMatrixExportProgress] = useState(null);
  const [rowFile, setRowFile] = useState(null);
  const [isRowExporting, setIsRowExporting] = useState(false);

  const errorMessage = (error) =>
    error?.response?.data?.message || "Request failed.";

  // Matrix backend returns processedRules/no rowErrors; the shared
  // DryRunPanel/CommitPanel/ErrorPanel read processedRows/rowErrors (the row
  // importer's field names) — normalized here so those components work
  // unchanged for both flows.
  const postMatrixFiles = async (dryRun) => {
    const formData = new FormData();
    formData.append("visa-requirement-file", requirementFile);
    formData.append("visa-duration-file", durationFile);
    const response = await axios.post(
      VISA_MATRIX_IMPORT_ENDPOINT,
      formData,
      dryRun ? { params: { dryRun: true } } : undefined,
    );
    return {
      ...response.data,
      processedRows: response.data.processedRules,
      rowErrors: response.data.rowErrors || [],
    };
  };

  const matrixPreview = useMutation({
    mutationFn: () => postMatrixFiles(true),
    onSuccess: (result) => {
      const count = (result.preview || []).length;
      if (count) {
        toast.success(
          `${count} rule(s) will change — ${result.willInsertCount ?? 0} new, ${
            result.willUpdateCount ?? 0
          } updated. Review, then confirm.`,
        );
      } else {
        toast.info("The sheets already match the database.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const matrixCommit = useMutation({
    mutationFn: () => postMatrixFiles(false),
    onSuccess: (result) => {
      toast.success(
        `Imported: ${result.modifiedCount ?? 0} modified, ${
          result.upsertedCount ?? 0
        } new.`,
      );
      queryClient.invalidateQueries({ queryKey: ["visaCountriesList"] });
      queryClient.invalidateQueries({ queryKey: ["visaRulesByPassport"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pickRequirementFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setRequirementFile(picked);
    matrixPreview.reset();
    matrixCommit.reset();
  };

  const removeRequirementFile = () => {
    setRequirementFile(null);
    matrixPreview.reset();
    matrixCommit.reset();
  };

  const pickDurationFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setDurationFile(picked);
    matrixPreview.reset();
    matrixCommit.reset();
  };

  const removeDurationFile = () => {
    setDurationFile(null);
    matrixPreview.reset();
    matrixCommit.reset();
  };

  const buildMatrixReport = () => {
    const result = matrixPreview.data || {};
    const previewRows = result.preview || [];
    const changeRows = [];

    previewRows.forEach((row) => {
      (row.changedFields || []).forEach((change) => {
        changeRows.push([
          row.action === "insert" ? "New row" : "Update",
          row.passport || "",
          row.destination || "",
          FIELD_LABELS[change.field] || change.field,
          formatFieldValue(change.field, change.oldValue),
          formatFieldValue(change.field, change.newValue),
        ]);
      });
    });

    const skippedRows = (result.rowErrors || []).map((entry) => [
      `Row ${entry.rowNumber}`,
      entry.reason,
    ]);

    return {
      title: "Visa Rules V2 Matrix — Dry Run",
      module: "Data Upload",
      page: "Visa Rules V2 Import",
      action: "Dry run PDF — Visa Rules V2 Matrix",
      fileName: [requirementFile?.name, durationFile?.name].filter(Boolean).join(" + "),
      summary: [
        { label: "Pairs read", value: result.processedRows ?? 0 },
        { label: "New rows", value: result.willInsertCount ?? 0 },
        { label: "Will update", value: result.willUpdateCount ?? 0 },
        { label: "No change", value: result.unchangedCount ?? 0 },
      ],
      sections: [
        {
          title: `Rules changing (${previewRows.length})`,
          columns: [
            { label: "Action", width: 0.1 },
            { label: "Passport", width: 0.2 },
            { label: "Destination", width: 0.2 },
            { label: "Field", width: 0.16 },
            { label: "Before", width: 0.17 },
            { label: "After", width: 0.17 },
          ],
          rows: changeRows,
        },
      ].filter((section) => section.rows.length > 0),
      notes: [
        "This is a dry run: no visa rule was written by generating this report.",
        "Requirement-sheet rows set both fields; duration-only rows never overwrite an existing requirement.",
      ],
    };
  };

  const matrixPdfExport = useMutation({
    mutationFn: () => exportDryRunPdf({ axios, report: buildMatrixReport() }),
    onSuccess: ({ stored }) => {
      if (stored) {
        toast.success("PDF downloaded and archived in Master Panel logs.");
      } else {
        toast.warning("PDF downloaded, but the archived copy could not be saved to logs.");
      }
    },
    onError: async (error) => toast.error(await readDryRunReportError(error)),
  });

  const matrixBusy = matrixPreview.isPending || matrixCommit.isPending;
  const matrixFailedRequest = matrixPreview.error || matrixCommit.error;
  const matrixFailedResult = matrixFailedRequest?.response?.data;
  const isMatrixExporting = Boolean(matrixExportProgress);

  const postRowFile = async (dryRun) => {
    const formData = new FormData();
    formData.append(VISA_ROW_IMPORT_FIELD, rowFile);
    const response = await axios.post(
      VISA_ROW_IMPORT_ENDPOINT,
      formData,
      dryRun ? { params: { dryRun: true } } : undefined,
    );
    return response.data;
  };

  const rowPreview = useMutation({
    mutationFn: () => postRowFile(true),
    onSuccess: (result) => {
      const count = (result.preview || []).length;
      if (count) {
        toast.success(
          `${count} rule(s) will change — ${result.willInsertCount ?? 0} new, ${
            result.willUpdateCount ?? 0
          } updated. Review, then confirm.`,
        );
      } else {
        toast.info("The sheet already matches the database.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rowCommit = useMutation({
    mutationFn: () => postRowFile(false),
    onSuccess: (result) => {
      toast.success(
        `Imported: ${result.modifiedCount ?? 0} modified, ${
          result.upsertedCount ?? 0
        } new.`,
      );
      queryClient.invalidateQueries({ queryKey: ["visaCountriesList"] });
      queryClient.invalidateQueries({ queryKey: ["visaRulesByPassport"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const pickRowFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setRowFile(picked);
    rowPreview.reset();
    rowCommit.reset();
  };

  const removeRowFile = () => {
    setRowFile(null);
    rowPreview.reset();
    rowCommit.reset();
  };

  const buildRowReport = () => {
    const result = rowPreview.data || {};
    const previewRows = result.preview || [];
    const changeRows = [];

    previewRows.forEach((row) => {
      (row.changedFields || []).forEach((change) => {
        changeRows.push([
          row.action === "insert" ? "New row" : "Update",
          row.passport || "",
          row.destination || "",
          FIELD_LABELS[change.field] || change.field,
          formatFieldValue(change.field, change.oldValue),
          formatFieldValue(change.field, change.newValue),
        ]);
      });
    });

    return {
      title: "Visa Rules V2 — Dry Run",
      module: "Data Upload",
      page: "Visa Rules V2 Import",
      action: "Dry run PDF — Visa Rules V2",
      fileName: rowFile?.name,
      summary: [
        { label: "Rows read", value: result.processedRows ?? 0 },
        { label: "New rows", value: result.willInsertCount ?? 0 },
        { label: "Will update", value: result.willUpdateCount ?? 0 },
        { label: "No change", value: result.unchangedCount ?? 0 },
      ],
      sections: [
        {
          title: `Rules changing (${previewRows.length})`,
          columns: [
            { label: "Action", width: 0.1 },
            { label: "Passport", width: 0.2 },
            { label: "Destination", width: 0.2 },
            { label: "Field", width: 0.16 },
            { label: "Before", width: 0.17 },
            { label: "After", width: 0.17 },
          ],
          rows: changeRows,
        },
      ].filter((section) => section.rows.length > 0),
      notes: ["This is a dry run: no visa rule was written by generating this report."],
    };
  };

  const rowPdfExport = useMutation({
    mutationFn: () => exportDryRunPdf({ axios, report: buildRowReport() }),
    onSuccess: ({ stored }) => {
      if (stored) {
        toast.success("PDF downloaded and archived in Master Panel logs.");
      } else {
        toast.warning("PDF downloaded, but the archived copy could not be saved to logs.");
      }
    },
    onError: async (error) => toast.error(await readDryRunReportError(error)),
  });

  const rowBusy = rowPreview.isPending || rowCommit.isPending;
  const rowFailedRequest = rowPreview.error || rowCommit.error;
  const rowFailedResult = rowFailedRequest?.response?.data;

  const handleExportRows = async () => {
    try {
      setIsRowExporting(true);
      const { countries, rulesByPassport, failedPassports } = await fetchAllVisaRules();

      const rows = [["Passport", "Destination", "Requirement", "DurationDays"]];
      countries.forEach((passport) => {
        const rules = rulesByPassport.get(passport) || [];
        rules.forEach((rule) => {
          rows.push([
            passport,
            rule.destination,
            rule.requirement ?? "",
            rule.durationDays ?? "",
          ]);
        });
      });

      downloadCsv({ filename: "wono_visa_rules.csv", matrix: rows });

      if (failedPassports.length) {
        toast.warning(`Exported, but ${describeFailures(failedPassports)}`);
      } else {
        toast.success(`Exported ${rows.length - 1} rule(s).`);
      }
    } catch (error) {
      toast.error(error.message || "Export failed. Please try again.");
    } finally {
      setIsRowExporting(false);
    }
  };

  // Shared by both export buttons: pulls every passport's rules via the
  // already-proven-fast per-passport endpoint, batched, never one big
  // unfiltered query. Row export flattens the result; matrix export reshapes
  // the same data into two grids.
  // Served from Nomads' in-memory cache (10-min stale-while-revalidate,
  // refreshed via the same scoped per-passport queries this used to run
  // client-side) — one request instead of ~190 batched ones.
  const fetchAllVisaRules = async (onProgress) => {
    onProgress?.(0, 1);
    const response = await axios.get(`${NOMADS_API_BASE_URL}/visa-rules-v2/cached-all`);
    const { countries = [], rulesByPassport: rulesByPassportObject = {} } = response.data || {};
    if (!countries.length) {
      throw new Error("No passports found to export.");
    }
    onProgress?.(1, 1);

    return {
      countries,
      rulesByPassport: new Map(Object.entries(rulesByPassportObject)),
      failedPassports: [],
    };
  };

  const describeFailures = (failedPassports) =>
    `${failedPassports.length} passport(s) failed: ${failedPassports
      .slice(0, 5)
      .join(", ")}${failedPassports.length > 5 ? "…" : ""}`;

  const handleExportMatrices = async () => {
    try {
      setMatrixExportProgress({ done: 0, total: 0 });
      const { countries, rulesByPassport, failedPassports } = await fetchAllVisaRules(
        (done, total) => setMatrixExportProgress({ done, total }),
      );

      // Same universe for rows and columns, generated together — so both
      // files always have identical destination columns, no manual-edit
      // mismatch possible.
      const destinations = countries;
      const header = ["Passport", ...destinations];
      const requirementMatrix = [header];
      const durationMatrix = [header];

      countries.forEach((passport) => {
        const rules = rulesByPassport.get(passport) || [];
        const requirementByDestination = new Map(
          rules.map((rule) => [rule.destination, rule.requirement || ""]),
        );
        const durationByDestination = new Map(
          rules.map((rule) => [rule.destination, rule.durationDays ?? ""]),
        );
        requirementMatrix.push([
          passport,
          ...destinations.map((destination) =>
            destination === passport
              ? "N/A"
              : requirementByDestination.get(destination) ?? "",
          ),
        ]);
        durationMatrix.push([
          passport,
          ...destinations.map((destination) => {
            if (destination === passport) return "N/A";
            const value = durationByDestination.get(destination);
            return value === undefined || value === null || value === "" ? "N/A" : value;
          }),
        ]);
      });

      downloadCsv({ filename: "wono_visa_requirement_matrix.csv", matrix: requirementMatrix });
      downloadCsv({ filename: "wono_visa_duration_matrix.csv", matrix: durationMatrix });

      if (failedPassports.length) {
        toast.warning(`Exported, but ${describeFailures(failedPassports)}`);
      } else {
        toast.success(
          `Exported matrices: ${countries.length} passports × ${destinations.length} destinations.`,
        );
      }
    } catch (error) {
      toast.error(error.message || "Matrix export failed. Please try again.");
    } finally {
      setMatrixExportProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* <UploadCard
        title="Visa Rules V2 Matrix Import"
        description="Upload a Requirement matrix + a Duration matrix (passport rows, destination columns) — matches how the source data is kept upstream."
      >
        <p className="mb-3 text-[10px] font-pmedium text-slate-400">
          First column <span className="text-slate-600">Passport</span>, every
          other column a destination. Same destination columns in both files —
          a column only in the Requirement file is fine, but a column only in
          the Duration file never overwrites an existing requirement.
        </p>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="text-[10px] font-pmedium text-slate-500">
            {isMatrixExporting
              ? `Exporting passports… ${matrixExportProgress.done}/${matrixExportProgress.total}`
              : "Export both matrices from current data, ready to edit and re-upload."}
          </p>
          <button
            type="button"
            onClick={handleExportMatrices}
            disabled={isMatrixExporting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[10px] font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown size={12} />
            {isMatrixExporting ? "Exporting..." : "Export Matrices (2 .csv)"}
          </button>
        </div>

        <UploadPanel>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                Requirement matrix
              </p>
              <FileDropzone
                file={requirementFile}
                onPick={pickRequirementFile}
                onRemove={removeRequirementFile}
                accept=".csv"
                dataTour="data-upload-matrix-requirement"
                disabled={matrixBusy}
                hint="Passport + one column per destination"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                Duration matrix
              </p>
              <FileDropzone
                file={durationFile}
                onPick={pickDurationFile}
                onRemove={removeDurationFile}
                accept=".csv"
                dataTour="data-upload-matrix-duration"
                disabled={matrixBusy}
                hint="Passport + one column per destination"
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
              How cells are read
            </p>
            <ul className="mt-1.5 space-y-1 text-[10px] font-pmedium text-slate-500">
              <li>
                A cell in the Requirement file sets both Requirement and
                Duration for that pair — blank Duration for it becomes empty,
                not left alone.
              </li>
              <li>
                A pair only present in the Duration file sets Duration only;
                an existing Requirement is never touched.
              </li>
              <li>
                A Passport + Destination pair that isn’t in the database yet is
                inserted as a new row.
              </li>
            </ul>
          </div>

          <UploadActions
            onUpload={() => matrixPreview.mutate()}
            onReset={() => {
              removeRequirementFile();
              removeDurationFile();
            }}
            uploadLabel="Preview changes (dry run)"
            pendingLabel="Checking sheets..."
            uploadDisabled={!requirementFile || !durationFile || matrixBusy}
            resetDisabled={matrixBusy}
            pending={matrixPreview.isPending}
          />

          {matrixFailedResult && (
            <ErrorPanel
              message={matrixFailedResult.message}
              rowErrors={matrixFailedResult.rowErrors}
            />
          )}

          {matrixPreview.data && !matrixCommit.data && (
            <DryRunPanel
              result={matrixPreview.data}
              onConfirm={() => matrixCommit.mutate()}
              onDiscard={() => matrixPreview.reset()}
              isCommitting={matrixCommit.isPending}
              onExportPdf={() => matrixPdfExport.mutate()}
              isExporting={matrixPdfExport.isPending}
            />
          )}

          {matrixCommit.data && <CommitPanel result={matrixCommit.data} />}
        </UploadPanel>
      </UploadCard> */}

      <UploadCard
        title="Visa Rules V2 Import"
        description="One CSV, one row per passport → destination pair — simpler to hand-edit a few rules than the matrix."
      >
        <p className="mb-3 text-[10px] font-pmedium text-slate-400">
          Columns: <span className="text-slate-600">Passport, Destination, Requirement, DurationDays</span>.
          Blank cells leave that field unchanged; -1 clears it.
        </p>

        {/* <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="text-[10px] font-pmedium text-slate-500">
            Export every rule as one sheet, ready to edit and re-upload.
          </p>
          <button
            type="button"
            onClick={handleExportRows}
            disabled={isRowExporting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[10px] font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown size={12} />
            {isRowExporting ? "Exporting..." : "Export All (.csv)"}
          </button>
        </div> */}

        <UploadPanel>
          <FileDropzone
            file={rowFile}
            onPick={pickRowFile}
            onRemove={removeRowFile}
            accept=".csv"
            dataTour="data-upload-visa-rows"
            disabled={rowBusy}
            hint="Passport, Destination, Requirement, DurationDays"
          />

          <UploadActions
            onUpload={() => rowPreview.mutate()}
            onReset={removeRowFile}
            uploadLabel="Preview changes (dry run)"
            pendingLabel="Checking sheet..."
            uploadDisabled={!rowFile || rowBusy}
            resetDisabled={rowBusy}
            pending={rowPreview.isPending}
          />

          {rowFailedResult && (
            <ErrorPanel
              message={rowFailedResult.message}
              rowErrors={rowFailedResult.rowErrors}
            />
          )}

          {rowPreview.data && !rowCommit.data && (
            <DryRunPanel
              result={rowPreview.data}
              onConfirm={() => rowCommit.mutate()}
              onDiscard={() => rowPreview.reset()}
              isCommitting={rowCommit.isPending}
              onExportPdf={() => rowPdfExport.mutate()}
              isExporting={rowPdfExport.isPending}
            />
          )}

          {rowCommit.data && <CommitPanel result={rowCommit.data} />}
        </UploadPanel>
      </UploadCard>
    </div>
  );
};

export default VisaRulesV2Upload;
