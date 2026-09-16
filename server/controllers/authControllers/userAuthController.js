const jwt = require("jsonwebtoken");
const AdminUser = require("../../models/AdminUser");
const Otp = require("../../models/Otp");
const bcrypt = require("bcryptjs");
const generatePassword = require("../../utils/passwordGenerator");
const mailer = require("../../config/nodemailerConfig");
const emailTemplates = require("../../utils/emailTemplates");

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).+$/;

const validateStrongPassword = (password) => {
  if (!password || password.length < 8) return "Must be at least 8 characters long.";
  if (password.length > 72) return "Password cannot exceed 72 characters.";
  if (!PASSWORD_REGEX.test(password)) {
    return "Should include both uppercase and lowercase letters and at least one number or special character.";
  }
  return "";
};

const getPasswordResetSessionSecret = () =>
  process.env.PASSWORD_RESET_OTP_SECRET || process.env.ACCESS_TOKEN_SECRET;

const signPasswordResetSession = (email) => {
  const secret = getPasswordResetSessionSecret();
  if (!secret) throw new Error("Password reset secret not configured");
  return jwt.sign(
    { purpose: "password_reset_session", email: String(email || "").trim().toLowerCase() },
    secret,
    { expiresIn: "15m" },
  );
};

const verifyPasswordResetSession = (token) => {
  const secret = getPasswordResetSessionSecret();
  if (!secret) throw new Error("Password reset secret not configured");
  return jwt.verify(token, secret);
};

const hasPasswordBeenUsedRecently = async (user, plainPassword) => {
  const currentHash = String(user?.password || "");
  if (currentHash && (await bcrypt.compare(plainPassword, currentHash))) return true;
  const history = Array.isArray(user?.passwordHistory) ? user.passwordHistory : [];
  for (const entry of history.slice(0, 2)) {
    const oldHash = String(entry?.hash || "");
    if (oldHash && (await bcrypt.compare(plainPassword, oldHash))) return true;
  }
  return false;
};

const applyPasswordUpdateWithHistory = async (user, nextPassword) => {
  const currentHash = String(user?.password || "");
  user.password = await bcrypt.hash(nextPassword, 10);
  const history = Array.isArray(user?.passwordHistory) ? user.passwordHistory : [];
  if (currentHash) history.unshift({ hash: currentHash, changedAt: new Date() });
  user.passwordHistory = history.slice(0, 2);
  await user.save();
};

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

    if (user.isActive === false)
      return res
        .status(403)
        .json({ message: "Your account has been disabled. Contact a superadmin for access." });

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

const startForgotPasswordWithOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ message: "Email is required." });

    const user = await AdminUser.findOne({ email: normalizedEmail }).lean().exec();
    if (!user) return res.status(404).json({ message: "Email doesn't exist." });

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await Otp.updateMany(
      { email: normalizedEmail, purpose: "password_reset", isUsed: false },
      { $set: { isUsed: true } },
    );
    await Otp.create({
      email: normalizedEmail,
      code: otp,
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      payload: {},
    });

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    await mailer.sendMail({
      to: normalizedEmail,
      subject: "Reset Your WONO Password",
      html: emailTemplates.renderNotificationEmail({
        heroTitle: "Reset Your Password",
        heroSubtitle: "Use the verification code below to continue.",
        greetingHtml: `
          <p style="margin:0 0 4px;">Hello ${fullName || "there"},</p>
          <p class="email-text" style="margin:0;">Use the verification code below to verify your identity and reset your WONO password.</p>
        `,
        otpCode: { code: otp, expiryMinutes: 10 },
        noteHtml:
          "For your security, never share this verification code with anyone.<br/><br/><b>Didn't request this?</b> You can safely ignore this email.",
      }),
    });

    return res.status(200).json({ message: "OTP sent successfully.", email: normalizedEmail });
  } catch (error) {
    next(error);
  }
};

const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: "password_reset",
      isUsed: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!otpRecord) return res.status(400).json({ message: "Please request OTP first." });
    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });
      return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }
    if (otpRecord.attempts >= 5) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });
      return res.status(429).json({ message: "OTP attempts exceeded. Request a new OTP." });
    }
    if (String(otpRecord.code) !== String(otp)) {
      await Otp.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ message: "Invalid OTP." });
    }

    const user = await AdminUser.findOne({ email: normalizedEmail }).lean().exec();
    if (!user) {
      await Otp.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });
      return res.status(404).json({ message: "Email doesn't exist." });
    }

    await Otp.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true } });
    const resetSessionToken = signPasswordResetSession(normalizedEmail);
    return res.status(200).json({
      message: "OTP verified successfully.",
      resetSessionToken,
      email: normalizedEmail,
    });
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Reset session expired. Verify OTP again." });
    }
    if (error?.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid reset session." });
    }
    next(error);
  }
};

const resetPasswordWithOtpSession = async (req, res, next) => {
  try {
    const { resetSessionToken, password, confirmPassword } = req.body;
    if (!resetSessionToken) {
      return res.status(400).json({ message: "Reset session token is required." });
    }
    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password are required." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    const strengthMessage = validateStrongPassword(password);
    if (strengthMessage) return res.status(400).json({ message: strengthMessage });

    const decoded = verifyPasswordResetSession(resetSessionToken);
    const normalizedEmail = String(decoded?.email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ message: "Invalid reset session." });

    const user = await AdminUser.findOne({ email: normalizedEmail }).exec();
    if (!user) return res.status(404).json({ message: "Email doesn't exist." });

    const usedRecently = await hasPasswordBeenUsedRecently(user, password);
    if (usedRecently) {
      return res
        .status(400)
        .json({ message: "New password cannot be same as current or last 2 passwords." });
    }

    await applyPasswordUpdateWithHistory(user, password);
    return res.status(200).json({ success: true, message: "Password reset successful." });
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Reset session expired. Verify OTP again." });
    }
    if (error?.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid reset session." });
    }
    next(error);
  }
};

module.exports = {
  login,
  logout,
  signup,
  startForgotPasswordWithOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtpSession,
};
