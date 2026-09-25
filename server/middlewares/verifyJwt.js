const jwt = require("jsonwebtoken");

const verifyJwt = (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return res.status(401).json({ message: "Unauthorized" });

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Forbidden" });

    // Admin access tokens are signed from the Mongo document returned by
    // Mongoose, so the identifier is normally `_id`. Keep the older `userId`
    // shape as a fallback for tokens issued by previous versions.
    req.user = decoded.userInfo.userId || decoded.userInfo._id || decoded.userInfo.id;
    req.roles = decoded.userInfo.roles;
    req.company = decoded.userInfo.company;
    req.departments = decoded.userInfo.departments;
    req.totalCredits = decoded.userInfo.totalMeetingCredits;
    req.creditsBalance = decoded.userInfo.meetingCreditBalance;

    req.userData = decoded.userInfo;

    next();
  });
};

module.exports = verifyJwt;
