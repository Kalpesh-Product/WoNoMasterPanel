// Builds the field-level change list saved in the logs table for website
// builder actions. Every template field is mapped to the site page + section
// it renders on, so a log entry can answer "who edited what, where".

const MAX_VALUE_LENGTH = 300;

// field -> { page, section } of the generated website
const FIELD_MAP = {
  // Home page
  title: { page: "Home", section: "Hero" },
  subTitle: { page: "Home", section: "Hero" },
  CTAButtonText: { page: "Home", section: "Hero" },
  heroVariant: { page: "Home", section: "Hero" },
  heroImages: { page: "Home", section: "Hero" },
  companyLogo: { page: "Home", section: "Header" },
  logoCarousel: { page: "Home", section: "Logo Carousel" },
  testimonialsHomePreviewCount: { page: "Home", section: "Testimonials" },

  // About page
  about: { page: "About", section: "About" },
  aboutPageIntro: { page: "About", section: "Intro" },
  aboutPageOverview: { page: "About", section: "Overview" },
  aboutPageStory: { page: "About", section: "Story" },
  aboutPageMission: { page: "About", section: "Mission" },
  aboutPageVision: { page: "About", section: "Vision" },
  aboutPageValues: { page: "About", section: "Values" },
  aboutPageTeamHeading: { page: "About", section: "Team" },
  aboutPageImages: { page: "About", section: "Images" },
  aboutPageImageCards: { page: "About", section: "Image Cards" },
  founders: { page: "About", section: "Founders" },

  // Products page (name varies by vertical: rooms, menu, packages, dorms…)
  productTitle: { page: "Products", section: "Products" },
  products: { page: "Products", section: "Products" },
  productDropdownPages: { page: "Products", section: "Product Pages" },
  inclusions: { page: "Products", section: "Inclusions" },
  rooms: { page: "Products", section: "Rooms" },
  meetingRooms: { page: "Products", section: "Meeting Rooms" },
  coLivingRooms: { page: "Products", section: "Co-Living Rooms" },
  packages: { page: "Products", section: "Packages" },
  dorms: { page: "Products", section: "Dorms" },
  menuItems: { page: "Products", section: "Menu" },

  // Gallery
  galleryTitle: { page: "Gallery", section: "Gallery" },
  galleryPageHeading: { page: "Gallery", section: "Gallery" },
  gallery: { page: "Gallery", section: "Gallery" },

  // Testimonials
  testimonialTitle: { page: "Testimonials", section: "Testimonials" },
  testimonials: { page: "Testimonials", section: "Testimonials" },
  testimonialsPageHeading: { page: "Testimonials", section: "Heading" },
  testimonialsPageIntro: { page: "Testimonials", section: "Intro" },
  testimonialsEnableWriteReview: { page: "Testimonials", section: "Write Review" },
  testimonialsSuccessMessage: { page: "Testimonials", section: "Write Review" },

  // Contact page
  contactTitle: { page: "Contact", section: "Contact" },
  contactPageHeading: { page: "Contact", section: "Heading" },
  contactPageIntro: { page: "Contact", section: "Intro" },
  contactEnableInquiryForm: { page: "Contact", section: "Inquiry Form" },
  contactInquirySuccessMessage: { page: "Contact", section: "Inquiry Form" },
  contactBusinessHours: { page: "Contact", section: "Business Hours" },
  contactPersonName: { page: "Contact", section: "Contact Person" },
  contactPersonRole: { page: "Contact", section: "Contact Person" },
  contactPersonEmail: { page: "Contact", section: "Contact Person" },
  contactPersonPhone: { page: "Contact", section: "Contact Person" },
  mapUrl: { page: "Contact", section: "Map" },
  email: { page: "Contact", section: "Contact Details" },
  phone: { page: "Contact", section: "Contact Details" },
  address: { page: "Contact", section: "Contact Details" },

  // Careers page
  careersPageHeading: { page: "Careers", section: "Hero" },
  careersPageIntro: { page: "Careers", section: "Hero" },
  careersHeroButtonText: { page: "Careers", section: "Hero" },
  careersHeroImage: { page: "Careers", section: "Hero" },
  careersClosingHeading: { page: "Careers", section: "Closing" },
  careersClosingText: { page: "Careers", section: "Closing" },
  careersApplyButtonText: { page: "Careers", section: "Apply" },
  careersApplyButtonLink: { page: "Careers", section: "Apply" },
  careersFormFields: { page: "Careers", section: "Application Form" },

  // Partner page
  partnerPageHeading: { page: "Partner", section: "Heading" },
  partnerPageContent: { page: "Partner", section: "Content" },
  partnerFormTitle: { page: "Partner", section: "Form" },

  // Footer / site-wide
  companyName: { page: "All Pages", section: "Footer" },
  registeredCompanyName: { page: "All Pages", section: "Footer" },
  copyrightText: { page: "All Pages", section: "Footer" },
  socials: { page: "All Pages", section: "Footer" },
  themeVariant: { page: "All Pages", section: "Theme" },
  styleConfig: { page: "All Pages", section: "Theme" },
  enabledSections: { page: "All Pages", section: "Layout" },
  sectionOverrides: { page: "All Pages", section: "Layout" },
  pageNavItems: { page: "All Pages", section: "Navigation" },
  faqs: { page: "All Pages", section: "FAQs" },
};

