const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const FOOTER_MM = 10;

const drawPageHeader = (pdf, title, rangeLabel, pageNumber) => {
  pdf.setFillColor(37, 99, 235);
  pdf.rect(0, 0, PAGE_WIDTH_MM, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, MARGIN_MM, 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(rangeLabel, MARGIN_MM, 16);
  pdf.text(`Page ${pageNumber}`, PAGE_WIDTH_MM - MARGIN_MM, 16, { align: "right" });
};

export const exportWonoAnalyticsPdf = async ({ filename, rangeLabel }) => {
  const sections = Array.from(document.querySelectorAll("[data-wono-pdf-section]"));
  if (sections.length === 0) throw new Error("No analytics sections are available to export.");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let pageNumber = 1;
  let y = 28;
  drawPageHeader(pdf, "WONO.CO ANALYTICS REPORT", rangeLabel, pageNumber);

  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale: 1.75,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.max(document.documentElement.clientWidth, section.scrollWidth),
    });
    const image = canvas.toDataURL("image/png", 1);
    let imageWidth = CONTENT_WIDTH_MM;
    let imageHeight = (canvas.height * imageWidth) / canvas.width;
    const maximumHeight = PAGE_HEIGHT_MM - 28 - FOOTER_MM;

    if (imageHeight > maximumHeight) {
      const scale = maximumHeight / imageHeight;
      imageWidth *= scale;
      imageHeight *= scale;
    }

    if (y + imageHeight > PAGE_HEIGHT_MM - FOOTER_MM) {
      pdf.addPage();
      pageNumber += 1;
      drawPageHeader(pdf, "WONO.CO ANALYTICS REPORT", rangeLabel, pageNumber);
      y = 28;
    }

    const x = MARGIN_MM + (CONTENT_WIDTH_MM - imageWidth) / 2;
    pdf.addImage(image, "PNG", x, y, imageWidth, imageHeight, undefined, "FAST");
    y += imageHeight + 5;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(MARGIN_MM, PAGE_HEIGHT_MM - 8, PAGE_WIDTH_MM - MARGIN_MM, PAGE_HEIGHT_MM - 8);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(
      `Generated ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Calcutta" })} IST - ${page} of ${totalPages}`,
      PAGE_WIDTH_MM / 2,
      PAGE_HEIGHT_MM - 4,
      { align: "center" },
    );
  }

  pdf.save(filename);
};
