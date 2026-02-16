const Blog = require("../../models/website/Blogs");
const News = require("../../models/website/News");

const toArrayResponse = (res, rows) => res.status(200).json(rows);

const getBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ date: -1, createdAt: -1 }).lean();
        return toArrayResponse(res, blogs);
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to fetch blogs" });
    }
};

const getNews = async (req, res) => {
    try {
        const news = await News.find().sort({ date: -1, createdAt: -1 }).lean();
        return toArrayResponse(res, news);
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to fetch news" });
    }
};

const createBlog = async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.mainTitle || `${payload.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }

        const blog = await Blog.create(payload);
        return res.status(201).json({ message: "Blog created", blog });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to create blog" });
    }
};

const createNews = async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.mainTitle || `${payload.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }

        const news = await News.create(payload);
        return res.status(201).json({ message: "News created", news });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to create news" });
    }
};
const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;

        const blog = await Blog.findByIdAndUpdate(
            id,
            payload,
            { new: true, runValidators: true }
        );

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        return res.status(200).json({ message: "Blog updated", blog });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to update blog" });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const blog = await Blog.findByIdAndDelete(id);

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        return res.status(200).json({ message: "Blog deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to delete blog" });
    }
};

const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;

        const news = await News.findByIdAndUpdate(
            id,
            payload,
            { new: true, runValidators: true }
        );

        if (!news) {
            return res.status(404).json({ message: "News not found" });
        }

        return res.status(200).json({ message: "News updated", news });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to update news" });
    }
};

const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const news = await News.findByIdAndDelete(id);

        if (!news) {
            return res.status(404).json({ message: "News not found" });
        }

        return res.status(200).json({ message: "News deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Failed to delete news" });
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
};