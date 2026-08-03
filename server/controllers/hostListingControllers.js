const { default: axios } = require("axios");
const HostCompany = require("../models/hostCompany/hostCompany");
const HostLeadCompany = require("../models/hostCompany/hostLeadCompany");
const { uploadFileToS3, deleteFileFromS3ByUrl } = require("../config/s3config");
const { getContinentForCountry } = require("../utils/countryContinent");

const normalizeReviews = (reviews) => {
  if (!Array.isArray(reviews)) return reviews;

  return reviews.map((review) => {
    const reviewText =
      review?.review ?? review?.description ?? review?.testimony ?? "";

    return {
      ...review,
      review: reviewText,
      description: review?.description ?? reviewText,
      starCount: Number(review?.starCount ?? review?.rating ?? 5),
    };
  });
};

const parseReviews = (reviews) => {
  if (typeof reviews === "string") {
    return normalizeReviews(JSON.parse(reviews));
  }

  return normalizeReviews(reviews);
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeLogo = (logo) => {
  if (!logo) return null;

  if (typeof logo === "string") {
    const url = logo.trim();
    return url ? { url, id: "" } : null;
  }

  if (typeof logo === "object") {
    const url = typeof logo.url === "string" ? logo.url.trim() : "";
    const id = typeof logo.id === "string" ? logo.id : "";
    return url ? { url, id } : null;
  }

  return null;
};

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }

  return "";
};

// `/api/company/companies` (the Nomads public site's own feed) only returns
// active listings and never inactive ones, so it can't be the source for an
// admin overview. The per-company `get-listings/:companyId` endpoint does
// return everything (public/private, active/inactive) — the first attempt
// at crawling it here hung the whole page because that endpoint queries
// Mongo by `companyId` with no index on that field (Company model, Nomads
// backend repo), turning every call into a full collection scan. Added the
// missing index there (`companySchema.index({ companyId: 1 })` in
// D:\Nomads\backend\models\Company.js) so each call is now fast, and kept a
// per-request timeout here as a safety net so one slow/broken company still
// can't freeze the whole crawl. Stale-while-revalidate + patch-in-place
// below keep this off the request path except on a cold cache.
const NOMAD_LISTINGS_CACHE_TTL_MS = 60 * 1000;
const NOMAD_LISTINGS_FETCH_CONCURRENCY = 40;
const NOMAD_LISTINGS_FETCH_TIMEOUT_MS = 4000;
let nomadListingsCache = { items: null, fetchedAt: 0 };
let nomadListingsRefreshPromise = null;

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
};

const fetchListingsForCompany = async (companyId) => {
  try {
    const response = await axios.get(
      `http://localhost:3000/api/company/get-listings/${encodeURIComponent(companyId)}`,
      { timeout: NOMAD_LISTINGS_FETCH_TIMEOUT_MS },
    );
    return { ok: true, items: Array.isArray(response.data) ? response.data : [] };
  } catch (error) {
    if (error?.response?.status === 404) {
      // No listings for this company yet — not a failure.
      return { ok: true, items: [] };
    }
    // No retry: a company that's genuinely slow/unreachable should fail
    // fast and get skipped, not double the wait for every bad company in
    // the crawl. With the companyId index in place, a healthy call should
    // resolve in well under a second — this timeout only exists to bound
    // the damage from one that isn't.
    console.error(
      `Failed to fetch Nomad listings for company ${companyId}:`,
      error?.response?.data || error.message,
    );
    return { ok: false, items: [] };
  }
};

