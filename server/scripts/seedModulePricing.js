/**
 * One-off seed: populates the ModulePricing collection with starting rows
 * for every Custom-plan add-on (modules not already included free at
 * Professional) plus a handful of department bundles, so staff have
 * something to open and edit in Master Panel's Plan Pricing settings page
 * instead of an empty list. These are STARTING values only — actual prices
 * are edited by staff afterwards and are never hardcoded in code.
 *
 * Idempotent — upserts by itemId, safe to re-run (re-running does not
 * overwrite a price staff already edited unless you pass --force).
 *
 * Run with:
 *   node scripts/seedModulePricing.js [--force]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ModulePricing = require("../models/hostCompany/ModulePricing");
const PlanPricingSettings = require("../models/hostCompany/PlanPricingSettings");

const MONGO_URL = process.env.DB_URL || process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error("DB_URL is not set in the environment.");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");

const SEED_MODULES = [
  { itemId: "attendance", label: "Attendance", priceUsd: 15 },
  { itemId: "tasks", label: "Tasks", priceUsd: 15 },
  { itemId: "leave-requests", label: "Leave Requests", priceUsd: 15 },
  { itemId: "assets", label: "Assets", priceUsd: 20 },
  { itemId: "inventory", label: "Inventory", priceUsd: 20 },
  { itemId: "finance-management", label: "Finance Management", priceUsd: 40 },
  { itemId: "team-management", label: "Team Management", priceUsd: 20 },
  { itemId: "reports", label: "Reports", priceUsd: 20 },
];

const SEED_DEPARTMENTS = [
  {
    itemId: "hr-department",
    label: "HR Department",
    priceUsd: 60,
    includesModuleIds: [
      "employee-management",
      "hr-documents",
      "recruitment",
      "leave-request-processing",
      "attendance-review",
      "payroll-management",
      "exit-management",
    ],
  },
  {
    itemId: "finance-department",
    label: "Finance Department",
    priceUsd: 60,
    includesModuleIds: ["finance-budget", "billing-payments", "accounting"],
  },
  {
    itemId: "maintenance-department",
    label: "Maintenance Department",
    priceUsd: 40,
    includesModuleIds: ["maintenance-repair-logs", "amc-maintenance-scheduler"],
  },
  {
    itemId: "it-department",
    label: "IT Department",
    priceUsd: 30,
    includesModuleIds: ["it-repair-logs"],
  },
];

const run = async () => {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB.");

  let created = 0;
  let skipped = 0;

  for (const row of SEED_MODULES) {
    const existing = await ModulePricing.findOne({ itemId: row.itemId });
    if (existing && !FORCE) {
      skipped += 1;
      continue;
    }
    await ModulePricing.findOneAndUpdate(
      { itemId: row.itemId },
      { $set: { itemType: "module", label: row.label, priceUsd: row.priceUsd, includesModuleIds: [] } },
      { upsert: true },
    );
    created += 1;
  }

  for (const row of SEED_DEPARTMENTS) {
    const existing = await ModulePricing.findOne({ itemId: row.itemId });
    if (existing && !FORCE) {
      skipped += 1;
      continue;
    }
    await ModulePricing.findOneAndUpdate(
      { itemId: row.itemId },
      {
        $set: {
          itemType: "department",
          label: row.label,
          priceUsd: row.priceUsd,
          includesModuleIds: row.includesModuleIds,
        },
      },
      { upsert: true },
    );
    created += 1;
  }

  const existingSettings = await PlanPricingSettings.findOne({ singletonKey: "default" });
  if (!existingSettings) {
    await PlanPricingSettings.create({ singletonKey: "default" });
    console.log(
      "Created default PlanPricingSettings (Professional $199/mo — Custom starts from this same price, no separate base).",
    );
  }

  console.log(`Seeded ${created} pricing row(s), skipped ${skipped} already-existing row(s).`);
  await mongoose.disconnect();
  console.log("Done.");
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
