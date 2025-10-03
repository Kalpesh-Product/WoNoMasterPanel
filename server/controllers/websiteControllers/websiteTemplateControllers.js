const sharp = require("sharp");
const axios = require("axios");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const {
  handleFileUpload,
  handleFileDelete,
} = require("../../config/cloudinaryConfig");
const Company = require("../../models/hr/Company");
const mongoose = require("mongoose");
const {
  uploadFileToS3,
  deleteFileFromS3ByUrl,
} = require("../../config/s3config");
const HostCompany = require("../../models/hostCompany/hostCompany");

const createTemplate = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { company } = req.query;

    // `products` might arrive as a JSON string in multipart. Normalize it.

    let { products, testimonials, about } = req.body;
    // about = JSON.parse(about || "[]");
    // products = JSON.parse(products || "[]");
    // testimonials = JSON.parse(testimonials || "[]");

    const safeParse = (val, fallback) => {
      try {
        return typeof val === "string" ? JSON.parse(val) : val || fallback;
      } catch {
        return fallback;
      }
    };

    about = safeParse(about, []);
    products = safeParse(products, []);
    testimonials = safeParse(testimonials, []);

    for (const k of Object.keys(req.body)) {
      if (/^(products|testimonials)\.\d+\./.test(k)) delete req.body[k];
    }

    const formatCompanyName = (name) => {
      if (!name) return "";
      return name.toLowerCase().split("-")[0].replace(/\s+/g, "");
    };

    const searchKey = formatCompanyName(req.body.companyName);
    const baseFolder = `WoNo${company}/template/${searchKey}`;

    if (searchKey === "") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Provide a valid company name" });
    }

    let template = await WebsiteTemplate.findOne({ searchKey }).session(
      session
    );

    if (template) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Template for this company already exists" });
    }

    template = new WebsiteTemplate({
      searchKey,
      companyId: req.body?.companyId,
      companyName: req.body.companyName,
      title: req.body.title,
      subTitle: req.body.subTitle,
      CTAButtonText: req.body.CTAButtonText,
      about: about,
      productTitle: req.body?.productTitle,
      galleryTitle: req.body?.galleryTitle,
      testimonialTitle: req.body.testimonialTitle,
      contactTitle: req.body.contactTitle,
      mapUrl: req.body.mapUrl,
      email: req.body.websiteEmail,
      phone: req.body.phone,
      address: req.body.address,
      registeredCompanyName: req.body.registeredCompanyName,
      copyrightText: req.body.copyrightText,
      products: [],
      testimonials: [],
    });

    // Helper: upload an array of multer files to a folder
    // const uploadImages = async (files = [], folder) => {
    //   const arr = [];
    //   for (const file of files) {
    //     const buffer = await sharp(file.buffer)
    //       .webp({ quality: 80 })
    //       .toBuffer();
    //     const base64Image = `data:image/webp;base64,${buffer.toString(
    //       "base64"
    //     )}`;
    //     const uploadResult = await handleFileUpload(base64Image, folder);
    //     arr.push({ id: uploadResult.public_id, url: uploadResult.secure_url });
    //   }
    //   return arr;
    // };

    const uploadImages = async (files = [], folder) => {
      const arr = [];
      for (const file of files) {
        const buffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        const route = `${folder}/${Date.now()}_${file.originalname.replace(
          /\s+/g,
          "_"
        )}`;
        const url = await uploadFileToS3(route, {
          buffer,
          mimetype: "image/webp",
        });
        arr.push({ url });
      }
      return arr;
    };

    if (req.body.companyLogo) {
      template.companyLogo = { url: req.body.companyLogo.url };
    }

    if (req.body.heroImages) {
      template.heroImages = req.body.heroImages.map((img) => ({
        url: img.url,
      }));
    }

    if (req.body.gallery) {
      template.gallery = req.body.gallery.map((img) => ({
        url: img.url,
      }));
    }

    // if (req.body.products) {
    //   // template.products = req.body.products.map((img) => ({
    //   //   url: img.url,
    //   // }));
    //   template.products = req.body.products;
    // }

    if (Array.isArray(products) && products.length) {
      template.products = products;
    }

    // if (req.body.testimonials) {
    //   template.testimonials = req.body.testimonials.map((img) => ({
    //     url: img.url,
    //   }));
    // }

    if (req.body.testimonials) {
      const parsedTestimonials = Array.isArray(req.body.testimonials)
        ? req.body.testimonials
        : safeParse(req.body.testimonials, []);

      template.testimonials = parsedTestimonials.map((t) =>
        t?.url ? { url: t.url } : {}
      );
    }

    // Multer.any puts files in req.files (array). Build a quick index by fieldname.
    const filesByField = {};
    for (const f of req.files || []) {
      if (!filesByField[f.fieldname]) filesByField[f.fieldname] = [];
      filesByField[f.fieldname].push(f);
    }

    // companyLogo
    // companyLogo (ensure it's a single file)
    if (filesByField.companyLogo && filesByField.companyLogo[0]) {
      const logoFile = filesByField.companyLogo[0];
      const buffer = await sharp(logoFile.buffer)
        .webp({ quality: 80 })
        .toBuffer();
      const route = `${baseFolder}/companyLogo/${Date.now()}_${
        logoFile.originalname
      }`;
      const url = await uploadFileToS3(route, {
        buffer,
        mimetype: "image/webp",
      });
      template.companyLogo = { url };
    }

    // heroImages
    if (filesByField.heroImages?.length) {
      template.heroImages = await uploadImages(
        filesByField.heroImages,
        `${baseFolder}/heroImages`
      );
    }

    // gallery
    if (filesByField.gallery?.length) {
      template.gallery = await uploadImages(
        filesByField.gallery,
        `${baseFolder}/gallery`
      );
    }

    if (Array.isArray(products) && products.length) {
      for (let i = 0; i < products.length; i++) {
        const p = products[i] || {};
        const pFiles = filesByField[`productImages_${i}`] || [];
        const uploaded = await uploadImages(
          pFiles,
          `${baseFolder}/productImages/${i}`
        );

        template.products.push({
          type: p.type,
          name: p.name,
          cost: p.cost,
          description: p.description,
          images: uploaded,
        });
      }
    }

    // TESTIMONIALS: objects + flat testimonialImages array (zip by index)
    let tUploads = [];
    if (filesByField.testimonialImages?.length) {
      // Preferred new path: single field 'testimonialImages' with N files in order
      tUploads = await uploadImages(
        filesByField.testimonialImages,
        `${baseFolder}/testimonialImages`
      );
    } else {
      // Back-compat: testimonialImages_${i}
      for (let i = 0; i < testimonials.length; i++) {
        const tFiles = filesByField[`testimonialImages_${i}`] || [];
        const uploaded = await uploadImages(
          tFiles,
          `${baseFolder}/testimonialImages/${i}`
        );
        tUploads[i] = uploaded[0]; // one file per testimonial
      }
    }

    // template.testimonials = (testimonials || []).map((t, i) => ({
    template.testimonials = (
      Array.isArray(testimonials) ? testimonials : []
    ).map((t, i) => ({
      image: tUploads[i], // may be undefined if fewer images provided
      name: t.name,
      jobPosition: t.jobPosition,
      testimony: t.testimony,
      rating: t.rating,
    }));

    const savedTemplate = await template.save({ session });

    if (!savedTemplate) {
      return res.status(400).json({ message: "Failed to create template" });
    }

    const updateHostCompany = await HostCompany.findOneAndUpdate(
      { companyName: req.body.companyName }, //can't use company Id as the nomads signup can't send any company Id
      {
        isWebsiteTemplate: true,
      }
    );

    if (!updateHostCompany) {
      return res.status(400).json({ message: "Company not found" });
    }

    try {
      const updatedCompany = await axios.patch(
        "https://wononomadsbe.vercel.app/api/company/add-template-link",
        {
          companyName: req.body.companyName,
          link: `https://${savedTemplate.searchKey}.wono.co/`,
        }
      );

      if (!updatedCompany) {
        return res
          .status(400)
          .json({ message: "Failed to add website template link" });
      }
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      if (error.response?.status !== 200) {
        return res.status(201).json({
          message:
            "Failed to add link.Check if the company is listed in Nomads.",
          error: error.message,
        });
      }
    }

    return res.status(201).json({ message: "Template created", template });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const getTemplate = async (req, res) => {
  try {
    const { companyName } = req.params;

    const formatCompanyName = (name) => {
      if (!name) return "";
      return name.toLowerCase().split("-")[0].replace(/\s+/g, "");
    };

    const searchKey = formatCompanyName(companyName);

    const template = await WebsiteTemplate.findOne({
      searchKey,
    });

    if (!template) {
      return res.status(200).json([]);
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInActiveTemplate = async (req, res) => {
  try {
    const { company } = req.params;

    const template = await WebsiteTemplate.findOne({
      searchKey: company,
      isActive: false,
    });

    if (!template) {
      return res.status(200).json([]);
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const templates = await WebsiteTemplate.find({ isActive: true });

    if (!templates.length) {
      return res.status(200).json([]);
    }

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInActiveTemplates = async (req, res) => {
  try {
    const templates = await WebsiteTemplate.find({ isActive: false });

    if (!templates.length) {
      return res.status(200).json([]);
    }

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const activateTemplate = async (req, res) => {
  try {
    const { searchKey } = req.query;

    if (!searchKey) {
      return res.status(400).json({ message: "Search key is missing" });
    }

    const template = await WebsiteTemplate.findOneAndUpdate(
      {
        searchKey,
      },
      {
        isActive: true,
      }
    );

    if (!template) {
      return res.status(400).json({ message: "Failed to activate website" });
    }

    return res.status(200).json({ message: "Website activated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { searchKey } = req.query;

    if (!searchKey) {
      return res.status(400).json({ message: "Search key is missing" });
    }

    const template = await WebsiteTemplate.findOneAndUpdate(
      {
        searchKey,
      },
      {
        isDeleted: true,
      }
    );

    if (!template) {
      return res.status(400).json({ message: "Failed to delete website" });
    }

    return res.status(200).json({ message: "Website deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const editTemplate = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let {
      products,
      testimonials,
      heroImageIds,
      galleryImageIds,
      companyLogoId,
      about,
      companyName,
    } = req.body;

    const company = companyName;

    // --- helpers ---
    const parseJson = (raw, fallback) => {
      try {
        if (raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    };

    const deleteS3Batch = async (items = []) => {
      await Promise.all(
        (items || [])
          .filter((img) => img?.url)
          .map((img) =>
            deleteFileFromS3ByUrl(img.url).catch((e) => {
              console.warn("S3 delete failed:", e.message);
              return null;
            })
          )
      );
    };

    const uploadImages = async (files = [], folder) => {
      const arr = [];
      for (const file of files) {
        const buffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        const route = `${folder}/${Date.now()}_${file.originalname.replace(
          /\s+/g,
          "_"
        )}`;

        const url = await uploadFileToS3(route, {
          buffer,
          mimetype: "image/webp",
        });

        arr.push({ url }); // only store url
      }
      return arr;
    };

    // --- normalize body ---
    about = parseJson(about, []);
    companyLogoId = parseJson(companyLogoId, undefined);
    products = parseJson(products, []);
    testimonials = parseJson(testimonials, []);
    const heroKeepIds = new Set(parseJson(heroImageIds, undefined));
    const galleryKeepIds = new Set(parseJson(galleryImageIds, undefined));

    // --- template ---
    const formatCompanyName = (name) =>
      (name || "").toLowerCase().split("-")[0].replace(/\s+/g, "");

    const searchKey = formatCompanyName(req.body.companyName);
    const baseFolder = `WoNo${company}/template/${searchKey}`;

    const template = await WebsiteTemplate.findOne({ searchKey }).session(
      session
    );
    if (!template) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Template not found" });
    }

    // --- map files ---
    const filesByField = {};
    for (const f of req.files || []) {
      (filesByField[f.fieldname] ||= []).push(f);
    }

    // --- merge text fields ---
    Object.assign(template, {
      companyName: req.body.companyName ?? template.companyName,
      title: req.body.title ?? template.title,
      subTitle: req.body.subTitle ?? template.subTitle,
      CTAButtonText: req.body.CTAButtonText ?? template.CTAButtonText,
      about: Array.isArray(about) ? about : template.about,
      productTitle: req.body.productTitle ?? template.productTitle,
      galleryTitle: req.body.galleryTitle ?? template.galleryTitle,
      testimonialTitle: req.body.testimonialTitle ?? template.testimonialTitle,
      contactTitle: req.body.contactTitle ?? template.contactTitle,
      mapUrl: req.body.mapUrl ?? template.mapUrl,
      email: req.body.email ?? template.email,
      phone: req.body.phone ?? template.phone,
      address: req.body.address ?? template.address,
      registeredCompanyName:
        req.body.registeredCompanyName ?? template.registeredCompanyName,
      copyrightText: req.body.copyrightText ?? template.copyrightText,
    });

    // === COMPANY LOGO ===
    if (companyLogoId !== undefined) {
      const currentUrl = template.companyLogo?.url || null;
      if (currentUrl && currentUrl !== companyLogoId) {
        await deleteFileFromS3ByUrl(currentUrl).catch(() => null);
        template.companyLogo = null;
      }
    }

    if (filesByField.companyLogo?.[0]) {
      if (template.companyLogo?.url) {
        await deleteFileFromS3ByUrl(template.companyLogo.url).catch(() => null);
      }
      const uploaded = await uploadImages(
        [filesByField.companyLogo[0]],
        `${baseFolder}/companyLogo`
      );
      template.companyLogo = uploaded[0];
    }

    // === HERO IMAGES ===
    if (heroKeepIds !== undefined) {
      const current = template.heroImages || [];
      const toDelete = current.filter((img) => !heroKeepIds.has(img.url));
      if (toDelete.length) {
        await deleteS3Batch(toDelete);
        template.heroImages = current.filter((img) => heroKeepIds.has(img.url));
      }
    }

    if (filesByField.heroImages?.length) {
      const uploaded = await uploadImages(
        filesByField.heroImages,
        `${baseFolder}/heroImages`
      );
      template.heroImages = [...(template.heroImages || []), ...uploaded];
    }

    // === GALLERY ===
    if (galleryKeepIds !== undefined) {
      const current = template.gallery || [];
      const toDelete = current.filter((img) => !galleryKeepIds.has(img.url));
      if (toDelete.length) {
        await deleteS3Batch(toDelete);
        template.gallery = current.filter((img) => galleryKeepIds.has(img.url));
      }
    }

    if (filesByField.gallery?.length) {
      const uploaded = await uploadImages(
        filesByField.gallery,
        `${baseFolder}/gallery`
      );
      template.gallery = [...(template.gallery || []), ...uploaded];
    }

    // === PRODUCTS ===
    const existingProductIdx = new Map(
      (template.products || []).map((p, i) => [String(p._id), i])
    );

    for (let i = 0; i < (products || []).length; i++) {
      const p = products[i];
      const pFiles = filesByField[`productImages_${i}`] || [];
      const uploaded = pFiles.length
        ? await uploadImages(
            pFiles,
            `${baseFolder}/productImages/${p?._id || "new"}`
          )
        : [];

      if (p?._id && existingProductIdx.has(String(p._id))) {
        const idx = existingProductIdx.get(String(p._id));
        const target = template.products[idx];

        if (Array.isArray(p.imageIds)) {
          const keepSet = new Set(p.imageIds);
          const toDelete = (target.images || []).filter(
            (img) => !keepSet.has(img.url)
          );
          if (toDelete.length) {
            await deleteS3Batch(toDelete);
            target.images = (target.images || []).filter((img) =>
              keepSet.has(img.url)
            );
          }
        }

        target.type = p.type ?? target.type;
        target.name = p.name ?? target.name;
        target.cost = p.cost ?? target.cost;
        target.description = p.description ?? target.description;
        target.images = [...(target.images || []), ...uploaded];
      } else {
        template.products.push({
          type: p.type,
          name: p.name,
          cost: p.cost,
          description: p.description,
          images: uploaded,
        });
      }
    }

    // === TESTIMONIALS ===
    const existingTestimonialIdx = new Map(
      (template.testimonials || []).map((t, i) => [String(t._id), i])
    );

    for (let i = 0; i < (testimonials || []).length; i++) {
      const t = testimonials[i];
      const tFiles = filesByField[`testimonialImages_${i}`] || [];
      const uploaded = tFiles.length
        ? await uploadImages(
            tFiles,
            `${baseFolder}/testimonialImages/${t?._id || "new"}`
          )
        : [];

      if (t?._id && existingTestimonialIdx.has(String(t._id))) {
        const idx = existingTestimonialIdx.get(String(t._id));
        const target = template.testimonials[idx];

        if ("imageId" in t) {
          const keepUrl = t.imageId || null;
          const currentUrl = target?.image?.url || null;
          if (currentUrl && currentUrl !== keepUrl) {
            await deleteFileFromS3ByUrl(currentUrl).catch(() => null);
            target.image = null;
          }
        }

        target.name = t.name ?? target.name;
        target.jobPosition = t.jobPosition ?? target.jobPosition;
        target.testimony = t.testimony ?? target.testimony;
        target.rating = t.rating ?? target.rating;

        if (uploaded[0]) target.image = uploaded[0];
      } else {
        template.testimonials.push({
          name: t.name,
          jobPosition: t.jobPosition,
          testimony: t.testimony,
          rating: t.rating,
          image: uploaded[0] || null,
        });
      }
    }

    await template.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Template updated", template });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

module.exports = {
  createTemplate,
  editTemplate,
  getTemplate,
  getTemplates,
  getInActiveTemplates,
  getInActiveTemplate,
  activateTemplate,
  deleteTemplate,
};
