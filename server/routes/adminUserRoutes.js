const {
  updateProfile,
  changePassword,
} = require("../controllers/adminUserControllers");

const router = require("express").Router();

router.patch("/update-profile/:userId", updateProfile);
router.patch("/change-password/:userId", changePassword);

module.exports = router;
