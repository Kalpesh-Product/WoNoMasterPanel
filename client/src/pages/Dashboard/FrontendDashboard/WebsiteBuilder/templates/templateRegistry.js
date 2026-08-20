import ClassicTemplate from "../ClassicTemplate";

export const DEFAULT_TEMPLATE_ID = "default";

// Keyed by the `themeVariant` value stored on WebsiteTemplate documents.
// Any themeVariant not present here falls back to DEFAULT_TEMPLATE_ID.
// Kept in sync with HostPanel's templateRegistry.ts and Nomads'
// templateRegistry.js — same IDs, same fallback rule.
export const TEMPLATE_REGISTRY = {
  [DEFAULT_TEMPLATE_ID]: {
    id: DEFAULT_TEMPLATE_ID,
    name: "Classic",
    description: "The original WoNo layout — clean, spacious, corporate.",
    component: ClassicTemplate,
  },
};

export const resolveTemplate = (themeVariant) => {
  const key = String(themeVariant || "").trim();
  return TEMPLATE_REGISTRY[key] || TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
};
