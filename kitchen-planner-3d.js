// kitchen-planner-3d.js — shared 3D + 2D rendering for the kitchen planner.
// Loaded by both kitchen-planner.html (customer) and kitchen-planner-review.html
// (Rakel's review page) so the two never drift apart. Exposes everything via
// window.KP3D. Depends on window.__THREE__ / window.__OrbitControls__ being
// set by the importmap module script each host page includes in its <head>.
(function(){
  "use strict";

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
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:200, maxW:1200, h:800,  d:600, minH:600,  maxH:1000, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,4,1], counter:true },
    harskapur:   { label:"Hárskápur",   zone:"floor", cls:"tall",  defaultW:600, minW:300, maxW:1200,  h:2400, d:600, minH:1800, maxH:2600, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,8,5] },
    efriskapur:  { label:"Efriskápur",  zone:"wall",  cls:"wall",  defaultW:600, minW:200, maxW:1200, h:1000, d:300, minH:300,  maxH:1200, minD:200, maxD:450, hasInterior:false, shelfRange:[0,5,2] },
    // Built-in fridge: NOT its own Skápategund in the schema (Skápategund has
    // Grunn/Hár/Efri/Lagna/Ofna/Loftunarskápur only) — physically a Hárskápur
    // housing a bought appliance, so it submits as Hárskápur plus a plain note
    // (same pattern as the drawer note) and Rakel confirms the niche size.
    isskapur:    { label:"Ísskápur (innbyggður)", zone:"floor", cls:"fridge", defaultW:600, minW:500, maxW:1000, h:2400, d:600, minH:1700, maxH:2600, minD:500, maxD:750, hasInterior:false,
                   skapategundOverride:"Hárskápur", fridge:true,
                   note:"Viðskiptavinur óskar eftir innbyggðum ísskáp í þessum skáp — vinsamlegast staðfestu stærð tækis (nisju) og hurðargerð." },
    // Special units: oven tower and Le Mans corner map to real Airtable fields
    // (Hæð ofns, Töfrahorn útfærsla); the sink base and open shelves have no
    // schema of their own, so they submit as Grunnskápur / Efriskápur plus a
    // plain note for Rakel.
    // b.ovenCombo = the drawer combo under the oven (an Útfærslur key, "" = cabinet door, no drawers)
    // ovens are 600 wide (user, 2026-10-02); "Í grunnskáp" = the low oven cabinet below (OFN6)
    ofnaskapur:  { label:"Ofnaskápur",  zone:"floor", cls:"oven",  defaultW:600, minW:600, maxW:600, h:2400, d:600, minH:1800, maxH:2600, minD:500, maxD:750, hasInterior:false, ovenHeightMm:595, oven:true },
    // ---- 2026-09-30: types that exist as real Útfærslur (see kitchen-planner-linemap.js) ----
    // Búrskápur: tall pantry, doors outside, a real drawer/shelf set inside (b.burCombo)
    ofnaskapurLagur:{ label:"Ofnaskápur (í grunnskáp)", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:800, d:600, minH:750, maxH:950, minD:550, maxD:700, hasInterior:false, counter:true, oven:true, lowOven:true },
    // Blint horn með hillum: the Töfrahorn's shape (door on one half, blind panel on the other) with plain shelves
    hornskapur:  { label:"Hornskápur með hillum", zone:"floor", cls:"corner", defaultW:1200, minW:900, maxW:1500, h:800, d:600, minH:600, maxH:1000, minD:500, maxD:900, hasInterior:false, counter:true, shelfRange:[0, 3, 1], skapategundOverride:"Grunnskápur" },
    // Free-standing appliances (2026-10-05): a gap with the appliance drawn in, not ordered from Björninn
    isskapurFri: { label:"Frístandandi ísskápur", zone:"floor", cls:"tall", defaultW:600, minW:600, maxW:900, widths:[600, 700, 900], h:1850, d:650, minH:1700, maxH:2000, minD:600, maxD:750, hasInterior:false, appliance:"fridge", notOrdered:true },
    uppthvottavelFri:{ label:"Uppþvottavél (frístandandi)", zone:"floor", cls:"floor", defaultW:600, minW:450, maxW:600, widths:[450, 600], h:800, d:600, minH:800, maxH:900, minD:550, maxD:700, hasInterior:false, counter:true, appliance:"dishwasher", notOrdered:true },
    // (no longer offered — "nú erum við að gera eldhús", 2026-10-05; kept so older drafts still load)
    thvottavelFri:{ label:"Þvottavél (frístandandi)", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:800, d:600, minH:800, maxH:900, minD:550, maxD:700, hasInterior:false, counter:true, appliance:"washer", notOrdered:true },
    burskapur:   { label:"Búrskápur", zone:"floor", cls:"tall", defaultW:600, minW:300, maxW:1200, h:2400, d:600, minH:1800, maxH:2600, minD:400, maxD:700, hasInterior:false, bur:true },
    // Þvottavélaskápur: washer/dryer tower; b.thvo = "skuffa" (a drawer at the bottom to raise the machine) | "hurdir" (doors only)
    thvottavel:  { label:"Þvottavélaskápur", zone:"floor", cls:"tall", defaultW:600, minW:600, maxW:900, h:2400, d:600, minH:1800, maxH:2600, minD:600, maxD:750, hasInterior:false, thvo:true, fixedFronts:true },
    // Uppþvottavél: integrated dishwasher behind one full front (V1 = the front itself)
    uppthvottavel:{ label:"Uppþvottavél", zone:"floor", cls:"floor", defaultW:600, minW:450, maxW:600, h:800, d:600, minH:750, maxH:900, minD:550, maxD:700, hasInterior:false, counter:true, dishwasher:true },
    // Ruslaskápur: one tall pull-out with bins (RUSL60 / RUSL80)
    ruslaskapur: { label:"Ruslaskápur", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:800, h:800, d:600, minH:600, maxH:1000, minD:500, maxD:700, hasInterior:false, counter:true, rusl:true },
    // Lítill kassi: a low box (benches, window seats, TV units) — no worktop by default
    litillkassi: { label:"Lítill kassi", zone:"floor", cls:"floor", defaultW:600, minW:200, maxW:1200, h:500, d:600, minH:300, maxH:700, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,2,1] },
    // Hár veggskápur: a shallower tall unit (500 deep, 2000 high)
    harveggskapur:{ label:"Hár veggskápur", zone:"floor", cls:"tall", defaultW:600, minW:300, maxW:1200, h:2000, d:500, minH:1500, maxH:2600, minD:300, maxD:600, hasInterior:true, drawerCountRange:[1,4], shelfRange:[0,6,4] },
    tofrahorn:   { label:"Töfrahorn (kapphorn)", zone:"floor", cls:"corner", defaultW:1200, minW:900, maxW:1500, h:800, d:600, minH:600, maxH:1000, minD:500, maxD:900, hasInterior:false, counter:true,
                   skapategundOverride:"Grunnskápur",
                   // Útfærslur "Le mans Töfrahorn" by door half (b.swing) × carcass colour — no light grey exists
                   tofrahornIds:{ haegri:{ dokkgra:"rec7qJxtUZFofq7CW", hvit:"recrLoaCJMoB0LGo4" }, vinstri:{ dokkgra:"recAxPR5s5jKnktRm", hvit:"recdfMCuUnPyRV8rV" } } },
    vaskaskapur: { label:"Vaskaskápur", zone:"floor", cls:"floor", defaultW:800, minW:500, maxW:1500, h:800, d:600, minH:600, maxH:1000, minD:400, maxD:750, hasInterior:false, counter:true, sink:true,
                   skapategundOverride:"Grunnskápur", note:"Vaskaskápur — útskurður fyrir vask og lagnir; vinsamlegast staðfestu vaskstærð og gerð." },
    opnarhillur: { label:"Opnar hillur", zone:"wall", cls:"wall", defaultW:600, minW:200, maxW:1200, h:700, d:300, minH:200, maxH:1200, minD:200, maxD:450, hasInterior:false, open:true, shelfRange:[1,5,3],
                   skapategundOverride:"Efriskápur", note:"Opnar hillur — engin hurð; viðskiptavinur óskar eftir opnum hillum." },
    // Úthlið (end panel): 19 mm thick, same material as the fronts. Placed at
    // the end of a run it copies height/depth from the cabinet it butts up to.
    uthlid:      { label:"Úthlið — neðri", zone:"floor", cls:"floor", defaultW:19, minW:19, maxW:19, h:800, d:600, minH:300, maxH:1000, minD:100, maxD:750, hasInterior:false, panel:true, counter:true, // the worktop runs on over it
                   skapategundOverride:"Grunnskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu).",
                   // Útfærslur "Úthliðar" (V1): UHGR, or UHLK beside a lítill kassi (≤ 600 mm high)
                   panelIds:[{ maxH:600, utfaerslaId:"recEpLxCpHtbBHRkV" }, { utfaerslaId:"recUKqD3UKKWQ8J7g" }] },
    uthlidhar:   { label:"Úthlið — há", zone:"floor", cls:"tall", defaultW:19, minW:19, maxW:19, h:2400, d:600, minH:1000, maxH:2600, minD:100, maxD:750, hasInterior:false, panel:true,
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
    laushilla:   { label:"Lausar hillur (38 mm)", zone:"wall", cls:"wall", defaultW:800, minW:200, maxW:3000, h:38, d:250, minH:38, maxH:2000, minD:150, maxD:450, hasInterior:false, shelfStack:true, elev:1200,
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
        label: b.label + " " + w, defaultW:w, skapategundOverride:b.label, variantOf:base, legacy:true
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
    { key:"framhlidaefni", label:"Framhliðaefni", blurb:"Fáguð, lituð og silkimjúk yfirborð sem minna á hágæða lakk." },
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
  var TOP_GROUPS = [
    { key:"limtre",   label:"Límtré",    blurb:"Hlý, náttúruleg og lifandi borðplata — ask, hnota, eik, beyki og fura." },
    { key:"compact",  label:"Compact",   blurb:"Þéttar og sterkbyggðar harðkjarna plötur — þola raka og daglega notkun vel." },
    { key:"hardplast",label:"Harðplast", blurb:"Hagkvæm og endingargóð — einlitt, viðar-, stein- og marmaraútlit." },
    { key:"steinn",   label:"Steinn",    blurb:"Steinplötur eru pantaðar sérstaklega hjá samstarfsaðilum." }
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
  var DRAWER_CODES = {
    legra:  { codes:["M", "K", "C", "F"], side:{ M:90.5, K:128.5, C:177, F:241 }, inner:["IK", "IM"] },
    merivo: { codes:["N", "M", "K", "E"], side:{ N:63, M:91, K:129, E:192 },     inner:["IM"] }
  };
  var FRONT_MIN = { N:85, M:110, K:150, E:212, C:197, F:261 };
  var FRONT_WEIGHT = { N:100, M:150, K:200, E:400, C:400, F:800 };
  var CODE_ORDER = "NMKECF"; // smallest → tallest; also the order Útfærslur combo keys use
  var DRAWER_GAP_MM = 3;
  var WIDE_DOOR_M = 0.6005; // a door unit wider than 600 mm is built with two doors
  // Board thickness of an open / articulated carcass: built from real 16 mm boards (sides, top, bottom) and a
  // thin back — it used to be the faces of one box, so the sides had no thickness at the front edge (2026-10-05)
  var CARCASS_T = 0.016, BACK_T = 0.008;

  // ---- Lighting (2026-10-05): LED under wall units, ATOM spots in open shelves, LED in the plinth ----
  // Each light = a small bright strip/spot + a soft additive "glow" plane on the surface it lights (cheap,
  // no real lights). MOOD = evening view: the room's own lights dim and the glows come up (view only).
  var MOOD = false, GLOW_TEX = null;
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
  function addCarcassBoards(THREE, parent, widthM, bodyH, bodyBase, depth, mat){
    var T = CARCASS_T, inner = widthM - 2 * T;
    function board(w, h, d, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
    board(T, bodyH, depth, -widthM / 2 + T / 2, bodyBase + bodyH / 2, depth / 2);   // sides
    board(T, bodyH, depth, widthM / 2 - T / 2, bodyBase + bodyH / 2, depth / 2);
    board(inner, T, depth - BACK_T, 0, bodyBase + bodyH - T / 2, BACK_T + (depth - BACK_T) / 2); // top + bottom, in front of the back
    board(inner, T, depth - BACK_T, 0, bodyBase + T / 2, BACK_T + (depth - BACK_T) / 2);
    board(inner, bodyH - 2 * T, BACK_T, 0, bodyBase + bodyH / 2, BACK_T / 2);          // back
  }
  // a sensible stack for N drawers when nothing has been picked (bottom → top)
  var DEFAULT_CODES = {
    legra:  { 1:["C"], 2:["C", "C"], 3:["F", "K", "M"], 4:["C", "K", "K", "M"] },
    merivo: { 1:["E"], 2:["E", "E"], 3:["E", "K", "M"], 4:["E", "K", "K", "M"] }
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
  // Inner drawers of a Búrskápur (bottom → top) from b.burCombo, a real BUR Útfærsla key like "MKCC".
  var BUR_DEFAULT = { legra:"MKCC", merivo:"MKEE" };
  function burCodesOf(b, sysKey){
    var sys = sysKey === "merivo" ? "merivo" : "legra", key = b.burCombo || BUR_DEFAULT[sys];
    return String(key).split("+")[0].split("").sort(function(a, c){ return CODE_ORDER.indexOf(c) - CODE_ORDER.indexOf(a); }).map(function(c){ return (CODE_SWAP[sys] && CODE_SWAP[sys][c]) || c; });
  }
  // a code from the other system → the nearest one in this system (switching Legra ↔ Merivo)
  var CODE_SWAP = { legra:{ N:"M", E:"C" }, merivo:{ C:"E", F:"E" } };
  // The drawer stack of a cabinet, bottom → top, in the kitchen's drawer system. Old drafts only
  // have a count — they get the default stack for that count.
  function drawerCodes(interior, sysKey){
    if (!interior || interior.mode !== "skuffur") return [];
    var sys = DRAWER_CODES[sysKey] ? sysKey : "legra";
    var codes = interior.codes && interior.codes.length ? interior.codes.slice()
      : (DEFAULT_CODES[sys][Math.max(1, Math.min(4, interior.count || 3))] || DEFAULT_CODES[sys][3]).slice();
    return codes.map(function(c){ return (CODE_SWAP[sys] && CODE_SWAP[sys][c]) || c; });
  }
  // Front heights (mm, bottom → top) for a stack in a body of bodyMm, or null when it doesn't fit.
  function drawerFrontsMm(codes, bodyMm){
    if (!codes.length) return [];
    var gaps = (codes.length - 1) * DRAWER_GAP_MM;
    var min = codes.reduce(function(a, c){ return a + (FRONT_MIN[c] || 150); }, 0);
    var spare = bodyMm - gaps - min;
    if (spare < -0.5) return null;
    var wsum = codes.reduce(function(a, c){ return a + (FRONT_WEIGHT[c] || 200); }, 0);
    return codes.map(function(c){ return (FRONT_MIN[c] || 150) + spare * (FRONT_WEIGHT[c] || 200) / wsum; });
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
      var sum = f.reduce(function(a, x){ return a + x; }, 0) + (codes.length - 1) * DRAWER_GAP_MM;
      var ok = Math.abs(sum - bodyMm) < 1.5 && f.every(function(h, i){ return h >= (FRONT_MIN[codes[i]] || 150) - 0.5; });
      if (ok) return f.slice();
    }
    return drawerFrontsMm(codes, bodyMm);
  }
  // Front i set to v mm: the other drawers give or take the difference, nearest first (the one above, then
  // below, ...), never going under their own minimum. null when it can't be done.
  function resizeFront(fronts, codes, i, v){
    var mins = codes.map(function(c){ return FRONT_MIN[c] || 150; });
    if (codes.length < 2 || v < mins[i] - 0.5) return null;
    var out = fronts.slice(), rem = v - out[i], order = [];
    out[i] = v;
    for (var d = 1; d < codes.length; d++){ if (i + d < codes.length) order.push(i + d); if (i - d >= 0) order.push(i - d); }
    for (var k = 0; k < order.length && Math.abs(rem) > 0.01; k++){
      var j = order[k];
      if (rem > 0){ var take = Math.min(rem, out[j] - mins[j]); out[j] -= take; rem -= take; }
      else { out[j] -= rem; rem = 0; }
    }
    return rem > 0.5 ? null : out.map(function(h){ return Math.round(h * 10) / 10; });
  }
  // seams as fractions of the body (bottom → top), like drawerFractions()
  function frontsToFractions(fronts, bodyMm){
    var out = [], acc = 0;
    fronts.slice(0, -1).forEach(function(h){ acc += h + DRAWER_GAP_MM / 2; out.push(acc / bodyMm); acc += DRAWER_GAP_MM / 2; });
    return out;
  }
  // Útfærslur combo key: letters in N M K E C F order, then "+IK"/"+IM" for an inner drawer
  function drawerComboKey(codes, inner){
    return codes.slice().sort(function(a, b){ return CODE_ORDER.indexOf(a) - CODE_ORDER.indexOf(b); }).join("") + (inner ? "+" + inner : "");
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
    legra:  { label:"Legra",  desc:"Skúffukerfi sem Björninn notar reglulega.", airtableName:"LEGRA" },
    merivo: { label:"Merivo", desc:"Annað skúffukerfi í boði hjá Birninum.",   airtableName:"MERIVO" }
  };

  // Room wall color (Phase 7e) — purely a visualization preference, not a
  // purchasable material (Björninn doesn't sell paint), so no Efnislisti
  // link like carcass/front — just a curated hex palette for the 3D/2D
  // preview. hvitt matches the historical fixed wall color.
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
  var WINDOW_DEFAULT = { widthMm:1200, heightMm:1000, sillHeightMm:900 };
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
    push:   { label:"Þrýstiopnun (Blum Tip-on)", img:"handles/push-open.jpg", desc:"Ekkert sýnilegt handfang eða grip — ýtt létt á framhliðina til að opna", vorulistiId:null, isPushOpen:true }
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
  function handleFinishFor(handleKey, colorKey){
    var h = HANDLES[handleKey];
    return h && !h.fixedColor && h.group !== "an" && colorKey && HANDLE_FINISHES[colorKey] ? HANDLE_FINISHES[colorKey] : null;
  }
  var handleFinish = null;
  var TOPS = {};
  Object.keys(KPCAT.tops).forEach(function(k){ TOPS[k] = KPCAT.tops[k]; });

  // EGGER decors Björninn actually stocks (2026-10-01): kitchen-planner-egger.js is generated by
  // tools/egger-sync.py from Efnislisti + egger.com's own "Raport" (CAD repeat) images. They replace the
  // site-photo Viðarlíki / Framhliðaefni fronts and Harðplast worktops in the pickers — old keys stay,
  // hidden, so drafts and submissions still render — and each one carries its real Efnislisti id, so the
  // pick links straight to the board on the Tækifæri. One raport tile ≈ 1.3 × 2.8 m (checked against the
  // plank widths of Halifax oak); a 600 mm front shows a ~half-tile-wide slice of it, as on a real board.
  var KPEG = window.KPEGGER || { decors:{} };
  var EGGER_TILE = { w:1.3, h:2.8 };
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
        tex:d.kind === "uni" ? null : d.tex, tile:EGGER_TILE
      };
      if (tp) TOPS["eg_" + code] = { label:label, code:code, egger:true, search:search, group:"hardplast", img:d.thumb, tex:d.tex, tile:EGGER_TILE, color3d:d.color || "#cccccc", efnislistiId:tp.id };
    });
    if (Object.keys(LOOKS).some(function(k){ return LOOKS[k].category === "steinaferd"; })){
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

  function wallGeometry3D(walls){
    function m(mm){ return mm / 1000; }
    var geoms = [];
    var origin = { x:0, z:0 };
    var axis = { x:1, z:0 };
    walls.forEach(function(w){
      var normal = normalFromAxis(axis);
      var lenM = m(w.lengthMm);
      geoms.push({ origin:{ x:origin.x, z:origin.z }, axis:axis, normal:normal, lenM:lenM });
      var end = { x: origin.x + axis.x * lenM, z: origin.z + axis.z * lenM };
      if (w.turnAfter === "left" || w.turnAfter === "right"){
        axis = rotate90(axis, w.turnAfter);
      }
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
  function surfaceGeoms(state){ return wallGeoms(state).concat(islandGeoms(state)); }
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
    if (walls[wallIndex] && walls[wallIndex].island) return 0; // free-standing rows have no corner
    var prevIdx = wallIndex > 0 ? wallIndex - 1 : -1;
    if (prevIdx < 0 && walls.closed){ // closed room: the last real wall meets the first
      prevIdx = walls.length - 1;
      while (prevIdx > 0 && walls[prevIdx].island) prevIdx--;
    }
    if (prevIdx < 0 || prevIdx === wallIndex) return 0;
    var prev = walls[prevIdx];
    if (prev.turnAfter !== "left" || prev.open || (walls[wallIndex] && walls[wallIndex].open)) return 0; // outward (reflex) corners and open edges have no clash
    var prevLast = prev.floor[prev.floor.length - 1];
    if (!prevLast) return 0;
    var cur = walls[wallIndex];
    // (No exemption for Töfrahorn any more: it is drawn as a plain 1200 × 600 box,
    // so the neighbouring wall's run has to start after its depth like any cabinet.)
    return prevLast.depthMm || CATALOG[prevLast.type].d;
  }

  // Áfella (19 mm filler) between a cabinet run and a wall face it would otherwise touch (user, 2026-10-02):
  // a run may not stand flush against a wall — placement keeps AFELLA_MM free at a wall end, and the 3D
  // draws a filler in the front material there (worktop over it) when a cabinet sits right at that limit.
  // A wall "end" is solid when the neighbouring wall turns inwards (left) and isn't an open edge. At the
  // start of a floor run that already begins after the previous wall's cabinets (corner clearance), the run
  // meets their side panel, not the wall — no áfella there.
  var AFELLA_MM = 19;
  function realWallCount(walls){ var n = 0; while (n < walls.length && !walls[n].island) n++; return n; }
  function afellaMm(walls, wallIndex, zoneKey){
    var w = walls[wallIndex], n = realWallCount(walls);
    if (!w || w.island || w.open || wallIndex >= n) return { start:0, end:0 };
    var prev = wallIndex > 0 ? walls[wallIndex - 1] : walls.closed ? walls[n - 1] : null;
    var next = wallIndex < n - 1 ? walls[wallIndex + 1] : walls.closed ? walls[0] : null;
    var startSolid = !!prev && prev !== w && prev.turnAfter === "left" && !prev.open;
    var endSolid = !!next && next !== w && w.turnAfter === "left" && !next.open;
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
  function fitWarnings(state){
    var out = [], byMsg = {}, roomH = state.roomHeightMm || 2600;
    function add(msg, ids){
      var w = byMsg[msg];
      if (!w){ w = byMsg[msg] = { msg:msg, ids:[], count:0 }; out.push(w); }
      w.count++;
      ids.forEach(function(id){ if (w.ids.indexOf(id) < 0) w.ids.push(id); });
    }
    function acc(label){ return label.replace(/^Veggur/, "vegg"); } // "á vegg 1"
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
          add(b2.c.label + " rekst á " + a.c.label.toLowerCase() + " á " + acc(wall.label) + ".", [a.b.id, b2.b.id]);
        });
      });
      var ops = (state.windows || []).filter(function(o){ return o.wallId === wall.id; }).map(function(o){ return { kind:"gluggi", o:o, lo:o.sillHeightMm, hi:o.sillHeightMm + o.heightMm }; })
        .concat((state.doors || []).filter(function(o){ return o.wallId === wall.id; }).map(function(o){ return { kind:o.gap ? "op" : "hurð", o:o, lo:0, hi:o.heightMm }; }));
      spans.forEach(function(sp){
        ops.forEach(function(op){
          var hOverlap = Math.min(sp.to, op.o.offsetMm + op.o.widthMm) - Math.max(sp.from, op.o.offsetMm);
          var vOverlap = Math.min(sp.hi, op.hi) - Math.max(sp.lo, op.lo);
          if (hOverlap > 20 && vOverlap > 20){
            add(sp.c.label + " skarast við " + (op.kind === "gluggi" ? "glugga" : op.kind === "op" ? "op í vegg" : "hurð") + " á " + acc(wall.label) + ".", [sp.b.id, op.o.id]);
          }
        });
        if (sp.rawH > roomH) add(sp.c.label + " á " + acc(wall.label) + " er hærri en loftið (" + roomH + " mm).", [sp.b.id]);
      });
    });
    out.forEach(function(w){ if (w.count > 1) w.msg = w.msg.replace(/\.$/, "") + " (" + w.count + " skápar)."; });
    islandWarnings(state, function(msg, ids){ out.push({ msg:msg, ids:ids, count:1 }); });
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
              push(isl.label + ": " + m.label.toLowerCase() + " skarast við " + o.label.toLowerCase() + " (" + name + ").", [m.id, o.id]);
              return;
            }
            var d = dist(m, o), cur = byTarget[key];
            if (!cur || d < cur.d) byTarget[key] = { d:d, name:name, ids:[m.id] };
          });
        });
      });
      Object.keys(byTarget).forEach(function(k){
        var t = byTarget[k];
        if (t.d < WALKWAY_MM) push("Aðeins " + Math.round(t.d) + " mm gangur á milli " + isl.label + " og " + t.name + " — mælt er með " + WALKWAY_MM + " mm eða meira.", t.ids);
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
      if (gp.hM < wallHeightM - 0.01) pieces.push([a, b, gp.hM, wallHeightM]); // header over the opening
      pos = b;
    });
    if (geom.lenM > pos + 0.001) pieces.push([pos, geom.lenM, 0, wallHeightM]);
    var mesh = null;
    // The room face sits 1.5 mm BEHIND the wall line: cabinet backs and the
    // skirting stand exactly on the line, and a shared plane made them z-fight
    // with the wall (flickering backs, worst through a faded wall).
    var back = WALL_THICKNESS_M / 2 + 0.0015;
    pieces.forEach(function(pc){
      var m = new THREE.Mesh(new THREE.BoxGeometry(pc[1] - pc[0], pc[3] - pc[2], WALL_THICKNESS_M), wallMat);
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
    bar(widthM, fw, 0.05, 0, baseYM + heightM - fw / 2, fo);                       // head
    bar(fw, heightM, 0.05, -(widthM / 2 - fw / 2), baseYM + heightM / 2, fo);      // left jamb
    bar(fw, heightM, 0.05, widthM / 2 - fw / 2, baseYM + heightM / 2, fo);         // right jamb
    if (!isDoor){
      bar(widthM, fw, 0.05, 0, baseYM + fw / 2, fo);                               // window base rail
      bar(0.035, heightM - 2 * fw, 0.04, 0, baseYM + heightM / 2, fo);             // centre mullion
      bar(widthM + 0.12, 0.035, 0.13, 0, baseYM - 0.0175, 0.065);                  // sill
    } else {
      var handleMat = new THREE.MeshStandardMaterial({ color:0x55575a, metalness:0.7, roughness:0.35 });
      bar(0.14, 0.02, 0.04, widthM / 2 - 0.1, 1.0, 0.04, handleMat);               // lever handle
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
    var n = 0;
    [MODEL_CACHE, RAW_CACHE].forEach(function(c){ Object.keys(c).forEach(function(k){ if (c[k].state === "loading") n++; }); });
    return n;
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
  function addFrontDetails(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta, frontMat){
    var n0 = group.children.length;
    addFrontDetailsInner.apply(null, arguments);
    if (meta && meta.oven) return;
    group.children.slice(n0).forEach(function(o){ o.__frontDetail = true; });
  }
  function addFrontDetailsInner(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta, frontMat){
    if (meta && meta.open) return; // open shelves have no fronts
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    var drawers = interior && interior.mode === "skuffur" ? interior.count : 0;
    var isOven = !!(meta && meta.oven);
    // Töfrahorn: ONE door, on the left or right half of the front; the other half is a fixed blind panel
    var isCorner = !!(meta && meta.corner), hw = isCorner ? widthM / 2 : widthM, hOff = isCorner ? (meta.doorSide === "left" ? -widthM / 4 : widthM / 4) : 0;
    var fronts = [];
    if (drawers){
      var fr = interior.fractions && interior.fractions.length === drawers - 1 ? interior.fractions : null;
      for (var i = 0; i < drawers; i++) fronts.push({ y0:fr ? (i === 0 ? 0 : fr[i - 1]) : i / drawers, y1:fr ? (i === drawers - 1 ? 1 : fr[i]) : (i + 1) / drawers, drawer:true });
    }
    else if (isTall && !isOven && meta && meta.washerDrawerM){ // washer tower: a drawer at the bottom, two doors above
      var wd = meta.washerDrawerM / heightM, sp2 = wd + (1 - wd) * 0.5;
      fronts.push({ y0:0, y1:wd, drawer:true }, { y0:wd, y1:sp2 }, { y0:sp2, y1:1 });
    }
    else if (isTall && !isOven){ fronts.push({ y0:0, y1:split }, { y0:split, y1:1 }); }
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
      var ovCodes = (meta && meta.ovenCodes) || [], oh = 0.595;
      var zoneH = meta && meta.lowOven ? Math.max(0.05, heightM - oh) : ovenZoneMm(ovCodes) / 1000, oy = baseYM + zoneH;
      var ovFr = meta && meta.lowOven ? [zoneH * 1000] : ovCodes.length ? stackFrontsMm({ frontsMm:meta && meta.ovenFrontsMm }, ovCodes, zoneH * 1000) : null;
      var glassMat = new THREE.MeshPhysicalMaterial({ color:0x0c0d0f, roughness:0.06, metalness:0.1, clearcoat:1, clearcoatRoughness:0.03 }); // dark glass that mirrors the room
      [oy, oy + oh].forEach(function(y){ place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), y, 0.004); });
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, oh - 0.13, 0.012), glassMat), oy + (oh - 0.13) / 2 + 0.005, 0.006);
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.94, oh - 0.006, 0.006), new THREE.MeshStandardMaterial({ color:0x9fa4aa, roughness:0.3, metalness:0.9 })), oy + oh / 2, 0.003); // steel frame behind the glass
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, 0.06, 0.012), new THREE.MeshStandardMaterial({ color:0x2b2c30, roughness:0.4, metalness:0.4 })), oy + oh - 0.05, 0.006);
      [-0.22, -0.15, 0.15, 0.22].forEach(function(f){ var kn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 20), new THREE.MeshStandardMaterial({ color:0xb7bcc2, roughness:0.25, metalness:0.95 })); kn.rotation.x = Math.PI / 2; place(kn, oy + oh - 0.05, 0.02, widthM * f); });
      place(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 0.002), new THREE.MeshBasicMaterial({ color:0x0b0b0c })), oy + oh - 0.05, 0.013); // display
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.7, 0.018, 0.028), handleMat), oy + oh - 0.105, 0.024);
      var tops = [];
      if (ovFr){ // seams between the drawers under the oven; a handle at the top of each
        var accY = baseYM;
        ovFr.forEach(function(h, i){
          accY += h / 1000 + (i < ovFr.length - 1 ? DRAWER_GAP_MM / 1000 : 0);
          tops.push(accY);
          if (i < ovFr.length - 1) place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), accY - DRAWER_GAP_MM / 2000, 0.004);
        });
      } else tops.push(oy);
      if (handleKey && hstyle !== "none" && hstyle !== "groove"){
        tops.forEach(function(t){ hbar(Math.min(0.24, widthM * 0.5), t - 0.04, 0); }); // drawers / door below the oven
        if (!(meta && meta.lowOven)) hbar(Math.min(0.24, widthM * 0.5), oy + oh + 0.06, 0); // door above
      }
      return;
    }

    // Door units wider than 600 mm get two doors (user, 2026-10-02 — was ≥ 750): a centre seam.
    var wideDoor = !drawers && widthM > WIDE_DOOR_M && !(meta && meta.fridge) && !isCorner;
    if (wideDoor || isCorner){
      place(new THREE.Mesh(new THREE.PlaneGeometry(0.008, heightM * 0.97), seamMat), baseYM + heightM / 2, 0.004);
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
      if (vertical && !(hcfg && hcfg.kind === "hexxa") && !(hcfg && hcfg.file)){ // plain vertical versions of the drawn handles
        var vy = (top + bottom) / 2;
        if (hstyle === "bar"){ var vl = Math.min(hdef.len || 0.24, doorH * 0.6); sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.012, vl, 0.02), handleMat), vy, 0.012, edgeAlong(sg, 0.05)); }); return; }
        if (hstyle === "edge"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.02, doorH * 0.94, 0.016), handleMat), vy, 0.008, edgeAlong(sg, 0.012)); }); return; }
        if (hstyle === "tab"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.03, hdef.len || 0.14, 0.02), handleMat), vy, 0.01, edgeAlong(sg, 0.02)); }); return; }
        if (hstyle === "groove"){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.006, doorH * 0.9, 0.002), seamMat), vy, 0.002, edgeAlong(sg, 0.012)); }); return; }
      }
      if (hcfg && hcfg.kind === "hexxa"){ // milled into the front, no fixed width: equal distance to both sides
        var hm2 = (hcfg.marginMm || 50) / 1000, dark = new THREE.MeshStandardMaterial({ color:0x18181a, roughness:0.6 });
        if (vertical){ sides.forEach(function(sg){ place(new THREE.Mesh(new THREE.BoxGeometry(0.012, Math.max(0.05, doorH - 2 * hm2), 0.0015), dark), (top + bottom) / 2, 0.0008, edgeAlong(sg, 0.02)); }); }
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
            var rot = new THREE.Group(), lift = new THREE.Group(), h2 = new THREE.Group();
            lift.position.y = jp.userData.size.h; lift.add(jp.clone(true)); rot.add(lift);
            rot.rotation.z = sg > 0 ? Math.PI / 2 : -Math.PI / 2; h2.add(rot);
            place(h2, (top + bottom) / 2, jout, twoLeaf ? 0 : sg * hw / 2 + hOff);
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
        var leafW = twoLeaf ? hw / 2 : hw, tlen = pickHandleLenM(hcfg, leafW - 0.06), tpf = handleProfile(THREE, handleKey, tlen);
        if (tpf){
          if (vertical){ // tall units: an edge pull on the free side, at chest height
            var vyc = Math.max(bottom + 0.12, Math.min(top - 0.12, 1.05));
            sides.forEach(function(sg){ var rotT = new THREE.Group(), hT = new THREE.Group(); rotT.add(tpf.clone(true)); rotT.rotation.z = sg > 0 ? -Math.PI / 2 : Math.PI / 2; hT.add(rotT); place(hT, vyc, 0, twoLeaf ? 0 : sg * hw / 2 + hOff); });
          } else {
            var centres = twoLeaf ? [-hw / 4, hw / 4] : [hOff];
            centres.forEach(function(cxT){ var rotB = new THREE.Group(), hB = new THREE.Group(); rotB.add(tpf.clone(true)); if (atBottom !== !!hcfg.flip) rotB.rotation.z = Math.PI; hB.add(rotB); place(hB, atBottom ? bottom + (hcfg.dropMm || 0) / 1000 : top - (hcfg.dropMm || 0) / 1000, -(hcfg.embedMm || 0) / 1000, cxT); }); // wall units: on the bottom edge, upside down
          }
          return;
        }
      }
      if (hcfg && hcfg.kind === "bar" && hcfg.file){ // a real pull screwed onto the face: centred, upright on tall units
        var leafB = twoLeaf ? hw / 2 : hw, fitB = pickHandleLenM(hcfg, leafB - 2 * (hcfg.fitMarginMm || 60) / 1000);
        var bp = handleProfile(THREE, handleKey, Math.max(0.05, fitB));
        if (bp){
          if (vertical){ var vyb = Math.max(bottom + 0.12, Math.min(top - 0.12, 1.05)); sides.forEach(function(sg){ var rot2 = new THREE.Group(), g2 = new THREE.Group(); rot2.add(bp.clone(true)); rot2.rotation.z = Math.PI / 2; g2.add(rot2); place(g2, vyb, 0, edgeAlong(sg, 0.05)); }); }
          else (twoLeaf ? [-hw / 4, hw / 4] : [hOff]).forEach(function(cxB){ var rotB = new THREE.Group(), gB = new THREE.Group(); rotB.add(bp.clone(true)); gB.add(rotB); place(gB, atBottom ? bottom + 0.06 : hy, 0, cxB); });
          return;
        }
      }
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
    var art = !!(meta && (meta.locked || meta.slabFronts) && meta.openMat && !meta.fixedFronts && !meta.open && !meta.panel && meta.zone !== "opening");
    var bodyD = art ? depthM - FRONT_T : depthM;
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * (bodyD / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * (bodyD / 2);
    // Floor units stand on a recessed plinth (sökkull): the body starts 100 mm
    // up and a dark, set-back block fills the gap, as in a real kitchen.
    var plinthM = meta && meta.plinth ? 0.1 : 0;
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
    if (selected){
      useFrontMat = frontMat.clone();
      useFrontMat.emissive = new THREE.Color(SELECT_COLOR);
      useFrontMat.emissiveIntensity = 0.35;
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
    group.add(edges);
    if (meta) meta.edgesObj = edges;
    if (meta && meta.zone !== "opening"){ // back-face fade (see fadeCabinets in buildScene)
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

    if (plinthM && meta && meta.plinthMat){
      // a hair shorter than the gap so its top never shares a plane with the body's underside (z-fighting showed through an open cabinet)
      var plGeo = new THREE.BoxGeometry(widthM - 0.004, plinthM - 0.004, depthM - 0.063);
      var plFace = Array.isArray(meta.plinthMat) ? meta.plinthMat[4] : meta.plinthMat;
      scaleFrontUV(plGeo, widthM, plinthM, plFace.userData && plFace.userData.tile); // the plinth's front is clad in the front material
      var pl = new THREE.Mesh(plGeo, meta.plinthMat);
      pl.position.copy(local(0, baseYM + (plinthM - 0.004) / 2, 0.003 + (depthM - 0.063) / 2)); // 3 mm off the wall line so its back face never shares a plane with the skirting/wall
      pl.quaternion.copy(quat);
      pl.receiveShadow = true;
      group.add(pl);
    }
    if (meta && meta.counter && meta.stoneMat){
      var sinkHole = meta.sink ? sinkSize(widthM, depthM) : null;
      var topGeo = sinkHole ? worktopWithHole(THREE, widthM + 0.001, 0.032, depthM + 0.02, sinkHole) : new THREE.BoxGeometry(widthM + 0.001, 0.032, depthM + 0.02);
      worktopUV(topGeo, meta.stoneMat.userData && meta.stoneMat.userData.tile, meta.stoneMat.userData && meta.stoneMat.userData.rotateTex, offsetM + widthM / 2);
      var top = new THREE.Mesh(topGeo, meta.stoneMat);
      // 1 mm proud of the carcass top: an open (articulated) carcass shows its top board from inside, and a
      // worktop underside in the very same plane z-fought with it (striped, 2026-10-02)
      top.position.copy(local(0, baseYM + heightM + 0.017, (depthM + 0.02) / 2));
      top.quaternion.copy(quat);
      top.castShadow = true; top.receiveShadow = true;
      group.add(top);
      if (meta.sink) addSink(THREE, group, local, quat, widthM, depthM, baseYM + heightM + 0.032);
    }

    if (art || isOpen){ // the carcass as real boards, in the cabinet's own frame (x along the wall, z out of it)
      var cframe = new THREE.Group();
      cframe.position.set(geom.origin.x + geom.axis.x * (offsetM + widthM / 2), 0, geom.origin.z + geom.axis.z * (offsetM + widthM / 2));
      cframe.quaternion.copy(quat);
      addCarcassBoards(THREE, cframe, widthM, bodyH, bodyBase, art ? depthM - FRONT_T : depthM, meta.openMat);
      cframe.traverse(function(o){ if (o.isMesh) o.userData = meta; }); // a click on a board = a click on the cabinet
      group.add(cframe);
    }
    if (isOpen){ // shelf boards
      for (var sh = 1; sh <= (meta.shelves || 0); sh++){
        var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, depthM - 0.02), meta.openMat); // side to side (user, 2026-10-05)
        board.position.copy(local(0, bodyBase + bodyH * sh / ((meta.shelves || 0) + 1), (depthM - 0.02) / 2 + 0.005));
        board.quaternion.copy(quat); board.castShadow = true; board.receiveShadow = true;
        group.add(board);
      }
    }
    if (interior && interior.mode === "skuffur" && !art){
      addDrawerSeams(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior.count, interior.fractions);
    }
    if (meta && meta.locked && !meta.suppressBadge && meta.zone !== "opening") addLockBadge(THREE, group, local(0, baseYM + heightM + (meta.counter ? 0.16 : 0.1), depthM / 2));
    if (art) addArticulated(THREE, scene, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta, useFrontMat, pickables);
    else if (meta && meta.zone !== "opening" && !isPanel && !meta.appliance) addFrontDetails(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta.handle, !!meta.tall, meta.zone === "wall", meta.split || 0.55, meta, useFrontMat);
    if (meta && meta.appliance) addApplianceDetails(THREE, group, geom, offsetM, widthM, heightM, depthM, meta.appliance);
    return group;
  }
  // A free-standing fridge (steel; side by side doors when ≥ 850 mm) or washer (white, porthole door) drawn on
  // its box — these are spaces for the customer's own appliance, not Björninn products.
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
    } else if (kind === "washer"){
      var r = Math.min(widthM, heightM) * 0.27, cy = heightM * 0.45;
      put(new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 12, 48), new THREE.MeshStandardMaterial({ color:0xb8bcc2, metalness:0.7, roughness:0.3 })), 0, cy, 0.015);
      put(new THREE.Mesh(new THREE.CircleGeometry(r - 0.012, 40), new THREE.MeshStandardMaterial({ color:0x3a4550, roughness:0.08, metalness:0.2, transparent:true, opacity:0.85 })), 0, cy, 0.012);
      put(new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.04, 0.09, 0.01), new THREE.MeshStandardMaterial({ color:0xe4e6e8, roughness:0.5 })), 0, heightM - 0.07, 0.005);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 24), dark).rotateX(Math.PI / 2), widthM * 0.3, heightM - 0.07, 0.012);
    }
  }

  // Small padlock floating over a locked cabinet.
  var LOCK_TEX = null;
  function addLockBadge(THREE, group, pos){
    if (!LOCK_TEX){
      var cv = document.createElement("canvas"); cv.width = cv.height = 96;
      var cx = cv.getContext("2d");
      cx.fillStyle = "rgba(25,25,25,.9)"; cx.beginPath(); cx.arc(48, 48, 46, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = "#f5c518"; cx.lineWidth = 7; cx.lineCap = "round";
      cx.beginPath(); cx.moveTo(35, 46); cx.lineTo(35, 36); cx.arc(48, 36, 13, Math.PI, 0); cx.lineTo(61, 46); cx.stroke(); // shackle
      cx.fillStyle = "#f5c518"; cx.beginPath(); cx.roundRect ? cx.roundRect(28, 44, 40, 30, 6) : cx.rect(28, 44, 40, 30); cx.fill(); // body
      cx.fillStyle = "#191919"; cx.beginPath(); cx.arc(48, 57, 4.5, 0, Math.PI * 2); cx.fill(); cx.fillRect(46, 57, 4, 10);
      LOCK_TEX = new THREE.CanvasTexture(cv); LOCK_TEX.userData = { keep:true };
    }
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:LOCK_TEX, depthTest:false, transparent:true }));
    sp.scale.set(0.11, 0.11, 1); sp.position.copy(pos); sp.renderOrder = 9;
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
    if (p.kind === "drawer") p.group.position.z = p.slide * e;
    else p.group.rotation.y = (p.hinge === "left" ? -1 : 1) * 1.75 * e;
  }
  function stepParts(scene){
    (scene.userData.parts || []).forEach(function(p){
      if (p.cur === p.target) return;
      p.cur += (p.target - p.cur) * 0.14;
      if (Math.abs(p.target - p.cur) < 0.002) p.cur = p.target;
      applyPart(p);
    });
  }
  function togglePart(key){
    if (!THREE_STATE) return;
    var p = (THREE_STATE.scene.userData.parts || []).find(function(x){ return x.key === key; });
    if (!p) return;
    p.target = p.target ? 0 : 1;
    PART_STATE[key] = p;
  }

  // Open (1) or close (0) every drawer and door in the scene at once ("Opna allt" in inspect mode)
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
    var nShelves = drawers ? 0 : (meta.shelves || 0);
    for (var sh = 1; sh <= nShelves; sh++){
      var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, CD - 0.03), meta.openMat); // shelves reach the sides
      board.position.set(0, bodyBase + bodyH * sh / (nShelves + 1), (CD - 0.03) / 2 + 0.005);
      board.castShadow = true; board.receiveShadow = true;
      frame.add(board);
    }
    // the fronts of this cabinet
    var fronts = [];
    if (drawers){
      var fr = interior.fractions && interior.fractions.length === drawers - 1 ? interior.fractions : null;
      for (var i = 0; i < drawers; i++) fronts.push({ y0:fr ? (i === 0 ? 0 : fr[i - 1]) : i / drawers, y1:fr ? (i === drawers - 1 ? 1 : fr[i]) : (i + 1) / drawers, drawer:true });
    } else if (meta.tall && !meta.corner){ var sp = meta.split || 0.55; fronts.push({ y0:0, y1:sp }, { y0:sp, y1:1 }); }
    else fronts.push({ y0:0, y1:1 });
    var sysKey = meta.drawerSystem || "legra";
    var dcodes = drawers && interior.codes && interior.codes.length === drawers ? interior.codes : null; // bottom → top
    var wide = !drawers && widthM > WIDE_DOOR_M && !meta.fridge && !meta.corner;
    var parts = (scene.userData.parts = scene.userData.parts || []);

    function makeLeaf(idx, cxL, w, y0, y1, hinge, f, fi){
      var key = meta.blockId + ":" + idx;
      var g = new THREE.Group(), pivotX = f.drawer || hinge === "bottom" ? cxL : (hinge === "left" ? cxL - w / 2 : cxL + w / 2), fh = y1 - y0;
      g.position.set(pivotX, 0, 0);
      var pmeta = Object.assign({}, meta, { isPart:true, partKey:key }), meshes = [];
      var hcfgA = meta.handle && window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[meta.handle];
      var hstyleA = (HANDLES[meta.handle] || {}).style;
      var vertA = !!(meta.tall && !f.drawer && !meta.corner && hstyleA !== "knob");
      var freeSideA = hinge === "left" ? "right" : "left", stripA = hcfgA && hcfgA.kind === "jey" ? (hcfgA.stripMm || 27) / 1000 : 0;
      // a Jey profile REPLACES stripMm of the front: the slab is that much shorter (top strip) or narrower (side strip on tall units)
      var slabW = w - 0.004 - (vertA ? stripA : 0), slabH = fh - (vertA ? 0 : stripA);
      var notchA = hcfgA && hcfgA.kind === "hexxa" && !vertA ? { len:Math.max(0.05, slabW - 2 * (hcfgA.marginMm || 50) / 1000), h:0.03 } : null;
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
        addFrontDetails(THREE, tmp, fake, 0, w, fh, y0, depthM, { mode:"skuffur", count:1 }, meta.handle, false, meta.zone === "wall" || (meta.tall && fi > 0 && !f.drawer), 0.55, { vertical:vertA, freeSide:freeSideA, slab:true }, frontMat);
        tmp.children.slice().forEach(function(ch){ ch.position.x -= pivotX; g.add(ch); if (ch.isMesh) meshes.push(ch); else ch.traverse(function(o){ if (o.isMesh) meshes.push(o); }); });
      }
      if (f.drawer){
        var code = dcodes ? dcodes[fi] : null, sysD = DRAWER_CODES[sysKey];
        var side = code && sysD && sysD.side[code] ? sysD.side[code] : Math.max(50, Math.min(200, Math.round(fh * 1000 - 55)));
        side = Math.max(40, Math.min(side, fh * 1000 - 40));
        var real = code ? getModel("drawers", sysKey + "_" + code) : null, bx;
        if (real){
          var rb = new THREE.Box3().setFromObject(real), rs = rb.getSize(new THREE.Vector3());
          bx = new THREE.Group(); real.position.set(0, 0, -rb.max.z); bx.add(real);
          bx.position.set(0, drawerBoxY(y0, y1, rs.y), CD - 0.005);
        } else {
          bx = buildDrawerBox(THREE, sysKey, meta.carcassKey, side, Math.max(0.2, widthM - 2 * T - 0.026), Math.max(0.2, Math.min(0.5, CD - 0.06)), code);
          bx.position.set(0, drawerBoxY(y0, y1, side / 1000), CD - 0.005);
        }
        if (interior && interior.inner && fi === drawers - 1 && fh > 0.2){ // inner drawer (innskúffa) behind the top front: a low drawer riding in the upper part of the tall one
          var innerCode = interior.inner === "IK" ? "K" : "M", innerSide = (sysD && sysD.side[innerCode]) || 90;
          var ib = buildDrawerBox(THREE, sysKey, meta.carcassKey, innerSide, Math.max(0.18, widthM - 2 * T - 0.06), Math.max(0.2, Math.min(0.46, CD - 0.1)), null);
          ib.position.set(0, Math.max(bx.position.y + 0.02, drawerBoxY(y0, y1, side / 1000) + side / 1000 - 0.012 - innerSide / 1000), CD - 0.045); // in the upper part of the tall drawer
          g.add(ib); ib.traverse(function(o){ if (o.isMesh) meshes.push(o); });
        }
        g.add(bx); bx.traverse(function(o){ if (o.isMesh) meshes.push(o); });
        if (bx.userData && bx.userData.runners){ var rgR = bx.userData.runners; rgR.position.copy(bx.position); frame.add(rgR); } // runners stay in the cabinet
      }
      if (!f.drawer){ // a door hinges on the FRONT edge of the carcass (not at the wall): move the pivot forward to z = CD
        g.children.forEach(function(ch){ ch.position.z -= CD; });
        g.position.z = CD;
        if (hinge === "bottom"){ g.children.forEach(function(ch){ ch.position.y -= y0; }); g.position.y = y0; } // a flap pivots on its lower edge
      }
      meshes.forEach(function(m){ m.userData = pmeta; pickables.push(m); });
      var prev = PART_STATE[key];
      var part = { key:key, group:g, kind:f.drawer ? "drawer" : hinge === "bottom" ? "flap" : "door", hinge:hinge, slide:Math.min(0.34, CD * 0.6), cur:prev ? prev.cur : 0, target:prev ? prev.target : 0 };
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
      [[tb + 0.06, 0.2], [tb + th * 0.55, 0.15]].forEach(function(r){ // lower + upper basket: rim, floor rods, tines
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
      frame.add(racks);
      makeLeaf(idx++, 0, widthM, bodyBase + 0.0015, bodyBase + bodyH - 0.0015, "bottom", { y0:0, y1:1 }, 0);
      var dwPart = parts[parts.length - 1]; dwPart.racks = racks; dwPart.racksOut = td * 0.8; applyPart(dwPart);
      return;
    }

    // Ofnaskápur: the real Útfærsla — drawers (or a door, OFN7) under the oven, the oven, and a cabinet above
    // it with two vent shelves behind its door
    if (meta.oven){
      var ovCodesA = meta.ovenCodes || [], zoneMm = meta.lowOven ? Math.max(50, bodyH * 1000 - 595 - 3) : ovenZoneMm(ovCodesA);
      var ovFrA = meta.lowOven ? [zoneMm] : ovCodesA.length ? stackFrontsMm({ frontsMm:meta.ovenFrontsMm }, ovCodesA, zoneMm) : null;
      var ovY = bodyBase + zoneMm / 1000, ovH = 0.595, wideA = widthM > WIDE_DOOR_M, hingeA = meta.hingeRight ? "right" : "left";
      if (ovFrA){
        dcodes = ovCodesA;
        var accA = bodyBase;
        ovFrA.forEach(function(h, i){ makeLeaf(idx++, 0, widthM, accA + 0.0015, accA + h / 1000 - 0.0015, "left", { drawer:true }, i); accA += h / 1000 + DRAWER_GAP_MM / 1000; });
        if (meta.ovenInner){ // "+IM"/"+IK": an inner drawer riding inside the top drawer (OFN2)
          var topPart = parts[parts.length - 1], sysO = DRAWER_CODES[sysKey], iCode = meta.ovenInner === "IK" ? "K" : "M", iSide = (sysO && sysO.side[iCode]) || 90;
          var ibO = buildDrawerBox(THREE, sysKey, meta.carcassKey, iSide, Math.max(0.18, widthM - 2 * T - 0.06), Math.max(0.2, Math.min(0.46, CD - 0.1)), null);
          ibO.position.set(0, accA - DRAWER_GAP_MM / 1000 - 0.02 - iSide / 1000, CD - 0.045);
          topPart.group.add(ibO);
          var pmO = Object.assign({}, meta, { isPart:true, partKey:topPart.key });
          ibO.traverse(function(o){ if (o.isMesh){ o.userData = pmO; pickables.push(o); } });
        }
      } else makeLeaf(idx++, 0, widthM, bodyBase + 0.0015, ovY - 0.0015, hingeA, { y0:0, y1:1 }, 0);
      // the oven itself: dark body in the niche, glass door, control strip, bar handle
      var dark = new THREE.MeshStandardMaterial({ color:0x1c1d20, roughness:0.4, metalness:0.4 });
      addBox(widthM - 2 * CARCASS_T - 0.004, ovH - 0.004, CD - 0.02, 0, ovY + ovH / 2, (CD - 0.02) / 2 + 0.01, dark);
      addBox(widthM - 0.006, ovH - 0.13, FRONT_T, 0, ovY + (ovH - 0.13) / 2 + 0.004, CD + FRONT_T / 2, new THREE.MeshStandardMaterial({ color:0x141518, roughness:0.12, metalness:0.5 }));
      addBox(widthM - 0.006, 0.115, FRONT_T, 0, ovY + ovH - 0.06, CD + FRONT_T / 2, new THREE.MeshStandardMaterial({ color:0x2b2c30, roughness:0.4, metalness:0.4 }));
      addBox(widthM * 0.7, 0.018, 0.028, 0, ovY + ovH - 0.145, CD + FRONT_T + 0.014, new THREE.MeshStandardMaterial({ color:0xb9bec4, metalness:0.85, roughness:0.28 }));
      if (meta.lowOven) return; // low oven (OFN6): the oven sits right under the worktop, nothing above
      // cabinet above: a fixed shelf right on top of the oven, then 2 vent shelves (loftunarhillur) — each
      // with one slot through it at the back: 60 mm from the back, 100 mm in from both sides, 60 mm wide
      // (user, 2026-10-05). Every shelf reaches the carcass sides.
      var upY0 = ovY + ovH + 0.003, upY1 = bodyBase + bodyH, shW = widthM - 2 * CARCASS_T - 0.001, shD = CD - 0.02 - BACK_T;
      addBox(shW, 0.018, shD, 0, ovY + ovH + 0.009, BACK_T + shD / 2 + 0.001, meta.openMat);
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
      for (var vs = 1; vs <= 2; vs++){
        var vm = new THREE.Mesh(ventGeo, meta.openMat), vy = upY0 + (upY1 - upY0) * vs / 3;
        vm.position.set(0, vy + 0.009, BACK_T + 0.001); vm.castShadow = true; vm.receiveShadow = true; frame.add(vm);
      }
      if (wideA){
        makeLeaf(idx++, -widthM / 4, widthM / 2, upY0 + 0.0015, upY1 - 0.0015, "left", { y0:0, y1:1 }, 1);
        makeLeaf(idx++, widthM / 4, widthM / 2, upY0 + 0.0015, upY1 - 0.0015, "right", { y0:0, y1:1 }, 1);
      } else makeLeaf(idx++, 0, widthM, upY0 + 0.0015, upY1 - 0.0015, hingeA, { y0:0, y1:1 }, 1);
      return;
    }

    fronts.forEach(function(f, fi){
      var y0 = bodyBase + bodyH * f.y0 + 0.0015, y1 = bodyBase + bodyH * f.y1 - 0.0015;
      if (f.drawer) makeLeaf(idx++, 0, widthM, y0, y1, "left", f, fi);
      else if (meta.corner){
        var left = meta.doorSide === "left", hw = widthM / 2;
        makeLeaf(idx++, left ? -hw / 2 : hw / 2, hw, y0, y1, left ? "left" : "right", f, fi);
        if (meta.leMans) addLeMansTrays(THREE, frame, parts[parts.length - 1], left ? -hw / 2 : hw / 2, hw, CD, bodyBase, bodyH, left, meta, pickables);
        var blind = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.004, y1 - y0, FRONT_T), frontMat); // fixed blind panel on the other half
        scaleFrontUV(blind.geometry, hw - 0.004, y1 - y0, frontMat.userData && frontMat.userData.tile, false, { u:offsetM + widthM / 2 + (left ? 0 : -hw), v:y0 });
        blind.position.set(left ? hw / 2 : -hw / 2, (y0 + y1) / 2, CD + FRONT_T / 2); blind.castShadow = true;
        frame.add(blind);
      } else if (wide){
        makeLeaf(idx++, -widthM / 4, widthM / 2, y0, y1, "left", f, fi);
        makeLeaf(idx++, widthM / 4, widthM / 2, y0, y1, "right", f, fi);
      } else makeLeaf(idx++, 0, widthM, y0, y1, meta.hingeRight ? "right" : "left", f, fi);
    });

    // Búrskápur: inner drawers (a real BUR Útfærsla) stacked from the bottom behind the doors, 2 shelves above;
    // each inner drawer pulls out on its own once the doors are open
    if (meta.burCodes && meta.burCodes.length){
      var sysB = DRAWER_CODES[sysKey], yb = bodyBase + 0.03, ibw = Math.max(0.2, widthM - 2 * T - 0.026), ibd = Math.max(0.2, Math.min(0.5, CD - 0.08));
      meta.burCodes.forEach(function(code, k){
        var side = (sysB && sysB.side[code]) || 120, key = meta.blockId + ":b" + k, g = new THREE.Group(), meshes = [];
        var bx = buildDrawerBox(THREE, sysKey, meta.carcassKey, side, ibw, ibd, code);
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
      var topB = bodyBase + bodyH;
      for (var bs = 1; bs <= 2; bs++){
        var shB = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * CARCASS_T - 0.001, 0.018, CD - 0.03), meta.openMat);
        shB.position.set(0, yb + (topB - yb) * bs / 3, (CD - 0.03) / 2 + 0.005); shB.castShadow = true; shB.receiveShadow = true;
        frame.add(shB);
      }
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
  function addLeMansTrays(THREE, frame, doorPart, cxDoor, hw, CD, bodyBase, bodyH, left, meta, pickables){
    if (!doorPart) return;
    var w = Math.max(0.3, hw - 0.07), d = Math.max(0.3, Math.min(0.5, CD - 0.08)), trays = [];
    var pmeta = Object.assign({}, meta, { isPart:true, partKey:doorPart.key });
    [0.08, 0.5].forEach(function(f){
      var g = leMansTray(THREE, w, d), y = bodyBase + bodyH * f;
      frame.add(g);
      g.traverse(function(o){ if (o.isMesh){ o.userData = pmeta; pickables.push(o); } });
      // closed: tucked partly into the blind corner; open: out through the door, square in front of it
      var inward = left ? 1 : -1;
      trays.push({ group:g, xIn:cxDoor + inward * hw * 0.35, xOut:cxDoor - inward * 0.03, y:y, z0:CD - 0.03 - d / 2, outZ:d + 0.1, turn:-inward * 0.55 });
    });
    doorPart.kind = "lemans"; doorPart.trays = trays;
    applyPart(doorPart);
  }

  // Stainless inset sink (visual pass 2): the worktop has a real cut-out, a brushed-steel basin with rounded walls
  // sinks 18 cm into the (open-topped) sink cabinet, a flush rim, a drain, and a gooseneck tap with a lever.
  function sinkSize(widthM, depthM){ return { w:Math.min(0.62, widthM * 0.72), d:Math.min(0.42, depthM * 0.62), r:0.02 }; }
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
  function addSink(THREE, group, local, quat, widthM, depthM, topY){
    var hs = sinkSize(widthM, depthM), depth = 0.18, zc = depthM * 0.5 + 0.01;
    var steel = new THREE.MeshStandardMaterial({ color:0xc4c8cc, metalness:0.9, roughness:0.32 });
    var steelIn = new THREE.MeshStandardMaterial({ color:0xaeb3b8, metalness:0.85, roughness:0.38, side:THREE.BackSide });
    function put(m, y, out, along){ m.position.copy(local(along || 0, y, out)); m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; }
    // basin: a rounded box seen from inside (BackSide), its top face is what the hole frames
    var basin = new THREE.Mesh(window.__RoundedBox__ ? new window.__RoundedBox__(hs.w - 0.002, depth, hs.d - 0.002, 4, 0.03) : new THREE.BoxGeometry(hs.w, depth, hs.d), steelIn);
    put(basin, topY - depth / 2 + 0.001, zc);
    // flush rim round the hole
    var rimSh = roundedRectShape(THREE, hs.w + 0.03, hs.d + 0.03, hs.r + 0.015); rimSh.holes.push(roundedRectShape(THREE, hs.w, hs.d, hs.r, new THREE.Path()));
    var rimG = new THREE.ExtrudeGeometry(rimSh, { depth:0.0015, bevelEnabled:false, curveSegments:6 }); rimG.rotateX(-Math.PI / 2);
    put(new THREE.Mesh(rimG, steel), topY, zc);
    // drain
    var drain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.003, 28), new THREE.MeshStandardMaterial({ color:0x9a9fa5, metalness:0.9, roughness:0.25 }));
    put(drain, topY - depth + 0.006, zc, hs.w * 0.25);
    // tap: round base, gooseneck, lever
    var back = zc - hs.d / 2 - 0.045;
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 24), steel), topY + 0.015, back);
    var neck = new THREE.Group(); neck.position.copy(local(0, topY + 0.03, back)); neck.quaternion.copy(quat); group.add(neck);
    var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 0.3, 0.06), new THREE.Vector3(0, 0.27, 0.17), new THREE.Vector3(0, 0.2, 0.2)]);
    var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 14, false), steel); tube.castShadow = true; neck.add(tube);
    var lever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 10), steel); lever.rotation.z = Math.PI / 2 - 0.3; lever.position.set(0.045, 0.1, 0); lever.castShadow = true; neck.add(lever);
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
      if (wallsOnly && walls[i].island) return; // windows/doors only go on real walls
      var x1 = g.origin.x, z1 = g.origin.z;
      var dx = g.axis.x * g.lenM, dz = g.axis.z * g.lenM;
      var lenSq = dx * dx + dz * dz;
      var t = lenSq > 0 ? ((worldX - x1) * dx + (worldZ - z1) * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      var d = Math.hypot(worldX - (x1 + t * dx), worldZ - (z1 + t * dz));
      // back-to-back island rows share one seam: pick the row whose front the cursor is on
      if (walls[i].island && walls[i].island.two && (worldX - x1) * g.normal.x + (worldZ - z1) * g.normal.z < 0) d += 5;
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
      if (!w || w.open || w.island) return;
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
  function isWallItem(meta){ return !!meta && (meta.zone === "wall" || meta.kind === "window" || meta.kind === "door"); }

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
    function pickMeshAt(evt){
      raycaster.setFromCamera(ndc(evt), camera);
      var hits = raycaster.intersectObjects(pickables, false);
      return hits.length ? hits[0].object : null;
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
    function floorHit(evt){
      raycaster.setFromCamera(ndc(evt), camera);
      var pt = new THREE.Vector3();
      return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt) ? pt : null;
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
      var readOnly = !opts.onSelect && !opts.onCabinetDragEnd; // review page / wizard preview
      var mesh = pickMeshAt(evt);
      if (!mesh) return;
      if (readOnly){ // only drawers/doors react (tap = open/close); everything else is left to OrbitControls
        if (mesh.userData.isPart && mesh.userData.locked) lockTap = { meta:mesh.userData, x:evt.clientX, y:evt.clientY };
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
        drag = { meta:mesh.userData, mesh:mesh, group:dg, island:true, decor:true, startX:evt.clientX, startY:evt.clientY, moved:false, pt0:floorHit(evt), dx:0, dz:0, groups:[dg] };
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
      var grip = gripOffsetMm(evt, mesh), bid = mesh.userData.blockId;
      drag = { meta:mesh.userData, mesh:mesh, group:mesh.parent, startX:evt.clientX, startY:evt.clientY, moved:false, gripMm:grip.along, gripYmm:grip.y,
        // a stack of shelves is several pickable boards under one block id: they all move together
        groups:pickables.filter(function(m){ return m.userData.blockId === bid && !m.userData.isPart; }).map(function(m){ return m.parent; }) };
      controls.enabled = false;
    }
    var hovered = null;
    function edgesOf(m){ return m.userData.edgesObj || (m.parent && m.parent.children[1]); }
    function setHover(mesh){
      if (mesh === hovered) return;
      if (hovered){ var e0 = edgesOf(hovered); if (e0 && e0.material && !hovered.userData.selected) e0.material.color.set(hovered.userData.warn ? WARN_COLOR : 0x2a2a2a); }
      hovered = mesh;
      if (hovered){ var e1 = edgesOf(hovered); if (e1 && e1.material && e1.material.color) e1.material.color.set(SELECT_COLOR); }
      renderer.domElement.style.cursor = hovered ? (hovered.userData.locked ? (hovered.userData.isPart ? "pointer" : "default") : "grab") : "";
    }
    function onMove(evt){
      if (!drag){
        if (evt.target === renderer.domElement) setHover(pickMeshAt(evt));
        else setHover(null);
        return;
      }
      if (!drag.moved){
        if (Math.hypot(evt.clientX - drag.startX, evt.clientY - drag.startY) < CABINET_DRAG_PX) return;
        drag.moved = true;
      }
      if (drag.island){
        var pt = floorHit(evt);
        if (!pt || !drag.pt0) return;
        drag.dx = pt.x - drag.pt0.x; drag.dz = pt.z - drag.pt0.z;
        if (drag.decor){ // its own position/rotation: just move it
          if (!drag.base) drag.base = drag.group.position.clone();
          drag.group.position.set(drag.base.x + drag.dx, drag.base.y, drag.base.z + drag.dz);
          return;
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
      if (lockTap){
        var lt = lockTap; lockTap = null;
        if (Math.hypot(evt.clientX - lt.x, evt.clientY - lt.y) < CABINET_DRAG_PX){
          if (lt.meta.isPart) togglePart(lt.meta.partKey);
          else if (opts.onSelect) opts.onSelect(lt.meta);
        }
        return;
      }
      if (!drag) return;
      if (drag.island){
        var d0 = drag;
        drag = null; haveTarget = false;
        controls.enabled = true;
        renderer.domElement.style.cursor = "";
        if (d0.moved){
          if (!d0.decor) d0.groups.forEach(function(g){ g.matrix.identity(); g.matrixWorldNeedsUpdate = true; });
          suppressClick = true;
          if (d0.decor){ if (opts.onDecorDragEnd) opts.onDecorDragEnd(d0.meta.decorId, Math.round(d0.dx * 1000), Math.round(d0.dz * 1000)); }
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
      if (opts.onWallSelect){ // a click on a wall (not on the floor in front of it) selects that wall
        raycaster.setFromCamera(ndc(evt), camera);
        var wh = wallPlaneHit(raycaster.ray, geoms, walls, 0, roomHM), fp = new THREE.Vector3();
        var floorT = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fp) ? fp.distanceTo(raycaster.ray.origin) : Infinity;
        if (wh && wh.t < floorT){ opts.onWallSelect(wh.wallId); return; }
      }
      if (opts.onSelect) opts.onSelect(null);
    }

    wrap.addEventListener("pointerdown", onDown, { capture:true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("click", onClickEmpty);
    return function cleanup(){
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
      var cab = m.parent && m.parent.userData && m.parent.userData.cab;
      if (cab && cab.items && cab.t > 0){ cab.items.forEach(function(it){ it.o.material = it.orig; }); cab.t = 0; } // back to solid before the material slots are touched
      if (Array.isArray(m.material)){ // cabinet
        if (u.open || u.art){ /* open shelves have NO front: swapping slot 4 for the real front material gave them a door */ }
        else if (want){
          var c = u.baseFront.clone();
          c.emissive = new THREE.Color(SELECT_COLOR); c.emissiveIntensity = 0.35;
          m.material[4] = c;
        } else {
          if (m.material[4] !== u.baseFront) m.material[4].dispose();
          m.material[4] = u.baseFront;
        }
        var e = m.parent && m.parent.children[1];
        if (e && e.material && e.material.color) e.material.color.set(want ? SELECT_COLOR : (u.warn ? WARN_COLOR : 0x2a2a2a));
      } else if (u.gap){ // opening in the wall: a faint tint over the hole
        m.material.opacity = want ? 0.25 : 0;
      } else { // window / door plane
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
    grp.add(pane);
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
  function setXrayFronts(on){
    if (!THREE_STATE || !THREE_STATE.frontMat) return false;
    var m = THREE_STATE.frontMat;
    m.transparent = true;
    m.opacity = on ? 0.1 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
    // See-through fronts must not cast shadows (thin slabs gave striped shadow acne under the worktop),
    // and their handles / seams go with them. Tagged objects are hidden, not removed — "on" restores them.
    THREE_STATE.scene.traverse(function(o){
      if (o.__frontDetail){ o.visible = !on; return; }
      if (!o.isMesh) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.indexOf(m) >= 0){
        if (o.__castShadow0 == null) o.__castShadow0 = o.castShadow;
        o.castShadow = on ? false : o.__castShadow0;
      }
    });
    return true;
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
  }

  function teardown3D(discardCamera){
    if (!THREE_STATE) return;
    savedCameraState = discardCamera ? null : {
      position: THREE_STATE.controls.object.position.clone(),
      target: THREE_STATE.controls.target.clone()
    };
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
  var IMG_TEX = typeof Map !== "undefined" ? new Map() : null;
  function imgTex(THREE, url){
    var t = IMG_TEX && IMG_TEX.get(url);
    if (t) return t;
    t = new THREE.TextureLoader().load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    t.userData.keep = true;
    if (IMG_TEX) IMG_TEX.set(url, t);
    return t;
  }

  // Worktop material for a TOPS key (null/unknown = the plain procedural stone).
  function makeTopMaterial(THREE, topKey){
    var topDef = topKey && TOPS[topKey] ? TOPS[topKey] : null;
    if (topDef && topDef.tex){
      var m = new THREE.MeshStandardMaterial({ map:imgTex(THREE, topDef.tex), roughness:0.42, metalness:0.02 });
      m.userData.tile = topDef.tile || { w:0.9, h:0.9 };
      // Límtré (glulam) worktops: the source photo's grain runs "up" the image — turned 90° here so it
      // runs side to side across the counter (widthwise) instead of front-to-back (2026-09-28, user request).
      if (topDef.group === "limtre") m.userData.rotateTex = true;
      return m;
    }
    if (topDef && topDef.group !== "steinn") return new THREE.MeshStandardMaterial({ color:topDef.color3d, roughness:0.45 });
    if (window.KPMat){
      var st = window.KPMat.stoneTexture("#e4dfd6");
      var sm = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, st.color, true), roughness:0.32, metalness:0.02 });
      sm.map.repeat.set(1 / st.tileW, 1 / st.tileH);
      return sm;
    }
    return new THREE.MeshStandardMaterial({ color:0xe4dfd6, roughness:0.4 });
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
      var im = new THREE.MeshStandardMaterial({ map:imgTex(THREE, look.tex), roughness:0.58 });
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
    man: { h:1.8, label:"180 cm",
      d: "M50 1 C57 1 60.5 5 60.5 12 C60.5 19 57 25 50 25 C43 25 39.5 19 39.5 12 C39.5 5 43 1 50 1 Z " + mirrorPath([
        [50,24],[55,24],[56,30],[63,33],[70,35],[74,39],[76,46],[77,60],[78,76],[78,92],[76,101],[72,103],[69.5,100],
        [68.5,110],[67.5,140],[66.5,170],[65.5,188],[70,191],[71,196],[56,196],[55.5,188],[54.5,160],[53,130],[51,114],[50,114]
      ]),
      cut: "M68.4 52 L71.6 58 L72.2 88 L69.4 96 Z M31.6 52 L28.4 58 L27.8 88 L30.6 96 Z" },
    woman: { h:1.68, label:"168 cm",
      d: "M50 2 C56.5 2 59.5 6 59.5 12.5 C59.5 19 56 24 50 24 C44 24 40.5 19 40.5 12.5 C40.5 6 43.5 2 50 2 Z " +
         "M42 8 C43 0 58 -1 60 8 C62 17 60 26 65 37 C61 38 57.5 34 57 28 C56 22 58 15 55 10 Z " +
         "M46 23 L46 29 L40 31.5 L35 34.5 L33 40 L31.5 60 L30.5 80 L29.5 97 L31.5 102 L34 101 L34.5 97 L35.5 80 L37.5 62 L38.5 70 L39.5 79 " +
         "L31 150 L43.5 152 L43.5 186 L40 194 L41 197 L46 197 L47 190 L48.5 152 L52.5 152 L53.5 186 L54 194 L55 197 L60 197 L58 186 L57 152 L69 150 " +
         "L60.5 80 L62.5 79 L64.5 81 L77 64 L78.5 58 L74 45 L69 36.5 L63 33 L54 29.5 L54 23 Z",
      cut: "M61 70 L71.5 59.5 L66 44 L61.5 42 Z" }
  };
  var PEOPLE_TEX = {};
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
  function addPeople(THREE, scene, geoms, wallH, heightMm, walls, wallHex){
    var g = geoms.filter(function(x, i){ return !(walls[i] && walls[i].open); }).sort(function(a, b){ return b.lenM - a.lenM; })[0] || geoms[0], mid = { x:g.origin.x + g.axis.x * g.lenM / 2, z:g.origin.z + g.axis.z * g.lenM / 2 }, out = [];
    var inM = 0.7;
    [["man", -0.38], ["woman", 0.42]].forEach(function(pr){
      var P = PEOPLE[pr[0]], tex = new THREE.CanvasTexture(personCanvas(pr[0]));
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      var mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true, alphaTest:0.4, side:THREE.DoubleSide });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(P.h / 2, P.h), mat);
      m.position.set(mid.x + g.normal.x * inM + g.axis.x * pr[1], P.h / 2, mid.z + g.normal.z * inM + g.axis.z * pr[1]);
      m.userData.billboard = true;
      scene.add(m); out.push(m);
      var sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.16, depthWrite:false }));
      sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.55, 1);
      sh.position.set(m.position.x, 0.003, m.position.z);
      scene.add(sh);
    });
    // dimension line on the wall, a little to the side of the figures
    var dOff = -Math.min(1.3, g.lenM * 0.42);
    var dx = mid.x + g.axis.x * dOff + g.normal.x * 0.02, dz = mid.z + g.axis.z * dOff + g.normal.z * 0.02;
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
    lx.fillText(heightMm + " mm", 128, 38);
    var lt = new THREE.CanvasTexture(lc);
    if (THREE.SRGBColorSpace) lt.colorSpace = THREE.SRGBColorSpace;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:lt, depthTest:false }));
    sp.scale.set(0.62, 0.175, 1); sp.renderOrder = 10;
    sp.position.set(dx + g.normal.x * 0.05, wallH / 2, dz + g.normal.z * 0.05);
    scene.add(sp);
    return { people:out, focus:{ x:mid.x + g.normal.x * inM, z:mid.z + g.normal.z * inM }, g:g };
  }

  // wrap: DOM element to render into. state: the planner's {shape,walls,look}
  // object. opts (optional): {selectedId, onSelect(meta|null)} — onSelect is
  // called with {wallId,zone,blockId} when a cabinet is clicked, or null on
  // a click that hit nothing (deselect).
  function buildScene(wrap, state, opts){
    opts = opts || {};
    handleFinish = handleFinishFor(state.handle, state.handleColor);
    var THREE = window.__THREE__;
    var OrbitControls = window.__OrbitControls__;

    var geoms = wallGeoms(state);
    var surfaces = surfacesOf(state), allGeoms = geoms.concat(islandGeoms(state)); // walls + island rows
    var carcass = state.carcass ? CARCASS[state.carcass] : null;
    var jeyOn = !!(state.handle && window.KPMODELS && window.KPMODELS.handles && window.KPMODELS.handles[state.handle] && /^(jey|hexxa)$/.test(window.KPMODELS.handles[state.handle].kind)); // Jey (on top of the front, incl. Spónagrip — same kind) and Hexxa (cut into it) need separate fronts
    var carcassMat = new THREE.MeshStandardMaterial({ color: carcass ? carcass.color3d : "#3a3a3a", roughness:0.9 });
    var wallColor = state.wallColor && WALL_COLORS[state.wallColor] ? WALL_COLORS[state.wallColor].hex : "#f1efe8";
    var wallMat = new THREE.MeshStandardMaterial({ color:wallColor, roughness:1, side:THREE.DoubleSide });
    var floorMat;
    if (window.KPMat){
      var ft = floorTexture(state.floor, state), isTile = (FLOORS[state.floor] || {}).kind === "tile";
      // gloss varies (visual pass 2): lacquered planks / glazed tiles catch a soft sheen, joints and grout stay matte
      floorMat = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, ft.color, true), bumpMap:canvasTex(THREE, ft.bump, false), bumpScale:isTile ? 0.35 : 0.7,
        roughnessMap:canvasTex(THREE, roughFromBump(ft.bump, isTile ? 0.28 : 0.42, isTile ? 0.04 : 0.12), false), roughness:1, envMapIntensity:0.55 });
      floorMat.userData.envKeep = true;
      floorMat.userData.tile = ft.tileW;
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });
    }

    var scene = new THREE.Scene();
    // opts.onlySurfaceId (drawing export): only that one wall's / island row's cabinets are built —
    // no floor, walls, skirting, windows/doors or other cabinets in front of or around them.
    var iso = opts.onlySurfaceId || null; // one surface id, or an array of them (both rows of an island)
    function isoHas(id){ return Array.isArray(iso) ? iso.indexOf(id) >= 0 : id === iso; }
    scene.background = new THREE.Color(iso ? 0xffffff : 0xf7f6f2);
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
    if (!opts.people && !opts.clean && !iso) geoms.forEach(function(g, i){ // (the ceiling-height view has its own single label; opts.clean skips it too — drawing exports don't want it baked into the picture)
      var cv = document.createElement("canvas"); cv.width = 420; cv.height = 64;
      var cx = cv.getContext("2d");
      cx.fillStyle = "rgba(255,255,255,.92)"; cx.strokeStyle = "#e6e3da"; cx.lineWidth = 3;
      cx.beginPath(); cx.roundRect ? cx.roundRect(4, 4, 412, 56, 14) : cx.rect(4, 4, 412, 56); cx.fill(); cx.stroke();
      cx.fillStyle = "#191919"; cx.font = "600 30px 'Kumbh Sans', Arial, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText((state.walls[i] ? state.walls[i].label : "Veggur") + " · " + Math.round(g.lenM * 1000) + " mm", 210, 34);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false, transparent:true }));
      sp.scale.set(1.0, 0.152, 1);
      sp.position.set(g.origin.x + g.axis.x * g.lenM / 2, WALL_H + 0.16, g.origin.z + g.axis.z * g.lenM / 2);
      sp.renderOrder = 10;
      scene.add(sp);
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
      if (isOpenGeom(gi) || iso) return;
      var mat = wallMat.clone();
      mat.transparent = true;
      var wid = state.walls[gi] && state.walls[gi].id;
      var gaps = (state.doors || []).filter(function(d){ return d.gap && d.wallId === wid; })
        .map(function(d){ return { offM:d.offsetMm / 1000, widM:d.widthMm / 1000, hM:Math.min(d.heightMm, roomHeightMm) / 1000 }; });
      wallFades.push({ mesh:addWallPlane(THREE, scene, g, WALL_H, mat, gaps), geom:g, mat:mat, wallId:wid, openings:[] });
    });

    function geomForWall(wallId){
      if (iso) return null;
      var wi = state.walls.findIndex(function(w){ return w.id === wallId; });
      return wi === -1 || state.walls[wi].open ? null : geoms[wi];
    }
    var pickables = [];
    // A window/door/opening fades together with its wall: seen from outside the room through a faded wall,
    // the frame and door leaf used to stay solid and block the view (user, 2026-10-02).
    function fadeWithWall(wallId, group){
      var w = group && wallFades.find(function(x){ return x.wallId === wallId; });
      if (!w) return;
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
    (state.doors || []).forEach(function(door){
      var g = geomForWall(door.wallId);
      if (!g) return;
      fadeWithWall(door.wallId, addOpeningMarker(THREE, scene, g, door.offsetMm / 1000, door.widthMm / 1000, door.heightMm / 1000,
        0, DOOR_MARKER_COLOR, 0.85,
        { wallId:door.wallId, zone:"opening", kind:"door", locked:!door.unlocked && !!opts.onSelect, gap:!!door.gap, blockId:door.id, widthMm:door.widthMm, depthMm:10, heightMm:door.heightMm, elevMm:0 }, opts.selectedId === door.id, pickables));
    });

    // built-in fridge reads as an appliance: brushed-steel front instead of the kitchen's fronts
    var steelMat = new THREE.MeshStandardMaterial({ color:0xc9ccd1, metalness:0.75, roughness:0.32 });
    var washerMat = new THREE.MeshStandardMaterial({ color:0xf3f4f5, roughness:0.35, metalness:0.05 });
    // shared by every floor unit: recessed plinth + honed-stone worktop
    // open-shelf units: inside faces must render (double-sided) and the front is left out
    var openMat = carcassMat.clone(); openMat.side = THREE.DoubleSide;
    var hiddenMat = new THREE.MeshBasicMaterial({ visible:false });
    var stoneMat = makeTopMaterial(THREE, state.top);
    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = look && window.KPMat
      ? makeFrontMaterial(THREE, state.look, look)
      : new THREE.MeshStandardMaterial({ color: look ? look.color3d : 0xb7b2a4, roughness:0.7 });
    var frontOpenMat = frontMat.clone(); frontOpenMat.side = THREE.DoubleSide; // open shelf units built all in the front material (b.frontAll)
    var LIGHT = state.lighting || {}; // { underWall, shelves, plinth } — see the "Lýsing" section of the editor
    // the plinth (sökkull): its FRONT face is clad in the front material once one is chosen (box face 4 = +z = out
    // of the wall); the sides and back stay the dark plinth colour
    var plinthDark = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 });
    var plinthMat = look ? [plinthDark, plinthDark, plinthDark, plinthDark, frontMat, plinthDark] : plinthDark;

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
            var tg = new THREE.BoxGeometry(w + 0.001, 0.032, dM + 0.02);
            var t = new THREE.Mesh(tg, stoneMat);
            t.position.set(g.origin.x + g.axis.x * along + g.normal.x * (dM + 0.02) / 2, hM + 0.017, g.origin.z + g.axis.z * along + g.normal.z * (dM + 0.02) / 2);
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
        var t = new THREE.Mesh(new THREE.BoxGeometry(len + 0.001, 0.032, w), stoneMat);
        t.position.set(g.origin.x + g.axis.x * along - g.normal.x * w / 2, hM + 0.017, g.origin.z + g.axis.z * along - g.normal.z * w / 2);
        t.quaternion.copy(q); t.castShadow = true; scene.add(t);
      }
    }

    surfaces.forEach(function(wall, wi){
      var g = allGeoms[wi];
      if (!g || (iso && !isoHas(wall.id))) return;
      var fStarts = blockStartsMm(wall.floor, cornerClearanceMm(surfaces, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      var islandId = wall.island ? wall.island.id : undefined;
      if (!opts.people) addAfellur(g, wall, wi, fStarts, wStarts);
      if (wall.island && wall.island.back && !wall.island.two && wall.floor.length) addIslandBack(g, wall, fStarts);
      wall.floor.forEach(function(b, bi){
        var offset = fStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        var inter = b.interior;
        if (c.rusl) inter = { mode:"skuffur", codes:[state.drawerSystem === "merivo" ? "E" : "C"], count:1 }; // one tall pull-out
        if (inter && inter.mode === "skuffur"){ // the real stack: one Blum code per drawer, fronts sized from the codes
          var dcodes = drawerCodes(inter, state.drawerSystem), dbody = hM * 1000 - 100, dfr = stackFrontsMm(inter, dcodes, dbody);
          inter = Object.assign({}, inter, { codes:dcodes, count:dcodes.length, fractions:dfr ? frontsToFractions(dfr, dbody) : null });
        }
        var applMat = c.appliance === "fridge" || c.appliance === "dishwasher" ? steelMat : c.appliance === "washer" ? washerMat : null;
        // an integrated fridge wears the kitchen's fronts (user, 2026-10-05 — it was steel)
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, applMat || carcassMat, applMat || frontMat, inter,
          { islandId:islandId, locked:!!b.locked || !!opts.xray, suppressBadge:!!opts.xray, slabFronts:jeyOn, corner:c.cls === "corner", doorSide:b.swing === "vinstri" ? "left" : "right", hingeRight:b.swing === "haegri", shelves:(c.hasInterior || c.shelfRange) && !(b.interior && b.interior.mode === "skuffur") ? (shelvesOf(b) || 0) : 0,
            openMat:openMat, hiddenMat:hiddenMat, drawerSystem:state.drawerSystem, carcassKey:state.carcass,
            warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), wallId:wall.id, zone:"floor", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d), heightMm:hM * 1000, elevMm:0, handle:c.appliance ? null : state.handle, tall:c.cls === "tall" || !!c.fridge, split:c.fridge ? 0.74 : 0.55,
            plinth:!c.panel && !c.appliance, appliance:c.appliance || null, leMans:!!c.tofrahornIds, counter:!!c.counter, sink:!!c.sink, oven:!!c.oven, panel:!!c.panel, plinthMat:plinthMat, stoneMat:stoneMat,
            ovenCodes:c.lowOven ? ["M"] : c.oven ? ovenCodesOf(b, state.drawerSystem) : null, fixedFronts:!!c.fixedFronts || !!c.appliance,
            burCodes:c.bur ? burCodesOf(b, state.drawerSystem) : null, dishwasher:!!c.dishwasher,
            lowOven:!!c.lowOven, ovenFrontsMm:c.oven ? b.ovenFrontsMm || null : null,
            ovenInner:c.oven && !c.lowOven ? (String(b.ovenCombo == null ? OVEN_DEFAULT[state.drawerSystem === "merivo" ? "merivo" : "legra"] : b.ovenCombo).split("+")[1] || null) : null,
            washerDrawerM:c.thvo && b.thvo !== "hurdir" ? 0.40 : 0 }, selected, pickables);
        // LED in the plinth: a strip at the foot of the plinth and a glow on the floor in front of it
        if (false){ // (plinth LED taken out 2026-10-05)
          var pf = ledFrame(THREE, scene, g, offset / 1000, b.widthMm / 1000), pw = b.widthMm / 1000;
          ledStrip(THREE, scene, pf, 0, pw - 0.02, 0.008, dM - 0.058);
          ledGlow(THREE, scene, pf, 0, pw, dM - 0.06, dM + 0.32, 0.003, 0.75);
        }
      });
      wall.wall.forEach(function(b, bi){
        var offset = wStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        var elevM = elevOf(b) / 1000;
        var metaBase = { locked:!!b.locked || !!opts.xray, suppressBadge:!!opts.xray, slabFronts:jeyOn, drawerSystem:state.drawerSystem, carcassKey:state.carcass, warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), wallId:wall.id, zone:"wall", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d),
          heightMm:hM * 1000, elevMm:elevM * 1000, handle:state.handle };
        if (c.shelfStack){ // 1–5 boards of 38 mm above each other: one pickable box per board, all sharing the block id
          var n = Math.max(1, Math.min(SHELF_STACK_MAX, b.count || 3)), gap = b.vgapMm != null ? b.vgapMm : SHELF_GAP_DEFAULT;
          for (var k = 0; k < n; k++){
            addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, SHELF_T_MM / 1000, dM, elevM + k * (SHELF_T_MM + gap) / 1000, carcassMat, frontMat, null,
              Object.assign({}, metaBase, { panel:true, shelfBoard:true }), selected, pickables);
          }
          return;
        }
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, elevM, carcassMat, frontMat, null,
          Object.assign(metaBase, { open:!!c.open, panel:!!c.panel, openMat:c.open && b.frontAll ? frontOpenMat : openMat, hiddenMat:hiddenMat, shelves:c.open ? shelvesOf(b) : (c.shelfRange ? (shelvesOf(b) || 0) : 0) }), selected, pickables);
        if (c.panel || opts.people) return;
        var wf = null, ww = b.widthMm / 1000;
        // LED under the wall unit: a strip under its front edge, a glow on what's below (worktop / floor unit / floor)
        if (b.led != null ? b.led : LIGHT.underWall){
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

    var camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    var dist = Math.max(bbox.w, bbox.d) * (geoms.closed ? 0.95 : 0.74) + (geoms.closed ? 1.7 : 1.2);
    camera.position.set(bbox.cx + dist * 0.6, dist * 0.55, bbox.cz + dist * 0.9);
    var people = opts.people && geoms.length ? addPeople(THREE, scene, geoms, WALL_H, roomHeightMm, state.walls, wallColor) : null;
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
    controls.target.set(bbox.cx, 1.0, bbox.cz);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minPolarAngle = 0.15;
    controls.minDistance = 0.8;
    controls.maxDistance = dist * 3;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    if (people) controls.target.set(people.focus.x - people.g.normal.x * 0.6, WALL_H * 0.46, people.focus.z - people.g.normal.z * 0.6);
    if (savedCameraState && !opts.freshCamera){
      camera.position.copy(savedCameraState.position);
      controls.target.copy(savedCameraState.target);
    }
    controls.update();

    var cleanupInteraction = setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, allGeoms, surfaces, opts, WALL_H);
    THREE_STATE = { renderer:renderer, camera:camera, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupInteraction:cleanupInteraction,
                    walls:surfaces, geoms:allGeoms, previewMesh:null, dragging:false, opts:opts, pickables:pickables, roomHM:WALL_H, wallHi:null, frontMat:frontMat };
    if (opts.selectedWallId) setSelectedWall3D(opts.selectedWallId);

    function resize(){
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
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
      floatV.set((floatBox.min.x + floatBox.max.x) / 2, floatBox.max.y, (floatBox.min.z + floatBox.max.z) / 2).project(camera);
      if (floatV.z > 1){ el.hidden = true; return; }
      var cr = renderer.domElement.getBoundingClientRect(), pr = el.offsetParent ? el.offsetParent.getBoundingClientRect() : cr;
      var x = cr.left - pr.left + (floatV.x * 0.5 + 0.5) * cr.width;
      var y = cr.top - pr.top + (-floatV.y * 0.5 + 0.5) * cr.height;
      el.style.left = Math.max(60, Math.min(pr.width - 60, x)) + "px";
      el.style.top = Math.max(46, y - 10) + "px";
      el.hidden = false;
    }

    var wallVec = new THREE.Vector3();
    function fadeWalls(){
      wallFades.forEach(function(w){
        var cx = w.geom.origin.x + w.geom.axis.x * w.geom.lenM / 2, cz = w.geom.origin.z + w.geom.axis.z * w.geom.lenM / 2;
        // camera on the outer side of this wall (opposite its room-facing normal)?
        var cp = (THREE_STATE.fadeCam || camera).position;
        wallVec.set(cp.x - cx, 0, cp.z - cz);
        var behind = wallVec.x * w.geom.normal.x + wallVec.z * w.geom.normal.z < 0;
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
    var lastMove = performance.now();
    controls.addEventListener("change", function(){ lastMove = performance.now(); });
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
      var still = forceAO || (!THREE_STATE.dragging && performance.now() - lastMove > 250);
      if (still && QUALITY.level === 0 && !opts.noAO){
        if (!THREE_STATE.aoComposer){ THREE_STATE.aoComposer = makeAOComposer(THREE, renderer, scene, camera); if (THREE_STATE.aoComposer){ var s2 = renderer.getSize(new THREE.Vector2()); THREE_STATE.aoComposer.setSize(s2.x, s2.y); } }
        if (THREE_STATE.aoComposer){ THREE_STATE.aoComposer.render(); return; }
      }
      renderer.render(scene, camera);
    }
    THREE_STATE.renderFrame = renderFrame;
    function loop(ts){
      THREE_STATE.rafId = requestAnimationFrame(loop);
      qualityTick(ts || performance.now(), renderer, resize);
      controls.update();
      settleLanded();
      if (THREE_STATE.dragStep) THREE_STATE.dragStep();
      fadeWalls();
      fadeCabinets();
      stepParts(scene);
      stepMood(scene);
      if (people) people.people.forEach(function(m){ m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); });
      renderFrame(false);
      placeFloatBar();
    }
    loop();
  }

  // ============================================================
  // Materials wizard: ONE 600 × 800 × 600 base cabinet you can spin around.
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
  function buildDrawerBox(THREE, sysKey, carcassKey, sideMm, boxW, boxD, code){
    var g = new THREE.Group();
    var dark = carcassKey === "dokkgra";
    if (code && (boxD || 0.5) >= 0.49){
      var rs = realSides(sysKey, code, dark);
      if (rs){ // Blum's own side parts + a plain bottom and back between them
        var bwR = boxW || 0.5, inset = 0.02, sideH = 0.19, len = 0.493;
        [["left", rs.left, rs.runLeft], ["right", rs.right, rs.runRight]].forEach(function(pr){
          var b = new THREE.Box3().setFromObject(pr[1]), holder = new THREE.Group(), wl = pr[1].userData.wall || { x0:b.min.x, x1:b.max.x };
          holder.add(pr[1]);
          holder.position.set(pr[0] === "left" ? -bwR / 2 - b.min.x : bwR / 2 - b.max.x, -b.min.y, -b.max.z); // outer edge at ±bw/2, bottom at 0, front at z = 0
          g.add(holder);
          if (pr[2]){ // the runner shares the side's frame (exact position relative to it) but is FIXED in the cabinet: callers add g.userData.runners to the cabinet, not to the sliding drawer
            var rh = new THREE.Group(); rh.position.copy(holder.position); rh.add(pr[2]);
            (g.userData.runners = g.userData.runners || new THREE.Group()).add(rh);
          }
          if (pr[0] === "left"){ inset = wl.x1 - b.min.x; sideH = b.max.y - b.min.y; len = b.max.z - b.min.z; }
        });
        var boardY = (rs.e.boardMm || 17.6) / 1000, inner = bwR - 2 * inset + 0.004;
        var bm = new THREE.MeshStandardMaterial({ color:dark ? 0x22231f : 0xe4e2d6, roughness:0.5, metalness:0.05 });
        function pnl(w, h, d, x, y, z){ var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); }
        pnl(inner, 0.016, len - 0.02, 0, boardY + 0.008, -(len - 0.02) / 2 - 0.01);                                   // bottom
        var backH = sideH - boardY;                                                                                   // back: as tall as the sides
        pnl(inner, backH, 0.016, 0, boardY + backH / 2, -len + 0.008);
        return g;
      }
    }
    var mat = new THREE.MeshStandardMaterial({ color:dark ? 0x64676c : 0xf0efeb, metalness:dark ? 0.45 : 0.1, roughness:0.4 });
    var legra = sysKey !== "merivo", t = legra ? 0.0128 : 0.016, bw = boxW || 0.5, bd = boxD || 0.5, h = sideMm / 1000;
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

  var FRONT_T = 0.02;   // fronts are 20 mm thick; the carcass is (depth - 20 mm)

  function setCabinetPreview(cfg){
    if (!PREVIEW) return;
    handleFinish = handleFinishFor(cfg.handle, cfg.handleColor);
    var THREE = window.__THREE__;
    if (PREVIEW.group){ PREVIEW.scene.remove(PREVIEW.group); disposeScene(PREVIEW.group); }
    var group = new THREE.Group();
    PREVIEW.group = group;
    var W = 0.6, H = 0.8, PL = 0.1, D = 0.6, CD = D - FRONT_T, T = 0.018, BODY = H - PL;
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
      var topGeo = new THREE.BoxGeometry(W + 0.001, 0.032, D + 0.02);
      scaleFrontUV(topGeo, W + 0.001, D + 0.02, topMat.userData && topMat.userData.tile, topMat.userData && topMat.userData.rotateTex); // over the top face (width × depth), not the thin edge
      var topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(0, H + 0.017, (D + 0.02) / 2); // 1 mm proud of the carcass top (z-fighting seen from inside) topMesh.castShadow = true; topMesh.receiveShadow = true;
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
          bx = buildDrawerBox(THREE, cfg.drawer, cfg.carcass, sides[i], null, null, L ? L.codes[2 - i] : null);
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
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, resumeTimer = 0;
    controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.8; // 2.0 = one turn per 30 s, so this is one turn per ~75 s
    function pauseSpin(){ controls.autoRotate = false; clearTimeout(resumeTimer); resumeTimer = setTimeout(function(){ if (PREVIEW && !reduceMotion) controls.autoRotate = true; }, 5000); }
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
    var margin = 0.8;
    // geoms/surfaces include free-standing island rows after the real walls
    return { minX: b.minX - margin, minZ: b.minZ - margin, pxPerM: PX_PER_M, geoms: geoms.concat(islandGeoms(state)), surfaces: surfacesOf(state) };
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
  var DECOR = {
    bordFer:    { label:"Borðstofuborð + 6 stólar", group:"floor", w:1600, d:900 },
    bordHring:  { label:"Hringborð + 4 stólar",     group:"floor", w:1100, d:1100 },
    barstoll:   { label:"Barstóll",                 group:"floor", w:420, d:420 },
    planta:     { label:"Pottaplanta",              group:"floor", w:450, d:450 },
    motta:      { label:"Gólfmotta",                group:"floor", w:2000, d:1400 },
    kaffivel:   { label:"Kaffivél",                 group:"top",   w:300, d:380 },
    ketill:     { label:"Ketill",                   group:"top",   w:220, d:180 },
    skal:       { label:"Ávaxtaskál",               group:"top",   w:280, d:280 },
    plantaLitil:{ label:"Lítil planta",             group:"top",   w:160, d:160 },
    bretti:     { label:"Skurðarbretti",            group:"top",   w:450, d:300 },
    hengiljos:  { label:"Hengiljós",                group:"ceiling", w:320, d:320 }
  };
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
        if (inside || inside2) top = Math.max(top, Math.min(b.heightMm || c.h, state.roomHeightMm || 2500) / 1000 + (c.counter ? 0.032 : 0));
      });
    });
    return top;
  }
  // Where a new decor item goes (2026-10-06): floor items take the most open spot (away from cabinets, islands,
  // walls and other furniture, then nearest the room centre); bar stools line up behind an island; a rug goes under
  // the dining table; worktop items take the next free spot along a counter (never on top of each other or in a
  // sink); a pendant hangs over the island / table. Returns {x, z} in mm, or null (top item but no counter).
  var DECOR_FOOT = { bordFer:[1.75, 1.85], bordHring:[1.6, 1.6], barstoll:[0.45, 0.45], planta:[0.5, 0.5], motta:[2.0, 1.4], hengiljos:[0.4, 0.4] };
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
    var rad = function(k){ var f = DECOR_FOOT[k] || [(DECOR[k].w || 300) / 1000, (DECOR[k].d || 300) / 1000]; return Math.hypot(f[0], f[1]) / 2 * 0.78; };
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
        others.forEach(function(d){ clear = Math.min(clear, Math.hypot(d.xMm / 1000 - x, d.zMm / 1000 - z) - rad(d.kind) - 0.1); });
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
    var sz = renderer.getSize(new THREE.Vector2()), cmp = new P.EffectComposer(renderer);
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
  function buildDecor(THREE, key){
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
      rbox(1.6, 0.032, 0.9, 0.01, 0, 0.744, 0, oak(3.6, 1.6)); // RoundedBox top: v runs along x, so the grain follows the length
      var lw = oak(0.3, 1);
      [[-0.7, -0.36], [0.7, -0.36], [-0.7, 0.36], [0.7, 0.36]].forEach(function(p){ var l = cyl(0.026, 0.018, 0.73, p[0], 0.365, p[1], lw, 14); l.rotation.z = p[0] > 0 ? -0.03 : 0.03; });
      rbox(1.36, 0.07, 0.022, 0.005, 0, 0.69, -0.36, lw); rbox(1.36, 0.07, 0.022, 0.005, 0, 0.69, 0.36, lw);
      rbox(0.022, 0.07, 0.68, 0.005, -0.7, 0.69, 0, lw); rbox(0.022, 0.07, 0.68, 0.005, 0.7, 0.69, 0, lw);
      [-0.5, 0, 0.5].forEach(function(x){ chair(x, -0.66, 0); chair(x, 0.66, Math.PI); });
    } else if (key === "bordHring"){
      lathe([[0, 0.725], [0.53, 0.725], [0.55, 0.735], [0.55, 0.752], [0.535, 0.76], [0, 0.76]], oak(1, 1), 64);
      lathe([[0, 0], [0.26, 0], [0.27, 0.012], [0.12, 0.05], [0.055, 0.2], [0.045, 0.5], [0.09, 0.69], [0.2, 0.725], [0, 0.725]], mat(0xf0ede6, 0.4), 48);
      [0, 1, 2, 3].forEach(function(i){ var a = i * Math.PI / 2 + Math.PI / 4; chair(Math.sin(a) * 0.7, Math.cos(a) * 0.7, a + Math.PI); });
    } else if (key === "barstoll"){
      var sw = oak(0.6, 0.7);
      lathe([[0, 0.72], [0.17, 0.72], [0.185, 0.73], [0.19, 0.755], [0.175, 0.765], [0.08, 0.752], [0, 0.75]], sw, 40);
      for (var li = 0; li < 4; li++){
        var a = li * Math.PI / 2 + Math.PI / 4, top = [Math.cos(a) * 0.1, 0.72, Math.sin(a) * 0.1], bot = [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2];
        tube([bot, [(bot[0] + top[0]) / 2, 0.36, (bot[2] + top[2]) / 2], top], 0.013, blackMetal);
      }
      var fr = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 8, 36), blackMetal); fr.rotation.x = Math.PI / 2; fr.position.y = 0.27; add(fr);
    } else if (key === "planta" || key === "plantaLitil"){
      var big = key === "planta", sc = big ? 1 : 0.42;
      var potM = big ? mat(0xd9d3c7, 0.85) : mat(0xe9e4da, 0.35);
      lathe([[0, 0], [0.12, 0], [0.13, 0.01], [0.165, 0.3], [0.17, 0.32], [0.158, 0.32], [0.152, 0.3], [0, 0.3]].map(function(p){ return [p[0] * sc, p[1] * sc]; }), potM, 40);
      cyl(0.152 * sc, 0.152 * sc, 0.01, 0, 0.29 * sc, 0, mat(0x3b2d22, 1), 32);
      var h0 = 0.29 * sc; // soil level
      var greens = [0x2f5a2c, 0x3b6a35, 0x2a4f27, 0x45753c];
      function leafAt(px, py, pz, ang, up, L, i){ // a leaf whose base sits at (px,py,pz), pointing outward along ang, tilted up by `up`
        var Wd = L * (big ? 0.45 : 0.36);
        var lf = new THREE.Mesh(leafGeometry(THREE, +L.toFixed(3), +Wd.toFixed(3), big ? 0.12 : 0.1, false), mat(greens[i % greens.length], 0.45, 0, { side:THREE.DoubleSide }));
        lf.position.set(px, py, pz); lf.rotation.order = "YXZ";
        lf.rotation.y = Math.atan2(-Math.cos(ang), -Math.sin(ang)); // the leaf's tip (-z) points out along (cos ang, sin ang)
        lf.rotation.x = up; lf.rotation.z = 0.25 * Math.sin(i * 2.3);
        add(lf);
      }
      if (big){ // rubber plant: three woody stems, leaves spiralling up them
        var stemM = mat(0x4b3a2a, 0.8), li2 = 0;
        [[0.0, 1.1, 0.0], [0.07, 0.95, 2.1], [0.06, 0.8, 4.2]].forEach(function(st){
          var lean = st[0], H = st[1], dir = st[2], top = [Math.cos(dir) * lean * 2.2, h0 + H, Math.sin(dir) * lean * 2.2];
          var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, h0, 0), new THREE.Vector3(top[0] * 0.3, h0 + H * 0.5, top[2] * 0.3), new THREE.Vector3(top[0], top[1], top[2])]);
          add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.009, 6, false), stemM));
          for (var t = 0.38; t <= 1.0001; t += 0.075){
            var pt = curve.getPoint(t), ang = li2 * 2.399 + dir, L = 0.27 - 0.08 * t;
            leafAt(pt.x, pt.y, pt.z, ang, 0.15 + t * 0.55, L, li2++);
          }
        });
      } else { // a small leafy pot plant: a rosette from the soil
        for (var j = 0; j < 9; j++){
          var a2 = j * 2.399, L2 = 0.1 + 0.025 * Math.sin(j * 1.3);
          leafAt(Math.cos(a2) * 0.01, h0 + 0.01 + j * 0.004, Math.sin(a2) * 0.01, a2, 0.45 + 0.35 * (j % 3) / 2, L2, j);
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
    (state.decor || []).forEach(function(d){
      var def = DECOR[d.kind]; if (!def) return;
      var gr = buildDecor(THREE, d.kind);
      var y = def.group === "ceiling" ? (state.roomHeightMm || 2500) / 1000 : def.group === "top" ? surfaceTopAt(state, d.xMm, d.zMm) : 0;
      gr.position.set(d.xMm / 1000, y, d.zMm / 1000); gr.rotation.y = (d.rot || 0) * Math.PI / 180;
      var meta = { kind:"decor", blockId:d.id, decorId:d.id, zone:"decor", widthMm:def.w, depthMm:def.d };
      gr.traverse(function(o){ if (o.isMesh){ o.userData = meta; pickables.push(o); } });
      if (opts.selectedId === d.id){ // a blue ring round the selected one
        var r = Math.max(def.w, def.d) / 2000 + 0.05, ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.02, 48), new THREE.MeshBasicMaterial({ color:SELECT_COLOR, side:THREE.DoubleSide }));
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

  function buildPlan2D(container, state, opts){
    opts = opts || {};
    var geoms = wallGeoms(state);
    if (!geoms.length){ container.innerHTML = ""; return; }
    var surfaces = surfacesOf(state), allGeoms = geoms.concat(islandGeoms(state));

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
        : '<line data-wall-line-id="' + wallId + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (opts.selectedWallId === wallId ? "#3d61c1" : "#2b2b2e") + '" stroke-width="' + (opts.selectedWallId === wallId ? 11 : 9) + '" stroke-linecap="square"' + (opts.onWallSelect ? ' style="cursor:pointer;"' : '') + '/>';
      var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      var lx = midX - g.normal.x * 14, ly = midY - g.normal.z * 14, wsel = opts.selectedWallId === wallId;
      svg += '<text x="' + lx + '" y="' + ly + '" font-size="' + (wsel ? 12.5 : 11) + '" font-weight="' + (wsel ? 700 : 400) + '" fill="' + (wsel ? "#3d61c1" : "#6f6d66") + '" text-anchor="middle" style="pointer-events:none;">' + (state.walls[gi] ? state.walls[gi].label + ' · ' : '') + Math.round(g.lenM * 1000) + ' mm</text>';
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
      } else if (isDoor){
        var cxp = ax + g.normal.x * widthM, czp = az + g.normal.z * widthM; // leaf tip, swung into the room
        var cross = g.normal.x * g.axis.z - g.normal.z * g.axis.x;
        svg += '<line x1="' + X(ax) + '" y1="' + Y(az) + '" x2="' + X(cxp) + '" y2="' + Y(czp) + '" stroke="#8a6a4a" stroke-width="2" style="pointer-events:none;"/>' +
          '<path d="M ' + X(cxp) + ' ' + Y(czp) + ' A ' + widthM * PX_PER_M + ' ' + widthM * PX_PER_M + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + X(bx) + ' ' + Y(bz) + '" fill="none" stroke="#8a6a4a" stroke-width="1.2" stroke-dasharray="4,3" style="pointer-events:none;"/>';
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
    (state.doors || []).forEach(function(d){ openingSegment(d, 'data-door-id', "#8a6a4a", true); });

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
      if (widthM * PX_PER_M > 30 && !thin){
        var cx = (X(corners[0].x) + X(corners[2].x)) / 2;
        var cy = (Y(corners[0].z) + Y(corners[2].z)) / 2;
        var label = bl.widthMm + (bl.interior && bl.interior.mode === "skuffur" ? " · " + bl.interior.count + "sk" : "");
        svg += '<text x="' + cx + '" y="' + cy + '" font-size="9.5" fill="' + (c.oven ? "#fff" : "#191919") + '" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none;">' + label + '</text>';
      }
    }

    surfaces.forEach(function(wall, wi){
      var g = allGeoms[wi];
      if (!g) return;
      var fStarts = blockStartsMm(wall.floor, cornerClearanceMm(surfaces, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      wall.floor.forEach(function(bl, bi){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "floor", fStarts[bi], false); });
      wall.wall.forEach(function(bl, bi){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "wall", wStarts[bi], true); });
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
    rectCornersWorld: rectCornersWorld, DECOR: DECOR, DECOR_GROUPS: DECOR_GROUPS, surfaceTopAt: surfaceTopAt,
    WALL_COLORS: WALL_COLORS,
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
    wallGeoms: wallGeoms,
    buildCabinetPreview: buildCabinetPreview,
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
    debugInfo: function(){ return sharedRenderer ? { memory:sharedRenderer.info.memory, programs:(sharedRenderer.info.programs || []).length } : null; },
    fitWarnings: fitWarnings,
    WALL_UNIT_BASE_MM: WALL_UNIT_BASE_MM,
    snapshot3D: snapshot3D,
    setXrayFronts: setXrayFronts,
    setCameraLookAt: setCameraLookAt,
    renderShot: renderShot,
    setAllParts: setAllParts,
    DRAWER_CODES: DRAWER_CODES,
    FRONT_MIN: FRONT_MIN,
    drawerCodes: drawerCodes,
    drawerFrontsMm: drawerFrontsMm, stackFrontsMm: stackFrontsMm, resizeFront: resizeFront,
    drawerComboKey: drawerComboKey,
    ovenCodesOf: ovenCodesOf, ovenZoneMm: ovenZoneMm, setMood: setMood,
    OVEN_DEFAULT: OVEN_DEFAULT,
    modelsPending: modelsPending,
    shelvesOf: shelvesOf,
    hideDragPreview3D: hideDragPreview3D,
    teardown3D: teardown3D,
    _three: function(){ return THREE_STATE; },
    _quality: QUALITY,
    _stepMood: function(n){ for (var i = 0; i < (n || 60); i++) if (THREE_STATE) stepMood(THREE_STATE.scene); return MOOD_T; } // debugging: rAF doesn't run in a hidden tab
  };
})();
