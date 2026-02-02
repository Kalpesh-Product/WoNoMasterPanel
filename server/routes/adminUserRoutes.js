const {
  updateProfile,
  verifyPassword,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkReuploadImages,
  uploadCompanyLogo,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");

const router = require("express").Router();

router.patch("/update-profile/:userId", updateProfile);
router.patch("/verify-password/:userId", verifyPassword);
router.patch("/change-password/:userId", changePassword);
// router.post("/bulk-upload-data", upload.single("file"), bulkUploadData);

router.post("/bulk-upload-data", upload.single("file"), bulkUploadData);
router.post("/bulk-upload-images", upload.array("images"), bulkUploadImages);
router.patch(
  "/bulk-reupload-images",
  upload.array("images"),
  bulkReuploadImages,
);
router.post("/upload-single-image", upload.single("image"), uploadCompanyLogo);

module.exports = router;
