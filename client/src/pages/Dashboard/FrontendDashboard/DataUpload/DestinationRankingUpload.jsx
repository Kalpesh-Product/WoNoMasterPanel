import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, FileDown, Plus, X } from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../../main";
import { toCsv } from "../../../../utils/csvExport";
import { exportDryRunPdf, readDryRunReportError } from "../../../../utils/dryRunReport";
import { FileDropzone, UploadActions, UploadCard, UploadPanel } from "./UploadUI";
import { AuditRecentUploadHistory } from "./RecentUploadHistory";

// This server owns WonoDestinationRanking (unlike the Nomads-owned World
// Ranking Weights / Visa Rules V2 uploads it otherwise mirrors). Same URL
// handles both steps: ?dryRun=true previews the diff, no query commits it.
// Upserts by destination name — a new name is a normal "insert", not an
// error, same as Visa Rules V2's passport+destination upsert.
const RANKING_ENDPOINT = "/api/hosts/destination-analytics/bulk-import";
const RANKING_FILE_FIELD = "file";

const FACTOR_FIELDS = [
  "targetBusinessSupply",
  "tourismAccommodationBase",
  "marketScale",
  "nomadDemandCommunity",
  "remoteWorkInfrastructure",
  "businessJobsEcosystem",
  "flightConnectivity",
  "affordability",
  "visaEntryAccessibility",
  "safetyHealthcare",
];
const FIELD_LABELS = {
  country: "Country",
  continent: "Continent",
  targetBusinessSupply: "Target Business Supply",
  tourismAccommodationBase: "Tourism / Accommodation Base",
  marketScale: "Market Scale",
  nomadDemandCommunity: "Nomad Demand & Community",
  remoteWorkInfrastructure: "Remote Work Infrastructure",
  businessJobsEcosystem: "Business & Jobs Ecosystem",
  flightConnectivity: "Flight Connectivity",
  affordability: "Affordability",
  visaEntryAccessibility: "Visa Entry Accessibility",
  safetyHealthcare: "Safety / Healthcare",
};
// Mirrors the upload's own column order, so "Download current data" round-trips.
const CURRENT_DATA_HEADERS = ["Destination", "Country", "Continent", ...FACTOR_FIELDS.map((field) => FIELD_LABELS[field])];
const currentDataFilename = () => `Destination Ranking Data - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.csv`;

const isCsv = (file) => /\.csv$/i.test(file.name);
const formatValue = (value) => (value === null || value === undefined || value === "" ? "— (blank)" : String(value));
const formatScore = (value) => (value === null || value === undefined ? "—" : Number(value).toFixed(2));
const normKey = (value) => String(value || "").trim().toLowerCase();

// Mirrors the server's computeClientOpportunity/computeFinalScore exactly
// (destinationDataControllers.js) so the dry run can show the WoNo score and
// priority impact of each change, not just the raw factor values — same idea
// as World Ranking Weights Upload's recalculated attribute scores.
const computeClientOpportunity = (factors) => {
  const { targetBusinessSupply, tourismAccommodationBase, marketScale } = factors || {};
  if ([targetBusinessSupply, tourismAccommodationBase, marketScale].some((value) => typeof value !== "number")) return null;
  return targetBusinessSupply * 0.6 + tourismAccommodationBase * 0.25 + marketScale * 0.15;
};
const computeFinalScore = (factors) => {
  const clientOpportunity = computeClientOpportunity(factors);
  if (clientOpportunity === null) return null;
  const { nomadDemandCommunity, remoteWorkInfrastructure, businessJobsEcosystem, flightConnectivity, affordability, visaEntryAccessibility, safetyHealthcare } = factors;
  const rest = [nomadDemandCommunity, remoteWorkInfrastructure, businessJobsEcosystem, flightConnectivity, affordability, visaEntryAccessibility, safetyHealthcare];
  if (rest.some((value) => typeof value !== "number")) return null;
  return Number((
    clientOpportunity * 0.35
    + nomadDemandCommunity * 0.20
    + remoteWorkInfrastructure * 0.15
    + businessJobsEcosystem * 0.10
    + flightConnectivity * 0.07
    + affordability * 0.05
    + visaEntryAccessibility * 0.05
    + safetyHealthcare * 0.03
  ).toFixed(2));
};

const PRIORITY_LABELS = { P1: "Immediate", P2: "High", P3: "Medium", P4: "Low" };

