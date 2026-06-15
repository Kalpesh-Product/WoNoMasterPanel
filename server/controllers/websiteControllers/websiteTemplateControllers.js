const sharp = require("sharp");
const axios = require("axios");
const WebsiteTemplate = require("../../models/website/WebsiteTemplate");
const WebsiteTemplateVersion = require("../../models/website/WebsiteTemplateVersion");
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

const hasDynamicTemplateFields = (templateDoc) => {
  if (!templateDoc) return false;
  const navItems = Array.isArray(templateDoc.pageNavItems)
    ? templateDoc.pageNavItems
    : [];
  const productPages = Array.isArray(templateDoc.productDropdownPages)
    ? templateDoc.productDropdownPages
    : [];
  return navItems.length > 0 || productPages.length > 0;
};

const buildSnapshotFromTemplate = (templateDoc) => {
  const plain =
    typeof templateDoc.toObject === "function"
      ? templateDoc.toObject()
      : { ...templateDoc };
  delete plain.__v;
  return plain;
};

const safeParse = (val, fallback) => {
  try {
    return typeof val === "string" ? JSON.parse(val) : val || fallback;
  } catch {
    return fallback;
  }
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const toNum = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePageNavItems = (items = []) =>
  Array.isArray(items)
    ? items.map((item) => ({
        name: item?.name || "",
        slug: item?.slug || "",
        enabled: toBool(item?.enabled, true),
        pageHeading: item?.pageHeading || "",
        pageIntro: item?.pageIntro || "",
        metaTitle: item?.metaTitle || "",
        metaDescription: item?.metaDescription || "",
      }))
    : [];

const normalizeProductDropdownPages = (items = []) =>
  Array.isArray(items)
    ? items.map((item) => ({
        name: item?.name || "",
        slug: item?.slug || "",
        enabled: toBool(item?.enabled, true),
        heroHeading: item?.heroHeading || "",
        heroSubHeading: item?.heroSubHeading || "",
        heroMode: item?.heroMode || "",
        heroImage: item?.heroImage || null,
        heroImages: Array.isArray(item?.heroImages) ? item.heroImages : [],
        heroButtonText: item?.heroButtonText || "",
        homeCardHeading: item?.homeCardHeading || "",
        homeCardSubText: item?.homeCardSubText || "",
        homeCardImage: item?.homeCardImage || null,
        leadEnabled: toBool(item?.leadEnabled, true),
        leadFormLabel: item?.leadFormLabel || "",
      }))
    : [];

const createTemplate = async (req, res, next) => {
  //Master Panel
  //Create template and store in Master Panel DB
  //Add isWebsiteTemplate host company in Master Panel
  //Add websiteLink in company in Nomads

  //Nomad Panel
  //Create template and store in Master Panel DB
  //Company will be created after verification so no isWebsiteTemplate or websiteLink

  try {
    const { company } = req.query;

    // `products` might arrive as a JSON string in multipart. Normalize it.

    let {
      products,
      testimonials,
      about,
      source = "Master Panel",
      pageNavItems,
      productDropdownPages,
      aboutPageImageCards,
    } = req.body;

    about = safeParse(about, []);
    products = safeParse(products, []);
    testimonials = safeParse(testimonials, []);
    pageNavItems = normalizePageNavItems(safeParse(pageNavItems, []));
    productDropdownPages = normalizeProductDropdownPages(
      safeParse(productDropdownPages, []),
    );
    aboutPageImageCards = safeParse(aboutPageImageCards, []);

    const hostCompanyExists = await HostCompany.findOne(
      { companyName: req.body.companyName }, //can't use company Id as the host signup form can't send any company Id
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
      verticalType: req.body.verticalType,
      heroVariant: req.body.heroVariant,
      themeVariant: req.body.themeVariant,
      enabledSections: safeParse(req.body.enabledSections, []),
      sectionOverrides: safeParse(req.body.sectionOverrides, {}),
      styleConfig: safeParse(req.body.styleConfig, {}),
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
      pageNavItems,
      productDropdownPages,
      aboutPageIntro: req.body.aboutPageIntro,
      aboutPageOverview: req.body.aboutPageOverview,
      aboutPageStory: req.body.aboutPageStory,
      aboutPageMission: req.body.aboutPageMission,
      aboutPageVision: req.body.aboutPageVision,
      aboutPageValues: req.body.aboutPageValues,
      aboutPageTeamHeading: req.body.aboutPageTeamHeading,
      aboutPageImages: [],
      aboutPageImageCards: Array.isArray(aboutPageImageCards)
        ? aboutPageImageCards.map((card) => ({
            title: card?.title || "",
            description: card?.description || "",
          }))
        : [],
      galleryPageHeading: req.body.galleryPageHeading,
      testimonialsPageHeading: req.body.testimonialsPageHeading,
      testimonialsPageIntro: req.body.testimonialsPageIntro,
      testimonialsHomePreviewCount: toNum(req.body.testimonialsHomePreviewCount, 3),
      testimonialsEnableWriteReview: toBool(
        req.body.testimonialsEnableWriteReview,
        true,
      ),
      testimonialsSuccessMessage: req.body.testimonialsSuccessMessage,
      contactPageHeading: req.body.contactPageHeading,
      contactPageIntro: req.body.contactPageIntro,
      contactEnableInquiryForm: toBool(req.body.contactEnableInquiryForm, true),
      contactInquirySuccessMessage: req.body.contactInquirySuccessMessage,
      contactBusinessHours: req.body.contactBusinessHours,
      contactPersonName: req.body.contactPersonName,
      contactPersonRole: req.body.contactPersonRole,
      contactPersonEmail: req.body.contactPersonEmail,
      contactPersonPhone: req.body.contactPersonPhone,
    });

    const uploadImages = async (files = [], folder) => {
      const arr = [];

      for (const file of files) {
        const buffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        const route = `${folder}/${Date.now()}_${file.originalname.replace(
          /\s+/g,
          "_",
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
        t?.url ? { url: t.url, id: t.id } : {},
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

    // Carousel Images: max 5
    if (heroFiles.length > 5) {
      return res.status(400).json({
        message: `Cannot exceed 5 carousel images (received ${heroFiles.length}).`,
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

    const aboutPageImagesFiles = filesByField.aboutPageImages || [];
    if (aboutPageImagesFiles.length > 12) {
      return res.status(400).json({
        message: `Cannot exceed 12 about page images (received ${aboutPageImagesFiles.length}).`,
      });
    }

    for (let i = 0; i < productDropdownPages.length; i++) {
      const heroImageSingle = filesByField[`productPageHeroImage_${i}`] || [];
      const heroImageMulti = filesByField[`productPageHeroImages_${i}`] || [];
      const homeCardImage = filesByField[`productPageHomeCardImage_${i}`] || [];
      if (heroImageSingle.length > 1) {
        return res.status(400).json({
          message: `Only one hero image is allowed for product page ${i + 1}.`,
        });
      }
      if (heroImageMulti.length > 5) {
        return res.status(400).json({
          message: `Cannot exceed 5 hero carousel images for product page ${i + 1}.`,
        });
      }
      if (homeCardImage.length > 1) {
        return res.status(400).json({
          message: `Only one home card image is allowed for product page ${i + 1}.`,
        });
      }
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
        `${baseFolder}/heroImages`,
      );
    }

    // gallery
    if (filesByField.gallery?.length) {
      template.gallery = await uploadImages(
        filesByField.gallery,
        `${baseFolder}/gallery`,
      );
    }

    if (aboutPageImagesFiles.length) {
      template.aboutPageImages = await uploadImages(
        aboutPageImagesFiles,
        `${baseFolder}/aboutPage/images`,
      );
    }

    for (let i = 0; i < template.aboutPageImageCards.length; i++) {
      const cardImage = filesByField[`aboutPageImageCardImage_${i}`] || [];
      if (cardImage[0]) {
        const uploaded = await uploadImages(
          [cardImage[0]],
          `${baseFolder}/aboutPage/cards/${i}`,
        );
        template.aboutPageImageCards[i].image = uploaded[0];
      }
    }

    if (Array.isArray(template.productDropdownPages)) {
      for (let i = 0; i < template.productDropdownPages.length; i++) {
        const page = template.productDropdownPages[i];
        const singleHero = filesByField[`productPageHeroImage_${i}`] || [];
        const multiHero = filesByField[`productPageHeroImages_${i}`] || [];
        const homeCard = filesByField[`productPageHomeCardImage_${i}`] || [];

        if (singleHero[0]) {
          const uploaded = await uploadImages(
            [singleHero[0]],
            `${baseFolder}/productDropdownPages/${i}/hero`,
          );
          page.heroImage = uploaded[0];
        }

        if (multiHero.length) {
          page.heroImages = await uploadImages(
            multiHero,
            `${baseFolder}/productDropdownPages/${i}/heroImages`,
          );
        }

        if (homeCard[0]) {
          const uploaded = await uploadImages(
            [homeCard[0]],
            `${baseFolder}/productDropdownPages/${i}/homeCard`,
          );
          page.homeCardImage = uploaded[0];
        }
      }
    }

    if (Array.isArray(products) && products.length) {
      console.log("=== PROCESSING PRODUCTS ===");
      console.log("Source:", source);
      console.log("Number of products:", products.length);
      for (let i = 0; i < products.length; i++) {
        const p = products[i] || {};
        const pFiles = filesByField[`productImages_${i}`] || [];

        console.log(`\nProduct ${i}:`);
        console.log("- Name:", p.name);
        console.log("- New files to upload:", pFiles.length);
        console.log("- Pre-existing images:", p.images?.length || 0);
        let productImages = [];

        // SCENARIO 1: New files being uploaded (from Master Panel)
        if (pFiles.length > 0) {
          productImages = await uploadImages(
            pFiles,
            `${baseFolder}/productImages/${i}`,
          );
          console.log(
            `Uploaded ${productImages.length} new images for product ${i}`,
          );
        }
        // SCENARIO 2: Pre-existing URLs (from Nomad website)
        else if (p.images && Array.isArray(p.images) && p.images.length > 0) {
          productImages = p.images.map((img) => ({
            url: img.url,
            id: img.id,
          }));
          console.log(
            `Using ${productImages.length} pre-existing images for product ${i}`,
          );
        }

        template.products.push({
          type: p.type,
          name: p.name,
          cost: p.cost,
          description: p.description,
          images: productImages, // Now handles both scenarios
        });
      }
    }
    // if (Array.isArray(products) && products.length) {
    //   console.log("Entered Products")
    //   for (let i = 0; i < products.length; i++) {
    //     const p = products[i] || {};
    //     const pFiles = filesByField[`productImages_${i}`] || [];
    //     const uploaded = await uploadImages(
    //       pFiles,
    //       `${baseFolder}/productImages/${i}`
    //     );

    //     template.products.push({
    //       type: p.type,
    //       name: p.name,
    //       cost: p.cost,
    //       description: p.description,
    //       images: uploaded,
    //     });
    //   }
    // }

    // TESTIMONIALS: objects + flat testimonialImages array (zip by index)
    let tUploads = [];
    if (filesByField.testimonialImages?.length) {
      // Preferred new path: single field 'testimonialImages' with N files in order
      tUploads = await uploadImages(
        filesByField.testimonialImages,
        `${baseFolder}/testimonialImages`,
      );
    } else {
      // Back-compat: testimonialImages_${i}
      for (let i = 0; i < testimonials.length; i++) {
        const tFiles = filesByField[`testimonialImages_${i}`] || [];
        const uploaded = await uploadImages(
          tFiles,
          `${baseFolder}/testimonialImages/${i}`,
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
        },
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
          },
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
    const latestPublished = await WebsiteTemplateVersion.findOne({
      searchKey,
      isLatestPublished: true,
    })
      .sort({ publishedAt: -1, version: -1 })
      .lean();

    if (latestPublished?.templateSnapshot) {
      return res.json({
        ...latestPublished.templateSnapshot,
        isPublished: true,
        publishedVersion: latestPublished.version,
        publishedAt: latestPublished.publishedAt,
      });
    }

    const template = await WebsiteTemplate.findOne({ searchKey }).lean();
    if (!template) {
      return res.status(200).json([]);
    }

    // Backward compatibility: old templates can still render from live doc.
    // Dynamic templates must be published before appearing on hosted domain.
    if (hasDynamicTemplateFields(template)) {
      return res.status(404).json({
        message:
          "No published website version found for this company. Please publish from Website Builder.",
      });
    }

    return res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const publishTemplate = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const formatCompanyName = (name) => {
      if (!name) return "";
      return name.toLowerCase().split("-")[0].replace(/\s+/g, "");
    };

    const rawSearchKey =
      req.body?.searchKey || req.query?.searchKey || req.body?.companyName || "";
    const searchKey = formatCompanyName(rawSearchKey);

    if (!searchKey) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "searchKey or companyName is required" });
    }

    const template = await WebsiteTemplate.findOne({ searchKey }).session(session);
    if (!template) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Website template not found" });
    }

    const nextVersion = Number(template.publishedVersion || 0) + 1;
    const publishedAt = new Date();

    await WebsiteTemplateVersion.updateMany(
      { searchKey, isLatestPublished: true },
      { $set: { isLatestPublished: false } },
      { session },
    );

    const snapshot = buildSnapshotFromTemplate(template);
    snapshot.isPublished = true;
    snapshot.publishedVersion = nextVersion;
    snapshot.publishedAt = publishedAt;

    await WebsiteTemplateVersion.create(
      [
        {
          searchKey,
          companyName: template.companyName || "",
          companyId: template.companyId || "",
          version: nextVersion,
          isLatestPublished: true,
          publishedAt,
          templateSnapshot: snapshot,
        },
      ],
      { session },
    );

    template.isPublished = true;
    template.publishedVersion = nextVersion;
    template.publishedAt = publishedAt;
    await template.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Website published successfully",
      searchKey,
      publishedVersion: nextVersion,
      publishedAt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
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
      },
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
      },
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
      about,
      companyName,
      pageNavItems,
      productDropdownPages,
      aboutPageImageCards,
    } = req.body;

    about = safeParse(about, []);
    products = safeParse(products, []);
    testimonials = safeParse(testimonials, []);
    pageNavItems = normalizePageNavItems(safeParse(pageNavItems, []));
    productDropdownPages = normalizeProductDropdownPages(
      safeParse(productDropdownPages, []),
    );
    aboutPageImageCards = safeParse(aboutPageImageCards, []);

    const formatCompanyName = (name) =>
      (name || "").toLowerCase().split("-")[0].replace(/\s+/g, "");
    const searchKey = formatCompanyName(companyName);
    const baseFolder = `hosts/template/${searchKey}`;

    const TEXT_LIMITS = {
      title: 120,
      subTitle: 200,
      CTAButtonText: 50,
      productTitle: 120,
      galleryTitle: 120,
      testimonialTitle: 120,
      contactTitle: 120,
      mapUrl: 2048,
      email: 254,
      phone: 30,
      address: 200,
      registeredCompanyName: 150,
      copyrightText: 200,
      aboutItem: 500,
      productType: 50,
      productName: 120,
      productCost: 50,
      productDescription: 500,
      testimonialName: 120,
      testimonialJob: 120,
      testimonialText: 500,
    };

    const enforceMaxLength = (label, value, max) => {
      if (typeof value === "string" && value.length > max) {
        throw new Error(`${label} cannot exceed ${max} characters.`);
      }
    };

    const validateTextFields = () => {
      const fieldLimits = [
        ["Title", req.body.title, TEXT_LIMITS.title],
        ["Subtitle", req.body.subTitle, TEXT_LIMITS.subTitle],
        ["CTA button text", req.body.CTAButtonText, TEXT_LIMITS.CTAButtonText],
        ["Product title", req.body.productTitle, TEXT_LIMITS.productTitle],
        ["Gallery title", req.body.galleryTitle, TEXT_LIMITS.galleryTitle],
        [
          "Testimonial title",
          req.body.testimonialTitle,
          TEXT_LIMITS.testimonialTitle,
        ],
        ["Contact title", req.body.contactTitle, TEXT_LIMITS.contactTitle],
        ["Map URL", req.body.mapUrl, TEXT_LIMITS.mapUrl],
        ["Email", req.body.email, TEXT_LIMITS.email],
        ["Phone", req.body.phone, TEXT_LIMITS.phone],
        ["Address", req.body.address, TEXT_LIMITS.address],
        [
          "Registered company name",
          req.body.registeredCompanyName,
          TEXT_LIMITS.registeredCompanyName,
        ],
        ["Copyright text", req.body.copyrightText, TEXT_LIMITS.copyrightText],
      ];

      fieldLimits.forEach(([label, value, max]) => {
        enforceMaxLength(label, value, max);
      });

      if (Array.isArray(about)) {
        about.forEach((item, index) => {
          enforceMaxLength(
            `About item ${index + 1}`,
            item,
            TEXT_LIMITS.aboutItem,
          );
        });
      }

      if (Array.isArray(products)) {
        products.forEach((product, index) => {
          enforceMaxLength(
            `Product ${index + 1} type`,
            product?.type,
            TEXT_LIMITS.productType,
          );
          enforceMaxLength(
            `Product ${index + 1} name`,
            product?.name,
            TEXT_LIMITS.productName,
          );
          enforceMaxLength(
            `Product ${index + 1} cost`,
            product?.cost,
            TEXT_LIMITS.productCost,
          );
          enforceMaxLength(
            `Product ${index + 1} description`,
            product?.description,
            TEXT_LIMITS.productDescription,
          );
        });
      }

      if (Array.isArray(testimonials)) {
        testimonials.forEach((testimonial, index) => {
          enforceMaxLength(
            `Testimonial ${index + 1} name`,
            testimonial?.name,
            TEXT_LIMITS.testimonialName,
          );
          enforceMaxLength(
            `Testimonial ${index + 1} job position`,
            testimonial?.jobPosition,
            TEXT_LIMITS.testimonialJob,
          );
          enforceMaxLength(
            `Testimonial ${index + 1} testimony`,
            testimonial?.testimony,
            TEXT_LIMITS.testimonialText,
          );
        });
      }
    };

    validateTextFields();

    const template = await WebsiteTemplate.findOne({ searchKey }).session(
      session,
    );
    if (!template) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Template not found" });
    }

    // const uploadImages = async (files = [], folder) => {
    //   const arr = [];
    //   for (const file of files) {
    //     const buffer = await sharp(file.buffer)
    //       .webp({ quality: 80 })
    //       .toBuffer();
    //     const route = `${folder}/${Date.now()}_${file.originalname.replace(
    //       /\s+/g,
    //       "_"
    //     )}`;
    //     const data = await uploadFileToS3(route, {
    //       buffer,
    //       mimetype: "image/webp",
    //     });
    //     arr.push({ id: data.id, url: data.url });
    //   }
    //   return arr;
    // };

    const uploadImages = async (files = [], folder, limit = Infinity) => {
      if (files.length > limit) {
        throw new Error(`Too many images for ${folder}. Max allowed: ${limit}`);
      }

      const arr = [];
      for (const file of files.slice(0, limit)) {
        const buffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();
        const route = `${folder}/${Date.now()}_${file.originalname.replace(
          /\s+/g,
          "_",
        )}`;
        const data = await uploadFileToS3(route, {
          buffer,
          mimetype: "image/webp",
        });
        arr.push({ id: data.id, url: data.url });
      }
      return arr;
    };

    // const deleteImagesFromS3 = async (images = []) => {
    //   const deletePromises = images.map(async (img) => {
    //     if (img?.url) {
    //       try {
    //         await deleteFileFromS3ByUrl(img.url);
    //       } catch (error) {
    //         console.error(`Failed to delete ${img.url}:`, error);
    //       }
    //     }
    //   });
    //   await Promise.all(deletePromises);
    // };

    const deleteImagesFromS3 = async (images = []) => {
      await Promise.all(
        images.map(async (img) => {
          if (img?.url) {
            try {
              await deleteFileFromS3ByUrl(img.url);
            } catch (err) {
              console.error(`Failed to delete ${img.url}:`, err);
            }
          }
        }),
      );
    };

    const filesByField = {};
    for (const f of req.files || []) {
      (filesByField[f.fieldname] ||= []).push(f);
    }

    Object.assign(template, {
      title: req.body.title ?? template.title,
      subTitle: req.body.subTitle ?? template.subTitle,
      CTAButtonText: req.body.CTAButtonText ?? template.CTAButtonText,
      verticalType: req.body.verticalType ?? template.verticalType,
      heroVariant: req.body.heroVariant ?? template.heroVariant,
      themeVariant: req.body.themeVariant ?? template.themeVariant,
      enabledSections:
        req.body.enabledSections !== undefined
          ? safeParse(req.body.enabledSections, [])
          : template.enabledSections,
      sectionOverrides:
        req.body.sectionOverrides !== undefined
          ? safeParse(req.body.sectionOverrides, {})
          : template.sectionOverrides,
      styleConfig:
        req.body.styleConfig !== undefined
          ? safeParse(req.body.styleConfig, {})
          : template.styleConfig,
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
      pageNavItems:
        req.body.pageNavItems !== undefined ? pageNavItems : template.pageNavItems,
      productDropdownPages:
        req.body.productDropdownPages !== undefined
          ? productDropdownPages
          : template.productDropdownPages,
      aboutPageIntro: req.body.aboutPageIntro ?? template.aboutPageIntro,
      aboutPageOverview: req.body.aboutPageOverview ?? template.aboutPageOverview,
      aboutPageStory: req.body.aboutPageStory ?? template.aboutPageStory,
      aboutPageMission: req.body.aboutPageMission ?? template.aboutPageMission,
      aboutPageVision: req.body.aboutPageVision ?? template.aboutPageVision,
      aboutPageValues: req.body.aboutPageValues ?? template.aboutPageValues,
      aboutPageTeamHeading:
        req.body.aboutPageTeamHeading ?? template.aboutPageTeamHeading,
      galleryPageHeading: req.body.galleryPageHeading ?? template.galleryPageHeading,
      testimonialsPageHeading:
        req.body.testimonialsPageHeading ?? template.testimonialsPageHeading,
      testimonialsPageIntro:
        req.body.testimonialsPageIntro ?? template.testimonialsPageIntro,
      testimonialsHomePreviewCount:
        req.body.testimonialsHomePreviewCount !== undefined
          ? toNum(
              req.body.testimonialsHomePreviewCount,
              template.testimonialsHomePreviewCount ?? 3,
            )
          : template.testimonialsHomePreviewCount,
      testimonialsEnableWriteReview:
        req.body.testimonialsEnableWriteReview !== undefined
          ? toBool(
              req.body.testimonialsEnableWriteReview,
              template.testimonialsEnableWriteReview ?? true,
            )
          : template.testimonialsEnableWriteReview,
      testimonialsSuccessMessage:
        req.body.testimonialsSuccessMessage ?? template.testimonialsSuccessMessage,
      contactPageHeading: req.body.contactPageHeading ?? template.contactPageHeading,
      contactPageIntro: req.body.contactPageIntro ?? template.contactPageIntro,
      contactEnableInquiryForm:
        req.body.contactEnableInquiryForm !== undefined
          ? toBool(req.body.contactEnableInquiryForm, true)
          : template.contactEnableInquiryForm,
      contactInquirySuccessMessage:
        req.body.contactInquirySuccessMessage ??
        template.contactInquirySuccessMessage,
      contactBusinessHours:
        req.body.contactBusinessHours ?? template.contactBusinessHours,
      contactPersonName: req.body.contactPersonName ?? template.contactPersonName,
      contactPersonRole: req.body.contactPersonRole ?? template.contactPersonRole,
      contactPersonEmail:
        req.body.contactPersonEmail ?? template.contactPersonEmail,
      contactPersonPhone:
        req.body.contactPersonPhone ?? template.contactPersonPhone,
    });

    if (req.body.aboutPageImageCards !== undefined) {
      template.aboutPageImageCards = Array.isArray(aboutPageImageCards)
        ? aboutPageImageCards.map((card, index) => ({
            title: card?.title || "",
            description: card?.description || "",
            image: template.aboutPageImageCards?.[index]?.image || null,
          }))
        : template.aboutPageImageCards;
    }

    // === COMPANY LOGO ===
    // if (filesByField.companyLogo?.[0]) {
    //   if (template.companyLogo?.url) {
    //     await deleteImagesFromS3([template.companyLogo]);
    //   }
    //   const uploaded = await uploadImages(
    //     [filesByField.companyLogo[0]],
    //     `${baseFolder}/companyLogo`
    //   );
    //   template.companyLogo = uploaded[0];
    // }

    // === 🏢 COMPANY LOGO (limit 1) ===
    if (filesByField.companyLogo?.length) {
      if (filesByField.companyLogo.length > 1) {
        throw new Error("Only one company logo is allowed.");
      }
      if (template.companyLogo?.url)
        await deleteImagesFromS3([template.companyLogo]);
      const uploaded = await uploadImages(
        [filesByField.companyLogo[0]],
        `${baseFolder}/companyLogo`,
        1,
      );
      template.companyLogo = uploaded[0];
    }

    // === CAROUSEL IMAGES ===
    // const heroKeepIds = safeParse(req.body.heroImageIds, null);
    // if (heroKeepIds) {
    //   const imagesToDelete = template.heroImages.filter(
    //     (img) => !heroKeepIds.includes(img.id)
    //   );
    //   await deleteImagesFromS3(imagesToDelete);
    //   template.heroImages = template.heroImages.filter((img) =>
    //     heroKeepIds.includes(img.id)
    //   );
    // }
    // if (filesByField.heroImages?.length) {
    //   const newHero = await uploadImages(
    //     filesByField.heroImages,
    //     `${baseFolder}/heroImages`
    //   );
    //   template.heroImages.push(...newHero);
    // }

    // === 🖼 HERO IMAGES (max 5 total) ===
    const heroKeepIds = safeParse(req.body.heroImageIds, []);

    if (req.body.heroImageIds !== undefined) {
      const toDelete = template.heroImages.filter(
        (img) => !heroKeepIds.includes(img.id),
      );
      await deleteImagesFromS3(toDelete);
      template.heroImages = template.heroImages.filter((img) =>
        heroKeepIds.includes(img.id),
      );
    }

    const newHeroFiles = filesByField.heroImages || [];
    const totalHeroCount = template.heroImages.length + newHeroFiles.length;
    // const totalHeroCount = heroKeepIds.length + newHeroFiles.length;
    if (totalHeroCount > 5) {
      throw new Error(
        `Cannot exceed 5 hero images (currently ${template.heroImages.length}).`,
      );
    }
    if (newHeroFiles.length) {
      const newHero = await uploadImages(
        newHeroFiles,
        `${baseFolder}/heroImages`,
        5,
      );
      template.heroImages.push(...newHero);
    }

    // === GALLERY ===
    // const galleryKeepIds = safeParse(req.body.galleryImageIds, null);
    // if (galleryKeepIds) {
    //   const imagesToDelete = template.gallery.filter(
    //     (img) => !galleryKeepIds.includes(img.id)
    //   );
    //   await deleteImagesFromS3(imagesToDelete);
    //   template.gallery = template.gallery.filter((img) =>
    //     galleryKeepIds.includes(img.id)
    //   );
    // }
    // if (filesByField.gallery?.length) {
    //   const newGallery = await uploadImages(
    //     filesByField.gallery,
    //     `${baseFolder}/gallery`
    //   );
    //   template.gallery.push(...newGallery);
    // }

    // === 🏞 GALLERY (max 40 total) ===
    const galleryKeepIds = safeParse(req.body.galleryImageIds, []);
    if (req.body.galleryImageIds !== undefined) {
      const toDelete = template.gallery.filter(
        (img) => !galleryKeepIds.includes(img.id),
      );
      await deleteImagesFromS3(toDelete);
      template.gallery = template.gallery.filter((img) =>
        galleryKeepIds.includes(img.id),
      );
    }

    const newGalleryFiles = filesByField.gallery || [];
    const totalGalleryCount = template.gallery.length + newGalleryFiles.length;
    if (totalGalleryCount > 40) {
      throw new Error(
        `Cannot exceed 40 gallery images (currently ${template.gallery.length}).`,
      );
    }
    if (newGalleryFiles.length) {
      const newGallery = await uploadImages(
        newGalleryFiles,
        `${baseFolder}/gallery`,
        40,
      );
      template.gallery.push(...newGallery);
    }

    // === ABOUT PAGE IMAGES / TEAM CARDS ===
    const newAboutPageImages = filesByField.aboutPageImages || [];
    const aboutKeepIds = safeParse(req.body.aboutPageImageIds, []);
    if (req.body.aboutPageImageIds !== undefined) {
      const toDelete = (template.aboutPageImages || []).filter(
        (img) => !aboutKeepIds.includes(img.id),
      );
      await deleteImagesFromS3(toDelete);
      template.aboutPageImages = (template.aboutPageImages || []).filter((img) =>
        aboutKeepIds.includes(img.id),
      );
    }
    if ((template.aboutPageImages?.length || 0) + newAboutPageImages.length > 12) {
      throw new Error("Cannot exceed 12 about page images.");
    }
    if (newAboutPageImages.length) {
      const uploaded = await uploadImages(
        newAboutPageImages,
        `${baseFolder}/aboutPage/images`,
        12,
      );
      template.aboutPageImages = [...(template.aboutPageImages || []), ...uploaded];
    }

    for (let i = 0; i < (template.aboutPageImageCards || []).length; i++) {
      const cardFiles = filesByField[`aboutPageImageCardImage_${i}`] || [];
      if (cardFiles.length > 1) {
        throw new Error(`Only one image allowed for about page card ${i + 1}.`);
      }
      if (cardFiles[0]) {
        const currentImage = template.aboutPageImageCards?.[i]?.image;
        if (currentImage?.url) await deleteImagesFromS3([currentImage]);
        const uploaded = await uploadImages(
          [cardFiles[0]],
          `${baseFolder}/aboutPage/cards/${i}`,
          1,
        );
        template.aboutPageImageCards[i].image = uploaded[0];
      }
    }

    // === PRODUCT DROPDOWN PAGE ASSETS ===
    for (let i = 0; i < (template.productDropdownPages || []).length; i++) {
      const page = template.productDropdownPages[i];
      const singleHero = filesByField[`productPageHeroImage_${i}`] || [];
      const multiHero = filesByField[`productPageHeroImages_${i}`] || [];
      const homeCard = filesByField[`productPageHomeCardImage_${i}`] || [];

      if (singleHero.length > 1) {
        throw new Error(`Only one hero image allowed for product page ${i + 1}.`);
      }
      if (multiHero.length > 5) {
        throw new Error(
          `Cannot exceed 5 hero carousel images for product page ${i + 1}.`,
        );
      }
      if (homeCard.length > 1) {
        throw new Error(
          `Only one home card image allowed for product page ${i + 1}.`,
        );
      }

      if (singleHero[0]) {
        if (page.heroImage?.url) await deleteImagesFromS3([page.heroImage]);
        const uploaded = await uploadImages(
          [singleHero[0]],
          `${baseFolder}/productDropdownPages/${i}/hero`,
          1,
        );
        page.heroImage = uploaded[0];
      }

      const keepHeroIds = safeParse(req.body[`productPageHeroImageIds_${i}`], []);
      if (req.body[`productPageHeroImageIds_${i}`] !== undefined) {
        const toDelete = (page.heroImages || []).filter(
          (img) => !keepHeroIds.includes(img.id),
        );
        await deleteImagesFromS3(toDelete);
        page.heroImages = (page.heroImages || []).filter((img) =>
          keepHeroIds.includes(img.id),
        );
      }
      if ((page.heroImages?.length || 0) + multiHero.length > 5) {
        throw new Error(
          `Cannot exceed 5 hero carousel images for product page ${i + 1}.`,
        );
      }
      if (multiHero.length) {
        const uploaded = await uploadImages(
          multiHero,
          `${baseFolder}/productDropdownPages/${i}/heroImages`,
          5,
        );
        page.heroImages = [...(page.heroImages || []), ...uploaded];
      }

      if (homeCard[0]) {
        if (page.homeCardImage?.url) await deleteImagesFromS3([page.homeCardImage]);
        const uploaded = await uploadImages(
          [homeCard[0]],
          `${baseFolder}/productDropdownPages/${i}/homeCard`,
          1,
        );
        page.homeCardImage = uploaded[0];
      }
    }

    // === PRODUCTS === (FIX: Use frontend's index mapping)
    // const existingMap = new Map(
    //   (template.products || []).map((p) => [String(p._id), p])
    // );

    // // Build index map matching frontend logic
    // const existingProducts = template.products || [];
    // const idxById = new Map(existingProducts.map((p, i) => [String(p._id), i]));
    // const baseLen = existingProducts.length;
    // let newCounter = 0;

    // const updatedProducts = [];
    // for (let formIdx = 0; formIdx < products.length; formIdx++) {
    //   const p = products[formIdx];
    //   const existing = p._id ? existingMap.get(String(p._id)) : null;

    //   // Calculate the correct file field index (matching frontend)
    //   let fileFieldIndex;
    //   if (p._id && idxById.has(String(p._id))) {
    //     fileFieldIndex = idxById.get(String(p._id));
    //   } else {
    //     fileFieldIndex = baseLen + newCounter;
    //     newCounter++;
    //   }

    //   const uploaded = await uploadImages(
    //     filesByField[`productImages_${fileFieldIndex}`] || [],
    //     `${baseFolder}/productImages/${p._id || fileFieldIndex}`
    //   );

    //   if (existing) {
    //     const keepIds = new Set(p.imageIds || []);
    //     const imagesToDelete = (existing.images || []).filter(
    //       (img) => !keepIds.has(img.id)
    //     );
    //     await deleteImagesFromS3(imagesToDelete);

    //     existing.images = (existing.images || []).filter((img) =>
    //       keepIds.has(img.id)
    //     );
    //     existing.images.push(...uploaded);
    //     existing.type = p.type ?? existing.type;
    //     existing.name = p.name ?? existing.name;
    //     existing.cost = p.cost ?? existing.cost;
    //     existing.description = p.description ?? existing.description;
    //     updatedProducts.push(existing);
    //   } else {
    //     updatedProducts.push({
    //       type: p.type,
    //       name: p.name,
    //       cost: p.cost,
    //       description: p.description,
    //       images: uploaded,
    //     });
    //   }
    // }

    // const updatedProductIds = new Set(
    //   updatedProducts.map((p) => String(p._id)).filter(Boolean)
    // );
    // const removedProducts = (template.products || []).filter(
    //   (p) => !updatedProductIds.has(String(p._id))
    // );
    // for (const removedProduct of removedProducts) {
    //   await deleteImagesFromS3(removedProduct.images || []);
    // }

    // template.products = updatedProducts;

    // === 🛍 PRODUCTS (max 10 per product) ===
    const existingMap = new Map(
      (template.products || []).map((p) => [String(p._id), p]),
    );
    const idxById = new Map(
      (template.products || []).map((p, i) => [String(p._id), i]),
    );
    const baseLen = (template.products || []).length;
    let newCounter = 0;

    const updatedProducts = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const existing = p._id ? existingMap.get(String(p._id)) : null;
      const fieldIdx =
        p._id && idxById.has(String(p._id))
          ? idxById.get(String(p._id))
          : baseLen + newCounter++;

      const existingCount = existing?.images?.length || 0;
      const newFiles = filesByField[`productImages_${fieldIdx}`] || [];
      const total = existingCount + newFiles.length;
      if (total > 10) {
        throw new Error(
          `Max 10 images allowed per product (${p.name || "Unnamed product"}).`,
        );
      }

      const uploaded = newFiles.length
        ? await uploadImages(
            newFiles,
            `${baseFolder}/productImages/${p._id || fieldIdx}`,
            10,
          )
        : [];

      if (existing) {
        const keepIds = new Set(p.imageIds || []);

        if (p.imageIds !== undefined) {
          const toDelete = (existing.images || []).filter(
            (img) => !keepIds.has(img.id),
          );
          await deleteImagesFromS3(toDelete);
          const kept = (existing.images || []).filter((img) =>
            keepIds.has(img.id),
          );
          existing.images = [...kept, ...uploaded];
        } else {
          existing.images = [...(existing.images || []), ...uploaded];
        }
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

    const updatedIds = new Set(
      updatedProducts.map((p) => String(p._id)).filter(Boolean),
    );
    const removedProducts = (template.products || []).filter(
      (p) => !updatedIds.has(String(p._id)),
    );
    for (const removed of removedProducts)
      await deleteImagesFromS3(removed.images || []);
    template.products = updatedProducts;

    // === TESTIMONIALS === (FIX: Use frontend's index mapping)
    // const testimonialMap = new Map(
    //   (template.testimonials || []).map((t) => [String(t._id), t])
    // );

    // const existingTestimonials = template.testimonials || [];
    // const tIdxById = new Map(
    //   existingTestimonials.map((t, i) => [String(t._id), i])
    // );
    // const tBaseLen = existingTestimonials.length;
    // let tNewCounter = 0;

    // const updatedTestimonials = [];
    // for (let formIdx = 0; formIdx < testimonials.length; formIdx++) {
    //   const t = testimonials[formIdx];
    //   const existing = t._id ? testimonialMap.get(String(t._id)) : null;

    //   // Calculate the correct file field index (matching frontend)
    //   let fileFieldIndex;
    //   if (t._id && tIdxById.has(String(t._id))) {
    //     fileFieldIndex = tIdxById.get(String(t._id));
    //   } else {
    //     fileFieldIndex = tBaseLen + tNewCounter;
    //     tNewCounter++;
    //   }

    //   const uploaded = await uploadImages(
    //     filesByField[`testimonialImages_${fileFieldIndex}`] || [],
    //     `${baseFolder}/testimonialImages`
    //   );

    //   if (existing) {
    //     if (t.imageId === null) {
    //       if (existing.image?.url) {
    //         await deleteImagesFromS3([existing.image]);
    //       }
    //       existing.image = null;
    //     } else if (uploaded[0]) {
    //       if (existing.image?.url) {
    //         await deleteImagesFromS3([existing.image]);
    //       }
    //       existing.image = uploaded[0];
    //     }

    //     existing.name = t.name ?? existing.name;
    //     existing.jobPosition = t.jobPosition ?? existing.jobPosition;
    //     existing.testimony = t.testimony ?? existing.testimony;
    //     existing.rating = t.rating ?? existing.rating;
    //     updatedTestimonials.push(existing);
    //   } else {
    //     updatedTestimonials.push({
    //       name: t.name,
    //       jobPosition: t.jobPosition,
    //       testimony: t.testimony,
    //       rating: t.rating,
    //       image: uploaded[0] || null,
    //     });
    //   }
    // }

    // const updatedTestimonialIds = new Set(
    //   updatedTestimonials.map((t) => String(t._id)).filter(Boolean)
    // );
    // const removedTestimonials = (template.testimonials || []).filter(
    //   (t) => !updatedTestimonialIds.has(String(t._id))
    // );
    // for (const removedTestimonial of removedTestimonials) {
    //   if (removedTestimonial.image?.url) {
    //     await deleteImagesFromS3([removedTestimonial.image]);
    //   }
    // }

    // template.testimonials = updatedTestimonials;

    // === 💬 TESTIMONIALS (max 1 per testimonial) ===
    const testimonialMap = new Map(
      (template.testimonials || []).map((t) => [String(t._id), t]),
    );
    const tIdxById = new Map(
      (template.testimonials || []).map((t, i) => [String(t._id), i]),
    );
    const tBaseLen = (template.testimonials || []).length;
    let tNewCounter = 0;

    const updatedTestimonials = [];
    for (let i = 0; i < testimonials.length; i++) {
      const t = testimonials[i];
      const existing = t._id ? testimonialMap.get(String(t._id)) : null;
      const fieldIdx =
        t._id && tIdxById.has(String(t._id))
          ? tIdxById.get(String(t._id))
          : tBaseLen + tNewCounter++;

      const newFiles = filesByField[`testimonialImages_${fieldIdx}`] || [];
      if (newFiles.length > 1)
        throw new Error("Only 1 image allowed per testimonial.");

      const uploaded = newFiles.length
        ? await uploadImages(newFiles, `${baseFolder}/testimonialImages`, 1)
        : [];

      if (existing) {
        if (uploaded[0]) {
          if (existing.image?.url) await deleteImagesFromS3([existing.image]);
          existing.image = uploaded[0];
        } else if (t.imageId === null) {
          if (existing.image?.url) await deleteImagesFromS3([existing.image]);
          existing.image = null;
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

    const updatedTIds = new Set(
      updatedTestimonials.map((t) => String(t._id)).filter(Boolean),
    );
    const removedT = (template.testimonials || []).filter(
      (t) => !updatedTIds.has(String(t._id)),
    );
    for (const r of removedT)
      if (r.image?.url) await deleteImagesFromS3([r.image]);
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
  publishTemplate,
  editTemplate,
  getTemplate,
  getTemplates,
  getInActiveTemplates,
  getInActiveTemplate,
  activateTemplate,
  deleteTemplate,
};
