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

test("doorSheet: one row per door, DIN hinge text, sliding doors say which way", () => {
  const svg = globalThis.KPWD.doorSheet({ project: "T-32" }, [
    { hu: "HU3", room: "Baðh.", kind: "hurd", product: "Innfelld hurð | JNF skrá", w: 900, h: 2100, wall: 100, hinge: "left", qty: 2, leaf: "Spónn Eik, ljós" },
    { hu: "HU4", room: "Gangur", kind: "renni", product: "Rennihurð | Hawa", w: 1000, h: 2100, wall: 120, hinge: "right", slide: true, qty: 1 },
  ], 3, 3);
  assert.match(svg, /HURÐALISTI — T-32/);
  assert.match(svg, />HU3</); assert.match(svg, />Vinstri</); assert.match(svg, /Rennur til vinstri/); assert.match(svg, /Spónn Eik, ljós/);
});

test("coverSheet: lists every room with its page range, then the door list", () => {
  const svg = globalThis.KPWD.coverSheet({ name: "T-40 | Jón", date: "23.10.2026", rooms: [{ name: "Eldhús", sheets: 4, units: 18 }, { name: "Fatask.", sheets: 2, units: 5 }], doors: 3, totalSheets: 8 });
  assert.match(svg, /VINNUTEIKNINGAR/); assert.match(svg, />Eldhús</); assert.match(svg, /bls\. 2–5/); assert.match(svg, /bls\. 6–7/); assert.match(svg, /Hurðalisti/); assert.match(svg, /bls\. 8/);
});

test("homeSheet: every room on one sheet with its name, no per-wall labels", () => {
  const geo = { walls: [{ id: "eldhus|W1", label: "Veggur 1", lenMm: 3000, n: { x: 0, z: 1 }, a: { x: 0, z: 0 }, b: { x: 3, z: 0 } }, { id: "rymi:1|W1", label: "Veggur 1", lenMm: 4000, n: { x: 0, z: 1 }, a: { x: 0, z: 3 }, b: { x: 4, z: 3 } }],
    openings: [], units: [], obstacles: [], labels: [{ x: 1.5, z: 1, text: "Eldhús", sub: "9,0 m²" }, { x: 2, z: 4, text: "Stofa" }] };
  const svg = globalThis.KPWD.homeSheet({ project: "T-40" }, geo, 2, 6);
  assert.match(svg, /ALLT HEIMILIÐ/); assert.match(svg, />Eldhús</); assert.match(svg, />Stofa</); assert.doesNotMatch(svg, /Veggur 1 · 3000/);
});

// 2026-10-26: Skápalisti — one row per Sk on the same A3 frame/title block, split over sheets when long
test("cabinetSheet: a row per Sk, title block, more sheets for a long list", () => {
  const W2 = globalThis.KPWD;
  const row = (i) => ({ sk: "Sk" + i, type: "Grunnskápur", product: "Grunnskápur 60sm", size: "600 × 800 × 600", front: "FR1", drawers: "M-M 174 / M-K 411 / M-E 215", doors: "", shelves: "", grip: "Comet", note: "" });
  const one = W2.cabinetSheets({ project: "T-32 | Prófun", date: "26.10.2026", notes: ["FR1 – Hvítt"] }, [row(1), row(2), { group: "Eldhús" }, row(3)], 5, 5);
  assert.equal(one.length, 1);
  assert.match(one[0], /SKÁPALISTI — T-32/);
  assert.match(one[0], />Sk2</);
  assert.match(one[0], />M-M 174 \/ M-K 411 \/ M-E 215</);
  assert.match(one[0], /Blað 5\/5/);
  assert.doesNotMatch(one[0], /font-size="[^"]*"[^>]*font-size=/); // one font-size per <text> (a duplicate breaks the PDF raster)
  const many = W2.cabinetSheets({ project: "T-1" }, Array.from({ length: 40 }, (_, i) => row(i + 1)), 2, 4);
  assert.equal(many.length, 3);
  assert.match(many[2], /\(3\/3\)/);
  assert.equal(W2.cabinetSheetCount(Array.from({ length: 40 }, (_, i) => row(i + 1))), 3);
});

test("Grunnmynd: Sk labels about twice the old size, notes in black", () => {
  const W2 = globalThis.KPWD;
  const geo = { walls: [{ id: "w1", label: "Veggur 1", lenMm: 3000, a: { x: 0, z: 0 }, b: { x: 3, z: 0 }, n: { x: 0, z: 1 } }, { id: "w2", label: "Veggur 2", lenMm: 3000, a: { x: 3, z: 0 }, b: { x: 3, z: 3 }, n: { x: -1, z: 0 } }],
    units: [{ zone: "floor", sk: "Sk1", poly: [{ x: 0, z: 0 }, { x: 0.6, z: 0 }, { x: 0.6, z: 0.6 }, { x: 0, z: 0.6 }] }] };
  const s = W2.overviewSheet({ project: "T-1", notes: ["FR1 – Hvítt"], planGeo: geo }, 1, 2);
  const m = s.match(/<text[^>]*font-size="([\d.]+)"[^>]*>SK1</);
  assert.ok(m && +m[1] >= 4, "SK label " + (m && m[1]));
  assert.match(s, /<text[^>]*fill="#1d1d1f"[^>]*>FR1 – Hvítt</);
});
