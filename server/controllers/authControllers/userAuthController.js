const jwt = require("jsonwebtoken");
const AdminUser = require("../../models/AdminUser");
const bcrypt = require("bcryptjs");
const generatePassword = require("../../utils/passwordGenerator");
const mailer = require("../../config/nodemailerConfig");
const emailTemplates = require("../../utils/emailTemplates");

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Invalid data" });

    const emailRegex = /^[a-zA-Z0-9_.±]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: "invalid data" });

    const user = await AdminUser.findOne({ email }).lean().exec();
    if (!user) return res.status(404).json({ message: "No user found" });

    const isPasswordValid = bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "invalid password" });

    delete user.password;
    delete user.refreshToken;

    const accessToken = jwt.sign(
      { userInfo: { ...user } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userInfo: { ...user } },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "15d" }
    );

    await AdminUser.findOneAndUpdate({ email }, { refreshToken }).lean().exec();

    res.cookie("masterPannelCookie", refreshToken, {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      maxAge: 15 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ user, accessToken });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const cookies = req.cookies;
    if (!cookies?.masterPannelCookie) {
      return res.sendStatus(201);
    }

    const refreshToken = cookies?.masterPannelCookie;
    const user = await Employee.findOne({ refreshToken }).lean().exec();
    if (!user) {
      res.clearCookie("masterPannelCookie", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
      });
      return res.sendStatus(201);
    }

    await Employee.findOneAndUpdate({ refreshToken }, { refreshToken: "" })
      .lean()
      .exec();
    res.clearCookie("masterPannelCookie", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
    });
    res.sendStatus(201);
  } catch (error) {
    next(error);
  }
};

module.exports = { login, logout };
