// kitchen-planner-worktop.js — the worktop as real production data in PRO (2026-10-26): pieces per counter run split at
// corners, joints with no default, cutouts over the sink/hob units, the Line Items + Smíðagögn PRO Vista sends — and
// api/kp-pro.js keeping the worktop lines' Magn (m²) in step with the drawing.
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.window = globalThis;
globalThis.location = globalThis.location || { search: "" };
await import("../kitchen-planner-catalog.js");
await import("../kitchen-planner-egger.js");
await import("../kitchen-planner-3d.js");
await import("../kitchen-planner-worktop.js");
await import("../kitchen-planner-workdraw.js");
import { validateLineItems } from "../api/kp-submit.js";
import { save, validate } from "../api/kp-pro.js";
import { validate as priceValidate } from "../api/kp-price.js";
import { makeAirtable } from "../api/kp-submit.js";
import { fakeFetch as rawFetch, byLink } from "./helpers.js";
const K = globalThis.KP3D, W = globalThis.KPWT;

const HP = Object.keys(K.TOPS).find((k) => K.TOPS[k].group === "hardplast" && !K.TOPS[k].hidden);
let n = 0;
const B = (type, w, ex) => Object.assign({ id: "b" + (n++), type, widthMm: w }, ex || {});
// a closed 5600 × 4200 room, walls turning left (the planner's rectangle)
function room(floors, top) {
  const lens = [5600, 4200, 5600, 4200];
  return { top: top === undefined ? HP : top, closed: true,
    walls: lens.map((l, i) => ({ id: "w" + i, label: "Veggur " + (i + 1), lengthMm: l, turnAfter: "left", floor: floors[i] || [], wall: [] })) };
}
const straight = () => room([[B("grunnskapur", 600, { gapMm: 19 }), B("vaskaskapur", 800), B("grunnskapur", 600)]]);
const L = () => room([
  [B("grunnskapur", 600, { gapMm: 19 }), B("vaskaskapur", 800), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 562)],
  [B("grunnskapur", 600), B("ofnaskapurLagur", 600), B("grunnskapur", 800), B("uthlid", 19)],
]);

test("a straight run is one piece: over the áfella at the wall, a free end with a finished edge, sink + tap over the sink unit", () => {
  const r = W.compute(straight(), K);
  assert.equal(r.kind, "inhouse");
  assert.equal(r.pieces.length, 1);
  const p = r.pieces[0];
  assert.deepEqual([p.left, p.len, p.depth, p.ends.L.type, p.ends.R.type], [0, 2019, 620, "wall", "free"]); // 19 áfella + 2000 of cabinets
  assert.deepEqual([p.edges.front, p.edges.L, p.edges.R], [true, false, true]);
  const sink = p.cutouts.find((o) => o.kind === "vaskur"), tap = p.cutouts.find((o) => o.kind === "kranagat");
  assert.equal(sink.x, 19 + 600 + 400); // centred over the sink unit, from the piece's left end
  assert.ok(tap.y < sink.y - sink.d / 2, "the tap hole sits between the sink and the wall");
  assert.equal(r.joints.length, 0);
  assert.equal(r.issues.length, 0);
});

test("an L: split at the corner, the joint has NO default — an in-house top can't go to production until it's chosen", () => {
  const s = L(), r = W.compute(s, K);
  assert.equal(r.pieces.length, 2);
  assert.equal(r.joints.length, 1);
  assert.equal(r.joints[0].chosen, false);
  assert.equal(r.issues.filter((x) => x.kind === "joint").length, 1);
  // drawn as "A runs through" while unchosen: B starts after A's depth
  assert.deepEqual(r.pieces.map((p) => [p.left, p.right]), [[0, 5600], [620, 2619]]);
  // the hob goes over the low oven unit automatically
  assert.equal(r.pieces[1].cutouts.filter((o) => o.kind === "helluborð").length, 1);

  W.setJoint(s, r.joints[0].id, { type: "beint", through: "b" });
  let r2 = W.compute(s, K);
  assert.deepEqual(r2.pieces.map((p) => [p.left, p.right]), [[0, 4980], [0, 2619]]); // B through: A stops at B's depth
  assert.equal(r2.issues.length, 0);

  W.setJoint(s, r.joints[0].id, { type: "ska" });
  r2 = W.compute(s, K);
  assert.deepEqual(r2.pieces.map((p) => [p.len, p.frontLen]), [[5600, 4980], [2619, 1999]]); // mitre: full on the back, shorter in front

  // the same L in stone: joints are optional (agreed with the stone maker), so no issue
  const st = L(); st.top = "steinn_hvitur";
  const rs = W.compute(st, K);
  assert.equal(rs.kind, "stone");
  assert.equal(rs.issues.length, 0);
});

