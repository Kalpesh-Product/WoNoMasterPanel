const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    searchKey: { type: String, required: true, index: true },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedVersion: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    //hero
    companyLogo: {
      id: { type: String },
      url: { type: String },
    },
    companyName: { type: String, required: true },
    companyId: {
      type: String,
      // required: true
    },
    title: { type: String },
    subTitle: { type: String },
    CTAButtonText: { type: String },
    verticalType: { type: String },
    heroVariant: { type: String },
    themeVariant: { type: String },
    enabledSections: [{ type: String }],
    sectionOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    styleConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    heroImages: [
      {
        id: { type: String },
        url: { type: String },
      },
    ],
    pageNavItems: [
      {
        name: { type: String },
        slug: { type: String },
        enabled: { type: Boolean, default: true },
        pageHeading: { type: String },
        pageIntro: { type: String },
        metaTitle: { type: String },
        metaDescription: { type: String },
      },
    ],
    productDropdownPages: [
      {
        name: { type: String },
        slug: { type: String },
        enabled: { type: Boolean, default: true },
        heroHeading: { type: String },
        heroSubHeading: { type: String },
        heroMode: { type: String },
        heroImage: {
          id: { type: String },
          url: { type: String },
        },
        heroImages: [
          {
            id: { type: String },
            url: { type: String },
          },
        ],
        heroButtonText: { type: String },
        homeCardHeading: { type: String },
        homeCardSubText: { type: String },
        homeCardImage: {
          id: { type: String },
          url: { type: String },
        },
        leadEnabled: { type: Boolean, default: true },
        leadFormLabel: { type: String },
      },
    ],
    aboutPageIntro: { type: String },
    aboutPageOverview: { type: String },
    aboutPageStory: { type: String },
    aboutPageMission: { type: String },
    aboutPageVision: { type: String },
    aboutPageValues: { type: String },
    aboutPageTeamHeading: { type: String },
    aboutPageImages: [
      {
        id: { type: String },
        url: { type: String },
      },
    ],
    aboutPageImageCards: [
      {
        title: { type: String },
        description: { type: String },
        image: {
          id: { type: String },
          url: { type: String },
        },
      },
    ],
    galleryPageHeading: { type: String },
    testimonialsPageHeading: { type: String },
    testimonialsPageIntro: { type: String },
    testimonialsHomePreviewCount: { type: Number, default: 3 },
    testimonialsEnableWriteReview: { type: Boolean, default: true },
    testimonialsSuccessMessage: { type: String },
    contactPageHeading: { type: String },
    contactPageIntro: { type: String },
    contactEnableInquiryForm: { type: Boolean, default: true },
    contactInquirySuccessMessage: { type: String },
    contactBusinessHours: { type: String },
    contactPersonName: { type: String },
    contactPersonRole: { type: String },
    contactPersonEmail: { type: String },
    contactPersonPhone: { type: String },
    //about
    about: [{ type: String }],
    //products
    productTitle: { type: String },
    products: [
      {
        type: { type: String },
        name: { type: String },
        cost: { type: String },
        description: { type: String },
        images: [
          {
            id: { type: String },
            url: { type: String },
          },
        ],
      },
    ],
    galleryTitle: { type: String },
    gallery: [
      {
        id: { type: String },
        url: { type: String },
      },
    ],
    //   //testimonials
    testimonialTitle: { type: String },
    testimonials: [
      {
        image: {
          id: { type: String },
          url: { type: String },
        },
        name: { type: String },
        jobPosition: { type: String },
        testimony: { type: String },
        rating: { type: Number },
      },
    ],
    // contact
    contactTitle: { type: String },
    mapUrl: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    //footer
    registeredCompanyName: { type: String },
    copyrightText: { type: String },
  },
  { timestamps: true }
);

const WebsiteTemplate = mongoose.model("WebsiteTemplate", templateSchema);
module.exports = WebsiteTemplate;
