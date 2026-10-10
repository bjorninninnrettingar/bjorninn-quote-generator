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

test("low oven: a plain 'Frontur' with a drawer back in the list is that drawer, not a door (T-32 Sk11)", () => {
  const rows = [row("Skápur hlið", 800, 583, 16, 2), row("Frontur", 202, 597, 16, 1), row("Skúffubak K - Merivo", 121, 517, 16, 1), row("Skúffubotn - Merivo", 474, 517, 16, 1)];
  const p = S.unitPlan("Sk 11", rows, {});
  assert.ok(ops(p).includes("MERIVOBOX_V2: -1.5, 0, 0, 0, 0, 0, 202, K"));
  assert.ok(!ops(p).some((x) => x.startsWith("LOM")));
});

test("oven from Smíðagögn: niche boards, fixed shelf and loose shelf with its own number of positions", () => {
  const r = (Partur, H, B, Þ, M) => ({ Partur, H, B, "Þ": Þ, M, "Tegund einingu": ["Ofnaskápur"] });
  const rows = [r("Skápur hlið", 2400, 583, 16, 2), r("Skúffufrontur E - Merivo", 397, 597, 19, 1), r("Skúffubak E - Merivo", 184, 517, 16, 1),
    r("Loftunarbotn", 582, 568, 16, 1), r("Loftunartoppur", 562, 568, 16, 1), r("Laus loftunarhilla", 558, 568, 16, 1), r("Frontur f. ofan ofn", 1202, 597, 19, 1)];
  const smida = JSON.stringify({ v: 1, oven: { h: 595, under: 600, shelves: [{ mm: 1600, fixed: true, pos: 1 }, { mm: 2000, fixed: false, pos: 5 }] } });
  const p = S.unitPlan("Sk 10", rows, { smida });
  const o = ops(p).filter((x) => /HILLA/.test(x));
  assert.deepEqual(o, ["FOST_HILLA: 16, 600, 2, lpy-22, lpz+5", "FOST_HILLA: 16, 1211, 2, lpy-22, lpz+5",
    "FOST_HILLA: 16, 1600, 2, lpy-22, lpz+5", "LAUS_HILLA: 1884, 5, 37, 20+60, 50"]);
  assert.ok(!p.check.some((c) => /bíða hönnuðar/.test(c)));
  assert.ok(!p.check.some((c) => /Lausar hillur:/.test(c))); // 1 loose in the drawing = 1 in Sögunarlisti
  // without Smíðagögn: still the old warning
  assert.ok(S.unitPlan("Sk 10", rows).check.some((c) => /bíða hönnuðar/.test(c)));
});

test("side files per cabinet: hinges only on the hinge side; no hinges = one file for both; unknown = both with hinges", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Frontur", 797, 597, 19, 1)];
  const left = S.unitPlan("Sk4 | LGR60", rows, { smida: JSON.stringify({ v: 1, hinge: "vinstri" }) });
  const f = S.sideFiles(left);
  assert.deepEqual(f.map((x) => [x.name, x.count, x.plan.ops.some((o) => o.name === "LOM")]), [["Vinstri hlið - lamir", 1, true], ["Hægri hlið", 1, false]]);
  assert.equal(S.cabinetFolder(left), "Sk4 - Grunnskápur");
  assert.equal(S.sideFileName("T-32", left, f[0]), "Vinstri hlið - lamir.bpp");
  assert.deepEqual(S.sideFiles(S.unitPlan("Sk4", rows, { smida: JSON.stringify({ v: 1, hinge: "haegri" }) })).map((x) => x.name), ["Vinstri hlið", "Hægri hlið - lamir"]);
  const unknown = S.unitPlan("Sk4", rows);
  assert.deepEqual(S.sideFiles(unknown).map((x) => [x.name, x.count]), [["Hliðar - lamir báðum megin", 2]]);
  assert.ok(unknown.check.some((c) => /Lamahlið óþekkt/.test(c)));
  assert.deepEqual(S.sideFiles(S.unitPlan("Sk1", SK1)).map((x) => [x.name, x.count]), [["Hliðar", 2]]);
});

