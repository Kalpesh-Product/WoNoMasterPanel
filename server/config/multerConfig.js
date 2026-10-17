const multer = require("multer");

const storage = multer.memoryStorage();
// const upload = multer({ storage });

//Multer config for most type of files
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
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

//Multer config for website file uploads
const createImageUpload = (maxFileSize) => multer({
  storage,
  limits: {
    fileSize: maxFileSize,
    fieldSize: 10 * 1024 * 1024, // draftData JSON can exceed multer's 1MB default
  },
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
module.exports.uploadImages = createImageUpload(30 * 1024 * 1024);
module.exports.uploadContentImages = createImageUpload(15 * 1024 * 1024);
