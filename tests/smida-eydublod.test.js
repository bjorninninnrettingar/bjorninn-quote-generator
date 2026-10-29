// "Smíða úr Eyðublöðum" (/smida, 2026-10-26): a legacy Eyðublað (T-15 shapes, real Sögunarlisti rows) + edits →
// Smíðagögn that cnc-sides.js (what /cnc exports with) accepts as-is; and the save endpoint writes only that field.
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../cnc-sides.js");
await import("../cnc-data.js");
await import("../smida-eydublod.js");
import handler, { save, validate } from "../api/smida-eydublad.js";
import { makeAirtable } from "../api/kp-submit.js";
import { mockRes, fakeFetch } from "./helpers.js";
const S = globalThis.CNCSIDES, M = globalThis.SMIDAEY, CD = globalThis.CNCDATA;

const row = (teg) => (Partur, H, B, Þ, M) => ({ Partur, H, B, "Þ": Þ, M, "Tegund einingu": [teg] });
const unit = (id, name, f) => ({ id, fields: Object.assign({ Athugasemd: name, "Fjöldi eininga": 1 }, f) });
const hr = row("Hárskápur"), ef = row("Efriskápur"), of = row("Ofnaskápur"), gr = row("Grunnskápur");
// T-15 Sk 23: one tall door, one fixed shelf, three inner drawers behind the door (no position anywhere before)
const SK23 = [hr("Frontur", 2527, 570, 19, 1), hr("Innskúffubotn - Merivo", 474, 517, 16, 3), hr("Skúffubak K - Merivo", 121, 517, 16, 3),
  hr("Föst hilla", 558, 568, 16, 1), hr("Skápur hlið", 2530, 580, 16, 2), hr("Innskúffufrontur K - Merivo Skrokkaefni", 144, 562, 16, 3)];
// T-15 Sk 5-8: four identical wall cabinets on one Eyðublað, two loose shelves each
const SK5 = [ef("Laus hilla", 258, 381, 16, 8), ef("Frontur", 897, 383, 19, 4), ef("Skápur hlið", 880, 280, 16, 8)];
// T-15 Sk 2: oven tower, E+K drawers, inner M, 1050 oven, 3 "Föst loftunarhilla" (incl. the boards around the oven) + 1 loose
const SK2 = [of("Skúffufrontur K - Merivo", 370, 597, 19, 1), of("Skúffubak K - Merivo", 121, 517, 16, 1), of("Laus loftunarhilla", 558, 568, 16, 1),
  of("Skápur hlið", 2296, 580, 16, 2), of("Skúffufrontur E - Merivo", 370, 597, 19, 1), of("Föst loftunarhilla", 558, 568, 16, 3),
  of("Frontur f. ofan ofn", 447, 597, 19, 1), of("Innskúffufrontur M - Merivo Skrokkaefni", 106, 562, 16, 1), of("Skúffubak E - Merivo", 184, 517, 16, 1)];
// T-15 Sk 30.2,31.2,32.2: no door, four inner K drawers — /cnc's default stacking doesn't fit (⛔ before)
const SK30_2 = [gr("Innskúffubotn - Merivo", 424, 737, 16, 12), gr("Skápur hlið", 818, 540, 16, 6), gr("Innskúffufrontur K - Merivo Frontaefni", 144, 782, 19, 12), gr("Skúffubak K - Merivo", 121, 737, 16, 12)];

const cab = (id, name, rows, f, grip) => M.cabinet(unit(id, name, f), rows, { gripMm: grip || 0 });
const opsOf = (p, n) => p.ops.filter((o) => o.name === n).map((o) => o.params);

