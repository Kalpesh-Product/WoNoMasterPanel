const multer = require("multer");

const storage = multer.memoryStorage();
// const upload = multer({ storage });

//Although bulk upload images is limited to 10MB,
//30MB considers the website template payload as well
const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB
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

module.exports = upload;
