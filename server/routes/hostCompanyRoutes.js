const router = require("express").Router();
const upload = require("../config/multerConfig");
const { setLogModule } = require("../middlewares/logContext");
const { getCompanyOverview } = require("../controllers/companyOverviewController");

// Default module for company management routes; nomad listing routes below
// override it with their own tag.
router.use(setLogModule("Companies"));

const {
  createCompany,
  getCompany,
  getCompanies,
  getCompanyLocations,
  bulkInsertCompanies,
  updateServices,
  activateProduct,
  setListingPublicStatus,
  getPublicLocationTree,
  bulkSetListingPublicStatus,
  bulkSetListingActiveStatus,
  bulkInsertLogos,
  uploadLogo,
  editCompany,
  getHostLeadCompanies,
  sendUpgradePaymentLink,
  requestUpgradePlan,
  startTrial,
  updateRequestedPlanModules,
  updateUpgradePaymentStatus,
  markUpgradeSuccessEmailSent,
  transferNomadListing,
  getLinkedNomadCompanyMeta,
  getEffectiveNomadSourceForCompany,
  getCompaniesListingRequests,
  approveCompaniesListingRequest,
  rejectCompaniesListingRequest,
  rejectExistingCompanyClaim,
  getExistingCompanyClaims,
  getExistingCompanyClaimDetail,
} = require("../controllers/hostCompanyControllers/hostCompanyControllers");
const {
  getAllCompanyListings,
  getCompanyListings,
  createCompanyListings,
  createCompanyListing,
  editCompanyListing,
  recoverProduct,
} = require("../controllers/hostListingControllers");
const {
  getDestinationsData,
} = require("../controllers/destinationDataControllers");
const {
  getCompanyUnits,
  getCompanyRecoveryQueue,
  setUnitActiveStatus,
  deleteUnit,
  recoverUnit,
} = require("../controllers/hostCompanyControllers/unitManagementControllers");
const {
  sendPlanPaymentLink,
  getPlanPaymentStatuses,
  getHostCompanyPlanHistory,
} = require("../controllers/planPaymentControllers");
const {
  getPlanPricing,
  getPricingCatalog,
  updateBasePricing,
  upsertPricingItem,
  removePricingItem,
  setCustomPlanModules,
} = require("../controllers/planPricingControllers");

//company
router.post(
  "/bulk-insert-companies",
  upload.single("companies"),
  setLogModule("Data Upload"),
  bulkInsertCompanies,
);
// router.patch("/bulk-insert-logos", upload.single("logos"), bulkInsertLogos);
router.post("/onboard-company", createCompany);
router.patch("/edit-company", upload.single("logo"), editCompany);
router.patch("/activate-product", activateProduct);
router.patch("/set-public-status", setListingPublicStatus);
router.patch("/recover-product", recoverProduct);
router.get("/public-location-tree", getPublicLocationTree);
router.patch("/bulk-set-public-status", bulkSetListingPublicStatus);
router.patch("/bulk-set-active-status", bulkSetListingActiveStatus);
router.patch("/update-services", updateServices);
router.patch("/send-upgrade-payment-link", sendUpgradePaymentLink);
router.patch("/request-upgrade-plan", requestUpgradePlan);
router.patch("/start-trial", startTrial);
router.patch("/host-companies/:companyId/custom-plan-modules", updateRequestedPlanModules);
router.patch("/update-upgrade-payment-status", updateUpgradePaymentStatus);
router.patch("/mark-upgrade-success-email-sent", markUpgradeSuccessEmailSent);
router.post("/plan-payments/send", sendPlanPaymentLink);
router.get("/plan-payments", getPlanPaymentStatuses);
router.get("/plan-pricing", getPlanPricing);
router.get("/plan-pricing/catalog", getPricingCatalog);
router.patch("/plan-pricing/settings", updateBasePricing);
router.put("/plan-pricing/:itemId", upsertPricingItem);
router.delete("/plan-pricing/:itemId", removePricingItem);
router.post("/custom-plan-modules", setCustomPlanModules);
router.get("/companies", getCompanies);
router.get("/companies/overview", getCompanyOverview);
router.get("/companies/locations", getCompanyLocations);
router.get("/destinations-data", getDestinationsData);
router.get("/host-companies", getHostLeadCompanies);
router.post(
  "/transfer-nomad-listing",
  setLogModule("Nomad Listings"),
  transferNomadListing,
);
router.get("/host-companies/:companyId/nomad-link", getLinkedNomadCompanyMeta);
router.get("/host-companies/:companyId/plan-history", getHostCompanyPlanHistory);
router.get("/companies/:companyId/nomad-source", getEffectiveNomadSourceForCompany);
router.get("/companies-requests", getCompaniesListingRequests);
router.post(
  "/companies-requests/:hostCompanyId/approve",
  setLogModule("Nomad Listings"),
  approveCompaniesListingRequest,
);
router.post(
  "/companies-requests/:hostCompanyId/reject",
  setLogModule("Nomad Listings"),
  rejectCompaniesListingRequest,
);
router.get("/existing-company-claims", getExistingCompanyClaims);
router.get("/existing-company-claims/:hostCompanyId", getExistingCompanyClaimDetail);
router.post(
  "/existing-company-claims/:hostCompanyId/reject",
  setLogModule("Nomad Listings"),
  rejectExistingCompanyClaim,
);
router.get("/company", getCompany);
router.patch("/upload-logo", uploadLogo);

//unit (workspace) management
router.get("/units", getCompanyUnits);
router.get("/units/recovery-queue", getCompanyRecoveryQueue);
router.patch("/units/:workspaceId/status", setUnitActiveStatus);
router.delete("/units/:workspaceId", deleteUnit);
router.post("/units/:workspaceId/recover", recoverUnit);

//listing
router.post(
  "/add-company-listing",
  setLogModule("Nomad Listings"),
  upload.any(),
  createCompanyListing,
);
router.patch(
  "/edit-company-listing",
  setLogModule("Nomad Listings"),
  upload.any(),
  editCompanyListing,
);
router.get("/get-companies-listings", getAllCompanyListings);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
