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

const generateInvoicePdf = async ({
  invoiceNumber,
  paidAt,
  customerName,
  customerEmail,
  companyName,
  description,
  amount,
  currency,
  paymentReference,
}) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 792;
  const line = (text, { size = 11, useBold = false, color = rgb(0.06, 0.09, 0.16), gap = 18 } = {}) => {
    page.drawText(String(text ?? ""), { x: 50, y, size, font: useBold ? bold : font, color });
    y -= gap;
  };

  line("WONO", { size: 24, useBold: true, gap: 20 });
  line("Coworking & Workspace Solutions — wono.co", { size: 9, color: rgb(0.45, 0.45, 0.45), gap: 36 });

  line(`Invoice ${invoiceNumber}`, { size: 15, useBold: true, gap: 20 });
  line(`Date: ${paidAt}`, { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 30 });

  line("Billed To", { size: 10, useBold: true, gap: 16 });
  line(customerName || "-", { gap: 16 });
  if (companyName) line(companyName, { gap: 16 });
  line(customerEmail || "-", { size: 10, color: rgb(0.35, 0.35, 0.35), gap: 34 });

  line("Description", { size: 10, useBold: true, gap: 16 });
  line(description || "Booking payment", { gap: 34 });

  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 24;

  line(`Amount Paid: ${formatAmount(amount, currency)}`, { size: 14, useBold: true, color: rgb(0.02, 0.5, 0.3), gap: 20 });
  line("Status: PAID", { size: 11, useBold: true, color: rgb(0.02, 0.5, 0.3), gap: 30 });

  line(`Stripe reference: ${paymentReference}`, { size: 8, color: rgb(0.55, 0.55, 0.55) });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

module.exports = { generateInvoicePdf };
