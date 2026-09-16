const express = require("express");
const router = express.Router();

const {
  getVerificationLeads,
  updateVerificationLeadStatus,
} = require("../controllers/companyVerificationLeadsControllers");
const {
  sendVerificationPaymentLink,
  getVerificationLeadHistory,
  getVerificationPaymentHistory,
} = require("../controllers/companyVerificationPaymentsControllers");
const { setLogModule } = require("../middlewares/logContext");

router.use(setLogModule("Company Verification Leads"));

router.get("/", getVerificationLeads);
router.get("/payment-history", getVerificationPaymentHistory);
router.patch("/:id/status", updateVerificationLeadStatus);
router.post("/:id/send-payment-link", sendVerificationPaymentLink);
router.get("/:id/history", getVerificationLeadHistory);

module.exports = router;
