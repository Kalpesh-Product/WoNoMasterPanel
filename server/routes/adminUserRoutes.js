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
  getReviewsByCompany,
  getWebsiteLeads,
  updateWebsiteLead,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");
const { setLogModule } = require("../middlewares/logContext");

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
router.patch("/review/:reviewId", setLogModule("Reviews"), updateReviewStatus);
router.get("/reviews", getReviewsByCompany);

//Website Lead Routes (company website builder)
router.get("/website-leads", getWebsiteLeads);
router.patch(
  "/website-leads/update",
  setLogModule("Website Leads"),
  updateWebsiteLead,
);

//
router.patch("/registration/:companyId", updateRegistrationStatus);

module.exports = router;
