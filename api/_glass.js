// api/_glass.js
// Björninn ehf. — shared helpers for glass / mirror orders (Ísspan).
// Used by api/glass-order.js (collect a project's unordered glass into an
// order) and api/generate-order-pdf.js (re-render a glass order's PDF).
// Underscore prefix = not a route.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const AIRTABLE_BASE = "app91U15z9K704Okd";

export const T = {
  projects: "tbl4LMXlQjp66RFKI",   // Tækifæri 📣
  glass: "tblgYiWIdDbXIhdw5",      // Gler & speglar 🪟
  orders: "tblSccfV2lBp4FiFU",     // Pantaðir listar
  companies: "tbl2akoCETBx9S1SK",  // Fyrirtæki 🏢
};

// Gler & speglar 🪟
export const G = {
  desc: "fldMjWCKs2IQZHTSR",
  project: "fldODfQPNykveTfBZ",
  unitName: "fldlaczfsfi3DOohs",
  type: "fldbmeScD8ovJHKHy",
  kind: "fldLSF0eDTbWW0Tlf",
  thickness: "fldK0FAJzSbHXZqbl",
  width: "fldWPM8gGL5JMoDCh",
  height: "fld3QnJHiLPJZEyCU",
  qty: "fld6TDZv4R6nGyA3j",
  edge: "fldJkOeJmUQZ853oT",
  tempered: "fld2iLxw4IRoVbhda",
  note: "fldNh5rQiMYtps3PI",
  order: "fldwZsKvSJd8ZHdSy",
  open: "fldHiz9K5nJmgAG7e",
};

// Pantaðir listar
export const O = {
  name: "fldxP74Uxdxk3I58K",
  status: "fldTXya1SZOLMhfS9",
  delivery: "fldV1yrxFwNicJ7eh",
  project: "fldAbQzOiuSUOyTkG",
  supplier: "fldTSJOspcw1IMJns",
  pdf: "fldtAwH9pxf3QSNO3",
  glass: "fldyYED03Y3qGP8Ga",
};

// Tækifæri
export const P = {
  name: "fldDC7LI0D4cUeCds",
  glass: "fld6hkz8U1Icvnx6d",
};

export const COMPANY_NAME = "fldj92sSvO8UJStdE";
export const STATUS_PREP = "Í undirbúningi";

// ── Airtable ──────────────────────────────────────────────────────────────────

