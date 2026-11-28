const router = require("express").Router();
const axios = require("axios");
const { setLogModule } = require("../middlewares/logContext");
const { PARTNERS_PANEL_API_URL, PARTNERS_PANEL_ADMIN_API_KEY } = require("../config/partnersPanel");

const client = axios.create({
  baseURL: `${PARTNERS_PANEL_API_URL}/admin`,
  headers: { "x-admin-api-key": PARTNERS_PANEL_ADMIN_API_KEY },
  timeout: 15000,
});

router.use(setLogModule("Onboarded Partners"));

const forward = (method, path) => async (req, res) => {
  try {
    const response = await client.request({
      method,
      url: typeof path === "function" ? path(req) : path,
      data: req.body,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return res.status(error.response?.status || 502).json({
      message: error.response?.data?.message || "Failed to reach Partners Panel.",
    });
  }
};

router.get("/partners", forward("get", "/partners"));
router.get("/lead-statuses", forward("get", "/lead-statuses"));
router.patch("/partners/:id", forward("patch", (req) => `/partners/${req.params.id}`));

router.get("/follow-ups", forward("get", "/follow-ups"));
router.post("/follow-ups", forward("post", "/follow-ups"));
router.patch("/follow-ups/:id", forward("patch", (req) => `/follow-ups/${req.params.id}`));

router.get("/commissions", forward("get", "/commissions"));
router.post("/commissions", forward("post", "/commissions"));
router.patch("/commissions/:id", forward("patch", (req) => `/commissions/${req.params.id}`));

module.exports = router;
