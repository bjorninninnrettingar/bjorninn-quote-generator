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

test("tall cabinet: inner drawers behind the door default from the bottom (front at 60, + 80 apart), hinges flagged", () => {
  const p = S.unitPlan("SK 17 ANDYRI", SK17);
  assert.deepEqual(ops(p).filter((o) => o.startsWith("MERVIBOX")), [114, 338, 562, 786].map((x) => `MERVIBOX_INNSKUFFA: 144, ${x}, K`));
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
  assert.deepEqual(h.at, [80, 680, 1320]); // nearest spot 30 mm clear of the shelf row
  // a loose shelf's hole band (3 holes 50 apart): the middle hinge of a 2400 door leaves the band
  assert.deepEqual(S.hingePositions(2400, [1143, 1193, 1243]).at, [80, 600, 1275, 1800, 2320]);
  assert.deepEqual(S.frontHinges(797), [79, 718]);
});

// 2026-10-13: confirmed against real masters on the USB stick — Emilia Barugata sk1.bpp, a 1980 mm, 4-hinge door
// (`@ LOM : 80,37,"2,3"` / `1980/3,37,"2"` / `1980/3*2,37,"2"` / `1980-80,37,"2"`), and independently Birgitta
// Axlaras sk12/sk13 wip.bpp, a 1990 mm door with the same `len/3`, `len/3*2` pattern (plus hand-adjustments for
// obstacles). Middle hinges are plain fractions of the full door length, NOT evenly divided between the two
// 80 mm end hinges — the old formula gave 640/1760 for a 1980 mm door, ~27 mm off the real 660/1320.
test("middle-hinge spacing matches the real master convention (len×i/(n-1), not the end-trimmed span)", () => {
  assert.deepEqual(S.hingePositions(1980).at, [80, 660, 1320, 1900]);
});

