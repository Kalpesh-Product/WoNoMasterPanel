const router = require("express").Router();
const {
  listAdminUsers,
  getModuleCatalog,
  updateAdminUserAccess,
  createAdminUser,
} = require("../controllers/adminAccessController");
const requireSuperAdmin = require("../middlewares/requireSuperAdmin");
const requireModuleAccess = require("../middlewares/requireModuleAccess");

// Managing other users' access stays superadmin-exclusive.
router.get("/users", requireSuperAdmin, listAdminUsers);
router.get("/modules", requireSuperAdmin, getModuleCatalog);
router.patch("/users/:userId", requireSuperAdmin, updateAdminUserAccess);

// Creating a master panel user is its own grantable module — superadmins
// always have it, other users only if given the "dashboard.add-master-user"
// module via the User Access page.
router.post(
  "/users",
  requireModuleAccess("dashboard.add-master-user"),
  createAdminUser,
);

module.exports = router;
