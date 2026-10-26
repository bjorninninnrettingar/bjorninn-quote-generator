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
