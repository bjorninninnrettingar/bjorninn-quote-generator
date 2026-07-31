// api/generate-extra-order-pdf.js
// Björninn ehf. — Auka-Pöntunarlisti (extra/forgotten items) PDF Generator
// Lean sibling of generate-order-pdf.js: same header/footer/title styling,
// but a flat table (no Gerð-grouping, no images, no per-line price) showing
// only Vara/Efni name + Dýpt [AP] + Litur [AP] + Magn + Glósur [AP], plus the
// total cost straight from Auka-Pöntunarlisti's own rollup field.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AIRTABLE_BASE  = "app91U15z9K704Okd";
const EXTRA_TABLE    = "tblHGYgrvvDqyKOAe"; // Auka-Pöntunarlisti 💻
const PURCHASE_TABLE = "tbloXR7f9Q943O9el"; // Pöntunarlisti 📋
const PDF_FIELD_ID   = "fldKtSQ766lXlnaRa"; // Auka-Pöntunarlisti 💻 → Auka pöntunarlisti PDF (attachment)
const LINES_FIELD     = "Pöntunarlisti 📋";  // Auka-Pöntunarlisti 💻 → linked lines
const TOTAL_FIELD     = "Áætlaður kostnaður Rollup (from Pöntunarlisti 📋)"; // Auka-Pöntunarlisti 💻's own rollup

// Brand colours — same palette as generate-order-pdf.js
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

async function getExtraOrder(token, recordId) {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EXTRA_TABLE}/${recordId}`,
    token
  );
  return data.fields;
}

// Two fetches against the same lines, merged by record ID: cellFormat=string
// resolves the Vörulisti 🚪/Efnislisti 🧱 link fields to the linked record's
// own display name (default format only gives a bare record ID) — but that
// same cellFormat also flattens attachment fields (Mynd af vöru/Mynd af efni)
// down to filenames, losing the URL needed to embed the thumbnail. So names
// come from the string-format call and everything else, incl. images, from
// the plain JSON one. timeZone/userLocale are required by Airtable whenever
// cellFormat=string is used and the table has any date/dateTime field
// (Pöntunarlisti's Created/Síðast uppfært do), even restricted to these two fields.
async function getLines(token, linkedIds) {
  if (!linkedIds || linkedIds.length === 0) return [];
  const filter = `OR(${linkedIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`;

  const rawData = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PURCHASE_TABLE}?filterByFormula=${encodeURIComponent(filter)}`,
    token
  );

  const nameParams = new URLSearchParams({
    filterByFormula: filter,
    cellFormat: "string",
    timeZone: "Atlantic/Reykjavik",
    userLocale: "is",
  });
  nameParams.append("fields[]", "Vörulisti 🚪");
  nameParams.append("fields[]", "Efnislisti 🧱");
  const nameData = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PURCHASE_TABLE}?${nameParams.toString()}`,
    token
  );

  const recordMap = Object.fromEntries(rawData.records.map((r) => [r.id, r.fields]));
  const nameMap = Object.fromEntries(nameData.records.map((r) => [r.id, r.fields]));

  return linkedIds
    .map((id) => {
      const fields = recordMap[id];
      if (!fields) return null;
      const names = nameMap[id] || {};
      return {
        ...fields,
        "Vörulisti 🚪": names["Vörulisti 🚪"],
        "Efnislisti 🧱": names["Efnislisti 🧱"],
      };
    })
    .filter(Boolean);
}

async function clearAttachment(token, recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${EXTRA_TABLE}/${recordId}`,
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
// Compound emoji (e.g. "🐻‍❄️") are sequences joined by U+200D with trailing
// U+FE0F/FE0E variation selectors and U+1F3FB–FF skin-tone modifiers — none of
// which \p{Extended_Pictographic} alone matches, so strip those explicitly too
// or a stray joiner/selector crashes WinAnsi encoding on its own.
function stripEmoji(str) {
  return String(str)
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Emoji_Modifier}‍︎️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function txt(page, str, x, y, font, size, color = DARK) {
  if (str === null || str === undefined || str === "") return;
  const clean = stripEmoji(str);
  if (!clean) return;
  page.drawText(clean, { x, y, size, font, color });
}