test("T-15 Sk 23: hinge side + edited shelf + inner drawers → /cnc drills one side, shelf where set, no defaults left", () => {
  const c = cab("recSk23aaaaaaaaaa", "Sk 23", SK23, { Hæð: 2530, Breidd: 600, Dýpt: 600 }, 27);
  const before = c.base;
  assert.ok(before.check.some((t) => /Föst hilla \(1\) — staðsetning ekki í gögnum/.test(t)));
  assert.ok(before.check.some((t) => /lamahlið óþekkt/.test(t)));
  const e = M.initEdit(c);
  assert.equal(e.hinge, null);
  assert.equal(e.shelves.length, 1);
  assert.equal(e.inner.length, 3);
  assert.ok(M.blockers(c, e, M.planOf(c, M.smidaOf(c, e))).some((t) => /lamahlið/.test(t)));
  e.hinge = "haegri"; e.shelves[0].mm = 1500; e.reviewed = true;
  const o = M.smidaOf(c, e);
  assert.equal(o.v, 1);
  assert.equal(o.hinge, "haegri");
  assert.deepEqual(o.shelves, { loose: 0, fixed: 1, list: [{ mm: 1500, fixed: true }] });
  assert.equal(o.ready, true);
  assert.equal(o.doors, undefined); // hinges untouched → /cnc's default (moved off the shelves)
  const p = S.unitPlan(c.name, SK23, { unitHeight: 2530, gripMm: 27, smida: JSON.stringify(o) });
  assert.equal(p.status, "ok", p.check.join(" | "));
  assert.ok(!p.check.some((t) => /passa ekki við Sögunarlista/.test(t)));
  assert.deepEqual(opsOf(p, "FOST_HILLA"), ["16, 1500, 2, lpy-22, lpz+5"]);
  assert.equal(opsOf(p, "MERVIBOX_INNSKUFFA").length, 3);
  const files = S.sideFiles(p);
  assert.deepEqual(files.map((f) => f.name), ["Vinstri hlið", "Hægri hlið - lamir"]);
  assert.ok(!files[0].plan.ops.some((x) => x.name === "LOM"));
  assert.ok(files[1].plan.ops.some((x) => x.name === "LOM"));
});

test("T-15 Sk 5-8: four cabinets on one Eyðublað, loose shelves dragged, hinges edited — door count matches Sögunarlisti", () => {
  const c = cab("recSk58aaaaaaaaaa", "Sk 5-8", SK5, { Hæð: 880, Breidd: 413, Dýpt: 300, "Fjöldi eininga": 4 });
  assert.equal(c.base.cabinets, 4);
  assert.equal(c.nLoose, 2);
  const e = M.initEdit(c);
  // untouched defaults drill exactly where /cnc's default does
  const dflt = S.unitPlan(c.name, SK5, { unitHeight: 880 });
  assert.deepEqual(opsOf(M.planOf(c, M.smidaOf(c, Object.assign({}, e, { hinge: "vinstri" }))), "LAUS_HILLA"), opsOf(dflt, "LAUS_HILLA"));
  e.hinge = "vinstri"; e.shelves[0].mm = 330; e.shelves[1].mm = 610;
  e.doors = [{ type: "hinged", hinges: [{ from: "bottom", mm: 100 }, { from: "top", mm: 100 }] }];
  e.reviewed = true;
  const o = M.smidaOf(c, e);
  assert.equal(o.doors.length, 1);
  assert.equal(o.doors[0].h, 897);
  const p = S.unitPlan(c.name, SK5, { unitHeight: 880, smida: JSON.stringify(o) });
  assert.ok(!p.check.some((t) => /passa ekki við Sögunarlista|lamahlið/.test(t)), p.check.join(" | "));
  assert.deepEqual(opsOf(p, "LAUS_HILLA"), ["264, 3, 37, 20+60, 50", "544, 3, 37, 20+60, 50"]); // hole row = mm − 16, middle hole under the shelf
  assert.deepEqual(opsOf(p, "LOM"), ['100, 37, "2"', '100, 37, "3"']); // the edited hinges, not /cnc's 80
  assert.deepEqual(S.sideFiles(p).map((f) => f.name + "×" + f.count), ["Vinstri hlið - lamir×4", "Hægri hlið×4"]);
});

