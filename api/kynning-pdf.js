// api/kynning-pdf.js — "Búa til kynningu (PDF)" (PRO, 2026-10-28): ONE PDF Rakel downloads — the first step of the sales
// process. She writes every e-mail herself; nothing is sent from here and nothing is written to Airtable.
//
// POST { k, project:{name,address,contact}, rooms:[{name,materials:[{kind,label,color,img}]}], images:[{title,jpeg}],
//        report:{lines:[…]}, quote:{rooms:[{name,lines:[{name,extra,qty,total}]}], handles:{count,total}|null, total} }
//   k      the office key (VERK_KEY) — same as tilbod-print; a floor token is NOT enough
//   img / jpeg  JPEG data URLs ("data:image/jpeg;base64,…") the browser captured (3D views, swatch pictures)
// → 200 application/pdf (binary; Vercel caps a response at 4.5 MB so the input image budget is 3.0 MB), headers
//   X-Kynning-Pages and X-Kynning-Warnings (URL-encoded JSON list of sections that were left out and why).
//
// Page order: cover · table of contents (clickable internal links) · Efnisval (moodboard) · Þrívíddarteikningar (+ the boxed 2D
// note) · Verkefnaskýrsla og ferlið · Tilboð per room. A section whose data is missing is omitted (and named in the
// warnings) — never half-drawn. All fixed wording lives in api/_kynning-texti.js. One typeface: Helvetica (its WinAnsi set
// covers á é í ó ú ý þ ð æ ö; anything it cannot print is dropped by safe() instead of crashing).
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb, PDFName } from "pdf-lib";
import { safeEq } from "./_auth.js";
import { PRICE_2D, NOTE_2D, NOTE_2D_TITLE, PROCESS_TITLE, PROCESS_INTRO, PROCESS_DURATION_NOTE, PROCESS_STEPS, SEC, COVER_TAG, VAT_PCT } from "./_kynning-texti.js";

export const LIMITS = { body: 4.4e6, image: 1.2e6, swatch: 120e3, imageTotal: 3.0e6, images: 16, rooms: 30, materials: 12, lines: 200, reportLines: 30, pdf: 4.4e6 };

const PW = 595.28, PH = 841.89, M = 56, CW = PW - 2 * M, TOP = PH - 64, BOTTOM = 62;
const INK = rgb(0.1, 0.1, 0.1), GRAY = rgb(0.45, 0.45, 0.45), LIGHT = rgb(0.9, 0.89, 0.86), GOLD = rgb(0.725, 0.643, 0.427), PAPER = rgb(0.973, 0.968, 0.955);
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const SWATCH_KINDS = ["Framhlið", "Höldur", "Borðplata", "Skrokkur", "Gólf", "Veggir"];

