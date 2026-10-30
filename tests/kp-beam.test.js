// kp-beam.test.js — the pure maths of dragging / turning a ceiling beam (kitchen-planner-beam.js, 2026-10-30)
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.window = globalThis;
await import("../kitchen-planner-beam.js");
const B = globalThis.KPBEAM;

test("damping: full speed above 20 degrees, much less below, never zero, always smaller the flatter", () => {
  assert.equal(B.dampScale(45), 1);
  assert.equal(B.dampScale(20), 1);
  assert.ok(B.dampScale(19.9) > 0.98);
  assert.ok(B.dampScale(10) < 0.4 && B.dampScale(10) > 0.15);
  let last = 1;
  for (const e of [19, 15, 10, 6, 3, 1]) { const k = B.dampScale(e); assert.ok(k > 0 && k < last, "e=" + e); last = k; }
});

test("damping: a huge pointer jump moves at most 60 mm per event, in the right direction", () => {
  const r = B.dampStep({ x: 0, z: 0 }, { x: 3000, z: 4000 }, 45);
  assert.ok(Math.abs(Math.hypot(r.x, r.z) - 60) < 1e-6);
  assert.ok(Math.abs(r.x / r.z - 0.75) < 1e-9);
  // a small move above the flat angle passes through whole
  assert.deepEqual(B.dampStep({ x: 10, z: 10 }, { x: 25, z: 10 }, 30), { x: 25, z: 10 });
  // flat ray: the same pointer travel moves the beam less
  const flat = B.dampStep({ x: 0, z: 0 }, { x: 40, z: 0 }, 8);
  assert.ok(flat.x > 0 && flat.x < 40 * 0.3);
});

test("damping: mm per pixel stays between 4 and 11 however flat the camera is (raw growth 1 / sin²)", () => {
  const perPx = (e) => 61 * Math.pow(Math.sin(8 * Math.PI / 180) / Math.sin(e * Math.PI / 180), 2) * B.dampScale(e); // raw mm/px measured at 8 degrees
  for (const e of [3, 5, 8, 12, 19]) { const v = perPx(e); assert.ok(v > 4 && v < 11, "e=" + e + " -> " + v); }
});

test("damping: sideways travel is kept, travel towards the camera is damped", () => {
  const fwd = { x: 0, z: 1 };
  const side = B.dampStep({ x: 0, z: 0 }, { x: 40, z: 0 }, 8, 0, fwd), depth = B.dampStep({ x: 0, z: 0 }, { x: 0, z: 40 }, 8, 0, fwd);
  assert.equal(side.x, 40); assert.equal(side.z, 0); assert.equal(depth.x, 0);
  assert.ok(Math.abs(depth.z - 40 * B.dampScale(8)) < 1e-9);
  const big = B.dampStep({ x: 0, z: 0 }, { x: 900, z: 900 }, 8, 0, fwd);
  assert.ok(Math.hypot(big.x, big.z) <= 60 + 1e-9);
});

test("grid: 10 mm steps, Shift = 1 mm", () => {
  const p = B.place({ cA: 1004, cN: 453, w: 2000, d: 300, ang: 0, free: true });
  assert.equal(p.cA - 1000, 0); assert.equal(p.cN - 150, 300);
  const f = B.place({ cA: 1004, cN: 453, w: 2000, d: 300, ang: 0, free: true, fine: true });
  assert.equal(f.cA - 1000, 4); assert.equal(f.cN - 150, 303);
});

test("snaps: wall end within 50 mm grabs the beam, 60 mm does not, Alt turns snaps off", () => {
  const targets = { a: [0, 3200], n: [0] };
  // beam 2000 wide, left end 40 mm from the wall's left corner
  let p = B.place({ cA: 1040, cN: 450, w: 2000, d: 300, ang: 0, targets });
  assert.equal(p.cA - 1000, 0); assert.ok(p.snapA);
  p = B.place({ cA: 1060, cN: 450, w: 2000, d: 300, ang: 0, targets });
  assert.equal(p.cA - 1000, 60); assert.ok(!p.snapA);
  p = B.place({ cA: 1040, cN: 450, w: 2000, d: 300, ang: 0, targets, free: true });
  assert.equal(p.cA, 1040);
  // far end onto the right corner
  p = B.place({ cA: 2170, cN: 450, w: 2000, d: 300, ang: 0, targets });
  assert.equal(p.cA + 1000, 3200);
  // against the wall (out)
  p = B.place({ cA: 1500, cN: 190, w: 2000, d: 300, ang: 0, targets });
  assert.equal(p.cN - 150, 0); assert.ok(p.snapN);
});