test("T-15 Sk 2 oven: boards around the oven counted with Sögunarlisti's fixed shelves (oven.boards = list)", () => {
  const c = cab("recSk2aaaaaaaaaaa", "Sk 2", SK2, { Hæð: 2296, Breidd: 600, Dýpt: 600, "Hæð ofns": 1050 }, 27);
  assert.ok(c.oven);
  assert.ok(c.base.check.some((t) => /Ofnaskápur: föstu hillurnar og ofninn bíða hönnuðar/.test(t)));
  const e = M.initEdit(c);
  assert.equal(e.oven.h, 1050);
  assert.equal(e.oven.under, 800); // E 370 + K 370, each + 27 grip + 3 gap
  assert.deepEqual(e.oven.shelves.filter((x) => x.fixed).map((x) => x.mm), [800, 1411, 1866]);
  e.hinge = "vinstri"; e.reviewed = true;
  const o = M.smidaOf(c, e);
  assert.equal(o.oven.boards, "list");
  const p = S.unitPlan(c.name, SK2, { unitHeight: 2296, gripMm: 27, smida: JSON.stringify(o) });
  assert.equal(p.status, "ok", p.check.join(" | "));
  assert.equal(opsOf(p, "FOST_HILLA").length, 3);
  assert.equal(opsOf(p, "LAUS_HILLA").length, 1);
  assert.deepEqual(S.sideFiles(p).map((f) => f.name), ["Vinstri hlið - lamir", "Hægri hlið"]);
});

test("T-15 Sk 30.2: inner drawers that /cnc couldn't stack get positions → no ⛔", () => {
  const c = cab("recSk302aaaaaaaaa", "Sk 30.2,31.2,32.2", SK30_2, { Hæð: 818, Breidd: 820, Dýpt: 540, "Fjöldi eininga": 3 });
  assert.equal(c.base.status, "stop");
  assert.ok(M.editable(c));
  const e = M.initEdit(c);
  assert.equal(e.inner.length, 4);
  assert.ok(e.inner[3].mm + 144 <= 818 - 16 - 20);
  e.reviewed = true;
  const p = S.unitPlan(c.name, SK30_2, { unitHeight: 818, smida: JSON.stringify(M.smidaOf(c, e)) });
  assert.equal(p.status, "ok", p.stop.concat(p.check).join(" | "));
  assert.equal(opsOf(p, "MERVIBOX_INNSKUFFA").length, 4);
});

test("previous Smíðagögn keys are kept, FRE is read-only, unchanged = not dirty", () => {
  const prev = { v: 1, w: 600, h: 2530, d: 600, fronts: [{ code: "K", mm: 200 }], hinge: "vinstri", shelves: { loose: 0, fixed: 1, list: [{ mm: 1400, fixed: true }] }, ready: true };
  const c = cab("recSk23bbbbbbbbbb", "Sk 23", SK23, { Hæð: 2530, Breidd: 600, Dýpt: 600, "Smíðagögn (JSON) 🔧": JSON.stringify(prev) });
  const e = M.initEdit(c);
  assert.equal(e.hinge, "vinstri");
  assert.equal(e.shelves[0].mm, 1400);
  assert.equal(e.reviewed, true);
  const o = M.smidaOf(c, e);
  assert.deepEqual(o.fronts, prev.fronts);
  e.inner = null; // (prev had no inner list; the editor adds one)
  assert.ok(M.same(M.smidaOf(c, e), prev));
  const fre = cab("recSk14aaaaaaaaaa", "SK 14", [row("Skápur úr FRE")("FRE - Hlið", 1260, 400, 19, 2), row("Skápur úr FRE")("FRE - Föst Hilla", 379, 581, 19, 2)], { Hæð: 1260 });
  assert.equal(M.editable(fre), false);
  assert.deepEqual(M.blockers(fre, M.initEdit(fre), fre.base), []);
});

test("cnc-data: a project whose Eyðublöð no Line Item made is legacy", () => {
  const data = { units: [unit("recU1aaaaaaaaaaaa", "Sk 1", {})], rows: [{ fields: Object.assign(hr("Skápur hlið", 800, 580, 16, 2), { "Eyðublað ✏️": ["recU1aaaaaaaaaaaa"] }) }], lineSmida: {}, lineKey: {}, linesSeen: false, projGrip: null };
  assert.equal(CD.legacy(data), true);
  assert.equal(CD.legacy(Object.assign({}, data, { linesSeen: true })), false);
  assert.equal(CD.legacy(Object.assign({}, data, { linesSeen: null })), false); // Line Items unreadable → don't guess
  const I = CD.sideInput(data);
  assert.equal(I.byUnit.recU1aaaaaaaaaaaa.length, 1);
  // 2026-10-27: the project's handle no longer decides the grip — only the Eyðublað's "Grip?" (what the cut list used)
  assert.deepEqual(CD.gripFor(I, { mm: 27 }, "recU1aaaaaaaaaaaa", null), { mm: 0, src: "unit" });
});

