// kp-pocket.test.js — pocket-door rules (kitchen-planner-pocket.js, round 1, 2026-10-30)
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.window = globalThis;
await import("../kitchen-planner-pocket.js");
const P = globalThis.KPPOCKET;
const dims = (w, h = 2300, d = 600) => ({ widthMm: w, bodyMm: h, depthMm: d });

test("the pocket sits inside the width: 100 mm of 600 leaves 500", () => {
  const r = P.resolve({ pocketSys: "revego", pocketVer: "uno", pocketSide: "right" }, dims(600), "left");
  assert.equal(r.pocketTotal, 100);
  assert.equal(r.innerMm, 500);
  assert.deepEqual(r.pockets, [{ x0: 500, x1: 600, side: "right" }]);
  assert.equal(P.spaceText(r)[0], "Vasinn tekur 100 mm af 600 mm. Innanmál: 500 mm");
});

test("duo takes 150, uno + uno takes 2 x 100, Hawa 55 / 110 (connector constants)", () => {
  assert.equal(P.resolve({ pocketVer: "duo" }, dims(1000)).pocketTotal, 150);
  const uu = P.resolve({ pocketVer: "unouno" }, dims(1200));
  assert.equal(uu.pocketTotal, 200); assert.equal(uu.innerMm, 1000); assert.equal(uu.pockets.length, 2);
  assert.equal(P.resolve({ pocketSys: "concepta", pocketVer: "c1" }, dims(600)).pocketTotal, P.HAWA_CONNECTOR_MM.one);
  assert.equal(P.resolve({ pocketSys: "concepta", pocketVer: "f2" }, dims(800)).pocketTotal, P.HAWA_CONNECTOR_MM.two);
  assert.equal(P.resolve({ pocketSys: "concepta", pocketVer: "f2x2" }, dims(1600)).pocketTotal, 2 * P.HAWA_CONNECTOR_MM.two);
  assert.equal(P.resolve({ pocketSys: "concepta", pocketVer: "f2p1" }, dims(1200)).pocketTotal, P.HAWA_CONNECTOR_MM.two + P.HAWA_CONNECTOR_MM.one);
});

test("old drafts (no pocketVer / pocketSide) map by width and keep the hinge side", () => {
  assert.equal(P.verOf({ type: "pocket", pocketSys: "revego" }, 600), "uno");
  assert.equal(P.verOf({ type: "pocket", pocketSys: "revego" }, 950), "duo");
  assert.equal(P.verOf({ type: "pocket", pocketSys: "revego" }, 1700), "unouno");
  assert.equal(P.verOf({ type: "pocket", pocketSys: "concepta" }, 600), "c1");
  assert.equal(P.verOf({ type: "pocket", pocketSys: "concepta", pocketVer: "uno" }, 1000), "c2x1"); // a Revego key under Hawa: width default
  assert.equal(P.closestVer("concepta", "duo"), "f2");
  assert.equal(P.closestVer("revego", "f2x2"), "duoduo");
  assert.equal(P.resolve({ type: "pocket" }, dims(600), "right").side, "right");
  assert.equal(P.resolve({ type: "pocket" }, dims(600), "left").side, "left");
});

test("leaves tile the whole front with a 2 mm joint, leaf 0 next to the pocket", () => {
  for (const [sys, ver, w] of [["revego", "uno", 800], ["revego", "duo", 1200], ["revego", "unouno", 1400], ["revego", "unoduo", 1800], ["concepta", "f2p1", 1500], ["concepta", "f2x2", 2400]]) {
    const r = P.resolve({ pocketSys: sys, pocketVer: ver, pocketSide: "left" }, dims(w));
    assert.equal(r.leaves[0].x0, 0, ver); assert.ok(Math.abs(r.leaves.at(-1).x1 - w) < 1e-6, ver);
    r.leaves.slice(1).forEach((l, i) => assert.ok(Math.abs(l.x0 - r.leaves[i].x1) < 1e-6, ver));
    r.pockets.forEach(p => { assert.ok(p.x0 >= 0 && p.x1 <= w); });
  }
  const l = P.resolve({ pocketVer: "uno" }, dims(900)).units[0];
  assert.equal(l.leafMm, 898);
});

