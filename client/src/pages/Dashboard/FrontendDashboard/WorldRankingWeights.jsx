import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Typography,
  TextField,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MuiModal from "../../../components/MuiModal";
import { toast } from "sonner";
import AgTable from "../../../components/AgTable";
import PageFrame from "../../../components/Pages/PageFrame";
import ThreeDotMenu from "../../../components/ThreeDotMenu";
import useAxiosPrivate from "../../../hooks/useAxiosPrivate";
import { queryClient } from "../../../main";
import {
  calculateScore,
  STATEWISE_WEIGHT_FORMULAS,
} from "../../../utils/weightCalculations";

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

const MAX_IMAGES = 3;

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
    options: ["Basic", "Strong", "Global Hub"],
  },
  {
    field: "labelMostAffordable",
    headerName: "Most Affordable",
    options: ["Budget-friendly", "Mid-Range", "Premium"],
  },
  {
    field: "labelSafestCities",
    headerName: "Safest Cities",
    options: ["Very Safe", "Safe", "Moderate"],
  },
  {
    field: "labelEasyVisa",
    headerName: "Easy Visa",
    options: ["Easy Stay", "Flexible", "Restricted"],
  },
  {
    field: "labelStrongNomadCommunity",
    headerName: "Strong Nomad Community",
    options: ["Major Hub", "Popular", "Growing"],
  },
  {
    field: "labelHealthcareFriendly",
    headerName: "Healthcare Friendly",
    options: ["Excellent", "Good", "Basic"],
  },
  {
    field: "labelStartupBusinessOpportunities",
    headerName: "Startup Business Opportunities",
    options: ["High Opportunity", "Emerging Hub", "Limited"],
  },
  {
    field: "labelCleanAirEnvironment",
    headerName: "Clean Air Environment",
    options: ["Very Clean", "Clean", "Moderate"],
  },
  {
    field: "labelBestWorkInfrastructure",
    headerName: "Best Work Infrastructure",
    options: ["Top Tier", "Good", "Basic"],
  },
  {
    field: "labelCheapestPlaces",
    headerName: "Cheapest Places",
    options: ["Budget", "Mid-Range", "Premium"],
  },
  {
    field: "labelBestForRemoteWorkSetup",
    headerName: "Best For Remote Work Setup",
    options: ["Basic", "Strong", "Global Hub"],
  },
  {
    field: "labelBestConnectedCitiesFlights",
    headerName: "Best Connected Cities Flights",
    options: ["Global Hub", "Well Connected", "Accessible"],
  },
  {
    field: "labelStrongNomadCommunityWfa",
    headerName: "Strong Nomad Community Wfa",
    options: ["Nomad Hotspot", "Popular", "Emerging"],
  },
  {
    field: "labelFastInternetCities",
    headerName: "Fast Internet Cities",
    options: ["High-Speed", "Fast", "Reliable"],
  },
  {
    field: "labelBestWorkInfrastructureWfa",
    headerName: "Best Work Infrastructure Wfa",
    options: ["Top Tier", "Good", "Basic"],
  },
  {
    field: "labelMaximumSavings",
    headerName: "Maximum Savings",
    options: ["High Savings", "Good Savings", "Moderate Savings"],
  },
  {
    field: "labelLowTaxation",
    headerName: "Low Taxation",
    options: ["Tax Haven", "Tax Efficient", "Moderate Tax"],
  },
  {
    field: "labelPurchasingPower",
    headerName: "Purchasing Power",
    options: ["Exceptional", "High", "Standard"],
  },
  {
    field: "labelFinancialStability",
    headerName: "Financial Stability",
    options: ["Secure", "Consistent", "Variable"],
  },
  {
    field: "labelStartupSetupCost",
    headerName: "Startup Setup Cost",
    options: ["Efficient", "Affordable", "Moderate"],
  },
  {
    field: "labelBalancedFinancialLifestyle",
    headerName: "Balanced Financial Lifestyle",
    options: ["Financial Harmony", "Smart Living", "Balanced Living"],
  },
  {
    field: "labelSocialPartyLifestyle",
    headerName: "Social Party Lifestyle",
    options: ["Party Hub", "Active", "Quiet"],
  },
  {
    field: "labelChillWellnessLifestyle",
    headerName: "Chill Wellness Lifestyle",
    options: ["Wellness Haven", "Balanced Living", "Light Retreat"],
  },
  {
    field: "labelAdventureExploration",
    headerName: "Adventure Exploration",
    options: ["Adventure Hub", "Moderate", "Limited"],
  },
  {
    field: "labelNomadCommunityNetworking",
    headerName: "Nomad Community Networking",
    options: ["Networking Hub", "Well Connected", "Growing Network"],
  },
  {
    field: "labelCoupleFriendlyLifestyle",
    headerName: "Couple Friendly Lifestyle",
    options: ["Ideal", "Friendly", "Suitable"],
  },
  {
    field: "labelFamilyFriendlyLifestyle",
    headerName: "Family Friendly Lifestyle",
    options: ["Ideal", "Friendly", "Suitable"],
  },
  {
    field: "labelFemaleFriendlyLifestyle",
    headerName: "Female Friendly Lifestyle",
    options: ["Confident Travel", "Comfortable & Safe", "Travel Aware"],
  },
  {
    field: "labelFounderNomads",
    headerName: "Founder Nomads",
    options: ["Founder Hub", "Startup Ready", "Rising"],
  },
  {
    field: "labelSoloNomads",
    headerName: "Solo Nomads",
    options: ["Excellent", "Good", "Moderate"],
  },
  {
    field: "labelStartupEcosystems",
    headerName: "Startup Ecosystems",
    options: ["Global Hub", "Startup Ready", "Emerging"],
  },
  {
    field: "labelRemoteJobOpportunities",
    headerName: "Remote Job Opportunities",
    options: ["Global Hub", "Moderate", "Limited"],
  },
  {
    field: "labelFounderNomadsAyc",
    headerName: "Founder Nomads Ayc",
    options: ["Global Hub", "Strong", "Growing"],
  },
  {
    field: "labelTechTalentDensity",
    headerName: "Tech Talent Density",
    options: ["Talent Hub", "Tech Dense", "Emerging"],
  },
  {
    field: "labelStartupIncubatorsAccelerators",
    headerName: "Startup Incubators Accelerators",
    options: ["Launchpad Hub", "Emerging Support", "Well Supported"],
  },
  {
    field: "labelBalancedCareerGrowth",
    headerName: "Balanced Career Growth",
    options: ["Career Hub", "Growth City", "Emerging"],
  },
  {
    field: "labelVentureCapitalPresence",
    headerName: "Venture Capital Presence",
    options: ["Capital Hub", "Strong", "Emerging"],
  },
  {
    field: "labelConferencesEvents",
    headerName: "Conferences Events",
    options: ["Global Hub", "Active", "Occasional"],
  },
];

