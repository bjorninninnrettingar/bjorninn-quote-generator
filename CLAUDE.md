# bjorninn-quote-generator

Static HTML tools + Vercel API functions for Björninn Innréttingar. Deployed at
https://bjorninn.vercel.app — all pages talk to Airtable through
`/api/airtable`, a server-side proxy that holds the PAT (kept out of the repo
since GitHub push protection blocks committing an Airtable PAT directly).

**This file is kept short on purpose** (it is loaded on every turn). The full history of each area lives in
`docs/` — read the one you need before working there, and add new round notes THERE, not here:

| Area | Doc |
|---|---|
| Kitchen planner `/skipuleggja` (+ pro mode, Line Items, Smíðagögn, drawing export) | [docs/kitchen-planner.md](docs/kitchen-planner.md) |
| CNC `/cnc` (sides, fronts, doors, USB layout) | [docs/cnc.md](docs/cnc.md) |
| API endpoints, proxy hardening, field check, rate limits | [docs/api.md](docs/api.md) |
| Æðaskipulag `/aedar` + `/saga` (grain.html) | [docs/aedar-grain.md](docs/aedar-grain.md) |
| Verkstæðisappið `/app`, cutlist + labels, QUICK FIX | [docs/app-floor.md](docs/app-floor.md) |
| Stimpilklukka `/klukka` `/eigandi`, HR / Launakerfi | [docs/klukka-hr.md](docs/klukka-hr.md) |

## Pages (short URL → file)

| URL | File | Purpose |
|---|---|---|
| `/tv` | [dashboard.html](dashboard.html) | Framleiðsluyfirlit — production overview / TV dashboard |
| `/cutlist` | [cutlist.html](cutlist.html) | Skurðarlisti (Cutty) — cutting list, also drives USB export to the saw |
| `/aedar` | [grain.html](grain.html) | Æðaskipulag (office) — build & **confirm** a grain-matched front sheet layout |
| `/saga` | [grain.html](grain.html) | Same file in `FLOOR_MODE` — the floor opens a **confirmed** plan and runs the guided sawing steps (can nudge locally, no write-back) |
| `/labels` | [labels.html](labels.html) | Merkingar (Sögun) — label printing for cut pieces |
| `/skipulag` | [skipulag.html](skipulag.html) | **Saga — Skipulag** — office-side hub: Cutty → Æðar → CNC as one pipeline (not alternatives), each a real link with a status chip where one honestly exists, project (`?recordId=`) forwarded into whichever step you pick |
| `/verkstaedi` | [verkstaedi.html](verkstaedi.html) | **Saga — Verkstæði** — floor-side hub: pick Merkingar or Saga, project (`?recordId=`) forwarded into whichever you pick |
| `/leidbeiningar` | [leidbeiningar.html](leidbeiningar.html) | Leiðbeiningar — instructions for the cutlist + labels workflow |
| `/klukka` | [stimpilklukka.html](stimpilklukka.html) | Stimpilklukka — PIN-pad time clock (Inn/Út) for starfsmenn, kiosk-style; on ÚT, split the shift's hours across projects (→ `Verktímar 🕒`) |
| `/eigandi` | [stimpilklukka.html](stimpilklukka.html) | Same page in "owner mode" — phone clock-in for eigendur, no device pairing (PIN verified by [api/eigandi-clock.js](api/eigandi-clock.js), which also checks `Tegund starfsmanns = Eigandi 👨🏻‍💼`) |
| `/velar` | [velar.html](velar.html) | **Vélar** — workshop machine SOP/FAQ from Airtable `Vélar 🏭` (`tblDwYfZWPmgGpjio`, one row per machine, fixed rich-text sections Ræsing / Notkun / Drepa á / Bilanir & ráð / Öryggi, `Röð` sorts, `Falið` hides). Search covers all sections; deep link `?vel=<recId>&kafli=raesing\|notkun\|drepa\|bilanir\|oryggi` (e.g. a QR on the machine). Tile in `/app`. Machine SOPs are being moved here out of `SOP's 🤓` by hand. |
| `/v/<pieceId>` → `/velja` | [api/v.js](api/v.js) → [velja.html](velja.html) | QR on every Zebra piece label. /velja = EINING or VERKEFNIÐ, plus (2026-10-05) a big **🔬 Merkja fræst** when the scanned Sögunarlisti row is `Yfirfr.` — one tap sets `Fræst` + `Magn fræst` (+ V/H counts) like /fraesing, with Afturkalla. Counts toward `Framvinda framleiðslu [weighted]` = (Lokið + Fræst) / (rows + Yfirfr. rows). |
| `/app` | [app.html](app.html) | **Verkstæðisappið** — installable PWA home screen for the floor. See docs/app-floor.md. |
| `/verk-i-gangi` | [verk-i-gangi.html](verk-i-gangi.html) | Project picker for `/app` — lists projects currently in production, tapping one becomes the app's "current project" |
| `/skipuleggja` | [kitchen-planner.html](kitchen-planner.html) | **Eldhússkipulag (sjálfsafgreiðsla)** — customer-facing kitchen planner, see docs/kitchen-planner.md. Desktop only (<768px shows a gate). |
| `/cnc` (`/hurdir`) | [cnc.html](cnc.html) + [cnc-sides.js](cnc-sides.js) + [cnc-doors.js](cnc-doors.js) | **CNC útflutningur (Rover-B)** — one export per project: cabinet sides from Sögunarlisti + doors (karmur + hurðablað) into `[99] - VERKEFNI/<T-xx name>/` on the USB stick. See docs/cnc.md. |
| `/bpp` | [bpp-viewer.html](bpp-viewer.html) | **BPP skoðari** — drag in a `.bpp` file `/cnc` wrote and see a 2D elevation of drawers/hinges/shelves/door hardware, without walking to the machine. `/cnc` itself now shows the same cards automatically right after export (shared `cnc-bpp.js`) — this page is for an older file or a second opinion. See docs/cnc.md. |