const SCALAR_FIELDS = Object.keys(FIELD_MAP).filter(
  (key) =>
    ![
      "heroImages",
      "gallery",
      "aboutPageImages",
      "companyLogo",
      "careersHeroImage",
      "products",
      "testimonials",
    ].includes(key),
);

const IMAGE_LIST_FIELDS = ["heroImages", "gallery", "aboutPageImages"];
const SINGLE_IMAGE_FIELDS = ["companyLogo", "careersHeroImage"];

const truncate = (value) => {
  const str = String(value);
  return str.length > MAX_VALUE_LENGTH
    ? `${str.slice(0, MAX_VALUE_LENGTH)}…`
    : str;
};

const toComparable = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const imageName = (img) => {
  const url = String(img?.url || "");
  const name = url.split("/").pop() || url;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

const locate = (field) => FIELD_MAP[field] || { page: "General", section: field };

// locateField: compound fields like "products.Hot Desk.cost" resolve their
// page/section from the parent collection field ("products").
const makeChange = (field, type, change, from, to, locateField = field) => ({
  ...locate(locateField),
  field,
  type,
  change,
  ...(from !== undefined ? { from: truncate(from) } : {}),
  ...(to !== undefined ? { to: truncate(to) } : {}),
});

const diffImageList = (
  field,
  beforeList = [],
  afterList = [],
  changes,
  locateField = field,
) => {
  const beforeIds = new Map(
    (beforeList || []).map((img) => [String(img?.id), img]),
  );
  const afterIds = new Map(
    (afterList || []).map((img) => [String(img?.id), img]),
  );

  const added = (afterList || []).filter(
    (img) => !beforeIds.has(String(img?.id)),
  );
  const removed = (beforeList || []).filter(
    (img) => !afterIds.has(String(img?.id)),
  );

  if (added.length) {
    changes.push(
      makeChange(
        field,
        "image",
        "added",
        undefined,
        added.map(imageName).join(", "),
        locateField,
      ),
    );
  }
  if (removed.length) {
    changes.push(
      makeChange(
        field,
        "image",
        "removed",
        removed.map(imageName).join(", "),
        undefined,
        locateField,
      ),
    );
  }
};

const diffItemCollection = (field, beforeList = [], afterList = [], options) => {
  const { nameOf, textFields, changes } = options;
  const beforeById = new Map(
    (beforeList || [])
      .filter((item) => item?._id)
      .map((item) => [String(item._id), item]),
  );
  const afterIds = new Set(
    (afterList || []).map((item) => String(item?._id)).filter(Boolean),
  );

  for (const item of afterList || []) {
    const before = item?._id ? beforeById.get(String(item._id)) : null;
    if (!before) {
      changes.push(
        makeChange(field, "item", "added", undefined, nameOf(item)),
      );
      continue;
    }

    for (const sub of textFields) {
      const from = toComparable(before[sub]);
      const to = toComparable(item[sub]);
      if (from !== to) {
        changes.push(
          makeChange(
            `${field}.${nameOf(item)}.${sub}`,
            "text",
            "edited",
            from,
            to,
            field,
          ),
        );
      }
    }

    const beforeImages = Array.isArray(before.images)
      ? before.images
      : before.image
        ? [before.image]
        : [];
    const afterImages = Array.isArray(item.images)
      ? item.images
      : item.image
        ? [item.image]
        : [];
    diffImageList(
      `${field}.${nameOf(item)}`,
      beforeImages,
      afterImages,
      changes,
      field,
    );
  }

  for (const item of beforeList || []) {
    if (item?._id && !afterIds.has(String(item._id))) {
      changes.push(
        makeChange(field, "item", "removed", nameOf(item), undefined),
      );
    }
  }
};

// Compares two plain snapshots of a website template (use .toObject() for
// mongoose docs) and returns the change list for the log entry.
const diffWebsiteTemplate = (before = {}, after = {}) => {
  const changes = [];

  for (const field of SCALAR_FIELDS) {
    const from = toComparable(before[field]);
    const to = toComparable(after[field]);
    if (from !== to) {
      changes.push(makeChange(field, "text", "edited", from, to));
    }
  }

  for (const field of SINGLE_IMAGE_FIELDS) {
    const fromId = String(before[field]?.id || "");
    const toId = String(after[field]?.id || "");
    if (fromId !== toId) {
      changes.push(
        makeChange(
          field,
          "image",
          toId ? (fromId ? "replaced" : "added") : "removed",
          fromId ? imageName(before[field]) : undefined,
          toId ? imageName(after[field]) : undefined,
        ),
      );
    }
  }

  for (const field of IMAGE_LIST_FIELDS) {
    diffImageList(field, before[field], after[field], changes);
  }

  diffItemCollection("products", before.products, after.products, {
    nameOf: (p) => String(p?.name || "Unnamed product"),
    textFields: ["type", "name", "cost", "description"],
    changes,
  });

  diffItemCollection("testimonials", before.testimonials, after.testimonials, {
    nameOf: (t) => String(t?.name || "Unnamed testimonial"),
    textFields: ["name", "jobPosition", "testimony", "rating"],
    changes,
  });

  return changes;
};

// Pages touched by a change list, for the log's summary "page" column.
const pagesFromChanges = (changes = []) => {
  const pages = [...new Set(changes.map((c) => c.page).filter(Boolean))];
  return pages.join(", ");
};

module.exports = { diffWebsiteTemplate, pagesFromChanges };