test("snaps: a window edge and another beam's side", () => {
  const targets = { a: [1200, 1800], n: [600] }; // window 1200..1800, a beam whose near side is at 600
  const p = B.place({ cA: 2780, cN: 1000, w: 2000, d: 300, ang: 0, targets }); // left end at 1780 -> 1800
  assert.equal(p.cA - 1000, 1800);
  const q = B.place({ cA: 1500, cN: 750, w: 2000, d: 300, ang: 0, targets }); // far side n=900?? near side 600 -> snaps
  assert.equal(q.cN - 150, 600);
});

test("snaps use the turned box: a 45 degree beam snaps by its real extent", () => {
  const e = B.extents(1000, 1000, 2000, 300, 45);
  assert.ok(Math.abs(e.minA - (1000 - (2000 * Math.SQRT1_2 + 300 * Math.SQRT1_2) / 2)) < 1e-6);
  const p = B.place({ cA: 1000 + 20, cN: 1000, w: 2000, d: 300, ang: 45, targets: { a: [e.minA - 0] , n: [] } });
  const ex2 = B.extents(p.cA, p.cN, 2000, 300, 45);
  assert.ok(Math.abs(ex2.minA - e.minA) < 1e-6);
});

test("angle: 5 degree steps, Shift 1 degree, magnet to 0 / 45 / 90 within 3 degrees", () => {
  assert.equal(B.turn({ pointerAng: 23, grab: 0 }).total, 25);
  assert.equal(B.turn({ pointerAng: 23, grab: 0, fine: true }).total, 23);
  const m = B.turn({ pointerAng: 87.5, grab: 0, fine: true });
  assert.equal(m.total, 90); assert.ok(m.magnet);
  assert.equal(B.turn({ pointerAng: 43, grab: 0, fine: true }).total, 45);
  assert.equal(B.turn({ pointerAng: 41.9, grab: 0, fine: true }).total, 42);
  assert.equal(B.turn({ pointerAng: 2.9, grab: 0, fine: true }).total, 0);
  assert.equal(B.turn({ pointerAng: 87.5, grab: 0, fine: true, free: true }).total, 87.5); // Alt: no magnet
});

test("angle: the press keeps the grab offset (no jump), and the stored ang excludes the quarter turn", () => {
  // handle grabbed 10 degrees away from the beam's axis: moving the pointer 20 degrees turns the beam 20 degrees
  const t = B.turn({ pointerAng: 40, grab: 10, base: 0 });
  assert.equal(t.total, 30);
  // rot 90 box (base 90): total 120 is stored as ang 30
  const r = B.turn({ pointerAng: 120, grab: 0, base: 90 });
  assert.equal(r.total, 120); assert.equal(r.ang, 30);
  assert.equal(B.normAng(190), -170); assert.equal(B.normAng(-180), 180); assert.equal(B.normLine(100), -80);
});

test("wall ownership: stays on its wall until well past the wall's ends", () => {
  assert.ok(B.keepsWall(-100, 3200)); assert.ok(B.keepsWall(3300, 3200));
  assert.ok(!B.keepsWall(-200, 3200)); assert.ok(!B.keepsWall(3400, 3200));
});

test("gaps to the wall: left, right and out follow the turn", () => {
  const g = B.wallGaps(1600, 450, 2000, 300, 0, 3200);
  assert.deepEqual([g.left, g.right, g.out], [600, 600, 300]);
  const h = B.wallGaps(1600, 1000, 2000, 300, 90, 3200);
  assert.ok(Math.abs(h.left - (1600 - 150)) < 1e-6 && Math.abs(h.out - 0) < 1e-6);
});
