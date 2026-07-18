const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  bulkInsertPoc,
  getCompanyMembers,
  getInviteStatuses,
  sendInviteEmail,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
  sendBookingPaymentLinkEmail,
  updateHostUserAccountStatus,
  updateWorkspaceAccountStatus,
  updateMemberWorkspaceAccess,
  updateWorkspaceEnabledModules,
  syncWorkspaceDepartmentModules,
} = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);
router.get("/invite-statuses", verifyJwt, getInviteStatuses);
router.get("/company-members", verifyJwt, getCompanyMembers);
router.post("/send-invite", verifyJwt, sendInviteEmail);
router.post("/send-upgrade-payment-link-email", verifyJwt, sendUpgradePaymentLinkEmail);
router.post("/send-upgrade-success-email", verifyJwt, sendUpgradeSuccessEmail);
router.post("/send-booking-payment-link", verifyJwt, sendBookingPaymentLinkEmail);
router.patch("/workspace/:workspaceId/bulk-account-status", verifyJwt, updateWorkspaceAccountStatus);
router.patch("/:memberId/account-status", verifyJwt, updateHostUserAccountStatus);
router.patch("/:memberId/workspace-access", verifyJwt, updateMemberWorkspaceAccess);
router.patch("/workspace/:workspaceId/enabled-modules", verifyJwt, updateWorkspaceEnabledModules);
router.post("/workspace/sync-department-modules", verifyJwt, syncWorkspaceDepartmentModules);

module.exports = router;
