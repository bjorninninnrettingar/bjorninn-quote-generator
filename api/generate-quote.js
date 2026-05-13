// api/generate-quote.js
// Björninn ehf. — Quote PDF Generator
// Uses pdf-lib (pure JS, no native deps, no startup issues)

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const PROJECTS_TABLE = "tbl4LMXlQjp66RFKI";
const LINE_ITEMS_TABLE = "tblFcsUoGxsuUwNEH";
const ATTACHMENT_FIELD = "flddIR5JAm8ZM753V";

// Brand colours (0–1 scale)
const GOLD = rgb(0.808, 0.694, 0.388);   // #CEB163
const DARK = rgb(0.102, 0.102, 0.102);   // #1A1A1A
const GRAY = rgb(0.431, 0.431, 0.431);   // #6E6E6E
const LIGHT = rgb(0.941, 0.941, 0.941);  // #F0F0F0
const WHITE = rgb(1, 1, 1);

const VAT_RATE = 0.11;

// ── Airtable helpers ──────────────────────────────────────────────────────────

async function airtableFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json();
}

async function getProject(token, recordId) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`;
  const data = await airtableFetch(url, token);
  return data.fields;
}

async function getLineItems(token, recordId) {
  // Line items are linked from the project; fetch the linked record IDs then
  // retrieve each one from the line-items table.
  const project = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    token
  );
  const linkedIds = project.fields["Vöru línur"] || [];
  if (linkedIds.length === 0) return [];

  // Fetch all linked line items in one filterByFormula call
  const filter = `OR(${linkedIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const url =
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${LINE_ITEMS_TABLE}` +
    `?filterByFormula=${encodeURIComponent(filter)}`;
  const data = await airtableFetch(url, token);
  return data.records.map((r) => r.fields);
}

async function uploadPdf(token, recordId, pdfBytes) {
  const base64 = Buffer.from(pdfBytes).toString("base64");
  const url = `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${ATTACHMENT_FIELD}/uploadAttachment`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: "tilbod.pdf",
      contentType: "application/pdf",
      file: base64,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload ${res.status}: ${body}`);
  }
  return res.json();
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 48;
const CONTENT_W = A4_W - MARGIN * 2;

function clamp(y, min = MARGIN) {
  return Math.max(y, min);
}

function drawRect(page, x, y, w, h, color) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function text(page, str, x, y, font, size, color = DARK, maxWidth) {
  if (!str) return;
  const opts = { x, y, size, font, color };
  if (maxWidth) opts.maxWidth = maxWidth;
  page.drawText(String(str), opts);
}