const str = (v, max = 200) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").trim().slice(0, max);
const kr = (n) => { const v = Math.round(Number(n) || 0), neg = v < 0; return (neg ? "-" : "") + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr."; };
const isNum = (v, max = 1e10) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const JPEG_RE = /^data:image\/jpe?g;base64,([A-Za-z0-9+/=\s]+)$/;
const decodeJpeg = (s) => { const m = JPEG_RE.exec(String(s || "")); if (!m) return null; const b = Buffer.from(m[1], "base64"); return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 ? new Uint8Array(b) : null; }; // a copy with its own ArrayBuffer: pdf-lib reads .buffer, and a small Buffer lives in a shared pool

// ---- validation (a clear Icelandic message, or null) --------------------------------------------------
export function validate(b) {
  if (!b || typeof b !== "object") return "Ógild beiðni";
  const p = b.project;
  if (!p || typeof p !== "object" || !str(p.name)) return "Verkefnið vantar nafn";
  if (!Array.isArray(b.rooms) || b.rooms.length > LIMITS.rooms) return "Ógild rými";
  let bytes = 0;
  for (const r of b.rooms) {
    if (!r || typeof r !== "object" || !str(r.name)) return "Rými án nafns";
    if (r.materials != null && (!Array.isArray(r.materials) || r.materials.length > LIMITS.materials)) return "Ógilt efnisval";
    for (const m of r.materials || []) {
      if (!m || !str(m.label)) return "Efni án nafns";
      if (m.color && !/^#[0-9a-f]{6}$/i.test(String(m.color))) return "Ógildur litur";
      if (m.img) { const buf = decodeJpeg(m.img); if (!buf) return "Efnismynd er ekki JPEG"; if (buf.length > LIMITS.swatch) return "Efnismynd er of stór"; bytes += buf.length; }
    }
  }
  if (b.images != null) {
    if (!Array.isArray(b.images) || b.images.length > LIMITS.images) return "Of margar myndir (hámark " + LIMITS.images + ")";
    for (const im of b.images) {
      const buf = decodeJpeg(im && im.jpeg);
      if (!buf) return "Mynd er ekki JPEG";
      if (buf.length > LIMITS.image) return "Mynd er of stór (hámark " + Math.round(LIMITS.image / 1e5) / 10 + " MB)";
      bytes += buf.length;
    }
  }
  if (bytes > LIMITS.imageTotal) return "Myndirnar eru of stórar saman (" + (Math.round(bytes / 1e5) / 10) + " MB, hámark " + LIMITS.imageTotal / 1e6 + " MB)";
  if (b.report != null && (!Array.isArray(b.report.lines) || b.report.lines.length > LIMITS.reportLines || b.report.lines.some((l) => typeof l !== "string"))) return "Ógild skýrsla";
  if (b.quote != null) {
    const q = b.quote;
    if (!Array.isArray(q.rooms) || q.rooms.length > LIMITS.rooms || !isNum(q.total)) return "Ógilt tilboð";
    let sum = 0;
    for (const r of q.rooms) {
      if (!r || !str(r.name) || !Array.isArray(r.lines) || r.lines.length > LIMITS.lines) return "Ógilt tilboð";
      for (const l of r.lines) { if (!l || !str(l.name) || !isNum(l.total) || (l.qty != null && !isNum(l.qty, 1e6))) return "Ógild tilboðslína"; sum += l.total; }
    }
    if (q.handles != null) { if (!isNum(q.handles.total) || (q.handles.count != null && !isNum(q.handles.count, 1e6))) return "Ógildar höldur"; sum += q.handles.total; }
    // the grand total must be the sum of what is printed — a PDF whose total differs from its lines is never produced
    if (Math.abs(sum - q.total) > 2) return "Heildarverð stemmir ekki við línurnar (" + kr(sum) + " en " + kr(q.total) + ")";
  }
  return null;
}

// ---- text helpers ------------------------------------------------------------------------------------
const charSets = new WeakMap();
function safe(font, s) { // drop what WinAnsi can't print (→, ✓, emoji …) instead of throwing
  let set = charSets.get(font); if (!set) { set = new Set(font.getCharacterSet()); charSets.set(font, set); }
  let out = "";
  for (const ch of String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ")) { const cp = ch.codePointAt(0); out += set.has(cp) ? ch : (cp === 0x2192 ? "-" : cp === 0x2713 ? "" : ""); }
  return out;
}
function wrap(font, size, text, maxW) {
  const words = safe(font, text).split(/\s+/).filter(Boolean), lines = []; let cur = "";
  for (let w of words) {
    while (font.widthOfTextAtSize(w, size) > maxW) { // a single over-long word: cut it
      let n = w.length; while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > maxW) n--;
      if (cur) { lines.push(cur); cur = ""; }
      lines.push(w.slice(0, n)); w = w.slice(n);
    }
    const t = cur ? cur + " " + w : w;
    if (cur && font.widthOfTextAtSize(t, size) > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
const hexColor = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return rgb(0.85, 0.84, 0.8); const n = parseInt(m[1], 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const dateIs = (d) => d.getDate() + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();

async function loadLogo(host, fetchImpl) {
  try { return new Uint8Array(fs.readFileSync(fileURLToPath(new URL("../logo-bjorninn.png", import.meta.url)))); } catch (e) { /* not bundled → fetch it */ }
  try { if (host) { const r = await fetchImpl(`https://${host}/logo-bjorninn.png`); if (r.ok) return new Uint8Array(await r.arrayBuffer()); } } catch (e) { /* → text wordmark */ }
  return null;
}

// ---- the document ------------------------------------------------------------------------------------
export async function buildKynning(data, { logo, now = new Date() } = {}) {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const P = data.project, projectName = str(P.name), warnings = [], sections = [];
  doc.setTitle("Kynning - " + projectName); doc.setAuthor("Björninn Innréttingar"); doc.setCreator("Björninn Innréttingar"); doc.setCreationDate(now);

  const pages = []; // { page, chrome }
  const newPage = (chrome = true) => { const page = doc.addPage([PW, PH]); pages.push({ page, chrome }); return page; };
  const idxOf = (page) => pages.findIndex((p) => p.page === page);
  const text = (page, s, x, y, o = {}) => page.drawText(safe(o.font || reg, s), { x, y, size: o.size || 10, font: o.font || reg, color: o.color || INK });
  const rtext = (page, s, xr, y, o = {}) => { const f = o.font || reg, t = safe(f, s); page.drawText(t, { x: xr - f.widthOfTextAtSize(t, o.size || 10), y, size: o.size || 10, font: f, color: o.color || INK }); };
  const rule = (page, y, x1 = M, x2 = PW - M, color = LIGHT, th = 0.6) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color });
  const heading = (page, y, title, sub) => { text(page, title, M, y, { font: bold, size: 20 }); rule(page, y - 10, M, M + 36, GOLD, 1.4); if (sub) text(page, sub, M, y - 28, { size: 10, color: GRAY }); return y - (sub ? 52 : 38); };

  // pre-allocated: page 1 = cover, page 2 = table of contents (filled last, when every section's page is known)
  const cover = newPage(false), tocPage = newPage(true);
  const toc = []; // { label, page (PDFPage), level }

  // 1) cover ----------------------------------------------------------------------------------------
  let logoImg = null; const logoBytes = logo === undefined ? null : logo;
  if (logoBytes) { try { logoImg = await doc.embedPng(logoBytes); } catch (e) { logoImg = null; } }
  if (logoImg) { const w = 190, h = w * logoImg.height / logoImg.width; cover.drawImage(logoImg, { x: M, y: PH - 80 - h, width: w, height: h }); }
  else text(cover, "BJÖRNINN INNRÉTTINGAR", M, PH - 100, { font: bold, size: 16, color: GOLD });
  rule(cover, 330, M, M + 48, GOLD, 1.6);
  text(cover, COVER_TAG.toUpperCase(), M, 305, { size: 9, color: GRAY });
  const addr = str(P.address), contact = str(P.contact);
  const title = addr || projectName; let y = 270;
  for (const l of wrap(bold, 28, title, CW).slice(0, 3)) { text(cover, l, M, y, { font: bold, size: 28 }); y -= 36; }
  if (contact) { y -= 6; text(cover, contact, M, y, { size: 15 }); y -= 24; }
  if (addr) text(cover, projectName, M, y, { size: 10, color: GRAY });
  text(cover, dateIs(now), M, 90, { size: 10, color: GRAY });
  if (!addr) warnings.push({ section: "Forsíða", why: "Heimilisfang verkefnis vantar — forsíðan sýnir verkefnisnafnið." });
  if (!contact) warnings.push({ section: "Forsíða", why: "Nafn tengiliðs vantar." });

  // 3) moodboard ------------------------------------------------------------------------------------
  const rooms = data.rooms.filter((r) => r.materials && r.materials.length);
  if (rooms.length) {
    let page = newPage(), y0 = heading(page, TOP, SEC.moodboard, "Efnið sem við leggjum til, rými fyrir rými."), yy = y0;
    toc.push({ label: SEC.moodboard, page, level: 0 }); sections.push({ id: "moodboard", page: idxOf(page) });
    const SW = 150, SH = 96, GAP = 16;
    for (const r of rooms) {
      const ord = (m) => { const i = SWATCH_KINDS.indexOf(m.kind); return i < 0 ? 99 : i; }, mats = [...r.materials].sort((a, b) => ord(a) - ord(b));
      const rowsN = Math.ceil(mats.length / 3), need = 40 + rowsN * (SH + 54);
      if (yy - Math.min(need, 40 + SH + 54) < BOTTOM) { page = newPage(); yy = TOP; }
      text(page, str(r.name, 60), M, yy, { font: bold, size: 14 }); rule(page, yy - 8, M, PW - M); yy -= 26;
      for (let i = 0; i < mats.length; i++) {
        const col = i % 3; if (col === 0 && i > 0) yy -= SH + 54;
        if (col === 0 && yy - SH - 40 < BOTTOM) { page = newPage(); yy = TOP; text(page, str(r.name, 60) + " (framhald)", M, yy, { font: bold, size: 14 }); rule(page, yy - 8, M, PW - M); yy -= 26; }
        const m = mats[i], x = M + col * (SW + GAP), top = yy;
        const jpg = m.img ? decodeJpeg(m.img) : null; let drawn = false;
        if (jpg) { try { const im = await doc.embedJpg(jpg); page.drawImage(im, { x, y: top - SH, width: SW, height: SH }); drawn = true; } catch (e) { /* → colour */ } }
        if (!drawn) page.drawRectangle({ x, y: top - SH, width: SW, height: SH, color: hexColor(m.color) });
        page.drawRectangle({ x, y: top - SH, width: SW, height: SH, borderColor: LIGHT, borderWidth: 0.6 });
        text(page, str(m.kind, 30).toUpperCase(), x, top - SH - 14, { size: 7.5, color: GRAY });
        wrap(bold, 10, str(m.label, 90), SW).slice(0, 2).forEach((l, k) => text(page, l, x, top - SH - 28 - k * 12, { font: bold, size: 10 }));
      }
      yy -= SH + 54 + 8;
    }
  } else warnings.push({ section: SEC.moodboard, why: "Efnisval vantar í öllum rýmum — kaflinn er sleppt." });

  // 4) 3D drawings + the 2D note ---------------------------------------------------------------------
  const imgs = (data.images || []);
  if (imgs.length) {
    let page = newPage(), yy = heading(page, TOP, SEC.drawings, "Þrívíddarmyndir af innréttingunni.");
    toc.push({ label: SEC.drawings, page, level: 0 }); sections.push({ id: "drawings", page: idxOf(page) });
    for (const im of imgs) {
      const emb = await doc.embedJpg(decodeJpeg(im.jpeg)), maxH = 280;
      const s = Math.min(CW / emb.width, maxH / emb.height), w = emb.width * s, h = emb.height * s;
      if (yy - h - 24 < BOTTOM) { page = newPage(); yy = TOP; }
      if (im.title) text(page, str(im.title, 100), M, yy, { size: 9, color: GRAY });
      page.drawImage(emb, { x: M + (CW - w) / 2, y: yy - 8 - h, width: w, height: h });
      yy -= h + 38;
    }
    // the boxed note about the paid 2D work drawings
    const lines = wrap(reg, 10.5, NOTE_2D(PRICE_2D), CW - 32), boxH = 34 + lines.length * 15;
    if (yy - boxH < BOTTOM) { page = newPage(); yy = TOP; }
    page.drawRectangle({ x: M, y: yy - boxH, width: CW, height: boxH, color: PAPER, borderColor: GOLD, borderWidth: 0.9 });
    text(page, NOTE_2D_TITLE.toUpperCase(), M + 16, yy - 20, { size: 8, color: GRAY });
    lines.forEach((l, i) => text(page, l, M + 16, yy - 38 - i * 15, { size: 10.5 }));
  } else warnings.push({ section: SEC.drawings, why: "Engar 3D myndir — kaflinn og athugasemdin um 2D vinnuteikningar eru sleppt." });

  // 5) report + process ------------------------------------------------------------------------------
  const rep = data.report && data.report.lines && data.report.lines.length ? data.report.lines : null;
  {
    let page = newPage(), yy = heading(page, TOP, "Verkefnaskýrsla", "Stutt samantekt á því sem tilboðið nær yfir.");
    toc.push({ label: SEC.report, page, level: 0 }); sections.push({ id: "report", page: idxOf(page) });
    if (rep) for (const raw of rep) {
      const m = /^([^:]{2,32}):\s+(.*)$/.exec(raw), lab = m ? m[1] + ": " : "", body = m ? m[2] : raw, labW = lab ? bold.widthOfTextAtSize(safe(bold, lab), 10.5) : 0;
      const ls = wrap(reg, 10.5, body, CW - labW - 0.01); // first line shares its row with the bold label
      const first = ls[0], restLines = wrap(reg, 10.5, ls.slice(1).join(" "), CW), all = ls.length > 1 ? [first, ...restLines.filter(Boolean)] : [first];
      if (yy - all.length * 15 < BOTTOM) { page = newPage(); yy = TOP; }
      if (lab) text(page, lab, M, yy, { font: bold, size: 10.5 });
      all.forEach((l, i) => text(page, l, M + (i === 0 ? labW : 0), yy - i * 15, { size: 10.5 }));
      yy -= all.length * 15 + 9;
    } else { text(page, "Skýrsla vantar.", M, yy, { color: GRAY }); warnings.push({ section: "Verkefnaskýrsla", why: "Skýrslutexti vantar." }); }

    page = newPage(); yy = heading(page, TOP, PROCESS_TITLE);
    toc.push({ label: PROCESS_TITLE, page, level: 1 }); sections.push({ id: "process", page: idxOf(page) });
    for (const l of wrap(reg, 10.5, PROCESS_INTRO, CW)) { text(page, l, M, yy, { size: 10.5, color: GRAY }); yy -= 15; }
    yy -= 16;
    PROCESS_STEPS.forEach((st, i) => {
      page.drawCircle({ x: M + 11, y: yy - 4, size: 11, borderColor: GOLD, borderWidth: 1, color: rgb(1, 1, 1) });
      const n = String(i + 1); text(page, n, M + 11 - bold.widthOfTextAtSize(n, 10) / 2, yy - 7.5, { font: bold, size: 10 });
      text(page, st.title, M + 34, yy, { font: bold, size: 12 });
      rtext(page, st.duration, PW - M, yy, { size: 9.5, color: GRAY });
      const ls = wrap(reg, 10, st.text, CW - 34); ls.forEach((l, k) => text(page, l, M + 34, yy - 16 - k * 13.5, { size: 10 }));
      const h = 16 + ls.length * 13.5;
      if (i < PROCESS_STEPS.length - 1) page.drawLine({ start: { x: M + 11, y: yy - 17 }, end: { x: M + 11, y: yy - h - 26 + 12 }, thickness: 0.6, color: LIGHT });
      yy -= h + 34;
    });
    text(page, PROCESS_DURATION_NOTE, M, yy + 6, { size: 9, color: GRAY });
  }

  // 6) the quote, per room ---------------------------------------------------------------------------
  const q = data.quote, qRooms = q ? q.rooms.filter((r) => r.lines.length) : [];
  const handles = q && q.handles && q.handles.total > 0 ? q.handles : null;
  if (q && (qRooms.length || handles)) {
    const COLQ = PW - M - 150, COLT = PW - M;
    let page = newPage(), yy = heading(page, TOP, SEC.quote, "Verð í íslenskum krónum, með virðisaukaskatti.");
    toc.push({ label: SEC.quote, page, level: 0 }); sections.push({ id: "quote", page: idxOf(page) });
    const colHead = (pg, y) => { text(pg, "VARA", M, y, { size: 7.5, color: GRAY }); rtext(pg, "MAGN", COLQ, y, { size: 7.5, color: GRAY }); rtext(pg, "SAMTALS", COLT, y, { size: 7.5, color: GRAY }); rule(pg, y - 6, M, PW - M); return y - 22; };
    const block = (name, lines, sub, isRoom) => {
      if (yy - 120 < BOTTOM) { page = newPage(); yy = TOP; }
      if (isRoom) toc.push({ label: name, page, level: 2 });
      text(page, str(name, 60), M, yy, { font: bold, size: 13 }); yy -= 22; yy = colHead(page, yy);
      for (const l of lines) {
        const nm = wrap(reg, 10, l.name, CW - 190), ex = l.extra ? wrap(reg, 8, l.extra, CW - 190).slice(0, 2) : [], h = nm.length * 13 + ex.length * 11 + 8;
        if (yy - h < BOTTOM + 30) { page = newPage(); yy = TOP; text(page, str(name, 60) + " (framhald)", M, yy, { font: bold, size: 13 }); yy -= 22; yy = colHead(page, yy); }
        nm.forEach((t, i) => text(page, t, M, yy - i * 13, { size: 10 }));
        ex.forEach((t, i) => text(page, t, M, yy - nm.length * 13 - i * 11 + 1, { size: 8, color: GRAY }));
        if (l.qty != null) rtext(page, String(l.qty).replace(".", ","), COLQ, yy, { size: 10 });
        rtext(page, kr(l.total), COLT, yy, { size: 10 });
        yy -= h; page.drawLine({ start: { x: M, y: yy + 4 }, end: { x: PW - M, y: yy + 4 }, thickness: 0.3, color: LIGHT });
      }
      yy -= 4; text(page, isRoom ? "Samtals " + str(name, 40) : "Samtals", M, yy, { font: bold, size: 10 }); rtext(page, kr(sub), COLT, yy, { font: bold, size: 10 }); yy -= 34;
    };
    let sum = 0;
    for (const r of qRooms) { const s = r.lines.reduce((a, l) => a + l.total, 0); sum += s; block(r.name, r.lines, s, true); }
    if (handles) { sum += handles.total; block("Höldur", [{ name: "Höldur í öllum rýmum", extra: "", qty: handles.count, total: handles.total }], handles.total, false); }
    // grand total
    const total = sum, vat = total - total / (1 + VAT_PCT / 100);
    if (yy - 90 < BOTTOM) { page = newPage(); yy = TOP; }
    page.drawRectangle({ x: M, y: yy - 70, width: CW, height: 70, color: PAPER, borderColor: GOLD, borderWidth: 0.9 });
    text(page, "HEILDARVERÐ MEÐ VSK", M + 16, yy - 22, { size: 8, color: GRAY });
    text(page, kr(total), M + 16, yy - 50, { font: bold, size: 22 });
    rtext(page, "þar af vsk (" + VAT_PCT + "%): " + kr(vat), PW - M - 16, yy - 50, { size: 10, color: GRAY });
    sections[sections.length - 1].total = total;
  } else warnings.push({ section: SEC.quote, why: "Engar tilboðslínur — kaflinn er sleppt." });

  // 2) the table of contents — every entry is a clickable internal link ----------------------------------
  {
    let y = heading(tocPage, TOP, "Efnisyfirlit");
    const entries = toc.filter((e) => e.level < 2 || toc.filter((x) => x.level === 2).length <= 12);
    for (const e of entries) {
      const pn = String(idxOf(e.page) + 1), x = M + e.level * 18, f = e.level === 0 ? bold : reg, sz = e.level === 0 ? 12 : 10.5;
      text(tocPage, e.label, x, y, { font: f, size: sz, color: e.level === 0 ? INK : GRAY }); rtext(tocPage, pn, PW - M, y, { font: f, size: sz });
      const lw = f.widthOfTextAtSize(safe(f, e.label), sz) + x + 8, pw = f.widthOfTextAtSize(pn, sz) + 8;
      for (let dx = lw; dx < PW - M - pw; dx += 5) tocPage.drawCircle({ x: dx, y: y + 1.5, size: 0.4, color: LIGHT });
      link(tocPage, [M + e.level * 18 - 2, y - 5, PW - M + 2, y + sz + 3], e.page);
      y -= e.level === 0 ? 30 : 22;
    }
    sections.unshift({ id: "toc", page: 1 });
  }
  function link(onPage, rect, target) { // an internal link annotation: click → jump to the top of `target`
    const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], Dest: [target.ref, PDFName.of("XYZ"), null, PH, null] });
    onPage.node.addAnnot(doc.context.register(annot));
  }

  // running header + footer on every page but the cover (+ a small "Efnisyfirlit" link back to the table of contents)
  const total = pages.length;
  pages.forEach((p, i) => {
    if (!p.chrome) return;
    text(p.page, projectName.toUpperCase(), M, PH - 36, { size: 7.5, color: GRAY });
    if (i > 1) { const l = "EFNISYFIRLIT"; rtext(p.page, l, PW - M, PH - 36, { size: 7.5, color: GOLD }); link(p.page, [PW - M - bold.widthOfTextAtSize(l, 7.5) - 4, PH - 40, PW - M + 2, PH - 28], tocPage); }
    rule(p.page, PH - 44, M, PW - M);
    rule(p.page, 40, M, PW - M); text(p.page, "Björninn Innréttingar", M, 28, { size: 8, color: GRAY }); rtext(p.page, "Síða " + (i + 1) + " af " + total, PW - M, 28, { size: 8, color: GRAY });
  });
  const bytes = await doc.save();
  return { bytes, pages: total, warnings, sections };
}

// ---- the endpoint ------------------------------------------------------------------------------------
export default async function handler(req, res, { fetchImpl = fetch, logo, now } = {}) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.VERK_KEY;
  if (!key) return res.status(500).json({ error: "Server not configured" });
  let body = req.body;
  if (typeof body === "string") { if (body.length > LIMITS.body) return res.status(413).json({ error: "Beiðnin er of stór" }); try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== "object" || !safeEq(String(body.k || ""), key)) return res.status(403).json({ error: "Rangur lykill" });
  const len = Number((req.headers || {})["content-length"]) || 0;
  if (len > LIMITS.body) return res.status(413).json({ error: "Beiðnin er of stór (hámark 4,4 MB) — færri eða minni myndir" });
  const bad = validate(body);
  if (bad) return res.status(/of stór|of marga|of margar/.test(bad) ? 413 : 400).json({ error: bad });
  try {
    const host = ((req.headers || {})["x-forwarded-host"]) || ((req.headers || {}).host);
    const lg = logo !== undefined ? logo : await loadLogo(host, fetchImpl);
    const out = await buildKynning(body, { logo: lg, now });
    if (out.bytes.length > LIMITS.pdf) return res.status(413).json({ error: "PDF-ið varð of stórt (" + (Math.round(out.bytes.length / 1e5) / 10) + " MB) — færri eða minni myndir" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Kynning-Pages", String(out.pages));
    res.setHeader("X-Kynning-Warnings", encodeURIComponent(JSON.stringify(out.warnings)));
    return res.status(200).end(Buffer.from(out.bytes));
  } catch (e) {
    console.error("kynning-pdf", e);
    return res.status(500).json({ error: "Tókst ekki að búa til PDF: " + (e && e.message || "villa") });
  }
}
