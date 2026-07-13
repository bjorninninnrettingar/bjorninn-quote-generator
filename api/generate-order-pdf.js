// api/generate-order-pdf.js
// Björninn ehf. — Purchase Order PDF Generator
// pdf-lib, pure JS, no native deps. Mirrors generate-quote.js's structure.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AIRTABLE_BASE   = "app91U15z9K704Okd";
const ORDERS_TABLE    = "tblSccfV2lBp4FiFU"; // Pantaðir listar
const PURCHASE_TABLE  = "tbloXR7f9Q943O9el"; // Pöntunarlisti 📋
const PDF_FIELD_ID    = "fldtAwH9pxf3QSNO3"; // Pantaðir listar → PDF (attachment)
const LINES_FIELD     = "Pöntunarlisti 📋";  // Pantaðir listar → linked lines

// Brand colours — same palette as generate-quote.js
const GOLD      = rgb(0.808, 0.694, 0.388);
const DARK      = rgb(0.102, 0.102, 0.102);
const GRAY      = rgb(0.431, 0.431, 0.431);
const LIGHT     = rgb(0.941, 0.941, 0.941);
const GOLD_TINT = rgb(0.980, 0.961, 0.906);

const MARGIN = 48;

const LOGO_URL =
  "https://raw.githubusercontent.com/bjorninninnrettingar/bjorninn-quote-generator/main/Lo%CC%81go%CC%81%20a%CC%81%20hvi%CC%81tum.png";
let _logoCache = null;
async function getLogo() {
  if (_logoCache) return _logoCache;
  try {
    const res = await fetch(LOGO_URL);
    if (res.ok) _logoCache = new Uint8Array(await res.arrayBuffer());
    else console.warn("Logo fetch status:", res.status);
  } catch (e) {
    console.warn("Logo fetch failed:", e.message);
  }
  return _logoCache;
}

// ── Airtable ──────────────────────────────────────────────────────────────────

