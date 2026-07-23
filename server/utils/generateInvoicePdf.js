const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// pdf-lib's standard fonts can't encode currency symbols like ₹ — use the
// currency code instead (e.g. "INR 200.00"), which is plain ASCII.
const formatAmount = (amount, currency) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: String(currency || "INR").toUpperCase(),
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(amount || 0);

// startDate/endDate arrive as raw ISO strings (e.g. "2026-07-23T00:00:00.000Z")
// from the frontend — render them the same human-readable way as the paid date.
const formatDateDisplay = (value) => {
  if (!value) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
};

const PAGE_WIDTH = 595.28;
const MARGIN = 50;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;

const generateInvoicePdf = async ({
  invoiceNumber,
  paidAt,
  customerName,
  customerEmail,
  bookingId,
  companyName,
  productType,
  startDate,
  endDate,
  noOfPeople,
  description,
  amount,
  currency,
  paymentReference,
  issuedBy = "WoNo",
}) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dark = rgb(0.06, 0.09, 0.16);
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.85, 0.85, 0.85);
  const green = rgb(0.02, 0.5, 0.3);

  let y = 792;

  const line = (text, { size = 11, useBold = false, color = dark, gap = 18, x = MARGIN } = {}) => {
    page.drawText(String(text ?? ""), { x, y, size, font: useBold ? bold : font, color });
    y -= gap;
  };

  const rightText = (text, { size = 11, useBold = false, color = dark } = {}) => {
    const f = useBold ? bold : font;
    const width = f.widthOfTextAtSize(String(text ?? ""), size);
    page.drawText(String(text ?? ""), { x: CONTENT_RIGHT - width, y, size, font: f, color });
  };

  const divider = (gapBefore = 0, gapAfter = 20) => {
    y -= gapBefore;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: CONTENT_RIGHT, y }, thickness: 1, color: lightGray });
    y -= gapAfter;
  };

  // --- Header ---
  const headerY = y;
  line("WONO", { size: 24, useBold: true, gap: 0 });
  page.drawText("INVOICE", {
    x: CONTENT_RIGHT - bold.widthOfTextAtSize("INVOICE", 20),
    y: headerY + 4,
    size: 20,
    font: bold,
    color: dark,
  });
  y -= 18;
  line("Coworking & Workspace Solutions — wono.co", { size: 9, color: gray, gap: 0 });
  rightText("PAID", { size: 10, useBold: true, color: green });
  y -= 28;

  divider(0, 22);

  // --- Invoice meta ---
  const metaLabelY = y;
  line("Invoice Number", { size: 9, color: gray, gap: 15 });
  line(invoiceNumber, { size: 12, useBold: true, gap: 26 });
  rightTextAt(page, font, 9, gray, "Date", metaLabelY);
  rightTextAt(page, bold, 12, dark, paidAt, metaLabelY - 15);

  // --- Issued By / Billed To (two columns) ---
  const sectionTopY = y;

  line("Issued By", { size: 10, useBold: true, gap: 15 });
  line(issuedBy, { gap: 15 });
  const issuedByBottomY = y;

  const billedToX = MARGIN + 260;
  let billedToY = sectionTopY;
  const billedToLine = (text, { size = 11, useBold = false, color = dark } = {}) => {
    page.drawText(String(text ?? ""), { x: billedToX, y: billedToY, size, font: useBold ? bold : font, color });
    billedToY -= 15;
  };
  billedToLine("Billed To", { size: 10, useBold: true });
  billedToLine(customerName || "-");
  billedToLine(customerEmail || "-", { size: 10, color: gray });

  y = Math.min(issuedByBottomY, billedToY) - 11;

  // --- Booking details (only rendered when at least one value is present) ---
  const hasBookingDetails = bookingId || companyName || productType || startDate || endDate || noOfPeople;
  if (hasBookingDetails) {
    divider(0, 20);
    line("Booking Details", { size: 10, useBold: true, gap: 18 });
    const detailRow = (label, value) => {
      line(label, { size: 9, color: gray, gap: 15, x: MARGIN });
      page.drawText(String(value), { x: MARGIN + 110, y: y + 15, size: 10, font, color: dark });
    };
    if (bookingId) detailRow("Booking ID", bookingId);
    if (companyName) detailRow("Workspace", companyName);
    if (productType) detailRow("Booking Type", productType);
    if (startDate) detailRow("Start Date", formatDateDisplay(startDate));
    if (endDate) detailRow("End Date", formatDateDisplay(endDate));
    if (noOfPeople) detailRow("Guests", noOfPeople);
    y -= 6;
  }

  divider(6, 20);

  // --- Line item ---
  rightText("Amount", { size: 9, useBold: true, color: gray });
  line("Description", { size: 9, useBold: true, color: gray, gap: 18 });
  line(description || "Booking payment", { size: 11, gap: 0 });
  rightText(formatAmount(amount, currency), { size: 11, color: dark });
  y -= 30;

  divider(0, 22);

  // --- Totals ---
  line("Amount Paid", { size: 12, useBold: true, color: green, gap: 0 });
  rightText(formatAmount(amount, currency), { size: 12, useBold: true, color: green });
  y -= 20;
  line("Balance Due", { size: 11, color: gray, gap: 0 });
  rightText(formatAmount(0, currency), { size: 11, color: gray });
  y -= 30;

  line(`Transaction ID: ${paymentReference}`, { size: 8, color: gray, gap: 0 });

  // --- Footer ---
  let footerY = 150;
  const footerLine = (text, { size = 9, useBold = false, color = gray, gapAfter = 15 } = {}) => {
    const f = useBold ? bold : font;
    const width = f.widthOfTextAtSize(String(text), size);
    page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y: footerY, size, font: f, color });
    footerY -= gapAfter;
  };

  page.drawLine({ start: { x: MARGIN, y: footerY + 10 }, end: { x: CONTENT_RIGHT, y: footerY + 10 }, thickness: 1, color: lightGray });
  footerY -= 12;

  footerLine("Need Immediate Assistance?", { size: 10, useBold: true, color: dark, gapAfter: 18 });
  footerLine("response@wono.co", { gapAfter: 14 });
  footerLine("www.wono.co", { gapAfter: 22 });
  footerLine("© Copyright 2026-27 All Rights Reserved.", { gapAfter: 14 });
  footerLine("WONOCO PRIVATE LIMITED - SINGAPORE.", { gapAfter: 22 });
  footerLine("Privacy Policy | Terms & Conditions", { color: dark });

  footerY -= 10;
  page.drawLine({ start: { x: MARGIN, y: footerY }, end: { x: CONTENT_RIGHT, y: footerY }, thickness: 1, color: lightGray });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

function rightTextAt(page, font, size, color, text, y) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: CONTENT_RIGHT - width, y, size, font, color });
}

module.exports = { generateInvoicePdf };
