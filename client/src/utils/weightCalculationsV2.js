// Algo 2.0 (WoNo AI Algorithm 2.0) — client-side port of the verified backend
// calc engine at wono/Nomads/backend/controllers/stateWiseWeightCalculation.js.
//
// This is a straight copy of the backend source of truth (same formulas, same
// tier labels, same universal 5-tier classifier, same quick-stats config) so the
// admin preview matches the live Nomads backend exactly. Do NOT modify or
// "improve" the formulas here — they were verified against the client's
// WoNo AI Algo 2.0.xlsx across all 132 destinations.
//
// The Algo 1.0 utilities live in ./weightCalculations.js and are untouched.

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 5.0;
};

const score = (weights, factors) =>
  Number(
    Object.entries(factors)
      .reduce((total, [factor, multiplier]) => total + toNumber(weights[factor]) * multiplier, 0)
      .toFixed(2),
  );

export const STATEWISE_WEIGHT_FORMULAS = {
  bestForNomads: {
    workInfrastructure: 0.2,
    internet: 0.18,
    costOfLiving: 0.15,
    safety: 0.15,
    nomadCommunity: 0.12,
    airQualityIndex: 0.1,
    visaOpenness: 0.05,
    healthcareQuality: 0.05,
  },
  mostAffordable: {
    costOfLiving: 0.6,
    healthcareCostIndex: 0.2,
    purchasingPower: 0.1,
    inflationStability: 0.1,
  },
  safestCities: {
    safety: 0.7,
    airQualityIndex: 0.15,
    climateEnvironment: 0.1,
    healthcareCostIndex: 0.05,
  },
  easyVisaLongStay: {
    visaOpenness: 0.65,
    flightConnectivity: 0.15,
    lowerTaxes: 0.1,
    startupEcosystem: 0.1,
  },
  strongNomadCommunity: {
    nomadCommunity: 0.45,
    meetupsEvents: 0.3,
    workInfrastructure: 0.15,
    internet: 0.1,
  },
  healthcareFriendly: {
    healthcareQuality: 0.6,
    healthcareCostIndex: 0.2,
    purchasingPower: 0.1,
    inflationStability: 0.1,
  },
  startupBusinessOpportunities: {
    startupEcosystem: 0.4,
    incubators: 0.25,
    ventureCapitalPresence: 0.2,
    techTalentDensity: 0.15,
  },
  cleanAirEnvironment: {
    airQualityIndex: 0.6,
    climateEnvironment: 0.2,
    natureNomadTravelling: 0.1,
    safety: 0.1,
  },
  bestWorkInfrastructure: {
    workInfrastructure: 0.6,
    internet: 0.2,
    nomadCommunity: 0.1,
    startupEcosystem: 0.1,
  },
  bestForRemoteWorkSetup: {
    internet: 0.45,
    workInfrastructure: 0.35,
    nomadCommunity: 0.1,
    lowerTaxes: 0.1,
  },
  bestConnectedCitiesFlights: {
    flightConnectivity: 0.6,
    internet: 0.15,
    workInfrastructure: 0.15,
    ventureCapitalPresence: 0.1,
  },
  fastInternetCities: {
    internet: 0.65,
    workInfrastructure: 0.15,
    meetupsEvents: 0.1,
    lowerTaxes: 0.1,
  },
  maximumSavings: {
    costOfLiving: 0.4,
    lowerTaxes: 0.3,
    purchasingPower: 0.2,
    healthcareCostIndex: 0.1,
  },
  lowTaxation: {
    lowerTaxes: 0.65,
    costOfLiving: 0.15,
    purchasingPower: 0.1,
    inflationStability: 0.1,
  },
  purchasingPower: {
    purchasingPower: 0.65,
    lowerTaxes: 0.15,
    healthcareCostIndex: 0.1,
    inflationStability: 0.1,
  },
  financialStabilityLowRisk: {
    inflationStability: 0.6,
    lowerTaxes: 0.15,
    healthcareCostIndex: 0.15,
    safety: 0.1,
  },
  startupSetupCost: {
    costOfLiving: 0.3,
    lowerTaxes: 0.25,
    workInfrastructure: 0.2,
    incubators: 0.15,
    purchasingPower: 0.1,
  },
  balancedFinancialLifestyle: {
    costOfLiving: 0.25,
    purchasingPower: 0.25,
    inflationStability: 0.2,
    lowerTaxes: 0.15,
    healthcareCostIndex: 0.15,
  },
  startupEcosystems: {
    startupEcosystem: 0.55,
    incubators: 0.2,
    ventureCapitalPresence: 0.15,
    ventureCapitalInvestments: 0.1,
  },
  remoteJobOpportunities: {
    remoteJobs: 0.6,
    internet: 0.15,
    workInfrastructure: 0.15,
    purchasingPower: 0.1,
  },
  techTalentDensity: {
    techTalentDensity: 0.6,
    internet: 0.15,
    workInfrastructure: 0.15,
    meetupsEvents: 0.1,
  },
  startupFundingSupport: {
    incubators: 0.4,
    ventureCapitalPresence: 0.25,
    ventureCapitalInvestments: 0.25,
    lowerTaxes: 0.1,
  },
  ventureCapitalPresence: {
    ventureCapitalPresence: 0.5,
    ventureCapitalInvestments: 0.3,
    incubators: 0.1,
    internet: 0.1,
  },
  founderNomads: {
    startupEcosystem: 0.3,
    incubators: 0.25,
    nomadCommunity: 0.2,
    meetupsEvents: 0.15,
    ventureCapitalPresence: 0.1,
  },
  balancedCareerGrowth: {
    remoteJobs: 0.3,
    workInfrastructure: 0.25,
    startupEcosystem: 0.2,
    techTalentDensity: 0.15,
    conferencesEvents: 0.1,
  },
  conferencesEvents: {
    conferencesEvents: 0.55,
    startupEcosystem: 0.2,
    incubators: 0.15,
    ventureCapitalPresence: 0.1,
  },
  socialPartyLifestyle: {
    meetupsEvents: 0.4,
    conferencesEvents: 0.25,
    nomadCommunity: 0.2,
    workInfrastructure: 0.15,
  },
  chillWellnessLifestyle: {
    yoga: 0.35,
    climateEnvironment: 0.25,
    airQualityIndex: 0.2,
    healthcareQuality: 0.2,
  },
  adventureExploration: {
    natureNomadTravelling: 0.45,
    climateEnvironment: 0.25,
    flightConnectivity: 0.15,
    safety: 0.15,
  },
  soloNomads: {
    safety: 0.4,
    meetupsEvents: 0.25,
    nomadCommunity: 0.25,
    visaOpenness: 0.1,
  },
  coupleFriendlyLifestyle: {
    safety: 0.3,
    nomadCommunity: 0.25,
    natureNomadTravelling: 0.2,
    costOfLiving: 0.15,
    workInfrastructure: 0.1,
  },
  femaleFriendlyLifestyle: {
    safety: 0.45,
    healthcareQuality: 0.2,
    nomadCommunity: 0.2,
    meetupsEvents: 0.15,
  },
  familyFriendlyLifestyle: {
    safety: 0.3,
    healthcareQuality: 0.2,
    costOfLiving: 0.2,
    healthcareCostIndex: 0.15,
    climateEnvironment: 0.15,
  },
};

