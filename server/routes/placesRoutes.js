const router = require("express").Router();
const {
  getPlaceContributions,
  updatePlaceContributionStatus,
} = require("../controllers/websiteControllers/blogNewsControllers");

router.get("/contributions", getPlaceContributions);
router.patch("/contributions/:id/status", updatePlaceContributionStatus);

module.exports = router;
