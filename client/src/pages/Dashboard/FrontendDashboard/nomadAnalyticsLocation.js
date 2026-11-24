export const capitalizeLocationName = (value) =>
  String(value ?? "").trim().replace(/(^|[\s.-])\p{L}/gu, (initial) => initial.toUpperCase());
