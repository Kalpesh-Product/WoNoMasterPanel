// Ported from HostPanel (client/src/pages/Dashboard/FrontendDashboard/WebsiteBuilder/templates/).
// Keep the three copies in sync.
import { contrastRatio, luminance, mix, normalizeHex } from "./emeraldTheme";
const THEME_DEFAULTS = {
  "emerald-studio": { bg: "#4a6b96", text: "#ffffff", accent: "#ffffff" },
  "figma-make": { bg: "#4a6b96", text: "#ffffff", accent: "#ffffff" },
  "fresh-studio": { bg: "#0a0a12", text: "#ffffff", accent: "#d94b4b" },
  default: { bg: "#efefef", text: "#1f1f1f", accent: "#3b82f6" },
  "warm-organic": { bg: "#f1e6d3", text: "#2b211a", accent: "#b85c38", surfaceUp: true }
};
const supportsThemeColors = (templateId) => Boolean(THEME_DEFAULTS[String(templateId || "").trim() || "default"]);
const getThemeDefaults = (templateId) => THEME_DEFAULTS[String(templateId || "").trim() || "default"] || THEME_DEFAULTS.default;
const hasCustomTheme = (config) => Boolean(
  normalizeHex(config?.bgColor) || normalizeHex(config?.textColor) || normalizeHex(config?.accentColor)
);
const readableAgainst = (hex, bg, text) => {
  let out = hex;
  for (let i = 1; i <= 10 && contrastRatio(out, bg) < 4.5; i++) out = mix(hex, text, i / 10);
  return out;
};
const readableOn = (hex) => contrastRatio(hex, "#111111") >= contrastRatio(hex, "#ffffff") ? "#111111" : "#ffffff";
const resolveThemeColors = (templateId, config) => {
  const d = getThemeDefaults(templateId);
  const bgC = normalizeHex(config?.bgColor);
  const bg = bgC || d.bg;
  const text = normalizeHex(config?.textColor) || (bgC && contrastRatio(d.text, bgC) < 4.5 ? readableOn(bgC) : d.text);
  return { bg, text, accent: normalizeHex(config?.accentColor) || d.accent };
};
const buildThemeVars = (templateId, config) => {
  if (!hasCustomTheme(config)) return void 0;
  const d = getThemeDefaults(templateId);
  const bgC = normalizeHex(config?.bgColor);
  const textC = normalizeHex(config?.textColor);
  const accC = normalizeHex(config?.accentColor);
  const { bg, text } = resolveThemeColors(templateId, config);
  const vars = {};
  if (bgC) {
    const dark = luminance(bgC) < 0.45;
    vars["--t-bg"] = bgC;
    if (d.surfaceUp) {
      vars["--t-surface"] = mix(bgC, "#ffffff", dark ? 0.07 : 0.5);
      vars["--t-surface2"] = mix(bgC, "#ffffff", dark ? 0.12 : 0.3);
      vars["--t-raised"] = mix(bgC, "#ffffff", dark ? 0.1 : 0.75);
    } else {
      vars["--t-surface"] = mix(bgC, dark ? "#ffffff" : "#000000", dark ? 0.06 : 0.05);
      vars["--t-surface2"] = mix(bgC, dark ? "#ffffff" : "#000000", dark ? 0.1 : 0.08);
      vars["--t-raised"] = vars["--t-surface"];
    }
    vars["--t-line"] = mix(bgC, text, 0.2);
  }
  if (textC || text !== d.text) vars["--t-text"] = text;
  if (bgC && luminance(bgC) >= 0.45 && !d.surfaceUp) vars["--t-k"] = "1.22";
  if (bgC || textC) vars["--t-muted"] = mix(text, bg, 0.3);
  if (accC) {
    const secondary = mix(accC, "#000000", 0.45);
    vars["--t-accent"] = accC;
    vars["--t-accent-text"] = readableOn(accC);
    vars["--t-accent-light"] = mix(accC, "#ffffff", 0.2);
    vars["--t-accent-dark"] = mix(accC, "#000000", 0.3);
    vars["--t-secondary"] = secondary;
    vars["--t-secondary-text"] = readableOn(secondary);
    vars["--t-secondary-fg"] = readableAgainst(secondary, bg, text);
    vars["--t-tint3"] = mix(secondary, accC, 0.5);
  } else if (bgC || textC) {
    vars["--t-secondary-fg"] = readableAgainst("#3e5641", bg, text);
    const accent = readableAgainst(d.accent, bg, text);
    if (accent !== d.accent) {
      vars["--t-accent"] = accent;
      vars["--t-accent-text"] = readableOn(accent);
      vars["--t-accent-light"] = mix(accent, "#ffffff", 0.2);
      vars["--t-accent-dark"] = mix(accent, "#000000", 0.3);
    }
  }
  return vars;
};
export {
  THEME_DEFAULTS,
  buildThemeVars,
  getThemeDefaults,
  hasCustomTheme,
  resolveThemeColors,
  supportsThemeColors
};
