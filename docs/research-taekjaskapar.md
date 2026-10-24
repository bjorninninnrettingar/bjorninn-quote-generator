# Research: "Tækjaskápar" (wow-factor) units — REVEGO, Hawa Concepta, AVENTOS, WingLine

Research only, 2026-10-24. Nothing was built and no code or Airtable data was changed.
Every number has a source link. Anything marked **óstaðfest / unconfirmed** was not found in a manufacturer
source, came from a reseller only, or the sources disagree. Check those before building on them.

Abbreviations from Blum: KH = cabinet height, KB = cabinet width, LW = internal width, LT = internal depth,
FH = front height, FD = front thickness, FG = front weight, LF = power factor (Leistungsfaktor), SOB = top panel thickness.

Main sources:
- [B-REV] Blum REVEGO programme page (EU): https://www.blum.com/eu/en/products/pocketsystems/revego/programme/
- [B-CAT533] Blum catalogue 2024/25, REVEGO overview p.533: https://publications.blum.com/2024/catalogue/en/533/
- [B-CAT534] Blum catalogue p.534 (uno): https://publications.blum.com/2024/catalogue/en/534/
- [B-CAT536] Blum catalogue p.536 (duo): https://publications.blum.com/2024/catalogue/en/536/
- [TD-HK] Blum technical data sheet AVENTOS HK top (TD-157/1EN-AA): https://d2.blum.com/services/BEC003/cme148001_td_dok_bau_$sen-au_$aof_$v1.pdf
- [TD-HL] Blum TD sheet AVENTOS HL top: https://d2.blum.com/services/BEC003/cme147999_td_dok_bau_$sen-au_$aof_$v1.pdf
- [TD-HS] Blum TD sheet AVENTOS HS top: https://d2.blum.com/services/BEC003/cme147998_td_dok_bau_$sen-au_$aof_$v1.pdf
- [TD-HF] Blum TD sheet AVENTOS HF top (TD-154/1EN-AA): https://d2.blum.com/services/BEC003/cme148000_td_dok_bau_$sen-au_$aof_$v1.pdf
- [TD-HKi] Blum TD sheet AVENTOS HKi: https://d2.blum.com/services/BEC003/cme148002_td_dok_bau_$sen-au_$aof_$v1.pdf
- [B-LIFT] Blum lift systems overview: https://www.blum.com/eu/en/products/liftsystems/
- [B-HKS] https://www.blum.com/eu/en/products/liftsystems/aventos-hk-s/programme/
- [B-HKXS] https://www.blum.com/eu/en/products/liftsystems/aventos-hk-xs/programme/
- [HAWA-C3] Hawa Concepta III product page (spec values are in the page's FAQ block): https://www.hawa.com/products/hawa-concepta-3/
- [HAWA-FAM] Hawa Concepta III Family: https://www.hawa.com/products/hawa-concepta-3-family/
- [HET-CMP] Hettich system comparison, folding doors: https://shop.hettich.com/th_EN/system-comparison/compare/group6164362375932
- [HET-HTA] Hettich Technical Assistant, WingLine L: https://hta.hettich.com/en-de/folding-door-systems/wingline-l
- [HEGAS-WL] Hegas news item "WingLine L fellihurðakerfi" (2026-01-08): https://hegas.is/wingline-l-fellihurdakerfi/

The Blum TD sheets are the Australian English editions. Their text was pulled from the PDFs and the tables were
read from that text. Most rows are clear. The few that weren't are marked as such below.

---

## 1) Blum REVEGO (pocket door system)

### Motion (for the 3D animation)
- Handle-less. A touch (TIP-ON) releases the front. The front swings open about 90°, then you push it straight
  back along the cabinet's side into a narrow dedicated cabinet next to the opening (the "pocket"). To close, you
  pull it out of the pocket and press it shut. Sources: [B-REV] ("Fronts open with a light touch thanks to the
  TIP-ON motion technology"; "press the door to release it from the pocket…"), and the overview page
  ("the full overlay fronts disappear into a dedicated narrow cabinet, the pocket"),
  https://www.blum.com/eu/en/products/pocketsystems/revego/overview/
- **uno** = one front sliding into one pocket of 100 mm. **duo** = two fronts sliding into **one** 150 mm pocket.
  The duo motion (the two fronts fold together, then slide in) is **inferred, not stated by Blum**. The
  arithmetic in [B-CAT533] backs it up: mounting width minus pocket equals internal width (uno 900 − 100 = 800;
  duo 1500 − 150 = 1350; duo+duo 3000 − 2×150 = 2700). Blum's pages only say "slide-in door system for a double
  door". **Confirm the duo motion against a Blum video or assembly guide (www.blum.com/a550) before animating it.**
- Can be full height (with or without plinth) or "a half-height structure mounted on a worktop" [B-REV], [B-CAT534].

### Dimensions (mm), Blum EU programme page [B-REV], same values in catalogue [B-CAT533]/[B-CAT534]/[B-CAT536]

| Variant | Fronts | Mounting width EB | Internal width LWA | Front width FB | Pocket width | Web code |
|---|---|---|---|---|---|---|
| uno | 1 | 450–900 | (350–)800 | 442–898 | 100 | DQIU7Y |
| uno + uno | 2 | 900–1800 | (700–)1600 | 442–898 | 2 × 100 | DQDN1C |
| duo | 2 | 900–1500 | (750–)1350 | 442–748 | 150 | DQITIM |
| uno + duo | 3 | 1350–2400 | (1100–)2150 | 442–898 / 442–748 | 100 + 150 | DQIUXA |
| duo + duo | 4 | 1800–3000 | (1500–)2700 | 442–748 | 2 × 150 | DQIVMM |

All variants share these values [B-REV]:
- Installation height EH: **1155–3012**. Internal height up to 2999 (uno) / 2884 (duo).
- Installation depth ET: **from 573**. Internal depth from 518 (uno) / 483 (duo). Pocket depth from 553.
- Pocket height: 1142–2999.
- Front height: **1130–2980**. Front thickness: **18–26**. Front weight: **max 35 kg per front**.
- Some regional Blum pages (Taiwan, Thailand) still show an older range: installation height **1820**–3012,
  front height 1800–2980. These pages appeared in search results, e.g.
  https://www.blum.com/tw/en/products/pocketsystems/revego/programme/. The EU page is the current one.

### Article numbers / sets
- Blum sells REVEGO by configuration (web code), not as one article number. You enter the web code in the
  Product Configurator (www.blum.com/s050) to get the parts list [B-CAT533].
- Pocket connector parts depend on the **pocket side thickness**. Resellers list 18–19 mm and 15–17 mm versions,
  e.g. "REVEGO duo pocket connector 802V580B, with plinth, 18–19 mm":
  https://lincolnsentry.com.au/revego-duo-pocket-connector-802v580b-with-plinth-18-19mm/p/7115221 and
  https://kitchenlibrary.au/collections/blum/products/blum-revego-duo-double-door-application-with-plinth-for-pocket-side-thickness-15-17mm
  **óstaðfest**: no Blum page confirms this.

### Production / CNC notes (summary only)
- The pocket is a narrow cabinet of its own, with Blum pocket rails and connectors. Fronts are TIP-ON and use no
  normal side hinges. Pocket side thickness affects which parts you order (above).
- `/cnc` already skips hinge drilling on pocket doors and says to follow the manufacturer's instructions
  (`cnc-sides.js` line ~345). Blum publishes assembly and drilling data at www.blum.com/a550 [B-CAT534]. The
  drilling positions were not pulled.

---

## 2) Hawa Concepta (pivot / slide-in, Hawa Sliding Solutions AG)

### What is current
- **Hawa Concepta III** (models **15, 25, 35**) is the current line [HAWA-C3]. The "15" is new, made for low and
  compact furniture such as base cabinets and islands [HAWA-C3].
- The older **Concepta 25 / 30 / 40 / 50** line has been replaced by Concepta III. Hranipex says Concepta III
  "replaces the older Concepta version":
  https://www.hranipex.de/en/product/hawa-concepta-iii-25-basic-set-left-door-height-1200-2200-mm-fwf010316.
  Old Concepta 50 was rated up to 50 kg (manual: https://www.manualslib.com/manual/1989847/Hawa-Concepta-50.html).
  Don't plan on the old line.
- **Hawa Folding Concepta III** (20 / 25, Push or Pull) also exists. It folds two doors together and slides them
  into the cabinet, and can be combined with Concepta III into three-door fronts with no separating wall
  [HAWA-FAM]; https://www.hawa.com/products/hawa-folding-concepta-3

### Motion
- Two movements. The door opens 90° on a pivot-hinge, then slides sideways into the side recess (pocket). To close,
  you pull it out again and it closes flush. Push version (handle-less) and Pull version (with handle). Wooden
  doors only [HAWA-C3].

### Data, Hawa Concepta III [HAWA-C3] (FAQ block on the product page)
- Door height **1200–2700**, door width **440–750**, door thickness **18–26**, door weight **6–35 kg**.
  These are family-wide figures. Per model: Concepta III 15 = 4–15 kg, height from 600; 25 = 6–25 kg;
  35 = 10–35 kg. **The per-model widths are óstaðfest**: a search summary of the same page gave 350–700 (15) and
  350–750 (25/35), but the page text pulled here only shows the 440–750 family range.
- **Pocket:** the hardware inside the pocket always takes **55 mm**. Add 1–2 cabinet sides (usually 16–19 mm),
  so plan a pocket **at least 87 mm** wide [HAWA-C3].
- Set structure (distributor Hranipex, matches Hawa naming). One door needs a **vertical (upright) profile + basic
  set + opening kit (Push or Pull)**:
  - Concepta III 25 basic set, left F010316 / right F010317: door height **1200–2200**, max **25 kg**.
  - Concepta III 35 basic set, left F010318 / right F010319: door height **1900–2700**, max **35 kg**.
  - Upright profile F010315 (L 1974 mm, for 1200–2200) / F010314 (L 2474 mm, for 1900–2700).
  - Connector set 55 mm, exterior connection to cabinet: F010324. Connector top / bottom 110 mm "for two
    pivot slide-in doors": F010325 / F010326. This is probably what makes a "tvöfalt kerfi" (two doors sharing a
    pocket), but that is **óstaðfest**.
  - Sources: https://www.hranipex.com/en/product/hawa-concepta-iii-25-basic-set-left-door-height-1200-2200-mm-fwf010316 ·
    https://www.hranipex.de/nl/product/hawa-concepta-iii-35-basic-set-left-door-height-1900-2700-mm-fwf010318 ·
    https://www.hranipex.com/en/product/hawa-concepta-iii-upright-profile-l-1974-mm-h-1200-2200-mm-silver-anodized-fwf010315 ·
    https://www.hranipex.com/en/product/hawa-concepta-iii-connector-bottom-110-mm-for-two-pivot-slide-in-doors-fwf010326
- **Not found:** minimum cabinet depth, minimum width of the opening, and any Concepta III 15 set numbers.
  Hawa has a configurator that produces installation plans [HAWA-C3].

---

## 3) Blum AVENTOS (lift systems for wall units)

### Power factor (applies to HK top, HKi, HF top, HK-S, HK-XS)
**LF = cabinet height KH [mm] × front weight incl. double the handle weight [kg].** Pick the mechanism whose LF
range contains the value. Where ranges overlap, take the stronger one. A third mechanism raises LF by 50% and is
recommended on wide cabinets so the front doesn't sag [TD-HK], [TD-HF], [TD-HKi].
HL top and HS top don't use LF. You pick by **KH + front weight FG** tables instead [TD-HL], [TD-HS].

### 3.1 AVENTOS HK top (stay lift: front tilts up and stays open at any angle)
- Motion: the one-part front pivots upward about its top edge and stays put. Opening angle is infinitely
  adjustable, **75°–107°**. No hinges needed [TD-HK].
- **KH 205–600**, **KB up to 1800** [TD-HK]. The Blum US page says 205–610 (8"–24"):
  https://www.blum.com/us/en/products/liftsystems/aventos-hk-top/programme/
- Lift mechanisms (sets of 2, chipboard screws / pre-mounted system screws) [TD-HK]:

  | Article | LF | Opening angle |
  |---|---|---|
  | 22K2300 / 22K2310 | 420–1610 | 75°–107° |
  | 22K2500 / 22K2510 | 930–2800 | 75°–107° |
  | 22K2700 / 22K2710 | 1730–5200 | 75°–107° |
  | 22K2900 / 22K2910 | 3200–9000 | 75°–107° |
  | TIP-ON versions 22K2300T / 2500T / 2700T / 2900T | same LF | 75°–107° (2300T/2500T), 75°–100° (2700T/2900T) |

- Max front weight **18 kg** with two mechanisms [TD-HK].
- Front fixing bracket 20S4200 (wooden fronts / wide alu), 20S4200A (narrow alu). Cover caps 22K8000. For
  SERVO-DRIVE: cover caps 23K8000 plus a SERVO-DRIVE set [TD-HK]. Thin fronts from 8 mm with EXPANDO T:
  https://www.blum.com/eu/en/products/liftsystems/aventos-hk-top/programme/
- Space needed above the cabinet when open: **Y ≈ FH × 0.29 + FD − SOB**. Top panel max 25.4 mm. Minimum
  internal height ~173 mm. "Min. 261 mm with visible wall hanging bracket" appears in the planning section; the
  sheet doesn't say what the 261 applies to, so that is **óstaðfest** [TD-HK].
- Suits small fronts: wall units, over the fridge, tall units [TD-HK].

### 3.2 AVENTOS HK-S (small stay lift)
- Motion like HK top, for small and light fronts. Opening-angle stops at **100° and 75°**. TIP-ON is available
  [B-HKS].
- KH **up to 600**, KB up to 1800 (depending on LF) [B-HKS]. The Blum US page says **186–610 mm (7-3/8"–24")**:
  https://iconnect.blum.com/us/en/products/liftsystems/aventos-hk-s/programme/
- 3 lift-mechanism types [B-HKS]. The articles are probably 20K2300 / 20K2500 / 20K2700 (+T for TIP-ON), but
  **the metric LF ranges are óstaðfest**: only US imperial reseller values were found, e.g. 20K2700 "175–349",
  https://www.cabinetparts.com/p/blum-hinges-lid-and-flap-stays-BA20K2700N5-p5130
- SERVO-DRIVE is not listed for HK-S on the Blum page [B-HKS].

### 3.3 AVENTOS HK-XS (smallest stay lift, works with hinges)
- Motion: the front pivots up on **normal CLIP top BLUMOTION hinges** at the top edge. The HK-XS only holds it
  open. Opening-angle stop **86°**. Mechanism on one side, or both sides for heavier fronts. TIP-ON is available
  [B-HKXS].
- KH **240–600**. Internal depth **from 100 mm** [B-HKXS].
- Lift mechanisms 20K1101 / 20K1301 / 20K1501 (+T). Reseller LF values: 200–1000 / 500–1500 / 800–1800,
  "doubled when used on two sides". At least 2 hinges per front, not included in the set. **óstaðfest**:
  https://www.richelieu.com/us/en/category/hinges-slides-and-opening-systems/opening-systems/suspension-arm/aventos-lift-mechanism-hk-xs/1186490/sku-20K1501
  · https://kjpselecthardwoods.com/products/blum-aventos-hk-xs

### 3.4 AVENTOS HKi (stay lift built into the cabinet side)
- Motion like HK top, opening up to **107°**. The mechanism sits **inside the side panel**, either fully or
  semi-integrated [TD-HKi].
- KH **162–600**, KB up to 1800. **Side panel thickness 16–25 mm**. Min internal depth **271 mm** [TD-HKi].
- 24K2300 LF 420–1610 · 24K2500 930–2800 · 24K2700 1730–5200 · 24K2800 2600–7800 (+T TIP-ON versions) [TD-HKi].
- **CNC:** the side panel needs a **milled slot**. Blum sells a dedicated machine for this, the MINIMILL (special
  order) [TD-HKi]. This is a real production change, unlike the other lift systems, which only need screw
  holes or 5 mm positioning holes.

### 3.5 AVENTOS HF top (bi-fold: two-part front folds in the middle as it lifts)
- Motion: two fronts joined by **CLIP top 120° unsprung hinges + a CLIP top centre hinge**. The top front swings
  up while the bottom front folds against it in the middle. The folded pair ends up above the cabinet. Opening
  angle **81°–116°**, multi-stage adjustable. It can stay open during use [TD-HF], and
  https://www.blum.com/eu/en/products/liftsystems/aventos-hf-top/programme/
- KH **480–1200** ("as of now!"). KB up to 1800. Min internal depth **264** [TD-HF].
- Lift mechanisms: **22F2500** (22F2510 system screws) LF **2700–13500**; **22F2800** (22F2810) LF
  **10000–19300**. A single mechanism (LF 1300–3000) is possible up to KB 600. Telescopic arms: 22F3200
  (KH 480–610), 22F3500 (KH 600–910), 22F3900 (KH 840–1200) [TD-HF].
- Asymmetric fronts: **the larger front must be on top**. Theoretical KH = top front height × 2 + gaps [TD-HF].
- Hinge set, wooden fronts (from the TD sheet's accessory table): 78Z5530T + 70T5590BTL + 177H3100. The exact
  set composition is **óstaðfest** because the extracted text was jumbled [TD-HF].
- Lincoln Sentry lists 22F2500 as LF 2700–13500, which matches:
  https://lincolnsentry.com.au/aventos-hf-top-22f2500-lift-mechanism-set-pf2700-13500-chipboard-screw/p/7115589

### 3.6 AVENTOS HS top (lift-up swing: one-part front swings up and over the cabinet)
- Motion: the one-part front lifts and swings **up and over**, ending above and partly over the top of the
  cabinet [B-LIFT], https://www.blum.com/eu/en/products/liftsystems/aventos-hs-top/programme/
- KH **350–800**, KB up to 1800, min internal depth **264** [TD-HS]. No cross stabiliser needed (Blum HS page).
- Picked by KH + front weight FG (incl. double handle weight) [TD-HS]:

  | Lift mechanism | KH | FG |
  |---|---|---|
  | 22S2200 / 22S2210 | 350–450 | 2.00–11.50 kg |
  | 22S2200 / 22S2210 | 450–540 | 2.50–12.50 kg |
  | 22S2500 / 22S2510 | 480–660 | 2.75–15.25 kg |
  | 22S2800 / 22S2810 | 650–800 | 3.50–18.50 kg |

- One lever arm for all sizes: 22S3500 [TD-HS]. Space needed above when open: **óstaðfest**. The figures are in
  the TD sheet's drawing but couldn't be read from the extracted text.

### 3.7 AVENTOS HL top (parallel lift: front rises straight up)
- Motion: the one-part front **lifts up parallel** to the cabinet and ends up above it [B-LIFT],
  https://www.blum.com/eu/en/products/liftsystems/aventos-hl-top/programme/
- KH **300–580**, KB up to 1800, min internal depth **264** [TD-HL].
- Lift mechanism 22L2200 (KH 300–389) / 22L2500 (KH 390–580). System-screw versions are 22L2210 / 22L2510
  [TD-HL].
- Lever arm picked by KH, with front weight FG [TD-HL]:

  | Lever arm | KH | FG | Min internal height LH |
  |---|---|---|---|
  | 22L3200 | 300–339 | 1.50–9.00 kg | 255 |
  | 22L3500 | 340–389 | 1.75–10.00 kg | 295 |
  | 22L3800 | 390–540 | 2.00–12.25 kg | 345 |
  | 22L3900 | 480–580 | 2.50–14.00 kg | 399 |

- Space needed above when open: Y ≈ 272.5 / 340 / 425 / 517 mm for 22L3200 / 3500 / 3800 / 3900. These values
  were read from the extracted planning table, which also has a/b/c columns, so **check them against the PDF
  drawing** [TD-HL].
- Cross stabiliser recommended from internal width ≥ 1190 mm or cabinet width ≥ 1228 mm [TD-HL].
- SERVO-DRIVE can be combined with it [TD-HL].

### 3.8 SERVO-DRIVE (electric opening)
- SERVO-DRIVE is a motion technology, not a separate lift type. It is available for HK top, HL top, HS top and
  HF top [B-LIFT], [TD-HK], [TD-HL], [TD-HS], [TD-HF]. It needs special cover caps, a drive unit, a distribution
  cable, a switch and a power supply unit. With three or more lift mechanisms, two synchronised drive units are
  recommended. The power supply unit needs 30 mm of clearance for air circulation [TD-HK].
- SERVO-DRIVE needs mains power at the wall unit. The planner already says "Rafmagn er tengt á staðnum" for LED,
  and the same will apply here.

### 3.9 Comparison

| Type | Motion | KH (mm) | Min internal depth | Selection | Hinges? | Notes |
|---|---|---|---|---|---|---|
| HK-XS | tilts up on hinges, 86° | 240–600 | 100 | LF (óstaðfest values) | **yes**, CLIP top | smallest, cheapest |
| HK-S | stay lift, 75°/100° | ≤600 (US: 186–610) | óstaðfest | LF (óstaðfest values) | no | small, light fronts |
| HK top | stay lift, 75°–107° | 205–600 | ~261 (óstaðfest) | LF 420–9000, 4 mechs | no | max 18 kg with 2 mechs |
| HKi | stay lift in side panel, 107° | 162–600 | 271 | LF 420–7800 | no | **milled slot in 16–25 mm side** |
| HF top | bi-fold, 81°–116° | 480–1200 | 264 | LF 2700–19300 | **yes**, CLIP top + centre hinge | tall wall units; larger front on top |
| HS top | up-and-over | 350–800 | 264 | KH + FG ≤18.5 kg | no | large one-part fronts |
| HL top | parallel lift | 300–580 | 264 | KH + FG ≤14 kg | no | needs the most free height above |

All types: cabinet width up to 1800 mm. Thin fronts are possible with EXPANDO T. All work with wooden fronts and
alu frames [B-LIFT].

---

## 4) Hettich WingLine (folding-sliding doors, sold here by Hegas)

### What is current
Hettich currently lists six folding-door systems [HET-CMP]:

| System | Wings | Max wing weight | Max wing width | Max wing height | Comfort / opening |
|---|---|---|---|---|---|
| **WingLine L** | 2 | 25 kg | 600 | 2600 | Pull to move Silent, Push to move, Pull to move |
| WingLine S | 2 | <5 kg | 450 | 1000 | same three |
| WingLine 220 | 2 | 25 kg | 500 | 2400 | none listed |
| WingLine 230 | 2 | 20–25 kg | 600 | 3000 | Pull to move Silent |
| WingLine 77 | 2 | 25 kg | 500 | 2400 | none listed |
| Wing 77 | 2 or 4 | 25 kg (2) / 20 kg (4) | 500 (2) / 400 (4) | 2400 | none listed; doors run in front of the cabinet, not side-mounted |

"WingLine 770" and "WingLine 26" don't appear in Hettich's current comparison [HET-CMP], so treat them as old
names. Electrical and mechanical locking is listed for all of them [HET-CMP].

### WingLine L, the one Hegas stocks
- Hegas: "WingLine L hentar fyrir hurðir allt að 600 mm á breidd og 2400–2600 mm á hæð". Now a stock item at
  Hegas, "á verulega lækkuðu verði", with push-to-open and damping [HEGAS-WL].
- Hettich HTA: wings **up to 25 kg** and **up to 2400 mm** high. Push/Pull-to-move, Silent System, tool-free
  installation, "minimal door protrusion". Bedroom, kitchen and office applications [HET-HTA].
- Height: 2400 (HTA) vs 2600 max (comparison table). The extra 2400–2600 range seems to need the bottom
  guide/double rail. Reseller Rocheleau: "max 2,600 mm with double rail", https://rocheleau.ca/en/Page/HettichWingline.
  The reseller Barbour gives wing width **250–600**, height **500–2600**, thickness **16–25 mm**,
  https://www.barbourproductsearch.info/wingline-l-prod1296248.html. **The minimum width, minimum height and
  thickness are óstaðfest** (reseller only).
- Sets come in **12 kg ("light") and 25 kg ("heavy")** versions, left/right, with or without self-closing:
  https://lincolnsentry.com.au/hettich-wingline-l-pull-to-move-silent-light-left-grey/p/7113827 ·
  https://lincolnsentry.com.au/hettich-wingline-l-double-hinge-standard-right-mount-12kg-grey/p/7113811
- One set = one folding door with 2 wings. A 4-wing front = two sets side by side (inferred, **óstaðfest**).

### Motion
- Two wings joined by **centre hinges**. The outer wing hangs on normal **Sensys cabinet hinges** on the cabinet
  side. A running unit at the top of the inner (free) wing runs in a top **runner profile**, and there is a
  guide profile at the bottom [HET-CMP]. When opened, the free edge slides along the top rail toward the hinge
  side while the two wings fold together. They end up folded at the side, standing more or less perpendicular to
  the cabinet front ("minimal door protrusion"). The protrusion in mm was **not found (óstaðfest)**. Hettich has
  a "WingLine door projection" planning tool [HET-HTA].
- Hinges: Push to move needs **unsprung** Sensys hinges (e.g. 8675 110° P2O). Classic/Pull to move uses Sensys
  8645i 110°. Centre hinges are **not included** in the sets, and how many you need depends on door height.
  Reseller info, **óstaðfest**:
  https://www.bricozor.com/41ea5charnieres-centrales-intermediaires-ferrures-wing-line-percage.html
- Drawers and pull-outs can sit behind the folding door (Hettich brochure, cited via
  https://www.woodworkingnetwork.com/product/components-hardware-and-assembly/folding-sliding-door-system).

### Not found
Cabinet depth requirement, side thickness, top panel requirement, exact protrusion when open, and the
centre-hinge count table. These are in the WingLine L planning PDF (Hettich catalogue
https://www.hettich.com/fileadmin/Media_Center/Catalogue/WingLine_L_HMV_2017_17611_en.pdf and the kitchen
brochure https://www.hettich.com/fileadmin/Media_Center/Catalogue/Wingline_L_Kitchen_HUK.pdf). Those PDFs
downloaded fine, but their text layer couldn't be read here. **Someone needs to open them and read pages 12–15
(planning).**

---

## 5) Björninn's Airtable records (base app91U15z9K704Okd, read-only check 2026-10-24)

Vörulisti 🚪 = tblzuuRSRkeXaLWxC, Útfærslur = tbl8HjvBwNJ41cTV0. Prices are `Innkaupsverð` (fldxQkro6tLV0hjdz) in kr.
Searches run (name and vörunúmer fields, Vörulisti and Útfærslur): aventos, revego, concepta, hawa, wingline,
hettich, blum, lyfta, lyftihurð, lift, vasahurð, fellihurð, servo, rennihurð.

### Pocket doors

| Vörulisti rec | Heiti | Vörunúmer | Flokkur | Innkaupsverð | Birgir | Útfærsla |
|---|---|---|---|---|---|---|
| rec3l2PsXk0aLLpVi | BLUM - Revego UNO | REVEGOUNO | Flókin kerfi | 155,000 | INNVAL | **recfSLkM50Ciz60Z0** "BLUM - Revego UNO" ✔ |
| recN2TnlS1sahXSXM | BLUM - Revego DUO | REVEGODUO | Flókin kerfi | 255,000 | INNVAL | **recSGWz9T3CaWSIdI** "BLUM - Revego DUO" ✔ |
| recwZzA9ROkEWsJQ6 | BLUM - Revego UNO + UNO | REVEGOUNOUNO | Flókin kerfi | 310,000 | INNVAL | recorckasOC5NtB56 |
| recg09WGyz5BEtBTx | BLUM - Revego UNO + DUO | REVEGOUNODUO | Flókin kerfi | 410,000 | INNVAL | recM5leP8c6aU3zRh |
| recLVN1FX5GX3iZ56 | BLUM - Revego DUO + DUO | REVEGODUODUO | Flókin kerfi | 510,000 | INNVAL | recbt57ZQAT1s9roq |
| rec7a2rlUBR09DnHc | Hawa Concepta III einfallt kerfi | CONCEPTA3UNO | Flókin kerfi | 173,376 | Járn og gler | **recvfAjKyZeokEk6U** ✔ |
| recQy7Ml7j6wX2cpS | Hawa Concepta III tvöfalt kerfi | CONCEPTA3UNOUNO | Flókin kerfi | 312,077 | Járn og gler | **recJYxvj0ERXyeUmw** ✔ |

✔ = the Útfærsla id the planner uses (verified). All REVEGO/Concepta records were created 2025-12-21. The
Concepta vörunúmer `CONCEPTA3UNOUNO` suggests "tvöfalt" means **two single doors** (UNO+UNO, i.e. two pockets or
a shared 110 mm connector), not a folding pair. The planner's `pocketLeafOf` treats it as the "duo" of Concepta.
**Ask Rakel/the supplier what "tvöfalt kerfi" actually contains.** Concepta III 25 vs 35 (25 kg / 35 kg, height
ranges) is not split in Airtable.

### AVENTOS

| Vörulisti rec | Heiti | Vörunúmer | Flokkur | Innkaupsverð | Birgir | Útfærsla |
|---|---|---|---|---|---|---|
| recF5UPkMansts2gi | Aventos HK-Top lyfta | AVENTOSHK | Flókin kerfi | 9,051 | INNVAL | **recguDtSfkhwH32U6** "Aventos HK-Top lyfta" ✔ |
| recOQGZH7j7XyYd5x | AVENTOS HL-Top | AVENTOSHL | Flókin kerfi | 15,515 | INNVAL | **recHqMOZkfg9tcWtn** "AVENTOS HL-Top" ✔ |
| rec5wdy6JOiDOJ8oS | **"500 x 400mm"** (sic) | AVENTOSHL (duplicate vörunúmer) | Stakar vörur / aukahlutir | 74,813 | INNVAL | **recCMF1q3qNtZsb8l** "Aventos HL Fronta lyfta Rafknúin" ✔ |

Observations:
- The electric HL record is named "500 x 400mm", shares the vörunúmer `AVENTOSHL` with the mechanical one, and
  sits in a different category ("Stakar vörur / aukahlutir", not "Flókin kerfi"). The name probably reflects the
  quoted front size (KH 400 → 22L2500 + 22L3800 per the HL table above). It's a data-quality issue worth fixing
  by hand.
- The prices don't say what a set contains (lift mechanism pair, lever arms, front brackets, cover caps), or
  which LF/KH range they were bought for. A 9,051 kr HK top is plausible for one mechanism set.
  **óstaðfest**: whether it's one pair or a complete set.
- **Missing entirely:** HK-S, HK-XS, HKi, HF top, HS top, and SERVO-DRIVE for anything other than HL. Hegas's
  lift page sells **Hettich** lifts (normal + electric), https://hegas.is/hurdalyftur/, but none are in
  Vörulisti under "lyfta/lift".

### WingLine / Hegas

| Vörulisti rec | Heiti | Vörunúmer | Flokkur | Innkaupsverð | Birgir | Útfærsla |
|---|---|---|---|---|---|---|
| rec6cbiQ4JDDsCp0c | Wingline L | WINGLINEL | Flókin kerfi | 16,440 | HEGAS (rec6mUvhApo8FRKrC) | **recRiQRmHo15SOGd2** "WingLine L" |

- Created 2026-03-03. It has already been ordered once (linked to PO-379).
- **Not** used by the planner (no WingLine id anywhere in kitchen-planner.html).
- Unknown: 12 kg or 25 kg set, Push or Pull, whether centre hinges and Sensys hinges are included, and whether
  16,440 kr is per 2-wing door.
- The supplier record HEGAS (tbl2akoCETBx9S1SK / rec6mUvhApo8FRKrC) also links Topline sliding systems, Emuca
  Fatalyfta, Roller, and others. Nothing else in the WingLine family.

### Search hits that aren't relevant (for completeness)
"Junior 100" sliding-door tracks (Járn og gler), Topline / Magic 2 sliding wardrobe systems, Kesseböhmer
Fatalyfta, Blum TIP-ON records. No records match "vasahurð", "fellihurð", "lyftihurð" or "servo".

---

## 6) What the planner already supports (code read, nothing changed)

- **Pocket doors (Rennihurð í hlið):** in Smíða (PRO), a door's spec can be `type:"pocket"` with
  `pocketSys:"revego"|"concepta"` (kitchen-planner.html ~12304–12313, 12660–12661). Tall units also have a
  toggle "Á lömum / Rennur inn í hlið" in the box editor (~8232–8254, 8395–8401).
  `POCKET_PRODUCTS` (~9366) maps to the Útfærslur above. `pocketLeafOf` (~9377) picks **duo when width > 600**
  (and not fridge/corner), using the same rule as the two-leaf hinged split. **This conflicts with Blum: REVEGO
  uno covers mounting width 450–900 and duo starts at 900** (section 1). Combination SKUs (UNO+UNO etc.) are
  deliberately left out. V3 gets the product. Notes text says to confirm width and price (~9486–9489).
- **AVENTOS (Lyfta):** PRO-only `<select data-role="aventos">` on wall units without panel/shelf stack/open
  (~8263). `AVENTOS_PRODUCTS` (~9372) has only **hktop, hltop, hlrafk**. It goes to V3 (`v3RecordsFor`, ~9384),
  plus a note "staðfestu stærð og þyngd framhliðar gagnvart lyftunni" (~9519). Smíða also has a door type
  `"lift"` ("Lyftihurð: engar lamir í hliðum — lamirnar fara í toppborðið", ~12304–12306). It is exported to
  Smíðagögn as `hinge:"top"` (~13257).
- **No validation** against any manufacturer limit: no KH/FH/weight/LF checks, no min height or depth for
  REVEGO, no pocket width taken out of the internal width.
- **3D:** `kitchen-planner-3d.js` has **no lift, pocket or folding motion**. Leaves swing on left/right hinges,
  drawers slide, and "bottom" flaps tip on their lower edge (`makeLeaf`, ~2440–2502). Pocket and lift doors
  currently render and animate like ordinary hinged doors. Grep for pocket/aventos/revego/concepta in the 3D
  file found nothing.
- **CNC (`cnc-sides.js` ~344–345, 458):** lift doors get no side hinges (warning: hinges go in the top panel).
  Pocket doors get no hinges, plus a warning to follow the manufacturer's instructions. Lift fronts aren't
  drilled.
- **"+ Ný eining":** the old "Tækjaskápar" group was renamed **Eldhústæki** (~5614, comment "that name goes to
  the lift / pocket-door group (2026-10-24)"). The new group doesn't exist yet.
- **WingLine:** nothing in the planner.

---

## 7) Open questions for the owner (the data can't decide these)

1. **Which systems do we actually sell?** REVEGO (INNVAL, 155–510k), Concepta III (Járn og gler, 173–312k), or
   both? Should the customer pick a system, or only "rennihurð í hlið" with Rakel choosing in PRO?
2. **REVEGO duo threshold:** follow Blum (uno up to 900 mounting width, duo from 900), or keep the current
   ">600 = duo" rule? A 600–900 opening with one front is valid uno.
3. **REVEGO depth:** Blum needs installation depth **≥573 mm**. What is Björninn's standard tall unit depth? If
   it is under 573, does a REVEGO unit get a deeper carcass, or is it blocked?
4. **What is in "Hawa Concepta III tvöfalt kerfi"** (vörunúmer CONCEPTA3UNOUNO)? Two pockets, or two doors on a
   110 mm shared connector? And should we split Concepta III 25 (≤2200 high, 25 kg) from 35 (1900–2700, 35 kg)?
5. **Which AVENTOS types belong in the customer-facing group?** All seven in the data (HK-XS, HK-S, HK top, HKi,
   HF top, HS top, HL top) + SERVO-DRIVE, or a short list (e.g. HK top, HF top, HL top, + "rafknúin")?
   HKi needs a milled slot in the side (MINIMILL), which our CNC flow doesn't do today.
6. **AVENTOS pricing records:** what does the 9,051 kr HK-Top / 15,515 kr HL-Top / 74,813 kr "500 x 400mm"
   record contain (one mechanism pair? full set with arms, brackets, caps?). And which LF/KH sizes did INNVAL
   quote? We need prices per type before a customer sees a price. Fix the "500 x 400mm" name and duplicate
   vörunúmer.
7. **Front weight:** LF and HL/HS selection need front weight. Do we have kg/m² per front material (Efnislisti)
   so the planner can compute it, or do we stay with "söluaðili staðfestir"?
8. **WingLine:** which variant is the Hegas 16,440 kr record (12 kg/25 kg, Push/Pull, left/right)? Does the price
   include centre hinges and Sensys hinges? Do we also want Hettich's own lift (Hegas, "Lift Advanced") as an
   alternative to AVENTOS?
9. **WingLine planning dimensions** (cabinet depth, protrusion when open, centre-hinge count): someone needs to
   read pages 12–15 of the Hettich WingLine L planning PDF, or ask Hegas, before we draw the open state in 3D.
10. **SERVO-DRIVE / electric:** the customer must provide power at the wall unit. Same note as LED, or a separate
    "rafvirki þarf" step?
11. **Is this group PRO-only, like today's Lyfta and Rennihurð** (comment ~9359: "never customer-facing… the real
    cost is Rakel's call"), or customer-facing in "+ Ný eining" as the brief implies? That decision changes how
    much validation the planner must do itself.
