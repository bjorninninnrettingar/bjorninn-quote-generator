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
- Pages: **Vélin** (Í stæðu / Undir borðplötu / Engin vél, `state.laundryMachine`) → Litur → Framhlið → Höldur → Borðplata (Egger, white pre-picked).
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
