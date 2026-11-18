import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  Download,
  Edit,
  Globe,
  Layers3,
  Plus,
  Search,
  Target,
  X,
  XCircle,
} from "lucide-react";
import PageFrame from "../../../components/Pages/PageFrame";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import {
  ATTRIBUTE_TIER_LABELS,
  STATEWISE_WEIGHT_FORMULAS,
  calculateScore,
  getLabelForScore,
  stateWiseWeightCalculation,
} from "../../../utils/weightCalculationsV2";
import {
  ALGO2_BASE_METRICS,
  FACTOR_SHORT_LABELS,
  tierPillClass,
} from "../../../constants/algo2Metrics";
import { NOMADS_API_BASE_URL } from "../../../constants/api";
import { downloadCsv } from "../../../utils/csvExport";
import Algo2MathDrawer from "./Algo2MathDrawer";

const WORLD_RANKING_ENDPOINT = `${NOMADS_API_BASE_URL}/state-wise-weight-v2`;

// Algo 2.0 categories. The Master Panel naming uses `financialStability`,
// while the calc engine key is `financialStabilityLowRisk` — the alias below
// keeps the UI copy stable while calculating with the real formula.
const CATEGORY_DEFINITIONS = {
  world: {
    label: "World Ranking (9 Pillars)",
    attributes: [
      "bestForNomads",
      "mostAffordable",
      "safestCities",
      "easyVisaLongStay",
      "strongNomadCommunity",
      "healthcareFriendly",
      "startupBusinessOpportunities",
      "cleanAirEnvironment",
      "bestWorkInfrastructure",
    ],
  },
  savings: {
    label: "Increase Your Savings (6)",
    attributes: [
      "maximumSavings",
      "lowTaxation",
      "purchasingPower",
      "financialStability",
      "startupSetupCost",
      "balancedFinancialLifestyle",
    ],
  },
  remote: {
    label: "Work From Anywhere (6)",
    attributes: [
      "bestForRemoteWorkSetup",
      "mostAffordable",
      "bestConnectedCitiesFlights",
      "strongNomadCommunity",
      "fastInternetCities",
      "bestWorkInfrastructure",
    ],
  },
  career: {
    label: "Advance Your Career (8)",
    attributes: [
      "startupEcosystems",
      "remoteJobOpportunities",
      "techTalentDensity",
      "startupFundingSupport",
      "ventureCapitalPresence",
      "founderNomads",
      "balancedCareerGrowth",
      "conferencesEvents",
    ],
  },
  community: {
    label: "Find Your Community (9)",
    attributes: [
      "socialPartyLifestyle",
      "chillWellnessLifestyle",
      "adventureExploration",
      "strongNomadCommunity",
      "soloNomads",
      "coupleFriendlyLifestyle",
      "femaleFriendlyLifestyle",
      "familyFriendlyLifestyle",
      "founderNomads",
    ],
  },
};

const ATTRIBUTE_KEY_ALIASES = {
  financialStability: "financialStabilityLowRisk",
};

const ATTRIBUTE_LABEL_OVERRIDES = {
  financialStabilityLowRisk: "Financial Stability",
  easyVisaLongStay: "Easy Visa & Long Stay",
  startupBusinessOpportunities: "Startup Business Opportunities",
};

const TIER_THRESHOLDS = [
  { min: "≥ 9.0", index: 0 },
  { min: "≥ 8.0", index: 1 },
  { min: "≥ 6.5", index: 2 },
  { min: "≥ 5.0", index: 3 },
  { min: "< 5.0", index: 4 },
];

const resolveAttributeKey = (key) => ATTRIBUTE_KEY_ALIASES[key] || key;

const titleCaseAttributeKey = (key = "") =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const getAttributeLabel = (key) =>
  ATTRIBUTE_LABEL_OVERRIDES[key] || titleCaseAttributeKey(key);

const CALCULATION_CONFIG = Object.keys(STATEWISE_WEIGHT_FORMULAS).map(
  (formula) => ({ label: getAttributeLabel(formula), formula }),
);

const getDestinationName = (row = {}) =>
  row.destination || row.state || row.title || row.city || "-";

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

const deriveCalculatedScores = (weights = {}) => stateWiseWeightCalculation(weights);

