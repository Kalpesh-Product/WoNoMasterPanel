const ModuleAccessLog = require("../models/ModuleAccessLog");

const getActorFromRequest = (req = {}) => {
  const data = req.userData || {};
  const actorId = data?.userId || data?._id || req.user || "";
  const actorName = [data?.firstName, data?.middleName, data?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    actorId: String(actorId || ""),
    actorName: actorName || data?.fullName || data?.email || "Unknown",
    actorEmail: String(data?.email || ""),
  };
};

const createModuleAccessLog = async (payload = {}) => {
  try {
    return await ModuleAccessLog.create(payload);
  } catch (error) {
    return null;
  }
};

const resolveSourcePanel = (req = {}, fallback = "master_panel") => {
  const explicit = String(req?.headers?.["x-panel-source"] || "")
    .trim()
    .toLowerCase();
  if (explicit === "master_panel" || explicit === "host_panel") return explicit;

  const roles = Array.isArray(req?.roles) ? req.roles : [];
  const hasMasterRole = roles.some((role) => {
    const normalized = String(role || "").trim().toLowerCase();
    return normalized === "master admin" || normalized === "super admin";
  });

  if (hasMasterRole) return "master_panel";

  const requestPath = String(req?.originalUrl || req?.baseUrl || "")
    .trim()
    .toLowerCase();
  if (requestPath.startsWith("/api/access")) return "master_panel";
  if (requestPath.startsWith("/api/host-user")) return "host_panel";

  const origin = String(req?.headers?.origin || req?.headers?.referer || "")
    .trim()
    .toLowerCase();

  if (
    origin.includes("wonohost") ||
    origin.includes("hostfe") ||
    origin.includes(":3006")
  ) {
    return "host_panel";
  }

  return fallback;
};

module.exports = { getActorFromRequest, createModuleAccessLog, resolveSourcePanel };
