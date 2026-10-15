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
