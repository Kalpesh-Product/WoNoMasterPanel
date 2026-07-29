const bcrypt = require("bcryptjs");
const AdminUser = require("../models/AdminUser");
const { masterPanelModules, allModuleKeys } = require("../config/masterPanelModules");
const { createLog } = require("../utils/moduleLogs");

const EMAIL_REGEX = /^[a-zA-Z0-9_.±]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$/;

const listAdminUsers = async (req, res, next) => {
  try {
    const users = await AdminUser.find()
      .select("-password -refreshToken")
      .lean()
      .exec();
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const getModuleCatalog = async (req, res, next) => {
  try {
    return res.status(200).json(masterPanelModules);
  } catch (error) {
    next(error);
  }
};

const updateAdminUserAccess = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isSuperAdmin, allowedModules, isActive } = req.body;
    const isSelf = String(userId) === String(req.userData?._id);

    if (
      isSuperAdmin === undefined &&
      allowedModules === undefined &&
      isActive === undefined
    ) {
      return res
        .status(400)
        .json({ message: "Nothing to update" });
    }

    if (allowedModules !== undefined) {
      if (!Array.isArray(allowedModules)) {
        return res
          .status(400)
          .json({ message: "allowedModules must be an array" });
      }
      const invalidKeys = allowedModules.filter(
        (key) => !allModuleKeys.includes(key)
      );
      if (invalidKeys.length) {
        return res.status(400).json({
          message: `Unknown module key(s): ${invalidKeys.join(", ")}`,
        });
      }
    }

    if (isSuperAdmin === false && isSelf) {
      return res
        .status(400)
        .json({ message: "You cannot remove your own superadmin access" });
    }

    if (isActive === false) {
      if (isSelf) {
        return res
          .status(400)
          .json({ message: "You cannot disable your own account" });
      }
      const targetUser = await AdminUser.findById(userId)
        .select("isSuperAdmin")
        .lean()
        .exec();
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const resultingIsSuperAdmin =
        isSuperAdmin !== undefined ? isSuperAdmin : targetUser.isSuperAdmin;
      if (resultingIsSuperAdmin) {
        return res
          .status(400)
          .json({ message: "Superadmins cannot be disabled" });
      }
    }

    const update = {};
    if (isSuperAdmin !== undefined) update.isSuperAdmin = Boolean(isSuperAdmin);
    if (allowedModules !== undefined)
      update.allowedModules = [...new Set(allowedModules)];
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const updatedUser = await AdminUser.findByIdAndUpdate(userId, update, {
      new: true,
    })
      .select("-password -refreshToken")
      .lean()
      .exec();

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await createLog({
      path: "adminAccess/AdminAccessLog",
      action: "Update Admin User Access",
      remarks: "Admin user access updated",
      status: "Success",
      user: req.userData?._id,
      ip: req.ip,
      sourceKey: "adminUser",
      sourceId: updatedUser._id,
      changes: update,
    });

    return res.status(200).json({
      message: "Access updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const createAdminUser = async (req, res, next) => {
  try {
    const { email, firstName, lastName, password } = req.body;
    const isCreatorSuperAdmin = Boolean(req.userData?.isSuperAdmin);

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await AdminUser.findOne({ email }).lean().exec();
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Only a superadmin can grant superadmin at creation time. A regular
    // user who only has the "add master user" module can create accounts,
    // but never with elevated access — that must be granted separately by
    // a superadmin via the User Access page.
    const isSuperAdmin = isCreatorSuperAdmin ? Boolean(req.body.isSuperAdmin) : false;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new AdminUser({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      isSuperAdmin,
      allowedModules: [],
    });
    await newUser.save();

    await createLog({
      path: "adminAccess/AdminAccessLog",
      action: "Create Admin User",
      remarks: "Master panel user created",
      status: "Success",
      user: req.userData?._id,
      ip: req.ip,
      sourceKey: "adminUser",
      sourceId: newUser._id,
      changes: { email, isSuperAdmin },
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        _id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isSuperAdmin: newUser.isSuperAdmin,
        allowedModules: newUser.allowedModules,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAdminUsers,
  getModuleCatalog,
  updateAdminUserAccess,
  createAdminUser,
};
