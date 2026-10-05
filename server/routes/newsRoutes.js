const router = require("express").Router();
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
router.post("/", createNews);
router.patch("/status/:id", updateNewsStatus);
router.patch("/:id", updateNews);
router.delete("/:id", deleteNews);

module.exports = router;
