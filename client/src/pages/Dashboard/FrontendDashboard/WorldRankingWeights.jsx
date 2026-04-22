import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Button, MenuItem, Typography, TextField } from "@mui/material";
import MuiModal from "../../../components/MuiModal";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import { calculateScore, STATEWISE_WEIGHT_FORMULAS } from "../../../utils/weightCalculations";

// const WORLD_RANKING_ENDPOINT =
//   "https://wononomadsbe.vercel.app/api/state-wise-weight";
const WORLD_RANKING_ENDPOINT = "http://localhost:3000/api/state-wise-weight";

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
  return [];
};

const getImageUrlsFromRow = (row = {}) =>
  normalizeImageUrls(
    row?.imageUrls ??
    row?.imageurls ??
    row?.imageURLS ??
    row?.imageUrl ??
    row?.imageurl,
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
  { field: "qualityOfLife", headerName: "Quality of Life", minWidth: 150 },
  { field: "visaFlexibility", headerName: "Visa Flexibility", minWidth: 160 },
  {
    field: "lifestyleEntertainment",
    headerName: "Lifestyle & Entertainment",
    minWidth: 220,
  },
  {
    field: "climateEnvironment",
    headerName: "Climate & Environment",
    minWidth: 190,
  },
  { field: "accessibility", headerName: "Accessibility", minWidth: 140 },
  { field: "airQualityIndex", headerName: "Air Quality Index", minWidth: 160 },
  {
    field: "startupEcosystemScore",
    headerName: "Startup Ecosystem Score",
    minWidth: 210,
  },
  {
    field: "airportConnectivity",
    headerName: "Airport Connectivity",
    minWidth: 190,
  },
  {
    field: "directInternationalFlights",
    headerName: "Direct International Flights",
    minWidth: 230,
  },
  {
    field: "taxFriendly",
    headerName: "Lower Taxes - Tax Friendly",
    minWidth: 220,
  },
  { field: "purchasingPower", headerName: "Purchasing Power", minWidth: 160 },
  {
    field: "inflationStability",
    headerName: "Inflation Stability",
    minWidth: 170,
  },
  {
    field: "startupSetupCost",
    headerName: "Startup Setup Cost",
    minWidth: 170,
  },
  {
    field: "ventureCapital",
    headerName: "Venture Capital Presence",
    minWidth: 190,
  },
  {
    field: "incubators",
    headerName: "Startup Incubators & Accelerators",
    minWidth: 250,
  },
  {
    field: "techTalentDensity",
    headerName: "Tech Talent Density",
    minWidth: 170,
  },
  { field: "conferences", headerName: "Conferences & Events", minWidth: 180 },
  { field: "remoteJobs", headerName: "Remote Job Availability", minWidth: 200 },
  { field: "founderNomads", headerName: "Founder Nomads", minWidth: 150 },
  { field: "meetupsEvents", headerName: "Meetups & Events", minWidth: 160 },
  { field: "soloNomad", headerName: "Solo Nomad Traveller", minWidth: 180 },
  {
    field: "familyNomads",
    headerName: "Family Nomad Traveller",
    minWidth: 190,
  },
  { field: "femaleNomads", headerName: "Girl Nomad Traveller", minWidth: 170 },
  {
    field: "coupleNomads",
    headerName: "Couple Nomad Travelletrs",
    minWidth: 200,
  },
  {
    field: "partyLifestyle",
    headerName: "Party & Events Nomad Traveller",
    minWidth: 250,
  },
  { field: "nature", headerName: "Nature Nomad Travelling", minWidth: 200 },
  {
    field: "adventure",
    headerName: "Adventure Nomad Travelling",
    minWidth: 220,
  },
  { field: "nightlife", headerName: "Nightlife & Pubs", minWidth: 150 },
  { field: "yoga", headerName: "Yoga", minWidth: 100 },
  {
    field: "healthcareCostIndex",
    headerName: "Healthcare Cost Index",
    minWidth: 190,
  },
];

