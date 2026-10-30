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