const crawlAllNomadListings = async () => {
  const startedAt = Date.now();
  const [hostCompanies, hostLeadCompanies] = await Promise.all([
    HostCompany.find().select("companyId").lean(),
    HostLeadCompany.find().select("companyId").lean(),
  ]);

  const companyIds = Array.from(
    new Set(
      [...hostCompanies, ...hostLeadCompanies]
        .map((company) => String(company?.companyId || "").trim())
        .filter(Boolean),
    ),
  );

  const results = await mapWithConcurrency(
    companyIds,
    NOMAD_LISTINGS_FETCH_CONCURRENCY,
    (companyId) => fetchListingsForCompany(companyId),
  );

  const failedCount = results.filter((result) => !result.ok).length;
  const items = results.flatMap((result) => result.items);

  // Visible in the server console every time the cache refreshes — makes it
  // obvious if companies are being silently dropped from the crawl again.
  console.log(
    `Nomad listings crawl: ${companyIds.length} companies, ${failedCount} failed, ` +
      `${items.length} listings found, ${Date.now() - startedAt}ms`,
  );

  return items;
};

const refreshNomadListingsCache = () => {
  if (!nomadListingsRefreshPromise) {
    nomadListingsRefreshPromise = crawlAllNomadListings()
      .then((items) => {
        nomadListingsCache = { items, fetchedAt: Date.now() };
        return items;
      })
      .finally(() => {
        nomadListingsRefreshPromise = null;
      });
  }
  return nomadListingsRefreshPromise;
};

const fetchAllNomadListings = async () => {
  const isFresh =
    nomadListingsCache.items &&
    Date.now() - nomadListingsCache.fetchedAt < NOMAD_LISTINGS_CACHE_TTL_MS;
  if (isFresh) return nomadListingsCache.items;

  // Stale but present: hand back what we have and let the refresh happen
  // in the background rather than blocking this request on it.
  if (nomadListingsCache.items) {
    refreshNomadListingsCache().catch((error) => {
      console.error("Background Nomad listings refresh failed:", error.message);
    });
    return nomadListingsCache.items;
  }

  // Cold start — nothing cached yet, so this one request has to wait.
  return refreshNomadListingsCache();
};

// Cheap in-place update used right after a mutation so the next read
// reflects it immediately without paying for a full re-crawl.
const patchNomadListingsCache = (businessIds, patch) => {
  if (!nomadListingsCache.items || !businessIds?.length) return;
  const idSet = new Set(businessIds.filter(Boolean).map(String));
  if (!idSet.size) return;
  nomadListingsCache.items = nomadListingsCache.items.map((item) =>
    idSet.has(String(item.businessId)) ? { ...item, ...patch } : item,
  );
};

// Still exposed for anything that needs a hard reset (e.g. if the crawl
// itself turns out wrong) — normal mutations should prefer patching.
const invalidateNomadListingsCache = () => {
  nomadListingsCache = { items: null, fetchedAt: 0 };
};

const normalizeListingValue = (value) => String(value || "").trim().toLowerCase();
const normalizeListingTypeKey = (value) =>
  normalizeListingValue(value).replace(/[^a-z0-9]/g, "");

const summarizeListings = (items) =>
  items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.isActive) acc.active += 1;
      else acc.inactive += 1;
      if (item.isPublic) acc.public += 1;
      else acc.private += 1;
      return acc;
    },
    { total: 0, active: 0, inactive: 0, public: 0, private: 0 },
  );

