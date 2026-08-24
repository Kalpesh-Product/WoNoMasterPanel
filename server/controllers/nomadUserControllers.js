const axios = require("axios");
const ExcelJS = require("exceljs");

const NOMADS_BASE_URL = String(
  process.env.NOMADS_BASE_URL || "http://localhost:3000/api",
).replace(/\/+$/, "");

// Internal admin surface on the Nomads backend, gated by a shared secret
// (not a per-user JWT) since these requests come from this server, not a
// signed-in Nomad app user. See D:\Nomads\backend\middlewares\verifyAdminApiKey.js.
const nomadsAdminClient = axios.create({
  baseURL: `${NOMADS_BASE_URL}/admin/nomad-users`,
  headers: { "x-admin-api-key": process.env.NOMADS_ADMIN_API_KEY },
  timeout: 15000,
});

const forwardNomadsError = (res, error, fallbackMessage) => {
  const status = error.response?.status || 502;
  const message = error.response?.data?.message || fallbackMessage;
  return res.status(status).json({ message });
};

const getNomadUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const response = await nomadsAdminClient.get("/", { params: { search } });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch nomad users");
  }
};

const getPopularDestinations = async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const response = await nomadsAdminClient.get("/popular-destinations", {
      params: { from, to, limit },
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch popular destinations");
  }
};

const getDestinationListingAnalytics = async (req, res) => {
  try {
    const { country, state, title, continent, from, to, limit, viewMode } = req.query;
    const response = await nomadsAdminClient.get("/popular-destinations/listings", {
      params: { country, state, title, continent, from, to, limit, viewMode },
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch destination listing analytics");
  }
};

const getDestinationUsers = async (req, res) => {
  try {
    const { country, state, title, continent, from, to, limit } = req.query;
    const response = await nomadsAdminClient.get("/popular-destinations/users", {
      params: { country, state, title, continent, from, to, limit },
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch destination users");
  }
};

// Where do Nomads visitors come from? Groups destination clicks by IP and
// resolves public IPs to country/city on the Nomads backend (cached there).
const getDestinationLocationBreakdown = async (req, res) => {
  try {
    const { from, to } = req.query;
    const response = await nomadsAdminClient.get("/popular-destinations/locations", {
      params: { from, to },
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch visitor location breakdown");
  }
};

// Every per-user sub-resource (destination views, listing views, session
// logs) is fetched the same way — factor the shared shape once instead of
// repeating it per endpoint.
const paginatedUserHistory = (endpointSuffix) => async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, from, to } = req.query;
    const response = await nomadsAdminClient.get(`/${userId}/${endpointSuffix}`, {
      params: { page, limit, from, to },
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardNomadsError(res, error, "Failed to fetch user activity");
  }
};

const getNomadUserDestinationViews = paginatedUserHistory("destination-views");
const getNomadUserListingViews = paginatedUserHistory("listing-views");
const getNomadUserSessionLogs = paginatedUserHistory("sessions");

const formatExportDate = (value) => (value ? new Date(value).toLocaleString("en-US") : "");

const exportNomadUserActivity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;

    let payload;
    try {
      const response = await nomadsAdminClient.get(`/${userId}/export-data`, {
        params: { from, to },
      });
      payload = response.data;
    } catch (error) {
      return forwardNomadsError(res, error, "Failed to fetch user activity for export");
    }

    const { user, destinations = [], listings = [], sessions = [] } = payload;

    const workbook = new ExcelJS.Workbook();

    const destinationsSheet = workbook.addWorksheet("Destinations");
    destinationsSheet.columns = [
      { header: "Title", key: "title", width: 24 },
      { header: "State", key: "state", width: 18 },
      { header: "Country", key: "country", width: 18 },
      { header: "Continent", key: "continent", width: 16 },
      { header: "Viewed At", key: "createdAt", width: 22 },
    ];
    destinations.forEach((entry) =>
      destinationsSheet.addRow({
        title: entry.title || "",
        state: entry.state || "",
        country: entry.country || "",
        continent: entry.continent || "",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    const listingsSheet = workbook.addWorksheet("Listings");
    listingsSheet.columns = [
      { header: "Company Name", key: "companyName", width: 28 },
      { header: "City", key: "city", width: 18 },
      { header: "State", key: "state", width: 18 },
      { header: "Country", key: "country", width: 18 },
      { header: "Continent", key: "continent", width: 16 },
      { header: "Viewed At", key: "createdAt", width: 22 },
    ];
    listings.forEach((entry) =>
      listingsSheet.addRow({
        companyName: entry.companyName || "",
        city: entry.city || "",
        state: entry.state || "",
        country: entry.country || "",
        continent: entry.continent || "",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    const sessionsSheet = workbook.addWorksheet("Sign In-Out");
    sessionsSheet.columns = [
      { header: "Event", key: "event", width: 14 },
      { header: "Date & Time", key: "createdAt", width: 22 },
    ];
    sessions.forEach((entry) =>
      sessionsSheet.addRow({
        event: entry.event === "login" ? "Signed In" : "Signed Out",
        createdAt: formatExportDate(entry.createdAt),
      }),
    );

    [destinationsSheet, listingsSheet, sessionsSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
    });

    const userLabel =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.email ||
      userId;
    const safeFileName = String(userLabel).trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "nomad-user";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nomad-activity-${safeFileName}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNomadUsers,
  getPopularDestinations,
  getDestinationListingAnalytics,
  getDestinationUsers,
  getDestinationLocationBreakdown,
  getNomadUserDestinationViews,
  getNomadUserListingViews,
  getNomadUserSessionLogs,
  exportNomadUserActivity,
};
