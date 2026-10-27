// kitchen-planner-3d.js exposes everything via window.KP3D and reads location.search once at load — stub both
// before importing so the shared 3D/2D module (no THREE.js calls at the top level) loads under plain Node.
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.window = globalThis;
globalThis.location = globalThis.location || { search: "" };
await import("../kitchen-planner-3d.js");
const K = globalThis.KP3D;

// Shelf above a closet's drawer stack (2026-10-16): only the drawer's real hardware (its Blum-style side/runner,
// drawerBoxY's own "20 mm up, its nominal side height tall" placement) is a real obstruction — the front still
// closes over a shelf sitting inside the drawer stack's nominal/declared zone. Before this, shelfSpaceMm's floor
// was the declared zone sum PLUS a board thickness baked into .lo, and shelfOk/railOk in kitchen-planner.html add
// another board thickness on top of that — double-margining a closet shelf 32 mm above the drawer zone instead
// of 16 (the same single margin burTopMm's branch already gets). A real T-80 Sigurjón-style unit (3 Merivo "K"
// drawers summing to a declared 846 mm zone) showed this directly: the floor landed at 879, exactly where the
// existing fixed shelf sat, pinned at the limit — a shelf typed at 840 (physically fine: still above the top
// drawer's own hardware, just inside the declared zone the front alone fills) was rejected.
test("shelfSpaceMm (closet shelf above a drawer stack): floor is the top drawer's real hardware, one board margin — not the declared zone sum, twice", () => {
  const b = { type: "harskapur", drawerZoneMm: 846, interior: { mode: "skuffur", codes: ["K", "K", "K"] } };
  const bodyMm = 2385 - 100;
  const r = K.shelfSpaceMm(b, bodyMm, "merivo");
  // top drawer (K, merivo side 129 mm) sits in [564, 846]; its box top = min(564+20+129, 846-10) = 713
  assert.equal(r.lo, 713);
  const OVEN_BOARD_MM = 16; // shelfOk/railOk's own downstream margin (unit under test doesn't duplicate it any more)
  assert.ok(840 > r.lo + OVEN_BOARD_MM, "840 mm now clears the real drawer hardware");
  assert.ok(879 > r.lo + OVEN_BOARD_MM, "the shelf already sitting at 879 is still valid (no regression)");
});

test("drawerBoxTopMm: a drawer's physical box never sticks out above its own slot (10 mm clear of the top)", () => {
  // a single very short "N" drawer (150 mm slot, 63 mm nominal side) — 20+63=83 fits well inside 150-10=140
  const short = K.drawerBoxTopMm({ interior: { mode: "skuffur", codes: ["N"] } }, 150, "merivo");
  assert.equal(short, 83);
  // a slot only as tall as its own minimum (N: 88 mm) is too short for its 63 mm side + the usual 20 mm runner
  // gap (83 mm) — the box top clamps to 10 mm below the slot's own top instead of sticking out of it
  const tight = K.drawerBoxTopMm({ interior: { mode: "skuffur", codes: ["N"] } }, 88, "merivo");
  assert.equal(tight, 78);
});

// Free-form innskúffur (2026-10-16): any tall closet with a door and no drawer stack of its own can get inner
// drawers now, not just a registered Búrskápur combo — same positioning convention (60 up, 35 apart) so the two
// features feel the same, but b.innerCodes/b.innerPos carry no product/V2 validation behind them.
test("innerDrawersOf: defaults from the bottom (60 mm, 35 mm apart), custom positions once Smíða sets them", () => {
  const def = K.innerDrawersOf({ innerCodes: ["K", "M"] }, "merivo");
  assert.deepEqual(def.map((d) => d.mm), [60, 60 + (129 + 20) + 35]);
  assert.deepEqual(def.map((d) => d.code), ["K", "M"]);
  const custom = K.innerDrawersOf({ innerCodes: ["K", "M"], innerPos: [100, 400] }, "merivo");
  assert.deepEqual(custom.map((d) => d.mm), [100, 400]);
  assert.deepEqual(K.innerDrawersOf({}, "merivo"), []); // no innerCodes at all — same as a plain tall closet
});

