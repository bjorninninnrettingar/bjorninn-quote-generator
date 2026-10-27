# CNC (`/cnc`, Rover-B) — full notes

Moved out of CLAUDE.md on 2026-10-12.

## CNC (`/cnc`, 2026-10-08)

One page, one button: pick a project → everything is written to `[99] - VERKEFNI/T-56 <name>/` on the stick (masters read from the same stick) plus `T-56 CNC skrá.txt` (made / ATHUGA / EKKI GERT). `/hurdir` is the same page.

**USB layout (user, 2026-10-10)** — the end goal:
```
[99] - VERKEFNI/T-32 <name>/
  Skápar/<Sk1 - Grunnskápur>/   Hliðar.bpp                                 (no hinges: one file, run ×2)
         <Sk2 - Hárskápur>/     Vinstri hlið.bpp + Hægri hlið - lamir.bpp  (only the hinge side is drilled)
                                + Skúffufrontur E 374.bpp, Frontur 2397.bpp … (fronts, see below)
  Hurðir/<HU01>/                Karmur lamir · Karmur slúttjárn · Karmur toppstykki · Hurðablað
  (file names are short inside the folders — no project / Sk / HU in them; a folder only exists when the project has it)
  Annað/                        úthliðar/blindlok etc. — later
  T-32 CNC skrá.txt, T-32 Hurðaskrá.txt
```
One folder per cabinet, identical cabinets are NOT merged (the old `SK01+02+05 Hliðar.bpp` grouping is gone from the export; `groupPlans` is kept for tests). Folder = Sk number + Tegund einingu (`SD.cabinetFolder`). The hinge side comes from Smíðagögn `hinge` ("vinstri"/"haegri"/"baedi", seen from the front — the designer sends it for every door cabinet; > 600 mm wide = two doors = both) or the first door's `side`; unknown → one "Hliðar - lamir báðum megin" file + ⚠ (what every side got before). A full export deletes marked side files from the old flat layout and marked files/empty folders under Skápar/ that it no longer produces. A door whose jamb was made in the old flat layout keeps its files there (jamb wins); new doors go to `Hurðir/<id>/`. Verified with an OPFS stand-in for the stick (`showDirectoryPicker` stubbed) on T-32.

