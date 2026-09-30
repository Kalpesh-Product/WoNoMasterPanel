const jwt = require("jsonwebtoken");

// Same as verifyJwt but never rejects: routes on shared mounts (eg: /api/hosts)
// are also consumed by other apps without a master panel token. When a valid
// token is present, req.userData is populated so auditLogger can attribute the
// action; otherwise the request passes through untouched and is not logged.
const verifyJwtOptional = (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return next();

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (!err && decoded?.userInfo) {
      // Admin access tokens normally carry Mongoose's `_id`; retain the
      // legacy `userId` fallback for already-issued tokens.
      req.user = decoded.userInfo.userId || decoded.userInfo._id || decoded.userInfo.id;
      req.roles = decoded.userInfo.roles;
      req.company = decoded.userInfo.company;
      req.departments = decoded.userInfo.departments;
      req.userData = decoded.userInfo;
    }
    next();
  });
};

module.exports = verifyJwtOptional;
