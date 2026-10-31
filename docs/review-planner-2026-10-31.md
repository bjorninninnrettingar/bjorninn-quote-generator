# Planner review — everything that landed 2026-10-30/31 (read-only, independent)

Scope: commits `5f2fe64`…`43f775c` on `kitchen-planner.html`, `kitchen-planner-3d.js`, `-beam.js`, `-pocket.js`, `-worktop.js`, `-linemap.js`,
`api/kp-pro.js`, `kp-submit.js`, `kp-price.js`, `kp-drawings.js`, `airtable.js`. No code was changed. Tools: reading the diffs, `npm test`
(run twice: 654/654 green both times — the PIN-rate-limit flakiness did not appear; it only showed up when two runs overlapped), and a local
copy of the page in PRO mode against a **throwaway mock server** (scratchpad only; no Airtable, no key, nothing submitted).

"VERIFIED" = reproduced in the running page. "READ" = traced in the code, not reproduced. Fix size is for one session.

---

## Ranked findings

### 1. CRITICAL — Vista (and Yfirferð / Tilboð) can write a *parked room's drawing over the room on screen*, and Afturkalla then restores it — VERIFIED
- `wtResult()` (`kitchen-planner.html:14263-14268`) calls `save()` + `toast()` when the new worktop re-keying (PRO #4, `kitchen-planner-worktop.js` `reconcile`) moves
  an override. `wtResult()` is called from inside `withEachCategory()` by `proSmidaAll`, `collectLineItems`/`wtLines`, `proCheckFacts` (`:20609`) — i.e. on every
  Vista and every Yfirferð refresh. Inside that loop the *live state fields are temporarily swapped to the parked room's data*.
- `save()` (`:3146`) writes that swapped state to localStorage and **pushes it onto the undo stack**.
- Reproduced: project with two rooms (active `thvottahus`, parked `eldhus` with a re-keyable worktop override). Clicked Vista. localStorage got a draft
  where the active room carried the parked room's walls (marker length 9999 instead of 3600); the undo button became enabled; pressing **Afturkalla replaced the
  active room's walls with the parked room's** (`walls[0].lengthMm` = 9999).
- Trigger is narrow (multi-room project, a parked room whose worktop run's first cabinet changed) but the result is a corrupted drawing that can be saved
  to Airtable with one more Vista. Also the draft in the browser stays wrong if the request then fails.
- Fix (<10 min): in `wtResult`, when `SK_CAT` is set (inside `withEachCategory`) do not `save()`/`toast()`; remember the moves and do both once after the loop.
  Test that would have caught it: a two-room fixture where Vista runs and `undoStack` is compared with the pre-Vista state (add to `tests/kp-pro-flow.test.js`).

### 2. CRITICAL (silent mismatch) — Afturkalla / Endurgera after Vista leaves "✓ vistað" although the drawing no longer matches Airtable — VERIFIED
- `stepHistory` (`:3184-3202`) restores the state and the save stamps (PRO #3), but never sets the dirty flag. Reproduced: áfella typed 45 mm → Vista (chip
  "✓ vistað") → Afturkalla: drawing shows 30 mm, `:dirty` is still `null`, chip still "✓ vistað".
- Consequences: no "● óvistað", no tab-close warning, and `proRunSkipulag` (`:20975`, `stale = proDirty() || !state.liSent`) will **run Keyra skipulag on Airtable's
  old data** without saving first. Old behaviour was the same, but PRO #3 was meant to make undo safe, so this is the missing half.
- Fix (<10 min): in `stepHistory`, when `PRO`, set `STORAGE_KEY + ":dirty"` and call `proBar()`. Test: undo after a mocked Vista must flip `proDirty()` to true.

### 3. MEDIUM — "Til baka" on the first Smíða screen leaves the island's new úthliðar behind — READ
- Adding a tall unit to an island in PRO calls `addIslandEndPanels(wall.island)` right after `insertBlockAt` (`:9267`, new in island round 2) and then `smEnterNew`.
  `smUndoNew` (`:19599`) removes only the cabinet (and its pair) and restores the neighbours' gaps — the úthlið blocks added by `addIslandEndPanels`
  (and whatever `matchPanelToNeighbour` changed) stay. Result: orphan UH units next to nothing, with their own Sk/UH Line Items on the next Vista.
  Same for the "tall unit arrives with a whole new island" path (`:9900`) if the island is cancelled.
- Fix (<10 min): remember the ids of blocks added during placement and detach them in `smUndoNew` (or snapshot `wall[zone]` like `addEndPanel` already does).
  Test: island + tall unit, Áfram, Til baka → island row must equal the starting row.

### 4. MEDIUM — Studio (customer) behaviour changed by the áfella work: úthlið no longer offered, and no AF line goes out either — VERIFIED (counts), customer impact reasoned
- `missingEndPanels` now treats any wall gap of 19-300 mm as "closed by an áfella" (`hasAf`, `:7100-7111`), also in Studio. But `afLines()` returns nothing in
  Studio (`AFELLA_LINES_IN_STUDIO_SUBMIT = false`, `:6461`). Measured in the Studio build with a cabinet at the corner: missing-úthlið count is 5 at a 10 mm gap
  (old behaviour), 4 at 30 mm and 60 mm, 3 at 150/300 mm. Before this round a 30 mm gap was "exposed" and offered an úthlið.
- Net for a customer who leaves 20-300 mm to a wall: the 3D now draws an áfella of that width, but neither an úthlið nor an AF line is in the submit — nothing
  is ordered for that side until Rakel opens it in PRO and presses Vista. The 3D width of the drawn filler also changed for Studio (now the real gap, was 19).
- Fix: gate `hasAf` (and the wider 3D filler) on `PRO || AFELLA_LINES_IN_STUDIO_SUBMIT`, or flip the flag after the T-32 check. Size <10 min.
  Test: Studio state with a 60 mm gap → `missingEndPanels().length` equals the pre-round number.

### 5. MINOR — Enter on an empty/invalid Smíða field disables the field's later "change" commit — READ
- `smWire` (`:19437-19438`, and the hinge/shelf variants `:19456`, `:19463`, `:19469`) sets `inp.__sent = true` on Enter and the `change` handler then
  ignores the field **for the rest of that DOM element's life**. `smCommit` (`:18982`) returns without re-rendering when the value is empty or NaN,
  so the element survives: Enter on an empty field, then typing 600 and tabbing out silently commits nothing.
- Fix (<10 min): clear `__sent` in a `setTimeout(0)` or on `input`. Test: dispatch Enter on an empty `data-sm-in`, then set value + `change` → ack must be written.

### 6. MINOR — Already-Klár cabinets can now show errors in Yfirferð that they did not have — READ
- `proReady` is unchanged (hash of `smidaFor`, which only gained pocket fields that are omitted unless chosen — so no Klár cabinet loses its ack; good).
  But `proCheckFacts` (`:20611`) lists `proIssues` for every cabinet whatever its ack, and `proIssues` gained (a) pocket size limits as errors (`:18444-18447`) and
  (b) the drawer-front sum now uses rounded values (`:18433`). An old, already-Klár pocket cabinet outside Blum/Hawa limits, or a drawer stack that rounds off by
  more than 1.5 mm, now appears under "Lagaðu" and blocks the green gate until touched. Probably intended for new work; Rakel should know it may hit old projects.
- Test: a Klár fixture with fractional drawer fronts → `proIssues` unchanged vs. the pre-round code.

### 7. MINOR — AF numbers are only remembered in `state.afKeys`, not checked against `liSent` — READ
- `afKeyOf` (`:6468`) takes `max+1` over `state.afKeys` only. `resetNow` in PRO keeps `proSavedAt`/`liSent` (PRO #8) but not `afKeys`, and any drawing whose JSON lost
  `afKeys` would restart at AF1 — re-pointing an existing AF1 Line Item (and an Eyðublað built from it) at a different wall. Sk numbers have the same property
  (they live in the blocks), so this is consistent, just worth knowing. Fix: seed the max from `Object.keys(state.liSent)` too (<10 min).

### 8. POLISH
- `" ⚠"` emoji in the Hvaða útgáfu? section summary (`kitchen-planner.html:8976`), visible to Studio customers; Studio rule is no emoji. `tests/emoji-ui.test.js` did not catch it.
- Vasahurð texts from `kitchen-planner-pocket.js` (card labels' errors, `spaceText`, `validate`, `SYSTEMS` labels) are not wrapped in `__()`; harmless while `KP_ENGLISH` is off.
- The island "Bil frá vegg" pills / typed gap (`:9957-9992`) show for customers too, not only PRO. If that is intended, nothing to do.
- `wireAfellaFields` stops propagation of *every* key at the input, so Esc inside the field does not close the panel (small).
- `refreshAfterEdit` (`:11581`) returns early while Smíða is open and so skips `clampIslands`, `glueLockedPanels`, `syncBathPanels`, `computeWarnings`; the new flow places the unit and stays in the wizard, so those only run when it closes. If Rakel presses Vista with the wizard open the saved drawing may not have been clamped yet. Not reproduced.

---

## Areas I checked and found clean
- **Planner JSON size (99 000):** new fields are tiny (`afKeys` ≈ 40 B per áfella, pocket fields live in `b.smida.doors` and are omitted unless chosen, island backs/áfella/pocket partitions are derived, not stored). No realistic project is pushed over the limit by this round. `fitPlannerJson`/413 order is correct: the 413 is raised before any Line Item write (`kp-pro.js:236-243`).
- **Hashes/acks:** `smidaFor` changed only by adding pocket keys that are `undefined` (dropped by `JSON.stringify`) until chosen — old Klár cabinets keep their hash. Lamir-as-own-section re-uses the `smidaAck.hw` keys.
- **Key regexes:** `Sk|UH|AF|HU|BP|BV|BH` is identical in `kp-pro.js:39`, `kp-submit.js:313`, `kp-price.js:28`; no client regex exists. `generate-quote.js:303` and `cnc-data.js:94` only look at `Sk|HU` — AF lines are not picked up there, which looks intended.
- **AF vs UH duplicates:** `afellaEndsOf` skips a panel/shelf-stack first block, and `missingEndPanels` skips the side an áfella covers, so AF and UH never cover the same wall side in PRO. Islands are excluded from áfella; their ends use ordinary UH.
- **Undo vs new fields:** snapshots carry `wall.afella` and pocket specs; `stepHistory` keeps `proSavedAt`, `liSent`, `roomMats`, `afKeys` (merged, never rewound). `proStateSig` strips the same four, so a save is not an undo step.
- **Worktop keys:** island úthliðar (`counter:true`) become the first block of a run; the PRO #4 `reconcile` moves the override and tells her. Island backs, áfella and pocket partitions are not blocks, so they cannot shift keys.
- **Global leaks:** none from the app (compared `window` against a clean iframe). **i18n:** every new `__("…")` has an EN key (scripted check). **Duplicate function names / script parse:** `tests/` pass.
- **Pointer/keyboard:** beam drag, beam turn handle and island drag use separate `drag` records; Esc handler is capture-phase and only acts while a beam drag is live. Global shortcuts ignore INPUT targets, so the island gap field and the áfella mm fields do not trigger nudging/delete. The island gap field relies on `change` (Enter fires it) — fine.
- **Performance:** nothing new runs per frame on all cabinets; clearance maths runs per pointer move on the dragged island only (small).
- **Security/privacy:** no new endpoint; `Pantaðir listar` PATCH now needs the key (good); 413 body exposes only part sizes to a keyed caller; `afellaId` is a record id already of the same kind as the rest of the linemap.
- **kp-drawings upload-first:** logic is sound on paper (old ids captured, new attachment kept, failed tidy-up leaves both). It relies on Airtable's uploadAttachment response including the attachment field — only the mocked test covers that, worth one look at T-32.

## Test gaps (summary)
| Finding | Test that would have caught it |
|---|---|
| 1 | two-room PRO fixture, run `proSmidaAll()` with a re-keyable parked override, assert `undoStack` unchanged and localStorage never holds mixed rooms |
| 2 | after mocked Vista then `stepHistory(-1)`, `proDirty()` must be true |
| 3 | island + tall unit → Áfram → Til baka → row equals start |
| 4 | Studio build with 60 mm wall gap → same `missingEndPanels` count as before the round |
| 5 | Enter on empty `data-sm-in`, then valid value + `change` commits |
| 6 | Klár fixtures (drawers with fractional fronts, an old pocket unit) keep `proIssues` empty |

Nothing here needed a live Airtable base or the office key; T-32 click tests should still cover: a two-room project through Vista + Afturkalla (finding 1), and Studio gap-to-wall behaviour (finding 4).
