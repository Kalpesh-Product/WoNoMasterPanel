const router = require("express").Router();
const axios = require("axios");
const upload = require("../config/multerConfig");
const { setLogModule } = require("../middlewares/logContext");
const { PARTNERS_PANEL_API_URL, PARTNERS_PANEL_ADMIN_API_KEY } = require("../config/partnersPanel");
const PartnerInviteSettings = require("../models/PartnerInviteSettings");
const {
  getDefaultPartnerAgreement,
  setDefaultPartnerAgreement,
  removeDefaultPartnerAgreement,
} = require("../controllers/partnerInviteSettingsController");

const client = axios.create({
  baseURL: `${PARTNERS_PANEL_API_URL}/invites`,
  headers: { "x-admin-api-key": PARTNERS_PANEL_ADMIN_API_KEY },
  timeout: 15000,
});

// Must match the Partner model's service keys on the Partners Panel side.
const VALID_SERVICES = [
  "visaPartner",
  "companySetupPartner",
  "activationSupportPartner",
  "consultationSupportPartner",
  "workationPartner",
];

router.use(setLogModule("Partner Invites"));

// The default agreement attached to every partner invite (upload once, replace when it changes).
router.get("/agreement", getDefaultPartnerAgreement);
router.put("/agreement", upload.single("agreement"), setDefaultPartnerAgreement);
router.delete("/agreement", removeDefaultPartnerAgreement);

// Invites (or extends an existing invite for) a Value Adds Partner lead into
// Partners Panel, once WoNo has approved that lead for the given service.
router.post("/", async (req, res) => {
  try {
    const { leadId, email, fullName, contactCode, contactNumber, linkedinProfile, currentCountry, message, submittedAt, service, services } =
      req.body || {};

    const serviceList = Array.isArray(services) && services.length ? services : service ? [service] : [];

    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    if (!serviceList.length || serviceList.some((entry) => !VALID_SERVICES.includes(entry))) {
      return res.status(400).json({ message: "A valid partner service is required." });
    }

    // The agreement is compulsory — nothing goes out without one saved, same
    // gate as Signup Leads' invite flow for hosts.
    const settings = await PartnerInviteSettings.findOne({ key: "default" }).lean();
    if (!settings?.agreement?.url) {
      return res.status(400).json({ message: "Attach the agreement before sending an invite." });
    }

    const invitedBy = req.userData?.name || req.userData?.email || String(req.userData?._id || req.user || "");

    const response = await client.post("/", {
      email,
      services: serviceList,
      fullName,
      contactCode,
      contactNumber,
      linkedinProfile,
      currentCountry,
      message,
      submittedAt,
      leadId,
      invitedBy,
      agreementDocument: {
        url: settings.agreement.url,
        id: settings.agreement.id,
        name: settings.agreement.name,
      },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({ message: error.response?.data?.message || "Failed to send the partner invite." });
  }
});

module.exports = router;
