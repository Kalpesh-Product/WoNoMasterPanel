require("dotenv").config();
const mongoose = require("mongoose");

const ModuleAccessLog = require("../models/ModuleAccessLog");
const HostCompany = require("../models/hostCompany/hostCompany");
const Workspace = require("../models/hostCompany/Workspace");

const isObjectId = (value = "") => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const buildCandidates = ({ rawCompanyId, workspaceCompanyId }) => {
  const candidates = new Set();
  const raw = String(rawCompanyId || "").trim();
  const workspace = String(workspaceCompanyId || "").trim();

  if (raw) {
    candidates.add(raw);
    candidates.add(raw.split("-")[0]);
  }
  if (workspace) {
    candidates.add(workspace);
    candidates.add(workspace.split("-")[0]);
  }

  return Array.from(candidates).filter(Boolean);
};

const resolveHostCompany = async (candidates = []) => {
  if (!candidates.length) return null;
  const objectIdCandidates = candidates.filter(isObjectId);

  return HostCompany.findOne({
    $or: [
      { companyId: { $in: candidates } },
      ...(objectIdCandidates.length ? [{ _id: { $in: objectIdCandidates } }] : []),
    ],
  })
    .select("_id companyId companyName")
    .lean();
};

const run = async ({ apply = false } = {}) => {
  await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });

  const logs = await ModuleAccessLog.find({})
    .select("_id companyId workspaceId")
    .lean();

  const workspaceIds = Array.from(
    new Set(logs.map((log) => String(log?.workspaceId || "").trim()).filter(isObjectId)),
  );

  const workspaces = workspaceIds.length
    ? await Workspace.find({ _id: { $in: workspaceIds } }).select("_id companyId").lean()
    : [];
  const workspaceCompanyMap = new Map(
    workspaces.map((workspace) => [
      String(workspace?._id || "").trim(),
      String(workspace?.companyId || "").trim(),
    ]),
  );

  let updated = 0;
  let unresolved = 0;
  const bulkOps = [];

  for (const log of logs) {
    const currentCompanyId = String(log?.companyId || "").trim();
    const workspaceCompanyId = workspaceCompanyMap.get(String(log?.workspaceId || "").trim()) || "";

    const candidates = buildCandidates({
      rawCompanyId: currentCompanyId,
      workspaceCompanyId,
    });

    const matchedHostCompany = await resolveHostCompany(candidates);
    if (!matchedHostCompany) {
      unresolved += 1;
      continue;
    }

    const canonicalCompanyId =
      String(matchedHostCompany?.companyId || "").trim() ||
      String(matchedHostCompany?._id || "").trim();

    if (!canonicalCompanyId || canonicalCompanyId === currentCompanyId) continue;

    updated += 1;
    bulkOps.push({
      updateOne: {
        filter: { _id: log._id },
        update: { $set: { companyId: canonicalCompanyId } },
      },
    });
  }

  if (apply && bulkOps.length) {
    await ModuleAccessLog.bulkWrite(bulkOps);
  }

  await mongoose.disconnect();
  return {
    mode: apply ? "apply" : "dry-run",
    scanned: logs.length,
    updated,
    unresolved,
  };
};

const apply = process.argv.includes("--apply");
run({ apply })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error?.message || error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