test("a U has two corner joints; a mitred / through choice moves only its own two pieces", () => {
  const s = room([
    [B("grunnskapur", 600, { gapMm: 19 }), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 162)],
    [B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 581)],
    [B("grunnskapur", 600), B("grunnskapur", 600), B("uthlid", 19)],
  ]);
  const r = W.compute(s, K);
  assert.deepEqual([r.pieces.length, r.joints.length, r.issues.length], [3, 2, 2]);
  W.setJoint(s, r.joints[1].id, { type: "beint", through: "b" });
  const r2 = W.compute(s, K);
  assert.equal(r2.pieces[1].right, 4200 - 620); // B stops before C, which runs to the corner
  assert.equal(r2.pieces[2].left, 0);
  assert.equal(r2.pieces[0].right, 5600);
});

test("Rakel's changes are only overrides: length/depth/edges/upstand/cutout moves, reset by clearing them", () => {
  const s = straight(), r = W.compute(s, K), p = r.pieces[0], sink = p.cutouts[0];
  W.setPiece(s, p.id, { ovR: 30, depthMm: 650, upstand: { on: true, h: 50 }, edges: { L: true } });
  W.setCut(s, sink.id, { dx: 100, mount: "undir" });
  const q = W.compute(s, K).pieces[0];
  assert.deepEqual([q.len, q.depth, q.upstand.on, q.edges.L], [2049, 650, true, true]);
  assert.deepEqual([q.cutouts[0].x, q.cutouts[0].mount, q.cutouts[0].moved], [sink.x + 100, "undir", true]);
  W.setCut(s, sink.id, { dx: null });
  assert.equal(W.compute(s, K).pieces[0].cutouts[0].x, sink.x);
  W.setPiece(s, p.id, { lenMm: 2500 });
  const m = W.compute(s, K).pieces[0];
  assert.deepEqual([m.len, m.manualLen, m.left], [2500, true, 0]); // grows at the free (right) end
  // an old project with no state.worktop computes everything automatically and isn't changed by it
  const old = straight(); W.compute(old, K);
  assert.equal(old.worktop, undefined);
});

test("Line Items: BP = m² rounded up on the m² Útfærsla, BV/BH = cutouts; Smíðagögn carry pieces/joints/cutouts and pass kp-submit's checks", () => {
  const s = L(), r0 = W.compute(s, K);
  W.setJoint(s, r0.joints[0].id, { type: "ska" });
  const r = W.compute(s, K), lines = W.lines(r, 1, "Eldhús", {});
  assert.deepEqual(lines.map((l) => [l["🔑"], l.Magn, l["Vöru reitur 1"][0]]),
    [["BP1", Math.ceil(r.m2), W.PRODUCTS.m2.id], ["BV1", 1, W.PRODUCTS.sink.id], ["BH1", 1, W.PRODUCTS.hob.id]]);
  assert.equal(validateLineItems(lines), null);
  const sm = JSON.parse(lines[0]["Smíðagögn (JSON) 🔧"]);
  assert.equal(sm.v, 1);
  assert.deepEqual(sm.bordplata.joints, [{ a: "A", b: "B", type: "ska", through: null }]);
  assert.deepEqual(sm.bordplata.pieces.map((p) => [p.id, p.len, p.depth]), [["A", 5600, 620], ["B", 2619, 620]]);
  assert.match(lines[0]["Skilaboð til skipulags"], /skáskorið 45°/);

  // stone: one BP line, no product (none in Vörulisti), the stone maker's price in its note
  const st = L(); st.top = "steinn_hvitur";
  const ls = W.lines(W.compute(st, K), 2, "Eldhús", {}, 850000);
  assert.deepEqual(ls.map((l) => [l["🔑"], !!l["Vöru reitur 1"]]), [["BP2", false]]);
  assert.match(ls[0]["Skilaboð til skipulags"], /850\.000 kr|850,000 kr|850 000 kr/);
  assert.equal(validateLineItems(ls), null);
  // no worktop picked / "Engin borðplata": no lines
  assert.deepEqual(W.lines(W.compute(room([[B("grunnskapur", 600)]], null), K), 1, "Eldhús", {}), []);
  assert.deepEqual(W.lines(W.compute(room([[B("grunnskapur", 600)]], "engin"), K), 1, "Eldhús", {}), []);
});

