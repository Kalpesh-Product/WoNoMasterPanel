// Reverse-engineered from the WoNo data team's per-city "Linked_WoNo_<City>_Analytics_2.0.xlsm"
// workbooks — specifically the "Kewords Scoring Logic & Doc" and
// "Scoring Logic Weight Calculatio[n]" sheets. Verified to reproduce the Dubai
// workbook's own computed values (see scripts/verifyDestinationListingScoring.js).

const KEYWORD_GROUPS = {
  DIGITAL: ["booking", "reservation", "website", "app", "online", "check-in", "check in"],
  EVENTS: ["meeting", "conference", "event", "workshop", "community", "networking"],
  SERVICE: ["reception", "front desk", "concierge", "staff", "24/7", "24-hour", "24 hour", "daily", "support", "housekeeping", "cleaning", "service"],
  ROOMS: ["private", "room", "desk", "office", "suite", "cabin", "accommodation", "dorm", "bed"],
  ACCESS: ["access", "security", "key", "parking", "24/7", "24-hour", "visitor", "entry", "reception"],
  INTERNET: ["wifi", "wi-fi", "internet", "desk", "remote", "workstation", "laptop", "coworking", "co-working", "mobile"],
  LOCATION: ["location", "transport", "central", "airport", "tourist", "metro"],
  COMMUNICATION: ["contact", "support", "reception", "message", "booking", "whatsapp", "chat", "messenger"],
  TRAVEL: ["tourist", "traveller", "traveler", "backpacker", "hostel", "stay", "accommodation", "dorm"],
  LEAD: ["enquiry", "inquiry", "lead", "contact", "quote", "pricing", "reservation", "booking"],
  ACTIVITY: ["event", "community", "member", "booking", "meeting"],
};

const WEBSITE_FACTOR = { website: true };

// category -> ordered list of 6 factors: { key, label, weight, groups } or website-special
const CATEGORY_FACTORS = {
  Coworking: [
    { key: "F1", label: "Lead Management Fit", weight: 25, groups: ["DIGITAL", "EVENTS", "ROOMS", "SERVICE"] },
    { key: "F2", label: "Website / Digital Presence Fit", weight: 20, ...WEBSITE_FACTOR },
    { key: "F3", label: "Visitor / Access Fit", weight: 15, groups: ["ACCESS", "SERVICE", "ROOMS", "EVENTS"] },
    { key: "F4", label: "Organization / Staff Fit", weight: 15, groups: ["SERVICE", "ROOMS", "ACCESS", "EVENTS"] },
    { key: "F5", label: "Nomad Listing Fit", weight: 15, groups: ["INTERNET", "ROOMS", "EVENTS", "LOCATION"] },
    { key: "F6", label: "Customer Communication / Chatbot", weight: 10, groups: ["DIGITAL", "SERVICE", "COMMUNICATION", "EVENTS"] },
  ],
  Coliving: [
    { key: "F1", label: "Nomad / Accommodation Fit", weight: 25, groups: ["TRAVEL", "ROOMS", "INTERNET", "LOCATION"] },
    { key: "F2", label: "Website / Digital Presence Fit", weight: 20, ...WEBSITE_FACTOR },
    { key: "F3", label: "Lead & Enquiry Management", weight: 20, groups: ["DIGITAL", "EVENTS", "ROOMS", "SERVICE"] },
    { key: "F4", label: "Customer Communication / Chatbot", weight: 15, groups: ["DIGITAL", "SERVICE", "COMMUNICATION", "EVENTS"] },
    { key: "F5", label: "Visitor Management", weight: 10, groups: ["ACCESS", "SERVICE", "ROOMS", "EVENTS"] },
    { key: "F6", label: "Operational / Staff Management", weight: 10, groups: ["SERVICE", "ROOMS", "ACCESS", "EVENTS"] },
  ],
  Cafe: [
    { key: "F1", label: "Website / Digital Presence Fit", weight: 25, ...WEBSITE_FACTOR },
    { key: "F2", label: "Customer / Lead Management Fit", weight: 20, groups: ["DIGITAL", "EVENTS", "ROOMS", "SERVICE"] },
    { key: "F3", label: "Workspace / Nomad Relevance", weight: 20, groups: ["INTERNET", "ROOMS", "EVENTS", "LOCATION"] },
    { key: "F4", label: "Customer Communication / Chatbot", weight: 15, groups: ["DIGITAL", "SERVICE", "COMMUNICATION", "EVENTS"] },
    { key: "F5", label: "Online Presence Gap", weight: 10, ...WEBSITE_FACTOR },
    { key: "F6", label: "Business Activity Signal Fit", weight: 10, groups: ["ACTIVITY", "EVENTS", "INTERNET", "SERVICE"] },
  ],
  Hostel: [
    { key: "F1", label: "Nomad / Traveller Fit", weight: 30, groups: ["TRAVEL", "ROOMS", "EVENTS", "LOCATION"] },
    { key: "F2", label: "Website / Digital Presence Fit", weight: 20, ...WEBSITE_FACTOR },
    { key: "F3", label: "Lead / Enquiry Management", weight: 20, groups: ["DIGITAL", "EVENTS", "ROOMS", "SERVICE"] },
    { key: "F4", label: "Customer Communication", weight: 10, groups: ["DIGITAL", "SERVICE", "COMMUNICATION", "EVENTS"] },
    { key: "F5", label: "Visitor Management", weight: 10, groups: ["ACCESS", "SERVICE", "ROOMS", "EVENTS"] },
    { key: "F6", label: "Operational Management", weight: 10, groups: ["SERVICE", "ROOMS", "ACCESS", "EVENTS"] },
  ],
  "Meeting Room": [
    { key: "F1", label: "Booking / Lead Management Fit", weight: 25, groups: ["DIGITAL", "LEAD", "EVENTS", "ROOMS"] },
    { key: "F2", label: "Website / Digital Presence Fit", weight: 20, ...WEBSITE_FACTOR },
    { key: "F3", label: "Visitor Management", weight: 20, groups: ["ACCESS", "SERVICE", "ROOMS", "EVENTS"] },
    { key: "F4", label: "Customer Communication", weight: 15, groups: ["DIGITAL", "SERVICE", "COMMUNICATION", "EVENTS"] },
    { key: "F5", label: "Staff / Access Management", weight: 10, groups: ["SERVICE", "ROOMS", "ACCESS", "EVENTS"] },
    { key: "F6", label: "Business Activity Signal Fit", weight: 10, groups: ["ACTIVITY", "EVENTS", "INTERNET", "SERVICE"] },
  ],
};

