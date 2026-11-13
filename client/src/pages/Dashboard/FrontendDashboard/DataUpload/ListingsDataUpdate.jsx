import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  X,
} from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { TemplateDownloadLink } from "./UploadUI";

const isSpreadsheet = (file) => /\.(xlsx|xlsm)$/i.test(file.name);
const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const STATS = [
  { key: "totalRows", label: "Sheet rows", tone: "text-slate-800" },
  { key: "updated", label: "Updated", tone: "text-emerald-700", labelTone: "text-emerald-600" },
  { key: "markedPrivate", label: "Made private", tone: "text-blue-700", labelTone: "text-blue-600" },
  { key: "matched", label: "Matched in DB", tone: "text-slate-800" },
  { key: "failed", label: "Row issues", tone: "text-rose-600", labelTone: "text-rose-500" },
  { key: "blanks", label: "Blank cells skipped", tone: "text-slate-800" },
];

const UpdateResultSummary = ({ result }) => {
  const stats = {
    ...result,
    blanks: (result.blankRatings || 0) + (result.blankReviews || 0),
  };

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
        {result.success ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        ) : (
          <X size={15} className="mt-0.5 shrink-0 text-rose-600" />
        )}
        <div>
          <p className="text-xs font-pmedium text-slate-800">
            {result.success
              ? "Listings data update completed"
              : "Update could not be completed"}
          </p>
          {!result.success && result.message && (
            <p className="mt-1 text-[10px] font-pmedium text-rose-600">
              {result.message}
            </p>
          )}
          {result.success && (
            <p className="mt-1 text-[10px] font-pmedium text-slate-400">
              Blank Ratings / Total Reviews cells never overwrite existing
              values. Rows marked IN-ACTIVE were made private; nothing was made
              public.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-y divide-slate-100">
        {STATS.map((stat) => (
          <div key={stat.key} className="px-3 py-3 text-center">
            <p
              className={`text-[9px] font-pmedium uppercase tracking-widest ${stat.labelTone || "text-slate-400"}`}
            >
              {stat.label}
            </p>
            <p className={`mt-1 text-lg font-pmedium ${stat.tone}`}>
              {stats[stat.key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {result.failures?.length > 0 && (
        <div className="border-t border-rose-100 bg-rose-50/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-rose-700">
            <AlertTriangle size={13} />
            Row issues
          </div>
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
            {result.failures.map((failure, index) => (
              <div
                key={`${failure.row}-${failure.column}-${index}`}
                className="rounded-lg border border-rose-100 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-pmedium text-slate-700">
                  Row {failure.row} · Column: {failure.column || "Unknown"}
                </p>
                {failure.value && (
                  <p className="mt-0.5 text-[10px] font-pmedium text-slate-500">
                    Value: {failure.value}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] font-pmedium text-rose-600">
                  {failure.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
            Workbook warnings
          </p>
          <div className="mt-1.5 space-y-1">
            {result.warnings.map((warning) => (
              <p key={warning} className="text-[10px] font-pmedium text-amber-700">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const ListingsDataUpdate = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { mutate: upload, isPending, data: result, error, reset } = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.post(
        "/api/admin/bulk-update-listing-stats",
        formData,
      );
      return response.data;
    },
    onSuccess: (uploadResult) => {
      const issues = uploadResult.failed
        ? ` ${uploadResult.failed} rows had issues.`
        : "";
      toast.success(
        `Updated ${uploadResult.updated} listings, ${uploadResult.markedPrivate} made private.${issues}`,
      );
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Update failed.");
    },
  });

  // A 400 (e.g. no usable rows) still carries totalRows/failures/warnings —
  // render it in the same summary instead of just a toast.
  const errorResult =
    error?.response?.data?.totalRows !== undefined
      ? error.response.data
      : null;

  const acceptFile = (picked) => {
    if (!picked) return;
    if (!isSpreadsheet(picked)) {
      toast.error("Only .xlsx or .xlsm files are allowed.");
      return;
    }
    setFile(picked);
    reset();
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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-pmedium text-slate-700">
            Upload the <span className="text-[#2563EB]">Business ALL Data</span> workbook to refresh live nomad listings.
          </p>
          <TemplateDownloadLink href="/templates/listings-data-update-template.xlsx" />
        </div>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Rows are matched by Business ID. Ratings and Total Reviews update only
          where the sheet has a value — blank cells are left untouched. Rows
          marked IN-ACTIVE are taken off the public site (made private); this
          upload never makes a listing public.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
              <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-pmedium text-slate-900">
                  {file.name}
                </p>
                <p className="text-[10px] font-pmedium text-slate-400">
                  {formatSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  reset();
                }}
                aria-label="Remove file"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              data-tour="data-upload-dropzone"
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${isDragOver ? "border-[#2563EB] bg-blue-50/60" : "border-slate-200 bg-white hover:border-[#2563EB]/40 hover:bg-blue-50/30"}`}
            >
              <UploadCloud
                size={22}
                className={isDragOver ? "text-[#2563EB]" : "text-slate-400"}
              />
              <span className="text-xs font-pmedium text-slate-600">
                Drag &amp; drop the .xlsx/.xlsm file here, or click to browse
              </span>
              <span className="text-[10px] font-pmedium text-slate-400">
                Required columns: Business ID · Ratings · Total Reviews · STATUS
              </span>
              <input
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(event) => {
                  acceptFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          )}

          <button
            type="button"
            disabled={!file || isPending}
            onClick={() => upload()}
            data-tour="data-upload-actions"
            className="mt-3 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {isPending ? "Updating..." : "Update Listings"}
          </button>

          {result && <UpdateResultSummary result={result} />}
          {errorResult && <UpdateResultSummary result={errorResult} />}
        </div>
      </div>
    </div>
  );
};

export default ListingsDataUpdate;
