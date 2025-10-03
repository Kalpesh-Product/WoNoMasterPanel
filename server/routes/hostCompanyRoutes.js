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
  bulkInsertCompanies
);
router.patch("/bulk-insert-logos", upload.single("logos"), bulkInsertLogos);
router.post("/onboard-company", createCompany);
router.patch("/activate-product", activateProduct);
router.patch("/update-services", updateServices);
router.get("/companies", getCompanies);
router.get("/company", getCompany);

//listing
router.post("/add-company-listing", upload.any(), createCompanyListing);
router.patch("/edit-company-listing", upload.any(), editCompanyListing);
router.get("/get-companies-listings", getAllCompanyListings);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
