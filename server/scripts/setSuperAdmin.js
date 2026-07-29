// One-off bootstrap script: grant isSuperAdmin to an AdminUser by email.
// Usage: node server/scripts/setSuperAdmin.js someone@example.com
require("dotenv").config();
const mongoose = require("mongoose");
const connectDb = require("../config/db");
const AdminUser = require("../models/AdminUser");

const run = async () => {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node server/scripts/setSuperAdmin.js <email>");
    process.exit(1);
  }

  await connectDb(process.env.DB_URL);

  const user = await AdminUser.findOneAndUpdate(
    { email },
    { isSuperAdmin: true },
    { new: true }
  )
    .select("-password -refreshToken")
    .lean();

  if (!user) {
    console.error(`No AdminUser found with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`isSuperAdmin=true set for ${user.email} (${user._id})`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
