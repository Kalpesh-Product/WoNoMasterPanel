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

// const createTemplate = async (req, res, next) => {
//   try {
//     const { company } = req.query;

//     // `products` might arrive as a JSON string in multipart. Normalize it.

//     let { products, testimonials, about, source = "Master Panel" } = req.body;

//     const safeParse = (val, fallback) => {
//       try {
//         return typeof val === "string" ? JSON.parse(val) : val || fallback;
//       } catch {
//         return fallback;
//       }
//     };

//     about = safeParse(about, []);
//     products = safeParse(products, []);
//     testimonials = safeParse(testimonials, []);

//     const hostCompanyExists = await HostCompany.findOne(
//       { companyName: req.body.companyName } //can't use company Id as the host signup form can't send any company Id
//     );

//     if (!hostCompanyExists && source !== "Nomad") {
//       return res.status(400).json({ message: "Company not found" });
//     }

//     for (const k of Object.keys(req.body)) {
//       if (/^(products|testimonials)\.\d+\./.test(k)) delete req.body[k];
//     }

//     const formatCompanyName = (name) => {
//       if (!name) return "";

//       const trimmed = name.trim().toLowerCase();

//       const invalids = ["n/a", "na", "none", "undefined", "null", "-"];
//       if (invalids.includes(trimmed)) return "";

//       return trimmed.split("-")[0].replace(/\s+/g, "");
//     };

//     const searchKey = formatCompanyName(req.body.companyName);
//     const baseFolder = `hosts/template/${searchKey}`;

//     if (searchKey === "") {
//       return res.status(400).json({ message: "Provide a valid company name" });
//     }

//     console.log("searchkey", searchKey);

//     let template = await WebsiteTemplate.findOne({ searchKey });

//     if (template) {
//       return res
//         .status(400)
//         .json({ message: "Template for this company already exists" });
//     }

//     template = new WebsiteTemplate({
//       searchKey,
//       companyId: req.body?.companyId,
//       companyName: req.body.companyName,
//       title: req.body.title,
//       subTitle: req.body.subTitle,
//       CTAButtonText: req.body.CTAButtonText,
//       about: about,
//       productTitle: req.body?.productTitle,
//       galleryTitle: req.body?.galleryTitle,
//       testimonialTitle: req.body.testimonialTitle,
//       contactTitle: req.body.contactTitle,
//       mapUrl: req.body.mapUrl,
//       email: req.body.websiteEmail,
//       phone: req.body.phone,
//       address: req.body.address,
//       registeredCompanyName: req.body.registeredCompanyName,
//       copyrightText: req.body.copyrightText,
//       isWebsiteTemplate: true,
//       products: [],
//       testimonials: [],
//     });

//     const uploadImages = async (files = [], folder) => {
//       const arr = [];
//       for (const file of files) {
//         const buffer = await sharp(file.buffer)
//           .webp({ quality: 80 })
//           .toBuffer();

//         const route = `${folder}/${Date.now()}_${file.originalname.replace(
//           /\s+/g,
//           "_"
//         )}`;
//         const data = await uploadFileToS3(route, {
//           buffer,
//           mimetype: "image/webp",
//         });
//         arr.push({ url: data.url, id: data.id });
//       }
//       return arr;
//     };

//     if (req.body.companyLogo) {
//       template.companyLogo = {
//         url: req.body.companyLogo.url,
//         id: req.body.companyLogo.id,
//       };
//     }

//     if (req.body.heroImages) {
//       template.heroImages = req.body.heroImages.map((img) => ({
//         url: img.url,
//         id: img.id,
//       }));
//     }

//     if (req.body.gallery) {
//       template.gallery = req.body.gallery.map((img) => ({
//         url: img.url,
//         id: img.id,
//       }));
//     }

//     if (req.body.testimonials) {
//       const parsedTestimonials = Array.isArray(req.body.testimonials)
//         ? req.body.testimonials
//         : safeParse(req.body.testimonials, []);

//       template.testimonials = parsedTestimonials.map((t) =>
//         t?.url ? { url: t.url, id: t.id } : {}
//       );
//     }

