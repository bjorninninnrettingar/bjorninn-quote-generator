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

## QA round (2026-10-26, report `/private/tmp/claude-501/pro-qa-2026-10-26.md`)

Blockers:
- **A1** A PRO project with no drawing (`freshState("byrja")`) had no `categoryData` → Byrja "Áfram" threw. Fixed in the
  Byrja handler; `withEachCategory` also tolerates a state with no room bookkeeping yet.
- **A2** Several rooms queued in PRO: the editor's Áfram button (hidden in PRO) becomes **"Næsta rými: X →"** (wraps
  round the queue, `proNextRoom`); the gate's new first line **"Öll rými teiknuð (N)"** lists every queued room, also
  ones never opened ("ekki teiknað enn") or with no units — "Laga" opens that room.
- **B1** Ný eining → "Úthlið — neðri" came out "há, 19 × 2500": `matchPanelToNeighbour` re-typed it from the tall
  neighbour. The wizard now passes `keepType` (type kept; height only taken from a same-kind neighbour).

Ruglar:
- **A3** A unit no standard product fits: pick its V1 right in the gate (all V1 Útfærslur in `KP_LINEMAP`, by name) →
  `b.v1Pick`, which `v1RecordFor` returns first; Smíða shows "Vara: … (valin í Yfirferð)". Units without a block (door
  lines) keep the "Útfærsla valin í Airtable" tick.
- **A4** Per-cabinet button = **"Skápur yfirfarinn ✓"** (and its notes/toasts); only the project gate says "Klár til framleiðslu".
- **A5** Gate lists in Sk order. **A7** 0 units never counts as done (vara/villur/smíða lines).
- **A6** "Mæling lokið" only when every row is ticked (counted from what's in the room now), labelled "— vista í Airtable" in PRO.
- **A8** A customer drawing (`Sjálfsafgreiðsla — óyfirfarið`) adds a gate line; the bar button is "Merkja teikningu yfirfarna".
- **A10** A failed Vista shows "Vistun tókst ekki: … · ● óvistað".
- **B5** "not yet reviewed" Smíða button is amber, red stays for ⛔. **C4** no Vinstri/Hægri hinge toggle when no door is on hinges.
- **C1** Smíða subtitle counts drawer/oven/shelf/rail/inner-drawer edits ("Breytt hér — fer í Airtable þegar þú vistar").
- **C2** ⛔ hinge collisions get **"Færa lamirnar sjálfkrafa"** (`proAutoHinges`): each colliding hinge moves to the
  nearest clear spot, missing ones are added, written to Smíðagögn so /cnc drills what the drawing shows (the shared
  /cnc default was not changed).
- **D3** Not a wrong number after all: T-32's Airtable lines also sum to 5,545,305 — Vista *would* drop it, mostly
  Halda 765 → 20. kp-price now returns `airtableLinesTotal` (lines × Einingarverð + handles) and the handles'
  Airtable count/amount; the Tilboð compares like with like, shows the Tækifæri's Tilboðsupphæð apart when different,
  and says "Höldur: 765 stk í Airtable → 20 stk í teikningunni (−4,258,656 kr.)". Test in `tests/kp-price.test.js`.
- **E1** Editor toolbar tightened below 1400 px — fits at 1280 (also with "13 ábendingar").
- Error reporter ("Skipulag villur"): already capped 3 / deduped per page load; now also deduped per browser session
  and never sent from localhost or an automated browser (`navigator.webdriver`).

Not done (optional smáatriði): A9, A11, A12, B2–B4, B6, C3, C5, D1, D2, D4, E2.

## Smíða loop round (2026-10-26) — one cabinet after another

Tested on T-32 with the read-only local server (every non-GET `/api` blocked), 1440×900 and 1280×720.

1. **Smíða = one sitting per room.** A strip on top of the box editor (`.pe-nav`, sticky): ‹ Sk1 … SkN › with a dot
   each (green yfirfarinn / amber ekki skoðaður / red ⛔, `proSkList`), the count, ONE primary button that never
   moves — "Yfirfarinn → Sk8" (marks, then `proNextUnready` = next not-reviewed, wrapping), "Skápur yfirfarinn ✓"
   when it's the last one, "Næsti → Sk8" / "Allir yfirfarnir — loka" on an already-marked cabinet — and Loka.
   ← → switch cabinet, Esc closes (window capture listener, skipped while typing; before this ← → in Smíða
   *nudged the selected cabinet along the wall* behind the overlay). Switching selects the cabinet (side panel +
   3D follow, `proEdGo`). "Taka merkinguna af" stays at the bottom. Card widened to 1180 px so 13 Sk fit.
2. Side panel header **"Sk1 · Grunnskápur"** in PRO. **Skoða → Sk-númer** (PRO only, remembered in localStorage):
   `KP3D.setSkTags({id:"Sk1"})` draws a pill on every ordered cabinet's front in the SVG overlay, read off the live
   pickables each frame (follows drags/rebuilds).
5. **"Laga" on every ⛔** (`proIssues(b, c, zone, true)` → `{text, fix}`): drawer errors → `proFixDrawers` (each front
   up to its minimum, the stack made to fill the cabinet by taking from / giving to the front with the most room —
   Sk7: E 215 → 231, K 411 → 395); hinge errors → `proAutoHinges` (which now also counts *added* hinges as a change —
   before, "needs 3 hinges" with a clear middle spot returned "Fann engan lausan stað"). One `save()` = one undo
   step; "Lagað: … · Afturkalla" sits under the list while it's still the latest step (Cmd+Z works too).
6. **Yfirferð "Laga →" lands on the fix**: Efni opens the editor's Efni menu at the missing field (`proOpenEfniAt`,
   blue blink + focus; a wardrobe's own pages still go to the materials step); ⛔ opens that cabinet's Smíða with the
   list blinking; "Hver skápur yfirfarinn" opens the first unreviewed (unchanged, now continues with the strip).
   Also fixed: in PRO the Borðplata select showed "Steinplata" while none was picked (so picking Steinplata did
   nothing) — it says "— veldu —" now. Customer flow unchanged.
8. **Failed load** (`proFail`): no stepper/title behind it, bar = "PRO · Verkefnið opnaðist ekki", a card in the stage:
   401/403 "lykillinn virkar ekki", 404 "það fannst ekki", other HTTP "villa á þjóninum", no response "ekkert samband",
   plus the broken/unloadable-drawing cases; "Reyna aftur" reloads; the raw "HTTP 403" only as small print.
9. **"Opna til breytinga"** = `proDialog` (PRO-styled, Esc/outside = cancel, Enter = main button) listing what to run
   again, in order: keyra skipulag → yfirfara breyttar einingar → keyra pöntunarlista, and re-export CNC.

Not exercised: a hinge "Laga" live (T-32 has no hinge collisions now; same `proAutoHinges` as C2).

**Follow-up — "+ Næsti hægra megin" (same day).** Adding a cabinet in PRO asked twice (Ný eining's sizes/innvols,
then Smíða again). The Smíða strip now has **"+ Næsti hægra megin"** next to the green button (`proNextRight`): closes
Smíða, opens Ný eining straight on the sizes step with the current cabinet's type (the tree option with the same
type, drawers-or-not matched), on the same wall, and sets `uwPlaceAfter` — "Setja inn" puts the new unit flush right of
the cabinet (`uwAfterPlacement`), then Smíða opens on the new Sk as before, so a whole run is drawn in one loop. No
room right there → the usual placement + toast "Ekki pláss beint hægra megin — settur á næsta lausa stað"; the
narrower-width offer still applies. Disabled on island boxes. Tested T-32: Sk6 → Sk14 flush (gap 0), Sk13/Sk3 → toast.
Kept to the Smíða side + the placement hook (PRO C is reshaping the wizard itself).