// ── api/smida-eydublad.js ───────────────────────────────────────────────────────────────────────
const OPP = "recq9EXEXfHiEETxp", A = "recAAAAAAAAAAAAAA", B = "recBBBBBBBBBBBBBB", X = "recXXXXXXXXXXXXXX";
const SM = JSON.stringify({ v: 1, hinge: "vinstri" });
function routes(units) {
  return (call) => {
    if (call.method === "GET" && call.url.includes("tbl0WcyHhz63pSzZX")) return { status: 200, body: { records: units } };
    if (call.method === "PATCH") return { status: 200, body: { records: call.body.records } };
  };
}
const at = (f) => makeAirtable("t", { fetchImpl: f, delays: [] });

test("smida-eydublad: validate", () => {
  assert.equal(validate({ recordId: OPP, items: [{ id: A, smida: SM }] }), null);
  assert.match(validate({ recordId: "x", items: [] }), /recordId/);
  assert.match(validate({ recordId: OPP, items: [] }), /Engar/);
  assert.match(validate({ recordId: OPP, items: [{ id: A, smida: "{}" }] }), /v:1/);
  assert.match(validate({ recordId: OPP, items: [{ id: A, smida: "nope" }] }), /JSON/);
  assert.match(validate({ recordId: OPP, items: [{ id: A, smida: SM }, { id: A, smida: SM }] }), /tvisvar/);
  assert.equal(validate({ recordId: OPP, items: [{ id: A, smida: null, prev: SM }] }), null); // Afturkalla to empty
});

test("smida-eydublad: writes ONLY Smíðagögn, in batches of 10, returns the previous values", async () => {
  const ids = Array.from({ length: 23 }, (_, i) => "rec" + String(i).padStart(14, "Q"));
  const units = ids.map((id, i) => ({ id, fields: { "Tækifæri 📣": [OPP], "Smíðagögn (JSON) 🔧": i === 0 ? "OLD" : undefined } }));
  const f = fakeFetch(routes(units));
  const out = await save(at(f), { recordId: OPP, items: ids.map((id, i) => ({ id, smida: SM, prev: i === 0 ? "OLD" : null })) });
  const patches = f.calls.filter((c) => c.method === "PATCH");
  assert.deepEqual(patches.map((p) => p.body.records.length), [10, 10, 3]);
  patches.forEach((p) => p.body.records.forEach((r) => assert.deepEqual(Object.keys(r.fields), ["Smíðagögn (JSON) 🔧"])));
  assert.ok(patches.every((p) => p.url.includes("tbl0WcyHhz63pSzZX")));
  assert.equal(out.written, 23);
  assert.equal(out.previous[ids[0]], "OLD");
  assert.equal(out.previous[ids[1]], null);
});

test("smida-eydublad: a unit of another project or changed since → nothing written", async () => {
  let f = fakeFetch(routes([{ id: A, fields: { "Tækifæri 📣 (projects)": [OPP] } }, { id: X, fields: { "Tækifæri 📣": ["recOTHERxxxxxxxxx"] } }]));
  await assert.rejects(save(at(f), { recordId: OPP, items: [{ id: A, smida: SM, prev: null }, { id: X, smida: SM, prev: null }] }), (e) => e.status === 400 && /tilheyra ekki/.test(e.message));
  assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
  f = fakeFetch(routes([{ id: A, fields: { "Tækifæri 📣": [OPP], "Smíðagögn (JSON) 🔧": "SOMEONE ELSE" } }, { id: B, fields: { "Tækifæri 📣": [OPP] } }]));
  await assert.rejects(save(at(f), { recordId: OPP, items: [{ id: A, smida: SM, prev: null }, { id: B, smida: SM, prev: null }] }), (e) => e.status === 409 && e.conflict.join() === A);
  assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
  // unchanged value: nothing to PATCH
  f = fakeFetch(routes([{ id: A, fields: { "Tækifæri 📣": [OPP], "Smíðagögn (JSON) 🔧": SM } }]));
  const out = await save(at(f), { recordId: OPP, items: [{ id: A, smida: SM, prev: SM }] });
  assert.equal(out.written, 0);
  assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
});

