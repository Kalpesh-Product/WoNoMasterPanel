const router = require("express").Router();
const upload = require("../config/multerConfig");
const { setLogModule } = require("../middlewares/logContext");

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
  updateUpgradePaymentStatus,
  markUpgradeSuccessEmailSent,
  transferNomadListing,
  getLinkedNomadCompanyMeta,
  getEffectiveNomadSourceForCompany,
  getCompaniesListingRequests,
  approveCompaniesListingRequest,
  rejectCompaniesListingRequest,
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
router.patch("/update-upgrade-payment-status", updateUpgradePaymentStatus);
router.patch("/mark-upgrade-success-email-sent", markUpgradeSuccessEmailSent);
router.get("/companies", getCompanies);
router.get("/companies/locations", getCompanyLocations);
router.get("/destinations-data", getDestinationsData);
router.get("/host-companies", getHostLeadCompanies);
router.post(
  "/transfer-nomad-listing",
  setLogModule("Nomad Listings"),
  transferNomadListing,
);
router.get("/host-companies/:companyId/nomad-link", getLinkedNomadCompanyMeta);
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