const CATEGORY_ALIASES = {
  coworking: "Coworking",
  coliving: "Coliving",
  cafe: "Cafe",
  café: "Cafe",
  hostel: "Hostel",
  meetingroom: "Meeting Room",
  "meeting room": "Meeting Room",
  "meeting rooms": "Meeting Room",
};

const normalizeCategory = (raw) => {
  const key = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  return CATEGORY_ALIASES[key] || CATEGORY_ALIASES[key.replace(/\s+/g, "")] || raw;
};

const PITCH_NO_WEBSITE = "Lead with FREE website, then WoNo listing and lead/customer tools.";
const PITCH_BY_CATEGORY = {
  Coworking: "Lead with lead management, visitor/access, customer communication and WoNo listing.",
  Coliving: "Lead with nomad listing, enquiry management, guest communication and visitor workflows.",
  Cafe: "Lead with digital presence, customer engagement, remote-work visibility and lead capture.",
  Hostel: "Lead with nomad listing, enquiry management, guest communication and visitor workflows.",
  "Meeting Room": "Lead with lead management, visitor/access, customer communication and WoNo listing.",
};

const textMatchesGroup = (text, groupKey) => {
  const haystack = text.toLowerCase();
  return KEYWORD_GROUPS[groupKey].some((keyword) => haystack.includes(keyword));
};

const matchedGroupCount = (text, groupKeys) => groupKeys.filter((key) => textMatchesGroup(text, key)).length;

const evidenceScore = (text, groupKeys) => Math.min(5, 1 + matchedGroupCount(text, groupKeys));

const websiteFactorScore = (hasWebsite, text) => {
  if (!hasWebsite) return 5;
  return textMatchesGroup(text, "DIGITAL") ? 1 : 2;
};

