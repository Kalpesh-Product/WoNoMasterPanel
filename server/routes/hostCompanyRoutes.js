const router = require("express").Router();
const upload = require("../config/multerConfig");
const { uploadImages } = upload;
const {
  createCompany,
  getCompany,
  getCompanies,
  bulkInsertCompanies,
  updateServices,
  activateProduct,
  bulkInsertLogos,
  uploadLogo,
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
// router.patch("/bulk-insert-logos", upload.single("logos"), bulkInsertLogos);
router.post("/onboard-company", createCompany);
router.patch("/activate-product", activateProduct);
router.patch("/update-services", updateServices);
router.get("/companies", getCompanies);
router.get("/company", getCompany);
router.patch("/upload-logo", uploadLogo);

//listing
router.post("/add-company-listing", uploadImages.any(), createCompanyListing);
router.patch("/edit-company-listing", uploadImages.any(), editCompanyListing);
router.get("/get-companies-listings", getAllCompanyListings);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