export const ATTRIBUTE_TIER_LABELS = {
  bestForNomads: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
  mostAffordable: ["Very Affordable", "Affordable", "Moderate", "Costly", "Very Costly"],
  safestCities: ["Very Safe", "Safe", "Moderately Safe", "Lower Safety", "Safety Concerns"],
  easyVisaLongStay: ["Very Accessible", "Accessible", "Moderate Access", "Restricted Access", "Highly Restricted"],
  strongNomadCommunity: ["Very Active", "Active", "Moderate", "Emerging", "Limited"],
  healthcareFriendly: ["Very Good", "Good", "Moderate", "Basic", "Limited"],
  startupBusinessOpportunities: ["Very Strong", "Strong", "Moderate", "Emerging", "Limited"],
  cleanAirEnvironment: ["Very Favorable", "Favorable", "Moderate", "Less Favorable", "Limited"],
  bestWorkInfrastructure: ["Well Equipped", "Good Setup", "Adequate", "Basic Setup", "Limited Setup"],
  bestForRemoteWorkSetup: ["Well Equipped", "Good Setup", "Adequate", "Basic Setup", "Limited Setup"],
  bestConnectedCitiesFlights: ["Very Connected", "Well Connected", "Moderate", "Limited", "Very Limited"],
  fastInternetCities: ["Very Strong", "Strong", "Moderate", "Limited", "Very Limited"],
  maximumSavings: ["Very High", "High", "Moderate", "Low", "Very Low"],
  lowTaxation: ["Very Favorable", "Favorable", "Moderate", "Limited", "Very Limited"],
  purchasingPower: ["Very High", "High", "Moderate", "Low", "Very Low"],
  financialStabilityLowRisk: ["Very Strong", "Strong", "Moderate", "Limited", "Very Limited"],
  startupSetupCost: ["Very Favorable", "Favorable", "Moderate", "Less Favorable", "Limited"],
  balancedFinancialLifestyle: ["Very Good Balance", "Good Balance", "Moderate Balance", "Limited Balance", "Poor Balance"],
  startupEcosystems: ["Well Established", "Established", "Developing", "Early Stage", "Limited"],
  remoteJobOpportunities: ["Very Good", "Good", "Moderate", "Limited", "Very Limited"],
  techTalentDensity: ["Very High", "High", "Moderate", "Low", "Very Low"],
  startupFundingSupport: ["Very Strong", "Strong", "Moderate", "Limited", "Very Limited"],
  ventureCapitalPresence: ["Very Strong", "Strong", "Moderate", "Limited", "Very Limited"],
  founderNomads: ["Highly Supportive", "Supportive", "Moderately Supportive", "Basic Support", "Limited Support"],
  balancedCareerGrowth: ["Very Good", "Good", "Moderate", "Limited", "Very Limited"],
  conferencesEvents: ["Very Active", "Active", "Moderate", "Occasional", "Limited"],
  socialPartyLifestyle: ["Very Active", "Active", "Moderate", "Quiet", "Very Quiet"],
  chillWellnessLifestyle: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
  adventureExploration: ["Many Options", "Good Options", "Some Options", "Few Options", "Limited Options"],
  soloNomads: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
  coupleFriendlyLifestyle: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
  femaleFriendlyLifestyle: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
  familyFriendlyLifestyle: ["Very Good Fit", "Good Fit", "Suitable", "Basic Fit", "Limited Fit"],
};

