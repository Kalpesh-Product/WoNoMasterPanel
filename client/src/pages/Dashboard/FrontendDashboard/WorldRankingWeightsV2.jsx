import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Eye,
  Edit,
  X,
  Globe,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import {
  calculateScore,
  getLabelForScore,
  ATTRIBUTE_TIER_LABELS,
  STATEWISE_WEIGHT_FORMULAS,
  stateWiseWeightCalculation,
} from "../../../utils/weightCalculationsV2";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const WORLD_RANKING_ENDPOINT = `${NOMADS_API_BASE_URL}/state-wise-weight-v2`;

const toRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const normalizeImageUrls = (source) => {
  if (Array.isArray(source)) return source.filter(Boolean);
  if (typeof source === "string" && source.trim()) return [source.trim()];
  if (source && typeof source === "object") {
    if (typeof source.url === "string" && source.url.trim()) {
      return [source.url.trim()];
    }

    return Object.values(source)
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && typeof item.url === "string") {
          return item.url.trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
};

const MAX_IMAGES = 5;

const getImageUrlsFromRow = (row = {}) =>
  normalizeImageUrls(
    row?.imageUrls ??
    row?.imageurls ??
    row?.imageURLS ??
    row?.imageUrl ??
    row?.imageurl ??
    row?.images,
  );

const fmtNumber = (value, digits = 2) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(digits);
};

const toNumericOrFallback = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? fallback : numericValue;
};

// Algo 2.0: exactly the 24 normalized base metrics (1.0–10.0). There is no
// separate labels subdocument — all 33 attribute labels are derived at runtime
// from the calculated score via getLabelForScore().
const weightColumns = [
  { field: "costOfLiving", headerName: "Cost Of Living", minWidth: 150 },
  { field: "internet", headerName: "Internet", minWidth: 120 },
  { field: "safety", headerName: "Safety", minWidth: 120 },
  { field: "nomadCommunity", headerName: "Nomad Community", minWidth: 170 },
  {
    field: "workInfrastructure",
    headerName: "Work Infrastructure",
    minWidth: 180,
  },
  { field: "airQualityIndex", headerName: "Air Quality Index", minWidth: 160 },
  { field: "startupEcosystem", headerName: "Startup Ecosystem", minWidth: 170 },
  {
    field: "healthcareCostIndex",
    headerName: "Healthcare Cost Index",
    minWidth: 190,
  },
  { field: "purchasingPower", headerName: "Purchasing Power", minWidth: 160 },
  {
    field: "inflationStability",
    headerName: "Inflation Stability",
    minWidth: 170,
  },
  { field: "meetupsEvents", headerName: "Meetups & Events", minWidth: 160 },
  {
    field: "incubators",
    headerName: "Startup Incubators & Accelerators",
    minWidth: 250,
  },
  {
    field: "climateEnvironment",
    headerName: "Climate & Environment",
    minWidth: 190,
  },
  { field: "lowerTaxes", headerName: "Lower Taxes", minWidth: 140 },
  {
    field: "natureNomadTravelling",
    headerName: "Nature Nomad Travelling",
    minWidth: 200,
  },
  { field: "yoga", headerName: "Yoga", minWidth: 100 },
  {
    field: "ventureCapitalPresence",
    headerName: "Venture Capital Presence",
    minWidth: 190,
  },
  {
    field: "ventureCapitalInvestments",
    headerName: "Venture Capital Investments",
    minWidth: 230,
  },
  { field: "visaOpenness", headerName: "Visa Openness", minWidth: 150 },
  { field: "healthcareQuality", headerName: "Healthcare Quality", minWidth: 170 },
  {
    field: "flightConnectivity",
    headerName: "Flight Connectivity",
    minWidth: 170,
  },
  { field: "remoteJobs", headerName: "Remote Jobs", minWidth: 130 },
  {
    field: "techTalentDensity",
    headerName: "Tech Talent Density",
    minWidth: 170,
  },
  {
    field: "conferencesEvents",
    headerName: "Conferences & Events",
    minWidth: 180,
  },
];

const titleCaseAttributeKey = (key = "") =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

// Algo 2.0: the 33 calculated attributes. Labels are derived from the score
// via the universal 5-tier classifier (getLabelForScore), never edited.
const CALCULATION_CONFIG = Object.keys(STATEWISE_WEIGHT_FORMULAS).map(
  (formula) => ({
    label: titleCaseAttributeKey(formula),
    formula,
  }),
);

