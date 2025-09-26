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

    const isPasswordValid = await bcrypt.compare(password, user.password);
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

const signup = async (req, res, next) => {
  try {
    const { email, firstName, lastName, password } = req.body;

    // 1. Validate input
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const emailRegex = /^[a-zA-Z0-9_.±]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // 2. Check if user already exists
    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create new user
    const newUser = new AdminUser({
      email,
      firstName,
      lastName,
      password: hashedPassword,
    });

    await newUser.save();

    // 5. Send success response
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
    });
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
    const user = await AdminUser.findOne({ refreshToken }).lean().exec();
    if (!user) {
      res.clearCookie("masterPannelCookie", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
      });
      return res.sendStatus(201);
    }

    await AdminUser.findOneAndUpdate({ refreshToken }, { refreshToken: "" })
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

module.exports = { login, logout, signup };
