const express = require("express");
const router = express.Router();

const { verifyNomadsServiceKey } = require("../middlewares/verifyNomadsServiceKey");
const {
  createVerificationPaymentLinkInternal,
  getVerificationLeadHistory,
} = require("../controllers/companyVerificationPaymentsControllers");

// Server-to-server only — the Nomads backend calls this after validating the
// logged-in owner itself; there is no human/browser session on this route,
// so it deliberately sits outside verifyJwt/auditLogger.
router.post(
  "/:nomadsRequestId/create-link",
  verifyNomadsServiceKey,
  createVerificationPaymentLinkInternal,
);
router.get("/:id/history", verifyNomadsServiceKey, getVerificationLeadHistory);

module.exports = router;
