import React, { useEffect, useState } from "react";
import { resolveTemplate } from "./templateRegistry";

const LIVE_PREVIEW_DRAFT_STORAGE_KEY = "website_builder_live_preview_draft";

const readThemeVariant = () => {
  try {
    const raw = localStorage.getItem(LIVE_PREVIEW_DRAFT_STORAGE_KEY);
    if (!raw) return "default";
    const draft = JSON.parse(raw);
    return String(draft?.themeVariant || "default").trim() || "default";
  } catch {
    return "default";
  }
};

// Picks which visual template component to mount based on the draft's
// themeVariant. Today only "default" (Classic) exists in the registry, so
// this always resolves to ClassicTemplate — this component exists purely to
// give future templates (Bold Editorial, Minimal Swiss, Warm Organic) a
// single switch point without touching PageDemo.jsx or ClassicTemplate.jsx.
const WebsiteTemplateRenderer = () => {
  const [themeVariant, setThemeVariant] = useState(readThemeVariant);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LIVE_PREVIEW_DRAFT_STORAGE_KEY) {
        setThemeVariant(readThemeVariant());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const { component: TemplateComponent } = resolveTemplate(themeVariant);
  return <TemplateComponent />;
};

export default WebsiteTemplateRenderer;
