const PartnerInviteSettings = require("../models/PartnerInviteSettings");
const { uploadFileToS3 } = require("../config/s3config");

// GET /api/partner-invites/agreement — the saved default agreement, if any.
const getDefaultPartnerAgreement = async (req, res, next) => {
  try {
    const settings = await PartnerInviteSettings.findOne({ key: "default" }).lean();
    const agreement = settings?.agreement?.url
      ? {
          url: settings.agreement.url,
          name: settings.agreement.name || "Agreement.pdf",
          updatedAt: settings.agreement.updatedAt || null,
        }
      : null;
    return res.status(200).json({ agreement });
  } catch (error) {
    next(error);
  }
};

// PUT /api/partner-invites/agreement (multipart "agreement", PDF)
const setDefaultPartnerAgreement = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Choose a PDF to upload" });
    }
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "The agreement must be a PDF file" });
    }
    const safeName =
      String(req.file.originalname || "agreement.pdf")
        .replace(/[^A-Za-z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "agreement.pdf";
    const uploaded = await uploadFileToS3(
      `partner-agreements/default/${Date.now()}_${safeName}`,
      req.file,
    );
    const settings = await PartnerInviteSettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          agreement: { url: uploaded.url, id: uploaded.id, name: safeName, updatedAt: new Date() },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return res.status(200).json({
      message: "Default agreement saved",
      agreement: { url: settings.agreement.url, name: settings.agreement.name, updatedAt: settings.agreement.updatedAt },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/partner-invites/agreement
const removeDefaultPartnerAgreement = async (req, res, next) => {
  try {
    await PartnerInviteSettings.findOneAndUpdate(
      { key: "default" },
      { $set: { agreement: { url: "", id: "", name: "", updatedAt: null } } },
    );
    return res.status(200).json({ message: "Default agreement removed" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDefaultPartnerAgreement,
  setDefaultPartnerAgreement,
  removeDefaultPartnerAgreement,
};
