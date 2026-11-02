const router = require("express").Router();
const { uploadImages } = require("../config/multerConfig");
const {
  getWebsiteThemeCatalog,
  createWebsiteTheme,
  updateWebsiteTheme,
  reorderWebsiteThemes,
} = require("../controllers/websiteControllers/websiteThemeCatalogController");

const screenshots = uploadImages.fields([
  { name: "desktopScreenshot", maxCount: 1 },
  { name: "mobileScreenshot", maxCount: 1 },
]);

router.get("/", getWebsiteThemeCatalog);
router.post("/", screenshots, createWebsiteTheme);
router.patch("/:themeId", screenshots, updateWebsiteTheme);
router.put("/order", reorderWebsiteThemes);

module.exports = router;
