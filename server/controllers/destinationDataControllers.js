const axios = require("axios");
const HostCompany = require("../models/hostCompany/hostCompany");
const { fetchAllNomadListings } = require("./hostListingControllers");
const WonoDestinationRanking = require("../models/WonoDestinationRanking");

const priorityLabels = { P1: "Immediate Priority", P2: "High Priority", P3: "Medium Priority", P4: "Low Priority" };

const CACHE_TTL_MS = 10 * 60 * 1000;
// Some Nomads collections are abnormally slow to query right now — `blogs`
// alone (only ~11MB / 1062 docs) measured over 2 minutes for a plain sorted
// find, which points to a real problem on the Nomads DB side (missing
// indexes and/or an underpowered cluster), not this endpoint. This timeout
// is a stopgap so the page waits for real data instead of silently showing
// zero results; it doesn't fix the underlying slowness. Only the very first
// request after a cold cache pays this cost — subsequent requests are
// served from cache while a refresh happens in the background (see
// getCachedDestinationStats below).
const FETCH_TIMEOUT_MS = 3 * 60 * 1000;
const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

const destinationCaches = {
  content: { items: null, fetchedAt: 0 },
  listings: { items: null, fetchedAt: 0 },
};
const destinationRefreshPromises = {
  content: null,
  listings: null,
};
const nomadsCompanyListingsCache = { items: null, fetchedAt: 0 };
let nomadsCompanyListingsRefreshPromise = null;

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.companies)) return payload.companies;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const getByPath = (value, path) => {
  let current = value;
  for (const key of path.split(".")) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
};

const pickFirst = (row, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.includes(".") ? getByPath(row, key) : row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
};

const normalizeKey = (value) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

const normalizeListingTypeKey = (value) =>
  normalizeSearchValue(value).replace(/[^a-z0-9]/g, "");

const listingTypeCountField = (value) => {
  const key = normalizeListingTypeKey(value);
  if (key === "coworking" || key === "coworkingspace" || key === "coworkingspaces") {
    return "coworkingCount";
  }
  if (key === "coliving" || key === "colivingspace" || key === "colivingspaces") {
    return "colivingCount";
  }
  if (key === "hostel" || key === "hostels") return "hostelCount";
  if (key === "meetingroom" || key === "meetingrooms") return "meetingRoomCount";
  if (key === "cafe" || key === "cafes") return "cafeCount";
  return null;
};

const listingTypeMatches = (listingType, requestedType) => {
  const expectedField = listingTypeCountField(requestedType);
  return Boolean(expectedField && listingTypeCountField(listingType) === expectedField);
};

const levenshteinDistance = (left, right) => {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(columns).fill(0));
  for (let index = 0; index < rows; index += 1) matrix[index][0] = index;
  for (let index = 0; index < columns; index += 1) matrix[0][index] = index;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      matrix[row][column] =
        left[row - 1] === right[column - 1]
          ? matrix[row - 1][column - 1]
          : 1 + Math.min(
              matrix[row - 1][column - 1],
              matrix[row - 1][column],
              matrix[row][column - 1],
            );
    }
  }
  return matrix[rows - 1][columns - 1];
};

const isSameDestinationKey = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 3 || right.length < 3) return false;
  if (left.startsWith(right) || right.startsWith(left)) return true;
  return Math.min(left.length, right.length) >= 4 && levenshteinDistance(left, right) <= 1;
};

const normalizeCountry = (row) =>
  pickFirst(
    row,
    [
      "country",
      "countryName",
      "country_name",
      "locationCountry",
      "location.country",
      "address.country",
      "companyCountry",
    ],
    "Unknown",
  );

const normalizeContinent = (row) =>
  pickFirst(
    row,
    [
      "continent",
      "continentName",
      "continent_name",
      "region",
      "location.continent",
      "companyContinent",
    ],
    "-",
  );

const normalizeState = (row) =>
  pickFirst(row, ["state", "stateName", "state_name", "companyState", "location.state"]);

const normalizeCity = (row) =>
  pickFirst(
    row,
    ["city", "cityName", "city_name", "companyCity", "location.city", "address.city"],
  );