function truncate(font, str, size, maxW) {
  str = stripEmoji(str);
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

// ── Extra order PDF ───────────────────────────────────────────────────────────

async function buildExtraOrderPdf(extraOrder, lines) {
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

  // Title — "Name" is a formula field already producing "AP{ID} - {project}"
  const title = extraOrder["Name"] || "Auka pöntun";
  txt(page, `AUKA-PÖNTUN — ${title}`, MARGIN, y, fontBold, 14, DARK);
  y -= 24;

  // Callout — no delivery date/supplier on this table, just the standing note
  // that these are items forgotten or added after the original order.
  rect(page, MARGIN, y - 26, CW, 34, GOLD_TINT);
  txt(
    page,
    "Viðbótarpöntun — vörur sem gleymdust eða bættust við eftir upphaflegu pöntunina.",
    MARGIN + 10,
    y - 4,
    fontBold,
    9,
    DARK
  );
  y -= 42;

  // ── Flat line-item table — no Gerð grouping, no per-line price.
  // Always exactly one page: row height shrinks to fit whatever's left.
  const cols = [
    { label: "Vara / Efni", w: 0.45, align: "left"   },
    { label: "Magn",        w: 0.05, align: "center" },
    { label: "Dýpt",        w: 0.05, align: "center" },
    { label: "Mynd",        w: 0.10, align: "center" },
    { label: "Litur",       w: 0.05, align: "left"   },
    { label: "Glósur",      w: 0.30, align: "left"   },
  ];

  let xCur = MARGIN;
  const colDefs = cols.map((c) => {
    const pw = CW * c.w;
    const def = { ...c, x: xCur, pw };
    xCur += pw;
    return def;
  });

  // Pre-embed every unique product/material thumbnail before drawing rows —
  // embedding is async, drawing each row is not, so this keeps the row loop simple.
  const imageCache = new Map();
  for (const item of lines) {
    const url = firstImageUrl(item["Mynd af vöru"], item["Mynd af efni"]);
    if (url) await embedImage(doc, url, imageCache);
  }

  const COLUMN_HEADER_H = 16;
  const FOOTER_RESERVE  = 46; // total line + rule + footer text

  const usableForRows = y - COLUMN_HEADER_H - (MARGIN + FOOTER_RESERVE);
  const rowCount = lines.length || 1;
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

  let rowIndex = 0;
  for (const item of lines) {
    // Vörulisti 🚪 first, else Efnislisti 🧱 — mirrors the priority the
    // original "Vörulisti txt" formula uses. cellFormat=string resolves
    // these link fields to the linked record's own display name.
    const name = stripEmoji(item["Vörulisti 🚪"] || item["Efnislisti 🧱"] || "") || "—";
    const qty   = item["Magn"] ?? "";
    const dypt   = stripEmoji(item["Dýptir [AP]"] || "") || "—";
    const litur  = stripEmoji(item["Litur [AP]"] || "") || "—";
    const glosur = stripEmoji(item["Glósur [AP]"] || "") || "—";

    if (rowIndex % 2 === 0) rect(page, MARGIN, y - ROW_H, CW, ROW_H, LIGHT);

    const textY = y - ROW_H / 2 - FONT_SIZE / 3;

    const nameCol = colDefs[0];
    txt(page, truncate(fontReg, name, FONT_SIZE, nameCol.pw - 6), nameCol.x + 3, textY, fontReg, FONT_SIZE, DARK);

    const qtyCol = colDefs[1];
    const qtyStr = String(qty);
    const qw = fontReg.widthOfTextAtSize(qtyStr, FONT_SIZE);
    txt(page, qtyStr, qtyCol.x + (qtyCol.pw - qw) / 2, textY, fontReg, FONT_SIZE, DARK);

    const dyptCol = colDefs[2];
    const dw = fontReg.widthOfTextAtSize(dypt, FONT_SIZE);
    txt(page, dypt, dyptCol.x + (dyptCol.pw - dw) / 2, textY, fontReg, FONT_SIZE, DARK);

    // Centered within the row's full height/width — drawThumb itself scales
    // to fit and centers within whatever box it's given.
    const imgCol = colDefs[3];
    const url = firstImageUrl(item["Mynd af vöru"], item["Mynd af efni"]);
    const img = url ? imageCache.get(url) : null;
    drawThumb(page, img, imgCol.x, y - ROW_H, imgCol.pw, ROW_H);

    const colorCol = colDefs[4];
    txt(page, truncate(fontReg, litur, FONT_SIZE, colorCol.pw - 6), colorCol.x + 3, textY, fontReg, FONT_SIZE, DARK);

    const notesCol = colDefs[5];
    txt(page, truncate(fontReg, glosur, FONT_SIZE, notesCol.pw - 6), notesCol.x + 3, textY, fontReg, FONT_SIZE, DARK);

    y -= ROW_H;
    rowIndex++;
  }

  // ── Total — straight from Auka-Pöntunarlisti's own rollup field, not
  // recomputed per line (Auka lines don't reliably carry a cost basis).
  y -= 8;
  line(page, MARGIN, y, PW - MARGIN, y, GRAY, 0.4);
  y -= 16;

  const totalLabel = "Áætlaður kostnaður samtals:";
  const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 10);
  const gtv = formatISK(extraOrder[TOTAL_FIELD] ?? 0);
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
    console.log(`Generating extra-order PDF for record: ${recordId}`);

    const extraOrder = await getExtraOrder(token, recordId);
    const linkedIds = extraOrder[LINES_FIELD] || [];
    const lines = await getLines(token, linkedIds);

    const safeTitle = (extraOrder["Name"] || "Auka-pontun")
      .replace(/[/\\:*?"<>]/g, "-")
      .trim();

    console.log("Clearing old attachment…");
    await clearAttachment(token, recordId);

    console.log(`Building PDF — ${lines.length} line(s)`);
    const pdfBytes = await buildExtraOrderPdf(extraOrder, lines);
    await uploadPdf(token, recordId, pdfBytes, `${safeTitle}.pdf`);

    console.log("Done.");

    return res.status(200).json({ success: true, recordId, lineCount: lines.length });
  } catch (err) {
    console.error("Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
