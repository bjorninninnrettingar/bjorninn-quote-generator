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