test("kp-pro / kp-price accept the worktop keys", () => {
  const OPP = "recAAAAAAAAAAAAAA";
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { BP1: { v: 1 }, BV1: { v: 1 }, BH1: { v: 1 } } }), null);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { BX1: { v: 1 } } }), "Ógilt 🔑: BX1");
  assert.equal(priceValidate({ recordId: OPP, lines: [{ key: "BP1", v1: [W.PRODUCTS.m2.id], qty: 3 }] }), null);
});

test("kp-pro: a worktop line's Magn follows the drawing, unless it was changed by hand in Airtable since last sent", async () => {
  const OPP = "recAAAAAAAAAAAAAA";
  const rows = [
    { id: "recBP1", fields: { "🔑": "BP1", "Magn": 4, "Tækifæri 📣 (projects)": [OPP], "Vöru reitur 1": [W.PRODUCTS.m2.id] } },  // drawing 4 → 6: written
    { id: "recBV1", fields: { "🔑": "BV1", "Magn": 2, "Tækifæri 📣 (projects)": [OPP], "Vöru reitur 1": [W.PRODUCTS.sink.id] } }, // Airtable 1 → 2 by hand, drawing still 1: kept
    { id: "recSk1", fields: { "🔑": "Sk1", "Magn": 3, "Tækifæri 📣 (projects)": [OPP] } },                                        // a cabinet's Magn is never touched
  ];
  const old = { liExtra: { BP1: { Magn: "4" }, BV1: { Magn: "1" } } };
  const route = (call) => {
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
      return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-1 | P", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify(old) } } };
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH")) return { status: 200, body: { records: rows } };
    return { status: 200, body: { records: [] } };
  };
  const f = rawFetch(byLink(route, { opp: OPP }));
  const li = (k, magn, v1) => ({ "🔑": k, "Magn": magn, "Vöru reitur 1": [v1] });
  await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { BP1: { v: 1 }, BV1: { v: 1 }, Sk1: { v: 1 } },
    lineItems: [li("BP1", 6, W.PRODUCTS.m2.id), li("BV1", 1, W.PRODUCTS.sink.id), li("Sk1", 1, "recV1V1V1V1V1V1V1")] });
  const patches = f.calls.filter((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH")).flatMap((c) => c.body.records);
  const magn = patches.filter((r) => "Magn" in r.fields).map((r) => [r.id, r.fields.Magn]);
  assert.deepEqual(magn, [["recBP1", 6]]);
  const state = JSON.parse(f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]);
  assert.deepEqual([state.liExtra.BP1.Magn, state.liExtra.BV1.Magn], ["6", "1"]);
});

test("plan SVG draws every piece, the joint marker and the cutouts", () => {
  const s = L(), r = W.compute(s, K), svg = W.planSvg(r, { K, state: s });
  assert.equal((svg.inner.match(/data-wt-piece=/g) || []).length, 2);
  assert.equal((svg.inner.match(/data-wt-joint=/g) || []).length, 1);
  assert.equal((svg.inner.match(/data-wt-cut=/g) || []).length, 3); // sink, tap, hob
  assert.match(svg.viewBox, /^-?\d/);
});

test("Vinnuteikningar: the Borðplata sheet — exact numbers for an in-house top, 'mál tekin af steinsmið' for stone", () => {
  const s = L(), r = W.compute(s, K);
  const model = (rr) => ({ room: "Eldhús", kind: rr.kind, top: rr.top, plan: W.planSvg(rr, { K, state: s }),
    pieces: rr.pieces.map((p) => ({ label: p.label, wall: p.wall, len: p.len, depth: p.depth, ends: "V · H", edges: W.edgeText(p), upstand: "", cutouts: p.cutouts.map((o) => W.cutText(o, {})) })),
    joints: rr.joints.map(W.jointText), notes: rr.notes });
  const inh = globalThis.KPWD.worktopSheet({ project: "T-1 | P" }, model(r), 6, 7);
  assert.match(inh, /BORÐPLATA — T-1/);
  assert.match(inh, /5600 × 620 × 20/);
  assert.match(inh, /Blað 6\/7/);
  assert.doesNotMatch(inh, /steinsmið\./);
  s.top = "steinn_hvitur";
  const stone = globalThis.KPWD.worktopSheet({ project: "T-1 | P" }, model(W.compute(s, K)), 7, 7);
  assert.match(stone, /Steinn — mál tekin af steinsmið/);
});
