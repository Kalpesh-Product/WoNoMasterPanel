const router = require("express").Router();
const { getNews, createNews, updateNews, deleteNews, updateNewsStatus } = require("../controllers/websiteControllers/blogNewsControllers");

router.get("/", getNews);
router.get("/all-news", getNews);
router.get("/get-all-news", getNews);
router.post("/", createNews);
router.patch("/:id", updateNews);
router.patch("/status/:id", updateNewsStatus);
router.delete("/:id", deleteNews);

module.exports = router;