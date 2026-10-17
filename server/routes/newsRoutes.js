const router = require("express").Router();
const { uploadContentImages } = require("../config/multerConfig");
const {
  getNews,
  getNewsContributions,
  createNews,
  updateNews,
  updateNewsStatus,
  updateNewsContributionStatus,
  deleteNews,
} = require("../controllers/websiteControllers/blogNewsControllers");

router.get("/", getNews);
router.get("/all-news", getNews);
router.get("/get-all-news", getNews);
router.get("/contributions", getNewsContributions);
router.patch("/contributions/:id/status", updateNewsContributionStatus);
router.post("/", uploadContentImages.any(), createNews);
router.patch("/status/:id", updateNewsStatus);
router.patch("/:id", uploadContentImages.any(), updateNews);
router.delete("/:id", deleteNews);

module.exports = router;
