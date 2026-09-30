// Ported from HostPanel (client/src/pages/Dashboard/FrontendDashboard/WebsiteBuilder/templates/).
// Keep the three copies in sync.
const EMERALD_DEFAULT_THEME = {
  bgColor: "#4a6b96",
  textColor: "#ffffff",
  accentColor: "#ffffff"
};
const normalizeHex = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return "";
};
const toRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16)
});
const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, weightOfB) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex({
    r: x.r + (y.r - x.r) * weightOfB,
    g: x.g + (y.g - x.g) * weightOfB,
    b: x.b + (y.b - x.b) * weightOfB
  });
};
const rgba = (hex, alpha) => {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};
const luminance = (hex) => {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const { r, g, b } = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrastRatio = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const hasCustomEmeraldTheme = (config) => Boolean(
  normalizeHex(config?.bgColor) || normalizeHex(config?.textColor) || normalizeHex(config?.accentColor)
);
const resolveEmeraldTheme = (config) => {
  const bg = normalizeHex(config?.bgColor) || EMERALD_DEFAULT_THEME.bgColor;
  const bgPicked = normalizeHex(config?.bgColor);
  const text = normalizeHex(config?.textColor) || (bgPicked && contrastRatio(EMERALD_DEFAULT_THEME.textColor, bgPicked) < 4.5 ? contrastRatio(bgPicked, "#111111") >= contrastRatio(bgPicked, "#ffffff") ? "#111111" : "#ffffff" : EMERALD_DEFAULT_THEME.textColor);
  const accent = normalizeHex(config?.accentColor) || text;
  return { bg, text, accent };
};
const EMERALD_BASE_CSS = ".es-scope .text-white\\/60{color:rgba(255,255,255,0.9)}.es-scope .text-white\\/40{color:rgba(255,255,255,0.85)}";
const esc = (cls) => cls.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
const buildEmeraldThemeCss = (config, scope = ".fm-template") => {
  if (!hasCustomEmeraldTheme(config)) return "";
  const { bg, text, accent } = resolveEmeraldTheme(config);
  const darkBg = luminance(bg) < 0.45;
  const tint = darkBg ? mix(bg, "#0b1626", 0.55) : mix(bg, "#000000", 0.5);
  const band = mix(bg, tint, darkBg ? 0.15 : 0.05);
  const card = mix(bg, tint, darkBg ? 0.35 : 0.1);
  const deep = mix(bg, tint, darkBg ? 0.55 : 0.16);
  const heroFrom = mix(bg, tint, darkBg ? 0.2 : 0.06);
  const heroTo = darkBg ? mix(bg, "#ffffff", 0.06) : mix(bg, "#000000", 0.04);
  const accentText = contrastRatio(accent, "#1b2b44") >= contrastRatio(accent, "#ffffff") ? "#1b2b44" : "#ffffff";
  const accentHover = luminance(accent) > 0.5 ? mix(accent, "#000000", 0.06) : mix(accent, "#ffffff", 0.15);
  const errorText = darkBg ? "#fecaca" : "#b91c1c";
  const out = [];
  const add = (cls, decl, pseudo = "") => out.push(`${scope} .${esc(cls)}${pseudo}{${decl}}`);
  out.push(`${scope}{background-color:${bg};color:${text}}`);
  add("text-white", `color:${text}`);
  add("text-white/90", `color:${rgba(text, 0.9)}`);
  add("text-white/85", `color:${rgba(text, 0.9)}`);
  add("text-white/80", `color:${rgba(text, 0.9)}`);
  add("text-white/70", `color:${rgba(text, 0.85)}`);
  add("text-white/60", `color:${rgba(text, 0.9)}`);
  add("text-white/40", `color:${rgba(text, 0.85)}`);
  add("hover:text-white", `color:${text}`, ":hover");
  add("placeholder:text-white/90", `color:${rgba(text, 0.65)}`, "::placeholder");
  add("text-slate-900", `color:${accentText}`);
  add("hover:text-slate-900", `color:${accentText}`, ":hover");
  add("text-slate-600", `color:${rgba(accentText, 0.75)}`);
  add("text-red-200", `color:${errorText}`);
  add("bg-white", `background-color:${accent}`);
  add("hover:bg-white", `background-color:${accent}`, ":hover");
  add("hover:bg-sky-50", `background-color:${accentHover}`, ":hover");
  add("bg-sky-200/25", `background-color:${rgba(accent, 0.25)}`);
  add("bg-sky-200/20", `background-color:${rgba(accent, 0.2)}`);
  add("bg-[#4a6b96]", `background-color:${bg}`);
  add("bg-[#4a6b96]/[0.92]", `background-color:${rgba(bg, 0.92)}`);
  add("bg-[#1f3556]/15", `background-color:${band}`);
  add("bg-[#1f3556]/30", `background-color:${card}`);
  add("bg-[#1f3556]/35", `background-color:${card}`);
  add("bg-[#2f4a70]", `background-color:${deep}`);
  add("bg-[#2f4a70]/95", `background-color:${rgba(deep, 0.95)}`);
  add("bg-[#2f4a70]/90", `background-color:${rgba(deep, 0.9)}`);
  add("bg-[#2f4a70]/85", `background-color:${rgba(deep, 0.85)}`);
  add("bg-white/10", `background-color:${rgba(text, 0.1)}`);
  add("hover:bg-white/10", `background-color:${rgba(text, 0.1)}`, ":hover");
  add("hover:bg-white/15", `background-color:${rgba(text, 0.15)}`, ":hover");
  add("hover:bg-white/20", `background-color:${rgba(text, 0.2)}`, ":hover");
  add("border-white", `border-color:${text}`);
  add("hover:border-white", `border-color:${text}`, ":hover");
  add("focus:border-white", `border-color:${text}`, ":focus");
  add("hover:border-white/50", `border-color:${rgba(text, 0.5)}`, ":hover");
  [10, 15, 20, 25, 40, 50, 60].forEach(
    (n) => add(`border-white/${n}`, `border-color:${rgba(text, n / 100)}`)
  );
  const gradFrom = (c) => `--tw-gradient-from:${c} var(--tw-gradient-from-position);--tw-gradient-to:${rgba(c, 0)} var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)`;
  add("from-[#3f5d85]", gradFrom(heroFrom));
  add(
    "via-[#4a6b96]",
    `--tw-gradient-to:${rgba(bg, 0)} var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),${bg} var(--tw-gradient-via-position),var(--tw-gradient-to)`
  );
  add("to-[#557699]", `--tw-gradient-to:${heroTo} var(--tw-gradient-to-position)`);
  add("from-[#4a6b96]", gradFrom(bg));
  add("from-[#4a6b96]/50", gradFrom(rgba(bg, 0.5)));
  add("to-[#4a6b96]/40", `--tw-gradient-to:${rgba(bg, 0.4)} var(--tw-gradient-to-position)`);
  return out.join("\n");
};
export {
  EMERALD_BASE_CSS,
  EMERALD_DEFAULT_THEME,
  buildEmeraldThemeCss,
  contrastRatio,
  hasCustomEmeraldTheme,
  luminance,
  mix,
  normalizeHex,
  resolveEmeraldTheme,
  rgba
};
