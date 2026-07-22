import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { Search, Eye, X, ChevronDown } from "lucide-react";
import { statusPillClass } from "../../../lib/status-pill";
import { toast } from "sonner";

const REQUIREMENT_OPTIONS = [
  "e-visa",
  "no admission",
  "visa free",
  "visa freee",
  "visa on arrival",
  "visa required",
];

const VisaCountries = () => {
  const axiosPrivate = useAxiosPrivate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formRows, setFormRows] = useState([]);
  const [modalError, setModalError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: countries = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["visaCountriesList"],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${NOMADS_API_BASE_URL}/visa-rules/destinations/countries`,
      );
      return response?.data?.countries || [];
    },
  });

  const tableRows = useMemo(
    () =>
      countries.map((country, index) => ({
        id: `${country}-${index}`,
        srNo: index + 1,
        country,
      })),
    [countries],
  );

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return tableRows;
    const q = searchQuery.trim().toLowerCase();
    return tableRows.filter((r) => r.country?.toLowerCase().includes(q));
  }, [tableRows, searchQuery]);

  const { data: visaRules = [], isFetching: isFetchingVisaRules } = useQuery({
    queryKey: ["visaRulesByPassport", selectedPassport],
    queryFn: async () => {
      const response = await axiosPrivate.get(
        `${NOMADS_API_BASE_URL}/visa-rules/passport/${encodeURIComponent(selectedPassport)}`,
      );
      return response?.data?.data || [];
    },
    enabled: Boolean(selectedPassport),
  });

  const { mutate: patchVisaRule, isPending: isSaving } = useMutation({
    mutationFn: async ({ passport, destination, durationDays, requirement }) =>
      axiosPrivate.patch(
        `${NOMADS_API_BASE_URL}/visa-rules/passport/${encodeURIComponent(passport)}`,
        {
          destination,
          durationDays: Number(durationDays),
          requirement,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["visaRulesByPassport", selectedPassport],
      });
      setEditMode(false);
      setModalError("");
    },
    onError: () => {
      setModalError("Failed to update visa rule(s). Please try again.");
    },
  });

  const handleOpenVisaDetails = (passportCountry) => {
    setSelectedPassport(passportCountry);
    setModalError("");
    setEditMode(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditMode(false);
    setFormRows([]);
    setModalError("");
  };

  React.useEffect(() => {
    setFormRows(
      (visaRules || []).map((rule) => ({
        destination: rule.destination || "",
        durationDays: rule.durationDays ?? "",
        requirement: rule.requirement || "",
      })),
    );
  }, [visaRules]);

  const handleFieldChange = (index, field, value) => {
    setFormRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const handleSubmitEdits = (event) => {
    event.preventDefault();
    formRows.forEach((row) => {
      patchVisaRule({
        passport: selectedPassport,
        destination: row.destination,
        durationDays: row.durationDays,
        requirement: row.requirement,
      });
    });
  };

  if (isError) {
    return (
      <div className="p-6 text-red-500">Failed to load visa countries.</div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">

          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                Visa Countries
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                View and manage visa rules for passport countries.
              </p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4 bg-slate-50/50">
              <div className="w-full xl:max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    placeholder="Search countries..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="h-3 bg-slate-200 rounded-full w-8" />
                      <div className="h-3 bg-slate-200 rounded-full w-40" />
                      <div className="h-8 bg-slate-200 rounded-lg w-8 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                  <tr>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Sr No</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-left">Country</th>
                    <th className="px-4 py-3.5 text-[11px] font-pmedium text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-20 text-slate-400 font-pmedium">No countries found.</td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-5 py-4 align-top text-xs font-pmedium text-slate-600">{row.srNo}</td>
                        <td className="px-5 py-4 align-top font-pmedium text-[#0F172A] text-[13px]">{row.country}</td>
                        <td className="px-5 py-4 align-top text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenVisaDetails(row.country)}
                              title="View visa details"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
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
              )}
            </div>
          </div>
        </div>
      </PageFrame>

      {isModalOpen ? (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3" onClick={handleCloseModal}>
          <div
            className="bg-white rounded-[2rem] max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/70 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Eye size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800 truncate">Visa Details - {selectedPassport}</h2>
                  {isFetchingVisaRules && <p className="text-[10px] font-pmedium text-slate-500 mt-1">Loading...</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="px-5 sm:px-6 pt-3">
                <p className="text-[12px] font-pmedium text-red-500">{modalError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitEdits} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-3 overflow-y-auto flex-1">
                {formRows.map((row, index) => (
                  <div
                    key={`${row.destination}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-100"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">Destination</label>
                      <input
                        type="text"
                        value={row.destination}
                        disabled
                        className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">Duration Days</label>
                      <input
                        type="number"
                        value={row.durationDays}
                        onChange={(event) => handleFieldChange(index, "durationDays", event.target.value)}
                        disabled={!editMode}
                        className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:bg-slate-50 disabled:text-slate-500 placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 uppercase font-pmedium tracking-widest">Requirement</label>
                      <div className="relative">
                        <select
                          value={row.requirement}
                          onChange={(event) => handleFieldChange(index, "requirement", event.target.value)}
                          disabled={!editMode}
                          className="w-full px-3 py-2 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] outline-none transition-all focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:bg-slate-50 disabled:text-slate-500 appearance-none"
                        >
                          {Array.from(
                            new Set([
                              ...REQUIREMENT_OPTIONS,
                              ...(row.requirement ? [row.requirement] : []),
                            ]),
                          ).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        {editMode && <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 transition-all"
                  >
                    Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VisaCountries;
