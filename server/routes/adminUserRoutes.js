const {
  updateProfile,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkReuploadImages,
  uploadCompanyLogo,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");
const { uploadImages } = upload;

const router = require("express").Router();

router.patch("/update-profile/:userId", updateProfile);
router.patch("/change-password/:userId", changePassword);
// router.post("/bulk-upload-data", upload.single("file"), bulkUploadData);

router.post("/bulk-upload-data", upload.single("file"), bulkUploadData);
router.post(
  "/bulk-upload-images",
  uploadImages.array("images"),
  bulkUploadImages
);
router.patch(
  "/bulk-reupload-images",
  uploadImages.array("images"),
  bulkReuploadImages
);
router.post(
  "/upload-single-image",
  uploadImages.single("image"),
  uploadCompanyLogo
);

module.exports = router;
