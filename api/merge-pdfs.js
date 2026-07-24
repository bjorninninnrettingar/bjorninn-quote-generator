// api/merge-pdfs.js
// Björninn ehf. — Merge final drawings into one "loka prent" PDF, with a
// generated cover page summarizing the project up front.
// pdf-lib, pure JS, no native deps. Mirrors generate-quote.js's Airtable plumbing.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AIRTABLE_BASE      = "app91U15z9K704Okd";
const PROJECTS_TABLE     = "tbl4LMXlQjp66RFKI"; // Tækifæri 📣 (projects)
const SOURCE_FIELD_NAME  = "Loka teikningar verkefnis 📋";
const DEST_FIELD_ID      = "fldlTmH5X3G3e5rU2"; // Loka prent 🖨️✅
const PROJECT_NAME_FIELD = "Heiti tækifæris / verkefnis";

// Cover page field names — all read from the same Tækifæri record, no other table hit.
const F = {
  skrokkaefni:     "Heiti efnis (from Skrokka efni 🔲 viðskiptavinar)",
  frontaefni1:     "Heiti efnis (from Fronta efni viðskiptavinar 🖼️)",
  frontaefni2:     "Heiti efnis (from Fronta efni 2.0 Viðskiptavinar 🖼️)",
  hurdaefni1:      "Heiti efnis (from Hurðaefni viðskiptavinar 🚪)",
  hurdaefni2:      "Heiti efnis (from Hurðaefni viðskiptavinar 🚪 2.0)",
  bordplata:       "Heiti efnis (from Borðplata viðskiptavinar 🍽️)",
  kantliming:      "Kantlíming skrokka",
  holdur1Nafn:     "Heiti vöru 📣 (from Höldur Viðskiptavinar ✊)",
  holdur1Litur:    "Litur á höldum 🎨",
  holdur2Nafn:     "Heiti vöru 📣 (from Höldur Viðskiptavinar ✊2.0)",
  holdur2Litur:    "Litur á höldum 2.0 🎨",
  markmid:         "🎯 Markmið:",
  pepp:            "🚀 Pepp verksins:",
  skipulagsadili:  "Skipulagsaðili verkefnis",
  abyrgdaradili:   "Ábyrgðaraðili yfirferðar",
  fraesari:        "🔬📌 Það sem Fræsari þarf að hafa í huga",
  verklysing:      "Ýtarleg verklýsing teiknara📝",
  afhending:       "Áætlaður afhendingardagur Björninn (internal)",
};

// Brand colours — same palette as generate-quote.js
const GOLD = rgb(0.808, 0.694, 0.388);
const DARK = rgb(0.102, 0.102, 0.102);
const RED  = rgb(0.75, 0.15, 0.15); // same red as the "Verðhugmynd" watermark

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

async function getProject(token, recordId) {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    token
  );
  return data.fields;
}

async function clearDest(token, recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { [DEST_FIELD_ID]: [] } }),
    }
  );
  if (!res.ok) console.warn(`clearDest: ${res.status} ${await res.text()}`);
}

