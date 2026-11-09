require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const sharp = require("sharp");
const connectDb = require("../config/db");
const { uploadFileToS3, deleteFileFromS3ByUrl } = require("../config/s3config");
const WebsiteThemeCatalog = require("../models/website/WebsiteThemeCatalog");

const assetsDirectory = process.argv[2];
const refreshScreenshots = process.argv.includes("--refresh-screenshots");
if (!assetsDirectory) {
  throw new Error("Pass the directory containing the Nomads theme screenshots");
}

const themes = [
  { templateId: "savor", name: "Savor", vertical: "cafe", description: "Photo-first and menu-led — category browsing, filters and a built-in reservation flow. Made for cafés, works for any service.", swatch: { bg: "#fff7ed", fg: "#2a1a12", accent: "#e4572e", font: "'Bricolage Grotesque', sans-serif" } },
  { templateId: "wayfarer", name: "Wayfarer", vertical: "hostel", description: "Booking-led — a search bar in the hero, results-style stay lists with filters and a sticky booking card. Made for hostels, works for any service.", swatch: { bg: "#f3fbfa", fg: "#0c2a2e", accent: "#f26b3a", font: "'Sora', sans-serif" } },
  { templateId: "haven", name: "Haven", vertical: "co-living", description: "Residence-led — arch-framed photos, room cards with a side-by-side compare view and a visit form on the home page. Made for co-living and workation stays, works for any service.", swatch: { bg: "#f4f1ea", fg: "#26312b", accent: "#5b7f6a", font: "'Fraunces', Georgia, serif" } },
  { templateId: "camelia", name: "Camelia", vertical: "co-living", description: "Boutique-resort style — a plain top bar, a full-bleed hero and a bold geometric sans paired with a light editorial serif. Made for co-living and workation stays, works for any service.", swatch: { bg: "#f6f3ec", fg: "#2b2a26", accent: "#8a9a86", font: "'Poppins', ui-sans-serif, sans-serif" } },
  { templateId: "commons", name: "Commons", vertical: "co-working", description: "Co-working style — a bold headline over a bento grid, an interactive space explorer and a visit form on the home page. Made for co-working, works for any service.", swatch: { bg: "#f6f7f9", fg: "#0b1f3a", accent: "#ffc21a", font: "'Plus Jakarta Sans', sans-serif" } },
  { templateId: "huddle", name: "Huddle", vertical: "meeting-rooms", description: "Booking-led — a date, time and duration panel on the home page that filters the rooms, room rows with hourly rates and a rate table. Made for meeting rooms, works for any service.", swatch: { bg: "#f5f6f8", fg: "#14161a", accent: "#3b6cf0", font: "'Sora', sans-serif" } },
  { templateId: "travigo", name: "Travigo", vertical: "hostel", description: "Editorial travel style — oversized typography, circular destination photography, room-led browsing and direct hostel booking.", swatch: { bg: "#f5f3ed", fg: "#111111", accent: "#d8ff48", font: "'Manrope', sans-serif" } },
  { templateId: "tulum", name: "Tulum", vertical: "co-living", description: "Quiet editorial co-living style: a full-bleed video hero with a nightly price, serif headings, sage bands, unit rows and pricing cards. Made for co-living and workation stays, works for any service.", swatch: { bg: "#f1f1ed", fg: "#4f5a53", accent: "#8a968f", font: "'Cormorant Upright', serif" } },
  { templateId: "grindelwald", name: "Grindelwald", vertical: "co-living", description: "Forest-retreat style: a deep green hero with a round photo and dashed neon rings, a pale intro with stats, a parallax photo, room cards, a photo slider and a closing band. Made for co-living and cabin stays, works for any service.", swatch: { bg: "#f8f8f8", fg: "#1b3936", accent: "#75ff69", font: "'Bodoni Moda', serif" } },
  { templateId: "biznest", name: "Biznest", vertical: "co-working", description: "The original WoNo layout — clean, spacious, corporate. A real, live co-working/workation site, not a seeded demo.", swatch: { bg: "#e9e9e9", fg: "#1f1f1f", accent: "#3b82f6", font: "'Poppins', sans-serif" }, externalDemoUrl: "https://biznest.wono.co" },
];

const upload = async (theme, type) => {
  const mobile = type === "mobile";
  const source = path.join(assetsDirectory, `${theme.templateId}-hero${mobile ? "-mobile" : ""}.jpg`);
  if (!fs.existsSync(source)) throw new Error(`Missing screenshot: ${source}`);
  const image = sharp(source).rotate();
  const resized = mobile
    ? image.resize({ width: 750 })
    : image.resize(1600, 1000, { fit: "cover", position: "north" });
  const { data: buffer, info } = await resized
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const key = `website-theme-catalog/${theme.templateId}/${type}-seed-${Date.now()}.webp`;
  const result = await uploadFileToS3(key, { buffer, mimetype: "image/webp" });
  return { id: result.id, url: result.url, width: info.width, height: info.height, format: "webp" };
};

const run = async () => {
  await connectDb(process.env.DB_URL);
  for (const [index, theme] of themes.entries()) {
    const existing = await WebsiteThemeCatalog.findOne({ templateId: theme.templateId }).lean();
    const desktopScreenshot = existing?.desktopScreenshot?.url && !refreshScreenshots
      ? existing.desktopScreenshot
      : await upload(theme, "desktop");
    const mobileScreenshot = existing?.mobileScreenshot?.url && !refreshScreenshots
      ? existing.mobileScreenshot
      : await upload(theme, "mobile");
    await WebsiteThemeCatalog.findOneAndUpdate(
      { templateId: theme.templateId },
      {
        $set: {
          ...theme,
          desktopScreenshot,
          mobileScreenshot,
          enabled: true,
          visible: true,
          featured: index === 0,
          sortOrder: (index + 1) * 10,
          disabledReason: "Coming soon",
          updatedBy: "local-seed",
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (refreshScreenshots) {
      await Promise.all([
        existing?.desktopScreenshot?.url,
        existing?.mobileScreenshot?.url,
      ].filter(Boolean).map((url) => deleteFileFromS3ByUrl(url)));
    }
    console.log(`Seeded ${theme.templateId}`);
  }
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
