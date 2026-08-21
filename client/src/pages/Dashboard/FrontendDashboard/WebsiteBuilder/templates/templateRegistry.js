import ClassicTemplate from "../ClassicTemplate";
import FreshStudioTemplate from "./FreshStudioTemplate";
import WarmOrganicTemplate from "./WarmOrganicTemplate";
import EmeraldStudioTemplate from "./EmeraldStudioTemplate";

export const DEFAULT_TEMPLATE_ID = "default";

// Keyed by the `themeVariant` value stored on WebsiteTemplate documents.
// Any themeVariant not present here falls back to DEFAULT_TEMPLATE_ID.
// Kept in sync with HostPanel's templateRegistry.ts and Nomads'
// templateRegistry.js — same IDs, same fallback rule. Minimal Swiss is
// intentionally not ported here — it's hidden/deprecated in HostPanel too.
export const TEMPLATE_REGISTRY = {
  [DEFAULT_TEMPLATE_ID]: {
    id: DEFAULT_TEMPLATE_ID,
    name: "Classic",
    description: "The original WoNo layout — clean, spacious, corporate.",
    component: ClassicTemplate,
    swatch: {
      bg: "#e9e9e9",
      fg: "#1f1f1f",
      accent: "#3b82f6",
      font: "'Poppins', sans-serif",
    },
  },
  "fresh-studio": {
    id: "fresh-studio",
    name: "Fresh Studio",
    description:
      "Clean, structured, and accessible — near-black text on white with a fresh green accent, pill buttons.",
    component: FreshStudioTemplate,
    swatch: {
      bg: "#ffffff",
      fg: "#0e0e0e",
      accent: "#D94B4B",
      font: "'Proxima Nova', sans-serif",
    },
  },
  "warm-organic": {
    id: "warm-organic",
    name: "Warm Organic",
    description:
      "Serif headings, blob-cropped imagery, rust/forest/sand palette, soft rounded cards.",
    component: WarmOrganicTemplate,
    swatch: {
      bg: "#F1E6D3",
      fg: "#2B211A",
      accent: "#B85C38",
      font: "Georgia, serif",
    },
  },
  "emerald-studio": {
    id: "emerald-studio",
    name: "Emerald Studio",
    description:
      "Dark emerald canvas, amber gold accents, Fraunces serif headings — elegant and bold.",
    component: EmeraldStudioTemplate,
    swatch: {
      bg: "#052e21",
      fg: "#e7e5e4",
      accent: "#d4a843",
      font: "'Fraunces', Georgia, serif",
    },
  },
};

export const resolveTemplate = (themeVariant) => {
  const key = String(themeVariant || "").trim();
  return TEMPLATE_REGISTRY[key] || TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
};
