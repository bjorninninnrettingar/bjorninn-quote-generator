# Studio — Innihurðir as steps + Allt heimilið as a list (2026-10-26)

Built from docs/studio-review-2026-10-25.md section C (the "Tillaga" lines, recommended answers as decisions).

## Innihurðir — `step "hurdir"` (`screen-hurdir`)
- The Studio card (and the Innihurðir row on Allt heimilið) opens `openDoors()` → its own screen, not in the stepper.
  The old overlay `openDoorList()` is still in the code (unused by the customer path).
- **Overview** = the list: one card per door (picture, HU, gerð, B × H cm, lamir/rennur, rými, efni, −/+ fjöldi,
  Breyta / Afrita / Eyða), doors drawn in a room's walls read-only, a dashed "+ Hurð" card. Áfram → Spurningar
  (doors-only) or back to Allt heimilið. An empty list goes straight to a new door (also after a reload).
- **Per-door wizard** (`doorWiz = {d, i, phase}`, a draft copy — Til baka on page 1 drops it):
  Gerð (pictures, `DOOR_KINDS` + `DOOR_KIND_DESC`) → Mál (chips in cm: breidd 70/80/90/100, hæð 210/220/240,
  veggþykkt 10/12/15 + "Annað mál" in cm; **80 × 210 pre-picked**) → Opnun (two pictures: lamir vinstra/hægra or
  rennur til hægri/vinstri + the product's real options as chips, `doorOptsFor`) → Efni (Hvar er hurðin? = the
  project's drawn rooms + "Annað" → every Rými 🏡 choice; Fjöldi; efni hurðarblaðs: Ákveða síðar (pre-picked) /
  Spónlagt / Harðplast (Egger, with search)). Karmur without options skips Opnun.
- A new door copies the last door's kind, options, height, wall and leaf (not the room).
- Data unchanged: same `state.doorList` objects in mm, `DOOR_DEFAULT.widthMm` now 800. `doorListLines`, HU numbers,
  Smíðagögn, kp-submit shapes untouched. Product names only shown in PRO.
- Senda inn for doors only (or Allt heimilið) shows just "Það sem þú pantar", not an empty kitchen drawing.

## Allt heimilið — list (`renderHomeList`, `state.home.view !== "plan"`)
- Rows = the project's rooms (`homeRooms()`) + an Innihurðir row (`state.home.doors` or a non-empty door list).
  Each row: icon, editable name (`state.home.names[key]`), type · status, ✓ when done (units > 0; a plain room when
  drawn; doors when ≥ 1), "Byrja →"/"Halda áfram →" (fixed width), × remove (confirm when there's work in it).
- "+ Rými" → type cards (Eldhús / Fataskápur / Baðherbergi / Þvottahús / Innihurðir / Aðeins rými) + Nafn
  (pre-filled from the type, numbered "Fataskápur 2"; type pre-picked: Eldhús if none yet, else Fataskápur) →
  "Byrja →" opens that type's flow. Opens with the form already showing on an empty home.
- **Several of one type**: keys `fataskapar:2`, `bad:2` … (`hlNewKey`; `rymi:N` as before). Checked/fixed for
  ":N": `catBase()` helper (bath hung units, Þvottahús seeding, shape titles, page title), kitchen-planner-3d.js
  wardrobe checks (`/^fataskapar(:|$)/`). Rými 🏡: a name that matches a choice ("Hjónaherbergi" → "Hjónah.") is
  used; 2nd bathroom → "Baðh. 2". Sk numbers stay unique (B1 counter). Verified: two wardrobes with units → both ✓,
  both listed by name on Senda inn.
- Every room's flow returns to the list (`finishCategory`, plain rooms' `lockRoom`, shape "Til baka", Spurningar
  "Til baka"). One Spurningar + Senda inn for everything.
- **"Ég á teikningu" removed** from the customer path: the old intro only shows it with `window.__kpPlanImport`.
  The floor-plan drawing is reachable as "Teikna grunnmynd" (`state.home.view = "plan"`) only with
  `window.__kpHomePlan` set — kept for later.
- heimili/hurdir pages use the 1240 px width like the room pages (nav in the same spot).

## Not verified
- Door product options (lamir/þröskuldur/skrá chips) and `doorProductFor` → needs `/api` (static server here has
  none); the logic is the same as the overlay's.
- No real submission (never submit from tests). Line Items shape unchanged by construction; `npm test` passes.
