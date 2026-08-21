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
const {
  getMasterTemplateChangeSummary,
  createMasterTemplateChangeRequest,
} = require("../controllers/websiteControllers/masterTemplateChangeRequestCreateController");

router.use(verifyJwt);
router.get("/requests", getTemplateChangeRequests);
router.get("/summary", getMasterTemplateChangeSummary);
router.post("/requests", createMasterTemplateChangeRequest);
router.patch("/requests/:requestId/approve", approveTemplateChangeRequest);
router.patch("/requests/:requestId/reject", rejectTemplateChangeRequest);
router.patch("/requests/:requestId/complete", completeTemplateChangeRequest);
router.get("/settings", getTemplateChangeSettings);
router.put("/settings", updateTemplateChangeSettings);

module.exports = router;
