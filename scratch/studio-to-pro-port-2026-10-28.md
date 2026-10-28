# Studio -> PRO port audit (2026-10-28)

Source: docs/kitchen-planner.md (rounds 2026-10-23 ... 2026-10-28), `git log --since=2026-10-26` (224 commits), and a grep of every `PRO` / `!PRO` / `!!PRO` guard in kitchen-planner.html (116 `!PRO` hits). "Active" = shared code with no PRO guard (read from code, not clicked: PRO needs a real key and live Airtable).

Rule used: PRO keeps its mm inputs, Smíða loop and Yfirferð gate. A Studio feature is carried over only if it does not touch PRO data or save paths.

| # | Studio improvement | In PRO today | Recommendation | Risk |
|---|---|---|---|---|
| 1 | Hover = preview, click = commit (Efni swatches, editor Efni menu, Ný eining step 3) | Active (HOV_SEL / withHov, no PRO guard) | Nothing to do | none |
| 2 | Blue alignment guides while dragging (`showSnapGuides`) | Active (the commit says "Studio + PRO") | Nothing to do | none |
| 3 | Right-click opens only that drawer/door, again closes (`togglePart`, `onPeekToggle`) | Active in 3D; the one-time hint `kikja` was off | DONE: hint allowed in PRO (`PRO_HINTS`) | low |
| 4 | Innskúffur tied to their host drawer | Active (KP3D) | Nothing to do | none |
| 5 | Úthliðar vanish when the cabinet is picked up (`on3DDragStart`) | Active, no guard | Nothing to do | none |
| 6 | Door look in 3D (room doors rebuilt, `addOpeningMarker`) | Active (KP3D) | Nothing to do | none |
| 7 | Thin line icons, no emoji | Customer side done; PRO bar and Smíða still use symbols/emoji | Left to builder 1 (header) / audit #15 | low |
| 8 | mm labels without unit text (2D úthlið "19", dimension chains) | PRO shows mm numbers through `uLen`; same chain code | Active; keep mm (PRO needs the unit) | none |
| 9 | Ný eining: Snúa / Framhliðar á-af preview tools (`#uwTools`) | Active (guard only hides them for machines) | Nothing to do | none |
| 10 | Ný eining preview holds still while a unit is being set up (no auto-spin restart) | Was `!PRO`: PRO kept spinning while Rakel typed mm | DONE: guard removed (2 places); Snúa toggle still there | low |
| 11 | Ný eining preview turnable by hand (`uwLockView`) | PRO can already rotate (returns early) | Nothing to do | none |
| 12 | Ný eining one group at a time with live dimension lines | PRO uses the same wizard (`uwShort` short kitchen form); dimension lines shared (`drawUwDims`) | Active; keep PRO's mm form | none |
| 13 | Drag drawer fronts in the Ný eining preview (`drawerDragAll`, `.dw-front-lbl`) | Customer only (`!PRO`) | KEEP customer-only: PRO sets drawer heights in mm in Smíða and has `onDrawerResize` on the main scene; two ways to change one stack would fight | medium |
| 14 | Efni pages in the kitchen's order with a preview that builds up | Customer only: PRO skips the Efni pages and uses the Efni menu | KEEP: PRO needs every select on one menu (undecided tags, per room). The menu already follows the kitchen's order | low |
| 15 | "Sömu efni og í …?" for a new room (`matAsk`) | Customer only (`!PRO`) | KEEP: PRO rooms carry their own carcass/worktop and Yfirferð (`sameMatCheckItem`) already warns when rooms differ | medium |
| 16 | Suggestion "Viltu fá tillögu?" (`suggestAsk`, `seedKitchenRun/Laundry/Bath`) | Customer only; PRO has its own "Fylla vegginn / Ég raða sjálf/ur" card | KEEP: PRO never auto-fills | medium |
| 17 | Corner wardrobe unit 110-120 cm rule (`closetFillPlan`) | Shared function; PRO's offer card uses it | Active | none |
| 18 | One-time hint bubbles (`hintOnce`) | Off in PRO | DONE: only `kikja` allowed; the rest are customer flow. PRO gets the tour instead | low |
| 19 | Tour | Auto-off in PRO, but Hjálp -> "Sýna leiðsögnina" ran the customer tour | DONE: PRO tour (5 steps), own seen flag `proTourDone`, Hjálp runs it in PRO | low |
| 20 | Hjálp "Hvernig…?" searchable reference (`KPHELP`) | Showed the customer list | DONE: PRO reads `KPHELP_PRO` (11 entries: Sk, Smíða, Yfirferð, 2/12, Klár til framleiðslu, Tilboð, læst verkefni, vistun …); the chatbot never sees it | low |
| 21 | Short texts, stable controls | PRO bar swaps buttons between locked/open | Builder 1 (audit #5) | n/a |
| 22 | Mouse-first walls (drag wall ends, live cm) | Customer wardrobe/bath only (`clEnds` `!PRO`); PRO has the mm table (`shapeProBox`) | KEEP: PRO must type exact mm | high if changed |
| 23 | Room cards / shape cards with pictures | `!PRO` -> PRO keeps plain cards | KEEP | low |
| 24 | Wall selection no longer tints (`outlineSel`) | PRO keeps the pane on purpose (it picks worktops) | KEEP | medium |
| 25 | No Tegund dropdown for customers | PRO keeps Tegund | KEEP (PRO changes the type of a unit) | none |
| 26 | Lift doors, pocket / sliding / fold doors in Ný eining | Customer wizard filters pocket (`!PRO`); PRO has Smíða door types | KEEP | none |
| 27 | Ganga um (walk mode, click to open) | Shared | Active | none |
| 28 | Bath/laundry water pages, machine pages, tiled floors | Customer flow only | Not applicable (PRO draws the room in mm) | none |
| 29 | Intro animation / welcome / Spyrja chatbot / language switch | Off in PRO (`KPI18N.isPro`) | Not applicable | none |
| 30 | Villa / hugmynd report pill | Shown in PRO too | Active | none |
| 31 | Studio submission -> PRO panel "Frá Studio" | PRO only | Active | none |

## What was built from this audit
Items 3, 10, 18, 19, 20 plus PRO UX audit #6 (tour + help), #8 (Efni: undecided count on the closed menu button, menu opens once per project), #11 (Tilboð: visible sentence + discount guard 0-30 %, "ertu viss?" above 15), #13 (every Smíða/Yfirferð issue text says what is wrong and what to click). See the commits on this branch.
