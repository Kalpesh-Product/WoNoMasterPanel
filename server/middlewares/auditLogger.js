const emitter = require("../utils/eventEmitter");

const auditLogger = (req, res, next) => {
  try {
    const startTime = Date.now();

    const validMethods = ["POST", "PATCH", "PUT", "DELETE"];
    const cleanUrl = req.originalUrl.split("?")[0];
    const pathSegments = cleanUrl.split("/").filter(Boolean);

    // If last segment is alphanumeric or just numeric, it's likely an ID
    const isPossiblyId = (segment) => /^[a-zA-Z0-9]+$/.test(segment);

    const lastSegment =
      pathSegments.length > 1 && isPossiblyId(pathSegments.at(-1))
        ? pathSegments.at(-2)
        : pathSegments.at(-1);

    // Skip invalid HTTP methods
    if (!validMethods.includes(req.method)) return next();

    // Skip refresh token route
    if (req.originalUrl.includes("refresh")) return next();

    // Skip if body is empty on methods other then GET
    if (
      !req.body &&
      !isPossiblyId &&
      req.method !== "GET" &&
      Object.keys(req.body).length === 0
    ) {
      return next();
    }

    res.on("finish", async () => {
      try {
        // Routes with optional auth (eg: /api/hosts) only log actions that can
        // be attributed to a logged-in master panel user.
        if (!req.userData) return;

        const status = res.statusCode;
        const success = status < 400;
        const { method, ip } = req;
        const url = req.originalUrl;
        const { firstName, lastName, _id } = req.userData;
        const fullName = `${firstName} ${lastName}`;

        const logContext = req.logContext || {};
        const performedBy = logContext.performedBy || _id;

        const parseJSONFields = (obj) => {
          for (const key in obj) {
            if (
              typeof obj[key] === "string" &&
              obj[key].startsWith("[") &&
              obj[key].endsWith("]")
            ) {
              try {
                const parsed = JSON.parse(obj[key]);
                if (Array.isArray(parsed)) {
                  obj[key] = parsed;
                }
              } catch (_) {
                // leave as-is if not parseable
              }
            }
          }
          return obj;
        };

        // Website builder bodies can carry very long strings (drafts, embedded
        // data URLs); cap values so log documents stay small.
        const MAX_PAYLOAD_VALUE_LENGTH = 1000;
        const capValue = (value) =>
          typeof value === "string" && value.length > MAX_PAYLOAD_VALUE_LENGTH
            ? `${value.slice(0, MAX_PAYLOAD_VALUE_LENGTH)}… [truncated]`
            : value;

        const flattenObject = (obj, prefix = "", result = {}) => {
          for (const key in obj) {
            const value = obj[key];
            const prefixedKey = prefix ? `${prefix}.${key}` : key;

            if (
              typeof value === "object" &&
              value !== null &&
              !Array.isArray(value)
            ) {
              flattenObject(value, prefixedKey, result);
            } else {
              result[prefixedKey] = capValue(value);
            }
          }
          return result;
        };

        let combinedPayload = parseJSONFields({
          ...(req.body || {}),
          ...(req.params || {}),
          ...(req.query || {}),
        });

        // 🧩 Handle uploaded files
        if (req.file) {
          combinedPayload.uploadedFile = {
            fieldName: req.file.fieldname,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
          };
        }

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          combinedPayload.uploadedFiles = req.files.map((f) => ({
            fieldName: f.fieldname,
            originalName: f.originalname,
            size: f.size,
            mimeType: f.mimetype,
          }));
        }

        // Mask sensitive fields before flattening
        ["password", "newPassword", "confirmPassword"].forEach((field) => {
          if (field in combinedPayload) combinedPayload[field] = "***";
        });

        const updatedPayload = flattenObject(combinedPayload);

        // When the controller supplied a proper change list, store only the
        // changes plus identifying fields instead of the full request body.
        const hasChanges =
          Array.isArray(logContext.changes) && logContext.changes.length > 0;
        const IDENTIFYING_KEYS = [
          "companyId",
          "companyName",
          "workspaceId",
          "searchKey",
          "vertical",
          "jobCode",
          "reviewId",
          "leadId",
        ];
        const minimalPayload = Object.fromEntries(
          Object.entries(updatedPayload).filter(([key]) =>
            IDENTIFYING_KEYS.includes(key),
          ),
        );

        // Company attribution: controller-provided first, request fields as
        // fallback so every log can say which company it belongs to.
        const companyName =
          logContext.companyName ||
          combinedPayload.companyName ||
          undefined;
        const companyId =
          logContext.companyId ||
          combinedPayload.companyId ||
          combinedPayload.workspaceId ||
          undefined;

        const logData = {
          performedBy,
          fullName,
          ipAddress: ip,
          action: logContext.action || lastSegment,
          method,
          statusCode: status,
          success,
          payload: hasChanges ? minimalPayload : updatedPayload,
          responseTime: Date.now() - startTime,
          // Controller-provided detail (website builder page/section diffs,
          // credits used, draft vs published, module name, etc.)
          ...(logContext.module ? { module: logContext.module } : {}),
          ...(logContext.page ? { page: logContext.page } : {}),
          ...(hasChanges ? { changes: logContext.changes } : {}),
          ...(logContext.creditsUsed !== undefined
            ? { creditsUsed: logContext.creditsUsed }
            : {}),
          ...(logContext.creditsRemaining !== undefined
            ? { creditsRemaining: logContext.creditsRemaining }
            : {}),
          ...(logContext.publishState
            ? { publishState: logContext.publishState }
            : {}),
          ...(companyName ? { companyName } : {}),
          ...(companyId ? { companyId: String(companyId) } : {}),
        };

        emitter.emit("storeLog", logData);
      } catch (error) {
        console.error("Error in auditLogger:", error.message);
      }
    });

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auditLogger;
