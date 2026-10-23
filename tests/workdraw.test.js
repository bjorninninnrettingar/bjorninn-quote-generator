// kitchen-planner-workdraw.js — the PRO work-drawing renderer (pure SVG from a sheet model).
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../kitchen-planner-workdraw.js");
const W = globalThis.KPWD;

test("drawer labels follow the shop's codes", () => {
  assert.equal(W.drawerLabel("merivo", { code: "K" }), "M-K");
  assert.equal(W.drawerLabel("legra", { code: "E" }), "L-E");
  assert.equal(W.drawerLabel("merivo", { code: "K", inner: true }), "M-IK");
  assert.equal(W.drawerLabel("merivo", { code: "IM", inner: true }), "M-IM");
  assert.equal(W.drawerLabel("merivo", { code: "K", inner: true, mat: "FRE1" }), "M-IK (FRE1)");
});

test("a wall sheet renders: SK labels, drawers, door opening lines, dimension chain, scale picked", () => {
  const model = { project: "T-1 | Prófun", date: "23.10.2026", drawerSystem: "merivo", notes: ["FR1 – Hvítt"], sheets: [{
    title: "Veggur 1", lenMm: 3000, roomH: 2600, openings: [], afella: [], annotations: [{ kind: "text", a: { x: 100, y: 2000 }, text: "Innstunga" }],
    units: [
      { sk: "Sk1", zone: "floor", x: 0, w: 600, d: 600, h: 800, y0: 100, plinth: 100, fronts: [{ code: "K", mm: 400, side: 129 }, { code: "K", mm: 400, side: 129 }] },
      { sk: "Sk2", zone: "floor", x: 600, w: 600, d: 600, h: 800, y0: 100, plinth: 100, doors: [{ h: 800, hinge: "left" }], shelves: [{ mm: 400, fixed: false }] },
    ] }] };
  const pages = W.render(model);
  assert.equal(pages.length, 2); // overview + one wall
  const s = pages[1];
  assert.match(s, /<svg[^>]+width="420mm"/);
  assert.equal((s.match(/>M-K</g) || []).length, 2);
  assert.match(s, />SK1</);
  assert.match(s, />H3</);
  assert.match(s, />Innstunga</);
  assert.match(s, /Mkv\. 1:\d+/);
  assert.match(s, />3000</); // the wall's own total
});

test("pickScale: the smallest standard scale that fits", () => {
  assert.equal(W.pickScale(3000, 2600, 200, 200), 15);
  assert.equal(W.pickScale(6000, 2600, 200, 200), 30);
});
