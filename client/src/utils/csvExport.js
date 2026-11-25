// Zero-dependency CSV export helper used by the Master Panel exports.
// Produces a real UTF-8 CSV file that opens directly in Excel / Sheets.

const escapeCell = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  const text = String(value);
  // Neutralise spreadsheet formula injection from data-driven text cells.
  const safe = /^[=+@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (matrix = []) =>
  matrix.map((row) => row.map(escapeCell).join(",")).join("\r\n");

export const downloadCsv = ({ filename = "export.csv", matrix = [] }) => {
  // The BOM makes Excel detect UTF-8 correctly (flag emoji, non-Latin names).
  const blob = new Blob(["\uFEFF", toCsv(matrix)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
