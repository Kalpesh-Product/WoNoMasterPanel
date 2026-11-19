import React from "react";
import { Breadcrumbs, Typography, Link } from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const BreadCrumbComponent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyId: routeCompanyId } = useParams();
  const companyNameFromState = location.state?.companyName;
  const companyIdFromSession = String(sessionStorage.getItem("companyId") || "").trim();
  const companyNameFromSession =
    companyIdFromSession && routeCompanyId && companyIdFromSession === routeCompanyId
      ? sessionStorage.getItem("companyName")
      : "";
  const resolvedCompanyName = String(
    companyNameFromState || companyNameFromSession || "",
  ).trim();

  // Extract query parameters
  const searchParams = new URLSearchParams(location.search);

  // Convert query parameters into an array of key-value pairs
  const queryParamEntries = Array.from(searchParams.entries());

  // Extract and process the path, excluding 'app' for display purposes
  const pathSegments =
    location.pathname === "/dashboard"
      ? ["dashboard"]
      : location.pathname === "/access"
        ? ["access"]
        : location.pathname
            .split("/")
            .filter(
              (segment) =>
                segment &&
                segment !== "app" &&
                segment !== "dashboard" &&
                segment !== "access",
            );

  // "/destinations-data/:locationType[/edit|add]" — the dynamic segment is
  // "<destination>-<category>" (e.g. "bangkok-blog") with no path segment
  // of its own for which summary tab (Content Data vs Nomad Listings) it
  // belongs to, so the generic per-segment mapping below can't produce
  // "Content Data > Bangkok > Blog" on its own. Build this chain explicitly.
  const DESTINATIONS_DATA_LISTING_TYPES = new Set([
    "coworking",
    "coliving",
    "hostel",
    "meetingroom",
    "cafe",
  ]);
  const DESTINATIONS_DATA_CATEGORY_LABELS = {
    blog: "Blog",
    news: "News",
    event: "Event",
    place: "Place",
    restaurant: "Restaurant",
    coworking: "Coworking",
    coliving: "Coliving",
    hostel: "Hostels",
    meetingroom: "Meeting Rooms",
    cafe: "Cafes",
  };
  const isDestinationsDataDetailRoute =
    pathSegments[0] === "destinations-data" &&
    pathSegments.length >= 2 &&
    !["content-data", "nomad-listings", "ranking"].includes(pathSegments[1]) &&
    pathSegments[1].lastIndexOf("-") !== -1;

  if (isDestinationsDataDetailRoute) {
    const locationType = pathSegments[1];
    const dashIndex = locationType.lastIndexOf("-");
    const destinationName = decodeURIComponent(locationType.substring(0, dashIndex));
    const categoryKey = locationType.substring(dashIndex + 1);
    const categoryLabel = DESTINATIONS_DATA_CATEGORY_LABELS[categoryKey] || categoryKey;
    const parentTabPath = DESTINATIONS_DATA_LISTING_TYPES.has(categoryKey)
      ? "nomad-listings"
      : "content-data";
    const parentTabLabel = DESTINATIONS_DATA_LISTING_TYPES.has(categoryKey)
      ? "Nomad Listings"
      : "Content Data";
    const subPage = pathSegments[2]; // "edit" | "add" | undefined
    const isCategoryLast = !subPage;

    const detailBreadcrumbs = [
      <Link
        key="destinations-data"
        underline="hover"
        color="inherit"
        onClick={() => navigate("/dashboard/destinations-data/content-data")}
        style={{ cursor: "pointer" }}
      >
        Destinations Data
      </Link>,
      <Link
        key="destinations-data-tab"
        underline="hover"
        color="inherit"
        // Carries the current search/filters along — they travel in the
        // query string (see DestinationsData.jsx's buildSummaryFilterQuery),
        // so this URL already has them whenever they were set.
        onClick={() => navigate(`/dashboard/destinations-data/${parentTabPath}${location.search}`)}
        style={{ cursor: "pointer" }}
      >
        {parentTabLabel}
      </Link>,
      <Typography key="destinations-data-destination" color="text.primary">
        {destinationName}
      </Typography>,
      isCategoryLast ? (
        <Typography key="destinations-data-category" color="text.primary">
          {categoryLabel}
        </Typography>
      ) : (
        <Link
          key="destinations-data-category"
          underline="hover"
          color="inherit"
          onClick={() => navigate(`/dashboard/destinations-data/${locationType}${location.search}`)}
          style={{ cursor: "pointer" }}
        >
          {categoryLabel}
        </Link>
      ),
    ];

    if (subPage) {
      detailBreadcrumbs.push(
        <Typography key="destinations-data-subpage" color="text.primary">
          {subPage === "add" ? `Add ${categoryLabel}` : `Edit ${categoryLabel}`}
        </Typography>,
      );
    }

    // Note: deliberately not appending queryParamEntries here — on this
    // route the query string only carries the summary's filter/search
    // state (see DestinationsData.jsx), not anything breadcrumb-worthy.

    return (
      <div className="rounded-t-md">
        <Breadcrumbs
          separator="›"
          aria-label="breadcrumb"
          sx={{
            "& .MuiBreadcrumbs-ol": {
              fontSize: "1rem !important",
              color: "#1E3D73",
            },
            "& .MuiBreadcrumbs-li": {
              fontSize: "0.9rem !important",
            },
            "& .MuiBreadcrumbs-li .MuiTypography-root": {
              fontSize: "0.9rem !important",
              color: "#1E3D73 !important",
            },
            "& .MuiBreadcrumbs-separator": {
              margin: "0 1rem",
            },
          }}
        >
          {detailBreadcrumbs}
        </Breadcrumbs>
      </div>
    );
  }

  // Generate breadcrumb links
  const breadcrumbs = pathSegments.map((segment, index) => {
    const isLast = index === pathSegments.length - 1;
    // "/destination-data-analytics/ranking/destination/:destination[/:category]" —
    // the literal "destination" routing segment has no page of its own, so
    // it is dropped and the chain goes Destination Data Analytics › Ranking
    // › the destination (e.g. Dubai) › the category.
    const isDestinationAnalyticsRouteSegment =
      segment === "destination" &&
      index > 1 &&
      pathSegments[index - 1] === "ranking" &&
      pathSegments[index - 2] === "destination-data-analytics";
    if (isDestinationAnalyticsRouteSegment) return null;
    const isEditCompanyIdSegment =
      index >= 2 &&
      pathSegments[index - 1] === "edit" &&
      ["host-companies", "companies"].includes(pathSegments[index - 2]) &&
      companyNameFromState;
    const isCompanyDetailsIdSegment =
      index >= 1 &&
      ["host-companies", "companies", "requests"].includes(pathSegments[index - 1]) &&
      segment !== "requests" &&
      resolvedCompanyName;
    const isHostPanelAnalyticsCompanySegment =
      index >= 1 && pathSegments[index - 1] === "host-panel-analytics";

    // Build the navigation path
    const path = pathSegments.slice(0, index + 1).join("/");
    const isDirectAppPath =
      location.pathname.startsWith(`/${path}`) &&
      !location.pathname.includes("/dashboard");
    const fullPath = isDirectAppPath ? `/${path}` : `/dashboard/${path}`;

    // Capitalize for display
    const isNomadProductFormSegment =
      index > 0 &&
      ["nomad-listing", "nomad-listings"].includes(pathSegments[index - 1]);
    const displayText = isEditCompanyIdSegment
      ? companyNameFromState
      : isCompanyDetailsIdSegment
      ? resolvedCompanyName
      : isHostPanelAnalyticsCompanySegment
      ? resolvedCompanyName
        ? `${resolvedCompanyName} Analytics` 
        : "Company Analytics"
      : isNomadProductFormSegment
      ? segment === "add"
        ? "Add Product"
        : "Edit Product"
      : decodeURIComponent(segment)
          .replace(/-/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
          .replace(/\bPoc\b/g, "POC");

    return isLast ? (
      <Typography key={index} color="text.primary">
        {displayText}
      </Typography>
    ) : (
      <Link
        key={index}
        underline="hover"
        color="inherit"
        onClick={() => navigate(fullPath)}
        style={{ cursor: "pointer" }}
      >
        {displayText}
      </Link>
    );
  }).filter(Boolean);

  // Only true for "/companies/:id/nomad-listings" and
  // "/host-companies/:id/nomad-listing" — both have a real Wono Nomads hub
  // page as their sibling/parent. "/companies/requests/:id/nomad-listing"
  // (nomad-listing nested one level deeper, under the static "requests"
  // segment) has no such hub in its chain, so it must not get this crumb.
  const nomadListingsIndex = pathSegments.findIndex((segment) =>
    ["nomad-listing", "nomad-listings"].includes(segment),
  );
  if (nomadListingsIndex === 2) {
    const wonoNomadsPath = `/dashboard/${pathSegments
      .slice(0, nomadListingsIndex)
      .join("/")}/wono-nomads`;
    breadcrumbs.splice(
      nomadListingsIndex,
      0,
      <Link
        key="wono-nomads"
        underline="hover"
        color="inherit"
        onClick={() => navigate(wonoNomadsPath)}
        style={{ cursor: "pointer" }}
      >
        Wono Nomads
      </Link>,
    );
  }

  // Append query parameters dynamically to the breadcrumb
  queryParamEntries.forEach(([key, value], index) => {
    breadcrumbs.push(
      <Typography key={`param-${index}`} color="text.primary">
        {`${value}`}
      </Typography>,
    );
  });

  return (
    <div className="rounded-t-md">
      <Breadcrumbs
        separator="›"
        aria-label="breadcrumb"
        sx={{
          "& .MuiBreadcrumbs-ol": {
            fontSize: "1rem !important",
            color: "#1E3D73",
          },
          "& .MuiBreadcrumbs-li": {
            fontSize: "0.9rem !important",
          },
          "& .MuiBreadcrumbs-li .MuiTypography-root": {
            fontSize: "0.9rem !important",
            color: "#1E3D73 !important",
          },
          "& .MuiBreadcrumbs-separator": {
            margin: "0 1rem",
          },
        }}
      >
        {breadcrumbs}
      </Breadcrumbs>
    </div>
  );
};

export default BreadCrumbComponent;


