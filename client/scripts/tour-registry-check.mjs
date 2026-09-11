// Assertions for the page-tour registry.
//
// A naive "returns an object with a title" check can never fail, because
// getPageTour always generates a fallback tour when nothing registered
// matches. This script instead pins each path to the tour id that MUST
// match — so matcher regressions, matcher-order collisions and accidentally
// deleted registrations all fail here. The "page-*" prefix marks the
// generated fallback; every routed page in the table must resolve to a real
// registered tour (the unknown-route entry at the end expects the fallback).
//
// Run: node scripts/tour-registry-check.mjs  (exit code 1 on any mismatch)
import { getPageTour } from "../src/tours/pageTours.js";

const EXPECTED = [
  // --- Dashboard section ---
  { path: "/dashboard", expectedId: "dashboard-overview" },
  { path: "/dashboard/signup-leads", expectedId: "signup-leads" },
  { path: "/dashboard/all-leads/all-enquiry", expectedId: "all-leads" },
  { path: "/dashboard/all-leads/job-applications", expectedId: "all-leads" },
  { path: "/dashboard/value-adds-leads/visa-support", expectedId: "value-adds-leads" },
  { path: "/dashboard/access-tree", expectedId: "access-tree" },
  { path: "/dashboard/requested-services", expectedId: "requested-services" },
  { path: "/dashboard/data-upload/company-upload", expectedId: "data-upload" },
  { path: "/dashboard/data-upload/bulk-upload-images", expectedId: "data-upload" },
  { path: "/dashboard/publish-listings", expectedId: "publish-listings" },
  { path: "/dashboard/nomad-signup-leads", expectedId: "nomad-signup-leads" },
  { path: "/dashboard/nomad-click-analytics", expectedId: "nomad-click-analytics" },
  { path: "/dashboard/nomad-click-analytics/listings", expectedId: "nomad-listing-analytics" },
  { path: "/dashboard/inactive-websites", expectedId: "inactive-websites" },
  { path: "/dashboard/profile/my-profile", expectedId: "my-profile" },
  { path: "/dashboard/profile/change-password", expectedId: "change-password" },
  { path: "/profile/my-profile", expectedId: "my-profile" },
  { path: "/profile/change-password", expectedId: "change-password" },
  { path: "/dashboard/logs-layout", expectedId: "logs" },
  { path: "/dashboard/module-access-logs", expectedId: "module-access-logs" },
  { path: "/dashboard/host-panel-logs", expectedId: "host-panel-logs" },
  { path: "/dashboard/host-panel-analytics", expectedId: "host-panel-analytics" },
  { path: "/dashboard/host-panel-analytics/abc123", expectedId: "host-panel-analytics" },
  { path: "/dashboard/master-panel-analytics", expectedId: "master-panel-analytics" },
  { path: "/dashboard/website-credits", expectedId: "website-credits" },
  { path: "/dashboard/website-templates", expectedId: "website-templates" },
  { path: "/dashboard/company-reviews/approved", expectedId: "company-reviews" },
  { path: "/dashboard/value-adds-partners/consultation", expectedId: "value-adds-partners" },
  { path: "/dashboard/destinations-data", expectedId: "destinations-data" },
  { path: "/dashboard/destinations-data/country/add", expectedId: "destinations-data" },
  { path: "/dashboard/world-ranking-weights", expectedId: "world-ranking-weights" },
  { path: "/dashboard/visa-countries", expectedId: "visa-countries" },
  { path: "/dashboard/master-panel-users", expectedId: "master-panel-users" },
  { path: "/dashboard/add-master-user", expectedId: "add-master-user" },
  { path: "/dashboard/companies", expectedId: "companies-shell" },
  { path: "/dashboard/companies/list", expectedId: "companies-list" },
  { path: "/dashboard/companies/requests", expectedId: "companies-requests" },
  { path: "/dashboard/companies/requests/xyz", expectedId: "companies-requests" },
  { path: "/dashboard/companies/add-company", expectedId: "company-forms" },
  { path: "/dashboard/companies/edit-company/xyz", expectedId: "company-forms" },
  { path: "/dashboard/companies/xyz", expectedId: "company-overview" },
  { path: "/dashboard/companies/xyz/wono-nomads", expectedId: "company-wono-nomads" },
  { path: "/dashboard/companies/xyz/nomad-listings/add", expectedId: "company-nomad-listings" },
  { path: "/dashboard/companies/xyz/website-builder/create-website", expectedId: "company-website-builder" },
  { path: "/dashboard/companies/xyz/data/leads", expectedId: "company-data" },
  { path: "/dashboard/companies/xyz/settings/sops", expectedId: "company-settings" },
  { path: "/dashboard/companies/xyz/finance/budget", expectedId: "company-finance" },
  { path: "/dashboard/companies/xyz/poc-details", expectedId: "company-poc-details" },
  { path: "/dashboard/host-companies", expectedId: "host-companies" },
  { path: "/dashboard/host-companies/abc", expectedId: "host-company-overview" },
  { path: "/dashboard/host-companies/abc/upgrade-plan", expectedId: "host-company-upgrade-plan" },
  { path: "/dashboard/host-companies/abc/module-access", expectedId: "host-company-module-access" },
  { path: "/dashboard/host-companies/abc/units", expectedId: "host-company-units" },
  { path: "/dashboard/host-companies/abc/nomad-listing", expectedId: "host-company-nomad-listing" },
  { path: "/dashboard/host-companies/abc/website-credit-requests", expectedId: "website-credit-requests" },
  { path: "/dashboard/support-tickets", expectedId: "host-support-tickets" },
  // --- Top-level pages ---
  { path: "/reports", expectedId: "reports" },
  { path: "/calendar", expectedId: "calendar" },
  { path: "/access", expectedId: "access" },
  { path: "/access/permissions", expectedId: "access-permissions" },
  { path: "/access/permissions/Leads", expectedId: "access-permissions" },
  { path: "/notifications", expectedId: "notifications" },
  { path: "/chat", expectedId: "chat" },

  // --- Tickets ---
  { path: "/tickets", expectedId: "tickets-dashboard" },
  { path: "/tickets/raise-ticket", expectedId: "raise-ticket" },
  { path: "/tickets/manage-tickets", expectedId: "manage-tickets" },
  { path: "/tickets/manage-tickets/it", expectedId: "manage-tickets" },
  { path: "/tickets/ticket-settings", expectedId: "ticket-settings" },
  { path: "/tickets/team-members", expectedId: "tickets-team-members" },
  { path: "/tickets/reports", expectedId: "ticket-reports" },
  { path: "/tickets/department-wise-tickets", expectedId: "department-wise-tickets" },

  // --- Meetings ---
  { path: "/meetings", expectedId: "meetings-dashboard" },
  { path: "/meetings/2026-08", expectedId: "month-meetings" },
  { path: "/meetings/book-meeting", expectedId: "book-meeting" },
  { path: "/meetings/book-meeting/schedule-meeting", expectedId: "schedule-meeting" },
  { path: "/meetings/manage-meetings/internal-meetings", expectedId: "manage-meetings" },
  { path: "/meetings/settings", expectedId: "meeting-settings" },
  { path: "/meetings/calendar", expectedId: "meeting-calendar" },
  { path: "/meetings/reports", expectedId: "meeting-reports" },
  { path: "/meetings/reviews", expectedId: "meeting-reviews" },

  // --- Assets (shared with Tasks where noted) ---
  { path: "/assets", expectedId: "assets-dashboard" },
  { path: "/assets/view-assets", expectedId: "assets-home" },
  { path: "/assets/view-assets/IT", expectedId: "assets-department-shell" },
  { path: "/assets/view-assets/IT/assets-categories", expectedId: "assets-department" },
  { path: "/assets/view-assets/IT/list-of-assets", expectedId: "assets-department" },
  { path: "/assets/manage-assets", expectedId: "manage-assets-home" },
  { path: "/tasks/manage-assets", expectedId: "manage-assets-home" },
  { path: "/assets/manage-assets/IT", expectedId: "manage-assets-department-shell" },
  { path: "/tasks/manage-assets/IT/approvals", expectedId: "manage-assets-department" },
  { path: "/assets/reports", expectedId: "asset-reports" },
  { path: "/assets/reviews", expectedId: "module-reviews" },
  { path: "/tasks/reviews", expectedId: "module-reviews" },
  { path: "/assets/settings", expectedId: "assets-settings" },
  { path: "/tasks/settings", expectedId: "assets-settings" },
  { path: "/assets/settings/bulk-upload", expectedId: "assets-bulk-upload" },
  { path: "/tasks/settings/bulk-upload", expectedId: "assets-bulk-upload" },

  // --- Performance ---
  { path: "/performance", expectedId: "performance-home" },
  { path: "/performance/IT", expectedId: "performance-department" },
  { path: "/performance/IT/daily-KRA", expectedId: "performance-daily-kra" },
  { path: "/performance/IT/monthly-KPA", expectedId: "performance-monthly-kpa" },
  { path: "/performance/IT/annual-KPA", expectedId: "performance-annual-kpa" },

  // --- Tasks ---
  { path: "/tasks", expectedId: "tasks-dashboard" },
  { path: "/tasks/department-tasks", expectedId: "department-tasks" },
  { path: "/tasks/department-tasks/IT", expectedId: "department-tasks" },
  { path: "/tasks/project-list/edit-project", expectedId: "project-list" },
  { path: "/tasks/project-list/edit-project/9", expectedId: "project-list" },
  { path: "/tasks/my-tasks", expectedId: "my-tasks" },
  { path: "/tasks/team-members", expectedId: "tasks-team-members" },
  { path: "/tasks/calendar", expectedId: "meeting-calendar" },
  { path: "/tasks/reports", expectedId: "task-reports" },
  { path: "/tasks/reports/my-task-reports", expectedId: "task-reports" },

  // --- Visitors ---
  { path: "/visitors", expectedId: "visitors-dashboard" },
  { path: "/visitors/add-visitor", expectedId: "add-visitor" },
  { path: "/visitors/add-client", expectedId: "add-client" },
  { path: "/visitors/manage-visitors/internal-visitors", expectedId: "manage-visitors" },
  { path: "/visitors/team-members", expectedId: "visitors-team-members" },
  { path: "/visitors/reports", expectedId: "visitor-reports" },
  { path: "/visitors/reviews", expectedId: "visitor-reviews" },
  { path: "/visitors/settings", expectedId: "visitor-settings" },
  { path: "/visitors/settings/bulk-upload", expectedId: "visitor-bulk-upload" },

  // --- Unknown routes: the generated fallback is the expected result ---
  { path: "/some/unknown/page", expectedId: "page-some-unknown-page" },
];

