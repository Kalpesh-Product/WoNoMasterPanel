const axios = require("axios");
const HostCompany = require("../models/hostCompany/hostCompany");

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

let destinationCache = { items: null, fetchedAt: 0 };
let destinationRefreshPromise = null;

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
    });
    return toArray(response.data);
  } catch (error) {
    console.error(`Failed to fetch destination source ${path}:`, error.message);
    return [];
  }
};

const buildDestinationStats = async () => {
  const [companies, blogs, news, events, places, restaurants] = await Promise.all([
    HostCompany.find()
      .select("companyCountry companyState companyCity companyContinent")
      .lean(),
    fetchNomadsRows("/blogs/blogs"),
    fetchNomadsRows("/news/news"),
    fetchNomadsRows("/events"),
    fetchNomadsRows("/places"),
    fetchNomadsRows("/restaurants"),
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
      if (entry) entry[countField] += 1;
    });
  });

  return destinationEntries
    .filter(
      (row) =>
        row.blogCount +
          row.newsCount +
          row.eventCount +
          row.placeCount +
          row.restaurantCount >
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

const refreshDestinationCache = () => {
  if (!destinationRefreshPromise) {
    destinationRefreshPromise = buildDestinationStats()
      .then((items) => {
        destinationCache = { items, fetchedAt: Date.now() };
        return items;
      })
      .finally(() => {
        destinationRefreshPromise = null;
      });
  }
  return destinationRefreshPromise;
};

const getCachedDestinationStats = async () => {
  const isFresh =
    destinationCache.items && Date.now() - destinationCache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return destinationCache.items;
  if (destinationCache.items) {
    refreshDestinationCache().catch((error) => {
      console.error("Background destination refresh failed:", error.message);
    });
    return destinationCache.items;
  }
  return refreshDestinationCache();
};

const summarize = (items) =>
  items.reduce(
    (counts, item) => ({
      destinations: counts.destinations + 1,
      blogs: counts.blogs + item.blogCount,
      news: counts.news + item.newsCount,
      events: counts.events + item.eventCount,
      places: counts.places + item.placeCount,
      restaurants: counts.restaurants + item.restaurantCount,
    }),
    { destinations: 0, blogs: 0, news: 0, events: 0, places: 0, restaurants: 0 },
  );

const getDestinationsData = async (req, res, next) => {
  try {
    const allItems = await getCachedDestinationStats();
    const country = normalizeSearchValue(req.query.country);
    const state = normalizeSearchValue(req.query.state);
    const city = normalizeSearchValue(req.query.city);
    const search = normalizeSearchValue(req.query.search);

    const countryScoped = country
      ? allItems.filter((item) => normalizeSearchValue(item.country) === country)
      : allItems;
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
      new Set(allItems.map((item) => item.country).filter(Boolean)),
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
      counts: summarize(allItems),
      filterOptions: { countries, states, cities },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDestinationsData };
