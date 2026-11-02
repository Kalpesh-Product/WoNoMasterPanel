const crypto = require("crypto");
const sharp = require("sharp");
const WebsiteThemeCatalog = require("../../models/website/WebsiteThemeCatalog");
const { uploadFileToS3, deleteFileFromS3ByUrl } = require("../../config/s3config");

const text = (value) => String(value ?? "").trim();
const slug = (value) => text(value).toLowerCase();
const boolean = (value) => value === true || value === "true";
const color = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(text(value)) ? text(value) : fallback);

const statusFor = (theme) => {
  if (theme.visible === false) return "hidden";
  return theme.enabled === true ? "live" : "coming-soon";
};

const statusFlags = (value) => {
  const status = ["live", "coming-soon", "hidden"].includes(value) ? value : "coming-soon";
  return {
    enabled: status === "live",
    visible: status !== "hidden",
  };
};

const serializeTheme = (theme, { publicView = false } = {}) => {
  const value = theme?.toObject ? theme.toObject() : theme;
  const serialized = {
    _id: text(value?._id),
    id: slug(value?.templateId),
    templateId: slug(value?.templateId),
    name: text(value?.name),
    tag: slug(value?.vertical),
    vertical: slug(value?.vertical),
    description: text(value?.description),
    swatch: {
      bg: text(value?.swatch?.bg) || "#ffffff",
      fg: text(value?.swatch?.fg) || "#111111",
      accent: text(value?.swatch?.accent) || "#0aa9ef",
      font: text(value?.swatch?.font) || "'Poppins', sans-serif",
    },
    heroImage: text(value?.desktopScreenshot?.url),
    heroImageMobile: text(value?.mobileScreenshot?.url),
    externalDemoUrl: text(value?.externalDemoUrl),
    status: statusFor(value),
    enabled: value?.enabled === true,
    visible: value?.visible !== false,
    featured: value?.featured === true,
    showOnHostHome: value?.showOnHostHome === true,
    sortOrder: Number(value?.sortOrder || 0),
    disabledReason: text(value?.disabledReason) || "Coming soon",
    updatedAt: value?.updatedAt || null,
  };
  if (!publicView) {
    serialized.desktopScreenshot = value?.desktopScreenshot || {};
    serialized.mobileScreenshot = value?.mobileScreenshot || {};
    serialized.createdAt = value?.createdAt || null;
    serialized.updatedBy = text(value?.updatedBy);
  }
  return serialized;
};

const removeUploaded = async (items) => {
  await Promise.all(items.filter(Boolean).map(async (item) => {
    try {
      await deleteFileFromS3ByUrl(item.url);
    } catch (error) {
      console.error("Failed to clean up theme screenshot:", error.message);
    }
  }));
};

const uploadScreenshot = async (file, templateId, type) => {
  if (!file) return null;
  const image = sharp(file.buffer).rotate();
  const resized = type === "desktop"
    ? image.resize(1600, 1000, { fit: "cover", position: "north" })
    : image.resize({ width: 750 });
  const { data: buffer, info } = await resized
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const key = `website-theme-catalog/${templateId}/${type}-${Date.now()}-${crypto.randomUUID()}.webp`;
  const uploaded = await uploadFileToS3(key, { buffer, mimetype: "image/webp" });
  return { id: uploaded.id, url: uploaded.url, width: info.width, height: info.height, format: "webp" };
};

const validateInput = (body, existing) => {
  const templateId = slug(body.templateId || existing?.templateId);
  const name = text(body.name ?? existing?.name);
  const vertical = slug(body.vertical ?? existing?.vertical);
  const description = text(body.description ?? existing?.description);
  if (!templateId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId)) return "Enter a valid template ID";
  if (!name) return "Theme name is required";
  if (!vertical) return "Vertical is required";
  if (!description) return "Description is required";
  if (text(body.externalDemoUrl) && !/^https?:\/\//i.test(text(body.externalDemoUrl))) return "Preview URL must start with http:// or https://";
  return "";
};

const getWebsiteThemeCatalog = async (_req, res, next) => {
  try {
    const themes = await WebsiteThemeCatalog.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return res.status(200).json(themes.map((theme) => serializeTheme(theme)));
  } catch (error) {
    next(error);
  }
};

const getPublicWebsiteThemes = async (_req, res, next) => {
  try {
    const themes = await WebsiteThemeCatalog.find({ visible: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    // Catalog visibility and ordering are controlled from the Master Panel and
    // should be reflected immediately on the public Themes page. Prevent the
    // browser and intermediary caches from serving an older catalog snapshot.
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });
    return res.status(200).json({ themes: themes.map((theme) => serializeTheme(theme, { publicView: true })) });
  } catch (error) {
    next(error);
  }
};

