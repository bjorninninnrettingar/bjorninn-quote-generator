// api/generate-quote.js
// Björninn ehf. — Quote PDF Generator
// pdf-lib, pure JS, no native deps

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const AIRTABLE_BASE       = "app91U15z9K704Okd";
const PROJECTS_TABLE      = "tbl4LMXlQjp66RFKI";
const LINE_ITEMS_TABLE    = "tblFcsUoGxsuUwNEH";
const ATTACHMENT_FIELD    = "flddIR5JAm8ZM753V";
const LINKED_FIELD        = "Vöru línur ➖📦 (Line item's)";
const INSTALL_PRICE_FIELD  = "Uppsetningarverð Verkefnis";
const DELIVERY_PRICE_FIELD = "heimsendingaverð";

// Brand colours
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

async function getProject(token, recordId) {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    token
  );
  return data.fields;
}

async function getLineItems(token, linkedIds) {
  if (!linkedIds || linkedIds.length === 0) return [];
  const filter = `OR(${linkedIds.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${LINE_ITEMS_TABLE}?filterByFormula=${encodeURIComponent(filter)}`,
    token
  );
  const recordMap = Object.fromEntries(data.records.map((r) => [r.id, r.fields]));
  return linkedIds.map((id) => recordMap[id]).filter(Boolean);
}

async function clearAttachments(token, recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { [ATTACHMENT_FIELD]: [] } }),
    }
  );
  if (!res.ok) console.warn(`clearAttachments: ${res.status} ${await res.text()}`);
}

