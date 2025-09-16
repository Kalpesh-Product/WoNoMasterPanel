const router = require("express").Router();
const {
  getEmployees,
  getEmployee,
} = require("../controllers/employeeControllers/employeeControllers");

router.get("/employees", getEmployees);
router.get("/employee", getEmployee);

module.exports = router;
