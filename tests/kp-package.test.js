// kitchen-planner-package.js — the customer draft package: report text, e-mail, readiness checklist.
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.window = globalThis;
await import("../kitchen-planner-package.js");
const P = globalThis.KPPACKAGE;

const rooms = [
  { name: "Eldhús", units: 12, look: "Eik W1100", carcass: "Dökkgrár", top: "Egger W1000", handle: "Hexxa svört" },
  { name: "Þvottahús", units: 4, look: "Hvítt", carcass: "Hvítur" },
];

test("report: 6-10 lines, rooms, total with VSK, validity, next step", () => {
  const r = P.buildReport({ rooms, total: 1234567, hasDrawings: true });
  assert.ok(r.lines.length >= 6 && r.lines.length <= 10, String(r.lines.length));
  assert.match(r.text, /Eldhús \(12 einingar\), Þvottahús \(4 einingar\) — alls 16 einingar/);
  assert.match(r.text, /Heildarverð með vsk: 1\.234\.567 kr\./);
  assert.match(r.text, /gildir í 30 daga/);
  assert.match(r.text, /Næsta skref/);
  assert.match(r.text, /Ekki innifalið/);
  assert.match(r.text, /Þrívíddarteikningar/);
  assert.match(r.text, /Eldhús: framhlið eik W1100, skrokkur dökkgrár, borðplata egger W1000, höldur hexxa svört\./);
});

test("report stays within 10 lines with many rooms and without drawings", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ name: "Rými " + (i + 1), units: 2, look: "Eik", carcass: "Hvítur" }));
  const r = P.buildReport({ rooms: many, total: 500000, noHandles: true });
  assert.ok(r.lines.length <= 10, String(r.lines.length));
  assert.doesNotMatch(r.text, /Teikningar af rýminu/);
  assert.match(r.text, /Höldur: engar/);
});

test("report with no price and no rooms still reads", () => {
  const r = P.buildReport({});
  assert.match(r.text, /Heildarverð: sjá tilboðið/);
  assert.ok(r.lines.length >= 6);
});

test("quote sections: per room, handles on their own, total = sum of the printed lines = the panel's total", () => {
  const data = { lines: [
    { key: "Sk1", name: "Skápur 60", qty: 2, total: 100000 }, { key: "Sk2", name: "Skápur 80", qty: 1, total: 50000 },
    { key: "Sk3", name: "Þvottahússskápur", qty: 1, total: 30000 }, { key: "BP1", name: "Borðplata", extra: "Egger", qty: 2, total: 0 } ],
    other: [{ key: null, name: "Lína úr Airtable", total: 1000 }], handles: { count: 12, total: 20000 }, total: 201000 };
  const q = P.buildQuoteSections(data, { Sk1: "Eldhús", Sk2: "Eldhús", Sk3: "Þvottahús", BP1: "Eldhús" }, { BP1: 40000 });
  assert.deepEqual(q.rooms.map((r) => [r.name, r.sum]), [["Eldhús", 190000], ["Þvottahús", 30000], ["Aðrar línur", 1000]]);
  assert.equal(q.rooms[0].lines.find((l) => /Stein/.test(l.name)).total, 40000);
  assert.deepEqual(q.handles, { count: 12, total: 20000 });
  assert.equal(q.total, 241000);
  assert.equal(q.panelTotal, 241000);
  assert.equal(q.mismatch, false);
});

test("quote sections: a total that differs from the panel is flagged", () => {
  const q = P.buildQuoteSections({ lines: [{ key: "Sk1", name: "A", qty: 1, total: 1000 }], other: [], handles: { count: 0, total: 0 }, total: 5000 }, { Sk1: "Eldhús" }, {});
  assert.equal(q.mismatch, true);
  assert.equal(q.handles, null);
});

const base = { dirty: false, rooms: [{ name: "Eldhús", closed: true, missing: [] }], address: "Bogahlíð 4", contact: "Jón Jónsson", imageCount: 6, hasQuote: true };

test("readiness: everything green", () => {
  const r = P.readiness(base);
  assert.equal(r.canMake, true);
  assert.deepEqual(r.blocking, []);
  assert.ok(r.items.every((i) => i.ok));
});

test("readiness: unsaved drawing blocks with a save fix", () => {
  const r = P.readiness({ ...base, dirty: true });
  assert.equal(r.canMake, false);
  assert.deepEqual(r.blocking, ["saved"]);
  assert.equal(r.items.find((i) => i.id === "saved").fix.id, "save");
});

test("readiness: open room / no 3D images / no address / no contact are said plainly but never block", () => {
  const r = P.readiness({ ...base, rooms: [{ name: "Eldhús", closed: true }, { name: "Bað", closed: false }], address: "", contact: "" });
  assert.equal(r.canMake, true);
  assert.match(r.items.find((i) => i.id === "drawings").detail, /Bað/);
  assert.equal(r.items.find((i) => i.id === "address").ok, false);
  assert.equal(r.items.find((i) => i.id === "contact").ok, false);
  const none = P.readiness({ ...base, imageCount: 0 });
  assert.equal(none.canMake, true);
  assert.match(none.items.find((i) => i.id === "drawings").detail, /Engar myndir/);
});

test("readiness: unset materials are named per room but do not block", () => {
  const r = P.readiness({ ...base, rooms: [{ name: "Eldhús", closed: true, missing: ["framhlið", "borðplata"] }] });
  assert.equal(r.canMake, true);
  assert.match(r.items.find((i) => i.id === "materials").detail, /Eldhús: framhlið, borðplata/);
});

test("readiness: no quote lines blocks", () => {
  assert.deepEqual(P.readiness({ ...base, hasQuote: false }).blocking, ["quote"]);
});

test("no e-mail, Gmail or 'sent' left in the package logic", () => {
  assert.equal(P.buildEmail, undefined);
  assert.equal(P.gmailUrl, undefined);
  assert.doesNotMatch(P.buildReport({ rooms, total: 1000 }).text, /póst/);
});
