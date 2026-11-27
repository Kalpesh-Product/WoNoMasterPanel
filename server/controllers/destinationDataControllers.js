const axios = require("axios");
const ExcelJS = require("exceljs");
const { Readable } = require("stream");
const HostCompany = require("../models/hostCompany/hostCompany");
const { fetchAllNomadListings } = require("./hostListingControllers");
const WonoDestinationRanking = require("../models/WonoDestinationRanking");

const priorityLabels = { P1: "Immediate Priority", P2: "High Priority", P3: "Medium Priority", P4: "Low Priority" };

const CACHE_TTL_MS = 10 * 60 * 1000;
const LISTINGS_INITIAL_WAIT_MS = 750;
// Minimum gap between two attempts when a source is down/empty, so client
// polling cannot hammer an already struggling Nomads backend.
const REFRESH_RETRY_MS = 30 * 1000;
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
const destinationRefreshAttempts = { content: 0, listings: 0 };
const nomadsCompanyListingsCache = { items: null, fetchedAt: 0 };
let nomadsCompanyListingsRefreshPromise = null;
let nomadsListingsRefreshAttemptAt = 0;
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

const requestNomadsRows = async (path, timeout = FETCH_TIMEOUT_MS) => {
  const response = await axios.get(`${NOMADS_BASE_URL}${path}`, {
    timeout,
    headers: process.env.NOMADS_ADMIN_API_KEY
      ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
      : {},
  });
  return toArray(response.data);
};

const fetchNomadsRows = async (path) => {
  try {
    return await requestNomadsRows(path);
  } catch (error) {
    console.error(`Failed to fetch destination source ${path}:`, error.message);
    return [];
  }
};

// Listing details still read the full listing records. The summary uses
// grouped counts when the Nomads server supports them.
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

      // An empty cold crawl is not a successful refresh — leave the cache
      // stale so the next poll can try again after the retry cooldown.
      nomadsCompanyListingsCache.items = items;
      nomadsCompanyListingsCache.fetchedAt = items.length ? Date.now() : 0;
      return items;
    })().finally(() => {
      nomadsCompanyListingsRefreshPromise = null;
    });
  }

  return nomadsCompanyListingsRefreshPromise;
};

// Non-blocking variant used by request handlers: a cold cache must never hold
// the HTTP response hostage while the Nomads backend is slow/unavailable.
// The caller gets an empty page plus a refresh flag and polls until the
// background crawl lands in the cache.
const getNomadsCompanyListingsState = () => {
  const isFresh =
    nomadsCompanyListingsCache.items &&
    Date.now() - nomadsCompanyListingsCache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) {
    return {
      items: nomadsCompanyListingsCache.items,
      isRefreshing: false,
      isInitialLoading: false,
    };
  }

  if (
    !nomadsCompanyListingsRefreshPromise &&
    Date.now() - nomadsListingsRefreshAttemptAt >= REFRESH_RETRY_MS
  ) {
    nomadsListingsRefreshAttemptAt = Date.now();
    refreshNomadsCompanyListingsCache().catch((error) => {
      console.error("Background Nomads company listings refresh failed:", error.message);
    });
  }

  return {
    items: nomadsCompanyListingsCache.items || [],
    isRefreshing: true,
    isInitialLoading: !nomadsCompanyListingsCache.items,
  };
};

const fetchNomadsCompanyListings = async () => {
  const state = getNomadsCompanyListingsState();
  if (state.isInitialLoading) {
    // Used by buildDestinationStats, which runs as a background refresh and
    // needs to wait for the crawl rather than return an empty snapshot.
    await nomadsCompanyListingsRefreshPromise;
    return nomadsCompanyListingsCache.items || [];
  }
  return state.items;
};

// Bypasses the stale-while-revalidate fast path above: fetchNomadsCompanyListings
// happily returns a snapshot that's minutes old and refreshes in the
// background without ever waiting on it, which is fine for a dashboard count
// but wrong for a dry run — a "not found" there has to reflect Nomads right
// now, not whatever was cached the last time anything touched this list.
// This does NOT reuse refreshNomadsCompanyListingsCache: that helper falls
// back to fetchAllNomadListings()'s slow per-company crawl whenever the
// direct call comes back empty, and uses a 3-minute timeout doing it — fine
// for a background refresh, but it turned one slow/failed Nomads response
// into a multi-minute hang that a reverse-proxy tunnel (100s patience) kills
// as a bare "Request failed". A live dry run needs to fail fast instead, and
// fall back to the last known-good cache rather than block on a crawl.
// Kept a little under CloudFront's origin response timeout (60s max without
// an AWS support request) so our own clear error message wins the race
// against CloudFront's generic gateway-timeout page if Nomads is ever this
// slow.
const FRESH_FETCH_TIMEOUT_MS = 55 * 1000;
const fetchFreshNomadsCompanyListings = async () => {
  try {
    const items = await requestNomadsRows("/company/companies", FRESH_FETCH_TIMEOUT_MS);
    if (items.length) {
      nomadsCompanyListingsCache.items = items;
      nomadsCompanyListingsCache.fetchedAt = Date.now();
      return items;
    }
  } catch (error) {
    console.error("Live Nomads company directory fetch failed:", error.message);
  }
  // Live fetch failed or came back empty — fall back to whatever is cached
  // (even if stale) rather than fail the whole request outright.
  if (nomadsCompanyListingsCache.items?.length) return nomadsCompanyListingsCache.items;
  throw new Error("Could not reach the Nomads company directory. Try again in a moment.");
};

