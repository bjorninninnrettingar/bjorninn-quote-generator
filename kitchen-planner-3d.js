// kitchen-planner-3d.js — shared 3D + 2D rendering for the kitchen planner.
// Loaded by kitchen-planner.html (customer flow and Rakel's PRO mode both run through this one file —
// kitchen-planner-review.html, a separate read-only review page, was removed 2026-10-17: never opened,
// PRO took over its job). Exposes everything via
// window.KP3D. Depends on window.__THREE__ / window.__OrbitControls__ being
// set by the importmap module script each host page includes in its <head>.
(function(){
  "use strict";
  // EN version (kitchen-planner-i18n.js): display strings go through __(); standalone (tests) it just fills {placeholders}
  var __ = window.__ || function(s, v){ return v ? String(s).replace(/\{(\w+)\}/g, function(m, n){ return Object.prototype.hasOwnProperty.call(v, n) ? v[n] : m; }) : s; };

  // Customers see cm, PRO sees mm (2026-10-26, docs/studio-cm.md). The planner sets KP3D.unitCm = !PRO;
  // anything built for Airtable runs inside KPI18N.asIS and stays mm. State is always mm.
  function unitCm(){ return !!(window.KP3D && window.KP3D.unitCm) && !(window.KPI18N && window.KPI18N.forced); }
  // Customers see whole cm (78,7 → 79; a 19 mm úthlið → 2) — user, 2026-10-26. `exact` keeps one decimal (product
  // names like "LED-borði 0,4×0,8 cm"); typed inputs (data-len) keep their own exact value.
  function dimNum(mm, exact){
    if (!unitCm()) return String(Math.round(mm));
    var v = exact ? Math.round(mm) / 10 : Math.round(mm / 10), t = v % 1 ? v.toFixed(1) : String(v);
    return window.KPI18N && window.KPI18N.lang === "en" ? t : t.replace(".", ",");
  }
  function dimLen(mm){ return dimNum(mm) + (unitCm() ? " cm" : " mm"); }

  // HomeByMe-style catalog (2026-09-17): the core 3 types only, each a
  // FIXED-size item (min===max on every dimension) rather than a
  // customer-adjustable range — you pick a cabinet by clicking it and
  // choosing its type from a dropdown, not by typing width/height/depth.
  // Ofnaskápur and Töfrahorn (real oven-cavity + Le Mans corner types) are
  // paused, not deleted-forever — they'll come back as "underskápar"
  // variants once this base 3-type model is settled; see kitchen-planner.html's
  // collectEyðublaðRows(), which already no-ops cleanly on their absence
  // (its ovenHeightMm/tofrahornIds branches just never fire for these 3).
  var CATALOG = {
    // Every dimension is editable per cabinet (typed in the properties panel,
    // clamped to minW..maxW etc.); w/h/d here are just the starting size.
    // Floor-unit h INCLUDES the 100 mm plinth: base units are 900 = 800 box + 100 plinth (production size,
    // 2026-10-09), so the worktop sits at ~932. Was 800 (700 box) until then.
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:200, maxW:1200, h:900,  d:600, minH:600,  maxH:1100, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,4,1], counter:true },
    // tall units: 2400 box + 100 plinth (user, 2026-10-09 — they were 2300 + plinth)
    harskapur:   { label:"Hár skápur",  airtableLabel:"Hárskápur", zone:"floor", cls:"tall",  defaultW:600, minW:300, maxW:1200,  h:2500, d:600, minH:1800, maxH:2700, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,8,5], railRange:[0,2,0] },
    // same body as harskapur, no front at all — open shelving, always built in the front material (2026-10-14)
    // drawerCountRange starts at 0 (off) — unlike the hasInterior types, drawers here sit ALONGSIDE
    // shelves/fataslá (always at the bottom, see addFrontDetailsInner), not instead of them (2026-10-22).
    // presets (2026-10-22): a quick-start recipe row in the wizard, set all three counts at once — the
    // manual steppers stay right below for fine-tuning, nothing is lost by picking one.
    harskapurOpinn: { label:"Opinn hárskápur", zone:"floor", cls:"tall", defaultW:600, minW:300, maxW:1200, h:2500, d:600, minH:1800, maxH:2700, minD:300, maxD:700, hasInterior:false, shelfRange:[0,8,5], railRange:[0,2,0], drawerCountRange:[0,4], open:true,
      presets: [
        { key:"shelves", label:"Bara hillur", shelves:8, rails:0, drawers:0 },
        { key:"shelvesRail", label:"Hillur + fatasláar", shelves:5, rails:1, drawers:0 },
        { key:"doubleRail", label:"Tvöföld fatasláar", shelves:0, rails:2, drawers:0 },
        { key:"drawers", label:"Skúffuskápur", shelves:1, rails:0, drawers:4 },
        { key:"mixed", label:"Blandað", shelves:2, rails:1, drawers:2 }
      ] },
    efriskapur:  { label:"Efri skápur", airtableLabel:"Efriskápur", zone:"wall",  cls:"wall",  defaultW:600, minW:200, maxW:1200, h:1000, d:300, minH:300,  maxH:1200, minD:100, maxD:450, hasInterior:false, shelfRange:[0,5,2] },
    // Built-in fridge: NOT its own Skápategund in the schema (Skápategund has
    // Grunn/Hár/Efri/Lagna/Ofna/Loftunarskápur only) — physically a Hárskápur
    // housing a bought appliance, so it submits as Hárskápur plus a plain note
    // (same pattern as the drawer note) and Rakel confirms the niche size.
    isskapur:    { label:"Ísskápur (innbyggður)", zone:"floor", cls:"fridge", defaultW:600, minW:600, maxW:900, widths:[600, 700, 900], fixedWidths:true, h:2500, d:600, minH:1700, maxH:2700, minD:500, maxD:750, hasInterior:false,
                   skapategundOverride:"Hárskápur", fridge:true,
                   note:"Viðskiptavinur óskar eftir innbyggðum ísskáp í þessum skáp — vinsamlegast staðfestu stærð tækis (nisju) og hurðargerð." },
    // Special units: oven tower and Le Mans corner map to real Airtable fields
    // (Hæð ofns, Töfrahorn útfærsla); the sink base and open shelves have no
    // schema of their own, so they submit as Grunnskápur / Efriskápur plus a
    // plain note for Rakel.
    // b.ovenCombo = the drawer combo under the oven (an Útfærslur key, "" = cabinet door, no drawers)
    // ovens are 600 wide (user, 2026-10-02); "Í grunnskáp" = the low oven cabinet below (OFN6)
    ofnaskapur:  { label:"Ofnaskápur",  zone:"floor", cls:"oven",  defaultW:600, minW:600, maxW:600, h:2500, d:600, minH:1800, maxH:2700, minD:500, maxD:750, hasInterior:false, ovenHeightMm:595, oven:true },
    // ---- 2026-09-30: types that exist as real Útfærslur (see kitchen-planner-linemap.js) ----
    // Búrskápur: tall pantry, doors outside, a real drawer/shelf set inside (b.burCombo)
    ofnaskapurLagur:{ label:"Ofnaskápur (í grunnskáp)", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:900, d:600, minH:850, maxH:1000, minD:550, maxD:700, hasInterior:false, counter:true, oven:true, lowOven:true },
    // Blint horn með hillum: the Töfrahorn's shape (door on one half, blind panel on the other) with plain shelves
    hornskapur:  { label:"Hornskápur með hillum", zone:"floor", cls:"corner", defaultW:1200, minW:900, maxW:1500, h:900, d:600, minH:600, maxH:1100, minD:500, maxD:900, hasInterior:false, counter:true, shelfRange:[0, 3, 1], skapategundOverride:"Grunnskápur" },
    // Free-standing appliances (2026-10-05): a gap with the appliance drawn in, not ordered from Björninn
    isskapurFri: { label:"Frístandandi ísskápur", zone:"floor", cls:"tall", defaultW:600, minW:600, maxW:900, widths:[600, 700, 900], h:1850, d:650, minH:1700, maxH:2000, minD:600, maxD:750, hasInterior:false, appliance:"fridge", notOrdered:true },
    uppthvottavelFri:{ label:"Uppþvottavél (frístandandi)", zone:"floor", cls:"floor", defaultW:600, minW:450, maxW:600, widths:[450, 600], h:900, d:600, minH:800, maxH:950, minD:550, maxD:700, hasInterior:false, counter:true, appliance:"dishwasher", notOrdered:true },
    // Tækjaskápar round (user, 2026-10-23, B1): a built-in freezer is the same cabinet + product as the built-in
    // fridge (fridge:true → LM.isskapur), only its note differs; a wine cooler is the customer's own appliance under the
    // worktop (like the freestanding dishwasher — nothing ordered for it). Ofn + örbylgja = ofnaskapur with ovenH 1050.
    frystir:     { label:"Frystir (innbyggður)", zone:"floor", cls:"fridge", defaultW:600, minW:600, maxW:900, widths:[600, 700, 900], fixedWidths:true, h:2500, d:600, minH:1700, maxH:2700, minD:500, maxD:750, hasInterior:false,
                   skapategundOverride:"Hárskápur", fridge:true,
                   note:"Viðskiptavinur óskar eftir innbyggðum FRYSTI (ekki ísskáp) í þessum skáp — staðfestu stærð tækis (nisju) og hurðargerð." },
    vinkaelir:   { label:"Vínkælir (undir borðplötu)", zone:"floor", cls:"floor", defaultW:600, minW:300, maxW:600, widths:[300, 450, 600], h:900, d:600, minH:820, maxH:950, minD:550, maxD:700, hasInterior:false, counter:true, appliance:"wine", notOrdered:true },
    // (no longer offered — "nú erum við að gera eldhús", 2026-10-05; kept so older drafts still load)
    thvottavelFri:{ label:"Þvottavél (frístandandi)", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:900, d:650, minH:800, maxH:950, minD:550, maxD:700, hasInterior:false, counter:true, appliance:"washer", notOrdered:true },
    burskapur:   { label:"Búrskápur", zone:"floor", cls:"tall", defaultW:600, minW:300, maxW:1200, h:2500, d:600, minH:1800, maxH:2700, minD:400, maxD:700, hasInterior:false, bur:true },
    // Þvottavélaskápur: washer/dryer tower; b.thvo = "skuffa" (a drawer at the bottom to raise the machine) | "hurdir" (doors only)
    // "Hlið við hlið í skáp" (owner, 2026-10-27): washer + dryer side by side, raised on a drawer (~30 cm), in a frame with a
    // cabinet above — built from existing parts (a Lítill kassi with the drawer + úthliðar, see v1RecordFor). 620 wide = one machine.
    thvottavelHlid:{ label:"Vélar hlið við hlið", zone:"floor", cls:"tall", defaultW:1240, minW:620, maxW:1300, widths:[620, 1240], h:2100, d:650, minH:1400, maxH:2700, minD:600, maxD:750, hasInterior:false, thvo:true, thvoSide:true, fixedFronts:true },
    thvottavel:  { label:"Þvottavélaskápur", zone:"floor", cls:"tall", defaultW:600, minW:600, maxW:900, h:2500, d:650, minH:1800, maxH:2700, minD:600, maxD:750, hasInterior:false, thvo:true, fixedFronts:true },
    // Uppþvottavél: integrated dishwasher behind one full front (V1 = the front itself)
    uppthvottavel:{ label:"Uppþvottavél", zone:"floor", cls:"floor", defaultW:600, minW:450, maxW:600, h:900, d:600, minH:850, maxH:1000, minD:550, maxD:700, hasInterior:false, counter:true, dishwasher:true },
    // Ruslaskápur: one tall pull-out with bins (RUSL60 / RUSL80)
    ruslaskapur: { label:"Ruslaskápur", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:800, h:900, d:600, minH:600, maxH:1100, minD:500, maxD:700, hasInterior:true, drawerCountRange:[1,3], drawersOnly:true, counter:true, rusl:true }, // a drawer stack like any drawer unit (bins in the bottom one), 2026-10-09
    // Lítill kassi: a low box (benches, window seats, TV units) — no worktop by default
    litillkassi: { label:"Lítill kassi", zone:"floor", cls:"floor", defaultW:600, minW:200, maxW:1200, h:500, d:600, minH:300, maxH:700, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,2,1] },
    // Hár veggskápur: a shallower tall unit (500 deep, 2000 high)
    harveggskapur:{ label:"Hár veggskápur", zone:"floor", cls:"tall", defaultW:600, minW:300, maxW:1200, h:2000, d:500, minH:1500, maxH:2700, minD:300, maxD:600, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,6,4] },
    // LeMans II exists for 45 / 50 / 60 cm doors; the door is half the cabinet (user, 2026-10-24: "B"), so only
    // 90 / 100 / 120 cm, and only heights LeMans fits (600–900 mm inside the carcass → 75–100 cm to the worktop)
    tofrahorn:   { label:"Töfrahorn (kapphorn)", zone:"floor", cls:"corner", defaultW:1200, minW:900, maxW:1200, widths:[900, 1000, 1200], fixedWidths:true, h:900, d:600, minH:750, maxH:1000, minD:500, maxD:900, hasInterior:false, counter:true,
                   skapategundOverride:"Grunnskápur",
                   // Útfærslur "Le mans Töfrahorn" by door half (b.swing) × carcass colour — no light grey exists
                   tofrahornIds:{ haegri:{ dokkgra:"rec7qJxtUZFofq7CW", hvit:"recrLoaCJMoB0LGo4" }, vinstri:{ dokkgra:"recAxPR5s5jKnktRm", hvit:"recdfMCuUnPyRV8rV" } }, // 50 cm door
                   tofrahornByDoor:{ // the 45 / 60 cm LeMans (Innval prices, created 2026-10-24); 50 = tofrahornIds above
                     450:{ haegri:{ dokkgra:"recKyaNOBzoA2V8Xz", hvit:"recLDsouN1wMiAU8m" }, vinstri:{ dokkgra:"recGYrvakmzngjtNQ", hvit:"rec5STUaCp24x4Too" } },
                     600:{ haegri:{ dokkgra:"rec83RJT2eLVlCxhZ", hvit:"recW2zy1TpVs7kSsh" }, vinstri:{ dokkgra:"recSzZVRkMZny4keq", hvit:"recx6v4o7oLRxJO6S" } } } },
    vaskaskapur: { label:"Vaskaskápur", zone:"floor", cls:"floor", defaultW:800, minW:500, maxW:1500, h:900, d:600, minH:600, maxH:1100, minD:400, maxD:750, hasInterior:true, drawerCountRange:[1,3], counter:true, sink:true,
                   skapategundOverride:"Grunnskápur", note:"Vaskaskápur — útskurður fyrir vask og lagnir; vinsamlegast staðfestu vaskstærð og gerð." },
    opnarhillur: { label:"Opnar hillur", zone:"wall", cls:"wall", defaultW:600, minW:200, maxW:1200, h:700, d:300, minH:200, maxH:1200, minD:200, maxD:450, hasInterior:false, open:true, shelfRange:[1,5,3],
                   skapategundOverride:"Efriskápur", note:"Opnar hillur — engin hurð; viðskiptavinur óskar eftir opnum hillum." },
    // Úthlið (end panel): 19 mm thick, same material as the fronts. Placed at
    // the end of a run it copies height/depth from the cabinet it butts up to.
    uthlid:      { label:"Úthlið — neðri", zone:"floor", cls:"floor", defaultW:19, minW:19, maxW:19, h:900, d:600, minH:300, maxH:1100, minD:100, maxD:750, hasInterior:false, panel:true, counter:true, // the worktop runs on over it
                   skapategundOverride:"Grunnskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu).",
                   // Útfærslur "Úthliðar" (V1): UHGR, or UHLK beside a lítill kassi (≤ 600 mm high)
                   panelIds:[{ maxH:600, utfaerslaId:"recEpLxCpHtbBHRkV" }, { utfaerslaId:"recUKqD3UKKWQ8J7g" }] },
    uthlidhar:   { label:"Úthlið — há", zone:"floor", cls:"tall", defaultW:19, minW:19, maxW:19, h:2500, d:600, minH:1000, maxH:2700, minD:100, maxD:750, hasInterior:false, panel:true,
                   skapategundOverride:"Hárskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu).",
                   // UHVS beside a hár veggskápur (≤ 2100 mm), else UHHA
                   panelIds:[{ maxH:2100, utfaerslaId:"recjkbrTcZZgSazX5" }, { utfaerslaId:"recgcU94bpLvATm0r" }] },
    uthlidefri:  { label:"Úthlið — efri", zone:"wall", cls:"wall", defaultW:19, minW:19, maxW:19, h:1000, d:300, minH:200, maxH:1200, minD:100, maxD:450, hasInterior:false, panel:true,
                   skapategundOverride:"Efriskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu).",
                   panelIds:[{ utfaerslaId:"recvaMCqmYlQur8Wr" }] }, // UHEF
    // Lausar hillur: 38 mm boards on the wall, 1–5 stacked above each other.
    // b.count = boards, b.vgapMm = clear gap between boards; b.heightMm is kept
    // equal to the whole stack's height (see stackHeightMm) so every height
    // check/drawing/submission treats it like any other wall unit.
    laushilla:   { label:"Lausar hillur", zone:"wall", cls:"wall", defaultW:800, minW:200, maxW:3000, h:38, d:250, minH:38, maxH:2000, minD:150, maxD:450, hasInterior:false, shelfStack:true, elev:1200,
                   skapategundOverride:"Efriskápur", note:"Lausar hillur, 38 mm þykkar — ekki skápur." }
  };
  var SHELF_T_MM = 38, SHELF_STACK_MAX = 5, SHELF_GAP_DEFAULT = 300;
  function stackHeightMm(count, gapMm){ return count * SHELF_T_MM + (count - 1) * gapMm; }

  // Loose shelves (Eyðublað "Lausar hillur fjöldi"): the customer's choice,
  // else the type's default. Not meaningful for a drawer unit.
  function shelvesOf(b){
    var c = CATALOG[b.type];
    if (!c || !c.shelfRange) return null;
    return b.shelves != null ? Math.max(c.shelfRange[0], Math.min(c.shelfRange[1], b.shelves)) : c.shelfRange[2];
  }
  // Fataslá (clothes rail, 2026-10-15): loose count like shelvesOf, only set on the two tall closet types.
  function railsOf(b){
    var c = CATALOG[b.type];
    if (!c || !c.railRange) return null;
    return b.rails != null ? Math.max(c.railRange[0], Math.min(c.railRange[1], b.rails)) : c.railRange[2];
  }
  // Height (mm) of a wall unit's bottom edge above the floor; 0 for floor units.
  var WALL_UNIT_BASE_MM = 1400;
  function elevOf(b){
    var c = CATALOG[b.type];
    if (!c || c.zone !== "wall") return 0;
    return b.elevMm != null ? b.elevMm : (c.elev != null ? c.elev : WALL_UNIT_BASE_MM);
  }
  function defaultElevOf(type){ var c = CATALOG[type]; return c.zone !== "wall" ? 0 : (c.elev != null ? c.elev : WALL_UNIT_BASE_MM); }

  // Width variants ("underskápar") of the core types from the first catalog
  // rounds. Widths are freely editable now, so these are no longer offered —
  // they stay in CATALOG (legacy) only so older drafts/submissions still load
  // and render. Keys stay `<core>_<mm>`.
  function widthRange(from, to){
    var out = [];
    for (var w = from; w <= to; w += 100) out.push(w);
    return out;
  }
  var WIDTH_VARIANTS = {
    grunnskapur: widthRange(300, 1200),
    harskapur:   widthRange(300, 900),
    efriskapur:  widthRange(300, 1200),
    vaskaskapur: widthRange(600, 1200),
    opnarhillur: widthRange(300, 1200)
  };
  Object.keys(WIDTH_VARIANTS).forEach(function(base){
    WIDTH_VARIANTS[base].forEach(function(w){
      var b = CATALOG[base];
      if (w === b.defaultW) return; // the core type already is this width
      CATALOG[base + "_" + w] = Object.assign({}, b, {
        label: b.label + " " + w, defaultW:w, skapategundOverride:b.airtableLabel || b.label, variantOf:base, legacy:true // airtableLabel: Airtable's Skápategund (the label is the menu's name, QA 2026-10-26 E10)
      });
    });
  });

  // Fixed tie-break priority, kept for display ordering (the style quiz that
  // used this for scoring was removed — see Phase 7a).
  var LOOK_ORDER = ["hvitt", "gratt", "eik", "valhnota", "sponn"];
  // Front-material categories, matching how the user thinks about them
  // (Phase 7b): real veneer / melamine wood-look / Perfect Sense solid color.
  // Purely a UI grouping — every LOOKS entry still maps to one real
  // Efnislisti record either way.
  // The picker now mirrors bjorninninnrettingar.is → Efnisúrval: three front groups.
  var LOOK_CATEGORIES = [
    { key:"vidarliki",     label:"Viðarlíki",     blurb:"Hlýlegt og stílhreint, slitsterkt og hagkvæmt — frá ljósri eik yfir í dökkar viðartegundir." },
    { key:"framhlidaefni", label:"Einlitt", blurb:"Fáguð, lituð og silkimjúk yfirborð sem minna á hágæða lakk." },
    { key:"sponlagt",      label:"Spónlagt",      blurb:"Ekta viður — hver innrétting verður einstök, með lifandi mynstri." }
  ];
  // Floors (chosen on the "Skilgreindu rýmið" page): three parquets, three tiles.
  var FLOORS = {
    parket_ljos: { label:"Ljós eik",           group:"parket", kind:"plank", color:"#dcc39a", rows:14 },
    parket_eik:  { label:"Náttúruleg eik",     group:"parket", kind:"plank", color:"#c9a97c", rows:14 },
    parket_dokk: { label:"Dökk hnota, breið",  group:"parket", kind:"plank", color:"#7b5a3d", rows:9 },
    flis_ljos:   { label:"Ljósgrátt steypuútlit", group:"flisar", kind:"tile", color:"#c4c2bb" },
    flis_beige:  { label:"Beige steinn",       group:"flisar", kind:"tile", color:"#cdbfa6" },
    flis_dokk:   { label:"Antrasít",           group:"flisar", kind:"tile", color:"#4e4f52" }
  };
  var FLOOR_GROUPS = [{ key:"parket", label:"Parket" }, { key:"flisar", label:"Flísar" }];
  var DEFAULT_FLOOR = "parket_eik";
  // Tile sizes (state.floorTile) and parquet laying patterns (state.floorPattern).
  var TILE_SIZES = {
    "30x60":  { label:"30 × 60 cm",  w:0.3, h:0.6 },
    "60x60":  { label:"60 × 60 cm",  w:0.6, h:0.6 },
    "60x120": { label:"60 × 120 cm", w:0.6, h:1.2 }
  };
  var DEFAULT_TILE = "60x60";
  var FLOOR_PATTERNS = { beint:{ label:"Beint" }, fiskibein:{ label:"Fiskibein" } };
  // variant: the state object (floorTile / floorPattern are read from it), or omitted = defaults
  function floorTexture(key, variant){
    var f = FLOORS[key] || FLOORS[DEFAULT_FLOOR], v = variant || {};
    if (f.kind === "tile"){
      var ts = TILE_SIZES[v.floorTile] || TILE_SIZES[DEFAULT_TILE];
      return window.KPMat.tileFloorTexture(f.color, 0.12, ts.w, ts.h);
    }
    if (v.floorPattern === "fiskibein") return window.KPMat.herringboneFloorTexture(f.color);
    return window.KPMat.plankFloorTexture(f.color, f.rows);
  }
  // soft tint of the floor for the 2D drawings
  function floorPlanColor(key){
    var f = FLOORS[key] || FLOORS[DEFAULT_FLOOR], n = parseInt(f.color.slice(1), 16), k = f.kind === "tile" ? 0.5 : 0.62;
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function(v){ return Math.round(v + (255 - v) * k); });
    return "#" + c.map(function(v){ return ("0" + v.toString(16)).slice(-2); }).join("");
  }
  var TOP_GROUPS = [ // most chosen first (user, 2026-10-24)
    { key:"hardplast",label:"Harðplast", blurb:"Hagkvæm og endingargóð — einlitt, viðar-, stein- og marmaraútlit." },
    { key:"compact",  label:"Compact",   blurb:"Þéttar og sterkbyggðar harðkjarna plötur — þola raka og daglega notkun vel." },
    { key:"limtre",   label:"Límtré",    blurb:"Hlý, náttúruleg og lifandi borðplata — ask, hnota, eik, beyki og fura." },
    { key:"steinn",   label:"Steinn",    blurb:"Steinplötur eru pantaðar sérstaklega hjá samstarfsaðilum." },
    { key:"engin",    label:"Engin",     blurb:"Engin borðplata frá okkur — t.d. ef þú færð hana annars staðar." }
  ];
  // `color3d` is the material's real average color (sampled directly from its
  // own photo, not guessed) — used as a flat color on 3D/2D cabinet faces. The
  // photos themselves are angled product shots with visible background, which
  // looks broken mapped 1:1 onto a flat box face (a photo of a tilted board
  // pasted onto another 3D box reads as a floating, wrongly-shaped patch) —
  // they stay as the actual images only on the 2D look-picker cards.
  var LOOKS = {
    hvitt:    { label:"Hvítt",    img:"materials/hvitt.png",    color3d:"#fffef9", desc:"Klassískt og bjart",   efnislistiId:"recETAWxGH3R4yYQK", category:"perfectsense" },
    gratt:    { label:"Grátt",    img:"materials/gratt.png",    color3d:"#e3dcd0", desc:"Nútímalegt og hlutlaust", efnislistiId:"recv9klBmrhz3BJJf", category:"perfectsense" },
    eik:      { label:"Eik",      img:"materials/eik.png",      color3d:"#ccae8b", desc:"Náttúrulegt og ljóst", efnislistiId:"recr7o33yRRU4DqO7", category:"melamine-wood" },
    valhnota: { label:"Valhnota", img:"materials/valhnota.png", color3d:"#765e48", desc:"Hlýtt og dökkt",       efnislistiId:"recOwpVNZipD18qME", category:"melamine-wood" },
    // Real Spónlagt (veneer) record — no product-photo swatch exists on this
    // one in Efnislisti (only a generic placeholder icon), so this stays a
    // text/glyph card like "Falið grip" rather than showing a fake photo.
    // Áferð/litun (smoked, bleached, etc.) gets refined with Rakel, not here.
    sponn:    { label:"Eik spónn", img:null, color3d:"#b89268", desc:"Alvöru viðarspónn — áferð og litun farið yfir með Rakel", efnislistiId:"recC4sVQ9NkQZTNkk", category:"sponn" }
  };

  // The four hand-picked Efnislisti looks stay (old drafts still render) but
  // are no longer offered; the picker now shows the site's own selection.
  Object.keys(LOOKS).forEach(function(k){ LOOKS[k].hidden = true; });
  Object.keys((window.KPCAT || { fronts:{} }).fronts).forEach(function(k){
    LOOKS[k] = Object.assign({ efnislistiId:null }, window.KPCAT.fronts[k]);
  });

  // Carcass (skrokkur) color — Phase 7b: previously hardcoded to dökkgrátt
  // for every project, now customer-selectable. All 3 are real, already-
  // stocked Efnislisti records (Undirflokkur=Skrokka efni) — no new material
  // needed. dokkgra is the historical default (98 real projects).
  var CARCASS = {
    dokkgra: { label:"Dökkgrátt", color3d:"#4a4946", efnislistiId:"recOz5NQJs6mCBpkq" },
    hvit:    { label:"Hvítt",     color3d:"#f3f1ea", efnislistiId:"rech0E8IbKuuSzeHU" },
    ljosgra: { label:"Ljósgrátt", color3d:"#c7c4ba", efnislistiId:"recAuDUx94oKtjeQQ" }
  };

  // Drawer runner system — real Eyðublað "Skúffutegund" field, exactly these
  // 2 choices. Project-wide like look/handle/carcass (you wouldn't mix
  // runner brands in one kitchen), not per-cabinet.
  // Real drawer-box side heights (mm) from Blum's catalogue, per the 3-drawer
  // base cabinet Björninn builds: LEGRABOX M / K / F, MERIVOBOX M / K / E
  // (listed top → bottom). Fronts are the box height plus an equal share of
  // what is left of the cabinet body, so the fronts read like a real stack.
  var DRAWER_LAYOUT = {
    legra:  { codes:["M", "K", "F"], sides:[90.5, 128.5, 241] },
    merivo: { codes:["M", "K", "E"], sides:[91, 129, 192] }
  };
  // ---- Drawer codes (2026-09-30): every drawer is one Blum height code. Legra = M/K/C/F, Merivo =
  // N/M/K/E (the letters Björninn's Útfærslur use). SIDE = Blum side height (mm). FRONT_MIN = the
  // lowest front a drawer of that code can have (side + ~20 mm per Blum; matches the lowest real
  // fronts in Sögunarlisti: Merivo M 98, K 162, E 270). FRONT_WEIGHT = how spare height is shared
  // out on top of the minimums (the "Sérhæð … fronts" defaults on Eyðublað) — so a Merivo E+K+M in a
  // 700 mm body comes out ≈ 334/211/156, close to the real medians (397/247/147).
  // "P" (Föst framhlið, user 2026-10-19): a plain fixed front — no drawer behind it, no real Vörulisti product,
  // height-adjustable like any other front. Reuses the exact "front slot, no box" path addCabinetBox already
  // has for a sink's fixed top front (meta.sinkFixedTop) — see makeLeaf's `fixedTop`. Lives in both systems'
  // own `codes` (so it shows in every drawer-type dropdown) with side:0 (no Blum hardware) — stackAllowed/
  // ensureCombo (kitchen-planner.html) skip the Útfærslur combo lookup entirely whenever it's in a stack.
  var FIXED_FRONT_CODE = "P";
  var DRAWER_CODES = {
    legra:  { codes:["M", "K", "C", "F", "P"], side:{ M:90.5, K:128.5, C:177, F:241, P:0 }, inner:["IK", "IM"] },
    merivo: { codes:["N", "M", "K", "E", "P"], side:{ N:63, M:91, K:129, E:192, P:0 },     inner:["IM"] }
  };
  // E and C are raised so the global front macro's extra row always lands on the front: E row at 218, C at 203.5
  // (+10 mm to the top edge; user, 2026-10-10 — was E 212 / C 197, and a 212 E front can't take its 218 holes)
  var FRONT_MIN = { N:85, M:110, K:150, E:228, C:214, F:261, P:40 }; // P: a plain panel, no Blum minimum behind it
  var FRONT_WEIGHT = { N:100, M:150, K:200, E:400, C:400, F:800, P:150 };
  var CODE_ORDER = "NMKECF"; // smallest → tallest; also the order Útfærslur combo keys use
  var DRAWER_GAP_MM = 3;
  var WIDE_DOOR_M = 0.6005; // a door unit wider than 600 mm is built with two doors
  // G15 (owner, 2026-10-27): an upper cabinet (Efriskápur) gets two doors from 600 mm INCLUSIVE, everything else above
  // 600 — the same rule Keyra skipulag uses for "Tveir frontar" (Efriskápur width >= 600, others > 600)
  function twoDoors(widthMm, wallUnit){ return wallUnit ? widthMm >= 599.5 : widthMm > WIDE_DOOR_M * 1000; }
  // Board thickness of an open / articulated carcass: built from real 16 mm boards (sides, top, bottom) and a
  // thin back — it used to be the faces of one box, so the sides had no thickness at the front edge (2026-10-05)
  var CARCASS_T = 0.016, BACK_T = 0.008;

  // ---- Lighting (2026-10-05): LED under wall units, ATOM spots in open shelves, LED in the plinth ----
  // Each light = a small bright strip/spot + a soft additive "glow" plane on the surface it lights (cheap,
  // no real lights). MOOD = evening view: the room's own lights dim and the glows come up (view only).
  var MOOD = false, GLOW_TEX = null;
  // Málband (tape measure, 2026-10-17): while on, every cabinet click/drag/select here is a no-op — the tool
  // itself (kitchen-planner.html) handles clicks, and the camera is left entirely to OrbitControls.
  var MEASURING = false;
  function setMeasuring(on){ MEASURING = !!on; }
  function glowTexture(THREE){
    if (GLOW_TEX) return GLOW_TEX;
    // bright at the light's edge fading away from it, and soft towards both ends (no hard rectangle on the worktop)
    var cv = document.createElement("canvas"); cv.width = 64; cv.height = 128;
    var cx = cv.getContext("2d"), gr = cx.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 128);
    cx.globalCompositeOperation = "destination-in";
    var side = cx.createLinearGradient(0, 0, 64, 0);
    side.addColorStop(0, "rgba(0,0,0,0)"); side.addColorStop(0.18, "rgba(0,0,0,1)"); side.addColorStop(0.82, "rgba(0,0,0,1)"); side.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = side; cx.fillRect(0, 0, 64, 128);
    GLOW_TEX = new THREE.CanvasTexture(cv); GLOW_TEX.userData.keep = true;
    return GLOW_TEX;
  }
  function ledFrame(THREE, scene, g, offsetM, widthM){ // x along the wall (0 = the cabinet's centre), z out of the wall
    var f = new THREE.Group();
    f.position.set(g.origin.x + g.axis.x * (offsetM + widthM / 2), 0, g.origin.z + g.axis.z * (offsetM + widthM / 2));
    f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
    scene.add(f); return f;
  }
  function ledStrip(THREE, scene, f, x, w, y, z, spot){
    var m = new THREE.Mesh(spot ? new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20) : new THREE.BoxGeometry(w, 0.005, 0.01), new THREE.MeshBasicMaterial({ color:0xfff1d8, toneMapped:false }));
    m.position.set(x, y, z); f.add(m);
    var L = (scene.userData.leds = scene.userData.leds || { glows:[] });
    (L.strips = L.strips || []).push(m);
    return m;
  }
  // a glow lying on a surface at height y, from zNear (bright) to zFar (faded), w wide
  function ledGlow(THREE, scene, f, x, w, zNear, zFar, y, strength){
    var len = Math.abs(zFar - zNear), m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({
      map:glowTexture(THREE), color:0xffd49a, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    m.rotation.x = -Math.PI / 2;
    if (zFar < zNear) m.rotation.z = Math.PI; // texture's bright edge toward zNear
    m.position.set(x, y, (zNear + zFar) / 2); m.renderOrder = 2; m.userData.glow = strength;
    f.add(m);
    (scene.userData.leds = scene.userData.leds || { glows:[] }).glows.push(m);
    return m;
  }
  // real lights for the evening: a soft area light under each lit wall unit, a spot under each ATOM
  // (capped so a big kitchen stays fast)
  function ledAreaLight(THREE, scene, f, w, y, z){
    var L = (scene.userData.leds = scene.userData.leds || { glows:[] });
    L.lights = L.lights || [];
    if (!THREE.RectAreaLight || L.lights.filter(function(l){ return l.isRectAreaLight; }).length >= 14) return;
    var a = new THREE.RectAreaLight(0xffcf96, 0, w, 0.03);
    a.position.set(0, y, z); a.rotation.x = -Math.PI / 2; a.userData.full = 11; // shines straight down
    f.add(a); L.lights.push(a);
  }
  function ledSpot(THREE, scene, f, x, y, z, floorY){
    var L = (scene.userData.leds = scene.userData.leds || { glows:[] });
    L.lights = L.lights || [];
    if (L.lights.filter(function(l){ return l.isSpotLight; }).length >= 12) return;
    var sp = new THREE.SpotLight(0xffd3a0, 0, 1.6, 0.75, 0.85, 2);
    sp.position.set(x, y, z); sp.target.position.set(x, floorY, z); sp.userData.full = 1.6;
    f.add(sp); f.add(sp.target); L.lights.push(sp);
  }
  // MOOD_T eases toward MOOD (0 = day, 1 = evening) so switching fades instead of jumping
  var MOOD_T = 0;
  function applyMood(scene){
    if (!scene) return;
    var t = scene.userData.noMood ? 0 : MOOD_T, L = scene.userData.sceneLights;
    if (L) L.forEach(function(l){ l.light.intensity = l.base * (1 - t + t * l.mood); });
    if (scene.userData.hemi){ scene.userData.hemi.color.setRGB(1 - t * 0.32, 1 - t * 0.24, 1 - t * 0.1); scene.userData.hemi.groundColor.setRGB(0.74 - t * 0.45, 0.71 - t * 0.45, 0.64 - t * 0.4); } // dusk blue above, darker below
    var leds = scene.userData.leds || { glows:[] };
    leds.glows.forEach(function(m){ m.material.opacity = m.userData.glow * (0.3 + 0.7 * t); });
    (leds.lights || []).forEach(function(l){ l.intensity = l.userData.full * (0.15 + 0.85 * t); });
    (leds.strips || []).forEach(function(m){ var k = 1 + t * 2.2; m.material.color.setRGB(k, k * 0.93, k * 0.82); }); // brighter than white → blooms
    if (scene.background && scene.userData.dayBg) scene.background.copy(scene.userData.dayBg).lerp(scene.userData.nightBg, t);
    if (scene.userData.env !== undefined) scene.environment = t > 0.5 ? null : scene.userData.env; // the image-based light washes out the evening
    (scene.userData.windowGlass || []).forEach(function(m){ m.color.copy(m.userData.day).lerp(NIGHT_GLASS, t); }); // daylight → a deep dusk blue
  }
  var NIGHT_GLASS = { r:0.05, g:0.07, b:0.13, isColor:true };
  function stepMood(scene){
    var want = scene.userData.noMood ? 0 : (MOOD ? 1 : 0);
    if (scene.userData.moodApplied === MOOD_T && Math.abs(MOOD_T - want) < 0.003) return;
    if (Math.abs(MOOD_T - want) < 0.003) MOOD_T = want; else MOOD_T += (want - MOOD_T) * 0.09;
    scene.userData.moodApplied = MOOD_T;
    applyMood(scene);
  }
  function setMood(on){ MOOD = !!on; return MOOD; }
  function addCarcassBoards(THREE, parent, widthM, bodyH, bodyBase, depth, mat, rails){
    var T = CARCASS_T, inner = widthM - 2 * T;
    function board(w, h, d, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
    board(T, bodyH, depth, -widthM / 2 + T / 2, bodyBase + bodyH / 2, depth / 2);   // sides
    board(T, bodyH, depth, widthM / 2 - T / 2, bodyBase + bodyH / 2, depth / 2);
    if (rails){ // a sink cabinet has no top board, only a rail at the front and one at the back (owner, 2026-10-27)
      board(inner, T, 0.09, 0, bodyBase + bodyH - T / 2, depth - 0.045);
      board(inner, T, 0.09, 0, bodyBase + bodyH - T / 2, BACK_T + 0.045);
    }
    else board(inner, T, depth - BACK_T, 0, bodyBase + bodyH - T / 2, BACK_T + (depth - BACK_T) / 2); // top + bottom, in front of the back
    board(inner, T, depth - BACK_T, 0, bodyBase + T / 2, BACK_T + (depth - BACK_T) / 2);
    board(inner, bodyH - 2 * T, BACK_T, 0, bodyBase + bodyH / 2, BACK_T / 2);          // back
  }
  // a sensible stack for N drawers when nothing has been picked (bottom → top)
  var DEFAULT_CODES = {
    legra:  { 1:["C"], 2:["C", "C"], 3:["F", "K", "M"], 4:["C", "K", "K", "M"], 5:["C", "K", "K", "K", "M"], 6:["C", "C", "K", "K", "K", "M"] },
    merivo: { 1:["E"], 2:["E", "E"], 3:["E", "K", "M"], 4:["E", "K", "K", "M"], 5:["E", "K", "K", "K", "M"], 6:["E", "E", "K", "K", "K", "M"] }
  };
  // Drawers under the oven (bottom → top) from b.ovenCombo, an Útfærslur key like "MKE" / "CC+IM".
  // undefined = the usual 3 drawers; "" = a cabinet door instead of drawers (OFN7).
  var OVEN_DEFAULT = { legra:"MKC", merivo:"MKE" };
  function ovenCodesOf(b, sysKey){
    var sys = sysKey === "merivo" ? "merivo" : "legra", key = b.ovenCombo == null ? OVEN_DEFAULT[sys] : b.ovenCombo;
    var letters = String(key).split("+")[0].split("");
    return letters.sort(function(a, c){ return CODE_ORDER.indexOf(c) - CODE_ORDER.indexOf(a); }).map(function(c){ return (CODE_SWAP[sys] && CODE_SWAP[sys][c]) || c; });
  }
  // Height of the drawer zone under a tall oven: 600 mm of body (worktop height), 700 when a combo needs it
  function ovenZoneMm(codes){ return !codes.length || drawerFrontsMm(codes, 600) ? 600 : 700; }
  // Oven settings, set in Smíða (2026-10-10): the oven's height 60 / 45 / 60+45 (b.ovenH = 595 / 455 / 1050), the
  // height under it (b.ovenUnderMm = Σ slots of the drawers / door below = top of the Loftunarbotn the oven stands on;
  // default by combo) and the shelves in the cabinet above (b.ovenShelves = [{mm, fixed, pos}]: mm = the shelf's top
  // face from the bottom of the body, pos = how many hole positions a loose one gets). The niche is closed above by
  // the Loftunartoppur; boards are carcass (16).
  var OVEN_HEIGHTS = [{ mm:595, label:"60" }, { mm:455, label:"45" }, { mm:1050, label:"60+45" }];
  var OVEN_BOARD_MM = 16, OVEN_DOOR_MIN = 150;
  function ovenHOf(b, c){
    var h = +(b && b.ovenH);
    return OVEN_HEIGHTS.some(function(o){ return o.mm === h; }) && !(c && c.lowOven && h > 600) ? h : 595;
  }
  function ovenUnderMinMm(b, sysKey){
    var codes = ovenCodesOf(b, sysKey);
    return codes.length ? codes.reduce(function(a, k){ return a + slotMin(k); }, 0) : OVEN_DOOR_MIN;
  }
  // the zone under the oven, mm; c.lowOven = the oven under the worktop, one slot of body − oven − 3
  function ovenUnderOf(b, sysKey, bodyMm, c){
    if (c && c.lowOven) return Math.max(53, bodyMm - ovenHOf(b, c)); // one slot: slot + oven = body (front = slot − 3)
    var u = +b.ovenUnderMm, def = ovenZoneMm(ovenCodesOf(b, sysKey));
    if (!(u > 0)) return def;
    u = Math.max(u, ovenUnderMinMm(b, sysKey));
    if (bodyMm) u = Math.min(u, ovenUnderMaxMm(b, bodyMm));
    return Math.round(u);
  }
  function ovenUnderMaxMm(b, bodyMm){ return bodyMm - ovenHOf(b) - OVEN_BOARD_MM - OVEN_DOOR_MIN; }
  // the space for shelves above the niche: top of the Loftunartoppur → under the top board
  function ovenUpperMm(b, sysKey, bodyMm){
    var lo = ovenUnderOf(b, sysKey, bodyMm) + ovenHOf(b) + OVEN_BOARD_MM;
    return { lo:lo, hi:bodyMm - OVEN_BOARD_MM };
  }
  // Shelves behind the doors of any cabinet (Smíða, 2026-10-10): b.shelfPos = [{mm, fixed, pos}], same meaning as
  // the oven's. Default = shelvesOf(b) loose shelves spread evenly (as the 3D always drew them), 3 positions each;
  // a búrskápur's 2 shelves sit above its inner drawers. The oven keeps its own list (ovenShelvesOf).
  // A búrskápur's inner drawers, bottom → top: [{code, mm = bottom of its inner front from the body's bottom, h = front}].
  // Default 60 mm up (its runner then clears the bottom hinge at 80 — was 30, runner on the hinge), 35 apart;
  // b.burPos = Rakel's positions from Smíða (2026-10-10).
  function burDrawersOf(b, sysKey){
    var sys = DRAWER_CODES[sysKey === "merivo" ? "merivo" : "legra"], codes = burCodesOf(b, sysKey), y = 60;
    var custom = Array.isArray(b.burPos) && b.burPos.length === codes.length ? b.burPos : null;
    return codes.map(function(code, k){
      var h = ((sys && sys.side[code]) || 120) + 20, mm = custom ? Math.round(custom[k]) : y;
      y = mm + h + 35;
      return { code:code, mm:mm, h:h };
    });
  }
  function burTopMm(b, sysKey){ // above the inner drawers: where the shelves may start
    var d = burDrawersOf(b, sysKey), last = d[d.length - 1];
    return last ? last.mm + last.h + 35 : 30;
  }
  // Free-form innskúffur behind a door (2026-10-16): same spot a búrskápur's own inner drawers sit in, but for
  // any other tall closet with a door and no drawer stack of its own — just b.innerCodes (any codes, any count,
  // no registered combo behind them) + b.innerPos, straight into Smíðagögn's generic "inner" list (the same
  // field name cnc-sides.js already reads for ANY cabinet, búrskápur or not — only the designer UI was
  // búrskápur-only before this). Positioning convention mirrors burDrawersOf exactly (60 mm up, 35 mm apart) so
  // the two feel the same to use.
  // Innskúffur behind a tall unit's door (b.innerCodes — Smíða's free list, and the closet's "Innskúffur fyrir aftan hurð",
  // owner 2026-10-27): drawn like a búrskápur's — inside, in the carcass colour, no handle, pulled out once the door is open
  function innerFreeOf(b, c){ return c && !c.bur && c.cls === "tall" && Array.isArray(b.innerCodes) && b.innerCodes.length && !(b.interior && b.interior.mode === "skuffur") ? b.innerCodes : null; }
  function innerDrawersOf(b, sysKey){
    var sys = DRAWER_CODES[sysKey === "merivo" ? "merivo" : "legra"], codes = Array.isArray(b.innerCodes) ? b.innerCodes : [], y = 60;
    var custom = Array.isArray(b.innerPos) && b.innerPos.length === codes.length ? b.innerPos : null;
    return codes.map(function(code, k){
      var h = ((sys && sys.side[code]) || 120) + 20, mm = custom ? Math.round(custom[k]) : y;
      y = mm + h + 35;
      return { code:code, mm:mm, h:h };
    });
  }
  function innerTopMm(b, sysKey){ // above the inner drawers: where the shelves may start
    var d = innerDrawersOf(b, sysKey), last = d[d.length - 1];
    return last ? last.mm + last.h + 35 : OVEN_BOARD_MM;
  }
  // A tall closet's door above its drawer stack can hold shelves too (user, 2026-10-15) — the zone above
  // drawerZoneMm(), same as a búrskápur's shelves sit above its inner drawers. Never for a non-tall cabinet: its
  // drawer stack already fills the whole body (drawerZoneMm returns bodyMm unchanged), so there's no zone left.
  function inDrawerShelfZone(b, c){ return !!c && c.cls === "tall" && !!(b.interior && b.interior.mode === "skuffur"); }
  function hasShelfLayout(b){
    var c = CATALOG[b.type];
    if (!c || c.oven) return false;
    if (b.interior && b.interior.mode === "skuffur" && !inDrawerShelfZone(b, c)) return false;
    return !!c.bur || shelvesOf(b) != null;
  }
  // Where the top drawer's real hardware ends (user, 2026-10-16): the FRONT still closes over a shelf sitting
  // inside its nominal slot — only the physical box/runner on the side panel (drawerBoxY's own "20 up, its
  // nominal side height tall, 10 clear of the slot top" placement, same table the Blum-side preview draws) is a
  // real obstruction. A shelf right above a closet's drawers only needs to clear THIS, not the whole declared
  // drawer-zone sum.
  function drawerBoxTopMm(b, zoneMm, sysKey){
    var sys = DRAWER_CODES[sysKey] ? sysKey : "legra", codes = drawerCodes(b.interior, sysKey);
    if (!codes.length) return 0;
    var fronts = stackFrontsMm(b.interior, codes, zoneMm);
    if (!fronts || !fronts.length) return 0;
    var top = fronts.length - 1, y0 = 0;
    for (var i = 0; i < top; i++) y0 += fronts[i];
    var y1 = y0 + fronts[top], side = DRAWER_CODES[sys].side[codes[top]] || 0;
    return Math.min(y0 + 20 + side, y1 - 10);
  }
  function shelfSpaceMm(b, bodyMm, sysKey){
    var c = CATALOG[b.type];
    if (c && c.oven) return ovenUpperMm(b, sysKey, bodyMm);
    // the generic consumers below (shelfOk/railOk and their layout filters) all add one OVEN_BOARD_MM of their
    // own on top of r.lo (same convention burTopMm/the plain OVEN_BOARD_MM floor use) — this used to ALSO bake
    // a board thickness into r.lo itself, double-margining a closet shelf 32 mm above the drawer zone instead
    // of 16; drawerBoxTopMm is the raw boundary now, same shape as the other two branches.
    if (inDrawerShelfZone(b, c)) return { lo:drawerBoxTopMm(b, drawerZoneMm(c, bodyMm, b.drawerZoneMm), sysKey), hi:bodyMm - OVEN_BOARD_MM };
    var innerLo = c && c.bur ? burTopMm(b, sysKey) : Array.isArray(b.innerCodes) && b.innerCodes.length ? innerTopMm(b, sysKey) : OVEN_BOARD_MM;
    return { lo:innerLo, hi:bodyMm - OVEN_BOARD_MM };
  }
  function shelfLayoutOf(b, bodyMm, sysKey){
    var c = CATALOG[b.type];
    if (!c) return [];
    if (c.oven) return c.lowOven ? [] : ovenShelvesOf(b, sysKey, bodyMm);
    if (!hasShelfLayout(b)) return [];
    var r = shelfSpaceMm(b, bodyMm, sysKey);
    // Clamped into the current band, never dropped (user, 2026-10-19): a stored shelf used to vanish for good
    // the moment some unrelated edit (the drawer stack under it, the body height) moved r.lo/r.hi past it —
    // same "a custom value shouldn't disappear just because something else moved the target" bug as the
    // drawer-front and door-split fixes, just one layer down (the geometry reader, not the editor).
    if (Array.isArray(b.shelfPos)) return b.shelfPos
      .filter(function(x){ return x && typeof x.mm === "number"; })
      .map(function(x){ return { mm:Math.round(Math.min(Math.max(x.mm, r.lo + OVEN_BOARD_MM + 1), r.hi - 11)), fixed:!!x.fixed, pos:x.fixed ? 1 : Math.max(1, Math.min(9, Math.round(x.pos) || 3)), locked:!!x.locked, tray:!!x.tray }; }) // locked: Smíða-only bookkeeping ("Dreifa ólæstum jafnt") — passed through so every setShelves read-then-rewrite doesn't silently drop it
      .sort(function(a, z){ return a.mm - z.mm; });
    var scoped = c.bur || inDrawerShelfZone(b, c);
    var n = c.bur ? (b.burShelves != null ? b.burShelves : 2) : (shelvesOf(b) || 0), out = [];
    for (var k = 1; k <= n; k++) out.push({ mm:Math.round(scoped ? r.lo + (r.hi - r.lo) * k / (n + 1) : bodyMm * k / (n + 1) + 9), fixed:false, pos:3 });
    return out;
  }
  // Raðborun (continuous/IKEA-style shelf-pin drilling, 2026-10-15): b.radborun = null (off, today's discrete
  // per-shelf hole clusters) or {topMm, bottomMm} (on — margins kept clear at the top/bottom of the same zone
  // shelves already use). Pitch is fixed for now; nothing stops making it configurable too later.
  var RADBORUN_PITCH_MM = 32, RADBORUN_MARGIN_DEFAULT_MM = 100;
  function radborunSpanMm(b, bodyMm, sysKey){
    var r = shelfSpaceMm(b, bodyMm, sysKey), rb = b.radborun;
    var topMm = rb && rb.topMm > 0 ? rb.topMm : RADBORUN_MARGIN_DEFAULT_MM;
    var bottomMm = rb && rb.bottomMm > 0 ? rb.bottomMm : RADBORUN_MARGIN_DEFAULT_MM;
    var from = r.lo + bottomMm, to = r.hi - topMm;
    return { from:Math.round(from), to:Math.round(Math.max(from, to)) };
  }
  // Fataslá colours (user, 2026-10-26): the three Hafele rails in Vörulisti (SLASV / SLAKR / SLAGY)
  var RAIL_COLORS = { svart:{ c:0x2b2b2e, m:0.55, r:0.35 }, krom:{ c:0xb0b4ba, m:0.8, r:0.3 }, gyllt:{ c:0xc8a24c, m:0.85, r:0.3 } };
  function railMatOf(b){ var THREE = window.__THREE__, k = RAIL_COLORS[b && b.railColor] || RAIL_COLORS.svart; return new THREE.MeshStandardMaterial({ color:k.c, metalness:k.m, roughness:k.r }); }
  // a pull-out tray (Útdraganlegur bakki): the shelf board plus a low rim in the front material, as children of the
  // board so a drag moves it whole
  function addTrayRim(board, wM, dM, mat){
    var THREE = window.__THREE__, rims = [[wM - 0.002, 0.06, 0.018, 0, 0.021, dM / 2 - 0.009], [wM - 0.002, 0.04, 0.012, 0, 0.011, -dM / 2 + 0.006],
      [0.012, 0.04, dM - 0.03, -wM / 2 + 0.006, 0.011, 0], [0.012, 0.04, dM - 0.03, wM / 2 - 0.006, 0.011, 0]];
    rims.forEach(function(r){ var m = new THREE.Mesh(new THREE.BoxGeometry(r[0], r[1], r[2]), mat); m.position.set(r[3], r[4], r[5]); m.castShadow = true; board.add(m); });
  }
  var RAIL_D_MM = 25, RAIL_TOP_OFFSET_MM = 120, RAIL_GAP_MM = 450; // Fataslá: rod diameter, clearance under the top board, double-hang spacing
  // Fataslá positions bottom → top: b.railPos (Smíða, mm only — no hole drilling like a shelf) in the same zone
  // shelves use (shelfSpaceMm), else spread from the top down (a rail wants headroom above it, unlike a shelf).
  function railLayoutOf(b, bodyMm, sysKey){
    var c = CATALOG[b.type];
    if (!c || !c.railRange) return [];
    var r = shelfSpaceMm(b, bodyMm, sysKey);
    if (Array.isArray(b.railPos)) return b.railPos // clamped into the current band, never dropped — see shelfLayoutOf
      .filter(function(x){ return x && typeof x.mm === "number"; })
      .map(function(x){ return { mm:Math.round(Math.min(Math.max(x.mm, r.lo + OVEN_BOARD_MM + 1), r.hi - 11)) }; })
      .sort(function(a, z){ return a.mm - z.mm; });
    var n = railsOf(b) || 0, out = [];
    for (var k = 0; k < n; k++) out.push({ mm:Math.round(Math.max(r.lo + 10, r.hi - RAIL_TOP_OFFSET_MM - k * RAIL_GAP_MM)) });
    return out.sort(function(a, z){ return a.mm - z.mm; });
  }
  // the shelves above the oven, bottom → top; default = 2 loose vent shelves at thirds, 3 positions each
  function ovenShelvesOf(b, sysKey, bodyMm){
    var r = ovenUpperMm(b, sysKey, bodyMm);
    if (Array.isArray(b.ovenShelves)) return b.ovenShelves // clamped into the current band, never dropped — see shelfLayoutOf
      .filter(function(x){ return x && typeof x.mm === "number"; })
      .map(function(x){ return { mm:Math.round(Math.min(Math.max(x.mm, r.lo + OVEN_BOARD_MM + 1), r.hi - 11)), fixed:!!x.fixed, pos:x.fixed ? 1 : Math.max(1, Math.min(9, Math.round(x.pos) || 3)), locked:!!x.locked, tray:!!x.tray }; })
      .sort(function(a, z){ return a.mm - z.mm; });
    return [1, 2].map(function(k){ return { mm:Math.round(r.lo + (r.hi - r.lo) * k / 3), fixed:false, pos:3 }; });
  }
  // Inner drawers of a Búrskápur (bottom → top) from b.burCombo, a real BUR Útfærsla key like "MKCC".
  var BUR_DEFAULT = { legra:"MKCC", merivo:"MKEE" };
  function burCodesOf(b, sysKey){
    var sys = sysKey === "merivo" ? "merivo" : "legra";
    // the customer's own set (b.burCodes, 2026-10-11) or a combo; burCombo "" = empty (new búrskápar start empty).
    // undefined = an old draft: the default combo, as before
    var key = Array.isArray(b.burCodes) ? b.burCodes.join("") : b.burCombo === "" ? "" : (b.burCombo || BUR_DEFAULT[sys]);
    if (!key) return [];
    return String(key).split("+")[0].split("").sort(function(a, c){ return CODE_ORDER.indexOf(c) - CODE_ORDER.indexOf(a); }).map(function(c){ return (CODE_SWAP[sys] && CODE_SWAP[sys][c]) || c; });
  }
  // a code from the other system → the nearest one in this system (switching Legra ↔ Merivo)
  var CODE_SWAP = { legra:{ N:"M", E:"C" }, merivo:{ C:"E", F:"E" } };
  // The drawer stack of a cabinet, bottom → top, in the kitchen's drawer system. Old drafts only
  // have a count — they get the default stack for that count.
  // which drawer an inner drawer (innskúffa) hides behind: the highest one tall enough (IK needs a C/F/E side,
  // IM a K or taller) — the same rule the planner's drawer list shows; codes bottom → top, -1 = none
  // at (optional, the customer moved it): that drawer when it's tall enough, else the default
  function innerHostIndex(codes, sysKey, inner, at){
    var ok = innerHostsOf(codes, sysKey, inner);
    return at != null && ok.indexOf(at) >= 0 ? at : ok.length ? ok[ok.length - 1] : -1;
  }
  function innerHostsOf(codes, sysKey, inner){ // every drawer an inner drawer could hide behind, bottom → top
    if (!inner || !Array.isArray(codes)) return [];
    var side = DRAWER_CODES[sysKey === "merivo" ? "merivo" : "legra"].side, need = inner === "IK" ? 170 : 125, out = [];
    codes.forEach(function(cd, i){ if ((side[cd] || 0) >= need) out.push(i); });
    return out;
  }
  function drawerCodes(interior, sysKey){
    if (!interior || interior.mode !== "skuffur") return [];
    var sys = DRAWER_CODES[sysKey] ? sysKey : "legra";
    var codes = interior.codes && interior.codes.length ? interior.codes.slice()
      : (DEFAULT_CODES[sys][Math.max(1, Math.min(6, interior.count || 3))] || DEFAULT_CODES[sys][3]).slice();
    return codes.map(function(c){ return (CODE_SWAP[sys] && CODE_SWAP[sys][c]) || c; });
  }
  // Drawer heights are SLOTS (user, 2026-10-09): the number shown/typed is the drawer's "Sérhæð", the slots
  // fill the body exactly (400 + 400 = 800) and each front is cut 3 mm smaller (397) — the 3 mm is its gap.
  function slotMin(c){ return (FRONT_MIN[c] || 150) + DRAWER_GAP_MM; }
  // Slot heights (mm, bottom → top) for a stack in a body of bodyMm, or null when it doesn't fit.
  function drawerFrontsMm(codes, bodyMm){
    if (!codes.length) return [];
    var min = codes.reduce(function(a, c){ return a + slotMin(c); }, 0);
    var spare = bodyMm - min;
    if (spare < -0.5) return null;
    var wsum = codes.reduce(function(a, c){ return a + (FRONT_WEIGHT[c] || 200); }, 0);
    var raw = codes.map(function(c){ return slotMin(c) + spare * (FRONT_WEIGHT[c] || 200) / wsum; });
    // whole millimetres that still add up to the body (largest remainder): the panel, the note and Smíðagögn showed
    // 174 / 234 / 393 = 801 vs 800 when each was rounded on its own (2026-10-11)
    var out = raw.map(Math.floor), left = Math.round(bodyMm) - out.reduce(function(a, x){ return a + x; }, 0);
    raw.map(function(x, i){ return { i:i, r:x - Math.floor(x) }; }).sort(function(a, b){ return b.r - a.r; })
      .forEach(function(o){ if (left > 0){ out[o.i]++; left--; } });
    return out;
  }
  // A drawer box sits at the BOTTOM of its front's zone (20 mm up, on its runners) and the space above it is
  // what's left over — the way a Blum drawer is built (user, 2026-10-05: they hung from the top before,
  // which wasted the bottom of every drawer). Never sticks out above the front.
  function drawerBoxY(y0, y1, boxH){ return Math.max(y0 + 0.004, Math.min(y0 + 0.02, y1 - 0.01 - boxH)); }
  // The customer's own front heights (interior.frontsMm, bottom → top — typed or dragged in the drawer
  // builder, 2026-10-02) when they still match this stack and body; otherwise the defaults above.
  function stackFrontsMm(interior, codes, bodyMm){
    var f = interior && interior.frontsMm;
    if (f && f.length === codes.length && codes.length > 1){
      var sum = f.reduce(function(a, x){ return a + x; }, 0);
      // drafts from before 2026-10-09 stored front heights with 3 mm between them: turn them into slots
      if (Math.abs(sum + (codes.length - 1) * DRAWER_GAP_MM - bodyMm) < 1.5){
        var below = 0; f = f.map(function(h, i){ var sl = i < f.length - 1 ? h + DRAWER_GAP_MM : bodyMm - below; below += sl; return sl; });
      }
      // Typed heights are used as-is while mid-edit (user, 2026-10-19: editing one front kept getting
      // overwritten by this falling back to the computed defaults the moment the sum/minimums weren't right
      // yet) — they don't have to sum to the body or clear each drawer's own minimum until the stack is
      // actually finished; only a sane floor so the 3D geometry never goes to zero/negative. A short or tall
      // stack just shows a gap/overhang, which is the signal to keep going, not a silent reset.
      return f.map(function(h){ return Math.max(5, Math.round(h * 10) / 10); });
    }
    return drawerFrontsMm(codes, bodyMm);
  }
  // seams as fractions of the body (bottom → top), like drawerFractions()
  function frontsToFractions(fronts, bodyMm){
    var out = [], acc = 0;
    fronts.slice(0, -1).forEach(function(h){ acc += h; out.push(acc / bodyMm); }); // slot boundaries; each front is drawn 3 mm inside its slot
    return out;
  }
  // Útfærslur combo key: letters in N M K E C F order, then "+IK"/"+IM" for an inner drawer
  function drawerComboKey(codes, inner){
    return codes.slice().sort(function(a, b){ return CODE_ORDER.indexOf(a) - CODE_ORDER.indexOf(b); }).join("") + (inner ? "+" + inner : "");
  }
  // The real Vörunúmer a new Útfærslur row for this combo would get (reverse-engineered from ~115 real
  // rows, 2026-10-19): letters tallest-first (reverse CODE_ORDER), count 1 bare / 2 repeated / 3+ as a
  // digit (e.g. "E3K" = 3 E-drawers + 1 K-drawer, "KKMM" = 2+2 — never "K2M2"), prefixed "M-"/"L-", inner
  // suffix (e.g. "IM") appended bare with no separator. Used both to look an existing combo up by its
  // human SKU and, if it doesn't exist yet, to create one with the right name (api/drawer-combo.js).
  function comboVorunumer(sys, codes, inner){
    var order = CODE_ORDER.split("").reverse().join(""), counts = {};
    codes.forEach(function(c){ counts[c] = (counts[c] || 0) + 1; });
    var body = order.split("").filter(function(l){ return counts[l]; }).map(function(l){
      var n = counts[l];
      return n === 1 ? l : n === 2 ? l + l : l + n;
    }).join("");
    return (sys === "merivo" ? "M-" : "L-") + body + (inner || "");
  }
  // cumulative front boundaries bottom → top (fractions of the body height, one per seam)
  function drawerFractions(sysKey, bodyMm, gapMm){
    var L = DRAWER_LAYOUT[sysKey];
    if (!L) return null;
    var gaps = (L.sides.length - 1) * (gapMm || 3), sum = L.sides.reduce(function(a, b){ return a + b; }, 0);
    var extra = (bodyMm - gaps - sum) / L.sides.length;
    var fronts = L.sides.map(function(h){ return h + extra; }).reverse(); // bottom → top
    var out = [], acc = 0;
    fronts.slice(0, -1).forEach(function(h){ acc += h + (gapMm || 3) / 2; out.push(acc / bodyMm); acc += (gapMm || 3) / 2; });
    return out;
  }

  var DRAWER_SYSTEMS = {
    // texts from Björninn (2026-10-11), shortened: Merivo the sensible everyday choice, Legra the luxury line
    legra:  { label:"Legra",  desc:"Lúxuslínan frá Blum. Grannar, beinar hliðar og einstaklega fágað útlit, þegar smáatriðin skipta öllu.", airtableName:"LEGRA" },
    merivo: { label:"Merivo", desc:"Okkar algengasta lausn. Sterkt og nákvæmt kerfi með hreinu útliti, án óþarfa kostnaðar.", airtableName:"MERIVO", popular:true }
  };

  // Room wall color (Phase 7e) — purely a visualization preference, not a
  // purchasable material (Björninn doesn't sell paint), so no Efnislisti
  // link like carcass/front — just a curated hex palette for the 3D/2D
  // preview. hvitt matches the historical fixed wall color.
  // Flísar á vegg (bath, owner 2026-10-27): decorative only, never ordered — 60 × 30 cm wall tiles, half-bond, grey grout
  var WALL_TILES = {
    hvit:  { label:"Hvítar flísar",  color:"#f2f1ec", grout:"#d4d1ca" },
    gra:   { label:"Gráar flísar",   color:"#bebdb7", grout:"#9c9b96" },
    beige: { label:"Beige flísar",   color:"#d9cdb7", grout:"#c2b59e" },
    dokk:  { label:"Dökkar flísar",  color:"#5b5c5f", grout:"#454649" }
  };
  var WALL_COLORS = {
    hreinhvitt: { label:"Hreinhvítt", hex:"#fbfbf9" },
    hvitt:   { label:"Beinhvítt",  hex:"#f1efe8" },
    ljosgra: { label:"Ljósgrátt", hex:"#d9d6cd" },
    blatt:   { label:"Ljósblátt", hex:"#cdd9e0" },
    graent:  { label:"Sölvígrænt",hex:"#d3d9c9" },
    greige:  { label:"Hlýtt grátt", hex:"#cfc8bc" },
    dokkgra: { label:"Dökkgrátt",  hex:"#5f6164" },
    kol:     { label:"Kolgrátt",   hex:"#3d3f42" }
  };

  // Windows/doors (Phase 7e) — room-level openings, not cabinets: fixed
  // sensible default sizes rather than customer-tunable dimensions, matching
  // this tool's "rough sketch" positioning (Rakel refines exact placement).
  // Deliberately independent of cabinet placement — no collision detection
  // against cabinets on the same wall; real-world conflicts (a window where
  // a cabinet was about to go) are exactly the kind of judgment call left
  // for Rakel's review, not something this tool tries to solve.
  var WINDOW_DEFAULT = { widthMm:1200, heightMm:1000, sillHeightMm:1000 }; // sill clears the worktop (base units 900 + 32 mm top)
  var DOOR_DEFAULT = { widthMm:800, heightMm:2000 };
  var GAP_DEFAULT = { widthMm:900, heightMm:2100 }; // a plain opening in the wall (no door)

  // A curated 5 of Vörulisti's 100+ "Höldur" products (no usage/popularity
  // field on that table to rank by, unlike Efnislisti's materials — picked
  // by hand for a spread of styles). `vorulistiId` is null for "fraest"
  // (no separate hardware, the existing milled-grip default) — everything
  // else links a real product record. Not modeled in 3D (out of scope, see
  // the "simple textured boxes" decision) — shown as a confirmation line
  // with the real photo instead, on both the customer summary and review page.
  var HANDLES = {
    fraest: { label:"Falið grip (fræst)", img:null, desc:"Ekkert áfast handfang — rennt í plötuna sjálfa", vorulistiId:null },
    ona:    { label:"Ona", img:"handles/ona.jpg", desc:"Klassískt langt stanghandfang", vorulistiId:"rec0vFCmgfSb4pn7Q" },
    jey2:   { label:"Jey2 Ál grip", img:"handles/jey2.jpg", desc:"Nútímalegt álprófíl-grip", vorulistiId:"recB9WZg6CXM0xZrZ" },
    arpa:   { label:"Arpa hnúður", img:"handles/arpa.png", desc:"Einfaldur hnúður", vorulistiId:"rec3cjIwV84443gre" },
    hexxa:  { label:"Hexxa Ál grip", img:"handles/hexxa.jpg", desc:"Grannt álprófíl-grip", vorulistiId:"rec9YdI6ECx0pxkPA" },
    // Real Blum Tip-on products exist for both doors and drawers (several
    // door variants + one drawer variant) — which exact SKU applies depends
    // on Rakel's own door/drawer judgment per cabinet, so this doesn't try to
    // fake that precision. It writes a plain note instead (see
    // collectEyðublaðRows in kitchen-planner.html), same pattern as the
    // shelves-vs-drawers note. `isPushOpen` flags that branch.
    push:   { label:"Þrýstiopnun", img:"handles/push-open.jpg", desc:"Ekkert sýnilegt handfang eða grip — ýtt létt á framhliðina til að opna", vorulistiId:null, isPushOpen:true }
  };
  // 3D look of each handle: style = bar | edge | tab | knob | groove | none,
  // len = bar length (m) or the share of the door width for an edge profile.
  HANDLES.fraest.style = "groove";
  HANDLES.ona.style = "bar";   HANDLES.ona.len = 0.24;
  HANDLES.jey2.style = "edge"; HANDLES.jey2.len = 0.94;
  HANDLES.hexxa.style = "edge"; HANDLES.hexxa.len = 0.7;
  HANDLES.arpa.style = "knob";
  HANDLES.push.style = "none";

  // Catalogue harvested from the galleries on bjorninninnrettingar.is
  // (kitchen-planner-catalog.js → window.KPCAT): fronts, worktops, more handles.
  var KPCAT = window.KPCAT || { fronts:{}, tops:{}, handles:{} };
  Object.keys(KPCAT.handles).forEach(function(k){ HANDLES[k] = Object.assign({ vorulistiId:null }, KPCAT.handles[k]); });
  // The handle range is being rebuilt one handle at a time (kitchen-planner-handles.js): the earlier ones stay
  // (old drafts / submissions still render) but are hidden from the picker.
  var KPH = window.KPHANDLES || { groups:[], items:{}, placeExisting:{} };
  Object.keys(HANDLES).forEach(function(k){ HANDLES[k].hidden = true; });
  Object.keys(KPH.placeExisting || {}).forEach(function(k){ if (HANDLES[k]){ HANDLES[k].hidden = false; HANDLES[k].group = KPH.placeExisting[k]; } });
  Object.keys(KPH.items || {}).forEach(function(k){ HANDLES[k] = Object.assign({ vorulistiId:null }, HANDLES[k] || {}, KPH.items[k], { hidden:false }); }); // an old key (Hexxa) keeps its Vörulisti id
  var HANDLE_GROUPS = KPH.groups || [];
  var HANDLE_FINISHES = KPH.finishes || {};
  // the chosen handle colour, or null when the handle keeps its own (set at the start of each scene build)
  function handleFinishFor(handleKey, colorKey){ // null = the handle as photographed (its own default colour)
    var h = HANDLES[handleKey];
    if (!h || h.fixedColor || h.group === "an" || !colorKey || !HANDLE_FINISHES[colorKey]) return null;
    if (h.finishes && (h.finishes.indexOf(colorKey) < 0 || colorKey === h.finish)) return null; // not made in it / its own colour
    return HANDLE_FINISHES[colorKey];
  }
  // the length rule for a pull screwed onto a front (user, 2026-10-24): the largest real length that is at most
  // 2/3 of the front and keeps fitMarginMm clear each side — the 3D and the order (Line Items) use this same number
  // An upright pull on a tall door (user, 2026-10-25): sized by the door's HEIGHT, the longest real length up to
  // 50 cm — the same rule picks the SKU for the order (handleHardwareSummary), so the picture and the order agree
  var TALL_PULL_MAX_MM = 500;
  function tallHandleAvailMm(hcfg, doorHmm){ return Math.min(TALL_PULL_MAX_MM, handleAvailMm(hcfg, doorHmm), doorHmm - 2 * HANDLE_SAFE_M * 1000); }
  function handleAvailMm(hcfg, frontMm){
    if (!hcfg) return frontMm;
    if (hcfg.kind === "bar") return Math.min(frontMm - 2 * (hcfg.fitMarginMm || 60), frontMm * 2 / 3);
    if (hcfg.kind === "topmount") return frontMm - 60;
    return frontMm;
  }
  var handleFinish = null;
  var TOPS = {};
  Object.keys(KPCAT.tops).forEach(function(k){ TOPS[k] = KPCAT.tops[k]; });
  // two veined stones next to the plain one (user, 2026-10-11 — "með æðum", hqs.is for inspiration); ordered from a
  // stone supplier like the plain Steinplata, the söluaðili confirms the exact slab
  TOPS.steinn_hvitur = { label:"Hvítur með gráum æðum", group:"steinn", img:null, tex:null, color3d:"#ece9e3", marble:{ base:"#f1eee8", vein:"#8e8f94", seed:3 }, desc:"Pöntuð sérstaklega hjá samstarfsaðilum" };
  TOPS.steinn_svartur = { label:"Svartur með ljósum æðum", group:"steinn", img:null, tex:null, color3d:"#2a2a2c", marble:{ base:"#232326", vein:"#d8d4cc", seed:7 }, desc:"Pöntuð sérstaklega hjá samstarfsaðilum" };
  // Worktop thickness by kind (user, 2026-10-11): límtré 30, compact 12, harðplast 20; stone stays 30
  // "Engin borðplata" (2026-10-12): nothing on the cabinets — drawn as an invisible 1 mm top, 0 mm everywhere else
  TOPS.engin = { label:"Engin borðplata", group:"engin", img:null, tex:null, color3d:"#ffffff", none:true, desc:"Engin borðplata" };
  var TOP_THICK = { limtre:0.030, compact:0.012, hardplast:0.020, steinn:0.030, engin:0 };
  function topThickM(topKey){ var t = TOPS[topKey || "steinn"]; return t && t.none ? 0 : (t && TOP_THICK[t.group]) || 0.030; }

  // EGGER decors Björninn actually stocks (2026-10-01): kitchen-planner-egger.js is generated by
  // tools/egger-sync.py from Efnislisti + egger.com's own "Raport" (CAD repeat) images. They replace the
  // site-photo Viðarlíki / Framhliðaefni fronts and Harðplast worktops in the pickers — old keys stay,
  // hidden, so drafts and submissions still render — and each one carries its real Efnislisti id, so the
  // pick links straight to the board on the Tækifæri. One raport tile ≈ 1.3 × 2.8 m (checked against the
  // plank widths of Halifax oak); a 600 mm front shows a ~half-tile-wide slice of it, as on a real board.
  var KPEG = window.KPEGGER || { decors:{} };
  var EGGER_TILE = { w:1.3, h:2.8 };
  // Egger's "Raport" CAD download is exported at a fixed pixel size regardless of a decor's real physical
  // repeat length (root-caused 2026-10-13, docs/kitchen-planner.md) — no metadata exists to derive a per-decor
  // scale automatically, so these are a one-time manual pick (user, 2026-10-14, pointed at exactly these 19 as
  // reading "zoomed out"/patchwork in the picker). Picker-only (same device the 3D texture already uses the
  // full image at 1:1 via EGGER_TILE) — a CSS crop+scale on the swatch tile, the same mechanism `.sw-crop`
  // already uses for Spónlagt photos, not a source-image edit.
  var EGGER_PICKER_ZOOM = { H1176:1.6, H1227:1.6, H1250:1.6, H1379:1.6, H1386:1.6, H1384:1.6, H3003:1.6, H3041:1.6,
    H3131:1.6, H3157:1.6, H3158:1.6, H3165:1.6, H3171:1.6, H3176:1.6, H3180:1.6, H3198:1.6, H3349:1.6, H3430:1.6, H3730:1.6 };
  function eggerRow(d, cat){
    var rows = d.rows.filter(function(r){ return r.cat === cat; });
    return rows.find(function(r){ return r.mm === 19; }) || rows[0] || null;
  }
  function eggerLabel(d){ // "H3710 ST9 Natural Carini Walnut" → "Natural Carini Walnut"
    return d.label.replace(new RegExp("^" + d.code + "\\s*(ST\\d+|TM\\d+|PM|PA|PG|PT|SM)?\\s*"), "") || d.code;
  }
  if (Object.keys(KPEG.decors).length){
    Object.keys(LOOKS).forEach(function(k){ if (LOOKS[k].category === "vidarliki" || LOOKS[k].category === "framhlidaefni") LOOKS[k].hidden = true; });
    Object.keys(TOPS).forEach(function(k){ if (TOPS[k].group === "hardplast") TOPS[k].hidden = true; });
    Object.keys(KPEG.decors).sort().forEach(function(code){
      var d = KPEG.decors[code], fr = eggerRow(d, "front"), tp = eggerRow(d, "top"), label = eggerLabel(d);
      // searchable by the Egger name, the code and Björninn's own Icelandic board names ("eik", "hnota", "grár")
      var search = (label + " " + code + " " + d.rows.map(function(r){ return r.name; }).join(" ")).toLowerCase();
      if (fr) LOOKS["eg_" + code] = {
        label:label, code:code, egger:true, search:search, img:d.thumb, color3d:d.color || "#cccccc", efnislistiId:fr.id, desc:"Egger " + code,
        // uni colours read better as the satin paint material than as a flat photo
        category:d.kind === "wood" ? "vidarliki" : d.kind === "uni" ? "framhlidaefni" : "steinaferd",
        tex:d.kind === "uni" ? null : d.tex, tile:EGGER_TILE, zoom:EGGER_PICKER_ZOOM[code] || null,
        // offered (user, 2026-10-11): Framhliðaefni only in Egger's PM (PerfectSense Matt) finish, no stone/metal fronts —
        // the rest stay so old drafts still render
        hidden:d.kind === "stone" || (d.kind === "uni" && d.structure !== "PM")
      };
      if (tp) TOPS["eg_" + code] = { label:label, code:code, egger:true, search:search, group:"hardplast", img:d.thumb, tex:d.tex, tile:EGGER_TILE, color3d:d.color || "#cccccc", efnislistiId:tp.id };
    });
    // Spónlagt (real veneer) draws with the nearest-looking Egger decor's raport in 3D (user, 2026-10-11: the
    // procedural grain looked fake). Only the 3D texture — the picker keeps Björninn's own photos.
    var SP_EGGER = { sp00:"H3331", sp01:"H3332", sp02:"H3398", sp03:"H1714", sp04:"H3325", sp05:"H1250", sp06:"H1379", sp07:"H3730" };
    Object.keys(SP_EGGER).forEach(function(k){
      var d = KPEG.decors[SP_EGGER[k]];
      if (LOOKS[k] && d && d.tex){ LOOKS[k].tex = d.tex; LOOKS[k].tile = EGGER_TILE; }
    });
    if (Object.keys(LOOKS).some(function(k){ return LOOKS[k].category === "steinaferd" && !LOOKS[k].hidden; })){
      LOOK_CATEGORIES.splice(2, 0, { key:"steinaferd", label:"Stein- og efnisáferð", blurb:"Steinn, steypa og málmur — áferðin úr Egger-línunni." });
    }
  }

  // Rectilinear wall-chain (Phase 7d-1) — replaces the old hardcoded
  // straight/L/U presets with a generic walk: each wall's `turnAfter`
  // ("left"|"right"|null) says how the *next* wall turns off this one, so
  // any rectilinear kitchen shape (not just 3 fixed presets) falls out of
  // the same loop.
  //
  // Every wall must form a RIGHT-HANDED basis with world-up, i.e.
  // cross(axis, (0,1,0)) must equal normal — makeBasis() below doesn't
  // validate this, it'll happily build a mirrored (determinant -1) matrix
  // that Quaternion.setFromRotationMatrix then silently mangles into a
  // degenerate non-unit quaternion (garbled wall/cabinet orientation,
  // "material facing the wrong way" — the bug this session's earlier 3D fix
  // chased down, hand-verified per hardcoded shape). Deriving normal from
  // axis via one fixed formula, always, retires that whole bug class instead
  // of re-verifying it by hand per shape: for axis=(x,z), normal=(-z,x) is
  // exactly cross(axis,(0,1,0)) — confirmed by checking it reproduces every
  // wall in the old straight/L/U cases exactly. Turning the walk left/right
  // rotates axis by the same ±90°, and normal is *always* re-derived from
  // the new axis by that formula — so a turn can never produce a mirrored
  // basis, by construction.
  function rotate90(v, dir){
    return dir === "left" ? { x:-v.z, z:v.x } : { x:v.z, z:-v.x };
  }
  function normalFromAxis(axis){ return { x:-axis.z, z:axis.x }; }
  // Skáveggir (user, 2026-10-23): a turn may be any angle. w.angleDeg = how far the next wall turns off this one
  // (exterior turn, 90 when absent — every older room stays exactly as it was), w.turnAfter still says which way;
  // walls[0].dirDeg = the first wall's own direction (0 = +x when absent). 90° keeps the exact rotate90 formula.
  function turnAngle(w){ return w && w.angleDeg != null ? w.angleDeg : 90; }
  function turnAxis(axis, dir, deg){
    if (dir !== "left" && dir !== "right") return axis;
    if (deg == null || deg === 90) return rotate90(axis, dir);
    var t = deg * Math.PI / 180 * (dir === "left" ? 1 : -1), c = Math.cos(t), sn = Math.sin(t);
    return { x:axis.x * c - axis.z * sn, z:axis.x * sn + axis.z * c };
  }

  function wallGeometry3D(walls){
    function m(mm){ return mm / 1000; }
    var geoms = [];
    var origin = { x:0, z:0 };
    var d0 = walls[0] && walls[0].dirDeg ? walls[0].dirDeg * Math.PI / 180 : 0;
    var axis = d0 ? { x:Math.cos(d0), z:Math.sin(d0) } : { x:1, z:0 };
    walls.forEach(function(w, i){
      var normal = normalFromAxis(axis);
      var lenM = m(w.lengthMm);
      // outer-corner fill for the 3D wall box: at an inward (left) corner the two boxes' outer faces leave a wedge
      // open behind the corner (the 8 cm square at 90°) — this wall's box runs on by thickness × tan(turn/2)
      var nx = walls[i + 1] || walls[0], turn = turnAngle(w);
      var ext = w.turnAfter === "left" && !w.open && nx && !nx.open && turn < 170 ? Math.min(0.4, WALL_THICKNESS_M * Math.tan(turn * Math.PI / 360)) : 0;
      geoms.push({ origin:{ x:origin.x, z:origin.z }, axis:axis, normal:normal, lenM:lenM, extEndM:ext });
      var end = { x: origin.x + axis.x * lenM, z: origin.z + axis.z * lenM };
      axis = turnAxis(axis, w.turnAfter, w.angleDeg);
      origin = end;
    });
    return geoms;
  }

  // ---------- islands ----------
  // state.islands = [{id, label, lengthMm, xMm, zMm, rot (0/90/180/270),
  //                   a:[blocks], two:bool, b:[blocks]}]. (xMm, zMm) is the
  // middle of the island's seam line in room coordinates. Each row behaves
  // like a wall that stands free in the room: "surfaces" = the real walls
  // followed by every island row, in the same order as surfaceGeoms(), so all
  // the wall-based placement/drag/render code works on islands unchanged.
  // Row A faces the island's normal; row B (back to back) faces the other way.
  function islandFrame(isl){
    var axis = { x:1, z:0 }, k = (((Math.round((isl.rot || 0) / 90)) % 4) + 4) % 4;
    for (var i = 0; i < k; i++) axis = rotate90(axis, "right");
    return { axis:axis, normal:normalFromAxis(axis) };
  }
  var ISLAND_MAX_MM = 6000;
  // ---------- milliveggir (partition walls, 2026-10-15) ----------
  // A "milliveggur" is an obstacle (state.obstacles, kind:"milliveggur" — see OBSTACLES below) that also
  // works as a real surface: cabinets can stand against either of its two long faces, same as an island's
  // two back-to-back rows. Unlike an island, its length (o.depthMm — "how far it reaches into the room")
  // is a fixed, user-set dimension, not grown from its cabinets, so it's used directly as the surface's
  // lengthMm (the same way a real wall's own lengthMm is its placement capacity). Cabinets live in the
  // obstacle's own o.sideA / o.sideB arrays (parallel to an island's a / b), keyed "<id>a" / "<id>b".
  function partitionObstacles(state){ return (state.obstacles || []).filter(function(o){ return o.kind === "milliveggur"; }); }
  function surfacesOf(state){
    var out = state.walls.slice();
    out.closed = !!state.closed;
    (state.islands || []).forEach(function(isl){
      if (!isl.a) isl.a = [];
      // lengthMm = placement capacity only: an island's real length grows/shrinks with its cabinets (see the planner's normalizeIslands)
      out.push({ id:isl.id + "a", label:isl.label + (isl.two ? " · röð A" : ""), lengthMm:ISLAND_MAX_MM, floor:isl.a, wall:[], island:isl, side:"a" });
      if (isl.two){
        if (!isl.b) isl.b = [];
        out.push({ id:isl.id + "b", label:isl.label + " · röð B", lengthMm:ISLAND_MAX_MM, floor:isl.b, wall:[], island:isl, side:"b" });
      }
    });
    partitionObstacles(state).forEach(function(o){
      if (!o.sideA) o.sideA = [];
      if (!o.sideB) o.sideB = [];
      out.push({ id:o.id + "a", label:"Milliveggur · hlið A", lengthMm:o.depthMm, floor:o.sideA, wall:[], partition:o, side:"a" });
      out.push({ id:o.id + "b", label:"Milliveggur · hlið B", lengthMm:o.depthMm, floor:o.sideB, wall:[], partition:o, side:"b" });
    });
    return out;
  }
  // Each face runs along the obstacle's own depthMm direction (perpendicular to its anchor wall), the two
  // faces separated by its thickness (widthMm) — exactly the two long edges of its footprint rectangle
  // (see obstacleQuad below, same corners). Skipped if its anchor wall is missing or open (nothing to
  // measure the offset/outMm from).
  function milliveggGeoms(state){
    var out = [], walls = wallGeoms(state);
    partitionObstacles(state).forEach(function(o){
      var wi = state.walls.findIndex(function(w){ return w.id === o.wallId; }), g = walls[wi];
      if (!g || state.walls[wi].open) return;
      var r = obstacleRect(o), a = r.a0 / 1000, b = r.a1 / 1000, n0 = r.n0 / 1000, n1 = r.n1 / 1000, lenM = o.depthMm / 1000;
      var ang = obstacleAng(o), mid = [(a + b) / 2, (n0 + n1) / 2];
      function P(al, ou){ if (ang){ var q = turnLocal([al, ou], mid, ang); al = q[0]; ou = q[1]; } return { x:g.origin.x + g.axis.x * al + g.normal.x * ou, z:g.origin.z + g.axis.z * al + g.normal.z * ou }; }
      function V(dal, dou){ if (ang){ var q = turnLocal([dal, dou], [0, 0], ang); dal = q[0]; dou = q[1]; } return { x:g.axis.x * dal + g.normal.x * dou, z:g.axis.z * dal + g.normal.z * dou }; }
      if (!r.rot){ // runs out from the wall: faces A / B are its two sides
        out.push({ origin:P(a, n0), axis:V(0, 1), normal:V(-1, 0), lenM:lenM });
        out.push({ origin:P(b, n0), axis:V(0, 1), normal:V(1, 0), lenM:lenM });
      } else { // turned: parallel to its wall — A faces the room, B faces back toward the wall
        out.push({ origin:P(a, n1), axis:V(1, 0), normal:V(0, 1), lenM:lenM });
        out.push({ origin:P(b, n0), axis:V(-1, 0), normal:V(0, -1), lenM:lenM });
      }
    });
    return out;
  }
  function islandGeoms(state){
    var out = [];
    (state.islands || []).forEach(function(isl){
      var f = islandFrame(isl), lenM = isl.lengthMm / 1000, cx = isl.xMm / 1000, cz = isl.zMm / 1000;
      out.push({ origin:{ x:cx - f.axis.x * lenM / 2, z:cz - f.axis.z * lenM / 2 }, axis:f.axis, normal:f.normal, lenM:lenM });
      if (isl.two){
        var ax = { x:-f.axis.x, z:-f.axis.z };
        out.push({ origin:{ x:cx + f.axis.x * lenM / 2, z:cz + f.axis.z * lenM / 2 }, axis:ax, normal:normalFromAxis(ax), lenM:lenM });
      }
    });
    return out;
  }
  // Wall geometry for a whole state: state.closed = the walls form a closed
  // room (last wall returns to the first wall's start); a wall with .open is a
  // dashed boundary with no wall, cabinets or openings (open-plan kitchens).
  function wallGeoms(state){
    var g = wallGeometry3D(state.walls);
    g.closed = !!state.closed;
    return g;
  }
  function surfaceGeoms(state){ return wallGeoms(state).concat(islandGeoms(state)).concat(milliveggGeoms(state)); }
  // where the move-handle "puck" of an island sits: on the floor just past its start
  function islandHandlePos(isl){
    var f = islandFrame(isl), lenM = isl.lengthMm / 1000;
    return { x:isl.xMm / 1000 - f.axis.x * (lenM / 2 + 0.42), z:isl.zMm / 1000 - f.axis.z * (lenM / 2 + 0.42) };
  }
  // room interior bounds (m) from the real walls only — islands are clamped inside
  function roomBounds(state){ var g = wallGeoms(state); return g.length ? interiorBounds(g, 4.2) : null; }

  // Corner-overlap fix (Phase 7d-2): a floor cabinet's depth projects into
  // the room along its own wall's normal — at a 90° turn, the previous
  // wall's last floor cabinet projects exactly along the NEXT wall's own
  // line, so if that next wall also starts filling from offset 0, the two
  // cabinets' boxes physically overlap in the shared corner square. Real
  // kitchen design handles this with a fixed clearance (one wall's cabinets
  // run flush into the corner, the other's start after leaving room for the
  // first one's depth) — not full 2D collision geometry. Skipped entirely
  // when a Töfrahorn (real Le Mans corner unit, `cls:"corner"`) already
  // occupies either side of the corner, since that hardware is specifically
  // built to consume the corner itself.
  var CORNER_CLEARANCE_MM = 600;
  function cornerClearanceMm(walls, wallIndex, zoneKey){
    if (zoneKey !== "floor" || wallIndex < 0) return 0;
    if (walls[wallIndex] && (walls[wallIndex].island || walls[wallIndex].partition)) return 0; // free-standing rows have no corner
    var prevIdx = wallIndex > 0 ? wallIndex - 1 : -1;
    if (prevIdx < 0 && walls.closed){ // closed room: the last real wall meets the first
      prevIdx = walls.length - 1;
      while (prevIdx > 0 && (walls[prevIdx].island || walls[prevIdx].partition)) prevIdx--;
    }
    if (prevIdx < 0 || prevIdx === wallIndex) return 0;
    var prev = walls[prevIdx];
    if (prev.turnAfter !== "left" || prev.open || (walls[wallIndex] && walls[wallIndex].open)) return 0; // outward (reflex) corners and open edges have no clash
    var prevLast = prev.floor[prev.floor.length - 1];
    if (!prevLast) return 0;
    var cur = walls[wallIndex];
    // (No exemption for Töfrahorn any more: it is drawn as a plain 1200 × 600 box,
    // so the neighbouring wall's run has to start after its depth like any cabinet.)
    var dPrev = prevLast.depthMm || CATALOG[prevLast.type].d;
    var th = turnAngle(prev);
    if (th === 90) return dPrev;
    // any angle (skáveggir): where this wall's first box (depth dCur) stops overlapping the previous wall's last
    // one, which is assumed to run right into the corner. In the previous wall's frame a point s along this
    // wall, u into the room, sits at p = s·cosθ − u·sinθ along it (past its end when > 0) and q = s·sinθ + u·cosθ off it.
    var first = cur && cur.floor && cur.floor[0], dCur = first ? (first.depthMm || (CATALOG[first.type] || {}).d || 600) : 600;
    var t = th * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t);
    var need = th < 90 ? Math.min(dPrev * sn, dCur * sn / cs) : (dPrev - dCur * cs) / sn;
    return Math.max(0, Math.ceil(need / 10) * 10);
  }

  // Áfella (19 mm filler) between a cabinet run and a wall face it would otherwise touch (user, 2026-10-02):
  // a run may not stand flush against a wall — placement keeps AFELLA_MM free at a wall end, and the 3D
  // draws a filler in the front material there (worktop over it) when a cabinet sits right at that limit.
  // A wall "end" is solid when the neighbouring wall turns inwards (left) and isn't an open edge. At the
  // start of a floor run that already begins after the previous wall's cabinets (corner clearance), the run
  // meets their side panel, not the wall — no áfella there.
  var AFELLA_MM = 19;
  function realWallCount(walls){ var n = 0; while (n < walls.length && !walls[n].island && !walls[n].partition) n++; return n; }
  function afellaMm(walls, wallIndex, zoneKey){
    var w = walls[wallIndex], n = realWallCount(walls);
    if (!w || w.island || w.partition || w.open || wallIndex >= n) return { start:0, end:0 };
    var prev = wallIndex > 0 ? walls[wallIndex - 1] : walls.closed ? walls[n - 1] : null;
    var next = wallIndex < n - 1 ? walls[wallIndex + 1] : walls.closed ? walls[0] : null;
    var startSolid = !!prev && prev !== w && prev.turnAfter === "left" && !prev.open && turnAngle(prev) > 20; // a (nearly) straight joint isn't a corner
    var endSolid = !!next && next !== w && w.turnAfter === "left" && !next.open && turnAngle(w) > 20;
    if (startSolid && zoneKey === "floor" && cornerClearanceMm(walls, wallIndex, "floor") > 0) startSolid = false;
    return { start:startSolid ? AFELLA_MM : 0, end:endSolid ? AFELLA_MM : 0 };
  }

  // Free positioning along a wall: each block may carry `gapMm` = empty space
  // between it and the previous block (or the wall start / corner clearance
  // for the first one). No gaps = the old packed layout, so old drafts and
  // submissions render exactly as before. Returns the start offset (mm from
  // the wall origin) of every block in `list`.
  function blockStartsMm(list, clearanceMm){
    var out = [], pos = clearanceMm || 0;
    list.forEach(function(b){
      pos += b.gapMm || 0;
      out.push(pos);
      pos += b.widthMm;
    });
    return out;
  }

  // ---------- fit check (shared: editor + Rakel's review page) ----------
  // Flags physically impossible/awkward combinations, in millimetres on each
  // wall: a cabinet overlapping a window or door, or a unit taller than the
  // ceiling. Advisory only — Rakel makes the final call.
  // opts.pro (PRO only, 2026-10-27): also small gaps along a run (G6) and two sinks in one room (G7)
  var GAP_HINT_MM = 300; // a gap under this between cabinets / to the wall wants an áfella or fyllistykki (or closing up)
  function fitWarnings(state, opts){
    var out = [], byMsg = {}, roomH = state.roomHeightMm || 2600, pro = !!(opts && opts.pro), surfs = pro ? surfacesOf(state) : null;
    function add(msg, ids){
      var w = byMsg[msg];
      if (!w){ w = byMsg[msg] = { msg:msg, ids:[], count:0 }; out.push(w); }
      w.count++;
      ids.forEach(function(id){ if (w.ids.indexOf(id) < 0) w.ids.push(id); });
    }
    function acc(label){ return __(label).replace(/^Veggur/, "vegg").replace(/^Wall/, "wall"); } // "á vegg 1"
    function lc(label){ return __(label).toLowerCase(); }
    state.walls.forEach(function(wall, wi){
      var spans = [], fStarts = blockStartsMm(wall.floor, cornerClearanceMm(state.walls, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      wall.floor.forEach(function(b, i){
        var c = CATALOG[b.type], h = b.heightMm || c.h;
        spans.push({ b:b, c:c, from:fStarts[i], to:fStarts[i] + b.widthMm, lo:0, hi:Math.min(h, roomH) + (c.counter ? 32 : 0), rawH:h });
      });
      wall.wall.forEach(function(b, i){
        var c = CATALOG[b.type], h = b.heightMm || c.h;
        var e = elevOf(b);
        spans.push({ b:b, c:c, from:wStarts[i], to:wStarts[i] + b.widthMm, lo:e, hi:e + h, rawH:e + h });
      });
      spans.forEach(function(a){ // upper units / shelves vs tall floor units on the same wall
        if (a.lo !== 0) return;
        spans.forEach(function(b2){
          if (b2.lo === 0 || Math.min(a.to, b2.to) - Math.max(a.from, b2.from) <= 20 || Math.min(a.hi, b2.hi) - Math.max(a.lo, b2.lo) <= 20) return;
          add(__("{a} rekst á {b} á {w}.", { a:__(b2.c.label), b:lc(a.c.label), w:acc(wall.label) }), [a.b.id, b2.b.id]);
        });
      });
      var ops = (state.windows || []).filter(function(o){ return o.wallId === wall.id; }).map(function(o){ return { kind:"gluggi", o:o, lo:o.sillHeightMm, hi:o.sillHeightMm + o.heightMm }; })
        .concat((state.doors || []).filter(function(o){ return o.wallId === wall.id; }).map(function(o){ return { kind:o.gap ? "op" : "hurð", o:o, lo:0, hi:o.heightMm }; }))
        .concat((state.obstacles || []).filter(function(o){ return o.wallId === wall.id && OBSTACLES[o.kind] && OBSTACLES[o.kind].blocks && obstacleRect(o).n0 < 600; })
          .map(function(o){ var v = obstacleVSpan(state, o), r = obstacleRect(o); return { kind:"hindrun", o:{ id:o.id, kind:o.kind, offsetMm:r.a0, widthMm:r.a1 - r.a0 }, lo:v.lo, hi:v.hi }; }));
      if (pro && !wall.partition && wall.floor.length){ // G6: gaps that need an áfella / fyllistykki — nothing in the Sögunarlisti covers them
        var cc = cornerClearanceMm(state.walls, wi, "floor"), af = afellaMm(surfs, wi, "floor"), lo = cc + af.start, hi = wall.lengthMm - af.end;
        var nm = function(b){ return b.sk || __(CATALOG[b.type].label); };
        var gaps = [];
        if (cc > 0 || af.start > 0) gaps.push({ from:lo, to:fStarts[0], b:wall.floor[0], end:true }); // only where a wall / corner run meets it
        wall.floor.forEach(function(b, i){ if (i) gaps.push({ from:fStarts[i - 1] + wall.floor[i - 1].widthMm, to:fStarts[i], a:wall.floor[i - 1], b:b }); });
        var li = wall.floor.length - 1;
        if (af.end > 0) gaps.push({ from:fStarts[li] + wall.floor[li].widthMm, to:hi, a:wall.floor[li], end:true });
        gaps.forEach(function(g){
          var n = Math.round(g.to - g.from);
          if (n < 5 || n >= GAP_HINT_MM) return;
          if (ops.some(function(op){ return op.lo < 900 && op.o.offsetMm < g.to && op.o.offsetMm + op.o.widthMm > g.from; })) return; // a door/opening/radiator is the reason
          var one = g.a || g.b;
          add(g.end ? __("Bil {n} mm frá {a} að vegg á {w} — áfella eða færa skápinn að?", { n:n, a:nm(one), w:acc(wall.label) })
                    : __("Bil {n} mm milli {a} og {b} á {w} — áfella, fyllistykki eða færa saman?", { n:n, a:nm(g.a), b:nm(g.b), w:acc(wall.label) }), [g.a, g.b].filter(Boolean).map(function(b){ return b.id; }));
        });
      }
      spans.forEach(function(sp){
        ops.forEach(function(op){
          var hOverlap = Math.min(sp.to, op.o.offsetMm + op.o.widthMm) - Math.max(sp.from, op.o.offsetMm);
          var vOverlap = Math.min(sp.hi, op.hi) - Math.max(sp.lo, op.lo);
          if (hOverlap > 20 && vOverlap > 20){
            add(__("{a} skarast við {b} á {w}.", { a:__(sp.c.label), b:(op.kind === "gluggi" ? __("glugga") : op.kind === "op" ? __("op í vegg") : op.kind === "hindrun" ? lc(OBSTACLES[op.o.kind].label) : __("hurð")), w:acc(wall.label) }), [sp.b.id, op.o.id]);
          }
        });
        if (sp.rawH > roomH) add(__("{a} á {w} er hærri en loftið ({h}).", { a:__(sp.c.label), w:acc(wall.label), h:dimLen(roomH) }), [sp.b.id]);
      });
    });
    out.forEach(function(w){ if (w.count > 1) w.msg = w.msg.replace(/\.$/, "") + " " + __("({n} skápar).", { n:w.count }); });
    (state.obstacles || []).forEach(function(o){
      if (o.kind !== "vatn") return;
      var wall = state.walls.find(function(w){ return w.id === o.wallId; }); if (!wall) return;
      var wi = state.walls.indexOf(wall), starts = blockStartsMm(wall.floor, cornerClearanceMm(state.walls, wi, "floor"));
      var behind = wall.floor.some(function(b, i){ var c = CATALOG[b.type]; return (c.sink || b.type === "dishwasher" || /uppthvottavel|thvottavel/.test(b.type)) && starts[i] < o.offsetMm + o.widthMm && starts[i] + b.widthMm > o.offsetMm; });
      if (!behind) out.push({ msg:__("Vatnsinntak / niðurfall á {w} er ekki á bak við vaskaskáp eða uppþvottavél.", { w:acc(wall.label) }), ids:[o.id], count:1 });
    });
    if (pro){ // G7: two sinks in one room — usually the auto-placed one plus one added by hand
      var sinks = [];
      surfacesOf(state).forEach(function(w){ w.floor.forEach(function(b){ if ((CATALOG[b.type] || {}).sink) sinks.push(b); }); });
      if (sinks.length > 1) out.push({ msg:__("{n} vaskaskápar í rýminu ({list}) — er það ætlunin?", { n:sinks.length, list:sinks.map(function(b){ return b.sk || __(CATALOG[b.type].label); }).join(", ") }),
        ids:sinks.map(function(b){ return b.id; }), count:1 });
    }
    islandWarnings(state, function(msg, ids){ out.push({ msg:msg, ids:ids, count:1 }); });
    openingIssues(state).warn.forEach(function(w){ out.push({ msg:w.msg, ids:w.ids, count:1 }); });
    roomDoorConflicts(state).forEach(function(cf){
      var many = cf.labels.length > 1, what = cf.labels.map(lc).join(", ");
      out.push({ msg:cf.slide
        ? (many ? __("Rennihurðin á {w} rennur þar sem {what} eru — láttu hana renna í hina áttina eða færðu skápana.", { w:acc(cf.wallLabel), what:what })
                : __("Rennihurðin á {w} rennur þar sem {what} er — láttu hana renna í hina áttina eða færðu skápinn.", { w:acc(cf.wallLabel), what:what }))
        : (many ? __("Hurðin á {w} rekst á {what} þegar hún opnast — snúðu henni (lamir/opnun) eða færðu skápana.", { w:acc(cf.wallLabel), what:what })
                : __("Hurðin á {w} rekst á {what} þegar hún opnast — snúðu henni (lamir/opnun) eða færðu skápinn.", { w:acc(cf.wallLabel), what:what })), ids:[cf.doorId].concat(cf.ids), count:1 });
    });
    return out;
  }

  // ── Room doors (2026-10-23): which way a door opens, and what it hits ─────────────────────────────────
  // door.swing = "in" (into this room, default) | "out" (away from it) | "slide" (no swing); door.hinge = "left" |
  // "right" as seen from INSIDE the room facing the wall. A wall's axis points to your right when you stand in the
  // room facing it (axis × normal geometry), so a left hinge sits at the door's start (offsetMm), a right one at its end.
  function doorSwingOf(d){ return d.swing === "out" || d.swing === "slide" ? d.swing : "in"; }
  function doorHingeOf(d){ return d.hinge === "right" ? "right" : "left"; }
  // the leaf's quarter circle in room coordinates (m): hinge point h, u = along the wall toward the latch, v = the
  // side it swings to, r = leaf width. null for a slider / an opening without a leaf / a door on a missing wall.
  function doorSweep(state, d){
    if (d.gap || doorSwingOf(d) === "slide") return null;
    var wi = state.walls.findIndex(function(w){ return w.id === d.wallId; });
    var g = wallGeoms(state)[wi];
    if (!g || state.walls[wi].open) return null;
    var right = doorHingeOf(d) === "right", along = (d.offsetMm + (right ? d.widthMm : 0)) / 1000;
    var sgn = doorSwingOf(d) === "out" ? -1 : 1;
    return { h:{ x:g.origin.x + g.axis.x * along, z:g.origin.z + g.axis.z * along }, u:{ x:g.axis.x * (right ? -1 : 1), z:g.axis.z * (right ? -1 : 1) },
      v:{ x:g.normal.x * sgn, z:g.normal.z * sgn }, r:d.widthMm / 1000, inward:sgn > 0, g:g, wi:wi };
  }
  function inConvex(p, poly){ // convex quad, either winding
    var sign = 0;
    for (var i = 0; i < poly.length; i++){
      var a = poly[i], b = poly[(i + 1) % poly.length], cr = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      if (Math.abs(cr) < 1e-9) continue;
      if (!sign) sign = cr > 0 ? 1 : -1; else if ((cr > 0 ? 1 : -1) !== sign) return false;
    }
    return true;
  }
  // floor-standing cabinets (any surface) whose footprint the inward swing of a door passes through. Sampled
  // (polar grid over the quarter circle + the cabinet's corners): exact enough at mm scale, and it never misses
  // a cabinet tucked into the corner beside the hinge, which a bounding-box test would.
  function roomDoorConflicts(state){
    var out = [], surf = surfacesOf(state), gs = surfaceGeoms(state), feet = [];
    surf.forEach(function(sf, si){
      var starts = blockStartsMm(sf.floor, cornerClearanceMm(surf, si, "floor"));
      sf.floor.forEach(function(b, i){
        var c = CATALOG[b.type];
        if (!c) return;
        feet.push({ id:b.id, label:c.label, q:rectCornersWorld(gs[si], starts[i], b.widthMm, b.depthMm || c.d) });
      });
    });
    (state.doors || []).forEach(function(d){
      if (!d.gap && doorSwingOf(d) === "slide"){ // the leaf parks on the wall beside the opening (surface track): nothing may stand there below the door's top
        var wl = state.walls.find(function(w){ return w.id === d.wallId; }); if (!wl || wl.open) return;
        var wix = state.walls.indexOf(wl), right = doorHingeOf(d) !== "right";
        var p0 = right ? d.offsetMm + d.widthMm : d.offsetMm - d.widthMm, p1 = p0 + d.widthMm;
        var fS = blockStartsMm(wl.floor, cornerClearanceMm(state.walls, wix, "floor")), wS = blockStartsMm(wl.wall, 0), sh = [];
        wl.floor.forEach(function(b, i){ if (Math.min(p1, fS[i] + b.widthMm) - Math.max(p0, fS[i]) > 20) sh.push(b); });
        wl.wall.forEach(function(b, i){ if (elevOf(b) < d.heightMm && Math.min(p1, wS[i] + b.widthMm) - Math.max(p0, wS[i]) > 20) sh.push(b); });
        if (sh.length) out.push({ doorId:d.id, wallLabel:wl.label, slide:true, ids:sh.map(function(b){ return b.id; }), labels:sh.map(function(b){ return CATALOG[b.type].label; }) });
        return;
      }
      var sw = doorSweep(state, d);
      if (!sw || !sw.inward) return;
      var r = sw.r - 0.02, pts = [];
      for (var ri = 1; ri <= 6; ri++) for (var ai = 0; ai <= 8; ai++){
        var rr = r * ri / 6, t = (Math.PI / 2) * ai / 8, cu = Math.cos(t), sv = Math.sin(t);
        if (sv * rr < 0.03) continue; // hugging the wall line itself: that's the frame, not the swing
        pts.push({ x:sw.h.x + (sw.u.x * cu + sw.v.x * sv) * rr, z:sw.h.z + (sw.u.z * cu + sw.v.z * sv) * rr });
      }
      function inSweep(p){
        var dx = p.x - sw.h.x, dz = p.z - sw.h.z, a = dx * sw.u.x + dz * sw.u.z, b = dx * sw.v.x + dz * sw.v.z;
        return a > 0.01 && b > 0.03 && a * a + b * b < r * r;
      }
      var hit = feet.filter(function(f){ return f.q.some(inSweep) || pts.some(function(p){ return inConvex(p, f.q); }); });
      if (hit.length) out.push({ doorId:d.id, wallLabel:state.walls[sw.wi].label, ids:hit.map(function(f){ return f.id; }), labels:hit.map(function(f){ return f.label; }) });
    });
    return out;
  }

  // ── Fronts meeting walls and corners (2026-10-10) ──────────────────────────────────────────────────────
  // A hinged door on concealed hinges turns roughly about the FRONT corner of its hinge edge (the hinge's crank
  // carries the door forward — it doesn't sweep its full thickness past the carcass side). Seen from above, with
  // that pivot at x = 0, the door running along +x and the room at +z, a point s along the door and v out from
  // its front face (−19 = its back face) is at x = s·cosθ − v·sinθ, z = s·sinθ + v·cosθ. Beside the hinge side there may be a
  // blocker: a plane x = −g (g = the free gap, an áfella is 19) reaching P mm in front of the door face — a wall
  // (P = ∞), the fronts of the other run in an inside corner (P = ∞, their handles eat into g), or a deeper
  // neighbour (a tall unit beside a wall unit). The door may open until its free end or its handle
  // (v = projection) would cross that plane — otherwise the designer showed doors swinging through
  // walls, which looks cheap (user, 2026-10-10). Drawers only run straight out: they're blocked when the other
  // run of an inside corner stands in front of them (the "dead corner").
  var DOOR_OPEN_DEG = 100, FRONT_MM = 19;
  var HANDLE_PROJ = {}; // measured from the real models once loaded (handleProfile), mm out from the front face
  function handleProjMm(key){
    if (!key) return 0;
    if (HANDLE_PROJ[key] != null) return HANDLE_PROJ[key];
    var cfg = window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[key], st = (HANDLES[key] || {}).style;
    if (cfg && (cfg.kind === "jey" || cfg.kind === "hexxa")) return 0;
    if (cfg && cfg.kind === "topmount") return 40;
    if (cfg && cfg.kind === "bar") return 35;
    return st === "knob" ? 30 : st === "bar" || st === "tab" ? 30 : 0; // edge / groove / none / push-to-open: flush
  }
  // the hinged leaves of a cabinet (as the 3D draws them): [{hinge:"left"|"right", w}] — none for drawer units,
  // corner units (they have their own check), appliances, panels, open shelves, flaps and fixed fronts
  function doorLeaves(b, c){
    if (!c || c.panel || c.shelfStack || c.appliance || c.open || c.fixedFronts || c.dishwasher || c.cls === "corner" || c.lowOven || c.drawersOnly) return [];
    if (!c.oven && b.interior && b.interior.mode === "skuffur" && c.cls !== "tall") return []; // a tall drawer unit still has its door on top
    if (twoDoors(b.widthMm, c.zone === "wall") && !c.fridge) return [{ hinge:"left", w:b.widthMm / 2 }, { hinge:"right", w:b.widthMm / 2 }];
    return [{ hinge:b.swing === "haegri" ? "right" : "left", w:b.widthMm }];
  }
  // Smíðagögn `hinge` → /cnc drills hinges only in that carcass side (seen from the front): two leaves = both
  // sides, else the swing. Only asked for a cabinet with a hinged door (2026-10-26, so /cnc never has to guess).
  function smidaHingeSide(b, c){ return doorLeaves(b, c).length > 1 ? "baedi" : b.swing === "haegri" ? "haegri" : "vinstri"; }
  function hasOpenings(b, c){ return !!c && !(c.panel || c.shelfStack || c.appliance || c.open); }
  // the widest the leaf can open (degrees) against a blocker g mm away reaching P mm in front of the door face
  function doorMaxDeg(L, g, P, handle, vertical, zMin){ // zMin: the blocker only starts this far in front of the face
    var t = FRONT_MM, h = handleProjMm(handle), us = [];
    if (h > 0){
      if (vertical) us = [L - 45]; // tall units: an upright pull on the free side
      else { var len = Math.min(320, Math.max(80, L - 200)); us = [Math.max(20, L / 2 - len / 2), Math.min(L - 20, L / 2 + len / 2)]; }
    }
    function hits(deg){
      var a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      function bad(sv, v){ var x = sv * cs - v * sn, z = sv * sn + v * cs; return x < -g - 0.5 && z < P && z >= (zMin || 0); }
      if (bad(L, 0) || bad(L, -t) || bad(0, -t)) return true;
      return us.some(function(u){ return bad(u, h); });
    }
    for (var d = 1; d <= DOOR_OPEN_DEG; d += 0.5) if (hits(d)) return d - 0.5;
    return DOOR_OPEN_DEG;
  }
  function openingIssues(state){
    var walls = surfacesOf(state), n = realWallCount(walls), out = { warn:[], limit:{} }, proj = handleProjMm(state.handle); // (surfacesOf carries `closed`)
    function lim(id, hinge, deg){ var l = out.limit[id] = out.limit[id] || {}; l[hinge] = Math.min(l[hinge] == null ? DOOR_OPEN_DEG : l[hinge], deg); }
    function depthOf(b){ return b.depthMm || CATALOG[b.type].d; }
    function hOf(b){ return b.heightMm || CATALOG[b.type].h; }
    function wl(label){ return __(String(label || "")).replace(/^Veggur/, "vegg").replace(/^Wall/, "wall"); }
    function nm(b, w){ return __("{a} á {w}", { a:__(CATALOG[b.type].label), w:wl(w.label) }); }
    for (var wi = 0; wi < n; wi++){
      var wall = walls[wi];
      if (wall.open) continue;
      var clear = cornerClearanceMm(walls, wi, "floor"), prevIdx = wi > 0 ? wi - 1 : walls.closed ? n - 1 : -1, prev = prevIdx >= 0 && prevIdx !== wi ? walls[prevIdx] : null;
      // in an inside corner, how far the previous wall's cabinets reach out in front of this run's first one
      // (mm from its front face): their fronts are the blocker beside its hinge side — only where they are
      var cornerWin = null;
      if (clear > 0 && prev && (wall.floor || []).length){
        var pS = blockStartsMm(prev.floor || [], cornerClearanceMm(walls, prevIdx, "floor")), Lp0 = prev.lengthMm || 0, dC0 = depthOf(wall.floor[0]);
        (prev.floor || []).forEach(function(pb, j){
          var zFrom = Lp0 - (pS[j] + pb.widthMm) - dC0, zTo = Lp0 - pS[j] - dC0;
          if (zTo <= 0) return;
          cornerWin = cornerWin ? { lo:Math.min(cornerWin.lo, Math.max(0, zFrom)), hi:Math.max(cornerWin.hi, zTo) } : { lo:Math.max(0, zFrom), hi:zTo };
        });
      }
      ["floor", "wall"].forEach(function(zone){
        var list = wall[zone] || [], starts = blockStartsMm(list, zone === "floor" ? clear : 0), af = afellaMm(walls, wi, zone);
        var floorStarts = zone === "wall" ? blockStartsMm(wall.floor || [], clear) : null;
        list.forEach(function(b, i){
          var c = CATALOG[b.type]; if (!c) return;
          var from = starts[i], to = from + b.widthMm, tall = c.cls === "tall" || !!c.fridge;
          doorLeaves(b, c).forEach(function(leaf){
            var g = null, P = Infinity, zLo = 0, why = "", blockerId = null, cornerRun = false;
            if (leaf.hinge === "left"){
              if (i === 0 && zone === "floor" && clear > 0 && prev){ if (cornerWin){ g = from - clear; P = cornerWin.hi; zLo = cornerWin.lo; why = __("skápana á {w}", { w:wl(prev.label) }); cornerRun = true; } } // the other run's fronts (their handles: below)
              else if (i === 0 && af.start > 0){ g = from; why = __("vegginn"); }
              else if (i > 0 && depthOf(list[i - 1]) > depthOf(b) + 20){ var pb = list[i - 1]; g = from - (starts[i - 1] + pb.widthMm); P = depthOf(pb) - depthOf(b); why = __("skápinn við hliðina ({a})", { a:__(CATALOG[pb.type].label).toLowerCase() }); blockerId = pb.id; }
            } else {
              if (i === list.length - 1 && af.end > 0){ g = (wall.lengthMm || 0) - to; why = __("vegginn"); }
              else if (i < list.length - 1 && depthOf(list[i + 1]) > depthOf(b) + 20){ var nb = list[i + 1]; g = starts[i + 1] - to; P = depthOf(nb) - depthOf(b); why = __("skápinn við hliðina ({a})", { a:__(CATALOG[nb.type].label).toLowerCase() }); blockerId = nb.id; }
            }
            // a wall unit beside a tall floor unit on the same wall: the tall one stands out by the depth difference
            // (the nearer blocker wins over a wall further away)
            if (zone === "wall") (wall.floor || []).forEach(function(f, fi){
              var fc = CATALOG[f.type]; if (!fc || hOf(f) < elevOf(b) + 50) return;
              var fFrom = floorStarts[fi], fTo = fFrom + f.widthMm, gap = leaf.hinge === "left" ? from - fTo : fFrom - to;
              if (gap >= -1 && gap < 100 && depthOf(f) > depthOf(b) + 20 && (g == null || gap < g)){ g = Math.max(0, gap); P = depthOf(f) - depthOf(b); zLo = 0; why = __("skápinn við hliðina ({a})", { a:__(fc.label).toLowerCase() }); blockerId = f.id; cornerRun = false; }
            });
            if (g == null || g > 400) return;
            var deg = doorMaxDeg(leaf.w, g, P, state.handle, tall, zLo);
            // inside corner: the other run's handles stand out of its fronts (somewhere out along this door, ≥ 100 mm)
            if (cornerRun && proj > 0) deg = Math.min(deg, doorMaxDeg(leaf.w, g - proj, P, state.handle, tall, Math.max(zLo, 100)));
            if (deg >= DOOR_OPEN_DEG) return;
            lim(b.id, leaf.hinge, deg);
            var handleLimits = doorMaxDeg(leaf.w, g, P, null, tall) > deg;
            if (deg < 90) out.warn.push({ msg:handleLimits
              ? __("{u}: hurðin opnast aðeins {d}° — höldurnar rekast á {why} (breiðari áfella, lamir hinum megin eða grip).", { u:nm(b, wall), d:Math.round(deg), why:why })
              : __("{u}: hurðin opnast aðeins {d}° — hún rekst á {why} (breiðari áfella eða lamir hinum megin).", { u:nm(b, wall), d:Math.round(deg), why:why }), ids:[b.id].concat(blockerId ? [blockerId] : []) });
            if (deg < 95 && (c.bur || c.leMans)) out.warn.push({ msg:__("{u}: innskúffurnar komast ekki út þegar hurðin opnast aðeins {d}°.", { u:nm(b, wall), d:Math.round(deg) }), ids:[b.id] });
          });
        });
      });
      // the dead corner: this run starts after the previous wall's cabinets, so its first cabinet stands in front
      // of the end of that wall's run — anything there that opens can't
      if (clear > 0 && prev && (wall.floor || []).length){
        var first = wall.floor[0], firstFrom = clear + (first.gapMm || 0), dC = depthOf(first), Lp = prev.lengthMm || 0;
        var pStarts = blockStartsMm(prev.floor || [], cornerClearanceMm(walls, prevIdx, "floor"));
        if (firstFrom - clear < 450) (prev.floor || []).forEach(function(pb, j){
          var pc = CATALOG[pb.type], f0 = pStarts[j], f1 = f0 + pb.widthMm;
          if (!hasOpenings(pb, pc)) return;
          var covered = Math.min(f1, Lp) - Math.max(f0, Lp - dC - (firstFrom - clear));
          if (covered <= 20) return;
          // a corner unit is fine when its door is on the half away from the corner (the end of that wall = its right)
          if (pc.cls === "corner" && pb.swing === "vinstri" && f1 - pb.widthMm / 2 <= Lp - dC + 20) return;
          out.warn.push({ msg:__("{a} opnast ekki: {b} stendur fyrir framan hann í horninu (notaðu hornskáp/Töfrahorn, blindlok eða færðu skápana).", { a:nm(pb, prev), b:nm(first, wall) }), ids:[pb.id, first.id] });
        });
        // the first cabinet's drawers slide past the other run's handles in the corner — only where there are
        // cabinets with fronts along the drawers' run (≈ 450 mm out from its front)
        var firstC = CATALOG[first.type], drawers = first.interior && first.interior.mode === "skuffur" || firstC.drawersOnly;
        var alongside = (prev.floor || []).some(function(pb, j){ var f0 = pStarts[j], f1 = f0 + pb.widthMm; return hasOpenings(pb, CATALOG[pb.type]) && Math.min(f1, Lp - dC) - Math.max(f0, Lp - dC - 450) > 20; });
        if (drawers && alongside && proj > firstFrom - clear) out.warn.push({ msg:__("{u}: skúffurnar rekast á höldurnar á {w} í horninu (bil {g}, höldur {p}).", { u:nm(first, wall), w:wl(prev.label), g:dimLen(firstFrom - clear), p:dimLen(proj) }), ids:[first.id] });
      }
    }
    return out;
  }

  // Islands: overlap with other cabinets/islands and walkways narrower than
  // 900 mm. Every wall and island is axis-aligned, so plain boxes (mm) will do.
  var WALKWAY_MM = 900;
  function islandWarnings(state, push){
    var islands = state.islands || [];
    if (!islands.length) return;
    var surf = surfacesOf(state), gs = surfaceGeoms(state);
    function bbox(cs){
      var xs = cs.map(function(p){ return p.x * 1000; }), zs = cs.map(function(p){ return p.z * 1000; });
      return { x0:Math.min.apply(null, xs), x1:Math.max.apply(null, xs), z0:Math.min.apply(null, zs), z1:Math.max.apply(null, zs) };
    }
    var boxes = surf.map(function(sf, si){
      var starts = blockStartsMm(sf.floor, cornerClearanceMm(surf, si, "floor"));
      return sf.floor.map(function(b, i){
        var c = CATALOG[b.type], bb = bbox(rectCornersWorld(gs[si], starts[i], b.widthMm, b.depthMm || c.d));
        bb.id = b.id; bb.label = c.label;
        return bb;
      });
    });
    function lineBox(g){
      return bbox([{ x:g.origin.x, z:g.origin.z }, { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM }]);
    }
    function overlap(a, b){ return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 20 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 20; }
    function dist(a, b){
      return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.z0 - b.z1, b.z0 - a.z1, 0));
    }
    islands.forEach(function(isl, ii){
      var mine = [];
      surf.forEach(function(sf, si){ if (sf.island === isl) mine = mine.concat(boxes[si]); });
      if (!mine.length) return;
      var byTarget = {}; // walkway per wall / other island: the tightest pair
      surf.forEach(function(sf, sj){
        if (sf.island === isl) return;
        if (sf.island && islands.indexOf(sf.island) < ii) return; // each island pair reported once
        var key = sf.island ? "i:" + sf.island.id : "w:" + sj;
        var name = sf.island ? sf.island.label : sf.label;
        var cands = boxes[sj].slice();
        if (!sf.island && !sf.open) cands.push(lineBox(gs[sj]));
        if (sf.open) return;
        mine.forEach(function(m){
          cands.forEach(function(o){
            if (o.id && overlap(m, o)){
              push(__("{i}: {a} skarast við {b} ({n}).", { i:__(isl.label), a:__(m.label).toLowerCase(), b:__(o.label).toLowerCase(), n:__(name) }), [m.id, o.id]);
              return;
            }
            var d = dist(m, o), cur = byTarget[key];
            if (!cur || d < cur.d) byTarget[key] = { d:d, name:name, ids:[m.id] };
          });
        });
      });
      Object.keys(byTarget).forEach(function(k){
        var t = byTarget[k];
        if (t.d < WALKWAY_MM) push(__("Aðeins {d} gangur á milli {i} og {n} — mælt er með {w} eða meira.", { d:dimLen(t.d), i:__(isl.label), n:__(t.name), w:dimLen(WALKWAY_MM) }), t.ids);
      });
    });
  }

  var ROOM_DEPTH_M = 2.4; // assumed walkway/room depth beyond each wall, for floor sizing + camera framing only

  function hasWebGL(){
    try{
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    }catch(e){ return false; }
  }

  function waitForThree(cb, timeoutMs){
    if (window.__THREE__){ cb(true); return; }
    var done = false;
    var timer = setTimeout(function(){
      if (done) return;
      done = true;
      cb(false);
    }, timeoutMs || 6000);
    window.addEventListener("three-ready", function onReady(){
      if (done) return;
      done = true;
      clearTimeout(timer);
      cb(true);
    }, { once:true });
  }

  // ---------- interior bounding box (for floor sizing + camera/plan framing) ----------
  function interiorBounds(geoms, depthM, extra){
    var D = depthM || ROOM_DEPTH_M;
    var minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    (extra || []).forEach(function(p){
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    });
    geoms.forEach(function(g){
      var end = { x:g.origin.x + g.axis.x*g.lenM, z:g.origin.z + g.axis.z*g.lenM };
      if (geoms.closed){ // a closed room IS its outline — nothing to guess beyond it
        [g.origin, end].forEach(function(p){
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        });
        return;
      }
      // Each wall's endpoints AND those endpoints pushed into the room along
      // the wall's own normal — must only grow on the interior side of a
      // wall, never symmetrically through it.
      [g.origin, end,
       { x:g.origin.x + g.normal.x*D, z:g.origin.z + g.normal.z*D },
       { x:end.x + g.normal.x*D, z:end.z + g.normal.z*D }
      ].forEach(function(p){
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      });
    });
    return { minX:minX, maxX:maxX, minZ:minZ, maxZ:maxZ };
  }

  // ============================================================
  // 3D scene
  // ============================================================

  // floor + camera framing bounds: the walls' interior plus every island with a walkway around it
  function stateBounds(state, geoms){
    var extra = [];
    (geoms.closed ? [] : (state.islands || [])).forEach(function(isl){ // a closed room already contains its islands
      var f = islandFrame(isl), h = isl.lengthMm / 2000 + 0.6, cx = isl.xMm / 1000, cz = isl.zMm / 1000;
      [-1, 1].forEach(function(a){ [-1, 1].forEach(function(n){
        extra.push({ x:cx + f.axis.x * h * a + f.normal.x * 1.3 * n, z:cz + f.axis.z * h * a + f.normal.z * 1.3 * n });
      }); });
    });
    return interiorBounds(geoms, ROOM_DEPTH_M, extra);
  }

  function addFloor(THREE, scene, geoms, floorMat, b){
    var margin = geoms.closed ? 0 : 0.3;
    var w = (b.maxX - b.minX) + margin * 2, d = (b.maxZ - b.minZ) + margin * 2;
    var cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    if (geoms.closed && geoms.length >= 3){ // floor follows the room outline (planks in world units: 1 uv = 1 m)
      var shape = new THREE.Shape();
      geoms.forEach(function(g, i){ if (i === 0) shape.moveTo(g.origin.x, -g.origin.z); else shape.lineTo(g.origin.x, -g.origin.z); });
      shape.closePath();
      var fm = floorMat.clone();
      fm.side = THREE.DoubleSide;
      if (floorMat.map && floorMat.userData.tile){
        fm.map = floorMat.map; fm.bumpMap = floorMat.bumpMap; fm.roughnessMap = floorMat.roughnessMap; // shared, kept textures
        [floorMat.map, floorMat.bumpMap, floorMat.roughnessMap].forEach(function(t){ if (t) t.repeat.set(1 / floorMat.userData.tile, 1 / floorMat.userData.tile); });
      }
      var pm = new THREE.Mesh(new THREE.ShapeGeometry(shape), fm);
      pm.rotation.x = -Math.PI / 2;
      pm.receiveShadow = true;
      scene.add(pm);
      return { cx:cx, cz:cz, w:w, d:d };
    }
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    if (floorMat.map && floorMat.userData.tile){ // one 2 m tile of oak planks, repeated to the room size
      var rx = w / floorMat.userData.tile, ry = d / floorMat.userData.tile;
      [floorMat.map, floorMat.bumpMap, floorMat.roughnessMap].forEach(function(t){ if (t) t.repeat.set(rx, ry); });
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { cx:cx, cz:cz, w:w, d:d };
  }

  var WALL_THICKNESS_M = 0.08;

  // `gaps` (optional): [{offM, widM, hM}] openings with no door — the wall is built
  // in pieces (left of the gap, the header above it, right of it) so it is a real hole.
  function addWallPlane(THREE, scene, geom, wallHeightM, wallMat, gaps){
    // A real (thin) box instead of a zero-thickness plane — a flat plane
    // viewed edge-on shrinks to a literal zero-width line, which read as a
    // "glitchy" flickering wall from some camera angles. The box's inner
    // (room-facing) surface stays exactly on the wall line; thickness
    // extends outward so cabinet placement (which assumes offset 0 = the
    // wall line) is unaffected.
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var wq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    // wall pieces: [from, to, bottom, top] along the wall / up the wall
    var pieces = [], pos = 0;
    (gaps || []).slice().sort(function(a, b){ return a.offM - b.offM; }).forEach(function(gp){
      var a = Math.max(pos, gp.offM), b = Math.min(geom.lenM, gp.offM + gp.widM);
      if (b - a < 0.01) return;
      if (a > pos + 0.001) pieces.push([pos, a, 0, wallHeightM]);
      if (gp.loM > 0.01) pieces.push([a, b, 0, gp.loM]);                        // wall under a window (2026-10-23: windows are real holes now)
      if (gp.hM < wallHeightM - 0.01) pieces.push([a, b, gp.hM, wallHeightM]); // header over the opening
      pos = b;
    });
    if (geom.lenM > pos + 0.001) pieces.push([pos, geom.lenM, 0, wallHeightM]);
    if (geom.extEndM) pieces.forEach(function(pc){ if (Math.abs(pc[1] - geom.lenM) < 0.001) pc[1] += geom.extEndM; }); // close the outer corner (see wallGeometry3D)
    var mesh = null;
    // The room face sits 1.5 mm BEHIND the wall line: cabinet backs and the
    // skirting stand exactly on the line, and a shared plane made them z-fight
    // with the wall (flickering backs, worst through a faded wall).
    var back = WALL_THICKNESS_M / 2 + 0.0015;
    pieces.forEach(function(pc){
      var bgeo = new THREE.BoxGeometry(pc[1] - pc[0], pc[3] - pc[2], WALL_THICKNESS_M);
      if (wallMat.userData && wallMat.userData.tileWall){ var tw = wallMat.userData.tileWall; scaleFrontUV(bgeo, pc[1] - pc[0], pc[3] - pc[2], { w:tw, h:tw }, false, { u:pc[0], v:pc[2] }); } // tiles at real size, lined up across the pieces
      var m = new THREE.Mesh(bgeo, wallMat);
      m.quaternion.copy(wq);
      var mid = (pc[0] + pc[1]) / 2;
      m.position.set(geom.origin.x + geom.axis.x * mid - geom.normal.x * back, (pc[2] + pc[3]) / 2, geom.origin.z + geom.axis.z * mid - geom.normal.z * back);
      m.receiveShadow = true;
      m.castShadow = false; // shadows come from the room's shadow shell (addSunShell), which has the window holes
      scene.add(m);
      if (!mesh) mesh = m;
    });
    return mesh;
  }

  // Sunlight through a window (visual pass 3, 2026-10-06). The visible walls fade and have no holes for windows,
  // so shadows come from an invisible shell instead: every solid wall with real openings for its windows (and plain
  // openings), plus a ceiling. colorWrite/depthWrite off = it never shows, it only casts. The key light then becomes a
  // low, warm sun outside the biggest window, so a bright patch of window light falls across the floor and units.
  function addSunShell(THREE, scene, state, geoms, wallH, isOpenGeom, bbox){
    var mat = new THREE.MeshBasicMaterial({ colorWrite:false, depthWrite:false });
    var T = 0.12;
    geoms.forEach(function(g, gi){
      if (isOpenGeom(gi)) return;
      var wid = state.walls[gi] && state.walls[gi].id;
      var holes = (state.windows || []).filter(function(o){ return o.wallId === wid; }).map(function(o){ return { a:o.offsetMm / 1000, b:(o.offsetMm + o.widthMm) / 1000, lo:o.sillHeightMm / 1000, hi:(o.sillHeightMm + o.heightMm) / 1000 }; })
        .concat((state.doors || []).filter(function(d){ return d.gap && d.wallId === wid; }).map(function(d){ return { a:d.offsetMm / 1000, b:(d.offsetMm + d.widthMm) / 1000, lo:0, hi:d.heightMm / 1000 }; }))
        .sort(function(x, y){ return x.a - y.a; });
      var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      function piece(a, b, lo, hi){
        if (b - a < 0.005 || hi - lo < 0.005) return;
        var m = new THREE.Mesh(new THREE.BoxGeometry(b - a, hi - lo, T), mat);
        var mid = (a + b) / 2;
        m.position.set(g.origin.x + g.axis.x * mid - g.normal.x * (T / 2 + 0.01), (lo + hi) / 2, g.origin.z + g.axis.z * mid - g.normal.z * (T / 2 + 0.01));
        m.quaternion.copy(q); m.castShadow = true; m.receiveShadow = false; m.userData.sunShell = true;
        scene.add(m);
      }
      var pos = -0.2; // run past the corners so no light leaks there
      holes.forEach(function(h){
        piece(pos, h.a, 0, wallH + 0.15);
        piece(h.a, h.b, 0, h.lo); piece(h.a, h.b, h.hi, wallH + 0.15);
        pos = h.b;
      });
      piece(pos, g.lenM + 0.2, 0, wallH + 0.15);
    });
    var lid = new THREE.Mesh(new THREE.BoxGeometry(bbox.w + 1, 0.1, bbox.d + 1), mat);
    lid.position.set(bbox.cx, wallH + 0.06, bbox.cz); lid.castShadow = true; lid.userData.sunShell = true; scene.add(lid);
  }
  // the biggest window on a solid wall: { center, normal (into the room), axis, w, h } or null
  function sunWindow(state, geoms, isOpenGeom){
    var best = null;
    (state.windows || []).forEach(function(o){
      var gi = state.walls.findIndex(function(w){ return w.id === o.wallId; });
      if (gi < 0 || isOpenGeom(gi)) return;
      var g = geoms[gi], area = o.widthMm * o.heightMm;
      if (best && best.area >= area) return;
      var along = (o.offsetMm + o.widthMm / 2) / 1000;
      best = { area:area, g:g, center:{ x:g.origin.x + g.axis.x * along, y:(o.sillHeightMm + o.heightMm / 2) / 1000, z:g.origin.z + g.axis.z * along }, w:o.widthMm / 1000, h:o.heightMm / 1000 };
    });
    return best;
  }

  // Window/door markers (Phase 7e) — a flat panel on the wall's inner face
  // rather than a true cut hole (no CSG boolean ops in vanilla Three.js;
  // matches this module's existing "simple textured boxes, not full
  // realism" approach used for cabinets/handles throughout). `baseYM` is
  // where the opening starts (sill height for a window, 0 for a door).
  var WINDOW_MARKER_COLOR = 0xa9c6d6, DOOR_MARKER_COLOR = 0x8a6a4a;
  // Veggur merkingar — one accent colour that reads on both the light and the PRO dark elevation, a short symbol set
  var ANNO_COLOR = "#e8590c";
  var ANNO_SYMBOLS = {
    innstunga:{ glyph:"⏚", label:"Innstunga" }, rofi:{ glyph:"⊘", label:"Rofi" }, ljos:{ glyph:"✦", label:"Ljós" },
    vatn:{ glyph:"≋", label:"Vatn / frárennsli" }, net:{ glyph:"⌁", label:"Net / loftnet" }, tafla:{ glyph:"▦", label:"Rafmagnstafla" },
    athuga:{ glyph:"!", label:"Athuga" }
  };
  function escSvg(t){ return String(t).replace(/[&<>"]/g, function(ch){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[ch]; }); }
  function addOpeningMarker(THREE, scene, geom, offsetM, widthM, heightM, baseYM, color, opacity, meta, selected, pickables){
    var isWin = meta && meta.kind === "window";
    var isGap = !!(meta && meta.gap); // a plain opening in the wall: no door leaf, the wall itself has the hole
    var mat = isGap
      ? new THREE.MeshBasicMaterial({ color:SELECT_COLOR, transparent:true, opacity:selected ? 0.25 : 0, depthWrite:false, side:THREE.DoubleSide })
      : isWin
      ? new THREE.MeshBasicMaterial({ color:selected ? 0xc9d4f4 : 0xf2f6f9, transparent:true, opacity:0.95, side:THREE.DoubleSide, toneMapped:false }) // daylight outside: the window reads as the bright light source it is; dusk blue in the evening (applyMood)
      : new THREE.MeshStandardMaterial({ color:0xd9d2c4, roughness:0.55, transparent:true, opacity:1, side:THREE.DoubleSide });
    if (selected && !isGap && !isWin){ mat.emissive = new THREE.Color(SELECT_COLOR); mat.emissiveIntensity = 0.55; }
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    // Just proud of the wall's inner (room-facing) face — avoids z-fighting
    // without needing to cut real geometry.
    var frontOut = 0.005;
    mesh.position.set(cx + geom.normal.x * frontOut, baseYM + heightM / 2, cz + geom.normal.z * frontOut);
    // Same group-per-object shape as cabinets so a 3D drag can move it; the
    // plane is pickable, so windows/doors select and drag like cabinets.
    if (meta) mesh.userData = meta;
    var group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    if (pickables && meta) pickables.push(mesh);
    if (isWin) mat.userData.studio = "glass";
    if (isWin && !selected){ // brighter than white: the post-processing tone maps the whole frame, so daylight needs headroom
      mat.color.setRGB(1.8, 1.86, 1.95); mat.userData.day = mat.color.clone(); (scene.userData.windowGlass = scene.userData.windowGlass || []).push(mat);
    }

    // Frame, sill / door leaf detail — all children of the same group, so a
    // drag or selection treats the opening as one object.
    var isDoor = meta && meta.kind === "door";
    var frameMat = new THREE.MeshStandardMaterial({ color:0xf2f0ea, roughness:0.5 });
    function at(along, y, out){
      return new THREE.Vector3(geom.origin.x + geom.axis.x * (offsetM + widthM / 2 + along) + geom.normal.x * out, y,
        geom.origin.z + geom.axis.z * (offsetM + widthM / 2 + along) + geom.normal.z * out);
    }
    var q = mesh.quaternion, fw = 0.055, fo = 0.03;
    function bar(w, h, d, along, y, out, mat){
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || frameMat);
      m.position.copy(at(along, y, out)); m.quaternion.copy(q); m.castShadow = true; group.add(m); return m;
    }
    if (isGap){ // reveals lining the hole through the wall thickness
      var rv = -(WALL_THICKNESS_M / 2 + 0.0015);
      bar(widthM, 0.012, WALL_THICKNESS_M, 0, baseYM + heightM - 0.006, rv);
      bar(0.012, heightM, WALL_THICKNESS_M, -(widthM / 2 - 0.006), baseYM + heightM / 2, rv);
      bar(0.012, heightM, WALL_THICKNESS_M, widthM / 2 - 0.006, baseYM + heightM / 2, rv);
      return group;
    }
    if (isWin){ // a real window in a real hole (2026-10-23): reveal boards, a deep outer frame, opening sashes with handles, glass set back, a sill
      var depthIn = -(WALL_THICKNESS_M * 0.55);                                     // the frame's plane, inside the wall
      mesh.position.set(cx + geom.normal.x * (depthIn - 0.012), baseYM + heightM / 2, cz + geom.normal.z * (depthIn - 0.012)); // glass, set back
      var revealMat = new THREE.MeshStandardMaterial({ color:0xf3f2ee, roughness:0.85 });
      // reveal: lines the hole through the wall, its room edge 4 mm back from the wall face (a 1.5 mm lip proud of the
      // wall read as a dashed stripe — shadow/AO noise on a sliver)
      var rd = WALL_THICKNESS_M - 0.004, rc = -(0.0055 + rd / 2);
      // 1 mm in from the hole's edge: flush with the wall's own end faces they z-fought (striped shadow line)
      [bar(widthM - 0.002, 0.012, rd, 0, baseYM + heightM - 0.007, rc, revealMat),
       bar(0.012, heightM - 0.002, rd, -(widthM / 2 - 0.007), baseYM + heightM / 2, rc, revealMat),
       bar(0.012, heightM - 0.002, rd, widthM / 2 - 0.007, baseYM + heightM / 2, rc, revealMat)].forEach(function(m){ m.castShadow = false; }); // a reveal's shadow on its own wall edge = acne stripes
      var ofw = 0.055, ofd = 0.07;                                                    // outer frame (karmur): 55 × 70 mm
      bar(widthM - 0.024, ofw, ofd, 0, baseYM + heightM - 0.012 - ofw / 2, depthIn);
      bar(widthM - 0.024, ofw, ofd, 0, baseYM + 0.012 + ofw / 2, depthIn);
      bar(ofw, heightM - 0.024, ofd, -(widthM / 2 - 0.012 - ofw / 2), baseYM + heightM / 2, depthIn);
      bar(ofw, heightM - 0.024, ofd, widthM / 2 - 0.012 - ofw / 2, baseYM + heightM / 2, depthIn);
      var leaves = widthM > 0.9 ? 2 : 1, innerW = widthM - 0.024 - 2 * ofw, innerH = heightM - 0.024 - 2 * ofw, lw = innerW / leaves, sw = 0.045, sd = 0.05;
      var handleMatW = new THREE.MeshStandardMaterial({ color:0xe8e9ea, metalness:0.6, roughness:0.3 });
      for (var li = 0; li < leaves; li++){                                            // sashes (opnanleg fög), each with a handle on its latch side
        var lc = -innerW / 2 + lw * (li + 0.5), ly = baseYM + heightM / 2, lz = depthIn + 0.008;
        bar(lw - 0.004, sw, sd, lc, ly + innerH / 2 - sw / 2, lz);
        bar(lw - 0.004, sw, sd, lc, ly - innerH / 2 + sw / 2, lz);
        bar(sw, innerH, sd, lc - lw / 2 + sw / 2 + 0.002, ly, lz);
        bar(sw, innerH, sd, lc + lw / 2 - sw / 2 - 0.002, ly, lz);
        var latch = leaves === 2 ? (li === 0 ? 1 : -1) : 1;
        bar(0.016, 0.12, 0.022, lc + latch * (lw / 2 - sw / 2 - 0.002), ly, lz + sd / 2 + 0.011, handleMatW); // handle
      }
      bar(widthM + 0.06, 0.025, WALL_THICKNESS_M + 0.045, 0, baseYM - 0.0125, -WALL_THICKNESS_M / 2 + 0.0225); // sill board: through the hole + 4.5 cm into the room
    } else if (isDoor){
      // A real interior door (owner, 2026-10-28: the old one was a flat plane with three bars): a 40 mm slab set in the
      // hole with a hairline gap, reveal boards through the wall, a flat architrave round it, three hinges and a lever
      // with its rose. The plane above stays as the invisible pick surface; a selection tints the slab.
      var Tw = WALL_THICKNESS_M, rvD = -(Tw / 2 + 0.0015);
      var leafMat = new THREE.MeshStandardMaterial({ color:0xeeebe4, roughness:0.5 });
      if (selected){ leafMat.emissive = new THREE.Color(SELECT_COLOR); leafMat.emissiveIntensity = 0.35; }
      var gapMat = new THREE.MeshStandardMaterial({ color:0x3b3a37, roughness:0.9 });
      mat.visible = false;                                                           // pick only
      bar(widthM - 0.004, heightM - 0.004, 0.012, 0, baseYM + heightM / 2, -Tw + 0.002, gapMat).castShadow = false; // the dark gap behind the slab
      var slab = bar(widthM - 0.012, heightM - 0.01, 0.04, 0, baseYM + 0.004 + (heightM - 0.01) / 2, -0.03, leafMat); slab.receiveShadow = true;
      [bar(widthM, 0.012, Tw, 0, baseYM + heightM - 0.006, rvD, frameMat),
       bar(0.012, heightM, Tw, -(widthM / 2 - 0.006), baseYM + heightM / 2, rvD, frameMat),
       bar(0.012, heightM, Tw, widthM / 2 - 0.006, baseYM + heightM / 2, rvD, frameMat)].forEach(function(m){ m.castShadow = false; });
      var cw = 0.07, cd = 0.014;                                                     // architrave: flat, 70 × 14 mm, with a thin bead inside it
      bar(widthM + 2 * cw, cw, cd, 0, baseYM + heightM + cw / 2, cd / 2);
      bar(cw, heightM + cw, cd, -(widthM / 2 + cw / 2), baseYM + (heightM + cw) / 2, cd / 2);
      bar(cw, heightM + cw, cd, widthM / 2 + cw / 2, baseYM + (heightM + cw) / 2, cd / 2);
      // two shallow raised panels on the slab, so the door reads as a door and not a white rectangle
      var pnMat = new THREE.MeshStandardMaterial({ color:0xe2dccf, roughness:0.55 }), pm = 0.1, pbw = 0.022, pdp = 0.008;
      [[0.09, 0.44], [0.58, 0.9]].forEach(function(pr){
        var y0p = baseYM + heightM * pr[0], y1p = baseYM + heightM * pr[1], hp = y1p - y0p, wp = widthM - 2 * pm - 0.012, cyp = (y0p + y1p) / 2;
        bar(wp, pbw, pdp, 0, y1p - pbw / 2, -0.006, pnMat); bar(wp, pbw, pdp, 0, y0p + pbw / 2, -0.006, pnMat);
        bar(pbw, hp, pdp, -(wp / 2 - pbw / 2), cyp, -0.006, pnMat); bar(pbw, hp, pdp, wp / 2 - pbw / 2, cyp, -0.006, pnMat);
      });
      var latchS = meta.hingeRight ? -1 : 1, metalMat = new THREE.MeshStandardMaterial({ color:0x8d9094, metalness:0.85, roughness:0.3 });
      [0.22, heightM / 2, heightM - 0.22].forEach(function(hy){ var hg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 12), metalMat);
        hg.position.copy(at(-latchS * (widthM / 2 - 0.004), baseYM + hy, -0.008)); hg.castShadow = true; group.add(hg); });
      var hx = latchS * (widthM / 2 - 0.075), hy0 = baseYM + 1.0;
      var rose = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 24), metalMat);
      rose.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      rose.position.copy(at(hx, hy0, -0.004)); rose.castShadow = true; group.add(rose);
      bar(0.018, 0.018, 0.034, hx, hy0, 0.013, metalMat);                            // the stem
      bar(0.13, 0.018, 0.018, hx - latchS * 0.055, hy0, 0.03, metalMat);             // the lever, pointing along the door
    } else {
    bar(widthM, fw, 0.05, 0, baseYM + heightM - fw / 2, fo);                       // head
    bar(fw, heightM, 0.05, -(widthM / 2 - fw / 2), baseYM + heightM / 2, fo);      // left jamb
    bar(fw, heightM, 0.05, widthM / 2 - fw / 2, baseYM + heightM / 2, fo);         // right jamb
    }
    return group;
  }

  function addDrawerSeams(THREE, scene, geom, offsetM, widthM, heightM, baseYM, depthM, count, fractions){
    if (!count || count < 2) return;
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    var seamMat = new THREE.MeshBasicMaterial({ color:0x2a2a2a, side:THREE.DoubleSide });
    var frontOut = depthM + 0.004; // just proud of the front face, avoids z-fighting
    for (var i = 1; i < count; i++){
      var y = baseYM + heightM * (fractions && fractions[i - 1] != null ? fractions[i - 1] : i / count);
      var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * frontOut;
      var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * frontOut;
      var seam = new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat); // the gap between two fronts: edge to edge, hairline thin
      seam.position.set(cx, y, cz);
      seam.quaternion.copy(quat);
      scene.add(seam);
    }
  }

  var SELECT_COLOR = 0x3d61c1;
  var WARN_COLOR = 0xd9822b; // outline of a cabinet/opening the fit check flagged

  // ---------- optional real models (.glb) — see kitchen-planner-models.js ----------
  var MODEL_CACHE = {}; // url -> {state:"loading"|"ready"|"error", obj}
  function modelEntry(kind, key){
    var m = window.KPMODELS && window.KPMODELS[kind] && window.KPMODELS[kind][key];
    return m && m.file ? m : null;
  }
  // load a .glb or .dae (Blum's CAD download) -> done(sceneRoot) / fail()
  function loadRaw(file, done, fail){
    var dae = /\.dae(\?|$)/i.test(file);
    import(dae ? "three/addons/loaders/ColladaLoader.js" : "three/addons/loaders/GLTFLoader.js").then(function(mod){
      new (dae ? mod.ColladaLoader : mod.GLTFLoader)().load(file, function(res){ done(res.scene); }, undefined, fail);
    }).catch(fail);
  }
  // -> a normalised clone (bottom at y=0, centred on x/z, front at +z side) or null while it loads / when none exists
  function getModel(kind, key){
    var e = modelEntry(kind, key);
    if (!e) return null;
    var c = MODEL_CACHE[e.file];
    if (!c){
      c = MODEL_CACHE[e.file] = { state:"loading", obj:null };
      loadRaw(e.file, function(root){
        c.obj = normaliseModel(root, e); c.state = "ready";
        window.dispatchEvent(new Event("kp3d-model-loaded"));
      }, function(){ c.state = "error"; });
    }
    return c.state === "ready" ? c.obj.clone(true) : null;
  }
  // models still downloading (drawing export waits for 0 before it takes a picture)
  function modelsPending(){
    var n = IMG_PENDING; // photo textures too: a drawing taken mid-load had plain-colour fronts
    [MODEL_CACHE, RAW_CACHE].forEach(function(c){ Object.keys(c).forEach(function(k){ if (c[k].state === "loading") n++; }); });
    return n;
  }
  // Warm what a pick will need while the pointer is still on its tile (studio-load, 2026-10-26): a handle's model, a
  // front's or worktop's photo. The click then shows the real thing instead of the drawn stand-in / plain colour.
  function preload(kind, key){
    var THREE = window.__THREE__; if (!THREE || !key) return;
    if (kind === "handle"){ var h = window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[key]; if (h && h.file) rawModel(h.file); }
    else if (kind === "look"){ var l = LOOKS[key]; if (l && l.tex) imgTex(THREE, l.tex, l.color3d); }
    else if (kind === "top"){ var t = TOPS[key]; if (t && t.tex) imgTex(THREE, t.tex, t.color3d); }
  }
  // A model in its own coordinates (Blum parts are positioned relative to one another, so
  // they must NOT be re-centred), with its Phong materials turned into standard ones.
  var RAW_CACHE = {};
  function rawModel(file, recolor){
    var key = file + "|" + (recolor || ""), c = RAW_CACHE[key];
    if (!c){
      c = RAW_CACHE[key] = { state:"loading", obj:null };
      loadRaw(file, function(root){
        var THREE = window.__THREE__;
        root.traverse(function(o){
          if (!o.isMesh) return;
          var conv = function(m){
            var metal = /zinc|steel|chrom|alu/i.test(m.name || ""), col = m.color ? m.color.clone() : new THREE.Color(0xcccccc);
            if (recolor === "white" && !metal && col.r < 0.3 && col.g < 0.3) col.setRGB(0.8637, 0.8637, 0.8155); // dark grey part -> Blum's own silk white
            return new THREE.MeshStandardMaterial({ color:col, metalness:metal ? 0.7 : 0.06, roughness:metal ? 0.38 : 0.5 });
          };
          o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
          o.castShadow = true; o.receiveShadow = true;
        });
        var b = new THREE.Box3().setFromObject(root), sz = b.getSize(new THREE.Vector3());
        if (Math.max(sz.x, sz.y, sz.z) > 4) root.scale.multiplyScalar(0.001); // still in millimetres
        // x-range of the side wall's top edge (the thin vertical plate), so bottom/back can be fitted between two walls
        root.updateMatrixWorld(true);
        var v = new THREE.Vector3(), tops = [], maxY = -1e9;
        root.traverse(function(o){
          if (!o.isMesh || !o.geometry.attributes.position) return;
          var pa = o.geometry.attributes.position;
          for (var i = 0; i < pa.count; i++){ v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); tops.push(v.x, v.y); if (v.y > maxY) maxY = v.y; }
        });
        var x0 = 1e9, x1 = -1e9;
        for (var t = 0; t < tops.length; t += 2){ if (tops[t + 1] > maxY - 0.0015){ x0 = Math.min(x0, tops[t]); x1 = Math.max(x1, tops[t]); } }
        root.userData.wall = { x0:x0, x1:x1 };
        c.obj = root; c.state = "ready";
        window.dispatchEvent(new Event("kp3d-model-loaded"));
      }, function(){ c.state = "error"; });
    }
    return c.state === "ready" ? c.obj.clone(true) : null;
  }
  // A real handle in its own frame: x along the front (centred), y up, z out of the front (0 = the plane it sits on).
  // kind "jey": y = 0 at its TOP edge and it extends downwards. lenM stretches it along x. Returns null until loaded.
  function handleProfile(THREE, key, lenM, frontMat){
    var cfg = window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[key];
    if (!cfg || !cfg.file) return null;
    var raw = rawModel(cfg.file);
    if (!raw) return null;
    var A = { x:0, y:1, z:2 }, rows = (cfg.map || ["x", "y", "z"]).map(function(t){ var r = [0, 0, 0]; r[A[t.replace("-", "")]] = t.charAt(0) === "-" ? -1 : 1; return r; });
    if (cfg.growBar){ // the light bar shares its surface with a dark core / the brackets → z-fighting (Crossing, 2026-10-11):
      // make it a hair thicker across its length so it cleanly covers them
      raw.traverse(function(o){
        if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.color) return;
        var col = o.material.color; if (col.r + col.g + col.b < 0.9) return; // only the light (wooden) part
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        var bb = o.geometry.boundingBox, sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
        var longAx = sz.x >= sz.y && sz.x >= sz.z ? "x" : sz.y >= sz.z ? "y" : "z", k = cfg.growBar;
        var sc = new THREE.Vector3(longAx === "x" ? 1 : k, longAx === "y" ? 1 : k, longAx === "z" ? 1 : k);
        var d = new THREE.Vector3(c.x * (1 - sc.x), c.y * (1 - sc.y), c.z * (1 - sc.z)).multiply(o.scale).applyQuaternion(o.quaternion);
        o.position.add(d); o.scale.multiply(sc);
      });
    }
    var w = new THREE.Group();
    w.add(raw);
    w.applyMatrix4(new THREE.Matrix4().set(rows[0][0], rows[0][1], rows[0][2], 0, rows[1][0], rows[1][1], rows[1][2], 0, rows[2][0], rows[2][1], rows[2][2], 0, 0, 0, 0, 1));
    w.updateMatrixWorld(true);
    if (cfg.take || cfg.dropFlat || cfg.posts){ // pick / assemble parts of a model that holds more than one handle
      var ms = []; w.traverse(function(o){ if (o.isMesh) ms.push(o); });
      if (cfg.take) ms = ms.slice(cfg.skip || 0, (cfg.skip || 0) + cfg.take);
      if (cfg.dropFlat) ms = ms.filter(function(m){ var sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()); return Math.min(sz.x, sz.y, sz.z) > 1e-4; });
      var baked = ms.map(function(m){ var gm = m.geometry.clone(); gm.applyMatrix4(m.matrixWorld); gm.computeBoundingBox(); return new THREE.Mesh(gm, m.material); });
      if (cfg.posts && baked.length > 2){ // one bar + mounting posts: keep the two END posts and fit the bar to the wanted length
        var bi = 0; baked.forEach(function(m, i){ if (m.geometry.boundingBox.getSize(new THREE.Vector3()).x > baked[bi].geometry.boundingBox.getSize(new THREE.Vector3()).x) bi = i; });
        var bar = baked[bi], bb = bar.geometry.boundingBox, barLen = bb.max.x - bb.min.x, posts = baked.filter(function(m, i){ return i !== bi; });
        posts.sort(function(p1, p2){ return p1.geometry.boundingBox.min.x - p2.geometry.boundingBox.min.x; });
        var first = posts[0], last = posts[posts.length - 1], kL = lenM ? lenM / barLen : 1;
        if (lenM){ bar.geometry.translate(-bb.min.x, 0, 0); bar.geometry.scale(kL, 1, 1); bar.geometry.translate(bb.min.x, 0, 0); last.geometry.translate(lenM - barLen, 0, 0); }
        baked = [bar, first, last]; lenM = null; // already at the right length
      }
      var w2 = new THREE.Group(); baked.forEach(function(m){ w2.add(m); });
      w = w2; w.updateMatrixWorld(true);
    }
    var b = new THREE.Box3().setFromObject(w), c = b.getCenter(new THREE.Vector3());
    w.position.set(-c.x, cfg.kind === "jey" || cfg.kind === "topmount" ? -b.max.y : -c.y, -b.min.z);
    if (cfg.matchFront && frontMat){ // Spónagrip: clad in the front's own material (colour + wood texture), not a fixed finish — matches "frontaefnisklæðning" (2026-09-29)
      w.traverse(function(o){ if (o.isMesh){ o.material = frontMat.clone(); if (o.material.roughness != null) o.material.roughness = Math.min(1, o.material.roughness + 0.08); o.material.needsUpdate = true; } });
    } else if (handleFinish){
      w.traverse(function(o){ if (o.isMesh){ o.material = o.material.clone(); o.material.color.set(handleFinish.hex); o.material.metalness = handleFinish.metal; o.material.roughness = handleFinish.rough; if (o.material.map) o.material.map = null; o.material.needsUpdate = true; } });
    } else if (cfg.color){
      w.traverse(function(o){ if (o.isMesh){ o.material = o.material.clone(); o.material.color.set(cfg.color); o.material.metalness = 0.55; o.material.roughness = 0.4; } });
    }
    var g = new THREE.Group(), inner = new THREE.Group();
    inner.add(w);
    if (lenM) inner.scale.x = lenM / Math.max(1e-6, b.max.x - b.min.x);
    g.add(inner);
    g.userData.size = { len:lenM || (b.max.x - b.min.x), h:b.max.y - b.min.y, d:b.max.z - b.min.z };
    if (cfg.kind !== "jey") HANDLE_PROJ[key] = Math.round((b.max.z - b.min.z) * 1000 - (cfg.embedMm || 0)); // how far it stands out (openingIssues)
    return g;
  }
  // The largest of a handle's real orderable lengths (`cfg.lenOptions`, mm + Vörulisti id) that still fits
  // `availM` metres, falling back to the shortest option if even that doesn't fit — every length this ever
  // returns is a real, orderable product, never an invented size (2026-09-28: "sýnir bara það sem er til").
  // A handle with no `lenOptions` (Vann — not a real Vörulisti product yet) falls back to its plain `lenMm`.
  function pickHandleLenM(cfg, availM){
    if (!cfg.lenOptions || !cfg.lenOptions.length) return (cfg.lenMm || 200) / 1000;
    var ms = cfg.lenOptions.map(function(o){ return o.mm / 1000; }).sort(function(a, b){ return a - b; });
    var fits = ms.filter(function(m){ return m <= Math.max(0, availM); });
    return fits.length ? fits[fits.length - 1] : ms[0];
  }
  // the two real drawer sides (left/right) for this system + height code + colour, or null
  function realSides(sysKey, code, dark){
    var e = window.KPMODELS && window.KPMODELS.drawerSides && window.KPMODELS.drawerSides[sysKey + "_" + code];
    var v = e && e[dark ? "dark" : "white"];
    if (!v) return null;
    // Blum's "L" file (x < 0) is the side that belongs on the RIGHT of the drawer and "R" on the left:
    // that way the bottom foot points inwards under the drawer bottom
    var left = rawModel(v.R, v.recolor), right = rawModel(v.L, v.recolor);
    var rn = window.KPMODELS.runners && window.KPMODELS.runners[sysKey], runL = null, runR = null;
    if (rn){
      runL = rawModel(rn.R); runR = rawModel(rn.L); // same pairing as the sides
      if (!runL || !runR) return null; // wait until everything is loaded so the drawer doesn't change look
    }
    return left && right ? { left:left, right:right, runLeft:runL, runRight:runR, e:e } : null;
  }
  function normaliseModel(root, e){
    var THREE = window.__THREE__, wrap = new THREE.Group();
    wrap.add(root);
    if (e.rot) root.rotation.set((e.rot[0] || 0) * Math.PI / 180, (e.rot[1] || 0) * Math.PI / 180, (e.rot[2] || 0) * Math.PI / 180);
    if (e.mirrorX) root.scale.x *= -1;
    var box = new THREE.Box3().setFromObject(wrap), size = box.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > 4) wrap.scale.setScalar(0.001); // exported in millimetres
    box.setFromObject(wrap);
    var ctr = box.getCenter(new THREE.Vector3());
    root.position.set(-ctr.x, -box.min.y, -ctr.z);
    var out = new THREE.Group(); out.add(wrap);
    wrap.traverse(function(o){ if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    return out;
  }

  // Door seams + handles on a cabinet front (2026-09-19) so cabinets read as
  // cabinets instead of plain boxes. Handle style follows the customer's
  // chosen opening (HANDLES key): a bar (ona), a full-width profile (jey2 /
  // hexxa), a knob (arpa), or a milled groove (fraest); push-open (push)
  // shows no hardware. Fronts: drawers → equal rows, tall unit → two doors,
  // anything else → one door. Purely visual — nothing here is submitted.
  // Handles, seams and grips drawn on a front are tagged (__frontDetail) so "fronts off" can hide them
  // with the fronts. Oven glass/controls are an appliance, not a front: left alone.
  // A door front split into 2–3 stacked fronts in Smíða: splitFr = the seams as fractions of the body, bottom → top.
  function pushSplitFronts(fronts, splitFr){
    var edges = [0].concat(splitFr, [1]);
    for (var i = 0; i < edges.length - 1; i++) fronts.push({ y0:edges[i], y1:edges[i + 1] });
  }
  // Smíða's split (slots in mm, top → bottom) → seams as fractions of the body, bottom → top; null when not split.
  function splitFractions(b, bodyMm){
    var sp = b && b.smida && b.smida.split;
    if (!sp || sp.length < 2 || !bodyMm) return null;
    var out = [], acc = 0, up = sp.slice().reverse();
    up.slice(0, -1).forEach(function(h){ acc += h; out.push(acc / bodyMm); });
    return out;
  }
  function addFrontDetails(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta, frontMat){
    var n0 = group.children.length;
    addFrontDetailsInner.apply(null, arguments);
    if (meta && meta.oven) return;
    group.children.slice(n0).forEach(function(o){ o.__frontDetail = true; });
  }
  function addFrontDetailsInner(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta, frontMat){
    // An open cabinet (Fataskápar's "Opinn skápur") has no door — but it can still have a real drawer
    // stack at the bottom, zoned off from the open shelves/fataslá above it exactly like a tall door
    // cabinet's own drawers-below/door-above split (interior.topDoorFr, set in buildScene) — just with
    // nothing drawn in that "door" zone (2026-10-22). Open + no drawers at all: still no front, as before.
    var isOpenDrawers = !!(meta && meta.open) && interior && interior.mode === "skuffur" && interior.count > 0;
    if (meta && meta.open && !isOpenDrawers) return; // open shelves have no fronts
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    var drawers = interior && interior.mode === "skuffur" ? interior.count : 0;
    var isOven = !!(meta && meta.oven);
    // Töfrahorn: ONE door, on the left or right half of the front; the other half is a fixed blind panel
    var isCorner = !!(meta && meta.corner), hw = isCorner ? widthM / 2 : widthM, hOff = isCorner ? (meta.doorSide === "left" ? -widthM / 4 : widthM / 4) : 0;
    var fronts = [];
    if (drawers){
      var fr = interior.fractions && interior.fractions.length === drawers - 1 ? interior.fractions : null, zt = interior.topDoorFr || 1;
      for (var i = 0; i < drawers; i++) fronts.push({ y0:fr ? (i === 0 ? 0 : fr[i - 1]) : i / drawers * zt, y1:fr ? (i === drawers - 1 ? zt : fr[i]) : (i + 1) / drawers * zt, drawer:true });
      if (interior.topDoorFr && !isOpenDrawers) fronts.push({ y0:interior.topDoorFr, y1:1 }); // tall unit: the door above the drawers — never for an open cabinet, that zone stays open shelves
    }
    else if (isTall && !isOven && meta && meta.washerDrawerM){ // washer tower: a drawer at the bottom, two doors above
      var wd = meta.washerDrawerM / heightM, sp2 = wd + (1 - wd) * 0.5;
      fronts.push({ y0:0, y1:wd, drawer:true }, { y0:wd, y1:sp2 }, { y0:sp2, y1:1 });
    }
    else if (meta && meta.splitFr && !isOven) pushSplitFronts(fronts, meta.splitFr); // fronts split in Smíða
    else if (isTall && !isOven && split){ fronts.push({ y0:0, y1:split }, { y0:split, y1:1 }); } // integrated fridge: two doors
    else if (!isOven) fronts.push({ y0:0, y1:1 });

    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2), cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2);
    function place(mesh, y, out, along){
      along = along || 0;
      mesh.position.set(cx + geom.axis.x * along + geom.normal.x * (depthM + out), y, cz + geom.axis.z * along + geom.normal.z * (depthM + out));
      mesh.quaternion.copy(quat);
      mesh.castShadow = true;
      group.add(mesh);
    }
    var seamMat = new THREE.MeshBasicMaterial({ color:0x2e2e30, transparent:true, opacity:0.7, side:THREE.DoubleSide });
    var hdef = HANDLES[handleKey] || {}, hstyle = hdef.style || "bar";
    var handleMat = handleFinish
      ? new THREE.MeshStandardMaterial({ color:handleFinish.hex, metalness:handleFinish.metal, roughness:handleFinish.rough })
      : new THREE.MeshStandardMaterial({ color:hdef.color || 0x55575a, metalness:hdef.color ? 0.55 : 0.75, roughness:0.34 });
    function hbar(len, y, along, out){ place(new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.02), handleMat), y, out || 0.012, along); }

    // Oven tower: drawer below, 595 mm oven (dark glass + control strip + bar
    // handle), door above.
    if (isOven){
      // the oven sits on a 700 mm drawer/cabinet zone (worktop height), its combo drawn as real drawer fronts
      var ovCodes = (meta && meta.ovenCodes) || [], ovB = (meta && meta.ovenBlock) || {}, ovSys = meta && meta.drawerSystem;
      var oh = ovenHOf(ovB, meta && meta.ovenCat) / 1000;
      var zoneH = meta && meta.lowOven ? Math.max(0.05, heightM - oh) : ovenUnderOf(ovB, ovSys, heightM * 1000) / 1000, oy = baseYM + zoneH;
      var ovFr = meta && meta.lowOven ? [zoneH * 1000] : ovCodes.length ? stackFrontsMm({ frontsMm:meta && meta.ovenFrontsMm }, ovCodes, zoneH * 1000) : null;
      var glassMat = new THREE.MeshPhysicalMaterial({ color:0x0c0d0f, roughness:0.06, metalness:0.1, clearcoat:1, clearcoatRoughness:0.03 }); // dark glass that mirrors the room
      [oy, oy + oh].forEach(function(y){ place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), y, 0.004); });
      // 60+45 = a 595 oven with a 455 compact oven on top
      (oh > 1 ? [[oy, 0.595], [oy + 0.595, 0.455]] : [[oy, oh]]).forEach(function(seg){
        var sy = seg[0], sh = seg[1], ovM = applModel("oven");
        if (ovM){ // the real oven (its face), scaled into the niche
          var osz = 0.05 / ovM.d; ovM.obj.scale.set((widthM - 0.006) / ovM.w, (sh - 0.004) / ovM.h, osz);
          place(ovM.obj, sy + 0.002, 0.003 - ovM.d * osz / 2); return;
        }
        place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, sh - 0.13, 0.012), glassMat), sy + (sh - 0.13) / 2 + 0.005, 0.006);
        place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.94, sh - 0.006, 0.006), new THREE.MeshStandardMaterial({ color:0x9fa4aa, roughness:0.3, metalness:0.9 })), sy + sh / 2, 0.003); // steel frame behind the glass
        place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, 0.06, 0.012), new THREE.MeshStandardMaterial({ color:0x2b2c30, roughness:0.4, metalness:0.4 })), sy + sh - 0.05, 0.006);
        [-0.22, -0.15, 0.15, 0.22].forEach(function(f){ var kn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 20), new THREE.MeshStandardMaterial({ color:0xb7bcc2, roughness:0.25, metalness:0.95 })); kn.rotation.x = Math.PI / 2; place(kn, sy + sh - 0.05, 0.02, widthM * f); });
        place(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.002), new THREE.MeshBasicMaterial({ color:0x0b0b0c })), sy + sh - 0.05, 0.013); // display
        place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.7, 0.018, 0.028), handleMat), sy + sh - 0.105, 0.024);
      });
      var tops = [];
      if (ovFr){ // seams between the drawers under the oven; a handle at the top of each
        var accY = baseYM;
        ovFr.forEach(function(h, i){
          accY += h / 1000; // slots (see drawerFrontsMm)
          tops.push(accY - DRAWER_GAP_MM / 1000);
          if (i < ovFr.length - 1) place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), accY - DRAWER_GAP_MM / 2000, 0.004);
        });
      } else tops.push(oy);
      if (handleKey && hstyle !== "none" && hstyle !== "groove"){
        tops.forEach(function(t){ hbar(Math.min(0.24, widthM * 0.5), t - 0.04, 0); }); // drawers / door below the oven
        if (!(meta && meta.lowOven)) hbar(Math.min(0.24, widthM * 0.5), oy + oh + 0.06, 0); // door above
      }
      return;
    }

    // Door units wider than 600 mm get two doors (user, 2026-10-02 — was ≥ 750; 2026-10-14 — also the door
    // zone above a drawer stack, not just drawer-free cabinets). The seam only spans the door's own zone,
    // not the drawers below it (drawers never split into two leaves regardless of width).
    var wideDoor = twoDoors(widthM * 1000, !!(meta && meta.zone === "wall")) && !(meta && meta.fridge) && !isCorner;
    if (((wideDoor && (!drawers || interior.topDoorFr)) || isCorner) && !isOpenDrawers){ // no door seam to draw — an open cabinet's zone above the drawers has no door at all
      var doorY0 = drawers && interior.topDoorFr ? interior.topDoorFr : 0, doorSpanM = (1 - doorY0) * heightM;
      place(new THREE.Mesh(new THREE.PlaneGeometry(0.008, doorSpanM * 0.97), seamMat), baseYM + heightM * doorY0 + doorSpanM / 2, 0.004);
    }

    fronts.forEach(function(f, idx){
      // seam between stacked door fronts (drawer seams are drawn separately)
      if (!f.drawer && idx > 0){
        place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), baseYM + heightM * f.y0, 0.004);
      }
      if (!handleKey || hstyle === "none") return;
      var top = baseYM + heightM * f.y1, bottom = baseYM + heightM * f.y0;
      // wall units and the upper door of a tall unit take the handle at the
      // lower edge, everything else at the upper edge
      var atBottom = isWallRow || (isTall && !f.drawer && idx === fronts.length - 1 && fronts.length > 1);
      var edgeY = atBottom ? bottom + 0.02 : top - 0.02;
      var hy = atBottom ? bottom + 0.06 : top - (f.drawer ? 0.07 : 0.06);
      var mesh;
      var hcfg = window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[handleKey];
      var doorH = top - bottom;
      // tall units: pulls stand upright on the free side of each door (opposite the hinge); wide units have two doors meeting in the middle
      var vertical = !!(meta && meta.vertical) || (isTall && !f.drawer && hstyle !== "knob");
      var freeRight = meta && meta.freeSide ? meta.freeSide === "right" : !(meta && meta.hingeRight);
      var twoLeaf = wideDoor && !f.drawer && !(meta && meta.vertical);
      var sides = twoLeaf ? [-1, 1] : [freeRight ? 1 : -1];
      function edgeAlong(sg, inset){ return twoLeaf ? sg * inset * 0.6 : sg * (hw / 2 - inset) + hOff; }
      function drawVertical(){ // plain vertical versions of the drawn handles, pulls at hand height
        var vlen = hstyle === "bar" ? Math.min(hdef.len || 0.24, doorH * 0.6) : hstyle === "tab" ? (hdef.len || 0.14) : 0;
        var vy = uprightY(bottom, top, vlen);
        if (hstyle === "bar"){ var vl = Math.min(hdef.len || 0.24, doorH * 0.6); sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.012, vl, 0.02), handleMat), vy, 0.012, edgeAlong(sg, 0.05)); }); return true; }
        if (hstyle === "edge"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.02, doorH * 0.94, 0.016), handleMat), (top + bottom) / 2, 0.008, edgeAlong(sg, 0.012)); }); return true; }
        if (hstyle === "tab"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.03, hdef.len || 0.14, 0.02), handleMat), vy, 0.01, edgeAlong(sg, 0.02)); }); return true; }
        if (hstyle === "groove"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.006, doorH * 0.9, 0.002), seamMat), (top + bottom) / 2, 0.002, edgeAlong(sg, 0.012)); }); return true; }
        return false;
      }
      if (vertical && !(hcfg && hcfg.kind === "hexxa") && !(hcfg && hcfg.file) && drawVertical()) return;
      if (hcfg && hcfg.kind === "hexxa"){ // milled into the front, no fixed width: equal distance to both sides
        var hm2 = (hcfg.marginMm || 50) / 1000, dark = new THREE.MeshStandardMaterial({ color:0x18181a, roughness:0.6 });
        if (vertical && wardrobeScene){ var hxL = Math.min(0.4, doorH - 2 * hm2), hxY = Math.max(bottom + hm2 + hxL / 2, Math.min(top - hm2 - hxL / 2, 1.05)); // wardrobe: a slot at hand height (user, 2026-10-25)
          sides.forEach(function(sg){ // milled into the opening edge exactly like the top-edge notch (user, 2026-10-26: same depth) — the slab itself is cut (sideNotch in addArticulated)
            if (meta && meta.slab){
              place(new THREE.Mesh(new THREE.BoxGeometry(0.028, Math.max(0.05, hxL) - 0.002, 0.003), dark), hxY, -FRONT_T + 0.0025, edgeAlong(sg, 0.0155));
              place(new THREE.Mesh(new THREE.BoxGeometry(0.001, Math.max(0.05, hxL) - 0.002, FRONT_T - 0.003), handleMat), hxY, -FRONT_T / 2 + 0.0005, edgeAlong(sg, 0.0295));
            } else {
              place(new THREE.Mesh(new THREE.BoxGeometry(0.03, Math.max(0.05, hxL), 0.0015), dark), hxY, 0.0008, edgeAlong(sg, 0.015));
              place(new THREE.Mesh(new THREE.BoxGeometry(0.003, Math.max(0.05, hxL), 0.004), handleMat), hxY, 0.002, edgeAlong(sg, 0.0315));
            } }); }
        else if (vertical){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.012, Math.max(0.05, doorH - 2 * hm2), 0.0015), dark), (top + bottom) / 2, 0.0008, edgeAlong(sg, 0.02)); }); }
        else {
          var hl = Math.max(0.05, hw - 2 * hm2);
          // wall units: the slot is milled into the BOTTOM edge (mirror of the base-unit one)
          var ed = atBottom ? bottom : top, sgn = atBottom ? 1 : -1;
          if (meta && meta.slab){ // the front is really cut away there: a dark back wall and a floor inside the notch
            // 1–2 mm smaller than the notch and lifted 1 mm off its floor, so nothing shares a plane with the panel (that z-fought)
            place(new THREE.Mesh(new THREE.BoxGeometry(hl - 0.002, 0.028, 0.003), dark), ed + sgn * 0.0155, -FRONT_T + 0.0025, hOff);
            place(new THREE.Mesh(new THREE.BoxGeometry(hl - 0.002, 0.001, FRONT_T - 0.003), handleMat), ed + sgn * 0.0295, -FRONT_T / 2 + 0.0005, hOff);
          } else {
            place(new THREE.Mesh(new THREE.BoxGeometry(hl, 0.03, 0.0015), dark), ed + sgn * 0.015, 0.0008, hOff);
            place(new THREE.Mesh(new THREE.BoxGeometry(hl, 0.003, 0.004), handleMat), ed + sgn * 0.0315, 0.002, hOff);
          }
        }
        return;
      }
      if (hcfg && hcfg.kind === "jey"){ // full-width profile that replaces stripMm of the front (see addArticulated)
        // Spónagrip (2026-09-28) reuses this exact geometry — same jey.glb, same stripMm/profileMm — with
        // `matchFront:true` so handleProfile() below clads it in the front's own material instead of a
        // fixed colour ("eins og Jey nema með frontaefnisklæðningu"); requiresFrontCategory:"sponlagt" in
        // KPHANDLES gates it to Spónlagt fronts only.
        var jl = vertical ? doorH - 0.004 : hw - 0.004, jp = handleProfile(THREE, handleKey, jl, frontMat);
        if (jp){
          var jout = meta && meta.slab ? -jp.userData.size.d + 0.0004 : 0; // in line with the fronts: the lip flush with the front face, the back wall behind it
          // place() overwrites the rotation of what it is given, so the turn lives in a child group
          if (vertical){ sides.forEach(function(sg){ // the finger lip (bottom of the profile) ends up on the free edge, the body extends inwards
            // two doors meeting in the middle (owner, 2026-10-27: they shared ONE profile at the seam): each door its own, on
            // its side of the seam, lip towards the seam — the left door's free edge is its right one, and the other way round
            var dirSg = twoLeaf ? -sg : sg;
            var rot = new THREE.Group(), lift = new THREE.Group(), h2 = new THREE.Group();
            lift.add(jp.clone(true)); rot.add(lift); // the same frame as on the top edge, turned: inside its own door, in the cut-out
            rot.rotation.z = dirSg > 0 ? -Math.PI / 2 : Math.PI / 2; h2.add(rot); // turned so the finger lip faces the opening (was the wrong way round, user 2026-10-25)
            place(h2, (top + bottom) / 2, jout, twoLeaf ? sg * (0.0015 + SIDE_REVEAL_M) : sg * (hw / 2 - SIDE_REVEAL_M) + hOff); // the door's side has its 2 mm reveal (the top edge doesn't) — in by that, so it meets the front as on the top edge
          }); }
          else if (atBottom){ // wall units: the profile runs along the bottom edge, upside down (finger lip facing down)
            var jr = new THREE.Group(), jh = new THREE.Group(); jr.add(jp); jr.rotation.z = Math.PI; jh.add(jr);
            place(jh, bottom, jout, hOff);
          }
          else place(jp, top, jout, hOff);
          return;
        }
      }
      if (hcfg && hcfg.kind === "topmount"){ // sits ON the top edge of the front (flat side up, under the worktop), projecting out of it
        var leafW = twoLeaf ? hw / 2 : hw, tlen = pickHandleLenM(hcfg, (vertical ? tallHandleAvailMm(hcfg, doorH * 1000) : handleAvailMm(hcfg, leafW * 1000)) / 1000), tpf = handleProfile(THREE, handleKey, tlen);
        if (tpf){
          if (vertical){ // tall units: an edge pull on the free side, at chest height
            var vyc = uprightY(bottom, top, tlen);
            sides.forEach(function(sg){ var dirT = twoLeaf ? -sg : sg; // two doors: one pull each, on its own side of the seam (owner, 2026-10-27)
              var rotT = new THREE.Group(), hT = new THREE.Group(); rotT.add(tpf.clone(true)); rotT.rotation.z = (dirT > 0 ? -Math.PI / 2 : Math.PI / 2) * (hcfg.flip ? -1 : 1); hT.add(rotT); /* a flipped model (Vann) turns the other way, as on the top edge */ place(hT, vyc, -(hcfg.embedMm || 0) / 1000 + EMBED_CLEAR_M, (twoLeaf ? sg * (0.0015 + SIDE_REVEAL_M) : sg * (hw / 2 - SIDE_REVEAL_M) + hOff) - dirT * (hcfg.dropMm || 0) / 1000); }); // dropped in from the edge + sunk into the front, as on the top edge
          } else {
            var centres = twoLeaf ? [-hw / 4, hw / 4] : [hOff];
            centres.forEach(function(cxT){ var rotB = new THREE.Group(), hB = new THREE.Group(); rotB.add(tpf.clone(true)); if (atBottom !== !!hcfg.flip) rotB.rotation.z = Math.PI; hB.add(rotB); place(hB, atBottom ? bottom + (hcfg.dropMm || 0) / 1000 : top - (hcfg.dropMm || 0) / 1000, -(hcfg.embedMm || 0) / 1000 + EMBED_CLEAR_M, cxT); }); // wall units: on the bottom edge, upside down
          }
          return;
        }
      }
      if (hcfg && hcfg.kind === "bar" && hcfg.file){ // a real pull screwed onto the face: centred, upright on tall units
        var leafB = twoLeaf ? hw / 2 : hw, fitB = pickHandleLenM(hcfg, (vertical ? tallHandleAvailMm(hcfg, doorH * 1000) : handleAvailMm(hcfg, leafB * 1000)) / 1000);
        var bp = handleProfile(THREE, handleKey, Math.max(0.05, fitB));
        if (bp){
          if (vertical){ var vyb = uprightY(bottom, top, Math.max(0.05, fitB)); sides.forEach(function(sg){ var rot2 = new THREE.Group(), g2 = new THREE.Group(); rot2.add(bp.clone(true)); rot2.rotation.z = Math.PI / 2; g2.add(rot2); place(g2, vyb, 0, edgeAlong(sg, 0.05)); }); }
          else (twoLeaf ? [-hw / 4, hw / 4] : [hOff]).forEach(function(cxB){ var rotB = new THREE.Group(), gB = new THREE.Group(); rotB.add(bp.clone(true)); gB.add(rotB); place(gB, atBottom ? bottom + 0.06 : hy, 0, cxB); });
          return;
        }
      }
      if (vertical && drawVertical()) return; // the real model isn't loaded yet: the drawn one, upright (not across the top)
      if (hstyle === "bar"){
        var blen = hdef.len || 0.24, cap = blen <= 0.24 ? 0.5 : 0.85;
        if (wideDoor && !f.drawer && blen <= 0.24){ hbar(0.16, hy, -widthM * 0.16); hbar(0.16, hy, widthM * 0.16); }
        else hbar(Math.min(blen, hw * cap), hy, hOff);
      } else if (hstyle === "edge"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.min(hw * 0.94, hw * (hdef.len || 0.7)), 0.02, 0.016), handleMat);
        place(mesh, edgeY, 0.008, hOff);
      } else if (hstyle === "tab"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(hdef.len || 0.14, 0.03, 0.02), handleMat);
        place(mesh, edgeY, 0.01, hOff);
      } else if (hstyle === "knob"){        var knobs = wideDoor && !f.drawer ? [-widthM * 0.12, widthM * 0.12] : [hOff];
        knobs.forEach(function(al){ place(new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 12), handleMat), atBottom ? bottom + 0.07 : top - 0.07, 0.014, al); });
      } else if (hstyle === "groove"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.9, 0.006, 0.002), seamMat);
        place(mesh, atBottom ? bottom + 0.012 : top - 0.012, 0.002, hOff);
      }
    });
  }

  // `interior` is optional: { mode:"hillur"|"skuffur", count:number }.
  // `meta` (optional) is tagged onto the mesh as userData for click-picking —
  // {wallId, zone, blockId}. `selected` swaps the edge color and tints the
  // front face so a picked cabinet is unambiguous. `pickables` (optional
  // array) collects the mesh so the caller can raycast against exactly the
  // clickable set, not walls/floor/seams.
  function addCabinetBox(THREE, scene, geom, offsetM, widthM, heightM, depthM, baseYM, carcassMat, frontMat, interior, meta, selected, pickables){
    // A locked cabinet is built in parts (open carcass + 20 mm fronts + drawer boxes) so its
    // drawers and doors can be opened and closed; an unlocked one stays a single solid box.
    var art = !!(meta && (meta.locked || meta.slabFronts || PEEK_OPEN[meta.blockId]) && meta.openMat && !meta.fixedFronts && !meta.open && !meta.panel && meta.zone !== "opening");
    var bodyD = art ? depthM - FRONT_T : depthM;
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * (bodyD / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * (bodyD / 2);
    // Floor units stand on a recessed plinth (sökkull): the body starts up by the wall/island's own plinth
    // height (100 mm default, Sökkulhæð overrides it — meta.plinthMm, set once per wall in buildScene) and a
    // dark, set-back block fills the gap, as in a real kitchen.
    var plinthM = meta && meta.plinth ? (typeof meta.plinthMm === "number" ? meta.plinthMm : 100) / 1000 : 0;
    var bodyBase = baseYM + plinthM, bodyH = heightM - plinthM;
    var panelBox = !!(meta && meta.panel);
    // an end panel stops 1 mm short of each neighbour: sharing the carcass side's plane z-fought, seen from
    // inside an open cabinet (2026-10-05)
    var boxGeo = window.__RoundedBox__ && !panelBox
      ? new window.__RoundedBox__(widthM, bodyH, bodyD, 3, 0.004)
      : new THREE.BoxGeometry(panelBox ? Math.max(0.005, widthM - 0.002) : widthM, bodyH, bodyD);
    if (panelBox) panelUV(boxGeo, widthM, bodyH, bodyD, frontMat.userData && frontMat.userData.tile);
    else scaleFrontUV(boxGeo, widthM, bodyH, frontMat.userData && frontMat.userData.tile, false, { u:offsetM, v:bodyBase });
    var useFrontMat = frontMat;
    if (selected && !outlineSel){ // a wardrobe keeps its real door colour — the blue outline (drawOverlay) shows the pick (user, 2026-10-26: "lilac looks like another door colour")
      useFrontMat = frontMat.clone();
      useFrontMat.emissive = new THREE.Color(SELECT_COLOR);
      useFrontMat.emissiveIntensity = 0.35;
      useFrontMat.__xrayBase = frontMat; // setXrayFronts: a selected cabinet's own clone, not the shared material it toggles — tagged (own property, not userData, so clone()/copy() never carries it onto the original) so it's found too
    }
    var isOpen = !!(meta && meta.open && meta.openMat);
    var isPanel = !!(meta && meta.panel); // úthlið / loose shelf: solid board in the front material on every face
    var mesh = new THREE.Mesh(boxGeo, art || isOpen ? meta.hiddenMat // the real boards are added below; the box stays only to pick/drag
      : isPanel ? [frontMat, frontMat, frontMat, frontMat, useFrontMat, frontMat]
      : [carcassMat, carcassMat, meta && meta.sink ? meta.hiddenMat : carcassMat, carcassMat, useFrontMat, carcassMat]); // a sink's body is open on top: the basin sinks into it
    mesh.position.set(cx, bodyBase + bodyH / 2, cz);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    mesh.quaternion.copy(quat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (meta) mesh.userData = meta;
    if (meta){ meta.selected = !!selected; meta.baseFront = frontMat; meta.art = art; meta.bodyMesh = mesh; }
    if (art || isOpen) mesh.castShadow = false;
    // One group per cabinet (body + outline + plinth + worktop + details) so a
    // drag can move the whole thing by setting a single matrix; the group stays
    // at identity otherwise. The pickable mesh is a child, so raycasts still hit it.
    var group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    if (pickables) pickables.push(mesh);

    // A light front color (e.g. hvítt) can otherwise blend into the equally
    // light wall/floor — a soft dark outline keeps every cabinet readable.
    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(widthM, bodyH, depthM)),
      new THREE.LineBasicMaterial({ color: selected ? SELECT_COLOR : (meta && meta.warn ? WARN_COLOR : 0x2a2a2a), transparent:true, opacity: (selected || (meta && meta.warn)) ? 1 : 0.2 })
    );
    edges.position.copy(mesh.position);
    if (art) edges.position.x += geom.normal.x * FRONT_T / 2, edges.position.z += geom.normal.z * FRONT_T / 2; // the outline wraps the fronts too
    edges.quaternion.copy(mesh.quaternion);
    if (meta && meta.applModel && !selected && !meta.warn) edges.visible = false; // a real appliance model needs no box outline
    group.add(edges);
    if (meta) meta.edgesObj = edges;
    if (meta && meta.zone !== "opening" && !meta.islandId){ // back-face fade (see fadeCabinets in buildScene) — never an island's boxes: they stand in the room and are seen from every side (user, 2026-10-11)
      group.userData.cab = { blockId:meta.blockId, nx:geom.normal.x, nz:geom.normal.z, d:geom.normal.x * geom.origin.x + geom.normal.z * geom.origin.z, t:0, items:null,
        edgesMat:edges.material, edgesBaseOpacity:edges.material.opacity,
        hide:!!(meta.panel && !meta.shelfBoard) }; // an end panel disappears completely seen from behind (2026-10-05)
      (scene.userData.cabs = scene.userData.cabs || []).push(group);
    }

    function local(alongM, y, outM){ // point on this cabinet: centre-line offset, height, distance out from the wall
      return new THREE.Vector3(
        geom.origin.x + geom.axis.x * (offsetM + widthM / 2 + alongM) + geom.normal.x * outM, y,
        geom.origin.z + geom.axis.z * (offsetM + widthM / 2 + alongM) + geom.normal.z * outM);
    }

    if (plinthM && meta && meta.plinthMat && !meta.hung){ // (a wall-hung bath unit: the "plinth" is just air under it)
      // full width (user, 2026-10-16): plinths of neighbouring units may run together with no visual break between
      // them, like a real continuous kickboard — only its height is a hair short, so its top never shares a plane
      // with the body's underside (z-fighting showed through an open cabinet).
      var plGeo = new THREE.BoxGeometry(widthM, plinthM - 0.004, depthM - 0.063);
      var plFace = Array.isArray(meta.plinthMat) ? meta.plinthMat[4] : meta.plinthMat;
      scaleFrontUV(plGeo, widthM, plinthM, plFace.userData && plFace.userData.tile); // the plinth's front is clad in the front material
      var pl = new THREE.Mesh(plGeo, meta.plinthMat);
      pl.position.copy(local(0, baseYM + (plinthM - 0.004) / 2, 0.003 + (depthM - 0.063) / 2)); // 3 mm off the wall line so its back face never shares a plane with the skirting/wall
      pl.quaternion.copy(quat);
      pl.receiveShadow = true;
      group.add(pl);
    }
    if (meta && meta.counter && meta.stoneMat){
      var sinkHole = meta.sink && !meta.basin ? sinkCutout(widthM, depthM) : null; // a bathroom basin sits ON the top: no cut-out
      var TT = meta.stoneMat.userData.thick || 0.03;
      var topGeo = sinkHole ? worktopWithHole(THREE, widthM + 0.001, TT, depthM + 0.02, sinkHole) : new THREE.BoxGeometry(widthM + 0.001, TT, depthM + 0.02);
      worktopUV(topGeo, meta.stoneMat.userData && meta.stoneMat.userData.tile, meta.stoneMat.userData && meta.stoneMat.userData.rotateTex, offsetM + widthM / 2);
      var top = new THREE.Mesh(topGeo, meta.stoneMat);
      // 1 mm proud of the carcass top: an open (articulated) carcass shows its top board from inside, and a
      // worktop underside in the very same plane z-fought with it (striped, 2026-10-02)
      top.position.copy(local(0, baseYM + heightM + 0.001 + TT / 2, (depthM + 0.02) / 2));
      top.quaternion.copy(quat);
      top.castShadow = true; top.receiveShadow = true;
      group.add(top);
      // PRO (2026-10-26): the worktop is its own object — a tap on it opens "Smíða — Borðplata" (locked: never drags the cabinet)
      if (meta.pickTop && pickables){
        var topEdges = new THREE.LineSegments(new THREE.EdgesGeometry(topGeo), new THREE.LineBasicMaterial({ color:SELECT_COLOR })); // shown on hover only
        topEdges.position.copy(top.position); topEdges.quaternion.copy(top.quaternion); topEdges.visible = false; group.add(topEdges);
        top.userData = { kind:"worktop", worktop:true, locked:true, blockId:meta.blockId, wallId:meta.wallId, zone:"worktop", edgesObj:topEdges }; pickables.push(top);
      }
      if (meta.sink && !meta.basin) addSink(THREE, group, local, quat, widthM, depthM, baseYM + heightM + 0.001 + TT, meta.tapCeilM, meta.utilityTap);
    }
    // Baðherbergi (user, 2026-10-26): a handlaug sitting on the top (or straight on the cabinet with no top) + a short
    // bathroom mixer — never the kitchen's inset steel sink and gooseneck
    if (meta && meta.sink && meta.basin) addBasin(THREE, group, local, quat, widthM, depthM, baseYM + heightM + 0.001 + (meta.counter && meta.stoneMat ? (meta.stoneMat.userData.thick || 0.03) : 0), meta.tapCeilM);

    if (art || isOpen){ // the carcass as real boards, in the cabinet's own frame (x along the wall, z out of it)
      var cframe = new THREE.Group();
      cframe.position.set(geom.origin.x + geom.axis.x * (offsetM + widthM / 2), 0, geom.origin.z + geom.axis.z * (offsetM + widthM / 2));
      cframe.quaternion.copy(quat);
      addCarcassBoards(THREE, cframe, widthM, bodyH, bodyBase, art ? depthM - FRONT_T : depthM, meta.openMat, !!meta.sink);
      cframe.traverse(function(o){ if (o.isMesh) o.userData = meta; }); // a click on a board = a click on the cabinet
      group.add(cframe);
    }
    if (isOpen){ // shelf boards — where Smíða put them, else spread evenly
      var openList = meta.shelfBlock ? shelfLayoutOf(meta.shelfBlock, bodyH * 1000, meta.drawerSystem)
        : (function(n){ var o = []; for (var k = 1; k <= n; k++) o.push({ mm:bodyH * 1000 * k / (n + 1) + 9 }); return o; })(meta.shelves || 0);
      for (var sh = 0; sh < openList.length; sh++){
        var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, depthM - 0.02), meta.openMat); // side to side (user, 2026-10-05)
        if (openList[sh].tray) addTrayRim(board, widthM - 2 * CARCASS_T - 0.001, depthM - 0.02, frontMat || meta.openMat);
        board.position.copy(local(0, bodyBase + openList[sh].mm / 1000 - 0.009, (depthM - 0.02) / 2 + 0.005));
        board.quaternion.copy(quat); board.castShadow = true; board.receiveShadow = true;
        group.add(board);
        // draggable up/down in 3D (2026-10-21): writes the same b.shelfPos Smíða's own box editor reads —
        // only for a real block (the synthetic even-spread fallback above has nothing to write back to)
        if (meta.shelfBlock && pickables){
          board.userData = { kind:"shelf-item", itemKind:"shelf", blockId:meta.shelfBlock.id, idx:sh, locked:meta.locked, bodyBaseY:bodyBase, widthM:widthM, ax:geom.axis.x, az:geom.axis.z };
          pickables.push(board);
          var boardEdges = new THREE.LineSegments(new THREE.EdgesGeometry(board.geometry), new THREE.LineBasicMaterial({ color:SELECT_COLOR, transparent:true, opacity:0 }));
          boardEdges.position.copy(board.position); boardEdges.quaternion.copy(board.quaternion);
          group.add(boardEdges);
          board.userData.edgesObj = boardEdges;
        }
      }
      // Fataslá (clothes rail, 2026-10-15): same zone/gating as the shelf boards above.
      var openRails = meta.shelfBlock && CATALOG[meta.shelfBlock.type] && CATALOG[meta.shelfBlock.type].railRange
        ? railLayoutOf(meta.shelfBlock, bodyH * 1000, meta.drawerSystem) : [];
      if (openRails.length){
        var openRailMat = railMatOf(meta.shelfBlock);
        var railLocalQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        openRails.forEach(function(rl, ri){
          var rod = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_D_MM / 2000, RAIL_D_MM / 2000, widthM - 2 * CARCASS_T - 0.02, 16), openRailMat);
          rod.quaternion.copy(quat).multiply(railLocalQ);
          rod.position.copy(local(0, bodyBase + rl.mm / 1000, (depthM - 0.02) / 2 + 0.005));
          rod.castShadow = true;
          group.add(rod);
          if (pickables){
            rod.userData = { kind:"rail-item", itemKind:"rail", blockId:meta.shelfBlock.id, idx:ri, locked:meta.locked, bodyBaseY:bodyBase, widthM:widthM, ax:geom.axis.x, az:geom.axis.z };
            pickables.push(rod);
            var rodEdges = new THREE.LineSegments(new THREE.EdgesGeometry(rod.geometry), new THREE.LineBasicMaterial({ color:SELECT_COLOR, transparent:true, opacity:0 }));
            rodEdges.position.copy(rod.position); rodEdges.quaternion.copy(rod.quaternion);
            group.add(rodEdges);
            rod.userData.edgesObj = rodEdges;
          }
        });
      }
    }
    // an open unit's drawers get real fronts (user, 2026-10-26: they showed as bare inner boxes — the box that carries
    // a closed unit's fronts is hidden in an open one); handles come from addFrontDetails below as before
    if (isOpen && interior && interior.mode === "skuffur" && interior.count > 0){
      var ofr = interior.fractions && interior.fractions.length === interior.count - 1 ? interior.fractions : null, ozt = interior.topDoorFr || 1;
      for (var oi = 0; oi < interior.count; oi++){
        var of0 = ofr ? (oi === 0 ? 0 : ofr[oi - 1]) : oi / interior.count * ozt, of1 = ofr ? (oi === interior.count - 1 ? ozt : ofr[oi]) : (oi + 1) / interior.count * ozt;
        var oy0 = bodyBase + bodyH * of0 + 0.0015, oy1 = bodyBase + bodyH * of1 - 0.0015;
        // inset between the sides, flush with their front edges — like the kitchen's innskúffa (user, 2026-10-26)
        var oslab = frontSlab(THREE, widthM - 2 * CARCASS_T - 0.004, oy1 - oy0, useFrontMat, null, { u:offsetM + CARCASS_T, v:oy0 });
        oslab.position.copy(local(0, (oy0 + oy1) / 2, depthM - FRONT_T / 2 - 0.001)); oslab.quaternion.copy(quat);
        oslab.castShadow = true; oslab.receiveShadow = true; oslab.userData = meta;
        if (wardrobeScene && meta.shelfBlock && pickables && geom && geom.axis){ // resizable like a closed unit's drawer (onDrawerResize)
          oslab.userData = Object.assign({}, meta, { isPart:true, drawerIdx:oi, drawerBotY:oy0, drawerTopY:oy1, ax:geom.axis.x, az:geom.axis.z, bodyBaseY:bodyBase, widthM:widthM - 2 * CARCASS_T });
          pickables.push(oslab);
        }
        group.add(oslab);
        // the drawer itself behind its front, so the fronts aren't slabs in thin air (owner, 2026-10-27)
        var sideO = Math.max(50, Math.min(200, Math.round((oy1 - oy0) * 1000 - 55))),
          obx = buildDrawerBox(THREE, meta.drawerSystem, meta.carcassKey, sideO, Math.max(0.2, widthM - 2 * CARCASS_T - 0.026), Math.max(0.2, depthM - FRONT_T - BACK_T - 0.01), null, widthM - 2 * CARCASS_T);
        obx.position.copy(local(0, drawerBoxY(oy0, oy1, sideO / 1000), depthM - FRONT_T - 0.005)); obx.quaternion.copy(quat);
        obx.traverse(function(o){ if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
        group.add(obx);
      }
      // ...and a board over the top drawer, so you don't look down into the drawers from the open space above
      var coverMm = bodyH * 1000 * ozt;
      if (ozt < 0.999 && !(openList || []).some(function(sl){ return Math.abs(sl.mm - coverMm) < 40; })){
        var cover = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, depthM - 0.02), meta.openMat);
        cover.position.copy(local(0, bodyBase + coverMm / 1000 + 0.009, (depthM - 0.02) / 2 + 0.005));
        cover.quaternion.copy(quat); cover.castShadow = true; cover.receiveShadow = true;
        group.add(cover);
      }
    }
    if (interior && interior.mode === "skuffur" && !art){
      if (interior.topDoorFr && !(meta && meta.open)) addDrawerSeams(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior.count + 1,
        (interior.fractions || Array.apply(null, Array(interior.count - 1)).map(function(_, k){ return (k + 1) / interior.count * interior.topDoorFr; })).concat([interior.topDoorFr]));
      else addDrawerSeams(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior.count, interior.fractions); // open: just the seams between drawers, no extra "door starts here" line floating in open air
    }
    if (meta && meta.locked && !meta.suppressBadge && meta.zone !== "opening") addLockBadge(THREE, group, local(0, baseYM + heightM + (meta.counter ? 0.16 : 0.1), depthM / 2));
    if (meta && meta.ready) addLockBadge(THREE, group, local(widthM / 2 - 0.07, baseYM + heightM + (meta.counter ? 0.16 : 0.1), depthM / 2), true); // pro: "Klár til framleiðslu"
    // Always-on W×H×D (Fataskápar, 2026-10-22): closets have far fewer pieces than a kitchen, so baking
    // the size onto every unit (PAX's own "dimensions always on" — the single thing most asked for in that
    // research round) doesn't clutter the way it would across a dozen kitchen cabinets; gated on
    // meta.alwaysDims (buildScene: activeCategory "fataskapar" or "fataskapar:N"), not a per-type flag, so it
    // covers every Fataskápar piece (floor and wall) uniformly.
    if (meta && meta.alwaysDims && meta.zone !== "opening" && !isPanel && geom && geom.axis) addUnitDims(geom, offsetM, widthM, baseYM + heightM, depthM, dimLen(Math.round(widthM * 1000)));
    if (art) addArticulated(THREE, scene, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta, useFrontMat, pickables);
    else if (meta && meta.zone !== "opening" && !isPanel && !meta.appliance) addFrontDetails(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta.handle, !!meta.tall, meta.zone === "wall" || !!meta.handleBottom || (bodyBase >= HIGH_DOOR_M && !(interior && interior.mode === "skuffur")), meta.split || 0, meta, useFrontMat);
    if (meta && meta.appliance && !meta.applModel) addApplianceDetails(THREE, group, geom, offsetM, widthM, heightM, depthM, meta.appliance);
    return group;
  }
  // A free-standing fridge (steel; side by side doors when ≥ 850 mm) or washer (white, porthole door) drawn on
  // its box — these are spaces for the customer's own appliance, not Björninn products.
  // ---------- real appliance models (user's SketchUp downloads, 2026-10-25) ----------
  // Each entry: a file (+ the node to take, + a turn so its front faces +z). Baked to one Group: centred on x/z,
  // bottom at y = 0, front at +z. Loaded the first time it's asked for; until then the drawn version shows.
  var APPL_SRC = {
    oven:     { file:"models/appliances/oven/model.dae",       node:"group_0" },
    fridge60: { file:"models/appliances/fridges/model.dae",    node:"group_1" },
    fridge70: { file:"models/appliances/fridges/model.dae",    node:"group_0" },
    fridge90: { file:"models/appliances/fridge90/model.dae",   node:null, rot:Math.PI },
    wine:     { file:"models/appliances/wine/model.dae",       node:null, rot:-Math.PI / 2 },
    // idle: only seen inside an opened dishwasher, and the biggest file by far — fetched a moment after the first view
    // is up instead of competing with it (drawn baskets until then, as before) (studio-load, 2026-10-26)
    dwLower:  { file:"models/appliances/dishwasher/model.dae", node:"group_3", idle:true },
    dwUpper:  { file:"models/appliances/dishwasher/model.dae", node:"group_36", idle:true },
    hinge:    { file:"models/hinges/blum-clip-top.glb",         node:null }, // Blum CLIP top (79B3491), open
    hingeArm: { file:"models/hinges/blum-clip-top.glb",         node:null, skip:["3DGeom-4"], full:true }, // arm + plate (on the carcass)
    hingeCup: { file:"models/hinges/blum-clip-top.glb",         node:"3DGeom-4", full:true }               // the cup (in the door)
  };
  var APPL_RAW = {}, APPL_READY = {}, APPL_HIDE = null, HINGE_MAT = null, CUP_DARK = null, SHOW_HINGES = false;
  function applStdMat(THREE, m){
    if (!m) return m;
    var metal = /metal|steel|chrome|stainless|inox|_ss|alu/i.test(m.name || "");
    var s = new THREE.MeshStandardMaterial({ color:m.color ? m.color.clone() : 0xcccccc, map:m.map || null, side:m.side,
      transparent:!!m.transparent || (m.opacity != null && m.opacity < 1), opacity:m.opacity == null ? 1 : m.opacity, roughness:metal ? 0.3 : 0.45, metalness:metal ? 0.8 : 0.08 });
    if (s.map && THREE.SRGBColorSpace) s.map.colorSpace = THREE.SRGBColorSpace;
    return s;
  }
  function applModel(key){
    var ready = APPL_READY[key];
    if (ready) return { obj:ready.obj.clone(true), w:ready.w, h:ready.h, d:ready.d };
    var src = APPL_SRC[key]; if (!src) return null;
    var raw = APPL_RAW[src.file];
    if (!raw){
      raw = APPL_RAW[src.file] = { state:"loading", root:null };
      var go = function(){ loadRaw(src.file, function(root){ raw.root = root; raw.state = "ready"; window.dispatchEvent(new Event("kp3d-model-loaded")); }, function(){ raw.state = "error"; }); };
      if (src.idle) setTimeout(function(){ if (window.requestIdleCallback) requestIdleCallback(go, { timeout:3000 }); else go(); }, 2500); else go();
      return null;
    }
    if (raw.state !== "ready") return null;
    var THREE = window.__THREE__; raw.root.updateMatrixWorld(true);
    var from = src.node ? raw.root.getObjectByName(src.node) : raw.root; if (!from) return null;
    var g = new THREE.Group(), turn = new THREE.Matrix4().makeRotationY(src.rot || 0);
    from.traverse(function(o){
      if (!o.isMesh || (src.skip && src.skip.indexOf(o.name) >= 0)) return;
      var gm = o.geometry.clone(); gm.applyMatrix4(o.matrixWorld); gm.applyMatrix4(turn);
      var m = new THREE.Mesh(gm, Array.isArray(o.material) ? o.material.map(function(x){ return applStdMat(THREE, x); }) : applStdMat(THREE, o.material));
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    });
    var bb = new THREE.Box3().setFromObject(g, true);
    if (src.full){ // parts of one model keep the whole model's frame (so they still fit together)
      bb = new THREE.Box3();
      raw.root.traverse(function(o){ if (o.isMesh){ var gm2 = o.geometry.clone(); gm2.applyMatrix4(o.matrixWorld); gm2.applyMatrix4(turn); gm2.computeBoundingBox(); bb.union(gm2.boundingBox); } });
    }
    var c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    g.children.forEach(function(m){ m.geometry.translate(-c.x, -bb.min.y, -c.z); });
    APPL_READY[key] = { obj:g, w:sz.x, h:sz.y, d:sz.z };
    return applModel(key);
  }
  // a freestanding appliance model in a wall's slot: front on the room side, scaled to the unit's own W × H × D
  function placeApplModel(THREE, scene, geom, offsetM, widthM, heightM, depthM, mdl){
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    var a = offsetM + widthM / 2, o = mdl.obj;
    o.scale.set(widthM / mdl.w, heightM / mdl.h, depthM / mdl.d);
    o.position.set(geom.origin.x + geom.axis.x * a + geom.normal.x * depthM / 2, 0, geom.origin.z + geom.axis.z * a + geom.normal.z * depthM / 2);
    o.quaternion.copy(quat); scene.add(o);
  }
  function applKeyOf(c, b){
    if (c.appliance === "wine") return "wine";
    if (c.appliance === "fridge") return b.widthMm >= 850 ? "fridge90" : b.widthMm >= 650 ? "fridge70" : "fridge60";
    return null;
  }
  // The washer tower as built: a drawer box (on the plinth), an open niche of carcass sides + back for the two machines,
  // a cabinet with one door above when there's room (≥ 20 cm). Both boxes carry the unit's meta (pick / drag / select).
  // Returns the niche's {base, top} (m) for addTowerMachines.
  var TOWER_DRAWER_M = 0.40, TOWER_NICHE_M = 1.76;
  function addWasherTower(THREE, scene, geom, offM, wM, hM, dM, plM, carcassMat, frontMat, meta, selected, pickables, single, side){
    // single (no dryer, owner 2026-10-27): a niche for the washer only — the rest above is a cabinet with shelves
    // side ("Hlið við hlið í skáp"): one machine-high niche, the machines next to each other, a ~30 cm drawer under them
    var base = plM + (side ? 0.3 : TOWER_DRAWER_M), niche = Math.min(single || side ? TOWER_NICHE_M / 2 : TOWER_NICHE_M, hM - base - CARCASS_T), up = hM - base - niche;
    if (up < 0.2){ niche = hM - base; up = 0; }
    var common = { washerDrawerM:0, tall:false, fixedFronts:true, splitFr:null, alwaysDims:false };
    // the box under the machines is a real DRAWER (owner, 2026-10-27): one front with its handle, a drawer box that pulls out
    var dCodes = drawerCodes({ mode:"skuffur", count:1 }, meta.drawerSystem);
    addCabinetBox(THREE, scene, geom, offM, wM, base, dM, 0, carcassMat, frontMat, { mode:"skuffur", count:dCodes.length, codes:dCodes }, Object.assign({}, meta, common, { fixedFronts:false }), selected, pickables);
    if (up > 0) addCabinetBox(THREE, scene, geom, offM, wM, up, dM, base + niche, carcassMat, frontMat, { mode:"hillur", count:up > 1 ? 3 : 1 }, Object.assign({}, meta, common, { fixedFronts:false, plinth:false, handleBottom:true, handle:null, slabFronts:false, suppressBadge:true }), selected, pickables) // a real cabinet: its fronts strip with X-Ray like any other (they stayed a white box on the Efni colour page); its shelves: with the fronts off it is a real carcass, not an empty glass box (owner, 2026-10-27);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    function board(w, h, d, along, y, out){
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), carcassMat), a = offM + wM / 2 + along;
      m.position.set(geom.origin.x + geom.axis.x * a + geom.normal.x * out, y, geom.origin.z + geom.axis.z * a + geom.normal.z * out);
      m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; m.userData = meta; scene.add(m); if (pickables) pickables.push(m); return m;
    }
    var my = base + niche / 2;
    board(CARCASS_T, niche, dM, -wM / 2 + CARCASS_T / 2, my, dM / 2);
    board(CARCASS_T, niche, dM, wM / 2 - CARCASS_T / 2, my, dM / 2);
    board(wM - 2 * CARCASS_T, niche, BACK_T, 0, my, BACK_T / 2);
    if (!up) board(wM, CARCASS_T, dM, 0, hM - CARCASS_T / 2, dM / 2); // no cabinet above: a top board closes the niche
    return { base:base + 0.002, top:base + niche - (up ? 0 : CARCASS_T) };
  }
  // Þvottavélaskápur "Hurðir alla leið" in a preview (owner, 2026-10-27): a real open carcass in the carcass colour (its
  // see-through solid box read as a white glass box), a ventilated shelf over the machines, and the door(s) in the front
  // material swung open so the washer + dryer show — like opening the cabinet in the showroom
  function addOpenDoorTower(THREE, scene, geom, offM, wM, hM, dM, plM, carcassMat, frontMat){
    var grp = new THREE.Group(), bodyH = hM - plM, bodyD = dM - FRONT_T;
    grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    grp.position.set(geom.origin.x + geom.axis.x * (offM + wM / 2), 0, geom.origin.z + geom.axis.z * (offM + wM / 2));
    addCarcassBoards(THREE, grp, wM, bodyH, plM, bodyD, carcassMat);
    var shelfY = Math.min(hM - CARCASS_T - 0.2, plM + CARCASS_T + 1.75); // just over the stacked machines
    if (shelfY > plM + 1.2){ var sh = new THREE.Mesh(new THREE.BoxGeometry(wM - 2 * CARCASS_T - 0.002, CARCASS_T, bodyD - BACK_T - 0.02), carcassMat); sh.position.set(0, shelfY, BACK_T + (bodyD - BACK_T - 0.02) / 2); sh.castShadow = sh.receiveShadow = true; grp.add(sh); }
    var pl = new THREE.Mesh(new THREE.BoxGeometry(wM, plM - 0.004, dM - 0.063), carcassMat); pl.position.set(0, (plM - 0.004) / 2, 0.003 + (dM - 0.063) / 2); grp.add(pl);
    var leaves = wM > WIDE_DOOR_M ? [-1, 1] : [-1], lw = wM / leaves.length - 0.003, lh = bodyH - 0.003;
    leaves.forEach(function(side){ // side −1: hinged left, swings out to the left; +1: hinged right
      var geo = new THREE.BoxGeometry(lw, lh, FRONT_T); scaleFrontUV(geo, lw, lh, frontMat.userData && frontMat.userData.tile, false, { u:offM, v:plM });
      var door = new THREE.Mesh(geo, frontMat), pivot = new THREE.Group();
      door.position.set(-side * lw / 2, 0, -FRONT_T / 2); door.castShadow = true; door.receiveShadow = true;
      pivot.position.set(side * (wM / 2 - 0.0015), plM + bodyH / 2, dM); pivot.rotation.y = side * 1.75; // ~100° open
      pivot.add(door); grp.add(pivot);
    });
    scene.add(grp);
  }
  // Þvottavélaskápur (user, 2026-10-26): the washer with the dryer on it, drawn inside the tower (above its drawer) —
  // hidden behind the doors in the room, seen through them in the previews (opts.towerGlass) or with the fronts off
  function addTowerMachines(THREE, group, geom, offsetM, widthM, baseM, topM, depthM, mat, single, side){
    var nSide = side ? (single ? 1 : 2) : 1;
    var mw = Math.min(0.6, (widthM - 2 * CARCASS_T - 0.012 * nSide) / nSide), mh = Math.min(0.85, (topM - baseM - 0.03) / (single || side ? 1 : 2)), md = Math.min(0.58, depthM - FRONT_T - 0.03);
    if (mh < 0.5 || mw < 0.4) return;
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    var a = offsetM + widthM / 2, back = BACK_T + 0.01;
    (single ? [0] : [0, 1]).forEach(function(k){
      var ak = side && nSide > 1 ? a + (k - 0.5) * (mw + 0.012) : a; // side by side: one each side of the middle; stacked: one above the other
      var sub = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(mw, mh - 0.01, md), mat);
      body.position.set(geom.origin.x + geom.axis.x * ak + geom.normal.x * (back + md / 2), mh / 2, geom.origin.z + geom.axis.z * ak + geom.normal.z * (back + md / 2));
      body.quaternion.copy(quat); body.castShadow = true; body.receiveShadow = true; sub.add(body);
      addApplianceDetails(THREE, sub, geom, ak - mw / 2, mw, mh - 0.01, back + md, "washer");
      sub.position.y = baseM + 0.005 + (side ? 0 : k * mh);
      group.add(sub);
    });
  }
  function addApplianceDetails(THREE, group, geom, offsetM, widthM, heightM, depthM, kind){
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    function put(mesh, along, y, out){
      var a = offsetM + widthM / 2 + along;
      mesh.position.set(geom.origin.x + geom.axis.x * a + geom.normal.x * (depthM + out), y, geom.origin.z + geom.axis.z * a + geom.normal.z * (depthM + out));
      mesh.quaternion.premultiply(quat); mesh.castShadow = true; group.add(mesh); return mesh;
    }
    var dark = new THREE.MeshStandardMaterial({ color:0x2a2b2e, roughness:0.4, metalness:0.3 });
    if (kind === "fridge"){
      var bar = new THREE.MeshStandardMaterial({ color:0x9ca1a7, metalness:0.85, roughness:0.25 });
      if (widthM >= 0.85){ // side by side
        put(new THREE.Mesh(new THREE.PlaneGeometry(0.005, heightM - 0.02), dark), 0, heightM / 2, 0.002);
        [-0.04, 0.04].forEach(function(x){ put(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.55, 0.025), bar), x, heightM * 0.6, 0.02); });
      } else { // fridge above, freezer below
        var sy = heightM * 0.36;
        put(new THREE.Mesh(new THREE.PlaneGeometry(widthM - 0.01, 0.005), dark), 0, sy, 0.002);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.025), bar), widthM / 2 - 0.06, sy + 0.35, 0.02);
        put(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.025), bar), widthM / 2 - 0.06, sy - 0.16, 0.02);
      }
    } else if (kind === "dishwasher"){ // control strip along the top, a bar handle under it
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.01, 0.075, 0.008), dark), 0, heightM - 0.045, 0.004);
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.6, 0.016, 0.025), new THREE.MeshStandardMaterial({ color:0x9ca1a7, metalness:0.85, roughness:0.25 })), 0, heightM - 0.12, 0.016);
      [0.18, 0.26].forEach(function(x){ put(new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({ color:0x7fd18b })), widthM / 2 - x, heightM - 0.045, 0.009); });
    } else if (kind === "wine"){ // wine cooler (user, 2026-10-25): steel frame, tinted glass door, lit inside, rows of bottles on beech shelves
      var fw = 0.035, gw = widthM - 2 * fw, gh = heightM - 0.12 - fw, gy = 0.03 + gh / 2 + 0.02;
      var steelF = new THREE.MeshStandardMaterial({ color:0xb9bdc2, metalness:0.85, roughness:0.28 });
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.004, heightM - 0.004, 0.012), steelF), 0, heightM / 2, 0.006);            // the frame
      put(new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshBasicMaterial({ color:0x4a4038 })), 0, gy, 0.0125);         // warm lit interior behind the glass
      var glow = new THREE.Mesh(new THREE.PlaneGeometry(gw, 0.012), new THREE.MeshBasicMaterial({ color:0xcfe4ff }));                // LED along the top inside
      put(glow, 0, gy + gh / 2 - 0.012, 0.013);
      var wood = new THREE.MeshStandardMaterial({ color:0xc9a273, roughness:0.6 }), bottle = new THREE.MeshStandardMaterial({ color:0x2f5a3c, roughness:0.15, metalness:0.2, emissive:0x0d1a12 });
      var foil = new THREE.MeshStandardMaterial({ color:0xb3343e, roughness:0.35, metalness:0.4, emissive:0x2a0808 });
      var rows = Math.max(3, Math.floor(gh / 0.105)), rowH = gh / rows, per = Math.max(2, Math.floor(gw / 0.08));
      for (var rw = 0; rw < rows; rw++){
        var sy = gy - gh / 2 + rw * rowH + 0.012;
        put(new THREE.Mesh(new THREE.BoxGeometry(gw - 0.01, 0.012, 0.01), wood), 0, sy, 0.014);                                      // shelf lip
        for (var bk = 0; bk < per; bk++){ // bottle necks pointing out: a dark round with a coloured capsule
          var bxp = -gw / 2 + (bk + 0.5) * gw / per, by = sy + 0.04;
          put(new THREE.Mesh(new THREE.CircleGeometry(0.032, 20), bottle), bxp, by, 0.0135);
          put(new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), foil), bxp, by, 0.0137);
        }
      }
      put(new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshStandardMaterial({ color:0x8090a0, roughness:0.05, metalness:0.3, transparent:true, opacity:0.22 })), 0, gy, 0.016); // the glass
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.01, 0.07, 0.008), dark), 0, heightM - 0.05, 0.012);                          // control strip
      put(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.016), new THREE.MeshBasicMaterial({ color:0x8fd3ff })), widthM / 2 - 0.08, heightM - 0.05, 0.0165); // temperature display
      put(new THREE.Mesh(new THREE.BoxGeometry(0.014, gh * 0.5, 0.025), steelF), widthM / 2 - fw - 0.02, gy, 0.03);                     // bar handle
    } else if (kind === "washer"){ // front-loader (user, 2026-10-25): porthole with a chrome ring, smoked glass and the drum behind it,
      // a panel along the top with the detergent drawer (left), a display and the programme dial
      var r = Math.min(widthM, heightM) * 0.26, cy = heightM * 0.47, chrome = new THREE.MeshStandardMaterial({ color:0xc8ccd1, metalness:0.85, roughness:0.22 });
      put(new THREE.Mesh(new THREE.CircleGeometry(r + 0.03, 48), new THREE.MeshStandardMaterial({ color:0xe9ebed, roughness:0.4 })), 0, cy, 0.004);   // the door disc
      put(new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.016, 14, 56), chrome), 0, cy, 0.016);
      put(new THREE.Mesh(new THREE.CircleGeometry(r - 0.004, 48), new THREE.MeshStandardMaterial({ color:0x9aa3ab, metalness:0.8, roughness:0.35 })), 0, cy, 0.006); // the drum
      for (var dh = 0; dh < 24; dh++){ var ang = dh / 24 * Math.PI * 2, rr = r * (dh % 2 ? 0.45 : 0.7); put(new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), dark), Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 0.007); }
      put(new THREE.Mesh(new THREE.CircleGeometry(r - 0.004, 48), new THREE.MeshStandardMaterial({ color:0x2b3640, roughness:0.05, metalness:0.3, transparent:true, opacity:0.45 })), 0, cy, 0.02); // smoked glass
      var panelY = heightM - 0.065, panel = new THREE.MeshStandardMaterial({ color:0xe2e4e7, roughness:0.45 });
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.02, 0.11, 0.01), panel), 0, panelY, 0.005);
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.3, 0.075, 0.012), new THREE.MeshStandardMaterial({ color:0xf4f5f6, roughness:0.4 })), -widthM / 2 + widthM * 0.17 + 0.01, panelY, 0.009); // detergent drawer
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.08, 0.008, 0.004), dark), -widthM / 2 + widthM * 0.17 + 0.01, panelY - 0.022, 0.016);
      put(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.03), new THREE.MeshBasicMaterial({ color:0x1d2a33 })), widthM * 0.02, panelY, 0.0105);
      put(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ color:0x7fd0ff })), widthM * 0.02, panelY, 0.011);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 32), chrome).rotateX(Math.PI / 2), widthM * 0.3, panelY, 0.016);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 24), new THREE.MeshStandardMaterial({ color:0xf4f5f6, roughness:0.4 })).rotateX(Math.PI / 2), widthM * 0.3, panelY, 0.02);
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.06, 0.004, 0.003), new THREE.MeshStandardMaterial({ color:0xc9ccd0 })), 0, panelY - 0.06, 0.004); // seam under the panel
    }
  }

  // Small padlock floating over a locked cabinet.
  var LOCK_TEX = null, READY_TEX = null;
  function addLockBadge(THREE, group, pos, ready){
    if (ready && !READY_TEX){ // green — the cabinet is ready for production (pro mode)
      var rc = document.createElement("canvas"); rc.width = rc.height = 96;
      var rx = rc.getContext("2d");
      rx.fillStyle = "#1f9d55"; rx.beginPath(); rx.arc(48, 48, 46, 0, Math.PI * 2); rx.fill();
      rx.strokeStyle = "#fff"; rx.lineWidth = 11; rx.lineCap = "round"; rx.lineJoin = "round";
      rx.beginPath(); rx.moveTo(26, 50); rx.lineTo(42, 66); rx.lineTo(71, 33); rx.stroke();
      READY_TEX = new THREE.CanvasTexture(rc); READY_TEX.userData = { keep:true };
    }
    if (!ready && !LOCK_TEX){
      var cv = document.createElement("canvas"); cv.width = cv.height = 96;
      var cx = cv.getContext("2d");
      cx.fillStyle = "rgba(25,25,25,.9)"; cx.beginPath(); cx.arc(48, 48, 46, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = "#f5c518"; cx.lineWidth = 7; cx.lineCap = "round";
      cx.beginPath(); cx.moveTo(35, 46); cx.lineTo(35, 36); cx.arc(48, 36, 13, Math.PI, 0); cx.lineTo(61, 46); cx.stroke(); // shackle
      cx.fillStyle = "#f5c518"; cx.beginPath(); cx.roundRect ? cx.roundRect(28, 44, 40, 30, 6) : cx.rect(28, 44, 40, 30); cx.fill(); // body
      cx.fillStyle = "#191919"; cx.beginPath(); cx.arc(48, 57, 4.5, 0, Math.PI * 2); cx.fill(); cx.fillRect(46, 57, 4, 10);
      LOCK_TEX = new THREE.CanvasTexture(cv); LOCK_TEX.userData = { keep:true };
    }
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:ready ? READY_TEX : LOCK_TEX, depthTest:false, transparent:true }));
    sp.scale.set(0.11, 0.11, 1); sp.position.copy(pos); sp.renderOrder = 9;
    group.add(sp);
  }
  // A plain white W×H×D chip (2026-10-22), always visible — not the usual blue drag/gap-feedback colour,
  // since this is passive info sitting in the room rather than a response to the pointer. One texture per
  // cabinet, painted once at build time (buildScene rebuilds the whole scene on every real change anyway,
  // so there's no live text to repaint here the way the shelf gap labels need).
  // ---------- one dimension style everywhere (user, 2026-10-26: "eins og í wizardinum — fágaður stíll") ----------
  // Every on-scene dimension (a wardrobe unit's width, the shelf/rail gap tags, a drawer's height) is an SVG overlay drawn
  // in screen space each frame: a thin line with end ticks and a small pill — dark, or blue while it's being changed.
  // KP3D.setShowDims(false) hides the always-on unit dimensions (the "Málsetning" toggle); live drag tags always show.
  var OV = null, PENDING_DIMS = [], PENDING_LABELS = [], SHOW_DIMS = (function(){ try{ return localStorage.getItem("bjorninn:kitchenPlanner:showDims") !== "0"; }catch(e){ return true; } })();
  var OV_BLUE = "#0058a3", OV_DARK = "#2b2b2e";
  function setShowDims(on){ SHOW_DIMS = !!on; if (OV){ OV.last = null; if (THREE_STATE && THREE_STATE.camera) drawOverlay(THREE_STATE.camera, THREE_STATE.renderer.domElement); } /* redrawn at once, not on the next frame */ try{ localStorage.setItem("bjorninn:kitchenPlanner:showDims", on ? "1" : "0"); }catch(e){} }
  function ovLineSvg(a, b, text, active){
    var col = active ? OV_BLUE : OV_DARK, sw = active ? 2.4 : 1.4;
    var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 6, ny = dx / L * 6, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var tw = String(text).length * 7.4 + 14;
    if (L < tw + 16){ var sx = -dy / L, sy = dx / L; if (sx < 0){ sx = -sx; sy = -sy; } mx += sx * (tw / 2 + 10); my += sy * (tw / 2 + 10); } // short (e.g. the 15 cm gap): the pill beside it, not on it
    return '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
      [a, b].map(function(p){ return '<line x1="' + (p.x - nx) + '" y1="' + (p.y - ny) + '" x2="' + (p.x + nx) + '" y2="' + (p.y + ny) + '" stroke="' + col + '" stroke-width="' + sw + '"/>'; }).join("") +
      '<rect x="' + (mx - tw / 2) + '" y="' + (my - 11) + '" width="' + tw + '" height="22" rx="11" fill="' + (active ? col : "#fff") + '" stroke="' + col + '" stroke-width="1"/>' +
      '<text x="' + mx + '" y="' + (my + 4.5) + '" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Kumbh Sans, Arial, sans-serif" fill="' + (active ? "#fff" : col) + '">' + text + '</text>';
  }
  function drawOverlay(camera, canvas){
    if (!OV || !OV.svg) return;
    var cr = canvas.getBoundingClientRect(); if (!cr.width) return;
    OV.svg.setAttribute("viewBox", "0 0 " + cr.width + " " + cr.height);
    var v = new (window.__THREE__.Vector3)();
    function P(p){ v.set(p.x, p.y, p.z).project(camera); return { x:(v.x + 1) / 2 * cr.width, y:(1 - v.y) / 2 * cr.height, behind:v.z > 1 }; }
    var out = selHullSvg(P) + skTagsSvg(P);
    if (SHOW_DIMS) OV.dims.forEach(function(d){ var a = P(d.a), b = P(d.b); if (!a.behind && !b.behind) out += ovLineSvg(a, b, d.text, false); });
    Object.keys(OV.gaps).forEach(function(k){ var g = OV.gaps[k]; if (!g) return; out += ovLineSvg(P(g.a), P(g.b), g.text, g.active); });
    (OV.labels || []).forEach(function(l){ // a call to action on the scene (the empty wardrobe area): a white pill, blue text
      var p = P(l.p); if (p.behind) return;
      var tw = String(l.text).length * 7.6 + 30;
      out += '<rect x="' + (p.x - tw / 2) + '" y="' + (p.y - 17) + '" width="' + tw + '" height="34" rx="17" fill="#fff" stroke="' + OV_BLUE + '" stroke-width="1.5"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 5) + '" text-anchor="middle" font-size="14" font-weight="700" font-family="Kumbh Sans, Arial, sans-serif" fill="' + OV_BLUE + '">' + l.text + '</text>';
    });
    if (out !== OV.last){ OV.svg.innerHTML = out; OV.last = out; }
  }
  // "Sk-númer" (PRO, 2026-10-26): every ordered cabinet's Sk number on its front, same pill as the dimensions.
  // KP3D.setSkTags({ blockId:"Sk1", … }) or null; read off the live pickables, so it follows drags and rebuilds.
  var SK_TAGS = null, skCorner = null;
  function setSkTags(map){ SK_TAGS = map && Object.keys(map).length ? map : null; if (OV) OV.last = ""; }
  function skTagsSvg(P){
    if (!SK_TAGS || !THREE_STATE || !THREE_STATE.pickables) return "";
    var out = "", seen = {};
    if (!skCorner) skCorner = new (window.__THREE__.Vector3)();
    THREE_STATE.pickables.forEach(function(m){
      var u = m.userData, text = u && SK_TAGS[u.blockId], e = u && u.edgesObj;
      if (!text || u.isPart || !e || !e.geometry || seen[u.blockId]) return;
      seen[u.blockId] = 1;
      if (!e.geometry.boundingBox) e.geometry.computeBoundingBox();
      var bb = e.geometry.boundingBox; e.updateMatrixWorld();
      // top-right corner of the front face as seen on screen (owner 2026-10-28: out of the way, always the same place)
      var best = null, behind = false;
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function(q){
        skCorner.set(q[0] ? bb.max.x : bb.min.x, q[1] ? bb.max.y : bb.min.y, bb.max.z).applyMatrix4(e.matrixWorld);
        var c = P(skCorner); if (c.behind){ behind = true; return; }
        if (!best || (c.x - c.y) > (best.x - best.y)) best = c;
      });
      if (behind || !best) return;
      var tw = String(text).length * 7.6 + 16, p = { x:best.x - tw / 2 - 4, y:best.y + 15 };
      out += '<rect x="' + (p.x - tw / 2) + '" y="' + (p.y - 11) + '" width="' + tw + '" height="22" rx="11" fill="#fff" stroke="' + OV_DARK + '" stroke-width="1"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 4.5) + '" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Kumbh Sans, Arial, sans-serif" fill="' + OV_DARK + '">' + text + '</text>';
    });
    return out;
  }
  // the selected wardrobe unit: a blue outline round its silhouette (2.5 px, screen space — a WebGL line is always
  // 1 px and too faint) instead of tinting its doors lilac (user, 2026-10-26)
  var selCorner = null;
  function selHullSvg(P){
    if (!outlineSel || !THREE_STATE || !THREE_STATE.pickables || THREE_STATE.dragging) return "";
    var m = THREE_STATE.pickables.find(function(x){ return x.userData && x.userData.selected && x.userData.edgesObj && !x.userData.isPart; });
    var e = m && m.userData.edgesObj; if (!e || !e.geometry) return "";
    if (!e.geometry.boundingBox) e.geometry.computeBoundingBox();
    var bb = e.geometry.boundingBox;
    if (!selCorner) selCorner = new (window.__THREE__.Vector3)();
    e.updateMatrixWorld();
    // the FRONT face only (local +z = the room side): the whole box's silhouette took in its sides, hidden behind the neighbours
    var hull = [[0, 0], [1, 0], [1, 1], [0, 1]].map(function(q){
      selCorner.set(q[0] ? bb.max.x : bb.min.x, q[1] ? bb.max.y : bb.min.y, bb.max.z).applyMatrix4(e.matrixWorld);
      return P(selCorner);
    });
    if (hull.some(function(p){ return p.behind; })) return "";
    return '<polygon points="' + hull.map(function(p){ return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ") + '" fill="none" stroke="' + OV_BLUE + '" stroke-width="2.5" stroke-linejoin="round"/>';
  }
  // a wardrobe unit's width, just above it, in that style (was a big "80 x 257 x 58" label)
  function addUnitDims(geom, offsetM, widthM, topY, depthM, text){
    var o = geom.origin, ax = geom.axis, n = geom.normal, y = topY + 0.06, out = depthM;
    PENDING_DIMS.push({ a:{ x:o.x + ax.x * (offsetM + 0.01) + n.x * out, y:y, z:o.z + ax.z * (offsetM + 0.01) + n.z * out },
      b:{ x:o.x + ax.x * (offsetM + widthM - 0.01) + n.x * out, y:y, z:o.z + ax.z * (offsetM + widthM - 0.01) + n.z * out }, text:text });
  }
  function addDimLabel(THREE, group, pos, text){
    var cv = document.createElement("canvas"); cv.width = 220; cv.height = 60;
    var cx = cv.getContext("2d");
    cx.fillStyle = "rgba(255,255,255,.95)"; cx.strokeStyle = "rgba(0,0,0,.14)"; cx.lineWidth = 2; cx.beginPath();
    if (cx.roundRect) cx.roundRect(4, 4, cv.width - 8, cv.height - 8, 16); else cx.rect(4, 4, cv.width - 8, cv.height - 8);
    cx.fill(); cx.stroke();
    cx.fillStyle = "#3b4652"; cx.font = "700 26px 'Kumbh Sans', Arial, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText(text, cv.width / 2, cv.height / 2 + 1);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false, transparent:true, sizeAttenuation:false }));
    sp.scale.set(0.1, 0.027, 1); sp.position.copy(pos); sp.renderOrder = 997;
    group.add(sp);
  }

  // Open/closed state of every drawer and door of locked cabinets, keyed "blockId:part".
  // Lives outside the scene so a rebuild (any edit re-renders the room) keeps them as they were.
  var PART_STATE = {};
  function partEase(p){ return p.cur * p.cur * (3 - 2 * p.cur); }
  function smooth01(x){ x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function applyPart(p){
    var e = partEase(p);
    if (p.kind === "lemans"){
      // Le Mans corner (Töfrahorn): the door swings open first, then the two trays glide out through the
      // opening on a curve — out, a little sideways and turned, settling square in front of the cabinet;
      // the upper tray follows the lower one. Closing plays it backwards.
      p.group.rotation.y = (p.hinge === "left" ? -1 : 1) * 1.75 * smooth01(p.cur * 2.2);
      p.trays.forEach(function(t, i){
        var k = smooth01((p.cur - 0.3 - i * 0.14) / 0.56), arc = Math.sin(Math.PI * k);
        if (t.real){
          // like a real LeMans II, the post stays put: (1) the tray turns 90° about the post out through the opening,
          // (2) steps sideways off the post (the post sat in its notch), (3) runs straight out in front of the opening
          // — it never passes through the post, the door or the side (user, 2026-10-25)
          var k1 = Math.min(1, k / 0.5), k2s = Math.max(0, Math.min(1, (k - 0.5) / 0.2)), k3 = Math.max(0, (k - 0.7) / 0.3), a = t.a1 * k1;
          var cx0 = (t.x0 || 0) - t.px, cz0 = t.z0 - t.pz, ca = Math.cos(a), sa = Math.sin(a);
          var bx = t.px + cx0 * ca + cz0 * sa, bz = t.pz - cx0 * sa + cz0 * ca;
          bx += -Math.sin(t.a1) * t.step * k2s; bz += -Math.cos(t.a1) * t.step * k2s; // away from the post
          t.group.position.set(bx, t.y, bz + t.out * k3);
          t.group.rotation.y = a;
          return;
        }
        t.group.position.set(t.xIn + (t.xOut - t.xIn) * k, t.y, t.z0 + t.outZ * k);
        t.group.rotation.y = t.turn * arc;
      });
      return;
    }
    if (p.kind === "flap"){ // dishwasher door: tips down on its bottom edge, then the racks roll out
      p.group.rotation.x = 1.45 * smooth01(p.cur * 1.6);
      if (p.racks) p.racks.position.z = p.racksOut * smooth01((p.cur - 0.5) / 0.5);
      return;
    }
    if (p.kind === "lift"){ p.group.rotation.x = -1.4 * e; return; }
    if (p.kind === "slide"){ // Topline: out a touch onto its track, then sideways past the other door (left behind, right in front)
      var sdir = p.hinge === "left" ? 1 : -1, sOut = smooth01(p.cur / 0.25);
      p.group.position.z = p.z0 + (p.hinge === "left" ? -0.004 : 0.026) * sOut;
      p.group.position.x = p.x0 + sdir * p.w * 0.92 * smooth01((p.cur - 0.15) / 0.85);
      return;
    }
    if (p.kind === "fold"){ // WingLine: the door folds in half towards its hinge side as it opens
      p.group.rotation.y = (p.hinge === "left" ? -1 : 1) * 1.45 * e;
      p.group.scale.x = 1 - 0.5 * e;
      return;
    } // AVENTOS: the front swings up and out over the cabinet
    if (p.kind === "pocket"){ // Revego: out to 90°, then back into the pocket beside the carcass
      p.group.rotation.y = (p.hinge === "left" ? -1 : 1) * Math.PI / 2 * smooth01(p.cur / 0.5);
      p.group.position.z = p.z0 - p.pocketIn * smooth01((p.cur - 0.5) / 0.5);
      return;
    }
    if (p.kind === "drawer") p.group.position.z = p.slide * e;
    else p.group.rotation.y = (p.hinge === "left" ? -1 : 1) * (p.maxRad || 1.75) * e;
    if (p.hinges) p.hinges.forEach(function(h){ h.visible = e > 0.75; }); // the hinge model is the open hinge
  }
  function stepParts(scene){
    var all = scene.userData.parts || [];
    all.forEach(function(p){
      if (p.cur === p.target && !(p.host && p.cur > 0)) return;
      if (p.host){ // an innskúffa lives behind its host drawer: it shuts with it and never opens through it (user, 2026-10-27)
        var hp = all.find(function(x){ return x.key === p.host; });
        if (hp){ if (hp.target === 0) p.target = 0; if (p.cur > hp.cur){ p.cur = hp.cur; applyPart(p); } if (p.cur === p.target) return; }
      }
      p.cur += (p.target - p.cur) * (p.kind === "lemans" ? 0.045 : 0.14); // a LeMans opens slowly enough to follow the trays
      if (Math.abs(p.target - p.cur) < 0.002) p.cur = p.target;
      applyPart(p);
    });
  }
  // Kíkja inn (owner, 2026-10-27, every room): a right-click on a cabinet opens its doors and drawers without selecting
  // it — an unlocked one (a solid box) is rebuilt in parts first (opts.onPeek), its parts start opening; again closes
  var PEEK_OPEN = {};
  function peekToggle(id, onRebuild){
    if (!THREE_STATE || !id) return;
    var mine = (THREE_STATE.scene.userData.parts || []).filter(function(p){ return p.key.indexOf(id + ":") === 0; });
    if (!mine.length){ if (onRebuild){ PEEK_OPEN[id] = true; Object.keys(PART_STATE).forEach(function(k){ if (k.indexOf(id + ":") === 0) delete PART_STATE[k]; }); onRebuild(id); } return; }
    var open = !mine.some(function(p){ return p.target > 0; });
    if (open) PEEK_OPEN[id] = true; else delete PEEK_OPEN[id];
    mine.forEach(function(p){ p.target = open ? 1 : 0; PART_STATE[p.key] = p; });
  }
  function togglePart(key){
    if (!THREE_STATE) return;
    var p = (THREE_STATE.scene.userData.parts || []).find(function(x){ return x.key === key; });
    if (!p) return;
    if (p.host){ var hp2 = (THREE_STATE.scene.userData.parts || []).find(function(x){ return x.key === p.host; }); if (hp2 && !hp2.target) return; } // behind a closed drawer: nothing to open
    p.target = p.target ? 0 : 1;
    PART_STATE[key] = p;
  }

  // Open (1) or close (0) every drawer and door in the scene at once ("Opna allt" in inspect mode)
  // jump every part straight to closed/open (no animation) — the wizard's hover preview starts closed, then opens
  function snapParts(open){
    if (!THREE_STATE) return;
    (THREE_STATE.scene.userData.parts || []).forEach(function(p){ p.cur = p.target = open ? 1 : 0; PART_STATE[p.key] = p; applyPart(p); });
  }
  // the Efni drawer page (owner, 2026-10-27): the top drawer of the scene pulled out to `amount` (0–1), animated
  function peekTopDrawer(amount){
    if (!THREE_STATE) return false;
    var V = new window.__THREE__.Vector3(), best = null, by = -Infinity;
    (THREE_STATE.scene.userData.parts || []).forEach(function(p){ if (p.kind !== "drawer" || !p.group) return; p.group.getWorldPosition(V); if (V.y > by){ by = V.y; best = p; } });
    if (!best) return false;
    best.target = amount; PART_STATE[best.key] = best; return true;
  }
  function setAllParts(open){
    if (!THREE_STATE) return 0;
    var list = THREE_STATE.scene.userData.parts || [];
    list.forEach(function(p){ p.target = open ? 1 : 0; PART_STATE[p.key] = p; });
    return list.length;
  }

  // The parts of a locked cabinet, in its own frame (x along the wall, z out of it):
  // shelves, then per front a 20 mm slab + handle that slides out (drawer, with a
  // real-height Legra/Merivo box behind it) or swings on its hinge (door).
  function addArticulated(THREE, scene, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta, frontMat, pickables){
    var CD = depthM - FRONT_T, T = 0.018;
    var frame = new THREE.Group();
    frame.position.set(geom.origin.x + geom.axis.x * (offsetM + widthM / 2), 0, geom.origin.z + geom.axis.z * (offsetM + widthM / 2));
    frame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(geom.axis.x, 0, geom.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    group.add(frame);
    var drawers = interior && interior.mode === "skuffur" ? interior.count : 0;
    // shelves where Rakel put them in Smíða (or spread evenly); the oven and the búrskápur draw their own below.
    // A tall drawer unit's door-above-drawers zone can hold shelves too — hasShelfLayout decides (not `drawers`
    // alone), so a non-tall drawer unit (no zone left) still gets none.
    var shelfList = meta.oven || (meta.burCodes && meta.burCodes.length && !meta.innerFree) ? [] :
      meta.shelfBlock && hasShelfLayout(meta.shelfBlock) ? shelfLayoutOf(meta.shelfBlock, bodyH * 1000, meta.drawerSystem) :
      drawers ? [] :
      (function(n){ var o = []; for (var k = 1; k <= n; k++) o.push({ mm:bodyH * 1000 * k / (n + 1) + 9 }); return o; })(meta.shelves || 0);
    // open the door and drag a shelf / fataslá up or down, as in an open cabinet (user, 2026-10-26) — only when the
    // list is the block's own layout (the even-spread fallback has nothing to write back to)
    var dragShelves = !!(pickables && meta.shelfBlock && hasShelfLayout(meta.shelfBlock) && !meta.oven && !(meta.burCodes && meta.burCodes.length && !meta.innerFree));
    function makeDraggable(mesh, kind, idx){
      mesh.userData = { kind:kind + "-item", itemKind:kind, blockId:meta.shelfBlock.id, idx:idx, locked:false, bodyBaseY:bodyBase, widthM:widthM, ax:geom.axis.x, az:geom.axis.z };
      pickables.push(mesh);
      var ed = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color:SELECT_COLOR, transparent:true, opacity:0 }));
      ed.position.copy(mesh.position); ed.quaternion.copy(mesh.quaternion); frame.add(ed);
      mesh.userData.edgesObj = ed;
    }
    shelfList.forEach(function(shf, si){
      var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, CD - 0.03), meta.openMat); // shelves reach the sides
      if (shf.tray) addTrayRim(board, widthM - 2 * CARCASS_T - 0.001, CD - 0.03, frontMat || meta.openMat);
      board.position.set(0, bodyBase + shf.mm / 1000 - 0.009, (CD - 0.03) / 2 + 0.005);
      board.castShadow = true; board.receiveShadow = true;
      frame.add(board);
      if (dragShelves && !shf.fixed) makeDraggable(board, "shelf", si);
    });
    // Fataslá (clothes rail, 2026-10-15): same zone/gating as shelfList, a plain steel rod across the width.
    var railList = meta.oven || (meta.burCodes && meta.burCodes.length && !meta.innerFree) ? [] :
      meta.shelfBlock && meta.shelfBlock.type && CATALOG[meta.shelfBlock.type] && CATALOG[meta.shelfBlock.type].railRange ?
        railLayoutOf(meta.shelfBlock, bodyH * 1000, meta.drawerSystem) : [];
    if (railList.length){
      var railMat = railMatOf(meta.shelfBlock);
      railList.forEach(function(rl, ri){
        var rod = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_D_MM / 2000, RAIL_D_MM / 2000, widthM - 2 * CARCASS_T - 0.02, 16), railMat);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, bodyBase + rl.mm / 1000, (CD - 0.03) / 2 + 0.005);
        rod.castShadow = true;
        frame.add(rod);
        if (pickables && meta.shelfBlock) makeDraggable(rod, "rail", ri);
      });
    }
    // the fronts of this cabinet
    var fronts = [];
    if (drawers){
      var fr = interior.fractions && interior.fractions.length === drawers - 1 ? interior.fractions : null, zt = interior.topDoorFr || 1;
      for (var i = 0; i < drawers; i++) fronts.push({ y0:fr ? (i === 0 ? 0 : fr[i - 1]) : i / drawers * zt, y1:fr ? (i === drawers - 1 ? zt : fr[i]) : (i + 1) / drawers * zt, drawer:true });
      if (interior.topDoorFr) fronts.push({ y0:interior.topDoorFr, y1:1 }); // tall unit: the door above the drawers
    } else if (meta.splitFr && !meta.corner) pushSplitFronts(fronts, meta.splitFr);
    else if (meta.tall && !meta.corner && meta.split){ var sp = meta.split; fronts.push({ y0:0, y1:sp }, { y0:sp, y1:1 }); }
    else fronts.push({ y0:0, y1:1 });
    var sysKey = meta.drawerSystem || "legra";
    var dcodes = drawers && interior.codes && interior.codes.length === drawers ? interior.codes : null; // bottom → top
    // A door zone over 600 mm still splits into two leaves even when there are drawers below it (owner,
    // 2026-10-14) — drawer fronts are already routed to their own "if (f.drawer)" branch below regardless
    // of this flag, so dropping the old "!drawers" gate here only affects the door-zone front, correctly.
    var wide = twoDoors(widthM * 1000, meta.zone === "wall") && !meta.fridge && !meta.corner;
    var parts = (scene.userData.parts = scene.userData.parts || []);
    // Tækjaskápar (owner, 2026-10-27): a wall unit with an AVENTOS lift opens UP (one front, tips up on its top edge);
    // doors with the Rennihurð í hlið spec (smida.doors type "pocket") turn out 90° and then slide back into the side
    var mvB = meta.shelfBlock, doorMove = !mvB || meta.corner || meta.fridge || meta.oven ? null
      : mvB.doorSys === "renni" ? "slide" : mvB.doorSys === "felli" ? "fold" // wardrobe Flóknari kerfi (owner, 2026-10-27)
      : meta.zone === "wall" && (mvB.aventos || (mvB.smida && Array.isArray(mvB.smida.doors) && mvB.smida.doors.some(function(d){ return d && d.type === "lift"; }))) ? "lift"
      : mvB.smida && Array.isArray(mvB.smida.doors) && mvB.smida.doors.some(function(d){ return d && d.type === "pocket"; }) ? "pocket" : null;

    function makeLeaf(idx, cxL, w, y0, y1, hinge, f, fi){
      var key = meta.blockId + ":" + idx;
      var g = new THREE.Group(), pivotX = f.drawer || hinge === "bottom" || hinge === "top" ? cxL : (hinge === "left" ? cxL - w / 2 : cxL + w / 2), fh = y1 - y0;
      g.position.set(pivotX, 0, 0);
      var pmeta = Object.assign({}, meta, { isPart:true, partKey:key }), meshes = [];
      // a wardrobe's drawer: dragged up/down its top edge follows the pointer (2.5 cm steps, user 2026-10-26) — see onDrawerResize
      if (f.drawer && ((wardrobeScene && meta.tall && meta.shelfBlock) || drawerDragAll)){ pmeta.drawerIdx = fi; pmeta.drawerBotY = y0; pmeta.drawerTopY = y1; pmeta.ax = geom.axis.x; pmeta.az = geom.axis.z; pmeta.bodyBaseY = bodyBase; pmeta.widthM = w; }
      var hcfgA = meta.handle && window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[meta.handle];
      var hstyleA = (HANDLES[meta.handle] || {}).style;
      var vertA = !!(meta.tall && !f.drawer && !meta.corner && hstyleA !== "knob");
      var freeSideA = hinge === "left" ? "right" : "left", stripA = hcfgA && hcfgA.kind === "jey" ? (hcfgA.stripMm || 27) / 1000 : 0;
      // a Jey profile REPLACES stripMm of the front: the slab is that much shorter (top strip) or narrower (side strip on tall units)
      var slabW = w - 0.004 - (vertA ? stripA : 0), slabH = fh - (vertA ? 0 : stripA);
      var notchA = hcfgA && hcfgA.kind === "hexxa" && !vertA ? { len:Math.max(0.05, slabW - 2 * (hcfgA.marginMm || 50) / 1000), h:0.03 } : null;
      if (hcfgA && hcfgA.kind === "hexxa" && vertA && wardrobeScene){ // a wardrobe door: the 40 cm Hexxa notch is cut into the opening edge at hand height (same numbers as addFrontDetails)
        var hmA = (hcfgA.marginMm || 50) / 1000, hxLA = Math.min(0.4, fh - 2 * hmA), hxYA = Math.max(y0 + hmA + hxLA / 2, Math.min(y1 - hmA - hxLA / 2, 1.05));
        notchA = { side:freeSideA, len:hxLA, h:0.03, at:hxYA - y0 };
      }
      var wallA = meta.zone === "wall"; // wall units: Jey strip / Hexxa notch along the BOTTOM edge
      var slabCx = cxL + (vertA ? (freeSideA === "right" ? -stripA / 2 : stripA / 2) : 0), slabCy = (y0 + y1) / 2 + (vertA ? 0 : (wallA ? stripA / 2 : -stripA / 2));
      var grainOff = { u:offsetM + widthM / 2 + slabCx - slabW / 2, v:slabCy - slabH / 2 }; // continuous grain (see scaleFrontUV)
      var slab = hcfgA && hcfgA.kind === "jey" && (hcfgA.profileMm || 0) > (hcfgA.stripMm || 27)
        ? frontSlabLip(THREE, slabW, slabH, frontMat, (hcfgA.profileMm - (hcfgA.stripMm || 27)) / 1000, 0.002, vertA ? freeSideA : "top", grainOff)
        : frontSlab(THREE, slabW, slabH, frontMat, notchA, grainOff);
      if (wallA && !vertA && (notchA || stripA)) slab.rotation.z = Math.PI; // the notch/lip edge turned to the bottom
      slab.position.set(slabCx - pivotX, slabCy, CD + FRONT_T / 2);
      slab.castShadow = true; slab.receiveShadow = true;
      g.add(slab); meshes.push(slab);
      if (meta.handle){
        var tmp = new THREE.Group();
        var fake = { origin:{ x:cxL - w / 2, z:0 }, axis:{ x:1, z:0 }, normal:{ x:0, z:1 }, lenM:w };
        addFrontDetails(THREE, tmp, fake, 0, w, fh, y0, depthM, { mode:"skuffur", count:1 }, meta.handle, false, meta.zone === "wall" || (meta.tall && fi > 0 && !f.drawer) || (!f.drawer && (!!meta.handleBottom || y0 >= HIGH_DOOR_M)), 0.55, { vertical:vertA, freeSide:freeSideA, slab:true }, frontMat); // a door hung high (over the machines, a top box): its handle at the bottom edge (owner, 2026-10-27)
        tmp.children.slice().forEach(function(ch){ ch.position.x -= pivotX; g.add(ch); if (ch.isMesh) meshes.push(ch); else ch.traverse(function(o){ if (o.isMesh) meshes.push(o); }); });
      }
      // a front slot with no drawer behind it: a sink's fixed top front, or any "P" (Föst framhlið) position
      var fixedTop = f.drawer && ((meta.sinkFixedTop && fi === drawers - 1) || (dcodes && dcodes[fi] === FIXED_FRONT_CODE));
      if (f.drawer && !fixedTop){
        var code = dcodes ? dcodes[fi] : null, sysD = DRAWER_CODES[sysKey];
        var side = code && sysD && sysD.side[code] ? sysD.side[code] : Math.max(50, Math.min(200, Math.round(fh * 1000 - 55)));
        side = Math.max(40, Math.min(side, fh * 1000 - 40));
        // an inner drawer (innskúffa) hides behind the tallest front: that drawer's own box drops low (a pot drawer)
        // and the inner drawer sits above it, fixed in the carcass — open the front and it's there, pull it on its own
        var innerAt = interior && interior.inner ? (dcodes ? innerHostIndex(dcodes, sysKey, interior.inner, interior.innerAt) : drawers - 1) : -1;
        var innerCode = interior && interior.inner === "IK" ? "K" : "M", innerSide = fi === innerAt ? ((sysD && sysD.side[innerCode]) || 90) : 0;
        var boxCode = code;
        if (innerSide){ // the drawer under it is a low one (Blum's own low sides, never the tall code's)
          side = Math.max(40, Math.min(side, fh * 1000 - innerSide - 60));
          boxCode = null;
          (sysD ? sysD.codes : []).forEach(function(cd){ var sd = sysD.side[cd] || 0; if (sd && sd <= side && (!boxCode || sd > sysD.side[boxCode])) boxCode = cd; });
          if (boxCode) side = sysD.side[boxCode];
        }
        var real = code && !innerSide ? getModel("drawers", sysKey + "_" + code) : null, bx;
        if (real){
          var rb = new THREE.Box3().setFromObject(real), rs = rb.getSize(new THREE.Vector3());
          bx = new THREE.Group(); real.position.set(0, 0, -rb.max.z); bx.add(real);
          bx.position.set(0, drawerBoxY(y0, y1, rs.y), CD - 0.005);
        } else {
          bx = buildDrawerBox(THREE, sysKey, meta.carcassKey, side, Math.max(0.2, widthM - 2 * T - 0.026), Math.max(0.2, CD - BACK_T - 0.01), boxCode, widthM - 2 * CARCASS_T);
          bx.position.set(0, drawerBoxY(y0, y1, side / 1000), CD - 0.005);
        }
        if (meta.bins && fi === 0 && !fixedTop) addBins(THREE, bx, innerSide ? fh - innerSide / 1000 - 0.06 : fh, meta.widthMm || widthM * 1000);
        g.add(bx); bx.traverse(function(o){ if (o.isMesh) meshes.push(o); });
        if (bx.userData && bx.userData.runners){ var rgR = bx.userData.runners; rgR.position.copy(bx.position); frame.add(rgR); } // runners stay in the cabinet
        if (innerSide){
          var ikey = meta.blockId + ":i" + idx, ig = new THREE.Group(), imeshes = [], ibw = Math.max(0.2, widthM - 2 * T - 0.026), ibd = Math.max(0.2, CD - 0.045 - BACK_T - 0.01);
          var iy = Math.min(y1 - 0.012 - innerSide / 1000 - 0.02, bx.position.y + side / 1000 + 0.025);
          var ib = buildDrawerBox(THREE, sysKey, meta.carcassKey, innerSide, ibw, Math.max(0.2, CD - 0.06 - BACK_T - 0.01), innerCode, widthM - 2 * CARCASS_T);
          ib.position.set(0, iy, CD - 0.06); // set back behind the big front
          ig.add(ib); ib.traverse(function(o){ if (o.isMesh) imeshes.push(o); });
          if (ib.userData && ib.userData.runners){ var rgI = ib.userData.runners; rgI.position.copy(ib.position); frame.add(rgI); }
          var ifh = innerSide / 1000 + 0.03, ifr = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * T - 0.006, ifh, 0.016), frontMat); // its own front, in the front material
          ifr.position.set(0, iy + ifh / 2 - 0.005, CD - 0.052); ifr.castShadow = true; ifr.receiveShadow = true; ig.add(ifr); imeshes.push(ifr);
          var ipm = Object.assign({}, meta, { isPart:true, partKey:ikey });
          imeshes.forEach(function(m){ m.userData = ipm; pickables.push(m); });
          var prevI = PART_STATE[ikey];
          var partI = { key:ikey, host:key, group:ig, kind:"drawer", slide:Math.min(0.3, CD * 0.5), cur:prevI ? prevI.cur : 0, target:prevI ? prevI.target : (PEEK_OPEN[meta.blockId] ? 1 : 0) };
          PART_STATE[ikey] = partI; parts.push(partI); applyPart(partI);
          frame.add(ig);
        }
      }
      // Blum CLIP top hinges (user, 2026-10-25): the model, split in two — arm + plate fixed on the inside of the side,
      // the cup (its own mesh from the same file) on the door. The file is the hinge open at 90°, so a hinged door opens
      // to 90° and, at that angle, the cup sits exactly where the model has it — flush in the back of the door — and closes
      // with the door. The arm only shows while the door is open.
      // Silver; 2, 3 on doors over 1 m, 4 over 1.8 m.
      var leafHinges = [], hingeOpenRad = null;
      if (SHOW_HINGES && !f.drawer && hinge !== "bottom"){ // off (user, 2026-10-25: "of mikið vesen" — never looked good enough)
        var hgM = applModel("hingeArm"), cpM = hgM && applModel("hingeCup");
        if (hgM && cpM){
          if (!HINGE_MAT) HINGE_MAT = new THREE.MeshStandardMaterial({ color:0xadb1b6, metalness:0.85, roughness:0.32 }); // a touch darker (user, 2026-10-25)
          var nH = fh > 1.8 ? 4 : fh > 1.0 ? 3 : 2, leftH = hinge === "left", sgnD = leftH ? -1 : 1;
          var sideX = leftH ? cxL - w / 2 + CARCASS_T : cxL + w / 2 - CARCASS_T; // inside face of the side the door hangs on
          var pzD = CD + FRONT_T; hingeOpenRad = Math.PI / 2;
          var doorOpen = new THREE.Matrix4().compose(new THREE.Vector3(pivotX, 0, pzD), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sgnD * hingeOpenRad), new THREE.Vector3(1, 1, 1));
          var doorOpenInv = doorOpen.clone().invert();
          for (var hk = 0; hk < nH; hk++){
            var armM = hk ? applModel("hingeArm") : hgM, cupM = hk ? applModel("hingeCup") : cpM;
            var hy = y0 + 0.1 + (fh - 0.2) * (nH > 1 ? hk / (nH - 1) : 0);
            function posed(m){ // the same pose for both halves, from the model's own measurements (mirrored for a right-hand door):
              // the plate's back on the inside of the side, the cup's flange in the plane of the open door's back, and the
              // cup's centre 22.5 mm out along the door from its hinge edge (that lands the plate right at the side's front edge)
              var wrap = new THREE.Group();
              m.obj.traverse(function(o){ if (o.isMesh) o.material = HINGE_MAT; });
              m.obj.rotation.z = Math.PI; m.obj.position.y = m.h; // turned the other way round: its back toward the door, not into the cabinet (user, 2026-10-25)
              wrap.add(m.obj);
              if (!leftH) wrap.scale.x = -1;
              wrap.position.set(sideX + (leftH ? 0.006 : -0.006), hy - 0.028, pzD + 0.0225 - 0.0375);
              wrap.updateMatrix(); wrap.updateMatrixWorld(true);
              return wrap;
            }
            var arm = posed(armM), cupW = posed(cupM);
            // the cup into door space (as the door stands open at 90°), then flush with the door's back
            var lm = doorOpenInv.clone().multiply(cupW.matrix), cupD = new THREE.Group();
            lm.decompose(cupD.position, cupD.quaternion, cupD.scale);
            var cupMesh = cupW.children[0]; cupW.remove(cupMesh); cupD.add(cupMesh);
            cupD.position.z += pzD + 0.008; // sunk 8 mm into the door, its flat top flush with the back (user, 2026-10-25); + pzD: the door's children get −pz further down
            g.add(cupD); cupD.traverse(function(o){ if (o.isMesh) meshes.push(o); });
            arm.visible = false; frame.add(arm); leafHinges.push(arm);
          }
        }
      }
      if (!f.drawer){ // a door turns about the front corner of its hinge edge (concealed hinges carry it forward): pivot at z = CD + front
        var pz = hinge === "bottom" ? CD : CD + FRONT_T; // (a flap still tips on its back edge)
        g.children.forEach(function(ch){ ch.position.z -= pz; });
        g.position.z = pz;
        if (hinge === "bottom"){ g.children.forEach(function(ch){ ch.position.y -= y0; }); g.position.y = y0; } // a flap pivots on its lower edge
        if (hinge === "top"){ g.children.forEach(function(ch){ ch.position.y -= y1; }); g.position.y = y1; } // a lift front tips up on its top edge
      }
      meshes.forEach(function(m){ m.userData = pmeta; pickables.push(m); });
      var prev = PART_STATE[key];
      var maxDeg = meta.doorLimit && meta.doorLimit[hinge] != null ? meta.doorLimit[hinge] : DOOR_OPEN_DEG; // stops at a wall / corner
      if (hingeOpenRad != null) maxDeg = Math.min(maxDeg, hingeOpenRad * 180 / Math.PI); // a door with the hinge model opens to the model's own 90°
      var part = { key:key, group:g, kind:f.drawer ? "drawer" : hinge === "bottom" ? "flap" : hinge === "top" ? "lift" : doorMove === "pocket" ? "pocket" : doorMove === "slide" ? "slide" : doorMove === "fold" ? "fold" : "door", hinge:hinge, z0:g.position.z, x0:g.position.x, w:w, pocketIn:Math.max(0.1, CD - 0.06), maxRad:maxDeg * Math.PI / 180, slide:fixedTop ? 0 : Math.min(0.34, CD * 0.6), cur:prev ? prev.cur : 0, target:prev ? prev.target : (PEEK_OPEN[meta.blockId] ? 1 : 0), hinges:leafHinges };
      PART_STATE[key] = part; parts.push(part); applyPart(part);
      frame.add(g);
    }

    var idx = 0;
    var steel = function(){ return new THREE.MeshStandardMaterial({ color:0xc3c7cc, metalness:0.85, roughness:0.32, side:THREE.DoubleSide }); };
    function addBox(w, h, d, x, y, z, mat){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; frame.add(m); return m; }

    // Uppþvottavél (UÞVFR): one integrated front that tips down; a stainless tub with two racks that roll out
    if (meta.dishwasher){
      var st = steel(), tw = widthM - 2 * T - 0.01, td = CD - 0.04, tb = bodyBase + 0.01, th = bodyH - 0.03;
      addBox(tw, th, 0.004, 0, tb + th / 2, 0.02, st);                                 // back
      addBox(0.004, th, td, -tw / 2, tb + th / 2, 0.02 + td / 2, st);                   // sides
      addBox(0.004, th, td, tw / 2, tb + th / 2, 0.02 + td / 2, st);
      addBox(tw, 0.004, td, 0, tb + th, 0.02 + td / 2, st);                              // top
      addBox(tw, 0.004, td, 0, tb + 0.005, 0.02 + td / 2, st);                           // floor
      var racks = new THREE.Group(), wire = new THREE.MeshStandardMaterial({ color:0x9aa0a6, metalness:0.6, roughness:0.4 });
      var dwLo = applModel("dwLower"), dwUp = dwLo && applModel("dwUpper");
      if (dwLo && dwUp){ // the real baskets (user's model), fitted inside the tub
        [[dwLo, tb + 0.04], [dwUp, tb + th * 0.5]].forEach(function(r){
          var k = (tw - 0.03) / r[0].w; r[0].obj.scale.set(k, k, (td - 0.05) / r[0].d);
          r[0].obj.position.set(0, r[1], 0.02 + td / 2); racks.add(r[0].obj);
        });
      }
      (dwLo && dwUp ? [] : [[tb + 0.06, 0.2], [tb + th * 0.55, 0.15]]).forEach(function(r){ // drawn baskets until the model is in: rim, floor rods, tines
        var rw = tw - 0.04, rd = td - 0.05, y = r[0], rh = r[1];
        [[rw, 0.006, 0.006, 0, y, 0], [rw, 0.006, 0.006, 0, y, rd], [0.006, 0.006, rd, -rw / 2, y, rd / 2], [0.006, 0.006, rd, rw / 2, y, rd / 2],
         [rw, 0.004, 0.004, 0, y + rh, 0], [rw, 0.004, 0.004, 0, y + rh, rd], [0.004, 0.004, rd, -rw / 2, y + rh, rd / 2], [0.004, 0.004, rd, rw / 2, y + rh, rd / 2]].forEach(function(b){
          var m = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), wire); m.position.set(b[3], b[4], b[5] + 0.04); racks.add(m);
        });
        for (var rx = -rw / 2 + 0.03; rx < rw / 2 - 0.02; rx += 0.035){
          var rod = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, rd), wire); rod.position.set(rx, y, rd / 2 + 0.04); racks.add(rod);
          var tine = new THREE.Mesh(new THREE.BoxGeometry(0.003, rh * 0.6, 0.003), wire); tine.position.set(rx, y + rh * 0.3, rd * 0.55 + 0.04); racks.add(tine);
        }
      });
      // a few dishes in the baskets so it reads as a dishwasher (user, 2026-10-25): plates standing in the lower one, cups upside down above
      var china = new THREE.MeshStandardMaterial({ color:0xf6f6f3, roughness:0.25 }), glassM = new THREE.MeshStandardMaterial({ color:0xdde8ee, roughness:0.05, transparent:true, opacity:0.5 });
      var rwP = tw - 0.04, rdP = td - 0.05;
      for (var pz = 0.06; pz < rdP - 0.03; pz += 0.035){
        var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.008, 32), china); plate.rotation.z = Math.PI / 2;
        plate.position.set(-rwP * 0.18, tb + 0.06 + 0.115, pz + 0.04); racks.add(plate);
      }
      [-0.28, -0.1, 0.08, 0.26].forEach(function(f, k){
        var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 20, 1, true), k % 2 ? glassM : china); cup.material.side = THREE.DoubleSide;
        cup.position.set(rwP * f, tb + th * 0.55 + 0.05, rdP * (k < 2 ? 0.35 : 0.7) + 0.04); racks.add(cup);
      });
      frame.add(racks);
      makeLeaf(idx++, 0, widthM, bodyBase + 0.0015, bodyBase + bodyH - 0.0015, "bottom", { y0:0, y1:1 }, 0);
      var dwPart = parts[parts.length - 1]; dwPart.racks = racks; dwPart.racksOut = td * 0.8; applyPart(dwPart);
      return;
    }

    // Ofnaskápur: the real Útfærsla — drawers (or a door, OFN7) under the oven, the oven, and a cabinet above
    // it with two vent shelves behind its door
    if (meta.oven){
      var ovCodesA = meta.ovenCodes || [], ovBA = meta.ovenBlock || {}, ovHmm = ovenHOf(ovBA, meta.ovenCat);
      var zoneMm = meta.lowOven ? Math.max(50, bodyH * 1000 - ovHmm - 3) : ovenUnderOf(ovBA, meta.drawerSystem, bodyH * 1000);
      var ovFrA = meta.lowOven ? [zoneMm] : ovCodesA.length ? stackFrontsMm({ frontsMm:meta.ovenFrontsMm }, ovCodesA, zoneMm) : null;
      var ovY = bodyBase + zoneMm / 1000, ovH = ovHmm / 1000, wideA = widthM > WIDE_DOOR_M, hingeA = meta.hingeRight ? "right" : "left";
      if (ovFrA){
        dcodes = ovCodesA;
        var accA = bodyBase;
        ovFrA.forEach(function(h, i){ makeLeaf(idx++, 0, widthM, accA + 0.0015, accA + h / 1000 - 0.0015, "left", { drawer:true }, i); accA += h / 1000; }); // slots: front = slot − 3
        if (meta.ovenInner){ // "+IM"/"+IK": an inner drawer riding inside the top drawer (OFN2)
          var topPart = parts[parts.length - 1], sysO = DRAWER_CODES[sysKey], iCode = meta.ovenInner === "IK" ? "K" : "M", iSide = (sysO && sysO.side[iCode]) || 90;
          var ibO = buildDrawerBox(THREE, sysKey, meta.carcassKey, iSide, Math.max(0.18, widthM - 2 * T - 0.06), Math.max(0.2, CD - 0.05 - BACK_T - 0.01), null);
          ibO.position.set(0, accA - DRAWER_GAP_MM / 1000 - 0.02 - iSide / 1000, CD - 0.045);
          topPart.group.add(ibO);
          var pmO = Object.assign({}, meta, { isPart:true, partKey:topPart.key });
          ibO.traverse(function(o){ if (o.isMesh){ o.userData = pmO; pickables.push(o); } });
        }
      } else makeLeaf(idx++, 0, widthM, bodyBase + 0.0015, ovY - 0.0015, hingeA, { y0:0, y1:1 }, 0);
      // the oven itself: dark body in the niche, glass door, control strip, bar handle
      var dark = new THREE.MeshStandardMaterial({ color:0x1c1d20, roughness:0.4, metalness:0.4 });
      (ovH > 1 ? [[ovY, 0.595], [ovY + 0.595, 0.455]] : [[ovY, ovH]]).forEach(function(seg){ // 60+45 = two ovens
        var sy = seg[0], sh = seg[1], ovA = applModel("oven");
        if (ovA){ // the real oven, its face flush with the fronts
          var od = CD + FRONT_T - 0.01; ovA.obj.scale.set((widthM - 0.006) / ovA.w, (sh - 0.004) / ovA.h, od / ovA.d);
          ovA.obj.position.set(0, sy + 0.002, CD + FRONT_T - od / 2); frame.add(ovA.obj); return;
        }
        addBox(widthM - 2 * CARCASS_T - 0.004, sh - 0.004, CD - 0.02, 0, sy + sh / 2, (CD - 0.02) / 2 + 0.01, dark);
        // the door: black glass with a window onto the warm-lit cavity, a steel trim, then the control strip (user, 2026-10-25)
        var doorH = sh - 0.13, doorY = sy + doorH / 2 + 0.004, zf = CD + FRONT_T;
        addBox(widthM - 0.006, doorH, FRONT_T, 0, doorY, CD + FRONT_T / 2, new THREE.MeshStandardMaterial({ color:0x111214, roughness:0.08, metalness:0.55 }));
        var winW = widthM - 0.14, winH = Math.max(0.12, doorH - 0.16);
        addBox(winW, winH, 0.002, 0, doorY + 0.01, zf + 0.001, new THREE.MeshBasicMaterial({ color:0x3a2a1c }));                     // the cavity seen through the glass
        addBox(winW * 0.86, 0.004, 0.002, 0, doorY + 0.01 + winH * 0.1, zf + 0.0015, new THREE.MeshBasicMaterial({ color:0x6b5038 })); // the rack
        addBox(winW, winH, 0.002, 0, doorY + 0.01, zf + 0.0025, new THREE.MeshStandardMaterial({ color:0x202226, roughness:0.05, metalness:0.4, transparent:true, opacity:0.55 }));
        var trim = new THREE.MeshStandardMaterial({ color:0xb9bec4, metalness:0.85, roughness:0.28 });
        addBox(widthM - 0.006, 0.004, 0.003, 0, sy + doorH + 0.006, zf + 0.0015, trim);
        addBox(widthM - 0.006, 0.115, FRONT_T, 0, sy + sh - 0.06, CD + FRONT_T / 2, new THREE.MeshStandardMaterial({ color:0x1a1b1e, roughness:0.3, metalness:0.5 }));
        addBox(0.1, 0.03, 0.002, 0, sy + sh - 0.06, zf + 0.001, new THREE.MeshBasicMaterial({ color:0x0c0d0f }));                         // display
        addBox(0.05, 0.011, 0.002, 0, sy + sh - 0.06, zf + 0.0015, new THREE.MeshBasicMaterial({ color:0xffb347 }));
        [-1, 1].forEach(function(sd){ // two knobs
          var kn = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.02, 28), trim); kn.rotation.x = Math.PI / 2; kn.position.set(sd * (widthM / 2 - 0.09), sy + sh - 0.06, zf + 0.01); kn.castShadow = true; frame.add(kn);
        });
        addBox(widthM * 0.7, 0.018, 0.028, 0, sy + sh - 0.145, CD + FRONT_T + 0.014, trim);
      });
      if (meta.lowOven) return; // low oven (OFN6): the oven sits right under the worktop, nothing above
      // cabinet above: a fixed shelf right on top of the oven, then 2 vent shelves (loftunarhillur) — each
      // with one slot through it at the back: 60 mm from the back, 100 mm in from both sides, 60 mm wide
      // (user, 2026-10-05). Every shelf reaches the carcass sides.
      var upY0 = ovY + ovH + 0.003, upY1 = bodyBase + bodyH, shW = widthM - 2 * CARCASS_T - 0.001, shD = CD - 0.02 - BACK_T;
      addBox(shW, 0.018, shD, 0, ovY + ovH + 0.009, BACK_T + shD / 2 + 0.001, meta.openMat); // Loftunartoppur
      var vent = new THREE.Shape(); // x across, y = distance from the back
      vent.moveTo(-shW / 2, 0); vent.lineTo(shW / 2, 0); vent.lineTo(shW / 2, shD); vent.lineTo(-shW / 2, shD); vent.lineTo(-shW / 2, 0);
      // slots milled through it: 60 mm long at 45°, one every 32 mm across the width (100 mm in from the
      // sides), in a band 60 mm from the back (user, 2026-10-05)
      var slotHalf = 0.03, slotW = 0.008, dx = slotHalf * Math.SQRT1_2, edgeX = widthM / 2 - 0.1, cyS = 0.06 + dx;
      var ux = Math.SQRT1_2, uy = Math.SQRT1_2, px = -uy * slotW / 2, py = ux * slotW / 2; // along / across the slot
      for (var sxC = -edgeX + dx; sxC <= edgeX - dx + 1e-6; sxC += 0.032){
        var hp = new THREE.Path(), ax = sxC - ux * slotHalf, ay = cyS - uy * slotHalf, bx2 = sxC + ux * slotHalf, by2 = cyS + uy * slotHalf;
        hp.moveTo(ax + px, ay + py); hp.lineTo(bx2 + px, by2 + py); hp.lineTo(bx2 - px, by2 - py); hp.lineTo(ax - px, ay - py); hp.lineTo(ax + px, ay + py);
        vent.holes.push(hp);
      }
      var ventGeo = new THREE.ExtrudeGeometry(vent, { depth:0.018, bevelEnabled:false });
      ventGeo.rotateX(Math.PI / 2); // shape y → depth into the room, thickness downwards from y = 0
      // the shelves Rakel set in Smíða (default: 2 loose at thirds); fixed ones are plain boards, loose ones vent shelves
      ovenShelvesOf(ovBA, meta.drawerSystem, bodyH * 1000).forEach(function(sh){
        var top = bodyBase + sh.mm / 1000;
        if (sh.fixed){ addBox(shW, 0.016, shD, 0, top - 0.008, BACK_T + shD / 2 + 0.001, meta.openMat); return; }
        var vm = new THREE.Mesh(ventGeo, meta.openMat);
        vm.position.set(0, top, BACK_T + 0.001); vm.castShadow = true; vm.receiveShadow = true; frame.add(vm);
      });
      if (wideA){
        makeLeaf(idx++, -widthM / 4, widthM / 2, upY0 + 0.0015, upY1 - 0.0015, "left", { y0:0, y1:1 }, 1);
        makeLeaf(idx++, widthM / 4, widthM / 2, upY0 + 0.0015, upY1 - 0.0015, "right", { y0:0, y1:1 }, 1);
      } else makeLeaf(idx++, 0, widthM, upY0 + 0.0015, upY1 - 0.0015, hingeA, { y0:0, y1:1 }, 1);
      return;
    }

    var partsBeforeFronts = parts.length;
    // the joint where drawers meet a door (and every joint in a wardrobe) reads as a real shadow line, even with white
    // fronts on a white carcass (owner, 2026-10-27: under-door drawers looked like handles on the door)
    fronts.forEach(function(f, fi){
      if (!fi || !(wardrobeScene || !!fronts[fi - 1].drawer !== !!f.drawer)) return;
      var sl = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T + 0.004, 0.004, 0.012), new THREE.MeshStandardMaterial({ color:0x1d1d1f, roughness:0.9 }));
      sl.position.set(0, bodyBase + bodyH * f.y0, CD - 0.006); frame.add(sl);
    });
    fronts.forEach(function(f, fi){
      var y0 = bodyBase + bodyH * f.y0 + 0.0015, y1 = bodyBase + bodyH * f.y1 - 0.0015;
      if (f.drawer) makeLeaf(idx++, 0, widthM, y0, y1, "left", f, fi);
      else if (meta.corner){
        var left = meta.doorSide === "left", hw = widthM / 2;
        makeLeaf(idx++, left ? -hw / 2 : hw / 2, hw, y0, y1, left ? "right" : "left", f, fi); // hinges always on the middle side, the door opens over the blind panel (user, 2026-10-24)
        if (meta.leMans) addLeMansTrays(THREE, frame, parts[parts.length - 1], left ? -hw / 2 : hw / 2, hw, CD, bodyBase, bodyH, left, meta, pickables);
        var blind = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.004, y1 - y0, FRONT_T), frontMat); // fixed blind panel on the other half
        scaleFrontUV(blind.geometry, hw - 0.004, y1 - y0, frontMat.userData && frontMat.userData.tile, false, { u:offsetM + widthM / 2 + (left ? 0 : -hw), v:y0 });
        blind.position.set(left ? hw / 2 : -hw / 2, (y0 + y1) / 2, CD + FRONT_T / 2); blind.castShadow = true;
        frame.add(blind);
      } else if (doorMove === "lift") makeLeaf(idx++, 0, widthM, y0, y1, "top", f, fi); // one lift front, however wide
      else if (doorMove === "slide"){ // Topline: 2–4 doors side by side; the left half slides right, the right half left
        var nS = Math.max(2, Math.min(4, mvB.slideDoors || 2)), sw = widthM / nS;
        for (var si = 0; si < nS; si++) makeLeaf(idx++, -widthM / 2 + sw * (si + 0.5), sw, y0, y1, si < nS / 2 ? "left" : "right", f, fi);
      }
      else if (wide){
        makeLeaf(idx++, -widthM / 4, widthM / 2, y0, y1, "left", f, fi);
        makeLeaf(idx++, widthM / 4, widthM / 2, y0, y1, "right", f, fi);
      } else makeLeaf(idx++, 0, widthM, y0, y1, meta.hingeRight ? "right" : "left", f, fi);
    });

    // Integrated fridge / freezer (user, 2026-10-25 — it was an empty box): the appliance sits behind the lower door —
    // white liner, glass shelves, crisper and freezer drawers, a light, and the door's own bins move with the door
    if (meta.fridgeKind && meta.split){
      var fz = meta.fridgeKind === "freezer", aTop = bodyBase + bodyH * meta.split - 0.01, aBot = bodyBase + 0.012;
      var lw = widthM - 2 * CARCASS_T - 0.012, ld = CD - 0.03, lz0 = 0.012, liner = new THREE.MeshStandardMaterial({ color:0xf3f4f5, roughness:0.55, metalness:0 });
      var glass = new THREE.MeshStandardMaterial({ color:0xdfeaf0, roughness:0.05, metalness:0.1, transparent:true, opacity:0.35 });
      var clear = new THREE.MeshStandardMaterial({ color:0xe8eef2, roughness:0.15, transparent:true, opacity:0.55 });
      var ah = aTop - aBot, wallT = 0.012, inW = lw - 2 * wallT, inD = ld - 0.075; // the front 6 cm is left for the door bins
      addBox(lw, ah, wallT, 0, aBot + ah / 2, lz0 + wallT / 2, liner);                                   // back
      addBox(wallT, ah, ld, -lw / 2 + wallT / 2, aBot + ah / 2, lz0 + ld / 2, liner);                   // sides
      addBox(wallT, ah, ld, lw / 2 - wallT / 2, aBot + ah / 2, lz0 + ld / 2, liner);
      addBox(lw, wallT, ld, 0, aTop - wallT / 2, lz0 + ld / 2, liner);                                  // top
      addBox(lw, wallT, ld, 0, aBot + wallT / 2, lz0 + ld / 2, liner);                                  // floor
      var lampY = aTop - 0.03, lamp = new THREE.Mesh(new THREE.BoxGeometry(inW * 0.5, 0.006, 0.02), new THREE.MeshBasicMaterial({ color:0xfffbea }));
      lamp.position.set(0, lampY, lz0 + inD * 0.7); frame.add(lamp);
      function drawer(y, h){ // a clear tub with a white lip
        addBox(inW - 0.01, h, inD - 0.02, 0, y + h / 2, lz0 + wallT + (inD - 0.02) / 2 + 0.005, clear);
        addBox(inW - 0.01, 0.03, 0.012, 0, y + h - 0.015, lz0 + wallT + inD - 0.01, liner);
      }
      var freezerTop = fz ? aTop - 0.02 : aBot + ah * 0.32;
      if (!fz){ // fridge above: 3 glass shelves over two crisper drawers
        addBox(lw, 0.02, ld, 0, freezerTop, lz0 + ld / 2, liner); // the divider between freezer and fridge
        var cr = freezerTop + 0.02, crH = 0.17;
        drawer(cr, crH);
        addBox(inW, 0.006, inD, 0, cr + crH + 0.01, lz0 + wallT + inD / 2, glass);
        var span = aTop - 0.06 - (cr + crH + 0.01);
        [1, 2, 3].forEach(function(k){ addBox(inW, 0.006, inD, 0, cr + crH + 0.01 + span * k / 4, lz0 + wallT + inD / 2, glass); });
      }
      var fzTop = fz ? freezerTop : freezerTop - 0.01, n = fz ? 6 : 3, fh = (fzTop - aBot - 0.02) / n; // freezer drawers
      for (var dk = 0; dk < n; dk++) drawer(aBot + 0.015 + dk * fh, fh - 0.025);
      // door bins: on the lower door, so they swing with it
      var dp = parts[partsBeforeFronts];
      if (dp && dp.group){
        var gpos = dp.group.position, binMat = new THREE.MeshStandardMaterial({ color:0xf7f8f9, roughness:0.4, transparent:true, opacity:0.92 });
        var binTop = fz ? [] : [0.82, 0.64, 0.46].map(function(f){ return freezerTop + (aTop - freezerTop) * f; });
        binTop.forEach(function(y){
          var bin = new THREE.Group();
          [[inW - 0.04, 0.008, 0.06, 0, -0.07, 0], [inW - 0.04, 0.07, 0.006, 0, -0.035, 0.027], [0.006, 0.07, 0.06, -(inW - 0.04) / 2, -0.035, 0], [0.006, 0.07, 0.06, (inW - 0.04) / 2, -0.035, 0]].forEach(function(q){
            var m = new THREE.Mesh(new THREE.BoxGeometry(q[0], q[1], q[2]), binMat); m.position.set(q[3], q[4], q[5]); bin.add(m);
          });
          bin.position.set(0 - gpos.x, y - gpos.y, CD - 0.045 - gpos.z);
          dp.group.add(bin);
        });
      }
    }

    // Búrskápur: inner drawers (a real BUR Útfærsla) stacked from the bottom behind the doors, 2 shelves above;
    // each inner drawer pulls out on its own once the doors are open
    if (meta.burCodes && meta.burCodes.length){
      var sysB = DRAWER_CODES[sysKey], yb = bodyBase + 0.06, ibw = Math.max(0.2, widthM - 2 * T - 0.026), ibd = Math.max(0.2, CD - 0.045 - BACK_T - 0.01);
      var burAt = meta.shelfBlock ? (meta.innerFree ? innerDrawersOf(meta.shelfBlock, sysKey) : burDrawersOf(meta.shelfBlock, sysKey)) : null; // Rakel's positions (Smíða) / the free innskúffur's own
      meta.burCodes.forEach(function(code, k){
        if (burAt && burAt[k]) yb = bodyBase + burAt[k].mm / 1000;
        var side = (sysB && sysB.side[code]) || 120, key = meta.blockId + ":b" + k, g = new THREE.Group(), meshes = [];
        var bx = buildDrawerBox(THREE, sysKey, meta.carcassKey, side, ibw, ibd, code, widthM - 2 * CARCASS_T);
        bx.position.set(0, yb, CD - 0.045);
        g.add(bx); bx.traverse(function(o){ if (o.isMesh) meshes.push(o); });
        if (bx.userData && bx.userData.runners){ var rgB = bx.userData.runners; rgB.position.copy(bx.position); frame.add(rgB); }
        var ifh = side / 1000 + 0.02, ifr = new THREE.Mesh(new THREE.BoxGeometry(ibw + 0.016, ifh, 0.016), meta.openMat); // inner front, carcass colour
        ifr.position.set(0, yb + ifh / 2, CD - 0.037); ifr.castShadow = true; g.add(ifr); meshes.push(ifr);
        var pm = Object.assign({}, meta, { isPart:true, partKey:key });
        meshes.forEach(function(m){ m.userData = pm; pickables.push(m); });
        var prevB = PART_STATE[key];
        var partB = { key:key, group:g, kind:"drawer", slide:Math.min(0.34, CD * 0.6), cur:prevB ? prevB.cur : 0, target:prevB ? prevB.target : 0 };
        PART_STATE[key] = partB; parts.push(partB); applyPart(partB);
        frame.add(g);
        yb += ifh + 0.035;
      });
      var burShelves = meta.innerFree ? [] : meta.shelfBlock ? shelfLayoutOf(meta.shelfBlock, bodyH * 1000, sysKey) : [1, 2].map(function(k){ return { mm:((yb - bodyBase) + (bodyH - (yb - bodyBase)) * k / 3) * 1000 + 9 }; });
      burShelves.forEach(function(shf){
        var shB = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, CD - 0.03), meta.openMat);
        shB.position.set(0, bodyBase + shf.mm / 1000 - 0.009, (CD - 0.03) / 2 + 0.005); shB.castShadow = true; shB.receiveShadow = true;
        frame.add(shB);
      });
    }
  }

  // Kesseböhmer Le Mans (Töfrahorn): two kidney-shaped trays with a chrome rail behind the door half. No
  // CAD model (Kesseböhmer's STEP files sit behind their CAD portal login) — drawn here, and they ride the
  // door's part so one tap opens door + trays (applyPart "lemans").
  var LEMANS_MATS = null;
  function leMansTray(THREE, w, d){
    if (!LEMANS_MATS) LEMANS_MATS = {
      plate:new THREE.MeshStandardMaterial({ color:0x55575b, roughness:0.55, metalness:0.15 }),
      rail:new THREE.MeshStandardMaterial({ color:0xd6d9dd, roughness:0.22, metalness:0.9 })
    };
    function outline(sh, w2, d2, rFront, rBack, inset){ // x across, y = depth (front at +y)
      var x0 = -w2 / 2 + inset, x1 = w2 / 2 - inset, y0 = -d2 / 2 + inset, y1 = d2 / 2 - inset;
      sh.moveTo(x0 + rBack, y0); sh.lineTo(x1 - rBack, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + rBack);
      sh.lineTo(x1, y1 - rFront); sh.quadraticCurveTo(x1, y1, x1 - rFront, y1);
      sh.lineTo(x0 + rFront, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - rFront);
      sh.lineTo(x0, y0 + rBack); sh.quadraticCurveTo(x0, y0, x0 + rBack, y0);
      return sh;
    }
    var rF = Math.min(w, d) * 0.42, rB = 0.03, g = new THREE.Group();
    var plate = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(new THREE.Shape(), w, d, rF, rB, 0), { depth:0.01, bevelEnabled:false }), LEMANS_MATS.plate);
    var ringShape = outline(new THREE.Shape(), w, d, rF, rB, 0);
    ringShape.holes.push(outline(new THREE.Path(), w, d, Math.max(0.01, rF - 0.008), rB, 0.008));
    var rail = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth:0.055, bevelEnabled:false }), LEMANS_MATS.rail);
    [plate, rail].forEach(function(m){ m.rotation.x = -Math.PI / 2; m.castShadow = true; m.receiveShadow = true; g.add(m); });
    return g;
  }
  // The real Kesseböhmer LeMans II (SketchUp → .dae, the right-hand version, user 2026-10-24): one kidney tray per
  // level (group_1 lower, group_19 upper, each with its rail) and the pivot column (group_14/23/9/12). Baked to
  // metres, each tray re-centred (x/z on its own centre, bottom at 0); the left-hand one is the same mirrored.
  var LEMANS_FILE = "models/lemans/lemans-ii-r.dae", LEMANS_REAL = { state:"", trays:null, column:null, w:0, d:0 };
  function leMansReal(){
    if (LEMANS_REAL.state) return LEMANS_REAL.state === "ready" ? LEMANS_REAL : null;
    LEMANS_REAL.state = "loading";
    loadRaw(LEMANS_FILE, function(root){
      var THREE = window.__THREE__;
      root.updateMatrixWorld(true);
      var metal = new THREE.MeshStandardMaterial({ color:0xc9ccd0, roughness:0.28, metalness:0.85 }),
          plate = new THREE.MeshStandardMaterial({ color:0xf2f2f0, roughness:0.55, metalness:0.05 });
      function bake(name){ // a group's meshes with their world transform baked in, as one Group
        var src = root.getObjectByName(name), out = new THREE.Group();
        if (!src) return out;
        src.traverse(function(o){
          if (!o.isMesh) return;
          var gm = o.geometry.clone(); gm.applyMatrix4(o.matrixWorld);
          var light = (Array.isArray(o.material) ? o.material[0] : o.material);
          var col = light && light.color ? light.color : null, isPlate = col && col.r > 0.85 && col.g > 0.85 && col.b > 0.85;
          var m = new THREE.Mesh(gm, isPlate ? plate : metal); m.userData.lemansRole = isPlate ? "plate" : "rail"; m.castShadow = true; m.receiveShadow = true; out.add(m);
        });
        return out;
      }
      var lower = bake("group_1"), upper = bake("group_19"), col = new THREE.Group();
      ["group_14"].forEach(function(n){ col.add(bake(n)); }); // the round post only (group_23 is the flat mounting bracket — left out, user 2026-10-25)
      col.traverse(function(m){ if (m.isMesh){ m.material = metal; m.userData.lemansRole = "post"; } });
      var bb = new THREE.Box3().setFromObject(lower, true), ctr = bb.getCenter(new THREE.Vector3());
      [lower, upper].forEach(function(g){ var b2 = new THREE.Box3().setFromObject(g, true); g.children.forEach(function(m){ m.geometry.translate(-ctr.x, -b2.min.y, -ctr.z); }); });
      var cb = new THREE.Box3().setFromObject(col, true);
      var cc = cb.getCenter(new THREE.Vector3()); LEMANS_REAL.colX = cc.x - ctr.x; LEMANS_REAL.colZ = cc.z - ctr.z; // the pivot, from the tray's centre
      col.traverse(function(m){ if (m.isMesh) m.geometry.translate(-ctr.x, -cb.min.y, -ctr.z); }); // column in tray coordinates, bottom at 0
      LEMANS_REAL.trays = [lower, upper]; LEMANS_REAL.column = col; LEMANS_REAL.colH = cb.max.y - cb.min.y;
      LEMANS_REAL.w = bb.max.x - bb.min.x; LEMANS_REAL.d = bb.max.z - bb.min.z;
      LEMANS_REAL.state = "ready";
      window.dispatchEvent(new Event("kp3d-model-loaded"));
    }, function(){ LEMANS_REAL.state = "error"; });
    return null;
  }
  // Colours from Kesseböhmer's own product photos (the two we sell, by carcass colour): "ice white" is all matt —
  // light grey tray floor, white rails and post; the dark one is an anthracite floor with chrome rails and a grey post
  var LEMANS_LOOKS = {};
  function leMansLook(THREE, dark){
    var k = dark ? "dark" : "white";
    if (!LEMANS_LOOKS[k]) LEMANS_LOOKS[k] = dark
      ? { plate:new THREE.MeshStandardMaterial({ color:0x3e4043, roughness:0.75, metalness:0.05 }), rail:new THREE.MeshStandardMaterial({ color:0xc9ccd0, roughness:0.25, metalness:0.9 }), post:new THREE.MeshStandardMaterial({ color:0x8e9196, roughness:0.4, metalness:0.7 }) }
      : { plate:new THREE.MeshStandardMaterial({ color:0xd3d5d7, roughness:0.85, metalness:0 }), rail:new THREE.MeshStandardMaterial({ color:0xf2f2f0, roughness:0.6, metalness:0 }), post:new THREE.MeshStandardMaterial({ color:0xefefed, roughness:0.6, metalness:0 }) };
    return LEMANS_LOOKS[k];
  }
  function leMansPaint(obj, look){ obj.traverse(function(m){ if (m.isMesh && m.userData.lemansRole) m.material = look[m.userData.lemansRole]; }); }
  function addLeMansTrays(THREE, frame, doorPart, cxDoor, hw, CD, bodyBase, bodyH, left, meta, pickables){
    if (!doorPart) return;
    var real = leMansReal(), inward = left ? 1 : -1, trays = [];
    var pmeta = Object.assign({}, meta, { isPart:true, partKey:doorPart.key });
    if (real){ // nearly the cabinet's width when closed (half in the blind corner), out through the opening when open
      // a touch smaller than the carcass and set back, so nothing (tray rail, column) ever shows through the fronts
      var innerW = Math.max(0.5, (2 * hw - 0.05) * 0.92), d = Math.max(0.3, Math.min(0.44, CD - 0.12)); // narrow enough to turn and step clear of the side
      var sx = innerW / real.w, sz = d / real.d, mx = left ? -1 : 1; // the file is the right-hand LeMans
      var zIn = CD - 0.07 - d / 2; // the post a little in from the front
      // the column stands just inside the opening, past the door's middle-side hinge — the tray turns about it
      // without ever sweeping through the door (which opens over the blind half)
      var pivotX = -inward * 0.07, xIn = pivotX - real.colX * sx * mx;
      for (var it = 0; it < 3; it++){ // shifted toward the opening, so narrow it until both ends clear the sides by 25 mm
        var fit = 2 * (hw - 0.025 - Math.abs(xIn));
        if (innerW <= fit) break;
        innerW = fit; sx = innerW / real.w; xIn = pivotX - real.colX * sx * mx;
      }
      var pz = zIn + real.colZ * sz, colBack = Math.max(0, pz + 0.02 - (CD - 0.045)); pz -= colBack;
      var look = leMansLook(THREE, meta.carcassKey === "dokkgra");
      var colG = real.column.clone(true); leMansPaint(colG, look); colG.scale.set(sx * mx, Math.max(0.5, bodyH - 0.06) / real.colH, sz); colG.position.set(xIn, bodyBase + 0.03, zIn - colBack);
      frame.add(colG); // the round post the trays turn about
      [0.08, 0.5].forEach(function(f, k){
        var g = new THREE.Group(), t = real.trays[k].clone(true); leMansPaint(t, look);
        t.scale.set(sx * mx, 1, sz); g.add(t); frame.add(g);
        g.traverse(function(o){ if (o.isMesh){ o.userData = pmeta; pickables.push(o); } });
        // the real motion: the tray first turns about the column out through the opening, then slides out —
        // open it stands out of the opening, pointing away from the cabinet at a slight angle (how a LeMans II stands open)
        trays.push({ group:g, real:true, y:bodyBase + bodyH * f, x0:xIn, z0:zIn, px:pivotX, pz:pz,
          a1:inward * Math.PI / 2, step:0.07, out:d * 0.75, xEnd:pivotX - inward * (d * 0.55 + 0.04), zEnd:zIn + d / 2 + innerW * 0.42, aEnd:inward * 1.3 });
      });
    } else {
      var w = Math.max(0.3, hw - 0.07), d2 = Math.max(0.3, Math.min(0.5, CD - 0.08));
      [0.08, 0.5].forEach(function(f){
        var g = leMansTray(THREE, w, d2), y = bodyBase + bodyH * f;
        frame.add(g);
        g.traverse(function(o){ if (o.isMesh){ o.userData = pmeta; pickables.push(o); } });
        // closed: tucked partly into the blind corner; open: out through the door, square in front of it
        trays.push({ group:g, xIn:cxDoor + inward * hw * 0.35, xOut:cxDoor - inward * 0.03, y:y, z0:CD - 0.03 - d2 / 2, outZ:d2 + 0.1, turn:-inward * 0.55 });
      });
    }
    doorPart.kind = "lemans"; doorPart.trays = trays;
    applyPart(doorPart);
  }

  // Stainless inset sink (visual pass 2): the worktop has a real cut-out, a brushed-steel basin with rounded walls
  // sinks 18 cm into the (open-topped) sink cabinet, a flush rim, a drain, and a gooseneck tap with a lever.
  function sinkSize(widthM, depthM){ return { w:Math.min(0.62, widthM * 0.72), d:Math.min(0.42, depthM * 0.62), r:0.02 }; }
  // The hole in the worktop (owner, 2026-10-27: the top poked into the bowl): 4 mm clear of the bowl all round, its corners
  // as round as the bowl's (SINK_BOWL_R), so no edge of the top ever shows inside — the sink's flange covers the gap
  var SINK_BOWL_R = 0.03, SINK_CLEAR = 0.004;
  function sinkCutout(widthM, depthM){ var s = sinkSize(widthM, depthM); return { w:s.w + 2 * SINK_CLEAR, d:s.d + 2 * SINK_CLEAR, r:SINK_BOWL_R + SINK_CLEAR }; }
  function roundedRectShape(THREE, w, d, r, path){
    var s2 = path || new THREE.Shape(), x0 = -w / 2, y0 = -d / 2;
    s2.moveTo(x0 + r, y0); s2.lineTo(x0 + w - r, y0); s2.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s2.lineTo(x0 + w, y0 + d - r);
    s2.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d); s2.lineTo(x0 + r, y0 + d); s2.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r); s2.lineTo(x0, y0 + r); s2.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s2;
  }
  // a worktop slab (centred like a BoxGeometry) with a rounded-rect hole in the middle; UVs 0..1 like a box face
  function worktopWithHole(THREE, w, h, d, hole){
    var sh = new THREE.Shape(); sh.moveTo(-w / 2, -d / 2); sh.lineTo(w / 2, -d / 2); sh.lineTo(w / 2, d / 2); sh.lineTo(-w / 2, d / 2); sh.lineTo(-w / 2, -d / 2);
    sh.holes.push(roundedRectShape(THREE, hole.w, hole.d, hole.r, new THREE.Path()));
    var g = new THREE.ExtrudeGeometry(sh, { depth:h, bevelEnabled:false, curveSegments:6 });
    g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0); // shape y → -z, extrusion → up
    var p = g.attributes.position, uv = g.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getZ(i) + d / 2) / d);
    return g;
  }
  // Drops every triangle that lies entirely above yCut (local y) — turns a closed box into an open bowl.
  function openTopGeometry(THREE, geo, yCut){
    var g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position, keep = [];
    for (var t = 0; t < pos.count; t += 3) if (!(pos.getY(t) > yCut && pos.getY(t + 1) > yCut && pos.getY(t + 2) > yCut)) keep.push(t);
    var out = new THREE.BufferGeometry();
    Object.keys(g.attributes).forEach(function(name){
      var src = g.attributes[name], n = src.itemSize, arr = new src.array.constructor(keep.length * 3 * n);
      keep.forEach(function(t, k){ for (var v = 0; v < 3 * n; v++) arr[k * 3 * n + v] = src.array[t * n + v]; });
      out.setAttribute(name, new THREE.BufferAttribute(arr, n));
    });
    return out;
  }
  // utility (Þvottahús, user 2026-10-26): a short ~20 cm utility spout instead of the kitchen's tall gooseneck
  function addSink(THREE, group, local, quat, widthM, depthM, topY, ceilM, utility){
    var hs = sinkSize(widthM, depthM), depth = 0.18, zc = depthM * 0.5 + 0.01;
    var steel = new THREE.MeshStandardMaterial({ color:0xc4c8cc, metalness:0.9, roughness:0.32 });
    // a solid bowl: seen from inside from above, and from outside (an open sink cabinet) — it used to be a
    // BackSide box, so its near wall vanished from the front and the inside read almost black (user, 2026-10-09)
    var steelIn = new THREE.MeshStandardMaterial({ color:0xc9cdd1, metalness:0.55, roughness:0.35, side:THREE.DoubleSide });
    function put(m, y, out, along){ m.position.copy(local(along || 0, y, out)); m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; }
    // basin: a rounded box with its top (lid + upper rounded band) cut away — the cut sits right under the flange, so the
    // bowl's straight walls run all the way up to it (they used to stop 3 cm down, inside the worktop's cut edge)
    var bowlR = window.__RoundedBox__ ? SINK_BOWL_R : 0, cutY = depth / 2 - SINK_BOWL_R - 0.0005;
    var basinGeo = window.__RoundedBox__ ? new window.__RoundedBox__(hs.w, depth, hs.d, 4, SINK_BOWL_R) : new THREE.BoxGeometry(hs.w, depth, hs.d);
    var basin = new THREE.Mesh(openTopGeometry(THREE, basinGeo, cutY), steelIn);
    var bowlY = topY - cutY - 0.0005; // centre of the box: its cut edge 0.5 mm under the worktop's surface
    put(basin, bowlY, zc);
    // the flange: from the bowl's own edge out over the worktop, 12 mm past the cut-out — the top's cut edge is never seen
    var hc = sinkCutout(widthM, depthM), rimSh = roundedRectShape(THREE, hc.w + 0.024, hc.d + 0.024, hc.r + 0.012);
    rimSh.holes.push(roundedRectShape(THREE, hs.w - 0.001, hs.d - 0.001, Math.max(0.002, bowlR * 1.25), new THREE.Path())); // (×1.25: the quadratic corner is squarer than the bowl's arc — this keeps it inside the bowl)
    var rimG = new THREE.ExtrudeGeometry(rimSh, { depth:0.0015, bevelEnabled:false, curveSegments:10 }); rimG.rotateX(-Math.PI / 2);
    put(new THREE.Mesh(rimG, steel), topY, zc);
    // drain
    var drain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.003, 28), new THREE.MeshStandardMaterial({ color:0x9a9fa5, metalness:0.9, roughness:0.25 }));
    put(drain, bowlY - depth / 2 + 0.006, zc, hs.w * 0.25);
    // tap: round base, gooseneck, lever
    var back = zc - hs.d / 2 - 0.045, room = ceilM != null ? ceilM - (topY + 0.03) - 0.02 : Infinity;
    // Under a low window / sill (2026-10-23): the ~0.32 m gooseneck is lowered to fit (2 cm clear); with almost no room
    // left (< 15 cm) it moves beside the bowl, out from under the sill, at full height, spout turned over the bowl —
    // what a kitchen fitter does with a sink under a low window.
    var side = room < 0.15, tapAlong = side ? hs.w / 2 + 0.05 : 0, tapOut = side ? zc - hs.d * 0.15 : back;
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 24), steel), topY + 0.015, tapOut, tapAlong);
    var neck = new THREE.Group(); neck.position.copy(local(tapAlong, topY + 0.03, tapOut)); neck.quaternion.copy(quat); group.add(neck);
    if (side) neck.rotateY(-Math.PI / 2); // spout over the bowl
    else if (room < (utility ? 0.2 : 0.32)) neck.scale.y = Math.max(0.35, room / (utility ? 0.2 : 0.32));
    var curve = new THREE.CatmullRomCurve3(utility
      ? [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.13, 0), new THREE.Vector3(0, 0.185, 0.04), new THREE.Vector3(0, 0.18, 0.14), new THREE.Vector3(0, 0.15, 0.17)]
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 0.3, 0.06), new THREE.Vector3(0, 0.27, 0.17), new THREE.Vector3(0, 0.2, 0.2)]);
    var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 14, false), steel); tube.castShadow = true; neck.add(tube);
    var lever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 10), steel); lever.rotation.z = Math.PI / 2 - 0.3; lever.position.set(0.045, 0.1, 0); lever.castShadow = true; neck.add(lever);
  }

  // A white ceramic vessel basin (handlaug ofan á), oval, centred a little toward the front, with its drain; behind it a
  // straight basin mixer (column + short spout over the bowl + lever) — about 25 cm, not the kitchen's 32 cm gooseneck
  function addBasin(THREE, group, local, quat, widthM, depthM, topY, ceilM){
    var bw = Math.min(0.5, Math.max(0.3, widthM * 0.62)), bd = Math.min(0.37, depthM * 0.72), R = 0.2;
    var zc = Math.max(bd / 2 + 0.09, depthM * 0.52);
    var ceramic = new THREE.MeshStandardMaterial({ color:0xf8f7f3, roughness:0.16, metalness:0, side:THREE.DoubleSide });
    var steel = new THREE.MeshStandardMaterial({ color:0xc9cdd2, metalness:0.92, roughness:0.22 });
    function put(m, y, out, along){ m.position.copy(local(along || 0, y, out)); m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; }
    var prof = [[0, 0.002], [0.12, 0.002], [0.165, 0.018], [0.194, 0.07], [R, 0.118], [R, 0.125], [0.191, 0.125], [0.186, 0.074], [0.158, 0.026], [0.1, 0.017], [0, 0.016]];
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(prof.map(function(p){ return new THREE.Vector2(p[0], p[1]); }), 56), ceramic);
    bowl.scale.set(bw / 2 / R, 1, bd / 2 / R);
    put(bowl, topY, zc);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.003, 24), steel), topY + 0.018, zc);
    var room = ceilM != null ? ceilM - topY - 0.02 : Infinity, colH = Math.max(0.1, Math.min(0.24, room - 0.02));
    var back = Math.max(0.045, zc - bd / 2 - 0.04);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.012, 24), steel), topY + 0.006, back);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, colH, 24), steel), topY + colH / 2, back);
    var spoutL = Math.min(0.15, bd / 2 + 0.03), spout = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, spoutL), steel);
    put(spout, topY + colH - 0.025, back + spoutL / 2);
    var lever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 10), steel); lever.rotation.x = Math.PI / 2 - 0.35;
    put(lever, topY + colH + 0.012, back - 0.02);
  }
  // Spegilskápur (Bað, state.bathMirror): a plain mirror cabinet over the sink, as wide as the sink unit, 15 cm deep —
  // shown only (the order carries it as a note); never drawn where a wall unit already hangs over the sink
  function addMirrorCabinet(THREE, scene, geom, offsetM, widthM, bottomM, carcassMat){
    var hM = 0.7, dM = 0.15, grp = new THREE.Group();
    var axis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z), nrm = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis, new THREE.Vector3(0, 1, 0), nrm));
    function at(along, y, out){ return new THREE.Vector3(geom.origin.x + geom.axis.x * (offsetM + widthM / 2 + along) + geom.normal.x * out, y, geom.origin.z + geom.axis.z * (offsetM + widthM / 2 + along) + geom.normal.z * out); }
    var body = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.004, hM, dM - 0.004), carcassMat);
    body.position.copy(at(0, bottomM + hM / 2, dM / 2)); body.quaternion.copy(quat); body.castShadow = true; body.receiveShadow = true; grp.add(body);
    var glass = new THREE.MeshStandardMaterial({ color:0xe9eef1, metalness:1, roughness:0.04 }); glass.userData.mirror = true;
    var doors = widthM > 0.65 ? 2 : 1, dw = (widthM - 0.004 - (doors - 1) * 0.003) / doors;
    for (var i = 0; i < doors; i++){
      var dm = new THREE.Mesh(new THREE.BoxGeometry(dw, hM - 0.004, 0.006), glass);
      dm.position.copy(at(-widthM / 2 + 0.002 + dw / 2 + i * (dw + 0.003), bottomM + hM / 2, dM + 0.003)); dm.quaternion.copy(quat); grp.add(dm);
    }
    grp.userData.mirrorCab = true;
    scene.add(grp);
  }

  function disposeScene(scene){
    if (!scene) return;
    scene.environment = null; // shared with the next scene — don't dispose it here
    scene.traverse(function(obj){
      if (obj.isLight && obj.shadow && obj.shadow.map) obj.shadow.map.dispose(); // 2048² depth target per build otherwise leaks on the shared renderer
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material){
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(function(mat){
          if (mat.map && !mat.map.userData.keep) mat.map.dispose();
          if (mat.bumpMap && !mat.bumpMap.userData.keep) mat.bumpMap.dispose();
          if (MIRROR_RT.has(mat)){ MIRROR_RT.get(mat).dispose(); MIRROR_RT.delete(mat); } // updateMirrors' cube map
          mat.dispose();
        });
      }
    });
  }

  var THREE_STATE = null;
  var sharedRenderer = null, sharedEnv = null;

  // Every click-to-select / type-change re-renders the whole scene from
  // scratch (teardown3D + buildScene) — without this, that also silently
  // reset the camera to its default framing on every single click, which
  // read as the view "snapping back" mid-orbit. Captured on teardown, applied
  // back on the next buildScene, so only a real reset (a fresh room, "byrja
  // upp á nýtt", a finished submit) should actually clear it — those call
  // teardown3D(true) to discard it explicitly.
  var savedCameraState = null;

  // Drag a cabinet in the 3D view (2026-09-19) — click-to-select and
  // drag-to-reposition share this one pointer handler so they can't fight
  // over the same gesture.
  //   • Press on a cabinet: OrbitControls is suspended for that gesture. The
  //     listener sits on `wrap` (an ANCESTOR of the canvas) in the capture
  //     phase and calls stopPropagation, so OrbitControls' own pointerdown
  //     (on the canvas itself) never runs. Listeners on the same element
  //     fire in registration order regardless of the capture flag, so
  //     attaching to the canvas would have lost that race.
  //   • Pointer moves past CABINET_DRAG_PX → a drag: the pointer is raycast
  //     onto the floor plane, projected to the nearest wall (same math as
  //     kitchen-planner.html's 2D findDropPoint), and reported up via
  //     opts.onCabinetDragMove / onCabinetDragEnd. Snapping/packing stays in
  //     kitchen-planner.html; the landing footprint is drawn with
  //     updateDragPreview3D.
  //   • Released without moving → a tap: opts.onSelect(meta).
  //   • Press on empty space is left alone, so orbit/pan/zoom work as before;
  //     a plain click there still deselects.
  var CABINET_DRAG_PX = 6;

  function nearestWallDrop(geoms, walls, worldX, worldZ, wallsOnly){
    var best = null, bestDist = Infinity, bestAlongM = 0;
    geoms.forEach(function(g, i){
      if (walls[i].open) return; // open edges take nothing
      if (wallsOnly && (walls[i].island || walls[i].partition)) return; // windows/doors only go on real walls
      var x1 = g.origin.x, z1 = g.origin.z;
      var dx = g.axis.x * g.lenM, dz = g.axis.z * g.lenM;
      var lenSq = dx * dx + dz * dz;
      var t = lenSq > 0 ? ((worldX - x1) * dx + (worldZ - z1) * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      var d = Math.hypot(worldX - (x1 + t * dx), worldZ - (z1 + t * dz));
      // back-to-back island rows (or the two faces of a milliveggur) share one seam: pick the one whose front the cursor is on
      if (walls[i].island && walls[i].island.two && (worldX - x1) * g.normal.x + (worldZ - z1) * g.normal.z < 0) d += 5;
      if (walls[i].partition && (worldX - x1) * g.normal.x + (worldZ - z1) * g.normal.z < 0) d += 5;
      if (d < bestDist){ bestDist = d; best = i; bestAlongM = t * g.lenM; }
    });
    return best === null ? null : { wallId:walls[best].id, alongMm:Math.round(bestAlongM * 1000) };
  }

  // Where a camera ray meets the room-facing plane of a real wall, `depthM`
  // into the room (0 = the wall itself, depth/2 = the middle of a cabinet
  // hanging on it). Only front-facing hits count (the ray must travel INTO the
  // wall from the room side), so a faded near wall is ignored and the far wall
  // behind it is what you point at. Returns the nearest {t, wallId, alongMm, y(m)}.
  // Wall-mounted things (upper cabinets, shelves, windows) are dragged with
  // this instead of a horizontal plane: the cursor is then over exactly the spot
  // that gets picked, from any camera angle, and it also gives the height.
  function wallPlaneHit(ray, geoms, walls, depthM, roomHM){
    var best = null, o = ray.origin, d = ray.direction;
    geoms.forEach(function(g, i){
      var w = walls[i];
      if (!w || w.open || w.island || w.partition) return; // no wall-mounted (upper) units on a milliveggur yet
      var dn = d.x * g.normal.x + d.z * g.normal.z;
      if (dn > -1e-6) return;
      var t = ((g.origin.x + g.normal.x * depthM - o.x) * g.normal.x + (g.origin.z + g.normal.z * depthM - o.z) * g.normal.z) / dn;
      if (t <= 0) return;
      var px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
      var along = (px - g.origin.x) * g.axis.x + (pz - g.origin.z) * g.axis.z;
      if (along < -0.3 || along > g.lenM + 0.3 || py < -0.3 || py > roomHM + 0.6) return;
      if (!best || t < best.t) best = { t:t, wallId:w.id, alongMm:Math.round(along * 1000), y:py };
    });
    return best;
  }
  function isWallItem(meta){ return !!meta && (meta.zone === "wall" || meta.kind === "window" || meta.kind === "door" || meta.kind === "obstacle"); }

  function setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, geoms, walls, opts, roomHM){
    var raycaster = new THREE.Raycaster();
    var floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var drag = null; // {meta, mesh, group, startMatrix, startX, startY, moved}
    var lockTap = null; // press on a locked cabinet
    var suppressClick = false;

    function ndc(evt){
      var rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((evt.clientX - rect.left) / rect.width) * 2 - 1,
        -((evt.clientY - rect.top) / rect.height) * 2 + 1
      );
    }
    // What you can't see you can't grab (user, 2026-10-09): a cabinet that has turned see-through (seen from
    // behind) and a window/door/opening in a faded wall are skipped, so the ray goes on to what's behind them —
    // looking in over wall 2 grabs the cabinet on wall 4, not the ghost on wall 2.
    function seeThrough(o){
      for (var p = o; p; p = p.parent){
        var c = p.userData && p.userData.cab;
        if (c && c.t > 0.5) return true;
        if (p.__fadeWall && p.__fadeWall.mat.opacity < 0.5) return true;
      }
      return false;
    }
    function spanAt(evt){ // the empty wardrobe area (buildScene's opts.__spanMeshes)
      if (!opts.__spanMeshes || !opts.__spanMeshes.length) return null;
      raycaster.setFromCamera(ndc(evt), camera);
      var h = raycaster.intersectObjects(opts.__spanMeshes, false);
      return h.length ? h[0].object : null;
    }
    function pickMeshAt(evt){
      raycaster.setFromCamera(ndc(evt), camera);
      var hits = raycaster.intersectObjects(pickables, false);
      // a milliveggur's resize handles are drawn on top of everything, so if one is under the pointer it wins — even when
      // it sits inside the partition (the end standing against its wall) or behind another box along the ray (2026-10-23)
      for (var hi = 0; hi < hits.length; hi++) if (hits[hi].object.userData && hits[hi].object.userData.kind === "obstacle-resize") return hits[hi].object;
      var first = null;
      for (var i = 0; i < hits.length; i++) if (!seeThrough(hits[i].object)){ first = hits[i].object; break; }
      if (!first) return null;
      // a drawer/door you can see through the cabinet's own invisible pick box (an inner drawer once its front is
      // open sits inside that box) is what you're pointing at, not the box (2026-10-24)
      if (first.material && first.material.visible === false){
        for (var k = 0; k < hits.length; k++){ var hp = hits[k].object; if (hp.userData && hp.userData.isPart && !seeThrough(hp)) return hp; }
      }
      // an open cabinet's own invisible pick box (its only click target, since isOpen never adds its
      // carcass boards to pickables) sits in front of its loose shelves/fataslá along this same ray —
      // prefer the one you're actually pointing at, from the SAME cabinet, over the whole box (2026-10-21)
      if (first.userData.kind !== "shelf-item" && first.userData.kind !== "rail-item" && first.userData.blockId && !first.userData.isPart){ // a closed door/drawer front is clicked to open it, never reached through
        for (var j = 0; j < hits.length; j++){
          var o = hits[j].object;
          if (seeThrough(o)) continue;
          if ((o.userData.kind === "shelf-item" || o.userData.kind === "rail-item") && o.userData.blockId === first.userData.blockId) return o;
        }
      }
      return first;
    }
    // Cast onto the horizontal plane through the dragged item's own mid-height,
    // not the floor: with the pointer over the cabinet body the floor hit lies
    // well behind it (parallax), which shifted the landing spot along the wall.
    function dropAt(evt){
      raycaster.setFromCamera(ndc(evt), camera);
      if (drag && isWallItem(drag.meta)){
        var wh = wallPlaneHit(raycaster.ray, geoms, walls, (drag.meta.depthMm || 0) / 2000, roomHM);
        if (wh) return { wallId:wh.wallId, alongMm:wh.alongMm - (drag.gripMm || 0),
          elevMm:Math.round(wh.y * 1000 - (drag.gripYmm || 0) - (drag.meta.heightMm || 0) / 2) };
      }
      var pt = new THREE.Vector3();
      var y = drag && drag.mesh ? drag.mesh.position.y : 0;
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
      if (!raycaster.ray.intersectPlane(plane, pt)) return null;
      var drop = nearestWallDrop(geoms, walls, pt.x, pt.z, drag && drag.meta && !!drag.meta.kind);
      // Keep the spot the cabinet was grabbed at under the cursor: alongMm is
      // the cabinet CENTRE, so shift it by the grab offset measured on press.
      if (drop && drag && drag.gripMm) drop.alongMm -= drag.gripMm;
      return drop;
    }
    // where a free-standing column / partition dropped: its own wall while it stands in front of it, otherwise the
    // nearest wall it is in front of — as {wallId, alongMm (centre), outMm (gap from the wall)}
    function freeSpotOnWalls(d0){
      var c = new THREE.Vector3(); d0.mesh.getWorldPosition(c);
      var px = c.x, pz = c.z, half = (d0.meta.depthMm || 0) / 2000, best = null;
      // outside the room (a closed room: ray-cast over the wall corners) → no move
      var rg = geoms.filter(function(g, i){ return walls[i] && !walls[i].island; }); // the room's own walls (not island rows)
      if (!walls.some(function(w){ return w.open; })){
        var inside = false;
        rg.forEach(function(g, i){ var h = rg[(i + 1) % rg.length], a = g.origin, b = h.origin;
          if ((a.z > pz) !== (b.z > pz) && px < (b.x - a.x) * (pz - a.z) / (b.z - a.z) + a.x) inside = !inside; });
        if (!inside) return null;
      }
      walls.forEach(function(w, i){
        var g = geoms[i]; if (!g || w.open || w.island) return;
        var t = (px - g.origin.x) * g.axis.x + (pz - g.origin.z) * g.axis.z, d = (px - g.origin.x) * g.normal.x + (pz - g.origin.z) * g.normal.z;
        if (t < 0 || t > g.lenM || d < -0.05) return;
        var score = w.id === d0.meta.wallId ? -1 : d;
        if (!best || score < best.score) best = { score:score, wallId:w.id, alongMm:Math.round(t * 1000), outMm:Math.max(0, Math.round((d - half) * 1000)) };
      });
      return best;
    }
    function floorHit(evt, y){ // the floor, or a level plane at height y (m)
      raycaster.setFromCamera(ndc(evt), camera);
      var pt = new THREE.Vector3();
      return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y || 0)), pt) ? pt : null;
    }
    // Distance (mm) of a world point along a wall from that wall's origin.
    function alongOnWall(wallId, x, z){
      var wi = walls.findIndex(function(w){ return w.id === wallId; });
      var g = geoms[wi];
      return g ? ((x - g.origin.x) * g.axis.x + (z - g.origin.z) * g.axis.z) * 1000 : null;
    }
    // Where on the cabinet the press landed, relative to its centre along the
    // wall — so grabbing a cabinet by its edge doesn't make it jump to centre
    // itself on the cursor.
    function gripOffsetMm(evt, mesh){
      var meta = mesh.userData;
      raycaster.setFromCamera(ndc(evt), camera);
      var pt = new THREE.Vector3();
      var wp = new THREE.Vector3();
      mesh.getWorldPosition(wp);
      if (isWallItem(meta)){ // measured on the wall plane, so it matches dropAt
        var wh = wallPlaneHit(raycaster.ray, geoms, walls, (meta.depthMm || 0) / 2000, roomHM);
        var cAlong = alongOnWall(meta.wallId, wp.x, wp.z);
        if (wh && wh.wallId === meta.wallId && cAlong !== null){
          var halfW = (meta.widthMm || 0) / 2, halfH = (meta.heightMm || 0) / 2;
          return { along:Math.max(-halfW, Math.min(halfW, wh.alongMm - cAlong)), y:Math.max(-halfH, Math.min(halfH, wh.y * 1000 - ((meta.elevMm || 0) + halfH))) };
        }
        return { along:0, y:0 };
      }
      if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -wp.y), pt)) return { along:0, y:0 };
      var a = alongOnWall(meta.wallId, pt.x, pt.z), c = alongOnWall(meta.wallId, wp.x, wp.z);
      if (a === null || c === null) return { along:0, y:0 };
      var half = (meta.widthMm || 0) / 2;
      return { along:Math.max(-half, Math.min(half, a - c)), y:0 };
    }

    function onDown(evt){
      if (evt.button !== undefined && evt.button !== 0) return;
      if (MEASURING) return; // málband (user, 2026-10-17): every click is left to OrbitControls and the tape tool, nothing here drags or selects
      var readOnly = !opts.onSelect && !opts.onCabinetDragEnd; // review page / wizard preview
      var mesh = pickMeshAt(evt);
      if (!mesh) return;
      // the "+ Ný eining" preview (read-only otherwise) can still move shelves / rails / drawers when given the callbacks
      // (user, 2026-10-26: "Smíða lite" while choosing the innvols)
      if (readOnly && (mesh.userData.kind === "shelf-item" || mesh.userData.kind === "rail-item") && opts.onShelfPosMove){
        drag = { meta:mesh.userData, mesh:mesh, shelfDrag:true, startX:evt.clientX, startY:evt.clientY, moved:false };
        controls.enabled = false; evt.stopPropagation();
        return;
      }
      if (readOnly && !(mesh.userData.isPart && mesh.userData.drawerIdx != null && opts.onDrawerResize)){ // only drawers/doors react (tap = open/close); everything else is left to OrbitControls
        if (mesh.userData.isPart && mesh.userData.locked) lockTap = { meta:mesh.userData, x:evt.clientX, y:evt.clientY };
        return;
      }
      // a wardrobe drawer, locked or not (user, 2026-10-26: the hover said "drag me" but the press moved the whole unit):
      // a drag resizes it; a tap opens it (locked) or selects the unit (unlocked)
      if (mesh.userData.isPart && mesh.userData.drawerIdx != null && opts.onDrawerResize && !(mesh.userData.shelfBlock && mesh.userData.shelfBlock.locked)){
        lockTap = { meta:mesh.userData, x:evt.clientX, y:evt.clientY, drawerMesh:mesh, select:!mesh.userData.locked && !readOnly };
        controls.enabled = false; evt.stopPropagation(); // the press belongs to the drawer, not to orbiting
        return;
      }
      if (mesh.userData.isPart && !mesh.userData.locked && mesh.userData.bodyMesh) mesh = mesh.userData.bodyMesh; // fronts of an unlocked cabinet are just its body
      if (mesh.userData.locked){
        // locked cabinet / window / door: it cannot be dragged, so the press is left to OrbitControls; a tap opens/closes a drawer/door or selects
        lockTap = { meta:mesh.userData, x:evt.clientX, y:evt.clientY };
        return;
      }
      evt.stopPropagation();
      if (mesh.userData.kind === "decor"){ // furniture/decor: slides over the floor as one piece
        var dg = mesh; while (dg.parent && !dg.parent.isScene) dg = dg.parent;
        // dragged on a plane at its own height (a cup on the worktop follows the pointer, it slid with parallax on the floor plane)
        drag = { meta:mesh.userData, mesh:mesh, group:dg, island:true, decor:true, planeY:dg.position.y, startX:evt.clientX, startY:evt.clientY, moved:false, pt0:floorHit(evt, dg.position.y), dx:0, dz:0, groups:[dg] };
        controls.enabled = false;
        return;
      }
      if (mesh.userData.kind === "obstacle-resize"){ // milliveggur far-end handle: stretches/shrinks it along its own wall's normal (2026-10-20)
        drag = { meta:mesh.userData, mesh:mesh, resize:true, startX:evt.clientX, startY:evt.clientY, moved:false };
        controls.enabled = false;
        return;
      }
      if (mesh.userData.kind === "obstacle" && mesh.userData.free){ // a column / partition slides over the floor, anywhere in the room (2026-10-12)
        var og = mesh; while (og.parent && !og.parent.isScene) og = og.parent;
        var ow = new THREE.Vector3(); mesh.getWorldPosition(ow); // moved on a level plane at its own mid-height: no parallax
        drag = { meta:mesh.userData, mesh:mesh, group:og, island:true, decor:true, obstacle:true, planeY:ow.y, startX:evt.clientX, startY:evt.clientY, moved:false, pt0:floorHit(evt, ow.y), dx:0, dz:0, groups:[og] };
        controls.enabled = false;
        return;
      }
      if (mesh.userData.kind === "island"){ // island move-handle: slides the island's cabinets as one
        var iid = mesh.userData.islandId;
        drag = { meta:mesh.userData, mesh:mesh, group:mesh.parent, island:true, startX:evt.clientX, startY:evt.clientY, moved:false,
          pt0:floorHit(evt), dx:0, dz:0,
          groups:pickables.filter(function(m){ return m.userData.islandId === iid && !m.userData.isPart; }).map(function(m){ return m.parent; }) };
        controls.enabled = false;
        return;
      }
      if (mesh.userData.kind === "shelf-item" || mesh.userData.kind === "rail-item"){ // a loose shelf/fataslá in an open cabinet: drag it up/down (2026-10-21)
        drag = { meta:mesh.userData, mesh:mesh, shelfDrag:true, startX:evt.clientX, startY:evt.clientY, moved:false };
        controls.enabled = false;
        return;
      }
      var grip = gripOffsetMm(evt, mesh), bid = mesh.userData.blockId;
      drag = { meta:mesh.userData, mesh:mesh, group:mesh.parent, startX:evt.clientX, startY:evt.clientY, moved:false, gripMm:grip.along, gripYmm:grip.y,
        // a stack of shelves is several pickable boards under one block id: they all move together — and so do the
        // úthliðar bound to it (owner, 2026-10-27: they stayed behind while the box flew off; the drop re-attaches them)
        groups:pickables.filter(function(m){ return (m.userData.blockId === bid || (m.userData.lockToId && m.userData.lockToId === bid)) && !m.userData.isPart; }).map(function(m){ return m.parent; })
          .filter(function(g, i, all){ return all.indexOf(g) === i; }) };
      // a group inside another dragged group moves with it: moving it too applied the offset twice (a spegilskápur's shelves
      // flew out of the room, owner 2026-10-28)
      drag.groups = drag.groups.filter(function(g){ return !drag.groups.some(function(o){ var p = g.parent; while (p){ if (p === o) return true; p = p.parent; } return false; }); });
      controls.enabled = false;
    }
    var hovered = null;
    function edgesOf(m){ // the cabinet's outline — never another mesh (it painted decor chairs blue, then near-black, 2026-10-10)
      var e = m.userData.edgesObj || (m.parent && m.parent.children[1]);
      return e && (e.isLineSegments || e.isLine) ? e : null;
    }
    function isShelfOrRail(m){ return m && (m.userData.kind === "shelf-item" || m.userData.kind === "rail-item"); }
    // Gap-to-neighbour indicator (2026-10-22): a blue line + big label for the space BELOW the item and
    // another for the space ABOVE, each spanning from the item's own position to its real neighbour (or
    // the zone's floor/ceiling when there's none) — shown on hover AND mid-drag, so "how much room is
    // here" is visible before you commit to grabbing something, not just while dragging. Each label is one
    // reused sprite, repainted only when its text actually changes (like málband's own measureSprite/
    // measureSpriteSetText), and the line is a real cylinder mesh (WebGL ignores LineBasicMaterial.
    // linewidth almost everywhere, same reason málband's own tape line isn't a THREE.Line either).
    var GAP_LINE_T = 0.004, GAP_COLOR = 0x2b2b2e; // quiet dark line + a small white tag, like the Ný eining dimension lines (user, 2026-10-26: was big and blue)
    var gapBelow = { line:null, label:null }, gapAbove = { line:null, label:null };
    // the same look as the "+ Ný eining" dimension lines (user, 2026-10-26): a pill with the value, end ticks, blue while
    // the item is being dragged, dark while only pointed at
    var GAP_BLUE = "#0058a3", GAP_DARK = "#2b2b2e";
    function gapLabelPaint(cv, text, active){
      var cx = cv.getContext("2d"), col = active ? GAP_BLUE : GAP_DARK;
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.fillStyle = active ? col : "#fff"; cx.strokeStyle = col; cx.lineWidth = 4; cx.beginPath();
      var h = cv.height - 12;
      if (cx.roundRect) cx.roundRect(6, 6, cv.width - 12, h, h / 2); else cx.rect(6, 6, cv.width - 12, h); cx.fill(); cx.stroke();
      cx.fillStyle = active ? "#fff" : col; cx.font = "700 44px 'Kumbh Sans', Arial, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(text, cv.width / 2, cv.height / 2 + 2);
    }
    function gapText(mm){ return unitCm() ? Math.round(mm / 10) + " cm" : Math.round(mm) + " mm"; } // whole cm (user, 2026-10-26)
    function ensureGapPart(part){
      if (part.label) return;
      var cv = document.createElement("canvas"); cv.width = 260; cv.height = 92;
      var tex = new THREE.CanvasTexture(cv);
      part.label = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true, sizeAttenuation:false }));
      part.label.scale.set(0.105, 0.037, 1); part.label.renderOrder = 999;
      part.label.userData.canvas = cv; part.label.userData.lastText = "";
      part.line = new THREE.Mesh(new THREE.CylinderGeometry(GAP_LINE_T / 2, GAP_LINE_T / 2, 1, 8),
        new THREE.MeshBasicMaterial({ color:GAP_COLOR, depthTest:false, transparent:true, opacity:0.92 }));
      part.line.renderOrder = 998;
      part.ticks = [0, 1].map(function(){ var t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), part.line.material); t.renderOrder = 998; return t; });
      if (THREE_STATE && THREE_STATE.scene){ THREE_STATE.scene.add(part.label); THREE_STATE.scene.add(part.line); part.ticks.forEach(function(t){ THREE_STATE.scene.add(t); }); }
    }
    function setGapPart(part, text, x, z, ay, by, active, dir){ // ay/by: world Y of the two ends (either order)
      if (OV){ OV.gaps[part === gapBelow ? "below" : "above"] = { a:{ x:x, y:ay, z:z }, b:{ x:x, y:by, z:z }, text:text, active:!!active }; return; }
      ensureGapPart(part);
      var key = text + (active ? "|a" : "");
      if (part.label.userData.lastText !== key){
        gapLabelPaint(part.label.userData.canvas, text, active);
        part.label.material.map.needsUpdate = true;
        part.label.userData.lastText = key;
      }
      part.line.material.color.set(active ? GAP_BLUE : GAP_DARK);
      var lenM = Math.max(1e-4, Math.abs(by - ay)), midY = (ay + by) / 2, th = active ? 1.6 : 1;
      part.line.position.set(x, midY, z); part.line.scale.set(th, lenM, th);
      part.label.position.set(x, midY, z);
      var rotY = dir ? -Math.atan2(dir.z, dir.x) : 0;
      part.ticks.forEach(function(t, i){ t.position.set(x, i ? by : ay, z); t.rotation.set(0, rotY, 0); t.scale.set(1, th, th); t.visible = true; });
      part.line.visible = true; part.label.visible = true;
    }
    function showGapInfo(mesh, mm, trueLo, trueHi, active){ // mm/trueLo/trueHi: the item's own mm + its real neighbours'/zone's
      var wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
      var u = mesh.userData, dir;
      if (u.ax != null) dir = new THREE.Vector3(u.ax, 0, u.az); // the cabinet's own run (a rail's mesh is turned on its side)
      else { var wq = new THREE.Quaternion(); mesh.getWorldQuaternion(wq); dir = new THREE.Vector3(1, 0, 0).applyQuaternion(wq); }
      var off = wp.clone().addScaledVector(dir, (u.widthM || 0.6) / 2 + 0.07); // just past the item's own end
      var baseY = u.bodyBaseY, itemY = baseY + mm / 1000;
      setGapPart(gapBelow, gapText(mm - trueLo), off.x, off.z, baseY + trueLo / 1000, itemY, active, dir);
      setGapPart(gapAbove, gapText(trueHi - mm), off.x, off.z, itemY, baseY + trueHi / 1000, active, dir);
    }
    function hideGapInfo(){ if (OV) OV.gaps = {}; [gapBelow, gapAbove].forEach(function(p){ if (p.label) p.label.visible = false; if (p.line) p.line.visible = false; (p.ticks || []).forEach(function(t){ t.visible = false; }); }); }
    function setHover(mesh){
      if (mesh === hovered) return;
      if (hovered){
        var e0 = edgesOf(hovered);
        if (e0 && e0.material){
          if (hovered.userData.kind === "worktop") e0.visible = false;
          else if (isShelfOrRail(hovered)) e0.material.opacity = 0; // always blue — only its visibility toggles
          else if (!hovered.userData.selected) e0.material.color.set(hovered.userData.warn ? WARN_COLOR : 0x2a2a2a);
        }
      }
      hovered = mesh;
      if (hovered){
        var e1 = edgesOf(hovered);
        if (e1 && e1.material){
          if (hovered.userData.kind === "worktop") e1.visible = true;
          else if (isShelfOrRail(hovered)) e1.material.opacity = 1;
          else if (e1.material.color) e1.material.color.set(SELECT_COLOR);
        }
      }
      if (isShelfOrRail(hovered) && opts.onShelfPosInfo){
        var info = opts.onShelfPosInfo(hovered.userData.blockId, hovered.userData.itemKind, hovered.userData.idx);
        if (info) showGapInfo(hovered, info.mm, info.trueLo, info.trueHi); else hideGapInfo();
      } else if (hovered && hovered.userData.drawerIdx != null && opts.onDrawerResize){ // a wardrobe drawer shows it can be resized, like a shelf (user, 2026-10-26)
        var du = hovered.userData, wpH = new THREE.Vector3(); hovered.getWorldPosition(wpH);
        var offH = wpH.clone().addScaledVector(new THREE.Vector3(du.ax || 1, 0, du.az || 0), (du.widthM || 0.5) / 2 + 0.07);
        setGapPart(gapBelow, gapText((du.drawerTopY - du.drawerBotY) * 1000), offH.x, offH.z, du.drawerBotY, du.drawerTopY, false);
      } else hideGapInfo();
      renderer.domElement.style.cursor = hovered ? (hovered.userData.drawerIdx != null && opts.onDrawerResize ? "ns-resize" : hovered.userData.locked ? (hovered.userData.isPart ? "pointer" : "default") :
        (hovered.userData.kind === "shelf-item" || hovered.userData.kind === "rail-item") ? "ns-resize" : "grab") : "";
    }
    function onMove(evt){
      if (!drag && lockTap && lockTap.drawerMesh && Math.hypot(evt.clientX - lockTap.x, evt.clientY - lockTap.y) >= CABINET_DRAG_PX){
        drag = { drawerDrag:true, meta:lockTap.meta, mesh:lockTap.drawerMesh, startX:lockTap.x, startY:lockTap.y, moved:true };
        lockTap = null;
      }
      if (!drag){
        // málband (user, 2026-10-20): while measuring, the cursor is the tool's own crosshair (set by
        // setMeasureMode) — hovering a cabinet used to flip it to "grab" anyway, since this hover/cursor
        // logic ran unconditionally and MEASURING only ever gated onDown, not onMove
        if (MEASURING) return;
        if (evt.target === renderer.domElement){ var hm = pickMeshAt(evt); setHover(hm); if (!hm && opts.__spanMeshes && opts.__spanMeshes.length) renderer.domElement.style.cursor = spanAt(evt) ? "pointer" : ""; }
        else setHover(null);
        return;
      }
      if (!drag.moved){
        if (Math.hypot(evt.clientX - drag.startX, evt.clientY - drag.startY) < CABINET_DRAG_PX) return;
        drag.moved = true;
        if (opts.onCabinetDragStart && drag.meta && drag.meta.blockId && !drag.island && !drag.resize && !drag.shelfDrag && !drag.drawerDrag){
          // picked up: its úthliðar vanish at once so they can't get in the way of the move (owner, 2026-10-27/28)
          var gone = opts.onCabinetDragStart(drag.meta.blockId) || [];
          if (gone.length) pickables.forEach(function(pm){ if (pm.userData && gone.indexOf(pm.userData.blockId) >= 0 && pm.parent) pm.parent.visible = false; });
        }
      }
      if (drag.drawerDrag){
        raycaster.setFromCamera(ndc(evt), camera);
        var wpD = new THREE.Vector3(); drag.mesh.getWorldPosition(wpD);
        var toCamD = camera.position.clone().sub(wpD); toCamD.y = 0;
        if (toCamD.lengthSq() < 1e-6) toCamD.set(0, 0, 1); else toCamD.normalize();
        var dPt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(toCamD, wpD), dPt)){
          var dm = drag.meta, res2 = opts.onDrawerResize(dm.blockId, dm.drawerIdx, Math.round((dPt.y - dm.bodyBaseY) * 1000));
          if (res2){
            var wq2 = new THREE.Quaternion(); drag.mesh.getWorldQuaternion(wq2);
            var off2 = wpD.clone().addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(wq2), (dm.widthM || 0.5) / 2 + 0.09);
            setGapPart(gapBelow, res2.label, off2.x, off2.z, dm.drawerBotY, dm.drawerBotY + res2.mm / 1000, true, new THREE.Vector3(1, 0, 0).applyQuaternion(wq2));
          }
        }
        return;
      }
      if (drag.shelfDrag){ // a plane through the item facing the camera, horizontally — any camera angle still gives a clean vertical drag
        raycaster.setFromCamera(ndc(evt), camera);
        var wpS = new THREE.Vector3(); drag.mesh.getWorldPosition(wpS);
        var toCam = camera.position.clone().sub(wpS); toCam.y = 0;
        if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1); else toCam.normalize();
        var sPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(toCam, wpS);
        var sPt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(sPlane, sPt) && opts.onShelfPosMove){
          var res = opts.onShelfPosMove(drag.meta.blockId, drag.meta.itemKind, drag.meta.idx, Math.round((sPt.y - drag.meta.bodyBaseY) * 1000));
          // moves the mesh (and its hover outline) directly — no scene rebuild mid-drag, so the window
          // pointermove/pointerup listeners this gesture is riding on never get torn out from under it
          // (a renderView() rebuild recreates setupCabinetInteraction, which is what "losing grip" was)
          if (res){
            var boardOffM = drag.meta.itemKind === "shelf" ? -0.009 : 0; // matches the board/rod's own render offset
            var newY = drag.meta.bodyBaseY + res.mm / 1000 + boardOffM;
            drag.mesh.position.y = newY;
            if (drag.mesh.userData.edgesObj) drag.mesh.userData.edgesObj.position.y = newY;
            showGapInfo(drag.mesh, res.mm, res.trueLo, res.trueHi, true);
          }
        }
        return;
      }
      if (drag.resize){
        var wiR = walls.findIndex(function(w){ return w.id === drag.meta.wallId; }), gR = geoms[wiR], mR = drag.meta;
        if (gR){
          var ptR = floorHit(evt, drag.mesh.position.y); // the handle's own height, not the floor — truer to where the cursor visually is
          if (ptR){
            var dir = mR.rot ? gR.axis : gR.normal; // the partition's length axis
            var posMm = Math.round((((ptR.x - gR.origin.x) * dir.x + (ptR.z - gR.origin.z) * dir.z) * 1000 - (mR.gapMm || 0)) / 10) * 10; // 10 mm steps, from the real end (not the handle)
            var minLen = opts.onObstacleResizeMove ? opts.onObstacleResizeMove(mR.obstacleId) : 200; // the editor's floor (cabinets standing on it)
            var s0 = mR.s0, s1 = mR.s1;
            if (mR.end === "far") s1 = Math.min(s0 + 6000, Math.max(s0 + minLen, posMm));
            else s0 = Math.max(mR.rot ? 0 : 0, Math.min(s1 - minLen, posMm));
            drag.res = { s0:s0, s1:s1 };
            // live: stretch the box (its parts are children) along the length axis and move the handle
            var px = mR.proxy, len0 = (mR.s1 - mR.s0) / 1000, len = (s1 - s0) / 1000, mid = (s0 + s1) / 2000, mid0 = (mR.s0 + mR.s1) / 2000;
            if (mR.rot) px.scale.x = len / len0; else px.scale.z = len / len0;
            if (!drag.pos0) drag.pos0 = px.position.clone();
            px.position.set(drag.pos0.x + dir.x * (mid - mid0), drag.pos0.y, drag.pos0.z + dir.z * (mid - mid0));
            var hp = (mR.end === "far" ? s1 : s0) / 1000, h0 = (mR.end === "far" ? mR.s1 : mR.s0) / 1000;
            if (!drag.hpos0) drag.hpos0 = drag.mesh.position.clone();
            drag.mesh.position.set(drag.hpos0.x + dir.x * (hp - h0), drag.hpos0.y, drag.hpos0.z + dir.z * (hp - h0));
          }
        }
        return;
      }
      if (drag.island){
        var pt = floorHit(evt, drag.decor ? drag.planeY : 0);
        if (!pt || !drag.pt0) return;
        drag.dx = pt.x - drag.pt0.x; drag.dz = pt.z - drag.pt0.z;
        if (drag.decor){ // its own position/rotation: just move it — the editor stops it at walls and cabinets (opts.onDecorDragMove)
          if (!drag.base) drag.base = drag.group.position.clone();
          if (opts.onDecorDragMove && !drag.obstacle){
            var ok = opts.onDecorDragMove(drag.meta.decorId, Math.round((drag.base.x + drag.dx) * 1000), Math.round((drag.base.z + drag.dz) * 1000),
              Math.round(drag.group.position.x * 1000), Math.round(drag.group.position.z * 1000));
            if (ok){ drag.dx = ok.x / 1000 - drag.base.x; drag.dz = ok.z / 1000 - drag.base.z; }
            else { drag.dx = drag.group.position.x - drag.base.x; drag.dz = drag.group.position.z - drag.base.z; }
          }
          drag.group.position.set(drag.base.x + drag.dx, drag.base.y, drag.base.z + drag.dz);
          return;
        }
        if (opts.onIslandDragMove){ // stops at walls and cabinets, slides along them
          var okI = opts.onIslandDragMove(drag.meta.islandId, Math.round(drag.dx * 1000), Math.round(drag.dz * 1000), drag.lastDx || 0, drag.lastDz || 0);
          if (okI){ drag.dx = okI.x / 1000; drag.dz = okI.z / 1000; }
          drag.lastDx = Math.round(drag.dx * 1000); drag.lastDz = Math.round(drag.dz * 1000);
        }
        drag.groups.forEach(function(g){ g.matrixAutoUpdate = false; g.matrix.makeTranslation(drag.dx, 0, drag.dz); g.matrixWorldNeedsUpdate = true; });
        return;
      }
      var drop = dropAt(evt);
      // the editor may hand back where the cabinet would land (alignment snap): the cabinet follows that
      var landed = opts.onCabinetDragMove ? opts.onCabinetDragMove(drag.meta, drop) : null;
      followCursor(landed && drop && landed.alongMm != null && !drag.meta.kind ? Object.assign({}, drop, { alongMm:landed.alongMm }) : drop);
    }
    // The real cabinet slides along the wall under the cursor (free, not
    // snapped — the blue/red footprint shows where it will actually land),
    // and turns with the wall if the cursor moves to another one. Setting the
    // group matrix G = target * startInverse moves body, outline and seams as
    // one without touching their own transforms.
    // Eased follow: the cabinet glides toward the cursor's wall position each
    // frame (it turns with the wall and lifts a touch, so it reads as held),
    // instead of jumping. Setting group.matrix = target · startInverse moves
    // body, outline, plinth, worktop and details as one.
    var tgtPos = new THREE.Vector3(), tgtQuat = new THREE.Quaternion(), haveTarget = false;
    function followCursor(drop){
      if (THREE_STATE){ THREE_STATE.dragging = true; THREE_STATE.dragStep = stepFollow; }
      if (!drop) return;
      var wi = walls.findIndex(function(w){ return w.id === drop.wallId; });
      var g = geoms[wi];
      if (!g) return;
      var widthM = drag.meta.widthMm / 1000, depthM = drag.meta.depthMm / 1000;
      var offsetM = Math.max(0, Math.min(g.lenM - widthM, drop.alongMm / 1000 - widthM / 2));
      var mesh = drag.mesh;
      var ty;
      if (drag.meta.kind === "door") ty = mesh.position.y;
      else if (isWallItem(drag.meta)) ty = mesh.position.y + ((drop.elevMm != null ? drop.elevMm : (drag.meta.elevMm || 0)) - (drag.meta.elevMm || 0)) / 1000; // follows the cursor up and down the wall
      else ty = mesh.position.y + 0.035; // floor units lift a touch, as if held
      // Pull the dragged item 20 mm further out from the wall than it'll actually land — purely visual, never
      // affects the committed drop (onUp computes `finalDrop` fresh with its own raycast). Without this, sliding
      // a cabinet past a stationary neighbour on the same wall put both at the exact same depth and z-fought.
      // Doors/windows sit flush in the wall plane and stay there (popping them out would look wrong).
      var normOut = depthM / 2 + (drag.meta.kind === "door" ? 0 : 0.02);
      tgtPos.set(
        g.origin.x + g.axis.x * (offsetM + widthM / 2) + g.normal.x * normOut,
        ty,
        g.origin.z + g.axis.z * (offsetM + widthM / 2) + g.normal.z * normOut);
      tgtQuat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      if (!drag.curPos){ drag.curPos = mesh.position.clone(); drag.curQuat = mesh.quaternion.clone(); }
      haveTarget = true;
    }
    function stepFollow(){
      if (!drag || !drag.curPos || !haveTarget) return;
      drag.curPos.lerp(tgtPos, 0.3);
      drag.curQuat.slerp(tgtQuat, 0.3);
      var mesh = drag.mesh;
      var m0 = new THREE.Matrix4().compose(mesh.position, mesh.quaternion, new THREE.Vector3(1, 1, 1));
      var m1 = new THREE.Matrix4().compose(drag.curPos, drag.curQuat, new THREE.Vector3(1, 1, 1));
      var gm = m1.multiply(m0.invert());
      drag.groups.forEach(function(gr){
        gr.matrixAutoUpdate = false;
        gr.matrix.copy(gm);
        gr.matrixWorldNeedsUpdate = true;
      });
    }
    function onUp(evt){
      if (drag && drag.drawerDrag){
        var dD = drag; drag = null; controls.enabled = true; hideGapInfo(); hovered = null; suppressClick = true;
        if (opts.onDrawerResizeEnd) opts.onDrawerResizeEnd(dD.meta.blockId);
        return;
      }
      if (lockTap){
        var lt = lockTap; lockTap = null;
        if (lt.drawerMesh) controls.enabled = true;
        if (Math.hypot(evt.clientX - lt.x, evt.clientY - lt.y) < CABINET_DRAG_PX){
          suppressClick = true; // the click that follows must not also pick the wall behind it (a locked window used to select its wall, 2026-10-10)
          if (lt.meta.isPart && lt.meta.partKey && !lt.select) togglePart(lt.meta.partKey);
          else if (opts.onSelect) opts.onSelect(lt.meta);
        }
        return;
      }
      if (!drag) return;
      if (drag.shelfDrag){
        var dS = drag;
        drag = null; controls.enabled = true; renderer.domElement.style.cursor = "";
        hideGapInfo(); hovered = null; // onMove's hover branch was skipped all through the drag — force it to re-evaluate fresh on the next move
        if (dS.moved){ suppressClick = true; if (opts.onShelfPosEnd) opts.onShelfPosEnd(dS.meta.blockId); }
        return;
      }
      if (drag.resize){
        var dR = drag;
        drag = null; controls.enabled = true; renderer.domElement.style.cursor = "";
        if (dR.moved){ suppressClick = true; if (opts.onObstacleResizeEnd) opts.onObstacleResizeEnd(dR.meta.obstacleId, dR.res ? { s0:dR.res.s0, s1:dR.res.s1, rot:dR.meta.rot } : null); }
        return;
      }
      if (drag.island){
        var d0 = drag;
        drag = null; haveTarget = false;
        controls.enabled = true;
        renderer.domElement.style.cursor = "";
        if (d0.moved){
          if (!d0.decor) d0.groups.forEach(function(g){ g.matrix.identity(); g.matrixWorldNeedsUpdate = true; });
          suppressClick = true;
          if (d0.obstacle){ if (opts.onObstacleFloorEnd) opts.onObstacleFloorEnd(d0.meta.blockId, freeSpotOnWalls(d0)); }
          else if (d0.decor){ if (opts.onDecorDragEnd) opts.onDecorDragEnd(d0.meta.decorId, Math.round(d0.dx * 1000), Math.round(d0.dz * 1000)); }
          else if (opts.onIslandDragEnd) opts.onIslandDragEnd(d0.meta.islandId, Math.round(d0.dx * 1000), Math.round(d0.dz * 1000));
        } else if (opts.onSelect){
          opts.onSelect(d0.meta);
        }
        return;
      }
      var meta = drag.meta, moved = drag.moved;
      // must be computed while `drag` is still set: dropAt uses its mid-height plane and grip offset
      var finalDrop = moved ? dropAt(evt) : null;
      if (moved){ drag.groups.forEach(function(gr){ gr.matrix.identity(); gr.matrixWorldNeedsUpdate = true; }); }
      haveTarget = false;
      if (THREE_STATE){ THREE_STATE.dragging = false; THREE_STATE.dragStep = null; }
      drag = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = "";
      if (moved){
        suppressClick = true;
        if (opts.onCabinetDragEnd) opts.onCabinetDragEnd(meta, finalDrop);
      } else if (opts.onSelect){
        opts.onSelect(meta);
      }
    }
    function onClickEmpty(evt){
      if (suppressClick){ suppressClick = false; return; }
      if (pickMeshAt(evt)) return; // a tap on a cabinet was already handled in onUp
      var spanHit = spanAt(evt);
      if (spanHit && opts.onClosetSpanClick){ opts.onClosetSpanClick(spanHit.userData.closetSpanWallId); return; }
      // A bare wall surface looks exactly like empty space in 3D (no highlight, no cursor cue) — unlike the
      // 2D plan's own wall line (a deliberate, clearly-clickable stroke), so a click here no longer opens the
      // wall panel (user, 2026-10-13): "blank space" should just deselect, not select the wall underneath it.
      if (opts.onSelect) opts.onSelect(null);
    }

    // a right-click (not a right-drag, which pans) on a cabinet peeks inside; no browser menu over the 3D
    var rDown = null;
    function onRDown(evt){ rDown = evt.button === 2 ? { x:evt.clientX, y:evt.clientY } : null; }
    function onRUp(evt){
      if (evt.button !== 2 || !rDown) return;
      var moved = Math.hypot(evt.clientX - rDown.x, evt.clientY - rDown.y) > 5; rDown = null;
      if (moved || MEASURING || drag) return;
      var mesh = pickMeshAt(evt), u = mesh && mesh.userData;
      if (!u || !u.blockId || /^(obstacle|decor|opening)/.test(String(u.kind || u.zone || ""))) return;
      if (u.isPart && u.partKey){ togglePart(u.partKey); return; } // right-click on one drawer / door opens only that one (user, 2026-10-27); the carcass opens the whole cabinet
      peekToggle(u.blockId, opts.onPeek);
      if (opts.onPeekToggle) opts.onPeekToggle(u.blockId);
    }
    function onCtx(e){ e.preventDefault(); }
    wrap.addEventListener("pointerdown", onDown, { capture:true });
    wrap.addEventListener("pointerdown", onRDown);
    window.addEventListener("pointerup", onRUp);
    renderer.domElement.addEventListener("contextmenu", onCtx);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("click", onClickEmpty);
    return function cleanup(){
      wrap.removeEventListener("pointerdown", onRDown);
      window.removeEventListener("pointerup", onRUp);
      renderer.domElement.removeEventListener("contextmenu", onCtx);
      wrap.removeEventListener("pointerdown", onDown, { capture:true });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("click", onClickEmpty);
    };
  }

  // Flat translucent footprint on the floor showing where the dragged
  // cabinet will land (blue = fits, red = wall full) — the 3D counterpart of
  // kitchen-planner.html's 2D drag-preview polygon.
  // heightMm/baseMm (optional) add a translucent ghost of the cabinet's real
  // volume at the landing spot; the target wall also gets a soft "drop band".
  function updateDragPreview3D(wallId, offsetMm, widthMm, depthMm, ok, heightMm, baseMm){
    if (!THREE_STATE) return;
    var THREE = window.__THREE__, st = THREE_STATE;
    var wi = st.walls.findIndex(function(w){ return w.id === wallId; });
    var g = st.geoms[wi];
    if (!g){ hideDragPreview3D(); return; }
    var col = ok ? 0x3d61c1 : 0xb3432f;
    function quad(mesh, corners, y){
      var p = corners, geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
        p[0].x, y, p[0].z,  p[1].x, y, p[1].z,  p[2].x, y, p[2].z,
        p[0].x, y, p[0].z,  p[2].x, y, p[2].z,  p[3].x, y, p[3].z
      ]), 3));
      mesh.geometry.dispose(); mesh.geometry = geo;
    }
    function ensure(key, opacity){
      if (!st[key]){
        st[key] = new THREE.Mesh(new THREE.BufferGeometry(),
          new THREE.MeshBasicMaterial({ color:0x3d61c1, transparent:true, opacity:opacity, side:THREE.DoubleSide, depthWrite:false }));
        st.scene.add(st[key]);
      }
      st[key].material.color.set(col);
      st[key].visible = true;
      return st[key];
    }
    quad(ensure("previewMesh", 0.5), rectCornersWorld(g, offsetMm, widthMm, depthMm), 0.012);
    quad(ensure("bandMesh", 0.16), rectCornersWorld(g, 0, g.lenM * 1000, 70), 0.008);
    if (heightMm){
      if (!st.ghostBox){
        st.ghostBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color:0x3d61c1, transparent:true, opacity:0.2, depthWrite:false }));
        st.ghostBox.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color:0x3d61c1, transparent:true, opacity:0.8 })));
        st.scene.add(st.ghostBox);
      }
      var w = widthMm / 1000, h = heightMm / 1000, d = depthMm / 1000, off = offsetMm / 1000;
      st.ghostBox.scale.set(w, h, d);
      st.ghostBox.position.set(
        g.origin.x + g.axis.x * (off + w / 2) + g.normal.x * (d / 2), (baseMm || 0) / 1000 + h / 2,
        g.origin.z + g.axis.z * (off + w / 2) + g.normal.z * (d / 2));
      st.ghostBox.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      st.ghostBox.material.color.set(col);
      st.ghostBox.children[0].material.color.set(col);
      st.ghostBox.visible = true;
    } else if (st.ghostBox) st.ghostBox.visible = false;
  }

  // Screen point → {wallId, alongMm} for the live 3D scene (used when a
  // catalog item is dragged in from the side panel); null when the point is
  // outside the canvas or misses the floor.
  // planeYm (optional) = height of the horizontal plane the pointer ray is cast
  // onto — pass the dragged item's mid-height so the point matches what the
  // cursor visually covers (default: the floor).
  // wallItem (optional) = {depthMm, heightMm} of a wall-mounted thing: the ray is
  // then cast onto the wall's own plane and the result also carries elevMm (the
  // item's bottom edge above the floor), whatever the camera angle.
  function dropPointFromClient(clientX, clientY, planeYm, wallsOnly, wallItem){
    if (!THREE_STATE) return null;
    var rect = THREE_STATE.renderer.domElement.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    var THREE = window.__THREE__;
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), THREE_STATE.camera);
    if (wallItem){
      var wh = wallPlaneHit(rc.ray, THREE_STATE.geoms, THREE_STATE.walls, (wallItem.depthMm || 0) / 2000, THREE_STATE.roomHM);
      if (wh) return { wallId:wh.wallId, alongMm:wh.alongMm, elevMm:Math.round(wh.y * 1000 - (wallItem.heightMm || 0) / 2) };
    }
    var pt = new THREE.Vector3();
    if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(planeYm || 0)), pt)) return null;
    return nearestWallDrop(THREE_STATE.geoms, THREE_STATE.walls, pt.x, pt.z, wallsOnly);
  }

  // Screen point → {xMm, zMm} on the floor (for dropping a new island from the catalog).
  function floorPointFromClient(clientX, clientY){
    if (!THREE_STATE) return null;
    var rect = THREE_STATE.renderer.domElement.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    var THREE = window.__THREE__, rc = new THREE.Raycaster(), pt = new THREE.Vector3();
    rc.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), THREE_STATE.camera);
    if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return null;
    return { xMm:Math.round(pt.x * 1000), zMm:Math.round(pt.z * 1000) };
  }

  // Selection without a rebuild: swap the highlight on the affected meshes in
  // place (a full teardown+rebuild cost ~80 ms with 20 cabinets, which made
  // plain clicks feel laggy). Returns false when there's no live scene, so
  // the caller falls back to a normal re-render.
  function setSelected3D(id){
    if (!THREE_STATE) return false;
    var THREE = window.__THREE__;
    THREE_STATE.pickables.forEach(function(m){
      var u = m.userData, want = u.blockId === id;
      if (!!u.selected === want) return;
      u.selected = want;
      if (u.isPart) return; // fronts of a locked cabinet: only the outline shows the selection
      if (u.kind === "obstacle"){ // the invisible grab box: tint its visible parts
        m.children.forEach(function(ch){ if (ch.material && ch.material.emissive){ ch.material.emissive = new THREE.Color(want ? SELECT_COLOR : 0x000000); ch.material.emissiveIntensity = want ? 0.55 : 0; } });
        return;
      }
      var cab = m.parent && m.parent.userData && m.parent.userData.cab;
      if (cab && cab.items && cab.t > 0){ cab.items.forEach(function(it){ it.o.material = it.orig; }); cab.t = 0; } // back to solid before the material slots are touched
      if (Array.isArray(m.material)){ // cabinet
        if (u.open || u.art){ /* open shelves have NO front: swapping slot 4 for the real front material gave them a door */ }
        else if (want && !outlineSel){
          var c = u.baseFront.clone();
          c.emissive = new THREE.Color(SELECT_COLOR); c.emissiveIntensity = 0.35;
          c.__xrayBase = u.baseFront; // same tag as addCabinetBox's build-time selection clone — setXrayFronts
          // only strips THREE_STATE.frontMat plus anything tagged back to it; this runtime clone (selecting
          // without a full rebuild) was missing it, so the one cabinet you had selected stayed opaque under X-ray
          m.material[4] = c;
        } else if (m.material[4] !== u.baseFront){
          m.material[4].dispose();
          m.material[4] = u.baseFront;
        }
        var e = m.parent && m.parent.children[1];
        if (e && e.material && e.material.color) e.material.color.set(want ? SELECT_COLOR : (u.warn ? WARN_COLOR : 0x2a2a2a));
      } else if (u.gap){ // opening in the wall: a faint tint over the hole
        m.material.opacity = want ? 0.25 : 0;
      } else if (m.material.isMeshBasicMaterial){ // window glass (unlit daylight): tint its colour. An `emissive` on a basic
        // material made every frame throw while it was selected — everything drawn after it (the walls) vanished (2026-10-10)
        if (!u.baseColor) u.baseColor = m.material.color.clone();
        m.material.color.copy(want ? u.baseColor.clone().lerp(new THREE.Color(SELECT_COLOR), 0.45) : u.baseColor);
      } else if (m.material.emissive){ // window / door plane
        m.material.emissive = new THREE.Color(want ? SELECT_COLOR : 0x000000);
        m.material.emissiveIntensity = want ? 0.55 : 0;
      }
    });
    THREE_STATE.opts.selectedId = id;
    return true;
  }

  // Highlight of the selected wall (blue tint + frame on its room face), applied
  // in place like setSelected3D. wallId null clears it.
  function setSelectedWall3D(wallId){
    var st = THREE_STATE;
    if (!st) return false;
    var THREE = window.__THREE__;
    if (st.wallHi){
      st.scene.remove(st.wallHi);
      st.wallHi.traverse(function(o){ if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      st.wallHi = null;
    }
    st.opts.selectedWallId = wallId || null;
    if (!wallId) return true;
    var wi = st.walls.findIndex(function(w){ return w.id === wallId; }), g = st.geoms[wi];
    if (!g || st.walls[wi].island || st.walls[wi].open) return true;
    var hM = st.roomHM, grp = new THREE.Group();
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
    var pane = new THREE.Mesh(new THREE.PlaneGeometry(g.lenM, hM),
      new THREE.MeshBasicMaterial({ color:SELECT_COLOR, transparent:true, opacity:0.22, side:THREE.DoubleSide, depthWrite:false }));
    pane.quaternion.copy(quat);
    pane.position.set(g.origin.x + g.axis.x * g.lenM / 2 + g.normal.x * 0.006, hM / 2, g.origin.z + g.axis.z * g.lenM / 2 + g.normal.z * 0.006);
    pane.renderOrder = 5;
    if (!outlineSel) grp.add(pane); // customers get only the blue frame — the see-through blue pane tinted every open unit lilac (owner, 2026-10-28)
    function bar(w, h, along, y){
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), new THREE.MeshBasicMaterial({ color:SELECT_COLOR, depthWrite:false }));
      m.quaternion.copy(quat);
      m.position.set(g.origin.x + g.axis.x * along + g.normal.x * 0.008, y, g.origin.z + g.axis.z * along + g.normal.z * 0.008);
      m.renderOrder = 6;
      grp.add(m);
    }
    bar(g.lenM, 0.035, g.lenM / 2, 0.0175); bar(g.lenM, 0.035, g.lenM / 2, hM - 0.0175);
    bar(0.035, hM, 0.0175, hM / 2); bar(0.035, hM, g.lenM - 0.0175, hM / 2);
    st.scene.add(grp);
    st.wallHi = grp;
    return true;
  }

  // PNG of the current 3D view: render once and read the canvas in the same
  // tick (without preserveDrawingBuffer the buffer is cleared after compositing).
  function snapshot3D(){
    if (!THREE_STATE) return null;
    THREE_STATE.renderer.render(THREE_STATE.scene, THREE_STATE.camera);
    return THREE_STATE.renderer.domElement.toDataURL("image/png");
  }

  // Drawing export (2026-09-30): point the live camera at an arbitrary position/target — the caller
  // (kitchen-planner.html's exportDrawings()) computes wall-elevation and orbit-overview positions from
  // KP3D.wallGeometry3D() and calls this + snapshot3D() once per shot. Doesn't touch OrbitControls'
  // damping/animation loop, just the camera + target it reads next frame; the caller is responsible for
  // restoring the customer's own view afterwards (teardown3D(true) + rebuild, same as resetCamBtn).
  // X-ray export (2026-09-30): toggles the room's one shared front material transparent so a wall
  // elevation shows the real interior (shelves/drawer boxes) instead of a closed front. Only works
  // together with `buildScene({xray:true})` — that's what forces every eligible cabinet into the
  // "locked/articulated" build (separate 20mm front slabs + real shelves/drawer boxes), which a plain
  // unlocked cabinet never gets (it's a single solid box with no interior geometry at all to reveal).
  // Every cabinet's front slab shares this ONE material object (frontSlab() never clones it), so
  // toggling it once affects the whole room; restore opacity 1 before the customer's own view returns.
  // hide (owner, 2026-10-27): the fronts not drawn at all — the Efni colour page shows the empty box, not grey ghost doors
  function setXrayFronts(on, hide){
    if (!THREE_STATE || !THREE_STATE.frontMat) return false;
    var m = THREE_STATE.frontMat;
    function strip(mat){
      mat.transparent = true;
      mat.opacity = on ? 0.1 : 1;
      mat.depthWrite = !on;
      mat.visible = !(on && hide);
      mat.needsUpdate = true;
    }
    strip(m);
    // See-through fronts must not cast shadows (thin slabs gave striped shadow acne under the worktop),
    // and their handles / seams go with them. Tagged objects are hidden, not removed — "on" restores them.
    // The selected cabinet's front is its own clone of `m` (addCabinetBox, for the blue highlight tint) —
    // never `m` itself, so it never showed through X-ray until toggled a second time (once it lost
    // selection): stripped here too via its __xrayBase tag back to `m`.
    THREE_STATE.scene.traverse(function(o){
      if (o.__frontDetail){ o.visible = !on; return; }
      if (!o.isMesh) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      var hit = mats.some(function(mat){ return mat === m || mat.__xrayBase === m; });
      if (!hit) return;
      mats.forEach(function(mat){ if (mat !== m && mat.__xrayBase === m) strip(mat); });
      if (o.__castShadow0 == null) o.__castShadow0 = o.castShadow;
      o.castShadow = on ? false : o.__castShadow0;
    });
    return true;
  }
  // Hover preview of a front on the live scene (2026-10-26): the look swapped on every front material in place — no
  // rebuild (a whole kitchen took ~250 ms per swatch). The UVs were laid out for the built look's tile, so the new
  // texture repeats by old/new tile; the textures are cached and shared, so this works on its own clones. FR2 fronts
  // are left alone. previewFront(null) puts the built look back. false = can't do it here, the caller rebuilds.
  var frontSwap = null;
  function previewFront(key){
    var st = THREE_STATE, THREE = window.__THREE__;
    if (frontSwap && (!st || frontSwap.scene !== st.scene)) frontSwap = null; // rebuilt since: nothing of ours left on screen
    if (!st || !st.frontMat || !THREE) return false;
    if (!key){
      if (!frontSwap) return false;
      frontSwap.mats.forEach(function(e){ Object.assign(e.mat, e.orig); e.mat.needsUpdate = true; });
      dropClones(); frontSwap = null; return true;
    }
    var base = st.frontMat, tile0 = base.userData && base.userData.tile, look = LOOKS[key];
    if (!look || !tile0 || !window.KPMat) return false; // a plain-colour front has no tiled UVs to reuse
    if (!frontSwap){
      var mats = [];
      st.scene.traverse(function(o){
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
          if (m && (m === base || (m.userData && m.userData.studio === "front" && !m.userData.fr2)) && !mats.some(function(e){ return e.mat === m; }))
            mats.push({ mat:m, orig:{ map:m.map, bumpMap:m.bumpMap || null, bumpScale:m.bumpScale, roughness:m.roughness } });
        });
      });
      frontSwap = { scene:st.scene, mats:mats, clones:[] };
      if (!previewFront.wired){ previewFront.wired = true; // a photo came in after the swap: its clone still holds the placeholder
        window.addEventListener("kp3d-tex-loaded", function(){ if (frontSwap) frontSwap.clones.forEach(function(x){ if (x.c.source !== x.src.source){ x.c.source = x.src.source; x.c.needsUpdate = true; } }); }); }
    }
    dropClones();
    var nm = makeFrontMaterial(THREE, key, look), t1 = nm.userData.tile || tile0;
    function tiled(src){
      if (!src) return null;
      var c = src.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(tile0.w / t1.w, tile0.h / t1.h); c.needsUpdate = true;
      frontSwap.clones.push({ c:c, src:src }); return c;
    }
    var map = tiled(nm.map), bump = tiled(nm.bumpMap);
    frontSwap.mats.forEach(function(e){ var m = e.mat; m.map = map; m.bumpMap = bump; if (bump) m.bumpScale = nm.bumpScale; m.roughness = nm.roughness; m.needsUpdate = true; });
    nm.dispose();
    return true;
    function dropClones(){ if (frontSwap){ frontSwap.clones.forEach(function(x){ x.c.dispose(); }); frontSwap.clones = []; } }
  }
  // Drawing export: render the live scene from an arbitrary camera at a fixed pixel size and return a
  // JPEG data URL. spec = {pos, target, up?, fov? | ortho:{halfW, halfH}, width, height, quality}.
  // The fade systems (walls / cabinets seen from behind) follow this camera for `settle` frames first
  // (they ease 0.2 per frame), so what's in the way is gone before the picture is taken. Resolves to
  // {url, halfW, halfH} — halfW/halfH = the ortho frustum actually used (after fitting the aspect),
  // so the caller can map metres to pixels for dimension lines.
  function renderShot(spec){
    return new Promise(function(resolve){
      if (!THREE_STATE){ resolve(null); return; }
      var THREE = window.__THREE__, st = THREE_STATE, r = st.renderer;
      var w = spec.width || 1600, h = spec.height || 1000, hw = 0, hh = 0, cam;
      if (spec.ortho){
        hw = spec.ortho.halfW; hh = spec.ortho.halfH;
        if (hw / hh > w / h) hh = hw * h / w; else hw = hh * w / h;
        cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 200);
      } else {
        cam = new THREE.PerspectiveCamera(spec.fov || 45, w / h, 0.05, 200);
      }
      if (spec.up) cam.up.set(spec.up.x, spec.up.y, spec.up.z);
      cam.position.set(spec.pos.x, spec.pos.y, spec.pos.z);
      cam.lookAt(spec.target.x, spec.target.y, spec.target.z);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      st.fadeCam = cam;
      for (var k = 0; k < (spec.settle == null ? 40 : spec.settle); k++) if (st.stepFades) st.stepFades(); // 0.2 ease per step → settled
      setTimeout(function(){ // one macrotask so async-loaded models/textures that just arrived get in
        if (THREE_STATE !== st){ resolve(null); return; }
        var old = r.getSize(new THREE.Vector2()), oldPR = r.getPixelRatio();
        // spec.headlight: a soft light from the camera itself + extra fill, so the inside of a
        // cabinet seen head-on (X-ray elevations) reads bright instead of in its own shadow
        var extra = [];
        if (spec.headlight){
          var hl = new THREE.DirectionalLight(0xffffff, spec.headlight);
          hl.position.copy(cam.position).add(new THREE.Vector3(1.5, 4, 1.5)); hl.target.position.set(spec.target.x, spec.target.y, spec.target.z);
          extra.push(hl, hl.target, new THREE.AmbientLight(0xffffff, 0.25));
          extra.forEach(function(o){ st.scene.add(o); });
        }
        r.setPixelRatio(1); r.setSize(w, h, false);
        r.render(st.scene, cam);
        extra.forEach(function(o){ st.scene.remove(o); });
        var url = r.domElement.toDataURL("image/jpeg", spec.quality || 0.86);
        r.setPixelRatio(oldPR); r.setSize(old.x, old.y, false);
        st.fadeCam = null;
        resolve({ url:url, halfW:hw, halfH:hh });
      }, 0);
    });
  }
  // Room card picture (Allt heimilið round 3, 2026-10-26): the units framed, from the room side of the walls they stand
  // on, turned 25° and a little from above — the same angle for every room, nothing cropped. Synchronous (the caller
  // tears the scene down right after), so it renders what is in the scene now. → JPEG data URL or null.
  function unitsShot(spec){
    var st = THREE_STATE, THREE = window.__THREE__; spec = spec || {};
    if (!st || !THREE) return null;
    var box = new THREE.Box3(), any = false, n = new THREE.Vector3(), mid = new THREE.Vector3(), ng = 0;
    (st.pickables || []).forEach(function(m){ var u = m.userData || {}; if (!u.blockId) return; box.expandByObject(m); any = true;
      var wi = (st.walls || []).findIndex(function(x){ return x.id === u.wallId; }), g = wi >= 0 && st.geoms ? st.geoms[wi] : null; if (g && g.normal && !(st.walls[wi] || {}).island){ n.x += g.normal.x; n.z += g.normal.z; ng++; } });
    if (!any || box.isEmpty()) return null;
    var nw = 0; (st.geoms || []).forEach(function(g, i){ if (g.origin && st.walls && st.walls[i] && !st.walls[i].island){ mid.x += g.origin.x; mid.z += g.origin.z; nw++; } });
    if (nw) mid.multiplyScalar(1 / nw);
    var c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    if (n.lengthSq() < 1e-6){ n.set(mid.x - c.x, 0, mid.z - c.z); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); }
    n.y = 0; n.normalize();
    var a = 25 * Math.PI / 180, dir = new THREE.Vector3(n.x * Math.cos(a) - n.z * Math.sin(a), 0, n.x * Math.sin(a) + n.z * Math.cos(a));
    var w = spec.width || 480, h = spec.height || 300, fov = 38, r = Math.max(0.6, sz.length() / 2);
    var dist = r / Math.sin(fov / 2 * Math.PI / 180) * 0.9; // the bounding sphere is generous: a little closer still frames every unit
    var cam = new THREE.PerspectiveCamera(fov, w / h, 0.05, 200);
    cam.position.set(c.x + dir.x * dist, c.y + dist * 0.32, c.z + dir.z * dist);
    cam.lookAt(c.x, c.y, c.z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    st.fadeCam = cam;
    for (var k = 0; k < 40; k++) if (st.stepFades) st.stepFades(); // the walls in the way fade out first
    var rr = st.renderer, old = rr.getSize(new THREE.Vector2()), oldPR = rr.getPixelRatio();
    rr.setPixelRatio(1); rr.setSize(w, h, false);
    rr.render(st.scene, cam);
    var url = rr.domElement.toDataURL("image/jpeg", spec.quality || 0.8);
    rr.setPixelRatio(oldPR); rr.setSize(old.x, old.y, false);
    st.fadeCam = null;
    return url;
  }
  // Studio mynd (2026-10-23): path-trace the live scene from the live camera (three-gpu-pathtracer, loaded on demand)
  // → a JPEG data URL. The editor's own loop is paused meanwhile; labels, handles, see-through (faded) walls and
  // cabinets, lines and sprites are hidden; a soft daylight sky lights it (and shows through the windows).
  function studioSky(THREE){
    var W = 256, H = 128, data = new Float32Array(W * H * 4);
    for (var y = 0; y < H; y++){
      var v = 1 - y / (H - 1), el = (v - 0.5) * Math.PI; // +π/2 zenith … −π/2 nadir
      var t = Math.max(0, Math.sin(el)), g = Math.max(0, -Math.sin(el));
      for (var x = 0; x < W; x++){
        var i = (y * W + x) * 4, sunU = Math.abs((x / W) - 0.15), sun = Math.exp(-((sunU * sunU) * 400 + Math.pow(el - 0.6, 2) * 40)) * 18;
        data[i] = 1.05 - 0.25 * t - 0.6 * g + sun; data[i + 1] = 1.08 - 0.15 * t - 0.62 * g + sun * 0.95; data[i + 2] = 1.15 + 0.05 * t - 0.65 * g + sun * 0.85; data[i + 3] = 1;
      }
    }
    var tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
    return tex;
  }
  // The photo's own scene: only what's really visible, each mesh with a material rebuilt from its ROLE (userData.studio)
  // — matte paint walls, the floor's planks with a satin lacquer, fronts with their decor + a light lacquer coat, a
  // honed/polished worktop, brushed steel, real glass. Overlays (selection rings, pick boxes, shadow shell, glows,
  // labels, faded/see-through walls) are left out entirely, so nothing invisible can block or recolour the picture.
  function studioMaterial(THREE, m){
    if (!m || m.visible === false || m.colorWrite === false) return null;
    var role = m.userData && m.userData.studio;
    if (m.transparent && m.opacity < 0.5 && role !== "glass") return null; // faded walls / x-rayed fronts
    if (role === "glass") return new THREE.MeshPhysicalMaterial({ color:0xffffff, metalness:0, roughness:0.02, transmission:1, ior:1.5, thickness:0.004, side:THREE.DoubleSide });
    if (m.isMeshBasicMaterial) return null; // markers, rings, badges, glows
    var base = { color:m.color ? m.color.clone() : new THREE.Color(0xffffff), map:m.map || null, side:m.side };
    if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() && role !== "front" && role !== "carcass"){ base.emissive = m.emissive.clone(); base.emissiveIntensity = m.emissiveIntensity; }
    switch (role){
      case "wall": return new THREE.MeshStandardMaterial({ color:base.color, roughness:0.92, metalness:0, side:THREE.FrontSide });
      case "floor": return new THREE.MeshPhysicalMaterial({ color:base.color, map:base.map, roughness:0.55, clearcoat:0.25, clearcoatRoughness:0.35 }); // no roughnessMap: a second texture on one material came out scrambled in the path tracer
      case "front": return new THREE.MeshPhysicalMaterial({ color:base.color, map:base.map, roughness:Math.min(0.75, m.roughness || 0.6), metalness:0, clearcoat:0.18, clearcoatRoughness:0.45 });
      case "carcass": case "plinth": return new THREE.MeshStandardMaterial({ color:base.color, roughness:0.8, metalness:0 });
      case "top": return new THREE.MeshPhysicalMaterial({ color:base.color, map:base.map, roughness:0.32, metalness:0, clearcoat:0.5, clearcoatRoughness:0.2 });
      case "steel": return new THREE.MeshPhysicalMaterial({ color:base.color, metalness:1, roughness:0.28 });
      case "appliance": return new THREE.MeshPhysicalMaterial({ color:base.color, roughness:0.3, clearcoat:0.6 });
    }
    var out = new THREE.MeshPhysicalMaterial({ color:base.color, map:base.map, roughness:m.roughness != null ? m.roughness : 0.6, metalness:m.metalness || 0,
      roughnessMap:m.roughnessMap || null, normalMap:m.normalMap || null, side:base.side });
    if (base.emissive){ out.emissive = base.emissive; out.emissiveIntensity = base.emissiveIntensity; }
    if (m.transparent && m.opacity < 1){ out.transparent = true; out.opacity = m.opacity; }
    return out;
  }
  // One mesh PER MATERIAL, world transforms baked in: the path tracer gets plain, uniform input (position + normal + uv,
  // non-indexed, no groups, no material arrays). Handing it the editor's hundreds of meshes as they are (groups, arrays,
  // missing uvs, shared geometry) scrambled which material landed on which surface — walls in wood, fronts black.
  function studioScene(THREE, src, o){
    src.updateMatrixWorld(true);
    var rs = new THREE.Scene(), made = [], box = new THREE.Box3(), cabBox = new THREE.Box3(), roomBox = new THREE.Box3(), cache = new Map(), buckets = new Map();
    function conv(m){
      if (!cache.has(m)){
        var c = studioMaterial(THREE, m);
        if (c){ var rl = (m.userData && m.userData.studio) || "other"; c.userData.role = rl;
          if (o && (o.noMaps || (o.mapRole && String(o.mapRole).split(",").indexOf(rl) < 0))){ c.map = null; c.roughnessMap = null; c.normalMap = null; }
          // a texture's repeat / offset / rotation is baked into the UVs instead (push() below) and the photo gets a plain,
          // untransformed copy of the image — transformed textures came out blank or swapped in the path tracer
          if (c.map){
            var src0 = c.map; src0.updateMatrix(); c.userData.uvm = src0.matrix.clone();
            var t2 = new THREE.Texture(src0.image); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.colorSpace = src0.colorSpace; t2.flipY = src0.flipY; t2.needsUpdate = true;
            c.map = t2; made.push(t2);
          }
          c.roughnessMap = null; c.normalMap = null; if (c.side !== THREE.DoubleSide && !c.transmission) c.side = THREE.DoubleSide; made.push(c); }
        cache.set(m, c);
      }
      return cache.get(m);
    }
    var v = new THREE.Vector3(), nm = new THREE.Matrix3();
    function push(mat, g, from, count, mw){
      var b = buckets.get(mat); if (!b){ b = { p:[], n:[], u:[] }; buckets.set(mat, b); }
      var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      nm.getNormalMatrix(mw);
      for (var i = from; i < from + count; i++){
        v.fromBufferAttribute(P, i).applyMatrix4(mw); b.p.push(v.x, v.y, v.z); box.expandByPoint(v);
        if (mat.userData.role === "front" || mat.userData.role === "carcass" || mat.userData.role === "top") cabBox.expandByPoint(v);
        else if (mat.userData.role === "floor") roomBox.expandByPoint(v);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); b.n.push(v.x, v.y, v.z);
        if (U){
          var uu = U.getX(i), vv = U.getY(i), M = mat.userData.uvm && mat.userData.uvm.elements;
          if (M){ var u2 = M[0] * uu + M[3] * vv + M[6], v2 = M[1] * uu + M[4] * vv + M[7]; uu = u2; vv = v2; }
          b.u.push(uu, vv);
        } else b.u.push(0, 0);
      }
    }
    src.traverseVisible(function(obj){
      if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh || (obj.userData && obj.userData.kind === "obstacle-resize")) return;
      var g0 = obj.geometry; if (!g0 || !g0.attributes || !g0.attributes.position) return;
      var arr = Array.isArray(obj.material), mats = arr ? obj.material.map(conv) : [conv(obj.material)];
      if (!mats.some(Boolean)) return;
      var g = g0.index ? g0.toNonIndexed() : g0;
      if (!g.attributes.normal){ if (g === g0) g = g0.clone(); g.computeVertexNormals(); }
      var total = g.attributes.position.count;
      if (arr && g.groups && g.groups.length){
        g.groups.forEach(function(gr){ var m = mats[gr.materialIndex]; if (m) push(m, g, gr.start, Math.min(gr.count, total - gr.start), obj.matrixWorld); });
      } else if (mats[0]) push(mats[0], g, 0, total, obj.matrixWorld);
      if (g !== g0) g.dispose();
    });
    var geos = [];
    buckets.forEach(function(b, mat){
      if (!b.p.length) return;
      var bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
      bg.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
      bg.setAttribute("uv", new THREE.Float32BufferAttribute(b.u, 2));
      rs.add(new THREE.Mesh(bg, mat)); geos.push(bg);
    });
    return { scene:rs, box:box, cabBox:cabBox, roomBox:roomBox, dispose:function(){ made.forEach(function(m){ m.dispose(); }); geos.forEach(function(x){ x.dispose(); }); } };
  }
  // light: the neutral procedural daylight sky. Tried photographed HDRIs (Poly Haven loft / small studio): both tinted the
  // whites and darkened the room — the even sky gave the truest colours (white worktop stays white, oak stays oak).
  function studioEnv(THREE){ return Promise.resolve({ tex:studioSky(THREE), intensity:1, own:true }); }
  // "view": the editor's own camera as you set it (default), or "eye" = a photographer standing in the room: 1.6 m eye
  // height, ~26 mm lens, level (so verticals stay vertical), looking at the middle of what's drawn
  function studioCamera(THREE, liveCam, view, aspect, built){
    var cam = liveCam.clone(); cam.aspect = aspect;
    var cab = built.cabBox, room = built.roomBox;
    if (view === "eye" && !cab.isEmpty() && !room.isEmpty()){
      // stand inside the room, on the far side from the cabinets, 1.6 m up, looking level at their middle
      var c = cab.getCenter(new THREE.Vector3()), rc = room.getCenter(new THREE.Vector3());
      var away = new THREE.Vector3(rc.x - c.x, 0, rc.z - c.z);
      if (away.lengthSq() < 0.04) away.set(liveCam.position.x - c.x, 0, liveCam.position.z - c.z); // cabinets all round: use the side you were looking from
      away.normalize();
      var m = 0.35, x0 = room.min.x + m, x1 = room.max.x - m, z0 = room.min.z + m, z1 = room.max.z - m, t = 0, step = 0.05;
      while (t < 12){ var px = c.x + away.x * (t + step), pz = c.z + away.z * (t + step); if (px < x0 || px > x1 || pz < z0 || pz > z1) break; t += step; } // walk back until the far wall
      cam.position.set(c.x + away.x * t, 1.6, c.z + away.z * t);
      cam.fov = 2 * Math.atan(24 / (2 * 24)) * 180 / Math.PI; // 24 mm on full frame (vertical) — a kitchen needs the width
      cam.up.set(0, 1, 0); cam.lookAt(c.x, 1.2, c.z); // level-ish, so verticals stay vertical
    }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    return cam;
  }
  async function studioRender(o){
    o = o || {};
    if (!THREE_STATE || !window.__loadPathTracer) throw new Error(__("3D er ekki tilbúið"));
    var st = THREE_STATE, THREE = window.__THREE__, r = st.renderer, scene = st.scene;
    // three-gpu-pathtracer 0.0.23 reads scene.environmentRotation / backgroundRotation (three r162+); we're on r160 —
    // give Scene those two as plain zero Eulers (what r162 defaults them to), nothing else changes
    ["environmentRotation", "backgroundRotation"].forEach(function(k){
      if (!(k in THREE.Scene.prototype)) Object.defineProperty(THREE.Scene.prototype, k, { configurable:true,
        get:function(){ return this["__" + k] || (this["__" + k] = new THREE.Euler()); }, set:function(v){ this["__" + k] = v; } });
    });
    var lib = await window.__loadPathTracer();
    if (THREE_STATE !== st) throw new Error(__("sýnin breyttist"));
    var w = o.width || 1920, h = o.height || 1200, target = o.samples || 240;
    var built = studioScene(THREE, scene, o), rs = built.scene;
    var env = await studioEnv(THREE);
    rs.environment = env.tex; rs.environmentIntensity = env.intensity;
    rs.background = o.view === "eye" ? env.tex : new THREE.Color(0xf3f2ef); // dollhouse view: a clean studio backdrop, the HDRI still lights it
    var cam = studioCamera(THREE, st.camera, o.view, w / h, built);
    // its OWN renderer + canvas: if the GPU gives up on a path-tracing pass, that context dies — never the editor's
    var pr = new THREE.WebGLRenderer({ antialias:false, preserveDrawingBuffer:true, powerPreference:"high-performance" });
    pr.setPixelRatio(1); pr.setSize(w, h, false);
    pr.toneMapping = r.toneMapping; pr.toneMappingExposure = r.toneMappingExposure; pr.outputColorSpace = r.outputColorSpace;
    st.studio = true; // the editor's loop sits out meanwhile (the GPU is busy enough)
    var pt = null;
    try{
      pt = new lib.WebGLPathTracer(pr);
      pt.tiles.set(3, 3); pt.minSamples = 0; // small tiles: each GPU call stays short (a long one trips the driver's watchdog → context lost)
      pt.renderScale = 1; pt.dynamicLowRes = false; pt.filterGlossyFactor = 0.5; pt.bounces = 6;
      if (o.onProgress) o.onProgress(0, null);
      await new Promise(function(res){ setTimeout(res, 60); }); // let "0 %" paint before the (synchronous) BVH build
      pt.setScene(rs, cam); // the async variant needs a BVH web worker set up; a kitchen builds in a second or two
      return await new Promise(function(resolve, reject){
        var last = 0, lost = false, gl = pr.getContext();
        pr.domElement.addEventListener("webglcontextlost", function(e){ e.preventDefault(); lost = true; }, { once:true });
        (function step(){
          if (o.cancelled && o.cancelled()){ resolve(null); return; }
          if (lost || (gl.isContextLost && gl.isContextLost())){ reject(new Error(__("skjákortið réð ekki við myndina — reyndu minni mynd eða aðra tölvu"))); return; }
          try{ pt.renderSample(); }catch(e){ reject(e); return; }
          var p = Math.min(1, pt.samples / target), now = performance.now(), preview = null;
          if (now - last > 1500){ last = now; preview = pr.domElement.toDataURL("image/jpeg", 0.7); }
          if (o.onProgress) o.onProgress(p, preview);
          if (pt.samples >= target){ resolve(pr.domElement.toDataURL("image/jpeg", 0.93)); return; }
          setTimeout(step, 0); // not rAF: keeps going in a background tab (rAF stops there)
        })();
      });
    } finally {
      try{ if (pt) pt.dispose(); }catch(e){}
      try{ pr.dispose(); }catch(e){}
      built.dispose(); if (env.own) env.tex.dispose();
      st.studio = false;
    }
  }
  // ---------- Allt heimilið in 3D (2026-10-23): every room built by buildScene, placed together ----------
  // rooms = [{ state, x, z, rot }] (mm / degrees, the home plan's places); rooms[0] is the one the scene is built
  // around (its lights, camera, walk start). Each other room is built into a hidden host, its content (no lights)
  // moved into a group turned/placed relative to rooms[0], and its own loop/listeners stopped. Walking: allowed inside
  // any room (25 cm off its walls) and through door openings; cabinets block.
  function buildHomeScene(container, rooms, opts){
    var THREE = window.__THREE__, extras = [], doorRects = [];
    var p0 = rooms[0], t0 = (p0.rot || 0) * Math.PI / 180;
    function toMain(x, z){ // plan mm of the home → rooms[0]'s own metres
      var dx = (x - p0.x) / 1000, dz = (z - p0.z) / 1000, c = Math.cos(-t0), sn = Math.sin(-t0);
      return { x:dx * c - dz * sn, z:dx * sn + dz * c };
    }
    function roomToMain(r, p){ var t = (r.rot || 0) * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), X = p.x * 1000, Z = p.z * 1000; return toMain(X * c - Z * sn + r.x, X * sn + Z * c + r.z); }
    rooms.slice(1).forEach(function(r){
      var hid = document.createElement("div");
      hid.style.cssText = "position:fixed;left:-30000px;top:0;width:" + Math.max(400, container.clientWidth) + "px;height:" + Math.max(300, container.clientHeight) + "px;";
      document.body.appendChild(hid);
      buildScene(hid, r.state, { freshCamera:true, darkBg:opts && opts.darkBg });
      var TS = THREE_STATE;
      cancelAnimationFrame(TS.rafId); window.removeEventListener("resize", TS.onResize);
      if (TS.walkCleanup) TS.walkCleanup();
      if (TS.cleanupInteraction) TS.cleanupInteraction();
      TS.controls.dispose();
      if (TS.composer) TS.composer.dispose(); if (TS.aoComposer) TS.aoComposer.dispose();
      var grp = new THREE.Group(), floorPicks = (TS.pickables || []).filter(function(m){ return m.userData && m.userData.blockId && m.userData.zone === "floor"; });
      TS.scene.children.slice().forEach(function(o){ if (o.isLight || (o.userData && o.userData.homeSkip)) return; grp.add(o); });
      disposeScene(TS.scene);
      if (TS.renderer.domElement.parentNode) TS.renderer.domElement.parentNode.removeChild(TS.renderer.domElement);
      THREE_STATE = null; hid.remove();
      var o = roomToMain(r, { x:0, z:0 }), dt = ((r.rot || 0) - (p0.rot || 0)) * Math.PI / 180;
      grp.position.set(o.x, 0, o.z); grp.rotation.y = -dt;
      extras.push({ grp:grp, room:r, picks:floorPicks });
    });
    buildScene(container, p0.state, opts || {});
    var MS = THREE_STATE;
    extras.forEach(function(e){ e.grp.traverse(function(o){ if (o.isSprite) o.visible = false; }); MS.scene.add(e.grp); }); // (their V-labels too)
    MS.scene.updateMatrixWorld(true);
    var polys = rooms.map(function(r){
      var g = wallGeometry3D(r.state.walls);
      return { pts:g.map(function(w){ return roomToMain(r, w.origin); }),
        segs:g.map(function(w, i){ return r.state.walls[i].open ? null : [roomToMain(r, w.origin), roomToMain(r, { x:w.origin.x + w.axis.x * w.lenM, z:w.origin.z + w.axis.z * w.lenM })]; }).filter(Boolean) };
    });
    rooms.forEach(function(r){
      var g = wallGeometry3D(r.state.walls);
      (r.state.doors || []).forEach(function(d){
        var wi = r.state.walls.findIndex(function(w){ return w.id === d.wallId; }), w = g[wi]; if (!w) return;
        var a0 = d.offsetMm / 1000 + 0.05, a1 = (d.offsetMm + d.widthMm) / 1000 - 0.05;
        function at(al, out){ return roomToMain(r, { x:w.origin.x + w.axis.x * al + w.normal.x * out, z:w.origin.z + w.axis.z * al + w.normal.z * out }); }
        doorRects.push([at(a0, 0.35), at(a1, 0.35), at(a1, -0.55), at(a0, -0.55)]);
      });
    });
    var boxes = [];
    (MS.pickables || []).forEach(function(m){ if (m.userData && m.userData.blockId && m.userData.zone === "floor") boxes.push(new THREE.Box3().setFromObject(m)); });
    extras.forEach(function(e){ e.picks.forEach(function(m){ boxes.push(new THREE.Box3().setFromObject(m)); }); });
    function inPoly(x, z, P){ var inside = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++){ if ((P[i].z > z) !== (P[j].z > z) && x < (P[j].x - P[i].x) * (z - P[i].z) / (P[j].z - P[i].z) + P[i].x) inside = !inside; } return inside; }
    function segDist(x, z, sg){ var ax = sg[0].x, az = sg[0].z, dx = sg[1].x - ax, dz = sg[1].z - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
    MS.homeWalk = { rooms:polys, blocked:function(x, z){
      var inDoor = doorRects.some(function(q){ return inPoly(x, z, q); });
      if (!inDoor){
        var room = polys.find(function(p){ return inPoly(x, z, p.pts); });
        if (!room) return true;
        if (room.segs.some(function(sg){ return segDist(x, z, sg) < 0.25; })) return true;
      }
      return boxes.some(function(b){ return x > b.min.x - 0.25 && x < b.max.x + 0.25 && z > b.min.z - 0.25 && z < b.max.z + 0.25; });
    } };
    return MS;
  }

  // walk mode — module level so it outlives scene rebuilds
  var WALK = { on:false, x:0, z:0, yaw:0, pitch:0 };
  function setWalkMode(on){ if (!THREE_STATE || !THREE_STATE.setWalk){ WALK.on = false; return false; } return THREE_STATE.setWalk(!!on); }
  function isWalking(){ return WALK.on; }
  function setCameraLookAt(pos, target){
    if (!THREE_STATE) return false;
    THREE_STATE.camera.position.set(pos.x, pos.y, pos.z);
    THREE_STATE.controls.target.set(target.x, target.y, target.z);
    THREE_STATE.camera.lookAt(target.x, target.y, target.z);
    THREE_STATE.controls.update();
    return true;
  }

  function hideDragPreview3D(){
    if (!THREE_STATE) return;
    ["previewMesh", "bandMesh", "ghostBox"].forEach(function(k){ if (THREE_STATE[k]) THREE_STATE[k].visible = false; });
    showSnapGuides(null, null);
  }
  // Figma-style alignment guides (owner, 2026-10-27): while a dragged unit is snapped flush with a neighbour, a thin blue
  // line runs along the shared edge — guides: [{along:mm, y0, y1}] (a vertical edge) / [{y:mm, a0, a1}] (a top / bottom),
  // on the face of wall `wallId`, `outMm` out from it. null clears them.
  function showSnapGuides(wallId, guides, outMm){
    if (!THREE_STATE) return;
    var THREE = window.__THREE__, grp = THREE_STATE.snapGuides;
    if (grp){ grp.children.forEach(function(o){ o.geometry.dispose(); }); grp.clear(); }
    if (!wallId || !guides || !guides.length) return;
    var wi = THREE_STATE.walls.findIndex(function(w){ return w.id === wallId; }), g = THREE_STATE.geoms[wi]; if (!g) return;
    if (!grp){ grp = THREE_STATE.snapGuides = new THREE.Group(); grp.renderOrder = 20; THREE_STATE.scene.add(grp); }
    if (!THREE_STATE.snapGuideMat) THREE_STATE.snapGuideMat = new THREE.LineBasicMaterial({ color:0x2f7bff, depthTest:false, transparent:true, opacity:0.95 });
    var out = (outMm || 0) / 1000 + 0.004;
    function P(alongMm, yMm){ return new THREE.Vector3(g.origin.x + g.axis.x * alongMm / 1000 + g.normal.x * out, yMm / 1000, g.origin.z + g.axis.z * alongMm / 1000 + g.normal.z * out); }
    guides.forEach(function(gd){
      var pts = gd.along != null ? [P(gd.along, gd.y0 - 60), P(gd.along, gd.y1 + 60)] : [P(gd.a0 - 60, gd.y), P(gd.a1 + 60, gd.y)];
      var ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), THREE_STATE.snapGuideMat); ln.renderOrder = 20; grp.add(ln);
    });
  }

  function teardown3D(discardCamera){
    if (!THREE_STATE) return;
    var wo = THREE_STATE.walkOrbit && THREE_STATE.walkOrbit(); // walking: remember the orbit view from before the walk, not the eye-level one
    savedCameraState = discardCamera ? null : {
      position: wo ? wo.pos.clone() : THREE_STATE.controls.object.position.clone(),
      target: wo ? wo.target.clone() : THREE_STATE.controls.target.clone()
    };
    if (THREE_STATE.walkCleanup) THREE_STATE.walkCleanup();
    cancelAnimationFrame(THREE_STATE.rafId);
    window.removeEventListener("resize", THREE_STATE.onResize);
    if (THREE_STATE.composer){ THREE_STATE.composer.dispose(); THREE_STATE.composer = null; } // the evening bloom's render targets
    if (THREE_STATE.aoComposer){ THREE_STATE.aoComposer.dispose(); THREE_STATE.aoComposer = null; }
    if (THREE_STATE.cleanupInteraction) THREE_STATE.cleanupInteraction();
    THREE_STATE.controls.dispose();
    disposeScene(THREE_STATE.scene);
    // the renderer is shared across rebuilds — keep it, just detach its canvas
    if (THREE_STATE.renderer.domElement.parentNode){
      THREE_STATE.renderer.domElement.parentNode.removeChild(THREE_STATE.renderer.domElement);
    }
    THREE_STATE = null;
  }

  // Front material from the procedural texture library (kitchen-planner-
  // materials.js): real-looking wood grain (rings, fibres, pores + a bump map)
  // for wood looks, a satin painted finish for solid colours. Each cabinet's UVs
  // are scaled to its own size (see scaleFrontUV) so the grain keeps one
  // physical scale across a 600 mm wall unit and a 2400 mm tower.
  // Textures are cached per source canvas and kept alive across scene rebuilds
  // (the renderer is shared too), so an edit doesn't re-upload megabytes of
  // wood/floor pixels to the GPU every time. disposeScene skips `userData.keep`.
  var TEX_CACHE = typeof Map !== "undefined" ? new Map() : null;
  function canvasTex(THREE, canvas, srgb){
    var key = srgb ? "s" : "l", hit = TEX_CACHE && TEX_CACHE.get(canvas);
    if (hit && hit[key]) return hit[key];
    var x = new THREE.CanvasTexture(canvas);
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    if (srgb && THREE.SRGBColorSpace) x.colorSpace = THREE.SRGBColorSpace;
    x.userData.keep = true;
    if (TEX_CACHE){ hit = hit || {}; hit[key] = x; TEX_CACHE.set(canvas, hit); }
    return x;
  }

  // Photo textures from the site (same-origin JPGs): loaded once, kept for the page session.
  var IMG_TEX = typeof Map !== "undefined" ? new Map() : null, IMG_PENDING = 0;
  // Until the photo is in (a first visit: ~0.3–2 s), the texture is a tiny swatch of the material's own colour —
  // a texture with no image yet rendered the front/worktop BLACK (studio-load, 2026-10-26). The photo then arrives as
  // a new Source (a fresh GPU texture at its real size), so every material/clone sharing `t` picks it up.
  // Mirrors (owner, 2026-10-27: the bath mirror was a flat grey slab): every mirror material gets a cube map of THIS room,
  // taken once from the mirror's own spot (the mirror itself hidden meanwhile) — the tiles, the units and the light show in
  // it instead of the generic studio environment. Again when a photo texture arrives, so the reflection isn't a placeholder.
  var MIRROR_RT = typeof WeakMap !== "undefined" ? new WeakMap() : new Map(); // material → its cube target (not userData: clone() JSON-copies that)
  function updateMirrors(THREE, renderer, scene){
    if (!THREE.CubeCamera || !renderer || !scene) return;
    var byMat = new Map();
    scene.traverse(function(o){ // (a Spegilskápur's fronts carry the mirror in a material ARRAY — they were skipped and read near-black)
      if (!o.isMesh || !o.visible || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(mt){ if (mt && mt.userData && mt.userData.mirror){ if (!byMat.has(mt)) byMat.set(mt, []); if (byMat.get(mt).indexOf(o) < 0) byMat.get(mt).push(o); } });
    });
    function swapMat(o, from, to){ if (Array.isArray(o.material)){ o.material = o.material.map(function(x){ return x === from ? to : x; }); } else if (o.material === from) o.material = to; }
    // one material shared by mirror cabinets on different walls (every Spegilskápur shares mirrorMat): a reflection per
    // cabinet, not one taken from a point between them (in the corner, behind a wall) — split by distance, cloned
    var groups = [];
    byMat.forEach(function(meshes, m){
      var clusters = [];
      meshes.forEach(function(o){ var p = new THREE.Vector3(); o.getWorldPosition(p); var cl = clusters.find(function(c){ return c.p.distanceTo(p) < 0.9; }); if (cl) cl.list.push(o); else clusters.push({ p:p, list:[o] }); });
      clusters.forEach(function(c, k){
        var mm = m;
        if (k){ mm = m.clone(); if (m.__xrayBase) mm.__xrayBase = m.__xrayBase; c.list.forEach(function(o){ swapMat(o, m, mm); }); }
        groups.push([c.list, mm]);
      });
    });
    var n = 0;
    var MIRROR_EDGE = null; // a mirror door is 20 mm slab: its edges (the underside seen from below) are satin, not more mirror (owner, 2026-10-28)
    groups.forEach(function(gm){ gm[0].forEach(function(o){
      var gp = o.geometry && o.geometry.parameters;
      if (!Array.isArray(o.material) && gp && o.geometry.type === "BoxGeometry" && Math.abs(gp.depth - FRONT_T) < 0.0015){
        MIRROR_EDGE = MIRROR_EDGE || new THREE.MeshStandardMaterial({ color:0xc9ceca, metalness:0.2, roughness:0.45 });
        var mm0 = o.material; o.material = [MIRROR_EDGE, MIRROR_EDGE, MIRROR_EDGE, MIRROR_EDGE, mm0, MIRROR_EDGE];
      }
    }); });
    groups.forEach(function(gm){ var meshes = gm[0], m = gm[1];
      if (++n > 4) return;
      var box = new THREE.Box3(); meshes.forEach(function(o){ box.expandByObject(o); });
      var rt = MIRROR_RT.get(m);
      if (!rt){ rt = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps:true, minFilter:THREE.LinearMipmapLinearFilter }); if (THREE.SRGBColorSpace) rt.texture.colorSpace = THREE.SRGBColorSpace; MIRROR_RT.set(m, rt); }
      var cc = new THREE.CubeCamera(0.05, 40, rt); box.getCenter(cc.position);
      meshes.forEach(function(o){ o.visible = false; });
      var bg = scene.background, bgI = scene.backgroundIntensity; if (scene.environment){ scene.background = scene.environment; scene.backgroundIntensity = 2.2; } // where the room has no wall (a one-wall bath) the mirror shows a soft interior, not the flat backdrop
      try{ cc.update(renderer, scene); }catch(e){}
      scene.background = bg; scene.backgroundIntensity = bgI;
      meshes.forEach(function(o){ o.visible = true; });
      m.envMap = rt.texture; m.envMapIntensity = 0.95; m.color.set(0xe8eeee); m.metalness = 1; m.roughness = 0.03; m.needsUpdate = true; // (the colour: a hint of the glass's green edge)
    });
  }
  var mirrorTimer = 0;
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("kp3d-tex-loaded", function(){ clearTimeout(mirrorTimer); mirrorTimer = setTimeout(function(){ if (THREE_STATE) updateMirrors(window.__THREE__, THREE_STATE.renderer, THREE_STATE.scene); }, 250); });
  function disposeSourceUsers(src){ // every live texture sharing `src` (clones for offsets/rotation) lets go of its old GPU storage
    [THREE_STATE && THREE_STATE.scene, PREVIEW && PREVIEW.scene].forEach(function(sc){
      if (sc) sc.traverse(function(o){
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
          ["map", "bumpMap", "roughnessMap", "normalMap", "alphaMap"].forEach(function(k){ var x = m && m[k]; if (x && x.source === src) x.dispose(); });
        });
      });
    });
  }
  function imgTex(THREE, url, color){
    var t = IMG_TEX && IMG_TEX.get(url);
    if (t) return t;
    var ph = document.createElement("canvas"); ph.width = ph.height = 2;
    var pc = ph.getContext("2d"); pc.fillStyle = color || "#d9d4ca"; pc.fillRect(0, 0, 2, 2);
    t = new THREE.Texture(ph); t.needsUpdate = true;
    IMG_PENDING++;
    new THREE.ImageLoader().load(url, function(img){
      IMG_PENDING--;
      // The photo goes into the SAME Source (so every clone of `t` gets it too), and every texture on it is disposed
      // first: three keeps a texture's GPU storage per texture settings, not per image, so once the 2 × 2 placeholder
      // had been drawn the photo was uploaded into that tiny immutable storage and failed — wood fronts came out one
      // flat colour or glitched (owner, bath 2026-10-27). Disposed, the next frame allocates it at the photo's size.
      var src = t.source; t.dispose(); src.data = img; src.needsUpdate = true;
      disposeSourceUsers(src);
      window.dispatchEvent(new Event("kp3d-tex-loaded"));
    }, undefined, function(){ IMG_PENDING--; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.userData.keep = true;
    if (IMG_TEX) IMG_TEX.set(url, t);
    return t;
  }

  // Worktop material for a TOPS key (null/unknown = the plain procedural stone).
  function makeTopMaterial(THREE, topKey){
    var topDef = topKey && TOPS[topKey] ? TOPS[topKey] : null;
    if (topDef && topDef.none){ var nm = new THREE.MeshBasicMaterial({ visible:false }); nm.userData.thick = 0.001; return nm; }
    if (topDef && topDef.tex){
      var m = new THREE.MeshStandardMaterial({ map:imgTex(THREE, topDef.tex, topDef.color3d), roughness:0.42, metalness:0.02 });
      m.userData.tile = topDef.tile || { w:0.9, h:0.9 };
      // Límtré (glulam) worktops: the source photo's grain runs "up" the image — turned 90° here so it
      // runs side to side across the counter (widthwise) instead of front-to-back (2026-09-28, user request).
      if (topDef.group === "limtre") m.userData.rotateTex = true;
      return withThick(m);
    }
    if (topDef && topDef.group !== "steinn") return withThick(new THREE.MeshStandardMaterial({ color:topDef.color3d, roughness:0.45 }));
    if (topDef && topDef.marble && window.KPMat && window.KPMat.marbleTexture){
      var mt = window.KPMat.marbleTexture(topDef.marble.base, topDef.marble.vein, topDef.marble.seed);
      var mm = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, mt.color, true), roughness:0.22, metalness:0.02 });
      mm.userData.tile = { w:mt.tileW, h:mt.tileH };
      return withThick(mm);
    }
    if (window.KPMat){
      var st = window.KPMat.stoneTexture("#e4dfd6");
      var sm = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, st.color, true), roughness:0.32, metalness:0.02 });
      sm.map.repeat.set(1 / st.tileW, 1 / st.tileH);
      return withThick(sm);
    }
    return withThick(new THREE.MeshStandardMaterial({ color:0xe4dfd6, roughness:0.4 }));
    function withThick(mat){ mat.userData.thick = topThickM(topKey); return mat; }
  }

  // A roughness canvas from a bump canvas: dark bump (joints, grout) = matte, the rest `base` ± a soft `spread`.
  var ROUGH_CACHE = new Map();
  function roughFromBump(bump, base, spread){
    var k = ROUGH_CACHE.get(bump); if (k && k[base + ":" + spread]) return k[base + ":" + spread];
    var W = bump.width, H = bump.height, c = document.createElement("canvas"); c.width = W; c.height = H;
    var src = bump.getContext("2d").getImageData(0, 0, W, H).data, x = c.getContext("2d"), img = x.createImageData(W, H), d = img.data;
    for (var i = 0; i < src.length; i += 4){
      var b = src[i] / 255, r = b < 0.12 ? 0.95 : base + (0.5 - b) * spread * 2;
      var v = Math.max(0, Math.min(255, Math.round(r * 255))); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (!k){ k = {}; ROUGH_CACHE.set(bump, k); } k[base + ":" + spread] = c;
    return c;
  }

  function makeFrontMaterial(THREE, lookKey, look){
    if (look.tex){ // a real board texture from the gallery
      var im = new THREE.MeshStandardMaterial({ map:imgTex(THREE, look.tex, look.color3d), roughness:0.58 });
      im.userData.tile = look.tile || { w:0.6, h:0.6 };
      return im;
    }
    var wood = look.category !== "perfectsense" && look.category !== "framhlidaefni";
    var t = wood ? window.KPMat.woodTexture(lookKey, look.color3d) : window.KPMat.paintTexture(lookKey, look.color3d);
    function tex(canvas, srgb){ return canvasTex(THREE, canvas, srgb); }
    var mat = wood
      ? new THREE.MeshStandardMaterial({ map:tex(t.color, true), bumpMap:tex(t.bump, false), bumpScale:1.4, roughness:0.6 })
      : new THREE.MeshPhysicalMaterial({ map:tex(t.color, true), bumpMap:tex(t.bump, false), bumpScale:0.08, roughness:0.5, clearcoat:0.14, clearcoatRoughness:0.45 });
    mat.userData.tile = { w:t.tileW, h:t.tileH };
    return mat;
  }

  // Rescale a box's UVs so one texture tile covers tile.w × tile.h metres.
  // `swap` transposes u/v first — a 90° turn of the texture's own pattern (e.g. Límtré's grain,
  // stored running "up" the source photo) onto the box's other axis, without touching the geometry.
  // An end panel (úthlið, 19 mm): every face gets the texture at its real size, grain running UP the panel
  // on its big side and its edges — scaling all faces by the 19 mm width blew the grain up (user, 2026-10-02).
  function panelUV(geo, w, h, d, tile){
    if (!tile) return;
    var uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // BoxGeometry faces: ±x, ±y, ±z
    for (var i = 0; i < uv.count; i++){
      var f = dims[Math.floor(i / 4)] || [w, h];
      uv.setXY(i, uv.getX(i) * f[0] / tile.w, uv.getY(i) * f[1] / tile.h);
    }
    uv.needsUpdate = true;
  }
  // `off` {u, v} (metres) shifts the texture by where the panel really sits — along the wall and up from the
  // floor — so the grain runs on from one drawer front to the next and into the neighbouring cabinet
  // instead of restarting on every front (user, 2026-10-02).
  function scaleFrontUV(geo, widthM, heightM, tile, swap, off){
    if (!tile) return;
    var uv = geo.attributes.uv, ou = off ? off.u : 0, ov = off ? off.v : 0;
    for (var i = 0; i < uv.count; i++){
      var u = uv.getX(i), v = uv.getY(i);
      if (swap) uv.setXY(i, (v * widthM + ou) / tile.w, (u * heightM + ov) / tile.h);
      else uv.setXY(i, (u * widthM + ou) / tile.w, (v * heightM + ov) / tile.h);
    }
    uv.needsUpdate = true;
  }

  // Worktop UVs at real size on every face (visual pass 2): the 32 mm front edge used to get the whole depth's
  // texture squeezed into it (streaks). Each face is mapped by its own normal; `uOff` = where the slab sits along
  // the wall, so the pattern runs on from one cabinet's worktop into the next instead of restarting.
  function worktopUV(geo, tile, swap, uOff){
    if (!tile) return;
    var p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (var i = 0; i < p.count; i++){
      var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), a, b;
      if (ay >= ax && ay >= az){ a = p.getX(i) + uOff; b = p.getZ(i); }
      else if (az >= ax){ a = p.getX(i) + uOff; b = p.getY(i); }
      else { a = p.getZ(i); b = p.getY(i); }
      if (swap) uv.setXY(i, b / tile.w, a / tile.h); else uv.setXY(i, a / tile.w, b / tile.h);
    }
    uv.needsUpdate = true;
  }

  // A 20 mm front panel; `notch` {len, h} cuts a recess out of the top edge, centred (Hexxa is milled into the front).
  function frontSlab(THREE, w, h, frontMat, notch, off){
    var geo;
    if (notch && notch.side && notch.len > 0.02 && notch.len < h - 0.02){ // a wardrobe's Hexxa: cut into the opening edge at `at` (m from the bottom)
      var hwS = w / 2, a0 = notch.at - notch.len / 2, a1 = notch.at + notch.len / 2, ed = notch.side === "right" ? hwS : -hwS, inn = notch.side === "right" ? hwS - notch.h : -hwS + notch.h, shS = new THREE.Shape();
      if (notch.side === "right"){ shS.moveTo(-hwS, 0); shS.lineTo(hwS, 0); shS.lineTo(ed, a0); shS.lineTo(inn, a0); shS.lineTo(inn, a1); shS.lineTo(ed, a1); shS.lineTo(hwS, h); shS.lineTo(-hwS, h); shS.lineTo(-hwS, 0); }
      else { shS.moveTo(-hwS, 0); shS.lineTo(hwS, 0); shS.lineTo(hwS, h); shS.lineTo(-hwS, h); shS.lineTo(ed, a1); shS.lineTo(inn, a1); shS.lineTo(inn, a0); shS.lineTo(ed, a0); shS.lineTo(-hwS, 0); }
      geo = new THREE.ExtrudeGeometry(shS, { depth:FRONT_T, bevelEnabled:false });
      var psS = geo.attributes.position, uvS = geo.attributes.uv;
      for (var iS = 0; iS < psS.count; iS++) uvS.setXY(iS, (psS.getX(iS) + hwS) / w, psS.getY(iS) / h);
      geo.translate(0, -h / 2, -FRONT_T / 2);
      scaleFrontUV(geo, w, h, frontMat.userData && frontMat.userData.tile, false, off);
      return new THREE.Mesh(geo, frontMat);
    }
    if (notch && notch.len > 0.02 && notch.len < w - 0.02){
      var hw2 = w / 2, nl = notch.len / 2, sh = new THREE.Shape();
      sh.moveTo(-hw2, 0); sh.lineTo(hw2, 0); sh.lineTo(hw2, h); sh.lineTo(nl, h); sh.lineTo(nl, h - notch.h); sh.lineTo(-nl, h - notch.h); sh.lineTo(-nl, h); sh.lineTo(-hw2, h); sh.lineTo(-hw2, 0);
      geo = new THREE.ExtrudeGeometry(sh, { depth:FRONT_T, bevelEnabled:false });
      var ps = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < ps.count; i++) uv.setXY(i, (ps.getX(i) + hw2) / w, ps.getY(i) / h);
      geo.translate(0, -h / 2, -FRONT_T / 2); // same centring as a box
    } else geo = new THREE.BoxGeometry(w, h, FRONT_T);
    scaleFrontUV(geo, w, h, frontMat.userData && frontMat.userData.tile, false, off);
    return new THREE.Mesh(geo, frontMat);
  }

  // A 20 mm front whose top (or side) strip has its BACK cut away, leaving only a thin front skin: the part of the
  // front that overlaps a Jey grip (the grip is 10 mm taller than the 27 mm it takes) — so the panel no longer
  // shows through the grip's channel. edge: "top" | "left" | "right".
  function frontSlabLip(THREE, w, h, frontMat, cutM, skinM, edge, off){
    var T = FRONT_T, A = edge === "top" ? h : w, E = edge === "top" ? w : h, sh = new THREE.Shape();
    var hiEnd = edge !== "left"; // which end of the axis the cut sits at
    if (hiEnd){ sh.moveTo(0, 0); sh.lineTo(T, 0); sh.lineTo(T, A - cutM); sh.lineTo(skinM, A - cutM); sh.lineTo(skinM, A); sh.lineTo(0, A); }
    else { sh.moveTo(0, 0); sh.lineTo(skinM, 0); sh.lineTo(skinM, cutM); sh.lineTo(T, cutM); sh.lineTo(T, A); sh.lineTo(0, A); }
    var geo = new THREE.ExtrudeGeometry(sh, { depth:E, bevelEnabled:false });
    // shape x -> -z (front at sx = 0), shape y -> the cut axis, extrusion -> the other in-plane axis (proper rotations)
    geo.applyMatrix4(edge === "top" ? new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1) : new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    geo.computeBoundingBox();
    var bb = geo.boundingBox; geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, T / 2);
    var ps = geo.attributes.position, uv = geo.attributes.uv;
    for (var i = 0; i < ps.count; i++) uv.setXY(i, (ps.getX(i) + w / 2) / w, (ps.getY(i) + h / 2) / h);
    scaleFrontUV(geo, w, h, frontMat.userData && frontMat.userData.tile, false, off);
    return new THREE.Mesh(geo, frontMat);
  }

  // ---- People silhouettes (ceiling-height step): a man (180 cm, hands in pockets)
  // and a woman (168 cm, hand on hip). Drawn in a 100 × 200 box, head at y=0, feet
  // at y=200; `cut` is a hole punched out (the gap between arm and body).
  function mirrorPath(right){ // right half of a symmetric outline → full closed path
    var left = right.slice().reverse().map(function(p){ return [100 - p[0], p[1]]; });
    return "M" + right.concat(left).map(function(p){ return p[0] + " " + p[1]; }).join(" L") + " Z";
  }
  var PEOPLE = {
    man: { h:1.8, label:"180 cm", img:"images/person-man.png", aspect:162 / 512,
      d: "M50 1 C57 1 60.5 5 60.5 12 C60.5 19 57 25 50 25 C43 25 39.5 19 39.5 12 C39.5 5 43 1 50 1 Z " + mirrorPath([
        [50,24],[55,24],[56,30],[63,33],[70,35],[74,39],[76,46],[77,60],[78,76],[78,92],[76,101],[72,103],[69.5,100],
        [68.5,110],[67.5,140],[66.5,170],[65.5,188],[70,191],[71,196],[56,196],[55.5,188],[54.5,160],[53,130],[51,114],[50,114]
      ]),
      cut: "M68.4 52 L71.6 58 L72.2 88 L69.4 96 Z M31.6 52 L28.4 58 L27.8 88 L30.6 96 Z" },
    woman: { h:1.68, label:"168 cm", img:"images/person-woman.png", aspect:150 / 512,
      d: "M50 2 C56.5 2 59.5 6 59.5 12.5 C59.5 19 56 24 50 24 C44 24 40.5 19 40.5 12.5 C40.5 6 43.5 2 50 2 Z " +
         "M42 8 C43 0 58 -1 60 8 C62 17 60 26 65 37 C61 38 57.5 34 57 28 C56 22 58 15 55 10 Z " +
         "M46 23 L46 29 L40 31.5 L35 34.5 L33 40 L31.5 60 L30.5 80 L29.5 97 L31.5 102 L34 101 L34.5 97 L35.5 80 L37.5 62 L38.5 70 L39.5 79 " +
         "L31 150 L43.5 152 L43.5 186 L40 194 L41 197 L46 197 L47 190 L48.5 152 L52.5 152 L53.5 186 L54 194 L55 197 L60 197 L58 186 L57 152 L69 150 " +
         "L60.5 80 L62.5 79 L64.5 81 L77 64 L78.5 58 L74 45 L69 36.5 L63 33 L54 29.5 L54 23 Z",
      cut: "M61 70 L71.5 59.5 L66 44 L61.5 42 Z" }
  };
  var PEOPLE_TEX = {}, PEOPLE_IMG = {};
  function personImage(key){ if (!PEOPLE_IMG[key]){ PEOPLE_IMG[key] = new Image(); PEOPLE_IMG[key].src = PEOPLE[key].img; } return PEOPLE_IMG[key]; }
  function personCanvas(key){
    if (PEOPLE_TEX[key]) return PEOPLE_TEX[key];
    var P = PEOPLE[key], c = document.createElement("canvas"), sc = 2.56;
    c.width = 256; c.height = 512;
    var ctx = c.getContext("2d");
    ctx.scale(sc, sc);
    // a light outline first so the figures read against dark walls too
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
    ctx.stroke(new Path2D(P.d));
    ctx.fillStyle = "#26241f";
    ctx.fill(new Path2D(P.d), "nonzero");
    if (P.cut){ ctx.globalCompositeOperation = "destination-out"; ctx.fill(new Path2D(P.cut)); }
    return (PEOPLE_TEX[key] = c);
  }
  // Two cut-out figures standing ~1.2 m in front of the longest solid wall, turned towards the camera every
  // frame, plus a floor-to-ceiling dimension line on that wall (left of them) with the height in mm.
  function addPeople(THREE, scene, geoms, wallH, heightMm, walls, wallHex, state){
    var g = geoms.filter(function(x, i){ return !(walls[i] && walls[i].open); }).sort(function(a, b){ return b.lenM - a.lenM; })[0] || geoms[0], mid = { x:g.origin.x + g.axis.x * g.lenM / 2, z:g.origin.z + g.axis.z * g.lenM / 2 }, out = [];
    var inM = 0.7, wallMid = mid;
    // never inside a unit (owner, 2026-10-27: they stood in the laundry's cabinets): the first spot — further out from the wall,
    // then along it — where both figures stand clear of every floor unit and obstacle, inside the room; none free: no people
    if (state){
      var quads = []; try{ quads = floorRects(state).map(function(r){ return r.q; }).concat((state.obstacles || []).map(function(o){ return obstacleQuad(state, o); }).filter(Boolean)); }catch(e){}
      var poly = geoms.closed ? geoms.map(function(x){ return { x:x.origin.x, z:x.origin.z }; }) : null;
      var clear = function(px, pz){ if (poly && !inPoly(px, pz, poly)) return false;
        return [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]].every(function(o){ return !quads.some(function(q){ return inPoly(px + o[0], pz + o[1], q); }); }); };
      var found = null;
      [0, -0.7, 0.7, -1.3, 1.3].some(function(sh){ for (var d = 0.7; d <= 2.6 && !found; d += 0.15){
        var ok = [-0.38, 0.42].every(function(a){ return clear(mid.x + g.normal.x * d + g.axis.x * (a + sh), mid.z + g.normal.z * d + g.axis.z * (a + sh)); });
        if (ok) found = { d:d, sh:sh }; } return !!found; });
      if (!found) return null;
      inM = found.d; wallMid = mid; mid = { x:mid.x + g.axis.x * found.sh, z:mid.z + g.axis.z * found.sh };
    }
    [["man", -0.38], ["woman", 0.42]].forEach(function(pr){
      // the illustrated people (user, 2026-10-24), head to sole = their height; the drawn silhouette is the fallback
      var P = PEOPLE[pr[0]], tex = new THREE.Texture(), pic = personImage(pr[0]);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      function usePic(){ tex.image = pic; tex.needsUpdate = true; }
      if (pic.complete && pic.naturalWidth) usePic(); else { pic.addEventListener("load", usePic); pic.addEventListener("error", function(){ tex.image = personCanvas(pr[0]); tex.needsUpdate = true; m.geometry = new THREE.PlaneGeometry(P.h / 2, P.h); }); }
      var mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true, alphaTest:0.4, side:THREE.DoubleSide });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(P.h * P.aspect, P.h), mat);
      m.position.set(mid.x + g.normal.x * inM + g.axis.x * pr[1], P.h / 2, mid.z + g.normal.z * inM + g.axis.z * pr[1]);
      m.userData.billboard = true;
      scene.add(m); out.push(m);
      var sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.16, depthWrite:false }));
      sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.55, 1);
      sh.position.set(m.position.x, 0.003, m.position.z);
      scene.add(sh);
      // the figure's own height, so it reads as a real measurement and not just "a person for scale"
      // (user, 2026-10-13: style redesign shelved for later, but keep this)
      var pc = document.createElement("canvas"); pc.width = 160; pc.height = 56;
      var px = pc.getContext("2d");
      px.fillStyle = "#ffffff"; px.strokeStyle = "#8a8f9a"; px.lineWidth = 3;
      if (px.roundRect){ px.beginPath(); px.roundRect(4, 4, 152, 48, 12); px.fill(); px.stroke(); } else { px.fillRect(4, 4, 152, 48); px.strokeRect(4, 4, 152, 48); }
      px.fillStyle = "#191919"; px.font = "700 24px 'Kumbh Sans', Arial, sans-serif"; px.textAlign = "center"; px.textBaseline = "middle";
      px.fillText(P.label, 80, 30);
      var pt = new THREE.CanvasTexture(pc);
      if (THREE.SRGBColorSpace) pt.colorSpace = THREE.SRGBColorSpace;
      var psp = new THREE.Sprite(new THREE.SpriteMaterial({ map:pt, depthTest:false }));
      psp.scale.set(0.42, 0.147, 1); psp.renderOrder = 10;
      psp.position.set(m.position.x, P.h + 0.14, m.position.z);
      scene.add(psp);
    });
    // dimension line on the wall, a little to the side of the figures
    // (2026-10-11) further from the figures, near the corner, and the label up by the ceiling — it sat on the man
    var dOff = -Math.max(0.9, Math.min(g.lenM / 2 - 0.15, 1.9)), dSide = mid !== wallMid && (mid.x - wallMid.x) * g.axis.x + (mid.z - wallMid.z) * g.axis.z < 0 ? -1 : 1; // the figures moved along the wall: the line goes to the other end
    var dx = wallMid.x + g.axis.x * dOff * dSide + g.normal.x * 0.02, dz = wallMid.z + g.axis.z * dOff * dSide + g.normal.z * 0.02;
    var wn = parseInt((wallHex || "#f1efe8").slice(1), 16), dark = (((wn >> 16) & 255) * 0.3 + ((wn >> 8) & 255) * 0.59 + (wn & 255) * 0.11) < 128;
    var lm = new THREE.LineBasicMaterial({ color:dark ? 0xf4f2ec : 0x333333 }), tick = 0.08;
    function seg(a, b){ scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lm)); }
    seg(new THREE.Vector3(dx, 0.01, dz), new THREE.Vector3(dx, wallH - 0.01, dz));
    [0.01, wallH - 0.01].forEach(function(y){
      seg(new THREE.Vector3(dx - g.axis.x * tick, y, dz - g.axis.z * tick), new THREE.Vector3(dx + g.axis.x * tick, y, dz + g.axis.z * tick));
    });
    var lc = document.createElement("canvas"); lc.width = 256; lc.height = 72;
    var lx = lc.getContext("2d");
    lx.fillStyle = "#ffffff"; lx.strokeStyle = "#8a8f9a"; lx.lineWidth = 3;
    if (lx.roundRect){ lx.beginPath(); lx.roundRect(4, 4, 248, 64, 14); lx.fill(); lx.stroke(); } else { lx.fillRect(4, 4, 248, 64); lx.strokeRect(4, 4, 248, 64); }
    lx.fillStyle = "#191919"; lx.font = "700 34px 'Kumbh Sans', Arial, sans-serif"; lx.textAlign = "center"; lx.textBaseline = "middle";
    lx.fillText(dimLen(heightMm), 128, 38);
    var lt = new THREE.CanvasTexture(lc);
    if (THREE.SRGBColorSpace) lt.colorSpace = THREE.SRGBColorSpace;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:lt, depthTest:false }));
    sp.scale.set(0.95, 0.27, 1); sp.renderOrder = 10;
    sp.position.set(dx + g.normal.x * 0.05 - g.axis.x * 0.32 * dSide, wallH - 0.14, dz + g.normal.z * 0.05 - g.axis.z * 0.32 * dSide); // on the outer side of its line: clear of the figures' own labels (owner, 2026-10-27)
    scene.add(sp);
    return { people:out, focus:{ x:mid.x + g.normal.x * inM, z:mid.z + g.normal.z * inM }, g:g };
  }

  // wrap: DOM element to render into. state: the planner's {shape,walls,look}
  // object. opts (optional): {selectedId, onSelect(meta|null)} — onSelect is
  // called with {wallId,zone,blockId} when a cabinet is clicked, or null on
  // a click that hit nothing (deselect).
  // Fataskápar (user, 2026-10-25): door handles at hand height — set per scene from the room's category
  var wardrobeScene = false, drawerDragAll = false; // drawerDragAll: the Ný eining preview — every drawer front's edge drags (owner, 2026-10-27)
  // the selected unit gets the blue outline (selHullSvg) instead of lilac fronts — every customer room (round 2, 2026-10-26:
  // lilac read as another front colour in the bath too); PRO (darkBg) keeps the tint
  var outlineSel = false;
  function buildScene(wrap, state, opts){
    opts = opts || {};
    wardrobeScene = /^fataskapar/.test(String(state.activeCategory || "")) || !!state.wardrobe;
    drawerDragAll = !!opts.drawerDragAll;
    outlineSel = wardrobeScene || !opts.darkBg;
    handleFinish = handleFinishFor(state.handle, state.handleColor);
    var THREE = window.__THREE__;
    var OrbitControls = window.__OrbitControls__;

    var geoms = wallGeoms(state);
    var surfaces = surfacesOf(state), allGeoms = geoms.concat(islandGeoms(state)).concat(milliveggGeoms(state)); // walls + island rows + milliveggir
    var carcass = state.carcass ? CARCASS[state.carcass] : null;
    var jeyOn = !!(state.handle && window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[state.handle] && /^(jey|hexxa)$/.test(window.KPMODELS.handles[state.handle].kind)); // Jey (on top of the front, incl. Spónagrip — same kind) and Hexxa (cut into it) need separate fronts
    var carcassMat = new THREE.MeshStandardMaterial({ color: carcass ? carcass.color3d : "#3a3a3a", roughness:0.9 });
    var wallColor = state.wallColor && WALL_COLORS[state.wallColor] ? WALL_COLORS[state.wallColor].hex : "#f1efe8";
    var wallMat = new THREE.MeshStandardMaterial({ color:wallColor, roughness:1, side:THREE.DoubleSide });
    var wt = state.wallTile && WALL_TILES[state.wallTile];
    if (wt && window.KPMat){ // tiled walls: real-size tiles (the UVs are set per wall piece in addWallPlane), a soft glaze
      var wtt = window.KPMat.wallTileTexture ? window.KPMat.wallTileTexture(wt.color, 0.6, 0.3, wt.grout) : window.KPMat.tileFloorTexture(wt.color, 0.06, 0.6, 0.3);
      wallMat = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, wtt.color, true), bumpMap:canvasTex(THREE, wtt.bump, false), bumpScale:0.6,
        roughnessMap:canvasTex(THREE, wtt.rough || roughFromBump(wtt.bump, 0.3, 0.05), false), roughness:1, side:THREE.DoubleSide, envMapIntensity:0.7 }); // a glossy glaze, matte grout
      wallMat.userData.envKeep = true; wallMat.userData.tileWall = 1.2; // the tile texture covers 1.2 m
    }
    var floorMat;
    if (window.KPMat){
      var ft = floorTexture(state.floor, state), isTile = (FLOORS[state.floor] || {}).kind === "tile";
      // gloss varies (visual pass 2): lacquered planks / glazed tiles catch a soft sheen, joints and grout stay matte
      floorMat = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, ft.color, true), bumpMap:canvasTex(THREE, ft.bump, false), bumpScale:isTile ? 0.35 : 0.7,
        roughnessMap:canvasTex(THREE, roughFromBump(ft.bump, isTile ? 0.28 : 0.42, isTile ? 0.04 : 0.12), false), roughness:1, envMapIntensity:0.55 });
      floorMat.userData.envKeep = true;
      floorMat.userData.tile = ft.tileW;
      // state.floorRot = 90: planks/tiles turned a quarter (textures are cached and shared, so always set it)
      [floorMat.map, floorMat.bumpMap, floorMat.roughnessMap].forEach(function(t){ t.rotation = state.floorRot ? Math.PI / 2 : 0; });
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });
    }
    // Studio roles, set the moment the materials exist — the floor and the walls are cloned from these before the rest
    // of the scene is built, and a clone only carries what userData held at clone time
    wallMat.userData.studio = "wall"; floorMat.userData.studio = "floor"; carcassMat.userData.studio = "carcass";

    var scene = new THREE.Scene();
    // opts.onlySurfaceId (drawing export / unit wizard preview): only that one wall's / island row's
    // cabinets are built — no floor, walls, skirting, windows/doors or other cabinets around them.
    // opts.focusWallId (2026-10-13, live "Veggur" view): isolates cabinets the same way, but keeps
    // that ONE real wall's own plane + windows/doors/obstacles (geomForWall below), since this is a
    // real wall the customer/Rakel is looking at face-on, not a fake preview surface or an X-ray export.
    var iso = opts.onlySurfaceId || opts.focusWallId || null; // one surface id, or an array of them (both rows of an island)
    var focusWallId = opts.focusWallId || null;
    function isoHas(id){ return Array.isArray(iso) ? iso.indexOf(id) >= 0 : id === iso; }
    function isFocusWall(wallId){ return !!focusWallId && wallId === focusWallId; }
    // Veggur view, corner return (user, 2026-10-17): the previous wall's last floor cabinet already sits with
    // its SIDE flush into this wall's starting corner whenever cornerClearanceMm pushed this wall's own run back
    // to make room for it (see that function's own comment) — same cabinet, same real position, just owned by
    // the other wall. A real elevation of this wall shows it; the plain isoHas() cabinet filter below doesn't,
    // since it only ever kept cabinets whose own wall.id matches. Never for a drawing-export preview
    // (opts.onlySurfaceId) — only a live "Veggur" look at a real wall needs its real neighbour.
    var neighborCabinetId = null;
    if (focusWallId){
      var fwIdx = surfaces.findIndex(function(w){ return w.id === focusWallId; });
      if (cornerClearanceMm(surfaces, fwIdx, "floor") > 0){
        var pwIdx = fwIdx > 0 ? fwIdx - 1 : -1;
        if (pwIdx < 0 && surfaces.closed){ pwIdx = surfaces.length - 1; while (pwIdx > 0 && surfaces[pwIdx].island) pwIdx--; }
        var pw = pwIdx >= 0 ? surfaces[pwIdx] : null, pwLast = pw && pw.floor[pw.floor.length - 1];
        if (pwLast) neighborCabinetId = pwLast.id;
      }
    }
    var DOOR_LIMITS = {}; try{ DOOR_LIMITS = openingIssues(state).limit; }catch(e){} // how far each door may open (walls, corners)
    scene.background = new THREE.Color(opts.darkBg ? (iso ? 0x1a2029 : 0x12161d) : iso ? 0xffffff : 0xf7f6f2); // darkBg = pro mode
    scene.userData.dayBg = scene.background.clone(); scene.userData.nightBg = new THREE.Color(0x2b303b);

    var nBeforeFloor = scene.children.length;
    var bbox = addFloor(THREE, scene, geoms, floorMat, stateBounds(state, geoms));
    if (iso) scene.children.slice(nBeforeFloor).forEach(function(o){ o.visible = false; });
    // Phase 7c: customer-set room height (was a fixed 2.6m for every
    // project). Also caps how tall any cabinet can render — a Hárskápur
    // sized for a 2.6m ceiling shouldn't poke through a lower one.
    var roomHeightMm = state.roomHeightMm || 2600;
    var WALL_H = roomHeightMm / 1000;
    // Walls between the camera and the room fade out (HomeByMe-style) so an
    // orbit to the "outside" never hides the cabinets behind a solid wall.
    // Wall length labels floating just above each wall (HomeByMe shows room
    // dimensions on the plan); a canvas-texture sprite, drawn on top.
    function isOpenGeom(i){ return !!(state.walls[i] && state.walls[i].open); }
    // the lowest thing hanging over a sink's tap on its wall (a window's bottom edge, a gluggakista), metres above the
    // floor — the tap's gooseneck is lowered to fit under it instead of poking through the glass (user, 2026-10-23)
    function tapCeilingM(wall, xMm){
      var lo = Infinity, pad = 60;
      (state.windows || []).forEach(function(w){ if (w.wallId === wall.id && xMm + pad > w.offsetMm && xMm - pad < w.offsetMm + w.widthMm) lo = Math.min(lo, w.sillHeightMm - 25); }); // the sill board is 25 mm under the opening
      (state.obstacles || []).forEach(function(o){
        if (o.wallId !== wall.id || o.kind === "vatn" || !OBSTACLES[o.kind] || !OBSTACLES[o.kind].blocks) return;
        var r = obstacleRect(o); if (r.n0 > 150 || !(xMm + pad > r.a0 && xMm - pad < r.a1)) return; // only what's right at the wall, over the tap
        lo = Math.min(lo, obstacleVSpan(state, o).lo);
      });
      return isFinite(lo) ? lo / 1000 : null;
    }
    // A wardrobe (user, 2026-10-26): its walls are the ones holding units. One such wall (straight / niche) needs no
    // label at all; a corner says "Veggur 1 / 2", out past the wall's free end so it never floats over the units or
    // their dimension lines. closetOuterEnd(i) = 0 (the wall's start) or 1 (its end): the end NOT in the corner.
    // Baðherbergi the same (user, 2026-10-26): the bubbles floated over an empty bathroom
    var closetSc = /^(fataskapar|bad|thvottahus)(:|$)/.test(String(state.activeCategory || "")) && !(opts.darkBg && /^thvottahus/.test(String(state.activeCategory || ""))); // (PRO laundry keeps its V-bubbles)
    var closetWallIdx = closetSc ? geoms.map(function(g, i){ return i; }).filter(function(i){ var w = state.walls && state.walls[i]; return w && ((w.floor || []).length || (w.wall || []).length); }) : [];
    function closetOuterEnd(i){
      var g = geoms[i], ends = [g.origin, { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM }];
      var inCorner = ends.map(function(p){ return closetWallIdx.some(function(j){
        if (j === i) return false; var h = geoms[j], q = [h.origin, { x:h.origin.x + h.axis.x * h.lenM, z:h.origin.z + h.axis.z * h.lenM }];
        return q.some(function(e){ return Math.hypot(e.x - p.x, e.z - p.z) < 0.05; }); }); });
      return inCorner[1] && !inCorner[0] ? 0 : 1;
    }
    var wallLabels = []; // {sp, g} — faded out in fadeWalls() while the camera is behind that wall (user, 2026-10-23)
    if (!opts.people && !opts.clean && !iso) geoms.forEach(function(g, i){ // (the ceiling-height view has its own single label; opts.clean skips it too — drawing exports don't want it baked into the picture)
      // a small "V1" bubble, the same size on screen however far the wall is (2026-10-12: "Veggur 1 · 4000 mm" was
      // too big; the lengths are on the 2D plan and in the wall's panel)
      var sw = state.walls && state.walls[i];
      if (sw && sw.open && !(sw.floor || []).length && !(sw.wall || []).length) return; // an empty open edge isn't a wall to the customer (2026-10-26)
      if (closetSc && (closetWallIdx.length < 2 || closetWallIdx.indexOf(i) < 0)) return;
      var txt = closetSc ? __("Veggur {n}", { n:i + 1 }) : __("V{n}", { n:i + 1 }), wide = closetSc ? 2 : 1;
      var cv = document.createElement("canvas"); cv.width = 128 * wide; cv.height = 96;
      var cx = cv.getContext("2d");
      cx.fillStyle = "rgba(255,255,255,.94)"; cx.strokeStyle = "#d6d2c8"; cx.lineWidth = 4;
      cx.beginPath(); cx.roundRect ? cx.roundRect(4, 4, 128 * wide - 8, 88, 44) : cx.rect(4, 4, 128 * wide - 8, 88); cx.fill(); cx.stroke();
      cx.fillStyle = "#191919"; cx.font = "700 " + (closetSc ? 40 : 46) + "px 'Kumbh Sans', Arial, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(txt, 64 * wide, 51);
      var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true, sizeAttenuation:false, toneMapped:!closetSc })); // a wardrobe's "Veggur N": crisp, not washed out by the tone mapping
      sp.scale.set(0.038 * wide, 0.0285, 1);
      if (closetSc){ var oe = closetOuterEnd(i), al = oe ? g.lenM + 0.45 : -0.45; sp.position.set(g.origin.x + g.axis.x * al, WALL_H * 0.75, g.origin.z + g.axis.z * al); }
      else sp.position.set(g.origin.x + g.axis.x * g.lenM / 2, WALL_H + 0.16, g.origin.z + g.axis.z * g.lenM / 2);
      sp.renderOrder = 10;
      scene.add(sp);
      wallLabels.push({ sp:sp, g:g });
    });

    // White skirting boards along every wall (visible wherever no cabinet stands)
    var skirtMat = new THREE.MeshStandardMaterial({ color:0xf3f1ec, roughness:0.55 });
    geoms.forEach(function(g, gi){
      if (isOpenGeom(gi) || iso) return;
      var sk = new THREE.Mesh(new THREE.BoxGeometry(g.lenM, 0.09, 0.014), skirtMat);
      sk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      sk.position.set(g.origin.x + g.axis.x * g.lenM / 2 + g.normal.x * 0.005, 0.045, g.origin.z + g.axis.z * g.lenM / 2 + g.normal.z * 0.005); // back face 2 mm behind the wall line: seen from behind it no longer z-fights with the plinth's back face
      sk.receiveShadow = true;
      scene.add(sk);
    });

    // open edges of an open-plan kitchen: no wall, just a dashed line on the floor
    geoms.forEach(function(g, gi){
      if (!isOpenGeom(gi) || iso) return;
      var pts = [new THREE.Vector3(g.origin.x, 0.012, g.origin.z), new THREE.Vector3(g.origin.x + g.axis.x * g.lenM, 0.012, g.origin.z + g.axis.z * g.lenM)];
      var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color:0x6f6d66, dashSize:0.12, gapSize:0.08 }));
      line.computeLineDistances();
      scene.add(line);
    });
    var wallFades = [];
    geoms.forEach(function(g, gi){
      var wid = state.walls[gi] && state.walls[gi].id;
      if (isOpenGeom(gi) || (iso && !isFocusWall(wid))) return;
      var mat = wallMat.clone();
      mat.transparent = true;
      var gaps = (state.doors || []).filter(function(d){ return d.gap && d.wallId === wid; })
        .map(function(d){ return { offM:d.offsetMm / 1000, widM:d.widthMm / 1000, hM:Math.min(d.heightMm, roomHeightMm) / 1000, loM:0 }; })
        .concat((state.windows || []).filter(function(w){ return w.wallId === wid; }).map(function(w){ // a window is a real hole: its frame sits in the reveal
          return { offM:w.offsetMm / 1000, widM:w.widthMm / 1000, loM:w.sillHeightMm / 1000, hM:Math.min(w.sillHeightMm + w.heightMm, roomHeightMm) / 1000 }; }));
      wallFades.push({ mesh:addWallPlane(THREE, scene, g, WALL_H, mat, gaps), geom:g, mat:mat, wallId:wid, openings:[] });
    });
    // opts.previewRoom (bath / laundry previews, owner 2026-10-27): the isolated unit stands in a piece of the real room —
    // the floor and the wall (colour or tiles) picked on "Útlit rýmisins", at real size, with the same light and shadows
    // as the editor — instead of a white void where a white box read as a flat slab
    if (iso && opts.previewRoom && geoms[0]){
      var prg = geoms[0], prExt = 3, prDepth = 4.5;
      var prWall = { origin:{ x:prg.origin.x - prg.axis.x * prExt, z:prg.origin.z - prg.axis.z * prExt }, axis:prg.axis, normal:prg.normal, lenM:prg.lenM + prExt * 2 };
      addWallPlane(THREE, scene, prWall, WALL_H + 1.5, wallMat.clone(), []); // taller than the room: a preview looking up at a tall unit never sees a white band over the wall
      var prq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(prg.axis.x, 0, prg.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(prg.normal.x, 0, prg.normal.z)));
      var prFloor = new THREE.Mesh(new THREE.PlaneGeometry(prWall.lenM, prDepth), floorMat);
      if (floorMat.map && floorMat.userData.tile) [floorMat.map, floorMat.bumpMap, floorMat.roughnessMap].forEach(function(t){ if (t) t.repeat.set(prWall.lenM / floorMat.userData.tile, prDepth / floorMat.userData.tile); });
      var prG = new THREE.Group(); prG.quaternion.copy(prq); prG.position.set(prg.origin.x + prg.axis.x * prg.lenM / 2, 0, prg.origin.z + prg.axis.z * prg.lenM / 2);
      prFloor.rotation.x = -Math.PI / 2; prFloor.position.set(0, 0, prDepth / 2 - 0.04); prFloor.receiveShadow = true; prG.add(prFloor);
      if (!wallMat.userData.tileWall){ // a painted wall gets its white skirting, like the room
        var prSk = new THREE.Mesh(new THREE.BoxGeometry(prWall.lenM, 0.09, 0.014), skirtMat); prSk.position.set(0, 0.045, 0.005); prSk.receiveShadow = true; prG.add(prSk);
      }
      scene.add(prG);
      scene.background = new THREE.Color(0xf3f1ec);
    }

    function geomForWall(wallId){
      if (iso && !isFocusWall(wallId)) return null;
      var wi = state.walls.findIndex(function(w){ return w.id === wallId; });
      return wi === -1 || state.walls[wi].open ? null : geoms[wi];
    }
    var pickables = [];
    // A window/door/opening fades together with its wall: seen from outside the room through a faded wall,
    // the frame and door leaf used to stay solid and block the view (user, 2026-10-02).
    function fadeWithWall(wallId, group){
      var w = group && wallFades.find(function(x){ return x.wallId === wallId; });
      if (!w) return;
      group.__fadeWall = w; // picking skips it while the wall is faded
      var mats = [];
      group.traverse(function(o){
        if (!o.material) return;
        o.material.transparent = true;
        o.material.userData.baseOpacity = o.material.opacity;
        o.material.userData.baseDepthWrite = o.material.depthWrite;
        mats.push({ mat:o.material, mesh:o, shadow:o.castShadow });
      });
      w.openings.push(mats);
    }
    (state.windows || []).forEach(function(win){
      var g = geomForWall(win.wallId);
      if (!g) return;
      fadeWithWall(win.wallId, addOpeningMarker(THREE, scene, g, win.offsetMm / 1000, win.widthMm / 1000, win.heightMm / 1000,
        win.sillHeightMm / 1000, WINDOW_MARKER_COLOR, 0.55,
        { wallId:win.wallId, zone:"opening", kind:"window", locked:!win.unlocked && !!opts.onSelect, blockId:win.id, widthMm:win.widthMm, depthMm:10, heightMm:win.heightMm, elevMm:win.sillHeightMm }, opts.selectedId === win.id, pickables));
    });
    var doorHitIds = {}; roomDoorConflicts(state).forEach(function(cf){ doorHitIds[cf.doorId] = cf.ids; });
    (state.doors || []).forEach(function(door){
      var g = geomForWall(door.wallId);
      if (!g) return;
      fadeWithWall(door.wallId, addOpeningMarker(THREE, scene, g, door.offsetMm / 1000, door.widthMm / 1000, door.heightMm / 1000,
        0, DOOR_MARKER_COLOR, 0.85,
        { wallId:door.wallId, zone:"opening", kind:"door", locked:!door.unlocked && !!opts.onSelect, gap:!!door.gap, blockId:door.id, widthMm:door.widthMm, depthMm:10, heightMm:door.heightMm, elevMm:0,
          hingeRight:doorHingeOf(door) === "right", swingOut:doorSwingOf(door) === "out" }, opts.selectedId === door.id, pickables));
      // Veggur view: nothing is built behind the wall, so an "Op í vegg" looked straight into the empty background —
      // a flat black slab in PRO's dark scene (2026-10-26). A soft neutral backdrop just behind the hole reads as
      // "the next room" instead, and the reveals still show the wall's depth.
      if (door.gap && isFocusWall(door.wallId)){
        var gapBack = new THREE.Mesh(new THREE.PlaneGeometry(door.widthMm / 1000, door.heightMm / 1000),
          new THREE.MeshBasicMaterial({ color:0xc9c4ba, side:THREE.DoubleSide }));
        gapBack.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
        var gapAlong = (door.offsetMm + door.widthMm / 2) / 1000;
        gapBack.position.set(g.origin.x + g.axis.x * gapAlong - g.normal.x * (WALL_THICKNESS_M + 0.02), door.heightMm / 2000, g.origin.z + g.axis.z * gapAlong - g.normal.z * (WALL_THICKNESS_M + 0.02));
        scene.add(gapBack);
      }
      // the floor the leaf sweeps (editor only): a faint quarter circle, red when a cabinet stands in it
      var sw = opts.onSelect && !opts.clean && !iso ? doorSweep(state, door) : null;
      if (sw){
        var bad = doorHitIds[door.id], N = 28, pos = [sw.h.x, 0.004, sw.h.z], idx = [], line = [];
        for (var k = 0; k <= N; k++){
          var t = (Math.PI / 2) * k / N, px = sw.h.x + (sw.u.x * Math.cos(t) + sw.v.x * Math.sin(t)) * sw.r, pz = sw.h.z + (sw.u.z * Math.cos(t) + sw.v.z * Math.sin(t)) * sw.r;
          pos.push(px, 0.004, pz); line.push(new THREE.Vector3(px, 0.006, pz));
          if (k) idx.push(0, k, k + 1);
        }
        var fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx);
        var fan = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color:bad ? 0xd64545 : 0x8a6a4a, transparent:true, opacity:bad ? 0.3 : (sw.inward ? 0.12 : 0.06), depthWrite:false, side:THREE.DoubleSide }));
        fan.renderOrder = 2; scene.add(fan);
        var arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineDashedMaterial({ color:bad ? 0xc0392b : 0x8a6a4a, dashSize:0.05, gapSize:0.035 }));
        arc.computeLineDistances(); scene.add(arc);
      }
    });

    // Hindranir: boxes in the wall colour (pipe box, column, partition, beam), a white radiator, a grey fuse box,
    // a chrome pipe stub, a stone sill. Tap = select (they never drag; moved in the panel / ◀ ▶).
    (state.obstacles || []).forEach(function(o){
      var def = OBSTACLES[o.kind], g = geomForWall(o.wallId); if (!def || !g) return;
      var v = obstacleVSpan(state, o), sel = opts.selectedId === o.id, hM = Math.max(0.01, (v.hi - v.lo) / 1000);
      var rr = obstacleRect(o), wM = (rr.a1 - rr.a0) / 1000, dM = (rr.n1 - rr.n0) / 1000, outM = rr.n0 / 1000; // wM along the wall, dM out of it (after a turn)
      // dragged along / up and down the wall in the editor like a window (2026-10-11); o.locked = stays put (2026-10-23)
      var meta = { kind:"obstacle", zone:"obstacle", blockId:o.id, wallId:o.wallId, locked:!opts.onCabinetDragEnd || !!o.locked, widthMm:rr.a1 - rr.a0, depthMm:rr.n1 - rr.n0, heightMm:v.hi - v.lo, elevMm:v.lo,
        free:!!def.free && !!opts.onObstacleFloorEnd && !o.locked };
      // one invisible box = what you grab (world position, like a window plane); the visible parts are its children
      var grp = new THREE.Group(), proxy = new THREE.Mesh(new THREE.BoxGeometry(wM, hM, dM), new THREE.MeshBasicMaterial({ visible:false }));
      proxy.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      var along = rr.a0 / 1000 + wM / 2;
      proxy.position.set(g.origin.x + g.axis.x * along + g.normal.x * (outM + dM / 2), v.lo / 1000 + hM / 2, g.origin.z + g.axis.z * along + g.normal.z * (outM + dM / 2));
      if (obstacleAng(o)) proxy.rotateY(-obstacleAng(o) * Math.PI / 180); // any angle (2026-10-24), about its own centre
      proxy.userData = meta; grp.add(proxy); pickables.push(proxy);
      function part(geo, color, rough, metal, x, y, z){ // y from the bottom, z from the depth centre
        var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:color, roughness:rough, metalness:metal || 0 }));
        if (sel){ m.material.emissive = new THREE.Color(SELECT_COLOR); m.material.emissiveIntensity = 0.55; }
        m.position.set(x || 0, y - hM / 2, z || 0); m.castShadow = true; m.receiveShadow = true;
        proxy.add(m); return m;
      }
      if (def.look === "radiator"){ // a modern double panel radiator (type 22), no pipes (user, 2026-10-23: "remove the bottom pipe")
        var radW = 0xf6f6f4, radD = 0xdcdcd8;
        [-1, 1].forEach(function(side){ // front + back panel, each with its vertical convector ribs
          var pz = side * (dM / 2 - 0.009);
          part(new THREE.BoxGeometry(wM - 0.02, hM - 0.03, 0.014), radW, 0.28, 0.05, 0, (hM - 0.03) / 2 + 0.005, pz);
          if (side > 0){
            var ribs = Math.max(4, Math.round((wM - 0.04) / 0.033));
            for (var ri = 0; ri < ribs; ri++) part(new THREE.BoxGeometry(0.003, hM - 0.08, 0.002), radD, 0.4, 0, -wM / 2 + 0.03 + ri * (wM - 0.06) / (ribs - 1), hM / 2, pz + 0.0075);
          }
        });
        part(new THREE.BoxGeometry(wM - 0.02, 0.006, dM - 0.004), 0x8e9094, 0.6, 0.1, 0, hM - 0.022, 0); // the shaded gap under the top grille
        for (var gi = 0; gi < Math.round(wM / 0.012); gi++) part(new THREE.BoxGeometry(0.004, 0.004, dM - 0.01), radW, 0.3, 0, -wM / 2 + 0.012 + gi * 0.012, hM - 0.017, 0); // grille bars
        [-1, 1].forEach(function(side){ part(new THREE.BoxGeometry(0.008, hM - 0.01, dM), radW, 0.3, 0, side * (wM / 2 - 0.004), (hM - 0.01) / 2, 0); }); // side covers
        // thermostatic valve head at the top corner, on the room side
        part(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 16), 0xd8d9db, 0.25, 0.8, wM / 2 - 0.03, hM - 0.06, dM / 2 + 0.025).rotation.x = Math.PI / 2;
        part(new THREE.CylinderGeometry(0.022, 0.024, 0.055, 24), 0xfafafa, 0.35, 0, wM / 2 - 0.03, hM - 0.06, dM / 2 + 0.06).rotation.x = Math.PI / 2;
      } else if (def.look === "panel"){ // a modern consumer unit: white enclosure, recessed door, smoked window over a row of breakers, lock
        var encl = 0xf1f1ef;
        part(new THREE.BoxGeometry(wM, hM, dM * 0.85), encl, 0.35, 0.02, 0, hM / 2, -dM * 0.075);
        part(new THREE.BoxGeometry(wM - 0.03, hM - 0.03, 0.012), 0xfbfbfa, 0.3, 0, 0, hM / 2, dM / 2 - 0.006); // the door
        part(new THREE.BoxGeometry(wM - 0.02, 0.004, 0.004), 0xd6d6d3, 0.4, 0, 0, hM - 0.016, dM / 2); // door shadow lines
        part(new THREE.BoxGeometry(wM - 0.02, 0.004, 0.004), 0xd6d6d3, 0.4, 0, 0, 0.016, dM / 2);
        var rows = hM > 0.45 ? 2 : 1;
        for (var row = 0; row < rows; row++){
          var wy = hM * (rows === 2 ? (row ? 0.36 : 0.7) : 0.6), wh = Math.min(0.11, hM * 0.2);
          var win = part(new THREE.BoxGeometry(wM - 0.07, wh, 0.003), 0x2c3136, 0.15, 0.1, 0, wy, dM / 2 + 0.001);
          win.material.transparent = true; win.material.opacity = 0.88;
          var n = Math.max(3, Math.floor((wM - 0.09) / 0.018)); // breakers on the DIN rail behind the window
          for (var bi = 0; bi < n; bi++){
            var bx = -(wM - 0.09) / 2 + 0.009 + bi * (wM - 0.09) / n;
            part(new THREE.BoxGeometry(0.0155, wh * 0.78, 0.003), 0xe9e9e6, 0.5, 0, bx, wy, dM / 2 + 0.0025);
            part(new THREE.BoxGeometry(0.006, wh * 0.18, 0.004), bi % 4 === 0 ? 0x2f6fd0 : 0x1e1f21, 0.5, 0, bx, wy + wh * 0.06, dM / 2 + 0.004);
          }
        }
        part(new THREE.BoxGeometry(0.012, 0.045, 0.01), 0xcfd2d5, 0.3, 0.7, wM / 2 - 0.035, hM * 0.5, dM / 2 + 0.005); // lock / handle
      } else if (def.look === "pipe"){
        part(new THREE.CylinderGeometry(0.02, 0.02, dM, 16).rotateX(Math.PI / 2), 0xc8ccd2, 0.25, 0.9, -wM / 4, hM / 2, 0);
        part(new THREE.CylinderGeometry(0.025, 0.025, dM, 16).rotateX(Math.PI / 2), 0x9a9da3, 0.35, 0.6, wM / 4, hM / 2, 0);
      } else if (def.look === "sill"){
        part(new THREE.BoxGeometry(wM, hM, dM), 0xe6e2da, 0.35, 0, 0, hM / 2, 0);
      } else if (def.model){ // a WC / a shower: the real model (the Húsgögn one), fitted to the box
        var mg = buildDecor(THREE, def.model, { kind:def.model }); mg.position.set(0, -hM / 2, 0);
        mg.scale.set(wM / (def.w / 1000), 1, dM / (def.d / 1000));
        mg.traverse(function(o){ if (o.isMesh){ o.castShadow = !o.userData.noShadow; o.receiveShadow = true; if (sel && o.material){ o.material = o.material.clone(); o.material.emissive = new THREE.Color(SELECT_COLOR); o.material.emissiveIntensity = 0.35; } } });
        proxy.add(mg);
      } else if (def.look === "mirror"){ // a wall mirror: a thin pale frame, the glass a near-perfect reflector
        part(new THREE.BoxGeometry(wM, hM, dM), 0xece9e2, 0.4, 0, 0, hM / 2, 0);
        var mir = part(new THREE.BoxGeometry(wM - 0.03, hM - 0.03, 0.004), 0xe4eaee, 0.04, 1, 0, hM / 2, dM / 2 + 0.002);
        mir.material.userData = { envKeep:true, mirror:true };
      } else if (def.look === "fixture"){ // shower / bath / WC: a calm neutral volume, a little see-through — "something stands here"
        var fx = part(new THREE.BoxGeometry(wM, hM, dM), 0xdfe3e6, 0.5, 0, 0, hM / 2, 0);
        fx.material.transparent = true; fx.material.opacity = 0.55; fx.castShadow = false;
        var ed = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(wM, hM, dM)), new THREE.LineBasicMaterial({ color:0x8f969c }));
        ed.position.set(0, 0, 0); proxy.add(ed);
      } else if (def.shapes && o.shape === "round"){ // a round column (2026-10-23)
        part(new THREE.CylinderGeometry(Math.min(wM, dM) / 2, Math.min(wM, dM) / 2, hM, 40), new THREE.Color(wallColor).getHex(), 1, 0, 0, hM / 2, 0);
      } else {
        // a shade darker than the wall, so it reads on a white wall — columns and milliveggir are the wall itself (user, 2026-10-24)
        part(new THREE.BoxGeometry(wM, hM, dM), (def.free && !def.ceiling ? new THREE.Color(wallColor) : new THREE.Color(wallColor).lerp(new THREE.Color(0x8a857a), 0.18)).getHex(), 1, 0, 0, hM / 2, 0);
      }
      scene.add(grp);
      if (!outM && def.look === "wall" && !(def.free && !def.ceiling)) fadeWithWall(o.wallId, grp); // a pipe box / beam on a faded wall fades with it — a column / milliveggur stands in the room and never does
      // a milliveggur's far-end handle (2026-10-20): drag it to stretch/shrink the partition instead of
      // only typing "Lengd út í rýmið" — a small ball at the tip, mid-height, always there (not just while
      // selected, same as the island puck) so it reads as grabbable at a glance
      // Both ends (2026-10-23): either end drags, the other stays put — along its length axis (out from the wall, or along
      // it once turned). The wall stretches live in 3D (proxy scaled, no scene rebuild — a rebuild mid-drag lost the
      // drag, which was why it "didn't work"); onObstacleResizeEnd stores it once on release.
      if (o.kind === "milliveggur" && def.free && opts.onObstacleResizeEnd && !o.locked && !obstacleAng(o)){ // (at an angle: its Lengd field)
        ["near", "far"].forEach(function(end){
          // 6 cm past the end, drawn on top: the end face itself (or the wall it stands against) must never win the pick
          var push = (end === "far" ? 1 : -1) * 0.06;
          var la = rr.rot ? (end === "far" ? rr.a1 : rr.a0) / 1000 + push : along, lo = rr.rot ? outM + dM / 2 : Math.max(0.05, (end === "far" ? rr.n1 : rr.n0) / 1000 + push);
          var rH = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color:sel ? 0x0d8fbf : 0xf5c518, depthTest:false }));
          rH.renderOrder = 12;
          rH.position.set(g.origin.x + g.axis.x * la + g.normal.x * lo, v.lo / 1000 + hM / 2, g.origin.z + g.axis.z * la + g.normal.z * lo);
          var gapMm = Math.round(((rr.rot ? la : lo) * 1000) - (end === "far" ? (rr.rot ? rr.a1 : rr.n1) : (rr.rot ? rr.a0 : rr.n0))); // handle ↔ actual end
          rH.userData = { kind:"obstacle-resize", obstacleId:o.id, wallId:o.wallId, end:end, rot:rr.rot, s0:rr.rot ? rr.a0 : rr.n0, s1:rr.rot ? rr.a1 : rr.n1, proxy:proxy, gapMm:gapMm };
          scene.add(rH); pickables.push(rH);
        });
      }
    });

    // built-in fridge reads as an appliance: brushed-steel front instead of the kitchen's fronts
    var steelMat = new THREE.MeshStandardMaterial({ color:0xc9ccd1, metalness:0.75, roughness:0.32 });
    var washerMat = new THREE.MeshStandardMaterial({ color:0xf3f4f5, roughness:0.35, metalness:0.05 });
    var wineMat = new THREE.MeshStandardMaterial({ color:0x1b1c1f, roughness:0.35, metalness:0.4 });
    // shared by every floor unit: recessed plinth + honed-stone worktop
    // open-shelf units: inside faces must render (double-sided) and the front is left out
    var openMat = carcassMat.clone(); openMat.side = THREE.DoubleSide;
    var hiddenMat = new THREE.MeshBasicMaterial({ visible:false });
    var stoneMat = makeTopMaterial(THREE, state.top);
    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = look && window.KPMat
      ? makeFrontMaterial(THREE, state.look, look)
      : new THREE.MeshStandardMaterial({ color: look ? look.color3d : 0xb7b2a4, roughness:0.7 });
    // FR2 (2026-10-23): a second front material for the project; cabinets with b.front2 are built in it. Tagged back to
    // frontMat so X-Ray strips it together with the FR1 fronts.
    var look2 = state.look2 ? LOOKS[state.look2] : null;
    var frontMat2 = look2 ? (window.KPMat ? makeFrontMaterial(THREE, state.look2, look2) : new THREE.MeshStandardMaterial({ color:look2.color3d, roughness:0.7 })) : null;
    if (frontMat2){ frontMat2.__xrayBase = frontMat; frontMat2.userData.fr2 = true; } // (fr2: previewFront leaves it alone)
    // a spegilskápur (owner, 2026-10-27): its fronts are a mirror — a bright, near-perfect reflector of the room's light
    var mirrorMat = new THREE.MeshStandardMaterial({ color:0xe4eaee, metalness:1, roughness:0.04 }); mirrorMat.__xrayBase = frontMat; mirrorMat.userData = { envKeep:true, fr2:true, mirror:true };
    // Spegill á hurð (wardrobes, owner 2026-10-27): state.closetMirror "ein" = the first door unit, "allar" = every one
    var closetMirrorIds = {};
    if (state.closetMirror === "ein" || state.closetMirror === "allar"){
      var cmDoors = [];
      (state.walls || []).forEach(function(w){ (w.floor || []).forEach(function(b){ if (b.type === "harskapur") cmDoors.push(b); }); });
      if (state.closetMirror === "allar") cmDoors.forEach(function(b){ closetMirrorIds[b.id] = true; });
      else { var cmPlain = function(b){ return !(b.interior && b.interior.mode === "skuffur") && !(b.closetItems && b.closetItems.drawers); }; // no drawer fronts to mirror
        var cm1 = cmDoors.find(function(b){ return cmPlain(b) && doorLeaves(b, CATALOG[b.type]).length === 1; }) || cmDoors.find(cmPlain) || cmDoors[0]; if (cm1) closetMirrorIds[cm1.id] = true; } // one door: a single-door unit if there is one
    }
    function frontMatOf(b){ return b && (b.mirrorFront || closetMirrorIds[b.id]) ? mirrorMat : b && b.front2 && frontMat2 ? frontMat2 : frontMat; }
    // opts.towerGlass (Þvottahús previews, user 2026-10-26): the washer tower's doors see-through so the machines inside show
    var towerGlassMat = opts.towerGlass ? (function(){ var m = frontMat.clone(); m.transparent = true; m.opacity = 0.16; m.depthWrite = false; return m; })() : null;
    var frontOpenMat = frontMat.clone(); frontOpenMat.side = THREE.DoubleSide; // open shelf units built all in the front material (b.frontAll)
    // Fataskápar has no stone worktop — a grunnskapur's "counter" cap reads as a front-material-finished top
    // instead (owner, 2026-10-14). stoneMat is read by closure everywhere a counter slab is drawn (the cabinet's
    // own cap, the áfella continuation, the island-back continuation), so this one reassignment covers all of them.
    if (/^fataskapar(:|$)/.test(String(state.activeCategory || ""))) stoneMat = frontMat;
    var LIGHT = state.lighting || {}; // { underWall, shelves, plinth } — see the "Lýsing" section of the editor
    // the plinth (sökkull): its FRONT face is clad in the front material once one is chosen (box face 4 = +z = out
    // of the wall); the sides and back stay the dark plinth colour. Its own clone, not `frontMat` itself (user,
    // 2026-10-19 — "X ray á ekki að taka sökkulcoverið burt"): setXrayFronts strips `frontMat` to see inside the
    // doors/drawers built from it, which doesn't apply to a plinth — there's nothing behind it to reveal.
    var plinthDark = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 });
    var plinthFrontMat = frontMat.clone();
    // the plinth's ends wrap round in the front material too (owner, 2026-10-27: a free end — a laundry tower in a preview — showed a black block)
    var plinthMat = look ? [plinthFrontMat, plinthFrontMat, carcassMat, plinthDark, plinthFrontMat, plinthDark] : plinthDark; // (top: the carcass colour — seen through an X-rayed front it read as a black floor in the box)
    // Studio: every base material says what it IS, so the photo builds its own physically-set material per role
    // (a wall can never come out in the front's wood). Clones (selection tint, per-wall fades) carry userData along.
    [[wallMat, "wall"], [floorMat, "floor"], [carcassMat, "carcass"], [openMat, "carcass"], [steelMat, "steel"], [washerMat, "appliance"],
     [stoneMat, /^fataskapar(:|$)/.test(String(state.activeCategory || "")) ? "front" : "top"], [frontMat, "front"], [frontMat2, "front"], [frontOpenMat, "front"],
     [plinthDark, "plinth"], [plinthFrontMat, "front"]].forEach(function(p){ if (p[0] && p[0].userData) p[0].userData.studio = p[1]; });

    // the áfellur of one wall (see afellaMm): a 19 mm panel in the front material from the floor (or the
    // cabinet's bottom, for wall units) to its top, the worktop running on over it
    function addAfellur(g, wall, wi, fStarts, wStarts){
      [["floor", fStarts, cornerClearanceMm(surfaces, wi, "floor")], ["wall", wStarts, 0]].forEach(function(z){
        var list = wall[z[0]], starts = z[1], af = afellaMm(surfaces, wi, z[0]);
        if (!list.length) return;
        var ends = [];
        if (af.start && Math.abs(starts[0] - z[2] - AFELLA_MM) < 1) ends.push({ b:list[0], at:z[2] });
        var li = list.length - 1;
        if (af.end && Math.abs(g.lenM * 1000 - AFELLA_MM - (starts[li] + list[li].widthMm)) < 1) ends.push({ b:list[li], at:g.lenM * 1000 - AFELLA_MM });
        ends.forEach(function(e){
          var c = CATALOG[e.b.type];
          if (c.panel || c.shelfStack) return; // an end panel already closes it
          var hM = Math.min(e.b.heightMm || c.h, roomHeightMm) / 1000, dM = (e.b.depthMm || c.d) / 1000;
          var y0 = z[0] === "wall" ? elevOf(e.b) / 1000 : 0, w = AFELLA_MM / 1000;
          var geo = new THREE.BoxGeometry(w - 0.002, hM, dM); // 1 mm off the wall and the cabinet: no shared planes
          panelUV(geo, w, hM, dM, frontMat.userData && frontMat.userData.tile);
          var m = new THREE.Mesh(geo, frontMat), along = e.at / 1000 + w / 2;
          m.position.set(g.origin.x + g.axis.x * along + g.normal.x * dM / 2, y0 + hM / 2, g.origin.z + g.axis.z * along + g.normal.z * dM / 2);
          m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
          m.castShadow = true; m.receiveShadow = true;
          var ag = new THREE.Group(); ag.add(m); scene.add(ag);
          ag.userData.cab = { blockId:null, nx:g.normal.x, nz:g.normal.z, d:g.normal.x * g.origin.x + g.normal.z * g.origin.z, t:0, items:null, hide:true };
          (scene.userData.cabs = scene.userData.cabs || []).push(ag);
          if (z[0] === "floor" && c.counter){ // the worktop covers the áfella too
            var tt0 = stoneMat.userData.thick || 0.03, tg = new THREE.BoxGeometry(w + 0.001, tt0, dM + 0.02);
            var t = new THREE.Mesh(tg, stoneMat);
            t.position.set(g.origin.x + g.axis.x * along + g.normal.x * (dM + 0.02) / 2, hM + 0.001 + tt0 / 2, g.origin.z + g.axis.z * along + g.normal.z * (dM + 0.02) / 2);
            t.quaternion.copy(m.quaternion); t.castShadow = true; t.receiveShadow = true;
            ag.add(t);
          }
        });
      });
    }

    // "Bak á eyju" (2026-10-05): a single-row island's open back clad with one 19 mm panel in the front
    // material over its whole length, the worktop running on over it
    function addIslandBack(g, wall, starts){
      var last = wall.floor.length - 1, from = starts[0] / 1000, to = (starts[last] + wall.floor[last].widthMm) / 1000;
      var hM = wall.floor.reduce(function(m, b){ var c = CATALOG[b.type]; return Math.max(m, Math.min(b.heightMm || c.h, roomHeightMm) / 1000); }, 0);
      var len = to - from, w = 0.019, along = from + len / 2;
      var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      var geo = new THREE.BoxGeometry(len, hM, w - 0.002);
      scaleFrontUV(geo, len, hM, frontMat.userData && frontMat.userData.tile);
      var m = new THREE.Mesh(geo, frontMat);
      m.position.set(g.origin.x + g.axis.x * along - g.normal.x * w / 2, hM / 2, g.origin.z + g.axis.z * along - g.normal.z * w / 2);
      m.quaternion.copy(q); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      if (wall.floor.some(function(b){ return CATALOG[b.type].counter; })){
        var tt1 = stoneMat.userData.thick || 0.03, t = new THREE.Mesh(new THREE.BoxGeometry(len + 0.001, tt1, w), stoneMat);
        t.position.set(g.origin.x + g.axis.x * along - g.normal.x * w / 2, hM + 0.001 + tt1 / 2, g.origin.z + g.axis.z * along - g.normal.z * w / 2);
        t.quaternion.copy(q); t.castShadow = true; scene.add(t);
      }
    }

    surfaces.forEach(function(wall, wi){
      var g = allGeoms[wi];
      var neighborOnly = !!(iso && !isoHas(wall.id) && neighborCabinetId && wall.floor.some(function(b){ return b.id === neighborCabinetId; }));
      if (!g || (iso && !isoHas(wall.id) && !neighborOnly)) return;
      var fStarts = blockStartsMm(wall.floor, cornerClearanceMm(surfaces, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      var islandId = wall.island ? wall.island.id : undefined;
      // This wall/island's own plinth (Sökkulhæð) — same resolver buildPlan2D's dimension chain already uses
      // (plinthMmOf in kitchen-planner.html); floor-unit geometry below used to hardcode 100 regardless, so a
      // custom Sökkulhæð changed the numbers shown but never what was actually drawn.
      var plinthSrcW = wall.island || wall, plinthMmW = (plinthSrcW && typeof plinthSrcW.plinthMm === "number") ? plinthSrcW.plinthMm : 100;
      if (!opts.people && !neighborOnly) addAfellur(g, wall, wi, fStarts, wStarts);
      if (wall.island && wall.island.back && !wall.island.two && wall.floor.length && !neighborOnly) addIslandBack(g, wall, fStarts);
      wall.floor.forEach(function(b, bi){
        if (neighborOnly && b.id !== neighborCabinetId) return;
        var offset = fStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var hungPanel = !!(c.panel && state.hungUnits && !wall.island); // a bath úthlið hangs with its unit: its height is the box, lifted by the gap
        if (hungPanel) hM = Math.min(hM + plinthMmW / 1000, roomHeightMm / 1000);
        var selected = opts.selectedId === b.id;
        var inter = b.interior;
        if (c.rusl && !(inter && inter.mode === "skuffur")) inter = { mode:"skuffur", codes:[state.drawerSystem === "merivo" ? "E" : "C"], count:1 }; // old drafts: one tall pull-out
        if (inter && inter.mode === "skuffur"){ // the real stack: one Blum code per drawer, fronts sized from the codes
          var fullBody = hM * 1000 - plinthMmW, dbody = drawerZoneMm(c, fullBody, b.drawerZoneMm), dcodes = drawerCodes(inter, state.drawerSystem), dfr = stackFrontsMm(inter, dcodes, dbody);
          // a tall unit with drawers: the drawers fill the bottom (≤ 1200 mm), a hinged door the rest (user, 2026-10-11)
          var zf = dbody / fullBody, topDoor = zf < 0.999 ? zf : null;
          inter = Object.assign({}, inter, { codes:dcodes, count:dcodes.length, topDoorFr:topDoor,
            fractions:dfr ? frontsToFractions(dfr, dbody).map(function(f){ return f * zf; }) : null });
        }
        var towerNiche = null;
        var applMat = c.appliance === "fridge" || c.appliance === "dishwasher" ? steelMat : c.appliance === "washer" ? washerMat : c.appliance === "wine" ? wineMat : null;
        var applMdl = applKeyOf(c, b) ? applModel(applKeyOf(c, b)) : null; // the real model: the box stays (for picking/dragging) but isn't drawn
        if (applMdl){ if (!APPL_HIDE) APPL_HIDE = new THREE.MeshBasicMaterial({ visible:false }); applMat = APPL_HIDE; }
        // an integrated fridge wears the kitchen's fronts (user, 2026-10-05 — it was steel)
        var cabMeta = { lockToId:b.lockTo && c.panel ? b.lockTo.id : null, islandId:islandId, locked:!!b.locked || !!opts.xray, suppressBadge:!!opts.xray, slabFronts:jeyOn, corner:c.cls === "corner", doorSide:b.swing === "vinstri" ? "left" : "right", hingeRight:c.cls === "corner" ? b.swing === "vinstri" : b.swing === "haegri", shelves:(c.hasInterior || c.shelfRange) && !(b.interior && b.interior.mode === "skuffur") ? (shelvesOf(b) || 0) : 0,
            openMat:c.open ? frontOpenMat : openMat, open:!!c.open, hiddenMat:hiddenMat, drawerSystem:state.drawerSystem, carcassKey:state.carcass,
            warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), ready:!!(opts.readyIds && opts.readyIds.indexOf(b.id) >= 0), doorLimit:DOOR_LIMITS[b.id] || null, shelfBlock:b, wallId:wall.id, zone:"floor", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d), heightMm:hM * 1000, elevMm:0, handle:c.appliance ? null : state.handle, tall:c.cls === "tall" || !!c.fridge, split:c.fridge ? 0.74 : 0, // tall units: one door unless split in Smíða (2026-10-09)
            splitFr:c.oven || c.fixedFronts ? null : splitFractions(b, hM * 1000 - (c.panel || c.appliance ? 0 : plinthMmW)), // a fridge too, once its split is changed in Smíða
            plinth:(!c.panel || hungPanel) && !c.appliance, plinthMm:plinthMmW, appliance:c.appliance || null, leMans:!!c.tofrahornIds, counter:!!c.counter, sink:!!c.sink, utilityTap:!!c.sink && /^thvottahus(:|$)/.test(String(state.activeCategory || "")), tapCeilM:c.sink ? tapCeilingM(wall, offset + b.widthMm / 2) : null, oven:!!c.oven, panel:!!c.panel, plinthMat:plinthMat, stoneMat:stoneMat,
            ovenCodes:c.lowOven ? ["M"] : c.oven ? ovenCodesOf(b, state.drawerSystem) : null, fixedFronts:!!c.fixedFronts || !!c.appliance,
            burCodes:c.bur ? burCodesOf(b, state.drawerSystem) : innerFreeOf(b, c), innerFree:!c.bur && !!innerFreeOf(b, c), dishwasher:!!c.dishwasher,
            lowOven:!!c.lowOven, pickTop:!!opts.pickWorktop && !!c.counter, ovenFrontsMm:c.oven ? b.ovenFrontsMm || null : null, ovenBlock:c.oven ? b : null, ovenCat:c.oven ? c : null,
            sinkFixedTop:!!c.sink && b.sinkTop === "fastur" && !!(b.interior && b.interior.mode === "skuffur"),
            fridgeKind:c.fridge ? (b.type === "frystir" ? "freezer" : "fridge") : null,
            bins:!!(c.rusl || (c.sink && b.interior && b.interior.mode === "skuffur") || binsWanted(b, c, state.drawerSystem)), // RUSL60/80 in the bottom drawer
            ovenInner:c.oven && !c.lowOven ? (String(b.ovenCombo == null ? OVEN_DEFAULT[state.drawerSystem === "merivo" ? "merivo" : "legra"] : b.ovenCombo).split("+")[1] || null) : null,
            washerDrawerM:c.thvo && b.thvo !== "hurdir" ? 0.40 : 0, alwaysDims:/^fataskapar(:|$)/.test(String(state.activeCategory || "")), hung:!!state.hungUnits, basin:!!c.sink && !!state.hungUnits, applModel:!!applMdl };
        // Þvottavélaskápur "Skúffa undir vélinni + skápur ofan við" (round 3, user 2026-10-26): a drawer at the bottom, the
        // washer + dryer in an open niche, a cabinet above — what's built and what the "Hvar er vélin?" preview shows
        var nicheTower = c.thvo && b.thvo !== "hurdir" && !applMat;
        if (nicheTower) towerNiche = addWasherTower(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, plinthMmW / 1000, carcassMat, frontMatOf(b), cabMeta, selected, pickables, !!b.single || (c.thvoSide && b.widthMm < 1000), !!c.thvoSide);
        else if (c.thvo && towerGlassMat && !applMat){ // "Hurðir alla leið" in a preview (owner, 2026-10-27: it read as a white glass box)
          var hk = cabMeta.handle; cabMeta.handle = null; // (no handle hanging where the closed door would be)
          addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, hiddenMat, hiddenMat, inter, cabMeta, selected, pickables); // the pick/drag box
          cabMeta.handle = hk;
          addOpenDoorTower(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, plinthMmW / 1000, carcassMat, frontMatOf(b));
        }
        else addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, applMat || carcassMat, applMat || frontMatOf(b), inter, cabMeta, selected, pickables);
        if (c.sink && state.hungUnits && state.bathMirror && !opts.people && !wall.island){ // the mirror cabinet asked for on the Efni page, over the sink
          var mx0 = offset, mx1 = offset + b.widthMm, mws = blockStartsMm(wall.wall || [], 0);
          var under = (wall.wall || []).some(function(wb, wi){ return mws[wi] < mx1 && mws[wi] + wb.widthMm > mx0; });
          if (!under) addMirrorCabinet(THREE, scene, g, offset / 1000, b.widthMm / 1000, Math.min(Math.max(1.15, hM + 0.42), (roomHeightMm - 760) / 1000), carcassMat);
        }
        if (applMdl) placeApplModel(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, applMdl);
        // a tall unit's side left bare above a lower neighbour (no room was left for its úthlið — owner, 2026-10-27: the laundry
        // tower's side read as a black slab): a 2 mm skin in the front material over the bare part, never ordered
        if (c.cls === "tall" && !c.panel && !opts.darkBg && !wall.island) [-1, 1].forEach(function(dir){
          var nb = wall.floor[bi + dir], nc = nb && CATALOG[nb.type];
          if (!nb || nc.panel) return;
          var touching = dir < 0 ? Math.abs(fStarts[bi - 1] + nb.widthMm - offset) < 3 : Math.abs(offset + b.widthMm - fStarts[bi + 1]) < 3;
          var nh = Math.min(nb.heightMm || nc.h, roomHeightMm) / 1000 + (nc.counter && stoneMat ? (stoneMat.userData.thick || 0.03) + 0.001 : 0);
          if (!touching || nh > hM - 0.05) return;
          var skinH = hM - nh, skin = new THREE.Mesh(new THREE.BoxGeometry(0.002, skinH, dM), frontMatOf(b)), along = (offset + (dir > 0 ? b.widthMm : 0)) / 1000 + dir * 0.0012;
          panelUV(skin.geometry, 0.002, skinH, dM, frontMatOf(b).userData && frontMatOf(b).userData.tile);
          skin.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
          skin.position.set(g.origin.x + g.axis.x * along + g.normal.x * dM / 2, nh + skinH / 2, g.origin.z + g.axis.z * along + g.normal.z * dM / 2);
          skin.castShadow = true; skin.receiveShadow = true; scene.add(skin);
        });
        if (c.thvo) addTowerMachines(THREE, scene, g, offset / 1000, b.widthMm / 1000, nicheTower ? towerNiche.base : plinthMmW / 1000 + CARCASS_T, nicheTower ? towerNiche.top : hM - CARCASS_T, dM, washerMat, !!b.single || (c.thvoSide && b.widthMm < 1000), !!c.thvoSide);
        // LED in a tall closet (user, 2026-10-23, C1): a vertical strip in a groove at the front edge of one side
        // (6×6 mm), or a strip under the top shelf (4×8 mm). Behind the doors — it shows in X-ray and with doors open.
        if (b.closetLed && c.cls === "tall" && !opts.people){
          var lf = ledFrame(THREE, scene, g, offset / 1000, b.widthMm / 1000), inW = b.widthMm / 1000 - 2 * CARCASS_T, bodyBot = plinthMmW / 1000 + CARCASS_T, bodyTop = hM - CARCASS_T;
          if (b.closetLed === "hlid"){
            var sx = (b.ledSide === "vinstri" ? -1 : 1) * (inW / 2 - 0.004), strip = ledStrip(THREE, scene, lf, sx, 0.006, (bodyBot + bodyTop) / 2, dM - 0.03);
            strip.scale.set(1, (bodyTop - bodyBot - 0.04) / 0.005, 0.6); // the 0.005 m box stood up the whole side
          } else {
            var shelfY = bodyTop - Math.min(0.35, (bodyTop - bodyBot) * 0.16);
            ledStrip(THREE, scene, lf, 0, inW - 0.02, shelfY - 0.004, dM - 0.04);
            ledGlow(THREE, scene, lf, 0, inW, dM - 0.03, 0.02, bodyBot + 0.001, 0.35);
          }
        }
      });
      wall.wall.forEach(function(b, bi){
        var offset = wStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        var elevM = elevOf(b) / 1000;
        var metaBase = { lockToId:b.lockTo && c.panel ? b.lockTo.id : null, locked:!!b.locked || !!opts.xray, suppressBadge:!!opts.xray, slabFronts:jeyOn, drawerSystem:state.drawerSystem, carcassKey:state.carcass, warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), ready:!!(opts.readyIds && opts.readyIds.indexOf(b.id) >= 0), doorLimit:DOOR_LIMITS[b.id] || null, shelfBlock:b, wallId:wall.id, zone:"wall", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d),
          heightMm:hM * 1000, elevMm:elevM * 1000, handle:state.handle, splitFr:c.open ? null : splitFractions(b, hM * 1000), alwaysDims:/^fataskapar(:|$)/.test(String(state.activeCategory || "")) };
        if (c.shelfStack){ // 1–5 boards of 38 mm above each other: one pickable box per board, all sharing the block id
          var n = Math.max(1, Math.min(SHELF_STACK_MAX, b.count || 3)), gap = b.vgapMm != null ? b.vgapMm : SHELF_GAP_DEFAULT;
          for (var k = 0; k < n; k++){
            addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, SHELF_T_MM / 1000, dM, elevM + k * (SHELF_T_MM + gap) / 1000, carcassMat, frontMatOf(b), null,
              Object.assign({}, metaBase, { panel:true, shelfBoard:true }), selected, pickables);
          }
          return;
        }
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, elevM, carcassMat, frontMatOf(b), null,
          Object.assign(metaBase, { open:!!c.open, panel:!!c.panel, openMat:c.open && b.frontAll ? frontOpenMat : openMat, hiddenMat:hiddenMat, shelves:c.open ? shelvesOf(b) : (c.shelfRange ? (shelvesOf(b) || 0) : 0) }), selected, pickables);
        if (c.panel || opts.people) return;
        var wf = null, ww = b.widthMm / 1000;
        // LED under the wall unit: a strip under its front edge, a glow on what's below (worktop / floor unit / floor)
        if (b.led != null ? b.led : b.mirrorFront ? !!LIGHT.mirror : LIGHT.underWall){ // a spegilskápur has its own "LED í spegilskáp"
          wf = ledFrame(THREE, scene, g, offset / 1000, ww);
          ledStrip(THREE, scene, wf, 0, ww - 0.04, elevM - 0.004, dM - 0.05);
          var mid = offset + b.widthMm / 2, under = wall.floor.find(function(fb, fi){ return fStarts[fi] <= mid && mid <= fStarts[fi] + fb.widthMm; });
          var uc = under && CATALOG[under.type], topY = under ? Math.min(under.heightMm || uc.h, roomHeightMm) / 1000 + (uc.counter ? 0.033 : 0.001) : 0.003;
          var reach = under ? Math.min(0.62, (under.depthMm || uc.d) / 1000 + 0.01) : 0.7;
          if (topY < elevM - 0.05) ledGlow(THREE, scene, wf, 0, ww * 1.1, 0.02, reach, topY + 0.001, 0.55);
          ledAreaLight(THREE, scene, wf, ww - 0.04, elevM - 0.008, dM - 0.05);
        }
        // LED strips in an open shelf unit (ATOM spots left out for now, 2026-10-05): one under the top and under
        // each shelf, along the front, lighting the shelf below it
        if (c.open && LIGHT.shelves){
          wf = wf || ledFrame(THREE, scene, g, offset / 1000, ww);
          var inner = ww - 2 * CARCASS_T, nShelf = shelvesOf(b) || 0;
          for (var sl = 0; sl <= nShelf; sl++){
            var under = sl === nShelf ? elevM + hM - CARCASS_T : elevM + hM * (sl + 1) / (nShelf + 1);  // underside of the board above this level
            var floorY = sl === 0 ? elevM + CARCASS_T : elevM + hM * sl / (nShelf + 1) + 0.009;      // the level it lights
            ledStrip(THREE, scene, wf, 0, inner - 0.02, under - 0.004, dM - 0.04);
            ledGlow(THREE, scene, wf, 0, inner, dM - 0.03, 0.02, floorY + 0.001, 0.6);
            ledAreaLight(THREE, scene, wf, inner - 0.02, under - 0.008, dM - 0.04);
          }
        }
      });
    });

    // Move-handles for islands: a flat puck on the floor just past each
    // island's start. Drag it to slide the whole island; tap it to select.
    if (opts.onSelect){
      (state.islands || []).forEach(function(isl){
        var hp = islandHandlePos(isl), sel = opts.selectedId === isl.id;
        var grp = new THREE.Group();
        var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32), new THREE.MeshStandardMaterial({ color:sel ? 0x3d61c1 : 0xf5c518, roughness:0.5 }));
        disc.position.set(hp.x, 0.02, hp.z);
        disc.userData = { islandId:isl.id, kind:"island", zone:"island", blockId:isl.id, wallId:isl.id + "a", widthMm:340, depthMm:340, selected:sel };
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color:0x2a2a2a }));
        ring.rotation.x = Math.PI / 2; ring.position.set(hp.x, 0.037, hp.z);
        grp.add(disc); grp.add(ring);
        scene.add(grp);
        pickables.push(disc);
      });
    }

    if (!opts.people && !iso) addDecorItems(THREE, scene, state, opts, pickables);

    // An empty wardrobe after "Ég raða sjálf/ur" (user, 2026-10-26): the brown area from the Mál step stands on its wall as
    // a see-through volume with a dashed outline and "+ Smelltu hér til að bæta við skáp" on it; a click on it opens Ný
    // eining for that wall (opts.onClosetSpanClick). Not a pickable — nothing drags it; onClickEmpty tests it.
    var spanMeshes = [];
    if (opts.closetEmptySpans && !iso && !opts.people) opts.closetEmptySpans.forEach(function(sp){
      var g = geoms[sp.wallIndex]; if (!g) return;
      var w = sp.mm / 1000, h = Math.min(sp.heightMm, roomHeightMm) / 1000, d = sp.depthMm / 1000, al = sp.startMm / 1000 + w / 2;
      var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      var cx = g.origin.x + g.axis.x * al + g.normal.x * (d / 2 + 0.003), cz = g.origin.z + g.axis.z * al + g.normal.z * (d / 2 + 0.003);
      var box = new THREE.Mesh(new THREE.BoxGeometry(w - 0.006, h, d), new THREE.MeshBasicMaterial({ color:0xc9a874, transparent:true, opacity:0.22, depthWrite:false }));
      box.position.set(cx, h / 2, cz); box.quaternion.copy(q); box.userData = { closetSpanWallId:sp.wallId };
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineDashedMaterial({ color:0x8a6a3c, dashSize:0.06, gapSize:0.04 }));
      edges.computeLineDistances(); edges.position.copy(box.position); edges.quaternion.copy(q);
      scene.add(box); scene.add(edges); spanMeshes.push(box);
      PENDING_LABELS.push({ p:{ x:g.origin.x + g.axis.x * al + g.normal.x * d, y:h * 0.55, z:g.origin.z + g.axis.z * al + g.normal.z * d }, text:__("+ Smelltu hér til að bæta við skáp") });
    });
    opts.__spanMeshes = spanMeshes;

    // the whole wardrobe's size (user, 2026-10-26): its total width above the units' own widths, one per wardrobe wall,
    // and its total height at its free end — same overlay style, on/off with "Málsetning"
    if (closetSc && !iso && !opts.people) (function(){
      var tallM = 0, hEnd = null, hungGapM = 0;
      // Bað / Þvottahús (owner, 2026-10-27): every dimension outside the units — the widths along the very top of the
      // wall, the heights as one clean chain (gap + unit) past the end of the run; no total stacked beside it
      var topDims = /^(bad|thvottahus)(:|$)/.test(String(state.activeCategory || ""));
      closetWallIdx.forEach(function(i){
        var wall = state.walls[i], g = geoms[i], st = blockStartsMm(wall.floor, cornerClearanceMm(state.walls, i, "floor")), lo = Infinity, hi = -Infinity, top = 0, dep = 0;
        wall.floor.forEach(function(b, bi){
          var c = CATALOG[b.type]; if (!c) return;
          lo = Math.min(lo, st[bi]); hi = Math.max(hi, st[bi] + b.widthMm);
          top = Math.max(top, Math.min(b.heightMm || c.h, roomHeightMm) / 1000); dep = Math.max(dep, (b.depthMm || c.d) / 1000);
        });
        if (!isFinite(lo)) return;
        tallM = Math.max(tallM, top);
        var hungW = !!state.hungUnits && !wall.island; // a wall-hung bath: its gap under the units (the box is lifted by it)
        if (hungW) hungGapM = Math.max(hungGapM, ((typeof wall.plinthMm === "number") ? wall.plinthMm : 200) / 1000);
        if (wall.floor.length > 1 || hungW){
          // clear of the unit (owner, 2026-10-27: it sat right on it) — over a bath's basin and tap too
          var o = g.origin, ax = g.axis, n = g.normal, y = top + (hungW ? 0.52 : 0.3);
          (wall.wall || []).forEach(function(wb){ var wc = CATALOG[wb.type]; if (!wc) return; y = Math.max(y, elevOf(wb) / 1000 + Math.min(wb.heightMm || wc.h, roomHeightMm) / 1000 + 0.14); }); // over a wall cabinet, never through it
          if (topDims) y = roomHeightMm / 1000 + 0.1; // above the wall itself
          var back = 0.02; // at the back, along the wall (owner, 2026-10-27): never in front of the unit while orbiting
          PENDING_DIMS.push({ a:{ x:o.x + ax.x * (lo / 1000) + n.x * back, y:y, z:o.z + ax.z * (lo / 1000) + n.z * back },
            b:{ x:o.x + ax.x * (hi / 1000) + n.x * back, y:y, z:o.z + ax.z * (hi / 1000) + n.z * back }, text:dimLen(hi - lo) });
        }
        if (!hEnd){ var oe = closetOuterEnd(i), off = topDims ? 0.16 : 0.24; hEnd = { g:g, at:oe ? hi / 1000 + off : lo / 1000 - off, at2:oe ? hi / 1000 + (topDims ? 0.16 : 0.1) : lo / 1000 - (topDims ? 0.16 : 0.1), dep:0.02 }; } // the heights at the back too
      });
      if (hEnd && tallM){
        var g = hEnd.g, px = g.origin.x + g.axis.x * hEnd.at + g.normal.x * hEnd.dep, pz = g.origin.z + g.axis.z * hEnd.at + g.normal.z * hEnd.dep;
        var chain = topDims && hungGapM > 0.01 && tallM > hungGapM;
        if (!chain) PENDING_DIMS.push({ a:{ x:px, y:0, z:pz }, b:{ x:px, y:tallM, z:pz }, text:dimLen(Math.round(tallM * 1000)) }); // outer: floor to the top
        if (hungGapM > 0.01 && tallM > hungGapM){ // inner, nearer the unit (owner, 2026-10-27): the gap under it + its own height, e.g. 20 + 60 = 80
          var px2 = g.origin.x + g.axis.x * hEnd.at2 + g.normal.x * hEnd.dep, pz2 = g.origin.z + g.axis.z * hEnd.at2 + g.normal.z * hEnd.dep;
          PENDING_DIMS.push({ a:{ x:px2, y:0, z:pz2 }, b:{ x:px2, y:hungGapM, z:pz2 }, text:dimLen(Math.round(hungGapM * 1000)) });
          PENDING_DIMS.push({ a:{ x:px2, y:hungGapM, z:pz2 }, b:{ x:px2, y:tallM, z:pz2 }, text:dimLen(Math.round((tallM - hungGapM) * 1000)) });
        }
      }
    })();

    // Soft daylight: sky/ground hemisphere fill + a warm key light with soft
    // shadows fitted to the room + a faint cool fill from the other side.
    var hemi = new THREE.HemisphereLight(0xffffff, 0xbdb4a4, 0.5);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xfff5e6, 1.0);
    dir.position.set(bbox.cx + 3.2, 5.5, bbox.cz + 4);
    dir.target.position.set(bbox.cx, 0.8, bbox.cz);
    var sunWin = !iso && !opts.people && geoms.closed ? sunWindow(state, geoms, isOpenGeom) : null;
    var dirBase = 1.0;
    if (sunWin){ // a low, warm sun outside the biggest window, slanting in across the room
      addSunShell(THREE, scene, state, geoms, WALL_H, isOpenGeom, bbox);
      var n = sunWin.g.normal, ax = sunWin.g.axis, elev = 0.52, skew = 0.45; // ~30° up, swung ~25° along the wall
      var dx = n.x + ax.x * skew, dz = n.z + ax.z * skew, dl = Math.hypot(dx, dz); dx /= dl; dz /= dl; // horizontal heading into the room
      var tgt = { x:sunWin.center.x + dx * 2.2, y:0, z:sunWin.center.z + dz * 2.2 };
      dir.target.position.set(tgt.x, tgt.y, tgt.z);
      dir.position.set(tgt.x - dx * 9 * Math.cos(elev), 9 * Math.sin(elev), tgt.z - dz * 9 * Math.cos(elev));
      dir.color.set(0xffe4bd); dirBase = 4.6;
      hemi.intensity = 0.62; // the shell blocks the sky light, so a little more fill
    }
    dir.intensity = dirBase;
    if (!sunWin){ // no window to shine through: the walls themselves cast, as before
      var wallMats = wallFades.map(function(w){ return w.mat; });
      scene.children.forEach(function(o){ if (o.isMesh && wallMats.indexOf(o.material) >= 0) o.castShadow = true; });
    }
    scene.add(dir.target);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    var SR = Math.max(bbox.w, bbox.d) * 0.75 + (sunWin ? 2.5 : 1);
    dir.shadow.camera.left = -SR; dir.shadow.camera.right = SR; dir.shadow.camera.top = SR; dir.shadow.camera.bottom = -SR;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = sunWin ? 24 : 18;
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.02; dir.shadow.radius = 3;
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.22);
    fill.position.set(bbox.cx - 3, 3, bbox.cz - 3);
    scene.add(fill);
    scene.userData.sceneLights = [{ light:hemi, base:hemi.intensity, mood:0.55 }, { light:dir, base:dirBase, mood:sunWin ? 0 : 0.12 }, { light:fill, base:0.22, mood:0.6 }]; // evening a bit brighter (2026-10-05); no sun at night
    scene.userData.hemi = hemi;
    scene.userData.noMood = !!(opts.clean || opts.people); // previews and the drawing export always show daylight
    applyMood(scene);

    // Wall-view (opts.focusWallId): bounds come from THIS wall's own units, not the room bbox — an
    // orthographic camera face-on, sized to fit them (elevationShot in kitchen-planner.html does the
    // same thing for the PDF export's X-ray elevations; this is the live, interactive equivalent).
    var focusBounds = null;
    if (focusWallId){
      var fsIdx = surfaces.findIndex(function(w){ return w.id === focusWallId; });
      if (fsIdx >= 0){
        var fg = allGeoms[fsIdx], fw = surfaces[fsIdx];
        var ffs = blockStartsMm(fw.floor, cornerClearanceMm(surfaces, fsIdx, "floor")), fws = blockStartsMm(fw.wall, 0);
        var funits = []; // for the dimension overlay: one entry per cabinet on this wall
        fw.floor.forEach(function(b, bi){
          var c = CATALOG[b.type], h = Math.min(b.heightMm || c.h, roomHeightMm) / 1000;
          funits.push({ a0:ffs[bi] / 1000, a1:(ffs[bi] + b.widthMm) / 1000, y0:0, y1:h, widthMm:b.widthMm, zone:"floor", plinth:!c.panel && !c.appliance, panel:!!c.panel });
        });
        fw.wall.forEach(function(b, bi){
          var c = CATALOG[b.type], h = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, y0 = elevOf(b) / 1000;
          funits.push({ a0:fws[bi] / 1000, a1:(fws[bi] + b.widthMm) / 1000, y0:y0, y1:y0 + h, widthMm:b.widthMm, zone:"wall", panel:!!CATALOG[b.type].panel });
        });
        var los = [0, fg.lenM].concat(funits.map(function(u){ return u.a0; }), funits.map(function(u){ return u.a1; }));
        var yhis = [0.1].concat(funits.map(function(u){ return u.y1; }));
        // a little extra left margin (was 0.35) — the height chain now draws two lines (total room height,
        // plus the plinth/carcass/ceiling-gap breakdown) instead of one, side by side
        var flo = Math.min.apply(null, los) - 0.46, fhi = Math.max.apply(null, los) + 0.35;
        var fyHi = Math.max.apply(null, yhis) + 0.35;
        focusBounds = { g:fg, lo:flo, hi:fhi, yLo:-0.45, yHi:Math.max(fyHi, roomHeightMm / 1000 + 0.35), units:funits, lenM:fg.lenM, roomHM:roomHeightMm / 1000 };
      }
    }

    var camera;
    if (focusBounds){
      var fb = focusBounds, fhw = (fb.hi - fb.lo) / 2, fhh = (fb.yHi - fb.yLo) / 2;
      camera = new THREE.OrthographicCamera(-fhw, fhw, fhh, -fhh, 0.05, 100);
      camera.userData.focusBounds = fb; // resize() refits this without distorting the elevation
      var fc = (fb.lo + fb.hi) / 2, fmid = (fb.yLo + fb.yHi) / 2;
      var fP = { x:fb.g.origin.x + fb.g.axis.x * fc, z:fb.g.origin.z + fb.g.axis.z * fc };
      camera.position.set(fP.x + fb.g.normal.x * 6, fmid, fP.z + fb.g.normal.z * 6);
      camera.lookAt(fP.x, fmid, fP.z);
    } else {
      camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    }
    var dist = Math.max(bbox.w, bbox.d) * (geoms.closed ? 0.95 : 0.74) + (geoms.closed ? 1.7 : 1.2);
    if (wardrobeScene) dist *= 1.1; // a full-height wardrobe: a little more room so its top isn't flush with the toolbar at 1280×720 (2026-10-26)
    if (!focusBounds) camera.position.set(bbox.cx + dist * 0.6, dist * 0.55, bbox.cz + dist * 0.9);
    // Baðherbergi (user, 2026-10-26): start facing the wall the units are on (a corner: both), at a person's height —
    // not the whole empty room from a top corner with a small vanity in the middle
    var bathAim = null, frontAz = null, frontSpan = 0;
    var unitWallRoom = /^(bad|fataskapar|thvottahus)(:|$)/.test(String(state.activeCategory || "")) && /^(bath|closet)/.test(state.shapeKey || ""); // (Allt rýmið orbits freely, like the kitchen)
    if (!focusBounds && !opts.people && unitWallRoom && !opts.darkBg){ // orbit stays in front of the unit wall(s) (round 2: it went behind the wall)
      var fIdx = (state.walls || []).map(function(w, i){ return i; }).filter(function(i){ var w = state.walls[i]; return geoms[i] && !w.open && ((w.floor || []).length || (w.wall || []).length); });
      if (!fIdx.length) fIdx = (state.walls || []).map(function(w, i){ return i; }).filter(function(i){ return geoms[i] && !state.walls[i].open; });
      if (fIdx.length && fIdx.length <= 2){
        var fnx = 0, fnz = 0; fIdx.forEach(function(i){ fnx += geoms[i].normal.x; fnz += geoms[i].normal.z; });
        if (Math.hypot(fnx, fnz) > 0.1){ frontAz = Math.atan2(fnx, fnz); frontSpan = fIdx.length > 1 ? 0.75 : 1.3; }
      }
    }
    var laundryAim = !opts.darkBg && /^thvottahus(:|$)/.test(String(state.activeCategory || "")) && /^bath/.test(state.shapeKey || ""); // a customer laundry (2026-10-26): its unit wall, like the bath
    // a customer bath too (owner, 2026-10-27): the whole unit wall floor to ceiling on entering Skipulag — the window was cut at the top, the vanity at the bottom
    var fullAim = laundryAim || (!opts.darkBg && /^bad(:|$)/.test(String(state.activeCategory || "")) && /^bath/.test(state.shapeKey || ""));
    if (!focusBounds && !opts.people && ((/^bad(:|$)/.test(String(state.activeCategory || "")) && state.hungUnits) || laundryAim)){
      var bIdx = (state.walls || []).map(function(w, i){ return i; }).filter(function(i){ var w = state.walls[i]; return geoms[i] && !w.open && ((w.floor || []).length || (w.wall || []).length); });
      if (!bIdx.length) bIdx = (state.walls || []).map(function(w, i){ return i; }).filter(function(i){ return geoms[i] && !state.walls[i].open; }).slice(0, 1);
      if (bIdx.length && bIdx.length <= 2){
        var bcx = 0, bcz = 0, bnx = 0, bnz = 0, bLen = 0;
        bIdx.forEach(function(i){ // frame the units on the wall (round 2: a 80 cm vanity was small in a 250 cm wall's view), else the wall; PRO (darkBg) always the whole wall (2026-10-26: the vanity filled the screen, bottom cut off)
          var g = geoms[i], w = state.walls[i], a0 = 0, a1 = g.lenM;
          var fs = blockStartsMm(w.floor || [], 0), ws = blockStartsMm(w.wall || [], 0), ext = [];
          (w.floor || []).forEach(function(b, k){ ext.push(fs[k], fs[k] + b.widthMm); }); (w.wall || []).forEach(function(b, k){ ext.push(ws[k], ws[k] + b.widthMm); });
          if (ext.length && !opts.darkBg && !fullAim){ a0 = Math.min.apply(null, ext) / 1000; a1 = Math.max.apply(null, ext) / 1000; var pad = Math.max(0, (1.4 - (a1 - a0)) / 2); a0 = Math.max(0, a0 - pad); a1 = Math.min(g.lenM, a1 + pad); }
          var am = (a0 + a1) / 2; bcx += g.origin.x + g.axis.x * am; bcz += g.origin.z + g.axis.z * am; bnx += g.normal.x; bnz += g.normal.z; bLen = Math.max(bLen, a1 - a0); });
        bcx /= bIdx.length; bcz /= bIdx.length; var bnl = Math.hypot(bnx, bnz) || 1; bnx /= bnl; bnz /= bnl;
        var bd = Math.max(2.3, bLen * 0.95 + 0.9) * (bIdx.length > 1 ? 1.2 : 1);
        if (fullAim){ // the whole unit wall, floor to ceiling, with a margin (round 2: the tower's top was clipped under the toolbar)
          var lAsp = (wrap && wrap.clientWidth && wrap.clientHeight) ? wrap.clientWidth / wrap.clientHeight : 1.6, lV = Math.tan(22.5 * Math.PI / 180);
          bd = Math.max((WALL_H + 0.7) / 2 / lV, (bLen + 0.8) / 2 / (lV * lAsp)) * (bIdx.length > 1 ? 1.1 : 1) + 0.3;
        }
        camera.position.set(bcx + bnx * bd + bnz * bd * 0.22, fullAim ? WALL_H * 0.55 : 1.3, bcz + bnz * bd - bnx * bd * 0.22); // low enough to see the floor under the hung units
        bathAim = { x:bcx + bnx * 0.3, y:fullAim ? WALL_H * 0.47 : 0.95, z:bcz + bnz * 0.3 };
      }
    }
    var people = opts.people && geoms.length ? addPeople(THREE, scene, geoms, WALL_H, roomHeightMm, state.walls, wallColor, state) : null;
    if (people){ // stand inside the room at eye height, facing the figures and their wall (wide lens so floor + ceiling fit)
      var pg = people.g, depth = Math.abs(pg.normal.x) > 0.5 ? bbox.w : bbox.d, back = Math.max(1.9, Math.min(4.2, depth - 0.7 - 0.25)); // keep the camera inside the room when it fits
      camera.fov = 70; camera.updateProjectionMatrix();
      camera.position.set(people.focus.x + pg.normal.x * back + pg.axis.x * 0.7, 1.45, people.focus.z + pg.normal.z * back + pg.axis.z * 0.7);
    }

    // One WebGL renderer (and one prefiltered environment map) for the whole
    // page session: every edit rebuilds the scene, and creating a renderer +
    // PMREM each time cost ~100 ms. teardown3D only detaches the canvas.
    var renderer = sharedRenderer;
    if (!renderer){
      renderer = sharedRenderer = new THREE.WebGLRenderer({ antialias:true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // GPU reset / tab backgrounded too long: drop the shared objects so the
      // next build makes fresh ones, and tell the page to rebuild now.
      renderer.domElement.addEventListener("webglcontextlost", function(e){
        e.preventDefault();
        sharedRenderer = null; sharedEnv = null;
        window.dispatchEvent(new Event("kp3d-context-lost"));
      });
    }
    applyToneMapping(THREE, renderer);
    wrap.appendChild(renderer.domElement);

    // "Veggur" view: an SVG overlay drawn on top of the canvas with IKEA-style chained dimensions
    // (per-cabinet width + one wall total + a height chain), projected live from the real 3D points —
    // elevationShot in kitchen-planner.html draws the same information once, offline, for the PDF export.
    // the shared dimension overlay (drawOverlay): always there, every scene
    if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    var ovSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ovSvg.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;");
    wrap.appendChild(ovSvg);
    OV = { svg:ovSvg, dims:PENDING_DIMS, labels:PENDING_LABELS, gaps:{}, last:"" }; PENDING_DIMS = []; PENDING_LABELS = [];
    var dimSvg = null, annoSvg = null;
    if (focusBounds){
      if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
      dimSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      dimSvg.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;");
      wrap.appendChild(dimSvg);
      annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      annoSvg.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;");
      wrap.appendChild(annoSvg);
    }

    // Subtle image-based lighting so steel, handles and the satin finish pick up
    // believable reflections; plus sharper textures at glancing angles.
    if (window.__RoomEnvironment__){
      if (!sharedEnv){
        var pmrem = new THREE.PMREMGenerator(renderer);
        sharedEnv = pmrem.fromScene(new window.__RoomEnvironment__(renderer), 0.04).texture;
        pmrem.dispose();
      }
      scene.environment = sharedEnv; scene.userData.env = sharedEnv;
    }
    updateMirrors(THREE, renderer, scene);
    var maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    scene.traverse(function(o){
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
        if (m.envMapIntensity !== undefined && !(m.userData && m.userData.envKeep)) m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.3;
        if (m.map) m.map.anisotropy = maxAniso;
        if (m.bumpMap) m.bumpMap.anisotropy = maxAniso;
      });
    });

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(bbox.cx, wardrobeScene ? Math.max(1.0, WALL_H * 0.5) : 1.0, bbox.cz); // a wardrobe reaches the ceiling — aim at its middle
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minPolarAngle = 0.15;
    controls.minDistance = 0.8;
    controls.maxDistance = dist * 3;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    if (people) controls.target.set(people.focus.x - people.g.normal.x * 0.6, WALL_H * 0.46, people.focus.z - people.g.normal.z * 0.6);
    if (bathAim) controls.target.set(bathAim.x, bathAim.y, bathAim.z);
    if (frontAz != null){ controls.minAzimuthAngle = frontAz - frontSpan; controls.maxAzimuthAngle = frontAz + frontSpan; controls.rotateSpeed = 0.45; }
    if (focusBounds){ // "Veggur" view: a fixed architectural elevation, not an orbit — only zoom
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.minZoom = 0.4; controls.maxZoom = 4;
      var fc2 = (focusBounds.lo + focusBounds.hi) / 2, fmid2 = (focusBounds.yLo + focusBounds.yHi) / 2;
      controls.target.set(focusBounds.g.origin.x + focusBounds.g.axis.x * fc2, fmid2, focusBounds.g.origin.z + focusBounds.g.axis.z * fc2);
    } else if (savedCameraState && !opts.freshCamera){
      camera.position.copy(savedCameraState.position);
      controls.target.copy(savedCameraState.target);
    }
    controls.update();

    var cleanupInteraction = setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, allGeoms, surfaces, opts, WALL_H);
    // Veggur view: screen ⇄ wall millimetres (ortho camera looking straight at the wall — see placeAnnotations)
    var annoV = new THREE.Vector3();
    function wallToScreen(xMm, yMm){
      if (!focusBounds) return null;
      var cr = renderer.domElement.getBoundingClientRect(), g = focusBounds.g;
      annoV.set(g.origin.x + g.axis.x * xMm / 1000, yMm / 1000, g.origin.z + g.axis.z * xMm / 1000).project(camera);
      return { x:cr.left + (annoV.x * 0.5 + 0.5) * cr.width, y:cr.top + (-annoV.y * 0.5 + 0.5) * cr.height };
    }
    function screenToWall(clientX, clientY){ // the camera looks straight at the wall, so screen ⇄ wall is a plain scale + offset per axis
      var s0 = wallToScreen(0, 0), s1 = wallToScreen(1000, 1000);
      if (!s0 || !s1 || s1.x === s0.x || s1.y === s0.y) return null;
      return { x:Math.round((clientX - s0.x) / (s1.x - s0.x) * 1000), y:Math.round((clientY - s0.y) / (s1.y - s0.y) * 1000) };
    }
    THREE_STATE = { renderer:renderer, camera:camera, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupInteraction:cleanupInteraction, wallToScreen:wallToScreen, screenToWall:screenToWall,
                    walls:surfaces, geoms:allGeoms, previewMesh:null, dragging:false, opts:opts, pickables:pickables, roomHM:WALL_H, wallHi:null, frontMat:frontMat };
    if (opts.selectedWallId) setSelectedWall3D(opts.selectedWallId);

    // Ganga um (user, 2026-10-23): first-person walk-through at eye height. Drag = look around, W/A/S/D or
    // arrows (or the wheel) = walk. You can't walk through walls, milliveggir or cabinets (footprints + 25 cm),
    // and it survives rebuilds (every edit rebuilds the scene) — WALK lives at module level.
    var walkPrev = null, walkKeys = {}, walkLook = null, walkLast = 0, walkBlocks = null, walkV = new THREE.Vector3();
    function walkBlocked(x, z){
      var HW = THREE_STATE && THREE_STATE.homeWalk; if (HW) return HW.blocked(x, z); // Allt heimilið: the whole home's rooms + doors
      var rb = interiorBounds(geoms, 4.2);
      if (x < rb.minX + 0.25 || x > rb.maxX - 0.25 || z < rb.minZ + 0.25 || z > rb.maxZ - 0.25) return true;
      if (geoms.closed){ // inside the outline
        var inside = false;
        geoms.forEach(function(g){ var ax = g.origin.x, az = g.origin.z, bx = ax + g.axis.x * g.lenM, bz = az + g.axis.z * g.lenM;
          if ((az > z) !== (bz > z) && x < ax + (z - az) * (bx - ax) / (bz - az)) inside = !inside; });
        if (!inside) return true;
      }
      for (var i = 0; i < allGeoms.length; i++){ // walls + island rows + milliveggir: keep 25 cm off every segment
        var g = allGeoms[i], dx = x - g.origin.x, dz = z - g.origin.z, t = Math.max(0, Math.min(g.lenM, dx * g.axis.x + dz * g.axis.z));
        if (Math.hypot(dx - g.axis.x * t, dz - g.axis.z * t) < 0.25) return true;
      }
      if (!walkBlocks){
        walkBlocks = [];
        pickables.forEach(function(m){ if (!m.userData.blockId) return; var b = new THREE.Box3().setFromObject(m); if (b.min.y < 0.5) walkBlocks.push(b); }); // only things standing on the floor
      }
      return walkBlocks.some(function(b){ return x > b.min.x - 0.25 && x < b.max.x + 0.25 && z > b.min.z - 0.25 && z < b.max.z + 0.25; });
    }
    function walkSpot(){ // start on the far side of the room from the cabinets, looking at all of them
      var rb = interiorBounds(geoms, 4.2), rc = { x:(rb.minX + rb.maxX) / 2, z:(rb.minZ + rb.maxZ) / 2 };
      walkBlocked(rc.x, rc.z); // fills walkBlocks (not in Allt heimilið, whose own check answers first)
      if (!walkBlocks){ walkBlocks = []; pickables.forEach(function(m){ if (!m.userData.blockId) return; var bb = new THREE.Box3().setFromObject(m); if (bb.min.y < 0.5) walkBlocks.push(bb); }); }
      var cab = new THREE.Box3(); walkBlocks.forEach(function(bx){ cab.union(bx); });
      var c = cab.isEmpty() ? rc : { x:(cab.min.x + cab.max.x) / 2, z:(cab.min.z + cab.max.z) / 2 };
      var dx = rc.x - c.x, dz = rc.z - c.z, L = Math.hypot(dx, dz);
      if (L < 0.2){ dx = camera.position.x - c.x; dz = camera.position.z - c.z; L = Math.hypot(dx, dz) || 1; }
      dx /= L; dz /= L;
      var best = null;
      for (var t = 0.6; t < 12; t += 0.1){ var x = c.x + dx * t, z = c.z + dz * t; if (!walkBlocked(x, z)) best = { x:x, z:z }; else if (best) break; }
      if (!best) for (var r = 0; r < 6 && !best; r += 0.2) for (var an = 0; an < 6.28; an += 0.4){ var x2 = rc.x + Math.cos(an) * r, z2 = rc.z + Math.sin(an) * r; if (!walkBlocked(x2, z2)){ best = { x:x2, z:z2 }; break; } }
      best = best || rc;
      best.yaw = Math.atan2(-(c.x - best.x), -(c.z - best.z));
      return best;
    }
    // "Veggur 1": stand ~2 m in front of each surface's floor cabinets, looking straight at them
    var walkJumpCache = null;
    function walkJumps(){
      if (walkJumpCache) return walkJumpCache;
      var bySurf = {};
      pickables.forEach(function(m){ var u = m.userData; if (!u || !u.blockId || u.zone !== "floor" || !u.wallId) return; (bySurf[u.wallId] = bySurf[u.wallId] || new THREE.Box3()).union(new THREE.Box3().setFromObject(m)); });
      walkJumpCache = [];
      surfaces.forEach(function(sf, i){
        var bx = bySurf[sf.id], g = allGeoms[i]; if (!bx || !g) return;
        var c = bx.getCenter(new THREE.Vector3()), n = g.normal, spot = null;
        [2.1, 1.7, 1.3, 2.6, 1.0].some(function(d){ var x = c.x + n.x * d, z = c.z + n.z * d; if (!walkBlocked(x, z)){ spot = { x:x, z:z }; return true; } return false; });
        if (spot) walkJumpCache.push({ label:sf.label || ("Veggur " + (i + 1)), x:spot.x, z:spot.z, yaw:Math.atan2(n.x, n.z) });
      });
      return walkJumpCache;
    }
    function walkApply(){
      camera.position.set(WALK.x, 1.6, WALK.z);
      camera.rotation.set(WALK.pitch, WALK.yaw, 0, "YXZ");
    }
    function walkStep(ts){
      var dt = Math.min(0.05, (ts - (walkLast || ts)) / 1000); walkLast = ts;
      var f = (walkKeys.w || walkKeys.arrowup ? 1 : 0) - (walkKeys.s || walkKeys.arrowdown ? 1 : 0), sd = (walkKeys.d ? 1 : 0) - (walkKeys.a ? 1 : 0);
      var turn = (walkKeys.arrowleft ? 1 : 0) - (walkKeys.arrowright ? 1 : 0);
      if (turn) WALK.yaw += turn * 1.6 * dt;
      if (f || sd){
        var sp = (walkKeys.shift ? 2.4 : 1.3) * dt, fx = -Math.sin(WALK.yaw), fz = -Math.cos(WALK.yaw);
        var nx = WALK.x + (fx * f + -fz * sd) * sp, nz = WALK.z + (fz * f + fx * sd) * sp;
        if (!walkBlocked(nx, nz)){ WALK.x = nx; WALK.z = nz; }
        else if (!walkBlocked(nx, WALK.z)) WALK.x = nx; // slide along whatever is in the way
        else if (!walkBlocked(WALK.x, nz)) WALK.z = nz;
      }
      walkApply();
    }
    function walkNudge(m){ // wheel: a step forward/back
      var nx = WALK.x - Math.sin(WALK.yaw) * m, nz = WALK.z - Math.cos(WALK.yaw) * m;
      if (!walkBlocked(nx, nz)){ WALK.x = nx; WALK.z = nz; }
    }
    // Mouse-look like a game (owner, 2026-10-27): a click in the view locks the pointer — moving the mouse turns the view,
    // no dragging; Esc gives the mouse back (the browser's own rule), Esc again or "Hætta" ends the walk. Touch keeps drag.
    var walkCanvas = renderer.domElement;
    function walkLocked(){ return document.pointerLockElement === walkCanvas; }
    // Doors, drawers, lift and pocket doors open with a click while walking (owner, 2026-10-27) — the editor builds the
    // cabinets in parts while walking (opts.xray from the page), so the same togglePart animation runs
    var walkRay = new THREE.Raycaster();
    function walkPartAt(cx, cy){
      var r = walkCanvas.getBoundingClientRect(), v = cx == null ? new THREE.Vector2(0, 0) : new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      walkRay.setFromCamera(v, camera); walkRay.far = 3.5; // within arm's reach-ish, not across the room
      var hit = walkRay.intersectObjects(pickables, false).find(function(h){ return h.object.visible !== false; });
      return hit && hit.object.userData && hit.object.userData.isPart && hit.object.userData.partKey ? hit.object.userData.partKey : null;
    }
    function walkOpenAtCentre(){ var k = walkPartAt(); if (k) togglePart(k); }
    function walkDown(e){
      if (!WALK.on || !wrap.contains(e.target) || e.target.closest("button,input,select,a,.kp-walk-hud")) return;
      e.stopPropagation(); e.preventDefault(); // nothing gets picked or dragged while walking
      if (walkLocked()){ walkOpenAtCentre(); return; } // looking with the mouse: a click opens / closes what's in the middle of the view
      if (e.pointerType !== "mouse"){ var hitT = walkPartAt(e.clientX, e.clientY); if (hitT){ togglePart(hitT); return; } } // touch: tap a door / drawer
      if (e.pointerType === "mouse" && walkCanvas.requestPointerLock){ try{ var pr = walkCanvas.requestPointerLock(); if (pr && pr.catch) pr.catch(function(){}); }catch(err){} return; }
      walkLook = { x:e.clientX, y:e.clientY, yaw:WALK.yaw, pitch:WALK.pitch };
    }
    function walkMove(e){
      if (WALK.on && walkLocked()){ // the locked mouse: right turns right, up looks up
        WALK.yaw -= (e.movementX || 0) * 0.0022;
        WALK.pitch = Math.max(-0.9, Math.min(0.7, WALK.pitch - (e.movementY || 0) * 0.0018));
        return;
      }
      if (!walkLook) return;
      WALK.yaw = walkLook.yaw + (e.clientX - walkLook.x) * 0.0045; // drag the world: right = turn left (like Street View)
      WALK.pitch = Math.max(-0.9, Math.min(0.7, walkLook.pitch + (e.clientY - walkLook.y) * 0.0035));
    }
    function walkUp(){ walkLook = null; }
    function walkKey(e){
      if (!WALK.on || /input|textarea|select/i.test((e.target && e.target.tagName) || "")) return;
      var k = e.key.toLowerCase();
      if (e.type === "keydown" && k === "escape"){ if (walkLocked()){ document.exitPointerLock(); return; } setWalk(false); if (opts.onWalkChange) opts.onWalkChange(false); return; }
      if (!/^(w|a|s|d|shift|arrow(up|down|left|right))$/.test(k)) return;
      walkKeys[k] = e.type === "keydown"; e.preventDefault();
    }
    function walkWheel(e){ if (!WALK.on || !wrap.contains(e.target)) return; e.preventDefault(); e.stopPropagation(); walkNudge(-Math.sign(e.deltaY) * 0.35); }
    function walkTip(){ return walkLocked() ? __("Hreyfðu músina til að líta í kring · smelltu á hurð eða skúffu til að opna · W A S D til að ganga · Esc sleppir músinni")
      : __("Smelltu í myndina og hreyfðu músina til að líta í kring · W A S D / örvar til að ganga"); }
    function walkLockChange(){
      var t = wrap.querySelector(".kp-walk-tip"); if (t) t.textContent = walkTip();
      var h = wrap.querySelector(".kp-walk-hud"); if (h) h.style.opacity = walkLocked() ? "0.82" : "1";
      wrap.style.cursor = WALK.on && !walkLocked() ? "pointer" : "";
      var dot = wrap.querySelector(".kp-walk-dot"); // the aim point while the mouse is locked: what a click opens
      if (WALK.on && walkLocked()){ if (!dot){ dot = document.createElement("div"); dot.className = "kp-walk-dot"; dot.style.cssText = "position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 1.5px rgba(0,0,0,.45);pointer-events:none;z-index:6"; wrap.appendChild(dot); } }
      else if (dot) dot.remove();
    }
    function walkHud(on){
      var h = wrap.querySelector(".kp-walk-hud");
      if (!on){ if (h) h.remove(); return; }
      if (h) return;
      h = document.createElement("div"); h.className = "kp-walk-hud";
      h.style.cssText = "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;display:flex;gap:8px;align-items:center;background:rgba(20,20,20,.72);color:#fff;font:500 12px/1.2 system-ui;padding:7px 10px;border-radius:999px;user-select:none";
      h.style.flexWrap = "wrap"; h.style.justifyContent = "center"; h.style.maxWidth = "min(92%, 720px)"; h.style.borderRadius = "18px";
      var pill = "all:unset;cursor:pointer;background:rgba(255,255,255,.16);color:#fff;border-radius:999px;padding:4px 10px;", arrow = "all:unset;cursor:pointer;background:#fff;color:#111;border-radius:8px;width:30px;height:28px;text-align:center;line-height:28px;font-size:14px;touch-action:none;";
      // hold-to-move arrows (touch screens and anyone without a keyboard, H6) + jump points: stand in front of each run
      h.innerHTML = '<span style="display:flex;gap:4px;">' +
        '<button type="button" data-wk="arrowleft" title="' + __("Snúa til vinstri") + '" style="' + arrow + '">⟲</button><button type="button" data-wk="w" title="' + __("Ganga áfram") + '" style="' + arrow + '">▲</button>' +
        '<button type="button" data-wk="s" title="' + __("Ganga aftur á bak") + '" style="' + arrow + '">▼</button><button type="button" data-wk="arrowright" title="' + __("Snúa til hægri") + '" style="' + arrow + '">⟳</button></span>' +
        '<span class="kp-walk-tip">' + walkTip() + '</span>' +
        walkJumps().map(function(j, i){ return '<button type="button" data-wj="' + i + '" style="' + pill + '">' + __(j.label) + '</button>'; }).join("") +
        '<button type="button" data-wq="1" style="all:unset;cursor:pointer;background:#fff;color:#111;border-radius:999px;padding:4px 10px;font-weight:600">' + __("Hætta (Esc)") + '</button>';
      h.querySelector("[data-wq]").addEventListener("click", function(){ setWalk(false); if (opts.onWalkChange) opts.onWalkChange(false); });
      h.querySelectorAll("[data-wk]").forEach(function(b){
        var k = b.dataset.wk, on = function(e){ e.preventDefault(); walkKeys[k] = true; }, off = function(){ walkKeys[k] = false; };
        b.addEventListener("pointerdown", on); ["pointerup", "pointerleave", "pointercancel"].forEach(function(ev){ b.addEventListener(ev, off); });
      });
      h.querySelectorAll("[data-wj]").forEach(function(b){ b.addEventListener("click", function(){ var j = walkJumps()[+b.dataset.wj]; if (!j) return; WALK.x = j.x; WALK.z = j.z; WALK.yaw = j.yaw; WALK.pitch = -0.12; walkApply(); }); });
      wrap.appendChild(h);
    }
    function setWalk(on){
      if (!camera.isPerspectiveCamera || focusBounds) on = false;
      if (on && !walkPrev){
        walkPrev = { pos:camera.position.clone(), target:controls.target.clone(), fov:camera.fov };
        if (!WALK.on || walkBlocked(WALK.x, WALK.z)){ var sp0 = walkSpot(); WALK.x = sp0.x; WALK.z = sp0.z; WALK.yaw = sp0.yaw; WALK.pitch = -0.08; }
        WALK.on = true; controls.enabled = false; camera.fov = 62; camera.updateProjectionMatrix(); walkApply();
      } else if (!on && WALK.on){
        WALK.on = false; walkKeys = {}; walkLook = null; controls.enabled = true; if (walkLocked()) document.exitPointerLock(); wrap.style.cursor = "";
        if (walkPrev){ camera.position.copy(walkPrev.pos); controls.target.copy(walkPrev.target); camera.fov = walkPrev.fov; camera.updateProjectionMatrix(); controls.update(); }
        walkPrev = null;
      }
      walkHud(WALK.on); walkLockChange();
      return WALK.on;
    }
    window.addEventListener("pointerdown", walkDown, true); window.addEventListener("pointermove", walkMove); window.addEventListener("pointerup", walkUp);
    window.addEventListener("keydown", walkKey); window.addEventListener("keyup", walkKey); wrap.addEventListener("wheel", walkWheel, { capture:true, passive:false });
    document.addEventListener("pointerlockchange", walkLockChange);
    THREE_STATE.setWalk = setWalk;
    THREE_STATE.walkCleanup = function(){
      window.removeEventListener("pointerdown", walkDown, true); window.removeEventListener("pointermove", walkMove); window.removeEventListener("pointerup", walkUp);
      window.removeEventListener("keydown", walkKey); window.removeEventListener("keyup", walkKey); wrap.removeEventListener("wheel", walkWheel, { capture:true });
      document.removeEventListener("pointerlockchange", walkLockChange); if (walkLocked()) document.exitPointerLock();
      walkHud(false);
    };
    THREE_STATE.walkStep = walkStep;
    THREE_STATE.walkOrbit = function(){ return walkPrev; };
    if (WALK.on){ WALK.on = false; setWalk(true); } // a rebuild while walking: keep walking from the same spot

    function resize(){
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      if (camera.isOrthographicCamera && camera.userData.focusBounds){
        // "contain"-fit the wall's content in the pane without distorting the elevation
        var fb2 = camera.userData.focusBounds, cw = (fb2.hi - fb2.lo) / 2, ch = (fb2.yHi - fb2.yLo) / 2, contAspect = w / h;
        if (contAspect > cw / ch){ camera.top = ch; camera.bottom = -ch; camera.left = -ch * contAspect; camera.right = ch * contAspect; }
        else { camera.left = -cw; camera.right = cw; camera.top = cw / contAspect; camera.bottom = -cw / contAspect; }
      } else if (!camera.isOrthographicCamera){
        camera.aspect = w / h;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (THREE_STATE && THREE_STATE.composer) THREE_STATE.composer.setSize(w, h);
      if (THREE_STATE && THREE_STATE.aoComposer) THREE_STATE.aoComposer.setSize(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    // Floating toolbar (opts.floatEl) pinned above the selected cabinet: its
    // top-centre is projected to screen every frame so it tracks orbiting.
    var floatBox = new THREE.Box3(), floatV = new THREE.Vector3();
    function placeFloatBar(){
      var el = opts.floatEl;
      if (!el) return;
      var mesh = opts.selectedId && !THREE_STATE.dragging ? pickables.find(function(m){ return m.userData.blockId === opts.selectedId; }) : null;
      if (!mesh || mesh.userData.kind === "island"){ el.hidden = true; return; }
      floatBox.setFromObject(mesh);
      var below = el.classList.contains("cl-sel"); // a wardrobe unit: under it, at the floor (its width tag is on top)
      floatV.set((floatBox.min.x + floatBox.max.x) / 2, below ? floatBox.min.y : floatBox.max.y, (floatBox.min.z + floatBox.max.z) / 2).project(camera);
      if (floatV.z > 1){ el.hidden = true; return; }
      var cr = renderer.domElement.getBoundingClientRect(), pr = el.offsetParent ? el.offsetParent.getBoundingClientRect() : cr;
      var x = cr.left - pr.left + (floatV.x * 0.5 + 0.5) * cr.width;
      var y = cr.top - pr.top + (-floatV.y * 0.5 + 0.5) * cr.height;
      el.style.left = Math.max(60, Math.min(pr.width - 60, x)) + "px";
      el.style.top = (below ? Math.min(pr.height - 48, y + 10) : Math.max(46, y - 10)) + "px";
      el.hidden = false;
    }

    // The side panel slides in OVER the right of the view (opts.coveredRight() = its width in px, 0 when closed):
    // shift the picture left (camera view offset — the camera itself stays put, so orbit/zoom are untouched) by half
    // the panel, more if the selected unit would still sit under it; glides back when the panel closes (user, 2026-10-26).
    // Worked out once per panel/selection change, not every frame, so orbiting afterwards isn't fought.
    var shift = { cur:0, target:0, key:"" }, shiftV = new THREE.Vector3();
    function panelShift(){
      var cov = 0; // the picture no longer slides aside when the side panel opens — the customer has already lined the view up (owner, 2026-10-27); was: opts.coveredRight()
      var cr = renderer.domElement.getBoundingClientRect(), W = cr.width, H = cr.height; if (!W || !H) return;
      var key = cov + "|" + (opts.selectedId || "");
      if (key !== shift.key){
        shift.key = key;
        var T = cov / 2;
        var mesh = cov && opts.selectedId ? pickables.find(function(m){ return m.userData.blockId === opts.selectedId; }) : null;
        if (mesh){
          floatBox.setFromObject(mesh);
          var lo = Infinity, hi = -Infinity;
          for (var i = 0; i < 8; i++){
            shiftV.set(i & 1 ? floatBox.max.x : floatBox.min.x, i & 2 ? floatBox.max.y : floatBox.min.y, i & 4 ? floatBox.max.z : floatBox.min.z).project(camera);
            var x = (shiftV.x * 0.5 + 0.5) * W + shift.cur; // screen x as if there were no shift
            lo = Math.min(lo, x); hi = Math.max(hi, x);
          }
          T = Math.min(Math.max(T, hi - (W - cov - 24)), lo - 24); // fully left of the panel; a unit wider than the room left keeps its left end in view
        }
        shift.target = Math.max(0, T);
      }
      shift.cur += (shift.target - shift.cur) * 0.2;
      if (Math.abs(shift.target - shift.cur) < 0.5) shift.cur = shift.target;
      if (shift.cur > 0.5) camera.setViewOffset(W, H, shift.cur, 0, W, H);
      else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    }

    // "Veggur" view's dimension chain — projected fresh every frame (cheap: at most ~a dozen ticks)
    // since zoom can still change the camera's framing even though rotate/pan are locked.
    var dimV = new THREE.Vector3();
    function dimTick(x0, y0, x1, y1, text, vertical, color){
      var t = 6;
      var s = '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="' + color + '" stroke-width="1.4"/>';
      [[x0, y0], [x1, y1]].forEach(function(p){
        s += '<line x1="' + (p[0] - (vertical ? t : 0)) + '" y1="' + (p[1] - (vertical ? 0 : t)) + '" x2="' + (p[0] + (vertical ? t : 0)) + '" y2="' + (p[1] + (vertical ? 0 : t)) + '" stroke="' + color + '" stroke-width="1.4"/>';
      });
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, narrow = !vertical && Math.abs(x1 - x0) < String(text).length * 7 + 8; // an úthlið's 19: above the chain, clear of its neighbours
      s += '<text x="' + mx + '" y="' + (my - (narrow ? 17 : 5)) + '" font-size="12" font-weight="600" fill="' + color + '" text-anchor="middle"' +
        (vertical ? ' transform="rotate(-90 ' + mx + ' ' + my + ')"' : '') + '>' + text + '</text>';
      return s;
    }
    function placeDims(){
      if (!dimSvg || !focusBounds) return;
      var cr = renderer.domElement.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      dimSvg.setAttribute("viewBox", "0 0 " + cr.width + " " + cr.height);
      var g = focusBounds.g, color = opts.darkBg ? "#cfd6e3" : "#3a3a3d";
      function P(a, y){ // a = along the wall (m), y = world height (m) — screen X/Y don't depend on normal offset for an ortho camera looking straight at the wall
        dimV.set(g.origin.x + g.axis.x * a, y, g.origin.z + g.axis.z * a).project(camera);
        return { x:(dimV.x * 0.5 + 0.5) * cr.width, y:(-dimV.y * 0.5 + 0.5) * cr.height };
      }
      var floorU = focusBounds.units.filter(function(u){ return u.zone === "floor"; });
      var wallU = focusBounds.units.filter(function(u){ return u.zone === "wall"; });
      var svg = "";
      // an úthlið is its own segment, labelled with its thickness in mm (owner, 2026-10-27: 60 | 19 | 60 adds up to
      // the real total) — "19 mm" for a customer, whose chain is otherwise in cm
      function segTxt(u){ return u.panel ? String(Math.round(u.widthMm)) : dimNum(u.widthMm); }
      floorU.forEach(function(u){
        var p0 = P(u.a0, -0.12), p1 = P(u.a1, -0.12);
        svg += dimTick(p0.x, p0.y, p1.x, p1.y, segTxt(u), false, color);
      });
      wallU.forEach(function(u){
        var p0 = P(u.a0, focusBounds.yHi - 0.22), p1 = P(u.a1, focusBounds.yHi - 0.22);
        svg += dimTick(p0.x, p0.y, p1.x, p1.y, segTxt(u), false, color);
      });
      // the wall's own full width/height, always shown (not just the cabinet run) — a bare wall still gets
      // dimensioned, same as the room's own wall-length label does on the 2D plan
      var p0w = P(0, -0.32), p1w = P(focusBounds.lenM, -0.32);
      svg += dimTick(p0w.x, p0w.y, p1w.x, p1w.y, dimLen(focusBounds.lenM * 1000), false, color);
      // Two height lines (2026-10-19, user): an outer one for the room's total floor-to-ceiling height, always
      // a single span; and an inner one, closer to the cabinets, chained through every real boundary — same
      // boundaries as before, plus a plinth/carcass split for each floor unit that actually sits on one (not an
      // appliance or panel) — so a single floor cabinet reads plinth · carcass · gap-to-ceiling, top to bottom.
      var p0r = P(focusBounds.lo + 0.08, 0), p1r = P(focusBounds.lo + 0.08, focusBounds.roomHM);
      svg += dimTick(p0r.x, p0r.y, p1r.x, p1r.y, dimLen(focusBounds.roomHM * 1000), true, color);
      var plinthSrc = fw.island || fw, plinthM = ((plinthSrc && typeof plinthSrc.plinthMm === "number") ? plinthSrc.plinthMm : 100) / 1000;
      var ys = [0, focusBounds.roomHM];
      floorU.forEach(function(u){ if (u.plinth) ys.push(Math.min(plinthM, u.y1)); ys.push(u.y1); });
      if (wallU.length){ ys.push(Math.min.apply(null, wallU.map(function(u){ return u.y0; }))); ys.push(Math.max.apply(null, wallU.map(function(u){ return u.y1; }))); }
      ys = ys.filter(function(y, i){ return ys.findIndex(function(z){ return Math.abs(z - y) < 0.005; }) === i; }).sort(function(a, b){ return a - b; });
      var hx = focusBounds.lo + 0.30;
      for (var k = 1; k < ys.length; k++){
        var ph0 = P(hx, ys[k - 1]), ph1 = P(hx, ys[k]);
        svg += dimTick(ph0.x, ph0.y, ph1.x, ph1.y, dimNum((ys[k] - ys[k - 1]) * 1000), true, color);
      }
      dimSvg.innerHTML = svg;
      placeAnnotations(P, cr);
    }
    // Veggur merkingar (2026-10-23): arrows / text boxes / symbols the designer puts on this wall's elevation.
    // Stored in wall millimetres (x = along the wall from its start, y = height above the floor) so they stay put
    // through zoom/resize and the drawing export can draw them too. The planner owns editing (opts.annotations()
    // returns this wall's list incl. a half-drawn one, opts.annoSelectedId() the selected id); this only draws.
    function placeAnnotations(P, cr){
      if (!annoSvg || !opts.annotations) return;
      var list = opts.annotations() || [], selId = opts.annoSelectedId ? opts.annoSelectedId() : null;
      var sig = JSON.stringify(list) + "|" + selId + "|" + cr.width + "x" + cr.height + "|" + camera.zoom + camera.left + camera.top;
      if (sig === annoSvg.__sig) return; // nothing moved: keep the DOM (a text box's own measuring is the slow part)
      annoSvg.__sig = sig;
      annoSvg.setAttribute("viewBox", "0 0 " + cr.width + " " + cr.height);
      var out = '<defs><marker id="kpAnnoHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + ANNO_COLOR + '"/></marker></defs>';
      function Q(pt){ return P(pt.x / 1000, pt.y / 1000); }
      list.forEach(function(an){
        var sel = an.id === selId, p = Q(an.a);
        if (an.kind === "arrow" && an.b){
          var q = Q(an.b);
          out += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="' + ANNO_COLOR + '" stroke-width="' + (sel ? 3.4 : 2.4) + '" stroke-linecap="round" marker-end="url(#kpAnnoHead)"/>';
          if (sel) [p, q].forEach(function(h){ out += '<circle cx="' + h.x + '" cy="' + h.y + '" r="5.5" fill="#fff" stroke="' + ANNO_COLOR + '" stroke-width="2"/>'; });
        } else if (an.kind === "text"){
          var lines = String(an.text || "").split("\n"), w = Math.max.apply(null, lines.map(function(l){ return l.length; })) * 7.1 + 18, h = lines.length * 16 + 10;
          out += '<g><rect x="' + p.x + '" y="' + (p.y - h / 2) + '" width="' + w + '" height="' + h + '" rx="6" fill="#fffdf6" fill-opacity=".96" stroke="' + ANNO_COLOR + '" stroke-width="' + (sel ? 2.4 : 1.4) + '"/>' +
            lines.map(function(l, i){ return '<text x="' + (p.x + 9) + '" y="' + (p.y - h / 2 + 18 + i * 16) + '" font-size="12.5" font-weight="600" fill="#2b2b2e">' + escSvg(l) + '</text>'; }).join("") + '</g>';
        } else if (an.kind === "symbol"){
          var sy = ANNO_SYMBOLS[an.sym] || ANNO_SYMBOLS.athuga;
          out += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (sel ? 14 : 12.5) + '" fill="' + ANNO_COLOR + '" stroke="#fff" stroke-width="2"/>' +
            '<text x="' + p.x + '" y="' + (p.y + 4.5) + '" font-size="13" text-anchor="middle" fill="#fff" font-weight="700">' + sy.glyph + '</text>' +
            (an.text ? '<text x="' + (p.x + 18) + '" y="' + (p.y + 4) + '" font-size="12" font-weight="600" fill="' + ANNO_COLOR + '" paint-order="stroke" stroke="#fff" stroke-width="3">' + escSvg(an.text) + '</text>' : "");
        }
      });
      annoSvg.innerHTML = out;
    }

    var wallVec = new THREE.Vector3();
    function fadeWalls(){
      // "V1" bubbles: drawn on top of everything (depthTest off), so a wall you're looking through would still
      // show its label floating over the room — hide it while the camera is on that wall's outer side
      wallLabels.forEach(function(l){
        if (THREE_STATE && THREE_STATE.homeWalk){ l.sp.visible = false; return; } // Allt heimilið: no V-labels floating through the other rooms
        var cp = (THREE_STATE.fadeCam || camera).position, lx = l.g.origin.x + l.g.axis.x * l.g.lenM / 2, lz = l.g.origin.z + l.g.axis.z * l.g.lenM / 2;
        var behind = (cp.x - lx) * l.g.normal.x + (cp.z - lz) * l.g.normal.z < 0;
        var m = l.sp.material; m.opacity += ((behind ? 0 : 1) - m.opacity) * 0.2;
        l.sp.visible = m.opacity > 0.02;
      });
      wallFades.forEach(function(w){
        var cx = w.geom.origin.x + w.geom.axis.x * w.geom.lenM / 2, cz = w.geom.origin.z + w.geom.axis.z * w.geom.lenM / 2;
        // camera on the outer side of this wall (opposite its room-facing normal)?
        var cp = (THREE_STATE.fadeCam || camera).position;
        wallVec.set(cp.x - cx, 0, cp.z - cz);
        var behind = wallVec.x * w.geom.normal.x + wallVec.z * w.geom.normal.z < (opts.fadeMargin || 0); // fadeMargin: the welcome kitchen starts fading a wall before the camera reaches its plane, so it is already gone when the camera sweeps past a corner (no flash)
        var target = behind ? (opts.clean ? 0 : 0.1) : 1; // export shots drop a wall in the way completely
        w.mat.opacity += (target - w.mat.opacity) * 0.2;
        w.mat.depthWrite = w.mat.opacity > 0.6;
        w.mesh.visible = w.mat.opacity > 0.02;
        var k = w.mat.opacity; // 1 = wall solid, 0.1 = faded (0 for export shots)
        w.openings.forEach(function(mats){
          mats.forEach(function(m){
            m.mat.opacity = m.mat.userData.baseOpacity * k;
            m.mat.depthWrite = k > 0.6 && m.mat.userData.baseDepthWrite;
            m.mesh.castShadow = m.shadow && k > 0.6;
          });
        });
      });
    }

    // Settle: the cabinet that just landed hops slightly and drops back.
    var landed = opts.landedId ? pickables.find(function(m){ return m.userData.blockId === opts.landedId; }) : null;
    var landedGroup = landed ? landed.parent : null, landedStart = performance.now();
    function settleLanded(){
      if (!landedGroup) return;
      var t = (performance.now() - landedStart) / 420;
      if (t >= 1){ landedGroup.position.y = 0; landedGroup = null; return; }
      landedGroup.position.y = 0.05 * Math.sin(Math.PI * t) * (1 - t);
    }

    // Cabinets seen from behind (camera on the wall side of their front plane) turn
    // see-through so they don't hide the room when planning around corners.
    var GHOST_OPACITY = 0.16;
    function ghostApply(gr, t){
      var c = gr.userData.cab;
      if (!c.items){
        if (t <= 0) return;
        c.items = [];
        gr.traverse(function(o){
          if (!o.isMesh) return;
          var cl = function(m){ if (m.visible === false) return m; var g = m.clone(); g.transparent = true; return g; };
          c.items.push({ o:o, orig:o.material, cast:o.castShadow, ghost:Array.isArray(o.material) ? o.material.map(cl) : cl(o.material) });
        });
      }
      // The dark outline (`edges`, EdgesGeometry sitting exactly on the box's own faces) stayed at full
      // opacity while the faces underneath faded to near-nothing — two coincident semi-transparent surfaces
      // with no stable draw order, which is what read as a flickering/speckled dark edge on a ghosted cabinet
      // seen from behind. Fading the outline down together with the faces removes the coincidence.
      var floor = c.hide ? 0 : GHOST_OPACITY; // end panels / áfellur go all the way to invisible
      if (c.edgesMat){ c.edgesMat.opacity = c.edgesBaseOpacity - (c.edgesBaseOpacity - floor) * t; c.edgesMat.depthWrite = t < 0.4; }
      c.items.forEach(function(it){
        (Array.isArray(it.ghost) ? it.ghost : [it.ghost]).forEach(function(m){ m.opacity = 1 - (1 - floor) * t; m.depthWrite = t < 0.4; });
        if (c.hide) it.o.visible = t < 0.97;
        it.o.material = t > 0.01 ? it.ghost : it.orig;
        it.o.castShadow = t > 0.01 ? false : it.cast; // a see-through cabinet casting a full shadow left blotchy shadow patterns on what's behind it
      });
    }
    function fadeCabinets(){
      (scene.userData.cabs || []).forEach(function(gr){
        var c = gr.userData.cab;
        var cp = (THREE_STATE.fadeCam || camera).position;
        var behind = cp.x * c.nx + cp.z * c.nz - c.d < -0.05;
        var want = behind && !opts.noGhost && !THREE_STATE.fadeCam && !THREE_STATE.dragging && (c.blockId == null || opts.selectedId !== c.blockId) ? 1 : 0; // export shots: never see-through
        if (c.t === want) return;
        c.t = Math.abs(want - c.t) < 0.01 ? want : c.t + (want - c.t) * 0.2;
        ghostApply(gr, c.t);
      });
    }

    // renderShot() settles the fades itself (synchronously) — rAF doesn't run in a background tab,
    // and a customer switching tabs mid-submit must not stall the drawing export.
    THREE_STATE.stepFades = function(){ fadeWalls(); fadeCabinets(); };
    renderer.setPixelRatio(qualityPixelRatio());
    // one frame: the evening bloom, or the still-view AO, or a straight render while things move
    function renderFrame(forceAO){
      if (MOOD_T > 0.02 && !scene.userData.noMood && window.__POST__){
        if (!THREE_STATE.composer){
          var P = window.__POST__, sz = renderer.getSize(new THREE.Vector2()), cmp = new P.EffectComposer(renderer);
          cmp.addPass(new P.RenderPass(scene, camera));
          cmp.addPass(new P.UnrealBloomPass(sz, 0.55, 0.45, 0.92));
          cmp.addPass(new P.OutputPass());
          THREE_STATE.composer = cmp;
        }
        THREE_STATE.composer.render();
        return;
      }
      // AO on every frame at quality 0 (2026-10-06): switching it off while the camera moved and back on when it
      // stopped made the shading pop in and out on every orbit. A slow machine drops to level 1 (no AO at all) instead.
      // AO only on high-density screens: on a 1× monitor its soft shading reads as fuzz (user, 2026-10-09)
      if (QUALITY.level === 0 && !opts.noAO && (window.devicePixelRatio || 1) >= 1.5){
        if (!THREE_STATE.aoComposer){ THREE_STATE.aoComposer = makeAOComposer(THREE, renderer, scene, camera); if (THREE_STATE.aoComposer){ var s2 = renderer.getSize(new THREE.Vector2()); THREE_STATE.aoComposer.setSize(s2.x, s2.y); } }
        if (THREE_STATE.aoComposer){ THREE_STATE.aoComposer.render(); return; }
      }
      renderer.render(scene, camera);
    }
    THREE_STATE.renderFrame = renderFrame;
    function loop(ts){
      THREE_STATE.rafId = requestAnimationFrame(loop);
      if (THREE_STATE.studio) return; // Studio mynd owns the renderer while it path-traces
      qualityTick(ts || performance.now(), renderer, resize);
      if (WALK.on) walkStep(ts || performance.now()); else controls.update();
      settleLanded();
      if (THREE_STATE.dragStep) THREE_STATE.dragStep();
      fadeWalls();
      fadeCabinets();
      stepParts(scene);
      stepMood(scene);
      if (people) people.people.forEach(function(m){ m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); });
      panelShift();
      renderFrame(false);
      placeFloatBar();
      placeDims();
      drawOverlay(camera, renderer.domElement);
      if (opts.afterFrame) opts.afterFrame(camera); // the caller's own overlays, drawn in the same frame (no lag/jiggle)
    }
    loop();
  }

  // ============================================================
  // Materials wizard: ONE 600 × 900 × 600 base cabinet you can spin around.
  // Each wizard page adds a level: carcass colour (open box) → drawer system
  // (drawer boxes inside) → front material (the cabinet closes) → handles →
  // worktop. cfg = {carcass, drawer, look, handle, top, showDrawers, showFronts,
  // showHandle, showTop}. Reuses addCabinetBox so it looks exactly like the room.
  // ============================================================
  var PREVIEW = null;

  function teardownCabinetPreview(){
    if (!PREVIEW) return;
    cancelAnimationFrame(PREVIEW.raf);
    window.removeEventListener("resize", PREVIEW.onResize);
    if (PREVIEW.ro) PREVIEW.ro.disconnect();
    if (PREVIEW.cleanupPick) PREVIEW.cleanupPick();
    PREVIEW.controls.dispose();
    disposeScene(PREVIEW.scene);
    if (PREVIEW.renderer.domElement.parentNode) PREVIEW.renderer.domElement.parentNode.removeChild(PREVIEW.renderer.domElement);
    PREVIEW = null;
  }

  // One drawer box (LEGRABOX: slim straight steel sides + back + the front
  // bracket; MERIVOBOX: L-profile sides with a flange at the bottom), built
  // with real Blum side heights. Local coordinates: bottom at y = 0, the
  // front edge at z = 0 and the box extending backwards (-z).
  // boxD = the depth there is for the drawer (m). The drawer (and its runners) take the longest Blum nominal
  // length that fits, 50 mm steps 270–650 — real size, all the way to the back of the carcass (user, 2026-10-11:
  // they were a fixed 500 and stopped well short of the back). The Blum side models are stretched to that length.
  // Drawers in a tall unit only go up to 1200 mm from the plinth; above that it's a hinged door (user, 2026-10-11)
  var TALL_DRAWER_MAX_MM = 1200;
  // The door above a drawer stack may shrink to absorb a typed drawer-front height, but never below this (user,
  // 2026-10-14 — "lama frontarnir lækka bara í staðinn"), same convention as the oven's OVEN_DOOR_MIN.
  var DRAWER_TOPDOOR_MIN_MM = 150;
  // The height a drawer stack with typed/dragged fronts has to fill (2026-10-26): a regular cabinet's drawers fill
  // its whole carcass, so a stack that comes up short is a gap to flag in Smíða; only a tall unit's stack follows the
  // drawn fronts (its door above takes the rest, never less than DRAWER_TOPDOOR_MIN_MM). Before, base units also
  // followed the drawn sum — "drawers don't fill the cabinet" could never fire, and a dragged seam left a silent gap.
  function drawerStackSpaceMm(cls, fullMm, frontsSumMm){
    if (cls !== "tall") return fullMm;
    return Math.max(0, Math.min(fullMm - DRAWER_TOPDOOR_MIN_MM, frontsSumMm));
  }
  // override = a persisted b.drawerZoneMm (Smíða/PRO only); clamped so the door above never drops under its min.
  function drawerZoneMm(c, bodyMm, override){
    if (!(c && c.cls === "tall")) return bodyMm;
    var def = Math.min(bodyMm, TALL_DRAWER_MAX_MM), v = +override;
    return v > 0 ? Math.max(0, Math.min(bodyMm - DRAWER_TOPDOOR_MIN_MM, v)) : def;
  }
  function drawerNominalM(boxD){ return Math.max(270, Math.min(650, Math.floor(((boxD || 0.562) * 1000 + 0.5) / 50) * 50)) / 1000; }
  // innerW (m, optional) = the carcass's inside width: the drawer is then made as wide as it takes for the runners
  // to sit right against the cabinet sides, as they're mounted (user, 2026-10-11 — they floated in from the sides)
  // an ordinary drawer unit's bins (b.bins): same rule as the planner's binsPossible — deep bottom drawer, 60/80 cm
  function binsWanted(b, c, sysKey){
    if (!b.bins || c.sink || c.rusl || !b.interior || b.interior.mode !== "skuffur") return false;
    var codes = drawerCodes(b.interior, sysKey), wf = Math.round((b.widthMm || 0) / 100) * 100;
    return (DRAWER_CODES[sysKey === "merivo" ? "merivo" : "legra"].side[codes[0]] || 0) >= 170 && (wf === 600 || wf === 800);
  }
  // the bins of a ruslaskápur / sink drawer (RUSL60: 2 × 17 l at the back + 2 × 8 l in front, RUSL80: 3 + 3) standing
  // on the bottom of the drawer box (front at z = 0, bottom at y = 0), as tall as the front lets them be
  function addBins(THREE, bx, frontH, widthMm){
    var p0 = bx.position.clone(); bx.position.set(0, 0, 0); bx.updateMatrixWorld(true);
    var bb = new THREE.Box3().setFromObject(bx); bx.position.copy(p0);
    var w = bb.max.x - bb.min.x - 0.05, d = bb.max.z - bb.min.z - 0.05, n = widthMm >= 750 ? 3 : 2;
    var tall = Math.max(0.12, Math.min(0.34, frontH - 0.07)), low = tall * 0.72, bw = w / n - 0.012;
    var body = new THREE.MeshStandardMaterial({ color:0x4b4e52, roughness:0.65, metalness:0.02 }), lid = new THREE.MeshStandardMaterial({ color:0x8e9196, roughness:0.45, metalness:0.05 });
    var x0 = (bb.min.x + bb.max.x) / 2, zBack = bb.min.z + 0.025 + d * 0.27, zFront = bb.min.z + 0.025 + d * 0.77;
    [[zBack, d * 0.54, tall], [zFront, d * 0.42, low]].forEach(function(row){
      for (var k = 0; k < n; k++){
        var x = x0 - w / 2 + (k + 0.5) * (w / n);
        var m = new THREE.Mesh(new THREE.BoxGeometry(bw, row[2], row[1] - 0.012), body); m.position.set(x, 0.02 + row[2] / 2, row[0]); m.castShadow = true; bx.add(m);
        var l = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.006, 0.012, row[1] - 0.006), lid); l.position.set(x, 0.02 + row[2] + 0.006, row[0]); bx.add(l);
      }
    });
  }
  function buildDrawerBox(THREE, sysKey, carcassKey, sideMm, boxW, boxD, code, innerW){
    var g = new THREE.Group();
    var dark = carcassKey === "dokkgra", nomD = drawerNominalM(boxD);
    if (code && nomD >= 0.45){
      var rs = realSides(sysKey, code, dark);
      if (rs){ // Blum's own side parts + a plain bottom and back between them
        var bwR = boxW || 0.5, inset = 0.02, sideH = 0.19, len = nomD;
        [["left", rs.left, rs.runLeft], ["right", rs.right, rs.runRight]].forEach(function(pr){
          var b = new THREE.Box3().setFromObject(pr[1]), holder = new THREE.Group(), wl = pr[1].userData.wall || { x0:b.min.x, x1:b.max.x };
          var k = nomD / Math.max(0.1, b.max.z - b.min.z); // stretched to the nominal length
          holder.add(pr[1]); holder.scale.z = k;
          holder.position.set(pr[0] === "left" ? -bwR / 2 - b.min.x : bwR / 2 - b.max.x, -b.min.y, -b.max.z * k); // outer edge at ±bw/2, bottom at 0, front at z = 0
          g.add(holder);
          if (pr[2]){ // the runner shares the side's frame (exact position relative to it) but is FIXED in the cabinet: callers add g.userData.runners to the cabinet, not to the sliding drawer
            var rh = new THREE.Group(); rh.position.copy(holder.position); rh.scale.z = k; rh.add(pr[2]);
            (g.userData.runners = g.userData.runners || new THREE.Group()).add(rh);
          }
          if (pr[0] === "left"){ inset = wl.x1 - b.min.x; sideH = b.max.y - b.min.y; }
        });
        if (innerW && g.userData.runners){ // push both sides (and their runners) out until the runners meet the carcass
          g.userData.runners.updateMatrixWorld(true);
          var rbx = new THREE.Box3().setFromObject(g.userData.runners), reach = Math.max(-rbx.min.x, rbx.max.x), grow = innerW / 2 - reach;
          if (Math.abs(grow) > 0.0005){
            g.children.forEach(function(h){ h.position.x += h.position.x < 0 ? -grow : grow; });
            g.userData.runners.children.forEach(function(h){ h.position.x += h.position.x < 0 ? -grow : grow; });
            bwR += 2 * grow;
          }
        }
        var boardY = (rs.e.boardMm || 17.6) / 1000, inner = bwR - 2 * inset + 0.004;
        // lightened a tone (user, 2026-10-13): the bottom/back board read as flat black at a glance,
        // for both drawer systems — still dark, just visibly dark grey instead.
        var bm = new THREE.MeshStandardMaterial({ color:dark ? 0x3c3d3a : 0xe4e2d6, roughness:0.5, metalness:0.05 });
        function pnl(w, h, d, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); }
        pnl(inner, 0.016, len - 0.02, 0, boardY + 0.008, -(len - 0.02) / 2 - 0.01);                                   // bottom
        var backH = sideH - boardY;                                                                                   // back: as tall as the sides
        pnl(inner, backH, 0.016, 0, boardY + backH / 2, -len + 0.008);
        return g;
      }
    }
    var mat = new THREE.MeshStandardMaterial({ color:dark ? 0x64676c : 0xf0efeb, metalness:dark ? 0.45 : 0.1, roughness:0.4 });
    var legra = sysKey !== "merivo", t = legra ? 0.0128 : 0.016, bw = innerW ? innerW - 0.026 : boxW || 0.5, bd = nomD, h = sideMm / 1000;
    function panel(w, hh, d, x, y, z){
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    panel(bw, t, bd, 0, t / 2, -bd / 2);                                   // bottom
    panel(t, h, bd, -bw / 2 + t / 2, h / 2, -bd / 2);                      // sides
    panel(t, h, bd, bw / 2 - t / 2, h / 2, -bd / 2);
    var bh = Math.min(h, 0.09);
    panel(bw, bh, t, 0, bh / 2, -bd + t / 2);                              // back panel
    if (!legra){
      panel(0.02, t, bd, -bw / 2 + t + 0.01, t * 1.5, -bd / 2);            // Merivo: L-shaped flange
      panel(0.02, t, bd, bw / 2 - t - 0.01, t * 1.5, -bd / 2);
    } else {
      panel(0.03, 0.04, 0.02, -bw / 2 + 0.03, h - 0.03, -0.01);            // Legra: front bracket
      panel(0.03, 0.04, 0.02, bw / 2 - 0.03, h - 0.03, -0.01);
    }
    return g;
  }

  var FRONT_T = 0.02;
  // a door's side edge sits 2 mm in from its slot (slab = width - 4 mm); an upright handle is moved in by that so it meets
  // the front exactly as it does on the top edge (user, 2026-10-26: Jey "1–2 mm nær frontinum"). A sunk-in handle (Vann)
  // stops 0.5 mm short of the front's back face, so the two never share a plane (that flickered).
  var SIDE_REVEAL_M = 0.002, EMBED_CLEAR_M = 0.0005;
  // Handle safety area (user, 2026-10-26: a 50 cm pull on a door above drawers reached down over the drawers — the
  // centre was kept 12 cm from the ends whatever the length): an upright pull stays HANDLE_SAFE_M inside its own
  // front at both ends, centred at hand height where it can, and is never longer than the front leaves room for.
  var HANDLE_SAFE_M = 0.05, HAND_HEIGHT_M = 1.05;
  var HIGH_DOOR_M = 1.2; // a door whose bottom edge is this high or more is reached from below: the handle goes on its bottom edge
  function uprightY(bottom, top, lenM){
    var lo = bottom + lenM / 2 + HANDLE_SAFE_M, hi = top - lenM / 2 - HANDLE_SAFE_M;
    return lo > hi ? (bottom + top) / 2 : Math.max(lo, Math.min(hi, HAND_HEIGHT_M));
  }   // fronts are 20 mm thick; the carcass is (depth - 20 mm)

  function setCabinetPreview(cfg){
    if (!PREVIEW) return;
    handleFinish = handleFinishFor(cfg.handle, cfg.handleColor);
    var THREE = window.__THREE__;
    if (PREVIEW.group){ PREVIEW.scene.remove(PREVIEW.group); disposeScene(PREVIEW.group); }
    var group = new THREE.Group();
    PREVIEW.group = group;
    var W = 0.6, H = 0.9, PL = 0.1, D = 0.6, CD = D - FRONT_T, T = 0.018, BODY = H - PL;
    var carc = cfg.carcass && CARCASS[cfg.carcass];
    var carcassMat = new THREE.MeshStandardMaterial({ color:carc ? carc.color3d : "#cdc8bd", roughness:0.9 });
    var look = cfg.look && LOOKS[cfg.look];
    var frontMat = look && window.KPMat ? makeFrontMaterial(THREE, cfg.look, look) : new THREE.MeshStandardMaterial({ color:look ? look.color3d : 0xd9d4ca, roughness:0.7 });
    function box(w, h, d, x, y, z, mat, tile){
      var geo = new THREE.BoxGeometry(w, h, d);
      if (tile) scaleFrontUV(geo, w, h, tile);
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m);
      return m;
    }
    // plinth (a hair shorter than the gap so nothing shares a plane) + carcass panels
    var plinthFront = !!(look && cfg.showFronts); // sökkull clad in the front material once the fronts are on
    var plDark = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 });
    box(W - 0.004, PL - 0.004, CD - 0.06, 0, (PL - 0.004) / 2, (CD - 0.06) / 2, plinthFront ? [plDark, plDark, plDark, plDark, frontMat, plDark] : plDark, plinthFront && frontMat.userData.tile);
    box(T, BODY, CD, -W / 2 + T / 2, PL + BODY / 2, CD / 2, carcassMat);                 // sides
    box(T, BODY, CD, W / 2 - T / 2, PL + BODY / 2, CD / 2, carcassMat);
    box(W - 2 * T, T, CD, 0, PL + T / 2, CD / 2, carcassMat);                              // bottom
    box(W - 2 * T, T, CD, 0, H - T / 2, CD / 2, carcassMat);                               // top
    box(W - 2 * T, BODY - 2 * T, 0.008, 0, PL + BODY / 2, 0.004, carcassMat);              // back
    if (cfg.showTop){
      var topMat = makeTopMaterial(THREE, cfg.top);
      var TTp = topMat.userData.thick || 0.03, topGeo = new THREE.BoxGeometry(W + 0.001, TTp, D + 0.02);
      scaleFrontUV(topGeo, W + 0.001, D + 0.02, topMat.userData && topMat.userData.tile, topMat.userData && topMat.userData.rotateTex); // over the top face (width × depth), not the thin edge
      var topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(0, H + 0.001 + TTp / 2, (D + 0.02) / 2); // 1 mm proud of the carcass top (z-fighting seen from inside) topMesh.castShadow = true; topMesh.receiveShadow = true;
      group.add(topMesh);
    }

    // drawers: front (20 mm) + handle + box move together
    var fractions = cfg.drawer ? drawerFractions(cfg.drawer, BODY * 1000) : [1 / 3, 2 / 3];
    var bounds = [0].concat(fractions).concat([1]);                                       // bottom → top
    var L = DRAWER_LAYOUT[cfg.drawer];
    var sides = L ? L.sides.slice().reverse() : [90, 130, 190];
    var showFronts = !!(cfg.showFronts && look), showBoxes = !!(cfg.showDrawers && cfg.drawer);
    var drawers = [], pickables = [];
    var geomFake = { origin:{ x:-W / 2, z:0 }, axis:{ x:1, z:0 }, normal:{ x:0, z:1 }, lenM:W };
    for (var i = 0; i < 3; i++){
      var dg = new THREE.Group();
      dg.userData.drawer = i;
      var y0 = PL + BODY * bounds[i] + (i === 0 ? 0.0015 : 0.0015), y1 = PL + BODY * bounds[i + 1] - (i === 2 ? 0.0015 : 0.0015), fh = y1 - y0;
      if (showFronts){
        var jcfgW = cfg.showHandle && cfg.handle && window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[cfg.handle], stripW = jcfgW && jcfgW.kind === "jey" ? (jcfgW.stripMm || 27) / 1000 : 0; // Jey takes its height off the front
        var notchW = jcfgW && jcfgW.kind === "hexxa" ? { len:Math.max(0.05, W - 0.004 - 2 * (jcfgW.marginMm || 50) / 1000), h:0.03 } : null;
        var slab = jcfgW && jcfgW.kind === "jey" && (jcfgW.profileMm || 0) > (jcfgW.stripMm || 27)
          ? frontSlabLip(THREE, W - 0.004, fh - stripW, frontMat, (jcfgW.profileMm - (jcfgW.stripMm || 27)) / 1000, 0.002, "top", { u:0, v:y0 })
          : frontSlab(THREE, W - 0.004, fh - stripW, frontMat, notchW, { u:0, v:y0 });
        slab.position.set(0, (y0 + y1) / 2 - stripW / 2, CD + FRONT_T / 2); slab.castShadow = true; slab.receiveShadow = true;
        dg.add(slab); pickables.push(slab);
        if (cfg.showHandle && cfg.handle){
          var tmp = new THREE.Group();
          addFrontDetails(THREE, tmp, geomFake, 0, W, fh, y0, D, { mode:"skuffur", count:1 }, cfg.handle, false, false, 0.55, { slab:true }, frontMat);
          tmp.children.slice().forEach(function(ch){ dg.add(ch); if (ch.isMesh) pickables.push(ch); });
        }
      }
      if (showBoxes){
        var real = L ? getModel("drawers", cfg.drawer + "_" + L.codes[2 - i]) : null, bx;
        if (real){ // real model: front edge at the front, top just under the drawer front's top
          var rb = new THREE.Box3().setFromObject(real), rs = rb.getSize(new THREE.Vector3());
          bx = new THREE.Group(); real.position.set(0, 0, -rb.max.z); bx.add(real);
          bx.position.set(0, drawerBoxY(y0, y1, rs.y), CD - 0.005);
        } else {
          bx = buildDrawerBox(THREE, cfg.drawer, cfg.carcass, sides[i], null, null, L ? L.codes[2 - i] : null, W - 2 * T);
          bx.position.set(0, drawerBoxY(y0, y1, sides[i] / 1000), CD - 0.005);
        }
        dg.add(bx);
        if (bx.userData && bx.userData.runners){ var rgW = bx.userData.runners; rgW.position.copy(bx.position); group.add(rgW); } // runners stay in the cabinet
        bx.traverse(function(o){ if (o.isMesh) pickables.push(o); });
      }
      pickables.forEach(function(m){ if (m.userData.drawer == null) m.userData.drawer = i; });
      group.add(dg);
      drawers.push(dg);
    }
    // keep each drawer's open/closed state across rebuilds (a pick shouldn't slam them shut)
    PREVIEW.drawers = drawers.map(function(g, i){
      var prev = PREVIEW.drawerState && PREVIEW.drawerState[i] || { target:0, cur:0 };
      g.position.z = 0.34 * prev.cur * prev.cur * (3 - 2 * prev.cur);
      return { group:g, target:prev.target, cur:prev.cur };
    });
    PREVIEW.pickables = showBoxes || showFronts ? pickables : [];
    PREVIEW.scene.add(group);
    var aniso = Math.min(8, PREVIEW.renderer.capabilities.getMaxAnisotropy());
    group.traverse(function(o){
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
        if (m.envMapIntensity !== undefined) m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.3;
        if (m.map) m.map.anisotropy = aniso;
      });
    });
  }

  var PREVIEW_SPIN_KEY = "bjorninn:kitchenPlanner:uwSpin"; // shared with the "＋ Ný eining" wizard's "Snúa" switch
  // the drawer page opens: one drawer slides half out and back, so it's clear they can be opened (2026-10-11)
  function previewPeek(i){
    if (!PREVIEW || !PREVIEW.drawers[i]) return;
    var d = PREVIEW.drawers[i]; if (d.target) return;
    d.target = 0.6; PREVIEW.drawerState[i] = d;
    setTimeout(function(){ var d2 = PREVIEW && PREVIEW.drawers[i]; if (d2 && d2.target === 0.6){ d2.target = 0; PREVIEW.drawerState[i] = d2; } }, 1100);
  }
  function previewSpinOn(){ try{ return localStorage.getItem(PREVIEW_SPIN_KEY) !== "0"; }catch(e){ return true; } }
  function setPreviewSpin(on){
    try{ localStorage.setItem(PREVIEW_SPIN_KEY, on ? "1" : "0"); }catch(e){}
    if (PREVIEW && PREVIEW.setSpin) PREVIEW.setSpin(on);
  }
  function buildCabinetPreview(wrap, cfg){
    var THREE = window.__THREE__, OrbitControls = window.__OrbitControls__;
    teardownCabinetPreview();
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1ea);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 64), new THREE.MeshStandardMaterial({ color:0xebe7dd, roughness:1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.3); floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb4a4, 0.55));
    var key = new THREE.DirectionalLight(0xfff5e6, 1.0);
    key.position.set(2.4, 3.6, 3.2); key.target.position.set(0, 0.4, 0.3);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6; key.shadow.camera.top = 1.6; key.shadow.camera.bottom = -1.6;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 12; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key); scene.add(key.target);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.25); fill.position.set(-2.5, 2, -1); scene.add(fill);

    var camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    camera.position.set(1.7, 1.45, 2.9);

    var renderer = sharedRenderer;
    if (!renderer){
      renderer = sharedRenderer = new THREE.WebGLRenderer({ antialias:true });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.addEventListener("webglcontextlost", function(e){
        e.preventDefault();
        sharedRenderer = null; sharedEnv = null;
        window.dispatchEvent(new Event("kp3d-context-lost"));
      });
    }
    renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%"; // the shared canvas may carry pixel sizes from the room view
    applyToneMapping(THREE, renderer);
    wrap.appendChild(renderer.domElement);
    if (window.__RoomEnvironment__){
      if (!sharedEnv){
        var pmrem = new THREE.PMREMGenerator(renderer);
        sharedEnv = pmrem.fromScene(new window.__RoomEnvironment__(renderer), 0.04).texture;
        pmrem.dispose();
      }
      scene.environment = sharedEnv;
    }
    var controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.45, 0.3);
    controls.enablePan = false;
    controls.minDistance = 1.6; controls.maxDistance = 5;
    controls.minPolarAngle = 0.25; controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.update();

    function resize(){
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h, false); // CSS (100% × 100%) sizes the canvas, so it can never stay at a stale pixel size
    }
    resize();
    window.addEventListener("resize", resize);
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrap);
    PREVIEW = { renderer:renderer, camera:camera, controls:controls, scene:scene, group:null, onResize:resize, raf:0, ro:ro, drawers:[], pickables:[], drawerState:[] };

    // click a drawer (front or box) to slide it out / push it back in
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), down = null, dom = renderer.domElement;
    function pick(evt){
      var r = dom.getBoundingClientRect();
      ndc.set(((evt.clientX - r.left) / r.width) * 2 - 1, -((evt.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hit = PREVIEW && PREVIEW.pickables.length ? ray.intersectObjects(PREVIEW.pickables, false)[0] : null;
      return hit ? hit.object.userData.drawer : null;
    }
    function onDown(e){ down = { x:e.clientX, y:e.clientY }; }
    function onUp(e){
      if (!down || !PREVIEW) return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
      down = null;
      if (moved) return;
      var i = pick(e);
      if (i == null || !PREVIEW.drawers[i]) return;
      var d = PREVIEW.drawers[i];
      d.target = d.target ? 0 : 1;
      PREVIEW.drawerState[i] = d;
    }
    function onMove(e){
      if (down || !PREVIEW) return;
      dom.style.cursor = pick(e) != null ? "pointer" : "grab";
    }
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointermove", onMove);
    // very slow spin so the cabinet is alive; it stops while you touch it and resumes a few seconds later
    // Sways at most 45° either side of the front and back again (user, 2026-10-11 — it used to turn all the way round),
    // and can be switched off (KP3D.setPreviewSpin, remembered with the unit wizard's "Snúa" switch).
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, resumeTimer = 0;
    var SWAY_P = Math.PI / 4, frontAz = controls.getAzimuthalAngle(), SPIN_SPEED = 0.55;
    controls.minAzimuthAngle = frontAz - SWAY_P; controls.maxAzimuthAngle = frontAz + SWAY_P;
    function spinWanted(){ return !reduceMotion && previewSpinOn(); }
    controls.autoRotate = spinWanted(); controls.autoRotateSpeed = SPIN_SPEED;
    function pauseSpin(){ controls.autoRotate = false; clearTimeout(resumeTimer); resumeTimer = setTimeout(function(){ if (PREVIEW && spinWanted()) controls.autoRotate = true; }, 5000); }
    PREVIEW.setSpin = function(on){ clearTimeout(resumeTimer); controls.autoRotate = on && !reduceMotion; };
    PREVIEW.sway = function(){ // autoRotateSpeed > 0 turns the camera towards smaller azimuth: reverse at each end
      var d = Math.atan2(Math.sin(controls.getAzimuthalAngle() - frontAz), Math.cos(controls.getAzimuthalAngle() - frontAz));
      if (d > SWAY_P - 0.03) controls.autoRotateSpeed = SPIN_SPEED; else if (d < -SWAY_P + 0.03) controls.autoRotateSpeed = -SPIN_SPEED;
    };
    dom.addEventListener("pointerdown", pauseSpin); dom.addEventListener("wheel", pauseSpin, { passive:true });
    PREVIEW.cleanupPick = function(){ clearTimeout(resumeTimer); dom.removeEventListener("pointerdown", pauseSpin); dom.removeEventListener("wheel", pauseSpin); dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointermove", onMove); dom.style.cursor = ""; };

    (function loop(){
      if (!PREVIEW) return;
      PREVIEW.raf = requestAnimationFrame(loop);
      PREVIEW.drawers.forEach(function(d){
        d.cur += (d.target - d.cur) * 0.14;
        if (Math.abs(d.target - d.cur) < 0.002) d.cur = d.target;
        d.group.position.z = 0.34 * d.cur * d.cur * (3 - 2 * d.cur);
      });
      PREVIEW.sway();
      controls.update();
      renderer.render(scene, camera);
    })();
    setCabinetPreview(cfg);
  }

  // ============================================================
  // 2D top-down plan (SVG) — reuses the exact same wall/offset math as the
  // 3D scene, just projected (drop Y, map world X/Z straight to SVG x/y).
  // Drawer seams aren't shown (they're a vertical/elevation feature, invisible
  // from directly above) — drawer cabinets get a small "· Nsk" width-label
  // suffix instead, so the count is still visible on the plan.
  // ============================================================

  var PX_PER_M = 80;

  // Phase 7d-3: exposes the exact same coordinate mapping buildPlan2D uses
  // internally, so a drag-and-drop drop handler in kitchen-planner.html can
  // convert a screen-pixel drop point into world mm and find the nearest
  // wall — without duplicating (and risking drift from) buildPlan2D's own
  // margin/scale math.
  function planTransform(state){
    var geoms = wallGeoms(state);
    if (!geoms.length) return null;
    var b = stateBounds(state, geoms);
    var margin = 1.3; // room for the dimension chains outside the walls however the room is reshaped (owner, 2026-10-27: dims were cut off; was 0.8)
    // geoms/surfaces include free-standing island rows and milliveggir after the real walls
    return { minX: b.minX - margin, minZ: b.minZ - margin, pxPerM: PX_PER_M, geoms: geoms.concat(islandGeoms(state)).concat(milliveggGeoms(state)), surfaces: surfacesOf(state) };
  }

  // Phase 8: shared corner math for a rectangle sitting on a wall (offset
  // along the wall, projecting `depthMm` into the room) — used by
  // buildPlan2D's own cabinet rendering AND by kitchen-planner.html's live
  // drag-preview overlay, so the preview shown while dragging is pixel-for-
  // pixel the same shape that actually gets drawn on drop, not an
  // approximation that could drift from it.
  function rectCornersWorld(g, offsetMm, widthMm, depthMm){
    var offsetM = offsetMm / 1000, widthM = widthMm / 1000, depthM = depthMm / 1000;
    var x0 = g.origin.x + g.axis.x * offsetM, z0 = g.origin.z + g.axis.z * offsetM;
    var corners = [0, widthM].map(function(along){
      return [0, depthM].map(function(out){
        return { x:x0 + g.axis.x * along + g.normal.x * out, z:z0 + g.axis.z * along + g.normal.z * out };
      });
    });
    return [corners[0][0], corners[1][0], corners[1][1], corners[0][1]];
  }

  // ---- Furniture & decor (2026-10-05): drawn from simple shapes, placed freely, never ordered ----
  // kind: "floor" stands on the floor, "top" sits on whatever worktop is under it, "ceiling" hangs from it.
  // ---- Hindranir (obstacles, 2026-10-11): fixed things in the room the kitchen must go round ----
  // state.obstacles = [{id, kind, wallId, offsetMm (from the wall's left corner), widthMm (along the wall), depthMm
  // (out into the room), heightMm (null = floor to ceiling), elevMm (bottom above the floor), outMm (gap to the wall,
  // free-standing column)}]. h:null = floor to ceiling; beam = hangs from the ceiling. `blocks` = cabinets can't
  // stand where it is at that height (openingSpans in the editor), vatn is only a marker.
  var OBSTACLES = {
    lagnastokkur:{ label:"Lagnastokkur",          w:200, d:200, h:null, elev:0,    blocks:true,  look:"wall" },
    stolpi:      { label:"Burðarstólpi",          w:300, d:300, h:null, elev:0,    blocks:true,  look:"wall", free:true, shapes:true },
    milliveggur: { label:"Milliveggur",           w:120, d:600, h:null, elev:0,    blocks:true,  look:"wall", free:true, rotatable:true }, // 120 mm thick by default (user, 2026-10-23)
    biti:        { label:"Biti í lofti",          w:2000, d:300, h:250, elev:null, blocks:true,  look:"wall", ceiling:true, free:true, rotatable:true }, // free + turnable (was: always along one wall, 2026-10-23)
    ofn:         { label:"Miðstöðvarofn",         w:1000, d:100, h:600, elev:150,  blocks:true,  look:"radiator" },
    // Bað (owner, 2026-10-27): where cabinets can't go — never ordered, only drawn and noted for the söluaðili
    handklaedaofn:{ label:"Handklæðaofn",         w:500, d:100, h:1200, elev:300,  blocks:true,  look:"radiator", rooms:["bad"] },
    sturta:      { label:"Sturta / baðkar",       w:900, d:900, h:2000, elev:0,    blocks:true,  look:"fixture", rooms:["bad"], model:"sturta" },
    klosett:     { label:"Klósett",               w:400, d:650, h:800, elev:0,     blocks:true,  look:"fixture", rooms:["bad"], model:"klosett" }, // a real wall-hung WC in 3D (owner, 2026-10-27)
    spegillVeggur:{ label:"Spegill",              w:600, d:20, h:800, elev:1100,   blocks:false, look:"mirror", rooms:["bad"] }, // a loose mirror on the wall — not ordered
    tafla:       { label:"Rafmagnstafla",         w:400, d:120, h:600,  elev:1400, blocks:true,  look:"panel" },
    vatn:        { label:"Vatnsinntak / niðurfall", w:150, d:60, h:150, elev:450,  blocks:false, look:"pipe", notRooms:["bad", "thvottahus"] }, // there the water is the droplet
    kista:       { label:"Gluggakista",           w:1300, d:200, h:40,  elev:960,  blocks:true,  look:"sill" }
  };
  // its height range above the floor (mm)
  function obstacleVSpan(state, o){
    var roomH = state.roomHeightMm || 2500, def = OBSTACLES[o.kind] || {};
    if (def.ceiling) return { lo:roomH - (o.heightMm || def.h), hi:roomH };
    if (o.heightMm == null) return { lo:0, hi:roomH };
    var lo = o.elevMm != null ? o.elevMm : def.elev || 0;
    return { lo:lo, hi:Math.min(roomH, lo + o.heightMm) };
  }
  // its footprint on the floor plan (m, world corners) — null when the wall isn't there
  // An obstacle's footprint in its anchor wall's frame (mm): along the wall [a0, a1], out into the room [n0, n1].
  // rot 90 (milliveggur / biti, 2026-10-23) = turned a quarter: widthMm then runs OUT from the wall and depthMm ALONG
  // it (a partition parallel to its wall, a beam across the room) — everything that needs the footprint reads it here.
  function obstacleRect(o){
    var def = OBSTACLES[o.kind] || {}, rot = o.rot === 90 && !!def.rotatable, off = o.offsetMm || 0, out = o.outMm || 0;
    return { a0:off, a1:off + (rot ? o.depthMm : o.widthMm), n0:out, n1:out + (rot ? o.widthMm : o.depthMm), rot:rot };
  }
  // a free column / milliveggur can also stand at any angle (user, 2026-10-24): o.ang degrees, turned about its own
  // centre in its wall's (along, out) frame, on top of the old quarter turn (o.rot). obstacleRect stays the unturned box.
  function obstacleAng(o){ var def = OBSTACLES[o.kind] || {}; return def.free && o.ang ? o.ang : 0; }
  function turnLocal(p, c, deg){ var t = deg * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t); return [c[0] + (p[0] - c[0]) * cs - (p[1] - c[1]) * sn, c[1] + (p[0] - c[0]) * sn + (p[1] - c[1]) * cs]; }
  function obstacleCorners(o){ // [[along, out] ×4] mm in its wall's frame
    var r = obstacleRect(o), c = [[r.a0, r.n0], [r.a1, r.n0], [r.a1, r.n1], [r.a0, r.n1]], ang = obstacleAng(o);
    if (!ang) return c;
    var mid = [(r.a0 + r.a1) / 2, (r.n0 + r.n1) / 2];
    return c.map(function(p){ return turnLocal(p, mid, ang); });
  }
  function obstacleQuad(state, o){
    var walls = wallGeoms(state), wi = state.walls.findIndex(function(w){ return w.id === o.wallId; }), g = walls[wi];
    if (!g || state.walls[wi].open) return null;
    return obstacleCorners(o).map(function(p){ var a = p[0] / 1000, n = p[1] / 1000; return { x:g.origin.x + g.axis.x * a + g.normal.x * n, z:g.origin.z + g.axis.z * a + g.normal.z * n }; });
  }
  var DECOR = {
    bordFer:    { label:"Borðstofuborð",            group:"floor", w:1600, d:900, seats:[4, 6, 8], seatsDefault:6 },
    bordHring:  { label:"Hringborð",                group:"floor", w:1100, d:1100, seats:[4, 6, 8], seatsDefault:4 },
    barstoll:   { label:"Barstóll",                 group:"floor", w:420, d:420 },
    planta:     { label:"Pottaplanta",              group:"floor", w:450, d:450 },
    motta:      { label:"Gólfmotta",                group:"floor", w:2000, d:1400 },
    kaffivel:   { label:"Kaffivél",                 group:"top",   w:300, d:380 },
    ketill:     { label:"Ketill",                   group:"top",   w:220, d:180 },
    skal:       { label:"Ávaxtaskál",               group:"top",   w:280, d:280 },
    plantaLitil:{ label:"Lítil planta",             group:"top",   w:160, d:160 },
    bretti:     { label:"Skurðarbretti",            group:"top",   w:450, d:300 },
    hengiljos:  { label:"Hengiljós",                group:"ceiling", w:320, d:320 },
    // a bedroom / walk-in closet (user, 2026-10-26): offered in Fataskápar instead of the kitchen props (rooms: the
    // room kinds an item is offered in; none = every room but a wardrobe's own list below)
    rum:        { label:"Rúm",                      group:"floor", w:1600, d:2000, rooms:["fataskapar"] },
    nattbord:   { label:"Náttborð",                 group:"floor", w:450, d:400, rooms:["fataskapar"] },
    spegill:    { label:"Standspegill",             group:"floor", w:500, d:80, rooms:["fataskapar"] },
    stoll:      { label:"Stóll",                    group:"floor", w:450, d:480, rooms:["fataskapar"] },
    // a bathroom (user, 2026-10-26): shower + bath to place the vanity around — props only, never ordered; no toilet
    sturta:     { label:"Sturta",                   group:"floor", w:900, d:900, rooms:["bad"] },
    badkar:     { label:"Baðkar",                   group:"floor", w:1700, d:700, rooms:["bad"] },
    // a laundry (user, 2026-10-26): props only, never ordered
    thvottakarfa:{ label:"Þvottakarfa",             group:"floor", w:450, d:350, rooms:["thvottahus"] },
    straubretti:{ label:"Straubretti",              group:"floor", w:1220, d:380, rooms:["thvottahus"] }
  };
  // which props a room kind offers: a wardrobe gets the bedroom ones + plant/rug/pendant; every other room the rest
  var DECOR_CLOSET = ["rum", "nattbord", "spegill", "stoll", "planta", "motta", "hengiljos"];
  var DECOR_BATH = ["sturta", "badkar", "planta", "motta"];
  var DECOR_LAUNDRY = ["thvottakarfa", "straubretti", "planta", "motta"];
  function decorKindsFor(category){
    var closet = /^fataskapar/.test(String(category || "")), bath = /^bad(:|$)/.test(String(category || ""));
    if (bath) return DECOR_BATH.slice(); // shower + bath first
    if (/^thvottahus(:|$)/.test(String(category || ""))) return DECOR_LAUNDRY.slice();
    return Object.keys(DECOR).filter(function(k){ return closet ? DECOR_CLOSET.indexOf(k) >= 0 : !DECOR[k].rooms; });
  }
  // Dining tables come in 4 / 6 / 8 seat sizes (d.seats, 2026-10-11): the table (m), where the chairs go, and the
  // footprint incl. the chairs (what may not go through a wall or a cabinet).
  var TABLE_SIZES = {
    bordFer:  { 4:{ w:1.2, d:0.8, xs:[-0.3, 0.3] }, 6:{ w:1.6, d:0.9, xs:[-0.5, 0, 0.5] }, 8:{ w:2.2, d:0.95, xs:[-0.825, -0.275, 0.275, 0.825] } },
    bordHring:{ 4:{ w:1.1, d:1.1, r:0.7, round:true }, 6:{ w:1.3, d:1.3, r:0.8, round:true }, 8:{ w:1.5, d:1.5, r:0.9, round:true } }
  };
  function tableOf(d){
    var T = TABLE_SIZES[d.kind]; if (!T) return null;
    var t = T[d.seats] || T[DECOR[d.kind].seatsDefault];
    return { w:t.w, d:t.d, xs:t.xs, r:t.r, round:!!t.round, top:0.76, seats:T[d.seats] ? d.seats : DECOR[d.kind].seatsDefault };
  }
  // the item's size on the floor (m): {w, d, round} — a table with its chairs, else DECOR_FOOT / its own size
  function decorFoot(d){
    var t = tableOf(d);
    if (t) return t.round ? { w:2 * (t.r + 0.22), d:2 * (t.r + 0.22), round:true } : { w:t.w + 0.15, d:t.d + 0.84 };
    var f = DECOR_FOOT[d.kind] || [(DECOR[d.kind].w || 300) / 1000, (DECOR[d.kind].d || 300) / 1000];
    return { w:f[0], d:f[1], round:d.kind === "barstoll" || d.kind === "planta" || d.kind === "hengiljos" };
  }
  // May a floor / ceiling item stand at (xMm, zMm)? Its whole footprint (rotated) inside the room, and not in a
  // cabinet or island (a rug only has to stay in the room; a pendant only by its cord). Worktop items: decorTopAt.
  function decorFits(state, d, xMm, zMm, rot){
    var def = DECOR[d.kind]; if (!def || def.group === "top") return true;
    var walls = wallGeoms(state), poly = walls.map(function(g){ return g.origin; });
    var closed = walls.closed && poly.length >= 3, x0 = xMm / 1000, z0 = zMm / 1000;
    if (def.group === "ceiling") return !closed || inPoly(x0, z0, poly);
    var f = decorFoot(d), a = (rot == null ? d.rot || 0 : rot) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    var pts = [], N = 8;
    for (var i = 0; i <= N; i++) for (var j = 0; j <= N; j++){
      var lx = (i / N - 0.5) * f.w, lz = (j / N - 0.5) * f.d;
      if (f.round && Math.hypot(lx / f.w, lz / f.d) > 0.5) continue;
      pts.push({ x:x0 + lx * ca + lz * sa, z:z0 - lx * sa + lz * ca });
    }
    if (closed && !pts.every(function(p){ return inPoly(p.x, p.z, poly); })) return false;
    if (d.kind === "motta") return true;
    var rects = floorRects(state).concat((state.obstacles || []).filter(function(o){ return OBSTACLES[o.kind] && obstacleVSpan(state, o).lo < 900; })
      .map(function(o){ return { q:obstacleQuad(state, o) }; }).filter(function(r){ return r.q; }));
    for (var r = 0; r < rects.length; r++){
      var q = rects[r].q, rq = q.slice().reverse();
      for (var k = 0; k < pts.length; k++) if (inPoly(pts[k].x, pts[k].z, q) || inPoly(pts[k].x, pts[k].z, rq)) return false;
      for (var m = 0; m < 4; m++){ // a thin cabinet / end panel between the sample points
        var lx2 = (q[m].x - x0) * ca - (q[m].z - z0) * sa, lz2 = (q[m].x - x0) * sa + (q[m].z - z0) * ca;
        if (f.round ? Math.hypot(lx2 / f.w, lz2 / f.d) < 0.5 : Math.abs(lx2) < f.w / 2 && Math.abs(lz2) < f.d / 2) return false;
      }
    }
    return true;
  }
  // An island may not stand through a wall, a wall's cabinets or a low obstacle (user, 2026-10-11). Its footprint:
  // along its axis the length, across it row A's depth (+20 mm worktop) in front of the centre line and row B's
  // depth (or the 19 mm back panel) behind it. (xMm, zMm) = a candidate centre.
  function islandFits(state, isl, xMm, zMm){
    var f = islandFrame(isl), L = isl.lengthMm / 1000;
    var depth = function(row){ return (row || []).reduce(function(m, b){ return Math.max(m, (b.depthMm || CATALOG[b.type].d) / 1000); }, 0); };
    var dA = depth(isl.a) + 0.02, dB = isl.two ? depth(isl.b) + 0.02 : (isl.back ? 0.019 : 0);
    var x0 = (xMm == null ? isl.xMm : xMm) / 1000, z0 = (zMm == null ? isl.zMm : zMm) / 1000, pts = [];
    for (var i = 0; i <= 10; i++) for (var j = 0; j <= 4; j++){
      var a = (i / 10 - 0.5) * L, n = -dB + (dA + dB) * j / 4;
      pts.push({ x:x0 + f.axis.x * a + f.normal.x * n, z:z0 + f.axis.z * a + f.normal.z * n });
    }
    var walls = wallGeoms(state), poly = walls.map(function(g){ return g.origin; });
    if (walls.closed && poly.length >= 3 && !pts.every(function(p){ return inPoly(p.x, p.z, poly); })) return false;
    var own = {}; (isl.a || []).concat(isl.b || []).forEach(function(b){ own[b.id] = 1; });
    var others = floorRects(state).filter(function(r){ return !own[r.b.id]; }).map(function(r){ return r.q; })
      .concat((state.obstacles || []).filter(function(o){ return OBSTACLES[o.kind] && OBSTACLES[o.kind].blocks && obstacleVSpan(state, o).lo < 900; }).map(function(o){ return obstacleQuad(state, o); }).filter(Boolean));
    return !others.some(function(q){ var rq = q.slice().reverse(); return pts.some(function(p){ return inPoly(p.x, p.z, q) || inPoly(p.x, p.z, rq); }); });
  }
  function nearestIslandFit(state, isl, xMm, zMm){
    if (islandFits(state, isl, xMm, zMm)) return { x:xMm, z:zMm };
    for (var r = 50; r <= 4000; r += 50){
      var n = Math.max(8, Math.round(r / 40));
      for (var k = 0; k < n; k++){
        var a = k / n * Math.PI * 2, px = Math.round((xMm + Math.cos(a) * r) / 10) * 10, pz = Math.round((zMm + Math.sin(a) * r) / 10) * 10;
        if (islandFits(state, isl, px, pz)) return { x:px, z:pz };
      }
    }
    return null;
  }
  // the nearest spot (mm) where it fits, searching outwards from (xMm, zMm); null = nowhere within 3 m
  function nearestDecorFit(state, d, xMm, zMm, rot){
    if (decorFits(state, d, xMm, zMm, rot)) return { x:xMm, z:zMm };
    for (var r = 50; r <= 3000; r += 50){
      var n = Math.max(8, Math.round(r / 40));
      for (var k = 0; k < n; k++){
        var a = k / n * Math.PI * 2, px = Math.round(xMm + Math.cos(a) * r), pz = Math.round(zMm + Math.sin(a) * r);
        if (decorFits(state, d, px, pz, rot)) return { x:px, z:pz };
      }
    }
    return null;
  }
  var DECOR_GROUPS = [{ key:"floor", label:"Á gólfið" }, { key:"top", label:"Á borðplötuna" }, { key:"ceiling", label:"Í loftið" }];
  // height of the worktop (or other top) under a point of the room, 0 = the floor
  function surfaceTopAt(state, xMm, zMm){
    var surf = surfacesOf(state), geoms = surfaceGeoms(state), x = xMm / 1000, z = zMm / 1000, top = 0;
    surf.forEach(function(w, wi){
      var g = geoms[wi]; if (!g || w.open) return;
      var starts = blockStartsMm(w.floor, cornerClearanceMm(surf, wi, "floor"));
      w.floor.forEach(function(b, i){
        var c = CATALOG[b.type], q = rectCornersWorld(g, starts[i], b.widthMm, b.depthMm || c.d);
        var inside = true;
        for (var k = 0; k < 4; k++){ var a = q[k], bb = q[(k + 1) % 4]; if ((bb.x - a.x) * (z - a.z) - (bb.z - a.z) * (x - a.x) < 0){ inside = false; break; } }
        var inside2 = true;
        for (var k2 = 0; k2 < 4; k2++){ var a2 = q[k2], b2 = q[(k2 + 1) % 4]; if ((b2.x - a2.x) * (z - a2.z) - (b2.z - a2.z) * (x - a2.x) > 0){ inside2 = false; break; } }
        if (inside || inside2) top = Math.max(top, Math.min(b.heightMm || c.h, state.roomHeightMm || 2500) / 1000 + (c.counter ? topThickM(state.top) + 0.001 : 0));
      });
    });
    return top;
  }
  // What a "top" decor item can stand on (2026-10-10): a worktop (a counter cabinet that isn't the sink) or a dining
  // table; m, 0 = nothing. And the nearest such spot to where it was dropped — it never lands on the floor.
  function decorTopAt(state, xMm, zMm, excludeId){
    var top = 0, x = xMm / 1000, z = zMm / 1000;
    floorRects(state).forEach(function(r){
      var c = CATALOG[r.b.type]; if (!c.counter || c.sink || c.panel) return;
      if (inPoly(x, z, r.q) || inPoly(x, z, r.q.slice().reverse())) top = Math.max(top, Math.min(r.b.heightMm || c.h, state.roomHeightMm || 2500) / 1000 + topThickM(state.top) + 0.001);
    });
    (state.decor || []).forEach(function(t){
      if (t.id === excludeId || !TABLE_SIZES[t.kind]) return;
      var T = tableOf(t), dx = x - t.xMm / 1000, dz = z - t.zMm / 1000, a = -(t.rot || 0) * Math.PI / 180;
      var lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      var on = T.round ? Math.hypot(lx, lz) < T.w / 2 - 0.06 : Math.abs(lx) < T.w / 2 - 0.06 && Math.abs(lz) < T.d / 2 - 0.06;
      if (on) top = Math.max(top, T.top);
    });
    return top;
  }
  function nearestTopSpot(state, xMm, zMm, excludeId){
    if (decorTopAt(state, xMm, zMm, excludeId) > 0) return { x:xMm, z:zMm };
    for (var r = 50; r <= 3000; r += 50){
      var n = Math.max(8, Math.round(r / 40));
      for (var k = 0; k < n; k++){
        var a = k / n * Math.PI * 2, px = Math.round(xMm + Math.cos(a) * r), pz = Math.round(zMm + Math.sin(a) * r);
        if (decorTopAt(state, px, pz, excludeId) > 0) return { x:px, z:pz };
      }
    }
    return null;
  }
  // Where a new decor item goes (2026-10-06): floor items take the most open spot (away from cabinets, islands,
  // walls and other furniture, then nearest the room centre); bar stools line up behind an island; a rug goes under
  // the dining table; worktop items take the next free spot along a counter (never on top of each other or in a
  // sink); a pendant hangs over the island / table. Returns {x, z} in mm, or null (top item but no counter).
  var DECOR_FOOT = { bordFer:[1.75, 1.85], bordHring:[1.6, 1.6], barstoll:[0.45, 0.45], planta:[0.5, 0.5], motta:[2.0, 1.4], hengiljos:[0.4, 0.4], rum:[1.65, 2.1], nattbord:[0.45, 0.4], spegill:[0.55, 0.25], stoll:[0.48, 0.5], sturta:[0.9, 0.9], badkar:[1.7, 0.7], thvottakarfa:[0.47, 0.37], straubretti:[1.25, 0.4] };
  function floorRects(state){ // every floor cabinet as a corner quad (m), walls and islands
    var surf = surfacesOf(state), geoms = surfaceGeoms(state), out = [];
    surf.forEach(function(w, wi){
      var g = geoms[wi]; if (!g || w.open) return;
      var starts = blockStartsMm(w.floor, cornerClearanceMm(surf, wi, "floor"));
      w.floor.forEach(function(b, i){ out.push({ q:rectCornersWorld(g, starts[i], b.widthMm, b.depthMm || CATALOG[b.type].d), b:b, g:g, start:starts[i] }); });
    });
    return out;
  }
  function distToSeg(px, pz, a, b){
    var vx = b.x - a.x, vz = b.z - a.z, t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
  }
  function inPoly(px, pz, pts){
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++){
      if (((pts[i].z > pz) !== (pts[j].z > pz)) && (px < (pts[j].x - pts[i].x) * (pz - pts[i].z) / (pts[j].z - pts[i].z) + pts[i].x)) inside = !inside;
    }
    return inside;
  }
  function decorSpot(state, kind){
    var def = DECOR[kind]; if (!def) return null;
    var decor = state.decor || [], rb = roomBounds(state); if (!rb) return null;
    var cx = (rb.minX + rb.maxX) / 2, cz = (rb.minZ + rb.maxZ) / 2;
    var rad = function(k, it){ var f = decorFoot(it || { kind:k }); return Math.hypot(f.w, f.d) / 2 * 0.78; };
    var table = decor.find(function(d){ return d.kind === "bordFer" || d.kind === "bordHring"; });
    if (def.group === "ceiling"){
      var isl = (state.islands || [])[0], n = decor.filter(function(d){ return d.kind === kind; }).length;
      var at = isl ? { x:isl.xMm / 1000, z:isl.zMm / 1000, ax:islandFrame(isl).axis, len:isl.lengthMm / 1000 } : table ? { x:table.xMm / 1000, z:table.zMm / 1000, ax:{ x:1, z:0 }, len:1.2 } : { x:cx, z:cz, ax:{ x:1, z:0 }, len:1 };
      var off = n ? ((n % 2 ? 1 : -1) * Math.ceil(n / 2) * Math.min(0.7, at.len / 3)) : 0;
      return { x:Math.round((at.x + at.ax.x * off) * 1000), z:Math.round((at.z + at.ax.z * off) * 1000) };
    }
    if (def.group === "top"){
      var tops = decor.filter(function(d){ return DECOR[d.kind] && DECOR[d.kind].group === "top"; });
      var me = Math.max(def.w, def.d) / 2000, best = null;
      floorRects(state).some(function(r){
        var c = CATALOG[r.b.type]; if (!c.counter || c.sink || c.panel) return false;
        var depth = (r.b.depthMm || c.d) / 1000, wM = r.b.widthMm / 1000;
        for (var t = me + 0.04; t <= wM - me - 0.04 + 1e-6; t += 0.05){
          var along = r.start / 1000 + t, out = Math.min(depth - me - 0.05, Math.max(me + 0.08, depth * 0.55));
          var p = { x:r.g.origin.x + r.g.axis.x * along + r.g.normal.x * out, z:r.g.origin.z + r.g.axis.z * along + r.g.normal.z * out };
          var free = tops.every(function(d){ return Math.hypot(d.xMm / 1000 - p.x, d.zMm / 1000 - p.z) > me + Math.max(DECOR[d.kind].w, DECOR[d.kind].d) / 2000 + 0.03; });
          if (free){ best = p; return true; }
        }
        return false;
      });
      return best ? { x:Math.round(best.x * 1000), z:Math.round(best.z * 1000) } : null;
    }
    if (kind === "motta" && table) return { x:table.xMm, z:table.zMm };
    if (kind === "barstoll" && (state.islands || []).length){
      var isl2 = state.islands[0], f2 = islandFrame(isl2), L2 = isl2.lengthMm / 1000, stools = decor.filter(function(d){ return d.kind === "barstoll"; });
      var backOut = isl2.two ? -(0.6 + 0.35) : -0.36; // behind a one-row island (its back), or past the B row
      for (var s = 0; s < 8; s++){
        var along2 = -L2 / 2 + 0.3 + s * 0.55; if (along2 > L2 / 2 - 0.2) break;
        var q = { x:isl2.xMm / 1000 + f2.axis.x * along2 + f2.normal.x * backOut, z:isl2.zMm / 1000 + f2.axis.z * along2 + f2.normal.z * backOut };
        if (stools.every(function(d){ return Math.hypot(d.xMm / 1000 - q.x, d.zMm / 1000 - q.z) > 0.4; })) return { x:Math.round(q.x * 1000), z:Math.round(q.z * 1000) };
      }
    }
    // the most open spot on the floor
    var walls = wallGeoms(state), poly = walls.map(function(g){ return g.origin; });
    var rects = floorRects(state), others = decor.filter(function(d){ return DECOR[d.kind] && DECOR[d.kind].group === "floor" && d.kind !== "motta"; });
    var myR = rad(kind), pick = null, pickScore = -1e9;
    for (var x = rb.minX + 0.2; x <= rb.maxX - 0.2; x += 0.1){
      for (var z = rb.minZ + 0.2; z <= rb.maxZ - 0.2; z += 0.1){
        if (walls.closed && poly.length >= 3 && !inPoly(x, z, poly)) continue;
        var clear = 9;
        walls.forEach(function(g, i){ if (!walls.closed && i === walls.length - 1) return; var e = { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM }; clear = Math.min(clear, distToSeg(x, z, g.origin, e)); });
        rects.forEach(function(r){ var q = r.q; if (inPoly(x, z, q)) clear = -1; else for (var k = 0; k < 4; k++) clear = Math.min(clear, distToSeg(x, z, q[k], q[(k + 1) % 4]) - (kind === "motta" ? 0 : 0.3)); });
        others.forEach(function(d){ clear = Math.min(clear, Math.hypot(d.xMm / 1000 - x, d.zMm / 1000 - z) - rad(d.kind, d) - 0.1); });
        clear -= myR;
        // no room anywhere (a big table in a small kitchen): the spot that overlaps least, never the island's middle
        var score = clear < 0 ? -10 + clear * 5 : Math.min(clear, 0.5) * 2 - Math.hypot(x - cx, z - cz) * 0.25;
        if (score > pickScore){ pickScore = score; pick = { x:x, z:z }; }
      }
    }
    if (!pick) pick = { x:cx, z:cz };
    return { x:Math.round(pick.x / 0.05) * 50, z:Math.round(pick.z / 0.05) * 50 };
  }
  // Furniture & decor models (rebuilt 2026-10-06 for realism): still procedural (no downloads, instant), but turned
  // profiles (LatheGeometry), rounded edges, real leaf shapes, wood grain and woven textures. Shared geometries and
  // textures are cached per page (DECOR_CACHE) so a rebuild of the scene costs next to nothing.
  var DECOR_CACHE = {};

  // ---- Render quality (2026-10-06 visual pass) ----
  // Filmic tone mapping on every scene; ambient occlusion (GTAOPass) only while the view is still, so orbiting and
  // dragging stay as fast as before; and a governor that steps quality down when frames get slow on a weak machine
  // (0 = AO + full pixel ratio, 1 = no AO, 2 = pixel ratio ≤ 1.5, 3 = pixel ratio 1) and back up when there's room.
  var QUALITY = { level:/[?&]q=low\b/.test(location.search) ? 3 : 0, ema:16, slowSince:0, fastSince:0, last:0 };
  function applyToneMapping(THREE, renderer){
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }
  function qualityPixelRatio(){ var d = window.devicePixelRatio || 1; return Math.min(d, QUALITY.level >= 3 ? 1 : QUALITY.level >= 2 ? 1.5 : 2); }
  function qualityTick(ts, renderer, onChange){
    if (document.visibilityState !== "visible"){ QUALITY.last = 0; return; }
    var dt = QUALITY.last ? ts - QUALITY.last : 16; QUALITY.last = ts;
    if (dt > 250) return; // tab was hidden / throttled — not a real frame time
    QUALITY.ema += (dt - QUALITY.ema) * 0.05;
    var now = ts;
    if (QUALITY.ema > 33){ QUALITY.fastSince = 0; QUALITY.slowSince = QUALITY.slowSince || now; }
    else if (QUALITY.ema < 12){ QUALITY.slowSince = 0; QUALITY.fastSince = QUALITY.fastSince || now; }
    else { QUALITY.slowSince = 0; QUALITY.fastSince = 0; }
    var lvl = QUALITY.level;
    if (QUALITY.slowSince && now - QUALITY.slowSince > 2000 && lvl < 3){ lvl++; QUALITY.slowSince = 0; QUALITY.ema = 20; }
    else if (QUALITY.fastSince && now - QUALITY.fastSince > 8000 && lvl > 0 && !/[?&]q=low\b/.test(location.search)){ lvl--; QUALITY.fastSince = 0; }
    if (lvl !== QUALITY.level){
      QUALITY.level = lvl;
      var pr = qualityPixelRatio();
      if (renderer.getPixelRatio() !== pr){ renderer.setPixelRatio(pr); if (onChange) onChange(); }
    }
  }
  // Ambient occlusion composer for the room view. Things that must not darken their surroundings — faded walls,
  // see-through cabinets, LED strips/glows, outlines, selection rings — are hidden for GTAO's own depth/normal pass.
  function makeAOComposer(THREE, renderer, scene, camera){
    var P = window.__POST__; if (!P || !P.GTAOPass) return null;
    // The composer's own buffers have no MSAA, so every edge lost its anti-aliasing while AO was on — a
    // multisampled render target keeps edges as sharp as a plain render.
    var sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    var rt = new THREE.WebGLRenderTarget(Math.max(1, sz.x * pr), Math.max(1, sz.y * pr), { type:THREE.HalfFloatType, samples:4 });
    var cmp = new P.EffectComposer(renderer, rt);
    cmp.addPass(new P.RenderPass(scene, camera));
    var ao = new P.GTAOPass(scene, camera, sz.x, sz.y);
    ao.updateGtaoMaterial({ radius:0.2, distanceExponent:1.2, thickness:0.25, scale:2.2, distanceFallOff:0.5, samples:16 }); // low thickness = no dark halos round things in front of a wall
    ao.updatePdMaterial({ lumaPhi:10, depthPhi:2, normalPhi:3, radius:12, rings:3, samples:24 });
    ao.blendIntensity = 1;
    var orig = ao.render.bind(ao);
    ao.render = function(r, w, rd, dt, m){
      var hidden = [];
      scene.traverse(function(o){
        if (!o.visible || !(o.isMesh || o.isLine || o.isLineSegments || o.isPoints || o.isSprite)) return;
        // judge only the materials that actually draw: a cabinet body with one invisible face (a sink's open top)
        // must still occlude, or the AO "sees" the basin straight through the front
        var ms = (Array.isArray(o.material) ? o.material : [o.material]).filter(function(mm){ return mm && mm.visible !== false; });
        var skip = !o.isMesh || !ms.length || ms.some(function(mm){ return mm.isMeshBasicMaterial || (mm.transparent && (mm.opacity < 0.95 || mm.blending !== THREE.NormalBlending)); });
        if (skip){ o.visible = false; hidden.push(o); }
      });
      orig(r, w, rd, dt, m);
      hidden.forEach(function(o){ o.visible = true; });
    };
    cmp.addPass(ao);
    cmp.addPass(new P.OutputPass());
    return cmp;
  }
  function decorTex(THREE, key, make, rx, ry, rot){
    var t = DECOR_CACHE["tex:" + key];
    if (!t){ t = new THREE.CanvasTexture(make()); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; DECOR_CACHE["tex:" + key] = t; }
    if (rx){ t = t.clone(); t.needsUpdate = true; t.repeat.set(rx, ry || rx); if (rot){ t.center.set(0.5, 0.5); t.rotation = rot; } }
    return t;
  }
  // Straight-grained oak for furniture: fine fibres and soft growth bands along v, built only from periodic
  // functions so the tile repeats with no seam (one tile ≈ 0.25 m across × 1 m along the grain).
  function oakCanvas(hex){
    var W = 512, H = 512, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d"), img = x.createImageData(W, H), d = img.data;
    var base = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)], TAU = Math.PI * 2;
    var fib = []; for (var i = 0; i < W; i++) fib.push(Math.random());
    for (var j = 0; j < H; j++) for (var i2 = 0; i2 < W; i2++){
      var u = i2 / W, v = j / H;
      var wob = 0.004 * Math.sin(TAU * (2 * v + 3 * u)) + 0.002 * Math.sin(TAU * 5 * v);
      var band = 0.5 + 0.5 * Math.sin(TAU * (7 * (u + wob)) + 1.7 * Math.sin(TAU * 2 * u));
      var band2 = 0.5 + 0.5 * Math.sin(TAU * (19 * (u + wob * 1.3)));
      var f = fib[i2] * 0.5 + fib[(i2 + 1) % W] * 0.25 + fib[(i2 + W - 1) % W] * 0.25;
      var l = 0.9 + 0.1 * band + 0.05 * band2 - 0.07 * Math.pow(f, 3) + 0.025 * Math.sin(TAU * 3 * v + u * 9);
      var k = (j * W + i2) * 4;
      d[k] = Math.min(255, base[0] * l); d[k + 1] = Math.min(255, base[1] * l * 0.99); d[k + 2] = Math.min(255, base[2] * l * 0.97); d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  // rx/ry = tiles across/along the face; the grain runs along v (rot = π/2 lays it along u)
  function decorWoodMat(THREE, hex, rx, ry, rough, rot){
    var map = decorTex(THREE, "oak" + hex, function(){ return oakCanvas(hex); }, rx || 1, ry || 1, rot);
    return new THREE.MeshStandardMaterial({ color:map ? 0xffffff : hex, map:map, roughness:rough == null ? 0.55 : rough, metalness:0 });
  }
  function rugCanvas(){ // woven wool: fine weft noise, a two-tone border and a soft herringbone body
    var S = 512, c = document.createElement("canvas"); c.width = c.height = S;
    var x = c.getContext("2d"), img = x.createImageData(S, S), d = img.data;
    for (var j = 0; j < S; j++) for (var i = 0; i < S; i++){
      var k = (j * S + i) * 4, b = Math.min(i, j, S - 1 - i, S - 1 - j);
      var base = b < 22 ? [92, 84, 74] : b < 34 ? [214, 205, 190] : [196, 186, 170];
      var weave = ((i >> 2) + (j >> 2)) % 2 ? 1.03 : 0.97, hb = (((i + (j % 16 < 8 ? j : -j)) >> 3) % 2) ? 1.02 : 0.98;
      var n = 0.94 + Math.random() * 0.12, f = weave * n * (b < 34 ? 1 : hb);
      d[k] = Math.min(255, base[0] * f); d[k + 1] = Math.min(255, base[1] * f); d[k + 2] = Math.min(255, base[2] * f); d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  function leafGeometry(THREE, len, wid, bend, notch){
    var key = "leaf" + [len, wid, bend, notch].join("_"), g = DECOR_CACHE[key];
    if (g) return g;
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(wid * 0.9, len * 0.12, wid * 1.05, len * 0.62, 0, len);
    s.bezierCurveTo(-wid * 1.05, len * 0.62, -wid * 0.9, len * 0.12, 0, 0);
    g = new THREE.ShapeGeometry(s, 10);
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++){ // cup across the width, arch along the length, a slight twist
      var X = p.getX(i), Y = p.getY(i), t = Y / len;
      var z = -Math.pow(X / wid, 2) * wid * 0.35 + Math.sin(t * Math.PI) * len * 0.06 - t * t * len * bend;
      if (notch && Math.abs(X) > wid * 0.45 && Math.sin(t * 18) > 0.6) z -= 0.004; // monstera-ish ribs
      p.setZ(i, z);
    }
    g.rotateX(-Math.PI / 2); g.computeVertexNormals();
    return (DECOR_CACHE[key] = g);
  }
  // A plant leaf (2026-10-28 overhaul): pointed oval, folded along the midrib, drooping along its length, with a
  // vertex-colour gradient (darker at the midrib and base, lighter at the edges). 7 × 9 grid ≈ 112 triangles, cached per size.
  function plantLeafGeometry(THREE, len, wid, bend){
    var key = "pleaf" + [len, wid, bend].join("_"), g = DECOR_CACHE[key];
    if (g) return g;
    var NC = 7, NR = 9, pos = [], col = [], idx = [], i, j;
    for (j = 0; j <= NR; j++){
      var t = j / NR, w = wid * Math.pow(Math.sin(Math.PI * Math.pow(Math.max(t, 0.001), 0.72)), 0.8) * (1 - 0.18 * t);
      for (i = 0; i <= NC; i++){
        var u = i / NC * 2 - 1, x = u * w, y = t * len;
        var z = Math.abs(u) * w * 0.22 - t * t * len * bend + Math.sin(u * 2.4) * 0.002 * len * t; // V fold at the midrib, droop, a faint ripple
        pos.push(x, y, z);
        var sh = 0.72 + 0.28 * Math.abs(u) + 0.08 * t - (Math.abs(u) < 0.14 ? 0.16 : 0); // paler towards the edge, a darker midrib line
        col.push(sh, sh, sh);
      }
    }
    for (j = 0; j < NR; j++) for (i = 0; i < NC; i++){ var a = j * (NC + 1) + i, b = a + 1, c = a + NC + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.rotateX(-Math.PI / 2); g.computeVertexNormals();
    return (DECOR_CACHE[key] = g);
  }
  function buildDecor(THREE, key, item){
    var gr = new THREE.Group(), RB = window.__RoundedBox__;
    function mat(c, r, m, extra){ return new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:r == null ? 0.6 : r, metalness:m || 0 }, extra || {})); }
    function add(o, parent){ o.castShadow = true; o.receiveShadow = true; (parent || gr).add(o); return o; }
    function rbox(w, h, d, r, x, y, z, m, parent){
      var geo = RB ? new RB(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
      var o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return add(o, parent);
    }
    function cyl(rt, rb, h, x, y, z, m, seg, parent){ var o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), m); o.position.set(x, y, z); return add(o, parent); }
    function lathe(pts, m, seg, x, y, z, parent){ var o = new THREE.Mesh(new THREE.LatheGeometry(pts.map(function(p){ return new THREE.Vector2(p[0], p[1]); }), seg || 40), m); o.position.set(x || 0, y || 0, z || 0); return add(o, parent); }
    function tube(pts, r, m, parent){ var o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(function(p){ return new THREE.Vector3(p[0], p[1], p[2]); })), 24, r, 8, false), m); return add(o, parent); }
    var dark = mat(0x26262a, 0.45, 0.2), steel = mat(0xc8ccd2, 0.22, 0.9), blackMetal = mat(0x1b1b1e, 0.35, 0.6);
    var oak = function(rx, ry, rot){ return decorWoodMat(THREE, "#b8936a", rx, ry, null, rot); };

    function chair(x, z, rot){ // oak dining chair: tapered legs, aprons, a curved back rail
      var c = new THREE.Group(), wood = oak(1.8, 0.6);
      [[-0.19, -0.18, 0.46], [0.19, -0.18, 0.46], [-0.19, 0.18, 0.86], [0.19, 0.18, 0.86]].forEach(function(p){
        var l = cyl(0.016, 0.012, p[2], p[0], p[2] / 2, p[1], wood, 12, c);
        if (p[1] > 0) l.rotation.x = -0.06;
      });
      rbox(0.44, 0.035, 0.42, 0.012, 0, 0.46, 0, wood, c);
      rbox(0.36, 0.05, 0.02, 0.006, 0, 0.41, -0.18, wood, c); rbox(0.36, 0.05, 0.02, 0.006, 0, 0.41, 0.18, wood, c);
      var rail = rbox(0.42, 0.075, 0.02, 0.008, 0, 0.8, 0.195, wood, c); rail.rotation.x = -0.06; // back rail between the rear legs
      rbox(0.36, 0.022, 0.018, 0.005, 0, 0.62, 0.19, wood, c);
      c.position.set(x, 0, z); c.rotation.y = rot; gr.add(c);
    }
    if (key === "bordFer"){
      var tf = tableOf(item || { kind:key }), hw = tf.w / 2 - 0.1, hd = tf.d / 2 - 0.09;
      rbox(tf.w, 0.032, tf.d, 0.01, 0, 0.744, 0, oak(3.6 * tf.w / 1.6, 1.6 * tf.d / 0.9)); // RoundedBox top: v runs along x, so the grain follows the length
      var lw = oak(0.3, 1);
      [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(function(p){ var l = cyl(0.026, 0.018, 0.73, p[0], 0.365, p[1], lw, 14); l.rotation.z = p[0] > 0 ? -0.03 : 0.03; });
      rbox(2 * hw - 0.04, 0.07, 0.022, 0.005, 0, 0.69, -hd, lw); rbox(2 * hw - 0.04, 0.07, 0.022, 0.005, 0, 0.69, hd, lw);
      rbox(0.022, 0.07, 2 * hd - 0.04, 0.005, -hw, 0.69, 0, lw); rbox(0.022, 0.07, 2 * hd - 0.04, 0.005, hw, 0.69, 0, lw);
      tf.xs.forEach(function(x){ chair(x, -(tf.d / 2 + 0.21), Math.PI); chair(x, tf.d / 2 + 0.21, 0); }); // the back rail is at the chair's +z: facing the table (they faced away, 2026-10-10)
    } else if (key === "bordHring"){
      var tr = tableOf(item || { kind:key }), R = tr.w / 2;
      lathe([[0, 0.725], [R - 0.02, 0.725], [R, 0.735], [R, 0.752], [R - 0.015, 0.76], [0, 0.76]], oak(R / 0.55, R / 0.55), 64);
      lathe([[0, 0], [0.26, 0], [0.27, 0.012], [0.12, 0.05], [0.055, 0.2], [0.045, 0.5], [0.09, 0.69], [0.2, 0.725], [0, 0.725]], mat(0xf0ede6, 0.4), 48);
      for (var ci = 0; ci < tr.seats; ci++){ var ca2 = ci * Math.PI * 2 / tr.seats + Math.PI / tr.seats; chair(Math.sin(ca2) * tr.r, Math.cos(ca2) * tr.r, ca2); }
    } else if (key === "barstoll"){
      var sw = oak(0.6, 0.7);
      // seat 10 cm lower than first drawn (user, 2026-10-10): ~65 cm, a counter stool for a 93 cm worktop
      lathe([[0, 0.62], [0.17, 0.62], [0.185, 0.63], [0.19, 0.655], [0.175, 0.665], [0.08, 0.652], [0, 0.65]], sw, 40);
      for (var li = 0; li < 4; li++){
        var a = li * Math.PI / 2 + Math.PI / 4, top = [Math.cos(a) * 0.1, 0.62, Math.sin(a) * 0.1], bot = [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2];
        tube([bot, [(bot[0] + top[0]) / 2, 0.31, (bot[2] + top[2]) / 2], top], 0.013, blackMetal);
      }
      var fr = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.008, 8, 36), blackMetal); fr.rotation.x = Math.PI / 2; fr.position.y = 0.22; add(fr);
    } else if (key === "planta" || key === "plantaLitil"){
      // 2026-10-28: a tapered stone-ceramic pot with a soft rim and a domed soil top, woody curved stems, many drooping
      // folded leaves in four greens (a fiddle-leaf fig); the small one is a leafy rosette in a glossy little pot.
      var big = key === "planta", sc = big ? 1 : 0.42;
      var potM = big ? mat(0xd8d2c6, 0.72) : mat(0xece7de, 0.3);
      lathe([[0, 0], [0.105, 0], [0.12, 0.012], [0.15, 0.14], [0.168, 0.28], [0.176, 0.3], [0.17, 0.318], [0.158, 0.318], [0.153, 0.3], [0.15, 0.285]].map(function(p){ return [p[0] * sc, p[1] * sc]; }), potM, 40);
      var h0 = 0.285 * sc; // soil level
      lathe([[0, 0.012], [0.146, 0], [0.15, -0.012], [0, -0.012]].map(function(p){ return [p[0] * sc, p[1] * sc]; }), mat(0x3b2d22, 1), 28, 0, h0 + 0.008 * sc, 0);
      var greens = [mat(0x2f5a2c, 0.5, 0, { vertexColors:true, side:THREE.DoubleSide }), mat(0x3b6a35, 0.5, 0, { vertexColors:true, side:THREE.DoubleSide }),
        mat(0x27492a, 0.5, 0, { vertexColors:true, side:THREE.DoubleSide }), mat(0x4a7a3d, 0.5, 0, { vertexColors:true, side:THREE.DoubleSide })];
      var stemM = mat(0x5a4533, 0.8);
      function leafAt(px, py, pz, ang, up, L, i){ // base at (px,py,pz), tip pointing out along ang, raised by `up`
        var lf = new THREE.Mesh(plantLeafGeometry(THREE, +L.toFixed(2), +(L * (big ? 0.42 : 0.36)).toFixed(3), big ? 0.35 : 0.3), greens[(i * 7 + (i >> 2)) % 4]);
        lf.position.set(px, py, pz); lf.rotation.order = "YXZ";
        lf.rotation.y = Math.atan2(-Math.cos(ang), -Math.sin(ang)); // the tip (-z) points out along (cos ang, sin ang)
        lf.rotation.x = up; lf.rotation.z = 0.3 * Math.sin(i * 2.3);
        lf.scale.setScalar(0.92 + 0.16 * Math.abs(Math.sin(i * 1.7)));
        add(lf);
      }
      if (big){
        var li2 = 0;
        [[0.0, 1.12, 0.3], [0.07, 0.92, 2.2], [0.06, 0.74, 4.3]].forEach(function(st){
          var lean = st[0], H = st[1], dir = st[2], top = [Math.cos(dir) * lean * 2.4, h0 + H, Math.sin(dir) * lean * 2.4];
          var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, h0 - 0.01, 0), new THREE.Vector3(top[0] * 0.25 - Math.sin(dir) * 0.012, h0 + H * 0.45, top[2] * 0.25 + Math.cos(dir) * 0.012), new THREE.Vector3(top[0], top[1], top[2])]);
          add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0095, 6, false), stemM));
          for (var t = 0.34; t <= 1.0001; t += 0.066){
            var pt = curve.getPoint(t), ang = li2 * 2.399 + dir, L = 0.3 - 0.12 * t;
            leafAt(pt.x, pt.y, pt.z, ang, 0.1 + t * 0.6, L, li2++);
          }
          leafAt(top[0], top[1], top[2], dir, 1.15, 0.12, li2++); // a young upright leaf at the tip
        });
      } else {
        for (var j = 0; j < 14; j++){
          var a2 = j * 2.399, L2 = 0.1 + 0.03 * Math.sin(j * 1.3) + (j < 5 ? 0.02 : 0);
          leafAt(Math.cos(a2) * 0.012, h0 + 0.01 + j * 0.003, Math.sin(a2) * 0.012, a2, 0.3 + 0.5 * (j % 5) / 4, L2, j);
        }
      }
    } else if (key === "motta"){
      var rugM = new THREE.MeshStandardMaterial({ map:decorTex(THREE, "rug", rugCanvas), roughness:0.98, metalness:0 });
      var rug = rbox(2.0, 0.01, 1.4, 0.004, 0, 0.005, 0, rugM); rug.castShadow = false;
    } else if (key === "kaffivel"){ // espresso machine: brushed steel body, group head, portafilter, drip tray, cups
      rbox(0.3, 0.34, 0.34, 0.02, 0, 0.17, -0.02, steel);
      rbox(0.26, 0.05, 0.3, 0.008, 0, 0.375, -0.03, blackMetal);
      rbox(0.28, 0.22, 0.01, 0.004, 0, 0.21, 0.152, mat(0x2b2b2f, 0.3, 0.4));
      cyl(0.04, 0.04, 0.04, 0, 0.24, 0.17, steel, 24);
      cyl(0.034, 0.03, 0.025, 0, 0.21, 0.175, steel, 24);
      var pf = rbox(0.022, 0.02, 0.14, 0.008, 0, 0.2, 0.25, blackMetal); pf.rotation.x = 0.1;
      rbox(0.26, 0.012, 0.11, 0.003, 0, 0.012, 0.21, steel);
      [-0.06, 0.06].forEach(function(cx){ lathe([[0, 0], [0.022, 0], [0.028, 0.055], [0.026, 0.055], [0.02, 0.004], [0, 0.004]], mat(0xf4f1ea, 0.3), 24, cx, 0.42, -0.05); });
      cyl(0.016, 0.016, 0.02, 0.1, 0.3, 0.16, blackMetal, 16).rotation.x = Math.PI / 2;
    } else if (key === "ketill"){ // turned kettle with a spout and a curved handle
      var km = mat(0xe9e6df, 0.35, 0.1);
      cyl(0.085, 0.09, 0.018, 0, 0.009, 0, dark, 32);
      lathe([[0, 0.018], [0.08, 0.018], [0.088, 0.05], [0.082, 0.15], [0.06, 0.2], [0.03, 0.21], [0, 0.21]], km, 40);
      cyl(0.006, 0.012, 0.02, 0, 0.222, 0, dark, 12);
      var sp = cyl(0.011, 0.02, 0.1, 0.105, 0.13, 0, km, 16); sp.rotation.z = -0.9;
      tube([[-0.07, 0.17, 0], [-0.13, 0.17, 0], [-0.14, 0.1, 0], [-0.085, 0.05, 0]], 0.011, dark);
    } else if (key === "skal"){ // stoneware bowl with fruit
      var bm = mat(0xe8e2d6, 0.5);
      lathe([[0, 0], [0.06, 0], [0.065, 0.006], [0.13, 0.07], [0.14, 0.085], [0.13, 0.086], [0.12, 0.075], [0.058, 0.014], [0, 0.014]], bm, 48);
      [[0xb3261e, -0.04, 0.05, 0.02, 0.038], [0xd9531e, 0.045, 0.055, -0.01, 0.04], [0x8fb339, 0.0, 0.06, -0.05, 0.036], [0xc0392b, 0.02, 0.09, 0.03, 0.035]].forEach(function(fd){
        var fr = new THREE.Mesh(new THREE.SphereGeometry(fd[4], 20, 14), mat(fd[0], 0.45, 0, { emissive:0x000000 })); fr.scale.y = 0.9; fr.position.set(fd[1], fd[2], fd[3]); add(fr);
        cyl(0.002, 0.002, 0.014, fd[1], fd[2] + fd[4] * 0.9, fd[3], mat(0x5a3d22, 0.9), 6);
      });
      tube([[-0.07, 0.07, -0.02], [-0.02, 0.1, -0.01], [0.05, 0.095, -0.03], [0.08, 0.08, -0.045]], 0.016, mat(0xf2d25a, 0.6));
    } else if (key === "bretti"){ // end-grain oak board with a handle hole, two lemons
      var sh = new THREE.Shape(), BW = 0.42, BD = 0.28, R = 0.03;
      sh.moveTo(-BW / 2 + R, -BD / 2); sh.lineTo(BW / 2 - R, -BD / 2); sh.quadraticCurveTo(BW / 2, -BD / 2, BW / 2, -BD / 2 + R); sh.lineTo(BW / 2, BD / 2 - R);
      sh.quadraticCurveTo(BW / 2, BD / 2, BW / 2 - R, BD / 2); sh.lineTo(-BW / 2 + R, BD / 2); sh.quadraticCurveTo(-BW / 2, BD / 2, -BW / 2, BD / 2 - R); sh.lineTo(-BW / 2, -BD / 2 + R); sh.quadraticCurveTo(-BW / 2, -BD / 2, -BW / 2 + R, -BD / 2);
      var hole = new THREE.Path(); hole.absellipse(-BW / 2 + 0.05, 0, 0.018, 0.035, 0, Math.PI * 2, false, 0); sh.holes.push(hole);
      var bg = new THREE.ExtrudeGeometry(sh, { depth:0.022, bevelEnabled:true, bevelThickness:0.003, bevelSize:0.003, bevelSegments:2 }); bg.rotateX(-Math.PI / 2);
      var board = new THREE.Mesh(bg, oak(1.5, 1.5)); board.position.y = 0.003; add(board);
      [[0.1, 0.06], [0.15, -0.04]].forEach(function(p){ var l = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 12), mat(0xf2d230, 0.5)); l.scale.set(1.25, 0.95, 0.95); l.position.set(p[0], 0.058, p[1]); add(l); });
    } else if (key === "rum"){ // a double bed: oak frame + headboard, mattress, duvet folded back, two pillows
      var linen = mat(0xf4f1ea, 0.85), duvet = mat(0xd9d3c7, 0.9);
      rbox(1.6, 0.26, 2.0, 0.02, 0, 0.17, 0, oak(1.5, 1.5));
      [[-0.75, -0.95], [0.75, -0.95], [-0.75, 0.95], [0.75, 0.95]].forEach(function(p){ rbox(0.06, 0.08, 0.06, 0.01, p[0], 0.04, p[1], dark); });
      rbox(1.64, 0.9, 0.06, 0.02, 0, 0.45, -1.01, oak(1.5, 1));
      rbox(1.52, 0.2, 1.92, 0.05, 0, 0.4, 0.01, linen);
      rbox(1.56, 0.07, 1.25, 0.03, 0, 0.53, 0.33, duvet);
      rbox(1.56, 0.06, 0.22, 0.03, 0, 0.58, -0.22, duvet);
      [-0.38, 0.38].forEach(function(x){ rbox(0.6, 0.12, 0.38, 0.06, x, 0.56, -0.72, linen); });
    } else if (key === "nattbord"){ // oak bedside table with a drawer and a small lamp
      rbox(0.45, 0.48, 0.4, 0.012, 0, 0.26, 0, oak(1, 1));
      [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.17], [0.2, 0.17]].forEach(function(p){ cyl(0.012, 0.012, 0.04, p[0], 0.02, p[1], dark, 10); });
      rbox(0.41, 0.15, 0.01, 0.004, 0, 0.38, 0.201, oak(1, 0.5));
      rbox(0.12, 0.012, 0.012, 0.004, 0, 0.38, 0.212, blackMetal);
      lathe([[0, 0], [0.06, 0], [0.06, 0.012], [0.015, 0.02], [0.012, 0.2], [0, 0.2]], mat(0xe8e2d6, 0.5), 32, -0.08, 0.5, -0.04);
      lathe([[0, 0], [0.1, 0], [0.07, 0.13], [0, 0.13]], mat(0xf2ede2, 0.7, 0, { side:THREE.DoubleSide, emissive:0x000000 }), 32, -0.08, 0.66, -0.04);
    } else if (key === "spegill"){ // a full-length mirror leaning on its stand
      var mf = new THREE.Group(); mf.rotation.x = -0.08; mf.position.z = 0.04; gr.add(mf);
      rbox(0.5, 1.75, 0.03, 0.01, 0, 0.9, 0, oak(1, 2), mf);
      var glass = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.64), mat(0xdfe6ea, 0.04, 1)); glass.position.set(0, 0.9, 0.016); add(glass, mf);
      rbox(0.04, 0.04, 0.24, 0.01, -0.2, 0.02, -0.08, dark); rbox(0.04, 0.04, 0.24, 0.01, 0.2, 0.02, -0.08, dark);
    } else if (key === "sturta"){ // a walk-in shower (owner, 2026-10-27): no tray — the floor runs through to a linear drain at the wall;
      // ONE frameless 8 mm glass screen on the open side (a slim wall profile + a stabiliser bar to the wall), its edges a
      // touch green like real glass; a rain head on a riser and a thermostatic bar mixer on the wall. Wall at z = −0.45.
      var glassFace = mat(0xe6f1f0, 0.02, 0, { transparent:true, opacity:0.14, depthWrite:false, envMapIntensity:1.4, side:THREE.DoubleSide });
      var glassEdge = mat(0x9fc4bb, 0.1, 0, { transparent:true, opacity:0.75, envMapIntensity:1.2 });
      var gW = 0.008, gH = 2.0, gL = 0.9, gx = 0.45 - gW / 2 - 0.006;
      var screen = new THREE.Mesh(new THREE.BoxGeometry(gW, gH, gL - 0.012), [glassFace, glassFace, glassEdge, glassEdge, glassEdge, glassEdge]);
      screen.position.set(gx, 0.012 + gH / 2, -0.45 + 0.012 + (gL - 0.012) / 2); screen.renderOrder = 2; screen.userData.noShadow = true; gr.add(screen); // (no shadow: clear glass)
      rbox(0.022, gH, 0.022, 0.003, gx, 0.012 + gH / 2, -0.45 + 0.011, steel); // the wall profile it stands in
      var bar = new THREE.Vector3(gx, 0.012 + gH - 0.02, 0.05), wallPt = new THREE.Vector3(0.12, 0.012 + gH - 0.02, -0.45), mid = bar.clone().add(wallPt).multiplyScalar(0.5), len = bar.distanceTo(wallPt);
      var rod = cyl(0.007, 0.007, len, mid.x, mid.y, mid.z, steel, 12); rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bar.clone().sub(wallPt).normalize());
      cyl(0.016, 0.016, 0.012, wallPt.x, wallPt.y, wallPt.z + 0.006, steel, 16).rotation.x = Math.PI / 2; // the wall rose
      rbox(0.02, 0.03, 0.03, 0.004, gx, bar.y, bar.z, steel); // the glass clamp
      // linear drain along the wall: a brushed steel strip with a slotted grate
      rbox(0.78, 0.004, 0.07, 0.002, -0.02, 0.002, -0.45 + 0.07, steel);
      var slot = mat(0x2c2d30, 0.6); for (var k = 0; k < 18; k++) rbox(0.03, 0.002, 0.008, 0.001, -0.39 + k * 0.043, 0.0045, -0.45 + 0.07, slot);
      // thermostatic bar mixer, riser with a hand shower, arm + 25 cm rain head
      var mx = -0.12, mz = -0.45 + 0.04;
      var mixer = cyl(0.026, 0.026, 0.32, mx, 1.05, mz, steel, 24); mixer.rotation.z = Math.PI / 2;
      [-0.14, 0.14].forEach(function(dx){ cyl(0.034, 0.034, 0.03, mx + dx, 1.05, mz, steel, 24).rotation.z = Math.PI / 2; });
      cyl(0.011, 0.011, 1.05, mx + 0.12, 1.6, mz, steel, 14); // riser
      tube([[mx + 0.12, 2.12, mz], [mx + 0.12, 2.16, mz + 0.05], [mx + 0.12, 2.16, mz + 0.26]], 0.011, steel);
      cyl(0.125, 0.125, 0.008, mx + 0.12, 2.145, mz + 0.3, steel, 40); // the rain head
      var hs = cyl(0.018, 0.012, 0.22, mx + 0.12, 1.45, mz + 0.035, steel, 16); hs.rotation.x = 0.12; // hand shower on its slider
      cyl(0.03, 0.03, 0.012, mx + 0.12, 1.57, mz + 0.045, steel, 24).rotation.x = Math.PI / 2 + 0.12;
    } else if (key === "klosett"){ // a wall-hung rimless WC (owner, 2026-10-27: "make it real-looking"): one lofted ceramic body —
      // flat on the wall, egg-shaped seen from above, curving in underneath back to the wall — a bevelled seat ring, a
      // soft-close lid, chrome hinges, the flush plate on the wall (the cistern is in the wall)
      var ceramic = mat(0xf8f7f3, 0.12, 0, { envMapIntensity:0.6 }), seatM = mat(0xfbfbf9, 0.22), wz = -0.325, L = 0.54, cz = L / 2, N = 72;
      function outl(th){ var c = Math.cos(th), sn = Math.sin(th), n = sn < 0 ? 3.4 : 2.15, r = 1 / Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(sn), n), 1 / n); return [0.178 * c * r, cz + cz * sn * r]; }
      var rings = [[0.405, 1], [0.392, 1.004], [0.36, 0.997], [0.322, 0.972], [0.288, 0.915], [0.262, 0.83], [0.243, 0.7], [0.232, 0.52], [0.226, 0.3]];
      var pos = [], idx = [];
      rings.forEach(function(rg){ for (var i = 0; i < N; i++){ var o = outl(-Math.PI / 2 + i / N * Math.PI * 2); pos.push(o[0] * rg[1], rg[0], wz + o[1] * rg[1]); } }); // scaled toward the wall: the underside curves back to it
      for (var j = 0; j < rings.length - 1; j++) for (var i = 0; i < N; i++){ var a = j * N + i, b = j * N + (i + 1) % N, c2 = a + N, d2 = b + N; idx.push(a, c2, b, b, c2, d2); }
      var top0 = pos.length / 3; pos.push(0, 0.405, wz + cz); for (var i = 0; i < N; i++) idx.push(top0, i, (i + 1) % N); // the top (under the seat)
      var bot0 = pos.length / 3, lr = rings[rings.length - 1]; pos.push(0, lr[0] - 0.004, wz + cz * lr[1]); for (var i = 0; i < N; i++) idx.push(bot0, (rings.length - 1) * N + (i + 1) % N, (rings.length - 1) * N + i);
      var bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
      add(new THREE.Mesh(bg, ceramic));
      function ring(sx, sz, dz){ var sh = new THREE.Shape(); for (var i = 0; i <= N; i++){ var o = outl(-Math.PI / 2 + i / N * Math.PI * 2); var x = o[0] * sx, z = cz + dz + (o[1] - cz) * sz; if (i) sh.lineTo(x, -z); else sh.moveTo(x, -z); } return sh; }
      function slab(sh, t, bev, y, m){ var g = new THREE.ExtrudeGeometry(sh, { depth:t, bevelEnabled:true, bevelThickness:bev, bevelSize:bev, bevelSegments:3, curveSegments:N }); g.rotateX(-Math.PI / 2); var o = new THREE.Mesh(g, m); o.position.set(0, y, wz); return add(o); }
      var seat = ring(0.97, 0.93, 0.03); seat.holes.push(ring(0.6, 0.62, 0.055)); // the ring: open in front of the hinges
      slab(seat, 0.012, 0.005, 0.411, seatM);
      slab(ring(0.955, 0.915, 0.03), 0.01, 0.006, 0.434, seatM); // the lid, down
      [-0.075, 0.075].forEach(function(x){ var h = cyl(0.011, 0.011, 0.03, x, 0.425, wz + 0.05, steel, 16); h.rotation.z = Math.PI / 2; });
      rbox(0.246, 0.164, 0.012, 0.006, 0, 1.02, wz + 0.006, mat(0xf1f1ef, 0.22)); // flush plate
      rbox(0.104, 0.124, 0.006, 0.004, -0.056, 1.02, wz + 0.014, mat(0xdcdfe1, 0.18, 0.4)); rbox(0.104, 0.124, 0.006, 0.004, 0.056, 1.02, wz + 0.014, mat(0xdcdfe1, 0.18, 0.4));
    } else if (key === "badkar"){ // a built-in 170×70 bath: white panelled tub, an inset oval bowl, a chrome spout at one end
      var whiteB = mat(0xf7f6f2, 0.2), inner = mat(0xf2f1ec, 0.15, 0, { side:THREE.DoubleSide });
      var ring = new THREE.Shape(); ring.moveTo(-0.85, -0.35); ring.lineTo(0.85, -0.35); ring.lineTo(0.85, 0.35); ring.lineTo(-0.85, 0.35); ring.lineTo(-0.85, -0.35);
      var hole = new THREE.Path(); hole.absellipse(0.03, 0, 0.74, 0.27, 0, Math.PI * 2, true, 0); ring.holes.push(hole);
      var rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth:0.56, bevelEnabled:false, curveSegments:40 }), whiteB); rim.rotation.x = -Math.PI / 2; add(rim);
      var bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), inner); bowl.scale.set(0.74, 0.42, 0.27); bowl.position.set(0.03, 0.56, 0); add(bowl);
      cyl(0.02, 0.02, 0.003, -0.55, 0.155, 0, steel, 20);
      cyl(0.014, 0.014, 0.08, -0.8, 0.6, 0, steel, 12);
      var spoutB = rbox(0.12, 0.022, 0.03, 0.008, -0.75, 0.64, 0, steel);
    } else if (key === "thvottakarfa"){ // a woven laundry basket with a lid: tapered oval body, rim bands, a towel over the edge
      var wick = mat(0xc9ab7d, 0.85), band = mat(0xa8875a, 0.8);
      lathe([[0, 0], [0.16, 0], [0.19, 0.52], [0, 0.52]], wick, 40, 0, 0.01, 0).scale.set(1.15, 1, 0.9);
      [0.08, 0.3, 0.5].forEach(function(y){ var r = new THREE.Mesh(new THREE.TorusGeometry(0.163 + y * 0.055, 0.007, 6, 40), band); r.rotation.x = Math.PI / 2; r.scale.set(1.15, 0.9, 1); r.position.y = y + 0.01; add(r); });
      var lid = cyl(0.2, 0.2, 0.025, 0, 0.545, 0, wick, 40); lid.scale.set(1.15, 1, 0.9);
      cyl(0.03, 0.03, 0.025, 0, 0.57, 0, band, 16);
      rbox(0.16, 0.2, 0.01, 0.004, 0.08, 0.44, 0.17, mat(0xe6eef2, 0.9)); // a towel hanging over the front
    } else if (key === "straubretti"){ // an ironing board on its crossed legs, an iron on the rest
      var boardM = mat(0xdfe7ea, 0.9), legM = mat(0xb9bec4, 0.35, 0.7);
      var bs = new THREE.Shape(); bs.moveTo(-0.58, -0.18); bs.lineTo(0.38, -0.18); bs.quadraticCurveTo(0.62, -0.12, 0.62, 0); bs.quadraticCurveTo(0.62, 0.12, 0.38, 0.18); bs.lineTo(-0.58, 0.18); bs.lineTo(-0.58, -0.18);
      var board = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth:0.03, bevelEnabled:false, curveSegments:16 }), boardM); board.rotation.x = -Math.PI / 2; board.position.y = 0.86; add(board);
      [[-0.3, 0.32], [0.32, -0.3]].forEach(function(p){ var l = rbox(0.022, 1.0, 0.022, 0.005, (p[0] + p[1]) / 2, 0.43, 0, legM); l.rotation.z = -Math.atan2(p[1] - p[0], 0.86); });
      rbox(0.36, 0.015, 0.03, 0.005, -0.12, 0.012, 0.14, legM); rbox(0.36, 0.015, 0.03, 0.005, -0.12, 0.012, -0.14, legM);
      rbox(0.2, 0.012, 0.16, 0.006, -0.66, 0.86, 0, legM); // the iron rest
      var iron = rbox(0.2, 0.05, 0.1, 0.02, -0.66, 0.9, 0, mat(0x3a6ea5, 0.4, 0.2)); iron.rotation.y = 0.2;
    } else if (key === "stoll"){ // the oak dining chair on its own
      chair(0, 0, 0);
    } else if (key === "hengiljos"){ // hangs from y = 0 down: canopy, cord, a turned metal dome, bulb (lights up in the evening)
      cyl(0.05, 0.05, 0.02, 0, -0.01, 0, blackMetal, 32);
      cyl(0.003, 0.003, 0.68, 0, -0.36, 0, dark, 8);
      var dome = [[0.012, 0], [0.03, -0.005], [0.12, -0.08], [0.17, -0.17], [0.18, -0.2]].map(function(p){ return [p[0], p[1] - 0.68]; });
      lathe(dome, mat(0x1f1f22, 0.4, 0.5, { side:THREE.DoubleSide }), 48);
      var lip = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.004, 6, 48), mat(0xb08d57, 0.3, 0.9)); lip.rotation.x = Math.PI / 2; lip.position.y = -0.88; add(lip); // brass rim
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), new THREE.MeshBasicMaterial({ color:0xfff1d8, toneMapped:false })); bulb.position.y = -0.84; gr.add(bulb);
      gr.userData.bulb = bulb;
    }
    return gr;
  }
  function addDecorItems(THREE, scene, state, opts, pickables){
    if (state.decorHidden) return; // "Fela húsgögn" (view only)
    (state.decor || []).forEach(function(d){
      var def = DECOR[d.kind]; if (!def) return;
      var gr = buildDecor(THREE, d.kind, d), ft = decorFoot(d);
      var y = def.group === "ceiling" ? (state.roomHeightMm || 2500) / 1000 : def.group === "top" ? decorTopAt(state, d.xMm, d.zMm, d.id) : 0;
      gr.position.set(d.xMm / 1000, y, d.zMm / 1000); gr.rotation.y = (d.rot || 0) * Math.PI / 180;
      var meta = { kind:"decor", blockId:d.id, decorId:d.id, zone:"decor", widthMm:Math.round(ft.w * 1000), depthMm:Math.round(ft.d * 1000), locked:!!(d.locked || state.decorLocked) && !!opts.onDecorDragEnd };
      gr.traverse(function(o){ if (o.isMesh){ o.userData = meta; pickables.push(o); } });
      if (opts.selectedId === d.id){ // a blue ring round the selected one
        var r = (TABLE_SIZES[d.kind] ? Math.max(ft.w, ft.d) / 2 : Math.max(def.w, def.d) / 2000) + 0.05, ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.02, 48), new THREE.MeshBasicMaterial({ color:SELECT_COLOR, side:THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = def.group === "ceiling" ? -0.9 : 0.006; gr.add(ring);
      }
      scene.add(gr);
      if (gr.userData.bulb){ // the pendant lights the table under it in the evening
        var L = (scene.userData.leds = scene.userData.leds || { glows:[] }); (L.strips = L.strips || []).push(gr.userData.bulb);
        ledSpot(THREE, scene, gr, 0, -0.88, 0, -y + 0.75);
        var sp = L.lights[L.lights.length - 1]; if (sp && sp.isSpotLight){ sp.angle = 0.9; sp.distance = 3; sp.userData.full = 5; }
      }
    });
  }

  // text along a plan line, never upside down; a side wall's text reads bottom-up
  function planTextAng(dx, dy){ var a = Math.atan2(dy, dx) * 180 / Math.PI; if (a >= 89.5) a -= 180; if (a < -90.5) a += 180; return Math.round(a * 10) / 10; }
  function planIsPro(){ return typeof document !== "undefined" && !!document.body && document.body.classList.contains("pro"); } // Sk-numbers are shop talk
  function buildPlan2D(container, state, opts){
    opts = opts || {};
    var geoms = wallGeoms(state);
    if (!geoms.length){ container.innerHTML = ""; return; }
    var surfaces = surfacesOf(state), allGeoms = geoms.concat(islandGeoms(state)).concat(milliveggGeoms(state));

    var b = stateBounds(state, geoms);
    var margin = 0.8;
    var minX = b.minX - margin, maxX = b.maxX + margin;
    var minZ = b.minZ - margin, maxZ = b.maxZ + margin;
    var svgW = (maxX - minX) * PX_PER_M, svgH = (maxZ - minZ) * PX_PER_M;

    function X(x){ return (x - minX) * PX_PER_M; }
    function Y(z){ return (z - minZ) * PX_PER_M; }

    var look = state.look ? LOOKS[state.look] : null;
    var fillColor = look ? look.color3d : "#b7b2a4";
    var topDef2 = state.top && TOPS[state.top] ? TOPS[state.top] : null;
    var counterFill = topDef2 ? topDef2.color3d : "#e6e1d8";

    // Drawing-board look: warm paper, a 0.5 m grid, soft drop shadows under
    // the cabinets, real door-swing arcs and window symbols.
    var gridPx = PX_PER_M * 0.5;
    var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg" ' +
      'style="width:100%;height:100%;display:block;background:#f7f4ed;font-family:\'Kumbh Sans\',Arial,sans-serif;">' +
      '<defs><pattern id="kpGrid" width="' + gridPx + '" height="' + gridPx + '" patternUnits="userSpaceOnUse">' +
        '<path d="M ' + gridPx + ' 0 L 0 0 0 ' + gridPx + '" fill="none" stroke="#ebe6da" stroke-width="1"/></pattern>' +
      '<filter id="kpShadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".22"/></filter></defs>' +
      '<rect width="100%" height="100%" fill="url(#kpGrid)"/>';

    if (geoms.closed && geoms.length >= 3){ // the room's floor
      svg += '<polygon points="' + geoms.map(function(g){ return X(g.origin.x) + "," + Y(g.origin.z); }).join(" ") + '" fill="' + floorPlanColor(state.floor) + '" stroke="none" style="pointer-events:none;"/>';
    }
    geoms.forEach(function(g, gi){
      var x1 = X(g.origin.x), y1 = Y(g.origin.z);
      var end = { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM };
      var x2 = X(end.x), y2 = Y(end.z);
      var wallId = state.walls[gi] ? state.walls[gi].id : "";
      var isOpen = !!(state.walls[gi] && state.walls[gi].open);
      svg += isOpen
        ? '<line data-wall-line-id="' + wallId + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#6f6d66" stroke-width="2.4" stroke-dasharray="8,6"/>'
        : '<line data-wall-line-id="' + wallId + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (opts.selectedWallId === wallId ? "#3d61c1" : "#2b2b2e") + '" stroke-width="' + (opts.selectedWallId === wallId ? 18 : 9) + '" stroke-linecap="square"' + (opts.onWallSelect ? ' style="cursor:pointer;"' : '') + '/>';
      var sw = state.walls[gi];
      // an open edge with nothing on it isn't a wall to the customer (a "Beinn veggur" wardrobe's 3 room edges) — no label
      if (!opts.mini && !(sw && sw.open && !(sw.floor || []).length && !(sw.wall || []).length)){
        var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        // outside the dimension chain (offsets -22/-38) and turned along the wall, so a side wall's name never sits on its
        // numbers (QA 2026-10-26, E7)
        var lx = midX - g.normal.x * 58, ly = midY - g.normal.z * 58, wsel = opts.selectedWallId === wallId, wAng = planTextAng(x2 - x1, y2 - y1);
        // just the wall's name here — its length is now on the dimension chain (wallDimChain) instead,
        // so this doesn't duplicate/overlap that number
        svg += '<text x="' + lx + '" y="' + ly + '" font-size="' + (wsel ? 12.5 : 11) + '" font-weight="' + (wsel ? 700 : 400) + '" fill="' + (wsel ? "#3d61c1" : "#6f6d66") + '" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + wAng + ' ' + lx + ' ' + ly + ')" style="pointer-events:none;">' + (state.walls[gi] ? escSvg(__(state.walls[gi].label)) : dimLen(g.lenM * 1000)) + '</text>';
      }
    });

    // Window/door markers: a thick colored segment over the wall line at
    // the opening's own span — simpler than drawing a true gap, and this
    // plan already isn't a precision architectural drawing.
    function openingSegment(o, dataAttr, color, isDoor){
      var g = geoms[state.walls.findIndex(function(w){ return w.id === o.wallId; })];
      if (!g) return;
      var offsetM = o.offsetMm / 1000, widthM = o.widthMm / 1000;
      var ax = g.origin.x + g.axis.x * offsetM, az = g.origin.z + g.axis.z * offsetM;
      var bx = g.origin.x + g.axis.x * (offsetM + widthM), bz = g.origin.z + g.axis.z * (offsetM + widthM);
      var sel = opts.selectedId === o.id;
      // gap in the wall + the symbol
      svg += '<line x1="' + X(ax) + '" y1="' + Y(az) + '" x2="' + X(bx) + '" y2="' + Y(bz) + '" stroke="#f7f4ed" stroke-width="11" stroke-linecap="butt" style="pointer-events:none;"/>';
      if (o.gap){ // a plain opening: just the two wall ends, no leaf or glazing
        [0, widthM].forEach(function(al){
          var px = g.origin.x + g.axis.x * (offsetM + al), pz = g.origin.z + g.axis.z * (offsetM + al);
          svg += '<line x1="' + (X(px) - g.normal.x * 6) + '" y1="' + (Y(pz) - g.normal.z * 6) + '" x2="' + (X(px) + g.normal.x * 6) + '" y2="' + (Y(pz) + g.normal.z * 6) + '" stroke="#8a6a4a" stroke-width="2" style="pointer-events:none;"/>';
        });
      } else if (isDoor && doorSwingOf(o) === "slide"){ // a sliding leaf: drawn parked (open) beside the opening, the opening itself dashed
        var sdir = doorHingeOf(o) === "right" ? -1 : 1, so = 0.035;
        var s0 = { x:(sdir > 0 ? bx : ax) + g.normal.x * so, z:(sdir > 0 ? bz : az) + g.normal.z * so }; // open = parked beside the opening
        var s1 = { x:s0.x + g.axis.x * sdir * widthM, z:s0.z + g.axis.z * sdir * widthM };
        svg += '<line x1="' + X(s0.x) + '" y1="' + Y(s0.z) + '" x2="' + X(s1.x) + '" y2="' + Y(s1.z) + '" stroke="#8a6a4a" stroke-width="3" style="pointer-events:none;"/>' +
          '<line x1="' + X(ax + g.normal.x * so) + '" y1="' + Y(az + g.normal.z * so) + '" x2="' + X(bx + g.normal.x * so) + '" y2="' + Y(bz + g.normal.z * so) + '" stroke="#8a6a4a" stroke-width="1.2" stroke-dasharray="4,3" style="pointer-events:none;"/>';
      } else if (isDoor){
        var sw = doorSweep(state, o);
        if (sw){ // leaf drawn open at 90°, its path a quarter circle; a light fill = the floor it needs, red if a cabinet is in it
          var tip = { x:sw.h.x + sw.v.x * sw.r, z:sw.h.z + sw.v.z * sw.r }, latch = { x:sw.h.x + sw.u.x * sw.r, z:sw.h.z + sw.u.z * sw.r };
          var crossS = sw.v.x * sw.u.z - sw.v.z * sw.u.x, rp = sw.r * PX_PER_M, bad = doorHits[o.id];
          svg += '<path d="M ' + X(sw.h.x) + ' ' + Y(sw.h.z) + ' L ' + X(tip.x) + ' ' + Y(tip.z) + ' A ' + rp + ' ' + rp + ' 0 0 ' + (crossS > 0 ? 1 : 0) + ' ' + X(latch.x) + ' ' + Y(latch.z) + ' Z" fill="' + (bad ? "#d64545" : "#8a6a4a") + '" fill-opacity="' + (bad ? 0.22 : (sw.inward ? 0.08 : 0.04)) + '" stroke="none" style="pointer-events:none;"/>' +
            '<line x1="' + X(sw.h.x) + '" y1="' + Y(sw.h.z) + '" x2="' + X(tip.x) + '" y2="' + Y(tip.z) + '" stroke="' + (bad ? "#c0392b" : "#8a6a4a") + '" stroke-width="2" style="pointer-events:none;"/>' +
            '<path d="M ' + X(tip.x) + ' ' + Y(tip.z) + ' A ' + rp + ' ' + rp + ' 0 0 ' + (crossS > 0 ? 1 : 0) + ' ' + X(latch.x) + ' ' + Y(latch.z) + '" fill="none" stroke="' + (bad ? "#c0392b" : "#8a6a4a") + '" stroke-width="1.2" stroke-dasharray="4,3" style="pointer-events:none;"/>';
        }
      } else {
        [-3, 3].forEach(function(d){
          svg += '<line x1="' + (X(ax) + g.normal.x * d) + '" y1="' + (Y(az) + g.normal.z * d) + '" x2="' + (X(bx) + g.normal.x * d) + '" y2="' + (Y(bz) + g.normal.z * d) + '" stroke="#5b8fae" stroke-width="1.6" style="pointer-events:none;"/>';
        });
      }
      // wide, mostly-invisible hit target that also shows the selection
      svg += '<line ' + dataAttr + '="' + o.id + '" x1="' + X(ax) + '" y1="' + Y(az) + '" x2="' + X(bx) + '" y2="' + Y(bz) +
        '" stroke="' + (sel ? "#3d61c1" : color) + '" stroke-opacity="' + (sel ? 1 : 0.35) + '" stroke-width="' + (sel ? 11 : 9) + '" stroke-linecap="butt" style="cursor:pointer;"/>';
    }
    (state.windows || []).forEach(function(w){ openingSegment(w, 'data-window-id', "#5b8fae", false); });
    var doorHits = {}; roomDoorConflicts(state).forEach(function(cf){ doorHits[cf.doorId] = cf.ids; });
    (state.doors || []).forEach(function(d){ openingSegment(d, 'data-door-id', "#8a6a4a", true); });
    (state.obstacles || []).forEach(function(o){
      var q = obstacleQuad(state, o), def = OBSTACLES[o.kind]; if (!q || !def) return;
      var sel = opts.selectedId === o.id, fill = def.look === "wall" ? "#9a958a" : def.look === "radiator" ? "#ffffff" : def.look === "sill" ? "#e6e2da" : def.look === "fixture" ? "#e8ebed" : "#c4c6c9";
      svg += '<polygon data-obstacle-id="' + o.id + '" points="' + q.map(function(p){ return X(p.x) + "," + Y(p.z); }).join(" ") + '" fill="' + fill + '" fill-opacity="' + (def.ceiling ? 0.35 : 0.9) + '" stroke="' + (sel ? "#3d61c1" : "#4a4740") + '" stroke-width="' + (sel ? 2.5 : 1.2) + '"' + (def.ceiling ? ' stroke-dasharray="6,4"' : '') + ' style="cursor:pointer;"><title>' + def.label + '</title></polygon>';
    });

    function drawCabinetRect(bl, c, g, wallId, zone, offsetMm, isWallRow){
      var widthM = bl.widthMm / 1000;
      var corners = rectCornersWorld(g, offsetMm, bl.widthMm, bl.depthMm || c.d);
      var poly = corners.map(function(p){ return X(p.x) + "," + Y(p.z); }).join(" ");
      var dash = isWallRow ? ' stroke-dasharray="5,3"' : '';
      var selected = opts.selectedId === bl.id;
      var warned = opts.warnIds && opts.warnIds.indexOf(bl.id) >= 0;
      var stroke = selected ? "#3d61c1" : (warned ? "#d9822b" : "#3a3a3d");
      var strokeW = selected ? 3 : (warned ? 3 : 1.2);
      // top view: worktop stone on base units, steel/black on appliances, the
      // kitchen's front colour on towers; wall units drawn lighter + dashed
      var fill = c.fridge ? "#c9ccd1" : c.oven ? "#4a4c52" : c.counter ? counterFill : fillColor;
      var op = isWallRow ? 0.5 : 1;
      var thin = bl.widthMm < 100; // úthlið: a hairline on the plan, so it gets a wider invisible hit target
      svg += '<polygon ' + (thin ? '' : 'data-wall-id="' + wallId + '" data-zone="' + zone + '" data-block-id="' + bl.id + '" ') +
        'points="' + poly + '" fill="' + (thin ? fillColor : fill) + '" fill-opacity="' + op + '" ' +
        'stroke="' + stroke + '" stroke-width="' + (thin ? Math.max(strokeW, 2.4) : strokeW) + '"' + dash + (isWallRow || thin ? '' : ' filter="url(#kpShadow)"') + (thin ? ' style="pointer-events:none;"' : ' style="cursor:pointer;"') + '/>';
      if (thin){
        svg += '<polygon data-wall-id="' + wallId + '" data-zone="' + zone + '" data-block-id="' + bl.id + '" points="' + poly + '" fill="none" stroke="transparent" stroke-width="14" style="cursor:pointer;pointer-events:stroke;"/>';
      }
      // front edge in the kitchen's front colour
      if (!isWallRow && c.counter){
        svg += '<line x1="' + X(corners[3].x) + '" y1="' + Y(corners[3].z) + '" x2="' + X(corners[2].x) + '" y2="' + Y(corners[2].z) + '" stroke="' + fillColor + '" stroke-width="4" style="pointer-events:none;"/>';
      }
      if (c.sink){ // basin
        var m = function(a, o2){ return { x:g.origin.x + g.axis.x * (offsetMm / 1000 + a) + g.normal.x * o2, z:g.origin.z + g.axis.z * (offsetMm / 1000 + a) + g.normal.z * o2 }; };
        var bw = Math.min(0.6, widthM * 0.72), bd = Math.min(0.4, (bl.depthMm || c.d) / 1000 * 0.62), oc = (bl.depthMm || c.d) / 2000;
        var q = [m(widthM / 2 - bw / 2, oc - bd / 2), m(widthM / 2 + bw / 2, oc - bd / 2), m(widthM / 2 + bw / 2, oc + bd / 2), m(widthM / 2 - bw / 2, oc + bd / 2)];
        svg += '<polygon points="' + q.map(function(p){ return X(p.x) + "," + Y(p.z); }).join(" ") + '" fill="#b9bec4" stroke="#7d848b" stroke-width="1" style="pointer-events:none;"/>';
      }
      if (widthM * PX_PER_M > 30 && !thin && !opts.mini){
        // a wall unit's label near the wall, a floor unit's toward its front, the wall one smaller and grey — they sat
        // on top of each other ("Sk5 · 60" over "Sk9 · 60", morning scan 2026-10-27); customers see just the width
        var tF = isWallRow ? 0.3 : 0.62, bx0 = (corners[0].x + corners[1].x) / 2, bz0 = (corners[0].z + corners[1].z) / 2, fx0 = (corners[3].x + corners[2].x) / 2, fz0 = (corners[3].z + corners[2].z) / 2;
        var cx = X(bx0 + (fx0 - bx0) * tF), cy = Y(bz0 + (fz0 - bz0) * tF);
        // just the width, readable (was "78,8 · 3sk" — user, 2026-10-26); PRO keeps its Sk-number in front
        var label = (bl.sk && planIsPro() ? bl.sk + " · " : "") + dimNum(bl.widthMm);
        svg += '<text x="' + cx + '" y="' + cy + '" font-size="' + (isWallRow ? 10.5 : 12) + '" font-weight="' + (isWallRow ? 500 : 600) + '" fill="' + (c.oven ? "#fff" : isWallRow ? "#6f6d66" : "#191919") + '" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none;">' + label + '</text>';
      }
    }

    // Chained dimensions along a real wall's floor row (IKEA-style): a tick + width per cabinet,
    // plus one total — drawn just outside the wall line, away from the room, so it never overlaps
    // the cabinets themselves. Walls only (v1) — island rows keep just their own on-cabinet labels.
    function planDimLine(ax, az, bx, bz, text, nx, nz){
      var x0 = X(ax), y0 = Y(az), x1 = X(bx), y1 = Y(bz), t = 5;
      var s = '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#8a857a" stroke-width="1" style="pointer-events:none;"/>';
      [[x0, y0], [x1, y1]].forEach(function(p){
        s += '<line x1="' + (p[0] - nx * t) + '" y1="' + (p[1] - nz * t) + '" x2="' + (p[0] + nx * t) + '" y2="' + (p[1] + nz * t) + '" stroke="#8a857a" stroke-width="1" style="pointer-events:none;"/>';
      });
      var tx = (x0 + x1) / 2 - nx * 7, ty = (y0 + y1) / 2 - nz * 7, ta = planTextAng(x1 - x0, y1 - y0); // along the line, on its outer side
      s += '<text x="' + tx + '" y="' + ty + '" font-size="10.5" fill="#6f6d66" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + ta + ' ' + tx + ' ' + ty + ')" style="pointer-events:none;">' + text + '</text>';
      return s;
    }
    function wallDimChain(g, floor, starts){
      var off = -22; // outward from the wall, away from the room (cabinets sit on the +normal side)
      var s = "";
      floor.forEach(function(bl, bi){
        if (unitCm() && CATALOG[bl.type] && CATALOG[bl.type].panel) return; // no "2" tag on an úthlið for a customer — the total covers it
        var a0 = starts[bi] / 1000, a1 = (starts[bi] + bl.widthMm) / 1000;
        var p0 = { x:g.origin.x + g.axis.x * a0 + g.normal.x * off / PX_PER_M, z:g.origin.z + g.axis.z * a0 + g.normal.z * off / PX_PER_M };
        var p1 = { x:g.origin.x + g.axis.x * a1 + g.normal.x * off / PX_PER_M, z:g.origin.z + g.axis.z * a1 + g.normal.z * off / PX_PER_M };
        s += planDimLine(p0.x, p0.z, p1.x, p1.z, dimNum(bl.widthMm), g.normal.x, g.normal.z);
      });
      // the wall's own full length, always shown (not just the cabinet run) — a bare wall still gets dimensioned
      var off2 = off - (floor.length ? 16 : 0);
      var q0 = { x:g.origin.x + g.normal.x * off2 / PX_PER_M, z:g.origin.z + g.normal.z * off2 / PX_PER_M };
      var q1 = { x:g.origin.x + g.axis.x * g.lenM + g.normal.x * off2 / PX_PER_M, z:g.origin.z + g.axis.z * g.lenM + g.normal.z * off2 / PX_PER_M };
      s += planDimLine(q0.x, q0.z, q1.x, q1.z, dimLen(g.lenM * 1000), g.normal.x, g.normal.z);
      return s;
    }

    surfaces.forEach(function(wall, wi){
      var g = allGeoms[wi];
      if (!g) return;
      var fStarts = blockStartsMm(wall.floor, cornerClearanceMm(surfaces, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      wall.floor.forEach(function(bl, bi){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "floor", fStarts[bi], false); });
      wall.wall.forEach(function(bl, bi){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "wall", wStarts[bi], true); });
      if (!wall.island && !opts.mini) svg += wallDimChain(g, wall.floor, fStarts);
    });

    // island move-handles (drag = slide the island, tap = select it)
    (opts.onSelect ? (state.islands || []) : []).forEach(function(isl){
      var hp = islandHandlePos(isl), sel = opts.selectedId === isl.id;
      svg += '<circle data-island-id="' + isl.id + '" cx="' + X(hp.x) + '" cy="' + Y(hp.z) + '" r="12" fill="' + (sel ? "#3d61c1" : "#f5c518") + '" stroke="#2a2a2a" stroke-width="1.6" style="cursor:grab;"/>' +
        '<text x="' + X(hp.x) + '" y="' + Y(hp.z) + '" font-size="13" text-anchor="middle" dominant-baseline="central" fill="' + (sel ? "#fff" : "#2a2a2a") + '" style="pointer-events:none;">✥</text>';
    });

    svg += "</svg>";
    container.innerHTML = svg;

    if (opts.onSelect){
      container.querySelectorAll("[data-block-id]").forEach(function(el){
        el.addEventListener("click", function(){
          opts.onSelect({ wallId: el.dataset.wallId, zone: el.dataset.zone, blockId: el.dataset.blockId });
        });
      });
      container.querySelectorAll("[data-obstacle-id]").forEach(function(el){
        el.addEventListener("click", function(evt){ evt.stopPropagation(); opts.onSelect({ blockId:el.dataset.obstacleId, kind:"obstacle", zone:"obstacle" }); });
      });
      container.querySelectorAll("[data-window-id],[data-door-id]").forEach(function(el){
        el.addEventListener("click", function(evt){
          evt.stopPropagation();
          var isWin = el.dataset.windowId !== undefined;
          opts.onSelect({ blockId: isWin ? el.dataset.windowId : el.dataset.doorId, kind: isWin ? "window" : "door", zone:"opening" });
        });
      });
      if (opts.onWallSelect){
        container.querySelectorAll("[data-wall-line-id]").forEach(function(el){
          if (el.getAttribute("stroke-dasharray")) return; // open edge: no wall
          el.addEventListener("click", function(evt){ evt.stopPropagation(); opts.onWallSelect(el.dataset.wallLineId); });
        });
      }
      // Clicking empty plan background deselects, mirroring the 3D view.
      container.querySelector("svg").addEventListener("click", function(evt){
        if (evt.target.tagName === "svg" || evt.target === container.querySelector("svg")) opts.onSelect(null);
      });
    }
  }

  window.KP3D = {
    unitCm: false, // set by the planner (customers); see dimLen
    dimNum: dimNum,
    dimLen: dimLen,
    CATALOG: CATALOG,
    LOOKS: LOOKS,
    LOOK_ORDER: LOOK_ORDER,
    LOOK_CATEGORIES: LOOK_CATEGORIES,
    TOPS: TOPS,
    FLOORS: FLOORS,
    FLOOR_GROUPS: FLOOR_GROUPS,
    floorTexture: floorTexture,
    PEOPLE: PEOPLE,
    TILE_SIZES: TILE_SIZES,
    FLOOR_PATTERNS: FLOOR_PATTERNS,
    floorPlanColor: floorPlanColor,
    TOP_GROUPS: TOP_GROUPS,
    CARCASS: CARCASS,
    DRAWER_SYSTEMS: DRAWER_SYSTEMS,
    DRAWER_LAYOUT: DRAWER_LAYOUT,
    HANDLES: HANDLES,
    HANDLE_GROUPS: HANDLE_GROUPS,
    HANDLE_FINISHES: HANDLE_FINISHES,
    handleFinishFor: handleFinishFor,
    wallGeometry3D: wallGeometry3D,
    cornerClearanceMm: cornerClearanceMm, afellaMm: afellaMm, AFELLA_MM: AFELLA_MM,
    blockStartsMm: blockStartsMm,
    planTransform: planTransform,
    rectCornersWorld: rectCornersWorld, drawerZoneMm: drawerZoneMm, TALL_DRAWER_MAX_MM: TALL_DRAWER_MAX_MM, DRAWER_TOPDOOR_MIN_MM: DRAWER_TOPDOOR_MIN_MM, drawerStackSpaceMm: drawerStackSpaceMm, doorLeaves: doorLeaves, smidaHingeSide: smidaHingeSide, islandFits: islandFits, nearestIslandFit: nearestIslandFit, topThickM: topThickM, OBSTACLES: OBSTACLES, obstacleVSpan: obstacleVSpan, obstacleQuad: obstacleQuad, obstacleRect: obstacleRect, obstacleCorners: obstacleCorners, handleAvailMm: handleAvailMm, tallHandleAvailMm: tallHandleAvailMm, obstacleAng: obstacleAng, setShowDims: setShowDims, setSkTags: setSkTags, showDimsOn: function(){ return SHOW_DIMS; }, DECOR: DECOR, decorKindsFor: decorKindsFor, decorFits: decorFits, nearestDecorFit: nearestDecorFit, decorFoot: decorFoot, tableOf: tableOf, DECOR_GROUPS: DECOR_GROUPS, surfaceTopAt: surfaceTopAt, decorTopAt: decorTopAt, nearestTopSpot: nearestTopSpot,
    WALL_COLORS: WALL_COLORS, WALL_TILES: WALL_TILES,
    WINDOW_DEFAULT: WINDOW_DEFAULT,
    _handleProfile: handleProfile,
    DOOR_DEFAULT: DOOR_DEFAULT,
    GAP_DEFAULT: GAP_DEFAULT,
    hasWebGL: hasWebGL,
    waitForThree: waitForThree,
    buildScene: buildScene,
    buildPlan2D: buildPlan2D,
    updateDragPreview3D: updateDragPreview3D,
    dropPointFromClient: dropPointFromClient,
    floorPointFromClient: floorPointFromClient,
    surfacesOf: surfacesOf,
    islandFrame: islandFrame,
    wallGeoms: wallGeoms, turnAxis: turnAxis,
    setWalkMode: setWalkMode, isWalking: isWalking, buildHomeScene: buildHomeScene,
    debugWalk: function(key, secs){ // test aid (the pane can be hidden, so rAF never ticks): hold a key for `secs`, return where you end up
      if (!THREE_STATE || !THREE_STATE.walkStep) return null;
      window.dispatchEvent(new KeyboardEvent("keydown", { key:key })); var t = 1000;
      for (var i = 0; i < secs * 30; i++){ t += 33; THREE_STATE.walkStep(t); }
      window.dispatchEvent(new KeyboardEvent("keyup", { key:key }));
      return { x:+WALK.x.toFixed(2), z:+WALK.z.toFixed(2), yaw:+WALK.yaw.toFixed(2) };
    },
    buildCabinetPreview: buildCabinetPreview, previewPeek: previewPeek, previewSpinOn: previewSpinOn, setPreviewSpin: setPreviewSpin,
    setCabinetPreview: setCabinetPreview,
    teardownCabinetPreview: teardownCabinetPreview,
    hasCabinetPreview: function(){ return !!PREVIEW; },
    surfaceGeoms: surfaceGeoms,
    islandHandlePos: islandHandlePos,
    roomBounds: roomBounds,
    decorSpot: decorSpot,
    nearestWallDrop: nearestWallDrop,
    setSelected3D: setSelected3D,
    setSelectedWall3D: setSelectedWall3D,
    elevOf: elevOf,
    defaultElevOf: defaultElevOf,
    stackHeightMm: stackHeightMm,
    SHELF_T_MM: SHELF_T_MM,
    SHELF_STACK_MAX: SHELF_STACK_MAX,
    SHELF_GAP_DEFAULT: SHELF_GAP_DEFAULT,
    // devtools / browser tests: a world point (m) → client px, and the scene's resize handles (2026-10-23)
    debugProject: function(x, y, z){ if (!THREE_STATE) return null; var V = THREE_STATE.camera.position.constructor, v = new V(x, y, z).project(THREE_STATE.camera), r = THREE_STATE.renderer.domElement.getBoundingClientRect();
      return { x:r.left + (v.x + 1) / 2 * r.width, y:r.top + (1 - v.y) / 2 * r.height }; },
    debugStudio: function(){ if (!THREE_STATE) return null; var b = studioScene(window.__THREE__, THREE_STATE.scene, {}), out = [];
      b.scene.children.forEach(function(m){ var mt = m.material, t = mt.map; out.push({ tris:m.geometry.attributes.position.count / 3, color:mt.color && mt.color.getHexString(), map:t ? { cs:t.colorSpace, w:t.image && (t.image.width || t.image.videoWidth), src:t.image && (t.image.src || t.image.nodeName), rot:t.rotation, rep:[t.repeat.x, t.repeat.y] } : null }); });
      b.dispose(); return out; },
    debugHandles: function(){ var out = []; if (THREE_STATE) THREE_STATE.scene.traverse(function(o){ if (o.userData && o.userData.kind === "obstacle-resize") out.push({ end:o.userData.end, x:o.position.x, y:o.position.y, z:o.position.z }); }); return out; },
    debugInfo: function(){ return sharedRenderer ? { memory:sharedRenderer.info.memory, programs:(sharedRenderer.info.programs || []).length } : null; },
    ANNO_SYMBOLS: ANNO_SYMBOLS, ANNO_COLOR: ANNO_COLOR,
    wallToScreen: function(x, y){ return THREE_STATE && THREE_STATE.wallToScreen ? THREE_STATE.wallToScreen(x, y) : null; },
    screenToWall: function(x, y){ return THREE_STATE && THREE_STATE.screenToWall ? THREE_STATE.screenToWall(x, y) : null; },
    fitWarnings: fitWarnings, twoDoors: twoDoors, openingIssues: openingIssues, roomDoorConflicts: roomDoorConflicts, doorSweep: doorSweep, doorSwingOf: doorSwingOf, doorHingeOf: doorHingeOf, doorMaxDeg: doorMaxDeg, handleProjMm: handleProjMm,
    WALL_UNIT_BASE_MM: WALL_UNIT_BASE_MM,
    snapshot3D: snapshot3D,
    setXrayFronts: setXrayFronts, previewFront: previewFront,
    setCameraLookAt: setCameraLookAt, studioRender: studioRender,
    renderShot: renderShot, unitsShot: unitsShot,
    setAllParts: setAllParts, snapParts: snapParts, peekTopDrawer: peekTopDrawer,
    DRAWER_CODES: DRAWER_CODES, FIXED_FRONT_CODE: FIXED_FRONT_CODE,
    FRONT_MIN: FRONT_MIN, slotMin: slotMin,
    drawerCodes: drawerCodes,
    drawerFrontsMm: drawerFrontsMm, stackFrontsMm: stackFrontsMm,
    drawerComboKey: drawerComboKey, comboVorunumer: comboVorunumer, innerHostIndex: innerHostIndex, innerHostsOf: innerHostsOf,
    ovenCodesOf: ovenCodesOf, ovenZoneMm: ovenZoneMm, setMood: setMood, OVEN_HEIGHTS: OVEN_HEIGHTS, OVEN_BOARD_MM: OVEN_BOARD_MM,
    shelfLayoutOf: shelfLayoutOf, burDrawersOf: burDrawersOf, shelfSpaceMm: shelfSpaceMm, hasShelfLayout: hasShelfLayout, burTopMm: burTopMm, drawerBoxTopMm: drawerBoxTopMm,
    innerDrawersOf: innerDrawersOf, innerTopMm: innerTopMm,
    ovenHOf: ovenHOf, ovenUnderOf: ovenUnderOf, ovenUnderMinMm: ovenUnderMinMm, ovenUnderMaxMm: ovenUnderMaxMm, ovenUpperMm: ovenUpperMm, ovenShelvesOf: ovenShelvesOf,
    OVEN_DEFAULT: OVEN_DEFAULT,
    modelsPending: modelsPending, preload: preload,
    shelvesOf: shelvesOf, burCodesOf: burCodesOf, innerFreeOf: innerFreeOf,
    railsOf: railsOf, railLayoutOf: railLayoutOf,
    radborunSpanMm: radborunSpanMm, RADBORUN_PITCH_MM: RADBORUN_PITCH_MM, RADBORUN_MARGIN_DEFAULT_MM: RADBORUN_MARGIN_DEFAULT_MM,
    setMeasuring: setMeasuring,
    hideDragPreview3D: hideDragPreview3D, showSnapGuides: showSnapGuides,
    teardown3D: teardown3D,
    _three: function(){ return THREE_STATE; },
    _quality: QUALITY,
    _stepMood: function(n){ for (var i = 0; i < (n || 60); i++) if (THREE_STATE) stepMood(THREE_STATE.scene); return MOOD_T; } // debugging: rAF doesn't run in a hidden tab
  };
})();