// 1) Route matcher assertions: each path MUST resolve to its expected tour id.
let failures = 0;
for (const { path, expectedId } of EXPECTED) {
  const tour = getPageTour(path);
  if (!tour || tour.id !== expectedId) {
    failures += 1;
    console.log(
      `MISMATCH ${path}\n  expected: ${expectedId}\n  actual:   ${tour?.id ?? "NULL"}`,
    );
    continue;
  }
  if (!tour.title || !tour.description) {
    failures += 1;
    console.log(`INCOMPLETE ${path} -> ${tour.id} (missing title/description)`);
  }
}

// 2) Structural assertions on every distinct registered tour touched above:
//    a step without textOnly needs a selector or text target (otherwise
//    buildSteps silently drops it), and every step needs copy to show.
let structuralIssues = 0;
const seenIds = new Set();
for (const { path } of EXPECTED) {
  const tour = getPageTour(path);
  if (!tour || seenIds.has(tour.id)) continue;
  seenIds.add(tour.id);
  if (tour.id.startsWith("page-")) continue; // generated fallback has no steps
  (tour.steps || []).forEach((step, index) => {
    if (!step.selector && !step.text && !step.textOnly) {
      structuralIssues += 1;
      console.log(
        `STEP ISSUE ${tour.id} step ${index + 1} ("${step.title}"): no selector/text and not textOnly — it would be silently dropped`,
      );
    }
    if (!step.title || !step.description) {
      structuralIssues += 1;
      console.log(
        `STEP ISSUE ${tour.id} step ${index + 1}: missing title or description`,
      );
    }
  });
}

console.log(
  `checked ${EXPECTED.length} paths -> ${seenIds.size} distinct tours; ` +
    `mismatches: ${failures}, step issues: ${structuralIssues}`,
);
process.exit(failures + structuralIssues > 0 ? 1 : 0);
