// Gates the internal verification-payments API the Nomads backend calls for
// self-serve renew/change-plan. A shared secret (not a per-user JWT) since
// these requests come from the Nomads backend itself, not a signed-in staff
// user — mirrors D:\Nomads\backend\middlewares\verifyAdminApiKey.js, reversed.
const verifyNomadsServiceKey = (req, res, next) => {
  const providedKey = req.headers["x-nomads-service-key"];
  const expectedKey = process.env.NOMADS_SERVICE_API_KEY;

  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};

module.exports = { verifyNomadsServiceKey };
