const router = require("express").Router();
const {
  createCompany,
} = require("../controllers/hostCompanyControllers/hostCompanyControllers");
const { getCompanyListings } = require("../controllers/hostListingControllers");

router.post("/onboard-company", createCompany);
router.get("/get-company-listings", getCompanyListings);

module.exports = router;