const fetchNomadListingCounts = async () => {
  try {
    return await requestNomadsRows("/company/destination-listing-counts", 15000);
  } catch (error) {
    if (error.response?.status !== 404) throw error;

    // A Master Panel deployment may precede the new Nomads endpoint.
    return fetchNomadsCompanyListings();
  }
};

let destinationSourcesPromise;
const fetchDestinationSources = () => {
  if (!destinationSourcesPromise) {
    // Both summaries use these sources. Share the work while requests overlap.
    destinationSourcesPromise = Promise.all([
      HostCompany.find()
        .select("companyCountry companyState companyCity companyContinent")
        .lean(),
      fetchNomadsRows("/blogs/destination-counts"),
      fetchNomadsRows("/news/destination-counts"),
      fetchNomadsRows("/events"),
      fetchNomadsRows("/places"),
      fetchNomadsRows("/restaurants"),
    ]).finally(() => {
      destinationSourcesPromise = null;
    });
  }
  return destinationSourcesPromise;
};

const buildDestinationStats = async ({ includeListings = false } = {}) => {
  const [[companies, blogs, news, events, places, restaurants], listings] = await Promise.all([
    fetchDestinationSources(),
    includeListings ? fetchNomadListingCounts() : Promise.resolve([]),
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
    entry[countField] += listing.count ?? 1;
    entry.publicListingCount += listing.publicCount ?? (listing.isPublic === true ? 1 : 0);
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
        if (items.length === 0 && previousItems?.length) {
          destinationCaches[scope] = { items: previousItems, fetchedAt: Date.now() };
          return previousItems;
        }
        destinationCaches[scope] = {
          items,
          fetchedAt: items.length ? Date.now() : 0,
        };
        return items;
      })
      .finally(() => {
        destinationRefreshPromises[scope] = null;
      });
  }
  return destinationRefreshPromises[scope];
};

// Same non-blocking contract as getNomadsCompanyListingsState: serve whatever
// is cached immediately, refresh in the background, and tell the client to
// poll while the first crawl is still running. Previously a cold cache made
// this endpoint wait on multi-minute Nomads queries, so the page looked stuck.
const getCachedDestinationStats = ({ includeListings = false } = {}) => {
  const scope = includeListings ? "listings" : "content";
  const destinationCache = destinationCaches[scope];
  const isFresh =
    destinationCache.items && Date.now() - destinationCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) {
    return {
      items: destinationCache.items,
      isRefreshing: false,
      isInitialLoading: false,
    };
  }

  if (
    !destinationRefreshPromises[scope] &&
    Date.now() - destinationRefreshAttempts[scope] >= REFRESH_RETRY_MS
  ) {
    destinationRefreshAttempts[scope] = Date.now();
    refreshDestinationCache(scope, { includeListings }).catch((error) => {
      console.error("Background destination refresh failed:", error.message);
    });
  }

  return {
    items: destinationCache.items || [],
    isRefreshing: true,
    isInitialLoading: !destinationCache.items,
  };
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
  const {
    items: listings,
    isRefreshing,
    isInitialLoading,
  } = getNomadsCompanyListingsState();
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

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const start = (page - 1) * limit;
  const total = filtered.length;

  return res.status(200).json({
    items: filtered.slice(start, start + limit).map((item, index) => ({
      ...item,
      srNo: start + index + 1,
    })),
    page,
    limit,
    total,
    hasMore: page * limit < total,
    isRefreshing,
    isInitialLoading,
  });
};