### Hliðar (cnc-sides.js)
- **Only from Sögunarlisti** (user: one source, so Eyðublað/Sögunarlisti is the one place to fix): the unit's "…hlið" row = LPX × LPY × LPZ (H × B × Þ). Some sides are stored rotated (T-31 tall: H 580 × B 2470) — `opts.unitHeight` (Eyðublað Hæð) only decides which way round.
- **Rules agreed with the user 2026-10-08** (rules session over the backwards analysis of 138 hand programs, report `~/bjorninn-cnc-mirror/CNC reglur - afturábak greining.md`):
  - drawers: macros take the **slot** = cut front + grip strip (`opts.gripMm`; T-31 had 35, T-33 27). The grip belongs on the handle in Vörulisti ("Grip mm") — until then /cnc has a "Grip á skúffufrontum" field per export. Bottom → top F,E,C,K,M,N; `MERIVOBOX_V2` slot1 = Σ(slot+3) − 3 (bottom −1.5 → runner 80, user 2026-10-09); Legra = `LEGRABOX_NEDSTA_SKUFFA` + `LEGRABOX_SKUFFA` (flagged until compared with a real Legra job);
  - inner drawer: on the cabinet sides like any runner, 32 mm back, hidden behind the front of the drawer zone it sits in = the **tallest** zone (tie → top); front top **32 mm** under the top of that zone (or the cabinet's top board). Behind a door (tall/pantry) the designer places them; default from the bottom, front + 80 apart (⚠). Open question: in 600 slots (T-31 Sk 3, T-56 oven) the shop used 60 mm;
  - doors: low "Frontur" (≤ 350) in a drawer cabinet = fixed front `FAST_FRAMSTYKKI` (no hinges); identical fronts that can't stack = leaves of one opening; a front taller than its space hangs on the side's length; hinges 80 from the ends + evenly between (count by height), moved off shelf rows/runners; door types hinged / lift-up — lift-up hinges go in the TOP board, not the side (designer must catch; until then ⚠);
  - **middle-hinge spacing fixed 2026-10-13**: for a 3+ hinge door the two end hinges are confirmed at 80 mm from each end (unchanged), but the middle ones are plain fractions of the full door length — `len × i / (n-1)` — not an even split of the span *between* the two 80 mm end hinges as `hingePositions()` used to compute. Confirmed against two independent real masters: Emilia Barugata `sk1.bpp` (1980 mm, 4-hinge door: `80, 1980/3=660, 1980/3*2=1320, 1980-80=1900`) and Birgitta Axlaras `sk12/13 wip.bpp` (1990 mm, same `len/3` pattern under its hand-adjustments). The old formula gave 640/1760 for the 1980 mm case — ~27 mm off. The 5-hinge (>2000 mm) case follows the same `len×i/(n-1)` pattern by extension but has no independent real-file confirmation yet.
  - **grip-style fronts (2026-10-13, found via T-33's 27mm Jey grip)**: `opts.gripMm` now also widens a fixed front's (`FAST_FRAMSTYKKI`) and a real door's own slot by `grip` when checking it against the side height — each front, including fixed and hinged ones, is cut `grip` mm short of its own opening (the reveal sits above it), same convention as a drawer's slot. A hinged door also shifts its whole position (and therefore its hinges, which are measured from the door's own ends) down by `grip`; the physical board height (`d.H`, used for cutting + hinge-cup positioning in `frontPlans`) is untouched — only where the board sits moves. `Fast framstykki`'s own cut macro is likewise untouched. Confirmed on T-33: cleared all 7 false "Frontar passa ekki við hlið" warnings once grip was set to 27.
  - **grip sign decides whether height matters (2026-10-13, user)**: a positive grip (Jey, a real handle on the face) applies to every door/fixed front in the unit no matter how tall, same as above. Drawer fronts are unconditional, no height check. Investigated for T-33 Sk45/46/Bað2# SK45-46 (traced from a false "Frontar passa ekki við hlið" even at the correct 27mm): those three turned out to be linked to "Blum tip-on fyrir skúffur (Þrýstiopnun)" in Airtable, not Jey — `Grip mm` = 0, not fræst grip at all. **The negative-grip ("fræst grip", `Grip mm` = −35, zeroed on doors/fixed fronts ≥900mm) branch this bullet used to describe is retired as of 2026-10-14** — see the Fræst-grip Type 1/2 entry below; `doorGrip()` now just returns `grip` unconditionally, since nothing produces a negative Höldur-1 grip any more.
  - **Fræst grip Type 1/2 (2026-10-14)**: Fræst grip no longer goes through Höldur 1/`Grip mm` at all. SMÍÐA's pro-mode box editor now has a per-front grip zone control (`kitchen-planner.html`: `proGripTargets`/`proGripOf`/`proSetGrip`), serialized into Smíðagögn's `grip[]` (`{target, type:"alla"|"hluti", att, brun?, start?, length?}`). Keyra skipulag validates it and writes it to Eyðublað's new `Grip svæði (JSON) 🪚` field; for `type:"alla"` it *also* bakes the height shrink (35mm) straight into that front's own Sérhæð/Hæð-frontur-N field — so by the time a row reaches Sögunarlisti/`/cnc` here, the dimension is already correct and nothing in this file needs to shrink anything for Fræst grip any more. `/cnc` (`cnc.html` fetches the field, `unitPlan` takes it as `opts.grip`) only surfaces *where* to mill: each zone is matched to a drawer code / split front (`frontN`) / door index (`doorN`) and pushed onto `check` as "Grip — … : … — fræst í höndunum, ekki í þessu útflutti." No real master `.bpp` with a milling macro for this has been seen yet, so it's a manual-work flag, not a generated macro call — same category as fixed shelves/FRE were before the designer caught up to them. `type:"alla"` + `att:"lóðrétt"` has no Eyðublað field to write into (height-only fields) — Keyra skipulag throws rather than guessing, so only `lárétt` works for Type 1 today.
  - loose shelf = one `LAUS_HILLA` with 3 positions (at the shelf, one above, one below), shelves spread evenly by default (designer later);
  - extra rail (`lpx/3`) on sides over **1000**; masonite groove off for lagna + FRE; FRE thickness is measured per job at the machine;
  - fixed shelves / oven types, FRE, door types, front ↔ cabinet links → the designer ("Smíðagögn"), not /cnc rules.
  - **Fataslá (clothes rail, 2026-10-15)**: a real drilling macro (`FATASLA`, built from the user's own `THYKKURFATASLAHALDARI`/`EMUCA_HANG_FATASLA`/`KESSEBOHMER_TOPLIFT_FATASLA` macros as templates — Ø5mm × 12mm deep, 2 holes 32mm apart on X, params `POSITION_X, POSITION_Y` centered on the pair, no `CRN`) now exists on the stick, so Fataslá is no longer flag-only. Height comes from Smíðagögn's own `rails: [{mm}, …]` (`kitchen-planner-3d.js` `railLayoutOf`/`railPos`, same bottom-up "mm" convention as `shelves.list` — SMÍÐA's pro-mode box editor, 2026-10-15); Y is centered on the panel's own depth (`B/2`, i.e. `LPY/2`) since nothing says it should vary per unit. `op("FATASLA", …)` applies to the whole side program, so both of a unit's physical side panels get it (same "identical sides share one file" mechanism as everything else here) — no per-side selection needed. No Smíða position yet (older project / not opened in Smíða) → falls back to the old flag-only check; Eyðublað's `Fataslár magn` (ordering count) disagreeing with Smíða's own rail count also gets flagged. `FATASLA` is in `MANAGED`, but the shop's `Hliðar.bpp` master doesn't have a template line for it yet — until it does, `renderSide`'s own "macro not in master" fallback inserts the generated line before `STAT_BLOCK` and flags it, so output is still correct, just not in the usual sequence position.
- **Drawer fronts are always "global" (user, 2026-10-09)**: every drawer front gets the same drilling as a bottom drawer — the masters `[03] - Skúffur/…/Global Frontar` call only `K_M_NEDSTI_FRONTUR_*`, `E_NEDSTI_FRONTUR_MERIVO`, `C_NEDSTI_FRONTUR_LEGRA`, `F_NEDSTA_SKUFFA_LEGRABOX`; the non-NEDSTI front macros are not used. The side macros already agree: the runner sits the same distance above its own slot for every drawer (Merivo `1.5+80+Σslots` / bottom 80, Legra `1.5+62.5+Σ` / bottom 64), so a front fits any slot. The bottom Merivo drawer's runner is at **80** (user, 2026-10-09): `MERIVOBOX_V2` with slot **−1.5** (the T-56 hand files' −3 gave 78.5).
- `/cnc?t=T-32` also opens a project that isn't won yet (marked "ekki unnið" in the list) — for test runs / checking a drawing before the deal closes; the list itself still shows only won projects.
- A plain low "Frontur" (≤ 350) in a unit with "Skúffubak X" rows but no "Skúffufrontur" (the low oven OFN6) is that drawer, not a door (T-32 Sk11).
- Macro last param = corner list: `"2,3"` = from both ends, `"2"` from the bottom, `"3"` from the top.
- **Smíðagögn** (Eyðublað `Smíðagögn (JSON) 🔧`, written by the designer's pro mode): `{v:1, doors:[{h, type:"hinged"|"lift", side, hinges:[{from:"bottom"|"top", mm}]}]}`, doors top → bottom. When the door count matches Sögunarlisti, its hinges replace the default (positions from each door's ends; > 20 mm height difference = ⚠); lift-up = no hinges on the side (⚠ "lamirnar fara í toppborðið"); a different door count = ignored + ⚠.
- Identical machining → one file (`T-56 SK01+02+05+06+09.1+11-13+14-16+15 Hliðar.bpp`). Generated side files carry `GLB=HS_HLID|1|…`; a full re-export deletes earlier marked files it no longer produces, never hand-made ones. Door-part rows and door units are excluded; units without a carcass side are skipped quietly; FRE/FRE2 cabinets stop (designer upgrade pending), oven cabinets get ⚠.
- Verified against the hand programs: T-56 SK 1-group (incl. inner drawer 700), 12, 18, 9.3 identical; after the rules session drawer differences across all 8 projects went 23 → 11 (the rest are data errors or old formats).

### Frontar (cnc-sides.js `frontPlans`, 2026-10-10)
Every front goes in its cabinet's folder, identical ones once with "keyra ×n". Masters from the stick: drawer fronts `[03] - Skúffur/01 - MERIVO/[01] - Global MERIVO Frontar.bpp` / `02 - LEGRA/01 - Global Frontar - LEGRABOX.bpp` (LPX = width, LPY = height; the base `K_M_NEDSTI_FRONTUR_*` always, `E_NEDSTI_FRONTUR_MERIVO` / `C_NEDSTI_FRONTUR_LEGRA` / `F_NEDSTA_SKUFFA_LEGRABOX` only on that code's front, and not when its row (218 / 203.5 / 235.5) would land within 10 mm of the top — ⚠); door fronts `[02] - Frontar/[01] - Lama frontar/[01] - Frontur Breytiskjal.bpp` (LPX = height, LPY = width) with `IKEALOM` cups at the side's hinges measured from the front's ends (80 → 79; "2" bottom, "3" top, "2,3" both; mid-door hinge counts from the bottom like LOM). Wing doors: one file × leaves. Not drilled yet (⚠ in `plan.frontCheck`, which never changes the side status): fixed fronts (Blindlok master), inner drawer fronts, lift doors. `renderSide(text, plan, managed)` renders fronts too (parameterless macros end in `0 :`). Verified on T-32 with an OPFS stand-in for the stick.

### Hurðir (cnc-doors.js)

Why: the shop's door masters on the USB (`[01] - AÐALMÖPPUR …/[05] - Hurdir`: `[01] - Hurd.bpp` + `01 - Karmur/[01] … ofan 'a` / `[02] … A_milli`) are parametric (HURD_H/B/Z, KARMAR_B/Z, HG_BIL, HK_BIL, LOM1-3, HANDFANG), but those numbers were typed into BiesseWorks Piece Data on the machine and never saved, so a leaf made weeks after its jamb didn't match (lock/strike plate and hinges).

- **Data**: door Eyðublöð (`{Sérsmíði tegund}="Hurð"`, HU number in Athugasemd, project from the formula "Athugasemd + Tækifæri (fyrir yfirfara)"). Sizes follow ÚRVINNSLA: leaf H = Hæð − 13 − karmabil − karmur, B = Breidd − 6 − 2·karmur − 2·karmabil; HG_BIL 10, HK_BIL 3, HURD_Z 38 (HU-Efni = cladding, not thickness). Hinges LOM1 237 / LOM2 607 from the top, LOM3 237 from the bottom; handle 1050 from the leaf bottom (user, 2026-10-08) — `RULES` in cnc-doors.js.
- **Hardware → macros by Vörulisti id** (`HINGES` / `LOCKS` / `THRESHOLDS`): JNF Coplan → COPLAN + COPLAN_KARM; JNF lykill m. segli 60 → IN_20_835_60_BA + IN_20_835_60_BA_SLUTJARN (strike plate not yet confirmed on a door → ⚠️); JNF euro WC 20 mm has no pair yet (⚠️, lock done by hand). Unknown hinge = ⛔ no files. Only the macros in `MANAGED` are switched @/'; everything else in a master stays as the shop left it, `Rem` lines are never touched; a macro to switch on that the master lacks is an error.
- **Output**: the masters are read from the stick the user picks (stick root or the AÐALMÖPPUR folder), files go to `[99] - VERKEFNI/T-49 <name>/T-49 HU4.1 Hurðablað|Karmur lamir|Karmur slúttjárn|Karmur toppstykki.bpp` (Windows-1252, CRLF), PAN LPX/LPY/LPZ as plain numbers, every variable substituted and saved as `GLB=HS_<VAR>|<n>|Hurdaskra|0|` (the record; the lock/strike macros read the machine's own HURD_Z). `T-49 Hurðaskrá.txt` is an append-only log next to them.
- **Jamb wins**: if `… Karmur lamir.bpp` made here already exists, its GLB numbers are used for the leaf and the jamb files are left alone (warning lists what Airtable changed since); a jamb not made here is never overwritten unless "Yfirskrifa karma" is ticked.
- **Confirmed on the machine 2026-10-08.** The machine defines HURD_B etc. itself, so a `GLB=HURD_B` line stopped the file ("Name redefined") — the record is saved as `GLB=HS_<VAR>`; a jamb with the same numbers is rewritten on re-export. Macro inventory: 243 macros on the stick, 82 referenced by a master/job/other macro (list sent as "Makró yfirlit.csv").
- **"Toppstykki" statblock, checked 2026-10-14**: the operator saw no statblock while milling a T-33 toppstykki on the machine. Checked the real files on the stick directly (all 7 T-33 HU1–7 `Karmur toppstykki.bpp`, plus lamir + slúttjárn) — every one has the full 11-line `GLB=HS_…` block, correctly positioned right after the `PAN=` lines, correct values. `renderBpp()` never special-cases which file kind it's rendering, so this was never a code path that could single out toppstykki. Still open: why it wasn't visible on the machine — GLB (global) variables are a different kind from PAN (piece) variables in BiesseWorks, so they likely live in a separate "Global Variables" view from the Piece Data panel an operator would normally check; needs confirming at the machine.
- **"Mælilína" removed from the toppstykki master, 2026-10-14**: the default ("Ofan á hliðum") `karmur_toppstykki.bpp` master had an active (`@`) `GEO "maeli lina"` block — a leftover reference line (1000,0)→(1000,500) from when the master was first drawn, not an actual cut. Disabled by switching only the parent `GEO` line to `'`, same convention the master already uses for its other inactive "sla" GEO block (children stay `@`, the machine only runs them if the parent geometry is active). Edited directly on the stick (and the local mirror `~/bjorninn-cnc-mirror`) since this lives in shop master data, not generator code. The "Á milli hliða" master (`karmur_toppstykki_M.bpp`) never had this block.

### BPP skoðari (`/bpp`, 2026-10-14)
A standalone viewer (`bpp-viewer.html`, no API/Airtable calls) so the user can drag a `.bpp` file `/cnc` just wrote into a browser and see a 2D elevation (drawers, hinges, shelves, rails, door/jamb hardware) instead of walking the USB stick down to the machine. Scoped to `/cnc`-generated files only (sides, fronts, door leaf/jamb) — a hand-made shop master uses far more macros than this knows about and just gets a raw op dump. Reconstructs positions the same way the generators compute them (bottom-up stacking with the 3mm gap, corner-coded hinge/shelf math from `cnc-sides.js`'s `unitPlan`/`frontPlans`, or straight off the `GLB=HS_<VAR>` record block for doors/jambs) rather than trying to model the real Biesse macro's own internal geometry — correct for our own output because we know exactly how we wrote it.

**Bug found while building it, confirmed against the real masters on `~/bjorninn-cnc-mirror`, fixed same day (2026-10-14, commit `d342425`):** `renderSide` (`cnc-sides.js`, shared by side **and** front files) used to re-emit a managed macro's *entire* op group at *every* template line matching that macro's name in the master, instead of only the first. Several real masters have more than one template line for the same macro name (`SLA_HLID` always has 2 — "Slár" + "Auka Slár"; `MERIVOBOX_V2` always has 2 — an "E" and a "K" example; the door-front master `[01] - Frontur Breytiskjal.bpp` has **5** `IKEALOM` template lines, one per hinge-count example) — so a real exported file with 2 Merivo drawers would end up with that pair of `MERIVOBOX_V2` lines written out 2×, a 2-hinge door front with its `IKEALOM` line written 5×, etc. The viewer separately detects and flags this (any active macro name+params combo repeated more than once, except `ENDPATH`/`GEO` which legitimately repeat) rather than silently drawing a plausible-looking but wrong diagram, as a second line of defense. Fixed in `renderSide`'s per-line loop: only the *first* matching template line for a given managed macro name gets `render()` called on it (via a `foundTemplate` guard); every later template line with that name is dropped, same as how a managed macro with *no* ops already gets dropped. **Any side or front file with a Merivo/Legra drawer, or any door front, exported before 2026-10-14 is very likely affected** — re-check anything from before that date before trusting what's on the stick; anything exported since is fine.

### Used by PRO's Smíða (2026-10-26)
`kitchen-planner.html` now calls `unitPlan` / `sideFiles` / `renderSide` (with a stand-in master) and `CNCBPP.buildCard`
for its "Hlið · CNC" tab — the designer sees the side drilling before Keyra skipulag. Any change here shows up there
too; keep these functions pure. `?recordId=` on /cnc now also opens a project outside the won/planning list (looked up
by id, marked "ekki í lista"), like `?t=` already did — PRO's Yfirferð links here with it. A wide (> 600) door cabinet
is one Smíðagögn door + two "Frontur vænghurð" leaves in Sögunarlisti; test "wide wall cabinet…" pins how they pair.

### /cnc reads the PRO drawing (2026-10-26)
- **Grip is automatic.** Order: "Fleiri stillingar → Grip handvirkt" (blank by default; when filled it overrides every
  drawer unit and the toolbar line turns amber "Grip handvirkt: X mm — yfirskrifar …") → the unit's own Höldur 1
  (`Grip mm (Höldur 1)`) → the **project handle PRO saved** (Tækifæri `Höldur Viðskiptavinar ✊` → Vörulisti `Grip mm`,
  readable in the proxy now; a handle with no Grip mm = a real handle = 0; Jey/Jey2 = 27) → unknown (planned at 0 and
  listed as an item). The old yellow "Grip er á 0 mm…" banner is gone. T-32: U halda 20sm → 0 mm.
- **Review state = PRO's.** It was always the same flag: Smíðagögn `ready` = `b.smidaReady` hash still matching
  ("Skápur yfirfarinn ✓" in Smíða). /cnc said "Ekki yfirfarið" on T-32 because it read the **Eyðublað copy** (written
  by the last Keyra skipulag, 2026-10-10 era, no `ready`/`hinge`) and because the marks were never saved — the planner
  JSON in Airtable (proSavedAt 2026-10-10) has no `smidaReady` on any block; the marks lived only in a local draft.
  /cnc now reads each Line Item's `Smíðagögn (JSON) 🔧` (proxy: VERK-only) and prefers it over the Eyðublað's. If the
  two differ in anything but `ready`/`hinge`, the card says "Teikningunni breytt eftir Keyra skipulag — keyrðu
  skipulag og Yfirfara…" (T-32 Sk10, Sk11). Chip: "Yfirfarinn í PRO" / "Ekki yfirfarinn í PRO" (read-only). There
  was no separate /cnc review step to drop (the `6. CNC yfirfarið` tick after a write is the export receipt, kept).
- **Defaults accepted on review** (`cnc-sides.js` `dflt()` → `plan.defaults`; `plan.reviewed` true/false/null): loose
  shelves at default spots, default hinges ("ef lyftihurð…"), hinges moved off a shelf, default inner drawers — hidden
  once the cabinet is reviewed in PRO (shown greyed "Samþykkt í PRO: …"), real errors (E-gat, Frontar passa ekki,
  hinge collisions, data mismatches) always show. Test in tests/cnc-sides.test.js.
- **Hinge side**: two leaves side by side (vænghurð) = `baedi` even if Smíðagögn has no `hinge` (old data, T-32 Sk6/Sk12),
  so "lamahlið óþekkt" no longer fires there; PRO's rule is now `KP3D.smidaHingeSide` (from `doorLeaves`: two leaves =
  baedi, else swing) — written for every cabinet with a hinged door. Tests in both test files.
- **"Laga í PRO →"** on every card with something to fix (fixed spot top-right, hidden otherwise so nothing shifts):
  `/skipuleggja?pro=<rec>&k=<key>&smida=Sk7` → PRO opens that room (if parked) and Smíða on that Sk (`proOpenSk`).
  Doors (HU) have no PRO deep link yet (PRO has no per-door editor to land on); T-32 has no doors.
- **One status line**: "Tilbúið að skrifa á USB? Ekki enn — N atriði:" + one link per card (first issue, "+n"),
  click = scroll + blink; green "Allt klárt — skrifa á USB" when none. Status-filter chips removed (search/type stay).
- **Failed load**: a card "Gat ekki sótt … — Lykillinn virkar ekki / Fannst ekki / Villa á þjóninum / Ekkert samband"
  + "Reyna aftur", raw "Airtable 403" as small print (was inside the project dropdown).

### Doors from the PRO drawing (2026-10-26)

`doorPlan(fields, catalog, smida)` — `smida` = the door Line Item's Smíðagögn (cnc.html passes `lineSmida[u.id]`). Its
`door` (widthMm/heightMm/wallMm) and PRO's `door.cnc` {karmZ, karmB, topp, hinge, lock, threshold} fill ONLY Eyðublað
fields that are empty (Hæð, Breidd, Dýpt, Þykkt karms, Karmabil frá vegg, Toppstykki hurðakarms, Lamir/Skrá/Felliþr.),
hardware only when the id is in HINGES/LOCKS/THRESHOLDS (never guessed); each fill is one ⚠ line "Úr PRO-teikningunni
(autt á Eyðublaði): …", so such a door is never ✅ silently. Opnun is not copied (the drawing's side is quoted in the
"Opnun vantar" ⚠ — the shop's DIN convention isn't confirmed to match). A fully filled Eyðublað plans exactly as before
(test in tests/cnc-doors.test.js; T-54's six door cards compared before/after: identical). The card's "Op H × B" now
shows the plan's numbers (same as the Eyðublað's when filled). Where PRO sets these: Hurðir → Hanna → Smíða
(docs/pro-finish.md).

### Legacy projects — /smida (2026-10-26)
`cnc-data.js` now holds /cnc's queries + per-unit maps (`CNCDATA.load/sideInput/gripFor/legacy`), shared with `/smida`
("Smíða úr Eyðublöðum", docs/pro-finish.md) so both plan from identical rows. On a project whose Eyðublöð no Line Item
made, each card's fix link is **"Laga í Smíða →"** (`/smida?…&unit=`). New Smíðagögn key: `oven.boards:"list"` — every
board/shelf of an old Ofnaskápur is in `oven.shelves` (Sögunarlisti counts the niche boards as fixed shelves); no
automatic Loftunarbotn/-toppur then. Card labels on such projects use `SD.shortName` ("Sk 5-8", was "Sk").
Seen, not changed: a multi-cabinet Eyðublað (T-15 Sk 5-8, 4 cabinets) lists its door front "keyra ×1", not ×4.

### Calm side view (cnc-bpp.js, 2026-10-26)
`buildCard(file, text, outEl, toolbarEl, opts)` now opens side and door-front files in a **calm view** by default
(`renderCalm`): the panel standing up like the cabinet (bottom down, front edge left), only hinge-plate holes (ring at
37 mm), shelf-pin rows (two dots per hole row), fixed-shelf lines, drawer/inner runner lines (Merivo slot + 80, Legra
+ 62.5, inner at its X); thin lines, labels as hover tooltips, no grid/legend/coordinates. "Tæknilegt" on the card
switches to the BiesseWorks window (macro list, legend, raw ops); "Einfalt" back. `opts.view:"tech"` starts there;
`opts.accent = {hinge, shelf, inner}` draws those in blue (/smida: set by hand). The CSS is injected by cnc-bpp.js
itself, so /cnc, /bpp and /smida get it; PRO's Smíða still lifts the technical `.bw-canvas-wrap svg` into its zoom view.
Other file kinds (drawer fronts, doors/jambs) keep the technical card only.

### /smida is the CNC page now (2026-10-26, owner)
- **Skrifa á USB in /smida** = /cnc's own writer: /smida loads `/cnc?recordId=…&k=…&embedded=1` in a hidden frame,
  waits for `CNC_API.ready()`, saves its own unsaved changes first, and calls `CNC_API.writeUsb(dir)` with the folder
  the user picked (picker first — the browser needs the click). Same folder, files, GLB=HS_ marks, jamb-wins rule,
  Hurðaskrá append, "6. CNC yfirfarið" tick. cnc.html only gained `window.CNC_API` + `lastExport` + a quiet
  "Opna í Smíða →" link; nothing else in /cnc changed (fallback for now). Test `tests/smida-eydublod.test.js` guards
  that /smida never writes files itself.
- **Parity proven on T-15** (local read-only server, masters copied from `~/bjorninn-cnc-mirror` into two OPFS
  stand-in sticks): /cnc's own button → stick A, /smida's Skrifa á USB → stick B: 76 files each, all 74 .bpp
  byte-identical; only the timestamp line ("Búið til: …") in T-15 CNC skrá.txt / Hurðaskrá.txt differs.
- After the export /smida shows: files written + folder, "Í höndunum" (EKKI GERT lines, FRE, inner drawers that
  don't fit, Stakur-frontur units whose doors hang on a neighbour — no hinges drilled for them, Fataslá), how many notes
  are in CNC skrá.txt, and every written file (click = its card, calm view).

### Collision check on the side (cnc-sides.js, 2026-10-26)
`unitPlan` now records what takes height on a side — boards (fixed/loose shelves, oven boards: [top − thickness, top]),
shelf-pin hole rows, inner-drawer front bands ([runner − 54, + front height]) — and checks: inner drawer vs every board
("Innskúffa M rekst í föstu hilluna í 800 — X mm vantar"), inner drawer above the top board, any runner within 12 mm of a
pin row, any runner within 20 mm of a fixed shelf's fixing line. Each hit is a `check` line and a band in `plan.hits`
(the calm view draws it red); /smida makes them open decisions that block "Yfirfarinn". T-15 as exported today: no hit
on any exported cabinet (Sk 2's inner M front is 662–768; Sk 30.2 hits the top but is ⛔ anyway). Drawer/runner
counts on every T-15 drawer cabinet match Sögunarlisti exactly (Sk 2: E + K runners + one MERVIBOX_INNSKUFFA at 716 = the
"Innskúffufrontur M" row — the "third box" was the inner drawer, drawn too tall in the calm view; fixed).
Calm view since: shelves/boards at their real thickness (top face = the mm /cnc uses), inner drawers dashed as their
front band, a thin fronts column at the front edge (`opts.fronts`), red collision bands (`opts.hits`), and the svg
carries data-s/data-lpx/data-top so /smida can drag shelves, hinge plates and inner drawers on it.
- **Hinge plate at true scale (2026-10-26):** the calm view draws the Blum cruciform mounting plate measured from Blum's
  GLB (body 26 × 56.5 r4.5, front wing to 22.8 mm, rear tab to −19, adjusting screw Ø3.6), centred on the plate's screw
  line at 37 mm, long axis vertical, **wing toward the front edge** (the arm clips on that side — the extracted outline's
  own note: +x = toward the front edge / arm side). The front elevation in /smida keeps the round hinge marks (seen from
  the front the plate is inside the side, and at that scale a plate is a few px).
- **Fronts in /smida's CNC view:** under the two sides, one small card per front from `plan.fronts` (exactly what the
  export writes): drawer fronts with the master's extra row (E 218 / C 203.5 / F 235.5) and any grip milling, door fronts
  with their Ø35 cups (IKEALOM ends, 22.5 mm in from the hinge edge), "×n" and "engin borun". Note: "Sama fræsing á öllum
  skúffufrontum (sameiginlegt master)".