const deriveCalculatedScores = (weights = {}) => stateWiseWeightCalculation(weights);

const deriveLabelsFromCalculatedScores = (calculatedScores = {}) =>
  Object.fromEntries(
    Object.entries(calculatedScores).map(([attribute, scoreValue]) => [
      attribute,
      getLabelForScore(attribute, scoreValue),
    ]),
  );

const getCalculatedScoreValue = (form, config) => {
  const scoreValue = form?.calculatedScores?.[config.formula];
  if (scoreValue !== undefined && scoreValue !== null && scoreValue !== "") {
    return scoreValue;
  }

  const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || {};
  return calculateScore(form?.weight || {}, factors);
};

const getDerivedLabelValue = (form, config) => {
  const storedLabel = form?.calculatedLabels?.[config.formula];
  if (storedLabel) return storedLabel;
  return getLabelForScore(
    config.formula,
    getCalculatedScoreValue(form, config),
  );
};

const getInitialForm = (row = {}) => {
  const rowWeights = row?.weight || row?.weights || {};
  const initialForm = {
    id: row?._id ?? "",
    rank: row?.rank ?? "",
    continent: row?.continent ?? "",
    country: row?.country ?? "",
    state: row?.state ?? "",
    title: row?.title ?? "",
    isActive:
      row?.isActive === true ? "true" : row?.isActive === false ? "false" : "",
    imageUrls: getImageUrlsFromRow(row),
    imageFiles: [],
    weight: {},
    calculatedScores: row?.calculatedScores || {},
    calculatedLabels: row?.calculatedLabels || {},
  };

  weightColumns.forEach((column) => {
    initialForm.weight[column.field] =
      rowWeights?.[column.field] ?? row?.[column.field] ?? "";
  });

  if (!row?.calculatedScores) {
    const derivedScores = deriveCalculatedScores(initialForm.weight);
    initialForm.calculatedScores = derivedScores;
    initialForm.calculatedLabels = deriveLabelsFromCalculatedScores(
      derivedScores,
    );
  }

  return initialForm;
};

const buildPayload = (form) => {
  const normalizedImageUrls = normalizeImageUrls(form.imageUrls).filter(
    (url) => !url.startsWith("blob:"),
  );
  const payload = {
    rank: toNumericOrFallback(form.rank, 0),
    continent: form.continent,
    country: form.country,
    state: form.state,
    title: form.title?.trim() || "",
    isActive:
      form.isActive === "true"
        ? true
        : form.isActive === "false"
          ? false
          : form.isActive,
    imageUrls: normalizedImageUrls,
    weight: {},
  };

  weightColumns.forEach((column) => {
    payload.weight[column.field] = toNumericOrFallback(
      form.weight?.[column.field],
      0,
    );
  });

  return payload;
};