test("renderSide: numbers in, master's managed lines off, generated lines in place with fresh ids", () => {
  const p = S.unitPlan("SK 1", SK1);
  const r = S.renderSide(MASTER, p);
  assert.deepEqual(r.errors, []);
  const L = r.text.split("\r\n");
  assert.ok(L.includes("PAN=LPX|800||4|") && L.includes("PAN=LPY|580||4|") && L.includes("PAN=LPZ|16||4|"));
  assert.ok(!L.some((l) => l.includes("LOM,")));                          // no hinges on this cabinet — gone, not just off
  assert.ok(L.some((l) => /^@ CUT_X, "", "Sögun f. masonit"/.test(l)));    // groove on
  assert.ok(L.some((l) => /^' CUT_X, "", "LED/.test(l)));                  // LED groove untouched
  const active = L.filter((l) => /^@ (TOPP_BOTN|SLA_HLID|MERIVOBOX_V2|MERVIBOX_INNSKUFFA),/.test(l));
  assert.equal(active.length, 5);
  const ids = L.map((l) => (l.match(/, (\d{9}), "", 0 :/) || [])[1]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);                               // no duplicate object ids
  // the master's own MERIVOBOX_V2 template (with its own example numbers) is gone entirely — only the
  // two real generated lines take its place, right where the template used to be. LAUS_HILLA (no loose
  // shelf on this cabinet) leaves no trace either, so the groove CUT_X line lands right before them.
  assert.ok(!L.some((l) => l.startsWith("' MERIVOBOX_V2,")));
  assert.ok(!L.some((l) => l.includes("LAUS_HILLA")));
  const i = L.findIndex((l) => l.startsWith("@ MERIVOBOX_V2,"));
  assert.ok(L[i - 1].startsWith("@ CUT_X, \"\", \"Sögun f. masonit\""));
});

test("a Merivo-only cabinet shows no Legra macro at all, and vice versa (user, 2026-10-13)", () => {
  const master = ["[VARIABLES]", "PAN=LPX|600||4|", "PAN=LPY|100||4|", "PAN=LPZ|19||4|", "", "[PROGRAM]",
    `' TOPP_BOTN, "", "Toppur / Botn", 160000000, "", 0 : Bora_I_Gegn, LPZ, 0, "1,4"`,
    `' SLA_HLID, "", "Slár", 160000004, "", 0 : LPZ, bora_i_gegn, lpz+1, 0, "1,4"`,
    `' LEGRABOX_NEDSTA_SKUFFA, "", "", 160000001, "", 0 : 397, E`,
    `' MERIVOBOX_V2, "", "", 160000002, "", 0 : -3, 0, 0, 0, 0, 0, 397, E`,
    `' MERVIBOX_INNSKUFFA, "", "", 160000005, "", 0 : 106, 700, M`,
    `@ STAT_BLOCK, "", "", 160000003, "", 0 : 0, LPY+100, 1`, ""].join("\r\n");
  const merivo = S.unitPlan("SK 1", SK1); // Merivo rows only
  const rm = S.renderSide(master, merivo);
  assert.deepEqual(rm.errors, []);
  const Lm = rm.text.split("\r\n");
  assert.ok(Lm.some((l) => l.includes("MERIVOBOX_V2")));
  assert.ok(!Lm.some((l) => l.includes("LEGRABOX")));   // not this cabinet's drawer system — no trace
});

test("renderSide: a managed macro with 2+ template lines in the master emits its ops only once, not once per template line (2026-10-14 bug, found via /bpp)", () => {
  const master = ["[VARIABLES]", "PAN=LPX|600||4|", "PAN=LPY|100||4|", "PAN=LPZ|19||4|", "", "[PROGRAM]",
    `' TOPP_BOTN, "", "Toppur / Botn", 170000000, "", 0 : Bora_I_Gegn, LPZ, 0, "1,4"`,
    `' SLA_HLID, "", "Slár", 170000001, "", 0 : LPZ, bora_i_gegn, lpz+1, 0, "1,4"`,
    `' MERIVOBOX_V2, "", "", 170000002, "", 0 : -3, 0, 0, 0, 0, 0, 397, E`,     // first example (E)
    `' MERIVOBOX_V2, "", "", 170000003, "", 0 : 400-3, 0, 0, 0, 0, 0, 397, K`, // second example (K) — same macro name
    `' MERVIBOX_INNSKUFFA, "", "", 170000005, "", 0 : 144, 650, M`,
    `@ STAT_BLOCK, "", "", 170000004, "", 0 : 0, LPY+100, 1`, ""].join("\r\n");
  const p = S.unitPlan("SK 1", SK1); // one Merivo drawer code (K) on this cabinet's own data
  const r = S.renderSide(master, p);
  assert.deepEqual(r.errors, []);
  const active = r.text.split("\r\n").filter((l) => l.startsWith("@ MERIVOBOX_V2,"));
  assert.equal(active.length, p.ops.filter((o) => o.name === "MERIVOBOX_V2").length); // not doubled by the 2nd template line
  assert.ok(!r.text.includes("' MERIVOBOX_V2,")); // the 2nd template line is dropped too, not left as a disabled leftover
});

test("grip: drawer slots = cut front + grip strip; inner drawer in the tallest zone (T-33 Sk 2: E567 + M227, inner K at 447)", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 540, 597, 19, 1),
    row("Skúffufrontur M - Merivo", 200, 597, 19, 1), row("Innskúffufrontur K - Merivo Skrokkaefni", 144, 562, 16, 1)];
  const o = ops(S.unitPlan("Sk 2", rows, { gripMm: 27 }));
  assert.ok(o.includes("MERIVOBOX_V2: -1.5, 0, 0, 0, 0, 0, 567, E"));
  assert.ok(o.includes("MERIVOBOX_V2: 567, 0, 0, 0, 0, 0, 227, M"));
  assert.ok(o.includes("MERVIBOX_INNSKUFFA: 144, 448, K"));   // hand file: 447
});