const getDestinationsData = async (req, res, next) => {
  try {
    if (normalizeSearchValue(req.query.tab) === "listings" && req.query.detailType) {
      return getDestinationListingDetails(req, res);
    }

    const activeTab = normalizeSearchValue(req.query.tab) === "listings" ? "listings" : "content";
    const includeListings = activeTab === "listings";
    let snapshot = getCachedDestinationStats({ includeListings });
    const listingsRefresh = destinationRefreshPromises.listings;
    if (includeListings && snapshot.isInitialLoading && listingsRefresh) {
      // A quick refresh can satisfy the first request without a client poll.
      let timer;
      await Promise.race([
        listingsRefresh.catch(() => {}),
        new Promise((resolve) => { timer = setTimeout(resolve, LISTINGS_INITIAL_WAIT_MS); }),
      ]);
      clearTimeout(timer);
      snapshot = getCachedDestinationStats({ includeListings });
    }
    const { items: allItems, isRefreshing, isInitialLoading } = snapshot;
    const contentItems = allItems.filter(hasContentData);
    const scopedItems = activeTab === "listings"
      ? allItems.filter(hasListingData)
      : contentItems;
    const continent = normalizeSearchValue(req.query.continent);
    const country = normalizeSearchValue(req.query.country);
    const state = normalizeSearchValue(req.query.state);
    const search = normalizeSearchValue(req.query.search);

    const continentScoped = continent
      ? scopedItems.filter((item) => normalizeSearchValue(item.continent) === continent)
      : scopedItems;
    const countryScoped = country
      ? continentScoped.filter((item) => normalizeSearchValue(item.country) === country)
      : continentScoped;
    const stateScoped = state
      ? countryScoped.filter((item) =>
          item.states.some((value) => normalizeSearchValue(value) === state),
        )
      : countryScoped;

    let filtered = stateScoped;
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

    const continents = Array.from(
      new Set(scopedItems.map((item) => item.continent).filter((value) => value && value !== "-")),
    ).sort((a, b) => a.localeCompare(b));
    const countries = Array.from(
      new Set(continentScoped.map((item) => item.country).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    const states = Array.from(
      new Set(countryScoped.flatMap((item) => item.states).filter(Boolean)),
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
      isRefreshing,
      isInitialLoading,
      counts: {
        destinations: contentItems.length,
        ...summarize(scopedItems),
      },
      filterOptions: { continents, countries, states },
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

// Header labels matching the data team's "Destination Ranking" sheet
// (Sequence Sheet _ 132 destinations) — same labels shown in the Ranking
// page's scoring-model guide, so the monthly refresh sheet lines up with the
// factors the formula actually uses. "Client Opportunity", "WoNo Priority
// Score", rank and priority are all recomputed from the factors below by
// recomputeActiveRanking() — the sheet's own copies of those are ignored on
// import, the same way editing one destination's factors here always does.
const RANKING_FIELD_LABELS = {
  country: "Country",
  continent: "Continent",
  targetBusinessSupply: "Target Business Supply",
  tourismAccommodationBase: "Tourism / Accommodation Base",
  marketScale: "Market Scale",
  nomadDemandCommunity: "Nomad Demand & Community",
  remoteWorkInfrastructure: "Remote Work Infrastructure",
  businessJobsEcosystem: "Business & Jobs Ecosystem",
  flightConnectivity: "Flight Connectivity",
  affordability: "Affordability",
  visaEntryAccessibility: "Visa Entry Accessibility",
  safetyHealthcare: "Safety / Healthcare",
};
const RANKING_HEADER_BY_FIELD = Object.fromEntries(
  Object.entries(RANKING_FIELD_LABELS).map(([field, label]) => [field, normalizeRankingHeader(label)]),
);

function normalizeRankingHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const rankingCellValue = (row, col) => {
  if (!col) return undefined;
  const value = row.getCell(col).value;
  return value && typeof value === "object" && "result" in value ? value.result : value;
};
const rankingCellStr = (row, col) => {
  const value = rankingCellValue(row, col);
  return value === null || value === undefined ? "" : String(value).trim();
};
const rankingCellNum = (row, col) => {
  const value = rankingCellValue(row, col);
  if (value === null || value === undefined || value === "") return undefined;
  return Number(value);
};

const rankingChangedFields = (existing, item) => {
  const fields = [];
  const pushIfChanged = (field, oldValue, newValue) => {
    if (oldValue === newValue) return;
    fields.push({ field, label: RANKING_FIELD_LABELS[field], oldValue: oldValue ?? null, newValue });
  };
  pushIfChanged("country", existing?.country ?? null, item.country);
  pushIfChanged("continent", existing?.continent ?? null, item.continent);
  WonoDestinationRanking.FACTOR_KEYS.forEach((field) => {
    pushIfChanged(field, existing?.factors?.[field] ?? null, item.factors[field]);
  });
  return fields;
};

// Monthly refresh of the global ranking's 10 scoring factors from the data
// team's CSV export (one row per destination). Upserts by destination name;
// ?dryRun=true previews the diff with no writes, same URL with no query
// commits it. Destinations missing from the sheet are left as-is — this
// never deletes or deactivates anything, and rank/priority/score are always
// recomputed from the factors, never read from the sheet.
const bulkImportDestinationRanking = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Upload a .csv file." });
    if (!/\.csv$/i.test(req.file.originalname || "")) {
      return res.status(400).json({ message: "Only .csv files are allowed." });
    }
    const dryRun = String(req.query.dryRun || "") === "true";

    const workbook = new ExcelJS.Workbook();
    await workbook.csv.read(Readable.from(req.file.buffer));
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ message: "The file has no readable rows." });

    const columnCount = sheet.actualColumnCount || sheet.columnCount;
    const headerRow = sheet.getRow(1);
    const columns = {};
    for (let col = 1; col <= columnCount; col += 1) {
      const header = normalizeRankingHeader(headerRow.getCell(col).value);
      if (header === "destination") columns.destination = col;
      else {
        const field = Object.keys(RANKING_HEADER_BY_FIELD).find((key) => RANKING_HEADER_BY_FIELD[key] === header);
        if (field) columns[field] = col;
      }
    }
    if (!columns.destination || !columns.country || !columns.continent) {
      return res.status(400).json({ message: 'Could not find "Destination", "Country" and "Continent" columns.' });
    }

    let processedRows = 0;
    const parsedRows = [];
    const rowErrors = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const destination = rankingCellStr(row, columns.destination);
      const country = rankingCellStr(row, columns.country);
      const continent = rankingCellStr(row, columns.continent);
      if (!destination && !country && !continent) return;
      processedRows += 1;

      if (!destination || !country || !continent) {
        rowErrors.push({ rowNumber, reason: "Missing destination, country or continent." });
        return;
      }

      const factors = {};
      const missing = [];
      WonoDestinationRanking.FACTOR_KEYS.forEach((field) => {
        const value = rankingCellNum(row, columns[field]);
        if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) missing.push(RANKING_FIELD_LABELS[field]);
        else factors[field] = value;
      });
      if (missing.length) {
        rowErrors.push({ rowNumber, destination, reason: `Missing or invalid (must be 0-100): ${missing.join(", ")}.` });
        return;
      }

      parsedRows.push({ rowNumber, destination, country, continent, factors });
    });

    if (!parsedRows.length) {
      return res.status(200).json({
        processedRows,
        willInsertCount: 0,
        willUpdateCount: 0,
        unchangedCount: 0,
        rowErrors,
        preview: [],
        message: "No valid destination rows were found. Nothing was changed.",
      });
    }

    const key = (value) => String(value || "").trim().toLowerCase();
    const existingDocs = await WonoDestinationRanking.find({}).lean();
    const existingByKey = new Map(existingDocs.map((doc) => [key(doc.destination), doc]));

    let willInsertCount = 0;
    let willUpdateCount = 0;
    let unchangedCount = 0;
    const preview = [];
    const operations = [];

    parsedRows.forEach((item) => {
      const existing = existingByKey.get(key(item.destination));
      const changedFields = rankingChangedFields(existing, item);

      if (existing && !changedFields.length) {
        unchangedCount += 1;
        return;
      }

      const action = existing ? "update" : "insert";
      if (action === "insert") willInsertCount += 1; else willUpdateCount += 1;
      preview.push({
        id: existing ? String(existing._id) : key(item.destination),
        destination: item.destination,
        country: item.country,
        continent: item.continent,
        rowNumber: item.rowNumber,
        action,
        changedFields,
      });

      if (existing) {
        operations.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: { country: item.country, continent: item.continent, factors: item.factors, isActive: true } },
          },
        });
      } else {
        operations.push({
          insertOne: {
            document: { destination: item.destination, country: item.country, continent: item.continent, factors: item.factors, isActive: true },
          },
        });
      }
    });

    if (dryRun) {
      return res.status(200).json({ processedRows, willInsertCount, willUpdateCount, unchangedCount, rowErrors, preview });
    }

    let matchedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;
    if (operations.length) {
      const result = await WonoDestinationRanking.bulkWrite(operations);
      matchedCount = result.matchedCount || 0;
      modifiedCount = result.modifiedCount || 0;
      upsertedCount = result.insertedCount || 0;
      await recomputeActiveRanking();
    }

    return res.status(200).json({
      message: "Destination ranking updated from CSV.",
      processedRows,
      matchedCount,
      modifiedCount,
      upsertedCount,
      rowErrors,
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
  bulkImportDestinationRanking,
  fetchNomadsCompanyListings,
  fetchFreshNomadsCompanyListings,
};
