const router = require("express").Router();
const upload = require("../config/multerConfig");
const { uploadImages } = upload;
const { checkAndDeductCredit } = require("../middlewares/creditCheck");

const {
  createTemplate,
  publishWebsite,
  getTemplate,
  editTemplate,
  getTemplates,
  getInActiveTemplates,
  activateTemplate,
  getInActiveTemplate,
  deleteTemplate,
  saveTemplateDraft,
} = require("../controllers/websiteControllers/websiteTemplateControllers");

router.post("/create-website", uploadImages.any(), createTemplate);
router.post("/publish-website", publishWebsite);
router.post("/save-website-draft", uploadImages.any(), saveTemplateDraft);
router.patch("/edit-website", uploadImages.any(), checkAndDeductCredit, editTemplate);
router.patch("/activate-website", activateTemplate);
router.patch("/delete-website", deleteTemplate);
router.get("/get-websites", getTemplates);
router.get("/get-inactive-website", getInActiveTemplate);
router.get("/get-inactive-websites", getInActiveTemplates);

module.exports = router;
