// Allows the request through if the caller is a superadmin OR has the given
// module key in their allowedModules (server/config/masterPanelModules.js).
const requireModuleAccess = (moduleKey) => (req, res, next) => {
  const userData = req.userData || {};
  if (userData.isSuperAdmin || (userData.allowedModules || []).includes(moduleKey)) {
    return next();
  }
  return res.status(403).json({ message: "You don't have access to this module" });
};

module.exports = requireModuleAccess;
