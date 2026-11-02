import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { buildDemoPreviewDraft } from "./templates/demoPreviewData";

const LIVE_PREVIEW_DRAFT_STORAGE_KEY = "website_builder_live_preview_draft";

// A plain, shareable link for a template's sample-content preview — the same
// data buildDemoPreviewDraft() generates for the Website Builder's own
// in-app "Preview with sample content" button (see TemplateChangeRequestControl's
// handlePreview), just triggered on page load instead of a click. Unlike the
// "<id>demo.wono.co" seeded tenant sites, this needs no demo company or
// subdomain to exist in the database, so it works identically in every
// environment — exactly what external links (e.g. the Nomads Theme Store's
// "Preview" button) need, since they can't run the click handler themselves.
//
// Writes to sessionStorage, NOT localStorage: localStorage is one shared
// bucket per origin, so two tabs/iframes both open on masterpanel.wono.co
// (e.g. previewing Haven in one tab and Tulum in another) would otherwise
// keep overwriting each other's draft, flipping whichever tab was opened
// first over to the second template's content too. sessionStorage is scoped
// per tab, so each preview stays independent. (The read side — see
// useWebsiteTemplateData and WebsiteTemplateRenderer — checks sessionStorage
// first and falls back to localStorage, so the Website Builder's own
// click-to-preview flow, which depends on localStorage surviving into a
// window.open(...,"noopener") tab, is unaffected.)
const PublicDemoPreview = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const draft = buildDemoPreviewDraft(templateId);
    sessionStorage.setItem(LIVE_PREVIEW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    navigate("/website-preview", { replace: true });
  }, [templateId, navigate]);

  return null;
};

export default PublicDemoPreview;
