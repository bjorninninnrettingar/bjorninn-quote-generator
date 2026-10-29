// cnc-bpp.js side features (2026-10-29): Topp/Botn, slár (back, both ends), masonite groove and LED read from the generated file
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../cnc-sides.js");
await import("../cnc-bpp.js");
const S = globalThis.CNCSIDES, B = globalThis.CNCBPP;
const MASTER = ["[VARIABLES]", "PAN=LPX|0||4|", "PAN=LPY|0||4|", "PAN=LPZ|0||4|", "", "[PROGRAM]",
  `' CUT_X, "", "Sögun f. masonit", 133054388, "", 0 : 0, "2", -32, lpy-18, 0, 7, lpx+64, 0, 100, "", 1`,
  `' CUT_X, "", "LED 4x8 (default Y 57)", 144058572, "", 0 : 0, "2", -50, 60, 0, 8+.5, lpx+50+50, 0, 100, "", 1`,
  `@ STAT_BLOCK, "", "", 100000001, "", 0 : 0, LPY+100, 1`, "", "[VBSCRIPT]"].join("\r\n");
test("side features: board footprints, back rails at both ends, masonite groove, LED line", () => {
  const rows = [{ Partur: "Skápur hlið", H: 2000, B: 580, "Þ": 16, M: 2, "Tegund einingu": ["Hárskápur"] }];
  const plan = S.unitPlan("Sk 1", rows, { smida: { v: 1, led: [{ where: "hlid", y: 45 }] } });
  const text = S.renderSide(MASTER, plan).text;
  const parsed = B.parseBpp(text);
  const f = B.buildSideFeatures(parsed.ops, parsed.vars).features;
  const tb = f.find((x) => x.type === "tb");
  assert.deepEqual([tb.z, tb.bil, tb.corners], [16, 1, [1, 4]]);
  const rails = f.filter((x) => x.type === "rail");
  assert.deepEqual(rails.map((r) => r.y), [17, 683.7]); // "Slár" and "Auka Slár"
  assert.equal(rails[0].bakz, 16);
  const gr = f.filter((x) => x.type === "groove");
  assert.deepEqual(gr.map((x) => [x.led, x.y]), [[false, 562], [true, 45]]); // masonite at lpy−18, LED 45 from the front edge
});

test("LED run: a shorter one is read back with its start and end; fatalyfta macros give shapes at their positions", () => {
  const rows = [{ Partur: "Skápur hlið", H: 2000, B: 580, "Þ": 16, M: 2, "Tegund einingu": ["Hárskápur"] }];
  const plan = S.unitPlan("Sk 1", rows, { smida: { v: 1, led: [{ where: "hlid", y: 45, from: 100, len: 500 }, { where: "hlid", y: 60 }],
    rails: [{ type: "emuca", mm: 1370, y: 180 }, { type: "toplift", mm: 1480 }] } });
  const parsed = B.parseBpp(S.renderSide(MASTER, plan).text);
  const f = B.buildSideFeatures(parsed.ops, parsed.vars).features;
  const led = f.filter((x) => x.type === "groove" && x.led);
  assert.deepEqual(led.map((x) => [x.y, x.x0, x.x1]), [[45, 100, 600], [60, 0, 2000]]);
  const lifts = f.filter((x) => x.type === "lift");
  assert.equal(lifts.length, 2);
  assert.match(lifts[0].label, /Emuca fatalyfta — 1370 mm frá botni, 180 mm frá framkanti/);
  const box = lifts[0].shapes.find((s) => s.k === "rect");
  assert.deepEqual([box.x0, box.x1, box.y0, box.y1], [1107, 1370, 200, 340]);
  assert.equal(lifts[0].shapes.filter((s) => s.k === "hole").length, 4);
  assert.match(lifts[1].label, /toplift — 1480 mm frá botni, 290 mm frá framkanti/);
});

test("drawer features carry the macro's first parameter (box bottom = 27.5 + slot for Merivo, 26 + slot for Legra); inner drawers know their system", () => {
  const rows = [{ Partur: "Skápur hlið", H: 800, B: 555, "Þ": 16, M: 2, "Tegund einingu": ["Grunnskápur"] }, { Partur: "Skúffufrontur E - Merivo", H: 300, B: 597, "Þ": 19, M: 2, "Tegund einingu": ["Grunnskápur"] },
    { Partur: "Innskúffufrontur M - Merivo Skrokkaefni", H: 106, B: 562, "Þ": 16, M: 2, "Tegund einingu": ["Grunnskápur"] }];
  const M2 = MASTER.replace("@ STAT_BLOCK", `' MERIVOBOX_V2, "", "", 1, "", 0 : -3, 0, 0, 0, 0, 0, 397, E\r\n' MERVIBOX_INNSKUFFA, "", "", 2, "", 0 : 144, 650, M\r\n@ STAT_BLOCK`);
  const plan = S.unitPlan("Sk 2", rows, {});
  const parsed = B.parseBpp(S.renderSide(M2, plan).text);
  const f = B.buildSideFeatures(parsed.ops, parsed.vars).features;
  const d = f.filter((x) => x.type === "drawer");
  assert.deepEqual(d.map((x) => [x.sys, x.p0]), [["merivo", -1.5], ["merivo", 300]]); // bottom −1.5 → box from 26; the next slot param = Σ(slot) → 327.5
  assert.ok(f.filter((x) => x.type === "inner").every((x) => x.sys === "merivo"));
});
