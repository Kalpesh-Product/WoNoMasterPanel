const axios = require("axios");
const { uploadFileToS3 } = require("../../config/s3config");

const NOMADS_BASE_URL = process.env.NOMADS_BASE_URL;

const toArrayResponse = (res, rows) => res.status(200).json(rows);

const adminHeaders = () => process.env.NOMADS_ADMIN_API_KEY
    ? { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY }
    : {};

const sanitizeS3PathSegment = (value, fallback = "untitled") => {
    const cleaned = String(value || "")
        .replace(/[/\\?%*:|"<>]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned || fallback;
};

const sanitizeFileName = (value, fallback = "image") => {
    const cleaned = String(value || "")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/\s+/g, "_")
        .trim();

    return cleaned || fallback;
};

const getS3KeyFromUrl = (fileUrl) => {
    try {
        if (!fileUrl) return "";
        const url = new URL(fileUrl);
        return decodeURIComponent(url.pathname.slice(1));
    } catch {
        return "";
    }
};

const buildContentPayload = async (req, { folder = "blogs", titleField = "mainTitle", titleFallback = "Blog" } = {}) => {
    const payload = { ...req.body };
    const files = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
    if (!files.length) return payload;

    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (files.some((file) => !extensions[file.mimetype])) {
        const error = new Error("Choose a JPEG, PNG, or WebP image.");
        error.status = 400;
        throw error;
    }
    if (typeof payload.sections === "string") {
        try {
            payload.sections = JSON.parse(payload.sections);
            if (!Array.isArray(payload.sections)) throw new Error("Invalid sections");
        } catch {
            const error = new Error("Sections must be a valid JSON array.");
            error.status = 400;
            throw error;
        }
    }
    if (typeof payload.isActive === "string") payload.isActive = payload.isActive === "true";

    const seenFields = new Set();
    const uploads = files.map((file) => {
        const match = file.fieldname.match(/^sectionImageFiles\[(\d+)\]$/);
        const index = match ? Number(match[1]) : null;
        if (seenFields.has(file.fieldname) || (file.fieldname !== "mainImageFile" &&
            (!match || !Number.isSafeInteger(index) || !payload.sections?.[index] ||
                typeof payload.sections[index] !== "object"))) {
            const error = new Error("Image upload must belong to an existing section or the main image.");
            error.status = 400;
            throw error;
        }
        seenFields.add(file.fieldname);
        return { file, index };
    });

    const destinationFolder = sanitizeS3PathSegment(payload.destination, "Destination");
    const contentFolder = sanitizeS3PathSegment(payload[titleField], titleFallback);
    const baseFolder = `nomads/${folder}/${destinationFolder}/${contentFolder}`;
    await Promise.all(uploads.map(async ({ file, index }) => {
        const isMain = index === null;
        const existingUrl = isMain ? payload.mainImage : payload.sections[index].image;
        const existingKey = getS3KeyFromUrl(existingUrl);
        // Reuse Nomads image keys; replace old flat Master Panel paths on upload.
        const isNomadsImage = isMain
            ? new RegExp(`^nomads/${folder}/[^/]+/[^/]+/Main Image/[^/]+$`).test(existingKey)
            : new RegExp(`^nomads/${folder}/[^/]+/[^/]+/Section \\d+ Image/[^/]+$`).test(existingKey);
        const imageFolder = isMain ? "Main Image" : `Section ${index + 1} Image`;
        const key = isNomadsImage ? existingKey : `${baseFolder}/${imageFolder}/${sanitizeFileName(file.originalname)}`;
        const uploaded = await uploadFileToS3(key, file);
        if (isMain) payload.mainImage = uploaded.url;
        else payload.sections[index] = { ...payload.sections[index], image: uploaded.url };
    }));
    return payload;
};

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
        if (!req.body?.mainTitle || `${req.body.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }
        const payload = await buildContentPayload(req);

        const response = await axios.post(`${NOMADS_BASE_URL}/blogs/blogs`, payload);
        return res.status(201).json({ message: "Blog created via API", blog: response.data.blog || response.data });
    } catch (error) {
        return res.status(error.response?.status || error.status || 500).json({
            message: error.response?.data?.message || (error.status === 400 ? error.message : "Failed to create blog via external API")
        });
    }
};

const createNews = async (req, res) => {
    try {
        if (!req.body?.mainTitle || `${req.body.mainTitle}`.trim() === "") {
            return res.status(400).json({ message: "mainTitle is required" });
        }
        const payload = await buildContentPayload(req, { folder: "news", titleFallback: "Content" });

        const response = await axios.post(`${NOMADS_BASE_URL}/news/news`, payload);
        return res.status(201).json({ message: "News created via API", news: response.data.news || response.data });
    } catch (error) {
        return res.status(error.response?.status || error.status || 500).json({
            message: error.response?.data?.message || (error.status === 400 ? error.message : "Failed to create news via external API")
        });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = await buildContentPayload(req);

        const response = await axios.put(`${NOMADS_BASE_URL}/blogs/blogs/${id}`, payload);
        return res.status(200).json({ message: "Blog updated via API", blog: response.data.blog || response.data });
    } catch (error) {
        return res.status(error.response?.status || error.status || 500).json({
            message: error.response?.data?.message || (error.status === 400 ? error.message : "Failed to update blog via external API")
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
        const payload = await buildContentPayload(req, { folder: "news", titleFallback: "Content" });

        const response = await axios.put(`${NOMADS_BASE_URL}/news/news/${id}`, payload);
        return res.status(200).json({ message: "News updated via API", news: response.data.news || response.data });
    } catch (error) {
        return res.status(error.response?.status || error.status || 500).json({
            message: error.response?.data?.message || (error.status === 400 ? error.message : "Failed to update news via external API")
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

const saveDestinationContent = async (req, res) => {
    const configs = {
        event: { folder: "events", titleField: "eventName", titleFallback: "Content" },
        place: { folder: "places", titleField: "placeName", titleFallback: "Content" },
    };
    const config = Object.prototype.hasOwnProperty.call(configs, req.params.type) ? configs[req.params.type] : null;
    if (!config) return res.status(400).json({ message: "Unsupported destination content type." });
    try {
        const payload = await buildContentPayload(req, config);
        const url = `${NOMADS_BASE_URL}/${config.folder}${req.params.id ? `/${req.params.id}` : ""}`;
        const response = req.params.id
            ? await axios.patch(url, payload, { headers: adminHeaders() })
            : await axios.post(url, payload, { headers: adminHeaders() });
        return res.status(req.params.id ? 200 : 201).json(response.data);
    } catch (error) {
        return res.status(error.response?.status || error.status || 500).json({
            message: error.response?.data?.message || (error.status === 400 ? error.message : "Failed to save destination content via external API"),
        });
    }
};

module.exports = {
    saveDestinationContent,
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
