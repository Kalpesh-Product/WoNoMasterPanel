export const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.result)) return value.result;
  return [];
};

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const flatten = (...arrays) => arrays.flat().filter(Boolean);

export const countBy = (items, key, labelMap = {}) => {
  const map = new Map();
  asArray(items).forEach((item) => {
    const raw = typeof key === "function" ? key(item) : item?.[key];
    const value = raw == null || String(raw).trim() === "" ? "Unknown" : String(raw);
    const label = Object.prototype.hasOwnProperty.call(labelMap, value.toLowerCase())
      ? labelMap[value.toLowerCase()]
      : value;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }));
};

export const topN = (data, n = 6) =>
  [...data].sort((a, b) => b.value - a.value).slice(0, n);

export const distinctCount = (items, key) => {
  const set = new Set();
  asArray(items).forEach((item) => {
    const raw = typeof key === "function" ? key(item) : item?.[key];
    if (raw != null && String(raw).trim() !== "") set.add(String(raw));
  });
  return set.size;
};

export const sumBy = (items, key) =>
  asArray(items).reduce(
    (acc, item) => acc + toNumber(typeof key === "function" ? key(item) : item?.[key]),
    0,
  );

export const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const monthlyTrend = (items, dateKey = "createdAt", months = 12) => {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { key: monthKey(d), label: d.toLocaleString("en-US", { month: "short" }), value: 0 };
  });
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  asArray(items).forEach((item) => {
    const t = new Date(item?.[dateKey]);
    if (Number.isNaN(t.getTime())) return;
    const i = index.get(monthKey(t));
    if (i != null) buckets[i].value += 1;
  });
  return buckets;
};

export const countSince = (items, dateKey = "createdAt", daysAgo) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);
  return asArray(items).filter((item) => {
    const t = new Date(item?.[dateKey]);
    return !Number.isNaN(t.getTime()) && t >= cutoff;
  }).length;
};

export const countThisMonth = (items, dateKey = "createdAt") => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return asArray(items).filter((item) => {
    const t = new Date(item?.[dateKey]);
    return !Number.isNaN(t.getTime()) && t >= start;
  }).length;
};

export const countToday = (items, dateKey = "createdAt") => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return asArray(items).filter((item) => {
    const t = new Date(item?.[dateKey]);
    return !Number.isNaN(t.getTime()) && t >= start;
  }).length;
};

export const firstNonEmpty = (record, fields) => {
  for (const field of fields) {
    const value = record?.[field];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  return "Unknown";
};

const VERTICAL_LABELS = {
  coworking: "Co-Working",
  "co-working": "Co-Working",
  coliving: "Co-Living",
  "co-living": "Co-Living",
  hostel: "Hostel",
  hostels: "Hostel",
  privatestay: "Private Stay",
  "private stay": "Private Stay",
  meetingroom: "Meeting Room",
  "meeting room": "Meeting Room",
  cafe: "Cafe",
  cafes: "Cafe",
  workation: "Workation",
  workations: "Workation",
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractVerticals = (raw) => {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return [];
  const found = new Map();
  Object.keys(VERTICAL_LABELS).forEach((key) => {
    const matches = value.match(new RegExp(`\\b${escapeRegExp(key)}\\b`, "g"));
    if (matches) {
      const label = VERTICAL_LABELS[key];
      found.set(label, (found.get(label) || 0) + matches.length);
    }
  });
  if (found.size === 0) {
    found.set(value.charAt(0).toUpperCase() + value.slice(1), 1);
  }
  return [...found.entries()];
};

export const countVerticals = (items, key) => {
  const map = new Map();
  asArray(items).forEach((item) => {
    const raw = typeof key === "function" ? key(item) : item?.[key];
    const parts = Array.isArray(raw) ? raw : String(raw || "").split(/[,;|/]+/);
    parts.forEach((part) => {
      extractVerticals(part).forEach(([label, count]) => {
        map.set(label, (map.get(label) || 0) + count);
      });
    });
  });
  return [...map.entries()].map(([label, value]) => ({ label, value }));
};

export const actorName = (item) => {
  if (item?.fullName && String(item.fullName).trim()) return String(item.fullName).trim();
  const performedBy = item?.performedBy;
  if (performedBy && (performedBy.firstName || performedBy.lastName)) {
    return `${performedBy.firstName ?? ""} ${performedBy.lastName ?? ""}`.trim();
  }
  return "Unknown";
};

export const pickArray = (res) => (Array.isArray(res?.data) ? res.data : []);
export const pickDataArray = (res) => (Array.isArray(res?.data?.data) ? res.data.data : []);
export const pickItems = (res) => (Array.isArray(res?.data?.items) ? res.data.items : []);
export const pickData = (res) => res?.data || {};

export const pickGenericArray = (res) => {
  const payload = res?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

export const pickReviews = (res) => {
  const payload = res?.data;
  const reviews = payload?.reviews ?? payload?.data?.reviews ?? payload?.data ?? payload;
  return Array.isArray(reviews) ? reviews : [];
};

export const buildOverview = (config, data) => {
  const ctx = { data };
  // A card/chart builder may reference a source that failed to load (or an
  // endpoint that returned nothing) — degrade that single card/chart instead
  // of blanking the whole tab.
  const safeBuild = (build) => {
    try {
      return build(ctx);
    } catch {
      return undefined;
    }
  };
  return {
    cards: config.cards.map((card, index) => ({
      label: card.label,
      value: safeBuild(card.value) ?? 0,
      icon: card.icon,
      tone: card.tone ?? index,
    })),
    charts: config.charts
      .map((chart) => ({ ...chart, dataset: safeBuild(chart.build) }))
      .filter((chart) => Array.isArray(chart.dataset) && chart.dataset.length > 0),
  };
};
