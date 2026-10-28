# PRO Smíða wizard (scoped 2026-10-28, not built)

Owner brief: Smíða must work like the Studio door wizard (`openDoors` / `KPDOORS`, `uw*` Ný eining wizard): the next step is always obvious, the camera zooms between the places being worked on so nothing can go wrong, and the summary builds up underneath. Rakel must stay awake — no click-through.

## Decisions (owner + recommendation)
- **Order:** one pass through the WHOLE room, unit by unit (Sk1 → Sk2 …). A unit marked "Klár" glides the camera to the next not-ready unit; progress (7/12) is always visible (same count as the Yfirferð badge). Nothing skippable.
- **"Nothing prefilled" (owner: "I don't know, what prevents most mistakes?") → ghost + confirm:** fields start EMPTY but the drawing shows the current value as a pale ghost; the step cannot be passed until Rakel types the value or taps "Rétt" on EACH dimension (its dimension line lights up in 3D while she does). Mistakes come from skipping, not from retyping — this stops skipping without 90 retyped numbers. Same rule for every later step (count, positions, hinges): an explicit action per item, never an automatic pass.
- **Steps per unit:** 1 Mál (B × H × D, dimension lines, camera head-on like the doors' Mál) → 2 Innvols (hillur / skúffur / ofn / slá: counts) → 3 Staðsetning innvols (heights of shelves, drawer seams, oven line — dragged in the zoomed 3D or typed) → 4 Vélbúnaður (hinge positions, door type, grip side) → 5 Yfirlit ("Klár til framleiðslu").
- **Summary tray under the wizard:** chips fill as choices are made — mál, hillufjöldi, skúffur (with Sérhæð), lamir (count + mm), ofn, grip. Clicking a chip jumps back to its step.

## Build plan (data model untouched)
`b.smida`, `b.shelfPos`, `b.interior.frontsMm`, `b.ovenShelves`, `smidaFor()`, `proIssues()`, `proReady()` stay exactly as they are — /smida, Keyra skipulag and the Vinnuteikningar read the same Smíðagögn. Only the UI shell changes; the editing primitives of `renderBoxEditor` (seam drag, shelf drag, hinge markers, `KP3D.resizeFront`) are reused inside steps.
1. **Shell + Mál + summary tray + room queue** (door-wizard layout, `uwAimCamera`-style camera, `b.smidaAck = {mal:[w,h,d], …}` records what Rakel confirmed; changing the drawing drops the ack like `smidaReady` does).
2. **Innvols + Staðsetning** for door cabinets and drawer units (most units), then oven / corner / fridge / búr.
3. **Vélbúnaður** (hinges with the existing `HINGE_CLEAR` rule and height rule).
4. **Yfirlit → Klár** replaces the ⛔ list + "Klár til framleiðslu" button; Yfirferð reads the same readiness.

## Ideas (not yet agreed)
- Show what the customer chose next to what Rakel confirmed ("viðskiptavinur: 3 hillur → þú: 4").
- Check Mál against the site measurement (Mæling) when one exists; warn on > 10 mm difference.
- Enter = next, Tab = next field; Esc steps back without losing values.
