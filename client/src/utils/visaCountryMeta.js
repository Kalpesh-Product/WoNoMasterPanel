import { Country } from "country-state-city";

// The visa matrix stores only `destination` (a country name). This helper
// resolves the canonical country name, flag emoji and continent without any
// extra API call, using the country-state-city package already shipped with
// the Master Panel.

const ALL_COUNTRIES = Country.getAllCountries();

const normalizeKey = (value = "") =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const COUNTRY_ALIASES = {
  usa: "US",
  unitedstatesofamerica: "US",
  america: "US",
  uae: "AE",
  unitedarabemirates: "AE",
  turkey: "TR",
  turkiye: "TR",
  czechrepublic: "CZ",
  czechia: "CZ",
  thebahamas: "BS",
  thegambia: "GM",
  swaziland: "SZ",
  eswatini: "SZ",
  ivorycoast: "CI",
  cotedivoire: "CI",
  hongkong: "HK",
  hongkongsarchina: "HK",
  macao: "MO",
  macau: "MO",
  macaosarchina: "MO",
  macausarchina: "MO",
  saintkittsandnevis: "KN",
  stkittsandnevis: "KN",
  saintlucia: "LC",
  saintvincentandthegrenadines: "VC",
  stvincentandthegrenadines: "VC",
  russia: "RU",
  southkorea: "KR",
  northkorea: "KP",
  vietnam: "VN",
  laos: "LA",
  syria: "SY",
  iran: "IR",
  bolivia: "BO",
  venezuela: "VE",
  tanzania: "TZ",
  moldova: "MD",
  brunei: "BN",
  palestine: "PS",
  bosnia: "BA",
  kosovo: "XK",
};

const COUNTRY_LOOKUP = new Map();
ALL_COUNTRIES.forEach((country) => {
  COUNTRY_LOOKUP.set(normalizeKey(country.name), country);
  COUNTRY_LOOKUP.set(country.isoCode.toLowerCase(), country);
});
Object.entries(COUNTRY_ALIASES).forEach(([alias, isoCode]) => {
  const country = ALL_COUNTRIES.find(
    (item) => item.isoCode.toLowerCase() === isoCode.toLowerCase(),
  );
  if (country) COUNTRY_LOOKUP.set(alias, country);
});

const CONTINENT_OVERRIDES = {
  RU: "Europe",
  TR: "Europe",
  GE: "Asia",
  AM: "Asia",
  AZ: "Asia",
  CY: "Europe",
};

const continentFromTimezone = (country) => {
  if (CONTINENT_OVERRIDES[country.isoCode]) {
    return CONTINENT_OVERRIDES[country.isoCode];
  }

  const zone = country.timezones?.[0]?.zoneName || "";

  if (/^America\//.test(zone)) return "Americas";
  if (/^Europe\//.test(zone) || /^Atlantic\/(Reykjavik|Faeroe|Azores|Madeira|Canary)/.test(zone)) {
    return "Europe";
  }
  if (/^Asia\//.test(zone)) return "Asia";
  if (/^Africa\//.test(zone)) return "Africa";
  if (/^(Australia|Pacific)\//.test(zone) || zone === "Antarctica/Macquarie") {
    return "Oceania";
  }
  if (/^Indian\//.test(zone)) return "Asia";

  return "";
};

const resolveCountry = (value = "") => {
  const key = normalizeKey(value);
  return key ? COUNTRY_LOOKUP.get(key) || COUNTRY_LOOKUP.get(key.slice(0, 2)) : null;
};

export const getCountryMeta = (value = "") => {
  const country = resolveCountry(value);

  if (!country) {
    return { name: String(value || "").trim(), flag: "", continent: "" };
  }

  return {
    name: country.name,
    flag: country.flag || "",
    continent: continentFromTimezone(country),
  };
};

// Used to drop the origin passport from its own visa matrix — travelling from
// Egypt to Egypt is not a visa rule. Compares by normalized key first, then by
// resolved ISO code so aliases like "USA" / "United States" still match.
export const isSameCountry = (a = "", b = "") => {
  const keyA = normalizeKey(a);
  const keyB = normalizeKey(b);
  if (keyA && keyA === keyB) return true;

  const countryA = resolveCountry(a);
  const countryB = resolveCountry(b);
  return Boolean(countryA && countryB && countryA.isoCode === countryB.isoCode);
};

export const getAllPassportOptions = (countries = []) =>
  countries
    .filter(Boolean)
    .map((country) => ({ value: country, ...getCountryMeta(country) }))
    .sort((a, b) => a.name.localeCompare(b.name));
