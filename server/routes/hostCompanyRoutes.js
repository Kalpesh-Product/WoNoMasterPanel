const router = require("express").Router();
const upload = require("../config/multerConfig");

const {
  createCompany,
  getCompany,
  getCompanies,
  bulkInsertCompanies,
} = require("../controllers/hostCompanyControllers/hostCompanyControllers");
const {
  getAllCompanyListings,
  getCompanyListings,
} = require("../controllers/hostListingControllers");

router.post(
  "/bulk-insert-companies",
  upload.single("companies"),
  bulkInsertCompanies
);
router.post("/onboard-company", createCompany);
router.get("/companies", getCompanies);
router.get("/company", getCompany);
router.get("/get-companies-listings", getAllCompanyListings);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
