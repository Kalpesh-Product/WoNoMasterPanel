const axios = require("axios");

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

// Internal admin surface on the Nomads backend, gated by a shared secret
// (not a per-user JWT) since these requests come from this server, not a
// signed-in Nomad app user. See D:\Nomads\backend\middlewares\verifyAdminApiKey.js.
const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/verification-requests`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

const forwardNomadsError = (res, error, fallbackMessage) => {
  const status = error.response?.status || 502;
  const message = error.response?.data?.message || fallbackMessage;
  return res.status(status).json({ message });
};

const getVerificationLeads = async (req, res) => {
  try {
    const response = await nomadsAdminClient.get("/");
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(
      res,
      error,
      "Failed to fetch company verification leads",
    );
  }
};

const updateVerificationLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await nomadsAdminClient.patch(`/${id}/status`, req.body);
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(
      res,
      error,
      "Failed to update verification lead status",
    );
  }
};

module.exports = {
  getVerificationLeads,
  updateVerificationLeadStatus,
};
