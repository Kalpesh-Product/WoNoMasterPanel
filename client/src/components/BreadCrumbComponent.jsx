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
      : location.pathname
          .split("/")
          .filter(
            (segment) =>
              segment && segment !== "app" && segment !== "dashboard",
          );

  // Generate breadcrumb links
  const breadcrumbs = pathSegments.map((segment, index) => {
    const isLast = index === pathSegments.length - 1;
    const isEditCompanyIdSegment =
      index >= 2 &&
      pathSegments[index - 1] === "edit" &&
      ["host-companies", "companies"].includes(pathSegments[index - 2]) &&
      companyNameFromState;
    const isCompanyDetailsIdSegment =
      index >= 1 &&
      ["host-companies", "companies"].includes(pathSegments[index - 1]) &&
      resolvedCompanyName;

    // Build the navigation path
    const path = pathSegments.slice(0, index + 1).join("/");
    const isDirectAppPath =
      location.pathname.startsWith(`/${path}`) &&
      !location.pathname.includes("/dashboard");
    const fullPath = isDirectAppPath ? `/${path}` : `/dashboard/${path}`;

    // Capitalize for display
    const displayText = isEditCompanyIdSegment
      ? companyNameFromState
      : isCompanyDetailsIdSegment
      ? resolvedCompanyName
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
  });

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
