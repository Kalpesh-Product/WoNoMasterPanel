import React from "react";
import WebsiteTemplateRenderer from "./templates/WebsiteTemplateRenderer";

// Thin route wrapper — kept at this path/name because Routes.jsx imports it
// directly. All actual rendering now lives in templates/ (see
// templateRegistry.js), so new visual templates can be added there without
// touching this file or the routes.
const PageDemo = () => <WebsiteTemplateRenderer />;

export default PageDemo;