const computeNeedScore = ({ hasWebsite, hasInstagram, hasFacebook, evidenceText }) => {
  const websiteGap = hasWebsite ? 0 : 5;
  const socialGap = hasInstagram && hasFacebook ? 0 : (hasInstagram || hasFacebook ? 3 : 5);
  const customerJourney = evidenceScore(evidenceText, ["DIGITAL", "EVENTS", "SERVICE", "ROOMS"]);
  const operational = evidenceScore(evidenceText, ["SERVICE", "ACCESS", "EVENTS", "ROOMS"]);
  const score = Number((
    (websiteGap / 5) * 35 + (socialGap / 5) * 15 + (customerJourney / 5) * 25 + (operational / 5) * 25
  ).toFixed(4));
  return { websiteGap, socialGap, customerJourney, operational, score };
};

const computeCategoryFitScore = (category, { hasWebsite, evidenceText }) => {
  const factors = CATEGORY_FACTORS[category];
  if (!factors) return { factors: [], score: null };
  const scoredFactors = factors.map((factor) => {
    const evidence = factor.website ? websiteFactorScore(hasWebsite, evidenceText) : evidenceScore(evidenceText, factor.groups);
    return { ...factor, evidence, weighted: (evidence / 5) * factor.weight };
  });
  const score = Number(scoredFactors.reduce((sum, f) => sum + f.weighted, 0).toFixed(4));
  return { factors: scoredFactors, score };
};

// Percentile rank within the same category, matching the workbook's
// COUNTIFS-based formula: (count of same-category rows <= this value, minus 1) / (category size - 1) * 100.
const percentileWithinCategory = (value, sameCategoryValues) => {
  const n = sameCategoryValues.length;
  if (n <= 1) return 100;
  const countLte = sameCategoryValues.filter((v) => v <= value).length;
  return ((countLte - 1) / (n - 1)) * 100;
};

const computeBusinessActivityScore = (business, sameCategoryBusinesses) => {
  const ratingPercentile = percentileWithinCategory(business.rating, sameCategoryBusinesses.map((b) => b.rating));
  const reviewPercentile = percentileWithinCategory(business.totalReviews, sameCategoryBusinesses.map((b) => b.totalReviews));
  const score = Number(((ratingPercentile + reviewPercentile) / 2).toFixed(4));
  return { ratingPercentile, reviewPercentile, score };
};

const priorityBand = (finalScore) => {
  if (finalScore >= 80) return "High Opportunity";
  if (finalScore >= 60) return "Medium Opportunity";
  return "Lower Opportunity";
};

const recommendedPitch = (category, hasWebsite) => (hasWebsite ? (PITCH_BY_CATEGORY[category] || "") : PITCH_NO_WEBSITE);

const digitalGapsCount = ({ hasWebsite, hasInstagram, hasFacebook }) => [hasWebsite, hasInstagram, hasFacebook].filter((v) => !v).length;

// Scores one business. `sameCategoryBusinesses` must be every business of the
// same `category` in the same destination (needed for the percentile step).
const scoreListing = (business, sameCategoryBusinesses) => {
  const category = normalizeCategory(business.category);
  const evidenceText = `${business.about || ""} ${business.inclusion || ""}`;
  const input = { hasWebsite: business.hasWebsite, hasInstagram: business.hasInstagram, hasFacebook: business.hasFacebook, evidenceText };
  const need = computeNeedScore(input);
  const categoryFit = computeCategoryFitScore(category, input);
  const activity = computeBusinessActivityScore(business, sameCategoryBusinesses);
  const finalScore = Number((need.score * 0.4 + (categoryFit.score || 0) * 0.35 + activity.score * 0.25).toFixed(4));
  return {
    category,
    need,
    categoryFit,
    activity,
    finalScore,
    priority: priorityBand(finalScore),
    digitalGaps: digitalGapsCount(input),
    recommendedPitch: recommendedPitch(category, business.hasWebsite),
  };
};

module.exports = {
  KEYWORD_GROUPS,
  CATEGORY_FACTORS,
  normalizeCategory,
  textMatchesGroup,
  evidenceScore,
  websiteFactorScore,
  computeNeedScore,
  computeCategoryFitScore,
  computeBusinessActivityScore,
  priorityBand,
  recommendedPitch,
  digitalGapsCount,
  scoreListing,
};