async function uploadPdf(token, recordId, pdfBytes, filename) {
  const res = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${DEST_FIELD_ID}/uploadAttachment`,
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

// ── PDF drawing helpers ─────────────────────────────────────────────────────

function lv(val) {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

function formatDate(val) {
  const d = val ? new Date(val) : new Date();
  return d.toLocaleDateString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Standard PDF fonts can't encode emoji — Airtable names/notes are full of them
// (e.g. collaborator names like "Jóel Kristjánsson 🦁") — so strip before drawing
// or measuring text, or pdf-lib throws instead of just dropping the glyph.
// Compound emoji (e.g. "🐻‍❄️") are sequences joined by U+200D with trailing
// U+FE0F/FE0E variation selectors and U+1F3FB–FF skin-tone modifiers — none of
// which \p{Extended_Pictographic} alone matches, so they'd survive the strip
// and crash WinAnsi encoding on their own.
function stripEmoji(str) {
  return String(str)
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Emoji_Modifier}\u200D\uFE0E\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function txt(page, str, x, y, font, size, color = DARK) {
  if (str === null || str === undefined || str === "") return;
  const clean = stripEmoji(str);
  if (!clean) return;
  page.drawText(clean, { x, y, size, font, color });
}

function wrapText(font, str, size, maxW) {
  const words = stripEmoji(str).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
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
    txt(page, dateStr, PW - MARGIN - dateW, y, fontReg, 8, DARK);

    y -= LOGO_H / 2 + 6;
  } else {
    txt(page, "BJÖRNINN", MARGIN, y, fontBold, 22, GOLD);
    const brandW = fontBold.widthOfTextAtSize("BJÖRNINN", 22);
    const subW   = fontReg.widthOfTextAtSize("INNRÉTTINGAR", 11);
    txt(page, "INNRÉTTINGAR", MARGIN + brandW - subW, y - 16, fontReg, 11, DARK);

    const dateStr = `Dagsetning: ${formatDate()}`;
    const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
    txt(page, dateStr, PW - MARGIN - dateW, y, fontReg, 8, DARK);

    y -= 28;
  }

  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1);
  return y - 16;
}

function drawFooter(page, PW, fontReg) {
  const footerY = 9;
  line(page, MARGIN, footerY + 20, PW - MARGIN, footerY + 20, rgb(0.941, 0.941, 0.941), 0.5);
  txt(
    page,
    "Björninn ehf.  |  Álfhella 5, 221 Hafnarfjörður  |  bjorninn@bjorninninnrettingar.is  |  bjorninninnrettingar.is",
    MARGIN,
    footerY + 14,
    fontReg,
    6.5,
    DARK
  );
}

// ── Cover page ────────────────────────────────────────────────────────────────

// Landscape, single page, four quadrants split by a gold cross. Gold is used
// only for separator lines — every label/value is dark or gray.
async function buildCoverPage(project) {
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
  const page = doc.addPage([PW, PH]);

  let y = drawHeader(page, logoImg, PW, PH, fontBold, fontReg);

  txt(page, "VERKEFNISYFIRLIT", MARGIN, y, fontReg, 8, DARK);
  y -= 16;
  const titleText = project[PROJECT_NAME_FIELD] || "Verkefni";
  txt(page, titleText, MARGIN, y, fontBold, 18, DARK);

  const afhendingVal = project[F.afhending] ? formatDate(project[F.afhending]) : null;
  if (afhendingVal) {
    const titleW = fontBold.widthOfTextAtSize(stripEmoji(titleText), 18);
    txt(page, `Áætluð afhending: ${afhendingVal}`, MARGIN + titleW + 24, y + 2, fontBold, 12, RED);
  }

  y -= 18;
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1);
  y -= 18;

  // ── Split the remaining area into four quadrants with a gold cross ─────────
  const GAP = 26;
  const contentTop    = y;
  const contentBottom = MARGIN;
  const contentLeft   = MARGIN;
  const contentRight  = PW - MARGIN;
  const midX = (contentLeft + contentRight) / 2;
  const midY = (contentTop + contentBottom) / 2;

  line(page, midX, contentTop, midX, contentBottom, GOLD, 0.75);
  line(page, contentLeft, midY, contentRight, midY, GOLD, 0.75);

  const quadW = (contentRight - contentLeft) / 2 - GAP / 2;
  const boxes = {
    tl: { x: contentLeft,    top: contentTop },
    tr: { x: midX + GAP / 2, top: contentTop },
    // Bottom quadrants get a full GAP of clearance below the divider (not
    // GAP/2) — the top quadrants' content height is sized to *just* fit above
    // the divider, so this leaves a buffer against font-metric rounding
    // instead of the two nearly touching.
    bl: { x: contentLeft,    top: midY - GAP },
    br: { x: midX + GAP / 2, top: midY - GAP },
  };

  // Each quadrant gets its own label-above-value "spec sheet" cursor — robust
  // to label length at this narrower per-quadrant width, and reads cleaner
  // than the old inline label:value layout.
  function makeQuadrant({ x, top }) {
    let qy = top;

    function header(label) {
      txt(page, label, x, qy, fontBold, 9, DARK);
      qy -= 6;
      line(page, x, qy, x + quadW, qy, GOLD, 0.5);
      qy -= 14;
    }

    function row(label, value) {
      if (!value) return;
      txt(page, label.toUpperCase(), x, qy, fontReg, 6, DARK);
      qy -= 9;
      for (const l of wrapText(fontReg, String(value), 9, quadW)) {
        txt(page, l, x, qy, fontReg, 9, DARK);
        qy -= 9;
      }
    }

    function paragraph(label, value) {
      if (!value) return;
      txt(page, label.toUpperCase(), x, qy, fontReg, 6.5, DARK);
      qy -= 12;
      for (const para of String(value).split("\n")) {
        for (const l of wrapText(fontReg, para, 8.5, quadW)) {
          txt(page, l, x, qy, fontReg, 8.5, DARK);
          qy -= 11;
        }
      }
      qy -= 6;
    }

    return { header, row, paragraph };
  }

  // ── Top-left: Efnisval ──────────────────────────────────────────────────
  const tl = makeQuadrant(boxes.tl);
  tl.header("EFNISVAL");
  tl.row("Skrokkaefni", lv(project[F.skrokkaefni]));
  tl.row("Frontaefni", lv(project[F.frontaefni1]));
  tl.row("Frontaefni 2", lv(project[F.frontaefni2]));
  tl.row("Hurðaefni", lv(project[F.hurdaefni1]));
  tl.row("Hurðaefni 2", lv(project[F.hurdaefni2]));
  tl.row("Borðplata", lv(project[F.bordplata]));
  tl.row("Kantlíming skrokka", project[F.kantliming]);
  const holdur1 = [lv(project[F.holdur1Nafn]), project[F.holdur1Litur]].filter(Boolean).join(" — ");
  const holdur2 = [lv(project[F.holdur2Nafn]), project[F.holdur2Litur]].filter(Boolean).join(" — ");
  tl.row("Höldur 1", holdur1);
  tl.row("Höldur 2", holdur2);

  // ── Top-right: Skipulags- og ábyrgðaraðili ──────────────────────────────
  const tr = makeQuadrant(boxes.tr);
  tr.header("VERKEFNI");
  tr.row("Skipulagsaðili", project[F.skipulagsadili]);
  tr.row("Ábyrgðaraðili yfirferðar", project[F.abyrgdaradili]);

  // ── Bottom-left: Markmið og pepp ────────────────────────────────────────
  const bl = makeQuadrant(boxes.bl);
  bl.header("MARKMIÐ OG PEPP");
  bl.row("Markmið", project[F.markmid]);
  bl.row("Pepp", project[F.pepp]);

  // ── Bottom-right: Fræsari og teiknari ───────────────────────────────────
  const br = makeQuadrant(boxes.br);
  br.header("ATHUGASEMDIR");
  br.paragraph("Fræsari", project[F.fraesari]);
  br.paragraph("Verklýsing teiknara", project[F.verklysing]);

  drawFooter(page, PW, fontReg);

  return doc.save();
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function isPdfAttachment(att) {
  return att.type === "application/pdf" || /\.pdf$/i.test(att.filename || "");
}

// Cover page first, then attachments in the order Airtable returns them, i.e.
// the order they're arranged in on the record — arranging them there controls
// page order here.
async function mergePdfs(coverBytes, attachments) {
  const merged = await PDFDocument.create();

  const coverDoc = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  coverPages.forEach((page) => merged.addPage(page));

  for (const att of attachments) {
    const res = await fetch(att.url);
    if (!res.ok) throw new Error(`Failed to download ${att.filename}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
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
    console.log(`Merging loka prent for record: ${recordId}`);

    const project = await getProject(token, recordId);
    const source = project[SOURCE_FIELD_NAME] || [];
    const pdfAttachments = source.filter(isPdfAttachment);

    if (pdfAttachments.length === 0) {
      return res.status(400).json({ error: `No PDF attachments found in "${SOURCE_FIELD_NAME}"` });
    }

    const safeTitle = (project[PROJECT_NAME_FIELD] || recordId)
      .replace(/[/\\:*?"<>]/g, "-")
      .trim();

    console.log("Building cover page…");
    const coverBytes = await buildCoverPage(project);

    console.log(`Merging cover page + ${pdfAttachments.length} PDF(s)…`);
    const mergedBytes = await mergePdfs(coverBytes, pdfAttachments);

    console.log("Clearing old Loka prent attachment…");
    await clearDest(token, recordId);

    await uploadPdf(token, recordId, mergedBytes, `${safeTitle} loka prent.pdf`);

    console.log("Done.");
    return res.status(200).json({
      success: true,
      recordId,
      mergedCount: pdfAttachments.length,
      skippedNonPdf: source.length - pdfAttachments.length,
    });
  } catch (err) {
    console.error("Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
