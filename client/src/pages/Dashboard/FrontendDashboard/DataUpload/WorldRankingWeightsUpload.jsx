import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileDown,
  X,
} from "lucide-react";
import useAxiosPrivate from "../../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../../main";
import { NOMADS_API_BASE_URL } from "../../../../constants/api";
import { ALGO2_BASE_METRICS } from "../../../../constants/algo2Metrics";
import {
  STATEWISE_WEIGHT_FORMULAS,
  calculateScore,
} from "../../../../utils/weightCalculationsV2";
import { toCsv } from "../../../../utils/csvExport";
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

// Nomads owns this endpoint. It matches rows by _id only (upsert: false), so an
// unknown _id is skipped and never inserted, and it writes only weight.<field>
// — never _id, state, country, title, rank or isActive. Same URL handles both
// steps: ?dryRun=true previews the diff, no query commits it.
const WEIGHTS_ENDPOINT = `${NOMADS_API_BASE_URL}/state-wise-weight-v2/bulk-update-weights`;
const FILE_FIELD = "state-wise-weight-file";

const METRIC_LABELS = Object.fromEntries(
  ALGO2_BASE_METRICS.map((metric) => [metric.field, metric.label]),
);

// Mirrors the "Export Weights (.csv)" header row on World Ranking Weights V2,
// so the sheet downloaded here is exactly what the importer reads (it
// normalises header text: lower-case, strips spaces/underscores/&()/).
const CURRENT_DATA_HEADERS = [
  "_id",
  "Rank",
  "Destination",
  "State",
  "Title",
  "Country",
  "Continent",
  "Active",
  ...ALGO2_BASE_METRICS.map((metric) => metric.label),
];

const isCsv = (file) => /\.csv$/i.test(file.name);

const destinationName = (row = {}) =>
  row.destination || row.state || row.title || row.city || "-";

const toNumericOrFallback = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? fallback : numericValue;
};

const metricLabel = (field) => METRIC_LABELS[field] || field;

const ATTRIBUTE_LABEL_OVERRIDES = {
  financialStabilityLowRisk: "Financial Stability",
  easyVisaLongStay: "Easy Visa & Long Stay",
  startupBusinessOpportunities: "Startup Business Opportunities",
};

const attributeLabel = (key = "") =>
  ATTRIBUTE_LABEL_OVERRIDES[key] ||
  String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const ATTRIBUTE_KEYS = Object.keys(STATEWISE_WEIGHT_FORMULAS);

// Same engine the World Ranking Weights V2 table uses. The backend dry run only
// returns ONE attribute's score/rank, so every other attribute's "what changes"
// is derived here from the live weights plus the preview's changedFields.
const attributesAffectedBy = (fields = []) =>
  ATTRIBUTE_KEYS.filter((attribute) =>
    Object.keys(STATEWISE_WEIGHT_FORMULAS[attribute]).some((factor) =>
      fields.includes(factor),
    ),
  );

