const { randomInt } = require("crypto");

const generateBookingId = (companyName) => {
  const companyCode = String(companyName || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");

  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const uniquePart = String(randomInt(0, 9999)).padStart(4, "0");

  return `WN-${companyCode}-${datePart}-${uniquePart}`;
};

module.exports = { generateBookingId };
