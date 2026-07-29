const requireSuperAdmin = (req, res, next) => {
  if (!req.userData?.isSuperAdmin) {
    return res.status(403).json({ message: "Superadmin access required" });
  }
  next();
};

module.exports = requireSuperAdmin;
