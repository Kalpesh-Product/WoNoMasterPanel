import React from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

// One result card for every Data Upload tab, in the destination-upload
// style: success/fail header, stat grid, per-row issue list, warnings.
// Understands every payload shape the upload backends return today
// (nomads bulk inserts, master panel inserts, image proxies, the proxy's
// {success, message: <payload>} wrapper, and 400s carrying errors[]).

const STAT_LABELS = [
  ["totalRows", "Sheet rows"],
  ["total", "Total rows"],
  ["count", "Inserted"],
  ["inserted", "Inserted"],
  ["updated", "Updated"],
  ["matched", "Matched in DB"],
  ["markedPrivate", "Made private"],
  ["skippedExisting", "Already in DB"],
  ["skippedDuplicateInCSV", "Duplicates in CSV"],
  ["skippedMissingCompanyId", "No company mapping"],
  ["missingCompanyCount", "No company mapping"],
  ["errorCount", "Invalid rows"],
  ["blankRatings", "Blank ratings skipped"],
  ["blankReviews", "Blank reviews skipped"],
];

const toFailure = (entry, defaultReason) => {
  if (typeof entry === "string") return { value: entry, reason: defaultReason };
  const location = [entry.city, entry.state, entry.country]
    .filter(Boolean)
    .join(", ");
  return {
    row: entry.row ?? entry.rowNumber,
    column: entry.column ?? entry.field,
    value: entry.value ?? entry.businessId ?? entry.companyId ?? entry.index,
    label:
      entry.businessName ?? entry.companyName ?? entry.name ?? entry.title,
    location,
    reason: entry.reason ?? entry.errmsg ?? defaultReason,
  };
};

const FAILURE_SOURCES = [
  ["failures", "Row failed"],
  ["errors", "Invalid row"],
  ["duplicateExistingLogs", "Already exists in DB — skipped"],
  ["duplicateExistingRows", "Already exists in DB — skipped"],
  ["duplicateCSVLogs", "Duplicate within the CSV — skipped"],
  ["duplicateCSVRows", "Duplicate within the CSV — skipped"],
  ["missingCompanyRows", "No matching company in master panel — skipped"],
  ["missingCompanyIds", "No matching company in master panel — skipped"],
  ["unmatchedBusinessIds", "No listing with this Business ID in the database — skipped"],
  ["writeErrors", "Database rejected this row"],
];

export const normalizeUploadResult = (data, error) => {
  let payload = data ?? error?.response?.data;
  if (!payload) {
    return error
      ? { success: false, message: error.message || "Upload failed", stats: [], failures: [], warnings: [] }
      : null;
  }

  // The master panel proxy wraps the nomads payload: {success, message: {...}}
  if (payload.message && typeof payload.message === "object") {
    payload = { ...payload, ...payload.message, message: payload.message.message };
  }

  const failures = [];
  FAILURE_SOURCES.forEach(([key, reason]) => {
    if (Array.isArray(payload[key])) {
      payload[key].forEach((entry) => failures.push(toFailure(entry, reason)));
    }
  });

  const seenLabels = new Set();
  const stats = [];
  STAT_LABELS.forEach(([key, label]) => {
    if (typeof payload[key] === "number" && !seenLabels.has(label)) {
      seenLabels.add(label);
      stats.push({ label, value: payload[key] });
    }
  });
  if (failures.length && !seenLabels.has("Row issues")) {
    stats.push({ label: "Row issues", value: failures.length, tone: "rose" });
  }

  return {
    success: !error && payload.success !== false,
    message:
      (typeof payload.message === "string" && payload.message) ||
      payload.error ||
      (error ? "Upload failed" : "Upload completed"),
    stats,
    failures,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  };
};

const UploadResultSummary = ({ data, error }) => {
  const result = normalizeUploadResult(data, error);
  if (!result) return null;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
        {result.success ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        ) : (
          <X size={15} className="mt-0.5 shrink-0 text-rose-600" />
        )}
        <p
          className={`text-xs font-pmedium ${result.success ? "text-slate-800" : "text-rose-600"}`}
        >
          {result.message}
        </p>
      </div>

      {result.stats.length > 0 && (
        <div className="grid grid-cols-3 divide-x divide-y divide-slate-100">
          {result.stats.map((stat) => (
            <div key={stat.label} className="px-3 py-3 text-center">
              <p
                className={`text-[9px] font-pmedium uppercase tracking-widest ${stat.tone === "rose" ? "text-rose-500" : "text-slate-400"}`}
              >
                {stat.label}
              </p>
              <p
                className={`mt-1 text-lg font-pmedium ${stat.tone === "rose" ? "text-rose-600" : "text-slate-800"}`}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {result.failures.length > 0 && (
        <div className="border-t border-rose-100 bg-rose-50/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-rose-700">
            <AlertTriangle size={13} />
            Row issues ({result.failures.length})
          </div>
          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
            {result.failures.map((failure, index) => (
              <div
                key={index}
                className="rounded-lg border border-rose-100 bg-white px-3 py-2"
              >
                {(failure.row !== undefined || failure.column) && (
                  <p className="text-[10px] font-pmedium text-slate-700">
                    {failure.row !== undefined && `Row ${failure.row}`}
                    {failure.row !== undefined && failure.column && " · "}
                    {failure.column && `Column: ${failure.column}`}
                  </p>
                )}
                {(failure.label || failure.value) && (
                  <p className="mt-0.5 text-[10px] font-pmedium text-slate-500">
                    {[failure.label, failure.value, failure.location]
                      .filter(Boolean)
                      .join(" · ")}
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

      {result.warnings.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
          <p className="text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
            Warnings
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

export default UploadResultSummary;
