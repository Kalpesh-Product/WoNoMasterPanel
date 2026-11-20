const jwt = require("jsonwebtoken");
const AdminUser = require("../../models/AdminUser");

const refreshTokenController = async (req, res, next) => {
  try {
    const cookie = req.cookies;
    if (!cookie?.masterPannelCookie) {
      return res.sendStatus(401);
    }
    const refreshToken = cookie?.masterPannelCookie;
    const user = await AdminUser.findOne({ refreshToken }).lean().exec();
    if (!user) {
      return res.sendStatus(401);
    }
    if (user.isActive === false) {
      return res
        .status(403)
        .json({ message: "Your account has been disabled." });
    }
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err) => {
        if (err) {
          return res.sendStatus(403);
        }
        delete user.password;
        delete user.refreshToken;
        // Sign from the freshly-fetched user, not the payload baked into the
        // refresh token at login time, so access/role changes (e.g.
        // isSuperAdmin, allowedModules) take effect on next silent refresh
        // instead of requiring the user to log out and back in.
        // tourProgress/passwordHistory are excluded the same way
        // userAuthController's login does — nothing reads them from the
        // decoded token, and tourProgress keeps growing, which was pushing
        // this token (sent on every request's Authorization header) past
        // Node's HTTP header size limit.
        const { tourProgress, passwordHistory, ...tokenUser } = user;
        const accessToken = jwt.sign(
          { userInfo: tokenUser },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        res.status(200).json({ user, accessToken });
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = refreshTokenController;
