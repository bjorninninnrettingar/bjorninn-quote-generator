# Studio — Innihurðir as steps + Allt heimilið as a list (2026-10-26)

Built from docs/studio-review-2026-10-25.md section C (the "Tillaga" lines, recommended answers as decisions).

## Innihurðir — `step "hurdir"` (`screen-hurdir`)
- The Studio card (and the Innihurðir row on Allt heimilið) opens `openDoors()` → its own screen, not in the stepper.
  The old overlay `openDoorList()` is still in the code (unused by the customer path).
- **Overview** = the list: one card per door (picture, HU, gerð, B × H cm, lamir/rennur, rými, efni, −/+ fjöldi,
  Breyta / Afrita / Eyða), doors drawn in a room's walls read-only, a dashed "+ Hurð" card. Áfram → Spurningar
  (doors-only) or back to Allt heimilið. An empty list goes straight to a new door (also after a reload).
- **Per-door wizard** (`doorWiz = {d, i, phase}`, a draft copy — Til baka on page 1 drops it):
  Gerð (pictures, `DOOR_KINDS` + `DOOR_KIND_DESC`) → Mál (chips in cm: breidd 70/80/90/100, hæð 210/220/240,
  veggþykkt 10/12/15 + "Annað mál" in cm; **80 × 210 pre-picked**) → Opnun (two pictures: lamir vinstra/hægra or
  rennur til hægri/vinstri + the product's real options as chips, `doorOptsFor`) → Efni (Hvar er hurðin? = the
  project's drawn rooms + "Annað" → every Rými 🏡 choice; Fjöldi; efni hurðarblaðs: Ákveða síðar (pre-picked) /
  Spónlagt / Harðplast (Egger, with search)). Karmur without options skips Opnun.
- A new door copies the last door's kind, options, height, wall and leaf (not the room).
- Data unchanged: same `state.doorList` objects in mm, `DOOR_DEFAULT.widthMm` now 800. `doorListLines`, HU numbers,
  Smíðagögn, kp-submit shapes untouched. Product names only shown in PRO.
- Senda inn for doors only (or Allt heimilið) shows just "Það sem þú pantar", not an empty kitchen drawing.

## Allt heimilið — list (`renderHomeList`, `state.home.view !== "plan"`)
- Rows = the project's rooms (`homeRooms()`) + an Innihurðir row (`state.home.doors` or a non-empty door list).
  Each row: icon, editable name (`state.home.names[key]`), type · status, ✓ when done (units > 0; a plain room when
  drawn; doors when ≥ 1), "Byrja →"/"Halda áfram →" (fixed width), × remove (confirm when there's work in it).
- "+ Rými" → type cards (Eldhús / Fataskápur / Baðherbergi / Þvottahús / Innihurðir / Aðeins rými) + Nafn
  (pre-filled from the type, numbered "Fataskápur 2"; type pre-picked: Eldhús if none yet, else Fataskápur) →
  "Byrja →" opens that type's flow. Opens with the form already showing on an empty home.
- **Several of one type**: keys `fataskapar:2`, `bad:2` … (`hlNewKey`; `rymi:N` as before). Checked/fixed for
  ":N": `catBase()` helper (bath hung units, Þvottahús seeding, shape titles, page title), kitchen-planner-3d.js
  wardrobe checks (`/^fataskapar(:|$)/`). Rými 🏡: a name that matches a choice ("Hjónaherbergi" → "Hjónah.") is
  used; 2nd bathroom → "Baðh. 2". Sk numbers stay unique (B1 counter). Verified: two wardrobes with units → both ✓,
  both listed by name on Senda inn.
- Every room's flow returns to the list (`finishCategory`, plain rooms' `lockRoom`, shape "Til baka", Spurningar
  "Til baka"). One Spurningar + Senda inn for everything.
- **"Ég á teikningu" removed** from the customer path: the old intro only shows it with `window.__kpPlanImport`.
  The floor-plan drawing is reachable as "Teikna grunnmynd" (`state.home.view = "plan"`) only with
  `window.__kpHomePlan` set — kept for later.
- heimili/hurdir pages use the 1240 px width like the room pages (nav in the same spot).

## Not verified
- Door product options (lamir/þröskuldur/skrá chips) and `doorProductFor` → needs `/api` (static server here has
  none); the logic is the same as the overlay's.
- No real submission (never submit from tests). Line Items shape unchanged by construction; `npm test` passes.