// Mirrors recomputeActiveRanking's priority split exactly: top/bottom 20%
// are P1/P4, the middle 60% splits evenly into P2/P3.
const buildPriorityByScore = (scored) => {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const total = sorted.length;
  const p1Count = Math.round(total * 0.2);
  const p4Count = Math.round(total * 0.2);
  const p2Count = Math.round((total - p1Count - p4Count) / 2);
  const map = new Map();
  sorted.forEach((entry, index) => {
    let priority = "P3";
    if (index < p1Count) priority = "P1";
    else if (index < p1Count + p2Count) priority = "P2";
    else if (index >= total - p4Count) priority = "P4";
    map.set(entry.id, { rank: index + 1, priority });
  });
  return map;
};

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

const RowIssues = ({ rowErrors = [] }) => {
  if (!rowErrors.length) return null;
  return (
    <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
        <AlertTriangle size={12} /> {rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} skipped
      </p>
      <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
        {rowErrors.slice(0, 50).map((entry) => (
          <li key={`${entry.rowNumber}-${entry.reason}`} className="text-[10px] font-pmedium text-amber-800">
            Row {entry.rowNumber}{entry.destination ? ` · ${entry.destination}` : ""}: {entry.reason}
          </li>
        ))}
      </ul>
      {rowErrors.length > 50 && <p className="mt-1 text-[10px] font-pmedium text-amber-700">+{rowErrors.length - 50} more</p>}
    </div>
  );
};