//     // Multer.any puts files in req.files (array). Build a quick index by fieldname.
//     const filesByField = {};
//     for (const f of req.files || []) {
//       if (!filesByField[f.fieldname]) filesByField[f.fieldname] = [];
//       filesByField[f.fieldname].push(f);
//     }

//     // companyLogo
//     // companyLogo (ensure it's a single file)
//     if (filesByField.companyLogo && filesByField.companyLogo[0]) {
//       const logoFile = filesByField.companyLogo[0];
//       const buffer = await sharp(logoFile.buffer)
//         .webp({ quality: 80 })
//         .toBuffer();
//       const route = `${baseFolder}/companyLogo/${Date.now()}_${
//         logoFile.originalname
//       }`;
//       const data = await uploadFileToS3(route, {
//         buffer,
//         mimetype: "image/webp",
//       });
//       template.companyLogo = { id: data.id, url: data.url };
//     }

//     // heroImages
//     if (filesByField.heroImages?.length) {
//       template.heroImages = await uploadImages(
//         filesByField.heroImages,
//         `${baseFolder}/heroImages`
//       );
//     }

//     // gallery
//     if (filesByField.gallery?.length) {
//       template.gallery = await uploadImages(
//         filesByField.gallery,
//         `${baseFolder}/gallery`
//       );
//     }

//     if (Array.isArray(products) && products.length) {
//       for (let i = 0; i < products.length; i++) {
//         const p = products[i] || {};
//         const pFiles = filesByField[`productImages_${i}`] || [];
//         const uploaded = await uploadImages(
//           pFiles,
//           `${baseFolder}/productImages/${i}`
//         );

//         template.products.push({
//           type: p.type,
//           name: p.name,
//           cost: p.cost,
//           description: p.description,
//           images: uploaded,
//         });
//       }
//     }

//     // TESTIMONIALS: objects + flat testimonialImages array (zip by index)
//     let tUploads = [];
//     if (filesByField.testimonialImages?.length) {
//       // Preferred new path: single field 'testimonialImages' with N files in order
//       tUploads = await uploadImages(
//         filesByField.testimonialImages,
//         `${baseFolder}/testimonialImages`
//       );
//     } else {
//       // Back-compat: testimonialImages_${i}
//       for (let i = 0; i < testimonials.length; i++) {
//         const tFiles = filesByField[`testimonialImages_${i}`] || [];
//         const uploaded = await uploadImages(
//           tFiles,
//           `${baseFolder}/testimonialImages/${i}`
//         );
//         tUploads[i] = uploaded[0]; // one file per testimonial
//       }
//     }

//     // template.testimonials = (testimonials || []).map((t, i) => ({
//     template.testimonials = (
//       Array.isArray(testimonials) ? testimonials : []
//     ).map((t, i) => ({
//       image: tUploads[i], // may be undefined if fewer images provided
//       name: t.name,
//       jobPosition: t.jobPosition,
//       testimony: t.testimony,
//       rating: t.rating,
//     }));

//     const savedTemplate = await template.save();

//     if (!savedTemplate) {
//       return res.status(400).json({ message: "Failed to create template" });
//     }

//     if (source !== "Nomad") {
//       const updateHostCompany = await HostCompany.findOneAndUpdate(
//         { companyName: req.body.companyName }, //can't use company Id as the host signup form can't send any company Id
//         {
//           isWebsiteTemplate: true,
//         }
//       );

//       if (!updateHostCompany) {
//         return res.status(400).json({ message: "Company not found" });
//       }

//       try {
//         const updatedCompany = await axios.patch(
//           "https://wononomadsbe.vercel.app/api/company/add-template-link",
//           {
//             companyName: req.body.companyName,
//             link: `https://${savedTemplate.searchKey}.wono.co/`,
//           }
//         );

//         if (!updatedCompany) {
//           return res
//             .status(400)
//             .json({ message: "Failed to add website template link" });
//         }
//       } catch (error) {
//         if (error.response?.status !== 200) {
//           return res.status(201).json({
//             message:
//               "Failed to add link.Check if the company is listed in Nomads.",
//             error: error.message,
//           });
//         }
//       }
//     }

//     console.log("template created!!");
//     return res
//       .status(201)
//       .json({ status: 201, message: "Template created", template });
//   } catch (error) {
//     next(error);
//   }
// };