const CALCULATION_CONFIG = [
  { label: "Best For Nomads", formula: "bestForNomads", field: "labelBestForNomads" },
  { label: "Most Affordable", formula: "mostAffordable", field: "labelMostAffordable" },
  { label: "Safest Cities", formula: "safestCities", field: "labelSafestCities" },
  { label: "Easy Visa", formula: "easyVisaLongStay", field: "labelEasyVisa" },
  { label: "Strong Nomad Community", formula: "strongNomadCommunity", field: "labelStrongNomadCommunity" },
  { label: "Healthcare Friendly", formula: "healthcareFriendly", field: "labelHealthcareFriendly" },
  { label: "Startup / Business Opportunities", formula: "startupBusinessOpportunities", field: "labelStartupBusinessOpportunities" },
  { label: "Clean Air / Environment", formula: "cleanAirEnvironment", field: "labelCleanAirEnvironment" },
  { label: "Best Work Infrastructure", formula: "bestWorkInfrastructure", field: "labelBestWorkInfrastructure" },
  { label: "Best For Remote Work Setup", formula: "bestForRemoteWorkSetup", field: "labelBestForRemoteWorkSetup" },
  { label: "Cheapest Places", formula: "cheapestPlaces", field: "labelCheapestPlaces" },
  { label: "Best Connected Cities (Flights)", formula: "bestConnectedCitiesFlights", field: "labelBestConnectedCitiesFlights" },
  { label: "Strong Nomad Community", formula: "strongNomadCommunityWFA", field: "labelStrongNomadCommunityWfa" },
  { label: "Fast Internet Cities", formula: "fastInternetCities", field: "labelFastInternetCities" },
  { label: "Best Work Infrastructure", formula: "bestWorkInfrastructureWFA", field: "labelBestWorkInfrastructureWfa" },
  { label: "Maximum Savings", formula: "maximumSavings", field: "labelMaximumSavings" },
  { label: "Low Taxation", formula: "lowTaxation", field: "labelLowTaxation" },
  { label: "Purchasing Power", formula: "purchasingPower", field: "labelPurchasingPower" },
  { label: "Financial Stability", formula: "financialStabilityLowRisk", field: "labelFinancialStability" },
  { label: "Startup Setup Cost", formula: "startupSetupCost", field: "labelStartupSetupCost" },
  { label: "Balanced Financial Lifestyle", formula: "balancedFinancialLifestyle", field: "labelBalancedFinancialLifestyle" },
  { label: "Social & Party Lifestyle", formula: "socialPartyLifestyle", field: "labelSocialPartyLifestyle" },
  { label: "Chill & Wellness Lifestyle", formula: "chillWellnessLifestyle", field: "labelChillWellnessLifestyle" },
  { label: "Adventure & Exploration", formula: "adventureExploration", field: "labelAdventureExploration" },
  { label: "Nomad Community & Networking", formula: "nomadCommunityNetworking", field: "labelNomadCommunityNetworking" },
  { label: "Couple-Friendly Lifestyle", formula: "coupleFriendlyLifestyle", field: "labelCoupleFriendlyLifestyle" },
  { label: "Family-Friendly Lifestyle", formula: "familyFriendlyLifestyle", field: "labelFamilyFriendlyLifestyle" },
  { label: "Female Friendly Lifestyle", formula: "femaleFriendlyLifestyle", field: "labelFemaleFriendlyLifestyle" },
  { label: "Founder Nomads", formula: "founderNomads", field: "labelFounderNomads" },
  { label: "Solo Nomads", formula: "soloNomads", field: "labelSoloNomads" },
  { label: "Startup Ecosystems", formula: "startupEcosystems", field: "labelStartupEcosystems" },
  { label: "Remote Job Opportunities", formula: "remoteJobOpportunities", field: "labelRemoteJobOpportunities" },
  { label: "Founder Nomads", formula: "founderNomadsAyc", field: "labelFounderNomadsAyc" },
  { label: "Tech Talent Density", formula: "techTalentDensity", field: "labelTechTalentDensity" },
  { label: "Startup Incubators & Accelerators", formula: "startupIncubatorsAndAccelerators", field: "labelStartupIncubatorsAccelerators" },
  { label: "Balanced Career Growth", formula: "balancedCareerGrowth", field: "labelBalancedCareerGrowth" },
  { label: "Venture Capital Presence", formula: "ventureCapitalPresence", field: "labelVentureCapitalPresence" },
  { label: "Conferences & Events", formula: "conferencesAndEvents", field: "labelConferencesEvents" },
];