const deriveLabelsFromCalculatedScores = (calculatedScores = {}) =>
  Object.fromEntries(
    Object.entries(calculatedScores).map(([attribute, score]) => [
      attribute,
      getLabelForScore(attribute, score),
    ]),
  );

const getCalculatedScoreValue = (form, config) => {
  const scoreValue = form?.calculatedScores?.[config.formula];
  if (scoreValue !== undefined && scoreValue !== null && scoreValue !== "") {
    return scoreValue;
  }
  return calculateScore(form?.weight || {}, STATEWISE_WEIGHT_FORMULAS[config.formula] || {});
};

const getDerivedLabelValue = (form, config) => {
  const storedLabel = form?.calculatedLabels?.[config.formula];
  if (storedLabel) return storedLabel;
  return getLabelForScore(config.formula, getCalculatedScoreValue(form, config));
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
    destination: getDestinationName(row),
    isActive:
      row?.isActive === true ? "true" : row?.isActive === false ? "false" : "",
    imageUrls: getImageUrlsFromRow(row),
    imageFiles: [],
    weight: {},
    calculatedScores: row?.calculatedScores || {},
    calculatedLabels: row?.calculatedLabels || {},
  };

  ALGO2_BASE_METRICS.forEach((metric) => {
    initialForm.weight[metric.field] =
      rowWeights?.[metric.field] ?? row?.[metric.field] ?? "";
  });

  if (!row?.calculatedScores) {
    const derivedScores = deriveCalculatedScores(initialForm.weight);
    initialForm.calculatedScores = derivedScores;
    initialForm.calculatedLabels = deriveLabelsFromCalculatedScores(derivedScores);
  }

  return initialForm;
};

const buildPayload = (form) => {
  const cleanedImageUrls = normalizeImageUrls(form.imageUrls).filter(
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
    imageUrls: cleanedImageUrls,
    weight: {},
  };

  ALGO2_BASE_METRICS.forEach((metric) => {
    payload.weight[metric.field] = toNumericOrFallback(
      form.weight?.[metric.field],
      0,
    );
  });

  return payload;
};

const Stat = ({ label, value, icon: Icon, border, accent }) => (
  <div
    className={`bg-white rounded-[2rem] border border-slate-100 border-l-4 ${border} px-5 py-5 shadow-sm min-w-[150px]`}
  >
    <div
      className={`flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest ${accent}`}
    >
      <Icon size={13} /> {label}
    </div>
    <div className="mt-2 text-[17px] font-pmedium text-slate-900">{value}</div>
  </div>
);