const normalizeDestination = (row) =>
  pickFirst(
    row,
    [
      "state",
      "companyState",
      "city",
      "companyCity",
      "destination",
      "destinationName",
      "destination_name",
      "region",
      "location.destination",
    ],
    "-",
  );

const fetchNomadsRows = async (path) => {
  try {
    const response = await axios.get(`${NOMADS_BASE_URL}${path}`, {
      timeout: FETCH_TIMEOUT_MS,
      headers: process.env.NOMADS_ADMIN_API_KEY
        ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
        : {},
    });
    return toArray(response.data);
  } catch (error) {
    console.error(`Failed to fetch destination source ${path}:`, error.message);
    return [];
  }
};

const refreshNomadsCompanyListingsCache = () => {
  if (!nomadsCompanyListingsRefreshPromise) {
    nomadsCompanyListingsRefreshPromise = (async () => {
      const directListings = await fetchNomadsRows("/company/companies");
      const items = directListings.length ? directListings : await fetchAllNomadListings();
      const previousItems = nomadsCompanyListingsCache.items;

      if (items.length === 0 && previousItems?.length) {
        nomadsCompanyListingsCache.fetchedAt = Date.now();
        return previousItems;
      }

      nomadsCompanyListingsCache.items = items;
      nomadsCompanyListingsCache.fetchedAt = Date.now();
      return items;
    })().finally(() => {
      nomadsCompanyListingsRefreshPromise = null;
    });
  }

  return nomadsCompanyListingsRefreshPromise;
};

const fetchNomadsCompanyListings = async () => {
  const isFresh =
    nomadsCompanyListingsCache.items &&
    Date.now() - nomadsCompanyListingsCache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) return nomadsCompanyListingsCache.items;

  if (nomadsCompanyListingsCache.items) {
    refreshNomadsCompanyListingsCache().catch((error) => {
      console.error("Background Nomads company listings refresh failed:", error.message);
    });
    return nomadsCompanyListingsCache.items;
  }

  return refreshNomadsCompanyListingsCache();
};

