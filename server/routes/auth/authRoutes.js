const router = require("express").Router();
const {
  login,
  logout,
  signup,
  startForgotPasswordWithOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtpSession,
} = require("../../controllers/authControllers/userAuthController");
const refreshTokenController = require("../../controllers/authControllers/refreshTokenController");

router.post("/login", login);
router.get("/logout", logout);
router.get("/refresh", refreshTokenController);
router.post("/signup", signup);
router.post("/forgot-password/start", startForgotPasswordWithOtp);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp);
router.post("/forgot-password/reset", resetPasswordWithOtpSession);
// router.post("/check-password", checkPassword);
// router.post("/update-password", updatePassword);

module.exports = router;