function headers(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function at(token, path, opts = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`, {
    ...opts,
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getRecord(token, table, id) {
  const data = await at(token, `${table}/${id}?returnFieldsByFieldId=true`);
  return data.fields;
}

// Fetch records by id (fields keyed by field id), in the order given.
export async function getRecords(token, table, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
    let offset;
    do {
      const q = `filterByFormula=${encodeURIComponent(formula)}&returnFieldsByFieldId=true` +
        (offset ? `&offset=${offset}` : "");
      const data = await at(token, `${table}?${q}`);
      for (const r of data.records) out.set(r.id, r.fields);
      offset = data.offset;
    } while (offset);
  }
  return ids.filter((id) => out.has(id)).map((id) => ({ id, fields: out.get(id) }));
}

export async function patchRecords(token, table, records) {
  for (let i = 0; i < records.length; i += 10) {
    await at(token, table, {
      method: "PATCH",
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true }),
    });
  }
}

export async function replacePdf(token, orderId, pdfBytes, filename) {
  await at(token, `${T.orders}/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { [O.pdf]: [] } }),
  });
  const res = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${orderId}/${O.pdf}/uploadAttachment`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        filename,
        contentType: "application/pdf",
        file: Buffer.from(pdfBytes).toString("base64"),
      }),
    }
  );
  if (!res.ok) throw new Error(`Upload ${res.status}: ${await res.text()}`);
}

export function safeFilename(s) {
  return String(s || "Pontun").replace(/[/\\:*?"<>]/g, "-").trim();
}

// ── Row helpers ───────────────────────────────────────────────────────────────

const selName = (v) => (v && typeof v === "object" ? v.name : v) || "";
const first = (v) => (Array.isArray(v) ? v[0] : v);

export function rowView(fields) {
  return {
    desc: fields[G.desc] || "",
    unit: (fields[G.unitName] || []).filter(Boolean).join(", "),
    type: selName(fields[G.type]),
    kind: selName(fields[G.kind]),
    thickness: selName(fields[G.thickness]),
    width: Number(fields[G.width]) || 0,
    height: Number(fields[G.height]) || 0,
    qty: Number(fields[G.qty]) || 0,
    edge: selName(fields[G.edge]),
    tempered: Boolean(fields[G.tempered]),
    note: fields[G.note] || "",
  };
}

// Everything Ísspan needs to cut the piece — refuse to order without it.
export function missingInfo(v) {
  const m = [];
  if (!v.kind) m.push("gerð glers");
  if (!v.thickness) m.push("þykkt");
  if (v.width <= 0) m.push("breidd");
  if (v.height <= 0) m.push("hæð");
  if (v.qty <= 0) m.push("magn");
  return m;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const GOLD = rgb(0.808, 0.694, 0.388);
const DARK = rgb(0.102, 0.102, 0.102);
const GRAY = rgb(0.431, 0.431, 0.431);
const LIGHT = rgb(0.941, 0.941, 0.941);
const GOLD_TINT = rgb(0.980, 0.961, 0.906);
const MARGIN = 40;

const LOGO_URL =
  "https://raw.githubusercontent.com/bjorninninnrettingar/bjorninn-quote-generator/main/Lo%CC%81go%CC%81%20a%CC%81%20hvi%CC%81tum.png";

function stripEmoji(str) {
  return String(str ?? "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Emoji_Modifier}‍︎️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(font, str, size, maxW) {
  const words = stripEmoji(str).split(" ").filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) <= maxW) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function formatDate(val) {
  const d = val ? new Date(val) : new Date();
  return d.toLocaleDateString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function buildGlassPdf({ title, projectName, delivery, rows }) {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  let logo = null;
  try {
    const r = await fetch(LOGO_URL);
    if (r.ok) logo = await doc.embedPng(new Uint8Array(await r.arrayBuffer()));
  } catch (e) {
    console.warn("Logo failed:", e.message);
  }

  const PW = 841.89;
  const PH = 595.28;
  const CW = PW - MARGIN * 2;

  const t = (page, s, x, y, font, size, color = DARK) => {
    const c = stripEmoji(s);
    if (c) page.drawText(c, { x, y, size, font, color });
  };
  const hline = (page, y, color = GOLD, th = 0.75) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PW - MARGIN, y }, thickness: th, color });

  const cols = [
    { label: "#", w: 0.04 },
    { label: "Lýsing / eining", w: 0.2 },
    { label: "Tegund", w: 0.1 },
    { label: "Gerð glers", w: 0.13 },
    { label: "Þykkt", w: 0.06 },
    { label: "Breidd × Hæð (mm)", w: 0.13 },
    { label: "Magn", w: 0.06 },
    { label: "Kantur", w: 0.07 },
    { label: "Hert", w: 0.05 },
    { label: "Göt / úrtök / athugasemd", w: 0.16 },
  ];
  let xc = MARGIN;
  for (const c of cols) {
    c.x = xc;
    c.pw = CW * c.w;
    xc += c.pw;
  }

  const SIZE = 8;
  const LINE = 10;
  const FOOTER = 40;
  let pageNo = 0;
  let page;
  let y;

  function header() {
    page = doc.addPage([PW, PH]);
    pageNo += 1;
    y = PH - MARGIN;
    if (logo) {
      const w = 150;
      const h = (w * logo.height) / logo.width;
      page.drawImage(logo, { x: MARGIN, y: y - h / 2, width: w, height: h });
      y -= h / 2 + 6;
    } else {
      t(page, "BJÖRNINN INNRÉTTINGAR", MARGIN, y, bold, 16, GOLD);
      y -= 22;
    }
    const d = `Dagsetning: ${formatDate()}`;
    t(page, d, PW - MARGIN - reg.widthOfTextAtSize(d, 8), PH - MARGIN, reg, 8, GRAY);
    hline(page, y, GOLD, 1);
    y -= 18;

    if (pageNo === 1) {
      t(page, `GLERPÖNTUN — ${title}`, MARGIN, y, bold, 14);
      y -= 16;
      t(page, `Verkefni: ${projectName}`, MARGIN, y, reg, 9, GRAY);
      y -= 14;
      const boxH = delivery ? 34 : 22;
      page.drawRectangle({ x: MARGIN, y: y - boxH + 10, width: CW, height: boxH, color: GOLD_TINT });
      let cy = y;
      if (delivery) {
        t(page, `Óskað er eftir afhendingu eigi síðar en: ${formatDate(delivery)}`, MARGIN + 8, cy, bold, 9);
        cy -= 12;
      }
      t(page, "Öll mál eru í mm, breidd × hæð. Vinsamlegast staðfestið móttöku og afhendingardag.", MARGIN + 8, cy, reg, 8.5);
      y -= boxH + 10;
    }

    page.drawRectangle({ x: MARGIN, y: y - 14, width: CW, height: 16, color: GOLD_TINT });
    for (const c of cols) t(page, c.label, c.x + 3, y - 9, bold, 7);
    y -= 16;
    hline(page, y, GOLD, 0.5);
  }

  function footer() {
    hline(page, 30, LIGHT, 0.5);
    t(page, "Björninn ehf.  |  Álfhella 5, 221 Hafnarfjörður  |  bjorninn@bjorninninnrettingar.is  |  bjorninninnrettingar.is",
      MARGIN, 20, reg, 6.5, GRAY);
    const p = `Bls. ${pageNo}`;
    t(page, p, PW - MARGIN - reg.widthOfTextAtSize(p, 6.5), 20, reg, 6.5, GRAY);
  }

  header();
  let totalPieces = 0;

  rows.forEach((r, i) => {
    const cells = [
      String(i + 1),
      [r.desc, r.unit].filter(Boolean).join(" · "),
      r.type,
      r.kind,
      r.thickness,
      `${r.width} × ${r.height}`,
      String(r.qty),
      r.edge,
      r.tempered ? "Já" : "",
      r.note,
    ];
    const wrapped = cells.map((s, ci) => wrap(ci === 5 || ci === 6 ? bold : reg, s, SIZE, cols[ci].pw - 6));
    const h = Math.max(...wrapped.map((l) => l.length)) * LINE + 6;

    if (y - h < MARGIN + FOOTER) {
      footer();
      header();
    }

    if (i % 2 === 0) page.drawRectangle({ x: MARGIN, y: y - h, width: CW, height: h, color: LIGHT });
    wrapped.forEach((lines, ci) => {
      lines.forEach((l, li) =>
        t(page, l, cols[ci].x + 3, y - 10 - li * LINE, ci === 5 || ci === 6 ? bold : reg, SIZE));
    });
    y -= h;
    totalPieces += r.qty;
  });

  y -= 14;
  const sum = `Samtals: ${rows.length} lín${rows.length === 1 ? "a" : "ur"}, ${totalPieces} stk.`;
  t(page, sum, PW - MARGIN - bold.widthOfTextAtSize(sum, 10), y, bold, 10);
  footer();

  return doc.save();
}

// Render + upload the PDF for an existing glass order. Returns line count.
export async function renderGlassOrder(token, orderId) {
  const order = await getRecord(token, T.orders, orderId);
  const glassIds = order[O.glass] || [];
  const rows = (await getRecords(token, T.glass, glassIds)).map((r) => rowView(r.fields));

  const projectId = first(order[O.project]);
  const project = projectId ? await getRecord(token, T.projects, projectId) : {};
  const projectName = project[P.name] || "";
  const title = order[O.name] || projectName || "Glerpöntun";

  const bytes = await buildGlassPdf({ title, projectName, delivery: order[O.delivery], rows });
  await replacePdf(token, orderId, bytes, `${safeFilename(title)}.pdf`);
  return rows.length;
}
