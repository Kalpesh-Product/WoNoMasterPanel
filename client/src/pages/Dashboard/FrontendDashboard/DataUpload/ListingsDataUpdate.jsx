import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, FileDown, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { toCsv } from "../../../../utils/csvExport";
import { exportDryRunPdf, readDryRunReportError } from "../../../../utils/dryRunReport";
import { TemplateDownloadLink } from "./UploadUI";

// This server forwards the write to Nomads' /company/bulk-update-company-stats,
// which has no preview mode of its own — so the dry-run diff below is built
// here, against Nomads' own company directory (fetchNomadsCompanyListings),
// before anything is sent to that write endpoint. Same URL handles both
// steps: ?dryRun=true previews, no query writes.
const isCsv = (file) => /\.csv$/i.test(file.name);
const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
const formatValue = (value) => (value === null || value === undefined || value === "" ? "— (blank)" : String(value));

const CURRENT_DATA_HEADERS = ["Business ID", "Business Name", "Ratings", "Total Reviews", "STATUS"];
const currentDataFilename = () => `Listings Data - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.csv`;

const StatGrid = ({ items }) => (
  <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5">
    {items.map((item) => (
      <div key={item.label} className="px-3 py-3 text-center">
        <p className={`text-[9px] font-pmedium uppercase tracking-widest ${item.labelTone || "text-slate-400"}`}>{item.label}</p>
        <p className={`mt-1 text-lg font-pmedium ${item.tone || "text-slate-800"}`}>{item.value ?? 0}</p>
      </div>
    ))}
  </div>
);

const RowIssues = ({ rowErrors = [], notFound = [] }) => (
  <>
    {notFound.length > 0 && (
      <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
          <AlertTriangle size={13} />
          {notFound.length} Business ID{notFound.length === 1 ? "" : "s"} not in the Nomads directory — skipped
        </div>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
          {notFound.map((entry) => (
            <p key={`${entry.rowNumber}-${entry.id}`} className="text-[10px] font-pmedium text-amber-800">
              Row {entry.rowNumber} · {entry.id}
            </p>
          ))}
        </div>
      </div>
    )}

    {rowErrors.length > 0 && (
      <div className="border-t border-rose-100 bg-rose-50/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-rose-700">
          <AlertTriangle size={13} />
          Row issues
        </div>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
          {rowErrors.map((entry, index) => (
            <p key={`${entry.row}-${entry.column}-${index}`} className="text-[10px] font-pmedium text-rose-700">
              Row {entry.row}{entry.column ? ` · ${entry.column}` : ""} — {entry.reason}
            </p>
          ))}
        </div>
      </div>
    )}
  </>
);

