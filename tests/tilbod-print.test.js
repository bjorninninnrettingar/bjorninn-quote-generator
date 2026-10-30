// api/tilbod-print.js — "Prenta tilboð" from PRO / CRM (G3 + G13, 2026-10-27): needs the office key, answers with the PDF.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/tilbod-print.js";
import pdf, { tilbodSig, pickQuote } from "../api/tilbod-pdf.js";
import { mockRes, fakeFetch } from "./helpers.js";

const REC = "recAAAAAAAAAAAAAA";
process.env.WEBHOOK_SECRET = "w"; process.env.VERK_KEY = "secret"; process.env.AIRTABLE_TOKEN = "t";
const req = (body) => ({ method: "POST", headers: { host: "bjorninn.vercel.app" }, body });

test("no key / wrong key / bad id: nothing is printed", async () => {
  const f = fakeFetch(() => ({ status: 200, body: {} }));
  for (const [body, code] of [[{ recordId: REC }, 403], [{ recordId: REC, k: "nope" }, 403], [{ recordId: "x", k: "secret" }, 400]]) {
    const res = mockRes();
    await handler(req(body), res, { fetchImpl: f });
    assert.equal(res.statusCode, code);
  }
  assert.equal(f.calls.length, 0);
});

test("prints through generate-quote and returns the new PDF links", async () => {
  const f = fakeFetch((c) => c.url.includes("/api/generate-quote") ? { status: 200, body: { success: true, total: 100 } }
    : c.url.includes("tblQ8zeUanriESWvL/recCONTACT0000000") ? { status: 200, body: { id: "recCONTACT0000000", fields: { "Netfang 📧": " jon@example.is ", "Fornafn ⬅️": "Jón" } } }
    : c.url.includes("fields%5B%5D") ? { status: 422, body: {} } // Airtable's single-record GET refuses fields[]
    : { status: 200, body: { id: REC, fields: { fldwF9nnmsFo2yp1R: ["recCONTACT0000000"], flddIR5JAm8ZM753V: [{ url: "https://dl.airtable/x.pdf", filename: "T-1 | A (Tilboð).pdf" }] } } });
  const res = mockRes();
  await handler(req({ recordId: REC, k: "secret" }), res, { fetchImpl: f, retryMs: 0 });
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls[0].body.recordId, REC);
  assert.deepEqual(res.body.files, [{ url: "https://dl.airtable/x.pdf", filename: "T-1 | A (Tilboð).pdf" }]);
  assert.equal(res.body.total, 100);
  assert.deepEqual(res.body.to, { email: "jon@example.is", first: "Jón" }); // G4: who the Gmail draft goes to
  assert.equal(res.body.link, `https://bjorninn.vercel.app/api/tilbod-pdf?r=${REC}&s=${tilbodSig(REC, "secret")}`);
});

test("tilbod-pdf: a signed link redirects to the current quote PDF; a wrong signature finds nothing", async () => {
  const f = fakeFetch((c) => c.url.includes("fields%5B%5D") ? { status: 422, body: {} } : ({ status: 200, body: { id: REC, fields: { flddIR5JAm8ZM753V: [{ url: "https://dl/u.pdf", filename: "T-1 | A (Uppsetning).pdf" }, { url: "https://dl/t.pdf", filename: "T-1 | A (Tilboð).pdf" }] } } }));
  let res = mockRes();
  await pdf({ query: { r: REC, s: tilbodSig(REC, "secret") } }, res, { fetchImpl: f });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "https://dl/t.pdf");
  for (const q of [{ r: REC, s: "0".repeat(24) }, { r: REC }, { r: "recBBBBBBBBBBBBBB", s: tilbodSig(REC, "secret") }]) {
    res = mockRes();
    await pdf({ query: q }, res, { fetchImpl: f });
    assert.equal(res.statusCode, 404);
  }
  assert.equal(f.calls.length, 1);
  assert.equal(pickQuote([{ filename: "x (Verðhugmynd).pdf" }]).filename, "x (Verðhugmynd).pdf");
});

// G3 rest (2026-10-27): PRO's print appends the designer's drawings to the quote PDF.
import { PDFDocument } from "pdf-lib";
import { appendPdf, quoteFile } from "../api/generate-quote.js";
import drawings from "../api/kp-drawings.js";

test("appendPdf: the drawings' pages follow the quote's own; quoteFile picks the quote, not Uppsetning", async () => {
  const mk = async (n) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([200, 100]); return d.save(); };
  const out = await PDFDocument.load(await appendPdf(await mk(2), await mk(3)));
  assert.equal(out.getPageCount(), 5);
  assert.equal(quoteFile([{ filename: "T-1 (Uppsetning).pdf" }, { filename: "T-1 (Tilboð).pdf" }]).filename, "T-1 (Tilboð).pdf");
});

