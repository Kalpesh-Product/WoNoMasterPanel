const express = require("express");
const {
  getRecruitmentJobOpenings,
  getPublicRecruitmentJobOpenings,
  createRecruitmentJobOpening,
  updateRecruitmentJobOpening,
} = require("../controllers/recruitmentController");
const verifyJwt = require("../middlewares/verifyJwt");

const router = express.Router();

router.get("/jobs/public", getPublicRecruitmentJobOpenings);
router.get("/jobs", verifyJwt, getRecruitmentJobOpenings);
router.post("/jobs", verifyJwt, createRecruitmentJobOpening);
router.patch("/jobs/:jobCode", verifyJwt, updateRecruitmentJobOpening);

module.exports = router;