test("older oven Smíðagögn (no shelf list): niche boards + the loose shelves spread above the niche", () => {
  const r = (Partur, H, B, Þ, M) => ({ Partur, H, B, "Þ": Þ, M, "Tegund einingu": ["Ofnaskápur"] });
  const rows = [r("Skápur hlið", 2400, 583, 16, 2), r("Laus loftunarhilla", 558, 568, 16, 2), r("Frontur f. ofan ofn", 1202, 597, 19, 1)];
  const o = ops(S.unitPlan("Sk 10", rows, { smida: JSON.stringify({ v: 1, oven: { h: 595, under: 600 } }) })).filter((x) => /HILLA/.test(x));
  assert.deepEqual(o, ["FOST_HILLA: 16, 600, 2, lpy-22, lpz+5", "FOST_HILLA: 16, 1211, 2, lpy-22, lpz+5",
    "LAUS_HILLA: 1557.3, 3, 37, 20+60, 50", "LAUS_HILLA: 1953.7, 3, 37, 20+60, 50"]);
});

test("fronts: global drawer fronts by code, door fronts with hinge cups from the side's hinges, leaves counted", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 374, 597, 19, 1),
    row("Skúffufrontur K - Merivo", 243, 597, 19, 1), row("Skúffufrontur M - Merivo", 171, 597, 19, 1)];
  const f = S.unitPlan("Sk1", rows).fronts;
  assert.deepEqual(f.map((x) => [x.name, x.master, x.LPX, x.LPY, x.ops.map((o) => o.name).join("+"), x.count]), [
    ["Skúffufrontur E 374", "merivo", 597, 374, "K_M_NEDSTI_FRONTUR_MERIVO+E_NEDSTI_FRONTUR_MERIVO", 1],
    ["Skúffufrontur K 243", "merivo", 597, 243, "K_M_NEDSTI_FRONTUR_MERIVO", 1],
    ["Skúffufrontur M 171", "merivo", 597, 171, "K_M_NEDSTI_FRONTUR_MERIVO", 1]]);
  // a 90 cm wing door: two leaves, hinges 80 from each end → cups 79 from both ends, one file run ×2
  const wing = S.unitPlan("Sk12", [row("Grunnskápur hlið", 800, 580, 16, 2), row("Frontur vænghurð", 797, 442, 19, 2)]).fronts;
  assert.deepEqual(wing.map((x) => [x.name, x.master, x.LPX, x.LPY, x.ops.map((o) => o.params), x.count]),
    [["Frontur vænghurð 797", "door", 797, 442, ['79, 0, "2,3"'], 2]]);
  // a Smíðagögn door with a middle hinge: cups from the nearest end
  const tall = S.unitPlan("Sk2", [row("Skápur hlið", 2400, 583, 16, 2), row("Frontur", 2397, 597, 19, 1)],
    { smida: JSON.stringify({ v: 1, doors: [{ h: 2397, type: "hinged", hinges: [{ from: "bottom", mm: 80 }, { from: "bottom", mm: 1200 }, { from: "top", mm: 80 }] }] }) }).fronts;
  assert.deepEqual(tall[0].ops.map((o) => o.params), ['79, 0, "2,3"', '1199, 0, "2"']);
});

test("renderSide with a front master: parameterless macros switched on/off by the plan", () => {
  const master = ["[VARIABLES]", "PAN=LPX|597||4|", "PAN=LPY|597||4|", "PAN=LPZ|19||4|", "[PROGRAM]",
    '@ K_M_NEDSTI_FRONTUR_MERIVO, "", "", 67399988, "", 0 :', '@ E_NEDSTI_FRONTUR_MERIVO, "", "", 67342012, "", 0 :', '@ STAT_BLOCK, "", "", 132215068, "", 0 : 0, LPY+100, 1'].join("\r\n");
  const r = S.renderSide(master, { LPX: 597, LPY: 243, LPZ: 19, ops: [{ name: "K_M_NEDSTI_FRONTUR_MERIVO", label: "", params: "" }] }, S.FRONT_MANAGED.merivo);
  const L = r.text.split("\r\n");
  assert.deepEqual(r.errors, []);
  assert.ok(L.includes("PAN=LPY|243||4|"));
  assert.ok(L.some((l) => /^@ K_M_NEDSTI_FRONTUR_MERIVO, "", "", \d+, "", 0 :$/.test(l)));
  assert.ok(L.includes(`' E_NEDSTI_FRONTUR_MERIVO, "", "", 67342012, "", 0 :`));
});

test("a drawer front too low for its code's extra row gets only the base row, with a warning", () => {
  const p = S.unitPlan("Sk7", [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 209, 667, 19, 1)]);
  assert.deepEqual(p.fronts[0].ops.map((o) => o.name), ["K_M_NEDSTI_FRONTUR_MERIVO"]);
  assert.ok(p.frontCheck.some((c) => /E-gatið \(218\)/.test(c)));
});
