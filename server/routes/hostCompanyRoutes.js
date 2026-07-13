const router = require("express").Router();
const upload = require("../config/multerConfig");

const {
  createCompany,
  getCompany,
  getCompanies,
  bulkInsertCompanies,
  updateServices,
  activateProduct,
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
} = require("../controllers/hostListingControllers");

//company
router.post(
  "/bulk-insert-companies",
  upload.single("companies"),
  bulkInsertCompanies,
);
// router.patch("/bulk-insert-logos", upload.single("logos"), bulkInsertLogos);
router.post("/onboard-company", createCompany);
router.patch("/edit-company", upload.single("logo"), editCompany);
router.patch("/activate-product", activateProduct);
router.patch("/update-services", updateServices);
router.patch("/send-upgrade-payment-link", sendUpgradePaymentLink);
router.patch("/request-upgrade-plan", requestUpgradePlan);
router.patch("/update-upgrade-payment-status", updateUpgradePaymentStatus);
router.patch("/mark-upgrade-success-email-sent", markUpgradeSuccessEmailSent);
router.get("/companies", getCompanies);
router.get("/host-companies", getHostLeadCompanies);
router.post("/transfer-nomad-listing", transferNomadListing);
router.get("/host-companies/:companyId/nomad-link", getLinkedNomadCompanyMeta);
router.get("/companies/:companyId/nomad-source", getEffectiveNomadSourceForCompany);
router.get("/companies-requests", getCompaniesListingRequests);
router.post("/companies-requests/:hostCompanyId/approve", approveCompaniesListingRequest);
router.post("/companies-requests/:hostCompanyId/reject", rejectCompaniesListingRequest);
router.get("/company", getCompany);
router.patch("/upload-logo", uploadLogo);

//listing
router.post("/add-company-listing", upload.any(), createCompanyListing);
router.patch("/edit-company-listing", upload.any(), editCompanyListing);
router.get("/get-companies-listings", getAllCompanyListings);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
