const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  bulkInsertPoc,
  getInviteStatuses,
  sendInviteEmail,
} = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);
router.get("/invite-statuses", verifyJwt, getInviteStatuses);
router.post("/send-invite", verifyJwt, sendInviteEmail);

module.exports = router;