test("shelfSpaceMm: shelves above free-form innskúffur start above them, same as above a búrskápur's own", () => {
  const withInner = K.shelfSpaceMm({ type: "harskapurOpinn", innerCodes: ["K"] }, 2000, "merivo");
  const bare = K.shelfSpaceMm({ type: "harskapurOpinn" }, 2000, "merivo");
  assert.ok(withInner.lo > bare.lo);
  assert.equal(withInner.lo, K.innerTopMm({ innerCodes: ["K"] }, "merivo"));
});

// Room doors (2026-10-23): a door's inward swing vs. floor cabinets. Square 4 m room; wall 1 starts at (4,0) and runs
// +z with the room at −x. A door at 100 mm on wall 1 hinged on the left (= its start, by the corner with wall 0)
// sweeps x 3.2–4, z 0.1–0.9 — exactly where the last cabinet on wall 0 (x 3.4–4, z 0–0.6) stands.
test("roomDoorConflicts: inward swing hits the corner cabinet; outward, sliding or a cabinet further along doesn't", () => {
  const room = (door) => ({ closed: true, roomHeightMm: 2600,
    walls: [0, 1, 2, 3].map((i) => ({ id: "w" + i, label: "Veggur " + (i + 1), lengthMm: 4000, turnAfter: "left", floor: [], wall: [] })),
    doors: [Object.assign({ id: "d1", wallId: "w1", offsetMm: 100, widthMm: 800, heightMm: 2100 }, door)] });
  const st = (door) => { const s = room(door); s.walls[0].floor.push({ id: "c1", type: "grunnskapur", widthMm: 600, gapMm: 3400 }); return s; };
  const hit = K.roomDoorConflicts(st({}));
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].ids, ["c1"]);
  assert.ok(K.fitWarnings(st({})).some((w) => /Hurðin á vegg 2 rekst á grunnskápur/.test(w.msg)));
  assert.equal(K.roomDoorConflicts(st({ swing: "out" })).length, 0);
  assert.equal(K.roomDoorConflicts(st({ swing: "slide" })).length, 0); // parks at z 0.9–1.7 on wall 1: nothing there
  const sl = room({ swing: "slide", offsetMm: 1000 }); sl.walls[1].floor.push({ id: "c2", type: "grunnskapur", widthMm: 600, gapMm: 1900 }); // wall 1 run 1.9–2.5 m (wall 0 is empty → no corner clearance)
  assert.deepEqual(K.roomDoorConflicts(sl).map((c) => [c.slide, c.ids[0]]), [[true, "c2"]]);
  assert.equal(K.roomDoorConflicts(Object.assign(sl, { doors: [Object.assign(sl.doors[0], { hinge: "right" })] })).length, 0); // slides the other way instead
  const far = room({}); far.walls[0].floor.push({ id: "c1", type: "grunnskapur", widthMm: 600, gapMm: 2000 });
  assert.equal(K.roomDoorConflicts(far).length, 0);
  const sw = K.doorSweep(room({ hinge: "right" }), room({ hinge: "right" }).doors[0]); // right hinge = the door's far end, swinging back along −axis
  assert.deepEqual([+sw.h.x.toFixed(3), +sw.h.z.toFixed(3), sw.u.z, sw.v.x], [4, 0.9, -1, -1]);
});