## Tilboð + Vinnuteikningar + skoðunarhamur round (2026-10-26)

Tested on T-32 with the read-only local server, 1440×900 (no Vista, no PATCH reached Airtable; the discount/markup
were only exercised through the `input` preview).

1. **Big quote change can't be missed.** When the drawing's total differs from what Airtable has now
   (`airtableLinesTotal`) by more than 10 %, a red box sits at the top of the Tilboð panel: "Tilboðið lækkar/hækkar
   um X m.kr. (N %) þegar þú vistar" + **Skoða línur** (scrolls to the first changed line, blinks them). Every line whose
   amount changes gets a red edge and "var X kr." / "ný lína" under its total; the Höldur row shows "var 765" / the old
   amount. kp-price now returns `was` per line (Airtable's Einingarverð × Magn × vsk, 0 for a new line). Under 10 % only
   the calm grey line + yellow notes, as before. T-32: −4,15 m.kr. (75 %), mostly Höldur 765 → 20, and every line is
   marked because the drawing's materials differ from the Tækifæri (so Vista really re-prices every line).
2. **Ósýnilegur afsláttur / Smáverka álagning** have an ⓘ (hover/focus tooltip: what it does, that it isn't a line on
   the quote, only the office sees it, when it's written). The total moves **while typing**: the panel sends
   `project:{hidden, small}` to kp-price as a preview (unchanged lines = Airtable's Einingarverð × new/old factor, a
   price-locked line stays as is, handles untouched); the PATCH to the Tækifæri still happens on change/blur, and now
   says so if it fails ("Vistaðist ekki á Tækifærið …"). T-32: 10 % → 1,390,685 → 1,262,106. Test in tests/kp-price.test.js.
3. **Skápalisti** = a sheet after the rooms' sheets (T-32: blað 5 of 5), same A3 frame / right column / title block,
   in the preview, Prenta / PDF and Vista á Tækifæri (same `pages` array). `KPWD.cabinetSheets` (18 rows a sheet, room
   group headers when several rooms, "(1/2)" when long) from `wdCabinetRows()` in the planner, which reads each
   **Line Item exactly as Vista sends it** (`collectLineItems` → its Smíðagögn JSON, V1, Frontaefni #2); door/hinge
   counts come from `proDoorsOf`/`proSpec` (what smidaFor/cnc use), ×2 leaves when `hinge:"baedi"`. Columns: Sk,
   tegund · V1, B × H × D (skrokkur), framhlið (FR1/FR2 + innskúffufrontar), skúffur ofan frá with Sérhæð, hurðir/lamir,
   hillur (lausar/fastar, LH over an oven, slár), grip/höldur (Fræst grip or the project's handle), athugasemd (ofn, vaskur,
   skiptir frontar, LED, eyja, no V1, "Ekki yfirfarinn í Smíða"). Listed on the cover when there is one. Size: goes
   through api/kp-workdraw.js (4.3 MB cap), not kp-drawings; T-32 at 180 dpi = 273+312+244+243+438 KB PNG ≈ 1.5 MB,
   the 150 dpi fallback is unchanged. Rows use their own Icelandic plural (`wdPl`) so the sheet never translates.
4. **Grunnmynd**: Sk labels 2.3 → 4.6 mm (shrunk only where the footprint is too small, rotated on a deep narrow one),
   drawn after every footprint with a white halo (a dashed wall unit above ran through SK1/SK5). ATHUGASEMDIR on every
   sheet's right column is black, 2.5 mm (was green 2.1), stops above the legend with "… fleiri athugasemdir".
8. **Skoðunarhamur**: `proRoSync()` (called from proBar) puts `body.pro-ro` while locked: "+ Ný eining" grey, undo/redo,
   Sökkull, ← Til baka, the cabinet float bar (færa/læsa/afrita/fjarlægja), the editable size chip and "+ Næsti hægra
   megin" dimmed, all with the title "Opnaðu til breytinga fyrst"; a capture click listener swallows their clicks with a
   toast. "Opna til breytinga" restores titles and clicks. Still possible while locked (not changed): dragging a cabinet
   in 3D, keyboard ⌘Z / Delete, the side panel's own edit fields — local only, Vista isn't offered.

## PRO → CNC round (2026-10-26)

Tested locally on T-32 at 1440×900 with the read-only server (every non-GET `/api` call blocked).

- **Smíða "Hlið · CNC" tab** (item 3). Tabs "Framhlið | Hlið · CNC" above the drawing (`peView`). The side view runs
  the cabinet's current Smíðagögn (`smidaFor`) through the SAME code /cnc exports with: `proCncRows` turns it into the
  Sögunarlisti rows ÚRVINNSLA would cut (side, "Skúffufrontur X - Merivo/Legra", "Frontur" / "Frontur vænghurð" ×2 /
  "Skiptur frontur N", Laus/Föst hilla counts, inner drawer fronts) → `CNCSIDES.unitPlan` → `sideFiles` →
  `renderSide` (stand-in master `PRO_CNC_MASTER`, so macros sit before STAT_BLOCK — same drilling, not the master's
  order) → `CNCBPP.buildCard` (cnc-bpp.js, lazy-loaded on first use so the customer planner never fetches it). Shows
  one card per side file (e.g. "Vinstri hlið - lamir ×1" + "Hægri hlið ×1"), /cnc's own ⛔/⚠ notes, and the front
  files under "Frontar". No geometry is duplicated; sizes are the drawing's (the real file uses Sögunarlisti, and /cnc
  flags > 20 mm differences). The side box takes exactly the drawing's size (scrolls inside), so nothing on the
  right moves between tabs.
- **Wide door cabinets = two leaves** (item 4, T-32 Sk6 Efri skápur 1200). Checked against the real T-32 data
  first: Sögunarlisti has "Frontur vænghurð 997 × 597" ×2; /cnc pairs them as one opening ("Vænghurð"), drills the
  hinges in both sides ("Hliðar - lamir báðum megin" ×2) and writes the door-front file ×2 — **export was right, only
  the drawing was wrong**. Smíða now draws two leaves (each its own hinges, title says which side); both leaves share
  the opening's hinge heights (one side file run ×2), so dragging a marker on either moves both, and the door section
  says so. Regression test in `tests/cnc-sides.test.js` (one Smíðagögn door + two leaves → designer hinges, both sides,
  front ×2).
- **After "Klár til framleiðslu"** (item 7). `proRunSkipulag` now checks the PATCH responses, then `proWatchSkipulag`
  polls Line Items (read-only, backoff 4 → 15 s, gives up after 5 min with what's still waiting + "Athuga aftur").
  Keyra skipulag 📝 stamps `Síðast samstillt timestamp` (unix s) on every line it wrote, last of all, so done = a line
  stamped since the run started, none left "⚠️ Breytt eftir stofnun", same count two polls in a row (or nothing to do
  after 75 s). Then it counts Sögunarlisti and names units with no Sögunarlisti rows ("keyrðu Yfirfara á þeim") —
  Keyra skipulag itself only makes Eyðublöð; Sögunarlisti comes from Yfirfara 3.0 per unit. The Yfirferð panel always
  has the status line + **"Opna CNC-útflutning →"** (`/cnc?recordId=…&k=…`, new tab) in the same place; the locked bar
  got a **CNC** button. Proxy: Line Items' `🔑`, `Eyðublað búið til ✏️`, `⚠️ Breytt eftir stofnun`,
  `Síðast samstillt timestamp` readable behind VERK_KEY. The real run was not exercised (writes are blocked locally):
  the watcher was driven with stubbed Line Item responses in the page (first poll stale, then stamped) against the real
  Sögunarlisti read → "Skipulag keyrt ✓ · 13 Eyðublöð uppfærð · Sögunarlisti 90 hlutir", and with an empty Sögunarlisti
  → "13 einingar án Sögunarlista (Sk1, …)".

Found, not changed: Keyra skipulag sets "Tveir frontar" on an **Efriskápur from 500 mm** (`width >= 500`, other units
`> 600`), but Smíða / the 3D / `smidaFor`'s `hinge` use **> 600** everywhere. A 500–600 mm wall cabinet would get two
leaves in Sögunarlisti while Smíðagögn says hinges on one side only → /cnc would drill hinges in one side for two
leaves. T-32 has none in that range; needs a decision on which rule is right.

## /cnc reads PRO (2026-10-26)
`&smida=Sk7` on a PRO link opens Smíða on that cabinet (`proOpenSk`, opens a parked room first) — /cnc's "Laga í PRO →".
Smíðagögn `hinge` now comes from `KP3D.smidaHingeSide` (same rule as before, from `doorLeaves`). /cnc reads the Line
Items' Smíðagögn for the review mark, so **"Skápur yfirfarinn" only reaches /cnc after Vista í Airtable** — T-32's saved
drawing has no marks at all. Details in docs/cnc.md.
## New project round (2026-10-26) — starting a project in PRO is fast

Tested on T-199 (`rec0Hylqy26rrPmKz`, no drawing, no contact) and T-32 with the read-only local server, 1440×900 and
1280×720; customer Eldhús walked end to end (5 room pages + 5 Efni pages unchanged).

1. **Header**: `proNameHtml()` — "T-199 · Nýtt verkefni" while the name has no contact ("T-199 | -"); the T-number is
   its own span that never shrinks, only the contact/address part ellipsizes (full name in the tooltip).
2. **Progress**: PRO hides the customer stepper; `#proSteps` (in `updateStepper`) shows "1. Rými › 2. Rýmið — Eldhús
   (1 af 2) › 3. Teikning" on the room pick and the Rýmið page only.
3. **Rýmið = one page** (`renderProRoomBox`, `#shapeProBox`): PRO's shape step is always the sizing drawing
   (`shapePhase = "size"`, walls still drag); a fresh room starts as the room kind's usual shape (`proDefaultShape`).
   Beside it: shape tiles, Lofthæð, then per wall its length + Opið, each window/door/op (frá horni, breidd, hæð, frá
   gólfi, ×), "+ Gluggi / + Hurð / + Op / + Vatn" and the water point (frá horni) — all mm, Enter commits and moves to
   the next field, the drawing redraws, dragged walls update the table (`syncProRoomVals`), the water point is drawn as
   a marker. Writes the same fields the five pages did (walls, roomHeightMm, windows, doors, waterWall/waterAlongMm,
   openingsDone). Obstacles (ofnar, lagnir) stay in the editor's "Gluggar og hindranir". The editor's "← Til baka"
   goes back here in PRO (it went to the Efni pages). The Mæling sheet is unchanged (it's the on-site tick list).
5. **Efni skipped in PRO**: "Áfram í teikningu →" (`proRoomDone`) → `proMatDefaults()` puts in the usual materials
   (room kind's `categoryDef.defaults` first, else dökkgrátt / Merivo / Egger W1000 white / Jey / W1000 top; no top in a
   wardrobe) and remembers each in `state.matAuto` (a ROOM_FIELD, copied with the materials to the project's next room).
   A material is "óákveðið" while it still equals what was put in (`matUndecided()`): the Efni menu shows an amber
   ÓÁKVEÐIÐ tag on that field; Yfirferð's "Efni og höldur valin" row is not green and lists them, "Laga →" opens the
   Efni menu at the first one, or tick "Sjálfgefnu efnin eru rétt" (ack tied to the set, like Ábendingar). Picking any
   other value clears it.
7. **mm in the Ný eining wizard in PRO**: chips, "Annað mál" input (min/max/step), folded headers, corner notes,
   Lausar hillur / hung-unit chips and the preview's dimension lines use `uwN` / `uLen` / `uUnit` (customer still cm).
8. **Kitchen Ný eining = one type list** (`KITCHEN_TREE`, customer and PRO): 25 types under group headings
   (Grunnskápar, Háir, Efri, Eldhústæki, Eyja, Úthliðar), three a row, descriptions in tooltips — fits one screen at
   1440×900 (7 px scroll at 1280×720). A click goes straight to Mál → **Skúffur eða hurðir** (picture cards, `frontsWiz`,
   the kitchen's one Grunnskápur / Vaskaskápur / Lítill kassi) → Innvols; Eyja / Bak á eyju go straight to their own
   config. **PRO kitchen is short** (`uwShort`): Breidd (+ Skúffur eða hurðir) then Setja inn → Smíða; úthliðar and
   Lausar hillur keep their sizes. Þvottahús keeps `UNIT_TREE`-style two levels; Fataskápar/Bað unchanged. PRO A's
   "+ Næsti hægra megin" finds the type in the new tree and starts a door cabinet's neighbour with a door.
   EN strings for the new labels in kitchen-planner-i18n.js.

Not done / left as is: the T-199 contact itself (Nýtt verkefni until a Tengiliður is linked in Airtable); Þvottahús'
tree; PRO bath/wardrobe wizards still show all sections.

## Mæling as a panel + fitting measurements (PRO C follow-up, 2026-10-26)

- **Mæling no longer jumps** to "Stilltu stærð rýmisins": `openMeasurePanel()` opens the sheet over wherever you are
  (editor, the Rýmið page, Smíða's room) and "Loka" / Esc leaves you exactly there. Changes redraw what's behind it
  (`mpRefresh`: the editor, or the sizing drawing + Rýmið table). On the Rýmið page the table underneath is hidden
  while the sheet is open (`body.mp-open`), so every value is typed in one place. Enter = next field, like Rýmið.
- **Three new sections** (optional — they don't count toward "x af y staðfest"), in `state.measurement` (planner JSON,
  per room via `room: activeCategory`):
  - `rafmagn: [{id, room, wallId, kind: tengill|dos|rofi, offsetMm, heightMm}]`
  - `lagnir: [{id, room, wallId, kind: vatn|frarennsli|hiti|annad, offsetMm, heightMm}]`
  - `skekkja: {<room>: {floor: mm/m, walls: {<wallId>: mm/m}}}`
- **Vinnuteikningar**: each point is a marker on its wall elevation ("Dós 2775/1100", `wdMeasureFor` → sheet
  annotations) and a line in that sheet's notes; a wall's out-of-plumb is a note on its sheet; the floor slope and the
  point counts go in the room's ATHUGASEMDIR (`wdMeasureNotes`). There is no separate "workshop note" field in the
  planner, so the drawings' notes column (what the workshop reads) is where it lands.
- Verified on T-32 via `&maeling=1` (locked project, local only) and on T-199's Rýmið page.

## Fataskápar in PRO (2026-10-26)

Tested on T-199 (`rec0Hylqy26rrPmKz`, fresh wardrobe: straight wall and corner) and T-32 with the read-only local
server, 1440×900 and 1280×720; customer Fataskápar walked Rými → Efni → Skipulag → Ný eining, unchanged (cm, no
Rennihurð in the wizard, three unit types).

1. **Fylla vegginn in PRO**: the same `#closetFillOffer` (PRO styling), text in mm per wall ("3 × 788 mm · tvær hurðir
   á hverjum · svo Smíða á Sk1", a corner "Veggur 1: 2 × 861 mm · Veggur 2: 571 + 570 mm"). After `fillCloset()` PRO
   opens Smíða on the first Sk (`proSkList()[0]`, may be the úthlið) so "Yfirfarinn → næsti" walks every unit.
   "Ég raða sjálf/ur" now shows the brown area in 3D in PRO too (`closetEmptySpans` no longer skips PRO).
2. **Skápurinn on the PRO Rýmið page**: under each wardrobe wall `proClosetSpanRow(i)` — Allur veggurinn / Hluti, the
   part's width in mm, Vinstri / Miðja / Hægri (a corner: "frá horninu"); same `setClosetSpan` as the customer's cm row.
   Dragging the brown area's ends keeps the mm box in step (`syncProRoomVals`).
3. **Hurðir step in PRO's wardrobe Ný eining** (before Innvols): Með hurðum / Rennihurð í hlið / Opið (`uw.doorKind`);
   Rennihurð is written after Setja inn with `applyClosetDoorKind` (the side panel's own door-kind code, now shared).
   PRO keeps its own Innvols (hardware rows), Smíða opens next as before.
4. **Úthlið + Horneining** in PRO's wardrobe tree (`FATASKAPAR_TREE_PRO`): Úthlið = `uthlidhar` (height from the
   neighbour, `keepType`); Horneining (corner shapes only) = the open shelf unit fillCloset puts in the corner square
   (depth + 60 mm wide, Hillur), always placed at the corner end of its wall ("Hornið er ekki laust" otherwise).
5. **Progress strip**: `.pro-steps{display:flex}` beat `[hidden]`, so the strip stayed on "2. Rýmið" in the drawing.
   It now shows "3. Teikning" in the editor (kitchen too); "2. Rýmið" there goes back to the Rýmið page (not while locked).
6. **mm on the Rýmið page in PRO**: wall dims ("2400 mm", "Veggur 1: 2400 mm"), the brown area's label. Also the 3D
   wardrobe width labels / total width / height and the drawer-hover tag go through `dimLen` / `gapText` (mm in PRO,
   customer text identical).
7. **Hlið · CNC**: the side file fills the column in a zoom box (`.pe-zoom`: wheel / ctrl-wheel = trackpad pinch / two
   fingers / − 100% + in the corner / double-click; drag to move; `peZoom` kept per cabinet + file across re-renders);
   several side files = chips on top (`peCncFile`). /cnc's notes are one-line rows with a line icon (stop / warn / info),
   the whole sentence in an ⓘ tooltip (`proCncTips`, fixed-position so the scrolling box doesn't clip it); the long
   "Sama og /cnc borar…" explanation is the ⓘ on the bar; "Ekki merktur Skápur yfirfarinn" is dropped here (the strip
   already shows it). Legend, Hráar aðgerðir and Frontar stay under the drawing.

Not done: at "100%" a side (2470 × 563) is only ~90 px tall in the ~390 px column — zoom is the way to see detail; the
column wasn't widened so the right side doesn't move between tabs.

## Baðherbergi in PRO (PRO F, 2026-10-26)

Tested on T-199 (fresh bath, "+ Vatn" on Veggur 1) and a customer-drawn bath (Horn) loaded in PRO, read-only server.

1. **U-skúffa (vatnslás)**: every bath vaskaskápur with drawers (`bathSinkUnit`) marks its top drawer automatically —
   Smíðagögn `vatnslas:{drawer:"M", cut:"U"}`, a dashed blue "U · vatnslás" cut drawn on the top drawer in Smíða. No
   /cnc macro exists (docs/cnc.md has none), so it's a hand job: a line on the Skápalisti ("U-skúffa (vatnslás):
   M-skúffan efst — í höndunum") and in that wall sheet's notes on the workshop drawing ("SK1: …").
2. **Toppur** section in Smíða for a bath sink unit (`b.bathTop`, `bathTopOf`): frárennslisgat (centred by default,
   mm from the left side / from the wall, "Miðja" resets), Krani Í toppi / Á vegg / Ekkert, kranagat mm when in the top
   (default centre, 60 mm from the wall), a small plan of the top beside it. Smíðagögn `toppur:{gat:{x,y}, krani,
   kranagat?}`; Skápalisti + workshop sheet notes via `bathSmidaNotes(sm)`. Note: adding vatnslas/toppur changes
   the Smíðagögn hash, so a bath sink unit marked "Skápur yfirfarinn" before this needs marking again.
3. **Upphengi**: drilled by hand — no /cnc rule. Every bath unit (hung) gets "Upphengi — borað í höndunum" on the
   Skápalisti and the workshop sheet, and Smíða's Hlið · CNC tab has info lines "Upphengi: borað í höndunum, ekki í
   skránni" (+ "Göt í toppi og U-skúffa: …" on a sink unit). Computed from the room, not stored in Smíðagögn.
4. **Camera**: the bath framing in buildScene framed only the units (an 80 cm vanity padded to 1.4 m → 2.3 m away,
   bottom cut off). PRO (`darkBg`) frames the whole unit wall; customer unchanged.
5. **mm tags**: the 3D wardrobe/bath unit width tags went through `dimLen` in the wardrobe round (that was the "80 cm").
6. **Shapes**: PRO's Rýmið page offers a bath the customer's shapes — Einn veggur / Horn — plus "Allt herbergið"
   (rect); a fresh PRO bath starts as Einn veggur; open walls get no "Opið" toggle. A customer bath (Horn, 3 units,
   water) copied into PRO loaded and opened the Rýmið page with identical walls/units/water/shapeKey.

## Innihurðir in PRO = the customer's HU system (2026-10-26)

- **Hurðir** (PRO bar) opens the customer's "Hurðirnar þínar" list + **Hanna** popup — same code (`openDoors`,
  `renderDoorStep`, `openDoorWiz`), as an overlay over the editor (`#screen-hurdir.pro-hd`, `proDoorsShow`): `state.step`
  stays where it was, so the editor's 3D/undo are untouched; "← Til baka" on the list / "Klárt" on Yfirlit / Esc close it.
  Opening it changes nothing (no auto HU-1 row in PRO — an empty project stays clean). The old one-row-per-door overlay
  (`openDoorList`) is removed.
- **mm**: inputs, dimension lines, summaries, review (`dU`/`dFmt`/`dParse`/`dLim`); ranges `KPDOORS.LIMITS_PRO` = the
  old overlay's (B 400–3000, H 1500–3200, vegg 50–400), so no stored door becomes invalid. Customers keep cm + LIMITS.
- **Exact hardware** on the steps (`KPDOORS.PRO_HW`): Lamir "JNF Coplan · faldar lamir (innfelldar)" /
  "JNF IN.05.020.100 · sýnilegar (samlokulamir)", Skrá "JNF IN.20.835" / "JNF segulskrá IN.20.976.60.B",
  Felliþröskuldur Já/Enginn. Same stored values as before (`opt.lamir` innfelldar|samloku, `skra` jnf|segul, …).
- **Smíða** (PRO-only last section): Fjöldi eins, Athugasemd, and for /cnc: Þykkt karms (37), Karmabil frá vegg (6),
  Toppstykki (Ofan á hliðum / Á milli hliða), and the hardware /cnc mills (selects from cnc-doors.js HINGES/LOCKS/
  THRESHOLDS, loaded only in PRO): "Sjálfvirkt" = faldar → JNF Coplan, felliþröskuldur Já → Felliþröskuldur
  (`KPDOORS.CNC_AUTO`); the lock is never automatic; "Ekkert (fræst í höndunum)" = none. Stored as `d.cnc`, sent as
  Smíðagögn `door.cnc` (`KPDOORS.cncOf`) + "Karmur: …" in the note. Every PRO-saved door gets `cnc` (defaults).
- **Old field → new home**: Rými → list dropdown (old values like "Eldhús"/custom kept as their own option); Gerð → Gerð
  (+ Fleiri gerðir); Lamir / Felliþröskuldur / Skrá → their steps; Efni hurðarblaðs → Útlit; Op í vegg B×H + Veggþykkt →
  Mál (mm); Lamir vinstra/hægra → Opnun; Fjöldi eins + Athugasemd → Smíða.
- **Migration**: `KPDOORS.migrate` (on opening a door) only fills `designed:true`, `frame:"innf"`, `opt:{}` — the HU
  line is byte-identical before/after (test "migration: an old PRO door row…" in tests/kp-doors.test.js). Checked in
  the UI by injecting old-format rows into T-32's loaded planner JSON (browser-side, nothing written): both rows opened
  unchanged, nothing marked óvistað until a door is saved. T-32 and T-199 have no doors in Airtable today.
- Verified 1440×900 on T-32 (unlocked locally) and T-199: add, Hanna, Eins og HU-1, Afrita, Eyða, Breyta, Yfirlit,
  Klárt → back in the editor; customer Innihurðir unchanged (cm, plain words, no Smíða, no `cnc`).

## Vista / Klár til framleiðslu — no silent data loss (PRO F2, 2026-10-26)

Tested on T-32 with the read-only server (every write fails → the failure path is real); the success / conflict
paths with `fetch` stubbed in the page, and server-side in `tests/kp-pro.test.js`.

1. **Two computers**: the page sends `basedOn` = the `proSavedAt` its copy came from (`state.proSavedAt`, null = never
   saved from PRO); kp-pro.js answers **409 `{conflict, savedAt}`** without writing anything when Airtable's
   `proSavedAt` is newer (`force:true` skips the check; no `basedOn` at all = an old cached page, not checked), and
   returns the new `proSavedAt`, which the page keeps for the next Vista. The page shows a PRO dialog "Einhver vistaði
   þetta verkefni kl. HH:MM í annarri tölvu" — **Sækja nýrri útgáfu** (drops the local copy, reloads) / **Skrifa samt
   yfir** (`force`) / Hætta við. On load, a dirty local copy no longer gets a native confirm: a PRO dialog shows the
   local edit time (`STORAGE_KEY:at`, written by `save()` in PRO), the version it was based on, Airtable's save time,
   and which is newer; Esc keeps the local changes (nothing is thrown away by accident).
2. **Keyra skipulag**: one PRO dialog — "Vista og keyra skipulag" when anything is unsaved (else "Keyra skipulag"),
   "Hætta við" does nothing. It saves first and runs only if that save reached Airtable — the old native confirm's
   "Hætta við" ran on the stale data. "Klár til framleiðslu" goes through the same dialog (no second confirm).
3. **Failed save**: Yfirferð stays open with a red box "Vistun tókst ekki." + an Icelandic reason (`proSaveErrText`:
   no connection / 401–403 lykill / 409 / 400 / 429 / 5xx) + "● Óvistað …" while dirty + **Reyna aftur**; the bar says
   "Vistun tókst ekki · ● óvistað". A failed save from anywhere (e.g. Mæling lokið) opens the panel the same way.
   Vista í Airtable in the panel now closes it only once the save worked.

## Multi-room PRO projects (PRO F3, 2026-10-26)

Tested on a fresh T-199 with Eldhús (1 Grunnskápur) + Fataskápar (Fylla vegginn, 5 units) and T-32 (one room,
unchanged), read-only server, 1440×900.

1. **Smíða strip = the whole project**: `proSkList()` reads every room through `withEachCategory`, grouped in queue
   order with the room's name between groups ("Eldhús Sk1 | Fataskápar Sk2 … Sk6"), counter over the project. Items
   carry `uid = "<room>|<block id>"` (block ids repeat between rooms); `proEdGo(uid)` opens the other room behind the
   popup (`openRoom`) and keeps Smíða open. Walked: Sk2…Sk6 in Fataskápar → "Yfirfarinn → Sk1" crossed into Eldhús, the
   room tab followed. Fylla vegginn still opens Smíða on the first Sk of THIS room.
2. **Efni row per room in its own words** — root cause: `catBase()` (isCloset/isBath/…) and `activeMatPhases()` read
   `state.activeCategory` even while `withEachCategory` visited another room, so the kitchen was checked against the
   wardrobe's pages ("Eldhús: stærð og litur vantar"). Both now use `SK_CAT` (the room being visited) first; so do
   `activeUnitTree`, `cabCfg`, `typesForZone`, `topGroupsNow` and the Mæling notes (`wdMeasureFor/Notes`). This also
   makes Vista / Teikningar / Skápalisti build a non-active room's lines with its own rules (e.g. a bath's U-skúffa
   notes, a wardrobe's types) — before, they followed whichever room was open. Undecided materials are listed in the
   Efni menu's order: "Eldhús: skrokkur, …, borðplata · Fataskápar: skrokkur, …".
3. **Room tabs**: right end of the PRO strip (`.ps-rooms`, shown with 2+ rooms, queue order so they never move), the
   open room marked, one click opens any room (closes Smíða first). "Næsta rými: X →" kept.
4. **Inherited materials**: a new room that took another room's materials remembers it (`state.matFrom`, a ROOM_FIELD).
   In PRO there's no toast; the room's Efni menu starts with "Erfir efni frá Eldhúsi · Breyta fyrir þetta rými" (the
   link jumps to the first material). Customer keeps the toast.

## Smoke-test fixes (2026-10-26)
1. **"+ Næsti hægra megin" never repeats a one-of-a-kind unit** (`proNextRight`): vaskaskápur, ofn(askápur), tæki
   (uppþvottavél, ísskápur/frystir, vínkælir, þvottavél), ruslaskápur, horn, the wardrobe's horneining → the run's
   normal unit: Grunnskápur with drawers under the worktop (same width when it fits its range), Hárskápur in a tall run,
   Efri skápur on the wall. Ordinary types repeat as before. T-199: vaskaskápur 800 → Grunnskápur 800 → Grunnskápur.
2. **One PRO side panel at a time** (`proSoloPanel`): Yfirferð, Tilboð, Mæling and Hurðir close each other; Yfirferð,
   Mæling and Hurðir also deselect the cabinet (they float over its panel). Tilboð + the cabinet panel may stay together
   (the drawer narrows the editor and highlights the selected cabinet's lines). The header cut ("RO T-199 · Nýt…") was
   the Tilboð drawer's width taken off the header twice (`body.pro.tp-open .top` padding inside `#mainWrap`) — the bar
   now fits at 1440 and 1280, no horizontal scroll. Also: the big-change alert said "(Infinity %)" when Airtable had
   0 kr — no % then.

## Borðplata as a real object in PRO (2026-10-26)

Before: the worktop was only a name (`state.top` → "Valin borðplata: …" in the note), not clickable, no sizes, not on
the quote / Skápalisti / Vinnuteikningar. Now [kitchen-planner-worktop.js](../kitchen-planner-worktop.js) (`window.KPWT`,
pure, runs under node) + small hooks in the planner. Tested on T-32 (straight runs, harðplast + stone) and T-199 (L, U)
with the read-only server at 1440×900; tests in `tests/kp-worktop.test.js`.

- **Two kinds** (user): in-house = harðplast / compact / límtré — cut here, every number is production data; stone =
  ordered, the stone maker measures on site: only the choice, rough size (for the quote) and where sink/hob/tap go.
- **Pieces** = `KPWT.compute(state, KP3D)`: one per contiguous counter run (same height), over the áfella at a wall end;
  ends are `wall` (wall / áfella / tall unit), `free` (overhang + finished edge offered) or `joint`. Depth = deepest
  cabinet + 20 front overhang (what the 3D always drew); thickness from the top (`KP3D.topThickM`). Islands: one piece
  per row (a two-row island is two pieces back to back — joining them is a hand note for now).
- **Joints**: a 90° inward corner where the previous wall's run reaches the corner and the next starts at the corner
  clearance. **No default** — Skáskorið 45° / Beint — A í gegn / Beint — B í gegn. Unchosen on an in-house top = ⛔ in the
  editor and in Yfirferð (Laga → the editor on that joint, blinking). Stone: optional. Non-90° corners: a note only.
  Lengths are on the back edge; a mitred piece also says "framan N".
- **Cutouts** (auto, movable in mm from the piece's left end / back edge, "Yfir skápnum" resets): sink over every
  vaskaskápur (size like the 3D, `ofan á` for harðplast/límtré, `undirlímdur` for compact/stone), tap Ø35 behind it
  ("í borðplötu" can be unticked), hob over the low oven unit (Ofnaskápur í grunnskáp) or any counter cabinet picked in
  "Helluborð", 30/60/70/80/90 cm with standard cut sizes. In-house: a cutout closer than 40 mm to an edge = ⛔.
- **Kantar**: framkantur, free ends, island back; **bakkantur upp við vegg** yes/no + height (counted in m²).
- **Stored**: `state.worktop` (now in `ROOM_FIELDS`, so per room) holds ONLY overrides — `pieces[id]` (lenMm, depthMm,
  front, ovL/ovR, edges, upstand, note), `joints[id]`, `cut[id]` (dx/dy/w/d/mount/off), `hob {id, w}`, `stonePrice`.
  Ids: piece = `p:<first block id>`, joint = `j:<A>|<B>`, cutout = `v:`/`k:`/`h:` + block id. Old projects have none →
  everything auto. Removing a run's first cabinet drops that piece's overrides (its joint becomes unchosen again — safe).
- **Editor**: tap the worktop in 3D (PRO only, `buildScene({pickWorktop})` makes the top slab a locked pickable, so it
  never drags the cabinet; hover outlines just the slab) or Efni → "Smíða borðplötu". Same white card as Smíða: plan on
  the left (click a piece / joint), ⛔ list on top with Laga, Samskeyti, piece tabs, Helluborð; Esc / Klárt close.
- **Line Items** (PRO only, customer flow unchanged), n = the room's place in the queue:
  `BP<n>` = "Borðplata - Efni viðskiptavinar | m² verð" (rec2hrdZTzZSKO4Gx), Magn = m² rounded up (Magn is an integer
  field; same as the hand-made lines); `BV<n>` = "Fræsing f. vask og blöndunartæki" (recjwxEFkBL17Q9gW) × sinks;
  `BH<n>` = "Fræsing f. helluborði" (recPElwpyIEo8inKq) × hobs. Smíðagögn of BP = `{v:1, w, h, d, bordplata:{kind, top,
  m2, pieces:[{id, wall, len, depth, front?, ends, miter?, edges, upstand?, note?, cutouts}], joints}}`; BV/BH carry their
  cutouts. Stone: one BP line with **no V1** + a note with the rough size, positions and the stone maker's price.
  kp-pro / kp-price / kp-submit accept `BP|BV|BH` keys; kp-pro keeps a BP/BV/BH line's **Magn** in step with the drawing
  (same "hand-changed in Airtable wins" rule as Frontaefni #2, kept in `liExtra[key].Magn`); a cabinet's Magn is untouched.
  The note (Skilaboð) is written only when the line is created, like every other line — the numbers live in Smíðagögn.
- **Vörulisti / Útfærslur (read 2026-10-26)**: worktops are priced per m² through the Útfærsla above (Magn = m², the
  Tækifæri's "Borðplata viðskiptavinar 🍽️" × "% í Borðplötu" 1/3 × álagning + 40,676 kr/m²) — ~20 projects already use it by
  hand (Magn 2–32), plus the two cutout Útfærslur at ~19,000 kr stk. There is also "Borðplata, Harðplastlögð, Vaskur,
  Helluborð" (388,000 kr fixed, one old project) — not used. **No stone product exists**: the Tilboð's stone line has a
  manual price field ("verð frá steinsmið", m/vsk, `state.worktop.stonePrice`) added to the total; it reaches Airtable only
  as text in BP's note — someone sets the Útfærsla/price on that line by hand (Yfirferð's "Hver eining tengd vöru" asks).
- **Tilboð**: the BP row says "<top> · 2,49 m² → 3 m² (námundað upp)"; clicking a BP/BV/BH row opens the editor.
  T-32 with Egger F128: BP1 3 m² 330,178 kr, BV1 19,095, BH1 19,000.
- **Yfirferð** gets **Borðplata** (after Efni): red when a room with counter cabinets has no top picked (Laga → Efni at
  Borðplata; "Engin borðplata" counts as decided), an in-house joint unchosen / cutout off the board (Laga → the editor at
  it), or a stone top without its price (Laga → Tilboð, focus on the price). So Klár til framleiðslu waits for it.
- **Vinnuteikningar**: a "Borðplata" sheet per room after the Skápalisti (`KPWD.worktopSheet`): the plan with dims,
  finished edges (blue), upstand (purple dashes), joints and cutouts + a table (L × D × Þ, ends, kantar, bakkantur,
  cutouts from the left end / wall). Stone: an orange "Steinn — mál tekin af steinsmið" band, rough sizes and "hvað fer
  hvar" only. Skápalisti gets one row per piece (`BP1A`, `BP1B` …).
- Not done: the 3D sink stays where it always was (centre of the unit) — moving a cutout changes the data and the plan,
  not the 3D; a straight piece longer than a 4100 mm board only gets a note ("samskeyti á beinum kafla"), no split tool;
  a two-row island's rows are not merged into one slab; the áfella strips' own top in 3D isn't clickable.

## Smíða úr Eyðublöðum — `/smida` (2026-10-26, for T-15)

A project planned the OLD way in Airtable (Eyðublöð + Sögunarlisti, no PRO drawing, no Eyðublað made from a Line Item —
`CNCDATA.legacy`) gets Smíða without being redrawn. Redrawing + Keyra skipulag is NOT an option on such a project:
Keyra skipulag creates an Eyðublað for every unlinked, warning-free Line Item, and T-15 has 54 Line Items none of which
are linked to its Eyðublöð → it would duplicate the whole job (checked read-only 2026-10-26, script of `wflPGRyv0VYi4AZpd`).

- **Entry**: PRO on a project with no drawing but with Eyðublöð asks "Þetta verkefni var skipulagt í Airtable" →
  **Smíða úr Eyðublöðum** (`proLegacyOffer`, one read-only GET) / "Teikna samt". /cnc's per-card link on such a project
  is **"Laga í Smíða →"** = `/smida?recordId=…&k=…&unit=<Eyðublað>` (else "Laga í PRO →" as before).
- **Why not PRO's box editor**: it edits planner blocks and serializes them (`smidaFor`); a legacy Eyðublað has no block,
  and /cnc ignores Smíðagögn whose door count differs from Sögunarlisti. So /smida builds each cabinet from the SAME
  Sögunarlisti rows /cnc plans from (`cnc-data.js` — the loader /cnc now uses too — → `cnc-sides.js unitPlan`), and only
  edits what Smíðagögn carries. Door count/heights therefore always match /cnc. Drawers, fronts, sizes are read-only
  (they come from Sögunarlisti — change the Eyðublað + Yfirfara). Pure model: `smida-eydublod.js` (`SMIDAEY`), tests in
  `tests/smida-eydublod.test.js` (T-15 Sk 2 / Sk 5-8 / Sk 23 / Sk 30.2 shapes through `unitPlan`).
- **Editing** (same ideas as Smíða): Sk strip with dots (green yfirfarinn / amber / red = blocked / grey = FRE), one
  fixed-place button "Yfirfarinn → Sk X", ← →; Lamahlið Vinstri/Hægri/Báðum megin (required when the cabinet has a
  hinged door; two leaves = báðum); per door Á lömum / Lyftihurð, hinge mm (↓ from bottom / ↑ from top), + / − löm,
  Sjálfgefið; shelves (fixed/loose counts from Sögunarlisti, mm = top face from the side's bottom, loose holes 1/3/5);
  oven (h 455/595/1050, "Ofn stendur á", "Raða botnum eftir ofni"); inner drawers behind a door (mm = bottom of the
  inner front — default squeezed to fit, which un-⛔s T-15 Sk 30.2 and Sk 33.2); Fataslá mm. Drag shelves, inner
  drawers, rails and hinges in the drawing. "Hlið · CNC" = the side files through `renderSide` + `CNCBPP.buildCard`.
  "Það sem /cnc segir" is `unitPlan`'s live stop/check. Any change drops the mark (like PRO).
- **Legacy ovens** (`oven.boards:"list"`, new in cnc-sides.js): on an old Ofnaskápur Sögunarlisti's "Föst loftunarhilla"
  count includes the board the oven stands on and the one over it (T-15 Sk 2: FH 3 with a 1050 oven), so every board is
  in `oven.shelves` at its own mm, counted against Sögunarlisti; no automatic Loftunarbotn/-toppur. PRO's ovens unchanged.
- **Save** = `api/smida-eydublad.js` (VERK_KEY): PATCHes ONLY `Smíðagögn (JSON) 🔧` (fldc72nKFtSVOChCZ) on Eyðublöð that
  link to the project (either Tækifæri link), batches of 10, `prev` = value the page loaded → 409 if changed since, nothing
  written. Returns the previous values → **Afturkalla** writes them back (the page keeps the edits, unsaved again). Only
  cabinets marked or changed are sent; unmarked-but-changed ones are confirmed first (/cnc says "ekki yfirfarinn" there).
  Draft per project in localStorage (`bjorninn:smida:<rec>`), dropped for a unit whose Airtable value changed since.
- **Automations (read-only check 2026-10-26)**: the only Eyðublað trigger is per-unit Yfirfara 3.0 (its own checkbox
  fld2oZxB3MIm2kT0K); only Keyra skipulag writes Smíðagögn, and only on an Eyðublað linked to a Line Item (create, or
  sync when stale / force) — T-15's aren't linked, so nothing overwrites what /smida saves. Yfirfara 3.0 / 4.0 scripts
  never read or write Smíðagögn. Samstilla Eyðublað (wflMRFhFANXon1UnQ) no longer exists.
- **Verified** on T-15 with the read-only server: 31 cabinets load (29 editable, SK 14 + Sk 41 FRE read-only); with
  a stubbed save of 5 cabinets (Sk 2 oven, Sk 5-8, Sk 23, Sk 30, Sk 30.2) injected into /cnc, "Ekki enn — 20 atriði" →
  15, those five ✅ with one-sided hinge files, Sk 30.2 exports (was ⛔). Simulating all 29 marked: /cnc items 40 → 4
  (the 2 FRE + 2 Fataslá "bora í höndunum").
- **Not covered (by hand)**: FRE cabinets (SK 14, Sk 41); doors that are their own Eyðublað "Stakur frontur" (Sk 29 →
  hangs on Sk 29.1/29.2, RH Sk 30-33 → Sk 30/31-32/33) — those sides have no door rows in Sögunarlisti, so /cnc drills no
  hinges for them; Fataslá (FATASLA not confirmed in the master).

### /smida redesign (2026-10-26, same night) — "one calm screen per cabinet"
Owner: the most important page in the company; the first version read like a form full of footnotes. Same data model
(`smida-eydublod.js`), same JSON, same endpoint, same draft key — anything saved before loads unchanged.
- Layout (1440×900, no page scroll): left list of cabinets (Sk + tegund, status: green ✓ yfirfarinn / amber ring
  "Þarf að ákveða" / grey ring / dash "Í höndunum" for FRE, blue dot = unsaved); centre the front elevation as the hero;
  right panel = what's still open, then quiet one-line rows. Top: "12 af 29 yfirfarnir" bar, save state, Vista, Afturkalla, CNC ↗.
- Direct manipulation: drag shelves / boards / inner drawers / rails / hinges; click a door = switch hinge side (the dashed
  chevron's point = hinge side, as on a drawing; vænghurð = both, not switchable); click a number on the drawing = type it.
- Panel: open decisions as plain questions with pictures ("Hvoru megin eru lamirnar?" Vinstri / Hægri / Báðum megin;
  "Innskúffurnar komast ekki fyrir" → Raða sjálfkrafa). Nothing open = calm green line. Settled things = rows
  (Lamahlið, Hurð "897 · 2 lamir", Ofn, Botnar/Hillur, Innskúffur, Fataslá, Skúffur read-only) that expand; hinge mm,
  holes 1/3/5, Raða jafnt behind "Nánar". Explanations are ⓘ tooltips. "Athugaðu" lists only /cnc's real notes
  (defaults and the hinge-side line are left out — the first goes away on review, the second is the question above).
- Flow: big button "Yfirfarinn → Sk X" (Enter); arrows move between cabinets. **Marking saves right away** (all marked,
  changed cabinets in one call); changes not yet marked wait in the local draft with "N breytingar óvistaðar" + Vista.
  A failed save says "Vistaðist ekki" + "Reyna aftur", nothing is lost (draft). Afturkalla = a stack, one save at a time.
- PRO bar: **"Smíða úr Eyðublöðum"** whenever the project is legacy (`proLegacyCheck`: has Eyðublöð, no Line Item linked
  to one — two one-record GETs), also with a drawing (T-15 got an empty one, so the no-drawing offer never showed).
- **Round 3 (owner on T-15 Sk 2):** door mark flipped — the chevron's point is the handle side (away from the hinges),
  two leaves point to the middle, a lift door points down. A click on anything in the drawing (shelf, hinge, inner drawer,
  rail, drawer, oven, door) opens that section alone in the panel, scrolls to it, blinks it and focuses its number;
  the same from the CNC side view (hinge → its door, shelf/inner → the nearest one). Double-click a door = switch hinge side.
  CNC side view: the hinge as its cross mounting plate; each drawer/inner drawer as its box standing on its runner line,
  as tall as its Blum side (Merivo N 63 / M 91 / K 129 / E 192, Legra M 90.5 / K 128.5 / C 177 / F 241 — the planner's table) with its code inside.
- **Round 4 — /smida = Smíða & CNC for every project.** Any project opens (no more "teiknað í PRO" stop). A unit whose
  Eyðublað was made from a Line Item is **read-only**: planned from the drawing's Smíðagögn (as /cnc), list says
  "Teiknaður í PRO", panel says why + "Breyta í PRO →" (`&smida=Sk7`), never saved from here — so a later Keyra
  skipulag can't silently disagree with /smida. "Skrifa á USB" in the top bar (see docs/cnc.md). Entry points with the
  office key: Skipulagsferli → Yfirfara → "3. Smíða & CNC" (Opna hér / ↗), the Verk-í-vinnslu project popup on
  /skrifstofa ("Smíða & CNC →", shown when it has Eyðublöð), and the CRM deal ("Smíða & CNC →", same rule).
  No sidebar entry: /smida is per project, like the others reached from a project.

## PRO 90 % round (2026-10-27) — from the overnight scan (scratch/morgun-pro.md §3)

**G1 — handles priced per SKU.** `handleHardwareSummary()` sent every length it used (Jey: 400/600/700/3000…) as
"Höldur Viðskiptavinar ✊" with ONE "Magn Halda 1"; Airtable's höldur formula (fld5N9nsHCOQroGzT = Σprice(✊)×Magn 1 +
Σprice(✊2.0)×Magn 2) and kp-price multiplied the SUM of the lengths by the total → ~60 þús kr per handle (T-199:
1,262,072 kr for 21). Now the drawing sends `handleSkus: [{id, n}]` (all rooms, `projectHandleSkus()`) to kp-submit,
kp-pro and kp-price; the server reads Vörulisti prices and `handleSlots()` (api/kp-submit.js) fills the two slots:
one/two SKUs exact; more → two used SKUs and a split of the true total whose amount is the smallest ≥ the exact Σnᵢpᵢ
(≤ one price step high, never low). Welcome kitchen (34 Jey, 6 lengths): 3,027,088 → 453,377 kr (= exact);
T-199-like (21 Jey: 6×400 8×600 4×700 3×3000): 1,262,072 → 288,895 kr (exact 287,010).
- Known limit: with 3+ SKUs the slot NAMES on the quote PDF are an equivalent split (e.g. "26 × Jey 800 + 8 × Jey 700"),
  only the amount and total count are true. A truly per-line handle would need Airtable changes (handle Útfærslur
  exist with "Söluverð fyrir V3 án halda" = 0, i.e. handles are priced on the Tækifæri by design).
- Ordering is unaffected: Keyra skipulag puts each Eyðublað's handle from its own Útfærslur, never from the Tækifæri.
- kp-pro: a one-SKU drawing never clears a Halda 2 the drawing didn't write (`HANDLE2` rule); one it wrote is cleared.
- **Hinge cups on the front (2026-10-27):** the /smida front view and the per-front cards draw each hinge as the front
  master's own IKEALOM drills it (read from `~/bjorninn-cnc-mirror/Macros/IKEALOM/IKEALOM.bsm`): Ø35 cup at 22.5 mm from
  the door edge, two Ø8 holes at ±22.5 along the edge and 9.5 mm further in (32 mm from the edge), true scale, blue
  (grey while the hinge side is open). Still dragged like before.

**G2 — front material per room.** The Tækifæri has two front fields; `projectFrontPlan()` walks the rooms in order:
first room's front = "Fronta efni" (FR1), the next different front actually used (that room's look2 on `b.front2`
blocks, or another room's look) = "Fronta efni 2.0" (FR2). Each line's "Frontaefni #2" = its own front is FR2 (so a
Halifax bath next to a white kitchen goes to Keyra skipulag → Eyðublað FR2 → Sögunarlisti on the right board, and
kp-price prices it on FR2's plate). A third front → Yfirferð ⛔ "Frontaefni: 3 í verkefninu" (Laga → Efni → Framhlið).
Carcass, worktop and handle colour are still the first room's (one field each on the Tækifæri) — not checked yet.

**G3 + G13 — Prenta tilboð saves first, opens the PDF, needs the key.** `proTilbodPrint()`: unsaved drawing →
`proSave()` first (a failed/cancelled save stops the print — it would have shown the old price); then
`/api/tilbod-print` with `k`, which now 403s without VERK_KEY (anyone could overwrite "Tilboð til sendingar" before)
and answers with the new PDF links (`files`, Airtable's short-lived URLs). A tab is opened on the click (pop-up rule)
and pointed at the "(Tilboð…)" PDF; the panel lists every PDF as links. /crm's Prenta tilboð sends its `k` too.
Not done: drawings/Studio pictures appended to the quote PDF.

**G6 + G7 — gap hint, no silent sink (PRO only).** `KP3D.fitWarnings(state, { pro:true })` (editor chip + Yfirferð
"Ábendingar") also flags floor-run gaps of 5–299 mm between cabinets, and at a wall end that meets a wall/corner run
(after the 19 mm áfella already kept free) — "Bil N mm milli Sk2 og Sk3 á vegg 1 — áfella, fyllistykki eða færa
saman?" — unless a door/opening/low obstacle sits in the gap; and "2 vaskaskápar í rýminu (Sk1, Sk3) — er það
ætlunin?". `seedSink()` still places the sink on the water in PRO but toasts it. Customers (Studio) see no change.

**G8 — appliances tell the truth.** Smíðagögn: an integrated dishwasher has no `hinge`/`doors` (its front hangs on
the machine) and `appliance:"uppthvottavel"`; built-in fridge/freezer get `appliance:"isskapur"|"frystir"` (Keyra
skipulag ignores the key; it's for /cnc and people). Skápalisti: dishwasher = "Frontur á vélinni (engar lamir)" +
"Innbyggð uppþvottavél"; fridge type "Hárskápur (ísskápur)" + "Ísskápur (innbyggður) · loftunarrist (sökkull/toppur)".
Side effect: a dishwasher/fridge already marked "Yfirfarinn" in Smíða drops its mark once (the Smíðagögn changed).

**G4 — Senda tilboð (Gmail draft, never sent).** Tilboð panel: "Senda tilboð" = the same save-first print, then a
Gmail compose window (`mail.google.com/mail/?view=cm`, a draft Gmail autosaves) to the project contact's Netfang
with "Hæ {Fornafn}" and the customer's LASTING link `/api/tilbod-pdf?r=<rec>&s=<HMAC(VERK_KEY)>` (Airtable's
attachment URLs expire within hours; the link resolves to the CURRENT "Tilboð til sendingar" PDF on each click —
a re-print updates what the customer sees). Nothing is sent by the app: after Rakel presses Send in Gmail she
clicks "Merkja tilboð sent" → `/api/sala` action `sent` (the sales session's endpoint: Staða í söluferli =
📤 Tilboð sent + Næsta skref "Bíða eftir svari" in 3 days). Automations on that status (checked 2026-10-27):
"Skráir tíma þegar tilboð var sent" (date), Eftirfylgni 1.0/2.0 (internal Chat nudges at 3/13 days), Virkni log,
and "Verk ósnert í 30 daga → tapað" — none e-mails the customer. tilbod-print now also returns `to` + `link`.
Not done: the PDF as a real attachment (would need Gmail API credentials server-side).

**G9 + G10 + G12 — navigation.** PRO strip: "+ Rými" next to the room tabs (also with one room) and a clickable
"1. Rými" → the room cards with this project's rooms ticked (same as Rýmið's ← Til baka; hidden when locked).
PRO bar: "← Skrifstofa" (not inside /pro's frame), "Smíða & CNC ↗" (/smida) in every state, unlocked too.
`PRO.k` falls back to the office key /skrifstofa keeps (`bjorninn:skrifstofa:k`) and a key in the link is
remembered there — a bookmark without `&k=` works. /crm "+ Nýtt verkefni → Hanna" opens PRO in a new tab.

**G15 — upper cabinet door count (owner decision 2026-10-27).** Efriskápur gets two doors from 600 mm INCLUSIVE
(`KP3D.twoDoors(widthMm, wallUnit)`: wall units `>= 600`, everything else `> 600`), matching Keyra skipulag's
"Tveir frontar" (the owner changes that script: Efriskápur `>= 500` → `>= 600`). Used by doorLeaves/smidaHingeSide
(Smíðagögn `hinge:"baedi"` → /cnc drills both sides), the 3D fronts, handle counts, Smíða's hinge UI, the Sögunarlisti
preview and the Skápalisti/workdraw doors. /cnc and /smida take the door rows from Sögunarlisti — nothing else to change.

**G11 — Yfirfara 3.0 after Keyra skipulag, from PRO.** When `proWatchSkipulag` sees the run finish, `proRunDone`
ticks "🔄 Keyra Yfirferð 3.0" false→true (the same write /ferli's Yfirfara button makes; the only writable Eyðublað
field) on every unit the run created/synced plus every unit still without a Sögunarlisti — ONE unit at a time:
the next starts when that unit's Sögunarlisti count has settled (≥ 20 s, two equal reads) or after 90 s, because
Yfirfara's lean Pöntunarlisti runs side by side on one project were what made duplicate lines. Progress and any
unit that failed show in Yfirferð's run line. No Airtable automation change needed. `window.__wt.runDone` = test hook.
