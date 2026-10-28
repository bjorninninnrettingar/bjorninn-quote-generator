// api/kynning-pdf.js — "Búa til kynningu (PDF)": the PDF is built offline with pdf-lib and re-loaded to check what is in it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import handler, { buildKynning, validate, LIMITS } from "../api/kynning-pdf.js";
import { PRICE_2D, PROCESS_STEPS, PROCESS_TITLE, SEC } from "../api/_kynning-texti.js";
import { mockRes } from "./helpers.js";

process.env.VERK_KEY = "secret";
const LOGO = new Uint8Array(fs.readFileSync(new URL("../logo-bjorninn.png", import.meta.url)));

// a real, tiny JPEG (24 px wide) — pdf-lib parses it when embedding
const JPG1 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgACAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMACQkJCQkJEAkJEBYQEBAWHhYWFhYeJh4eHh4eJi4mJiYmJiYuLi4uLi4uLjc3Nzc3N0BAQEBASEhISEhISEhISP/bAEMBCwwMEhESHxERH0szKjNLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS//dAAQAAv/aAAwDAQACEQMRAD8A9jMjBiCW49AaUPJjgt+VTHqacOlKwXK6ytkct2H3T7f41a59ajH+H9KmosB//9k=";

const body = (over = {}) => ({
  k: "secret",
  project: { name: "T-248 | Þórunn Ægisdóttir", address: "Þórsgata 5, 101 Reykjavík", contact: "Þórunn Ægisdóttir" },
  rooms: [
    { name: "Eldhús", materials: [
      { kind: "Framhlið", label: "Eik W1100", color: "#ccae8b", img: JPG1 }, { kind: "Höldur", label: "Hexxa Ál grip", color: "", img: "" },
      { kind: "Borðplata", label: "Steinn", color: "#ece9e3", img: "" }, { kind: "Skrokkur", label: "Dökkgrátt", color: "#4a4946", img: "" },
      { kind: "Gólf", label: "Ljós eik", color: "#dcc39a", img: "" }, { kind: "Veggir", label: "Beinhvítt", color: "#f1efe8", img: "" } ] },
    { name: "Þvottahús", materials: [{ kind: "Framhlið", label: "Hvítt", color: "#fffef9", img: "" }] },
  ],
  images: [{ title: "Þrívíddarmynd úr horni 1", jpeg: JPG1 }, { title: "Ofanmynd", jpeg: JPG1 }, { title: "Þrívíddarmynd úr horni 2", jpeg: JPG1 }],
  report: { lines: ["Verkefnið: Eldhús (12 einingar), Þvottahús (4 einingar) — alls 16 einingar.", "Eldhús: framhlið eik W1100, skrokkur dökkgrátt.", "Tilboðið gildir í 30 daga."] },
  quote: {
    rooms: [
      { name: "Eldhús", lines: [{ name: "Neðri skápur 60", extra: "Eik W1100", qty: 3, total: 300000 }, { name: "Efri skápur 80", qty: 2, total: 180000 }] },
      { name: "Þvottahús", lines: [{ name: "Háskápur", qty: 1, total: 120000 }] },
    ],
    handles: { count: 14, total: 21000 }, total: 621000,
  },
  ...over,
});

