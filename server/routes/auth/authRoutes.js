const router = require("express").Router();
const {
  login,
  logout,
  signup,
} = require("../../controllers/authControllers/userAuthController");
const refreshTokenController = require("../../controllers/authControllers/refreshTokenController");

router.post("/login", login);
router.get("/logout", logout);
router.get("/refresh", refreshTokenController);
router.post("/signup", signup);
// router.post("/check-password", checkPassword);
// router.post("/update-password", updatePassword);

module.exports = router;