const SCORE_TO_LABEL_OPTIONS_MAP = labelColumns.reduce((acc, column) => {
  acc[column.field] = column.options?.filter(Boolean) || [];
  return acc;
}, {});

const SCORE_LABEL_RANGES = {
  bestForNomads: [
    { min: 0, max: 7, label: "Basic" },
    { min: 7, max: 8, label: "Strong" },
    { min: 8, max: 10, label: "Global Hub" },
  ],
  mostAffordable: [
    { min: 0, max: 7, label: "Premium" },
    { min: 7, max: 8, label: "Mid-Range" },
    { min: 8, max: 10, label: "Budget-friendly" },
  ],
  safestCities: [
    { min: 0, max: 7, label: "Moderate" },
    { min: 7, max: 8, label: "Safe" },
    { min: 8, max: 10, label: "Very Safe" },
  ],
  easyVisaLongStay: [
    { min: 0, max: 7, label: "Restricted" },
    { min: 7, max: 8, label: "Flexible" },
    { min: 8, max: 10, label: "Easy Stay" },
  ],
  strongNomadCommunity: [
    { min: 0, max: 7.5, label: "Growing" },
    { min: 7.5, max: 8.5, label: "Popular" },
    { min: 8.5, max: 10, label: "Major Hub" },
  ],
  healthcareFriendly: [
    { min: 0, max: 7, label: "Basic" },
    { min: 7, max: 8, label: "Good" },
    { min: 8, max: 10, label: "Excellent" },
  ],
  startupBusinessOpportunities: [
    { min: 0, max: 7, label: "Limited" },
    { min: 7, max: 8, label: "Emerging Hub" },
    { min: 8, max: 10, label: "High Opportunity" },
  ],
  cleanAirEnvironment: [
    { min: 0, max: 7, label: "Moderate" },
    { min: 7, max: 8, label: "Clean" },
    { min: 8, max: 10, label: "Very Clean" },
  ],
  bestWorkInfrastructure: [
    { min: 0, max: 7, label: "Basic" },
    { min: 7, max: 8, label: "Good" },
    { min: 8, max: 10, label: "Top Tier" },
  ],
  bestForRemoteWorkSetup: [
    { min: 0, max: 7, label: "Basic" },
    { min: 7, max: 8, label: "Strong" },
    { min: 8, max: 10, label: "Global Hub" },
  ],
  cheapestPlaces: [
    { min: 0, max: 7, label: "Premium" },
    { min: 7, max: 8, label: "Mid-Range" },
    { min: 8, max: 10, label: "Budget" },
  ],
  bestConnectedCitiesFlights: [
    { min: 0, max: 7.5, label: "Accessible" },
    { min: 7.5, max: 8.5, label: "Well Connected" },
    { min: 8.5, max: 10, label: "Global Hub" },
  ],
  strongNomadCommunityWfa: [
    { min: 0, max: 7.5, label: "Emerging" },
    { min: 7.5, max: 8.5, label: "Popular" },
    { min: 8.5, max: 10, label: "Nomad Hotspot" },
  ],
  fastInternetCities: [
    { min: 0, max: 7.5, label: "Reliable" },
    { min: 7.5, max: 8.5, label: "Fast" },
    { min: 8.5, max: 10, label: "High Speed" },
  ],
  bestWorkInfrastructureWfa: [
    { min: 0, max: 7.5, label: "Basic" },
    { min: 7.5, max: 8.5, label: "Good" },
    { min: 8.5, max: 10, label: "Top Tier" },
  ],
  maximumSavings: [
    { min: 0, max: 7, label: "Moderate Savings" },
    { min: 7, max: 8, label: "Good Savings" },
    { min: 8, max: 10, label: "High Savings" },
  ],
  lowTaxation: [
    { min: 0, max: 7.5, label: "Moderate Tax" },
    { min: 7.5, max: 8.5, label: "Tax Efficient" },
    { min: 8.5, max: 10, label: "Tax Haven" },
  ],
  purchasingPower: [
    { min: 0, max: 7, label: "Standard" },
    { min: 7, max: 8, label: "High" },
    { min: 8, max: 10, label: "Exceptional" },
  ],
  financialStability: [
    { min: 0, max: 7, label: "Variable" },
    { min: 7, max: 8, label: "Consistent" },
    { min: 8, max: 10, label: "Secure" },
  ],
  startupSetupCost: [
    { min: 0, max: 7, label: "Moderate" },
    { min: 7, max: 8, label: "Affordable" },
    { min: 8, max: 10, label: "Efficient" },
  ],
  balancedFinancialLifestyle: [
    { min: 0, max: 7, label: "Balanced Living" },
    { min: 7, max: 8, label: "Smart Living" },
    { min: 8, max: 10, label: "Financial Harmony" },
  ],
  socialPartyLifestyle: [
    { min: 0, max: 7.5, label: "Quiet" },
    { min: 7.5, max: 8.5, label: "Active" },
    { min: 8.5, max: 10, label: "Party Hub" },
  ],
  chillWellnessLifestyle: [
    { min: 0, max: 7.5, label: "Light Retreat" },
    { min: 7.5, max: 8.5, label: "Balanced Living" },
    { min: 8.5, max: 10, label: "Wellness Haven" },
  ],
  adventureExploration: [
    { min: 0, max: 7.5, label: "Limited" },
    { min: 7.5, max: 8.5, label: "Moderate" },
    { min: 8.5, max: 10, label: "Adventure Hub" },
  ],
  nomadCommunityNetworking: [
    { min: 0, max: 7.5, label: "Growing Network" },
    { min: 7.5, max: 8.5, label: "Well Connected" },
    { min: 8.5, max: 10, label: "Networking Hub" },
  ],
  coupleFriendlyLifestyle: [
    { min: 0, max: 7.5, label: "Suitable" },
    { min: 7.5, max: 8.5, label: "Friendly" },
    { min: 8.5, max: 10, label: "Ideal" },
  ],
  familyFriendlyLifestyle: [
    { min: 0, max: 7.5, label: "Suitable" },
    { min: 7.5, max: 8.5, label: "Friendly" },
    { min: 8.5, max: 10, label: "Ideal" },
  ],
  femaleFriendlyLifestyle: [
    { min: 0, max: 7.5, label: "Travel Aware" },
    { min: 7.5, max: 8.5, label: "Comfortable & Safe" },
    { min: 8.5, max: 10, label: "Confident Travel" },
  ],
  founderNomads: [
    { min: 0, max: 7.5, label: "Rising" },
    { min: 7.5, max: 8.5, label: "Startup Ready" },
    { min: 8.5, max: 10, label: "Founder Hub" },
  ],
  soloNomads: [
    { min: 0, max: 7.5, label: "Moderate" },
    { min: 7.5, max: 8.5, label: "Good" },
    { min: 8.5, max: 10, label: "Excellent" },
  ],
  startupEcosystems: [
    { min: 0, max: 7.5, label: "Emerging" },
    { min: 7.5, max: 8.5, label: "Startup Ready" },
    { min: 8.5, max: 10, label: "Global Hub" },
  ],
  remoteJobOpportunities: [
    { min: 0, max: 7.5, label: "Limited" },
    { min: 7.5, max: 8.5, label: "Moderate" },
    { min: 8.5, max: 10, label: "Global Hub" },
  ],
  founderNomadsAyc: [
    { min: 0, max: 7.5, label: "Growing" },
    { min: 7.5, max: 8.5, label: "Strong" },
    { min: 8, max: 10, label: "Global Hub" },
  ],
  techTalentDensity: [
    { min: 0, max: 7.5, label: "Emerging" },
    { min: 7.5, max: 8.5, label: "Tech Dense" },
    { min: 8.5, max: 10, label: "Talent Hub" },
  ],
  startupIncubatorsAndAccelerators: [
    { min: 0, max: 7.5, label: "Emerging Support" },
    { min: 7.5, max: 8.5, label: "Well Supported" },
    { min: 8.5, max: 10, label: "Launchpad Hub" },
  ],
  balancedCareerGrowth: [
    { min: 0, max: 7.5, label: "Emerging" },
    { min: 7.5, max: 8.5, label: "Growth City" },
    { min: 8.5, max: 10, label: "Career Hub" },
  ],
  ventureCapitalPresence: [
    { min: 0, max: 7.5, label: "Emerging" },
    { min: 7.5, max: 8.5, label: "Strong" },
    { min: 8.5, max: 10, label: "Capital Hub" },
  ],
  conferencesAndEvents: [
    { min: 0, max: 7.5, label: "Occasional" },
    { min: 7.5, max: 8.5, label: "Active" },
    { min: 8.5, max: 10, label: "Global Hub" },
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
    imageFiles: [],
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
  const normalizedImageUrls = normalizeImageUrls(form.imageUrls).filter(
    (url) => !url.startsWith("blob:"),
  );
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
      const nextLabels = deriveLabelsFromCalculatedScores(
        nextWeight,
        prev.labels,
      );

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

    if (editForm.imageFiles?.length) {
      const formData = new FormData();
      formData.append("rank", String(payload.rank));
      formData.append("continent", payload.continent || "");
      formData.append("country", payload.country || "");
      formData.append("state", payload.state || "");
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

  // Track the last blob URL we created so we only revoke it on unmount or modal close
  useEffect(() => {
    return () => {
      // Cleanup on unmount only — prevents premature revocation during re-renders
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
      ...Object.entries(STATEWISE_WEIGHT_FORMULAS).flatMap(
        ([formulaKey, factors]) => {
          const labelField = SCORE_TO_LABEL_MAP[formulaKey];
          const labelCol = labelColumns.find((c) => c.field === labelField);

          return [
            {
              headerName: `${formulaKey} Score`,
              field: `score_${formulaKey}`,
              minWidth: 150,
              valueGetter: (params) => {
                const weights =
                  params.data?.weight ||
                  params.data?.weights ||
                  params.data ||
                  {};
                return calculateScore(weights, factors);
              },
              valueFormatter: (params) => fmtNumber(params.value, 3),
            },
            ...(labelCol
              ? [
                  {
                    ...labelCol,
                    valueGetter: (params) =>
                      params.data?.labels?.[labelCol.field] ??
                      params.data?.[labelCol.field],
                  },
                ]
              : []),
          ];
        },
      ),
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
                  {editForm?.imageUrls?.length > 0 ? (
                    <Box sx={{ mt: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, textAlign: "center" }}
                      >
                        Image Preview ({editForm.imageUrls.length}/{MAX_IMAGES})
                      </Typography>
                      <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {editForm.imageUrls.map((url, index) => (
                          <Box
                            key={`${url}-${index}`}
                            sx={{ textAlign: "center" }}
                          >
                            <Box
                              component="img"
                              src={url}
                              alt={`${editForm.state || "State"} preview ${index + 1}`}
                              sx={{
                                width: "100%",
                                maxWidth: 220,
                                height: 140,
                                objectFit: "cover",
                                borderRadius: 1,
                                border: "1px solid #e5e7eb",
                              }}
                            />
                            {editMode ? (
                              <IconButton
                                color="error"
                                onClick={() => handleImageDelete(index, "edit")}
                                size="small"
                                sx={{ mt: 1 }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            ) : null}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <p>No image</p>
                  )}
                  {editMode ? (
                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" component="label">
                        Upload Images
                        <input
                          hidden
                          accept="image/*"
                          type="file"
                          multiple
                          onChange={(event) => handleImageUpload(event, "edit")}
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
                      handleWeightFieldChange(
                        column.field,
                        event.target.value,
                        "edit",
                      )
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
                    (c) => c.field === config.field,
                  );
                  const factors =
                    STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
                  const currentScore = calculateScore(
                    editForm.weight || {},
                    factors,
                  );

                  return (
                    <React.Fragment key={config.formula}>
                      <TextField
                        label={`Score ${config.label}`}
                        value={currentScore}
                        InputProps={{ readOnly: true }}
                        disabled // disable the score field
                        fullWidth
                        size="small"
                        sx={{ bgcolor: "#f9fafb" }}
                      />
                      {labelCol ? (
                        <TextField
                          label={config.field}
                          select
                          disabled // disable the label field
                          value={editForm.labels?.[config.field] ?? ""}
                          onChange={(event) =>
                            handleLabelFieldChange(
                              config.field,
                              event.target.value,
                              "edit",
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
                    (lc) =>
                      !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field),
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
                            "edit",
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
                    Image Preview ({addForm.imageUrls.length}/{MAX_IMAGES})
                  </Typography>
                  <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {addForm.imageUrls.map((url, index) => (
                      <Box key={`${url}-${index}`} sx={{ textAlign: "center" }}>
                        <Box
                          component="img"
                          src={url}
                          alt={`${addForm.state || "State"} preview ${index + 1}`}
                          sx={{
                            width: "100%",
                            maxWidth: 220,
                            height: 140,
                            objectFit: "cover",
                            borderRadius: 1,
                            border: "1px solid #e5e7eb",
                          }}
                        />
                        <IconButton
                          color="error"
                          onClick={() => handleImageDelete(index, "add")}
                          size="small"
                          sx={{ mt: 1 }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" component="label">
                  Upload Images
                  <input
                    hidden
                    accept="image/*"
                    type="file"
                    multiple
                    onChange={(event) => handleImageUpload(event, "add")}
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
                setAddForm((prev) => ({
                  ...prev,
                  isActive: event.target.value,
                }))
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
                  handleWeightFieldChange(
                    column.field,
                    event.target.value,
                    "add",
                  )
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
                (c) => c.field === config.field,
              );
              const factors = STATEWISE_WEIGHT_FORMULAS[config.formula] || [];
              const currentScore = calculateScore(
                addForm.weight || {},
                factors,
              );

              return (
                <React.Fragment key={config.formula}>
                  <TextField
                    label={`Score ${config.label}`}
                    value={currentScore}
                    InputProps={{ readOnly: true }}
                    disabled // disable the score field
                    fullWidth
                    size="small"
                    sx={{ bgcolor: "#f9fafb" }}
                  />
                  {labelCol ? (
                    <TextField
                      label={config.field}
                      select
                      disabled // disable the label field
                      value={addForm.labels?.[config.field] ?? ""}
                      onChange={(event) =>
                        handleLabelFieldChange(
                          config.field,
                          event.target.value,
                          "add",
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
                (lc) => !Object.values(SCORE_TO_LABEL_MAP).includes(lc.field),
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
                        "add",
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