const DryRunPanel = ({ result, onConfirm, onDiscard, isCommitting, onExportPdf, isExporting }) => {
  const preview = result.preview || [];
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
            {hasChanges ? `Dry run — ${preview.length} listing${preview.length === 1 ? "" : "s"} will change` : "Dry run — nothing to update"}
          </p>
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">
            Nothing has been written yet. Review the diff below, then apply it — or discard and re-upload.
          </p>
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
          { label: "Will update", value: result.willUpdateCount, tone: "text-emerald-700", labelTone: "text-emerald-600" },
          { label: "No change", value: result.unchangedCount },
          { label: "Not found", value: result.notFoundCount, tone: "text-amber-700", labelTone: "text-amber-600" },
          { label: "Row issues", value: (result.rowErrors || []).length, tone: "text-rose-600", labelTone: "text-rose-500" },
        ]}
      />

      {hasChanges && (
        <div className="border-t border-slate-100">
          <p className="px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">Changed listings</p>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
            {preview.map((row) => (
              <div key={row.id} className="px-4 py-2.5">
                <p className="truncate text-xs font-pmedium text-slate-800">
                  {row.businessName || row.businessId}
                  <span className="ml-2 text-[10px] font-pmedium text-slate-400">{row.businessId} · Row {row.rowNumber}</span>
                </p>
                <div className="mt-1.5 space-y-1 pl-1">
                  {row.changedFields.map((change) => (
                    <div key={change.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-pmedium">
                      <span className="min-w-[90px] text-slate-400">{change.label}</span>
                      <span className="text-slate-400 line-through decoration-slate-300">{formatValue(change.oldValue)}</span>
                      <ArrowRight size={10} className="shrink-0 text-slate-300" />
                      <span className="rounded bg-white px-1 py-0.5 text-slate-900 ring-1 ring-slate-200">{formatValue(change.newValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RowIssues rowErrors={result.rowErrors} notFound={result.notFound} />

      <div className="border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          disabled={!hasChanges || isCommitting}
          onClick={onConfirm}
          className="w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {isCommitting ? "Applying..." : `Apply ${preview.length} change${preview.length === 1 ? "" : "s"}`}
        </button>
        <p className="mt-2 text-[10px] font-pmedium text-slate-400">
          Blank Ratings / Total Reviews cells never overwrite existing values. Rows marked IN-ACTIVE are made private; nothing is ever force-published.
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
        <p className="text-xs font-pmedium text-slate-800">{result.message || "Listings data update completed"}</p>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Blank Ratings / Total Reviews cells never overwrite existing values. Rows marked IN-ACTIVE were made private; nothing was made public.
        </p>
      </div>
    </div>

    <StatGrid
      items={[
        { label: "Rows read", value: result.totalRows },
        { label: "Matched", value: result.matched },
        { label: "Updated", value: result.updated, tone: "text-emerald-700", labelTone: "text-emerald-600" },
        { label: "Made private", value: result.markedPrivate, tone: "text-blue-700", labelTone: "text-blue-600" },
        { label: "Row issues", value: result.failed, tone: "text-rose-600", labelTone: "text-rose-500" },
      ]}
    />

    <RowIssues rowErrors={result.failures} />
  </section>
);

const ErrorPanel = ({ message, rowErrors = [] }) => (
  <section className="mt-3 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/60">
    <div className="flex items-start gap-2 px-4 py-3">
      <X size={15} className="mt-0.5 shrink-0 text-rose-600" />
      <div>
        <p className="text-xs font-pmedium text-rose-700">{message || "The update could not be processed."}</p>
        {rowErrors.length > 0 && (
          <div className="mt-2 space-y-1">
            {rowErrors.slice(0, 10).map((entry, index) => (
              <p key={`${entry.row}-${index}`} className="text-[10px] font-pmedium text-rose-600">
                Row {entry.row} · {entry.column || "Unknown"} — {entry.reason}
              </p>
            ))}
            {rowErrors.length > 10 && <p className="text-[10px] font-pmedium text-rose-500">+{rowErrors.length - 10} more rows with issues</p>}
          </div>
        )}
      </div>
    </div>
  </section>
);

const ListingsDataUpdate = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const postFile = async (dryRun) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post("/api/admin/bulk-update-listing-stats", formData, dryRun ? { params: { dryRun: true } } : undefined);
    return response.data;
  };

  const errorMessage = (error) => error?.response?.data?.message || "Request failed.";

  const preview = useMutation({
    mutationFn: () => postFile(true),
    onSuccess: (result) => {
      if (result.willUpdateCount) {
        toast.success(`${result.willUpdateCount} listing(s) will change. Review the diff, then apply.`);
      } else {
        toast.info("No listing changes found in this file.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const commit = useMutation({
    mutationFn: () => postFile(false),
    onSuccess: (result) => {
      toast.success(`Updated ${result.updated ?? 0} listings, ${result.markedPrivate ?? 0} made private.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetAll = () => {
    setFile(null);
    preview.reset();
    commit.reset();
  };

  // Live export: the same Nomads company directory the dry run diffs
  // against, shaped as the columns this upload reads back — a monthly
  // reference and a round-trip file, same idea as Destination Ranking
  // Upload's "Download current data".
  const { data: currentListings = [] } = useQuery({
    queryKey: ["listings-current-data"],
    queryFn: async () => {
      const response = await axios.get("/api/admin/listings-current-data");
      return response.data?.items || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const [currentDataHref, setCurrentDataHref] = useState("");
  useEffect(() => {
    if (!currentListings.length) {
      setCurrentDataHref("");
      return undefined;
    }
    const matrix = [
      CURRENT_DATA_HEADERS,
      ...currentListings.map((item) => [item.businessId, item.businessName, item.ratings, item.totalReviews, item.status]),
    ];
    const blob = new Blob(["﻿", toCsv(matrix)], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    setCurrentDataHref(url);
    return () => window.URL.revokeObjectURL(url);
  }, [currentListings]);

  const acceptFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setFile(picked);
    preview.reset();
    commit.reset();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(event.dataTransfer.files || []);
    if (dropped.length > 1) {
      toast.error("Drop one file at a time.");
      return;
    }
    acceptFile(dropped[0]);
  };

  const buildReport = () => {
    const result = preview.data || {};
    const previewRows = result.preview || [];
    const changeRows = [];
    previewRows.forEach((row) => {
      (row.changedFields || []).forEach((change) => {
        changeRows.push([
          `${row.businessName || row.businessId} (Row ${row.rowNumber})`,
          change.label,
          formatValue(change.oldValue),
          formatValue(change.newValue),
        ]);
      });
    });
    const notFoundRows = (result.notFound || []).map((entry) => [`Row ${entry.rowNumber}`, entry.id]);
    const errorRows = (result.rowErrors || []).map((entry, index) => [`Row ${entry.row ?? index}`, entry.column || "—", entry.reason]);

    return {
      title: "Listings Data Update — Dry Run",
      module: "Data Upload",
      page: "Listings Data Update",
      action: "Dry run PDF — Listings Data Update",
      fileName: file?.name || "",
      summary: [
        { label: "Rows read", value: result.processedRows ?? 0 },
        { label: "Will update", value: result.willUpdateCount ?? 0 },
        { label: "No change", value: result.unchangedCount ?? 0 },
        { label: "Not found", value: result.notFoundCount ?? 0 },
        { label: "Row issues", value: (result.rowErrors || []).length },
      ],
      sections: [
        {
          title: `Listing changes (${changeRows.length})`,
          columns: [
            { label: "Listing", width: 0.4 },
            { label: "Field", width: 0.2 },
            { label: "Before", width: 0.2 },
            { label: "After", width: 0.2 },
          ],
          rows: changeRows,
        },
        {
          title: `Business IDs not in Nomads — skipped (${notFoundRows.length})`,
          columns: [
            { label: "Row", width: 0.2 },
            { label: "Business ID", width: 0.8 },
          ],
          rows: notFoundRows,
        },
        {
          title: `Row issues (${errorRows.length})`,
          columns: [
            { label: "Row", width: 0.16 },
            { label: "Column", width: 0.26 },
            { label: "Reason", width: 0.58 },
          ],
          rows: errorRows,
        },
      ].filter((section) => section.rows.length > 0),
      notes: [
        "This is a dry run: no listing was written by generating this report.",
        "Rows are matched by Business ID against Nomads' own company directory.",
        "Blank Ratings / Total Reviews cells never overwrite existing values.",
      ],
    };
  };

  const pdfExport = useMutation({
    mutationFn: () => exportDryRunPdf({ axios, report: buildReport() }),
    onSuccess: ({ stored }) => {
      toast[stored ? "success" : "warning"](stored ? "PDF downloaded and archived in Master Panel logs." : "PDF downloaded, but the archived copy could not be saved to logs.");
    },
    onError: async (error) => toast.error(await readDryRunReportError(error)),
  });

  const previewResult = preview.data;
  const commitResult = commit.data;
  const failedRequest = preview.error || commit.error;
  const failedResult = failedRequest?.response?.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-pmedium text-slate-700">Listings Data Update</p>
          <TemplateDownloadLink
            href={currentDataHref}
            label="Download current data (.csv)"
            filename={currentDataFilename()}
          />
        </div>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Best flow: download the current data → edit Ratings, Total Reviews or STATUS → upload here. Rows are matched by
          Business ID. Ratings and Total Reviews update only where the sheet has a value — blank cells are left untouched.
          Rows marked IN-ACTIVE are taken off the public site (made private); this upload never makes a listing public.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-pmedium text-slate-900">{file.name}</p>
                <p className="text-[10px] font-pmedium text-slate-400">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={resetAll}
                aria-label="Remove file"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              data-tour="data-upload-dropzone"
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${isDragOver ? "border-[#2563EB] bg-blue-50/60" : "border-slate-200 bg-white hover:border-[#2563EB]/40 hover:bg-blue-50/30"}`}
            >
              <UploadCloud size={22} className={isDragOver ? "text-[#2563EB]" : "text-slate-400"} />
              <span className="text-xs font-pmedium text-slate-600">Drag &amp; drop the .csv file here, or click to browse</span>
              <span className="text-[10px] font-pmedium text-slate-400">Required columns: Business ID · Ratings · Total Reviews · STATUS</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = ""; }}
              />
            </label>
          )}

          <button
            type="button"
            disabled={!file || preview.isPending || commit.isPending}
            onClick={() => preview.mutate()}
            data-tour="data-upload-actions"
            className="mt-3 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {preview.isPending ? "Checking file..." : "Preview changes (dry run)"}
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={preview.isPending || commit.isPending}
            className="mt-2 w-full text-center text-[10px] font-pmedium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          {failedResult && <ErrorPanel message={failedResult.message} rowErrors={failedResult.failures} />}

          {previewResult && !commitResult && (
            <DryRunPanel
              result={previewResult}
              onConfirm={() => commit.mutate()}
              onDiscard={() => preview.reset()}
              isCommitting={commit.isPending}
              onExportPdf={() => pdfExport.mutate()}
              isExporting={pdfExport.isPending}
            />
          )}

          {commitResult && <CommitPanel result={commitResult} />}
        </div>
      </div>
    </div>
  );
};

export default ListingsDataUpdate;
