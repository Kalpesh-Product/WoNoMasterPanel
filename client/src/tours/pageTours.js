// Registry of per-page driver.js guides for the Master Panel.
//
// Each entry matches one or more routes and describes the steps the guide
// walks through. Tag the elements a step should highlight with a
// `data-tour="..."` attribute and reference that same string as `selector`
// below (or use `text` to match visible label/placeholder/aria-label text
// when you can't add an attribute). See usePageTour.js for how these are
// consumed.
//
// Bump a tour's `version` whenever you change its steps meaningfully — a
// higher version re-triggers the auto-start for users who already completed
// or skipped the older version.

const exact = (path) => (pathname) => pathname === path || pathname === `${path}/`;
const startsWith = (path) => (pathname) =>
  pathname === path || pathname.startsWith(`${path}/`);

const PAGE_TOURS = [
  // Example — copy this shape for each page you wire up:
  // {
  //   id: "dashboard-overview",
  //   version: 1,
  //   title: "Dashboard overview",
  //   description: "See what this dashboard tracks and where to drill in.",
  //   matches: exact("/dashboard"),
  //   steps: [
  //     {
  //       selector: '[data-tour="dashboard-summary-cards"]',
  //       title: "Key numbers at a glance",
  //       description: "These cards summarize the most important metrics for this section.",
  //     },
  //     {
  //       selector: '[data-tour="dashboard-guide-button"]',
  //       title: "Replay this guide",
  //       description: "Select Guide beside the page heading whenever you want to see this walkthrough again.",
  //     },
  //   ],
  // },
];

const FALLBACK_TOUR_VERSION = 1;

const titleFromPath = (pathname) => {
  const pathParts = pathname.split("/").filter(Boolean);
  const part = pathParts[pathParts.length - 1] || "page";
  return part
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

// Returns the tour definition for the given pathname, or null when the page
// has neither a registered tour nor any page-content marked up with
// data-tour="page-content" (see usePageTour.js's fallback-target check).
export const getPageTour = (pathname) => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = PAGE_TOURS.find((tour) => tour.matches(normalizedPath));
  if (match) {
    const { matches: _matches, ...tour } = match;
    return tour;
  }

  const routeKey = normalizedPath
    .replace(/^\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return {
    id: `page-${routeKey || "overview"}`,
    version: FALLBACK_TOUR_VERSION,
    title: titleFromPath(normalizedPath),
    description: "Use this page to review the available information and complete the actions provided here.",
    formDescription: "Complete the visible fields carefully and review the information before saving.",
    recordsDescription: "Use the available search, filters, and row actions to work with these records.",
  };
};

export { exact, startsWith };
