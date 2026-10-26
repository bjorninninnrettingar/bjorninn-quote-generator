# Studio — first-visit loading (2026-10-26)

QA item F6 (`/private/tmp/claude-501/studio-qa-2026-10-26.md`): on a first visit the 3D preview and the handle
pictures sat blank for 4+ s with no loading cue. This round: measure, fix the biggest wins, measure again.

## How it was measured

Headless Chrome with a **fresh profile** (cold cache), 1440×900, network throttled to 20 Mbit/s + 30 ms (a normal
home connection), driven over the DevTools protocol (script kept outside the repo, in the session scratchpad:
`measure.mjs`). Each run: load `/skipuleggja` → welcome page → reload with a draft at the materials step (cache now
warm for what the welcome page fetched, like a real visitor moving on) → "Halda áfram" → Framhlið → pick a front →
Höldur → pick Crossing. `/api/kp-submit`, `/api/kp-pro`, `/api/kp-studio` are blocked so nothing reaches Airtable.

## What was slow (before)

- **Every model / photo was re-validated on every visit** — Vercel served all static files with
  `max-age=0, must-revalidate`, so moving between steps sent ~60 conditional requests (each a full round-trip,
  0.3–0.9 s on a cold edge) queued behind whatever else was loading. The drawer models in the materials preview
  took ~0.9 s just to be told "not modified".
- **The welcome page downloaded the 11 MB dishwasher model** (941 KB brotli) — the showcase kitchen has an
  integrated dishwasher, whose baskets are only visible once its door is tapped open. It also had to be parsed (11 MB
  of XML) while the welcome scene was turning.
- **Handle pictures had no placeholder** — plain grey tiles for 2–6 s on a busy connection.
- **A picked front showed BLACK in 3D** until its photo texture (300–600 KB webp) arrived — a three.js texture with
  no image yet renders black.
- Collada files carried 7 significant digits + noise (`1.776357e-15`) on every number.

## What changed

| Change | Where |
|---|---|
| `Cache-Control: public, max-age=86400, stale-while-revalidate=2592000` on `/models/`, `/materials/`, `/handles/`, `/images/`, `/icons/` (HTML/JS stay `max-age=0` — parallel sessions deploy all day). A replaced model/photo reaches a returning visitor within a day; give it a new file name if it must be instant. | [vercel.json](../vercel.json) |
| Every `.dae` slimmed with [tools/slim-dae.py](../tools/slim-dae.py): positions rounded to 0.001 mm, normals/UVs to 5 decimals, indentation dropped. Checked by loading old and new side by side: same meshes and vertex counts, max position change 0.0007 mm. Dishwasher: the unused body groups (`group_0/1/69`) dropped — only `group_3`/`group_36` (the baskets) are drawn. 23 MB → 17 MB on disk, 3.4 → 2.8 MB gzipped, ~45 % less XML to parse for the drawers. | `models/**/*.dae` |
| Oven and wine cooler pointed a second texture reference at an identical copy (`…_1_0.jpg`, `…_21_1.png`) → now the same file, one download less each (162 KB for the oven). | `models/appliances/oven|wine/model.dae` |
| Dishwasher baskets (`APPL_SRC.dwLower/dwUpper`, `idle:true`) load 2.5 s after first being asked for, at idle — the drawn baskets show until then, exactly as before. | [kitchen-planner-3d.js](../kitchen-planner-3d.js) `applModel` |
| `imgTex(THREE, url, color)`: until the photo is in, the texture is a 2×2 swatch of the look's/worktop's own `color3d`; the photo then arrives as a new `THREE.Source` (fresh GPU texture at its real size) so every clone sharing it updates. `modelsPending()` now also counts photos still loading, so a drawing export waits for them. | kitchen-planner-3d.js |
| Loading cues: `.sw-tile img:not(.ld)` shimmers (a capture-phase `load`/`error` listener sets `.ld`); tiles with their own colour behind the picture (fronts, worktops) keep that colour. `#cabPreview`, `#uwPreview`, `#threeWrap` show a small turning ring while `:empty`; the existing "Hleð 3D…" note got a spinner. Reduced motion: no animation. No new strings. | [kitchen-planner.html](../kitchen-planner.html) CSS after `.sw-crop img` |
| Preload on hover: resting 120 ms on a `[data-handle]` / `[data-look]` / `[data-top]` tile calls `KP3D.preload(kind, key)` — the handle's model / the front's or worktop's photo starts downloading before the click. | kitchen-planner.html (next to the load listener), `KP3D.preload` |

Already fine, left alone: swatch grids use `_t.webp` thumbnails with `loading="lazy"`; everything is served brotli;
three.js comes from jsDelivr with a year-long immutable cache.

## Numbers

<!-- filled in after deploy -->