const SCORE_TO_LABEL_MAP = CALCULATION_CONFIG.reduce((acc, item) => {
  acc[item.formula] = item.field;
  return acc;
}, {});


const labelColumns = [
  {
    field: "labelBestForNomads",
    headerName: "Best For Nomads",
    options: ["Basic", "Strong", "Global Hub"],
  },
  {
    field: "labelMostAffordable",
    headerName: "Most Affordable",
    options: ["Budget", "Mid-Range", "Premium"],
  },
  {
    field: "labelSafestCities",
    headerName: "Safest Cities",
    options: ["Very Safe", "Safe", "Moderate", "Unsafe"],
  },
  {
    field: "labelEasyVisa",
    headerName: "Easy Visa",
    options: ["Easy Stay", "Flexible", "Restricted", "Difficult"],
  },
  {
    field: "labelStrongNomadCommunity",
    headerName: "Strong Nomad Community",
    options: ["Major Hub", "Popular", "Growing", "Limited"],
  },
  {
    field: "labelHealthcareFriendly",
    headerName: "Healthcare Friendly",
    options: ["Excellent", "Good", "Basic", "Limited"],
  },
  {
    field: "labelStartupBusinessOpportunities",
    headerName: "Startup Business Opportunities",
    options: ["High Opportunity", "Emerging Hub", "Moderate", "Limited"],
  },
  {
    field: "labelCleanAirEnvironment",
    headerName: "Clean Air Environment",
    options: ["Very Clean", "Clean", "Moderate", "Poor"],
  },
  {
    field: "labelBestWorkInfrastructure",
    headerName: "Best Work Infrastructure",
    options: ["Top Tier", "Good", "Basic", "Limited"],
  },
  {
    field: "labelCheapestPlaces",
    headerName: "Cheapest Places",
    options: ["Budget", "Affordable", "Mid-Range", "Premium"],
  },
  {
    field: "labelBestForRemoteWorkSetup",
    headerName: "Best For Remote Work Setup",
    options: ["Basic", "Strong", "Global Hub"],
  },
  {
    field: "labelBestConnectedCitiesFlights",
    headerName: "Best Connected Cities Flights",
    options: ["Global Hub", "Well Connected", "Connected", "Isolated"],
  },
  {
    field: "labelStrongNomadCommunityWfa",
    headerName: "Strong Nomad Community Wfa",
    options: ["Nomad Hotspot", "Popular", "Emerging", "Quiet"],
  },
  {
    field: "labelFastInternetCities",
    headerName: "Fast Internet Cities",
    options: ["High-Speed", "Fast", "Reliable", "Slow"],
  },
  {
    field: "labelBestWorkInfrastructureWfa",
    headerName: "Best Work Infrastructure Wfa",
    options: ["Top Tier", "Good", "Basic", "Limited"],
  },
  {
    field: "labelMaximumSavings",
    headerName: "Maximum Savings",
    options: ["High Savings", "Good Savings", "Moderate Savings", "Low Savings"],
  },
  {
    field: "labelLowTaxation",
    headerName: "Low Taxation",
    options: ["Tax Haven", "Tax Efficient", "Moderate Tax", "High Tax"],
  },
  {
    field: "labelPurchasingPower",
    headerName: "Purchasing Power",
    options: ["Exceptional", "High", "Standard", "Low"],
  },
  {
    field: "labelFinancialStability",
    headerName: "Financial Stability",
    options: ["Secure", "Consistent", "Variable", "Unstable"],
  },
  {
    field: "labelStartupSetupCost",
    headerName: "Startup Setup Cost",
    options: ["Affordable", "Moderate", "Expensive", "Premium"],
  },
  {
    field: "labelBalancedFinancialLifestyle",
    headerName: "Balanced Financial Lifestyle",
    options: ["Financial Harmony", "Smart Living", "Balanced Living", "Struggling"],
  },
  {
    field: "labelSocialPartyLifestyle",
    headerName: "Social Party Lifestyle",
    options: ["Party Hub", "Active", "Quiet", "Boring"],
  },
  {
    field: "labelChillWellnessLifestyle",
    headerName: "Chill Wellness Lifestyle",
    options: ["Wellness Haven", "Balanced Living", "Light Retreat", "Stressful"],
  },
  {
    field: "labelAdventureExploration",
    headerName: "Adventure Exploration",
    options: ["Adventure Hub", "Active", "Moderate", "Limited"],
  },
  {
    field: "labelNomadCommunityNetworking",
    headerName: "Nomad Community Networking",
    options: ["Networking Hub", "Well Connected", "Growing Network", "Isolated"],
  },
  {
    field: "labelCoupleFriendlyLifestyle",
    headerName: "Couple Friendly Lifestyle",
    options: ["Ideal", "Friendly", "Suitable", "Difficult"],
  },
  {
    field: "labelFamilyFriendlyLifestyle",
    headerName: "Family Friendly Lifestyle",
    options: ["Ideal", "Friendly", "Suitable", "Difficult"],
  },
  {
    field: "labelFemaleFriendlyLifestyle",
    headerName: "Female Friendly Lifestyle",
    options: [
      "Confident Travel",
      "Comfortable & Safe",
      "Travel Aware",
      "Unsafe",
    ],
  },
  {
    field: "labelFounderNomads",
    headerName: "Founder Nomads",
    options: ["Founder Hub", "Startup Ready", "Rising", "Emerging"],
  },
  {
    field: "labelSoloNomads",
    headerName: "Solo Nomads",
    options: ["Excellent", "Good", "Moderate", "Difficult"],
  },
  {
    field: "labelStartupEcosystems",
    headerName: "Startup Ecosystems",
    options: ["Global Hub", "Emerging", "Moderate", "Limited"],
  },
  {
    field: "labelRemoteJobOpportunities",
    headerName: "Remote Job Opportunities",
    options: ["Global Hub", "Growing", "Moderate", "Limited"],
  },
  {
    field: "labelFounderNomadsAyc",
    headerName: "Founder Nomads Ayc",
    options: ["Global Hub", "Popular", "Emerging", "Limited"],
  },
  {
    field: "labelTechTalentDensity",
    headerName: "Tech Talent Density",
    options: ["Talent Hub", "Tech Dense", "Strong", "Limited"],
  },
  {
    field: "labelStartupIncubatorsAccelerators",
    headerName: "Startup Incubators Accelerators",
    options: ["Launchpad Hub", "Emerging Support", "Well Supported", "Basic"],
  },
  {
    field: "labelBalancedCareerGrowth",
    headerName: "Balanced Career Growth",
    options: ["Career Hub", "Growth City", "Emerging", "Stagnant"],
  },
  {
    field: "labelVentureCapitalPresence",
    headerName: "Venture Capital Presence",
    options: ["Capital Hub", "Strong", "Growing", "Limited"],
  },
  {
    field: "labelConferencesEvents",
    headerName: "Conferences Events",
    options: ["Global Hub", "Active", "Occasional", "Rare"],
  },
];

