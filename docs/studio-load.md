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

Live site, same harness. "Before" = runs on production just before this round (the previous deployment is behind
Vercel login, so it couldn't be re-run); "after" = 3 runs at 20 Mbit/s + 1 unthrottled, after deploy. Times in ms
from the action (page load / "Halda áfram" click / "Áfram" into Höldur).

| | before | after |
|---|---|---|
| Welcome: room cards on screen | 1430–2100 | 1430–1830 |
| Welcome: hero picture in | 1670–2750 | 1700–2000 |
| Welcome: 3D kitchen faded in | 2150–4720 | 2180–2560 |
| Welcome: bytes in the first ~5 s | 3.0 MB (dishwasher 940 KB at ~2.3 s) | 2.6 MB (dishwasher 776 KB, fetched at ~4.5 s, after the 3D is up) |
| Materials: preview (cue or 3D) after "Halda áfram", **unthrottled** | 1500 / 3D 1610 | 83–110 / 3D 98–110 |
| Materials: the 8 drawer models (re-validation) | ~900 | 0 (served from cache) |
| Materials: front thumbnails on screen | 1615 (unthrottled) | 420–1050 (20 Mbit/s) |
| Höldur: all handle pictures in | **6400** (blank grey until then) | **1040–1260** (shimmer until then) |
| Höldur: Crossing's model after the click | 260–360 | 58–330 (0 when hovered first) |
| A picked front in 3D while its photo loads | black | its own colour |

Not done (bigger jobs, flagged): the page itself is 1.17 MB of HTML (326 KB brotli) + 0.5 MB `kitchen-planner-3d.js`,
which is most of the ~1.5 s to the first welcome screen — splitting the inline script out (cacheable, versioned)
would be the next real win. The 11 MB dishwasher baskets could become a quantised .glb (~10× smaller) if they ever
show up early again.

## Speed round 2 (2026-10-29) — "run smooth on almost any computer"

Goal (owner): faster on weak machines, nothing visibly worse. Three changes, each with an off-switch or a tiny blast radius:

1. **Draw only when something can have changed** (kitchen-planner-3d.js, `IDLE_MS`, `idleBump`, `idleCameraMoved`, `var busy =` in `loop`). The main 3D loop used to redraw every frame even with a still picture (with AO on a 2× screen that keeps a weak GPU/battery busy while the customer just reads or types a number). A frame is now drawn while input is recent (2.6 s after any pointer/key/wheel/click/input/resize/focus), while the camera/projection/target moves (+0.9 s so fades finish), while walking / dragging / models load, and as a safety net **one frame every 250 ms** (anything that arrives by another route shows within a quarter of a second). `?q=full` in the URL = the old always-draw behaviour (A/B + emergency off-switch). Measured by an agent in the editor (WebGL draw calls/s, `?q=low`, 1280×720): idle **5.8k vs 83.4k** (≈14.5× fewer), during a camera drag **60.6k vs 60.1k** (identical), after release full speed ~3 s then back to the net. Checked by hand: fades behind walls, selection ring, new cabinet, width change, view switches, resize, side panel — no case of a stale picture. Not checked on real hardware: one run of screenshots after resize + X-Ray showed an older frame for a moment in the idle path (not in `?q=full`); most likely the hidden Browser pane / screenshot lag, but watch for a flash on real Chrome. The preview canvases (`PREVIEW.raf`, welcome kitchen) still draw every frame — next candidate.
2. **English dictionary is its own file** (`kitchen-planner-i18n-en.js`, 154 KB / ~51 KB gz). `kitchen-planner-i18n.js` (5 KB) is just the runtime; it `document.write`s the dictionary only when `window.KP_ENGLISH === true` and English is chosen. Icelandic visitors no longer download or parse it. `tests/kp-i18n.test.js` loads both files.
3. **three.js modules fetched side by side**: `<link rel="preconnect">` to cdn.jsdelivr.net and `<link rel="modulepreload">` for all 23 modules the page actually loads (three, OrbitControls, post-processing + shaders, GLTF/Collada/TGA loaders, BufferGeometryUtils). Before: three waves (t≈50, 100, 830–1050 ms on a fast link); after: all 23 start at the same ms, none duplicated. **The links MUST come after the `<script type="importmap">`** — before it, `import … from "three"` cannot be resolved and the whole page breaks (this happened once during the round and was fixed). Keep the list in step with the importmap and with what `performance.getEntriesByType('resource')` shows from jsdelivr.

Not done, with reasons: lazy-loading `-pro-help/-package/cnc-sides` (≈15 KB gz, not worth the risk); `-worktop` and `-workdraw` look PRO-only but customers' line items and drawings PDF use them. A real minify step for the 1.8 MB page (≈ -35 % bytes/parse) needs a build step Vercel doesn't run today.
