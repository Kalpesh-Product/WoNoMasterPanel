const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

// Renders a data-upload dry-run diff (weights / visa rules) as an A4 PDF so the
// exact preview a staff member reviewed can be archived and downloaded. The
// caller hands over plain data — the layout lives here, not in the controllers,
// so both upload tabs share one report look.

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 14;

const COLORS = {
  dark: rgb(0.06, 0.09, 0.16),
  body: rgb(0.2, 0.25, 0.33),
  muted: rgb(0.45, 0.51, 0.6),
  line: rgb(0.88, 0.9, 0.94),
  band: rgb(0.96, 0.97, 0.99),
  blue: rgb(0.145, 0.388, 0.92),
  white: rgb(1, 1, 1),
};

// pdf-lib's standard fonts are WinAnsi only. Drop control characters and
// replace glyphs the encoding can't hold, so a stray emoji never breaks the
// export.
const toEncodable = (value) =>
  [...String(value ?? "")]
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === 9) return " ";
      if (code < 32 || (code >= 127 && code <= 159)) return "";
      return code <= 255 ? char : "?";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const fitText = (font, value, size, maxWidth) => {
  const text = toEncodable(value);
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let clipped = text;
  while (
    clipped.length > 1 &&
    font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth
  ) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trimEnd()}...`;
};

const wrapText = (font, value, size, maxWidth) => {
  const words = toEncodable(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const normalizeColumns = (columns = []) => {
  const usable = (Array.isArray(columns) ? columns : []).slice(0, 8);
  if (!usable.length) return [];

  const raw = usable.map((column) => ({
    label: String(column?.label ?? ""),
    width: Number(column?.width) > 0 ? Number(column.width) : 0,
  }));
  const total = raw.reduce((sum, column) => sum + column.width, 0);

  if (!total) {
    return raw.map((column) => ({ ...column, width: 1 / raw.length }));
  }
  return raw.map((column) => ({ ...column, width: column.width / total }));
};

const buildDryRunReportPdf = async ({
  title = "Dry run report",
  module = "Data Upload",
  page = "",
  fileName = "",
  summary = [],
  sections = [],
  notes = [],
  generatedAt = new Date(),
}) => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(toEncodable(title));
  pdfDoc.setCreator("Wono Master Panel");
  pdfDoc.setProducer("Wono Master Panel");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const stamp = generatedAt.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let current = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    current = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensure = (height) => {
    if (y - height < BOTTOM) newPage();
  };

  const text = (value, { x = MARGIN, size = 9, useBold = false, color = COLORS.body } = {}) => {
    const content = toEncodable(value);
    if (!content) return;
    current.drawText(fitText(useBold ? bold : font, content, size, CONTENT_WIDTH - (x - MARGIN)), {
      x,
      y,
      size,
      font: useBold ? bold : font,
      color,
    });
  };

  // --- Header ---
  text("WONO MASTER PANEL", { size: 8, useBold: true, color: COLORS.blue });
  y -= 20;
  text(title, { size: 18, useBold: true, color: COLORS.dark });
  y -= 16;

  const meta = [module, page].filter(Boolean).join("  ·  ");
  if (meta) {
    text(meta, { size: 8.5, color: COLORS.muted });
    y -= 12;
  }
  const source = [fileName ? `File: ${fileName}` : "", `Generated: ${stamp} UTC`]
    .filter(Boolean)
    .join("  ·  ");
  if (source) {
    text(source, { size: 8.5, color: COLORS.muted });
    y -= 12;
  }

  y -= 4;
  current.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 1.2,
    color: COLORS.blue,
  });
  y -= 20;

  // --- Summary strip (three per row) ---
  const summaryItems = (Array.isArray(summary) ? summary : []).filter(
    (item) => item && item.label !== undefined,
  );

  summaryItems.forEach((item, index) => {
    const column = index % 3;
    if (column === 0) ensure(38);
    const cellWidth = CONTENT_WIDTH / 3;
    const x = MARGIN + column * cellWidth;

    if (column === 0 && index > 0) {
      // separator already advanced below the previous row
    }

    current.drawText(fitText(bold, String(item.label).toUpperCase(), 7, cellWidth - 10), {
      x,
      y,
      size: 7,
      font: bold,
      color: COLORS.muted,
    });
    current.drawText(fitText(bold, String(item.value ?? "0"), 13, cellWidth - 10), {
      x,
      y: y - 16,
      size: 13,
      font: bold,
      color: COLORS.dark,
    });

    if (column === 2 || index === summaryItems.length - 1) {
      y -= 34;
      if (index !== summaryItems.length - 1) {
        current.drawLine({
          start: { x: MARGIN, y: y + 6 },
          end: { x: MARGIN + CONTENT_WIDTH, y: y + 6 },
          thickness: 0.5,
          color: COLORS.line,
        });
      }
    }
  });

  if (summaryItems.length) y -= 6;

  // --- Sections ---
  const usableSections = (Array.isArray(sections) ? sections : []).filter(
    (section) => section && Array.isArray(section.rows) && section.rows.length > 0,
  );

  usableSections.forEach((section) => {
    const columns = normalizeColumns(section.columns);
    if (!columns.length) return;

    ensure(56);
    text(section.title || "Changes", { size: 10, useBold: true, color: COLORS.dark });
    y -= 8;
    current.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 0.7,
      color: COLORS.line,
    });
    y -= 14;

    const drawHead = () => {
      current.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width: CONTENT_WIDTH,
        height: 17,
        color: COLORS.band,
      });
      let x = MARGIN + 4;
      columns.forEach((column) => {
        const width = column.width * CONTENT_WIDTH;
        current.drawText(fitText(bold, column.label, 7.5, width - 8), {
          x,
          y,
          size: 7.5,
          font: bold,
          color: COLORS.muted,
        });
        x += width;
      });
      y -= 19;
    };

    drawHead();

    (section.rows || []).forEach((row, rowIndex) => {
      const cells = Array.isArray(row) ? row : [row];
      if (y - ROW_HEIGHT < BOTTOM) {
        newPage();
        text(section.title || "Changes", { size: 10, useBold: true, color: COLORS.dark });
        y -= 12;
        drawHead();
      }

      if (rowIndex % 2 === 1) {
        current.drawRectangle({
          x: MARGIN,
          y: y - 4,
          width: CONTENT_WIDTH,
          height: 15,
          color: rgb(0.985, 0.99, 0.995),
        });
      }

      let x = MARGIN + 4;
      columns.forEach((column, columnIndex) => {
        const width = column.width * CONTENT_WIDTH;
        const value = cells[columnIndex];
        current.drawText(fitText(font, value, 8, width - 8), {
          x,
          y,
          size: 8,
          font,
          color: COLORS.body,
        });
        x += width;
      });
      y -= ROW_HEIGHT;
    });

    y -= 12;
  });

  // --- Notes ---
  const usableNotes = (Array.isArray(notes) ? notes : []).filter(Boolean);
  if (usableNotes.length) {
    ensure(44);
    text("Notes", { size: 10, useBold: true, color: COLORS.dark });
    y -= 15;
    usableNotes.forEach((note) => {
      wrapText(font, `• ${note}`, 8, CONTENT_WIDTH - 4).forEach((line) => {
        ensure(12);
        text(line, { x: MARGIN + 2, size: 8, color: COLORS.muted });
        y -= 11;
      });
    });
  }

  // --- Footers ---
  const pages = pdfDoc.getPages();
  pages.forEach((pageRef, index) => {
    pageRef.drawText(`Wono Master Panel · generated ${stamp} UTC`, {
      x: MARGIN,
      y: 30,
      size: 7,
      font,
      color: COLORS.muted,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    pageRef.drawText(label, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 7),
      y: 30,
      size: 7,
      font,
      color: COLORS.muted,
    });
  });

  return Buffer.from(await pdfDoc.save());
};

module.exports = { buildDryRunReportPdf };
