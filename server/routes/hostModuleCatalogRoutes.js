const router = require("express").Router();
const { uploadImages } = require("../config/multerConfig");
const {
  getHostModuleCatalog,
  createCategory,
  createModule,
  replaceCategoryModules,
  updateModuleFields,
  uploadModuleScreenshot,
  deleteModule,
} = require("../controllers/websiteControllers/hostModuleCatalogControllers");

router.get("/", getHostModuleCatalog);
router.post("/", createCategory);
router.post("/:categoryId/modules", createModule);
router.put("/:categoryId", replaceCategoryModules);
router.patch("/:categoryId/modules/:moduleId", updateModuleFields);
router.post(
  "/:categoryId/modules/:moduleId/screenshot",
  uploadImages.single("image"),
  uploadModuleScreenshot,
);
router.delete("/:categoryId/modules/:moduleId", deleteModule);

module.exports = router;
