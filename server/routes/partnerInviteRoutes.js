const router = require("express").Router();
const axios = require("axios");
const { setLogModule } = require("../middlewares/logContext");
const { PARTNERS_PANEL_API_URL, PARTNERS_PANEL_ADMIN_API_KEY } = require("../config/partnersPanel");

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

// Invites (or extends an existing invite for) a Value Adds Partner lead into
// Partners Panel, once WoNo has approved that lead for the given service.
router.post("/", async (req, res) => {
  try {
    const { leadId, email, fullName, contactCode, contactNumber, linkedinProfile, currentCountry, message, submittedAt, service } =
      req.body || {};

    if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    if (!VALID_SERVICES.includes(service)) {
      return res.status(400).json({ message: "A valid partner service is required." });
    }

    const invitedBy = req.userData?.name || req.userData?.email || String(req.userData?._id || req.user || "");

    const response = await client.post("/", {
      email,
      service,
      fullName,
      contactCode,
      contactNumber,
      linkedinProfile,
      currentCountry,
      message,
      submittedAt,
      leadId,
      invitedBy,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({ message: error.response?.data?.message || "Failed to send the partner invite." });
  }
});

module.exports = router;
