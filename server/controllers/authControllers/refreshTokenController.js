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
        const accessToken = jwt.sign(
          { userInfo: { ...user } },
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
