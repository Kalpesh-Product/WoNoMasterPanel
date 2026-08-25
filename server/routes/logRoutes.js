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
const {
  getMasterPanelAnalytics,
  getDataUploadAnalytics,
} = require("../controllers/masterPanelAnalyticsController");

const router = require("express").Router();

router.get("/get-logs", getLogs);
router.get("/module-access-logs", getModuleAccessLogs);
router.get("/host-activity-logs", getHostActivityLogs);
router.get("/master-panel-analytics", getMasterPanelAnalytics);
router.get("/data-upload-analytics", getDataUploadAnalytics);
router.get("/host-panel-analytics", getHostPanelAnalytics);
router.get("/host-panel-analytics/:companyId", getHostPanelCompanyAnalytics);
router.get("/host-panel-analytics/:companyId/modules", getHostPanelModuleAnalytics);

module.exports = router;
