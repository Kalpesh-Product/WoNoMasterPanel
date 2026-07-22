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
  STATEWISE_WEIGHT_FORMULAS,
} from "../../../utils/weightCalculations";
import { NOMADS_API_BASE_URL } from "../../../constants/api";

const WORLD_RANKING_ENDPOINT = `${NOMADS_API_BASE_URL}/state-wise-weight`;

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
  { field: "visaCost", headerName: "Visa Cost", minWidth: 140 },
  {
    field: "visaRenewalEase",
    headerName: "Visa Renewal Ease",
    minWidth: 180,
  },
  {
    field: "medicalInsuranceEase",
    headerName: "Medical Insurance Ease",
    minWidth: 210,
  },
  {
    field: "internalCommuting",
    headerName: "Internal Commuting",
    minWidth: 180,
  },
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
    field: "localGovernmentSupport",
    headerName: "Local Government Support",
    minWidth: 220,
  },
  {
    field: "ventureCapitalInvestments",
    headerName: "Venture Capital Investments",
    minWidth: 230,
  },
  {
    field: "governmentStartupEvents",
    headerName: "Government Startup Events",
    minWidth: 220,
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
  {
    label: "Best For Nomads",
    formula: "bestForNomads",
    field: "labelBestForNomads",
  },
  {
    label: "Most Affordable",
    formula: "mostAffordable",
    field: "labelMostAffordable",
  },
  {
    label: "Safest Cities",
    formula: "safestCities",
    field: "labelSafestCities",
  },
  { label: "Easy Visa", formula: "easyVisaLongStay", field: "labelEasyVisa" },
  {
    label: "Strong Nomad Community",
    formula: "strongNomadCommunity",
    field: "labelStrongNomadCommunity",
  },
  {
    label: "Healthcare Friendly",
    formula: "healthcareFriendly",
    field: "labelHealthcareFriendly",
  },
  {
    label: "Startup / Business Opportunities",
    formula: "startupBusinessOpportunities",
    field: "labelStartupBusinessOpportunities",
  },
  {
    label: "Clean Air / Environment",
    formula: "cleanAirEnvironment",
    field: "labelCleanAirEnvironment",
  },
  {
    label: "Best Work Infrastructure",
    formula: "bestWorkInfrastructure",
    field: "labelBestWorkInfrastructure",
  },
  {
    label: "Best For Remote Work Setup",
    formula: "bestForRemoteWorkSetup",
    field: "labelBestForRemoteWorkSetup",
  },
  {
    label: "Cheapest Places",
    formula: "cheapestPlaces",
    field: "labelCheapestPlaces",
  },
  {
    label: "Best Connected Cities (Flights)",
    formula: "bestConnectedCitiesFlights",
    field: "labelBestConnectedCitiesFlights",
  },
  {
    label: "Strong Nomad Community",
    formula: "strongNomadCommunityWFA",
    field: "labelStrongNomadCommunityWfa",
  },
  {
    label: "Fast Internet Cities",
    formula: "fastInternetCities",
    field: "labelFastInternetCities",
  },
  {
    label: "Best Work Infrastructure",
    formula: "bestWorkInfrastructureWFA",
    field: "labelBestWorkInfrastructureWfa",
  },
  {
    label: "Maximum Savings",
    formula: "maximumSavings",
    field: "labelMaximumSavings",
  },
  { label: "Low Taxation", formula: "lowTaxation", field: "labelLowTaxation" },
  {
    label: "Purchasing Power",
    formula: "purchasingPower",
    field: "labelPurchasingPower",
  },
  {
    label: "Financial Stability",
    formula: "financialStabilityLowRisk",
    field: "labelFinancialStability",
  },
  {
    label: "Startup Setup Cost",
    formula: "startupSetupCost",
    field: "labelStartupSetupCost",
  },
  {
    label: "Balanced Financial Lifestyle",
    formula: "balancedFinancialLifestyle",
    field: "labelBalancedFinancialLifestyle",
  },
  {
    label: "Social & Party Lifestyle",
    formula: "socialPartyLifestyle",
    field: "labelSocialPartyLifestyle",
  },
  {
    label: "Chill & Wellness Lifestyle",
    formula: "chillWellnessLifestyle",
    field: "labelChillWellnessLifestyle",
  },
  {
    label: "Adventure & Exploration",
    formula: "adventureExploration",
    field: "labelAdventureExploration",
  },
  {
    label: "Nomad Community & Networking",
    formula: "nomadCommunityNetworking",
    field: "labelNomadCommunityNetworking",
  },
  {
    label: "Couple-Friendly Lifestyle",
    formula: "coupleFriendlyLifestyle",
    field: "labelCoupleFriendlyLifestyle",
  },
  {
    label: "Family-Friendly Lifestyle",
    formula: "familyFriendlyLifestyle",
    field: "labelFamilyFriendlyLifestyle",
  },
  {
    label: "Female Friendly Lifestyle",
    formula: "femaleFriendlyLifestyle",
    field: "labelFemaleFriendlyLifestyle",
  },
  {
    label: "Founder Nomads",
    formula: "founderNomads",
    field: "labelFounderNomads",
  },
  { label: "Solo Nomads", formula: "soloNomads", field: "labelSoloNomads" },
  {
    label: "Startup Ecosystems",
    formula: "startupEcosystems",
    field: "labelStartupEcosystems",
  },
  {
    label: "Remote Job Opportunities",
    formula: "remoteJobOpportunities",
    field: "labelRemoteJobOpportunities",
  },
  {
    label: "Founder Nomads",
    formula: "founderNomadsAyc",
    field: "labelFounderNomadsAyc",
  },
  {
    label: "Tech Talent Density",
    formula: "techTalentDensity",
    field: "labelTechTalentDensity",
  },
  {
    label: "Startup Incubators & Accelerators",
    formula: "startupIncubatorsAndAccelerators",
    scoreField: "startupIncubatorsAccelerators",
    field: "labelStartupIncubatorsAccelerators",
  },
  {
    label: "Balanced Career Growth",
    formula: "balancedCareerGrowth",
    field: "labelBalancedCareerGrowth",
  },
  {
    label: "Venture Capital Presence",
    formula: "ventureCapitalPresence",
    field: "labelVentureCapitalPresence",
  },
  {
    label: "Conferences & Events",
    formula: "conferencesAndEvents",
    scoreField: "conferencesEvents",
    field: "labelConferencesEvents",
  },
];