const FormulaBanner = ({ attributeKey, categoryLabel, averageScore }) => {
  const factors = STATEWISE_WEIGHT_FORMULAS[attributeKey] || {};
  const tierLabels = ATTRIBUTE_TIER_LABELS[attributeKey] || [];
  const formulaText = Object.entries(factors)
    .map(
      ([factor, multiplier]) =>
        `${FACTOR_SHORT_LABELS[factor] || titleCaseAttributeKey(factor)}(${Math.round(multiplier * 100)}%)`,
    )
    .join(" + ");

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#2563EB] shadow-sm">
            <Calculator size={14} />
          </span>
          <div>
            <p className="text-[10px] font-pmedium uppercase tracking-widest text-blue-600">
              Active Formula · {categoryLabel}
            </p>
            <p className="mt-0.5 text-[12px] font-pmedium text-blue-950">
              {getAttributeLabel(attributeKey)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-sm">
          <span className="text-[9px] font-pmedium uppercase tracking-widest text-slate-400">
            Average score
          </span>
          <span className="text-[12px] font-pmedium text-[#2563EB]">
            {averageScore}
          </span>
        </div>
      </div>

      <p className="mt-3 break-words font-mono text-[11px] leading-6 text-blue-950">
        {formulaText}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TIER_THRESHOLDS.map((threshold) => (
          <div
            key={threshold.min}
            className={`flex items-center justify-between gap-2 rounded-xl border bg-white px-2.5 py-2 ${tierPillClass(tierLabels[threshold.index], tierLabels)}`}
          >
            <span className="text-[9px] font-pmedium uppercase tracking-wider">
              {tierLabels[threshold.index] || "-"}
            </span>
            <span className="text-[10px] font-pmedium">{threshold.min}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed"
            >
              <option value="">None</option>
              {tierOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    })}
  </div>
);

const WorldRankingWeightsV2 = () => {
  const axios = useAxiosPrivate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [addForm, setAddForm] = useState(() => getInitialForm());
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("world");
  const [selectedAttribute, setSelectedAttribute] = useState("bestForNomads");
  const [mathRow, setMathRow] = useState(null);

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

  const continents = useMemo(
    () =>
      [
        ...new Set(companies.map((c) => c.companyContinent?.trim()).filter(Boolean)),
      ].sort(),
    [companies],
  );

  const countries = useMemo(
    () =>
      [
        ...new Set(
          companies
            .filter((c) => !addForm.continent || c.companyContinent === addForm.continent)
            .map((c) => c.companyCountry?.trim())
            .filter(Boolean),
        ),
      ].sort(),
    [companies, addForm.continent],
  );

  const states = useMemo(
    () =>
      [
        ...new Set(
          companies
            .filter(
              (c) =>
                (!addForm.continent || c.companyContinent === addForm.continent) &&
                (!addForm.country || c.companyCountry === addForm.country),
            )
            .map((c) => c.companyState?.trim())
            .filter(Boolean),
        ),
      ].sort(),
    [companies, addForm.continent, addForm.country],
  );

  const { mutate: updateWeights, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.patch(`${WORLD_RANKING_ENDPOINT}/${id}`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "World ranking weight (v2) updated successfully");
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights-v2"] });
      setIsEditOpen(false);
      setEditForm(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update world ranking weight (v2)");
    },
  });

  const {
    mutate: toggleActive,
    isPending: isTogglingActive,
    variables: togglingVariables,
  } = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await axios.patch(`${WORLD_RANKING_ENDPOINT}/${id}`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights-v2"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
  });

  const { mutate: createWeight, isPending: isCreating } = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post(`${WORLD_RANKING_ENDPOINT}/add`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "World ranking weight (v2) added successfully");
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights-v2"] });
      setIsAddOpen(false);
      setAddForm(getInitialForm());
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to add world ranking weight (v2)");
    },
  });

  const category = CATEGORY_DEFINITIONS[selectedCategory];
  const activeAttributeKey = resolveAttributeKey(selectedAttribute);
  const activeTierLabels = ATTRIBUTE_TIER_LABELS[activeAttributeKey] || [];

  const handleCategoryChange = (categoryKey) => {
    setSelectedCategory(categoryKey);
    setSelectedAttribute(CATEGORY_DEFINITIONS[categoryKey].attributes[0]);
  };

  const rankedRows = useMemo(() => {
    const factors = STATEWISE_WEIGHT_FORMULAS[activeAttributeKey] || {};
    const scored = rows.map((row) => {
      const score = calculateScore(row?.weight || row?.weights || {}, factors);
      return {
        ...row,
        attributeScore: score,
        semanticBadge: getLabelForScore(activeAttributeKey, score),
      };
    });

    return scored
      .sort(
        (a, b) =>
          b.attributeScore - a.attributeScore ||
          String(getDestinationName(a)).localeCompare(String(getDestinationName(b))),
      )
      .map((row, index) => ({ ...row, dynamicRank: index + 1 }));
  }, [rows, activeAttributeKey]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rankedRows;
    return rankedRows.filter((row) =>
      [getDestinationName(row), row.country, row.continent, row.state, row.title, String(row.dynamicRank)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [rankedRows, search]);

  const stats = useMemo(() => {
    const total = rankedRows.length;
    const scores = rankedRows.map((row) => row.attributeScore);
    const top = scores.length ? Math.max(...scores) : 0;
    const average = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
    const active = rankedRows.filter((row) => row.isActive === true || row.isActive === "true").length;
    return {
      total,
      top: fmtNumber(top, 2),
      average: fmtNumber(average, 2),
      active,
    };
  }, [rankedRows]);

  const handleToggleActive = (row) => {
    if (!row?._id) return;
    const currentlyActive = row.isActive === true || row.isActive === "true";
    const form = getInitialForm(row);
    const payload = buildPayload({ ...form, isActive: currentlyActive ? "false" : "true" });
    toggleActive({ id: row._id, payload });
  };

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
    const maxRank = rows.length > 0 ? Math.max(...rows.map((r) => Number(r.rank) || 0)) : 0;
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
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleWeightFieldChange = (field, value, formType = "edit") => {
    const setForm = formType === "edit" ? setEditForm : setAddForm;
    setForm((prev) => {
      const nextWeight = { ...prev.weight, [field]: value };
      const nextCalculatedScores = deriveCalculatedScores(nextWeight);
      return {
        ...prev,
        weight: nextWeight,
        calculatedScores: nextCalculatedScores,
        calculatedLabels: deriveLabelsFromCalculatedScores(nextCalculatedScores),
      };
    });
  };

  const handleUpdateSubmit = () => {
    if (!editForm) return;
    const payload = buildPayload(editForm);
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
    (addForm.imageFiles || []).forEach((file) => formData.append("images", file));
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
      return {
        ...prev,
        imageUrls: [
          ...existingUrls,
          ...acceptedFiles.map((file) => URL.createObjectURL(file)),
        ],
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
          currentUrls.slice(0, index + 1).filter((url) => url.startsWith("blob:")).length - 1;
        nextFiles = nextFiles.filter((_, i) => i !== blobIndex);
        URL.revokeObjectURL(targetUrl);
      }
      return { ...prev, imageUrls: nextUrls, imageFiles: nextFiles };
    });
  };

  const handleExportWeights = () => {
    const matrix = [
      [
        "_id",
        "Rank",
        "Destination",
        "State",
        "Title",
        "Country",
        "Continent",
        "Active",
        ...ALGO2_BASE_METRICS.map((metric) => metric.label),
      ],
      ...rankedRows.map((row) => [
        row._id || "",
        row.rank ?? "",
        getDestinationName(row),
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
    downloadCsv({ filename: "wono_algo2_base_weights.csv", matrix });
    toast.success("Weights exported with 24 base metrics and locked _ids");
  };

  useEffect(() => {
    if (!isEditOpen) setEditMode(false);
  }, [isEditOpen]);

  useEffect(
    () => () => {
      (editForm?.imageUrls || []).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      (addForm?.imageUrls || []).forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderSkeleton = () => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse"
          >
            <div className="h-3 w-20 bg-slate-200 rounded-full mb-2" />
            <div className="h-5 w-10 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="bg-white/80 rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 animate-pulse">
            <div className="h-3 bg-slate-200 rounded-full w-8" />
            <div className="h-3 bg-slate-200 rounded-full w-24" />
            <div className="h-3 bg-slate-200 rounded-full w-40" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
      <PageFrame>
        <div className="flex flex-col gap-4">
          <div className="mb-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
            <div>
              <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                World Ranking Weights (Algo 2.0)
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Filter a persona, recalculate all 132 destinations live, and inspect the exact
                formula behind every rank.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportWeights}
              disabled={!rankedRows.length}
              data-tour="world-ranking-weights-v2-export"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Download size={13} /> Export Weights (.csv)
            </button>
          </div>

          {isPending ? (
            renderSkeleton()
          ) : (
            <>
              <div
                data-tour="world-ranking-weights-v2-stats"
                className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0"
              >
                <Stat
                  label="Destinations"
                  value={stats.total}
                  icon={Globe}
                  border="border-l-slate-400"
                  accent="text-slate-500"
                />
                <Stat
                  label="Top Score"
                  value={stats.top}
                  icon={Target}
                  border="border-l-emerald-500"
                  accent="text-emerald-600"
                />
                <Stat
                  label="Average Score"
                  value={stats.average}
                  icon={BarChart3}
                  border="border-l-blue-500"
                  accent="text-blue-600"
                />
                <Stat
                  label="Active Entries"
                  value={stats.active}
                  icon={CheckCircle2}
                  border="border-l-violet-500"
                  accent="text-violet-600"
                />
              </div>

              <FormulaBanner
                attributeKey={activeAttributeKey}
                categoryLabel={category.label}
                averageScore={stats.average}
              />

              <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-3 sm:p-4 lg:p-5 border-b border-slate-100/60 flex flex-col gap-3 bg-slate-50/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                      <Layers3 size={13} /> Hierarchical filters
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(event) => handleCategoryChange(event.target.value)}
                      data-tour="world-ranking-weights-v2-category"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB] min-w-[210px]"
                    >
                      {Object.entries(CATEGORY_DEFINITIONS).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedAttribute}
                      onChange={(event) => setSelectedAttribute(event.target.value)}
                      data-tour="world-ranking-weights-v2-attribute"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-pmedium text-slate-700 outline-none focus:border-[#2563EB] min-w-[200px]"
                    >
                      {category.attributes.map((attribute) => (
                        <option key={attribute} value={attribute}>
                          {getAttributeLabel(resolveAttributeKey(attribute))}
                        </option>
                      ))}
                    </select>
                    <div className="relative flex-1 min-w-[200px] max-w-sm" data-tour="world-ranking-weights-v2-search">
                      <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={15}
                      />
                      <input
                        type="text"
                        placeholder="Search destination, country, continent..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-pmedium text-[#0F172A] outline-none focus:border-[#2563EB] placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      data-tour="world-ranking-weights-v2-add"
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[11px] font-pmedium text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                      <Plus size={13} /> Add Entry
                    </button>
                  </div>
                  <p className="text-[10px] font-pmedium text-slate-400">
                    Ranks are recalculated on every attribute change from the 24 normalized base
                    weights — stored ranks are never reused for this view.
                  </p>
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
                    <p className="text-slate-400 font-semibold font-pmedium">No entries found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-1" data-tour="world-ranking-weights-v2-table">
                    <table className="w-full min-w-[900px] text-left">
                      <thead className="border-b border-slate-100 bg-white text-[10px] font-pmedium uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="px-5 py-3">Rank</th>
                          <th className="px-5 py-3">Destination</th>
                          <th className="px-5 py-3">Country</th>
                          <th className="px-5 py-3">Continent</th>
                          <th className="px-5 py-3 text-center">Attribute Score</th>
                          <th className="px-5 py-3 text-left">Semantic Badge</th>
                          <th className="px-5 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((row, index) => (
                          <tr
                            key={row._id || `${row.dynamicRank}-${getDestinationName(row)}`}
                            className="transition-colors hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-3.5 font-pmedium text-slate-500">
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-[10px] font-pmedium text-slate-600">
                                #{row.dynamicRank}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-pmedium text-[#0F172A]">
                              {getDestinationName(row)}
                            </td>
                            <td className="px-5 py-3.5 font-pmedium text-slate-600">
                              {row.country || "-"}
                            </td>
                            <td className="px-5 py-3.5 font-pmedium text-slate-600">
                              {row.continent || "-"}
                            </td>
                            <td className="px-5 py-3.5 text-center font-pmedium text-slate-900">
                              {fmtNumber(row.attributeScore, 2)}
                              <span className="text-[10px] font-pregular text-slate-400"> / 10</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-pmedium uppercase tracking-wider ${tierPillClass(row.semanticBadge, activeTierLabels)}`}
                              >
                                {row.semanticBadge || "-"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setMathRow(row)}
                                  aria-label={`Show math for ${getDestinationName(row)}`}
                                  data-tour={index === 0 ? "world-ranking-weights-v2-action-math" : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
                                >
                                  <Calculator size={12} /> Math
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(row, true)}
                                  aria-label={`Edit ${getDestinationName(row)}`}
                                  data-tour={index === 0 ? "world-ranking-weights-v2-action-edit" : undefined}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-pmedium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#2563EB]"
                                >
                                  <Edit size={12} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(row)}
                                  disabled={
                                    isTogglingActive && togglingVariables?.id === row._id
                                  }
                                  aria-label={
                                    row.isActive === true || row.isActive === "true"
                                      ? "Disable entry"
                                      : "Enable entry"
                                  }
                                  data-tour={index === 0 ? "world-ranking-weights-v2-action-toggle" : undefined}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-pmedium transition-colors disabled:opacity-50 ${
                                    row.isActive === true || row.isActive === "true"
                                      ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  {row.isActive === true || row.isActive === "true" ? (
                                    <CheckCircle2 size={12} />
                                  ) : (
                                    <XCircle size={12} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </PageFrame>

      {mathRow && (
        <Algo2MathDrawer
          row={mathRow}
          attributeKey={activeAttributeKey}
          categoryAttributes={category.attributes.map(resolveAttributeKey)}
          onClose={() => setMathRow(null)}
          onEdit={(row) => {
            setMathRow(null);
            handleOpenEdit(row, true);
          }}
          onSelectAttribute={(key) => {
            const sourceKey = Object.entries(ATTRIBUTE_KEY_ALIASES).find(
              ([, resolved]) => resolved === key,
            )?.[0];
            setSelectedAttribute(sourceKey || key);
          }}
        />
      )}

      {isEditOpen && editForm && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={handleCloseEditModal}
        >
          <div
            data-tour="world-ranking-weights-v2-edit-modal"
            className="bg-white rounded-[2rem] max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Edit size={16} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">
                    Edit Weights (Algo 2.0) : {editForm.state || getDestinationName(editForm)}
                  </h2>
                  <p className="text-[11px] font-pmedium text-slate-500 mt-0.5">
                    {editForm.country}, {editForm.continent}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!editMode ? (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Edit size={13} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateSubmit}
                      disabled={isUpdating}
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
                      <div key={`${url}-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`${editForm.state || "Destination"} preview ${index + 1}`}
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
                  <p className="text-[12px] text-slate-400 font-pmedium">No images uploaded.</p>
                )}
                {editMode && (
                  <label className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                    Upload Images
                    <input hidden accept="image/*" type="file" multiple onChange={(event) => handleImageUpload(event, "edit")} />
                  </label>
                )}
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Rank</label>
                    <input type="number" disabled value={editForm.rank} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Continent</label>
                    <input type="text" disabled value={editForm.continent} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Country</label>
                    <input type="text" disabled value={editForm.country} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">State / Destination</label>
                    <input type="text" disabled value={editForm.state || getDestinationName(editForm)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Title</label>
                    <input
                      type="text"
                      disabled={!editMode}
                      value={editForm.title}
                      onChange={(event) => handleFormFieldChange("title", event.target.value)}
                      className={editMode
                        ? "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                        : "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed"}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Status</label>
                    <select
                      disabled={!editMode}
                      value={editForm.isActive}
                      onChange={(event) => handleFormFieldChange("isActive", event.target.value)}
                      className={editMode
                        ? "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                        : "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed"}
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
                  {ALGO2_BASE_METRICS.map((metric) => (
                    <div key={metric.field}>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                        {metric.label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!editMode}
                        value={editForm.weight?.[metric.field] ?? ""}
                        onChange={(event) => handleWeightFieldChange(metric.field, event.target.value, "edit")}
                        className={editMode
                          ? "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                          : "w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 disabled:opacity-60 cursor-not-allowed"}
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
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-pmedium shadow-sm shrink-0 bg-[#2563EB] text-white">
                  <Plus size={16} />
                </div>
                <h2 className="text-base lg:text-lg font-pmedium tracking-tight text-slate-800">
                  Add World Ranking Weight (Algo 2.0)
                </h2>
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
                      <div key={`${url}-${index}`} className="relative group">
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-28 object-cover rounded-xl border border-slate-100" />
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
                  Upload Images
                  <input hidden accept="image/*" type="file" multiple onChange={(event) => handleImageUpload(event, "add")} />
                </label>
              </div>

              <div>
                <h3 className="text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Rank</label>
                    <input
                      type="number"
                      value={addForm.rank}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, rank: event.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Continent</label>
                    <select
                      value={addForm.continent}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, continent: event.target.value, country: "", state: "" }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                    >
                      <option value="">None</option>
                      {continents.map((continent) => (
                        <option key={continent} value={continent}>{continent}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Country</label>
                    <select
                      value={addForm.country}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, country: event.target.value, state: "" }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                    >
                      <option value="">None</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">State / Destination</label>
                    <select
                      value={addForm.state}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, state: event.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                    >
                      <option value="">None</option>
                      {states.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Title</label>
                    <input
                      type="text"
                      value={addForm.title}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">Status</label>
                    <select
                      value={addForm.isActive}
                      onChange={(event) => setAddForm((prev) => ({ ...prev, isActive: event.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
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
                  {ALGO2_BASE_METRICS.map((metric) => (
                    <div key={metric.field}>
                      <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                        {metric.label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={addForm.weight?.[metric.field] ?? ""}
                        onChange={(event) => handleWeightFieldChange(metric.field, event.target.value, "add")}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-700 focus:border-[#2563EB] outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-pmedium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSubmit}
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[11px] font-pmedium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Plus size={13} /> {isCreating ? "Adding..." : "Add Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldRankingWeightsV2;
