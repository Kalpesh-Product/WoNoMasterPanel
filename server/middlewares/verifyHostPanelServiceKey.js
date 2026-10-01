// Gates the internal verification-requests API HostPanel calls when a host
// requests/renews/changes their business verification plan. A shared secret
// (not a per-user JWT) since these requests come from HostPanel's own
// server, not a signed-in staff user — mirrors verifyNomadsServiceKey.js,
// just for the HostPanel<->master-panel leg instead of Nomads<->master-panel.
const verifyHostPanelServiceKey = (req, res, next) => {
  const providedKey = req.headers["x-hostpanel-service-key"];
  const expectedKey = process.env.HOSTPANEL_SERVICE_API_KEY;

  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};

module.exports = { verifyHostPanelServiceKey };
