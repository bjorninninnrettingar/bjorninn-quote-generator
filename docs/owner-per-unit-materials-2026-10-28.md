# Per-unit carcass (skrokkaefni) and worktop (borðplata) - 2026-10-28

Nothing here was applied. Everything below was read live from the base (`app91U15z9K704Okd`) with read-only MCP calls on 2026-10-28.
Rule everywhere: **the unit's own value when set, else the Tækifæri's.** Empty own value = behaves exactly as today.

## 0. What the base does today (verified)

| Where | How the Tækifæri's carcass/worktop is read |
|---|---|
| Tækifæri | link `Skrokka efni 🔲 viðskiptavinar` (`fldw1MDJEpQhPhDQf`), link `Borðplata viðskiptavinar 🍽️` (`fld3r8ZXf6Bxfamv6`) |
| Sögunarlisti | lookup `Skrokkaefni 🔲` (`fldYAXqrPKRZbAYqA`) through the row's Tækifæri link. It feeds formula `Efni: (undirstaða)` (`fldshrZoGeVBBiDcR`, 4 uses) which feeds `Efni:` (`fldGJlstHqJfu9QOg`), and the 4 formulas `Kant F_h / B_h / V_h / H_h efni` (3 uses each, via ARRAYJOIN) |
| Sögunarlisti script | writes **no** material. It only fills the `Efnislisti 🧱` link by matching the text of `Efni:` to `Heiti efnis` (`syncCutlistMaterialLinks`) |
| Pöntunarlisti full + lean | boards/edgeband come from each Sögunarlisti row's `Efnislisti 🧱` link and `Kant ..._h efni` text; they never read the Tækifæri's carcass. Lean never touches boards. Worktops are **not** in Pöntunarlisti at all |
| Eyðublað | lookups `Skrokka efni viðskiptavinar` (`fldIGGBEzpVRxHIyQ`), `Þykkt skrokka` (`fldo0tpMjSVjWqqTz`); formula `Þykkt skrokka f. Úrvinnslu` (`fldDuehb65mZyVfB0`) gives the thickness the Sögunarlisti script uses in the ÚRVINNSLA formulas |
| Line Item (quote cost) | lookups `Innkaupaverð Skrokka plötu 🔲` (`flddNx6X9nCidwM7F`) and `Innkaupaverð borðplötu viðskiptavinar` (`fldmgI7SsqRzJYa7V`) via the Tækifæri link, used by formulas `Efniskostnaður Skrokkar` (`fldgkdjVniwomuwHt`) and `Efniskostnaður borðplötu` (`fldz2S5t14zwQm8Qc`) -> Rukkum f. skrokka/borðplötur -> Einingarverð -> Viðbót |

Consequence: **only one script changes (Keyra skipulag).** The Sögunarlisti and both Pöntunarlisti scripts need NO edit, because they read the material from the Sögunarlisti formulas and links. Everything else is fields and formulas.

Known leftovers, not solved here: drawer/back-panel colour (`Skrokkaefni heiti 🔍` -> `Litur`, Pöntunarlisti `fld3MGlNw1BoPmSxh`) still follows the Tækifæri's carcass, because drawers and `Bakplata` are ordered project-wide. A unit in a different carcass colour still gets its boards and edgeband in its own colour, but not its drawer colour.

## 1. New fields (create in this order)

Names are exact; the script finds them by name.

**Efnislisti 🧱** (tbl8CrVWKF8CuI7HD) gets automatic inverse link fields when you create the links below. Leave them.

