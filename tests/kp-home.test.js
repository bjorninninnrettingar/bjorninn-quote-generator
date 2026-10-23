// kitchen-planner-home.js — Allt heimilið drawn outline-first: interior walls across the outline → the rooms.
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../kitchen-planner-home.js");
const H = globalThis.KPHOME;

const box = (pts) => { const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; };

test("one wall across a rectangle makes two rooms, each 60 mm short of the wall's centre line", () => {
  const P = H.outlinePoly({ w: 6000, d: 4000, shape: "rect" });
  const S = H.spans(P, [{ o: "v", c: 3000, p: 2000 }]);
  assert.deepEqual(S, [{ o: "v", c: 3000, a: 0, b: 4000 }]);
  const R = H.regions(P, S, 120);
  assert.equal(R.length, 2);
  assert.deepEqual(box(R[0].pts), [0, 0, 2940, 4000]);
  assert.deepEqual(box(R[1].pts), [3060, 0, 6000, 4000]);
  assert.ok(Math.abs(R[0].area - 2.94 * 4) < 1e-6);
});

test("a later wall stops at an earlier one (a T), never crosses it", () => {
  const P = H.outlinePoly({ w: 6000, d: 4000, shape: "rect" });
  const S = H.spans(P, [{ o: "v", c: 3000, p: 2000 }, { o: "h", c: 2000, p: 4500 }]);
  assert.deepEqual(S[1], { o: "h", c: 2000, a: 3000, b: 6000 });
  const R = H.regions(P, S, 120);
  assert.equal(R.length, 3);
});

test("outside or duplicate walls are ignored", () => {
  const P = H.outlinePoly({ w: 6000, d: 4000, shape: "L", corner: "ne", cw: 2000, cd: 2000 });
  const S = H.spans(P, [{ o: "v", c: 5000, p: 1000 }, { o: "v", c: 3000, p: 3000 }, { o: "v", c: 3000, p: 1000 }]);
  assert.equal(S[0], null);
  assert.deepEqual(S[1], { o: "v", c: 3000, a: 0, b: 4000 });
  assert.equal(S[2], null);
});

test("an L-shaped room keeps its shape and its interior side moves in", () => {
  const P = H.outlinePoly({ w: 6000, d: 4000, shape: "L", corner: "ne", cw: 2000, cd: 2000 });
  const R = H.regions(P, H.spans(P, [{ o: "v", c: 1500, p: 2000 }]), 120);
  assert.equal(R.length, 2);
  const L = R.find((r) => r.pts.length === 6);
  assert.ok(L, "the right room is an L");
  assert.deepEqual(box(L.pts), [1560, 0, 6000, 4000]);
});

test("every template splits into exactly its named rooms", () => {
  for (const [k, t] of Object.entries(H.TEMPLATES)) {
    const P = H.outlinePoly(t.outline), S = H.spans(P, t.walls);
    assert.ok(S.every(Boolean), k + ": every wall lands");
    const R = H.regions(P, S, 120);
    assert.equal(R.length, t.names.length, k);
    for (const r of R) assert.equal(t.names.filter((n) => H.inside(r.raw, n[0], n[1])).length, 1, k + ": one name per room");
    for (const r of R) assert.ok(r.area > 2, k + ": no sliver rooms");
  }
});
