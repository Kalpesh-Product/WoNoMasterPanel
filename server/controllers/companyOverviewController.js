const HostCompany = require("../models/hostCompany/hostCompany");

const groupLocation = (field) => [
  {
    $project: {
      label: { $trim: { input: { $ifNull: [`$${field}`, ""] } } },
    },
  },
  { $group: { _id: { $toLower: "$label" }, label: { $first: "$label" }, value: { $sum: 1 } } },
  { $project: { _id: 0, label: { $cond: [{ $eq: ["$_id", ""] }, "Unknown", "$label"] }, value: 1 } },
  { $sort: { value: -1, label: 1 } },
];

const getCompanyOverview = async (req, res, next) => {
  try {
    const [overview] = await HostCompany.aggregate([
      {
        $facet: {
          status: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ["$isRegistered", true] }, 1, 0] } },
                inactive: { $sum: { $cond: [{ $eq: ["$isRegistered", false] }, 1, 0] } },
              },
            },
          ],
          cities: groupLocation("companyCity"),
          continents: groupLocation("companyContinent"),
          countries: groupLocation("companyCountry"),
        },
      },
    ]);

    const total = overview.status[0]?.total || 0;
    const active = overview.status[0]?.active || 0;
    res.json({
      counts: {
        total,
        active,
        inactive: overview.status[0]?.inactive || 0,
        countries: overview.countries.filter((row) => row.label !== "Unknown").length,
      },
      cities: overview.cities,
      continents: overview.continents,
      countries: overview.countries,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCompanyOverview };
