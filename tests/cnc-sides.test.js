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

test("base cabinet = the shop's own T-56 program, inner drawer included (32 mm under the top board)", () => {
  const p = S.unitPlan("SK 1", SK1);
  assert.equal(p.status, "ok");
  assert.deepEqual([p.LPX, p.LPY, p.LPZ, p.groove], [800, 580, 16, true]);
  assert.deepEqual(ops(p), [
    'TOPP_BOTN: Bora_I_Gegn, LPZ, 1, "1,4"',
    'SLA_HLID: LPZ, bora_i_gegn, lpz+1, 0, "1,4"',
    "MERIVOBOX_V2: -1.5, 0, 0, 0, 0, 0, 397, E",     // bottom runner at 80 (the hand file has -3 = 78.5; user: 80 is right)
    "MERIVOBOX_V2: 397, 0, 0, 0, 0, 0, 397, K",       // the hand file has "400-3"
    "MERVIBOX_INNSKUFFA: 106, 700, M",                // = the hand file: 800 − 16 − 32 = 752 top of front → 752 − 106 + 54
  ]);
});

test("identical sides share one file, whatever the cabinet count", () => {
  const g = S.groupPlans([S.unitPlan("SK 1", SK1), S.unitPlan("SK 11/ 13 EYJA", SK11_13), S.unitPlan("SK 9.1", SK1)]);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, "SK01+09.1+11-13");
  assert.equal(g[0].cabinets, 4);
  assert.equal(S.fileName("T-56", g[0]), "T-56 SK01+09.1+11-13 Hliðar.bpp");
});

test("tall cabinet: inner drawers behind the door default from the bottom (75, front + 80), hinges flagged", () => {
  const p = S.unitPlan("SK 17 ANDYRI", SK17);
  assert.deepEqual(ops(p).filter((o) => o.startsWith("MERVIBOX")), [75, 299, 523, 747].map((x) => `MERVIBOX_INNSKUFFA: 144, ${x}, K`));
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

test("grip: drawer slots = cut front + grip strip; inner drawer in the tallest zone (T-33 Sk 2: E567 + M227, inner K at 447)", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 540, 597, 19, 1),
    row("Skúffufrontur M - Merivo", 200, 597, 19, 1), row("Innskúffufrontur K - Merivo Skrokkaefni", 144, 562, 16, 1)];
  const o = ops(S.unitPlan("Sk 2", rows, { gripMm: 27 }));
  assert.ok(o.includes("MERIVOBOX_V2: -1.5, 0, 0, 0, 0, 0, 567, E"));
  assert.ok(o.includes("MERIVOBOX_V2: 567, 0, 0, 0, 0, 0, 227, M"));
  assert.ok(o.includes("MERVIBOX_INNSKUFFA: 144, 448, K"));   // hand file: 447
});

test("two identical door fronts that can't stack are leaves of one opening (no negative hinges)", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Frontur", 797, 397, 19, 2)];
  const o = ops(S.unitPlan("Sk 16", rows)).filter((x) => x.startsWith("LOM"));
  assert.deepEqual(o, ['LOM: 80, 37, "2,3"']);
});

test("a low front in a drawer cabinet is a fixed front, not a door", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 597, 597, 19, 1), row("Frontur", 162, 597, 19, 1)];
  const o = ops(S.unitPlan("Sk 4", rows));
  assert.ok(o.includes("FAST_FRAMSTYKKI: 162, LPX, 0, 0"));
  assert.ok(!o.some((x) => x.startsWith("LOM")));
});

test("a side stored rotated in Sögunarlisti is turned by the unit's height; rail over 1000; FRE2 is FRE", () => {
  const p = S.unitPlan("Sk 19", [row("Grunnskápur hlið", 580, 2470, 16, 2)], { unitHeight: 2470 });
  assert.deepEqual([p.LPX, p.LPY], [2470, 580]);
  assert.equal(ops(p).filter((x) => x.startsWith("SLA_HLID")).length, 2);
  assert.equal(ops(S.unitPlan("x", [row("Grunnskápur hlið", 1040, 300, 16, 2)])).filter((x) => x.startsWith("SLA_HLID")).length, 2);
  assert.equal(S.unitPlan("Sk 6", [row("FRE2 - Hlið", 1670, 580, 19, 2)]).status, "stop");
});