const SCORE_TO_LABEL_OPTIONS_MAP = labelColumns.reduce((acc, column) => {
  acc[column.field] = column.options?.filter(Boolean) || [];
  return acc;
}, {});

const SCORE_LABEL_RANGES = {
  mostAffordable: [
    { min: 0, max: 7, label: "Premium" },
    { min: 7, max: 8, label: "Mid-Range" },
    { min: 8, max: 10, label: "Budget" },
  ],
};

const getLabelFromScoreRanges = (scoreValue, ranges = []) => {
  const numericScore = Number(scoreValue);
  if (!Number.isFinite(numericScore) || ranges.length === 0) return "";

  const matchedRange = ranges.find((range, index) => {
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;

    const isLastRange = index === ranges.length - 1;
    if (isLastRange) {
      return numericScore >= min && numericScore <= max;
    }

    return numericScore >= min && numericScore < max;
  });

  return matchedRange?.label ?? "";
};

const getLabelFromScore = (scoreValue, options = []) => {
  const numericScore = Number(scoreValue);
  if (!Number.isFinite(numericScore) || options.length === 0) return "";

  const clampedScore = Math.max(0, Math.min(10, numericScore));
  const bucketSize = 10 / options.length;
  const bucketIndex = Math.min(
    options.length - 1,
    Math.floor((10 - clampedScore) / bucketSize),
  );

  return options[bucketIndex] ?? "";
};