// 2026-10-13: grip (Vörulisti "Grip mm" via Höldur 1 — Jey and the like, a real handle sitting on the face)
// applies to every door/fixed front and every drawer front, any height, unconditionally.
// 2026-10-14: the "fræst grip" branch that used to live here (a negative Höldur-1 Grip mm, zeroed on doors/fixed
// fronts ≥900mm) is retired — Fræst grip no longer goes through Höldur 1 at all, so `grip` is never negative any
// more (see cnc.html's "Grip svæði (JSON)" + the check-list test below instead).
test("grip (Jey and the like, via Höldur 1) applies to every door/fixed front and drawer front, any height", () => {
  const drawerRows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur K - Merivo", 600, 597, 19, 1)];
  assert.ok(ops(S.unitPlan("Sk D", drawerRows, { gripMm: 27 })).includes("MERIVOBOX_V2: -1.5, 0, 0, 0, 0, 0, 627, K"));

  const jeyTall = S.unitPlan("C", [row("Grunnskápur hlið", 1000, 580, 16, 2), row("Frontur", 970, 597, 19, 1)], { gripMm: 27 });
  assert.deepEqual([jeyTall.doors[0].to, jeyTall.doors[0].from], [973, 0]); // positive grip: applies to a tall door too
});

// Fræst grip Type 1/2 (2026-10-14): Keyra skipulag already bakes a "alla" zone's shrink into Sérhæð/Hæð frontur N
// (so Sögunarlisti's H is already the shrunk size by the time it reaches here) — cnc-sides.js only has to surface
// where to mill, not recompute a dimension. A drawer-code "alla"+lárétt zone is now actually milled via the real
// HARDVIDAR_GRIP_ENDA_TIL_ENDA macro (found on the USB, disabled template line added to both front masters
// 2026-10-14) — frontPlans() below emits it. Everything else (split fronts, every "hluti" zone) is still a
// flagged-for-manual-work note, not a generated macro call.
test("grip svæði (Fræst grip): a drawer-code alla/lárétt zone is milled; everything else stays a manual flag", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur K - Merivo", 397, 797, 19, 1),
    row("Skúffufrontur E - Merivo", 397, 797, 19, 1)];
  const withZone = S.unitPlan("Sk G", rows, { grip: [{ target: "K", type: "alla", att: "lárétt", brun: "efst" }] });
  assert.ok(withZone.info.some((c) => c.indexOf("Grip — Skúffa K") === 0 && c.indexOf("HARDVIDAR_GRIP_ENDA_TIL_ENDA") >= 0));
  const kFront = withZone.fronts.find((f) => f.name.startsWith("Skúffufrontur K"));
  assert.deepEqual(kFront.ops.find((o) => o.name === "HARDVIDAR_GRIP_ENDA_TIL_ENDA").params, "397, 30"); // efst: FINALSTAERD = front height (already shrunk)

  const bottom = S.unitPlan("Sk G1b", rows, { grip: [{ target: "K", type: "alla", att: "lárétt", brun: "neðst" }] });
  const kFrontB = bottom.fronts.find((f) => f.name.startsWith("Skúffufrontur K"));
  assert.deepEqual(kFrontB.ops.find((o) => o.name === "HARDVIDAR_GRIP_ENDA_TIL_ENDA").params, "30, 30"); // neðst: flush at the bottom

  const partial = S.unitPlan("Sk G2", rows, { grip: [{ target: "E", type: "hluti", att: "lóðrétt", start: 100, length: 300 }] });
  assert.ok(partial.check.some((c) => c.indexOf("Grip — Skúffa E") === 0 && c.indexOf("100–400 mm") >= 0));

  const stale = S.unitPlan("Sk G3", rows, { grip: [{ target: "front2", type: "alla", att: "lárétt", brun: "efst" }] });
  assert.ok(stale.check.some((c) => c.indexOf('Grip "front2"') === 0 && c.indexOf("finnst ekki") >= 0));

  const none = S.unitPlan("Sk G4", rows);
  assert.ok(!none.check.some((c) => c.indexOf("Grip") === 0));
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