const createWebsiteTheme = async (req, res, next) => {
  const uploaded = [];
  try {
    const validationError = validateInput(req.body);
    if (validationError) return res.status(400).json({ message: validationError });
    const templateId = slug(req.body.templateId);
    if (await WebsiteThemeCatalog.exists({ templateId })) {
      return res.status(409).json({ message: "That template ID is already in the catalog" });
    }
    const flags = statusFlags(text(req.body.status));
    const desktop = await uploadScreenshot(req.files?.desktopScreenshot?.[0], templateId, "desktop");
    if (desktop) uploaded.push(desktop);
    const mobile = await uploadScreenshot(req.files?.mobileScreenshot?.[0], templateId, "mobile");
    if (mobile) uploaded.push(mobile);
    if (flags.enabled && (!desktop || !mobile)) {
      await removeUploaded(uploaded);
      return res.status(400).json({ message: "Live themes require desktop and mobile screenshots" });
    }
    const last = await WebsiteThemeCatalog.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const theme = await WebsiteThemeCatalog.create({
      templateId,
      name: text(req.body.name),
      vertical: slug(req.body.vertical),
      description: text(req.body.description),
      swatch: {
        bg: color(req.body.swatchBg, "#ffffff"),
        fg: color(req.body.swatchFg, "#111111"),
        accent: color(req.body.swatchAccent, "#0aa9ef"),
        font: text(req.body.swatchFont) || "'Poppins', sans-serif",
      },
      desktopScreenshot: desktop || {},
      mobileScreenshot: mobile || {},
      externalDemoUrl: text(req.body.externalDemoUrl),
      ...flags,
      featured: boolean(req.body.featured),
      showOnHostHome: boolean(req.body.showOnHostHome),
      disabledReason: text(req.body.disabledReason) || "Coming soon",
      sortOrder: Number(last?.sortOrder || 0) + 10,
      updatedBy: text(req.user),
    });
    if (theme.featured) {
      await WebsiteThemeCatalog.updateMany({ _id: { $ne: theme._id } }, { $set: { featured: false } });
    }
    return res.status(201).json({ message: "Theme added to the catalog", theme: serializeTheme(theme) });
  } catch (error) {
    await removeUploaded(uploaded);
    next(error);
  }
};

const updateWebsiteTheme = async (req, res, next) => {
  const uploaded = [];
  try {
    const theme = await WebsiteThemeCatalog.findById(req.params.themeId);
    if (!theme) return res.status(404).json({ message: "Theme not found" });
    const validationError = validateInput(req.body, theme);
    if (validationError) return res.status(400).json({ message: validationError });
    const flags = statusFlags(text(req.body.status) || statusFor(theme));
    const desktop = await uploadScreenshot(req.files?.desktopScreenshot?.[0], theme.templateId, "desktop");
    if (desktop) uploaded.push(desktop);
    const mobile = await uploadScreenshot(req.files?.mobileScreenshot?.[0], theme.templateId, "mobile");
    if (mobile) uploaded.push(mobile);
    const nextDesktop = desktop || theme.desktopScreenshot;
    const nextMobile = mobile || theme.mobileScreenshot;
    if (flags.enabled && (!nextDesktop?.url || !nextMobile?.url)) {
      await removeUploaded(uploaded);
      return res.status(400).json({ message: "Live themes require desktop and mobile screenshots" });
    }
    const oldDesktop = desktop && theme.desktopScreenshot?.url ? { url: theme.desktopScreenshot.url } : null;
    const oldMobile = mobile && theme.mobileScreenshot?.url ? { url: theme.mobileScreenshot.url } : null;
    theme.name = text(req.body.name ?? theme.name);
    theme.vertical = slug(req.body.vertical ?? theme.vertical);
    theme.description = text(req.body.description ?? theme.description);
    theme.externalDemoUrl = text(req.body.externalDemoUrl ?? theme.externalDemoUrl);
    theme.swatch = {
      bg: color(req.body.swatchBg, theme.swatch?.bg || "#ffffff"),
      fg: color(req.body.swatchFg, theme.swatch?.fg || "#111111"),
      accent: color(req.body.swatchAccent, theme.swatch?.accent || "#0aa9ef"),
      font: text(req.body.swatchFont) || theme.swatch?.font || "'Poppins', sans-serif",
    };
    theme.desktopScreenshot = nextDesktop;
    theme.mobileScreenshot = nextMobile;
    theme.enabled = flags.enabled;
    theme.visible = flags.visible;
    theme.featured = boolean(req.body.featured);
    theme.showOnHostHome = boolean(req.body.showOnHostHome);
    theme.disabledReason = text(req.body.disabledReason) || "Coming soon";
    theme.updatedBy = text(req.user);
    await theme.save();
    if (theme.featured) {
      await WebsiteThemeCatalog.updateMany({ _id: { $ne: theme._id } }, { $set: { featured: false } });
    }
    await removeUploaded([oldDesktop, oldMobile]);
    return res.status(200).json({ message: "Theme catalog entry updated", theme: serializeTheme(theme) });
  } catch (error) {
    await removeUploaded(uploaded);
    next(error);
  }
};

const reorderWebsiteThemes = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.themeIds) ? req.body.themeIds.map(text).filter(Boolean) : [];
    const currentIds = (await WebsiteThemeCatalog.find({}).select("_id").lean()).map((row) => text(row._id));
    if (ids.length !== currentIds.length || new Set(ids).size !== ids.length || currentIds.some((id) => !ids.includes(id))) {
      return res.status(400).json({ message: "The saved order must include every catalog theme exactly once" });
    }
    await WebsiteThemeCatalog.bulkWrite(ids.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder: (index + 1) * 10, updatedBy: text(req.user) } } },
    })));
    const themes = await WebsiteThemeCatalog.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return res.status(200).json({ message: "Theme order saved", themes: themes.map((theme) => serializeTheme(theme)) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWebsiteThemeCatalog,
  getPublicWebsiteThemes,
  createWebsiteTheme,
  updateWebsiteTheme,
  reorderWebsiteThemes,
};