const createTemplate = async (req, res, next) => {
  try {
    const { company } = req.query;

    // `products` might arrive as a JSON string in multipart. Normalize it.

    let { products, testimonials, about, source = "Master Panel" } = req.body;

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

    const hostCompanyExists = await HostCompany.findOne(
      { companyName: req.body.companyName } //can't use company Id as the host signup form can't send any company Id
    );

    if (!hostCompanyExists && source !== "Nomad") {
      return res.status(400).json({ message: "Company not found" });
    }

    for (const k of Object.keys(req.body)) {
      if (/^(products|testimonials)\.\d+\./.test(k)) delete req.body[k];
    }

    const formatCompanyName = (name) => {
      if (!name) return "";

      const trimmed = name.trim().toLowerCase();

      const invalids = ["n/a", "na", "none", "undefined", "null", "-"];
      if (invalids.includes(trimmed)) return "";

      return trimmed.split("-")[0].replace(/\s+/g, "");
    };

    const searchKey = formatCompanyName(req.body.companyName);
    const baseFolder = `hosts/template/${searchKey}`;

    if (searchKey === "") {
      return res.status(400).json({ message: "Provide a valid company name" });
    }

    let template = await WebsiteTemplate.findOne({ searchKey });

    if (template) {
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
      isWebsiteTemplate: true,
      products: [],
      testimonials: [],
    });

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
        const data = await uploadFileToS3(route, {
          buffer,
          mimetype: "image/webp",
        });
        arr.push({ url: data.url, id: data.id });
      }
      return arr;
    };

    if (req.body.companyLogo) {
      template.companyLogo = {
        url: req.body.companyLogo.url,
        id: req.body.companyLogo.id,
      };
    }

    if (req.body.heroImages) {
      template.heroImages = req.body.heroImages.map((img) => ({
        url: img.url,
        id: img.id,
      }));
    }

    if (req.body.gallery) {
      template.gallery = req.body.gallery.map((img) => ({
        url: img.url,
        id: img.id,
      }));
    }

    if (req.body.testimonials) {
      const parsedTestimonials = Array.isArray(req.body.testimonials)
        ? req.body.testimonials
        : safeParse(req.body.testimonials, []);

      template.testimonials = parsedTestimonials.map((t) =>
        t?.url ? { url: t.url, id: t.id } : {}
      );
    }

    // Multer.any puts files in req.files (array). Build a quick index by fieldname.
    const filesByField = {};
    for (const f of req.files || []) {
      if (!filesByField[f.fieldname]) filesByField[f.fieldname] = [];
      filesByField[f.fieldname].push(f);
    }

    // IMAGE LIMIT VALIDATION (same rules as editTemplate)

    const heroFiles = filesByField.heroImages || [];
    const galleryFiles = filesByField.gallery || [];
    const logoFiles = filesByField.companyLogo || [];

    // Company Logo: max 1
    if (logoFiles.length > 1) {
      return res.status(400).json({
        message: "Only one company logo is allowed.",
      });
    }

    // Hero Images: max 5
    if (heroFiles.length > 5) {
      return res.status(400).json({
        message: `Cannot exceed 5 hero images (received ${heroFiles.length}).`,
      });
    }

    // Product images: max 10 per product
    for (let i = 0; i < products.length; i++) {
      const pFiles = filesByField[`productImages_${i}`] || [];
      if (pFiles.length > 10) {
        return res.status(400).json({
          message: `Max 10 images allowed per product (${
            products[i].name || "Unnamed product"
          }).`,
        });
      }
    }

    // Gallery: max 40
    if (galleryFiles.length > 40) {
      return res.status(400).json({
        message: `Cannot exceed 40 gallery images (received ${galleryFiles.length}).`,
      });
    }

    // Testimonials: max 1 image per testimonial
    for (let i = 0; i < testimonials.length; i++) {
      const tFiles = filesByField[`testimonialImages_${i}`] || [];
      if (tFiles.length > 1) {
        return res.status(400).json({
          message: "Only 1 image allowed per testimonial.",
        });
      }
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
      const data = await uploadFileToS3(route, {
        buffer,
        mimetype: "image/webp",
      });
      template.companyLogo = { id: data.id, url: data.url };
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

    const savedTemplate = await template.save();

    if (!savedTemplate) {
      return res.status(400).json({ message: "Failed to create template" });
    }

    if (source !== "Nomad") {
      const updateHostCompany = await HostCompany.findOneAndUpdate(
        { companyName: req.body.companyName }, //can't use company Id as the host signup form can't send any company Id
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
      } catch (error) {
        if (error.response?.status !== 200) {
          return res.status(201).json({
            message:
              "Failed to add link.Check if the company is listed in Nomads.",
            error: error.message,
          });
        }
      }
    }

    console.log("template created!!");
    return res
      .status(201)
      .json({ message: "Template created", template, status: 201 }); //format for host signup response in wono.co
  } catch (error) {
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
        isActive: false,
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
    let { products, testimonials, about, companyName } = req.body;

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

    const formatCompanyName = (name) =>
      (name || "").toLowerCase().split("-")[0].replace(/\s+/g, "");
    const searchKey = formatCompanyName(companyName);
    const baseFolder = `hosts/template/${searchKey}`;

    const template = await WebsiteTemplate.findOne({ searchKey }).session(
      session
    );
    if (!template) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Template not found" });
    }

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
        const data = await uploadFileToS3(route, {
          buffer,
          mimetype: "image/webp",
        });
        arr.push({ id: data.id, url: data.url });
      }
      return arr;
    };

    const deleteImagesFromS3 = async (images = []) => {
      const deletePromises = images.map(async (img) => {
        if (img?.url) {
          try {
            await deleteFileFromS3ByUrl(img.url);
          } catch (error) {
            console.error(`Failed to delete ${img.url}:`, error);
          }
        }
      });
      await Promise.all(deletePromises);
    };

    const filesByField = {};
    for (const f of req.files || []) {
      (filesByField[f.fieldname] ||= []).push(f);
    }

    Object.assign(template, {
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
    if (filesByField.companyLogo?.[0]) {
      if (template.companyLogo?.url) {
        await deleteImagesFromS3([template.companyLogo]);
      }
      const uploaded = await uploadImages(
        [filesByField.companyLogo[0]],
        `${baseFolder}/companyLogo`
      );
      template.companyLogo = uploaded[0];
    }

    // === HERO IMAGES ===
    const heroKeepIds = safeParse(req.body.heroImageIds, null);
    if (heroKeepIds) {
      const imagesToDelete = template.heroImages.filter(
        (img) => !heroKeepIds.includes(img.id)
      );
      await deleteImagesFromS3(imagesToDelete);
      template.heroImages = template.heroImages.filter((img) =>
        heroKeepIds.includes(img.id)
      );
    }
    if (filesByField.heroImages?.length) {
      const newHero = await uploadImages(
        filesByField.heroImages,
        `${baseFolder}/heroImages`
      );
      template.heroImages.push(...newHero);
    }

    // === GALLERY ===
    const galleryKeepIds = safeParse(req.body.galleryImageIds, null);
    if (galleryKeepIds) {
      const imagesToDelete = template.gallery.filter(
        (img) => !galleryKeepIds.includes(img.id)
      );
      await deleteImagesFromS3(imagesToDelete);
      template.gallery = template.gallery.filter((img) =>
        galleryKeepIds.includes(img.id)
      );
    }
    if (filesByField.gallery?.length) {
      const newGallery = await uploadImages(
        filesByField.gallery,
        `${baseFolder}/gallery`
      );
      template.gallery.push(...newGallery);
    }

    // === PRODUCTS === (FIX: Use frontend's index mapping)
    const existingMap = new Map(
      (template.products || []).map((p) => [String(p._id), p])
    );

    // Build index map matching frontend logic
    const existingProducts = template.products || [];
    const idxById = new Map(existingProducts.map((p, i) => [String(p._id), i]));
    const baseLen = existingProducts.length;
    let newCounter = 0;

    const updatedProducts = [];
    for (let formIdx = 0; formIdx < products.length; formIdx++) {
      const p = products[formIdx];
      const existing = p._id ? existingMap.get(String(p._id)) : null;

      // Calculate the correct file field index (matching frontend)
      let fileFieldIndex;
      if (p._id && idxById.has(String(p._id))) {
        fileFieldIndex = idxById.get(String(p._id));
      } else {
        fileFieldIndex = baseLen + newCounter;
        newCounter++;
      }

      const uploaded = await uploadImages(
        filesByField[`productImages_${fileFieldIndex}`] || [],
        `${baseFolder}/productImages/${p._id || fileFieldIndex}`
      );

      if (existing) {
        const keepIds = new Set(p.imageIds || []);
        const imagesToDelete = (existing.images || []).filter(
          (img) => !keepIds.has(img.id)
        );
        await deleteImagesFromS3(imagesToDelete);

        existing.images = (existing.images || []).filter((img) =>
          keepIds.has(img.id)
        );
        existing.images.push(...uploaded);
        existing.type = p.type ?? existing.type;
        existing.name = p.name ?? existing.name;
        existing.cost = p.cost ?? existing.cost;
        existing.description = p.description ?? existing.description;
        updatedProducts.push(existing);
      } else {
        updatedProducts.push({
          type: p.type,
          name: p.name,
          cost: p.cost,
          description: p.description,
          images: uploaded,
        });
      }
    }

    const updatedProductIds = new Set(
      updatedProducts.map((p) => String(p._id)).filter(Boolean)
    );
    const removedProducts = (template.products || []).filter(
      (p) => !updatedProductIds.has(String(p._id))
    );
    for (const removedProduct of removedProducts) {
      await deleteImagesFromS3(removedProduct.images || []);
    }

    template.products = updatedProducts;

    // === TESTIMONIALS === (FIX: Use frontend's index mapping)
    const testimonialMap = new Map(
      (template.testimonials || []).map((t) => [String(t._id), t])
    );

    const existingTestimonials = template.testimonials || [];
    const tIdxById = new Map(
      existingTestimonials.map((t, i) => [String(t._id), i])
    );
    const tBaseLen = existingTestimonials.length;
    let tNewCounter = 0;

    const updatedTestimonials = [];
    for (let formIdx = 0; formIdx < testimonials.length; formIdx++) {
      const t = testimonials[formIdx];
      const existing = t._id ? testimonialMap.get(String(t._id)) : null;

      // Calculate the correct file field index (matching frontend)
      let fileFieldIndex;
      if (t._id && tIdxById.has(String(t._id))) {
        fileFieldIndex = tIdxById.get(String(t._id));
      } else {
        fileFieldIndex = tBaseLen + tNewCounter;
        tNewCounter++;
      }

      const uploaded = await uploadImages(
        filesByField[`testimonialImages_${fileFieldIndex}`] || [],
        `${baseFolder}/testimonialImages`
      );

      if (existing) {
        if (t.imageId === null) {
          if (existing.image?.url) {
            await deleteImagesFromS3([existing.image]);
          }
          existing.image = null;
        } else if (uploaded[0]) {
          if (existing.image?.url) {
            await deleteImagesFromS3([existing.image]);
          }
          existing.image = uploaded[0];
        }

        existing.name = t.name ?? existing.name;
        existing.jobPosition = t.jobPosition ?? existing.jobPosition;
        existing.testimony = t.testimony ?? existing.testimony;
        existing.rating = t.rating ?? existing.rating;
        updatedTestimonials.push(existing);
      } else {
        updatedTestimonials.push({
          name: t.name,
          jobPosition: t.jobPosition,
          testimony: t.testimony,
          rating: t.rating,
          image: uploaded[0] || null,
        });
      }
    }

    const updatedTestimonialIds = new Set(
      updatedTestimonials.map((t) => String(t._id)).filter(Boolean)
    );
    const removedTestimonials = (template.testimonials || []).filter(
      (t) => !updatedTestimonialIds.has(String(t._id))
    );
    for (const removedTestimonial of removedTestimonials) {
      if (removedTestimonial.image?.url) {
        await deleteImagesFromS3([removedTestimonial.image]);
      }
    }

    template.testimonials = updatedTestimonials;

    await template.save({ session });
    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ message: "Template updated successfully", template });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Edit Template Error:", err);
    next(err);
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