async function airtableFetch(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getOrder(token, recordId) {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${ORDERS_TABLE}/${recordId}`,
    token
  );
  return data.fields;
}

async function getLines(token, linkedIds) {
  if (!linkedIds || linkedIds.length === 0) return [];
  const filter = `OR(${linkedIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PURCHASE_TABLE}?filterByFormula=${encodeURIComponent(filter)}`,
    token
  );
  const recordMap = Object.fromEntries(data.records.map((r) => [r.id, r.fields]));
  return linkedIds.map((id) => recordMap[id]).filter(Boolean);
}

async function clearAttachment(token, recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${ORDERS_TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { [PDF_FIELD_ID]: [] } }),
    }
  );
  if (!res.ok) console.warn(`clearAttachment: ${res.status} ${await res.text()}`);
}

async function uploadPdf(token, recordId, pdfBytes, filename) {
  const res = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${PDF_FIELD_ID}/uploadAttachment`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        contentType: "application/pdf",
        file: Buffer.from(pdfBytes).toString("base64"),
      }),
    }
  );
  if (!res.ok) throw new Error(`Upload ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

function formatISK(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return "0 kr.";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr.";
}

function formatDate(val) {
  const d = val ? new Date(val) : new Date();
  return d.toLocaleDateString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Standard PDF fonts can't encode emoji (e.g. Litur's colour-swatch glyphs) —
// stripping them avoids a hard crash on drawText for any field that has one.
function stripEmoji(str) {
  return String(str).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

function txt(page, str, x, y, font, size, color = DARK) {
  if (str === null || str === undefined || str === "") return;
  const clean = stripEmoji(str);
  if (!clean) return;
  page.drawText(clean, { x, y, size, font, color });
}

function truncate(font, str, size, maxW) {
  str = String(str);
  if (font.widthOfTextAtSize(str, size) <= maxW) return str;
  while (str.length > 1 && font.widthOfTextAtSize(str + "…", size) > maxW) {
    str = str.slice(0, -1);
  }
  return str + "…";
}

// ── Image helpers (product/material thumbnails) ────────────────────────────

function firstImageUrl(...fieldValues) {
  for (const val of fieldValues) {
    if (!Array.isArray(val) || !val.length) continue;
    let att = val[0];
    if (Array.isArray(att)) att = att[0];
    const url = att?.thumbnails?.large?.url || att?.url;
    if (url) return url;
  }
  return null;
}

async function embedImage(doc, url, cache) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  let img = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      try { img = await doc.embedJpg(bytes); }
      catch { img = await doc.embedPng(bytes); }
    }
  } catch (e) {
    console.warn("Image embed failed:", url, e.message);
  }
  cache.set(url, img);
  return img;
}

function drawThumb(page, img, cellX, cellY, cellW, cellH) {
  if (!img) return;
  const scale = Math.min(cellW / img.width, cellH / img.height) * 0.85;
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: cellX + (cellW - w) / 2, y: cellY + (cellH - h) / 2, width: w, height: h });
}

function rect(page, x, y, w, h, color) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function line(page, x1, y1, x2, y2, color = GOLD, thickness = 0.75) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

function drawHeader(page, logoImg, PW, PH, fontBold, fontReg) {
  let y = PH - MARGIN;
  const LOGO_W = 180;

  if (logoImg) {
    const LOGO_H = Math.round(LOGO_W * logoImg.height / logoImg.width);
    page.drawImage(logoImg, { x: MARGIN, y: y - LOGO_H / 2, width: LOGO_W, height: LOGO_H });

    const dateStr = `Dagsetning: ${formatDate()}`;
    const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
    txt(page, dateStr, PW - MARGIN - dateW, y, fontReg, 8, GRAY);

    y -= LOGO_H / 2 + 6;
  } else {
    txt(page, "BJÖRNINN", MARGIN, y, fontBold, 22, GOLD);
    const brandW = fontBold.widthOfTextAtSize("BJÖRNINN", 22);
    const subW   = fontReg.widthOfTextAtSize("INNRÉTTINGAR", 11);
    txt(page, "INNRÉTTINGAR", MARGIN + brandW - subW, y - 16, fontReg, 11, DARK);

    const dateStr = `Dagsetning: ${formatDate()}`;
    const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
    txt(page, dateStr, PW - MARGIN - dateW, y, fontReg, 8, GRAY);

    y -= 28;
  }

  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1);
  return y - 16;
}

function drawFooter(page, PW, fontReg) {
  const footerY = 9;
  line(page, MARGIN, footerY + 20, PW - MARGIN, footerY + 20, LIGHT, 0.5);
  txt(
    page,
    "Björninn ehf.  |  Álfhella 5, 221 Hafnarfjörður  |  bjorninn@bjorninninnrettingar.is  |  bjorninninnrettingar.is",
    MARGIN,
    footerY + 14,
    fontReg,
    6.5,
    GRAY
  );
}

// ── Order PDF ─────────────────────────────────────────────────────────────────

async function buildOrderPdf(order, lines) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);

  const logoBytes = await getLogo();
  let logoImg = null;
  if (logoBytes) {
    try { logoImg = await doc.embedPng(logoBytes); } catch (e) {
      console.warn("Logo embed failed:", e.message);
    }
  }

  const PW = 841.89;
  const PH = 595.28;
  const CW = PW - MARGIN * 2;

  function newPage() {
    return doc.addPage([PW, PH]);
  }

  let page = newPage();
  let y = drawHeader(page, logoImg, PW, PH, fontBold, fontReg);

  // Title
  const title = order["Stöðu kenni"] || "Pöntun";
  txt(page, `PÖNTUN — ${title}`, MARGIN, y, fontBold, 14, DARK);
  y -= 24;

  // Delivery / instructions callout
  const deliveryDate = order["Afhending óskuð"] ? formatDate(order["Afhending óskuð"]) : null;
  rect(page, MARGIN, y - 34, CW, 42, GOLD_TINT);
  let cy = y - 4;
  if (deliveryDate) {
    txt(page, `Óskað er eftir afhendingu eigi síðar en: ${deliveryDate}`, MARGIN + 10, cy, fontBold, 10, DARK);
    cy -= 15;
  }
  txt(
    page,
    "Vinsamlegast afgreiðið alla pöntunina í einu lagi — ekki í hlutum.",
    MARGIN + 10,
    cy,
    fontBold,
    9,
    DARK
  );
  y -= 50;

  // ── Sort + group by Gerð ─────────────────────────────────────────────────
  const GERD_ORDER = ["Skúffur", "Höldur", "Fylgihlutir", "Stök vara", "Plötur", "Harðplast", "Kantlíming", "Spónlagt"];
  function gerdRank(g) {
    const i = GERD_ORDER.indexOf(g);
    return i === -1 ? GERD_ORDER.length : i;
  }
  const sortedLines = [...lines].sort((a, b) => gerdRank(a["Gerð"]) - gerdRank(b["Gerð"]));
  const groupCount = new Set(sortedLines.map((item) => item["Gerð"] || "Annað")).size;

  // Pre-embed every unique product/material thumbnail before drawing rows —
  // embedding is async, drawing each row is not, so this keeps the row loop simple.
  const imageCache = new Map();
  for (const item of sortedLines) {
    const url = firstImageUrl(item["Mynd af vöru"], item["Mynd af efni"]);
    if (url) await embedImage(doc, url, imageCache);
  }

  // ── Line items table — always exactly one page. Row height is computed
  // from however much vertical space is left, so it shrinks automatically
  // as the order gets longer instead of ever spilling onto a page 2.
  const cols = [
    { label: "Vörulisti txt", w: 0.44, align: "left",   clip: true },
    { label: "Magn",          w: 0.08, align: "center", clip: false },
    { label: "Mynd",          w: 0.13, align: "center", clip: false },
    { label: "Litur",         w: 0.35, align: "left",   clip: true },
  ];

  let xCur = MARGIN;
  const colDefs = cols.map((c) => {
    const pw = CW * c.w;
    const def = { ...c, x: xCur, pw };
    xCur += pw;
    return def;
  });

  const COLUMN_HEADER_H = 16;
  const GROUP_HEADER_H  = 14;
  const GROUP_GAP       = 6; // breathing room between one group's last row and the next group's header
  const FOOTER_RESERVE  = 46; // total line + rule + footer text

  const usableForRows = y - COLUMN_HEADER_H - (groupCount * GROUP_HEADER_H)
    - ((groupCount - 1) * GROUP_GAP) - (MARGIN + FOOTER_RESERVE);
  const rowCount = sortedLines.length || 1;
  const ROW_H = Math.max(6, Math.min(20, usableForRows / rowCount));
  const FONT_SIZE = ROW_H >= 15 ? 7.5 : ROW_H >= 10 ? 6.5 : 5.5;

  // Every block below follows the same convention: y is the top edge of the
  // space still to be drawn. A block occupies [y - H, y], then y -= H. No
  // fudge-factor offsets, so adjacent blocks can never overlap each other.
  rect(page, MARGIN, y - COLUMN_HEADER_H, CW, COLUMN_HEADER_H, GOLD_TINT);
  for (const col of colDefs) {
    const lw = fontBold.widthOfTextAtSize(col.label, 7);
    const lx = col.align === "right"  ? col.x + col.pw - lw - 3
             : col.align === "center" ? col.x + (col.pw - lw) / 2
             : col.x + 3;
    txt(page, col.label, lx, y - COLUMN_HEADER_H + 5, fontBold, 7, DARK);
  }
  y -= COLUMN_HEADER_H;
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 0.5);

  let totalCost = 0;
  let currentGerd = null;
  let rowIndex = 0;

  for (const item of sortedLines) {
    const gerd = item["Gerð"] || "Annað";
    if (gerd !== currentGerd) {
      if (currentGerd !== null) y -= GROUP_GAP;
      currentGerd = gerd;
      line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1.5);
      rect(page, MARGIN, y - GROUP_HEADER_H, CW, GROUP_HEADER_H, LIGHT);
      txt(page, gerd, MARGIN + 6, y - GROUP_HEADER_H + 5, fontBold, 7, DARK);
      y -= GROUP_HEADER_H;
      rowIndex = 0;
    }

    const name  = stripEmoji(item["Vörulisti txt"] || item["Vörunúmer #️⃣"] || "") || "—";
    const qty   = item["Magn"] ?? "";
    const litur = stripEmoji(item["Litur"] || "") || "—";
    const cost  = parseFloat(item["Áætlaður kostnaður"] ?? 0) || 0;
    totalCost += cost;

    if (rowIndex % 2 === 0) rect(page, MARGIN, y - ROW_H, CW, ROW_H, LIGHT);

    const textY = y - ROW_H / 2 - FONT_SIZE / 3;

    const nameCol = colDefs[0];
    txt(page, truncate(fontReg, name, FONT_SIZE, nameCol.pw - 6), nameCol.x + 3, textY, fontReg, FONT_SIZE, DARK);

    const qtyCol = colDefs[1];
    const qtyStr = String(qty);
    const qw = fontReg.widthOfTextAtSize(qtyStr, FONT_SIZE);
    txt(page, qtyStr, qtyCol.x + (qtyCol.pw - qw) / 2, textY, fontReg, FONT_SIZE, DARK);

    // Centered within the row's full height/width — drawThumb itself scales
    // to fit and centers within whatever box it's given.
    const imgCol = colDefs[2];
    const url = firstImageUrl(item["Mynd af vöru"], item["Mynd af efni"]);
    const img = url ? imageCache.get(url) : null;
    drawThumb(page, img, imgCol.x, y - ROW_H, imgCol.pw, ROW_H);

    const colorCol = colDefs[3];
    txt(page, truncate(fontReg, litur, FONT_SIZE, colorCol.pw - 6), colorCol.x + 3, textY, fontReg, FONT_SIZE, DARK);

    y -= ROW_H;
    rowIndex++;
  }

  // ── Total ────────────────────────────────────────────────────────────────
  y -= 8;
  line(page, MARGIN, y, PW - MARGIN, y, GRAY, 0.4);
  y -= 16;

  const totalLabel = "Áætlaður kostnaður samtals:";
  const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 10);
  const gtv = formatISK(totalCost);
  const gtw = fontBold.widthOfTextAtSize(gtv, 12);
  txt(page, totalLabel, PW - MARGIN - gtw - 8 - totalLabelW, y, fontBold, 10, DARK);
  txt(page, gtv, PW - MARGIN - gtw, y, fontBold, 12, GOLD);

  drawFooter(page, PW, fontReg);

  return doc.save();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  const { recordId } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "recordId is required" });

  try {
    console.log(`Generating order PDF for record: ${recordId}`);

    const order = await getOrder(token, recordId);
    const linkedIds = order[LINES_FIELD] || [];
    const lines = await getLines(token, linkedIds);

    const safeTitle = (order["Stöðu kenni"] || "Pontun")
      .replace(/[/\\:*?"<>]/g, "-")
      .trim();

    console.log("Clearing old attachment…");
    await clearAttachment(token, recordId);

    console.log(`Building PDF — ${lines.length} line(s)`);
    const pdfBytes = await buildOrderPdf(order, lines);
    await uploadPdf(token, recordId, pdfBytes, `${safeTitle}.pdf`);

    console.log("Done.");

    return res.status(200).json({ success: true, recordId, lineCount: lines.length });
  } catch (err) {
    console.error("Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
