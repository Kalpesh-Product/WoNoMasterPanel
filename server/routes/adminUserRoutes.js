const {
  updateProfile,
  changePassword,
  bulkUploadData,
} = require("../controllers/adminUserControllers");
const upload = require("../config/multerConfig");

const router = require("express").Router();

router.patch("/update-profile/:userId", updateProfile);
router.patch("/change-password/:userId", changePassword);
router.post("/bulk-upload-data", upload.any(), bulkUploadData);

module.exports = router;
