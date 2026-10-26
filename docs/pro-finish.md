# PRO mode — "finish it" round (2026-10-26)

Goal (owner): Rakel can finish a project A–Z in PRO; nothing skippable or missable; where something can't be simple,
an explanation sits right next to it. Tested locally on T-32 (`recjvDRC6ooWfJQNz`, read-only: a local node server
with every non-GET `/api/*` call blocked, so nothing was ever written to Airtable).

## 1. Smíða box editor (review pages 2–5)

Walked: door openings + hinge markers (Sk2 Hárskápur, Sk10 oven tower), drawer stacks + seam drag (Sk7), oven
settings (Sk10/Sk11), shelves + split fronts (Sk2 split into 2).

- **Real bug — a base unit's drawer stack never had to fill the cabinet.** `drawerBodyMm` returned the drawn sum of
  the fronts for every cabinet with typed/dragged heights, so `proIssues`' "Skúffuhæðir eru samtals … þurfa að fylla …"
  could never fire for a grunnskápur, and dragging one seam (only that front moves, by design since 2026-10-19) left a
  silent gap that would go to Keyra skipulag / CNC. Now `KP3D.drawerStackSpaceMm(cls, full, sum)`: base units fill the
  whole carcass, only a tall unit's stack follows its fronts (door above keeps ≥150 mm). Side effect, intended: old drafts
  that stored fronts with 3 mm gaps (e.g. T-32 Sk1/Sk7, 794 in an 800 body) are converted to slots again, so Smíðagögn
  sends 215/411/174 (= 800) instead of 212/408/174. Test in `tests/kitchen-planner-3d.test.js`.
- ⛔ issues now sit at the **top** of the Smíða panel (were under the last section, below the fold on a tall unit); the
  ready button says it opens when they're fixed.
- Collapsed sections say what's in them: "▸ Hurð — 2400 mm · 5 lamir", "▸ Hillur · 5 (1 föst)", "▸ Skúffur · M / K / E",
  "▸ Ofn · 60 cm, 653 mm undir", "▸ Innskúffur · engar" (`peSectionSummary`, read off the section's own controls).
- Drawing: the door label moves off shelf / inner-drawer labels (it sat on the middle shelf of a 5-shelf tall unit) and
  shrinks/shortens on a narrow cabinet ("Hurð fyrir ofan ofn · 1152" ran over the hinge markers on a 600 mm tower).
- Explanations next to the controls: each hinged door section now says ↓ = from the bottom, ↑ = from the top (80 mm
  default, rest evenly spaced, same as /cnc, drag the blue dots); Hillur explains solid/dashed lines and "laus ×3"
  (holes for 3 positions, 50 mm apart); Skúffur says only the dragged drawer changes and the stack must fill the cabinet,
  and what the red dots are.
- Rows wrap instead of squeezing words ("Hilla\n1:", a horizontal scrollbar in the oven's shelf rows); card a bit wider.
- Seen, left as is: splitting a 2400 tall unit 1200/1200 puts the default bottom-door hinge on the middle shelf's holes —
  it is flagged ⛔ at the top with the fix ("færðu lömina eða hilluna"), not auto-moved.

## 2. Yfirferð — the gate before Vista

The bar's "Vista í Airtable" + "Keyra skipulag" became one **Vista** button with a progress badge (`2/6`, `✓` when all
green). It opens the Yfirferð panel (`#proCheck`, `proCheckItems` / `proCheckRender`, refreshed 0.5 s after each save):

1. Rýmið mælt á staðnum — `state.measurement.at` (Mæling → "Mæling lokið"). → opens Mæling.
2. Efni og höldur valin — every room's material pages (`activeMatPhases().done()`), per room when there are several.
   → that room's first missing material page.
3. Hver eining tengd vöru — every Line Item (cabinets, room doors, Innihurðir) has a V1. A unit no standard product
   fits gets its Útfærsla in Airtable, so Rakel ticks "Útfærsla valin í Airtable" per Sk (kept in `state.proAck`).
4. Engar ⛔ villur í Smíða — `proIssues` on every ordered cabinet. → that cabinet's Smíða.
5. Hver skápur yfirfarinn í Smíða — every Sk marked "Klár til framleiðslu" (hash still matching). → first one left.
6. Ábendingar yfirfarnar — the fit warnings, ticked "Ég hef farið yfir…" (the tick is tied to the exact warning set;
   a new/changed warning unticks it). → opens the warnings list.

Footer: **Vista í Airtable** (always — drafts) and **Klár til framleiðslu** (only when all six are green) = vista, then
the existing `proRunSkipulag` (its own confirm). If the save fails it stops before Keyra skipulag. Locked projects
("Í skipulagi") keep their old bar. Free-form editor unchanged.

Also: "Mæling lokið" no longer toasts "vistuð í Airtable" when the save failed.

## 3. Header

The 5 customer steps were already hidden in PRO (`updateStepper`). The header now fits one row at 1280–1440 px: the
customer sentence "Hannaðu eldhúsið þitt" is hidden in PRO, the bar takes the free width and only the project name
ellipsizes, nothing wraps inside a button (before: two-line buttons and "Hjálp" pushed past the edge at 1440, which
also made the page scroll sideways). With Tilboð open the bar stops at the panel's edge and the brand gives way.

## 4. "Black door" in the Veggur view

On T-32 the "door" is an **Op í vegg** (`gap:true`). The isolated Veggur scene builds nothing behind the wall, so the
hole showed the empty background — black in PRO's dark scene. It now gets a soft backdrop just behind the wall (the
reveals still show its depth). Real doors were fine. Same round: the Veggur ◀ ▶ arrows + "Veggur N af M" were measured
before the stage had its layout in PRO (arrows above the stage, label on the toolbar, a click scrolled the editor
sideways) — `placeWallCycle()` measures again once laid out.

## Not exercised live

- A real **Vista** write and **Keyra skipulag** (never run against a real project; locally every write returned 503).
  The all-green path was walked locally on T-32 (Sk7 fixed, a worktop picked, all 13 marked ready, measured): the
  button opened, called `/api/kp-pro`, and stopped when it failed.
- `state.proAck` / `state.measurement` travel inside the planner JSON like the rest of the state; kp-pro stores the
  state as sent, so nothing server-side changed.