export const getLabelForScore = (attribute, score) => {
  const tiers = ATTRIBUTE_TIER_LABELS[attribute];
  if (!tiers) return "";
  const num = Number(score);
  if (!Number.isFinite(num)) return tiers[4];
  if (num >= 9.0) return tiers[0];
  if (num >= 8.0) return tiers[1];
  if (num >= 6.5) return tiers[2];
  if (num >= 5.0) return tiers[3];
  return tiers[4];
};

export const ATTRIBUTE_QUICK_STATS_CONFIG = {
  bestForNomads: { attributes: ["workInfrastructure", "internet", "costOfLiving", "safety"], labels: ["Workspaces", "Internet Speed", "Affordability", "Safety"] },
  mostAffordable: { attributes: ["costOfLiving", "healthcareCostIndex", "purchasingPower", "inflationStability"], labels: ["Affordability", "Healthcare Affordability", "Purchasing Power", "Price Stability"] },
  safestCities: { attributes: ["safety", "airQualityIndex", "climateEnvironment", "healthcareCostIndex"], labels: ["Safety", "Clean Air", "Environmental Quality", "Healthcare Affordability"] },
  easyVisaLongStay: { attributes: ["visaOpenness", "flightConnectivity", "lowerTaxes", "startupEcosystem"], labels: ["Visa Openness", "Flight Connections", "Tax Friendliness", "Startup Ecosystem"] },
  strongNomadCommunity: { attributes: ["nomadCommunity", "meetupsEvents", "workInfrastructure", "internet"], labels: ["Nomad Network", "Meetups & Events", "Workspaces", "Internet Speed"] },
  healthcareFriendly: { attributes: ["healthcareQuality", "healthcareCostIndex", "purchasingPower", "inflationStability"], labels: ["Healthcare Quality", "Healthcare Affordability", "Purchasing Power", "Price Stability"] },
  startupBusinessOpportunities: { attributes: ["startupEcosystem", "incubators", "ventureCapitalPresence", "techTalentDensity"], labels: ["Startup Ecosystem", "Startup Support", "VC Presence", "Tech Talent"] },
  cleanAirEnvironment: { attributes: ["airQualityIndex", "climateEnvironment", "natureNomadTravelling", "safety"], labels: ["Clean Air", "Environmental Quality", "Nature & Exploration", "Safety"] },
  bestWorkInfrastructure: { attributes: ["workInfrastructure", "internet", "nomadCommunity", "startupEcosystem"], labels: ["Workspaces", "Internet Speed", "Nomad Network", "Startup Ecosystem"] },
  bestForRemoteWorkSetup: { attributes: ["internet", "workInfrastructure", "nomadCommunity", "lowerTaxes"], labels: ["Internet Speed", "Workspaces", "Nomad Network", "Tax Friendliness"] },
  bestConnectedCitiesFlights: { attributes: ["flightConnectivity", "internet", "workInfrastructure", "ventureCapitalPresence"], labels: ["Flight Connections", "Internet Speed", "Workspaces", "VC Presence"] },
  fastInternetCities: { attributes: ["internet", "workInfrastructure", "meetupsEvents", "lowerTaxes"], labels: ["Internet Speed", "Workspaces", "Meetups & Events", "Tax Friendliness"] },
  maximumSavings: { attributes: ["costOfLiving", "lowerTaxes", "purchasingPower", "healthcareCostIndex"], labels: ["Affordability", "Tax Friendliness", "Purchasing Power", "Healthcare Affordability"] },
  lowTaxation: { attributes: ["lowerTaxes", "costOfLiving", "purchasingPower", "inflationStability"], labels: ["Tax Friendliness", "Affordability", "Purchasing Power", "Price Stability"] },
  purchasingPower: { attributes: ["purchasingPower", "lowerTaxes", "healthcareCostIndex", "inflationStability"], labels: ["Purchasing Power", "Tax Friendliness", "Healthcare Affordability", "Price Stability"] },
  financialStabilityLowRisk: { attributes: ["inflationStability", "lowerTaxes", "healthcareCostIndex", "safety"], labels: ["Price Stability", "Tax Friendliness", "Healthcare Affordability", "Safety"] },
  startupSetupCost: { attributes: ["costOfLiving", "lowerTaxes", "workInfrastructure", "incubators"], labels: ["Affordability", "Tax Friendliness", "Workspace Availability", "Startup Support"] },
  balancedFinancialLifestyle: { attributes: ["costOfLiving", "purchasingPower", "inflationStability", "lowerTaxes"], labels: ["Affordability", "Purchasing Power", "Price Stability", "Tax Friendliness"] },
  startupEcosystems: { attributes: ["startupEcosystem", "incubators", "ventureCapitalPresence", "ventureCapitalInvestments"], labels: ["Startup Ecosystem", "Startup Support", "VC Presence", "VC Investment"] },
  remoteJobOpportunities: { attributes: ["remoteJobs", "internet", "workInfrastructure", "purchasingPower"], labels: ["Remote Jobs", "Internet Speed", "Workspaces", "Purchasing Power"] },
  techTalentDensity: { attributes: ["techTalentDensity", "internet", "workInfrastructure", "meetupsEvents"], labels: ["Tech Talent", "Internet Speed", "Workspaces", "Meetups & Events"] },
  startupFundingSupport: { attributes: ["incubators", "ventureCapitalPresence", "ventureCapitalInvestments", "lowerTaxes"], labels: ["Startup Support", "VC Presence", "VC Investment", "Tax Friendliness"] },
  ventureCapitalPresence: { attributes: ["ventureCapitalPresence", "ventureCapitalInvestments", "incubators", "internet"], labels: ["VC Presence", "VC Investment", "Startup Support", "Internet Speed"] },
  founderNomads: { attributes: ["startupEcosystem", "incubators", "nomadCommunity", "meetupsEvents"], labels: ["Startup Ecosystem", "Incubators & Accelerators", "Nomad Network", "Meetups & Events"] },
  balancedCareerGrowth: { attributes: ["remoteJobs", "workInfrastructure", "startupEcosystem", "techTalentDensity"], labels: ["Remote Job Opportunities", "Workspaces", "Startup Ecosystem", "Tech Talent"] },
  conferencesEvents: { attributes: ["conferencesEvents", "startupEcosystem", "incubators", "ventureCapitalPresence"], labels: ["Conferences & Events", "Startup Ecosystem", "Startup Support", "VC Presence"] },
  socialPartyLifestyle: { attributes: ["meetupsEvents", "conferencesEvents", "nomadCommunity", "workInfrastructure"], labels: ["Meetups & Events", "Conferences & Events", "Nomad Network", "Workspaces"] },
  chillWellnessLifestyle: { attributes: ["yoga", "climateEnvironment", "airQualityIndex", "healthcareQuality"], labels: ["Yoga & Wellness", "Environmental Quality", "Clean Air", "Healthcare Access & Cost"] },
  adventureExploration: { attributes: ["natureNomadTravelling", "climateEnvironment", "flightConnectivity", "safety"], labels: ["Nature & Exploration", "Environmental Quality", "Flight Connections", "Safety"] },
  soloNomads: { attributes: ["safety", "meetupsEvents", "nomadCommunity", "visaOpenness"], labels: ["Safety", "Meetups & Events", "Nomad Network", "Visa Accessibility"] },
  coupleFriendlyLifestyle: { attributes: ["safety", "nomadCommunity", "natureNomadTravelling", "costOfLiving"], labels: ["Safety", "Nomad Network", "Nature & Exploration", "Affordability"] },
  femaleFriendlyLifestyle: { attributes: ["safety", "healthcareQuality", "nomadCommunity", "meetupsEvents"], labels: ["Safety", "Healthcare Quality", "Nomad Network", "Meetups & Events"] },
  familyFriendlyLifestyle: { attributes: ["safety", "healthcareQuality", "costOfLiving", "healthcareCostIndex"], labels: ["Safety", "Healthcare Quality", "Affordability", "Healthcare Affordability"] },
};

export const calculateScore = (weight, factors) => score(weight, factors);

export const stateWiseWeightCalculation = (weight = {}) =>
  Object.fromEntries(
    Object.entries(STATEWISE_WEIGHT_FORMULAS).map(([formulaName, factors]) => [
      formulaName,
      score(weight, factors),
    ]),
  );
