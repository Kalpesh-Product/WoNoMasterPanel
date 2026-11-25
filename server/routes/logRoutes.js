const {
  getLogs,
  getModuleAccessLogs,
  getHostActivityLogs,
} = require("../controllers/logController");
const { exportDryRunReport } = require("../controllers/dryRunReportController");
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
// Data upload dry runs export a PDF here: it is returned as a download and
// archived in S3 with a log entry, so Logs keeps a copy of every report.
router.post("/dry-run-report", exportDryRunReport);
router.get("/module-access-logs", getModuleAccessLogs);
router.get("/host-activity-logs", getHostActivityLogs);
router.get("/master-panel-analytics", getMasterPanelAnalytics);
router.get("/data-upload-analytics", getDataUploadAnalytics);
router.get("/host-panel-analytics", getHostPanelAnalytics);
router.get("/host-panel-analytics/:companyId", getHostPanelCompanyAnalytics);
router.get("/host-panel-analytics/:companyId/modules", getHostPanelModuleAnalytics);

module.exports = router;