// 2026-10-13 (user): the default 80mm-from-ends formula is confirmed against the real masters, so it's no longer
// worth a warning on its own — only merge the two real risks (lift-up door on the side, unknown hinge side bores
// both) into one line when neither is known from the designer, and drop whichever half IS known.
test("default-hinge and hinge-side checks merge when neither is known, split or drop when the designer covers one", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Frontur", 797, 597, 19, 1)];
  const lamChecks = (p) => p.check.filter((c) => /^Lamir|^Lamahlið/.test(c));
  assert.deepEqual(lamChecks(S.unitPlan("Sk9", rows)),
    ["Lamir: sjálfgefin staðsetning, lamahlið óþekkt (lamagöt í báðar hliðar) — ef lyftihurð fara lamirnar í toppinn, ekki hliðina; vista skápinn í hönnuðinum til að staðfesta"]);
  assert.deepEqual(lamChecks(S.unitPlan("Sk9", rows, { smida: JSON.stringify({ v: 1, hinge: "vinstri" }) })),
    ["Lamir: sjálfgefin staðsetning — ef lyftihurð fara lamirnar í toppinn, ekki hliðina"]);
  const designerHinges = { v: 1, doors: [{ h: 797, type: "hinged", hinges: [{ from: "bottom", mm: 80 }, { from: "top", mm: 80 }] }] };
  assert.deepEqual(lamChecks(S.unitPlan("Sk9", rows, { smida: JSON.stringify(designerHinges) })),
    ["Lamahlið óþekkt — lamagöt í báðar hliðar (vista skápinn í hönnuðinum svo /cnc viti hvorum megin)"]);
  assert.deepEqual(lamChecks(S.unitPlan("Sk9", rows, { smida: JSON.stringify(Object.assign({ hinge: "vinstri" }, designerHinges)) })), []);
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
  assert.ok(unknown.check.some((c) => /lamahlið óþekkt/i.test(c)));
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
  assert.ok(!L.some((l) => l.includes("E_NEDSTI_FRONTUR_MERIVO")));  // not used on this front — gone, not just off
});

test("a drawer front too low for its code's extra row gets only the base row, with a warning", () => {
  const p = S.unitPlan("Sk7", [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 209, 667, 19, 1)]);
  assert.deepEqual(p.fronts[0].ops.map((o) => o.name), ["K_M_NEDSTI_FRONTUR_MERIVO"]);
  assert.ok(p.frontCheck.some((c) => /E-gatið \(218\)/.test(c)));
});

test("a cabinet drawn in the designer but not marked ready gets a warning; marked = none", () => {
  const rows = [row("Grunnskápur hlið", 800, 580, 16, 2), row("Skúffufrontur E - Merivo", 797, 597, 19, 1)];
  assert.ok(S.unitPlan("Sk5", rows, { smida: '{"v":1,"w":800}' }).check.some((c) => /Klár til framleiðslu/.test(c)));
  assert.ok(!S.unitPlan("Sk5", rows, { smida: '{"v":1,"w":800,"ready":true}' }).check.some((c) => /Klár til framleiðslu/.test(c)));
  assert.ok(!S.unitPlan("Sk5", rows).check.some((c) => /Klár til framleiðslu/.test(c))); // not from the designer at all
});

test("shelves from Smíða in any cabinet: fixed at its top face, loose with its own holes; hinges stay off them", () => {
  const rows = [row("Skápur hlið", 2400, 583, 16, 2), row("Frontur", 2397, 597, 19, 1), row("Laus hilla", 558, 566, 16, 1), row("Föst hilla", 558, 566, 19, 1)];
  const smida = JSON.stringify({ v: 1, shelves: { loose: 1, fixed: 1, list: [{ mm: 900, fixed: true, pos: 1 }, { mm: 1600, fixed: false, pos: 5 }] } });
  const p = S.unitPlan("Sk2", rows, { smida });
  assert.deepEqual(ops(p).filter((x) => /HILLA/.test(x)), ["FOST_HILLA: 19, 900, 2, lpy-22, lpz+5", "LAUS_HILLA: 1484, 5, 37, 20+60, 50"]);
  assert.ok(!p.check.some((c) => /^(Lausar hillur|Föst hilla|Fastar hillur)/.test(c))); // shelves are from the designer; the doors' default hinges are a separate, expected check
  // a default hinge in the middle of the door would land on a hole row → it is moved off it
  assert.ok(ops(p).filter((x) => /^LOM/.test(x)).every((x) => { const v = +x.split(": ")[1].split(",")[0]; return Math.abs(v - 1584) >= 30 || /"3"/.test(x); }));
  // counts that differ from Sögunarlisti are flagged
  const q = S.unitPlan("Sk2", rows.slice(0, 3), { smida });
  assert.ok(q.check.some((c) => /Fastar hillur: 1 í hönnuði, 0 í Sögunarlista/.test(c)));
});