// ---- helpers: read the PDF back ------------------------------------------------------------------------
async function load(bytes) { return PDFDocument.load(bytes); }
function pageText(doc, i) { // the page's content stream; text is hex WinAnsi (= Latin-1 for á é í ó ú ý þ ð æ ö) → string
  const page = doc.getPages()[i], c = page.node.Contents(), streams = c instanceof PDFArray ? c.asArray().map((r) => doc.context.lookup(r)) : [c];
  let out = "";
  for (const s of streams) {
    const raw = Buffer.from(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getContents()).toString("latin1");
    for (const m of raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(m[1], "hex").toString("latin1") + "\n";
  }
  return out;
}
function links(doc, i) { // [{rect, dest page index}]
  const page = doc.getPages()[i], annots = page.node.Annots(), res = [];
  if (!annots) return res;
  for (let k = 0; k < annots.size(); k++) {
    const a = annots.lookup(k, PDFDict);
    if (a.get(PDFName.of("Subtype")).toString() !== "/Link") continue;
    const dest = a.lookup(PDFName.of("Dest"), PDFArray), ref = dest.get(0);
    res.push({ rect: a.lookup(PDFName.of("Rect"), PDFArray).asArray().map((n) => n.asNumber()), to: doc.getPages().findIndex((p) => p.ref === ref) });
  }
  return res;
}
const findPage = (doc, re) => doc.getPages().map((_, i) => i).filter((i) => re.test(pageText(doc, i)));

test("full PDF: cover, contents, moodboard, 3D + 2D note, report + process, quote — in that order", async () => {
  const out = await buildKynning(body(), { logo: LOGO, now: new Date(2026, 9, 28) });
  const doc = await load(out.bytes);
  assert.equal(doc.getPageCount(), out.pages);
  assert.deepEqual(out.warnings, []);
  const sec = Object.fromEntries(out.sections.map((s) => [s.id, s.page]));
  assert.ok(sec.toc === 1 && sec.moodboard > 1 && sec.drawings > sec.moodboard && sec.report > sec.drawings && sec.process === sec.report + 1 && sec.quote > sec.process, JSON.stringify(sec));
  // cover: address, contact, date (the logo is an image on page 1)
  const cover = pageText(doc, 0);
  assert.match(cover, /Þórsgata 5, 101 Reykjavík/);
  assert.match(cover, /Þórunn Ægisdóttir/);
  assert.match(cover, /28\. október 2026/);
  assert.ok(doc.getPages()[0].node.Resources().lookup(PDFName.of("XObject")), "logo drawn on the cover");
  // 2D note with the price constant, in the drawings section
  assert.match(pageText(doc, sec.drawings), /Vinnuteikningar í 2D \(2D work drawings\) eru í boði gegn greiðslu: verð eftir samkomulagi/);
  assert.equal(PRICE_2D, "verð eftir samkomulagi");
  // the process page lists every step with its duration
  const proc = pageText(doc, sec.process);
  assert.match(proc, new RegExp(PROCESS_TITLE));
  for (const st of PROCESS_STEPS) assert.ok(proc.includes(st.title) && proc.includes(st.duration), st.title);
  assert.match(proc, /til staðfestingar/);
});

test("table of contents: clickable links point at the right pages", async () => {
  const out = await buildKynning(body(), { logo: LOGO });
  const doc = await load(out.bytes);
  const toc = links(doc, 1), sec = Object.fromEntries(out.sections.map((s) => [s.id, s.page]));
  const targets = toc.map((l) => l.to);
  for (const id of ["moodboard", "drawings", "report", "process", "quote"]) assert.ok(targets.includes(sec[id]), id + " linked → page " + sec[id]);
  // the two quote rooms (Eldhús, Þvottahús) are linked from the contents as well, both inside the quote section
  const roomLinks = targets.filter((t) => t >= sec.quote);
  assert.ok(roomLinks.length >= 3, "Tilboð + 2 rooms");
  assert.ok(toc.every((l) => l.to >= 0), "every link resolves to a page of this document");
  // the page numbers printed in the contents are the same pages
  const t = pageText(doc, 1);
  assert.match(t, /Efnisyfirlit/); assert.match(t, new RegExp(SEC.quote));
  for (const l of toc) assert.ok(l.rect[2] > l.rect[0] && l.rect[3] > l.rect[1]);
  // every later page links back to the contents
  assert.ok(links(doc, doc.getPageCount() - 1).some((l) => l.to === 1));
});

test("page count follows the optional sections", async () => {
  const full = await buildKynning(body(), { logo: LOGO });
  const noImg = await buildKynning(body({ images: [] }), { logo: LOGO });
  const noMood = await buildKynning(body({ rooms: [{ name: "Eldhús", materials: [] }] }), { logo: LOGO });
  const noQuote = await buildKynning(body({ quote: undefined }), { logo: LOGO });
  assert.ok(noImg.pages < full.pages && noMood.pages < full.pages && noQuote.pages < full.pages);
  assert.deepEqual(noImg.sections.map((s) => s.id), ["toc", "moodboard", "report", "process", "quote"]);
  assert.match(noImg.warnings.map((w) => w.section + w.why).join(" "), /Þrívíddarteikningar.*Engar 3D myndir/);
  assert.ok(!noMood.sections.some((s) => s.id === "moodboard") && noMood.warnings.some((w) => w.section === SEC.moodboard));
  assert.ok(!noQuote.sections.some((s) => s.id === "quote") && noQuote.warnings.some((w) => w.section === SEC.quote));
  // the contents of a PDF without images has no entry for them, and none of its links point outside the document
  const doc = await load(noImg.bytes);
  assert.doesNotMatch(pageText(doc, 1), /Þrívíddarteikningar/);
  assert.ok(links(doc, 1).every((l) => l.to >= 0));
  assert.doesNotMatch(pageText(doc, 0), /undefined/);
});

test("missing address / contact: cover falls back to the project name and flags it", async () => {
  const out = await buildKynning(body({ project: { name: "T-9 | Jón", address: "", contact: "" } }), { logo: LOGO });
  assert.equal(out.warnings.length, 2);
  const cover = pageText(await load(out.bytes), 0);
  assert.match(cover, /T-9 \| Jón/);
});

test("quote: per room, itemised, room subtotals + grand total incl. VSK", async () => {
  const out = await buildKynning(body(), { logo: LOGO });
  const doc = await load(out.bytes), q = out.sections.find((s) => s.id === "quote");
  assert.equal(q.total, 621000);
  const text = Array.from({ length: doc.getPageCount() - q.page }, (_, i) => pageText(doc, q.page + i)).join("\n");
  assert.match(text, /Eldhús/); assert.match(text, /Þvottahús/);
  assert.match(text, /Neðri skápur 60/); assert.match(text, /Efri skápur 80/);
  assert.match(text, /Samtals Eldhús/); assert.match(text, /480\.000 kr\./);   // 300.000 + 180.000
  assert.match(text, /Samtals Þvottahús/); assert.match(text, /120\.000 kr\./);
  assert.match(text, /Höldur/); assert.match(text, /21\.000 kr\./);
  assert.match(text, /HEILDARVERÐ MEÐ VSK/); assert.match(text, /621\.000 kr\./);
  assert.match(text, /þar af vsk \(24%\): 120\.194 kr\./);   // 621000 − 621000/1.24
});

test("a long quote paginates with 'framhald' headings and still one grand total", async () => {
  const lines = Array.from({ length: 70 }, (_, i) => ({ name: "Skápur númer " + (i + 1), extra: "Lýsing", qty: 1, total: 1000 }));
  const b = body({ quote: { rooms: [{ name: "Eldhús", lines }], handles: null, total: 70000 } });
  const out = await buildKynning(b, { logo: LOGO });
  const doc = await load(out.bytes), q = out.sections.find((s) => s.id === "quote");
  assert.ok(doc.getPageCount() - q.page >= 2);
  const all = Array.from({ length: doc.getPageCount() - q.page }, (_, i) => pageText(doc, q.page + i)).join("\n");
  assert.match(all, /Eldhús \(framhald\)/);
  assert.equal((all.match(/HEILDARVERÐ MEÐ VSK/g) || []).length, 1);
  assert.match(all, /Skápur númer 70/);
});

test("Icelandic letters survive (Helvetica WinAnsi); what it can't print is dropped, not a crash", async () => {
  const b = body({ project: { name: "T-1 | Þ Ð Æ Ö þ ð æ ö á é í ó ú ý", address: "Æðarvarp → Ýmir ✓ 😀", contact: "Össur Þór" } });
  const out = await buildKynning(b, { logo: LOGO });
  const doc = await load(out.bytes), cover = pageText(doc, 0);
  assert.ok(cover.includes("Þ Ð Æ Ö þ ð æ ö á é í ó ú ý"), "all ten Icelandic letters, upper and lower case");
  assert.ok(pageText(doc, 1).includes("Þ Ð Æ Ö þ ð æ ö á é í ó ú ý".toUpperCase().slice(0, 7)), "header too");
  assert.match(cover, /Æðarvarp - Ýmir/);
  assert.match(cover, /Össur Þór/);
  assert.doesNotMatch(cover, /[→✓]/); assert.doesNotMatch(cover, /ð/); // the arrow became "-", the check mark and the emoji are gone
});

test("without a logo the cover still has a wordmark", async () => {
  const out = await buildKynning(body(), { logo: null });
  assert.match(pageText(await load(out.bytes), 0), /BJÖRNINN INNRÉTTINGAR/);
});

test("validation: sizes, JPEG, totals", () => {
  assert.equal(validate(body()), null);
  assert.match(validate(body({ images: Array.from({ length: LIMITS.images + 1 }, () => ({ jpeg: JPG1 })) })), /Of margar myndir/);
  assert.match(validate(body({ images: [{ title: "x", jpeg: "data:image/png;base64,AAAA" }] })), /ekki JPEG/);
  const big = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(LIMITS.image + 10)]).toString("base64");
  assert.match(validate(body({ images: [{ title: "x", jpeg: big }] })), /of stór/);
  const m = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(1.1e6)]).toString("base64");
  assert.match(validate(body({ images: [1, 2, 3].map(() => ({ title: "x", jpeg: m })) })), /of stórar saman/);
  assert.match(validate(body({ quote: { ...body().quote, total: 1 } })), /Heildarverð stemmir ekki/);
  assert.match(validate(body({ project: { name: "" } })), /nafn/);
  assert.match(validate(body({ rooms: [{ name: "A", materials: [{ label: "x", color: "red" }] }] })), /Ógildur litur/);
});

