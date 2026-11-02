// Proxy for the host.wono.co /modules page catalog (HostModuleCategory on the
// Nomads backend), following the same shape as blogNewsControllers.js: no
// local copy here, every call forwards to the Nomads backend which owns the
// data. Reads hit the public endpoint directly; writes go through the
// shared-secret-gated admin surface. See
// D:\Nomads\backend\controllers\hostModuleCatalogControllers.js.
const axios = require("axios");
const FormData = require("form-data");

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/host-modules`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 20000,
});

const forwardNomadsError = (res, error, fallbackMessage) => {
  const status = error.response?.status || 502;
  const message = error.response?.data?.message || fallbackMessage;
  return res.status(status).json({ message });
};

// includeDisabled=1 so the master panel can see (and re-enable) a module
// that's hidden from host.wono.co, not just the ones currently live.
const getHostModuleCatalog = async (req, res) => {
  try {
    const response = await axios.get(`${NOMADS_BASE_URL}/host-modules`, {
      params: { includeDisabled: 1 },
      timeout: 15000,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch host module catalog");
  }
};

const createCategory = async (req, res) => {
  try {
    const response = await nomadsAdminClient.post("/", req.body);
    return res.status(201).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to create category");
  }
};

const createModule = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const response = await nomadsAdminClient.post(`/${categoryId}/modules`, req.body);
    return res.status(201).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to create module");
  }
};

// Whole-array replace for a category — used for reordering modules/children
// (drag or move up/down on the client builds the new array, this just saves it).
const replaceCategoryModules = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const response = await nomadsAdminClient.put(`/${categoryId}`, req.body);
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to update category");
  }
};

// Edits one module/child's copy (label, summary, bullets, plan). Pass
// childId in the body to target a department's sub-module.
const updateModuleFields = async (req, res) => {
  try {
    const { categoryId, moduleId } = req.params;
    const response = await nomadsAdminClient.patch(`/${categoryId}/modules/${moduleId}`, req.body);
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to update module");
  }
};

const uploadModuleScreenshot = async (req, res) => {
  try {
    const { categoryId, moduleId } = req.params;
    const { childId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image provided" });
    }

    const formData = new FormData();
    formData.append("image", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const response = await nomadsAdminClient.post(
      `/${categoryId}/modules/${moduleId}/screenshot${query}`,
      formData,
      { headers: formData.getHeaders() },
    );

    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to upload screenshot");
  }
};

const deleteModule = async (req, res) => {
  try {
    const { categoryId, moduleId } = req.params;
    const { childId } = req.query;
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const response = await nomadsAdminClient.delete(`/${categoryId}/modules/${moduleId}${query}`);
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to delete module");
  }
};

module.exports = {
  getHostModuleCatalog,
  createCategory,
  createModule,
  replaceCategoryModules,
  updateModuleFields,
  uploadModuleScreenshot,
  deleteModule,
};
