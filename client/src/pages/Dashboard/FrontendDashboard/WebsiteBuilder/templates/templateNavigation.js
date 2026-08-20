export const normalizeTemplateNavSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isProductsNavItem = (item) => {
  const slug = normalizeTemplateNavSlug(item?.slug || item?.name);
  return slug === "products" || slug === "product";
};