const deriveLabelsFromCalculatedScores = (weights, existingLabels = {}) => {
  const nextLabels = { ...existingLabels };

  CALCULATION_CONFIG.forEach((config) => {
    const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
    const labelOptions = SCORE_TO_LABEL_OPTIONS_MAP[config.field] || [];
    if (factors.length === 0 || labelOptions.length === 0) return;

    const calculatedScore = calculateScore(weights, factors);
    const configuredRanges = SCORE_LABEL_RANGES[config.formula] || [];
    const derivedLabel =
      getLabelFromScoreRanges(calculatedScore, configuredRanges) ||
      getLabelFromScore(calculatedScore, labelOptions);
    if (!derivedLabel) return;

    nextLabels[config.field] = derivedLabel;
  });

  return nextLabels;
};


const getInitialForm = (row = {}) => {
  const rowWeights = row?.weight || row?.weights || {};
  const initialForm = {
    id: row?._id ?? "",
    rank: row?.rank ?? "",
    continent: row?.continent ?? "",
    country: row?.country ?? "",
    state: row?.state ?? "",
    isActive:
      row?.isActive === true ? "true" : row?.isActive === false ? "false" : "",
    imageUrls: getImageUrlsFromRow(row),
    imageFile: null,
    weight: {},
    labels: {},
  };

  weightColumns.forEach((column) => {
    initialForm.weight[column.field] =
      rowWeights?.[column.field] ?? row?.[column.field] ?? "";
  });

  const rowLabels = row?.labels || {};
  labelColumns.forEach((column) => {
    initialForm.labels[column.field] =
      rowLabels?.[column.field] ?? row?.[column.field] ?? "";
  });

  return initialForm;
};

const buildPayload = (form) => {
  const normalizedImageUrls = normalizeImageUrls(form.imageUrls);
  const payload = {
    rank: toNumericOrFallback(form.rank, 0),
    continent: form.continent,
    country: form.country,
    state: form.state,
    isActive:
      form.isActive === "true"
        ? true
        : form.isActive === "false"
          ? false
          : form.isActive,
    imageUrls: normalizedImageUrls,
    weight: {},
    labels: {},
  };

  weightColumns.forEach((column) => {
    payload.weight[column.field] = toNumericOrFallback(
      form.weight?.[column.field],
      0,
    );
  });

  labelColumns.forEach((column) => {
    payload.labels[column.field] = form.labels?.[column.field] || "";
  });

  return payload;
};

