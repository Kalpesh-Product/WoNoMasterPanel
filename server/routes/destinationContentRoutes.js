const router = require("express").Router();
const { uploadContentImages } = require("../config/multerConfig");
const { saveDestinationContent } = require("../controllers/websiteControllers/blogNewsControllers");

router.post("/:type", uploadContentImages.any(), saveDestinationContent);
router.patch("/:type/:id", uploadContentImages.any(), saveDestinationContent);

module.exports = router;
