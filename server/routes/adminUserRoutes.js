const {
  updateProfile,
  verifyPassword,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkReuploadImages,
  uploadCompanyLogo,
  updateReviewStatus,
  updateRegistrationStatus,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");

const router = require("express").Router();

//User Routes
router.patch("/update-profile/:userId", updateProfile);
router.patch("/verify-password/:userId", verifyPassword);
router.patch("/change-password/:userId", changePassword);

//Bulk Routes
router.post("/bulk-upload-data", upload.single("file"), bulkUploadData);
router.post("/bulk-upload-images", upload.array("images"), bulkUploadImages);
router.patch(
  "/bulk-reupload-images",
  upload.array("images"),
  bulkReuploadImages,
);
router.post("/upload-single-image", upload.single("image"), uploadCompanyLogo);

//Review Routes
router.patch("/review/:reviewId", updateReviewStatus);

//
router.patch("/registration/:companyId", updateRegistrationStatus);

module.exports = router;
