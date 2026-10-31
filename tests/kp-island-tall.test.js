// Umferð 2 (2026-10-30): Hár skápur í eyju + eyjuflæðið (docs/spec-island-beams-2026-10-30.md, A and B1–B3).
// Island scenes WITHOUT a tall unit must come out exactly as before the round (island-baseline.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.window = globalThis;
globalThis.location = globalThis.location || { search: "" };
await import("../kitchen-planner-catalog.js");
await import("../kitchen-planner-egger.js");
await import("../kitchen-planner-3d.js");
await import("../kitchen-planner-worktop.js");
import { measure, scenes } from "./fixtures/island-scenes.mjs";
const K = globalThis.KP3D, W = globalThis.KPWT;
const HP = Object.keys(K.TOPS).find((k) => K.TOPS[k].group === "hardplast" && !K.TOPS[k].hidden);
let n = 0;
const B = (type, w, ex) => Object.assign({ id: "t" + (n++), type, widthMm: w }, ex || {});

test("islands without a tall unit: worktop pieces, warnings and fits are exactly what they were before the round", () => {
  const base = JSON.parse(fs.readFileSync(new URL("./fixtures/island-baseline.json", import.meta.url), "utf8"));
  assert.deepEqual(JSON.parse(JSON.stringify(measure(K, W, HP))), base);
});

test("island back: no tall unit = one piece at the highest unit's height (as before); tall units get their own back", () => {
  const row = [B("grunnskapur", 600), B("litillkassi", 600), B("grunnskapur", 600)];
  assert.deepEqual(K.islandBackSegs(row, 2600), [{ from: 0, to: 1800, h: 900, tall: false }]);
  const withTall = [B("grunnskapur", 600), B("harskapur", 600), B("grunnskapur", 600), B("litillkassi", 600)];
  const segs = K.islandBackSegs(withTall, 2600);
  assert.deepEqual(segs.map((s) => [s.from, s.to, s.h, s.tall]), [[0, 600, 900, false], [600, 1200, 2500, true], [1200, 2400, 900, false]]);
  assert.equal(K.islandHasTall({ a: withTall }), true);
  assert.equal(K.islandHasTall({ a: row }), false);
  // a ceiling lower than the unit caps it
  assert.equal(K.islandBackSegs([B("harskapur", 600)], 2300)[0].h, 2300);
});

// a 5600 × 4200 room; the island stands 2.2 m out from wall 1
function room(islands, obstacles) {
  const lens = [5600, 4200, 5600, 4200];
  return { top: HP, closed: true, roomHeightMm: 2600, obstacles: obstacles || [],
    walls: lens.map((l, i) => ({ id: "w" + i, label: "Veggur " + (i + 1), lengthMm: l, turnAfter: "left", floor: [], wall: [] })), islands };
}
const isl = (a, ex) => Object.assign({ id: "I1", label: "Eyja 1", lengthMm: a.reduce((t, b) => t + b.widthMm, 0), xMm: 2800, zMm: 2100, rot: 180, back: true, a }, ex || {});

test("worktop: the end of an island run next to a tall unit is a wall (no overhang, no finished edge); next to nothing / a low panel it stays free", () => {
  const withTall = room([isl([B("grunnskapur", 600), B("grunnskapur", 600), B("harskapur", 600), B("grunnskapur", 600)])]);
  const r = W.compute(withTall, K);
  assert.equal(r.pieces.length, 2);
  const [p1, p2] = r.pieces;
  assert.deepEqual([p1.ends.L.type, p1.ends.R.type, p1.edges.L, p1.edges.R], ["free", "wall", true, false]); // the free end keeps its finished edge, the end at the tall unit does not
  assert.deepEqual([p2.ends.L.type, p2.ends.R.type], ["wall", "free"]);
  assert.equal(p1.len, 1200); // no overhang added at the tall unit
  // a tall úthlið beside a low run is a wall too; a low úthlið is not
  const tallPanel = room([isl([B("uthlidhar", 19), B("grunnskapur", 600), B("grunnskapur", 600)])]);
  assert.equal(W.compute(tallPanel, K).pieces[0].ends.L.type, "wall");
  const lowPanel = room([isl([B("uthlid", 19), B("grunnskapur", 600), B("grunnskapur", 600)])]);
  assert.equal(W.compute(lowPanel, K).pieces[0].ends.L.type, "free");
});

// a beam across the room, 1.2 m out from wall 1, hanging 250 mm from the 2600 ceiling (lowest edge 2350)
const beam = (ex) => Object.assign({ id: "ob1", kind: "biti", wallId: "w0", offsetMm: 1000, outMm: 1200, widthMm: 3600, depthMm: 300, heightMm: 250 }, ex || {}); // runs parallel to wall 1, 1200–1500 out

test("beam check: a tall unit in an island under a ceiling beam is stopped (islandFits) and warned about; base units are not", () => {
  const withTall = room([isl([B("grunnskapur", 600), B("harskapur", 600), B("grunnskapur", 600)])], [beam()]);
  const il = withTall.islands[0];
  const hits = K.islandObstacleHits(withTall, il);
  assert.equal(hits.length, 0); // 2100 mm out: the row spans 1500–2100, clear of the beam (1200–1500)
  il.zMm = 1500; // the row now spans 900–1500: its tall unit stands under the beam
  assert.equal(K.islandObstacleHits(withTall, il).length > 0, true);
  assert.equal(K.islandFits(withTall, il, 2800, 1500), false);
  assert.equal(K.fitWarnings(withTall, { pro: true }).some((w) => /rekst á biti/i.test(w.msg)), true);
  // the same island without a tall unit is not stopped by a beam above it
  const flat = room([isl([B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600)], { zMm: 1500 })], [beam()]);
  assert.equal(K.islandObstacleHits(flat, flat.islands[0]).length, 0);
  assert.equal(K.islandFits(flat, flat.islands[0], 2800, 1500), true);
  // a nearby spot exists for the tall one
  const fit = K.nearestIslandFit(withTall, il, 2800, 1500);
  assert.ok(fit && K.islandFits(withTall, il, fit.x, fit.z));
  // spans for placing a tall unit in the row: the beam stretch along the row; a base unit gets none
  const spans = K.islandRowObstacleSpans(withTall, "I1a", { lo: 0, hi: 2500 }, 600);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].obstacle.id, "ob1");
  assert.deepEqual(K.islandRowObstacleSpans(withTall, "I1a", { lo: 0, hi: 900 }, 600), []);
});
