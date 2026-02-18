const axios = require("axios");

const NOMADS_BASE_URL = process.env.NOMADS_BASE_URL;

const toArrayResponse = (res, rows) => res.status(200).json(rows);

const getBlogs = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/blogs/blogs`);
        return toArrayResponse(res, response.data);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || "Failed to fetch blogs from external API"
        });
    }
};

const getNews = async (req, res) => {
    try {
        const response = await axios.get(`${NOMADS_BASE_URL}/news/news`);
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
    createBlog,
    createNews,
    updateBlog,
    deleteBlog,
    updateNews,
    deleteNews,
    updateNewsStatus,
};