// Skáveggir (2026-10-23): any corner angle. A room without angleDeg/dirDeg must come out exactly as before.
test("wallGeometry3D: 90° rooms unchanged, a 45° turn + dirDeg turn the next wall by exactly that", () => {
  const rect = K.wallGeometry3D([{ lengthMm: 4000, turnAfter: "left" }, { lengthMm: 3000, turnAfter: "left" }]);
  assert.deepEqual(rect[1].axis, { x: -0, z: 1 });
  assert.deepEqual(rect[1].origin, { x: 4, z: 0 });
  const g = K.wallGeometry3D([{ lengthMm: 2000, turnAfter: "left", angleDeg: 45, dirDeg: 90 }, { lengthMm: 1000, turnAfter: "left" }]);
  assert.ok(Math.abs(g[0].axis.x) < 1e-9 && Math.abs(g[0].axis.z - 1) < 1e-9, "dirDeg 90 = wall 1 runs along +z");
  assert.ok(Math.abs(g[1].axis.x + Math.SQRT1_2) < 1e-9 && Math.abs(g[1].axis.z - Math.SQRT1_2) < 1e-9, "then 45° to the left");
  assert.ok(Math.abs(g[0].extEndM - 0.08 * Math.tan(Math.PI / 8)) < 1e-9, "the outer corner fill follows the angle");
});
test("cornerClearanceMm: 90° = the previous cabinet's depth; 45° (a skáhorn) and 135° from the box geometry", () => {
  const walls = (deg) => {
    const w = [{ lengthMm: 4000, turnAfter: "left", floor: [{ type: "grunnskapur", widthMm: 600, depthMm: 600 }], wall: [] },
               { lengthMm: 3000, turnAfter: "left", floor: [{ type: "grunnskapur", widthMm: 600, depthMm: 600 }], wall: [] }];
    if (deg !== 90) w[0].angleDeg = deg;
    return w;
  };
  assert.equal(K.cornerClearanceMm(walls(90), 1, "floor"), 600);
  assert.equal(K.cornerClearanceMm(walls(45), 1, "floor"), 430);  // 600·sin45 = 424 → next 10 mm
  assert.equal(K.cornerClearanceMm(walls(135), 1, "floor"), 1450); // (600 + 600·cos45) / sin45 = 1448.5
});

// Upright pulls on tall doors (2026-10-25): sized by the door's height, capped at 50 cm — the order picks its SKU
// with the same KP3D.tallHandleAvailMm, so what the customer sees is what gets ordered.
test("tallHandleAvailMm: a tall door's pull is the longest real length up to 500 mm", async () => {
  await import("../kitchen-planner-models.js");
  const H = globalThis.KPMODELS.handles;
  const longest = (cfg, avail) => Math.max(...cfg.lenOptions.map((o) => o.mm).filter((mm) => mm <= avail));
  assert.equal(K.tallHandleAvailMm(H.angle, 2300), 500);
  assert.equal(longest(H.angle, K.tallHandleAvailMm(H.angle, 2300)), 500);
  assert.equal(longest(H.sense, K.tallHandleAvailMm(H.sense, 2300)), 490);
  assert.equal(longest(H.vann, K.tallHandleAvailMm(H.vann, 2300)), 350);
  assert.ok(K.tallHandleAvailMm(H.angle, 600) < 500, "a short door still gets a shorter pull");
});

// Smíða (2026-10-26): dragging one seam of a grunnskápur's drawer stack only moves that front, so the stack can come
// up short of the carcass. The space it must fill used to follow the drawn sum for every cabinet, so proIssues'
// "Skúffuhæðir eru samtals … þurfa að fylla …" could never fire for a base unit — the gap went to Keyra skipulag/CNC.
test("drawerStackSpaceMm: a base unit's stack must fill the whole carcass; a tall unit's follows its drawn fronts", () => {
  assert.equal(K.drawerStackSpaceMm("base", 800, 731), 800, "a dragged-short base stack still has to fill 800");
  assert.equal(K.drawerStackSpaceMm("base", 800, 900), 800);
  assert.equal(K.drawerStackSpaceMm("tall", 2300, 846), 846, "tall: the door above takes the rest");
  assert.equal(K.drawerStackSpaceMm("tall", 2300, 2290), 2300 - K.DRAWER_TOPDOOR_MIN_MM, "tall: the door keeps its minimum");
  // an old draft (fronts stored with the 3 mm gaps between them) is still turned into slots that fill a base unit
  const slots = K.stackFrontsMm({ frontsMm: [212, 407.6, 174.4] }, ["E", "K", "M"], K.drawerStackSpaceMm("base", 800, 794));
  assert.equal(Math.round(slots.reduce((a, h) => a + h, 0)), 800);
});

