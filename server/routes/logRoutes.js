const {
  getLogs,
  getModuleAccessLogs,
  getHostActivityLogs,
} = require("../controllers/logController");
const {
  getHostPanelAnalytics,
  getHostPanelCompanyAnalytics,
  getHostPanelModuleAnalytics,
} = require("../controllers/hostPanelAnalyticsController");

const router = require("express").Router();

router.get("/get-logs", getLogs);
router.get("/module-access-logs", getModuleAccessLogs);
router.get("/host-activity-logs", getHostActivityLogs);
router.get("/host-panel-analytics", getHostPanelAnalytics);
router.get("/host-panel-analytics/:companyId", getHostPanelCompanyAnalytics);
router.get("/host-panel-analytics/:companyId/modules", getHostPanelModuleAnalytics);

module.exports = router;
