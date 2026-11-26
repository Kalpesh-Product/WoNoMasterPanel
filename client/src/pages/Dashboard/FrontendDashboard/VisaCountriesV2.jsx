import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit,
  Globe2,
  Pencil,
  Plane,
  Search,
  ShieldCheck,
  TicketCheck,
  UploadCloud,
  X,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { STATUS_PILL_BASE } from "../../../lib/status-pill";
import {
  getAllPassportOptions,
  getCountryMeta,
  isSameCountry,
} from "../../../utils/visaCountryMeta";
import { downloadCsv } from "../../../utils/csvExport";
import { FileDropzone } from "./DataUpload/UploadUI";

const VISA_ROWS_IMPORT_ENDPOINT = `${NOMADS_API_BASE_URL}/visa-rules-v2/import-rows-csv`;

const CONTINENT_OPTIONS = ["Europe", "Asia", "Africa", "Americas", "Oceania"];

const REQUIREMENT_FILTERS = [
  { value: "visa free", label: "Visa Free" },
  { value: "visa on arrival", label: "Visa on Arrival" },
  { value: "e-visa", label: "e-Visa" },
  { value: "physical visa", label: "Physical Visa" },
];

const EDIT_REQUIREMENT_OPTIONS = [
  ...REQUIREMENT_FILTERS.map((option) => option.value),
  "eta",
  "nomad visa",
  "no admission",
];

const REQUIREMENT_ALIASES = {
  "e visa": "e-visa",
  evisa: "e-visa",
  "e-visa": "e-visa",
  "traditional visa": "physical visa",
  "physical visa": "physical visa",
  "visa required": "physical visa",
  "visa on arrival": "visa on arrival",
  "visa free": "visa free",
  "visa freee": "visa free",
  "visa free e": "visa free",
};

const normalizeRequirement = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return REQUIREMENT_ALIASES[normalized] || normalized;
};

const visaPillClass = (requirement) => {
  if (requirement === "visa free") {
    return `${STATUS_PILL_BASE} bg-emerald-50 text-emerald-700`;
  }
  if (requirement === "visa on arrival") {
    return `${STATUS_PILL_BASE} bg-blue-50 text-blue-700`;
  }
  if (requirement === "e-visa") {
    return `${STATUS_PILL_BASE} bg-violet-50 text-violet-700`;
  }
  if (requirement === "physical visa") {
    return `${STATUS_PILL_BASE} bg-amber-50 text-amber-700`;
  }
  return `${STATUS_PILL_BASE} bg-slate-100 text-slate-600`;
};