const WorldRankingWeights = () => {
  const axios = useAxiosPrivate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [addForm, setAddForm] = useState(() => getInitialForm());
  const [editMode, setEditMode] = useState(false);

  const {
    data: rows = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: ["world-ranking-weights"],
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
              (!addForm.continent || c.companyContinent === addForm.continent) &&
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
        data?.message || "World ranking weight updated successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights"] });
      setIsEditOpen(false);
      setEditForm(null);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
        "Failed to update world ranking weight",
      );
    },
  });

  const { mutate: createWeight, isPending: isCreating } = useMutation({
    mutationFn: async (payload) => {
      const response = await axios.post(`${WORLD_RANKING_ENDPOINT}/add`, payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "World ranking weight added successfully");
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights"] });
      setIsAddOpen(false);
      setAddForm(getInitialForm());
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to add world ranking weight",
      );
    },
  });

  const handleOpenEdit = (row) => {
    setEditForm(getInitialForm(row));
    setIsEditOpen(true);
  };

  const handleCloseEditModal = () => {
    if (isUpdating) return;
    setIsEditOpen(false);
    setEditForm(null);
  };

  const handleOpenAddModal = () => {
    const maxRank =
      rows.length > 0
        ? Math.max(...rows.map((r) => Number(r.rank) || 0))
        : 0;
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
      const nextLabels = deriveLabelsFromCalculatedScores(nextWeight, prev.labels);

      return {
        ...prev,
        weight: nextWeight,
        labels: nextLabels,
      };
    });
  };

  const handleLabelFieldChange = (field, value, formType = "edit") => {
    const setForm = formType === "edit" ? setEditForm : setAddForm;
    setForm((prev) => ({
      ...prev,
      labels: {
        ...prev.labels,
        [field]: value,
      },
    }));
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

    if (editForm.imageFile) {
      const formData = new FormData();
      formData.append("rank", String(payload.rank));
      formData.append("continent", payload.continent || "");
      formData.append("country", payload.country || "");
      formData.append("state", payload.state || "");
      formData.append("isActive", String(payload.isActive ?? ""));
      formData.append("imageUrls", JSON.stringify(payload.imageUrls || []));
      formData.append("images", editForm.imageFile);
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
    formData.append("isActive", String(payload.isActive ?? ""));
    formData.append("imageUrls", JSON.stringify(payload.imageUrls || []));
    formData.append("weight", JSON.stringify(payload.weight));
    formData.append("labels", JSON.stringify(payload.labels));

    if (addForm.imageFile) {
      formData.append("images", addForm.imageFile);
    }

    createWeight(formData);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setEditForm((prev) => ({
      ...prev,
      imageUrls: [previewUrl],
      imageFile: file,
    }));
    // toast.success("Image added successfully");
  };

  const handleImageUploadAdd = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAddForm((prev) => ({
      ...prev,
      imageUrls: [previewUrl],
      imageFile: file,
    }));
  };

  useEffect(() => {
    if (!isEditOpen) {
      setEditMode(false);
    }
  }, [isEditOpen]);

  // Track the last blob URL we created so we only revoke it on unmount or modal close
  useEffect(() => {
    return () => {
      // Cleanup on unmount only — prevents premature revocation during re-renders
      const editUrl = editForm?.imageUrls?.[0];
      const addUrl = addForm?.imageUrls?.[0];
      if (editUrl?.startsWith("blob:")) URL.revokeObjectURL(editUrl);
      if (addUrl?.startsWith("blob:")) URL.revokeObjectURL(addUrl);
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

  const columns = useMemo(
    () => [
      {
        field: "srNo",
        headerName: "Sr No",
        width: 90,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "rank",
        headerName: "Rank",
        width: 90,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "state",
        headerName: "State",
        minWidth: 170,
        pinned: "left",
        lockPinned: true,
        suppressMovable: true,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 110,
        pinned: "right",
        lockPinned: true,
        suppressMovable: true,
        cellRenderer: (params) => (
          <ThreeDotMenu
            rowId={
              params?.data?._id || params?.data?.state || params?.data?.srNo
            }
            menuItems={[
              {
                label: "Edit",
                onClick: () => handleOpenEdit(params.data),
              },
            ]}
          />
        ),
      },
      // Weight Columns
      ...weightColumns.map((column) => ({
        ...column,
        valueGetter: (params) =>
          params.data?.weight?.[column.field] ??
          params.data?.weights?.[column.field] ??
          params.data?.[column.field],
        valueFormatter: (params) => fmtNumber(params.value, 2),
      })),
      // Interleaved Score and Label Columns
      ...Object.entries(STATEWISE_WEIGHT_FORMULAS).flatMap(([formulaKey, factors]) => {
        const labelField = SCORE_TO_LABEL_MAP[formulaKey];
        const labelCol = labelColumns.find(c => c.field === labelField);

        return [
          {
            headerName: `${formulaKey} Score`,
            field: `score_${formulaKey}`,
            minWidth: 150,
            valueGetter: (params) => {
              const weights = params.data?.weight || params.data?.weights || params.data || {};
              return calculateScore(weights, factors);
            },
            valueFormatter: (params) => fmtNumber(params.value, 3),
          },
          ...(labelCol ? [{
            ...labelCol,
            valueGetter: (params) =>
              params.data?.labels?.[labelCol.field] ??
              params.data?.[labelCol.field],
          }] : [])
        ];
      })
    ],
    [],
  );

  return (
    <div className="p-4">
      <PageFrame>
        <AgTable
          data={rowData}
          columns={columns}
          search
          tableTitle="World Ranking Weights"
          buttonTitle="Add"
          handleClick={handleOpenAddModal}
          tableHeight={550}
          loading={isPending}
        />
        {isError ? (
          <p className="pt-3 text-sm text-red-500">
            Could not load world ranking data. Please verify World Ranking API
            connectivity.
          </p>
        ) : null}
      </PageFrame>

      <MuiModal
        open={isEditOpen}
        onClose={handleCloseEditModal}
        title={`Edit Weights of ${editForm?.state || ""} State`}
      >
        <Box
          sx={{
            width: "100%",
          }}
        >
          {editForm ? (
            <>
              <Box className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-1 mb-4">
                <Box className="mt-1 mb-4 flex flex-col items-center justify-center">
                  {editForm?.imageUrls?.[0] ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, textAlign: "center" }}
                      >
                        Image Preview
                      </Typography>
                      <Box
                        component="img"
                        src={editForm.imageUrls[0]}
                        alt={`${editForm.state || "State"} preview`}
                        sx={{
                          width: "100%",
                          maxWidth: 360,
                          maxHeight: 220,
                          objectFit: "cover",
                          borderRadius: 1,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    </Box>
                  ) : <p>No image</p>}
                  {editMode ? (
                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" component="label">
                        Upload Image
                        <input
                          hidden
                          accept="image/*"
                          type="file"
                          onChange={handleImageUpload}
                        />
                      </Button>
                    </Box>
                  ) : null}
                </Box>
              </Box>
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 mb-4">
                <TextField
                  label="Rank"
                  type="number"
                  disabled
                  value={editForm.rank}
                  onChange={(event) =>
                    handleFormFieldChange("rank", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Continent"
                  disabled
                  value={editForm.continent}
                  onChange={(event) =>
                    handleFormFieldChange("continent", event.target.value)
                  }
                  fullWidth
                />
              </Box>
              <Box className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1 mb-4">
                <TextField
                  label="Country"
                  disabled
                  value={editForm.country}
                  onChange={(event) =>
                    handleFormFieldChange("country", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="State"
                  disabled
                  value={editForm.state}
                  onChange={(event) =>
                    handleFormFieldChange("state", event.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Status"
                  select
                  value={editForm.isActive}
                  disabled={!editMode}
                  onChange={(event) =>
                    handleFormFieldChange("isActive", event.target.value)
                  }
                  fullWidth
                >
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </TextField>
              </Box>

              <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
                Weights
              </Typography>
              <Box className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-1 mb-4">
                {weightColumns.map((column) => (
                  <TextField
                    key={column.field}
                    label={column.headerName}
                    type="number"
                    disabled={!editMode}
                    value={editForm.weight?.[column.field] ?? ""}
                    onChange={(event) =>
                      handleWeightFieldChange(column.field, event.target.value, "edit")
                    }
                    fullWidth
                    size="small"
                  />
                ))}
              </Box>

              <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
                Calculations & Labels
              </Typography>
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-1 mb-4">
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  Computed Score
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                  Label
                </Typography>

                {CALCULATION_CONFIG.map((config) => {
                  const labelCol = labelColumns.find(
                    (c) => c.field === config.field
                  );
                  const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
                  const currentScore = calculateScore(
                    editForm.weight || {},
                    factors
                  );

                  return (
                    <React.Fragment key={config.formula}>
                      <TextField
                        label={`Score ${config.label}`}
                        value={currentScore}
                        InputProps={{ readOnly: true }}
                        fullWidth
                        size="small"
                        sx={{ bgcolor: "#f9fafb" }}
                      />
                      {labelCol ? (
                        <TextField
                          label={config.field}
                          select
                          disabled={!editMode}
                          value={editForm.labels?.[config.field] ?? ""}
                          onChange={(event) =>
                            handleLabelFieldChange(
                              config.field,
                              event.target.value,
                              "edit"
                            )
                          }
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {labelCol.options?.map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Box />
                      )}
                    </React.Fragment>
                  );
                })}

                {labelColumns
                  .filter(
                    (lc) => !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field)
                  )
                  .map((column) => (
                    <React.Fragment key={column.field}>
                      <Box />
                      <TextField
                        label={column.headerName}
                        select
                        disabled={!editMode}
                        value={editForm.labels?.[column.field] ?? ""}
                        onChange={(event) =>
                          handleLabelFieldChange(
                            column.field,
                            event.target.value,
                            "edit"
                          )
                        }
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {column.options?.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    </React.Fragment>
                  ))}
              </Box>
            </>
          ) : null}

          {editMode ? (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
              <Button onClick={() => setEditMode(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleUpdateSubmit}
                disabled={isUpdating || !editForm}
              >
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
              <Button onClick={() => setEditMode(true)} variant="contained">
                Edit
              </Button>
            </Box>
          )}
        </Box>
      </MuiModal>

      <MuiModal
        open={isAddOpen}
        onClose={handleCloseAddModal}
        title="Add World Ranking Weight"
      >
        <Box sx={{ width: "100%" }}>
          <Box className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-1 mb-4">
            <Box className="mt-1 mb-4 flex flex-col items-center justify-center">
              {addForm.imageUrls?.length > 0 ? (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, textAlign: "center" }}
                  >
                    Image Preview
                  </Typography>
                  <Box
                    component="img"
                    src={addForm.imageUrls[0]}
                    alt={`${addForm.state || "State"} preview`}
                    sx={{
                      width: "100%",
                      maxWidth: 360,
                      maxHeight: 220,
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                </Box>
              ) : null}
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" component="label">
                  Upload Image
                  <input
                    hidden
                    accept="image/*"
                    type="file"
                    onChange={handleImageUploadAdd}
                  />
                </Button>
              </Box>
            </Box>
          </Box>
          <Box className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1 mb-4">
            <TextField
              label="Rank"
              type="number"
              value={addForm.rank}
              onChange={(event) =>
                setAddForm((prev) => ({ ...prev, rank: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Continent"
              select
              value={addForm.continent}
              onChange={(event) =>
                setAddForm((prev) => ({
                  ...prev,
                  continent: event.target.value,
                  country: "",
                  state: "",
                }))
              }
              fullWidth
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {continents.map((continent) => (
                <MenuItem key={continent} value={continent}>
                  {continent}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Country"
              select
              value={addForm.country}
              onChange={(event) =>
                setAddForm((prev) => ({
                  ...prev,
                  country: event.target.value,
                  state: "",
                }))
              }
              fullWidth
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {countries.map((country) => (
                <MenuItem key={country} value={country}>
                  {country}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 mb-4">
            <TextField
              label="State / City"
              select
              value={addForm.state}
              onChange={(event) =>
                setAddForm((prev) => ({ ...prev, state: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {states.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              select
              value={addForm.isActive}
              onChange={(event) =>
                setAddForm((prev) => ({ ...prev, isActive: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>
          </Box>

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            Weights
          </Typography>
          <Box className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-1 mb-4">
            {weightColumns.map((column) => (
              <TextField
                key={column.field}
                label={column.headerName}
                type="number"
                value={addForm.weight?.[column.field] ?? ""}
                onChange={(event) =>
                  handleWeightFieldChange(column.field, event.target.value, "add")
                }
                fullWidth
                size="small"
              />
            ))}
          </Box>

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            Calculations & Labels
          </Typography>
          <Box className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-1 mb-4">
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              Computed Score
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              Label
            </Typography>

            {CALCULATION_CONFIG.map((config) => {
              const labelCol = labelColumns.find((c) => c.field === config.field);
              const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
              const currentScore = calculateScore(addForm.weight || {}, factors);

              return (
                <React.Fragment key={config.formula}>
                  <TextField
                    label={`Score ${config.label}`}
                    value={currentScore}
                    InputProps={{ readOnly: true }}
                    fullWidth
                    size="small"
                    sx={{ bgcolor: "#f9fafb" }}
                  />
                  {labelCol ? (
                    <TextField
                      label={config.field}
                      select
                      value={addForm.labels?.[config.field] ?? ""}
                      onChange={(event) =>
                        handleLabelFieldChange(
                          config.field,
                          event.target.value,
                          "add"
                        )
                      }
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {labelCol.options?.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <Box />
                  )}
                </React.Fragment>
              );
            })}

            {labelColumns
              .filter(
                (lc) => !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field)
              )
              .map((column) => (
                <React.Fragment key={column.field}>
                  <Box />
                  <TextField
                    label={column.headerName}
                    select
                    value={addForm.labels?.[column.field] ?? ""}
                    onChange={(event) =>
                      handleLabelFieldChange(
                        column.field,
                        event.target.value,
                        "add"
                      )
                    }
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {column.options?.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </React.Fragment>
              ))}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
            <Button onClick={handleCloseAddModal} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAddSubmit}
              disabled={isCreating}
            >
              {isCreating ? "Adding..." : "Add"}
            </Button>
          </Box>
        </Box>
      </MuiModal>
    </div>
  );
};

export default WorldRankingWeights;