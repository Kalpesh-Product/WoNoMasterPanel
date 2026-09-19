const router = require("express").Router();
const { verifyHostPanelServiceKey } = require("../middlewares/verifyHostPanelServiceKey");
const { setLogModule } = require("../middlewares/logContext");

const {
  submitHostPanelVerificationRequest,
  payHostPanelVerification,
  getHostPanelVerificationStatus,
  updateHostPanelBadgeVisibility,
  getVerificationLeadHistory,
} = require("../controllers/companyVerificationPaymentsControllers");

router.use(setLogModule("HostPanel Verification Requests"));
router.use(verifyHostPanelServiceKey);

router.get("/verification-requests", getHostPanelVerificationStatus);
router.post("/verification-requests", submitHostPanelVerificationRequest);
router.post("/verification-requests/pay", payHostPanelVerification);
router.patch("/verification-requests/badge-visibility", updateHostPanelBadgeVisibility);
router.get("/verification-requests/:id/history", getVerificationLeadHistory);

module.exports = router;
