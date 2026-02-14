const { default: axios } = require("axios");
const HostCompany = require("../models/hostCompany/hostCompany");
const { uploadFileToS3, deleteFileFromS3ByUrl } = require("../config/s3config");

const createCompanyListing = async (req, res) => {
  try {
    const {
      companyId,
      companyType,
      companyTitle,
      ratings,
      totalReviews,
      productName,
      cost,
      description,
      latitude,
      longitude,
      inclusions,
      about,
      address,
      reviews,
    } = req.body;

    let parsedReviews;

    const company = await HostCompany.findOne({ companyId: companyId.trim() });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    if (typeof reviews === "string") {
      parsedReviews = JSON.parse(reviews);
    }

    const listingData = {
      companyName: productName,
      companyTitle: companyTitle ? companyTitle : company.companyName,
      companyId: company.companyId,
      logo: company.logo,
      city: company.companyCity,
      state: company.companyState,
      country: company.companyCountry,
      website: company.websiteLink,
      companyType: companyType,
      ratings: ratings,
      totalReviews: totalReviews,
      // productName: productName,
      cost: cost,
      description: description,
      latitude: latitude,
      longitude: longitude,
      inclusions: inclusions,
      about: about,
      address: address,
      reviews: parsedReviews,
      images: [],
    };

    //Upload images

    const formatCompanyType = (type) => {
      const map = {
        hostel: "hostels",
        privatestay: "private-stay",
        meetingroom: "meetingroom",
        coworking: "coworking",
        cafe: "cafe",
        coliving: "coliving",
        workation: "workation",
      };
      const key = String(type || "").toLowerCase();
      return map[key] || "unknown";
    };

    const pathCompanyType = formatCompanyType(companyType);

    const safeCompanyName =
      (company.companyName || "unnamed").replace(/[^\w\- ]+/g, "").trim() ||
      "unnamed";

    const folderPath = `nomads/${pathCompanyType}/${company.companyCountry}/${safeCompanyName}`;

    if (req.files?.length > 0) {
      const imageFiles = req.files.filter((f) => f.fieldname === "images");

      if (imageFiles.length > 0) {
        const startIndex = listingData.images.length;

        const sanitizeFileName = (name) =>
          String(name || "file")
            .replace(/[/\\?%*:|"<>]/g, "_")
            .replace(/\s+/g, "_");

        const results = await Promise.allSettled(
          imageFiles.map((file, i) => {
            const uniqueKey = `${folderPath}/images/${sanitizeFileName(
              file.originalname,
            )}`;
            return uploadFileToS3(uniqueKey, file).then((data) => ({
              url: data.url,
              id: data.id,
              index: startIndex + i + 1,
            }));
          }),
        );

        const successes = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        listingData.images.push(...successes);
      }
    }

    try {
      const response = await axios.post(
        "https://wononomadsbe.vercel.app/api/company/create-company",
        listingData,
      );

      if (response.status !== 201) {
        return res.status(400).json({ message: "Failed to add listing" });
      }
    } catch (err) {
      console.error("Upstream API failed:", err.response?.data || err.message);
      throw err;
    }

    return res
      .status(201)
      .json({ message: "Listing added successfully", data: listingData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// const editCompanyListing = async (req, res) => {
//   try {
//     const payload = req.body.data ? JSON.parse(req.body.data) : req.body;

//     const {
//       businessId,
//       companyType,
//       companyTitle,
//       companyId,
//       ratings,
//       totalReviews,
//       productName,
//       cost,
//       description,
//       latitude,
//       longitude,
//       inclusions,
//       about,
//       address,
//       reviews,
//       existingImages = [],
//     } = payload;

//     // const {
//     //   businessId,
//     //   companyType,
//     //companyTitle,
//     //companyId,
//     //   ratings,
//     //   totalReviews,
//     //   productName,
//     //   cost,
//     //   description,
//     //   latitude,
//     //   longitude,
//     //   inclusions,
//     //   about,
//     //   address,
//     //   reviews,
//     //   existingImages = [],
//     // } = req.body;

//     const parsedReviews =
//       typeof reviews === "string" ? JSON.parse(reviews) : reviews;

//     if (!companyId || !businessId || !companyType) {
//       return res.status(404).json({ message: "Missing required fields" });
//     }

//     // FIX: Search by both businessId and companyId
//     const company = await HostCompany.findOne({
//       companyId: req.body.companyId?.trim(),
//     });

//     if (!company) {
//       return res.status(404).json({ message: "Company not found" });
//     }

//     const updateData = {
//       businessId,
//       companyType,
//       ratings,
//       totalReviews,
//       companyName: company.companyName,
//       companyTitle: companyTitle ? companyTitle : company.companyName,
//       cost,
//       description,
//       latitude,
//       longitude,
//       inclusions,
//       about,
//       address,
//       reviews: parsedReviews,
//       images: [...existingImages], // Start with existing images
//     };

//     // ---------- IMAGE UPLOAD (NO DELETION HERE) ----------
//     const formatCompanyType = (type) => {
//       const map = {
//         hostel: "hostels",
//         privatestay: "private-stay",
//         meetingroom: "meetingroom",
//         coworking: "coworking",
//         cafe: "cafe",
//         coliving: "coliving",
//         workation: "workation",
//       };
//       return map[String(type).toLowerCase()] || "unknown";
//     };

//     const pathCompanyType = formatCompanyType(companyType);
//     const safeCompanyName =
//       (company.companyName || "unnamed").replace(/[^\w\- ]+/g, "").trim() ||
//       "unnamed";
//     const folderPath = `nomads/${pathCompanyType}/${company.companyCountry}/${safeCompanyName}`;

//     if (req.files?.length) {
//       const imageFiles = req.files.filter((f) => f.fieldname === "images");
//       if (imageFiles.length) {
//         const sanitize = (name) =>
//           String(name || "file")
//             .replace(/[/\\?%*:|"<>]/g, "_")
//             .replace(/\s+/g, "_");

//         const results = await Promise.allSettled(
//           imageFiles.map(async (file) => {
//             const key = `${folderPath}/images/${sanitize(file.originalname)}`;
//             const data = await uploadFileToS3(key, file);
//             return { url: data.url, id: data.id };
//           }),
//         );

//         const uploaded = results
//           .filter((r) => r.status === "fulfilled")
//           .map((r) => r.value);
//         updateData.images.push(...uploaded);
//       }
//     }

//     // ---------- REMOTE UPDATE (NO DELETION YET) ----------
//     try {
//       const response = await axios.patch(
//         "https://wononomadsbe.vercel.app/api/company/update-company",
//         updateData,
//       );
//     } catch (err) {
//       console.error(
//         "❌ Remote update failed:",
//         err.response?.data || err.message,
//       );

//       // If remote update fails, delete the newly uploaded images to maintain consistency
//       if (req.files?.length) {
//         const imageFiles = req.files.filter((f) => f.fieldname === "images");
//         if (imageFiles.length) {
//           console.log(
//             "🧹 Cleaning up newly uploaded images due to remote failure...",
//           );
//           const newlyUploadedUrls = updateData.images.slice(
//             existingImages.length,
//           );
//           await Promise.allSettled(
//             newlyUploadedUrls.map((img) => deleteFileFromS3ByUrl(img.url)),
//           );
//         }
//       }

//       return res.status(err.response?.status || 500).json({
//         message: "Remote company update failed",
//         detail: err.response?.data || err.message,
//       });
//     }

//     return res.status(200).json({
//       message: "Listing updated successfully",
//       data: updateData,
//     });
//   } catch (error) {
//     console.error("❌ Internal error:", error);
//     return res.status(500).json({
//       message: "Internal server error",
//       detail: error.message,
//     });
//   }
// };

const editCompanyListing = async (req, res) => {
  try {
    const payload = req.body.data ? JSON.parse(req.body.data) : req.body;

    const {
      businessId,
      companyId,
      companyType,
      companyTitle,
      ratings,
      totalReviews,
      productName,
      cost,
      description,
      latitude,
      longitude,
      inclusions,
      about,
      address,
      reviews,
      existingImages = [],
    } = payload;

    // const {
    //   businessId,
    //   companyId,
    //   companyTitle,
    //   companyType,
    //   ratings,
    //   totalReviews,
    //   productName,
    //   cost,
    //   description,
    //   latitude,
    //   longitude,
    //   inclusions,
    //   about,
    //   address,
    //   reviews,
    //   existingImages = [],
    // } = req.body;

    console.log("listing hit🔥");

    if (!companyId || !businessId || !companyType) {
      return res.status(404).json({ message: "Missing required fields" });
    }

    const parsedReviews =
      typeof reviews === "string" ? JSON.parse(reviews) : reviews;

    // FIX: Search by both businessId and companyId
    const company = await HostCompany.findOne({
      companyId: companyId?.trim(),
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const allowedFields = {
      companyTitle,
      ratings,
      totalReviews,
      cost,
      description,
      latitude,
      longitude,
      inclusions,
      about,
      address,
      reviews: parsedReviews,
    };

    let updateData = {};
    Object.entries(allowedFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    updateData = {
      ...updateData,
      businessId,
      companyType,
      companyName: company.companyName,
      images: [...existingImages], // Start with existing images
    };

    // ---------- IMAGE UPLOAD (NO DELETION HERE) ----------
    const formatCompanyType = (type) => {
      const map = {
        hostel: "hostels",
        privatestay: "private-stay",
        meetingroom: "meetingroom",
        coworking: "coworking",
        cafe: "cafe",
        coliving: "coliving",
        workation: "workation",
      };
      return map[String(type).toLowerCase()] || "unknown";
    };

    const pathCompanyType = formatCompanyType(companyType);
    const safeCompanyName =
      (company.companyName || "unnamed").replace(/[^\w\- ]+/g, "").trim() ||
      "unnamed";

    const folderPath = `nomads/${pathCompanyType}/${company.companyCountry}/${safeCompanyName}`;

    if (req.files?.length) {
      const imageFiles = req.files.filter((f) => f.fieldname === "images");

      const totalImages = imageFiles.length + existingImages.length;
      if (totalImages > 10) {
        return res.status(400).json({ message: "Maximum 10 images allowed" });
      }

      if (imageFiles.length) {
        const sanitize = (name) =>
          String(name || "file")
            .replace(/[/\\?%*:|"<>]/g, "_")
            .replace(/\s+/g, "_");

        const results = await Promise.allSettled(
          imageFiles.map(async (file) => {
            const key = `${folderPath}/images/${sanitize(file.originalname)}`;
            const data = await uploadFileToS3(key, file);
            return { url: data.url, id: data.id };
          }),
        );

        const uploaded = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        updateData.images.push(...uploaded);

        console.log("✅ Total images after upload:", updateData.images.length);
      }
    }

    // ---------- REMOTE UPDATE (NO DELETION YET) ----------
    try {
      // const response = await axios.patch(
      //   "https://wononomadsbe.vercel.app/api/company/update-company",
      //   updateData,
      // );

      const response = await axios.patch(
        "http://localhost:3000/api/company/update-company",
        updateData,
      );
      console.log("✅ Remote update success:", response.data);
    } catch (err) {
      console.error(
        "❌ Remote update failed:",
        err.response?.data || err.message,
      );

      // If remote update fails, delete the newly uploaded images to maintain consistency
      if (req.files?.length) {
        const imageFiles = req.files.filter((f) => f.fieldname === "images");
        if (imageFiles.length) {
          console.log(
            "🧹 Cleaning up newly uploaded images due to remote failure...",
          );
          const newlyUploadedUrls = updateData.images.slice(
            existingImages.length,
          );
          await Promise.allSettled(
            newlyUploadedUrls.map((img) => deleteFileFromS3ByUrl(img.url)),
          );
        }
      }

      //Remote company update failed
      return res.status(err.response?.status || 500).json({
        message: err.response?.data.message || err.message,
      });
    }

    return res.status(200).json({
      message: "Listing updated successfully",
      data: updateData,
    });
  } catch (error) {
    console.error("❌ Internal error:", error);
    return res.status(500).json({
      message: "Internal server error",
      detail: error.message,
    });
  }
};

const getAllCompanyListings = async (req, res) => {
  try {
    const response = await axios.get(
      "https://wononomadsbe.vercel.app/api/company/companies",
    );

    if (!response.data) {
      return res.status(200).json([]);
    }

    return res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCompanyListings = async (req, res) => {
  try {
    const response = await axios.get(
      "https://wononomadsbe.vercel.app/api/company/companies",
    );

    if (!response.data) {
      return res.status(200).json([]);
    }

    return res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCompanyListings,
  getAllCompanyListings,
  createCompanyListing,
  editCompanyListing,
};