const ChangedFields = ({ changedFields = [] }) => (
  <div className="mt-1.5 space-y-1 pl-1">
    {changedFields.map((change) => (
      <div key={change.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-pmedium">
        <span className="min-w-[140px] text-slate-400">{change.label || FIELD_LABELS[change.field] || change.field}</span>
        <span className="text-slate-400 line-through decoration-slate-300">{formatValue(change.oldValue)}</span>
        <ArrowRight size={10} className="shrink-0 text-slate-300" />
        <span className="rounded bg-white px-1 py-0.5 text-slate-900 ring-1 ring-slate-200">{formatValue(change.newValue)}</span>
      </div>
    ))}
  </div>
);

// The right half of each row — what this change does to the destination's
// actual output (score/priority/rank), not just the raw factor edit on the
// left. "New" rows have no before, since the destination doesn't exist yet.
const ScoreImpact = ({ impact }) => {
  if (!impact) return null;
  const isNew = impact.scoreBefore === null || impact.scoreBefore === undefined;
  const rankDelta = isNew || !impact.rankBefore || !impact.rankAfter ? 0 : impact.rankBefore - impact.rankAfter;

  return (
    <div className="w-52 shrink-0 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-pmedium">
        <span className="text-slate-400">WoNo score</span>
        <span className="flex items-center gap-1">
          {!isNew && <span className="text-slate-400">{formatScore(impact.scoreBefore)}</span>}
          {!isNew && <ArrowRight size={10} className="text-slate-300" />}
          <span className="text-slate-900">{formatScore(impact.scoreAfter)}</span>
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-pmedium">
        <span className="text-slate-400">Priority</span>
        <span className="flex items-center gap-1">
          {!isNew && (
            <span className="text-slate-400" title={impact.priorityBefore ? PRIORITY_LABELS[impact.priorityBefore] : undefined}>
              {impact.priorityBefore || "—"}
            </span>
          )}
          {!isNew && <ArrowRight size={10} className="text-slate-300" />}
          <span className="text-slate-900" title={impact.priorityAfter ? PRIORITY_LABELS[impact.priorityAfter] : undefined}>
            {impact.priorityAfter || "—"}
          </span>
        </span>
      </div>
      {!isNew && impact.rankBefore && impact.rankAfter && (
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-pmedium">
          <span className="text-slate-400">#{impact.rankBefore} → #{impact.rankAfter}</span>
          {rankDelta !== 0 && (
            <span className={rankDelta > 0 ? "text-emerald-600" : "text-rose-500"}>
              {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const PreviewGroup = ({ title, description, rows, tone, impactById }) => {
  if (!rows.length) return null;
  const isInsert = tone === "insert";

  return (
    <div className="border-t border-slate-100">
      <div className="flex items-center gap-2 px-4 pt-3">
        {isInsert ? <Plus size={12} className="text-[#2563EB]" /> : <ArrowRight size={12} className="text-slate-400" />}
        <p className="text-[10px] font-pmedium uppercase tracking-widest text-slate-500">{title} ({rows.length})</p>
      </div>
      {description && <p className="px-4 pt-1 text-[10px] font-pmedium text-slate-400">{description}</p>}
      <div className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-4 px-4 py-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-pmedium uppercase tracking-wider ${isInsert ? "bg-blue-50 text-[#2563EB] ring-1 ring-blue-100" : "bg-slate-100 text-slate-500"}`}>
                {isInsert ? "New destination" : "Update"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-pmedium text-slate-800">
                  {row.destination} <span className="mx-1.5 text-slate-300">·</span> {[row.country, row.continent].filter(Boolean).join(", ")}
                  <span className="ml-2 text-[10px] text-slate-400">Row {row.rowNumber}</span>
                </p>
                <ChangedFields changedFields={row.changedFields} />
              </div>
            </div>
            <ScoreImpact impact={impactById?.[row.id]} />
          </div>
        ))}
      </div>
    </div>
  );
};

const DryRunPanel = ({ result, onConfirm, onDiscard, isCommitting, onExportPdf, isExporting, impact }) => {
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
            {hasChanges ? `Dry run — ${preview.length} destination${preview.length === 1 ? "" : "s"} will change` : "Dry run — the sheet already matches the database"}
          </p>
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">
            Nothing has been written yet. Rank, priority and WoNo score are recalculated from the factors below after you apply — they are never read from the sheet.
          </p>
          {inserts.length > 0 && (
            <p className="mt-1 text-[10px] font-pmedium text-slate-400">{inserts.length} of these are brand-new destination names that don&apos;t exist yet; the rest correct existing destinations.</p>
          )}
          {impact?.universeCount > 0 && (
            <p className="mt-1 text-[10px] font-pmedium text-slate-400">Score and priority impact on the right are recalculated over all {impact.universeCount} active destinations after this import.</p>
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
          { label: "New destinations", value: result.willInsertCount, tone: "text-[#2563EB]", labelTone: "text-[#2563EB]" },
          { label: "Will update", value: result.willUpdateCount, tone: "text-amber-700", labelTone: "text-amber-600" },
          { label: "No change", value: result.unchangedCount, tone: "text-emerald-700", labelTone: "text-emerald-600" },
          { label: "Row issues", value: (result.rowErrors || []).length, tone: "text-rose-600", labelTone: "text-rose-500" },
        ]}
      />

      <RowIssues rowErrors={result.rowErrors} />

      <PreviewGroup
        tone="insert"
        title="New destinations to insert"
        description="These names have no row in the database yet — confirming will create them, active, with the factors below."
        rows={inserts}
        impactById={impact?.byId}
      />
      <PreviewGroup tone="update" title="Existing destinations to update" rows={updates} impactById={impact?.byId} />

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
          Apply writes country, continent and the 10 factors for the rows above, then recalculates rank/priority/score for every active destination. Destinations left out of the sheet are untouched.
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
        <p className="text-xs font-pmedium text-slate-800">{result.message || "Destination ranking updated from CSV."}</p>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">Re-open the Ranking page to see the new scores and ordering.</p>
      </div>
    </div>
    <StatGrid
      items={[
        { label: "Rows read", value: result.processedRows },
        { label: "Matched", value: result.matchedCount, tone: "text-slate-800" },
        { label: "Modified", value: result.modifiedCount, tone: "text-amber-700", labelTone: "text-amber-600" },
        { label: "New rows", value: result.upsertedCount, tone: "text-[#2563EB]", labelTone: "text-[#2563EB]" },
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
        <p className="text-xs font-pmedium text-rose-700">{message || "The import could not be processed."}</p>
        <p className="mt-1 text-[10px] font-pmedium text-rose-600">No rows were written. Fix the sheet and upload it again.</p>
      </div>
    </div>
    <RowIssues rowErrors={rowErrors} />
  </section>
);

// Monthly refresh: one CSV covers every destination's 10 scoring factors.
// Rows are matched by destination name — existing destinations get their
// factors replaced, new names are inserted. Rank/priority/score are always
// recalculated server-side, never read from the sheet.
const DestinationRankingUpload = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);

  const postFile = async (dryRun) => {
    const formData = new FormData();
    formData.append(RANKING_FILE_FIELD, file);
    const response = await axios.post(RANKING_ENDPOINT, formData, dryRun ? { params: { dryRun: true } } : undefined);
    return response.data;
  };

  const errorMessage = (error) => error?.response?.data?.message || "Request failed.";

  const preview = useMutation({
    mutationFn: () => postFile(true),
    onSuccess: (result) => {
      const count = (result.preview || []).length;
      if (count) {
        toast.success(`${count} destination(s) will change — ${result.willInsertCount ?? 0} new, ${result.willUpdateCount ?? 0} updated. Review, then confirm.`);
      } else {
        toast.info("The sheet already matches the database.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const commit = useMutation({
    mutationFn: () => postFile(false),
    onSuccess: (result) => {
      toast.success(`Updated: ${result.modifiedCount ?? 0} modified, ${result.upsertedCount ?? 0} new.`);
      queryClient.invalidateQueries({ queryKey: ["wono-destination-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["recent-data-uploads", "destination-ranking-upload"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Live ranking rows: "Download current data" round-trips exactly what the
  // importer reads, same as World Ranking Weights Upload does for its sheet.
  const { data: liveRows = [] } = useQuery({
    queryKey: ["wono-destination-analytics", "ranking-upload-current-data"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/destination-analytics", { params: { limit: 250, includeInactive: true } });
      return response.data?.items || [];
    },
  });

  const [currentDataHref, setCurrentDataHref] = useState("");
  useEffect(() => {
    if (!liveRows.length) {
      setCurrentDataHref("");
      return undefined;
    }
    const matrix = [
      CURRENT_DATA_HEADERS,
      ...liveRows.map((row) => [row.destination, row.country, row.continent, ...FACTOR_FIELDS.map((field) => row.factors?.[field] ?? "")]),
    ];
    const blob = new Blob(["﻿", toCsv(matrix)], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    setCurrentDataHref(url);
    return () => window.URL.revokeObjectURL(url);
  }, [liveRows]);

  // Recalculates each previewed destination's WoNo score/priority/rank
  // before vs. after, over the whole active set — same technique World
  // Ranking Weights Upload uses for its attribute-score impact, since the
  // backend dry run only returns the raw factor diff, not the downstream
  // score/priority it would produce.
  const rankingImpact = useMemo(() => {
    const previewRows = preview.data?.preview || [];
    if (!previewRows.length || !liveRows.length) return { byId: {}, universeCount: 0 };

    const activeRows = liveRows.filter((row) => row.isActive);
    const beforeByKey = new Map(activeRows.map((row) => [normKey(row.destination), row]));
    const afterFactorsByKey = new Map(activeRows.map((row) => [normKey(row.destination), row.factors]));

    previewRows.forEach((row) => {
      const key = normKey(row.destination);
      const base = beforeByKey.get(key)?.factors || {};
      const overrides = Object.fromEntries(
        (row.changedFields || []).filter((change) => FACTOR_FIELDS.includes(change.field)).map((change) => [change.field, change.newValue]),
      );
      afterFactorsByKey.set(key, { ...base, ...overrides });
    });

    const afterScored = Array.from(afterFactorsByKey.entries())
      .map(([key, factors]) => ({ id: key, score: computeFinalScore(factors) }))
      .filter((entry) => typeof entry.score === "number");
    const afterByKey = buildPriorityByScore(afterScored);
    const afterScoreByKey = new Map(afterScored.map((entry) => [entry.id, entry.score]));

    const byId = {};
    previewRows.forEach((row) => {
      const key = normKey(row.destination);
      const before = beforeByKey.get(key);
      const after = afterByKey.get(key);
      byId[row.id] = {
        scoreBefore: before?.score ?? null,
        scoreAfter: afterScoreByKey.get(key) ?? null,
        priorityBefore: before?.priority ?? null,
        priorityAfter: after?.priority ?? null,
        rankBefore: before?.rank ?? null,
        rankAfter: after?.rank ?? null,
      };
    });

    return { byId, universeCount: afterScored.length };
  }, [preview.data, liveRows]);

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

  const buildReport = () => {
    const result = preview.data || {};
    const previewRows = result.preview || [];
    const changeRows = [];
    previewRows.forEach((row) => {
      (row.changedFields || []).forEach((change) => {
        changeRows.push([
          row.action === "insert" ? "New destination" : "Update",
          row.destination,
          `Row ${row.rowNumber}`,
          change.label || FIELD_LABELS[change.field] || change.field,
          formatValue(change.oldValue),
          formatValue(change.newValue),
        ]);
      });
    });
    const skippedRows = (result.rowErrors || []).map((entry) => [`Row ${entry.rowNumber}`, entry.destination || "—", entry.reason]);
    const impactRows = previewRows.map((row) => {
      const impact = rankingImpact.byId[row.id] || {};
      return [
        row.destination,
        impact.scoreBefore === null || impact.scoreBefore === undefined ? "New" : formatScore(impact.scoreBefore),
        formatScore(impact.scoreAfter),
        impact.priorityBefore || "—",
        impact.priorityAfter || "—",
        impact.rankBefore ? `#${impact.rankBefore}` : "—",
        impact.rankAfter ? `#${impact.rankAfter}` : "—",
      ];
    });

    return {
      title: "Destination Ranking — Dry Run",
      module: "Data Upload",
      page: "Destination Ranking Upload",
      action: "Dry run PDF — Destination Ranking",
      fileName: file?.name || "",
      summary: [
        { label: "Rows read", value: result.processedRows ?? 0 },
        { label: "New destinations", value: result.willInsertCount ?? 0 },
        { label: "Will update", value: result.willUpdateCount ?? 0 },
        { label: "No change", value: result.unchangedCount ?? 0 },
        { label: "Row issues", value: (result.rowErrors || []).length },
      ],
      sections: [
        {
          title: `Changes (${changeRows.length})`,
          columns: [
            { label: "Action", width: 0.12 },
            { label: "Destination", width: 0.2 },
            { label: "Row", width: 0.08 },
            { label: "Field", width: 0.2 },
            { label: "Before", width: 0.2 },
            { label: "After", width: 0.2 },
          ],
          rows: changeRows,
        },
        {
          title: `Score & priority impact (${impactRows.length})`,
          columns: [
            { label: "Destination", width: 0.28 },
            { label: "Score before", width: 0.13 },
            { label: "Score after", width: 0.13 },
            { label: "Priority before", width: 0.13 },
            { label: "Priority after", width: 0.13 },
            { label: "Rank before", width: 0.1 },
            { label: "Rank after", width: 0.1 },
          ],
          rows: impactRows,
        },
        {
          title: `Rows skipped (${skippedRows.length})`,
          columns: [
            { label: "Row", width: 0.14 },
            { label: "Destination", width: 0.26 },
            { label: "Reason", width: 0.6 },
          ],
          rows: skippedRows,
        },
      ].filter((section) => section.rows.length > 0),
      notes: [
        "This is a dry run: nothing was written by generating this report.",
        "Rows are matched by destination name. A new name is inserted active; an existing destination's country/continent/factors are replaced.",
        "Rank, priority and WoNo score are recalculated from the factors — never read from the sheet.",
        `Score & priority impact is recalculated over all ${rankingImpact.universeCount} active destinations after this import.`,
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

  const busy = preview.isPending || commit.isPending;
  const failedRequest = preview.error || commit.error;
  const failedResult = failedRequest?.response?.data;

  return (
    <div className="flex flex-col gap-4">
      <UploadCard
        title="Destination Ranking Upload"
        description="Monthly refresh — update every destination's 10 scoring factors from a CSV exported out of the Ranking page's own data."
        templateHref={currentDataHref}
        templateLabel="Download current data (.csv)"
        templateFilename={currentDataFilename()}
      >
        <p className="mb-3 text-[10px] font-pmedium text-slate-400">
          Best flow: download the current data → edit the factor columns → upload here. Destination, Country and Continent
          identify the row; the 10 factor columns are what actually changes.
        </p>

        <UploadPanel>
          <FileDropzone
            file={file}
            onPick={pickFile}
            onRemove={removeFile}
            accept=".csv"
            dataTour="data-upload-dropzone"
            disabled={busy}
            hint="CSV only · needs Destination, Country, Continent plus the 10 factor columns"
          />

          <UploadActions
            onUpload={() => preview.mutate()}
            onReset={removeFile}
            uploadLabel="Preview changes (dry run)"
            pendingLabel="Checking file..."
            uploadDisabled={!file || busy}
            resetDisabled={busy}
            pending={preview.isPending}
          />

          {failedResult && <ErrorPanel message={failedResult.message} rowErrors={failedResult.rowErrors} />}

          {preview.data && !commit.data && (
            <DryRunPanel
              result={preview.data}
              onConfirm={() => commit.mutate()}
              onDiscard={() => preview.reset()}
              isCommitting={commit.isPending}
              onExportPdf={() => pdfExport.mutate()}
              isExporting={pdfExport.isPending}
              impact={rankingImpact}
            />
          )}

          {commit.data && <CommitPanel result={commit.data} />}
        </UploadPanel>
      </UploadCard>
      <AuditRecentUploadHistory
        action="destination-ranking-upload"
        title="Recent Destination Ranking Uploads"
        description="Open to view recently committed ranking CSV files."
      />
    </div>
  );
};

export default DestinationRankingUpload;
