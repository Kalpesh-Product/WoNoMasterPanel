const router = require("express").Router();
const { getBlogs, createBlog, updateBlog, deleteBlog } = require("../controllers/websiteControllers/blogNewsControllers");

router.get("/", getBlogs);
router.get("/all-blogs", getBlogs);
router.get("/get-all-blogs", getBlogs);
router.post("/", createBlog);
router.patch("/:id", updateBlog);
router.delete("/:id", deleteBlog);

module.exports = router;