const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  bulkInsertPoc,
  getCompanyMembers,
  getInviteStatuses,
  sendInviteEmail,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
  updateMemberWorkspaceAccess,
} = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);
router.get("/invite-statuses", verifyJwt, getInviteStatuses);
router.get("/company-members", verifyJwt, getCompanyMembers);
router.post("/send-invite", verifyJwt, sendInviteEmail);
router.post("/send-upgrade-payment-link-email", verifyJwt, sendUpgradePaymentLinkEmail);
router.post("/send-upgrade-success-email", verifyJwt, sendUpgradeSuccessEmail);
router.patch("/:memberId/workspace-access", verifyJwt, updateMemberWorkspaceAccess);

module.exports = router;