const buildRanks = (scoresById) => {
  const ordered = [...scoresById.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
  return new Map(ordered.map((entry, index) => [entry.id, index + 1]));
};

const formatScore = (value) =>
  value === null || value === undefined ? "—" : Number(value).toFixed(2);

const formatCount = (value) => value ?? 0;

const plural = (count, singular, pluralForm) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const StatGrid = ({ items }) => (
  <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5">
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
          {item.value}
        </p>
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
          {plural(notFound.length, "_id not in DB — skipped", "_ids not in DB — skipped")}
        </div>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
          {notFound.map((entry) => (
            <p
              key={`${entry.rowNumber}-${entry.id}`}
              className="text-[10px] font-pmedium text-amber-800"
            >
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
          {rowErrors.map((entry) => (
            <p
              key={`${entry.rowNumber}-${entry.id || "no-id"}`}
              className="text-[10px] font-pmedium text-rose-700"
            >
              Row {entry.rowNumber}
              {entry.id ? ` · ${entry.id}` : ""} — {entry.reason}
            </p>
          ))}
        </div>
      </div>
    )}
  </>
);

const DryRunPanel = ({
  result,
  expandedIds,
  onToggle,
  onConfirm,
  onDiscard,
  isCommitting,
  attributeImpact,
  impactPending,
  onExportPdf,
  isExporting,
}) => {
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
            {hasChanges
              ? `Dry run — ${plural(preview.length, "destination will change", "destinations will change")}`
              : "Dry run — nothing to update"}
          </p>
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">
            Nothing has been written yet. Review the diff below, then apply it —
            or discard and re-upload.
          </p>
          <p className="mt-1 text-[10px] font-pmedium text-slate-400">
            Expand a destination to see every attribute score and rank that
            moves. A rank is that destination&apos;s position across all
            destinations for the attribute&apos;s own score (1 = highest) — the
            stored Rank column in the sheet is never read or written.
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
          { label: "Rows read", value: formatCount(result.processedRows) },
          {
            label: "Will update",
            value: formatCount(result.willUpdateCount),
            tone: "text-emerald-700",
            labelTone: "text-emerald-600",
          },
          { label: "No change", value: formatCount(result.unchangedCount) },
          {
            label: "Not in DB",
            value: formatCount(result.notFoundCount),
            tone: "text-amber-700",
            labelTone: "text-amber-600",
          },
          {
            label: "Row issues",
            value: formatCount((result.rowErrors || []).length),
            tone: "text-rose-600",
            labelTone: "text-rose-500",
          },
        ]}
      />

      {hasChanges && (
        <div className="border-t border-slate-100">
          <p className="px-4 py-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
            Changed destinations
          </p>
          <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
            {preview.map((row) => {
              const isOpen = expandedIds.has(row.id);
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              const changedFields = row.changedFields || [];
              const attributeRows = attributeImpact?.byId?.[row.id] || [];

              let attributeSummary = "No score change";
              if (attributeRows.length) {
                attributeSummary = `${attributeRows.length} attribute score${
                  attributeRows.length === 1 ? "" : "s"
                } change`;
              } else if (impactPending) {
                attributeSummary = "Calculating scores…";
              }

              return (
                <div key={row.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(row.id)}
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <Chevron size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-pmedium text-slate-900">
                        {row.title || row.state || "Untitled"}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-pmedium text-slate-400">
                        {[row.state, row.country].filter(Boolean).join(" · ")} ·
                        Row {row.rowNumber}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-pmedium text-slate-500">
                        {plural(changedFields.length, "metric", "metrics")}{" "}
                        changing
                      </p>
                      <p className="mt-0.5 text-[10px] font-pmedium text-slate-400">
                        {attributeSummary}
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-slate-50/60 px-4 pb-3 pl-10 pt-1">
                      <div className="flex items-center gap-2 text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
                        {plural(changedFields.length, "metric", "metrics")} changing
                      </div>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {changedFields.map((change) => (
                          <div
                            key={change.field}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                          >
                            <span className="truncate text-[10px] font-pmedium text-slate-600">
                              {metricLabel(change.field)}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-pmedium">
                              <span className="text-slate-400">
                                {change.oldValue}
                              </span>
                              <ArrowRight size={10} className="text-slate-300" />
                              <span className="text-slate-900">
                                {change.newValue}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {impactPending ? (
                        <p className="mt-3 text-[10px] font-pmedium text-slate-400">
                          Calculating every attribute score…
                        </p>
                      ) : attributeRows.length > 0 ? (
                        <div className="mt-3 border-t border-slate-200 pt-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
                              Attribute scores changing ({attributeRows.length})
                            </p>
                            {attributeImpact?.universeCount > 0 && (
                              <p className="text-[9px] font-pmedium text-slate-400">
                                ranks over {attributeImpact.universeCount}{" "}
                                destinations
                              </p>
                            )}
                          </div>
                          <div className="mt-1.5 space-y-1">
                            {attributeRows.map((item) => {
                                const rankDelta =
                                  (item.rankBefore || 0) -
                                  (item.rankAfter || 0);
                                return (
                                  <div
                                    key={item.attribute}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                                  >
                                    <span className="truncate text-[10px] font-pmedium text-slate-600">
                                      {item.label}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-pmedium">
                                      <span className="text-slate-400">
                                        {formatScore(item.scoreBefore)}
                                      </span>
                                      <ArrowRight
                                        size={10}
                                        className="text-slate-300"
                                      />
                                      <span className="text-slate-900">
                                        {formatScore(item.scoreAfter)}
                                      </span>
                                      {item.rankBefore && item.rankAfter && (
                                        <span className="ml-1 text-slate-400">
                                          #{item.rankBefore} → #{item.rankAfter}
                                        </span>
                                      )}
                                      {rankDelta !== 0 && (
                                        <span
                                          className={
                                            rankDelta > 0
                                              ? "text-emerald-600"
                                              : "text-rose-500"
                                          }
                                        >
                                          {rankDelta > 0
                                            ? `▲${rankDelta}`
                                            : `▼${Math.abs(rankDelta)}`}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
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
          {isCommitting
            ? "Applying..."
            : `Apply ${plural(preview.length, "change", "changes")}`}
        </button>
        <p className="mt-2 text-[10px] font-pmedium text-slate-400">
          Apply only writes the weight values above, for the matched _ids.
          Unmatched _ids are skipped and never inserted; state, country, title,
          rank and active status are never touched.
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
          {result.message || "Weight values updated from CSV."}
        </p>
        <p className="mt-1 text-[10px] font-pmedium text-slate-400">
          Only weight fields were written. Re-open World Ranking Weights V2 to
          see the new scores and ordering.
        </p>
      </div>
    </div>

    <StatGrid
      items={[
        { label: "Rows read", value: formatCount(result.processedRows) },
        {
          label: "Matched",
          value: formatCount(result.matchedCount),
          tone: "text-slate-800",
        },
        {
          label: "Modified",
          value: formatCount(result.modifiedCount),
          tone: "text-emerald-700",
          labelTone: "text-emerald-600",
        },
        {
          label: "Not in DB",
          value: formatCount(result.notFoundCount),
          tone: "text-amber-700",
          labelTone: "text-amber-600",
        },
        {
          label: "Row issues",
          value: formatCount((result.rowErrors || []).length),
          tone: "text-rose-600",
          labelTone: "text-rose-500",
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
          {message || "The upload could not be processed."}
        </p>
        {(rowErrors || []).length > 0 && (
          <div className="mt-2 space-y-1">
            {rowErrors.slice(0, 10).map((entry) => (
              <p
                key={`${entry.rowNumber}-${entry.id || "no-id"}`}
                className="text-[10px] font-pmedium text-rose-600"
              >
                Row {entry.rowNumber}
                {entry.id ? ` · ${entry.id}` : ""} — {entry.reason}
              </p>
            ))}
            {rowErrors.length > 10 && (
              <p className="text-[10px] font-pmedium text-rose-500">
                +{rowErrors.length - 10} more rows with issues
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  </section>
);

const WorldRankingWeightsUpload = () => {
  const axios = useAxiosPrivate();
  const [file, setFile] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const postFile = async (target, dryRun) => {
    const formData = new FormData();
    formData.append(FILE_FIELD, target);
    const response = await axios.post(
      WEIGHTS_ENDPOINT,
      formData,
      dryRun ? { params: { dryRun: true } } : undefined,
    );
    return response.data;
  };

  const errorMessage = (error) =>
    error?.response?.data?.message || "Request failed.";

  const preview = useMutation({
    mutationFn: () => postFile(file, true),
    onSuccess: (result) => {
      setExpandedIds(new Set());
      if (result.willUpdateCount) {
        toast.success(
          `${result.willUpdateCount} destination(s) will change. Review the diff, then apply.`,
        );
      } else {
        toast.info("No weight changes found in this file.");
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const commit = useMutation({
    mutationFn: () => postFile(file, false),
    onSuccess: (result) => {
      toast.success(
        `${result.modifiedCount ?? 0} destination(s) updated${
          result.notFoundCount ? `, ${result.notFoundCount} _id(s) not found` : ""
        }.`,
      );
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights-v2"] });
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Live weights: the dry-run diff explanation and "Download current data"
  // both start from them. Shares the weights page's query key so opening that
  // page afterwards is instant.
  const { data: liveWeights = [], isPending: isWeightsPending } = useQuery({
    queryKey: ["world-ranking-weights-v2"],
    queryFn: async () => {
      const response = await axios.get(`${NOMADS_API_BASE_URL}/state-wise-weight-v2`);
      const payload = response.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.rows)) return payload.rows;
      return [];
    },
  });

  // The card header's "Download current data (.csv)" — the same matrix the
  // World Ranking Weights V2 export produces, so export → edit → upload is a
  // round trip with the importer's own headers.
  const [currentDataHref, setCurrentDataHref] = useState("");

  useEffect(() => {
    if (!liveWeights.length) {
      setCurrentDataHref("");
      return undefined;
    }

    const matrix = [
      CURRENT_DATA_HEADERS,
      ...liveWeights.map((row) => [
        row._id || "",
        row.rank ?? "",
        destinationName(row),
        row.state || "",
        row.title || "",
        row.country || "",
        row.continent || "",
        row.isActive === true || row.isActive === "true" ? "Active" : "Inactive",
        ...ALGO2_BASE_METRICS.map((metric) =>
          toNumericOrFallback(row.weight?.[metric.field] ?? row?.[metric.field], 0),
        ),
      ]),
    ];

    const blob = new Blob(["\uFEFF", toCsv(matrix)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    setCurrentDataHref(url);

    return () => window.URL.revokeObjectURL(url);
  }, [liveWeights]);

  // The backend dry run ranks ONE attribute (bestForNomads by default). Every
  // other attribute that uses a changed metric gets its score and its rank
  // recalculated here, before and after, over the whole destination set.
  const attributeImpact = useMemo(() => {
    if (!preview.data || !liveWeights.length) return { byId: {}, universeCount: 0 };

    const weightsById = new Map(
      liveWeights.map((doc) => [String(doc._id), doc.weight || doc.weights || {}]),
    );
    const overridesById = new Map(
      (preview.data.preview || []).map((row) => [
        String(row.id),
        Object.fromEntries(
          (row.changedFields || []).map((change) => [change.field, change.newValue]),
        ),
      ]),
    );

    const afterWeightsById = new Map(weightsById);
    overridesById.forEach((changes, id) => {
      const base = weightsById.get(id);
      if (base) afterWeightsById.set(id, { ...base, ...changes });
    });

    const affectedAttributes = [
      ...new Set(
        [...overridesById.values()].flatMap((changes) =>
          attributesAffectedBy(Object.keys(changes)),
        ),
      ),
    ];

    const rankBeforeByAttribute = new Map();
    const rankAfterByAttribute = new Map();
    affectedAttributes.forEach((attribute) => {
      const factors = STATEWISE_WEIGHT_FORMULAS[attribute];
      const beforeScores = new Map();
      const afterScores = new Map();
      weightsById.forEach((_weight, id) => {
        beforeScores.set(id, calculateScore(weightsById.get(id), factors));
        afterScores.set(id, calculateScore(afterWeightsById.get(id), factors));
      });
      rankBeforeByAttribute.set(attribute, buildRanks(beforeScores));
      rankAfterByAttribute.set(attribute, buildRanks(afterScores));
    });

    const byId = {};
    overridesById.forEach((changes, id) => {
      const base = weightsById.get(id);
      if (!base) return; // unmatched _id — no scores to compare
      const after = afterWeightsById.get(id);
      byId[id] = attributesAffectedBy(Object.keys(changes))
        .map((attribute) => {
          const factors = STATEWISE_WEIGHT_FORMULAS[attribute];
          const scoreBefore = calculateScore(base, factors);
          const scoreAfter = calculateScore(after, factors);
          if (scoreBefore === scoreAfter) return null;
          return {
            attribute,
            label: attributeLabel(attribute),
            scoreBefore,
            scoreAfter,
            rankBefore: rankBeforeByAttribute.get(attribute)?.get(id) ?? null,
            rankAfter: rankAfterByAttribute.get(attribute)?.get(id) ?? null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.scoreAfter - a.scoreAfter);
    });

    return { byId, universeCount: weightsById.size };
  }, [preview.data, liveWeights]);

  const resetAll = () => {
    setFile(null);
    setExpandedIds(new Set());
    preview.reset();
    commit.reset();
  };

  const pickFile = (picked) => {
    if (!picked) return;
    if (!isCsv(picked)) {
      toast.error("Only .csv files are allowed.");
      return;
    }
    setFile(picked);
    setExpandedIds(new Set());
    preview.reset();
    commit.reset();
  };

  const toggleRow = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Everything the dry run shows — changed metrics, the recalculated attribute
  // scores/ranks, skipped _ids and row issues — becomes the archived PDF.
  const buildReport = () => {
    const result = preview.data || {};
    const previewRows = result.preview || [];
    const metricRows = [];
    const attributeRows = [];

    previewRows.forEach((row) => {
      const label = row.title || row.state || "Untitled";
      const meta = [label, row.state, row.country, `Row ${row.rowNumber}`]
        .filter(Boolean)
        .join(" · ");

      (row.changedFields || []).forEach((change) => {
        metricRows.push([
          meta,
          metricLabel(change.field),
          String(change.oldValue ?? ""),
          String(change.newValue ?? ""),
        ]);
      });

      (attributeImpact?.byId?.[row.id] || []).forEach((item) => {
        attributeRows.push([
          meta,
          item.label,
          formatScore(item.scoreBefore),
          formatScore(item.scoreAfter),
          item.rankBefore ? `#${item.rankBefore}` : "—",
          item.rankAfter ? `#${item.rankAfter}` : "—",
        ]);
      });
    });

    const notFoundRows = (result.notFound || []).map((entry) => [
      `Row ${entry.rowNumber}`,
      entry.id,
    ]);

    const errorRows = (result.rowErrors || []).map((entry) => [
      `Row ${entry.rowNumber}`,
      entry.id || "—",
      entry.reason,
    ]);

    const sections = [
      {
        title: `Metric changes (${metricRows.length})`,
        columns: [
          { label: "Destination", width: 0.38 },
          { label: "Metric", width: 0.3 },
          { label: "Before", width: 0.16 },
          { label: "After", width: 0.16 },
        ],
        rows: metricRows,
      },
      {
        title: `Attribute score changes (${attributeRows.length})`,
        columns: [
          { label: "Destination", width: 0.32 },
          { label: "Attribute", width: 0.26 },
          { label: "Score before", width: 0.12 },
          { label: "Score after", width: 0.12 },
          { label: "Rank before", width: 0.09 },
          { label: "Rank after", width: 0.09 },
        ],
        rows: attributeRows,
      },
      {
        title: `_ids not in DB — skipped (${notFoundRows.length})`,
        columns: [
          { label: "Row", width: 0.2 },
          { label: "_id", width: 0.8 },
        ],
        rows: notFoundRows,
      },
      {
        title: `Row issues (${errorRows.length})`,
        columns: [
          { label: "Row", width: 0.16 },
          { label: "_id", width: 0.26 },
          { label: "Reason", width: 0.58 },
        ],
        rows: errorRows,
      },
    ].filter((section) => section.rows.length > 0);

    return {
      title: "World Ranking Weights — Dry Run",
      module: "Data Upload",
      page: "World Ranking Weights Upload",
      action: "Dry run PDF — World Ranking Weights",
      fileName: file?.name || "",
      summary: [
        { label: "Rows read", value: formatCount(result.processedRows) },
        { label: "Will update", value: formatCount(result.willUpdateCount) },
        { label: "No change", value: formatCount(result.unchangedCount) },
        { label: "Not in DB", value: formatCount(result.notFoundCount) },
        { label: "Row issues", value: formatCount((result.rowErrors || []).length) },
        { label: "Attributes ranked over", value: formatCount(attributeImpact?.universeCount) },
      ],
      sections,
      notes: [
        "This is a dry run: no weight values were written by generating this report.",
        "Rows are matched by _id only — unknown _ids are skipped and never inserted.",
        "The stored Rank column in the sheet is never read or written; ranks below are position across all destinations for that attribute's own score.",
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

  const previewResult = preview.data;
  const commitResult = commit.data;
  const failedRequest = preview.error || commit.error;
  const failedResult = failedRequest?.response?.data;

  return (
    <div className="flex flex-col gap-4">
      <UploadCard
        title="World Ranking Weights Upload"
        description="Update Algo 2.0 destination weights from a CSV exported out of World Ranking Weights V2."
        templateHref={currentDataHref}
        templateLabel="Download current data (.csv)"
      >
        <p className="mb-3 text-[10px] font-pmedium text-slate-400">
          Best flow: download the current data → edit the metric columns → upload
          here. The sheet keeps the _id and stored Rank columns exactly as the
          database has them.
        </p>

        <UploadPanel>
          <FileDropzone
            file={file}
            onPick={pickFile}
            onRemove={resetAll}
            accept=".csv"
            dataTour="data-upload-dropzone"
            disabled={preview.isPending || commit.isPending}
            hint="CSV only · needs the _id column plus the metric columns (Cost Of Living, Internet, Safety, …)"
          />

          <UploadActions
            onUpload={() => preview.mutate()}
            onReset={resetAll}
            uploadLabel="Preview changes (dry run)"
            pendingLabel="Checking file..."
            uploadDisabled={!file || preview.isPending || commit.isPending}
            resetDisabled={preview.isPending || commit.isPending}
            pending={preview.isPending}
          />

          {failedResult && (
            <ErrorPanel
              message={failedResult.message}
              rowErrors={failedResult.rowErrors}
            />
          )}

          {previewResult && !commitResult && (
            <DryRunPanel
              result={previewResult}
              expandedIds={expandedIds}
              onToggle={toggleRow}
              onConfirm={() => commit.mutate()}
              onDiscard={() => preview.reset()}
              isCommitting={commit.isPending}
              attributeImpact={attributeImpact}
              impactPending={isWeightsPending}
              onExportPdf={() => pdfExport.mutate()}
              isExporting={pdfExport.isPending}
            />
          )}

          {commitResult && <CommitPanel result={commitResult} />}
        </UploadPanel>
      </UploadCard>
    </div>
  );
};

export default WorldRankingWeightsUpload;
