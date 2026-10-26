import React, { Suspense, useEffect, useState } from "react";
import { resolveTemplate } from "./templateRegistry";
import TemplateIntroLoader from "./shared/TemplateIntroLoader";
import TemplateBackToTop from "./shared/TemplateBackToTop";

// Shown while a lazily-loaded template's own JS chunk is still downloading
// (see templateRegistry.js) — without it the page is just blank white for
// however long that takes, which reads as "broken" rather than "loading".
const TemplateLoadingFallback = () => (
  <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-white">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
    <p className="text-sm font-medium text-slate-500">Loading preview…</p>
  </div>
);

const LIVE_PREVIEW_DRAFT_STORAGE_KEY = "website_builder_live_preview_draft";

const mediaSrc = (value) =>
  typeof value === "string" ? value.trim() : String(value?.url || value?.src || "").trim();

// sessionStorage first — see useWebsiteTemplateData's readPreviewDraftRaw for
// why: keeps two tabs previewing different templates from overwriting each
// other's draft in the one shared localStorage bucket for this origin.
const readDraftRaw = () => {
  try {
    return sessionStorage.getItem(LIVE_PREVIEW_DRAFT_STORAGE_KEY) || localStorage.getItem(LIVE_PREVIEW_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
};

const readPreviewMetadata = () => {
  try {
    const raw = readDraftRaw();
    const draft = raw ? JSON.parse(raw) : null;
    return {
      title: String(draft?.companyName || "Website Preview").trim() || "Website Preview",
      favicon: mediaSrc(draft?.companyLogo),
    };
  } catch {
    return { title: "Website Preview", favicon: "" };
  }
};

const readThemeVariant = () => {
  try {
    const raw = readDraftRaw();
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
  const [metadata, setMetadata] = useState(readPreviewMetadata);

  useEffect(() => {
    const refreshPreviewState = () => {
      setThemeVariant(readThemeVariant());
      const next = readPreviewMetadata();
      setMetadata((current) => current.title === next.title && current.favicon === next.favicon ? current : next);
    };
    const handleStorage = (event) => {
      if (event.key === LIVE_PREVIEW_DRAFT_STORAGE_KEY) {
        refreshPreviewState();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("website-preview-draft-updated", refreshPreviewState);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("website-preview-draft-updated", refreshPreviewState);
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    const existingIcons = Array.from(document.querySelectorAll('link[rel~="icon"]'));
    const previousIcons = existingIcons.map((icon) => ({ icon, href: icon.getAttribute("href") }));
    let createdIcon = null;

    document.title = metadata.title;
    if (metadata.favicon) {
      if (existingIcons.length) {
        existingIcons.forEach((icon) => { icon.href = metadata.favicon; });
      } else {
        const icon = document.createElement("link");
        icon.rel = "icon";
        icon.href = metadata.favicon;
        document.head.appendChild(icon);
        createdIcon = icon;
      }
    }

    return () => {
      document.title = previousTitle;
      previousIcons.forEach(({ icon, href }) => href === null ? icon.removeAttribute("href") : icon.setAttribute("href", href));
      createdIcon?.remove();
    };
  }, [metadata]);

  const previewOverride = new URLSearchParams(window.location.search).get("previewTemplate");
  const resolvedTemplate = resolveTemplate(previewOverride || themeVariant);
  const { component: TemplateComponent } = resolvedTemplate;
  return (
    <Suspense fallback={<TemplateLoadingFallback />}>
      <TemplateIntroLoader
        key={resolvedTemplate.id}
        themeVariant={resolvedTemplate.id}
        companyName={metadata.title}
      />
      <TemplateBackToTop themeVariant={resolvedTemplate.id} />
      <TemplateComponent />
    </Suspense>
  );
};

export default WebsiteTemplateRenderer;