const buildDestinationStats = async ({ includeListings = false } = {}) => {
  const [companies, blogs, news, events, places, restaurants, listings] = await Promise.all([
    HostCompany.find()
      .select("companyCountry companyState companyCity companyContinent")
      .lean(),
    // Pre-aggregated on the Nomads side (destination + count only) — pulling
    // full blog/news documents just to count them by destination was taking
    // 50-120s+ over this link; the grouped summary takes well under a second.
    fetchNomadsRows("/blogs/destination-counts"),
    fetchNomadsRows("/news/destination-counts"),
    fetchNomadsRows("/events"),
    fetchNomadsRows("/places"),
    fetchNomadsRows("/restaurants"),
    includeListings ? fetchNomadsCompanyListings() : Promise.resolve([]),
  ]);

  const destinationMap = new Map();
  const destinationEntries = [];
  const locationLookup = new Map();

  companies.forEach((company) => {
    const location = {
      country: normalizeCountry(company),
      continent: normalizeContinent(company),
      state: normalizeState(company),
      city: normalizeCity(company),
    };
    [location.state, location.city].filter(Boolean).forEach((name) => {
      if (!locationLookup.has(normalizeKey(name))) {
        locationLookup.set(normalizeKey(name), location);
      }
    });
  });

  const ensureDestination = (row) => {
    const destination = normalizeDestination(row);
    if (!destination || destination === "-") return null;

    const destinationKey = normalizeKey(destination);
    const lookupLocation = locationLookup.get(destinationKey);
    const normalizedCountry = normalizeCountry(row);
    const country =
      (normalizedCountry === "Unknown" || normalizedCountry === "-") && lookupLocation?.country
        ? lookupLocation.country
        : normalizedCountry;
    const normalizedContinent = normalizeContinent(row);
    const continent =
      normalizedContinent !== "-"
        ? normalizedContinent
        : lookupLocation?.continent || "-";
    const state = normalizeState(row) || lookupLocation?.state || "";
    const city = normalizeCity(row) || lookupLocation?.city || "";
    const countryKey = normalizeKey(country);
    const mapKey = `${countryKey}::${destinationKey}`;

    let entry = destinationMap.get(mapKey);
    if (!entry) {
      entry = destinationEntries.find(
        (candidate) =>
          normalizeKey(candidate.country) === countryKey &&
          isSameDestinationKey(destinationKey, normalizeKey(candidate.destination)),
      );
    }

    if (!entry) {
      entry = {
        destination,
        country,
        continent,
        states: new Set(),
        cities: new Set(),
        blogCount: 0,
        newsCount: 0,
        eventCount: 0,
        placeCount: 0,
        restaurantCount: 0,
        publicListingCount: 0,
        coworkingCount: 0,
        colivingCount: 0,
        hostelCount: 0,
        meetingRoomCount: 0,
        cafeCount: 0,
      };
      destinationEntries.push(entry);
    } else if (destination.length > entry.destination.length) {
      entry.destination = destination;
    }

    if (state) entry.states.add(state);
    if (city) entry.cities.add(city);
    destinationMap.set(mapKey, entry);
    return entry;
  };

  companies.forEach(ensureDestination);
  [
    [blogs, "blogCount"],
    [news, "newsCount"],
    [events, "eventCount"],
    [places, "placeCount"],
    [restaurants, "restaurantCount"],
  ].forEach(([rows, countField]) => {
    rows.forEach((row) => {
      if (row?.isActive === false) return;
      const entry = ensureDestination(row);
      // Pre-aggregated sources (blogs/news) carry a `count`; raw per-item
      // sources (events/places/restaurants) don't, so each row is just 1.
      if (entry) entry[countField] += row?.count || 1;
    });
  });
  listings.forEach((listing) => {
    if (listing?.isActive === false || listing?.isDeleted === true) return;
    const countField = listingTypeCountField(listing?.companyType);
    if (!countField) return;
    const entry = ensureDestination(listing);
    if (!entry) return;
    entry[countField] += 1;
    if (listing.isPublic === true) entry.publicListingCount += 1;
  });

  return destinationEntries
    .filter(
      (row) =>
        row.blogCount +
          row.newsCount +
          row.eventCount +
          row.placeCount +
          row.restaurantCount +
          row.coworkingCount +
          row.colivingCount +
          row.hostelCount +
          row.meetingRoomCount +
          row.cafeCount >
        0,
    )
    .map((row) => ({
      ...row,
      states: Array.from(row.states).sort((a, b) => a.localeCompare(b)),
      cities: Array.from(row.cities).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => {
      const continentOrder = left.continent.localeCompare(right.continent);
      if (continentOrder !== 0) return continentOrder;
      const countryOrder = left.country.localeCompare(right.country);
      if (countryOrder !== 0) return countryOrder;
      return left.destination.localeCompare(right.destination);
    });
};

const refreshDestinationCache = (scope, options) => {
  if (!destinationRefreshPromises[scope]) {
    destinationRefreshPromises[scope] = buildDestinationStats(options)
      .then((items) => {
        const previousItems = destinationCaches[scope].items;
        if (scope === "listings" && items.length === 0 && previousItems?.length) {
          destinationCaches[scope] = { items: previousItems, fetchedAt: Date.now() };
          return previousItems;
        }
        destinationCaches[scope] = { items, fetchedAt: Date.now() };
        return items;
      })
      .finally(() => {
        destinationRefreshPromises[scope] = null;
      });
  }
  return destinationRefreshPromises[scope];
};

const getCachedDestinationStats = async ({ includeListings = false } = {}) => {
  const scope = includeListings ? "listings" : "content";
  const destinationCache = destinationCaches[scope];
  const isFresh =
    destinationCache.items && Date.now() - destinationCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return destinationCache.items;
  if (destinationCache.items) {
    refreshDestinationCache(scope, { includeListings }).catch((error) => {
      console.error("Background destination refresh failed:", error.message);
    });
    return destinationCache.items;
  }
  return refreshDestinationCache(scope, { includeListings });
};

const summarize = (items) =>
  items.reduce(
    (counts, item) => ({
      blogs: counts.blogs + item.blogCount,
      news: counts.news + item.newsCount,
      events: counts.events + item.eventCount,
      places: counts.places + item.placeCount,
      restaurants: counts.restaurants + item.restaurantCount,
      publicListings: counts.publicListings + item.publicListingCount,
      coworking: counts.coworking + item.coworkingCount,
      coliving: counts.coliving + item.colivingCount,
      hostels: counts.hostels + item.hostelCount,
      meetingRooms: counts.meetingRooms + item.meetingRoomCount,
      cafes: counts.cafes + item.cafeCount,
    }),
    {
      blogs: 0,
      news: 0,
      events: 0,
      places: 0,
      restaurants: 0,
      publicListings: 0,
      coworking: 0,
      coliving: 0,
      hostels: 0,
      meetingRooms: 0,
      cafes: 0,
    },
  );

const hasContentData = (item) =>
  item.blogCount +
    item.newsCount +
    item.eventCount +
    item.placeCount +
    item.restaurantCount >
  0;

const hasListingData = (item) =>
  item.coworkingCount +
    item.colivingCount +
    item.hostelCount +
    item.meetingRoomCount +
    item.cafeCount >
  0;

const getDestinationListingDetails = async (req, res) => {
  const listings = await fetchNomadsCompanyListings();
  const requestedType = req.query.detailType;
  const destinationKey = normalizeKey(req.query.destination);
  const search = normalizeSearchValue(req.query.search);

  let filtered = listings.filter((listing) => {
    if (listing?.isActive === false || listing?.isDeleted === true) return false;
    if (!listingTypeMatches(listing?.companyType, requestedType)) return false;
    if (destinationKey) {
      const listingDestinationKey = normalizeKey(normalizeDestination(listing));
      if (!isSameDestinationKey(listingDestinationKey, destinationKey)) return false;
    }
    if (search) {
      return [
        listing.companyName,
        listing.companyTitle,
        listing.companyType,
        listing.city,
        listing.state,
        listing.country,
      ]
        .filter(Boolean)
        .some((value) => normalizeSearchValue(value).includes(search));
    }
    return true;
  });

  filtered = filtered.sort((left, right) => {
    const companyOrder = String(left.companyName || "").localeCompare(
      String(right.companyName || ""),
    );
    if (companyOrder !== 0) return companyOrder;
    return String(left.companyTitle || "").localeCompare(String(right.companyTitle || ""));
  });

  return res.status(200).json({
    items: filtered.map((item, index) => ({ ...item, srNo: index + 1 })),
    total: filtered.length,
  });
};

const getDestinationsData = async (req, res, next) => {
  try {
    if (normalizeSearchValue(req.query.tab) === "listings" && req.query.detailType) {
      return getDestinationListingDetails(req, res);
    }

    const activeTab = normalizeSearchValue(req.query.tab) === "listings" ? "listings" : "content";
    const allItems = await getCachedDestinationStats({
      includeListings: activeTab === "listings",
    });
    const contentItems = allItems.filter(hasContentData);
    const scopedItems = activeTab === "listings"
      ? allItems.filter(hasListingData)
      : contentItems;
    const country = normalizeSearchValue(req.query.country);
    const state = normalizeSearchValue(req.query.state);
    const city = normalizeSearchValue(req.query.city);
    const search = normalizeSearchValue(req.query.search);

    const countryScoped = country
      ? scopedItems.filter((item) => normalizeSearchValue(item.country) === country)
      : scopedItems;
    const stateScoped = state
      ? countryScoped.filter((item) =>
          item.states.some((value) => normalizeSearchValue(value) === state),
        )
      : countryScoped;

    let filtered = stateScoped;
    if (city) {
      filtered = filtered.filter((item) =>
        item.cities.some((value) => normalizeSearchValue(value) === city),
      );
    }
    if (search) {
      filtered = filtered.filter((item) =>
        [
          item.destination,
          item.country,
          item.continent,
          ...item.states,
          ...item.cities,
        ].some((value) => normalizeSearchValue(value).includes(search)),
      );
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const start = (page - 1) * limit;
    const total = filtered.length;

    const countries = Array.from(
      new Set(scopedItems.map((item) => item.country).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    const states = Array.from(
      new Set(countryScoped.flatMap((item) => item.states).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    const cities = Array.from(
      new Set(stateScoped.flatMap((item) => item.cities).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      items: filtered.slice(start, start + limit).map((item, index) => ({
        ...item,
        srNo: start + index + 1,
      })),
      page,
      limit,
      total,
      hasMore: page * limit < total,
      counts: {
        destinations: contentItems.length,
        ...summarize(scopedItems),
      },
      filterOptions: { countries, states, cities },
    });
  } catch (error) {
    next(error);
  }
};

const computeClientOpportunity = (factors) => {
  if (!factors) return null;
  const { targetBusinessSupply, tourismAccommodationBase, marketScale } = factors;
  if ([targetBusinessSupply, tourismAccommodationBase, marketScale].some((value) => typeof value !== "number")) return null;
  return Number((targetBusinessSupply * 0.6 + tourismAccommodationBase * 0.25 + marketScale * 0.15).toFixed(2));
};

const computeFinalScore = (factors) => {
  const clientOpportunity = computeClientOpportunity(factors);
  if (clientOpportunity === null) return null;
  const { nomadDemandCommunity, remoteWorkInfrastructure, businessJobsEcosystem, flightConnectivity, affordability, visaEntryAccessibility, safetyHealthcare } = factors;
  const weighted = [nomadDemandCommunity, remoteWorkInfrastructure, businessJobsEcosystem, flightConnectivity, affordability, visaEntryAccessibility, safetyHealthcare];
  if (weighted.some((value) => typeof value !== "number")) return null;
  return Number((
    clientOpportunity * 0.35
    + nomadDemandCommunity * 0.20
    + remoteWorkInfrastructure * 0.15
    + businessJobsEcosystem * 0.10
    + flightConnectivity * 0.07
    + affordability * 0.05
    + visaEntryAccessibility * 0.05
    + safetyHealthcare * 0.03
  ).toFixed(2));
};

const getMissingFactorKeys = (factors = {}) => WonoDestinationRanking.FACTOR_KEYS
  .filter((key) => typeof factors[key] !== "number" || factors[key] < 0 || factors[key] > 100);

const recomputeActiveRanking = async () => {
  const activeRows = await WonoDestinationRanking.find({ isActive: true });
  const scored = activeRows
    .map((row) => ({ row, score: computeFinalScore(row.factors) }))
    .sort((left, right) => right.score - left.score);

  const total = scored.length;
  const p1Count = Math.round(total * 0.2);
  const p4Count = Math.round(total * 0.2);
  const remaining = total - p1Count - p4Count;
  const p2Count = Math.round(remaining / 2);

  const operations = scored.map(({ row, score }, index) => {
    const rank = index + 1;
    let priority = "P3";
    if (index < p1Count) priority = "P1";
    else if (index < p1Count + p2Count) priority = "P2";
    else if (index >= total - p4Count) priority = "P4";
    return { updateOne: { filter: { _id: row._id }, update: { $set: { rank, priority, score } } } };
  });

  if (operations.length) await WonoDestinationRanking.bulkWrite(operations);
};

const getWonoDestinationAnalytics = async (req, res, next) => {
  try {
    const priority = String(req.query.priority || "").trim().toUpperCase();
    const continent = normalizeSearchValue(req.query.continent);
    const search = normalizeSearchValue(req.query.search);
    const includeInactive = String(req.query.includeInactive || "").trim() === "true";

    const dbRows = await WonoDestinationRanking.find(includeInactive ? {} : { isActive: true })
      .sort({ rank: 1 })
      .lean();
    const rankingRows = dbRows.map((row) => ({
      ...row,
      priorityLabel: row.priority ? priorityLabels[row.priority] : null,
      clientOpportunity: computeClientOpportunity(row.factors),
      missingFactors: getMissingFactorKeys(row.factors),
    }));
    const activeRows = rankingRows.filter((row) => row.isActive);

    const filtered = rankingRows.filter((row) => {
      if (priority && row.priority !== priority) return false;
      if (continent && normalizeSearchValue(row.continent) !== continent) return false;
      if (!search) return true;
      return [row.destination, row.country, row.continent, row.priority, row.priorityLabel]
        .some((value) => normalizeSearchValue(value).includes(search));
    });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(250, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const start = (page - 1) * limit;
    const prioritySummary = Object.keys(priorityLabels).map((key) => {
      const rows = activeRows.filter((row) => row.priority === key);
      return {
        priority: key,
        label: priorityLabels[key],
        count: rows.length,
        rankRange: rows.length ? `${rows[0].rank}–${rows[rows.length - 1].rank}` : "—",
        averageScore: rows.length ? Number((rows.reduce((sum, row) => sum + row.score, 0) / rows.length).toFixed(2)) : 0,
      };
    });
    const continentSummary = Array.from(new Set(activeRows.map((row) => row.continent)))
      .sort((left, right) => left.localeCompare(right))
      .map((name) => {
        const rows = activeRows.filter((row) => row.continent === name);
        return {
          continent: name,
          count: rows.length,
          averageScore: Number((rows.reduce((sum, row) => sum + row.score, 0) / rows.length).toFixed(2)),
        };
      });
    return res.status(200).json({
      items: filtered.slice(start, start + limit),
      page,
      limit,
      total: filtered.length,
      hasMore: page * limit < filtered.length,
      summary: {
        destinations: activeRows.length,
        countries: new Set(activeRows.map((row) => row.country)).size,
        continents: continentSummary.length,
        averageScore: activeRows.length ? Number((activeRows.reduce((sum, row) => sum + row.score, 0) / activeRows.length).toFixed(2)) : 0,
        pending: rankingRows.length - activeRows.length,
        prioritySummary,
        continentSummary,
        sourceSnapshot: "2026-10-14",
      },
      filterOptions: {
        continents: continentSummary.map((row) => row.continent),
        priorities: Object.keys(priorityLabels).map((key) => ({ key, label: priorityLabels[key] })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createWonoDestination = async (req, res, next) => {
  try {
    const { destination, country, continent, factors = {}, isActive } = req.body;
    if (!destination?.trim() || !country?.trim() || !continent?.trim()) {
      return res.status(400).json({ message: "Destination, country and continent are required." });
    }

    const missingFactors = getMissingFactorKeys(factors);
    if (isActive && missingFactors.length) {
      return res.status(400).json({ message: `Cannot activate: missing factors — ${missingFactors.join(", ")}` });
    }

    const doc = await WonoDestinationRanking.create({
      destination: destination.trim(),
      country: country.trim(),
      continent: continent.trim(),
      factors,
      isActive: Boolean(isActive) && !missingFactors.length,
    });

    await recomputeActiveRanking();
    const saved = await WonoDestinationRanking.findById(doc._id).lean();
    return res.status(201).json({
      ...saved,
      priorityLabel: saved.priority ? priorityLabels[saved.priority] : null,
      clientOpportunity: computeClientOpportunity(saved.factors),
      missingFactors: getMissingFactorKeys(saved.factors),
    });
  } catch (error) {
    next(error);
  }
};

const updateWonoDestination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await WonoDestinationRanking.findById(id);
    if (!existing) return res.status(404).json({ message: "Destination not found." });

    const { destination, country, continent, factors, isActive } = req.body;
    if (destination?.trim()) existing.destination = destination.trim();
    if (country?.trim()) existing.country = country.trim();
    if (continent?.trim()) existing.continent = continent.trim();
    if (factors && typeof factors === "object") {
      existing.factors = { ...(existing.factors?.toObject?.() || existing.factors || {}), ...factors };
    }

    const nextActive = isActive === undefined ? existing.isActive : Boolean(isActive);
    const missingFactors = getMissingFactorKeys(existing.factors);
    if (nextActive && missingFactors.length) {
      return res.status(400).json({ message: `Cannot activate: missing factors — ${missingFactors.join(", ")}` });
    }
    existing.isActive = nextActive;
    if (!nextActive) {
      existing.rank = null;
      existing.priority = null;
      existing.score = null;
    }

    await existing.save();
    await recomputeActiveRanking();
    const saved = await WonoDestinationRanking.findById(id).lean();
    return res.status(200).json({
      ...saved,
      priorityLabel: saved.priority ? priorityLabels[saved.priority] : null,
      clientOpportunity: computeClientOpportunity(saved.factors),
      missingFactors: getMissingFactorKeys(saved.factors),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDestinationsData,
  getWonoDestinationAnalytics,
  createWonoDestination,
  updateWonoDestination,
};
