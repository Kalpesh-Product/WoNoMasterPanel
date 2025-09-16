const { default: Employee } = require("../../models/hostCompany/employees");

const getEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find();

    if (!employees || !employees.length) {
      return res.status(200).json([]);
    }

    return res.status(200).json(employees);
  } catch (error) {
    next(error);
  }
};

const getEmployee = async (req, res, next) => {
  try {
    const { companyId } = req.query;
    const employee = await Employee.findOne({ company: companyId });

    if (!employee || !employee.length) {
      return res.status(200).json([]);
    }

    return res.status(200).json(employee);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEmployees,
  getEmployee,
};
