import ClassicTemplate from "../ClassicTemplate";
import FreshStudioTemplate from "./FreshStudioTemplate";
import WarmOrganicTemplate from "./WarmOrganicTemplate";
import EmeraldStudioTemplate from "./EmeraldStudioTemplate";
import SavorTemplate from "./savor/SavorTemplate";
import WayfarerTemplate from "./wayfarer/WayfarerTemplate";
import HavenTemplate from "./haven/HavenTemplate";
import CommonsTemplate from "./commons/CommonsTemplate";
import HuddleTemplate from "./huddle/HuddleTemplate";
export const DEFAULT_TEMPLATE_ID = "default";
// Keyed by the `themeVariant` value stored on WebsiteTemplate documents.
// Any themeVariant not present here falls back to DEFAULT_TEMPLATE_ID.
// Kept in sync with HostPanel's templateRegistry.ts. Minimal Swiss is intentionally not ported here.
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
        description: "Clean, structured, and accessible — near-black text on white with a fresh green accent, pill buttons.",
        component: FreshStudioTemplate,
        swatch: {
            bg: "#ffffff",
            fg: "#0e0e0e",
            accent: "#D94B4B",
            font: "'Proxima Nova', sans-serif",
        },
    },
    savor: {
        id: "savor",
        name: "Savor",
        description: "Photo-first and menu-led — category browsing, filters and a built-in reservation flow. Made for cafés, works for any service.",
        component: SavorTemplate,
        swatch: {
            bg: "#fff7ed",
            fg: "#2a1a12",
            accent: "#e4572e",
            font: "'Bricolage Grotesque', sans-serif",
        },
        recommendedFor: ["menu"],
        supportsBooking: true,
    },
    wayfarer: {
        id: "wayfarer",
        name: "Wayfarer",
        description: "Booking-led — a search bar in the hero, results-style stay lists with filters and a sticky booking card. Made for hostels, works for any service.",
        component: WayfarerTemplate,
        swatch: {
            bg: "#f3fbfa",
            fg: "#0c2a2e",
            accent: "#f26b3a",
            font: "'Sora', sans-serif",
        },
        recommendedFor: ["hostel"],
        supportsBooking: true,
    },
    haven: {
        id: "haven",
        name: "Haven",
        description: "Residence-led — arch-framed photos, room cards with a side-by-side compare view and a visit form on the home page. Made for co-living and workation stays, works for any service.",
        component: HavenTemplate,
        swatch: {
            bg: "#f4f1ea",
            fg: "#26312b",
            accent: "#5b7f6a",
            font: "'Fraunces', Georgia, serif",
        },
        recommendedFor: ["coLiving", "workation"],
        supportsBooking: true,
    },
    commons: {
        id: "commons",
        name: "Commons",
        description: "Co-working style — a bold headline over a bento grid, an interactive space explorer and a visit form on the home page. Enquiry-led, no plan tables. Made for co-working, works for any service.",
        component: CommonsTemplate,
        swatch: {
            bg: "#f6f7f9",
            fg: "#0b1f3a",
            accent: "#ffc21a",
            font: "'Plus Jakarta Sans', sans-serif",
        },
        recommendedFor: ["workspace"],
        supportsBooking: true,
    },
    huddle: {
        id: "huddle",
        name: "Huddle",
        description: "Booking-led — a date, time and duration panel on the home page that filters the rooms, room rows with hourly rates and a rate table. Made for meeting rooms, works for any service.",
        component: HuddleTemplate,
        swatch: {
            bg: "#f5f6f8",
            fg: "#14161a",
            accent: "#3b6cf0",
            font: "'Sora', sans-serif",
        },
        recommendedFor: ["meeting"],
        supportsBooking: true,
    },
    "warm-organic": {
        id: "warm-organic",
        name: "Warm Organic",
        description: "Serif headings, blob-cropped imagery, rust/forest/sand palette, soft rounded cards.",
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
        description: "Light steel-blue canvas, frosted panels, white accents and Fraunces serif headings — calm, clean and modern.",
        component: EmeraldStudioTemplate,
        swatch: {
            bg: "#4a6b96",
            fg: "#ffffff",
            accent: "#dbeafe",
            font: "'Fraunces', Georgia, serif",
        },
    },
    // Backward-compatible renderer alias for previews saved before the rename.
    "figma-make": {
        id: "figma-make",
        name: "Emerald Studio",
        description: "Light steel-blue canvas, frosted panels, white accents and Fraunces serif headings — calm, clean and modern.",
        component: EmeraldStudioTemplate,
        swatch: {
            bg: "#4a6b96",
            fg: "#ffffff",
            accent: "#dbeafe",
            font: "'Fraunces', Georgia, serif",
        },
        hidden: true,
    },
};
/** Picker-visible template ids recommended for any of the given service kinds, in order. */
export const getRecommendedTemplateIds = (kinds) => {
    const ids = [];
    kinds.forEach((kind) => {
        Object.values(TEMPLATE_REGISTRY).forEach((template) => {
            if (!template.hidden && template.recommendedFor?.includes(kind) && !ids.includes(template.id))
                ids.push(template.id);
        });
    });
    return ids;
};
export const resolveTemplate = (themeVariant) => {
    const key = String(themeVariant || "").trim();
    return TEMPLATE_REGISTRY[key] || TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_ID];
};
