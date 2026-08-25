const {
  updateProfile,
  verifyPassword,
  changePassword,
  bulkUploadData,
  bulkUploadImages,
  bulkUploadRestaurantImages,
  bulkReuploadImages,
  uploadCompanyLogo,
  uploadRestaurantLogo,
  updateReviewStatus,
  updateRegistrationStatus,
  getReviewsByCompany,
  getWebsiteLeads,
  escalateWebsiteLeadToHostPanel,
  updateWebsiteLead,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");
const { setLogModule } = require("../middlewares/logContext");

const router = require("express").Router();

//User Routes
router.patch("/update-profile/:userId", upload.single("profilePic"), updateProfile);
router.patch("/verify-password/:userId", verifyPassword);
router.patch("/change-password/:userId", changePassword);

//Bulk Routes — tagged "Data Upload" so every upload is attributable in the
// Logs table and the Data Upload analytics.
router.post(
  "/bulk-upload-data",
  upload.single("file"),
  setLogModule("Data Upload"),
  bulkUploadData,
);
router.post(
  "/bulk-upload-images",
  upload.array("images"),
  setLogModule("Data Upload"),
  bulkUploadImages,
);
router.post(
  "/bulk-upload-restaurant-images",
  upload.array("images"),
  setLogModule("Data Upload"),
  bulkUploadRestaurantImages,
);
router.patch(
  "/bulk-reupload-images",
  upload.array("images"),
  setLogModule("Data Upload"),
  bulkReuploadImages,
);
router.post(
  "/upload-single-image",
  upload.single("image"),
  setLogModule("Data Upload"),
  uploadCompanyLogo,
);
router.post(
  "/upload-restaurant-logo",
  upload.single("image"),
  setLogModule("Data Upload"),
  uploadRestaurantLogo,
);

//Review Routes
router.patch("/review/:reviewId", setLogModule("Reviews"), updateReviewStatus);
router.get("/reviews", getReviewsByCompany);

//Website Lead Routes (company website builder)
router.get("/website-leads", getWebsiteLeads);
router.patch(
  "/website-leads/escalate",
  setLogModule("All Enquiry"),
  escalateWebsiteLeadToHostPanel,
);
router.patch(
  "/website-leads/update",
  setLogModule("Website Leads"),
  updateWebsiteLead,
);

//
router.patch("/registration/:companyId", updateRegistrationStatus);

module.exports = router;