async function uploadPdf(token, recordId, pdfBytes, filename = "tilbod.pdf") {
  const res = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${ATTACHMENT_FIELD}/uploadAttachment`,
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

function lv(val) {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

function formatDate(val) {
  const d = val ? new Date(val) : new Date();
  return d.toLocaleDateString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function txt(page, str, x, y, font, size, color = DARK) {
  if (str === null || str === undefined || str === "") return;
  page.drawText(String(str), { x, y, size, font, color });
}

function truncate(font, str, size, maxW) {
  str = String(str);
  if (font.widthOfTextAtSize(str, size) <= maxW) return str;
  while (str.length > 1 && font.widthOfTextAtSize(str + "…", size) > maxW) {
    str = str.slice(0, -1);
  }
  return str + "…";
}

function wrapText(font, str, size, maxW) {
  const words = String(str).split(" ");
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

function rect(page, x, y, w, h, color) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function line(page, x1, y1, x2, y2, color = GOLD, thickness = 0.75) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
}

// ── Shared header renderer (used by both PDFs) ────────────────────────────────

function drawHeader(page, project, logoImg, PW, PH, fontBold, fontReg, hideDate = false) {
  const CW = PW - MARGIN * 2;
  let y = PH - MARGIN;
  const LOGO_W = 180;

  if (logoImg) {
    const LOGO_H = Math.round(LOGO_W * logoImg.height / logoImg.width);
    page.drawImage(logoImg, { x: MARGIN, y: y - LOGO_H / 2, width: LOGO_W, height: LOGO_H });

    const tagline = "Íslensk framleiðsla í meira en hálfa öld";
    const tagW = fontReg.widthOfTextAtSize(tagline, 9);
    txt(page, tagline, PW - MARGIN - tagW, y, fontReg, 9, GRAY);

    if (!hideDate) {
      const dateStr = `Dagsetning: ${formatDate(project["Skráð þann:"])}`;
      const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
      txt(page, dateStr, PW - MARGIN - dateW, y - 14, fontReg, 8, GRAY);
    }

    y -= LOGO_H / 2 + 6;
  } else {
    txt(page, "BJÖRNINN", MARGIN, y, fontBold, 22, GOLD);
    const brandW = fontBold.widthOfTextAtSize("BJÖRNINN", 22);
    const subW   = fontReg.widthOfTextAtSize("INNRÉTTINGAR", 11);
    txt(page, "INNRÉTTINGAR", MARGIN + brandW - subW, y - 16, fontReg, 11, DARK);

    const tagline = "Íslensk framleiðsla í meira en hálfa öld";
    const tagW = fontReg.widthOfTextAtSize(tagline, 9);
    txt(page, tagline, PW - MARGIN - tagW, y, fontReg, 9, GRAY);

    if (!hideDate) {
      const dateStr = `Dagsetning: ${formatDate(project["Skráð þann:"])}`;
      const dateW = fontReg.widthOfTextAtSize(dateStr, 8);
      txt(page, dateStr, PW - MARGIN - dateW, y - 14, fontReg, 8, GRAY);
    }

    y -= 28;
  }

  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 1);
  return y - 16;  // return y position after the gold rule
}

// ── Diagonal watermark (used by the "estimate" / verðhugmynd variant) ─────────

const WATERMARK_TEXT = "Aðeins verðhugmynd, ógilt sem tilboð";
const WATERMARK_ANGLE = 35; // degrees, bottom-left to top-right

function drawWatermark(page, font, PW, PH) {
  const size = 30;
  const textWidth = font.widthOfTextAtSize(WATERMARK_TEXT, size);
  const rad = (WATERMARK_ANGLE * Math.PI) / 180;
  const x = PW / 2 - (textWidth / 2) * Math.cos(rad);
  const y = PH / 2 - (textWidth / 2) * Math.sin(rad);

  page.drawText(WATERMARK_TEXT, {
    x,
    y,
    size,
    font,
    color: rgb(0.75, 0.15, 0.15),
    opacity: 0.22,
    rotate: degrees(WATERMARK_ANGLE),
  });
}

// ── Shared footer renderer ────────────────────────────────────────────────────

function drawFooter(page, PW, fontReg) {
  const footerY = 9;
  line(page, MARGIN, footerY + 37, PW - MARGIN, footerY + 37, LIGHT, 0.5);

  const footerLines = [
    "Tilboði fylgir hvorki uppsetning né flutningur nema það komi sérstaklega fram.  ·  Skilmálar: https://www.bjorninninnrettingar.is/skilm%C3%A1lar",
    "Innborgun er samþykki við skilmálum  ·  Endurgreiðsla á staðfestingargjaldi er ekki möguleg.",
    "Björninn ehf.  |  Álfhella 5, 221 Hafnarfjörður  |  bjorninn@bjorninninnrettingar.is  |  bjorninninnrettingar.is",
  ];
  let fy = footerY + 31;
  for (const l of footerLines) {
    txt(page, l, MARGIN, fy, fontReg, 6.5, GRAY);
    fy -= 9;
  }
}

// ── Main quote PDF ────────────────────────────────────────────────────────────

async function buildPdf(project, lineItems, includeSummary = false, estimate = false) {
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

  const ROW_H = 15;
  const availableLand = 595.28 - MARGIN * 2 - 165 - 40 - 85 - 35;
  const landscape = lineItems.length * ROW_H <= availableLand;
  const PW = landscape ? 841.89 : 595.28;
  const PH = landscape ? 595.28 : 841.89;
  const CW = PW - MARGIN * 2;

  function newPage() {
    return doc.addPage([PW, PH]);
  }

  function checkBreak(page, y, reserve = 100) {
    if (y > MARGIN + reserve) return { page, y };
    const p = newPage();
    line(p, MARGIN, PH - 28, PW - MARGIN, PH - 28, GOLD, 0.5);
    txt(p, "BJÖRNINN INNRÉTTINGAR — framhald", MARGIN, PH - 20, fontReg, 7.5, GRAY);
    return { page: p, y: PH - 48 };
  }

  let page = newPage();
  let y = drawHeader(page, project, logoImg, PW, PH, fontBold, fontReg, estimate);

  // Quote title + validity
  const quoteTitle = project["Tilboðsblaðs heiti"] || (estimate ? "Verðhugmynd" : "Tilboð");
  txt(page, quoteTitle, MARGIN, y, fontBold, 14, DARK);

  if (!estimate) {
    const validStr = "Tilboð gildir í 30 daga frá útgáfudegi";
    const validW = fontReg.widthOfTextAtSize(validStr, 8);
    txt(page, validStr, PW - MARGIN - validW, y, fontReg, 8, GRAY);
  }
  y -= 22;

  // ── Info block ───────────────────────────────────────────────────────────
  const colL = MARGIN;
  const colR = MARGIN + CW * 0.38;
  const infoTopY = y;

  txt(page, "TENGILIÐUR", colL, y, fontBold, 7, GOLD);
  y -= 13;
  txt(page, lv(project["Fullt nafn 👤"]), colL, y, fontBold, 10, DARK);
  y -= 13;
  const phone = lv(project["Símanúmer ☎️"]);
  const email = lv(project["Netfang 📧"]);
  if (phone) { txt(page, String(phone), colL, y, fontReg, 8.5, GRAY); y -= 12; }
  if (email) { txt(page, String(email), colL, y, fontReg, 8.5, GRAY); y -= 12; }

  let yR = infoTopY;
  txt(page, "EFNISVAL", colR, yR, fontBold, 7, GOLD);
  yR -= 13;

  const holder1 = lv(project["Heiti vöru 📣 (from Höldur Viðskiptavinar ✊)"]);
  const holder2 = lv(project["Heiti vöru 📣 (from Höldur Viðskiptavinar ✊2.0)"]);
  const holderVal = [holder1, holder2].filter(Boolean).join(" / ");

  const specFields = [
    ["Innvols",       lv(project["Heiti efnis (from Skrokka efni 🔲 viðskiptavinar)"])],
    ["Framhliðar",    lv(project["Heiti efnis (from Fronta efni viðskiptavinar 🖼️)"])],
    ["Framhliðar 2",  lv(project["Heiti efnis (from Fronta efni 2 Viðskiptavinar 🖼️)"])],
    ["Borðplata",     lv(project["Heiti efnis (from Borðplata viðskiptavinar 🍽️)"])],
    ["Höldur",        holderVal],
  ];

  for (const [label, val] of specFields) {
    if (!val) continue;
    txt(page, `${label}:`, colR, yR, fontBold, 8, DARK);
    const maxSpecW = PW - MARGIN - (colR + 55) - 4;
    txt(page, truncate(fontReg, String(val), 8, maxSpecW), colR + 55, yR, fontReg, 8, GRAY);
    yR -= 12;
  }

  y = Math.min(y - 10, yR - 10);

  // ── Line items table ─────────────────────────────────────────────────────
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 0.75);
  y -= 20;

  const cols = [
    { label: "Rými",            w: 0.10, align: "left",   clip: true  },
    { label: "Vara",            w: 0.22, align: "left",   clip: true  },
    { label: "Útfærsla",        w: 0.32, align: "left",   clip: true  },
    { label: "Magn",            w: 0.05, align: "center", clip: false },
    { label: "Afsl. %",         w: 0.05, align: "center", clip: false },
    { label: "Einingarverð",    w: 0.13, align: "right",  clip: false },
    { label: "Samtals m. vsk.", w: 0.13, align: "right",  clip: false },
  ];

  let xCur = MARGIN;
  const colDefs = cols.map((c) => {
    const pw = CW * c.w;
    const def = { ...c, x: xCur, pw };
    xCur += pw;
    return def;
  });

  rect(page, MARGIN, y - 5, CW, 18, GOLD_TINT);
  for (const col of colDefs) {
    const lw = fontBold.widthOfTextAtSize(col.label, 7.5);
    const lx = col.align === "right"  ? col.x + col.pw - lw - 3
             : col.align === "center" ? col.x + (col.pw - lw) / 2
             : col.x + 3;
    txt(page, col.label, lx, y, fontBold, 7.5, DARK);
  }
  y -= 16;
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 0.5);
  y -= 4;

  let subtotalInclVat = 0;
  let totalDiscountInclVat = 0;

  for (let i = 0; i < lineItems.length; i++) {
    ({ page, y } = checkBreak(page, y, 110));

    const item = lineItems[i];
    const qty       = parseFloat(item["Magn"]        ?? 1) || 1;
    const unitPrice = parseFloat(item["Einingarverð"] ?? 0) || 0;
    const discPct   = parseFloat(item["Afsl. %"]      ?? 0) || 0;
    const lineExVat   = unitPrice * qty;
    const lineInclVat = lineExVat * 1.24;
    subtotalInclVat      += lineInclVat;
    totalDiscountInclVat += unitPrice * qty * discPct * 1.24;

    if (i % 2 === 0) rect(page, MARGIN, y - 3, CW, ROW_H, LIGHT);

    const rowData = [
      item["Rými 🏡"]      || "",
      item["Vara 🚪"]      || "—",
      item["útfærsla 🎨"]  || "",
      qty % 1 === 0 ? String(qty) : qty.toFixed(1),
      discPct ? `${Math.round(discPct * 100)}%` : "—",
      formatISK(unitPrice),
      formatISK(lineInclVat),
    ];

    for (let ci = 0; ci < colDefs.length; ci++) {
      const col = colDefs[ci];
      const maxTextW = col.pw - 6;
      const raw = String(rowData[ci] ?? "");
      const val = col.clip ? truncate(fontReg, raw, 8, maxTextW) : raw;
      const vw = fontReg.widthOfTextAtSize(val, 8);
      const vx = col.align === "right"  ? col.x + col.pw - vw - 3
               : col.align === "center" ? col.x + (col.pw - vw) / 2
               : col.x + 3;
      txt(page, val, vx, y, fontReg, 8, DARK);
    }
    y -= ROW_H;
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  ({ page, y } = checkBreak(page, y, 90));
  y -= 16;
  line(page, MARGIN, y, PW - MARGIN, y, GRAY, 0.4);
  y -= 16;

  const totalInclVat = subtotalInclVat;
  const totalExVat   = totalInclVat / 1.24;
  const vatAmount    = totalInclVat - totalExVat;
  const totalsX = PW - MARGIN - 230;

  const subtotalRows = [
    { label: "Samtals (án VSK):", value: formatISK(totalExVat) },
    { label: "VSK 24%:",          value: formatISK(vatAmount)  },
  ];
  if (totalDiscountInclVat > 0) {
    subtotalRows.push({ label: "Afsláttur samtals:", value: formatISK(totalDiscountInclVat) });
  }
  for (const row of subtotalRows) {
    txt(page, row.label, totalsX, y, fontReg, 9, GRAY);
    const vw = fontReg.widthOfTextAtSize(row.value, 9);
    txt(page, row.value, PW - MARGIN - vw, y, fontReg, 9, GRAY);
    y -= 13;
  }

  y -= 6;
  line(page, totalsX, y, PW - MARGIN, y, GOLD, 0.75);
  y -= 14;
  txt(page, "Samtals m. vsk.:", totalsX, y, fontBold, 11, DARK);
  const gtv = formatISK(totalInclVat);
  const gtw = fontBold.widthOfTextAtSize(gtv, 13);
  txt(page, gtv, PW - MARGIN - gtw, y, fontBold, 13, GOLD);

  drawFooter(page, PW, fontReg);

  // ── Summary page (by Rými) — appended when there are multiple rooms ───────
  if (includeSummary) {
    const SPW = PW;
    const SPH = PH;
    const SCW = SPW - MARGIN * 2;

    const sPage = doc.addPage([SPW, SPH]);
    let sy = drawHeader(sPage, project, logoImg, SPW, SPH, fontBold, fontReg, estimate);

    txt(sPage, project["Tilboðsblaðs heiti"] || (estimate ? "Verðhugmynd" : "Tilboð"), MARGIN, sy, fontBold, 14, DARK);
    const subLabel = "Samantekt eftir rými";
    const subLabelW = fontReg.widthOfTextAtSize(subLabel, 8);
    txt(sPage, subLabel, SPW - MARGIN - subLabelW, sy, fontReg, 8, GRAY);
    sy -= 28;

    const roomOrder = [];
    const roomTotals = new Map();
    let currentRoom = "Óskilgreint";
    for (const item of lineItems) {
      if (item["Rými 🏡"]) currentRoom = item["Rými 🏡"];
      const qty       = parseFloat(item["Magn"]        ?? 1) || 1;
      const unitPrice = parseFloat(item["Einingarverð"] ?? 0) || 0;
      const lineInclVat = unitPrice * qty * 1.24;
      if (!roomTotals.has(currentRoom)) { roomOrder.push(currentRoom); roomTotals.set(currentRoom, 0); }
      roomTotals.set(currentRoom, roomTotals.get(currentRoom) + lineInclVat);
    }

    const COL_ROOM_W = SCW * 0.65;
    const COL_VAL_X  = MARGIN + COL_ROOM_W;
    const COL_VAL_W  = SCW * 0.35;
    const SROW_H = 22;

    rect(sPage, MARGIN, sy - 5, SCW, 20, GOLD_TINT);
    txt(sPage, "Rými", MARGIN + 3, sy, fontBold, 8.5, DARK);
    const hdrLabel = "Samtals m. vsk.";
    const hdrLabelW = fontBold.widthOfTextAtSize(hdrLabel, 8.5);
    txt(sPage, hdrLabel, COL_VAL_X + COL_VAL_W - hdrLabelW - 3, sy, fontBold, 8.5, DARK);
    sy -= 14;
    line(sPage, MARGIN, sy, SPW - MARGIN, sy, GOLD, 0.5);
    sy -= 6;

    let grandTotal = 0;
    for (let i = 0; i < roomOrder.length; i++) {
      const room  = roomOrder[i];
      const total = roomTotals.get(room);
      grandTotal += total;
      if (i % 2 === 0) rect(sPage, MARGIN, sy - 4, SCW, SROW_H, LIGHT);
      txt(sPage, room, MARGIN + 3, sy, fontBold, 9, DARK);
      const valStr = formatISK(total);
      const valW   = fontReg.widthOfTextAtSize(valStr, 9);
      txt(sPage, valStr, COL_VAL_X + COL_VAL_W - valW - 3, sy, fontReg, 9, DARK);
      sy -= SROW_H;
    }

    sy -= 10;
    line(sPage, MARGIN, sy, SPW - MARGIN, sy, GRAY, 0.4);
    sy -= 16;

    const grandExVat = grandTotal / 1.24;
    const grandVat   = grandTotal - grandExVat;
    const sTotalsX   = MARGIN + COL_ROOM_W;

    const sSummaryRows = [
      { label: "Samtals (án VSK):", value: formatISK(grandExVat) },
      { label: "VSK 24%:",          value: formatISK(grandVat)   },
    ];
    if (totalDiscountInclVat > 0) {
      sSummaryRows.push({ label: "Afsláttur samtals:", value: formatISK(totalDiscountInclVat) });
    }
    for (const row of sSummaryRows) {
      txt(sPage, row.label, sTotalsX, sy, fontReg, 9, GRAY);
      const vw = fontReg.widthOfTextAtSize(row.value, 9);
      txt(sPage, row.value, SPW - MARGIN - vw, sy, fontReg, 9, GRAY);
      sy -= 13;
    }

    sy -= 6;
    line(sPage, sTotalsX, sy, SPW - MARGIN, sy, GOLD, 0.75);
    sy -= 14;
    txt(sPage, "Samtals m. vsk.:", sTotalsX, sy, fontBold, 11, DARK);
    const sgtv = formatISK(grandTotal);
    const sgtw = fontBold.widthOfTextAtSize(sgtv, 13);
    txt(sPage, sgtv, SPW - MARGIN - sgtw, sy, fontBold, 13, GOLD);

    drawFooter(sPage, SPW, fontReg);
  }

  if (estimate) {
    for (const p of doc.getPages()) drawWatermark(p, fontBold, p.getWidth(), p.getHeight());
  }

  return doc.save();
}

// ── Virtual installation line items (for combined PDF) ───────────────────────

function buildInstallationLineItems(project, installPriceInclVat, deliveryPriceInclVat) {
  const items = [];
  const ROOM = "Uppsetning";

  if (installPriceInclVat > 0) {
    items.push({
      "Rými 🏡":     ROOM,
      "Vara 🚪":     "Uppsetning",
      "útfærsla 🎨": "",
      "Magn":        1,
      "Einingarverð": installPriceInclVat / 1.24,
      "Afsl. %":     0,
    });
  }

  const tripsRaw    = project["Fjöldi ferða 🚚"] || "";
  const tripsClean  = tripsRaw.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
  const freeTrip    = project["Ein ferð ókeypis"];
  const TRIP_PRICES = {
    "1 Ferð 🚚": 20000, "2 Ferðir 🚚🚚": 35000,
    "3 Ferðir 🚚🚚🚚": 50000, "4 Ferðir 🚚🚚🚚🚚": 65000,
  };
  const fullDeliveryPrice = TRIP_PRICES[tripsRaw] || deliveryPriceInclVat;
  const freeTripDiscount  = freeTrip ? (tripsRaw === "1 Ferð 🚚" ? 20000 : 15000) : 0;

  if (fullDeliveryPrice > 0) {
    const label = tripsClean ? `Heimsending — ${tripsClean}` : "Heimsending";
    items.push({
      "Rými 🏡":     ROOM,
      "Vara 🚪":     label,
      "útfærsla 🎨": "",
      "Magn":        1,
      "Einingarverð": fullDeliveryPrice / 1.24,
      "Afsl. %":     0,
    });
    if (freeTripDiscount > 0) {
      items.push({
        "Rými 🏡":     ROOM,
        "Vara 🚪":     "Afsláttur — Ein ferð ókeypis",
        "útfærsla 🎨": "",
        "Magn":        1,
        "Einingarverð": -(freeTripDiscount / 1.24),
        "Afsl. %":     0,
      });
    }
  }

  return items;
}

// ── Installation quote PDF ────────────────────────────────────────────────────

async function buildInstallationPdf(project, installPriceExVat, deliveryPriceInclVat) {
  const doc      = await PDFDocument.create();
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

  const page = doc.addPage([PW, PH]);
  let y = drawHeader(page, project, logoImg, PW, PH, fontBold, fontReg);

  // Title
  const quoteTitle = (project["Tilboðsblaðs heiti"] || "Tilboð") + " — Uppsetning";
  txt(page, quoteTitle, MARGIN, y, fontBold, 14, DARK);

  const validStr = "Tilboð gildir í 30 daga frá útgáfudegi";
  const validW = fontReg.widthOfTextAtSize(validStr, 8);
  txt(page, validStr, PW - MARGIN - validW, y, fontReg, 8, GRAY);
  y -= 22;

  // Customer info
  txt(page, "TENGILIÐUR", MARGIN, y, fontBold, 7, GOLD);
  y -= 13;
  txt(page, lv(project["Fullt nafn 👤"]), MARGIN, y, fontBold, 10, DARK);
  y -= 13;
  const phone = lv(project["Símanúmer ☎️"]);
  const email = lv(project["Netfang 📧"]);
  if (phone) { txt(page, String(phone), MARGIN, y, fontReg, 8.5, GRAY); y -= 12; }
  if (email) { txt(page, String(email), MARGIN, y, fontReg, 8.5, GRAY); y -= 12; }
  y -= 14;

  // Gold rule
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 0.75);
  y -= 20;

  // Column header
  const COL_LABEL_W = CW * 0.65;
  const COL_VAL_X   = MARGIN + COL_LABEL_W;
  const COL_VAL_W   = CW * 0.35;

  rect(page, MARGIN, y - 5, CW, 18, GOLD_TINT);
  txt(page, "Þjónusta", MARGIN + 3, y, fontBold, 7.5, DARK);
  const hdr = "Samtals m. vsk.";
  const hdrW = fontBold.widthOfTextAtSize(hdr, 7.5);
  txt(page, hdr, COL_VAL_X + COL_VAL_W - hdrW - 3, y, fontBold, 7.5, DARK);
  y -= 16;
  line(page, MARGIN, y, PW - MARGIN, y, GOLD, 0.5);
  y -= 4;

  // Rows — both field values already include VAT
  const tripsRaw = project["Fjöldi ferða 🚚"] || "";
  const tripsClean = tripsRaw.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
  const freeTrip = project["Ein ferð ókeypis"];

  const TRIP_PRICES = {
    "1 Ferð 🚚": 20000, "2 Ferðir 🚚🚚": 35000,
    "3 Ferðir 🚚🚚🚚": 50000, "4 Ferðir 🚚🚚🚚🚚": 65000,
  };
  const fullDeliveryPrice = TRIP_PRICES[tripsRaw] || deliveryPriceInclVat;
  const freeTripDiscount  = freeTrip ? (tripsRaw === "1 Ferð 🚚" ? 20000 : 15000) : 0;
  const deliveryLabel     = tripsClean ? `Heimsending — ${tripsClean}` : "Heimsending";

  const rows = [
    { label: "Uppsetning", amount: installPriceExVat },
    ...(fullDeliveryPrice > 0 ? [
      { label: deliveryLabel,              amount: fullDeliveryPrice  },
      ...(freeTripDiscount > 0 ? [
        { label: "Afsláttur — Ein ferð ókeypis", amount: -freeTripDiscount, isDiscount: true },
      ] : []),
    ] : []),
  ].filter((r) => r.amount !== 0 || r.isDiscount);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowColor = row.isDiscount ? GRAY : DARK;
    if (!row.isDiscount && i % 2 === 0) rect(page, MARGIN, y - 3, CW, 15, LIGHT);
    txt(page, row.label, MARGIN + 3, y, fontReg, 8, rowColor);
    const rv = row.isDiscount ? `- ${formatISK(-row.amount)}` : formatISK(row.amount);
    const rvw = fontReg.widthOfTextAtSize(rv, 8);
    txt(page, rv, COL_VAL_X + COL_VAL_W - rvw - 3, y, fontReg, 8, rowColor);
    y -= 15;
  }

  const totalInclVat = installPriceExVat + deliveryPriceInclVat;
  const priceExVat   = totalInclVat / 1.24;
  const vatAmount    = totalInclVat - priceExVat;

  // Totals
  y -= 22;
  line(page, MARGIN, y, PW - MARGIN, y, GRAY, 0.4);
  y -= 16;

  const totalsX = PW - MARGIN - 230;
  for (const row of [
    { label: "Samtals (án VSK):", value: formatISK(priceExVat) },
    { label: "VSK 24%:",          value: formatISK(vatAmount)  },
  ]) {
    txt(page, row.label, totalsX, y, fontReg, 9, GRAY);
    const vw = fontReg.widthOfTextAtSize(row.value, 9);
    txt(page, row.value, PW - MARGIN - vw, y, fontReg, 9, GRAY);
    y -= 13;
  }

  y -= 6;
  line(page, totalsX, y, PW - MARGIN, y, GOLD, 0.75);
  y -= 14;
  txt(page, "Samtals m. vsk.:", totalsX, y, fontBold, 11, DARK);
  const gtv = formatISK(totalInclVat);
  const gtw = fontBold.widthOfTextAtSize(gtv, 13);
  txt(page, gtv, PW - MARGIN - gtw, y, fontBold, 13, GOLD);

  // Disclaimer
  y -= 32;
  line(page, MARGIN, y, PW - MARGIN, y, LIGHT, 0.5);
  y -= 14;

  const disclaimerParas = [
    "Tilboðið nær eingöngu til þeirrar vinnu sem sérstaklega er tilgreind og miðast við að aðstæður á verkstað séu eðlilegar og í samræmi við þær upplýsingar sem lágu fyrir við tilboðsgerð.",
    "Ófyrirséðar aðstæður, þar með talið en ekki takmarkað við miklar skekkjur í gólfi eða veggjum, frávik í lögnum, dreni, burðarflötum, festingum eða aðrar aðstæður sem kalla á aukavinnu, breytingar eða sérlausnir, teljast ekki hluti af föstu tilboðsverði.",
    "Slík vinna er rukkuð sérstaklega í tímavinnu samkvæmt tímagjaldi að fjárhæð kr. 13.000 + vsk. á klst., auk efnis, aksturs eða annars útlagðs kostnaðar, ef við á.",
  ];
  const DISC_SIZE = 7.5;
  const DISC_LEAD = 11;
  for (const para of disclaimerParas) {
    for (const l of wrapText(fontReg, para, DISC_SIZE, CW)) {
      txt(page, l, MARGIN, y, fontReg, DISC_SIZE, GRAY);
      y -= DISC_LEAD;
    }
    y -= 6;
  }

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

  const { recordId, mode = "separate" } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "recordId is required" });

  // mode: "separate" → 2 PDFs (cabinets + installation)
  // mode: "combined" → 1 PDF (installation appears as line items under Uppsetning room)
  // mode: "estimate" → same as "combined", but no date, no validity line, and a red
  //                     "Aðeins verðhugmynd, ógilt sem tilboð" watermark on every page

  try {
    console.log(`Generating quote for record: ${recordId} (mode: ${mode})`);

    const project   = await getProject(token, recordId);
    const linkedIds = project[LINKED_FIELD] || [];
    const lineItems = await getLineItems(token, linkedIds);

    const installPriceInclVat  = parseFloat(project[INSTALL_PRICE_FIELD]  ?? 0) || 0;
    const deliveryPriceInclVat = parseFloat(project[DELIVERY_PRICE_FIELD] ?? 0) || 0;
    const hasInstallationData  = installPriceInclVat > 0 || deliveryPriceInclVat > 0;

    const safeTitle = (project["Tilboðsblaðs heiti"] || "Tilboð")
      .replace(/[/\\:*?"<>]/g, "-")
      .trim();

    console.log("Clearing old attachments…");
    await clearAttachments(token, recordId);

    if ((mode === "combined" || mode === "estimate") && hasInstallationData) {
      const isEstimate   = mode === "estimate";
      const virtualItems = buildInstallationLineItems(project, installPriceInclVat, deliveryPriceInclVat);
      const allItems     = [...lineItems, ...virtualItems];
      const allRooms     = new Set(allItems.map((i) => i["Rými 🏡"] || "").filter(Boolean));
      console.log(`${isEstimate ? "Estimate" : "Combined"} PDF — ${allItems.length} items (${virtualItems.length} installation)`);
      const pdfBytes = await buildPdf(project, allItems, allRooms.size > 1, isEstimate);
      await uploadPdf(
        token,
        recordId,
        pdfBytes,
        isEstimate ? `${safeTitle} | Verðhugmynd.pdf` : `${safeTitle} | Tilboð & Uppsetning.pdf`
      );
    } else if (mode === "estimate") {
      // No installation data — estimate mode still needs the watermark applied to the cabinets-only PDF.
      const uniqueRooms = new Set(lineItems.map((i) => i["Rými 🏡"] || "").filter(Boolean));
      console.log(`Estimate PDF (no installation data) — ${lineItems.length} items`);
      const pdfBytes = await buildPdf(project, lineItems, uniqueRooms.size > 1, true);
      await uploadPdf(token, recordId, pdfBytes, `${safeTitle} | Verðhugmynd.pdf`);
    } else {
      const uniqueRooms = new Set(lineItems.map((i) => i["Rými 🏡"] || "").filter(Boolean));
      const pdfBytes    = await buildPdf(project, lineItems, uniqueRooms.size > 1);
      console.log(`Cabinets PDF — ${lineItems.length} items`);
      await uploadPdf(token, recordId, pdfBytes, `${safeTitle} | Tilboð.pdf`);

      if (hasInstallationData) {
        console.log(`Installation PDF — uppsetning: ${formatISK(installPriceInclVat)}, heimsending: ${formatISK(deliveryPriceInclVat)}`);
        const installPdfBytes = await buildInstallationPdf(project, installPriceInclVat, deliveryPriceInclVat);
        await uploadPdf(token, recordId, installPdfBytes, `${safeTitle} | Uppsetning.pdf`);
      }
    }

    console.log("Done.");

    return res.status(200).json({
      success: true,
      recordId,
      mode,
      installationPrice: installPriceInclVat || null,
      deliveryPrice: deliveryPriceInclVat || null,
    });
  } catch (err) {
    console.error("Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
