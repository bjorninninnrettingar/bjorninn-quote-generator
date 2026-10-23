// kitchen-planner-plan.js — click inside a room on a floor plan bitmap → its outline (Allt heimilið, 2026-10-23)
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../kitchen-planner-plan.js");
const P = globalThis.KPPLAN;

// a synthetic plan at 1 px = 10 mm: outer walls 200 mm, an interior wall 120 mm with a 900 mm door gap, a second
// interior wall splitting the right half, thin "furniture" lines and a text-like squiggle inside the rooms
function plan(){
  const w = 1000, h = 700, g = new Uint8Array(w * h).fill(255);
  const rect = (x0, y0, x1, y1, v = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  rect(50, 50, 950, 70); rect(50, 630, 950, 650); rect(50, 50, 70, 650); rect(930, 50, 950, 650);   // outer walls
  rect(450, 70, 462, 630); rect(450, 300, 462, 390, 255);                                             // interior wall + door gap
  rect(462, 340, 930, 352); rect(700, 340, 790, 352, 255);                                           // right side split, its door
  for (let x = 120; x < 300; x++) g[200 * w + x] = 0; for (let y = 200; y < 260; y++) g[y * w + 300] = 0; // furniture (thin)
  for (let i = 0; i < 40; i++) g[(500 + (i % 7)) * w + 150 + i] = 0;                                  // "text"
  return { g, w, h };
}
const box = (poly) => { const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v)); };

test("click in a room → its floor up to the walls, not leaking through the door gap", () => {
  const { g, w, h } = plan();
  const left = P.detect(g, w, h, 250, 400, { pxPerMm: 0.1 });
  assert.ok(left, "found the left room");
  const [x0, y0, x1, y1] = box(left);
  assert.ok(Math.abs(x0 - 70) <= 3 && Math.abs(y0 - 70) <= 3 && Math.abs(x1 - 450) <= 3 && Math.abs(y1 - 630) <= 3, "left room ≈ 70,70 – 450,630, got " + [x0, y0, x1, y1]);
  assert.ok(left.length <= 6, "a clean rectangle-ish outline, " + left.length + " corners");
  const topRight = box(P.detect(g, w, h, 700, 200, { pxPerMm: 0.1 }));
  assert.ok(Math.abs(topRight[0] - 462) <= 3 && Math.abs(topRight[3] - 340) <= 3, "top-right room ends at the split wall, got " + topRight);
  const botRight = box(P.detect(g, w, h, 700, 500, { pxPerMm: 0.1 }));
  assert.ok(Math.abs(botRight[1] - 352) <= 3 && Math.abs(botRight[3] - 630) <= 3, "bottom-right room, got " + botRight);
});
test("outside the building / on a wall → nothing", () => {
  const { g, w, h } = plan();
  assert.equal(P.detect(g, w, h, 10, 10, { pxPerMm: 0.1 }), null);
});
test("an L-shaped room keeps its six corners; a slanted wall stays slanted", () => {
  const w = 800, h = 700, g = new Uint8Array(w * h).fill(255);
  const rect = (x0, y0, x1, y1, v = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  // L: outer 60..700 × 60..600, the top-right quarter (400..700 × 60..300) walled off
  rect(60, 60, 400, 80); rect(60, 580, 700, 600); rect(60, 60, 80, 600); rect(680, 300, 700, 600); rect(380, 60, 400, 320); rect(380, 300, 700, 320);
  const L = P.detect(g, w, h, 200, 450, { pxPerMm: 0.1 });
  assert.ok(L && L.length === 6, "6 corners, got " + (L && L.length));
  // a room with one 45° corner cut off
  const g2 = new Uint8Array(w * h).fill(255);
  const r2 = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g2[y * w + x] = 0; };
  r2(60, 60, 520, 80); r2(60, 580, 700, 600); r2(60, 60, 80, 600); r2(680, 220, 700, 600);
  for (let t = 0; t < 220; t++) for (let k = -14; k <= 14; k++){ const x = 495 + t + Math.round(k * 0.7), y = 55 + t + Math.round(-k * 0.7) + 10; if (x >= 0 && x < w && y >= 0 && y < h) g2[y * w + x] = 0; }
  const C = P.detect(g2, w, h, 300, 350, { pxPerMm: 0.1 });
  assert.ok(C && C.length === 5, "5 corners with the skáveggur, got " + (C && C.length));
});
test("a calibration that isn't a round number (R not an integer) still finds the room", () => {
  const w = 1000, h = 700, g = new Uint8Array(w * h).fill(255);
  const rect = (x0, y0, x1, y1, v = 0) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  rect(50, 50, 950, 70); rect(50, 630, 950, 650); rect(50, 50, 70, 650); rect(930, 50, 950, 650); rect(450, 70, 462, 630); rect(450, 300, 462, 390, 255); rect(462, 340, 930, 352); rect(700, 340, 790, 352, 255);
  for (const k of [0.100023, 0.1037, 0.0961]) assert.ok(P.detect(g, w, h, 699, 199, { pxPerMm: k }), "found at " + k);
});
