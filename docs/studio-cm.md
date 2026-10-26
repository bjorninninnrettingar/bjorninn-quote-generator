# BJÖRNINN STUDIO — customers see cm (2026-10-26)

Owner's rule: a customer never sees mm. PRO (`?pro=`) keeps mm. State, saved drafts and everything sent to
Airtable stay **mm** — only display and typing changed, so drafts saved before this load unchanged.

## How it works
- `kitchen-planner-3d.js`: `KP3D.unitCm` (set by the planner to `!KPI18N.isPro`), `KP3D.dimNum(mm)` → "60" / "60,5"
  (cm, decimal comma in IS) or "600" (mm), `KP3D.dimLen(mm)` → "60 cm" / "600 mm". Both answer mm inside
  `KPI18N.asIS(...)` (new getter `KPI18N.forced`), which is where Airtable text is built.
- `kitchen-planner.html` (right after `var KP3D = window.KP3D`): `uNum`, `uLen`, `uUnit`, `uDims` ("80 × 257 × 58 cm"),
  `uDimsBare` (PRO keeps its unit-less "800 × 2570 × 580"), `uText` (product names: "LED-borði 4×8 mm" → "0,4×0,8 cm").
- **Length inputs:** markup is still written in mm and marked `data-len`. A MutationObserver (`cmFields`) turns each
  one into a cm field for a customer — min/max/step divided by 10 (step < 10 mm → 0.5 cm), and an own `value`
  getter/setter so `inp.value` still reads and writes **mm**. Every existing handler keeps working in mm; typing
  60,5 stores 605. New length inputs: just add `data-len`.
- Messages: "{a}–{b} mm" keys became "{a}–{b} {u}" / "{n}" with `uLen()` values (EN entries in the
  "cm for customers" block of kitchen-planner-i18n.js; the old mm keys' EN entries are left, unused).

## Where it changed
Room pages (wall list + drawing + dim popup, skáskurður, lofthæð, burðarstólpar/milliveggir, openings list and
elevation pills, water pills, plan-import prompt), editor panel (Mál (cm), Frá gólfi, shelf gap, úthlið thickness,
openings, obstacles, wall panel "langur · lofthæð", laust pláss), floating bar chip + its inputs, the Rými/Gluggar
menu sizes, fit warnings + "Viltu setja hann … breiðan", drawer-height toasts, sink note, worktop thickness, island
length, keyboard help, 2D/Ofanmynd labels and wall chain, wall-view (2D) dims, 3D height label, wardrobe 3D size
labels, shelf/rail drag gap labels, KP3D warnings (loft, skúffur/höldur, gangur), Málband, Allt heimilið
calibration + window/door sizes, Senda inn lighting row. Handle descriptions (20/32 cm), "Lausar hillur" label
(dropped "(38 mm)" — the panel shows the thickness).

## Left in mm on purpose
PRO-only screens (Smíða editor, Sökkulhæð panel, Mæling), Airtable notes / Skilaboð / Line Items, the drawings PDF
(production drawings), CNC. Bath "Hæð frá gólfi" chips were already cm everywhere.
