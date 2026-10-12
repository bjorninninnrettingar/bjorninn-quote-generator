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
  - loose shelf = one `LAUS_HILLA` with 3 positions (at the shelf, one above, one below), shelves spread evenly by default (designer later);
  - extra rail (`lpx/3`) on sides over **1000**; masonite groove off for lagna + FRE; FRE thickness is measured per job at the machine;
  - fixed shelves / oven types, FRE, wardrobe rails, door types, front ↔ cabinet links → the designer ("Smíðagögn"), not /cnc rules.
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