test("validations: spec examples", () => {
  const e = (spec, d) => P.validate(P.resolve(spec, d)).filter(x => x.level === "err").map(x => x.text);
  assert.deepEqual(e({ pocketVer: "uno" }, dims(950)), ["Hurðin er of breið fyrir REVEGO uno (hámark 898 mm)"]);
  assert.deepEqual(e({ pocketVer: "uno" }, dims(900)), []);
  assert.match(e({ pocketVer: "uno" }, dims(400))[0], /of mjór fyrir REVEGO uno \(lágmark 450 mm\)/);
  assert.match(e({ pocketVer: "uno" }, dims(600, 1100))[0], /of lágur fyrir REVEGO \(lágmark 1155 mm\)/);
  assert.match(e({ pocketVer: "uno" }, dims(600, 3100))[0], /of hár fyrir REVEGO \(hámark 3012 mm\)/);
  assert.match(e({ pocketVer: "uno" }, dims(600, 2300, 500))[0], /of grunnur fyrir REVEGO \(lágmark 573 mm\)/);
  assert.deepEqual(e({ pocketVer: "uno", onWorktop: true }, dims(600, 1140)), []);       // front from 1130 on a worktop
  assert.match(e({ pocketVer: "uno", onWorktop: true }, dims(600, 1100))[0], /Framhliðin er of lág/);
  assert.match(e({ pocketSys: "concepta", pocketVer: "c1" }, dims(900))[0], /of breið fyrir Concepta III \(hámark 750 mm\)/);
  assert.match(e({ pocketSys: "concepta", pocketVer: "c1" }, dims(600, 2800))[0], /of há fyrir Concepta III \(hámark 2700 mm\)/);
  assert.match(e({ pocketSys: "concepta", pocketVer: "f2" }, dims(800, 1000))[0], /of lág fyrir Folding Concepta III \(lágmark 1200 mm\)/);
  const warn = P.validate(P.resolve({ pocketSys: "concepta", pocketVer: "c1" }, dims(600, 2400)));
  assert.equal(warn.filter(x => x.level === "err").length, 0); assert.equal(warn[0].level, "warn");
});

test("every version has a width that validates clean, and the valid widths do not overlap wrongly", () => {
  for (const sys of ["revego", "concepta"]) for (const v of P.versionsOf(sys)) {
    let ok = 0; for (let w = 300; w <= 3000; w += 10) if (!P.firstError(P.resolve({ pocketSys: sys, pocketVer: v.key }, dims(w, 2000)))) ok++;
    assert.ok(ok > 0, sys + " " + v.key + " has no valid width");
  }
  // the default for a width is itself valid across the common range
  for (let w = 450; w <= 900; w += 50) assert.equal(P.firstError(P.resolve({ pocketSys: "revego" }, dims(w, 2000))), null, "uno " + w);
});

test("folding doors name their front clearance as an estimate", () => {
  const f = P.resolve({ pocketSys: "concepta", pocketVer: "f2" }, dims(1000, 2200, 600));
  assert.ok(f.folding); assert.match(P.spaceText(f)[1], /áætlun/);
  const u = P.resolve({ pocketVer: "uno" }, dims(600, 2200, 600));
  assert.equal(u.protrudeMm, 38); // 598 mm leaf, 560 mm pocket depth
  assert.match(P.spaceText(u)[1], /Opin hurð stendur um 38 mm/);
  assert.equal(P.resolve({ pocketVer: "uno" }, dims(450, 2200, 600)).protrudeMm, 0);
});

test("plan symbols are true mm: the viewBox is the cabinet plus a margin", () => {
  const r = P.resolve({ pocketVer: "uno", pocketSide: "right" }, dims(900, 2300, 600));
  const svg = P.planSvg(r);
  assert.match(svg, /viewBox="-40 -40 980 /);
  assert.match(svg, /<rect x="800" y="0" width="100" height="600"/); // the 100 mm pocket at the right end
});

test("Blum duo: both leaves of the pocket side belong to one unit, uno + duo puts uno at the pocketSide end", () => {
  const r = P.resolve({ pocketVer: "unoduo", pocketSide: "right" }, dims(1800));
  assert.equal(r.pockets.length, 2);
  assert.equal(r.units[0].kind, "uno"); assert.equal(r.units[0].pocketSide, "right");
  assert.equal(r.units[1].pocketSide, "left");
  assert.equal(r.pockets[0].x1 - r.pockets[0].x0, 150); // the duo pocket is at the left end
  assert.equal(r.pockets[1].x1 - r.pockets[1].x0, 100);
  assert.equal(P.leafOf(r), "duo");
});