function formatISK(num) {
  if (num === undefined || num === null || isNaN(num)) return "0 kr.";
  return (
    Math.round(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr."
  );
}

function formatDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return now.toLocaleDateString("is-IS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return new Date(dateStr).toLocaleDateString("is-IS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildPdf(project, lineItems) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4_W, A4_H]);

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  // ── Header bar ────────────────────────────────────────────────────────────
  drawRect(page, 0, A4_H - 72, A4_W, 72, DARK);

  // Company name (gold)
  text(page, "BJÖRNINN", MARGIN, A4_H - 34, fontBold, 22, GOLD);
  text(page, "INNRÉTTINGAR", MARGIN, A4_H - 52, fontBold, 13, GOLD);

  // Tagline (right-aligned area)
  const tagline = "Íslensk framleiðsla í meira en hálfa öld";
  text(page, tagline, A4_W - MARGIN - 230, A4_H - 42, fontReg, 9, WHITE);

  // ── Quote meta ────────────────────────────────────────────────────────────
  let y = A4_H - 100;

  const quoteNum = project["Tilboðsnúmer"] || project["Name"] || "—";
  const customerName =
    project["Tengiliðir"] ||
    project["Viðskiptavinur"] ||
    project["Customer"] ||
    "Viðskiptavinur";
  const quoteLabel = `Tilboð: T-${quoteNum} | ${customerName}`;
  text(page, quoteLabel, MARGIN, y, fontBold, 13, DARK);

  const today = formatDate(null);
  const dateStr = `Dagsetning: ${today}`;
  const dateW = fontReg.widthOfTextAtSize(dateStr, 9);
  text(page, dateStr, A4_W - MARGIN - dateW, y, fontReg, 9, GRAY);

  y -= 14;
  const validStr = "Tilboð gildir í 30 daga frá útgáfudegi";
  text(page, validStr, MARGIN, y, fontReg, 8, GRAY);

  // ── Divider ───────────────────────────────────────────────────────────────
  y -= 10;
  drawRect(page, MARGIN, y, CONTENT_W, 1, GOLD);
  y -= 16;

  // ── Two-column info block ─────────────────────────────────────────────────
  const colL = MARGIN;
  const colR = MARGIN + CONTENT_W * 0.5 + 10;

  // Left: customer info
  text(page, "TENGILIÐUR", colL, y, fontBold, 7, GOLD);
  y -= 12;
  const phone = project["Sími"] || project["Phone"] || "";
  const email = project["Netfang"] || project["Email"] || "";
  const addr = project["Heimilisfang"] || project["Address"] || "";
  text(page, String(customerName), colL, y, fontBold, 9, DARK);
  if (phone) { y -= 11; text(page, phone, colL, y, fontReg, 8, GRAY); }
  if (email) { y -= 11; text(page, email, colL, y, fontReg, 8, GRAY); }
  if (addr)  { y -= 11; text(page, addr,  colL, y, fontReg, 8, GRAY); }

  // Right: material spec
  const infoTop = y + (phone ? 11 : 0) + (email ? 11 : 0) + (addr ? 11 : 0) + 12;
  let yR = infoTop;
  text(page, "EFNISVAL", colR, yR, fontBold, 7, GOLD);
  yR -= 12;

  const specs = [
    ["Innvols", project["Skrokkaefni"] || "Egger hvítt 18mm"],
    ["Framhliðar", project["Frontaefni"] || "—"],
    ["Kantlíming", project["Kantlíming"] || "Matching ABS"],
    ["Búnaður", "Blum (mjúk lokun)"],
  ];
  for (const [label, val] of specs) {
    text(page, `${label}:`, colR, yR, fontBold, 8, DARK, 80);
    text(page, val, colR + 82, yR, fontReg, 8, GRAY, 150);
    yR -= 11;
  }

  // Standard description block (right column)
  yR -= 4;
  const desc =
    "Verð er án uppsetningar og flutnings nema annað komi fram. " +
    "Allt efni er úr hágæða Egger spónum. " +
    "Búnaður er frá Blum — mjúk lokun á öllum skúffum og hurðum.";
  // Draw wrapped desc text
  const descWords = desc.split(" ");
  let line = "";
  const lineH = 10;
  const maxW = CONTENT_W * 0.47;
  for (const word of descWords) {
    const test = line ? `${line} ${word}` : word;
    if (fontReg.widthOfTextAtSize(test, 7.5) > maxW) {
      text(page, line, colR, yR, fontReg, 7.5, GRAY);
      yR -= lineH;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { text(page, line, colR, yR, fontReg, 7.5, GRAY); yR -= lineH; }

  // Move main y to below both columns
  y = Math.min(y - 10, yR - 10);

  // ── Line items table ──────────────────────────────────────────────────────
  y -= 8;
  drawRect(page, MARGIN, y, CONTENT_W, 1, GOLD);
  y -= 18;

  // Column widths
  const cols = [
    { label: "Vörur",         key: "Vörur",        w: 0.30 },
    { label: "Útfærslur",     key: "Útfærslur",    w: 0.22 },
    { label: "Magn",          key: "Magn",         w: 0.08, align: "right" },
    { label: "Afsl.",         key: "Afsláttur",    w: 0.08, align: "right" },
    { label: "Einingarverð",  key: "Einingarverð", w: 0.16, align: "right" },
    { label: "Samtals m. vsk.", key: null,          w: 0.16, align: "right" },
  ];

  // Compute pixel widths
  let xCursor = MARGIN;
  const colDefs = cols.map((c) => {
    const pw = CONTENT_W * c.w;
    const def = { ...c, x: xCursor, pw };
    xCursor += pw;
    return def;
  });

  // Header row
  drawRect(page, MARGIN, y - 4, CONTENT_W, 18, DARK);
  for (const col of colDefs) {
    const lw = fontBold.widthOfTextAtSize(col.label, 7.5);
    const lx =
      col.align === "right"
        ? col.x + col.pw - lw - 4
        : col.x + 4;
    text(page, col.label, lx, y + 1, fontBold, 7.5, WHITE);
  }
  y -= 22;

  // Data rows
  let subtotalExVat = 0;
  const ROW_H = 16;

  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const qty = parseFloat(item["Magn"] ?? item["Quantity"] ?? 1) || 1;
    const unitPrice = parseFloat(item["Einingarverð"] ?? item["Unit Price"] ?? 0) || 0;
    const discPct = parseFloat(item["Afsláttur"] ?? item["Discount"] ?? 0) || 0;
    const lineExVat = unitPrice * qty * (1 - discPct / 100);
    const lineInclVat = lineExVat * (1 + VAT_RATE);
    subtotalExVat += lineExVat;

    // Alternating row background
    if (i % 2 === 0) {
      drawRect(page, MARGIN, y - 4, CONTENT_W, ROW_H, LIGHT);
    }

    const rowData = [
      item["Vörur"] || item["Name"] || "—",
      item["Útfærslur"] || item["Description"] || "",
      qty.toString(),
      discPct ? `${discPct}%` : "—",
      formatISK(unitPrice),
      formatISK(lineInclVat),
    ];

    for (let ci = 0; ci < colDefs.length; ci++) {
      const col = colDefs[ci];
      const val = String(rowData[ci] ?? "");
      const vw = fontReg.widthOfTextAtSize(val, 8);
      const vx =
        col.align === "right"
          ? col.x + col.pw - vw - 4
          : col.x + 4;
      text(page, val, vx, y + 1, fontReg, 8, DARK);
    }
    y -= ROW_H;

    // Page break guard (leave 120px for totals/footer)
    if (y < 120 + MARGIN) {
      // In a full implementation you'd add a new page here;
      // for now stop rendering items to avoid overflow.
      break;
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  y -= 10;
  drawRect(page, MARGIN, y, CONTENT_W, 1, GRAY);
  y -= 14;

  const vatAmount = subtotalExVat * VAT_RATE;
  const totalInclVat = subtotalExVat + vatAmount;
  const totalsX = A4_W - MARGIN - 200;

  const totals = [
    { label: "Samtals (án VSK):",  value: formatISK(subtotalExVat), bold: false },
    { label: "VSK 11%:",           value: formatISK(vatAmount),     bold: false },
  ];

  for (const row of totals) {
    const font = row.bold ? fontBold : fontReg;
    text(page, row.label, totalsX, y, font, 9, GRAY);
    const vw = font.widthOfTextAtSize(row.value, 9);
    text(page, row.value, A4_W - MARGIN - vw, y, font, 9, GRAY);
    y -= 13;
  }

  // Grand total row
  drawRect(page, MARGIN, y - 6, CONTENT_W, 22, DARK);
  const gtLabel = "Samtals m. vsk.:";
  const gtValue = formatISK(totalInclVat);
  text(page, gtLabel, totalsX, y + 3, fontBold, 11, GOLD);
  const gtw = fontBold.widthOfTextAtSize(gtValue, 13);
  text(page, gtValue, A4_W - MARGIN - gtw, y + 2, fontBold, 13, WHITE);
  y -= 30;

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = MARGIN + 10;
  drawRect(page, 0, 0, A4_W, footerY + 52, DARK);

  const footerLines = [
    "Tilboði fylgir hvorki uppsetning né flutningur nema það komi sérstaklega fram.",
    "Skilmálar: https://www.bjorninninnrettingar.is/skilmálar",
    "Mikilvægt er að kynna sér skilmála — innborgun er samþykki við skilmálum.",
    "Endurgreiðsla á staðfestingargjaldi er ekki möguleg undir neinum kringumstæðum.",
  ];
  let fy = footerY + 46;
  for (const line of footerLines) {
    text(page, line, MARGIN, fy, fontReg, 7, GRAY);
    fy -= 10;
  }

  // Company info line
  text(
    page,
    "Björninn ehf. · Álfhella 5, 221 Hafnarfjörður · bjorninn@bjorninninnrettingar.is · bjorninninnrettingar.is",
    MARGIN,
    footerY - 2,
    fontReg,
    7,
    GRAY
  );

  return doc.save();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify webhook secret
  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });
  }

  const { recordId } = req.body || {};
  if (!recordId) {
    return res.status(400).json({ error: "recordId is required" });
  }

  try {
    console.log(`Generating quote for record: ${recordId}`);

    const [project, lineItems] = await Promise.all([
      getProject(token, recordId),
      getLineItems(token, recordId),
    ]);

    console.log(`Fetched project "${project["Name"] || recordId}" with ${lineItems.length} line items`);

    const pdfBytes = await buildPdf(project, lineItems);

    console.log(`PDF built (${pdfBytes.length} bytes), uploading…`);

    await uploadPdf(token, recordId, pdfBytes);

    console.log("Upload complete.");

    return res.status(200).json({
      success: true,
      recordId,
      pdfSize: pdfBytes.length,
      lineItemCount: lineItems.length,
    });
  } catch (err) {
    console.error("Quote generation failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
