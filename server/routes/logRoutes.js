const { getLogs, getModuleAccessLogs } = require("../controllers/logController");

const router = require("express").Router();

router.get("/get-logs", getLogs);
router.get("/module-access-logs", getModuleAccessLogs);

module.exports = router;
