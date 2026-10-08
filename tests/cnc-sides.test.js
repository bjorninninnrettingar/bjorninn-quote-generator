// cnc-sides.js — cabinet sides from Sögunarlisti. Fixtures are real T-56 rows; expectations are the shop's own
// hand-made T-56 programs (except the inner drawer, which follows the user's 20 mm finger-pull rule).
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../cnc-sides.js");
const S = globalThis.CNCSIDES;

const row = (Partur, H, B, Þ, M) => ({ Partur, H, B, "Þ": Þ, M, "Tegund einingu": ["Grunnskápur"] });
const SK1 = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur K - Merivo", 397, 797, 19, 1),
  row("Innskúffufrontur M - Merivo Skrokkaefni", 106, 762, 16, 1), row("Skúffufrontur E - Merivo", 397, 797, 19, 1), row("Botn", 568, 762, 16, 1)];
const SK11_13 = SK1.map((r) => ({ ...r, M: r.M * 2, B: r.Partur.includes("hlið") ? 580 : r.B }));
const SK17 = [row("Grunnskápur hlið", 2550, 530, 16, 2), row("Frontur", 2547, 797, 19, 1), row("Laus hilla", 508, 768, 16, 2),
  row("Innskúffufrontur K - Merivo Skrokkaefni", 144, 762, 16, 4)];

const MASTER = ["[VARIABLES]", "PAN=LPX|600||4|", "PAN=LPY|100||4|", "PAN=LPZ|19||4|", "", "[PROGRAM]",
  `' TOPP_BOTN, "", "Toppur / Botn", 68342668, "", 0 : Bora_I_Gegn, LPZ, 0, "1,4"`,
  `' SLA_HLID, "", "Slár", 161376700, "", 0 : LPZ, bora_i_gegn, lpz+1, 0, "1,4"`,
  `' CUT_X, "", "Sögun f. masonit", 133054388, "", 0 : 0, "2", -32, lpy-18`,
  `@ LOM, "", "80", 158303308, "", 0 : 79, 37, "2,3"`,
  `' LAUS_HILLA, "", "Laus hilla", 144898172, "", 0 : lpx/3-150, 12, 37, 20+60, 50`,
  `' MERIVOBOX_V2, "", "", 68155476, "", 0 : -3, 0, 0, 0, 0, 0, 397, E`,
  `' MERVIBOX_INNSKUFFA, "", "", 145835260, "", 0 : 144, 650, M`,
  `' CUT_X, "", "LED 4x8 (default Y 57)", 144058572, "", 0 : 0, "2"`,
  `@ STAT_BLOCK, "", "", 66488244, "", 0 : 0, LPY+100, 1`, "", "[VBSCRIPT]"].join("\r\n");

const ops = (p) => p.ops.map((o) => o.name + ": " + o.params);

test("base cabinet = the shop's own T-56 program (sizes, joints, drawers), inner drawer 20 mm under the top", () => {
  const p = S.unitPlan("SK 1", SK1);
  assert.equal(p.status, "ok");
  assert.deepEqual([p.LPX, p.LPY, p.LPZ, p.groove], [800, 580, 16, true]);
  assert.deepEqual(ops(p), [
    'TOPP_BOTN: Bora_I_Gegn, LPZ, 1, "1,4"',
    'SLA_HLID: LPZ, bora_i_gegn, lpz+1, 0, "1,4"',
    "MERIVOBOX_V2: -3, 0, 0, 0, 0, 0, 397, E",
    "MERIVOBOX_V2: 397, 0, 0, 0, 0, 0, 397, K",       // the hand file has "400-3"
    "MERVIBOX_INNSKUFFA: 106, 712, M",                // 800 − 16 − 20 = 764 top of front → 764 − 106 + 54
  ]);
});

test("identical sides share one file, whatever the cabinet count", () => {
  const g = S.groupPlans([S.unitPlan("SK 1", SK1), S.unitPlan("SK 11/ 13 EYJA", SK11_13), S.unitPlan("SK 9.1", SK1)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, "SK01+09.1+11-13");
  assert.equal(g[0].cabinets, 4);
  assert.equal(S.fileName("T-56", g[0]), "T-56 SK01+09.1+11-13 Hliðar.bpp");
});

test("tall cabinet: inner drawers behind the door from the bottom like T-56 SK 17 (75, 304, 533, 762), hinges flagged", () => {
  const p = S.unitPlan("SK 17 ANDYRI", SK17);
  assert.deepEqual(ops(p).filter((o) => o.startsWith("MERVIBOX")), [75, 304, 533, 762].map((x) => `MERVIBOX_INNSKUFFA: 144, ${x}, K`));
  assert.ok(ops(p).includes('LOM: 80, 37, "2,3"'));
  assert.equal(p.status, "check");
  assert.ok(p.check.some((c) => c.startsWith("Lamir")));
});

test("plumbing side: no masonite groove; plinths/end panels are skipped, FRE stops", () => {
  assert.equal(S.unitPlan("SK 18", [row("Lagna - Hliðar", 600, 430, 16, 2)]).groove, false);
  assert.equal(S.unitPlan("Sökkull", [row("Sökkull - framstykki", 80, 2000, 16, 1)]).status, "skip");
  assert.equal(S.unitPlan("SK 19", [row("FRE - Hlið", 450, 600, 19, 2)]).status, "stop");
});

test("hinges: 80 from each end, middle ones by height and moved off shelves; fronts are 79", () => {
  assert.deepEqual(S.hingePositions(797).at, [80, 717]);
  assert.deepEqual(S.hingePositions(1400).at, [80, 700, 1320]);
  const h = S.hingePositions(1400, [710]);
  assert.deepEqual(h.at, [80, 660, 1320]);
  assert.deepEqual(S.frontHinges(797), [79, 718]);
});

test("renderSide: numbers in, master's managed lines off, generated lines in place with fresh ids", () => {
  const p = S.unitPlan("SK 1", SK1);
  const r = S.renderSide(MASTER, p);
  assert.deepEqual(r.errors, []);
  const L = r.text.split("\r\n");
  assert.ok(L.includes("PAN=LPX|800||4|") && L.includes("PAN=LPY|580||4|") && L.includes("PAN=LPZ|16||4|"));
  assert.ok(L.some((l) => /^' LOM, "", "80"/.test(l)));                    // master's own hinge switched off
  assert.ok(L.some((l) => /^@ CUT_X, "", "Sögun f. masonit"/.test(l)));    // groove on
  assert.ok(L.some((l) => /^' CUT_X, "", "LED/.test(l)));                  // LED groove untouched
  const active = L.filter((l) => /^@ (TOPP_BOTN|SLA_HLID|MERIVOBOX_V2|MERVIBOX_INNSKUFFA),/.test(l));
  assert.equal(active.length, 5);
  const ids = L.map((l) => (l.match(/, (\d{9}), "", 0 :/) || [])[1]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);                               // no duplicate object ids
  // generated drawer lines sit right after the master's own (switched-off) drawer line
  const i = L.findIndex((l) => l.startsWith("' MERIVOBOX_V2,"));
  assert.ok(L[i + 1].startsWith("@ MERIVOBOX_V2,"));
});
