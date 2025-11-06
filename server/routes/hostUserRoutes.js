const router = require("express").Router();
const { bulkInsertPoc } = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);

module.exports = router;
