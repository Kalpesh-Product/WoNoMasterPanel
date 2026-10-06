const axios = require("axios");

const NOMADS_BASE_URL = process.env.NOMADS_BASE_URL;

const toArrayResponse = (res, rows) => res.status(200).json(rows);

const adminHeaders = () => process.env.NOMADS_ADMIN_API_KEY
    ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
    : {};

const getBlogs = async (req, res) => {
    try {
        const queryParams = { ...req.query };
        if (queryParams.destination && !queryParams.keyword) {
            queryParams.keyword = queryParams.destination;
        }
        if (queryParams.keyword && !queryParams.destination) {
            queryParams.destination = queryParams.keyword;
        }
        const response = await axios.get(`${NOMADS_BASE_URL}/blogs/blogs`, {
            params: queryParams,
            headers: process.env.NOMADS_ADMIN_API_KEY
                ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
                : {},
        });
        return toArrayResponse(res, response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch blogs from external API"
        });
    }
};

const getNews = async (req, res) => {
    try {
        const queryParams = { ...req.query };
        if (queryParams.destination && !queryParams.keyword) {
            queryParams.keyword = queryParams.destination;
        }
        if (queryParams.keyword && !queryParams.destination) {
            queryParams.destination = queryParams.keyword;
        }
        const response = await axios.get(`${NOMADS_BASE_URL}/news/news`, {
            params: queryParams,
            headers: process.env.NOMADS_ADMIN_API_KEY
                ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
                : {},
        });
        return toArrayResponse(res, response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch news from external API"
        });
    }
};

const createBlog = async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.mainTitle || `${payload.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }

        const response = await axios.post(`${NOMADS_BASE_URL}/blogs/blogs`, payload);
        return res.status(201).json({ message: "Blog created via API", blog: response.data.blog || response.data });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to create blog via external API"
        });
    }
};

const createNews = async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.mainTitle || `${payload.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }

        const response = await axios.post(`${NOMADS_BASE_URL}/news/news`, payload);
        return res.status(201).json({ message: "News created via API", news: response.data.news || response.data });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to create news via external API"
        });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;

        const response = await axios.put(`${NOMADS_BASE_URL}/blogs/blogs/${id}`, payload);
        return res.status(200).json({ message: "Blog updated via API", blog: response.data.blog || response.data });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update blog via external API"
        });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        await axios.delete(`${NOMADS_BASE_URL}/blogs/blogs/${id}`);
        return res.status(200).json({ message: "Blog deleted via API" });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to delete blog via external API"
        });
    }
};

const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;

        const response = await axios.put(`${NOMADS_BASE_URL}/news/news/${id}`, payload);
        return res.status(200).json({ message: "News updated via API", news: response.data.news || response.data });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update news via external API"
        });
    }
};

const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        await axios.delete(`${NOMADS_BASE_URL}/news/news/${id}`);
        return res.status(200).json({ message: "News deleted via API" });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to delete news via external API"
        });
    }
};

const getBlogContributions = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/blogs/contributions`, {
            params: req.query,
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch blog contributions from external API"
        });
    }
};

const updateBlogContributionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.patch(`${NOMADS_BASE_URL}/blogs/contributions/${id}/status`, req.body, {
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update blog contribution status in external API"
        });
    }
};
const getNewsContributions = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/news/contributions`, {
            params: req.query,
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch news contributions from external API"
        });
    }
};

const updateNewsContributionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.patch(`${NOMADS_BASE_URL}/news/contributions/${id}/status`, req.body, {
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update news contribution status in external API"
        });
    }
};

const getEventContributions = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/events/contributions`, {
            params: req.query,
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch event contributions from external API"
        });
    }
};

const updateEventContributionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.patch(`${NOMADS_BASE_URL}/events/contributions/${id}/status`, req.body, {
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update event contribution status in external API"
        });
    }
};
const getPlaceContributions = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/places/contributions`, {
            params: req.query,
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch place contributions from external API"
        });
    }
};

const updatePlaceContributionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.patch(`${NOMADS_BASE_URL}/places/contributions/${id}/status`, req.body, {
            headers: adminHeaders(),
        });
        return res.status(200).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update place contribution status in external API"
        });
    }
};
const updateNewsStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const response = await axios.patch(`${NOMADS_BASE_URL}/news/status/${id}`, { isActive });
        return res.status(200).json({ message: "Status updated successfully", news: response.data.news });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to update status in external API"
        });
    }
};

module.exports = {
    getBlogs,
    getNews,
    getBlogContributions,
    getNewsContributions,
    getEventContributions,
    getPlaceContributions,
    createBlog,
    createNews,
    updateBlog,
    deleteBlog,
    updateNews,
    deleteNews,
    updateNewsStatus,
    updateBlogContributionStatus,
    updateNewsContributionStatus,
    updateEventContributionStatus,
    updatePlaceContributionStatus,
};
