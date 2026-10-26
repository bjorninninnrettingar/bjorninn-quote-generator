# BJÖRNINN STUDIO — Baðherbergi + Þvottahús (2026-10-26)

Built from [studio-review-2026-10-25.md](studio-review-2026-10-25.md) section C, every "Spurningar" item = the bold
recommended answer. Same pattern as Fataskápar: flags on the `CATEGORIES` entry + a page list (`matPhases`), no
scattered `=== "bad"` checks.

## Category flags (CATEGORIES in kitchen-planner.html)
| Flag | Used by | Meaning |
|---|---|---|
| `matPhases` | `activeMatPhases()` | `MAT_PHASES_BAD` / `MAT_PHASES_THVOTTAHUS` (built with `phaseLike(key, over)` from the kitchen's `MAT_PHASES`) |
| `defaults` | `roomDefaults()` (lockRoom + every renderMaterials) | the usual picks, set only where empty: carcass `dokkgra`, drawerSystem `legra`, top (`engin` for Bað, `eg_W1000` for Þvottahús), `laundryMachine:"staeda"` |
| `topGroups` | `topGroupsNow()` → top tabs + the editor's Efni dropdown | `["hardplast"]` = Egger only, no stone/compact/límtré; a top outside the list (stone from an old draft) is reset to the default |
| `noTopLabel` | renderTopCards | Bað: "Engin — handlaug ofan á" instead of "Engin borðplata" |
| `defaultShape` | renderShapeStep | `rect` pre-picked on the shape page |
| `waterTitle` / `waterHint` | water page | Þvottahús: "Hvar eru vatn og niðurfall?"; hints name the right units |

A room with `defaults` always opens Efni on page 1 (`lockRoom`), so a laundry that inherited fronts from the kitchen
still sees "Hvar er vélin?".

## Bað
- Pages: Litur → Framhlið → Höldur → **Toppur og spegill** (drawer brand defaulted, no page).
- Mirror cabinet = a note only: Nei/Já cards on the top page (`state.bathMirror`, a ROOM field); Já adds
  "Spegilskápur óskast yfir vaskinn…" to the sink's Line Item "Skilaboð til skipulags".
- **Hæð frá gólfi** (never "Sökkull"): the gap is still the wall's `plinthMm` (all hung units on a wall line up).
  `setHungGap(wall, mm)` moves it and keeps each box's own height (`heightMm = box + gap`). Shown as cm chips
  15/20/25/30 in the "+ Ný eining" Hæð group (with "Hæð skáps" chips 40–70, tall 160–200) and in the edit panel.
  `isHungUnit(c)` = hungUnits room + floor zone + not panel/appliance (tall units hang too).
- Tall cabinet (`BAD_TREE` "Hár skápur", optional): harskapur, 160 cm box hung at the gap, 35 cm deep.

## Þvottahús
- (Superseded 2026-10-26 — see "Þvottahús as its own room" at the end.) Pages were: **Vélin** (Í stæðu / Undir borðplötu / Engin vél, `state.laundryMachine`) → Litur → Framhlið → Höldur → Borðplata (Egger, white pre-picked).
- `placeLaundryMachine(wall, sink)` (from seedSink): stack = `thvottavel`; under worktop = two `thvottavelFri`
  side by side; next to the sink where there's free room. Blocks carry `autoMachine:true`; changing the page's answer
  later (`reseedLaundryMachine`) swaps only those (never a hand-placed or locked one).
- Tree gained the kitchen's corner units (Töfrahorn, Hillur) and Úthliðar (no island back).

## Also
- Water position typed in **cm** (all rooms). Page titles "Hannaðu baðherbergið/þvottahúsið þitt"; the tour's first
  bubble says "rýmið" outside the kitchen.

## Not done / known
- The materials 3D preview is still the kitchen's floor-standing base cabinet in Bað (not a hung vanity).
- The tour's "Smelltu á grunnskáp" bubble still talks about base units in Bað/Þvottahús.
- Mirror cabinet is a note on the sink line only — a bathroom without a vaskaskápur loses it.
- Edit panel still says "Mál (mm)" above the cm chips (kitchen-wide mm, not changed here).

## QA round 2 (2026-10-26, studio-qa report)
- B1/Þ1: `roomSize` flag → `fitRoomSize()` in applyShapeTemplate (rect exact 250×200 / 250×180 cm, other shapes scaled
  down whole). The size page (wall list, the dim pop-up, wall labels on the drawing) is in **cm for every room** now.
- B3/Þ3: Bað/Þvottahús default `drawerSystem:"merivo"` (the "Vinsælast" one).
- Þ4: `goto()` gives back `activeCategory` (the last room in the queue) when going from Spurningar/Senda inn to
  Rými/Efni/Skipulag — finishCategory had cleared the name, so Efni showed the kitchen's pages.
- E2/B2/Þ2/F5: `MAT_NEED` — a grey Áfram gets "Veldu … til að halda áfram." left of the buttons (they don't move).
  Fronts/handles are still never pre-picked (taste).
- E1: kitchen `defaultShape:"rect"`. E8: "Rýmið er tilbúið" toast once per room per visit (`roomReadyToasted`).
- E10: CATALOG labels "Hár skápur" / "Efri skápur" (menu names); `airtableLabel` keeps "Hárskápur"/"Efriskápur" as
  the width variants' Skápategund. Bað menu "Neðri skápur" → "Grunnskápur".
- E9: Lofthæð page: Vegglitur above Gólf, floor tiles 46 px high, the "Valfrjálst" line moved to a tooltip, tighter
  margins — no inner scroll at 1440×900 or 1280×800.
- E7: Ofanmynd — dimension text turned along its line on the outer side, wall names 58 px out (beyond the chain) and
  turned along the wall (`planTextAng`, side walls read bottom-up).

## Baðherbergi as its own room (2026-10-26, user "allt já" on the coordinator's 17-item scan)
Fataskápar is the model. Laundry's flow is untouched; shared code (wizard framing, step-1 preview) improves every room.
- **Rými (5 pages → 3):** `SHAPE_TEMPLATES` `bathWall` / `bathCorner` (group `"bath"`, `closetWalls` = the unit walls, the
  rest open). `bathShape()` / `unitWallShape()`; `closetDims` / `setClosetDim` serve both. Pick page: "Hvar á innréttingin
  að vera?" (Einn veggur pre-picked) → `applyShapeTemplate` puts the water mid-wall 1 and opens **"Veggurinn og vatnið"**
  (`shapePhase "water"`: `renderBathSize` cm fields — wall(s) + Lofthæð — above the droplet; the drawing shows the unit
  walls' sizes, no wall arrows/number circles, no "Fjarlægja vatn") → Gluggar og hurðir (only the solid walls = the unit
  wall(s)) → `lockRoom`. A saved bath opening on "size"/"height" lands on "water". PRO keeps the old shapes.
- **Efni** (`MAT_PHASES_BAD`): Litur → Framhlið → Höldur → **Toppur og vaskur** (mirror cards + Egger tops, "Enginn toppur")
  → Skúffur. `defaults` now pre-pick `look:"eg_H1180"` (Natural Halifax Oak), `handle:"jey"`, `top:"eg_W1000"` (harðplast
  with the handlaug on it). Egger names left in English (no Icelandic names to hand). Preview = `renderBathPreview`: an
  80 cm vaskaskápur hung at the wall's gap via buildScene (`hungUnits`, wall `plinthMm`), the mirror cabinet when picked,
  `previewFloor()` adds a floor + wall so the gap reads; see-through fronts on Litur.
- **3D** (kitchen-planner-3d.js): `meta.basin` (sink + hungUnits) → `addBasin` — white oval vessel basin + a ~25 cm
  straight mixer; the top gets no cut-out; with "Enginn toppur" it sits on the cabinet. `addMirrorCabinet` over each sink
  when `state.bathMirror` (70 cm high, 15 deep, mirror doors) unless a wall unit already hangs there — still only a note on
  the order. Wall bubbles: bath uses the wardrobe rule (none on one wall, "Veggur 1/2" in a corner). Camera: a bath starts
  facing its unit wall(s) at 1.3 m (`bathAim`). Props: `sturta` 90×90, `badkar` 170×70 (`DECOR_BATH`, never ordered, no
  toilet); `bathPropSpot` puts them back-to-wall in the biggest free stretch next to the units (else the usual spot).
- **Ný eining:** BAD_TREE Vaskaskápur / Grunnskápur have one option each → straight to the sections: Breidd (vaskaskápur
  60/80/100/120, grunnskápur 30/40/60/80) → Hæð (box + Hæð frá gólfi, a gap pick advances) → **Skúffur eða hurðir**
  (`bathFrontsHtml` picture cards, `data-hw`) → Innvols (hidden when empty, e.g. a sink with doors). No Dýpt for customers.
  Preview hangs the unit (`pv.hungUnits` + wall `plinthMm`) over a floor; framing counts the tap (`extraTop`) and gives
  low units more room (all rooms). Step 1 shows the first type straight away (`uw.hoverCat = 0`, all rooms).
- **Skipulag panel (customer):** `#floatBar.cl-sel` (Afrita / Eyða) for bath units; `bathPanelHead` "◀ Vaskaskápur 1 af 3 ▶"
  (`bathUnitOrder`), no Læsa, no ◀ ▶ / Fjarlægja row, no "Veggur 1 · neðri skápur".
- Not done: the Senda inn summary still says "Borðplata" for the bath top; the tour's "Smelltu á grunnskáp" bubble.

### Round 2 (2026-10-26, coordinator's live walk)
- Senda inn picture (`captureThumb`): rebuilt once with `freshCamera` + `clean`, nothing selected — never the orbited angle or a tint.
- Selection = blue front outline (`selHullSvg`) instead of lilac fronts in every customer room (`outlineSel`; PRO keeps the tint).
- Bath vanities start with drawers everywhere (`newBlock`): 2 under a basin (`sinkDefaultStack`, fronts split from the box,
  room for the trap), 3 in other base units.
- Bath + wardrobe orbit: azimuth limited to the front of the unit wall(s) (±75°, ±43° in a corner), `rotateSpeed` 0.45;
  clicking "3D" while in 3D reframes to the default view (all rooms). The bath camera frames the units (+ margin), not the whole wall.
- Wizard width line sits above the tap (`extraTop`). Senda inn: "Toppur: … · Handlaug ofan á" + "Spegilskápur: Já/Nei".
- Gluggar og hurðir drawing: no "← Veggur 4 (opinn)" nav to open edges in a bath/wardrobe. Höldur page always opens on "Allt".
- Úthliðar in the bath (user decision, item 4): no "Það vantar úthliðar" question (`checkEndPanelsThen` goes straight on when
  `bathAutoPanels()`). `syncBathPanels()` (refreshAfterEdit + seedSink) takes every `autoPanel` off and puts back what
  `missingEndPanels()` still wants (ids `ap_<unit>L/R`); units beyond keep their place unless the panel was flush on both
  sides (then the two units close up — a new unit lands next to the vanity, not two panels away). A bath panel is the box
  height (`carcassHeightMm`) and hangs at the wall's gap in 3D (`hungPanel`) and in the PDF sheets. Hand-added panels are
  never touched. Kitchen keeps its prompt; PRO bath too.

## Þvottahús as its own room (2026-10-26, user approved the coordinator's 8-item scan)
Baðherbergi is the model. `isLaundry()` / `isWallRoom()` (= Bað or Þvottahús); `bathShape()` now answers for both, so the
bath's Rými pages, drawing, sizes, openings-on-the-unit-wall and Efni back-button work for the laundry too. PRO keeps its
own one-page Rýmið (laundry PRO shapes = Einn veggur / Horn + the closed shapes, `proRoomShapes`) and the old tree.
- **Rými** (5 pages → 4): "Hvar á innréttingin að vera?" (Einn veggur / Horn, `bathWall` / `bathCorner`) → **"Hvar er
  vélin?"** (`shapePhase "machine"`, moved from Efni: cards in `#shapeMachine`, 3D on the left = `renderMachinePreview`:
  the stack in a tall unit with see-through doors, two machines under the worktop, or a sink + base unit; uses the height
  page's `heightScene` flag so leaving tears it down) → "Veggurinn og vatnið" (cm fields + droplet, preset mid-wall 1, +
  **Niðurfall í gólfinu?** Já / Nei / Veit ekki = `state.laundryDrain`, a ROOM field → "Niðurfall í gólfi: já/nei" on
  the sink's Line Item) → Gluggar og hurðir (unit wall only) → Efni.
- **Efni** (`MAT_PHASES_THVOTTAHUS`): Litur → Framhlið → Höldur → Borðplata → Skúffur, all pre-picked (defaults now add
  `look:"hvitt"`, `handle:"jey"`). `categoryDef.inherit` (`["look","handle","handleColor"]`): a laundry after a kitchen still
  takes the kitchen's fronts/handles ("Sömu efni og í …") even though it has its own default.
- **Nothing placed without water** (all customer rooms with water, not PRO): `seedSink` falls back to `sinkFallbackWall()` —
  the unit wall (Bað/Þvottahús), else the longest solid wall — mid-wall. Kitchen used to get an empty Skipulag.
  `placeLaundryMachine`: flush to the sink (0 gap — the auto úthliðar go in by themselves); when the machines don't fit
  beside a centred sink and the sink is alone on the wall, the sink slides along so they do (250 cm wall + two machines).
  `reseedLaundryMachine` also lifts our úthliðar first and re-syncs them.
- **3D**: `addTowerMachines` draws the washer + dryer inside every Þvottavélaskápur (above its drawer); `opts.towerGlass`
  (Ný eining preview + "Hvar er vélin?") gives the tower's doors a see-through clone of the front material. Camera faces
  the unit wall like the bath (`laundryAim`, further back + higher for the 2,5 m tower, customer only); wall bubbles use
  the wardrobe rule (PRO laundry keeps V-bubbles). Props: **Þvottakarfa**, **Straubretti** (`DECOR_LAUNDRY`, never ordered).
- **Ný eining** (`THVOTT_TREE`, one option each): Vélarstæða · Vélar undir borðplötu (`opt.pair` → washer + dryer side
  by side, preview shows both; one only when there's room for one, with a toast) · Vaskaskápur · Grunnskápur · Hár skápur ·
  Efri skápur (3 options). Base units get Breidd → Hæð → **Skúffur eða hurðir** → Innvols (no Dýpt, `bathFrontsWiz`); a
  freestanding machine has no sizes, just "Pláss fyrir þína … — vélarnar sjálfar eru ekki í pöntuninni." PRO: `THVOTT_TREE_PRO`.
- **Skipulag**: automatic úthliðar on visible sides (`bathAutoPanels`), simplified float bar (Afrita / Eyða) + "◀ Vaskaskápur
  1 af 3 ▶" panel head (`bathUnitOrder` skips our auto úthliðar now — the bath said "1 af 6" too). Blue outline selection
  and the Senda inn picture from the default view were already every customer room's. Senda inn: "Vélin: Í stæðu".
- Verified 1440×900 + 1280×720 on a static server: each machine option, Einn veggur + Horn, water preset and water
  removed from the draft (fallback), Senda inn with `fetch` stubbed (payload has the drain note); kitchen without water
  (sink on the 560 cm wall) and the bath flow unchanged. PRO not opened (needs the API) — its paths are all `!PRO`-gated.
- Not done: the laundry's materials preview is still the kitchen's base cabinet; the tower's bottom drawer front is
  see-through in the previews too (nothing behind it).

### Þvottahús round 2 (2026-10-26, coordinator's live walk)
- Skipulag camera (`laundryAim`): frames the whole unit wall floor to ceiling with a margin — distance from the room
  height + wall length against the view's real aspect (the tower's top was clipped). Checked by projecting the ceiling /
  floor corners: inside the canvas at 1440×900 and 1280×720.
- Tips: `hideToast()` hides for real (visibility + text cleared, not just opacity 0) and `goto()` to Spurningar / Senda
  inn / Takk always drops a tip from another step ("Efnin eru valin …" was seen on Senda inn). Shared by every room and
  Allt heimilið (they all go through `goto`).
- Laundry sinks get a ~20 cm utility tap (`meta.utilityTap` → `addSink(…, utility)`) instead of the kitchen's 32 cm
  gooseneck; the Ný eining preview passes the room so its sink matches.

### Þvottahús round 3 (2026-10-26, user "allt já" on 11 items + Allt rýmið)
- **Skipulag = the picked layout** (`seedLaundry`, from seedSink for a customer laundry): left → right the 60 cm sink at the
  water, then the machine(s) (Engin vél: a 60 cm drawer unit, as on its preview); drawer base units (`laundryBase`,
  `laundryFill`) fill the rest of the wall; efri skápar over every worktop-height unit for Undir borðplötu / Engin vél
  (`laundryWallUnits`). **Horn**: sink + cabinets on the water wall, which stops 62 cm short of the corner (the corner square
  stays free — the other wall's units stand in front of it, no "opnast ekki" warning); the machines on the other wall —
  two under the worktop at the corner, the tall tower at the far end. Everything seeded is `autoSeed`: a later change on
  "Hvar er vélin?" lays it all out again while nothing was moved or locked (`laundryUntouched`).
- **Washer tower as built** (`addWasherTower` in 3D, Útfærsla "Skúffa undir vélinni + skápur ofan við"): drawer box on the
  plinth, an open 176 cm niche (carcass sides + back) with the washer + dryer, a cabinet with one door above (≥ 20 cm, else
  a top board). Every view — Skipulag, Ný eining, "Hvar er vélin?", Efni — shows the machines; b.thvo "hurdir" keeps doors.
- **Efni**: laundry default front is Alpine White (`eg_W1100`, Einlitt — the old `hvitt` was hidden, so no tab showed the
  pick); the preview is the laundry itself (`renderMachinePreview(host, true)`, see-through fronts on Litur); "Snúa: á"
  pill hidden (dragging turns); the last page's button says "Áfram →" like every page (title = "Áfram í skipulag →").
- **Spurningar**: a laundry on its own gets `LAUNDRY_BUDGETS` (Undir 300 þús. … Yfir 1 m.kr.).
- **Allt rýmið** (Þvottahús, Baðherbergi, Fataskápar): a third/fourth card on "Hvar á innréttingin að vera?" / "Hvar fer
  fataskápurinn?" → `rect`, the kitchen's room pages (Stærð → Lofthæð → Gluggar → Vatn; laundry asks "Hvar er vélin?"
  first). Defaults: laundry seeded on the water wall (or the longest), bath vanity at the water, a wardrobe room offers
  "Fylla vegginn" on the longest wall without a door (`closetWallIdx`), 360 × 300 cm bedroom. The camera orbits freely
  there (unit-wall orbit limit only for bath*/closet* shapes). Einn veggur / Beinn veggur stays pre-picked.
- Verified 1440×900 (+ cards at 1280×720): all three machines × Einn veggur / Horn, Allt rýmið for all three rooms,
  bath + wardrobe end to end, relayout on a changed machine, Spurningar brackets, Senda inn picture centred.
