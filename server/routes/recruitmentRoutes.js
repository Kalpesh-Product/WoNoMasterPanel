const express = require("express");
const {
  getRecruitmentJobOpenings,
  getPublicRecruitmentJobOpenings,
  getRecruitmentCandidates,
  createRecruitmentJobOpening,
  updateRecruitmentJobOpening,
  applyRecruitmentJob,
} = require("../controllers/recruitmentController");
const upload = require("../config/multerConfig");
const verifyJwt = require("../middlewares/verifyJwt");

const { setLogModule } = require("../middlewares/logContext");

const router = express.Router();

router.use(setLogModule("Careers"));

router.get("/jobs/public", getPublicRecruitmentJobOpenings);
router.post(
  "/jobs/apply",
  upload.single("resumeFile"),
  applyRecruitmentJob,
);
router.get("/jobs", verifyJwt, getRecruitmentJobOpenings);
router.get("/candidates", verifyJwt, getRecruitmentCandidates);
router.post("/jobs", verifyJwt, createRecruitmentJobOpening);
router.patch("/jobs/:jobCode", verifyJwt, updateRecruitmentJobOpening);

module.exports = router;
