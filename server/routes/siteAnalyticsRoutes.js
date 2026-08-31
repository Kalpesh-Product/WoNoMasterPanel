const router = require("express").Router();
const { setLogModule } = require("../middlewares/logContext");
const {
  getRealtimeActiveUsers,
  getHistoricalAnalytics,
} = require("../controllers/siteAnalyticsControllers");

router.use(setLogModule("Site Analytics"));

router.get("/wono/realtime-active-users", getRealtimeActiveUsers);
router.get("/wono/historical", getHistoricalAnalytics);

module.exports = router;
