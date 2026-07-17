const {
  getLogs,
  getModuleAccessLogs,
  getHostActivityLogs,
} = require("../controllers/logController");

const router = require("express").Router();

router.get("/get-logs", getLogs);
router.get("/module-access-logs", getModuleAccessLogs);
router.get("/host-activity-logs", getHostActivityLogs);

module.exports = router;
