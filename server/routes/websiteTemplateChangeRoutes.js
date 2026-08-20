const router = require("express").Router();
const verifyJwt = require("../middlewares/verifyJwt");
const {
  getTemplateChangeRequests,
  approveTemplateChangeRequest,
  rejectTemplateChangeRequest,
  completeTemplateChangeRequest,
  getTemplateChangeSettings,
  updateTemplateChangeSettings,
} = require("../controllers/websiteControllers/websiteTemplateChangeRequestsController");

router.use(verifyJwt);
router.get("/requests", getTemplateChangeRequests);
router.patch("/requests/:requestId/approve", approveTemplateChangeRequest);
router.patch("/requests/:requestId/reject", rejectTemplateChangeRequest);
router.patch("/requests/:requestId/complete", completeTemplateChangeRequest);
router.get("/settings", getTemplateChangeSettings);
router.put("/settings", updateTemplateChangeSettings);

module.exports = router;
