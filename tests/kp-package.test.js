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
  assert.match(r.text, /Teikningar/);
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

test("email: greeting with first name, report, link, signature", () => {
  const rep = P.buildReport({ rooms, total: 1000 }).text;
  const e = P.buildEmail({ first: "Jón", report: rep, link: "https://x.is/api/tilbod-pdf?r=1", projectName: "T-12 | Jón Jónsson" });
  assert.match(e.subject, /Drög og tilboð frá Birninum — T-12/);
  assert.ok(e.body.startsWith("Hæ Jón,"));
  assert.ok(e.body.includes(rep));
  assert.ok(e.body.includes("https://x.is/api/tilbod-pdf?r=1"));
  assert.match(e.body, /Kær kveðja,\nRakel/);
  assert.ok(!P.hasPlaceholder(e.body));
});

test("email: placeholder link is swapped once the PDF exists, edits kept", () => {
  const e = P.buildEmail({ first: "", report: "R", link: "" });
  assert.ok(e.body.startsWith("Hæ,"));
  assert.ok(P.hasPlaceholder(e.body));
  const edited = e.body.replace("Takk fyrir síðast.", "Gaman að hitta þig.");
  const done = P.withLink(edited, "https://l");
  assert.ok(done.includes("https://l") && done.includes("Gaman að hitta þig.") && !P.hasPlaceholder(done));
});

test("gmailUrl encodes", () => {
  const u = P.gmailUrl("a@b.is", "Tilboð & drög", "Hæ\nÞú");
  assert.match(u, /to=a%40b\.is/);
  assert.match(u, /su=Tilbo%C3%B0%20%26%20dr%C3%B6g/);
  assert.match(u, /body=H%C3%A6%0A%C3%9E%C3%BA/);
});

const base = { dirty: false, rooms: [{ name: "Eldhús", closed: true, missing: [] }], email: "a@b.is", quote: { ok: true, link: "x", files: 1 } };

test("readiness: everything green", () => {
  const r = P.readiness(base);
  assert.equal(r.canSend, true);
  assert.deepEqual(r.blocking, []);
  assert.ok(r.items.every((i) => i.ok || i.optional));
});

test("readiness: unsaved drawing blocks with a save fix", () => {
  const r = P.readiness({ ...base, dirty: true });
  assert.equal(r.canSend, false);
  const it = r.items.find((i) => i.id === "saved");
  assert.equal(it.fix.id, "save");
});

test("readiness: open room says drawings are skipped; override lets it through", () => {
  const rm = [{ name: "Eldhús", closed: true }, { name: "Bað", closed: false }];
  const r = P.readiness({ ...base, rooms: rm });
  assert.deepEqual(r.blocking, ["closed"]);
  assert.match(r.items.find((i) => i.id === "closed").detail, /Bað/);
  const r2 = P.readiness({ ...base, rooms: rm, skipDrawings: true });
  assert.equal(r2.canSend, true);
  assert.match(r2.items.find((i) => i.id === "closed").detail, /án teikninga/);
});

test("readiness: missing or bad e-mail blocks", () => {
  assert.deepEqual(P.readiness({ ...base, email: "" }).blocking, ["email"]);
  assert.deepEqual(P.readiness({ ...base, email: "nope" }).blocking, ["email"]);
});

test("readiness: quote not made yet is pending, not blocking; failed quote blocks", () => {
  const p = P.readiness({ ...base, quote: null });
  assert.equal(p.canSend, true);
  assert.equal(p.items.find((i) => i.id === "quote").pending, true);
  const f = P.readiness({ ...base, quote: { ok: true, link: "x", files: 0 } });
  assert.deepEqual(f.blocking, ["quote"]);
});

test("readiness: unset materials (ÓÁKVEÐIÐ) block and name the room", () => {
  const r = P.readiness({ ...base, rooms: [{ name: "Eldhús", closed: true, missing: ["framhlið", "borðplata"] }] });
  assert.deepEqual(r.blocking, ["materials"]);
  assert.match(r.items.find((i) => i.id === "materials").detail, /Eldhús: framhlið, borðplata/);
});

test("readiness: drawings skipped after printing is reported with the reason", () => {
  const r = P.readiness({ ...base, drawingsSkippedWhy: "Upphleðsla mistókst" });
  assert.deepEqual(r.blocking, ["drawings"]);
  assert.match(r.items.find((i) => i.id === "drawings").detail, /Upphleðsla/);
});

test("readiness: Studio image is optional", () => {
  const r = P.readiness({ ...base, studioKnown: 0 });
  assert.equal(r.items.find((i) => i.id === "studio").optional, true);
  assert.equal(r.canSend, true);
});
