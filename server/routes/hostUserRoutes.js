const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  bulkInsertPoc,
  sendInviteEmail,
} = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);
router.post("/send-invite", verifyJwt, sendInviteEmail);

module.exports = router;
