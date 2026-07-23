const { randomInt } = require("crypto");

const generateRegistrationId = () => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const uniquePart = String(randomInt(0, 99999)).padStart(5, "0");

  return `WN-REG-${datePart}-${uniquePart}`;
};

module.exports = { generateRegistrationId };