test("inner drawers behind a door at the designer's positions (búrskápur in Smíða)", () => {
  const smida = JSON.stringify({ v: 1, inner: [{ code: "K", mm: 30 }, { code: "K", mm: 400 }, { code: "K", mm: 650 }, { code: "K", mm: 900 }] });
  const p = S.unitPlan("SK 17 ANDYRI", SK17, { smida });
  assert.deepEqual(ops(p).filter((o) => o.startsWith("MERVIBOX")), [84, 454, 704, 954].map((x) => `MERVIBOX_INNSKUFFA: 144, ${x}, K`));
  assert.ok(!p.check.some((c) => /hönnuður staðsetur/.test(c)));
});

// Fataslá (closet clothes rail): off Eyðublað's own link field for ordering (magn/names); a real position from
// Smíðagögn's own o.rails (Smíða, 2026-10-15 — bottom-up mm like a shelf) is flagged with the exact mm rather
// than drilled (2026-10-19 — the FATASLA macro isn't guaranteed to exist in the reference master this export
// reads, and a plan referencing it used to block the whole side file from writing, not just flag it) — same
// real T-80 Sigurjón data (SK 1-3 has one, SK 4 next to it has none).
test("Fataslá: no Smíða position yet → flagged as a manual step; no rail → silent", () => {
  const rows = [row("Grunnskápur hlið", 2385, 580, 16, 2), row("Frontur vænghurð", 1553, 461.5, 19, 2)];
  const withRail = S.unitPlan("SK 1-3", rows, { fataslar: { magn: 1, names: ["Fataslá Svört 1m Hafele"] } });
  assert.ok(withRail.check.includes("Fataslá (1): Fataslá Svört 1m Hafele — staðsetning vantar í Smíða, settu upp eftir teikningu"));
  assert.ok(!ops(withRail).some((o) => o.startsWith("FATASLA")));
  const noRail = S.unitPlan("SK 4", rows);
  assert.ok(!noRail.check.some((c) => /Fataslá/.test(c)));
});

test("Fataslá: Smíða position → flagged with the real mm (not drilled — the reference master isn't guaranteed to have FATASLA, and a plan referencing an undefined macro used to block the whole side file from being written at all, not just flag it; found live, T-80 Sk1-3, 2026-10-19)", () => {
  const rows = [row("Grunnskápur hlið", 2385, 580, 16, 2), row("Frontur vænghurð", 1553, 461.5, 19, 2)];
  const p = S.unitPlan("SK 1-3", rows, {
    fataslar: { magn: 1, names: ["Fataslá Svört 1m Hafele"] },
    smida: JSON.stringify({ v: 1, rails: [{ mm: 1800 }] }),
  });
  assert.ok(!ops(p).some((o) => o.startsWith("FATASLA")));
  assert.ok(p.check.includes("Fataslá (1): 1800 mm frá botni (úr Smíða) — borað handvirkt þangað til FATASLA er staðfest í master."));
});

test("Fataslá: magn in Pöntunarlisti disagreeing with Smíða's own rail count gets flagged", () => {
  const rows = [row("Grunnskápur hlið", 2385, 580, 16, 2), row("Frontur vænghurð", 1553, 461.5, 19, 2)];
  const p = S.unitPlan("SK 1-3", rows, {
    fataslar: { magn: 2, names: ["Fataslá Svört 1m Hafele"] },
    smida: JSON.stringify({ v: 1, rails: [{ mm: 1800 }] }),
  });
  assert.ok(p.check.some((c) => /magn í Pöntunarlista \(2\) og staðsetningar í Smíða \(1\)/.test(c)));
});
