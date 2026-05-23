const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  createWebsiteCreditRequest,
  getWebsiteCreditRequests,
  approveWebsiteCreditRequest,
  rejectWebsiteCreditRequest,
  sendWebsiteCreditPaymentLink,
  updateWebsiteCreditPaymentStatus,
  addWebsiteCredits,
  resetMonthlyWebsiteCredits,
} = require("../controllers/websiteControllers/websiteCreditRequestsController");

router.post("/requests", verifyJwt, createWebsiteCreditRequest);
router.get("/requests", verifyJwt, getWebsiteCreditRequests);
router.patch("/requests/:requestId/approve", verifyJwt, approveWebsiteCreditRequest);
router.patch("/requests/:requestId/reject", verifyJwt, rejectWebsiteCreditRequest);
router.patch(
  "/requests/:requestId/send-payment-link",
  verifyJwt,
  sendWebsiteCreditPaymentLink,
);
router.patch(
  "/requests/:requestId/payment-status",
  verifyJwt,
  updateWebsiteCreditPaymentStatus,
);
router.patch("/requests/:requestId/add-credits", verifyJwt, addWebsiteCredits);
router.post("/maintenance/reset-monthly", verifyJwt, resetMonthlyWebsiteCredits);

module.exports = router;
