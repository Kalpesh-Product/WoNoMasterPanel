const { v4: uuidv4 } = require("uuid");
const Log = require("../models/Log");
const { uploadFileToS3 } = require("../config/s3config");
const { buildDryRunReportPdf } = require("../utils/dryRunReportPdf");

// One place both data-upload tabs report their dry run to. The PDF is returned
// as the response body (so the browser downloads it straight away) and a copy
// is archived in S3, with a Master Panel log entry linking to it.

const MAX_SECTIONS = 8;
const MAX_ROWS_PER_SECTION = 1500;
const MAX_CELL_CHARS = 160;

const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "report";

const cleanText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, MAX_CELL_CHARS);
};

const normalizeSummary = (summary) =>
  (Array.isArray(summary) ? summary : [])
    .slice(0, 12)
    .map((item) => ({
      label: cleanText(item?.label),
      value: cleanText(item?.value ?? "0"),
    }))
    .filter((item) => item.label);

const normalizeSections = (sections) =>
  (Array.isArray(sections) ? sections : [])
    .slice(0, MAX_SECTIONS)
    .map((section) => {
      const columns = (Array.isArray(section?.columns) ? section.columns : [])
        .slice(0, 8)
        .map((column, index) => ({
          label: cleanText(column?.label, `Column ${index + 1}`),
          width: Number(column?.width) > 0 ? Number(column.width) : 0,
        }));

      const rows = (Array.isArray(section?.rows) ? section.rows : [])
        .slice(0, MAX_ROWS_PER_SECTION)
        .map((row) =>
          (Array.isArray(row) ? row : [row])
            .slice(0, columns.length)
            .map((cell) => cleanText(cell)),
        );

      return { title: cleanText(section?.title, "Changes"), columns, rows };
    })
    .filter((section) => section.columns.length && section.rows.length);

const resolveActor = (req = {}) => {
  const data = req.userData || {};
  const id = data.userId || data._id || req.user || "";
  const name =
    [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ").trim() ||
    data.fullName ||
    data.email ||
    "Unknown";

  return { id: String(id || ""), name };
};

const exportDryRunReport = async (req, res, next) => {
  try {
    const title = cleanText(req.body?.title, "Dry run report");
    const module = cleanText(req.body?.module, "Data Upload");
    const page = cleanText(req.body?.page);
    const fileName = cleanText(req.body?.fileName);
    const action = cleanText(req.body?.action, `Dry run PDF — ${title}`);
    const summary = normalizeSummary(req.body?.summary);
    const sections = normalizeSections(req.body?.sections);
    const notes = (Array.isArray(req.body?.notes) ? req.body.notes : [])
      .slice(0, 8)
      .map((note) => cleanText(note))
      .filter(Boolean);

    const buffer = await buildDryRunReportPdf({
      title,
      module,
      page,
      fileName,
      summary,
      sections,
      notes,
    });

    const baseName = `${slugify(fileName.replace(/\.csv$/i, "") || title)}-dry-run-${Date.now()}.pdf`;
    const key = `master-panel/dry-run-reports/${slugify(page || module)}/${uuidv4().slice(0, 8)}-${baseName}`;

    let archived = null;
    try {
      archived = await uploadFileToS3(key, {
        buffer,
        mimetype: "application/pdf",
        originalname: baseName,
      });
    } catch (uploadError) {
      // The download must still work when the bucket is unreachable — the log
      // entry is simply skipped and the response tells the panel about it.
      console.error("Dry-run report S3 upload failed:", uploadError?.message || uploadError);
    }

    const actor = resolveActor(req);
    let logId = "";

    if (archived?.url && actor.id) {
      try {
        const log = await Log.create({
          action,
          module,
          page,
          fullName: actor.name,
          performedBy: actor.id,
          payload: {
            reportUrl: archived.url,
            reportFileName: baseName,
            uploadFileName: fileName,
            summary: summary.map((item) => `${item.label}: ${item.value}`).join(" · "),
          },
          ipAddress: req.ip || "",
          method: "POST",
          statusCode: "200",
          success: true,
        });
        logId = String(log._id);
      } catch (logError) {
        console.error("Dry-run report log failed:", logError?.message || logError);
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`);
    res.setHeader("X-Report-Stored", archived?.url ? "true" : "false");
    if (archived?.url) res.setHeader("X-Report-Url", archived.url);
    if (logId) res.setHeader("X-Report-Log-Id", logId);

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { exportDryRunReport };
