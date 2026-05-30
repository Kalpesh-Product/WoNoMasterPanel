const Permissions = require("../../models/Permissions");
const masterPermissions = require("../../config/masterPermissions");
const Company = require("../../models/hr/Company");
const CustomError = require("../../utils/customErrorlogs");
const UserData = require("../../models/hr/UserData");
const Department = require("../../models/Departments");
const { createLog } = require("../../utils/moduleLogs");
const {
  createModuleAccessLog,
  getActorFromRequest,
  resolveSourcePanel,
} = require("../../utils/moduleAccessLogs");

const getPermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const permissions = await Permissions.findOne({ user: userId })
      .lean()
      .exec();

    if (!permissions) {
      return res.status(200).json([]);
    }

    return res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};

const updatePermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid array of permissions" });
    }

    const uniquePermissions = [...new Set(permissions)];

    let userPermissions = await Permissions.findOne({ user: userId });
    const previousPermissions = Array.isArray(userPermissions?.permissions)
      ? userPermissions.permissions.map((id) => String(id))
      : [];

    if (!userPermissions) {
      userPermissions = new Permissions({
        user: userId,
        permissions: uniquePermissions,
      });
    } else {
      userPermissions.permissions = uniquePermissions;
    }

    const savedPermissions = await userPermissions.save();

    await UserData.findByIdAndUpdate(userId, {
      permissions: savedPermissions._id,
    });

    const targetUser = await UserData.findById(userId)
      .select("firstName middleName lastName email")
      .lean();
    const actor = getActorFromRequest(req);
    const previousSet = new Set(previousPermissions);
    const nextSet = new Set(uniquePermissions);
    const enabledModules = uniquePermissions.filter((id) => !previousSet.has(id));
    const disabledModules = previousPermissions.filter((id) => !nextSet.has(id));

    await createModuleAccessLog({
      ...actor,
      sourcePanel: resolveSourcePanel(req, "master_panel"),
      action: "master_permissions_updated",
      targetType: "user",
      targetId: String(userId || ""),
      targetName:
        [targetUser?.firstName, targetUser?.middleName, targetUser?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || targetUser?.email || "",
      companyId: String(req?.company || ""),
      enabledModules,
      disabledModules,
      enabledCount: enabledModules.length,
      disabledCount: disabledModules.length,
      changes: {
        previousPermissions,
        nextPermissions: uniquePermissions,
        enabledModules,
        disabledModules,
        enabledCount: enabledModules.length,
        disabledCount: disabledModules.length,
      },
      ipAddress: req.ip || "",
    });

    return res.status(200).json({
      message: "Permissions updated successfully",
      data: savedPermissions,
    });
  } catch (error) {
    next(error);
  }
};

const getDepartmentWiseUsers = async (req, res, next) => {
  try {
    const { departments, roles, company } = req;

    const deptIds = departments.map((dept) => dept._id);
    let query = {};

    if (!roles.includes("Master Admin") && !roles.includes("Super Admin")) {
      query = { _id: { $in: deptIds } };
    }

    const fetchedDepartments = await Department.find(query)
      .select("departmentId name isActive")
      .lean()
      .exec();
    const users = await UserData.find({ isActive: true })
      .select(
        "firstName lastName empId departments role email workLocation gender phone profilePicture employeeType reportsTo shift homeAddress isActive credits"
      )
      .populate([{ path: "role" }])
      .lean()
      .exec();

    const departmentWiseEmployees = fetchedDepartments.map((dept) => {
      const employees = users.filter((user) =>
        user.departments?.some(
          (dep) => dep._id?.toString() === dept._id.toString()
        )
      );

      return {
        ...dept,
        employees,
      };
    });

    res.status(200).json({ data: departmentWiseEmployees });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPermissions, updatePermissions, getDepartmentWiseUsers };