test("kp-drawings: with the office key an older Tækifæri's drawing is replaced; without it, still refused", async () => {
  const realFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, o = {}) => { calls.push((o.method || "GET") + " " + url);
    const atts = String(url).includes("uploadAttachment") ? [{ id: "attOld1", url: "x" }, { id: "attNew1", url: "y" }] : [{ id: "attOld1", url: "x" }]; // upload appends, then the old one is dropped
    return { ok: true, status: 200, json: async () => ({ id: REC, createdTime: "2026-01-01T00:00:00Z", fields: { "Teikningar úr skipuleggjara 📐": atts, fldO6cbhBV2FQTmLx: atts } }), text: async () => "" }; };
  try {
    const pdf = Buffer.from("%PDF-1.7\n" + "x".repeat(200));
    let res = mockRes();
    await drawings({ method: "POST", query: { recordId: REC }, body: pdf }, res);
    assert.equal(res.statusCode, 403); // old record, no key
    calls.length = 0; res = mockRes();
    await drawings({ method: "POST", query: { recordId: REC, k: "secret" }, body: pdf }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(calls.some((c) => c.startsWith("PATCH")) && calls.some((c) => c.includes("uploadAttachment")), calls.join(" | "));
    assert.ok(calls.findIndex((c) => c.includes("uploadAttachment")) < calls.findIndex((c) => c.startsWith("PATCH")), "upload before the PATCH");
  } finally { globalThis.fetch = realFetch; }
});

import { realHandleItems } from "../api/generate-quote.js";
import { handleSlotsKey } from "../api/kp-submit.js";
test("quote PDF: 3+ handle SKUs print as the real SKUs, adding up to Airtable's handle amount; hand-changed slots don't", () => {
  const skus = [{ id: "a", n: 6, name: "Jey Ál grip 400mm (frágangur innifalinn)", p: 8446.67 }, { id: "b", n: 8, name: "Jey Ál grip 600mm", p: 10066.67 },
    { id: "c", n: 4, name: "Jey Ál grip 700mm", p: 10386.67 }, { id: "d", n: 3, name: "Jey Ál grip 3000mm", p: 19566.67 }];
  const project = { "Höldur Viðskiptavinar ✊": ["a"], "Magn Halda 1": 16, "Höldur Viðskiptavinar ✊2.0": ["d"], "Magn halda 2.0": 5,
    "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ handlesPrint: { key: handleSlotsKey(["a"], 16, ["d"], 5), skus } }) };
  const slots = [{ "Einingarverð": 8446.67, "Magn": 16 }, { "Einingarverð": 19566.67, "Magn": 5 }];
  const rows = realHandleItems(project, slots);
  assert.equal(rows.length, 4);
  assert.equal(rows[0]["Vara 🚪"], "Jey Ál grip 400mm");
  assert.deepEqual(rows.map((r) => r["Magn"]), [6, 8, 4, 3]);
  const sum = (l) => l.reduce((a, r) => a + r["Einingarverð"] * r["Magn"], 0);
  assert.ok(Math.abs(sum(rows) - sum(slots)) < 0.01);
  assert.equal(realHandleItems(Object.assign({}, project, { "Magn Halda 1": 17 }), slots), null); // changed in Airtable
});

import { materialSpec } from "../api/generate-quote.js";
test("EFNISVAL: both front materials with their rooms; 3+ handle SKUs as one family with the lengths", () => {
  const project = { "Heiti efnis (from Fronta efni viðskiptavinar 🖼️)": ["W1100 hvít"], "Heiti efnis (from Fronta efni 2.0 Viðskiptavinar 🖼️)": ["H1180 Halifax"],
    "Heiti efnis (from Skrokka efni 🔲 viðskiptavinar)": ["U963"], "Heiti vöru 📣 (from Höldur Viðskiptavinar ✊)": ["Jey Ál grip 700mm (frágangur innifalinn)"],
    "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ handlesPrint: { skus: [{ name: "Jey Ál grip 400mm (frágangur innifalinn)" }, { name: "Jey Ál grip 600mm" }, { name: "Jey Ál grip 3000mm" }] } }) };
  const lines = [{ "🔑": "Sk1", "Rými 🏡": "Eldhús" }, { "🔑": "Sk2", "Rými 🏡": "Eldhús" }, { "🔑": "Sk10", "Rými 🏡": "Baðh.", "Frontaefni #2": true }, { "Rými 🏡": "Höldur" }];
  const m = Object.fromEntries(materialSpec(project, lines));
  assert.equal(m["Framhliðar"], "W1100 hvít (Eldhús)");
  assert.equal(m["Framhliðar 2"], "H1180 Halifax (Baðh.)");
  assert.equal(m["Höldur"], "Jey Ál grip (400, 600, 3000 mm)");
  const one = Object.fromEntries(materialSpec({ "Heiti efnis (from Fronta efni viðskiptavinar 🖼️)": ["W1100 hvít"] }, [{ "🔑": "Sk1", "Rými 🏡": "Eldhús" }]));
  assert.equal(one["Framhliðar"], "W1100 hvít");
  assert.equal(one["Framhliðar 2"], "");
});

test("EFNISVAL per room: carcass / worktop / handle colour listed per room when rooms differ", () => {
  const roomMats = [{ room: "Eldhús", carcass: "Dökkgrátt", top: "Premium White", handleColor: "Svartar ⚫" }, { room: "Baðh.", carcass: "Hvítt", handleColor: "Svartar ⚫" }];
  const m = Object.fromEntries(materialSpec({ "Heiti efnis (from Skrokka efni 🔲 viðskiptavinar)": ["U963"], "Heiti efnis (from Borðplata viðskiptavinar 🍽️)": ["W1000"],
    "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ roomMats }) }, []));
  assert.equal(m["Innvols"], "Dökkgrátt (Eldhús) · Hvítt (Baðh.)");
  assert.equal(m["Borðplata"], "W1000"); // only one room has a worktop
  assert.equal(m["Höldulitur"], ""); // the same everywhere
});
