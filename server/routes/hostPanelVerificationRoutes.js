const router = require("express").Router();
const {
  searchNomadCompaniesForClaim,
  getNomadCompanyListingsForClaim,
} = require("../controllers/hostCompanyControllers/hostCompanyControllers");
const { verifyHostPanelServiceKey } = require("../middlewares/verifyHostPanelServiceKey");
const { setLogModule } = require("../middlewares/logContext");

const {
  submitHostPanelVerificationRequest,
  payHostPanelVerification,
  getHostPanelVerificationStatus,
  updateHostPanelBadgeVisibility,
  getVerificationLeadHistory,
} = require("../controllers/companyVerificationPaymentsControllers");
const { getHostPanelPlanInvoices } = require("../controllers/planPaymentControllers");

router.use(setLogModule("HostPanel Verification Requests"));
router.use(verifyHostPanelServiceKey);

router.get("/nomad-companies/search", searchNomadCompaniesForClaim);
router.get("/nomad-companies/:companyId/listings", getNomadCompanyListingsForClaim);
router.get("/verification-requests", getHostPanelVerificationStatus);
router.post("/verification-requests", submitHostPanelVerificationRequest);
router.post("/verification-requests/pay", payHostPanelVerification);
router.patch("/verification-requests/badge-visibility", updateHostPanelBadgeVisibility);
router.get("/verification-requests/:id/history", getVerificationLeadHistory);
router.get("/plan/:companyId/invoices", getHostPanelPlanInvoices);

module.exports = router;
