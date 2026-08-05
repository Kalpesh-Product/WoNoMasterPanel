const router = require("express").Router();
const { setLogModule } = require("../middlewares/logContext");

router.use(setLogModule("Nomad Signup Leads"));

const {
  getNomadUsers,
  getNomadUserDestinationViews,
  getNomadUserListingViews,
  getNomadUserSessionLogs,
  exportNomadUserActivity,
} = require("../controllers/nomadUserControllers");

router.get("/", getNomadUsers);
router.get("/:userId/destination-views", getNomadUserDestinationViews);
router.get("/:userId/listing-views", getNomadUserListingViews);
router.get("/:userId/sessions", getNomadUserSessionLogs);
router.get("/:userId/export", exportNomadUserActivity);

module.exports = router;
