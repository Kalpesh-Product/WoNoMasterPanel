const Log = require("../models/Log");
const ModuleAccessLog = require("../models/ModuleAccessLog");
const HostActivityLog = require("../models/HostActivityLog");
const HostCompany = require("../models/hostCompany/hostCompany");
const Workspace = require("../models/hostCompany/Workspace");
const modelMap = require("../config/modelMap");
const mongoose = require("mongoose");

const getLogs = async (req, res, next) => {
  try {
    const logs = await Log.find().populate([
      { path: "performedBy", select: "firstName middleName lastName" },
    ]);

    const populatedLogs = await Promise.all(
      logs.map(async (log) => {
        const populatedPayload = { ...log.payload };

        for (const key of Object.keys(populatedPayload)) {
          const modelName = modelMap[key];
          const value = populatedPayload[key];

          if (modelName && mongoose.isValidObjectId(value)) {
            const Model = mongoose.model(modelName);
            populatedPayload[key] = await Model.findById(value).lean();
          }
        }

        return {
          ...log.toObject(),
          payload: populatedPayload,
        };
      })
    );

    return res.status(200).json(populatedLogs);
  } catch (error) {
    next(error);
  }
};

const getModuleAccessLogs = async (req, res, next) => {
  try {
    const logs = await ModuleAccessLog.find().sort({ createdAt: -1 }).lean();

    const workspaceIdsNeedingCompany = Array.from(
      new Set(
        logs
          .filter(
            (log) =>
              !String(log?.companyId || "").trim() &&
              String(log?.workspaceId || "").trim(),
          )
          .map((log) => String(log.workspaceId).trim()),
      ),
    );

    const workspaceCompanyMap = new Map();
    if (workspaceIdsNeedingCompany.length) {
      const workspaceDocs = await Workspace.find({
        _id: { $in: workspaceIdsNeedingCompany },
      })
        .select("_id companyId workspaceName")
        .lean();

      workspaceDocs.forEach((workspace) => {
        workspaceCompanyMap.set(
          String(workspace?._id || "").trim(),
          String(workspace?.companyId || "").trim(),
        );
      });
    }

    const companyIdsRaw = Array.from(
      new Set(
        logs
          .map((log) => {
            const fromLog = String(log?.companyId || "").trim();
            if (fromLog) return fromLog;
            return workspaceCompanyMap.get(String(log?.workspaceId || "").trim()) || "";
          })
          .filter(Boolean),
      ),
    );

    const companyIdBases = Array.from(
      new Set(
        companyIdsRaw
          .map((id) => String(id || "").trim().split("-")[0])
          .filter((id) => /^[a-f0-9]{24}$/i.test(id)),
      ),
    );

    const companies = companyIdsRaw.length
      ? await HostCompany.find({
          $or: [
            { companyId: { $in: companyIdsRaw } },
            { companyId: { $in: companyIdBases } },
            { _id: { $in: companyIdBases } },
          ],
        })
          .select("_id companyId companyName")
          .lean()
      : [];

    const companyMap = new Map();
    companies.forEach((company) => {
      const companyName = String(company?.companyName || "").trim();
      const companyId = String(company?.companyId || "").trim();
      const baseCompanyId = companyId.split("-")[0];
      const companyObjectId = String(company?._id || "").trim();

      if (companyId) companyMap.set(companyId, companyName);
      if (baseCompanyId) companyMap.set(baseCompanyId, companyName);
      if (companyObjectId) companyMap.set(companyObjectId, companyName);
    });

    const resolveCompanyName = (rawCompanyId) => {
      const logCompanyId = String(rawCompanyId || "").trim();
      if (!logCompanyId) return "-";

      const exact = companyMap.get(logCompanyId);
      if (exact) return exact;

      const normalizedPrefix = logCompanyId.split("-")[0];
      if (normalizedPrefix && companyMap.get(normalizedPrefix)) {
        return companyMap.get(normalizedPrefix);
      }

      const prefixMatch = companies.find((company) => {
        const hostCompanyId = String(company?.companyId || "").trim();
        return (
          hostCompanyId &&
          (logCompanyId.startsWith(`${hostCompanyId}-`) ||
            hostCompanyId.startsWith(`${logCompanyId}-`))
        );
      });

      return prefixMatch?.companyName || "-";
    };

    const enrichedLogs = logs.map((log) => {
      const effectiveCompanyId =
        String(log?.companyId || "").trim() ||
        workspaceCompanyMap.get(String(log?.workspaceId || "").trim()) ||
        "";

      return {
        ...log,
        companyId: effectiveCompanyId || log?.companyId || "",
        hostCompany: resolveCompanyName(effectiveCompanyId),
      };
    });

    return res.status(200).json(enrichedLogs);
  } catch (error) {
    next(error);
  }
};

const getHostActivityLogs = async (req, res, next) => {
  try {
    const { companyId, workspaceId, startDate, endDate } = req.query;

    const filter = {};
    if (companyId) filter.companyId = String(companyId).trim();
    if (workspaceId) filter.workspaceId = String(workspaceId).trim();
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Host panel volume grows fast; cap the response so the table stays usable.
    const limit = Math.min(Number(req.query.limit) || 5000, 20000);

    const logs = await HostActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = { getLogs, getModuleAccessLogs, getHostActivityLogs };
