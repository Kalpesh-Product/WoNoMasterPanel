const router = require("express").Router();
const {
  getBlogs,
  getBlogContributions,
  createBlog,
  updateBlog,
  updateBlogContributionStatus,
  deleteBlog,
} = require("../controllers/websiteControllers/blogNewsControllers");

router.get("/", getBlogs);
router.get("/all-blogs", getBlogs);
router.get("/get-all-blogs", getBlogs);
router.get("/contributions", getBlogContributions);
router.patch("/contributions/:id/status", updateBlogContributionStatus);
router.post("/", createBlog);
router.patch("/:id", updateBlog);
router.delete("/:id", deleteBlog);

module.exports = router;