const categorizeListings = (items) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = normalizeListingTypeKey(item.companyType) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};

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
      city,
      state,
      country,
      inclusions,
      about,
      address,
      reviews,
    } = req.body;

    const company =
      (await HostCompany.findOne({ companyId: companyId.trim() })) ||
      (await HostLeadCompany.findOne({ companyId: companyId.trim() }));

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    const parsedReviews = parseReviews(reviews);

    // Each listing has its own location — staff can add several locations
    // of the same product type in different cities — so prefer whatever the
    // form submitted, only falling back to the Host Company's registered
    // address when it was left blank.
    const resolvedCity = String(city || "").trim() || company.companyCity;
    const resolvedState = String(state || "").trim() || company.companyState;
    const resolvedCountry = String(country || "").trim() || company.companyCountry;
    // Nomads' Company schema requires `continent` — most Host Company
    // records don't have one on file, so fall back to deriving it from the
    // listing's own country.
    const resolvedContinent =
      company.companyContinent || getContinentForCountry(resolvedCountry);

    if (!resolvedContinent) {
      return res.status(400).json({
        message:
          "Could not determine continent for this listing — please check the selected country.",
      });
    }

    const listingData = {
      companyName: company.companyName,
      companyTitle: companyTitle ? companyTitle : company.companyName,
      companyId: company.companyId,
      city: resolvedCity,
      state: resolvedState,
      country: resolvedCountry,
      continent: resolvedContinent,
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

    const logo = normalizeLogo(company.logo);
    if (logo) listingData.logo = logo;

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

    const folderPath = `nomads/${pathCompanyType}/${resolvedCountry}/${safeCompanyName}`;

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
        "http://localhost:3000/api/company/create-company",
        listingData,
      );

      if (response.status !== 201) {
        return res.status(400).json({ message: "Failed to add listing" });
      }
    } catch (err) {
      console.error("Upstream API failed:", err.response?.data || err.message);
      throw err;
    }

    req.logContext = {
      ...(req.logContext || {}),
      action: "add-company-listing",
      companyName: company.companyName,
      companyId: company.companyId,
      changes: [
        {
          field: "listing",
          type: "item",
          change: "added",
          to: `${listingData.companyName || listingData.companyTitle} (${companyType})`,
        },
        ...(listingData.images.length
          ? [
              {
                field: "images",
                type: "image",
                change: "added",
                to: `${listingData.images.length} image(s)`,
              },
            ]
          : []),
      ],
    };

    return res
      .status(201)
      .json({ message: "Listing added successfully", data: listingData });
  } catch (error) {
    console.error("❌ createCompanyListing failed:", error);
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
//         "http://localhost:3000/api/company/update-company",
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

///// Edit listing Note /////

// Reviews
// News Reviews get added without deleting existing ones
// Existing reviews can be edited properly
// Avoid duplicate reviews

// Images
// New Image get's added without deleting existing ones
// Intended images get deleted from DB & S3

// Note: Should send review objects with review._id for the existing reviews to avoid deleting them similarly for images as well

const editCompanyListing = async (req, res) => {
  try {
    // const payload = req.body.data ? JSON.parse(req.body.data) : req.body;

    // const {
    //   businessId,
    //   companyId,
    //   companyType,
    //   companyTitle,
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
    // } = payload;

    const {
      businessId,
      companyId,
      companyTitle,
      companyName,
      companyType,
      ratings,
      totalReviews,
      productName,
      cost,
      description,
      latitude,
      longitude,
      city,
      state,
      country,
      inclusions,
      about,
      address,
      googleMap,
      reviews,
      existingImages = [],
    } = req.body;

    console.log("listing hit🔥");

    if (!companyId || !businessId || !companyType) {
      return res.status(404).json({ message: "Missing required fields" });
    }

    const parsedReviews = parseReviews(reviews);
    const parsedExistingImages = parseJsonArray(existingImages);

    // FIX: Search by both businessId and companyId
    const company =
      (await HostCompany.findOne({ companyId: companyId?.trim() })) ||
      (await HostLeadCompany.findOne({ companyId: companyId?.trim() }));

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const resolvedCompanyTitle = firstNonEmptyString(
      companyTitle,
      companyName,
      company.companyName,
    );

    const allowedFields = {
      companyTitle: resolvedCompanyTitle,
      ratings,
      totalReviews,
      cost,
      description,
      latitude,
      longitude,
      city,
      state,
      country,
      inclusions,
      about,
      address,
      googleMap,
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
      images: [...parsedExistingImages], // Start with existing images
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

      const totalImages = imageFiles.length + parsedExistingImages.length;
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
      const response = await axios.patch(
        "http://localhost:3000/api/company/update-company",
        updateData,
      );

      // const response = await axios.patch(
      //   "http://localhost:3000/api/company/update-company",
      //   updateData,
      // );
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
            parsedExistingImages.length,
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

    // The listing itself lives in the Nomads service, so log the fields this
    // edit submitted (new values) plus any images added.
    const editedFields = Object.entries(allowedFields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        field: key,
        type: "text",
        change: "edited",
        to:
          typeof value === "object"
            ? JSON.stringify(value).slice(0, 300)
            : String(value).slice(0, 300),
      }));
    const newImageCount = updateData.images.length - parsedExistingImages.length;
    req.logContext = {
      ...(req.logContext || {}),
      action: "edit-company-listing",
      companyName: company.companyName,
      companyId: company.companyId,
      changes: [
        ...editedFields,
        ...(newImageCount > 0
          ? [
              {
                field: "images",
                type: "image",
                change: "added",
                to: `${newImageCount} image(s)`,
              },
            ]
          : []),
      ],
    };

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
    const allItems = await fetchAllNomadListings();
    const { page } = req.query;

    // No `page` param: keep the original plain-array contract for any other
    // caller that still expects the full list in one shot.
    if (page === undefined) {
      return res.json(allItems);
    }

    const { limit, search, status, isPublic, type, country, state, city } = req.query;

    const trimmedCountry = normalizeListingValue(country);
    const trimmedState = normalizeListingValue(state);
    const trimmedCity = normalizeListingValue(city);

    let locationFiltered = allItems;
    if (trimmedCountry) {
      locationFiltered = locationFiltered.filter(
        (item) => normalizeListingValue(item.country) === trimmedCountry,
      );
    }
    if (trimmedState) {
      locationFiltered = locationFiltered.filter(
        (item) => normalizeListingValue(item.state) === trimmedState,
      );
    }
    if (trimmedCity) {
      locationFiltered = locationFiltered.filter(
        (item) => normalizeListingValue(item.city) === trimmedCity,
      );
    }

    let filtered = locationFiltered;
    if (status === "active") filtered = filtered.filter((item) => item.isActive);
    else if (status === "inactive") filtered = filtered.filter((item) => !item.isActive);

    if (isPublic === "true") filtered = filtered.filter((item) => item.isPublic);
    else if (isPublic === "false") filtered = filtered.filter((item) => !item.isPublic);

    const trimmedType = normalizeListingTypeKey(type);
    if (trimmedType && trimmedType !== "all") {
      filtered = filtered.filter(
        (item) => (normalizeListingTypeKey(item.companyType) || "unknown") === trimmedType,
      );
    }

    const trimmedSearch = normalizeListingValue(search);
    if (trimmedSearch) {
      filtered = filtered.filter((item) =>
        [item.companyName, item.companyTitle, item.companyType, item.city, item.state, item.country]
          .filter(Boolean)
          .some((value) => normalizeListingValue(value).includes(trimmedSearch)),
      );
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const total = filtered.length;
    const start = (pageNumber - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const countryOptions = Array.from(
      new Set(allItems.map((item) => item.country).filter(Boolean)),
    ).sort();
    const stateOptions = trimmedCountry
      ? Array.from(
          new Set(
            allItems
              .filter((item) => normalizeListingValue(item.country) === trimmedCountry)
              .map((item) => item.state)
              .filter(Boolean),
          ),
        ).sort()
      : [];
    const cityOptions =
      trimmedCountry && trimmedState
        ? Array.from(
            new Set(
              allItems
                .filter(
                  (item) =>
                    normalizeListingValue(item.country) === trimmedCountry &&
                    normalizeListingValue(item.state) === trimmedState,
                )
                .map((item) => item.city)
                .filter(Boolean),
            ),
          ).sort()
        : [];

    return res.json({
      items,
      page: pageNumber,
      limit: pageSize,
      total,
      hasMore: pageNumber * pageSize < total,
      globalCounts: summarizeListings(allItems),
      categoryCounts: categorizeListings(allItems),
      locationCounts:
        trimmedCountry && trimmedState ? summarizeListings(locationFiltered) : null,
      filterOptions: {
        countries: countryOptions,
        states: stateOptions,
        cities: cityOptions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCompanyListings = async (req, res) => {
  try {
    const items = await fetchAllNomadListings();
    return res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCompanyListings,
  getAllCompanyListings,
  createCompanyListing,
  editCompanyListing,
  invalidateNomadListingsCache,
  patchNomadListingsCache,
  fetchAllNomadListings,
};
