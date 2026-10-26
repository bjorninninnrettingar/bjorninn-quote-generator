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
