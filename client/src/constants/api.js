const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const NOMADS_BACKEND_URL = stripTrailingSlash(
  import.meta.env.VITE_NOMADS_BACKEND_URL ||
    import.meta.env.VITE_VALUE_ADDS_API_BASE_URL ||
    "https://wononomadsbe.vercel.app",
);

export const NOMADS_API_BASE_URL = `${NOMADS_BACKEND_URL}/api`;
