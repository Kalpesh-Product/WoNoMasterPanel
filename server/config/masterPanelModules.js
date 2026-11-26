// Catalog of Master Panel sidebar submenus that a superadmin can grant/revoke
// per AdminUser via /api/admin-access. Keys here MUST stay in sync with the
// `key` on each submenu in client/src/components/Sidebar.jsx.
const masterPanelModules = [
  {
    key: "dashboard",
    label: "Dashboard",
    submenus: [
      { key: "dashboard.companies", label: "Companies" },
      { key: "dashboard.all-leads", label: "All Leads" },
      { key: "dashboard.contributor-leads", label: "Contributor Leads" },
      { key: "dashboard.value-adds-leads", label: "Value Adds Leads" },
      {
        key: "dashboard.data-upload",
        label: "Data Upload",
        // Having this bare key means full access to every tab (unchanged
        // for anyone already granted it). These let a superadmin instead
        // hand out just specific tabs — keys must stay in sync with the
        // `path`s in client/src/.../DataUpload/UploadLayout.jsx.
        tabs: [
          { key: "company-upload", label: "Company Upload" },
          { key: "product-upload", label: "Products Upload" },
          { key: "bulk-upload-images", label: "Bulk Upload Images" },
          { key: "bulk-reupload-images", label: "Bulk Reupload Images" },
          { key: "upload-single-image", label: "Upload Single Image" },
          { key: "news-upload", label: "News Upload" },
          { key: "blogs-upload", label: "Blogs Upload" },
          { key: "events-upload", label: "Events Upload" },
          { key: "places-upload", label: "Places Upload" },
          { key: "restaurants-upload", label: "Restaurants Upload" },
          { key: "bulk-restaurant-images-upload", label: "Bulk Restaurant Images Upload" },
          { key: "restaurant-images-reupload", label: "Restaurant Images Reupload" },
          { key: "restaurant-logo-upload", label: "Restaurant Logo Upload" },
          { key: "destination-add-upload", label: "Add Destination Data" },
          { key: "destination-reupload", label: "Reupload Destination Data" },
          { key: "destination-ranking-upload", label: "Destination Ranking Upload" },
          { key: "listings-data-update", label: "Listings Data Update" },
          { key: "world-ranking-weights-upload", label: "World Ranking Weights Upload" },
          { key: "visa-rules-v2-upload", label: "Visa Rules V2 Upload" },
        ],
      },
      { key: "dashboard.publish-listings", label: "Publish Listings" },
      { key: "dashboard.contributions", label: "Contributions" },
      { key: "dashboard.nomad-signup-leads", label: "Nomad Signup Leads" },
      { key: "dashboard.company-verification-leads", label: "Company Verification Leads" },
      { key: "dashboard.companies-verified", label: "Companies Verified" },
      { key: "dashboard.profile", label: "Profile" },
      { key: "dashboard.logs", label: "Logs" },
      { key: "dashboard.master-panel-analytics", label: "Master Panel Analytics" },
      { key: "dashboard.reviews", label: "Reviews" },
      { key: "dashboard.value-adds-partners", label: "Value Adds Partners" },
      { key: "dashboard.destinations-data", label: "Destinations Data" },
      { key: "dashboard.destination-data-analytics", label: "Destination Data Analytics" },
      { key: "dashboard.world-ranking-weights", label: "World Ranking Weights" },
      { key: "dashboard.world-ranking-weights-v2", label: "World Ranking (Algo 2.0)" },
      { key: "dashboard.visa-countries", label: "Visa Countries" },
      { key: "dashboard.visa-countries-v2", label: "Visa Countries (Algo 2.0)" },
      { key: "dashboard.nomad-click-analytics", label: "Nomad Click Analytics" },
      { key: "dashboard.add-master-user", label: "Add Master User" },
      { key: "dashboard.host-modules-content", label: "Host Modules Content" },
    ],
  },
  {
    key: "hostpanel",
    label: "Host Panel",
    submenus: [
      { key: "hostpanel.companies", label: "Companies" },
      { key: "hostpanel.support-tickets", label: "Support Tickets" },
      { key: "hostpanel.signup-leads", label: "Signup Leads" },
      { key: "hostpanel.website-credits", label: "Website Credits" },
      { key: "hostpanel.website-templates", label: "Website Templates" },
      { key: "hostpanel.host-companies", label: "Host Companies" },
      { key: "hostpanel.plan-pricing", label: "Plan Pricing" },
      { key: "hostpanel.module-access-logs", label: "Module Access Logs" },
      { key: "hostpanel.host-panel-logs", label: "Host Panel Logs" },
      { key: "hostpanel.host-panel-analytics", label: "Host Panel Analytics" },
    ],
  },
];

const allModuleKeys = masterPanelModules.flatMap((m) =>
  m.submenus.flatMap((s) => [
    s.key,
    ...(s.tabs || []).map((t) => `${s.key}.${t.key}`),
  ])
);

module.exports = { masterPanelModules, allModuleKeys };
