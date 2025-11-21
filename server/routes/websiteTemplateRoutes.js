const router = require("express").Router();
const upload = require("../config/multerConfig");
const { uploadImages } = upload;

const {
  createTemplate,
  getTemplate,
  editTemplate,
  getTemplates,
  getInActiveTemplates,
  activateTemplate,
  getInActiveTemplate,
  deleteTemplate,
} = require("../controllers/websiteControllers/websiteTemplateControllers");

router.post("/create-website", uploadImages.any(), createTemplate);
router.patch("/edit-website", uploadImages.any(), editTemplate);
router.patch("/activate-website", activateTemplate);
router.patch("/delete-website", deleteTemplate);
router.get("/get-websites", getTemplates);
router.get("/get-inactive-website", getInActiveTemplate);
router.get("/get-inactive-websites", getInActiveTemplates);

module.exports = router;