test("a door taller than its space (wall cabinet with a lip) hangs on the side's own length", () => {
  const o = ops(S.unitPlan("Sk 6-8", [row("Grunnskápur hlið", 824, 300, 16, 2), row("Frontur", 864, 597, 19, 1)])).filter((x) => x.startsWith("LOM"));
  assert.deepEqual(o, ['LOM: 80, 37, "2,3"']);
});

test("Smíðagögn: the designer's hinges and door type win when its doors match Sögunarlisti", () => {
  const rows = [row("Grunnskápur hlið", 2190, 580, 16, 2), row("Frontur", 2187, 597, 19, 1)];
  assert.deepEqual(S.defaultHingeSpec(800), [{ from: "bottom", mm: 80 }, { from: "top", mm: 80 }]);
  const smida = JSON.stringify({ v: 1, doors: [{ h: 2190, type: "hinged", hinges: [{ from: "bottom", mm: 120 }, { from: "bottom", mm: 900 }, { from: "top", mm: 80 }] }] });
  const p = S.unitPlan("Sk 13", rows, { smida });
  assert.deepEqual(ops(p).filter((x) => x.startsWith("LOM")), ['LOM: 120, 37, "2"', 'LOM: 900, 37, "2"', 'LOM: 80, 37, "3"']);
  assert.ok(!p.check.some((c) => c.startsWith("Lamir: sjálfgefið")));
  assert.deepEqual(p.doors[0].frontHinges, [119, 899, 2111]);   // the same positions on the front (79 / −1)
});

test("Smíðagögn: a different door count is ignored, a height difference is flagged, lift-up = no side hinges", () => {
  const rows = [row("Grunnskápur hlið", 470, 580, 16, 2), row("Frontur", 467, 797, 19, 1)];
  const bad = S.unitPlan("Sk 7", rows, { smida: { v: 1, doors: [{ h: 300, type: "hinged", hinges: [] }, { h: 167, type: "hinged", hinges: [] }] } });
  assert.ok(bad.check.some((c) => c.startsWith("Smíðagögn passa ekki")));
  assert.ok(ops(bad).includes('LOM: 80, 37, "2,3"'));
  const off = S.unitPlan("Sk 7", rows, { smida: { v: 1, doors: [{ h: 367, type: "hinged", hinges: [{ from: "bottom", mm: 90 }, { from: "top", mm: 90 }] }] } });
  assert.deepEqual(ops(off).filter((x) => x.startsWith("LOM")), ['LOM: 90, 37, "2"', 'LOM: 90, 37, "3"']);
  assert.ok(off.check.some((c) => c.startsWith("Hurð 1: hönnuður 367")));
  const lift = S.unitPlan("Sk 7", rows, { smida: { v: 1, doors: [{ h: 467, type: "lift" }] } });
  assert.ok(!ops(lift).some((x) => x.startsWith("LOM")));
  assert.ok(lift.check.some((c) => c.startsWith("Lyftihurð")));
});

test("Smíðagögn with sizes only (no doors) = /cnc's default hinges, no mismatch warning", () => {
  const rows = [row("Grunnskápur hlið", 470, 580, 16, 2), row("Frontur", 467, 797, 19, 1)];
  const p = S.unitPlan("Sk 7", rows, { smida: JSON.stringify({ v: 1, w: 800, h: 800, d: 600, shelves: { loose: 1 } }) });
  assert.ok(!p.check.some((c) => c.startsWith("Smíðagögn passa ekki")));
  assert.ok(ops(p).includes('LOM: 80, 37, "2,3"'));
});
