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
const GRAY = rgb(0.431, 0.431, 0.431);

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
function stripEmoji(str) {
  return String(str).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();
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
  line(page, MARGIN, footerY + 20, PW - MARGIN, footerY + 20, rgb(0.941, 0.941, 0.941), 0.5);
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

// ── Cover page ────────────────────────────────────────────────────────────────

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

  const PW = 595.28;
  const PH = 841.89;
  const CW = PW - MARGIN * 2;
  const LABEL_W = 155;

  function newPage() {
    return doc.addPage([PW, PH]);
  }

  let page = newPage();
  let y = drawHeader(page, logoImg, PW, PH, fontBold, fontReg);

  function checkBreak(reserve = 40) {
    if (y > MARGIN + reserve) return;
    page = newPage();
    line(page, MARGIN, PH - 28, PW - MARGIN, PH - 28, GOLD, 0.5);
    txt(page, "BJÖRNINN INNRÉTTINGAR — framhald", MARGIN, PH - 20, fontReg, 7.5, GRAY);
    y = PH - 48;
  }

  txt(page, "VERKEFNISYFIRLIT", MARGIN, y, fontBold, 8, GOLD);
  y -= 16;
  txt(page, project[PROJECT_NAME_FIELD] || "Verkefni", MARGIN, y, fontBold, 18, DARK);
  y -= 22;
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1);
  y -= 20;

  function sectionHeader(label) {
    checkBreak(30);
    txt(page, label, MARGIN, y, fontBold, 9, GOLD);
    y -= 14;
  }

  function row(label, value) {
    if (!value) return;
    checkBreak(30);
    const lines = wrapText(fontReg, String(value), 9, CW - LABEL_W);
    txt(page, `${label}:`, MARGIN, y, fontBold, 9, DARK);
    txt(page, lines[0] || "", MARGIN + LABEL_W, y, fontReg, 9, GRAY);
    y -= 13;
    for (const extra of lines.slice(1)) {
      checkBreak(30);
      txt(page, extra, MARGIN + LABEL_W, y, fontReg, 9, GRAY);
      y -= 13;
    }
  }

  function paragraph(label, value) {
    if (!value) return;
    checkBreak(50);
    txt(page, label, MARGIN, y, fontBold, 9, GOLD);
    y -= 14;
    for (const para of String(value).split("\n")) {
      for (const l of wrapText(fontReg, para, 9, CW)) {
        checkBreak(30);
        txt(page, l, MARGIN, y, fontReg, 9, DARK);
        y -= 13;
      }
    }
    y -= 8;
  }

  // ── Efnisval ──────────────────────────────────────────────────────────────
  sectionHeader("EFNISVAL");
  row("Skrokkaefni", lv(project[F.skrokkaefni]));
  row("Frontaefni", lv(project[F.frontaefni1]));
  row("Frontaefni 2", lv(project[F.frontaefni2]));
  row("Hurðaefni", lv(project[F.hurdaefni1]));
  row("Hurðaefni 2", lv(project[F.hurdaefni2]));
  row("Borðplata", lv(project[F.bordplata]));
  row("Kantlíming skrokka", project[F.kantliming]);
  const holdur1 = [lv(project[F.holdur1Nafn]), project[F.holdur1Litur]].filter(Boolean).join(" — ");
  const holdur2 = [lv(project[F.holdur2Nafn]), project[F.holdur2Litur]].filter(Boolean).join(" — ");
  row("Höldur 1", holdur1);
  row("Höldur 2", holdur2);
  y -= 8;

  // ── Verkefni ──────────────────────────────────────────────────────────────
  sectionHeader("VERKEFNI");
  row("Skipulagsaðili", project[F.skipulagsadili]);
  row("Ábyrgðaraðili yfirferðar", project[F.abyrgdaradili]);
  row("Áætluð afhending", project[F.afhending] ? formatDate(project[F.afhending]) : null);
  y -= 8;

  // ── Markmið og pepp ───────────────────────────────────────────────────────
  sectionHeader("MARKMIÐ OG PEPP");
  row("Markmið", project[F.markmid]);
  row("Pepp", project[F.pepp]);
  y -= 8;

  // ── Athugasemdir (long free text, can spill onto page 2) ───────────────────
  paragraph("ÞAÐ SEM FRÆSARI ÞARF AÐ HAFA Í HUGA", project[F.fraesari]);
  paragraph("VERKLÝSING TEIKNARA", project[F.verklysing]);

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
