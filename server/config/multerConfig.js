const multer = require("multer");

const storage = multer.memoryStorage();
// const upload = multer({ storage });

//Although bulk upload images is limited to 5MB,
//20MB considers the website template payload as well

//Multer config for any file uploads except bulk upload images
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },

  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp" ||
      file.mimetype === "text/csv" ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .jpeg, .png, and .webp files are allowed"), false);
    }
  },
});

//Multer config for bulk upload Images
const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  // limits: { fileSize: 2 * 1024 }, // 2 KB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp"
    ) {
      return cb(null, true);
    }
    cb(new Error("Only .jpeg, .png, and .webp images are allowed"), false);
  },
});

module.exports = upload;
module.exports.uploadImages = uploadImages;
