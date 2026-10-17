const router = require("express").Router();
const { uploadContentImages } = require("../config/multerConfig");
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
router.post("/", uploadContentImages.any(), createBlog);
router.patch("/:id", uploadContentImages.any(), updateBlog);
router.delete("/:id", deleteBlog);

module.exports = router;
