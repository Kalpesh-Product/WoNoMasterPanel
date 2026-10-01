const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const upload = require("../config/multerConfig");
const {
  bulkInsertPoc,
  getCompanyMembers,
  getInviteStatuses,
  sendInviteEmail,
  getDefaultInviteAgreement,
  setDefaultInviteAgreement,
  removeDefaultInviteAgreement,
  getVerifyBusinessClicks,
  sendUpgradePaymentLinkEmail,
  sendUpgradeSuccessEmail,
  sendBookingPaymentLinkEmail,
  getBookingPaymentStatuses,
  updateHostUserAccountStatus,
  updateWorkspaceAccountStatus,
  updateMemberWorkspaceAccess,
  updateWorkspaceEnabledModules,
  syncWorkspaceDepartmentModules,
} = require("../controllers/hostUserControllers");

router.post("/bulk-insert-poc", bulkInsertPoc);
router.get("/invite-statuses", verifyJwt, getInviteStatuses);
router.get("/company-members", verifyJwt, getCompanyMembers);
// The default agreement attached to every invite (upload once, replace when it changes).
router.get("/verify-clicks", verifyJwt, getVerifyBusinessClicks);
router.get("/invite-agreement", verifyJwt, getDefaultInviteAgreement);
router.put("/invite-agreement", verifyJwt, upload.single("agreement"), setDefaultInviteAgreement);
router.delete("/invite-agreement", verifyJwt, removeDefaultInviteAgreement);
// Optional "agreement" PDF is attached to the invite email — see createHostInvite.
router.post("/send-invite", verifyJwt, upload.single("agreement"), sendInviteEmail);
router.post("/send-upgrade-payment-link-email", verifyJwt, sendUpgradePaymentLinkEmail);
router.post("/send-upgrade-success-email", verifyJwt, sendUpgradeSuccessEmail);
router.post("/send-booking-payment-link", verifyJwt, sendBookingPaymentLinkEmail);
router.get("/booking-payment-links", verifyJwt, getBookingPaymentStatuses);
router.patch("/workspace/:workspaceId/bulk-account-status", verifyJwt, updateWorkspaceAccountStatus);
router.patch("/:memberId/account-status", verifyJwt, updateHostUserAccountStatus);
router.patch("/:memberId/workspace-access", verifyJwt, updateMemberWorkspaceAccess);
router.patch("/workspace/:workspaceId/enabled-modules", verifyJwt, updateWorkspaceEnabledModules);
router.post("/workspace/sync-department-modules", verifyJwt, syncWorkspaceDepartmentModules);

module.exports = router;