const Stat = ({ label, value, icon: Icon, border, accent }) => (
  <div
    className={`bg-white rounded-[2rem] border border-slate-100 border-l-4 ${border} px-5 py-5 shadow-sm`}
  >
    <div
      className={`flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest ${accent}`}
    >
      <Icon size={13} /> {label}
    </div>
    <div className="mt-2 text-[17px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const ImportStat = ({ label, value, tone = "text-slate-800" }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
    <p className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-sm font-pmedium ${tone}`}>{value}</p>
  </div>
);

const ImportRowErrors = ({ rowErrors = [] }) => {
  if (!rowErrors.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest text-amber-700">
        <AlertCircle size={12} /> {rowErrors.length} row
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

const ImportResultPanel = ({ result }) => (
  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-start gap-2 border-b border-slate-100 px-3 py-2.5">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
      <p className="text-[11px] font-pmedium text-slate-800">
        {result.message || "Visa rules imported successfully."}
      </p>
    </div>
    <div className="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4">
      <ImportStat label="Rows read" value={result.processedRows ?? 0} />
      <ImportStat label="Matched" value={result.matchedCount ?? 0} />
      <ImportStat
        label="Modified"
        value={result.modifiedCount ?? 0}
        tone="text-amber-700"
      />
      <ImportStat
        label="New rows"
        value={result.upsertedCount ?? 0}
        tone="text-[#2563EB]"
      />
    </div>
    <div className="px-3 pb-3">
      <ImportRowErrors rowErrors={result.rowErrors} />
    </div>
  </div>
);

const ImportErrorPanel = ({ error }) => (
  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5">
    <p className="flex items-start gap-1.5 text-[11px] font-pmedium text-rose-700">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      {error.message || "The import could not be processed."}
    </p>
    <ImportRowErrors rowErrors={error.rowErrors} />
  </div>
);

const VisaCountriesV2 = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();

  const [selectedPassport, setSelectedPassport] = useState("");
  const [continent, setContinent] = useState("");
  const [requirementFilter, setRequirementFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({ requirement: "", durationDays: "" });
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const {
    data: passportCountries = [],
    isPending: isLoadingPassports,
    isError: isPassportError,
  } = useQuery({
    queryKey: ["visaCountriesList"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${NOMADS_API_BASE_URL}/visa-rules-v2/destinations/countries`,
      );
      return response?.data?.countries || [];
    },
  });

  const passportOptions = useMemo(
    () => getAllPassportOptions(passportCountries),
    [passportCountries],
  );

  useEffect(() => {
    if (selectedPassport || !passportOptions.length) return;

    const preferred = ["Egypt", "India", "United States"];
    const match = preferred
      .map((name) =>
        passportOptions.find(
          (option) =>
            option.value === name ||
            option.name === name ||
            getCountryMeta(option.value).name === name,
        ),
      )
      .find(Boolean);

    setSelectedPassport((match || passportOptions[0]).value);
  }, [passportOptions, selectedPassport]);

  const {
    data: visaRules = [],
    isFetching: isFetchingRules,
    isError: isRulesError,
  } = useQuery({
    queryKey: ["visaRulesByPassport", selectedPassport],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${NOMADS_API_BASE_URL}/visa-rules-v2/passport/${encodeURIComponent(selectedPassport)}`,
      );
      return response?.data?.data || [];
    },
    enabled: Boolean(selectedPassport),
  });

  const rows = useMemo(
    () =>
      (visaRules || [])
        // You don't need a visa to travel from a country to itself, so the
        // selected origin passport is removed from its own matrix.
        .filter(
          (rule) =>
            !isSameCountry(rule.destination || rule.country, selectedPassport),
        )
        .map((rule, index) => {
          const meta = getCountryMeta(rule.destination);
          return {
            srNo: index + 1,
            id: rule._id || `${rule.destination}-${index}`,
            destination: rule.destination || "",
            country: rule.country || meta.name || rule.destination || "",
            continent: rule.continent || meta.continent || "Other",
            flag: meta.flag,
            requirement: normalizeRequirement(rule.requirement),
            rawRequirement: rule.requirement || "",
            durationDays: rule.durationDays,
          };
        }),
    [visaRules, selectedPassport],
  );

  const kpis = useMemo(
    () => ({
      total: rows.length,
      visaFree: rows.filter((row) => row.requirement === "visa free").length,
      voaOrEvisa: rows.filter((row) =>
        ["visa on arrival", "e-visa"].includes(row.requirement),
      ).length,
      visaRequired: rows.filter((row) => row.requirement === "physical visa").length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (continent && row.continent !== continent) return false;
      if (requirementFilter && row.requirement !== requirementFilter) return false;
      if (!query) return true;
      return [row.destination, row.country, row.continent, row.requirement]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [rows, continent, requirementFilter, search]);

  const { mutate: patchVisaRule, isPending: isSaving } = useMutation({
    mutationFn: async ({ passport, destination, requirement, durationDays }) =>
      axiosPrivate.patch(
        `${NOMADS_API_BASE_URL}/visa-rules-v2/passport/${encodeURIComponent(passport)}`,
        {
          destination,
          requirement,
          durationDays: durationDays === "" ? null : Number(durationDays),
        },
      ),
    onSuccess: (response) => {
      toast.success(response?.data?.message || "Visa rule updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["visaRulesByPassport", selectedPassport],
      });
      setEditingRow(null);
      setEditForm({ requirement: "", durationDays: "" });
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to update visa rule. Please try again.",
      );
    },
  });

  const handleOpenEdit = (row) => {
    setEditingRow(row);
    setEditForm({
      requirement: REQUIREMENT_FILTERS.some(
        (option) => option.value === row.requirement,
      )
        ? row.requirement
        : row.rawRequirement || row.requirement || "physical visa",
      durationDays: row.durationDays ?? "",
    });
  };

  const handleCloseEdit = () => {
    if (isSaving) return;
    setEditingRow(null);
    setEditForm({ requirement: "", durationDays: "" });
  };

  const handleSaveEdit = () => {
    if (!editingRow) return;
    patchVisaRule({
      passport: selectedPassport,
      destination: editingRow.destination,
      requirement: editForm.requirement,
      durationDays: editForm.durationDays,
    });
  };

  // Full-dataset export straight from the backend: the server already sends
  // the round-trippable Passport / Destination / Requirement / DurationDays
  // CSV with a Content-Disposition filename, so a plain link downloads it.
  const importRows = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("visa-rules-file", file);
      const response = await axiosPrivate.post(VISA_ROWS_IMPORT_ENDPOINT, formData);
      return response.data;
    },
    onSuccess: (result) => {
      setImportError(null);
      setImportResult(result);
      setImportFile(null);
      toast.success(result?.message || "Visa rules imported successfully");
      // The file can touch any passport, not just the selected one.
      queryClient.invalidateQueries({ queryKey: ["visaRulesByPassport"] });
      queryClient.invalidateQueries({ queryKey: ["visaCountriesList"] });
    },
    onError: (error) => {
      const data = error?.response?.data;
      setImportResult(null);
      setImportError(
        data && (data.message || data.rowErrors?.length)
          ? data
          : { message: "Import failed. Please try again." },
      );
      toast.error(data?.message || "Import failed. Please try again.");
    },
  });

  // Scoped to the selected passport, reusing data already loaded for the
  // table — the all-passports backend export hangs on production (full
  // unfiltered collection scan), so this stays client-side and per-passport.
  const handleExportMatrix = () => {
    const matrix = [
      ["Passport", "Destination", "Requirement", "DurationDays"],
      ...rows.map((row) => [
        selectedPassport,
        row.destination,
        row.rawRequirement || row.requirement || "",
        row.durationDays ?? "",
      ]),
    ];
    const safePassport = (selectedPassport || "passport")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    downloadCsv({ filename: `visa-rules-${safePassport}.csv`, matrix });
    toast.success(`Visa rules exported for ${selectedPassport}`);
  };

  const passportMeta = getCountryMeta(selectedPassport);
  const isLoading =
    isLoadingPassports ||
    (!selectedPassport && !isPassportError) ||
    (isFetchingRules && rows.length === 0 && !isRulesError);

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                Visa Countries (Algo 2.0)
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Direct lookup of visa type and stay duration for every country in the
                selected passport matrix.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportMatrix}
              disabled={!selectedPassport || !rows.length}
              data-tour="visa-countries-v2-export"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={13} /> Export Visa Rules (.csv)
            </button>
          </div>

          {isPassportError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-[12px] font-pmedium text-red-600">
              Failed to load passport countries. Please verify Visa Rules API connectivity.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    <Plane size={14} className="text-[#2563EB]" /> Origin Passport:
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                    <span className="text-base leading-none">{passportMeta.flag || "🌐"}</span>
                    <select
                      value={selectedPassport}
                      onChange={(event) => {
                        setSelectedPassport(event.target.value);
                        setContinent("");
                        setRequirementFilter("");
                        setSearch("");
                      }}
                      data-tour="visa-countries-v2-passport"
                      className="min-w-[180px] bg-transparent py-1.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB]"
                    >
                      {passportOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.flag ? `${option.flag} ` : ""}
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isFetchingRules && (
                    <span className="text-[10px] font-pmedium text-slate-400">
                      Loading rules...
                    </span>
                  )}
                </div>
              </section>

              <div
                data-tour="visa-countries-v2-stats"
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
              >
                <Stat
                  label="Total Countries"
                  value={isLoading ? "—" : kpis.total}
                  icon={Globe2}
                  border="border-l-slate-400"
                  accent="text-slate-500"
                />
                <Stat
                  label="Visa Free"
                  value={isLoading ? "—" : kpis.visaFree}
                  icon={ShieldCheck}
                  border="border-l-emerald-500"
                  accent="text-emerald-600"
                />
                <Stat
                  label="VoA / e-Visa"
                  value={isLoading ? "—" : kpis.voaOrEvisa}
                  icon={TicketCheck}
                  border="border-l-blue-500"
                  accent="text-blue-600"
                />
                <Stat
                  label="Physical Visa"
                  value={isLoading ? "—" : kpis.visaRequired}
                  icon={Plane}
                  border="border-l-amber-500"
                  accent="text-amber-600"
                />
              </div>

              <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={continent}
                      onChange={(event) => setContinent(event.target.value)}
                      data-tour="visa-countries-v2-continent"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB] min-w-[170px]"
                    >
                      <option value="">All Continents</option>
                      {CONTINENT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={requirementFilter}
                      onChange={(event) => setRequirementFilter(event.target.value)}
                      data-tour="visa-countries-v2-requirement"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB] min-w-[170px]"
                    >
                      <option value="">All Requirements</option>
                      {REQUIREMENT_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1 min-w-[200px] max-w-sm" data-tour="visa-countries-v2-search">
                      <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={15}
                      />
                      <input
                        type="text"
                        placeholder="Search country, continent, requirement..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-pmedium text-[#0F172A] outline-none focus:border-[#2563EB] placeholder:text-slate-400"
                      />
                    </div>
                    <span className="ml-auto text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                      {filteredRows.length} of {rows.length} rules
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto flex-1" data-tour="visa-countries-v2-table">
                  {isLoading ? (
                    <div className="p-6 space-y-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4 animate-pulse">
                          <div className="h-3 bg-slate-200 rounded-full w-8" />
                          <div className="h-3 bg-slate-200 rounded-full w-40" />
                          <div className="h-3 bg-slate-200 rounded-full w-24" />
                          <div className="h-8 bg-slate-200 rounded-lg w-16 ml-auto" />
                        </div>
                      ))}
                    </div>
                  ) : isRulesError ? (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-400">
                        <X size={28} />
                      </div>
                      <p className="text-red-500 font-semibold font-pmedium">
                        Could not load visa rules for {selectedPassport}.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Please verify Visa Rules API connectivity.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[820px] text-left">
                      <thead className="border-b border-slate-100 bg-white text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Sr No</th>
                          <th className="px-5 py-3">Country</th>
                          <th className="px-5 py-3">Continent</th>
                          <th className="px-5 py-3 text-center">Visa Type</th>
                          <th className="px-5 py-3 text-right">Stay Duration (Days)</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-5 py-20 text-center text-[12px] font-pmedium text-slate-400"
                            >
                              No countries match the active filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => (
                            <tr
                              key={row.id}
                              className="transition-colors hover:bg-slate-50/70"
                            >
                              <td className="px-5 py-3.5 text-[11px] font-pmedium text-slate-500">
                                {row.srNo}
                              </td>
                              <td className="px-5 py-3.5 font-pmedium text-[#0F172A]">
                                <span className="mr-1.5">{row.flag}</span>
                                {row.country || "-"}
                              </td>
                              <td className="px-5 py-3.5 font-pmedium text-slate-600">
                                {row.continent || "-"}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={visaPillClass(row.requirement)}>
                                  {row.requirement || "unknown"}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center font-pmedium text-slate-900">
                                {row.durationDays ?? "-"}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(row)}
                                  data-tour={row.srNo === 1 ? "visa-countries-v2-action-edit" : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
                                >
                                  <Pencil size={11} /> Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section
                data-tour="visa-countries-v2-import"
                className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-5"
              >
                <div className="mb-3">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-pmedium uppercase tracking-widest text-slate-500">
                    <UploadCloud size={13} className="text-[#2563EB]" /> Bulk Import Visa
                    Rules
                  </h3>
                  <p className="mt-1 text-[10px] font-pmedium text-slate-400">
                    Upload a CSV from “Export Visa Rules” (one passport, or
                    several combined) to update those rows. Blank Requirement /
                    DurationDays leaves that field unchanged, -1 clears it, and
                    an unknown Passport + Destination pair is inserted as a new
                    row.
                  </p>
                </div>

                <FileDropzone
                  file={importFile}
                  onPick={(picked) => {
                    setImportFile(picked);
                    setImportResult(null);
                    setImportError(null);
                  }}
                  onRemove={() => setImportFile(null)}
                  accept=".csv,text/csv"
                  hint="CSV with columns: Passport, Destination, Requirement, DurationDays"
                  dataTour="visa-countries-v2-import-file"
                  disabled={importRows.isPending}
                />

                <button
                  type="button"
                  onClick={() => importRows.mutate(importFile)}
                  disabled={!importFile || importRows.isPending}
                  className="mt-3 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-pmedium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {importRows.isPending ? "Importing..." : "Upload & Apply"}
                </button>

                {importResult && <ImportResultPanel result={importResult} />}
                {importError && <ImportErrorPanel error={importError} />}
              </section>
            </>
          )}
        </div>
      </PageFrame>

      {editingRow && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={handleCloseEdit}
        >
          <div
            data-tour="visa-countries-v2-edit-modal"
            className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col border border-white/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#2563EB] text-white shadow-sm shrink-0">
                  <Edit size={15} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-pmedium text-slate-800 truncate">
                    Edit visa rule · {editingRow.country || editingRow.destination}
                  </h2>
                  <p className="text-[10px] font-pmedium text-slate-500 mt-0.5">
                    Passport: {selectedPassport} · {editingRow.continent}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                  Country
                </label>
                <input
                  type="text"
                  disabled
                  value={editingRow.country || editingRow.destination}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-pmedium text-slate-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                  Visa Requirement
                </label>
                <select
                  value={editForm.requirement}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, requirement: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB]"
                >
                  {Array.from(
                    new Set([...EDIT_REQUIREMENT_OPTIONS, editForm.requirement].filter(Boolean)),
                  ).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                  Stay Duration (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editForm.durationDays}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, durationDays: event.target.value }))
                  }
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB] placeholder:text-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaCountriesV2;