## QA round 2 (2026-10-26, report /private/tmp/claude-501/studio-qa-2026-10-26.md)
- I1: Opnun options in plain words with a line under each (`DOOR_OPT_PLAIN`: Faldar/Sýnilegar lamir, Venjulegt bil /
  Þétting sem fellur niður, Venjuleg/Hljóðlát skrá, Braut í loftinu/á veggnum/Falin braut, 30/60 mínútur, karmur
  sléttur / með listum), usual value first. HU codes only in PRO — customers see "Hurð 1".
- I2: Spónlagt / Harðplast tab always has a species picked (first of the group) + "Valið: …" line.
- I3: Senda inn lists doors by the same kind names as the list (`doorKindLabel`); the stepper is hidden on
  Spurningar/Senda inn for a doors-only project or Allt heimilið (`listProject()`); delivery question says "hurðirnar".
- A1: Allt heimilið's top button is "Áfram →". A2: no "Eldhús · Eldhús" (type hidden when the name is the type);
  a done row's button is "Breyta". A3: plain rooms are listed on Senda inn ("Rýmið teiknað, án innréttingar").
- E5: Til baka from a room's first page goes to the front page (or the home list); "Byrja að hanna" with nothing
  started opens the kitchen; the hidden Byrja page no longer lists "Hurðir — Væntanlegt".
- E12: a front-page room card says "Halda áfram" only when that room is drawn (`closed`).
- F4: Senda inn summary is project-wide: "Skipulagið þitt · N skápar" over every room, each room's row with its own
  front + worktop (no worktop for rooms without one, e.g. wardrobes); a single-room project's materials list is that
  room's, worktop dropped when the room has none.

## Allt heimilið polish (2026-10-26, 8 approved items)
- **Empty rooms never block** (`homeListNext`): Áfram drops the empty starter door(s) (`designed:false`) and goes on;
  empty rooms are left out with one line under the cards ("Innihurðir er tómt og fer ekki með."). Only when no room
  has anything to order (units or a designed door) does it stop, with an inline box naming each empty room +
  Hanna / Fjarlægja (`hlGate`; a door without a room shows canGoTo's reason + Hanna). No toast.
- **Messages stay on their step**: the gate box and the undo toast clear when you leave the list (`goto`); the
  "Sömu efni…" toast is gone (see below); no toast on the list's Áfram any more.
- **× with undo**: empty room → removed at once; room with work → removed + "Fjarlægt: {room} · Afturkalla" toast
  (6 s, `undoToast`, restores queue position, room data, name, home position, thumbnail / the door list).
- **Room steps inside Allt heimilið**: the stepper shows only Rými · Efni · Skipulag (`updateStepper` HM); the
  editor's button and the doors review's button say "Klárt — aftur í Allt heimilið". Single-room flows unchanged.
- **Cards** (`renderHomeList`): picture (the editor's 3D, captured on Klárt or the header's Allt heimilið pill and kept
  per room in localStorage `bjorninn:kitchenPlanner:homeThumbs:v1` — NOT in the draft, which goes to Airtable as text;
  stale when the unit count changed → the room's 2D plan; nothing drawn → the type icon; doors → first door's 3D),
  name (editable), status Ekki byrjað / Í vinnslu / ✓ Klárt, count, Hanna / Halda áfram / Breyta; "+ Rými" is the
  last card and opens the type form in place of the grid. 4 columns (3 under 900 px), row height computed to fit the
  canvas — no scroll at 1440×900 / 1280×720 with 6 rooms (re-measured once if the screen was still switching).
- Welcome card: "Mörg rými — eitt tilboð".
- **Hvar er hurðin?** (doors list select) in Allt heimilið: optgroup "Rýmin þín" (the project's rooms by name) then
  "Önnur rými" + Annað. Picking one stores its Rými 🏡 value in `d.room` (Line Item unchanged) + `d.homeRoom` for the
  name shown (`doorRoomText`); a room name that isn't a Rými choice → Annað + the name.
- **"Sömu efni og í {room}?"** (`renderMatAsk`, `state.matAsk = {from, own}` per room): a new room that inherited
  materials asks on its first Efni page (the 3D already shows them). Já, sömu → Skipulag (or only the page still open,
  e.g. its own worktop); Velja ný → the room's own starting picks back (`own`), page 1. Customer only (PRO keeps its
  "Erfir efni frá…" line).
- Verified in the Browser pane (static server, 1440×900 + 1280×720): Eldhús + Fataskápur + empty Bað/Þvottahús/Stofa/
  Innihurðir → Áfram → Spurningar → Senda inn (not submitted), remove + undo, nothing-in-it gate, door room picker,
  single-room kitchen still shows 5 steps + "Áfram →".