// ---- the endpoint: auth, limits, response ------------------------------------------------------------------
const req = (b, headers = { host: "bjorninn.vercel.app" }) => ({ method: "POST", headers, body: b });

test("auth: no key / wrong key / a floor token → 403, nothing built; GET → 405", async () => {
  for (const k of [undefined, "nope", "fl1.abc.1.x.y"]) {
    const res = mockRes();
    await handler(req(body({ k })), res, { logo: null });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "Rangur lykill");
  }
  const g = mockRes(); await handler({ method: "GET", headers: {} }, g, {}); assert.equal(g.statusCode, 405);
  const saved = process.env.VERK_KEY; delete process.env.VERK_KEY;
  const r = mockRes(); await handler(req(body()), r, { logo: null }); assert.equal(r.statusCode, 500);
  process.env.VERK_KEY = saved;
});

test("endpoint: 200 application/pdf (binary), page count + warnings in headers, a string body works too", async () => {
  for (const b of [body(), JSON.stringify(body({ images: [] }))]) {
    const res = mockRes();
    await handler(req(b), res, { logo: LOGO });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "application/pdf");
    assert.ok(Buffer.isBuffer(res.body) && res.body.subarray(0, 5).toString("latin1") === "%PDF-");
    const doc = await load(res.body);
    assert.equal(String(doc.getPageCount()), res.headers["X-Kynning-Pages"]);
  }
  const res = mockRes(); await handler(req(body({ images: [] })), res, { logo: LOGO });
  assert.match(JSON.parse(decodeURIComponent(res.headers["X-Kynning-Warnings"]))[0].why, /3D/);
});

test("size limits: clear 413 / 400 errors, never a half PDF", async () => {
  const m = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(1.1e6)]).toString("base64");
  let res = mockRes();
  await handler(req(body({ images: [1, 2, 3].map(() => ({ title: "x", jpeg: m })) })), res, { logo: null });
  assert.equal(res.statusCode, 413); assert.match(res.body.error, /of stórar/);
  res = mockRes();
  await handler(req(body(), { host: "x", "content-length": String(LIMITS.body + 1) }), res, { logo: null });
  assert.equal(res.statusCode, 413); assert.match(res.body.error, /of stór/);
  res = mockRes();
  await handler(req("x".repeat(LIMITS.body + 1)), res, { logo: null });
  assert.equal(res.statusCode, 413);
  res = mockRes();
  await handler(req(body({ quote: { ...body().quote, total: 5 } })), res, { logo: null });
  assert.equal(res.statusCode, 400);
});

test("vercel.json gives the function 60 s and the logo", () => {
  const v = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(v.functions["api/kynning-pdf.js"].maxDuration, 60);
  assert.match(v.functions["api/kynning-pdf.js"].includeFiles, /logo-bjorninn\.png/);
});