const WorldRankingWeightsV2 = () => {
  const axios = useAxiosPrivate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [addForm, setAddForm] = useState(() => getInitialForm());
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");

  const {
    data: rows = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["world-ranking-weights-v2"],
    queryFn: async () => {
      const response = await axios.get(WORLD_RANKING_ENDPOINT);
      return toRows(response.data);
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["all-companies"],
    queryFn: async () => {
      const response = await axios.get("/api/hosts/companies");
      return response.data;
    },
  });

  const continents = useMemo(() => {
    return [
      ...new Set(
        companies.map((c) => c.companyContinent?.trim()).filter(Boolean),
      ),
    ].sort();
  }, [companies]);

  const countries = useMemo(() => {
    return [
      ...new Set(
        companies
          .filter(
            (c) =>
              !addForm.continent || c.companyContinent === addForm.continent,
          )
          .map((c) => c.companyCountry?.trim())
          .filter(Boolean),
      ),
    ].sort();
  }, [companies, addForm.continent]);

  const states = useMemo(() => {
    return [
      ...new Set(
        companies
          .filter(
            (c) =>
              (!addForm.continent ||
                c.companyContinent === addForm.continent) &&
              (!addForm.country || c.companyCountry === addForm.country),
          )
          .map((c) => c.companyState?.trim())
          .filter(Boolean),
      ),
    ].sort();
  }, [companies, addForm.continent, addForm.country]);

  const { mutate: updateWeights, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.patch(
        `${WORLD_RANKING_ENDPOINT}/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.message || "World ranking weight (v2) updated successfully",
      );
      queryClient.invalidateQueries({
        queryKey: ["world-ranking-weights-v2"],
      });
      setIsEditOpen(false);
      setEditForm(null);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to update world ranking weight (v2)",
      );
    },
  });

  const {
    mutate: toggleActive,
    isPending: isTogglingActive,
    variables: togglingVariables,
  } = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.patch(
        `${WORLD_RANKING_ENDPOINT}/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Status updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["world-ranking-weights-v2"],
      });
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to update status",
      );
    },
  });

  const handleToggleActive = (row) => {
    if (!row?._id) return;
    const currentlyActive = row.isActive === true || row.isActive === "true";
    const form = getInitialForm(row);
    const payload = buildPayload({
      ...form,
      isActive: currentlyActive ? "false" : "true",
    });
    toggleActive({ id: row._id, payload });
  };

  const { mutate: createWeight, isPending: isCreating } = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post(
        `${WORLD_RANKING_ENDPOINT}/add`,
        payload,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.message || "World ranking weight (v2) added successfully",
      );
      queryClient.invalidateQueries({
        queryKey: ["world-ranking-weights-v2"],
      });
      setIsAddOpen(false);
      setAddForm(getInitialForm());
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to add world ranking weight (v2)",
      );
    },
  });

  const handleOpenEdit = (row, startEditing = false) => {
    setEditForm(getInitialForm(row));
    setIsEditOpen(true);
    if (startEditing) setEditMode(true);
  };

  const handleCloseEditModal = () => {
    if (isUpdating) return;
    setIsEditOpen(false);
    setEditForm(null);
  };

  const handleOpenAddModal = () => {
    const maxRank =
      rows.length > 0 ? Math.max(...rows.map((r) => Number(r.rank) || 0)) : 0;
    const initialForm = getInitialForm();
    initialForm.rank = maxRank + 1;
    setAddForm(initialForm);
    setIsAddOpen(true);
  };

  const handleCloseAddModal = () => {
    if (isCreating) return;
    setIsAddOpen(false);
    setAddForm(getInitialForm());
  };

  const handleFormFieldChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleWeightFieldChange = (field, value, formType = "edit") => {
    const setForm = formType === "edit" ? setEditForm : setAddForm;
    setForm((prev) => {
      const nextWeight = { ...prev.weight, [field]: value };
      const nextCalculatedScores = deriveCalculatedScores(nextWeight);
      const nextCalculatedLabels = deriveLabelsFromCalculatedScores(
        nextCalculatedScores,
      );

      return {
        ...prev,
        weight: nextWeight,
        calculatedScores: nextCalculatedScores,
        calculatedLabels: nextCalculatedLabels,
      };
    });
  };

  const handleUpdateSubmit = () => {
    if (!editForm) return;

    const payload = buildPayload(editForm);

    weightColumns.forEach((column) => {
      payload.weight[column.field] = toNumericOrFallback(
        editForm.weight?.[column.field],
        0,
      );
    });

    if (!editForm.id) {
      toast.error("Unable to update weight: missing record id");
      return;
    }

    if (editForm.imageFiles?.length) {
      const formData = new FormData();
      formData.append("rank", String(payload.rank));
      formData.append("continent", payload.continent || "");
      formData.append("country", payload.country || "");
      formData.append("state", payload.state || "");
      formData.append("title", payload.title || "");
      formData.append("isActive", String(payload.isActive ?? ""));
      formData.append("imageUrls", JSON.stringify(payload.imageUrls || []));
      editForm.imageFiles.forEach((file) => formData.append("images", file));
      formData.append("weight", JSON.stringify(payload.weight));

      updateWeights({ id: editForm.id, payload: formData });
      return;
    }

    updateWeights({ id: editForm.id, payload });
  };

  const handleAddSubmit = () => {
    const payload = buildPayload(addForm);

    const formData = new FormData();
    formData.append("rank", String(payload.rank));
    formData.append("continent", payload.continent || "");
    formData.append("country", payload.country || "");
    formData.append("state", payload.state || "");
    formData.append("title", payload.title || "");
    formData.append("isActive", String(payload.isActive ?? ""));
    formData.append("imageUrls", JSON.stringify(payload.imageUrls || []));
    formData.append("weight", JSON.stringify(payload.weight));

    (addForm.imageFiles || []).forEach((file) =>
      formData.append("images", file),
    );

    createWeight(formData);
  };

  const handleImageUpload = (event, formType = "edit") => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      toast.error("Please upload valid image files");
      event.target.value = "";
      return;
    }

    const setForm = formType === "edit" ? setEditForm : setAddForm;
    setForm((prev) => {
      const existingUrls = normalizeImageUrls(prev?.imageUrls);
      const remainingSlots = Math.max(0, MAX_IMAGES - existingUrls.length);

      if (remainingSlots <= 0) {
        toast.error(`You can upload a maximum of ${MAX_IMAGES} images`);
        return prev;
      }

      const acceptedFiles = files.slice(0, remainingSlots);
      if (acceptedFiles.length < files.length) {
        toast.error(`Only ${MAX_IMAGES} images are allowed`);
      }

      const previewUrls = acceptedFiles.map((file) =>
        URL.createObjectURL(file),
      );

      return {
        ...prev,
        imageUrls: [...existingUrls, ...previewUrls],
        imageFiles: [...(prev?.imageFiles || []), ...acceptedFiles],
      };
    });

    event.target.value = "";
  };

  const handleImageDelete = (index, formType = "edit") => {
    const setForm = formType === "edit" ? setEditForm : setAddForm;
    setForm((prev) => {
      const currentUrls = normalizeImageUrls(prev?.imageUrls);
      const targetUrl = currentUrls[index];
      if (!targetUrl) return prev;

      const nextUrls = currentUrls.filter((_, i) => i !== index);
      let nextFiles = [...(prev?.imageFiles || [])];

      if (targetUrl.startsWith("blob:")) {
        const blobIndex =
          currentUrls
            .slice(0, index + 1)
            .filter((url) => url.startsWith("blob:")).length - 1;
        nextFiles = nextFiles.filter((_, i) => i !== blobIndex);
        URL.revokeObjectURL(targetUrl);
      }

      return {
        ...prev,
        imageUrls: nextUrls,
        imageFiles: nextFiles,
      };
    });
  };

  useEffect(() => {
    if (!isEditOpen) {
      setEditMode(false);
    }
  }, [isEditOpen]);

  useEffect(() => {
    return () => {
      (editForm?.imageUrls || []).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      (addForm?.imageUrls || []).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowData = useMemo(
    () =>
      rows.map((item, index) => ({
        srNo: index + 1,
        ...item,
      })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowData.filter(
      (row) =>
        !q ||
        [row.state, row.country, row.continent, row.title, String(row.rank)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rowData, search]);

  const stats = useMemo(() => {
    const total = rowData.length;
    const active = rowData.filter(
      (r) => r.isActive === true || r.isActive === "true",
    ).length;
    const inactive = total - active;
    const avgRank =
      total > 0
        ? (
            rowData.reduce((s, r) => s + (Number(r.rank) || 0), 0) / total
          ).toFixed(1)
        : "0.0";
    return { total, active, inactive, avgRank };
  }, [rowData]);

  const inputCls =
    "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400";
  const inputDisabledCls =
    "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed";
  const selectCls =
    "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all";
  const selectDisabledCls =
    "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed";

  const CalculationsGrid = ({ form }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CALCULATION_CONFIG.map((config) => {
        const currentScore = getCalculatedScoreValue(form, config);
        const derivedLabel = getDerivedLabelValue(form, config);
        const tierOptions = ATTRIBUTE_TIER_LABELS[config.formula] || [];
        return (
          <div key={config.formula} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                Score {config.label}
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={fmtNumber(currentScore, 2)}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                {config.label}
              </label>
              <select
                disabled
                value={derivedLabel || ""}
                onChange={() => {}}
                className={selectDisabledCls}
              >
                <option value="">None</option>
                {tierOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
              <div>
                <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                  World Ranking Weights (Algo 2.0)
                </h2>
                <p className="text-xs font-pmedium text-slate-500 mt-1">
                  Manage country and state rankings with WoNo AI Algorithm 2.0
                  weight configurations.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse"
                >
                  <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
                  <div className="h-5 w-10 bg-slate-200 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded-full w-8" />
                  <div className="h-3 bg-slate-200 rounded-full w-16" />
                  <div className="h-3 bg-slate-200 rounded-full w-24" />
                  <div className="h-3 bg-slate-200 rounded-full w-32" />
                  <div className="h-3 bg-slate-200 rounded-full w-20" />
                  <div className="h-3 bg-slate-200 rounded-full w-16" />
                </div>
              ))}
            </div>
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                World Ranking Weights (Algo 2.0)
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Manage country and state rankings with WoNo AI Algorithm 2.0
                weight configurations.
              </p>
            </div>
          </div>

          <div data-tour="world-ranking-weights-v2-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {[
              {
                label: "Total Entries",
                value: stats.total,
                icon: BarChart3,
                accent: "border-l-slate-400",
                textColor: "text-slate-500",
                bgColor: "bg-slate-50",
              },
              {
                label: "Active",
                value: stats.active,
                icon: CheckCircle2,
                accent: "border-l-emerald-500",
                textColor: "text-emerald-600",
                bgColor: "bg-emerald-50",
              },
              {
                label: "Inactive",
                value: stats.inactive,
                icon: XCircle,
                accent: "border-l-amber-500",
                textColor: "text-amber-600",
                bgColor: "bg-amber-50",
              },
              {
                label: "Average Rank",
                value: stats.avgRank,
                icon: Globe,
                accent: "border-l-blue-500",
                textColor: "text-blue-600",
                bgColor: "bg-blue-50",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className={`flex items-center justify-between rounded-[2rem] border border-slate-100 border-l-4 bg-white p-5 shadow-sm ${s.accent}`}
                >
                  <div>
                    <p
                      className={`mb-1 text-[10px] font-pmedium uppercase tracking-widest ${s.textColor}`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[15px] font-pmedium text-slate-900">
                      {s.value}
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl p-2 ${s.bgColor} ${s.textColor}`}
                  >
                    <Icon size={16} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm" data-tour="world-ranking-weights-v2-search">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={15}
                  />
                  <input
                    type="text"
                    placeholder="Search state, country, title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/60 rounded-lg text-[12px] font-pmedium text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                <button
                  onClick={handleOpenAddModal}
                  data-tour="world-ranking-weights-v2-add"
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-3xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={14} /> Add Entry
                </button>
              </div>
            </div>

            {isError ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-400">
                  <XCircle size={28} />
                </div>
                <p className="text-red-500 font-semibold font-pmedium">
                  Could not load world ranking (Algo 2.0) data.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Please verify World Ranking V2 API connectivity.
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Globe size={28} />
                </div>
                <p className="text-slate-400 font-semibold font-pmedium">
                  No entries found.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table data-tour="world-ranking-weights-v2-table" className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">State</th>
                      <th className="px-5 py-4">Country</th>
                      <th className="px-5 py-4">Title</th>
                      <th className="px-5 py-4">Default Score</th>
                      <th className="px-5 py-4">Default Label</th>
                      <th className="px-5 py-4 text-center">Status</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredRows.map((row, index) => {
                      const isActive =
                        row.isActive === true || row.isActive === "true";
                      const defaultScore =
                        row.calculatedScores?.bestForNomads ?? "";
                      const defaultLabel =
                        row.calculatedLabels?.bestForNomads ?? "";
                      return (
                        <tr
                          key={row._id || row.srNo}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="px-5 py-4 text-[11px] font-pmedium text-slate-500">
                            {row.srNo}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row.rank}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row.state}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {row.country}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700 truncate max-w-[200px]">
                            {row.title}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {fmtNumber(defaultScore, 2)}
                          </td>
                          <td className="px-5 py-4 text-[12px] font-pmedium text-slate-700">
                            {defaultLabel || "-"}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                                title="View"
                                data-tour={index === 0 ? "world-ranking-weights-v2-action-view" : undefined}
                              >
                                <Eye size={15} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row, true)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                                title="Edit"
                                data-tour={index === 0 ? "world-ranking-weights-v2-action-edit" : undefined}
                              >
                                <Edit size={15} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(row)}
                                disabled={
                                  isTogglingActive &&
                                  togglingVariables?.id === row._id
                                }
                                className={`p-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isActive
                                    ? "bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700"
                                    : "bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
                                }`}
                                title={isActive ? "Disable" : "Enable"}
                                data-tour={index === 0 ? "world-ranking-weights-v2-action-toggle" : undefined}
                              >
                                {isActive ? (
                                  <XCircle size={15} strokeWidth={2.5} />
                                ) : (
                                  <CheckCircle2 size={15} strokeWidth={2.5} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageFrame>

      {isEditOpen && editForm && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={handleCloseEditModal}
        >
          <div
            data-tour="world-ranking-weights-v2-edit-modal"
            className="bg-white rounded-[2rem] max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Edit size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">
                    Edit Weights (Algo 2.0) : {editForm.state || ""}
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                    {editForm.country}, {editForm.continent}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!editMode ? (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Edit size={13} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(false)}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateSubmit}
                      disabled={isUpdating || !editForm}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isUpdating ? "Updating..." : "Update"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto bg-white flex-1">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Images
                </h3>
                {editForm.imageUrls?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {editForm.imageUrls.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="relative group"
                      >
                        <img
                          src={url}
                          alt={`${editForm.state} preview ${index + 1}`}
                          className="w-full h-28 object-cover rounded-xl border border-slate-100"
                        />
                        {editMode && (
                          <button
                            type="button"
                            onClick={() => handleImageDelete(index, "edit")}
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-400 font-pmedium">
                    No images uploaded.
                  </p>
                )}
                {editMode && (
                  <label className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                    Upload Images
                    <input
                      hidden
                      accept="image/*"
                      type="file"
                      multiple
                      onChange={(e) => handleImageUpload(e, "edit")}
                    />
                  </label>
                )}
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Rank
                    </label>
                    <input
                      type="number"
                      disabled
                      value={editForm.rank}
                      onChange={(e) =>
                        handleFormFieldChange("rank", e.target.value)
                      }
                      className={inputDisabledCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Continent
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editForm.continent}
                      className={inputDisabledCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editForm.country}
                      className={inputDisabledCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editForm.state}
                      className={inputDisabledCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={editForm.title}
                      onChange={(e) =>
                        handleFormFieldChange("title", e.target.value)
                      }
                      className={editMode ? inputCls : inputDisabledCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </label>
                    <select
                      disabled={!editMode}
                      value={editForm.isActive}
                      onChange={(e) =>
                        handleFormFieldChange("isActive", e.target.value)
                      }
                      className={editMode ? selectCls : selectDisabledCls}
                    >
                      <option value="">Select</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Weights (24 Metrics)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {weightColumns.map((column) => (
                    <div key={column.field}>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                        {column.headerName}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!editMode}
                        value={editForm.weight?.[column.field] ?? ""}
                        onChange={(e) =>
                          handleWeightFieldChange(
                            column.field,
                            e.target.value,
                            "edit",
                          )
                        }
                        className={editMode ? inputCls : inputDisabledCls}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Calculated Scores &amp; Derived Labels (Algo 2.0, read-only)
                </h3>
                <CalculationsGrid form={editForm} />
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddOpen && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={handleCloseAddModal}
        >
          <div
            data-tour="world-ranking-weights-v2-add-modal"
            className="bg-white rounded-[2rem] max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Plus size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">
                    Add World Ranking Weight (Algo 2.0)
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto bg-white flex-1">
              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Images
                </h3>
                {addForm.imageUrls?.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                    {addForm.imageUrls.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="relative group"
                      >
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-28 object-cover rounded-xl border border-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleImageDelete(index, "add")}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                  Upload Images
                  <input
                    hidden
                    accept="image/*"
                    type="file"
                    multiple
                    onChange={(e) => handleImageUpload(e, "add")}
                  />
                </label>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Rank
                    </label>
                    <input
                      type="number"
                      value={addForm.rank}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          rank: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Continent
                    </label>
                    <select
                      value={addForm.continent}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          continent: e.target.value,
                          country: "",
                          state: "",
                        }))
                      }
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {continents.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Country
                    </label>
                    <select
                      value={addForm.country}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          country: e.target.value,
                          state: "",
                        }))
                      }
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      State / City
                    </label>
                    <select
                      value={addForm.state}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </label>
                    <select
                      value={addForm.isActive}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          isActive: e.target.value,
                        }))
                      }
                      className={selectCls}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={addForm.title}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Weights (24 Metrics)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {weightColumns.map((column) => (
                    <div key={column.field}>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                        {column.headerName}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={addForm.weight?.[column.field] ?? ""}
                        onChange={(e) =>
                          handleWeightFieldChange(
                            column.field,
                            e.target.value,
                            "add",
                          )
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Calculated Scores &amp; Derived Labels (Algo 2.0, read-only)
                </h3>
                <CalculationsGrid form={addForm} />
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3 shrink-0">
              <button
                onClick={handleCloseAddModal}
                disabled={isCreating}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-pmedium text-[12px] hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubmit}
                disabled={isCreating}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl font-pmedium text-[12px] hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isCreating ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldRankingWeightsV2;
