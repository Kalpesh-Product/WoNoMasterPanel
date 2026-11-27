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

// Nomads owns this endpoint. Import format is one row per passport +
// destination pair. Unlike the weights importer this one upserts: a visa
// rule legitimately gains new passport/destination pairs over time, so
// "insert" is a normal outcome, not an error.
// Same URL handles both steps: ?dryRun=true previews, no query writes.
const VISA_IMPORT_ENDPOINT = `${NOMADS_API_BASE_URL}/visa-rules-v2/import-rows-csv`;
const VISA_IMPORT_FIELD = "visa-rules-file";

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

// How many passports to fetch in parallel per round. The all-passports
// backend export (one unfiltered collection scan) hangs in production; this
// instead reuses the per-passport endpoint — already proven fast — in small
// batches, so no single request is ever large.
const EXPORT_BATCH_SIZE = 5;

const VisaRulesV2Upload = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [exportProgress, setExportProgress] = useState(null);

  const postFile = async (dryRun) => {
    const formData = new FormData();
    formData.append(VISA_IMPORT_FIELD, file);
    const response = await axios.post(
      VISA_IMPORT_ENDPOINT,
      formData,
      dryRun ? { params: { dryRun: true } } : undefined,
    );
    return response.data;
  };

  const errorMessage = (error) =>
    error?.response?.data?.message || "Request failed.";

  const preview = useMutation({
    mutationFn: () => postFile(true),
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

  const commit = useMutation({
    mutationFn: () => postFile(false),
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

  const pickFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setFile(picked);
    preview.reset();
    commit.reset();
  };

  const removeFile = () => {
    setFile(null);
    preview.reset();
    commit.reset();
  };

  // The archived PDF mirrors the dry-run preview: every rule that would be
  // inserted or corrected, plus the rows the backend skipped.
  const buildReport = () => {
    const result = preview.data || {};
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
      title: "Visa Rules V2 — Dry Run",
      module: "Data Upload",
      page: "Visa Rules V2 Import",
      action: "Dry run PDF — Visa Rules V2",
      fileName: file?.name || "",
      summary: [
        { label: "Rows read", value: result.processedRows ?? 0 },
        { label: "New rows", value: result.willInsertCount ?? 0 },
        { label: "Will update", value: result.willUpdateCount ?? 0 },
        { label: "No change", value: result.unchangedCount ?? 0 },
        { label: "Row issues", value: (result.rowErrors || []).length },
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
        {
          title: `Rows skipped (${skippedRows.length})`,
          columns: [
            { label: "Row", width: 0.16 },
            { label: "Reason", width: 0.84 },
          ],
          rows: skippedRows,
        },
      ].filter((section) => section.rows.length > 0),
      notes: [
        "This is a dry run: no visa rule was written by generating this report.",
        "Import upserts by passport + destination. Blank cells leave a field untouched, -1 clears it, and an unknown pair is inserted.",
      ],
    };
  };

  const pdfExport = useMutation({
    mutationFn: () => exportDryRunPdf({ axios, report: buildReport() }),
    onSuccess: ({ stored }) => {
      if (stored) {
        toast.success("PDF downloaded and archived in Master Panel logs.");
      } else {
        toast.warning("PDF downloaded, but the archived copy could not be saved to logs.");
      }
    },
    onError: async (error) => toast.error(await readDryRunReportError(error)),
  });

  const busy = preview.isPending || commit.isPending;
  const failedRequest = preview.error || commit.error;
  const failedResult = failedRequest?.response?.data;
  const isExporting = Boolean(exportProgress);

  const handleExportAll = async () => {
    try {
      const countriesRes = await axios.get(
        `${NOMADS_API_BASE_URL}/visa-rules-v2/destinations/countries`,
      );
      const passports = countriesRes?.data?.countries || [];
      if (!passports.length) {
        toast.error("No passports found to export.");
        return;
      }

      setExportProgress({ done: 0, total: passports.length });
      const matrix = [["Passport", "Destination", "Requirement", "DurationDays"]];
      const failedPassports = [];

      for (let i = 0; i < passports.length; i += EXPORT_BATCH_SIZE) {
        const batch = passports.slice(i, i + EXPORT_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((passport) =>
            axios.get(
              `${NOMADS_API_BASE_URL}/visa-rules-v2/passport/${encodeURIComponent(passport)}`,
            ),
          ),
        );

        results.forEach((result, index) => {
          const passport = batch[index];
          if (result.status === "fulfilled") {
            const rules = result.value?.data?.data || [];
            rules.forEach((rule) => {
              matrix.push([
                passport,
                rule.destination || "",
                rule.requirement || "",
                rule.durationDays ?? "",
              ]);
            });
          } else {
            failedPassports.push(passport);
          }
        });

        setExportProgress({
          done: Math.min(i + EXPORT_BATCH_SIZE, passports.length),
          total: passports.length,
        });
      }

      downloadCsv({ filename: "wono_visa_rules_v2_full.csv", matrix });

      if (failedPassports.length) {
        toast.warning(
          `Exported, but ${failedPassports.length} passport(s) failed: ${failedPassports.slice(0, 5).join(", ")}${failedPassports.length > 5 ? "…" : ""}`,
        );
      } else {
        toast.success(`Exported ${passports.length} passports, ${matrix.length - 1} rows.`);
      }
    } catch (error) {
      toast.error("Export failed. Please try again.");
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <UploadCard
        title="Visa Rules V2 Import"
        description="Upload one CSV to preview and import visa rules for every passport → destination pair."
      >
        <p className="mb-3 text-[10px] font-pmedium text-slate-400">
          One row per rule with the columns{" "}
          <span className="text-slate-600">Passport, Destination, Requirement,
          DurationDays</span>. The file only needs to contain the rows you want
          to touch; everything else in the database is left alone.
        </p>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="text-[10px] font-pmedium text-slate-500">
            {isExporting
              ? `Exporting passports… ${exportProgress.done}/${exportProgress.total}`
              : "Export every passport's current rules into one CSV, ready to edit and re-upload."}
          </p>
          <button
            type="button"
            onClick={handleExportAll}
            disabled={isExporting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[10px] font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileDown size={12} />
            {isExporting ? "Exporting..." : "Export All (.csv)"}
          </button>
        </div>

        <UploadPanel>
          <FileDropzone
            file={file}
            onPick={pickFile}
            onRemove={removeFile}
            accept=".csv"
            dataTour="data-upload-dropzone"
            disabled={busy}
            hint="CSV with Passport, Destination, Requirement, DurationDays"
          />

          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
              How cells are read
            </p>
            <ul className="mt-1.5 space-y-1 text-[10px] font-pmedium text-slate-500">
              <li>
                <span className="text-slate-700">Blank</span> Requirement or
                DurationDays → that field is left unchanged.
              </li>
              <li>
                <span className="text-slate-700">-1</span> in either column →
                that field is explicitly cleared.
              </li>
              <li>
                A Passport + Destination pair that isn’t in the database yet is
                inserted as a new row.
              </li>
              <li>
                Both cells blank in a row → the row is skipped and listed as a
                row issue.
              </li>
            </ul>
          </div>

          <UploadActions
            onUpload={() => preview.mutate()}
            onReset={removeFile}
            uploadLabel="Preview changes (dry run)"
            pendingLabel="Checking sheet..."
            uploadDisabled={!file || busy}
            resetDisabled={busy}
            pending={preview.isPending}
          />

          {failedResult && (
            <ErrorPanel
              message={failedResult.message}
              rowErrors={failedResult.rowErrors}
            />
          )}

          {preview.data && !commit.data && (
            <DryRunPanel
              result={preview.data}
              onConfirm={() => commit.mutate()}
              onDiscard={() => preview.reset()}
              isCommitting={commit.isPending}
              onExportPdf={() => pdfExport.mutate()}
              isExporting={pdfExport.isPending}
            />
          )}

          {commit.data && <CommitPanel result={commit.data} />}
        </UploadPanel>
      </UploadCard>
    </div>
  );
};

export default VisaRulesV2Upload;