Rewrites live in [vercel.json](vercel.json) (`source` = short path, `destination` = the `.html` file); push to
`main` redeploys. Hub pages `/skipulag` and `/verkstaedi` just forward `?recordId=` into the tool picked.

## Kitchen planner — essentials (details: docs/kitchen-planner.md)

- Files: [kitchen-planner.html](kitchen-planner.html) (UI, state, Line Items), [kitchen-planner-3d.js](kitchen-planner-3d.js)
  (`window.KP3D`: CATALOG, buildScene, buildPlan2D, all 3D), `-models.js` (Blum/handle models), `-handles.js`
  (KPHANDLES), `-catalog.js` / `-egger.js` (fronts, worktops), `-linemap.js` (generated Útfærslur ids — don't
  hand-edit), `-worktop.js` (KPWT: PRO borðplata — pieces/joints/cutouts, BP/BV/BH lines, docs/pro-finish.md), `-showcase.js` (welcome-page kitchen), review page `kitchen-planner-review.html`.
- Flow: welcome → shape (pick → size → height → openings → water) → materials (5 pages) → editor → intake → contact.
  Draft in `localStorage` `bjorninn:kitchenPlanner:draft:v1`; every edit ends in `refreshAfterEdit()`.
- Submit = [api/kp-submit.js](api/kp-submit.js) (idempotent: contact → Tækifæri → Line Items) + drawings PDF
  ([api/kp-drawings.js](api/kp-drawings.js)). Pro mode (`?pro=<recId>&k=`) saves via [api/kp-pro.js](api/kp-pro.js).
- After touching the linemap, handles, catalog or Töfrahorn run `npm run test:live`.
- UX rules (user): on a computer no page scroll; "← Til baka / Áfram →" sit at the right of the title row on every
  step (same spot); short texts, details in tooltips.
- Verify in the Browser pane (local `python3 -m http.server 4398`, `fetch(url, {cache:'reload'})` to bust the cache;
  screenshots lag one action behind; rAF doesn't run while the pane is hidden).

## CNC — essentials (details: docs/cnc.md)

One export per project to `[99] - VERKEFNI/T-xx <name>/` on the USB stick: sides only from Sögunarlisti
([cnc-sides.js](cnc-sides.js)), fronts, doors ([cnc-doors.js](cnc-doors.js)); Smíðagögn from the designer overrides
hinges/shelves. Generated files are marked (`GLB=HS_…`) so re-exports never delete hand-made ones.

## API — essentials (details: docs/api.md)

[api/airtable.js](api/airtable.js) is open to the internet: **assume anyone can list what is in `ALLOWED_FIELDS`**;
writes are allowlisted (`CREATABLE_FIELDS` / `WRITABLE_FIELDS`, forced fields server-side). Sensitive actions have
their own endpoints behind `VERK_KEY`. A daily field check ([api/field-check.js](api/field-check.js)) files renamed
fields to Skipulag villur 🐞.

## Preview / staging (2026-10-01)

Work that customers shouldn't see yet goes on a branch (`prufa` is the standing one): every push gets a Vercel preview, the branch's stable URL is **https://bjorninn-quote-generator-git-prufa-bjorninn.vercel.app** (behind Vercel login — open it while signed in to Vercel; from the CLI: `vercel curl <path> --deployment <url>`). Previews have `AIRTABLE_TOKEN` + `VERK_KEY` and talk to the **same live Airtable base** as production — a test submission there creates real records (delete them after). When it's right: `git checkout main && git merge --ff-only prufa && git push`. Small, safe fixes can still go straight to main.

## Tests

`npm test` (node:test, no dependencies) runs [tests/](tests/): kp-submit (fresh / resumed / contact reuse / retries / validation), the proxy's privacy rules (Tengiliðir unreadable, Starfsmenn PIN query shape, write-only tables, ?k= contact fields, planner tables not creatable), every page's inline `<script>` parses, and the linemap's ids are well-formed. GitHub Actions runs it on every push ([.github/workflows/test.yml](.github/workflows/test.yml)) — a red ✖ on a commit means look before trusting that deploy. `npm run test:live` checks hard-coded Airtable ids against the live base (local only). Add a test when you fix a bug that a test could have caught.

## General gotchas

- Local dev: `.claude/launch.json` has a `vercel-dev` config (port 4322) that sources `.env.local` before running `vercel dev`, since `vercel dev` does **not** load `.env.local` into the function process on its own here — confirmed by direct testing (a custom test var placed in `.env.local` never showed up in `process.env` until the launch command explicitly `source`d the file first). `AIRTABLE_TOKEN`/`WEBHOOK_SECRET` are marked Sensitive in Vercel, so `vercel env pull` returns them empty — get a real PAT from the user and write it into `.env.local` (gitignored via `.env*`) to test locally.
- When building a query string for `/api/airtable`, always percent-encode with `encodeURIComponent` (not `URLSearchParams`, which turns spaces into `+`). The incoming request parser here does not decode `+` back to space, so a `+` in a `filterByFormula` field reference (e.g. `{Field Name}`) survives as a literal plus and Airtable's formula parser rejects it as an unknown field. `api/airtable.js` also normalizes any stray `+` back to `%20` before forwarding to Airtable, as a second layer.
- **Interfaces are built manually in Airtable, not by me**: I have no API access to add elements to an *existing* interface page (only create whole new pages, which show up as separate sidebar tabs, not sections stacked on an existing page) and no way to edit/rename singleSelect choices after creation (only whole-field create). Anything involving those has to be described step-by-step for the user to do themselves in the Airtable UI.
