const router = require("express").Router();
const axios = require("axios");
const { setLogModule } = require("../middlewares/logContext");

const baseURL = String(process.env.NOMADS_BASE_URL || "http://localhost:3000/api").replace(/\/+$/, "");
const client = axios.create({
  baseURL: `${baseURL}/become-contributor`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

router.use(setLogModule("Contributor Leads"));
router.get("/", async (req, res) => {
  try {
    const response = await client.get("/");
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({ message: error.response?.data?.message || "Failed to load contributor leads." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid contributor lead ID." });
    }
    const { role, isActive } = req.body || {};
    const response = await client.patch(`/${req.params.id}/status`, { role, isActive });
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({ message: error.response?.data?.message || "Failed to update contributor access." });
  }
});

module.exports = router;