**Vöru línur ➖📦 (Line item's)** - this is the source Rakel/PRO edits (cost needs it before any Eyðublað exists)

| # | Name | Type | Config |
|---|---|---|---|
| L1 | `Skrokkaefni (lína) 🔲` | Link -> Efnislisti 🧱 | single record only |
| L2 | `Borðplata (lína) 🍽️` | Link -> Efnislisti 🧱 | single record only |
| L3 | `Innkaupaverð Skrokka (lína) 🔲` | Lookup | link L1 -> `Söluverð á plötu (aðeins f. spónlagt)` (the same source the Tækifæri lookup uses) |
| L4 | `Innkaupaverð borðplötu (lína)` | Lookup | link L2 -> `🚨INNKAUPAVERÐ🚨` (same source as the Tækifæri lookup) |
| L5 | `Innkaupaverð Skrokka plötu (gildandi) 🔲` | Formula, currency kr. 0 decimals | `IF(SUM({Innkaupaverð Skrokka (lína) 🔲}) > 0, SUM({Innkaupaverð Skrokka (lína) 🔲}), SUM({Innkaupaverð Skrokka plötu 🔲}))` |
| L6 | `Innkaupaverð borðplötu (gildandi)` | Formula, currency kr. 0 decimals | `IF(SUM({Innkaupaverð borðplötu (lína)}) > 0, SUM({Innkaupaverð borðplötu (lína)}), SUM({Innkaupaverð borðplötu viðskiptavinar}))` |

**Eyðublað ✏️** - written by Keyra skipulag from the Line Item (a unit made by hand with no Line Item can still be set by hand)

| # | Name | Type | Config |
|---|---|---|---|
| E1 | `Skrokkaefni (eining) 🔲` | Link -> Efnislisti 🧱 | single record only |
| E2 | `Borðplata (eining) 🍽️` | Link -> Efnislisti 🧱 | single record only. Display/review only: no Airtable calc reads a unit's worktop (cost is on the Line Item) |
| E3 | `Þykkt skrokka (eining)` | Lookup | link E1 -> `Þykkt (mm)` |

**Sögunarlisti 🪚**

| # | Name | Type | Config |
|---|---|---|---|
| S1 | `Skrokkaefni (Tækifæri) 🔲` | Lookup | link `Tækifæri 📣 (projects)` -> `Skrokka efni 🔲 viðskiptavinar` (a copy of today's `Skrokkaefni 🔲`) |
| S2 | `Skrokkaefni (eining) 🔲` | Lookup | link `Eyðublað ✏️` -> `Skrokkaefni (eining) 🔲` (E1) |

## 2. Order for the owner

1. Create L1-L4, E1-E3 (E3 after E1), S1-S2 (S2 after E1). Then create L5, L6.
2. Paste Blocks 1-4 (formulas, no automation involved).
3. Do the watch-list edit (section 3, after Block 4).
4. Paste Blocks 5-7 in the Keyra skipulag script, save, Test run once on T-248.
5. Only then deploy the app patch (section 4). If the app goes first, every PRO save PATCHes unknown fields and fails with a 422.
6. Run the test plan (section 5).

## 3. Find / Replace blocks (7)

Formula text below is shown with field **names**, as the Airtable formula editor shows it.

### Block 1 - Eyðublað field `Þykkt skrokka f. Úrvinnslu` (formula)
Automations affected: none embed it. Read by the Sögunarlisti script, which runs in **Skipulag · Yfirfara einingu** (`wflqQLKQBKIpNutDn`) - no script edit needed, the next run just sees the new thickness.

**Find:** (the last branch of the formula, appears once)
```
{Þykkt skrokka}
```
**Replace with:**
```
IF(ARRAYJOIN({Þykkt skrokka (eining)}, "") != "", SUM({Þykkt skrokka (eining)}), {Þykkt skrokka})
```
(The FRE and FRE #2 branches above it are untouched.)

### Block 2 - Sögunarlisti field `Skrokkaefni 🔲` (change the field type in place)
Open the field, "Customize field type", choose Formula. The field keeps its id, so `Efni: (undirstaða)`, `Efni:` and the four `Kant ..._h efni` formulas keep working with no edit. Do S1 and S2 first.
Automations affected: none embed it. The Sögunarlisti script (Yfirfara einingu `wflqQLKQBKIpNutDn`) reads the result through `Efni:`.

**Find:** (the current definition)
```
Lookup: link "Tækifæri 📣 (projects)" -> field "Skrokka efni 🔲 viðskiptavinar"
```
**Replace with:**
```
IF(
  ARRAYJOIN({Skrokkaefni (eining) 🔲}, "") != "",
  {Skrokkaefni (eining) 🔲},
  {Skrokkaefni (Tækifæri) 🔲}
)
```
Rollback: convert the field back to a Lookup on the same link/field.

### Block 3 - Vöru línur field `Efniskostnaður Skrokkar` (formula)
Automations affected: none.

**Find:**
```
{Innkaupaverð Skrokka plötu 🔲} * {Plötu-nýting Skrokka}
```
**Replace with:**
```
{Innkaupaverð Skrokka plötu (gildandi) 🔲} * {Plötu-nýting Skrokka}
```

### Block 4 - Vöru línur field `Efniskostnaður borðplötu` (formula)
Automations affected: none.

**Find:**
```
{Innkaupaverð borðplötu viðskiptavinar} * {% í Borðplötu 🍽️}
```
**Replace with:**
```
{Innkaupaverð borðplötu (gildandi)} * {% í Borðplötu 🍽️}
```

Not changed on purpose: `Verðlykill` (adding the own ids would alter every existing key and make locked lines look changed). A line's own material still moves its price through Blocks 3-4, so after "Unnið" it shows as Viðbót as it should.

**Watch-list edit (a setting, not a formula):** field `Skipulag síðast breytt 🕒` (lastModifiedTime, `fldorD54fxfQIBNiU`) -> edit field -> add `Skrokkaefni (lína) 🔲` and `Borðplata (lína) 🍽️` to "Only watch these fields". Then changing a line's own material lights `⚠️ Line Item breytt eftir að Eyðublað var stofnað` and the next Keyra skipulag run syncs it.

### Scripts: Keyra skipulag (3 blocks, one script)
Automation that contains it: **Skipulag · Keyra skipulag (Line Items -> Eyðublöð)** (`wflPGRyv0VYi4AZpd`, node `wacqu9ISRBogXpgxE`). It is the only automation with this script (the old Samstilla and Keyra alla lista automations no longer exist in `list_automations`). Paste Blocks 5, 6, 7 in that one script. Input variables unchanged (`recordId`, optional `force`).

### Block 5 - Line Item field map `F`
**Find:**
```
    GRIP: "fldgamCjzfqt6wNQH",
```
**Replace with:**
```
    GRIP: "fldgamCjzfqt6wNQH",
    CARCASS: "Skrokkaefni (lína) 🔲",   // own carcass on the line ([] = use the Tækifæri's)
    TOP: "Borðplata (lína) 🍽️",         // own worktop on the line
```

### Block 6 - Eyðublað field map `E`
**Find:**
```
    GRIP: "fldj9D05dfOFbbvPt",
```
**Replace with:**
```
    GRIP: "fldj9D05dfOFbbvPt",
    CARCASS: "Skrokkaefni (eining) 🔲",
    TOP: "Borðplata (eining) 🍽️",
```

### Block 7 - `buildFields`: copy the line's own material to the unit (create and sync)
**Find:**
```
        [E.FR2]: !!li.getCellValue(F.FR2),
```
**Replace with:**
```
        [E.FR2]: !!li.getCellValue(F.FR2),

        // Eigið efni einingar (úr línunni). Tómt = efni Tækifærisins. Speglar línuna nákvæmlega, líka þegar hún er hreinsuð.
        [E.CARCASS]: links(li, F.CARCASS).slice(0, 1).map(l => ({ id: l.id })),
        [E.TOP]: links(li, F.TOP).slice(0, 1).map(l => ({ id: l.id })),
```
Mirrors the line both ways, like every other field this script writes. A hand edit of E1/E2 on a unit that has a Line Item is overwritten at the next sync - edit the Line Item instead. Units without a Line Item are never touched by this script.

After a unit's material changes: Keyra skipulag copies it, then run **Yfirfara einingu** on the unit (recreates its Sögunarlisti rows with the new `Efni:` link and thickness), then **Pöntunarlisti verkefnis**. The Sögunarlisti `Efni:` text updates live, but the `Efnislisti 🧱` link on existing unlocked rows only refreshes when the rows are recreated; rows with Tilbúið 🔒 keep their old material by design.

## 4. App side (patch description for a later builder; nothing edited)

PRO already sends `smida.mat {carcass, top, handleColor}` (kitchen-planner.html `smidaFor`, line ~18474) as Efnislisti ids, excluded from `smidaHash`. Keep it. Keyra skipulag does **not** read `smida.mat` (single source = the two Line Item links), so there is no second place to keep in sync. The rule "own only when different from the first room" is the same as `roomMatDiff()`.

1. **kitchen-planner.html** - new helper next to `roomMatNow()` (~line 13417):
   ```js
   function roomOwnMats(){ var f = firstRoomBlob(), m = roomMatNow(),
       fc = f.carcass && CARCASS[f.carcass], ft = f.top && TOPS[f.top] && !TOPS[f.top].none ? TOPS[f.top] : null;
     return { carcass: m.carcass && m.carcass.id && (!fc || fc.efnislistiId !== m.carcass.id) ? [m.carcass.id] : [],
              top: m.top && m.top.id && (!ft || ft.efnislistiId !== m.top.id) ? [m.top.id] : [] }; }
   ```
   In `collectLineItems()` (line ~13271), right after `if (hasInnerDrawers(b, c) && b.innerFront) fields["Tegund innskúffu fronts"] = b.innerFront;` (line ~13366) add (not for `c.notOrdered`, which already returns earlier):
   ```js
   var own = roomOwnMats(); fields["Skrokkaefni (lína) 🔲"] = own.carcass; fields["Borðplata (lína) 🍽️"] = own.top;
   ```
   and on the worktop lines (`if (PRO) wtLines().forEach(...)`, ~line 13296) add `li["Borðplata (lína) 🍽️"] = roomOwnMats().top;`. Door lines (`doorLineOf`) get nothing. This runs inside `withEachCategory`, so `state` is the room being collected.
   Empty array is sent on purpose: it is how a room that went back to the Tækifæri's material clears its old own value.

2. **api/kp-submit.js** - add `"Skrokkaefni (lína) 🔲", "Borðplata (lína) 🍽️"` to `LINE_FIELDS` (line 41); in `validateLineItems` reject them unless an array of at most 1 `rec...` id (same shape check as the V1-V3 loop); where lines are created (`pick`), skip empty arrays. `fieldDeps()` in kp-pro and the daily field check pick the names up from `LINE_FIELDS` automatically.

3. **api/kp-pro.js** - this is the existing "LINE_EXTRA" mechanism (Frontaefni #2 / Tegund innskúffu fronts), same rule: the drawing's value is written unless it is unchanged since the drawing last sent it AND Airtable was changed by hand since; a drawing that never sent anything never clears a hand pick.
   - `LINE_EXTRA` (line 56): add the two names (this also adds them to the `linesOfProject` field list, so existing values are read back).
   - `extraVal` (line 62): add a first case `Array.isArray(v) ? idsKey(v)` so a link compares as sorted ids.
   - the `put(row, f, ...)` call in the LINE_EXTRA loop: for these two fields write `D ? D.split(",") : []` (link field, an array of ids) instead of `D || null`.
   - the "creates" loop (new lines): skip a LINE_FIELDS entry that is an empty array (`Array.isArray(li[f]) && !li[f].length`).
   - `liExtra` already stores what was sent per key, so no new state.
   Result: PRO Vista writes the room's own carcass/worktop to the Line Item only when it differs from the first room; reverting a room clears it; Airtable hand picks survive.

4. **tests** - `tests/kp-pro.test.js`, next to the "FR2 / inner fronts" test: (a) new own carcass is PATCHed as `["recX"]`; (b) hand-set in Airtable and never sent -> kept; (c) sent before and now `[]` -> cleared with `[]`. `tests/kp-submit.test.js`: validation accepts `[]` and `["rec..14 chars"]`, rejects two ids and a non-rec string. Then `npm test`, and `npm run test:live` (hard-coded ids).

5. **docs/pro-finish.md** - replace the "Not done - needs the owner (schema)" paragraph under "Materials per room" with a pointer to this document and the final field names.

## 5. Test plan - T-248 only (recB7aDe1sBFzbr1t, "T-248 | TEST TESTI")

Checked 2026-10-28: Staða í söluferli = Teikna og yfirfara tilboð (not Unnið), so the Fjármál price lock, Konto drafts, F2 mails and the Framleiðsla automations do not fire. Its carcass and worktop links are empty today. Do NOT use the "Aftur í forskipulag" button (it posts a real Google Chat message). Keyra skipulag writes Staða í skipulagi = Í skipulagningu once; the only automation that watches that field here is the "Virkni-logg" (writes one log row). Leave it, or set it back by hand in the field (not with a button).

Materials to use (Efnislisti): A = `Plastl spónapl 16 mm U963 dökkgrá ST2` (recOz5NQJs6mCBpkq, 16 mm). B = `Eurodekor W1100 SM 16 mm MDF` (recAhnF5QSK93nT8F, thickness 19, different price - makes the thickness and cost change visible).

1. **Before anything**: on T-248 set Skrokka efni = A. Take notes of `Efniskostnaður Skrokkar` and `Efni:` of any existing line/part. Create two Line Items if none: Sk1, Sk2 (V1 a floor cabinet, Magn 1, Rými set, 🔑 filled).
2. **Neutral check** (after steps 1-2 of section 2): nothing has an own value, so every `Efniskostnaður Skrokkar`, Sögunarlisti `Efni:` and `Þykkt skrokka f. Úrvinnslu` equals the notes. Pass = no change anywhere.
3. **Line cost**: on Sk2 set `Skrokkaefni (lína) 🔲` = B. Expected: Sk2's `Efniskostnaður Skrokkar` changes (B's price x nýting), Sk1 does not, and the quote-side totals follow.
4. **Keyra skipulag** (button on T-248): Sk1 and Sk2 get Eyðublöð. Expected: Sk1 `Skrokkaefni (eining) 🔲` empty; Sk2 = B, `Þykkt skrokka (eining)` = 19 and `Þykkt skrokka f. Úrvinnslu` = 19 on Sk2's unit, 16 on Sk1's.
5. **Yfirfara einingu** on Sk2's unit: its new Sögunarlisti rows have `Efni:` = B's name, `Efnislisti 🧱` link = B, side/shelf `Þ` = 19. Sk1's unit rows unchanged = A. Fronts untouched.
6. **Pöntunarlisti verkefnis**: one board line per material (A and B) with sheet counts for each unit's parts only, Kantlíming lines per material. Pass = B appears and A's sheet count dropped by Sk2's share.
7. **Worktop**: set `Borðplata (lína) 🍽️` on Sk2 = a different worktop than the Tækifæri's. Expected: only `Efniskostnaður borðplötu` of Sk2 changes; nothing in Sögunarlisti/Pöntunarlisti changes (worktops are not ordered there).
8. **Clear**: empty both lines' own fields, run Keyra skipulag: Eyðublað E1/E2 become empty, Yfirfara einingu again -> Sk2 back to A / 16 mm.
9. **Watch-list**: edit Sk2's own carcass again after a sync: `⚠️ Line Item breytt eftir að Eyðublað var stofnað` appears, Keyra skipulag syncs and clears it.
10. **App** (only after steps 1-8 pass, on the `prufa` branch against T-248 with `?pro=recB7aDe1sBFzbr1t&k=`): add a second room with a different carcass and a different worktop, PRO Vista. Expected: that room's cabinet lines get the own carcass (and BP lines the own worktop), the first room's lines get none; switch the second room back -> the fields clear on the next Vista; set a value by hand on one line in Airtable -> Vista keeps it. Delete the test Line Items/Eyðublöð after (a test submission on the shared base is real data).
11. **Rollback if anything is off**: convert `Skrokkaefni 🔲` back to Lookup (Block 2), restore the Find texts of Blocks 1, 3, 4, remove Blocks 5-7 lines from the script. The new fields can stay, they are inert when unused.
