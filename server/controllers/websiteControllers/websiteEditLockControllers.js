const WebsiteEditLock = require("../../models/website/WebsiteEditLock");

const SOURCE = "master-panel";
const LEASE_MS = 90_000;
const normalizeKey = (value) => String(value || "").trim().toLowerCase();
const publicLock = (lock, sessionId = "") => ({
  lockKey: lock.lockKey,
  editorName: lock.editorName || "Someone",
  source: lock.source,
  expiresAt: lock.expiresAt,
  isMine: Boolean(sessionId && lock.editorSessionId === sessionId),
});

const acquireWebsiteEditLock = async (req, res, next) => {
  try {
    const lockKey = normalizeKey(req.body?.lockKey || req.body?.searchKey);
    const editorSessionId = String(req.body?.editorSessionId || "").trim();
    if (!lockKey || !editorSessionId) {
      return res.status(400).json({ message: "lockKey and editorSessionId are required" });
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LEASE_MS);
    let lock;
    try {
      lock = await WebsiteEditLock.findOneAndUpdate(
        { lockKey, $or: [{ expiresAt: { $lte: now } }, { editorSessionId }] },
        {
          $set: {
            editorSessionId,
            editorUserId: String(req.user || ""),
            editorName: String(req.body?.editorName || "Master Panel user").trim().slice(0, 100),
            source: SOURCE,
            expiresAt,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    if (!lock) {
      const activeLock = await WebsiteEditLock.findOne({ lockKey, expiresAt: { $gt: now } }).lean();
      return res.status(423).json({
        code: "WEBSITE_EDIT_LOCKED",
        message: `This website is currently being edited from ${activeLock?.source === "host-panel" ? "HostPanel" : "Master Panel"}.`,
        lock: activeLock ? publicLock(activeLock, editorSessionId) : null,
      });
    }
    return res.status(200).json({ lock: publicLock(lock, editorSessionId) });
  } catch (error) {
    return next(error);
  }
};

const getWebsiteEditLock = async (req, res, next) => {
  try {
    const lockKey = normalizeKey(req.query?.lockKey || req.query?.searchKey);
    const editorSessionId = String(req.query?.editorSessionId || "").trim();
    const lock = lockKey
      ? await WebsiteEditLock.findOne({ lockKey, expiresAt: { $gt: new Date() } }).lean()
      : null;
    return res.status(200).json({ lock: lock ? publicLock(lock, editorSessionId) : null });
  } catch (error) {
    return next(error);
  }
};

const releaseWebsiteEditLock = async (req, res, next) => {
  try {
    const lockKey = normalizeKey(req.body?.lockKey || req.body?.searchKey);
    const editorSessionId = String(req.body?.editorSessionId || "").trim();
    if (lockKey && editorSessionId) {
      await WebsiteEditLock.deleteOne({ lockKey, editorSessionId });
    }
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

const assertWebsiteEditLock = async (lockKeyValue, editorSessionIdValue) => {
  const lockKey = normalizeKey(lockKeyValue);
  const editorSessionId = String(editorSessionIdValue || "").trim();
  const lock = await WebsiteEditLock.findOne({ lockKey, expiresAt: { $gt: new Date() } }).lean();
  if (!lock || !editorSessionId || lock.editorSessionId !== editorSessionId) {
    const error = new Error(
      lock
        ? `This website is currently being edited from ${lock.source === "host-panel" ? "HostPanel" : "Master Panel"}.`
        : "Your website editing session expired. Reopen the editor and try again.",
    );
    error.status = 423;
    error.code = "WEBSITE_EDIT_LOCKED";
    throw error;
  }
};

module.exports = {
  acquireWebsiteEditLock,
  getWebsiteEditLock,
  releaseWebsiteEditLock,
  assertWebsiteEditLock,
};
