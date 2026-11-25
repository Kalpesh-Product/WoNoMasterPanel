// Data-upload dry runs are archived from the Master Panel backend: it renders
// the report as a PDF, stores it in S3 and writes a Log entry, then returns the
// file itself. This helper triggers that download and reports whether the copy
// made it into Logs.
export const exportDryRunPdf = async ({ axios, report }) => {
  const response = await axios.post("/api/logs/dry-run-report", report, {
    responseType: "blob",
  });

  const fallbackName = `${String(report?.fileName || report?.title || "dry-run")
    .replace(/\.csv$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")}-dry-run.pdf`;

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);

  return {
    stored: response.headers?.["x-report-stored"] === "true",
    reportUrl: response.headers?.["x-report-url"] || "",
  };
};

// The endpoint answers with a PDF blob even on failure, so the usual
// `error.response.data.message` would be a Blob. Read it as text first.
export const readDryRunReportError = async (error) => {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return parsed.message;
    } catch {
      // fall through to the generic message
    }
  }

  return error?.response?.data?.message || error?.message || "Could not export the PDF.";
};