test("smida-eydublad: handler needs POST + VERK_KEY", async () => {
  const env = { ...process.env };
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "key";
  try {
    let res = mockRes(); await handler({ method: "GET" }, res); assert.equal(res.statusCode, 405);
    res = mockRes(); await handler({ method: "POST", body: { k: "wrong", recordId: OPP, items: [{ id: A, smida: SM }] } }, res); assert.equal(res.statusCode, 403);
    res = mockRes(); await handler({ method: "POST", body: { k: "key", recordId: OPP, items: [] } }, res); assert.equal(res.statusCode, 400);
  } finally { process.env.AIRTABLE_TOKEN = env.AIRTABLE_TOKEN; process.env.VERK_KEY = env.VERK_KEY; if (env.AIRTABLE_TOKEN === undefined) delete process.env.AIRTABLE_TOKEN; if (env.VERK_KEY === undefined) delete process.env.VERK_KEY; }
});

// "Skrifa á USB" in /smida must be /cnc's own writer (parity by construction, 2026-10-26): /smida loads /cnc in a
// hidden frame and calls cnc.html's CNC_API.writeUsb — it must never grow a file writer of its own.
test("/smida writes to USB only through cnc.html's writeUsb", async () => {
  const fs = await import("node:fs");
  const cnc = fs.readFileSync(new URL("../cnc.html", import.meta.url), "utf8");
  const smida = fs.readFileSync(new URL("../smida.html", import.meta.url), "utf8");
  assert.match(cnc, /window\.CNC_API = \{/);
  assert.match(cnc, /writeUsb: async function \(dir\) \{ lastExport = null; await writeUsb\(dir\);/);
  assert.match(cnc, /lastExport = \{ made: made, warn: warn, missing: missing, preview: preview/);
  assert.match(smida, /api\.writeUsb\(dir\)/);
  assert.match(smida, /"\/cnc\?recordId="/);
  assert.doesNotMatch(smida, /createWritable|getFileHandle\([^)]*create/); // no writes of its own
});

test("collision check: an inner drawer through a shelf or a runner on shelf-pin holes is flagged (plan.hits)", () => {
  // T-15 Sk 2 as /cnc exports it today: inner M in the K zone, nothing above it drilled → no collision
  const p0 = S.unitPlan("Sk 2", SK2, { unitHeight: 2296, gripMm: 27 });
  assert.ok(!p0.check.some((t) => / rekst | nær upp/.test(t)), p0.check.join(" | "));
  assert.deepEqual(p0.hits, []);
  // …and with the /smida oven boards (800 / 1411 / 1866): the inner M front (662–768) clears the 784–800 board
  const c = cab("recSk2bbbbbbbbbbb", "Sk 2", SK2, { Hæð: 2296, Breidd: 600, Dýpt: 600, "Hæð ofns": 1050 }, 27);
  const e = M.initEdit(c); e.hinge = "vinstri";
  assert.deepEqual(M.planOf(c, M.smidaOf(c, e)).hits, []);
  // T-15 Sk 23 with the fixed shelf dragged down through the top inner drawer (508–652): flagged + blocks Yfirfarinn
  const c23 = cab("recSk23ccccccccc", "Sk 23", SK23, { Hæð: 2530, Breidd: 600, Dýpt: 600 }, 27);
  const e23 = M.initEdit(c23); e23.hinge = "haegri"; e23.shelves[0].mm = 600;
  const p23 = M.planOf(c23, M.smidaOf(c23, e23));
  assert.ok(p23.check.some((t) => /^Innskúffa K rekst í föstu hilluna í 600 — \d+ mm vantar$/.test(t)), p23.check.join(" | "));
  assert.ok(p23.hits.length >= 1);
  assert.ok(M.blockers(c23, e23, p23).some((t) => / rekst í /.test(t)));
  // /smida's own default for a tall cabinet with inner drawers keeps the shelves above them (T-15 Sk 29.1 shape)
  const SK29_1 = [hr("Laus hilla", 559, 768, 16, 1), hr("Innskúffufrontur K - Merivo Skrokkaefni", 144, 762, 16, 4), hr("Skápur hlið", 2530, 580, 16, 2), hr("Föst hilla", 559, 768, 16, 1)];
  const c29 = cab("recSk291aaaaaaaa", "Sk 29.1", SK29_1, { Hæð: 2530, Breidd: 800, Dýpt: 580 });
  assert.deepEqual(M.planOf(c29, M.smidaOf(c29, M.initEdit(c29))).hits, []);
});


// T-248 (2026-10-27): a PRO drawer unit with a Jey PROJECT handle but an empty "Grip?" — the Sögunarlisti script cut the
// fronts Sérhæð − 3 (no grip), so /cnc must not add 27 per drawer ("Frontar (881) passa ekki við hlið (800)").
test("grip = the Eyðublað's Grip? (as the cut list), not the handle: PRO stack 800 fits, JEY lárétt still 27", () => {
  const gr = (Partur, H, B, Þ, M) => ({ Partur, H, B, "Þ": Þ, M, "Tegund einingu": ["Grunnskápur"] });
  // PRO slots 215/411/174 (= 800) → cut 212/408/171
  const rows = [gr("Skápur hlið", 800, 580, 16, 2), gr("Skúffufrontur E - Merivo", 212, 597, 19, 1), gr("Skúffufrontur K - Merivo", 408, 597, 19, 1), gr("Skúffufrontur M - Merivo", 171, 597, 19, 1)];
  const mk = (grip) => ({ units: [unit("recU2aaaaaaaaaaaa", "Sk2", grip ? { "Grip?": grip } : {})], rows: rows.map((r) => ({ fields: Object.assign({}, r, { "Eyðublað ✏️": ["recU2aaaaaaaaaaaa"] }) })), lineSmida: {}, lineKey: {}, linesSeen: true, projGrip: { mm: 27 } });
  const I0 = CD.sideInput(mk(null));
  const g0 = CD.gripFor(I0, { mm: 27, name: "Jey" }, "recU2aaaaaaaaaaaa", null).mm;
  assert.equal(g0, 0);
  const p0 = S.unitPlan("Sk2", rows, { unitHeight: 800, gripMm: g0 });
  assert.ok(!p0.check.some((t) => /passa ekki við hlið/.test(t)), p0.check.join(" | "));
  const before = S.unitPlan("Sk2", rows, { unitHeight: 800, gripMm: 27 }); // what /cnc did on T-248
  assert.ok(before.check.some((t) => /Frontar \(881\) passa ekki við hlið \(800\)/.test(t)), before.check.join(" | "));
  // a legacy unit whose Grip? is JEY lárétt (T-15): the cut list took 27 off, so /cnc adds 27 back — unchanged
  assert.equal(CD.gripFor(CD.sideInput(mk("JEY lárétt")), null, "recU2aaaaaaaaaaaa", null).mm, 27);
  assert.equal(CD.gripFor(CD.sideInput(mk("JEY lóðrétt")), null, "recU2aaaaaaaaaaaa", null).mm, 0);
});

test("Jey off on one front (T-15 Sk 2, 2026-10-29): that slot is the front alone, the rest keep the profile; round-trips through Smíðagögn", () => {
  const c = cab("recSk2aaaaaaaaaaaa", "Sk 2", SK2, { Hæð: 2300, Breidd: 600, Dýpt: 600 }, 27);
  const e = M.initEdit(c);
  assert.deepEqual(e.noJey, { drawers: [], doors: [] });
  const p0 = M.planOf(c, M.smidaOf(c, e));
  assert.equal(p0.drawers.length, 2);
  assert.equal(p0.drawers[1].H, p0.drawers[1].front + 27);
  e.noJey.drawers.push(1); // the upper drawer (bottom → top) has no Jey
  const o = M.smidaOf(c, e);
  assert.deepEqual(o.noJey, { drawers: [1], doors: [] });
  const p1 = M.planOf(c, o);
  assert.equal(p1.drawers[1].H, p1.drawers[1].front);
  assert.equal(p1.drawers[0].H, p0.drawers[0].H);
  assert.equal(p1.drawers[0].to, p0.drawers[0].to); // nothing below it moves
  // saved and re-opened: the switch is still off, and an untouched cabinet writes no noJey at all
  const again = M.initEdit(Object.assign({}, c, { existing: o }));
  assert.deepEqual(again.noJey, { drawers: [1], doors: [] });
  assert.equal("noJey" in M.smidaOf(c, M.initEdit(c)), false);
});