// Smíðagögn `hinge` (2026-10-26): every door cabinet carries it so /cnc never drills "both sides, to be safe".
test("smidaHingeSide: two leaves = both sides, one door = its swing (wall, base, tall, corner, fridge)", () => {
  const C = K.CATALOG;
  assert.equal(K.smidaHingeSide({ type: "efriskapur", widthMm: 1200 }, C.efriskapur), "baedi"); // T-32 Sk6
  assert.equal(K.smidaHingeSide({ type: "grunnskapur", widthMm: 900 }, C.grunnskapur), "baedi");
  assert.equal(K.smidaHingeSide({ type: "efriskapur", widthMm: 600, swing: "haegri" }, C.efriskapur), "haegri");
  assert.equal(K.smidaHingeSide({ type: "grunnskapur", widthMm: 500 }, C.grunnskapur), "vinstri");
  assert.equal(K.smidaHingeSide({ type: "hornskapur", widthMm: 1200, swing: "haegri" }, C.hornskapur), "haegri"); // one corner door
  const fridge = Object.keys(C).find((k) => C[k].fridge);
  assert.equal(K.smidaHingeSide({ type: fridge, widthMm: 700 }, C[fridge]), "vinstri"); // a fridge's doors hang on one side
});

// G6 + G7 (PRO, 2026-10-27): gaps under 300 mm along a floor run, and two sinks in one room, are hints in PRO only.
test("fitWarnings pro: small gaps want an áfella; a door in the gap or a wide gap doesn't; two sinks are flagged", () => {
  const room = (floor, extra = {}) => Object.assign({ closed: false, roomHeightMm: 2600,
    walls: [{ id: "w0", label: "Veggur 1", lengthMm: 4000, turnAfter: null, floor, wall: [] }] }, extra);
  const b = (id, gapMm, type = "grunnskapur") => ({ id, sk: id, type, widthMm: 600, gapMm });
  let w = K.fitWarnings(room([b("Sk1", 200), b("Sk2", 0), b("Sk3", 150), b("Sk4", 900)]), { pro: true }).map((x) => x.msg);
  assert.ok(w.some((m) => /Bil 150 mm milli Sk2 og Sk3/.test(m)), w.join(" | "));
  assert.ok(!w.some((m) => /Sk3 og Sk4/.test(m))); // 900 mm: room for a cabinet, not an áfella
  assert.ok(!w.some((m) => /frá Sk1 að vegg/.test(m))); // a lone wall's end has no wall face to fill against
  const closed = { closed: true, roomHeightMm: 2600, walls: [0, 1, 2, 3].map((i) => ({ id: "w" + i, label: "Veggur " + (i + 1), lengthMm: 4000, turnAfter: "left", floor: i ? [] : [b("Sk1", 120)], wall: [] })) };
  w = K.fitWarnings(closed, { pro: true }).map((x) => x.msg);
  assert.ok(w.some((m) => /Bil 101 mm frá Sk1 að vegg á vegg 1/.test(m)), w.join(" | ")); // 120 − the 19 mm áfella already kept free
  assert.equal(K.fitWarnings(room([b("Sk1", 0), b("Sk2", 150)])).length, 0); // customers: unchanged
  w = K.fitWarnings(room([b("Sk1", 0), b("Sk2", 150)], { doors: [{ id: "d", wallId: "w0", offsetMm: 610, widthMm: 100, heightMm: 2100 }] }), { pro: true }).map((x) => x.msg);
  assert.ok(!w.some((m) => /Bil/.test(m)), w.join(" | "));
  w = K.fitWarnings(room([b("Sk1", 0, "vaskaskapur"), b("Sk2", 0), b("Sk3", 0, "vaskaskapur")]), { pro: true }).map((x) => x.msg);
  assert.ok(w.some((m) => /2 vaskaskápar í rýminu \(Sk1, Sk3\)/.test(m)), w.join(" | "));
});