const SCORE_TO_LABEL_MAP = CALCULATION_CONFIG.reduce((acc, item) => {
  acc[item.formula] = item.field;
  return acc;
}, {});

const labelColumns = [
  {
    field: "labelBestForNomads",
    headerName: "Best For Nomads",
    options: ["Challenging", "Decent", "Very Good", "Excellent", "Elite"],
  },
  {
    field: "labelMostAffordable",
    headerName: "Most Affordable",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelSafestCities",
    headerName: "Safest Cities",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelEasyVisa",
    headerName: "Easy Visa",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStrongNomadCommunity",
    headerName: "Strong Nomad Community",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelHealthcareFriendly",
    headerName: "Healthcare Friendly",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStartupBusinessOpportunities",
    headerName: "Startup Business Opportunities",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelCleanAirEnvironment",
    headerName: "Clean Air Environment",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBestWorkInfrastructure",
    headerName: "Best Work Infrastructure",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelCheapestPlaces",
    headerName: "Cheapest Places",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBestForRemoteWorkSetup",
    headerName: "Best For Remote Work Setup",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBestConnectedCitiesFlights",
    headerName: "Best Connected Cities Flights",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStrongNomadCommunityWfa",
    headerName: "Strong Nomad Community Wfa",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFastInternetCities",
    headerName: "Fast Internet Cities",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBestWorkInfrastructureWfa",
    headerName: "Best Work Infrastructure Wfa",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelMaximumSavings",
    headerName: "Maximum Savings",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelLowTaxation",
    headerName: "Low Taxation",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelPurchasingPower",
    headerName: "Purchasing Power",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFinancialStability",
    headerName: "Financial Stability",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStartupSetupCost",
    headerName: "Startup Setup Cost",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBalancedFinancialLifestyle",
    headerName: "Balanced Financial Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelSocialPartyLifestyle",
    headerName: "Social Party Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelChillWellnessLifestyle",
    headerName: "Chill Wellness Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelAdventureExploration",
    headerName: "Adventure Exploration",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelNomadCommunityNetworking",
    headerName: "Nomad Community Networking",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelCoupleFriendlyLifestyle",
    headerName: "Couple Friendly Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFamilyFriendlyLifestyle",
    headerName: "Family Friendly Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFemaleFriendlyLifestyle",
    headerName: "Female Friendly Lifestyle",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFounderNomads",
    headerName: "Founder Nomads",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelSoloNomads",
    headerName: "Solo Nomads",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStartupEcosystems",
    headerName: "Startup Ecosystems",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelRemoteJobOpportunities",
    headerName: "Remote Job Opportunities",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelFounderNomadsAyc",
    headerName: "Founder Nomads Ayc",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelTechTalentDensity",
    headerName: "Tech Talent Density",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelStartupIncubatorsAccelerators",
    headerName: "Startup Incubators Accelerators",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelBalancedCareerGrowth",
    headerName: "Balanced Career Growth",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelVentureCapitalPresence",
    headerName: "Venture Capital Presence",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
  {
    field: "labelConferencesEvents",
    headerName: "Conferences Events",
    options: [
      "Challenging",
      "Decent",
      "Very Good",
      "Excellent",
      "Elite",
    ],
  },
];

const SCORE_TO_LABEL_OPTIONS_MAP = labelColumns.reduce((acc, column) => {
  acc[column.field] = column.options?.filter(Boolean) || [];
  return acc;
}, {});

const SCORE_LABEL_RANGES = {
  bestForNomads: [
    { min: 0, max: 7.5, label: "Challenging" },
    { min: 7.5, max: 7.8, label: "Decent" },
    { min: 7.8, max: 8, label: "Very Good" },
    { min: 8, max: 8.2, label: "Excellent" },
    { min: 8.2, max: 10, label: "Elite" },
  ],
  mostAffordable: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.8, label: "Decent" },
    { min: 7.8, max: 8, label: "Very Good" },
    { min: 8, max: 8.2, label: "Excellent" },
    { min: 8.2, max: 10, label: "Elite" },
  ],
  safestCities: [
    { min: 0, max: 7.5, label: "Challenging" },
    { min: 7.5, max: 7.8, label: "Decent" },
    { min: 7.8, max: 8, label: "Very Good" },
    { min: 8, max: 8.2, label: "Excellent" },
    { min: 8.2, max: 10, label: "Elite" },
  ],
  easyVisaLongStay: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8.06, label: "Very Good" },
    { min: 8.06, max: 8.36, label: "Excellent" },
    { min: 8.36, max: 10, label: "Elite" },
  ],
  strongNomadCommunity: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8.06, label: "Very Good" },
    { min: 8.06, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  healthcareFriendly: [
    { min: 0, max: 7.5, label: "Challenging" },
    { min: 7.5, max: 7.8, label: "Decent" },
    { min: 7.8, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  startupBusinessOpportunities: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  cleanAirEnvironment: [
    { min: 0, max: 6.5, label: "Challenging" },
    { min: 6.5, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  bestWorkInfrastructure: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  bestForRemoteWorkSetup: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  cheapestPlaces: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.3, label: "Excellent" },
    { min: 8.3, max: 10, label: "Elite" },
  ],
  bestConnectedCitiesFlights: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  strongNomadCommunityWfa: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  fastInternetCities: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  bestWorkInfrastructureWfa: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  maximumSavings: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  lowTaxation: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  purchasingPower: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  financialStability: [
    { min: 0, max: 6.5, label: "Challenging" },
    { min: 6.5, max: 7, label: "Decent" },
    { min: 7, max: 7.5, label: "Very Good" },
    { min: 7.5, max: 8, label: "Excellent" },
    { min: 8, max: 10, label: "Elite" },
  ],
  startupSetupCost: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  balancedFinancialLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  socialPartyLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  chillWellnessLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  adventureExploration: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  nomadCommunityNetworking: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  coupleFriendlyLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  familyFriendlyLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  femaleFriendlyLifestyle: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  founderNomads: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  soloNomads: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  startupEcosystems: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  remoteJobOpportunities: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  founderNomadsAyc: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  techTalentDensity: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  startupIncubatorsAndAccelerators: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  balancedCareerGrowth: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  ventureCapitalPresence: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
  ],
  conferencesAndEvents: [
    { min: 0, max: 7, label: "Challenging" },
    { min: 7, max: 7.5, label: "Decent" },
    { min: 7.5, max: 8, label: "Very Good" },
    { min: 8, max: 8.5, label: "Excellent" },
    { min: 8.5, max: 10, label: "Elite" },
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

const deriveCalculatedScores = (weights = {}) =>
  Object.fromEntries(
    CALCULATION_CONFIG.map((config) => {
      const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
      return [
        config.scoreField || config.formula,
        calculateScore(weights, factors),
      ];
    }),
  );

const getCalculatedScoreValue = (form, config) => {
  const scoreKeys = [config.scoreField, config.formula].filter(Boolean);

  for (const scoreKey of scoreKeys) {
    const scoreValue = form?.calculatedScores?.[scoreKey];
    if (scoreValue !== undefined && scoreValue !== null && scoreValue !== "") {
      return scoreValue;
    }
  }

  const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
  return calculateScore(form?.weight || {}, factors);
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
    labels: {},
    calculatedScores: row?.calculatedScores || {},
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

  if (!row?.calculatedScores) {
    initialForm.calculatedScores = deriveCalculatedScores(initialForm.weight);
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
  const [search, setSearch] = useState("");

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
      const response = await axios.post(
        `${WORLD_RANKING_ENDPOINT}/add`,
        payload,
      );
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.message || "World ranking weight added successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["world-ranking-weights"] });
      setIsAddOpen(false);
      setAddForm(getInitialForm());
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message ||
          "Failed to add world ranking weight",
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
      const nextLabels = deriveLabelsFromCalculatedScores(
        nextWeight,
        prev.labels,
      );

      return {
        ...prev,
        weight: nextWeight,
        calculatedScores: nextCalculatedScores,
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
      formData.append("labels", JSON.stringify(payload.labels));

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
    formData.append("labels", JSON.stringify(payload.labels));

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

  if (isPending) {
    return (
      <div className="p-2 lg:p-2.5 min-h-full text-[#0F172A] font-sans text-[12px]">
        <PageFrame>
          <div className="flex flex-col gap-4">
            <div className="mb-3 flex flex-col md:flex-row justify-between items-start md:items-end gap-1.5">
              <div>
                <h2 className="text-title font-pmedium text-primary uppercase flex items-center gap-1.5">
                  World Ranking Weights
                </h2>
                <p className="text-xs font-pmedium text-slate-500 mt-1">
                  Manage country and state rankings with weight configurations.
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
                World Ranking Weights
              </h2>
              <p className="text-xs font-pmedium text-slate-500 mt-1">
                Manage country and state rankings with weight configurations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
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
                <div className="relative flex-1 max-w-sm">
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
                  Could not load world ranking data.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Please verify World Ranking API connectivity.
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
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-slate-50/50 text-[10px] font-pmedium text-slate-500 uppercase tracking-widest border-b border-slate-100/60">
                    <tr>
                      <th className="px-5 py-4">#</th>
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">State</th>
                      <th className="px-5 py-4">Country</th>
                      <th className="px-5 py-4">Title</th>
                      <th className="px-5 py-4 text-center">Status</th>
                      <th className="px-5 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {filteredRows.map((row) => {
                      const isActive =
                        row.isActive === true || row.isActive === "true";
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
                              >
                                <Eye size={15} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(row, true)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit size={15} strokeWidth={2.5} />
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
                    Edit Weights : {editForm.state || ""}
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
                  Weights
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
                  Calculations & Labels
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CALCULATION_CONFIG.map((config) => {
                    const labelCol = labelColumns.find(
                      (c) => c.field === config.field,
                    );
                    const currentScore = getCalculatedScoreValue(
                      editForm,
                      config,
                    );
                    return (
                      <div
                        key={config.formula}
                        className="flex items-end gap-2"
                      >
                        <div className="flex-1">
                          <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                            Score {config.label}
                          </label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={fmtNumber(currentScore, 3)}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-500"
                          />
                        </div>
                        {labelCol && (
                          <div className="flex-1">
                            <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                              {labelCol.headerName}
                            </label>
                            <select
                              disabled
                              value={editForm.labels?.[config.field] ?? ""}
                              onChange={(e) =>
                                handleLabelFieldChange(
                                  config.field,
                                  e.target.value,
                                  "edit",
                                )
                              }
                              className={selectDisabledCls}
                            >
                              <option value="">None</option>
                              {labelCol.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {labelColumns
                    .filter(
                      (lc) =>
                        !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field),
                    )
                    .map((column) => (
                      <div
                        key={column.field}
                        className="flex items-end gap-2"
                      >
                        <div className="flex-1" />
                        <div className="flex-1">
                          <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                            {column.headerName}
                          </label>
                          <select
                            disabled={!editMode}
                            value={editForm.labels?.[column.field] ?? ""}
                            onChange={(e) =>
                              handleLabelFieldChange(
                                column.field,
                                e.target.value,
                                "edit",
                              )
                            }
                            className={editMode ? selectCls : selectDisabledCls}
                          >
                            <option value="">None</option>
                            {column.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                </div>
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
                    Add World Ranking Weight
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
                  Weights
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
                  Calculations & Labels
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CALCULATION_CONFIG.map((config) => {
                    const labelCol = labelColumns.find(
                      (c) => c.field === config.field,
                    );
                    const currentScore = getCalculatedScoreValue(
                      addForm,
                      config,
                    );
                    return (
                      <div
                        key={config.formula}
                        className="flex items-end gap-2"
                      >
                        <div className="flex-1">
                          <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                            Score {config.label}
                          </label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={fmtNumber(currentScore, 3)}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200/60 rounded-xl text-[12px] font-pmedium text-slate-500"
                          />
                        </div>
                        {labelCol && (
                          <div className="flex-1">
                            <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                              {labelCol.headerName}
                            </label>
                            <select
                              disabled
                              value={addForm.labels?.[config.field] ?? ""}
                              onChange={(e) =>
                                handleLabelFieldChange(
                                  config.field,
                                  e.target.value,
                                  "add",
                                )
                              }
                              className={selectDisabledCls}
                            >
                              <option value="">None</option>
                              {labelCol.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {labelColumns
                    .filter(
                      (lc) =>
                        !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field),
                    )
                    .map((column) => (
                      <div
                        key={column.field}
                        className="flex items-end gap-2"
                      >
                        <div className="flex-1" />
                        <div className="flex-1">
                          <label className="block text-[10px] font-pmedium text-slate-500 uppercase tracking-widest mb-1">
                            {column.headerName}
                          </label>
                          <select
                            value={addForm.labels?.[column.field] ?? ""}
                            onChange={(e) =>
                              handleLabelFieldChange(
                                column.field,
                                e.target.value,
                                "add",
                              )
                            }
                            className={selectCls}
                          >
                            <option value="">None</option>
                            {column.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                </div>
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

export default WorldRankingWeights;