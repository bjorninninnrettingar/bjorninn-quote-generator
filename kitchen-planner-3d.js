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
  // (its ovenHeightMm/tofrahornId branches just never fire for these 3).
  var CATALOG = {
    // Every dimension is editable per cabinet (typed in the properties panel,
    // clamped to minW..maxW etc.); w/h/d here are just the starting size.
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:200, maxW:1200, h:800,  d:600, minH:600,  maxH:1000, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,4,1], counter:true },
    harskapur:   { label:"Hárskápur",   zone:"floor", cls:"tall",  defaultW:600, minW:300, maxW:900,  h:2400, d:600, minH:1800, maxH:2600, minD:300, maxD:700, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,8,5] },
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
    ofnaskapur:  { label:"Ofnaskápur",  zone:"floor", cls:"oven",  defaultW:600, minW:500, maxW:900, h:2400, d:600, minH:1800, maxH:2600, minD:500, maxD:750, hasInterior:false, ovenHeightMm:595, oven:true },
    tofrahorn:   { label:"Töfrahorn (kapphorn)", zone:"floor", cls:"corner", defaultW:1200, minW:900, maxW:1500, h:800, d:600, minH:600, maxH:1000, minD:500, maxD:900, hasInterior:false, counter:true,
                   skapategundOverride:"Grunnskápur", tofrahornId:"rec9PD5fCZGUpwAon" },
    vaskaskapur: { label:"Vaskaskápur", zone:"floor", cls:"floor", defaultW:800, minW:500, maxW:1500, h:800, d:600, minH:600, maxH:1000, minD:400, maxD:750, hasInterior:false, counter:true, sink:true,
                   skapategundOverride:"Grunnskápur", note:"Vaskaskápur — útskurður fyrir vask og lagnir; vinsamlegast staðfestu vaskstærð og gerð." },
    opnarhillur: { label:"Opnar hillur", zone:"wall", cls:"wall", defaultW:600, minW:200, maxW:1200, h:700, d:300, minH:200, maxH:1200, minD:200, maxD:450, hasInterior:false, open:true, shelfRange:[1,5,3],
                   skapategundOverride:"Efriskápur", note:"Opnar hillur — engin hurð; viðskiptavinur óskar eftir opnum hillum." },
    // Úthlið (end panel): 19 mm thick, same material as the fronts. Placed at
    // the end of a run it copies height/depth from the cabinet it butts up to.
    uthlid:      { label:"Úthlið — neðri", zone:"floor", cls:"floor", defaultW:19, minW:19, maxW:19, h:800, d:600, minH:300, maxH:1000, minD:100, maxD:750, hasInterior:false, panel:true,
                   skapategundOverride:"Grunnskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu)." },
    uthlidhar:   { label:"Úthlið — há", zone:"floor", cls:"tall", defaultW:19, minW:19, maxW:19, h:2400, d:600, minH:1000, maxH:2600, minD:100, maxD:750, hasInterior:false, panel:true,
                   skapategundOverride:"Hárskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu)." },
    uthlidefri:  { label:"Úthlið — efri", zone:"wall", cls:"wall", defaultW:19, minW:19, maxW:19, h:1000, d:300, minH:200, maxH:1200, minD:100, maxD:450, hasInterior:false, panel:true,
                   skapategundOverride:"Efriskápur", note:"Úthlið, 19 mm þykk, sama efni og framhliðar (stendur við enda á skápalínu)." },
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
  function floorTexture(key){
    var f = FLOORS[key] || FLOORS[DEFAULT_FLOOR];
    return f.kind === "tile" ? window.KPMat.tileFloorTexture(f.color, 0.12) : window.KPMat.plankFloorTexture(f.color, f.rows);
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
    hvitt:   { label:"Hvítt",     hex:"#f1efe8" },
    ljosgra: { label:"Ljósgrátt", hex:"#d9d6cd" },
    blatt:   { label:"Ljósblátt", hex:"#cdd9e0" },
    graent:  { label:"Sölvígrænt",hex:"#d3d9c9" }
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
  var TOPS = {};
  Object.keys(KPCAT.tops).forEach(function(k){ TOPS[k] = KPCAT.tops[k]; });

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
        fm.map = floorMat.map; fm.bumpMap = floorMat.bumpMap; // shared, kept textures
        floorMat.map.repeat.set(1 / floorMat.userData.tile, 1 / floorMat.userData.tile);
        if (floorMat.bumpMap) floorMat.bumpMap.repeat.set(1 / floorMat.userData.tile, 1 / floorMat.userData.tile);
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
      floorMat.map.repeat.set(rx, ry);
      if (floorMat.bumpMap) floorMat.bumpMap.repeat.set(rx, ry);
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
      m.castShadow = true;
      scene.add(m);
      if (!mesh) mesh = m;
    });
    return mesh;
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
      ? new THREE.MeshPhysicalMaterial({ color:0xbfd8e8, roughness:0.05, metalness:0, transparent:true, opacity:0.32, side:THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color:0xd9d2c4, roughness:0.55, transparent:true, opacity:1, side:THREE.DoubleSide });
    if (selected && !isGap){ mat.emissive = new THREE.Color(SELECT_COLOR); mat.emissiveIntensity = 0.55; }
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
      return;
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
  function addFrontDetails(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta){
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
    var handleMat = new THREE.MeshStandardMaterial({ color:hdef.color || 0x55575a, metalness:hdef.color ? 0.55 : 0.75, roughness:0.34 });
    function hbar(len, y, along, out){ place(new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.02), handleMat), y, out || 0.012, along); }

    // Oven tower: drawer below, 595 mm oven (dark glass + control strip + bar
    // handle), door above.
    if (isOven){
      var oy = baseYM + 0.55, oh = 0.595;
      var glassMat = new THREE.MeshStandardMaterial({ color:0x141518, roughness:0.12, metalness:0.5 });
      [oy, oy + oh].forEach(function(y){ place(new THREE.Mesh(new THREE.PlaneGeometry(widthM + 0.002, 0.005), seamMat), y, 0.004); });
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, oh - 0.13, 0.012), glassMat), oy + (oh - 0.13) / 2 + 0.005, 0.006);
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, 0.06, 0.012), new THREE.MeshStandardMaterial({ color:0x2b2c30, roughness:0.4, metalness:0.4 })), oy + oh - 0.05, 0.006);
      place(new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.7, 0.018, 0.028), handleMat), oy + oh - 0.105, 0.024);
      if (handleKey && hstyle !== "none" && hstyle !== "groove"){
        hbar(Math.min(0.24, widthM * 0.5), oy - 0.06, 0);                    // drawer below the oven
        hbar(Math.min(0.24, widthM * 0.5), oy + oh + 0.06, 0);               // door above
      }
      return;
    }

    // Wide door units (≥ 750 mm) read as double doors: a centre seam.
    var wideDoor = !drawers && widthM >= 0.75 && !(meta && meta.fridge) && !isCorner;
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
      var hm = getModel("handles", handleKey);
      if (hm){ // a real handle model: back against the front, anchored where the procedural one would sit
        var hb = new THREE.Box3().setFromObject(hm), hsz = hb.getSize(new THREE.Vector3()), holder = new THREE.Group();
        hm.position.set(0, -hsz.y / 2, hsz.z / 2);
        holder.add(hm);
        place(holder, hstyle === "edge" || hstyle === "tab" ? edgeY : hy, 0, hOff);
        return;
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
    var art = !!(meta && meta.locked && meta.openMat && !meta.oven && !meta.open && !meta.panel && meta.zone !== "opening");
    var bodyD = art ? depthM - FRONT_T : depthM;
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * (bodyD / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * (bodyD / 2);
    // Floor units stand on a recessed plinth (sökkull): the body starts 100 mm
    // up and a dark, set-back block fills the gap, as in a real kitchen.
    var plinthM = meta && meta.plinth ? 0.1 : 0;
    var bodyBase = baseYM + plinthM, bodyH = heightM - plinthM;
    var boxGeo = window.__RoundedBox__
      ? new window.__RoundedBox__(widthM, bodyH, bodyD, 3, 0.004)
      : new THREE.BoxGeometry(widthM, bodyH, bodyD);
    scaleFrontUV(boxGeo, widthM, bodyH, frontMat.userData && frontMat.userData.tile);
    var useFrontMat = frontMat;
    if (selected){
      useFrontMat = frontMat.clone();
      useFrontMat.emissive = new THREE.Color(SELECT_COLOR);
      useFrontMat.emissiveIntensity = 0.35;
    }
    var isOpen = !!(meta && meta.open && meta.openMat);
    var isPanel = !!(meta && meta.panel); // úthlið / loose shelf: solid board in the front material on every face
    var mesh = new THREE.Mesh(boxGeo, art ? [meta.openMat, meta.openMat, meta.openMat, meta.openMat, meta.hiddenMat, meta.openMat]
      : isOpen
      ? [meta.openMat, meta.openMat, meta.openMat, meta.openMat, meta.hiddenMat, meta.openMat] // no front, inside faces visible
      : isPanel ? [frontMat, frontMat, frontMat, frontMat, useFrontMat, frontMat]
      : [carcassMat, carcassMat, carcassMat, carcassMat, useFrontMat, carcassMat]);
    mesh.position.set(cx, bodyBase + bodyH / 2, cz);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    mesh.quaternion.copy(quat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (meta) mesh.userData = meta;
    if (meta){ meta.selected = !!selected; meta.baseFront = frontMat; meta.art = art; }
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
      new THREE.LineBasicMaterial({ color: selected ? SELECT_COLOR : (meta && meta.warn ? WARN_COLOR : 0x2a2a2a), transparent:true, opacity: (selected || (meta && meta.warn)) ? 1 : 0.4 })
    );
    edges.position.copy(mesh.position);
    if (art) edges.position.x += geom.normal.x * FRONT_T / 2, edges.position.z += geom.normal.z * FRONT_T / 2; // the outline wraps the fronts too
    edges.quaternion.copy(mesh.quaternion);
    group.add(edges);
    if (meta) meta.edgesObj = edges;
    if (meta && meta.zone !== "opening"){ // back-face fade (see fadeCabinets in buildScene)
      group.userData.cab = { blockId:meta.blockId, nx:geom.normal.x, nz:geom.normal.z, d:geom.normal.x * geom.origin.x + geom.normal.z * geom.origin.z, t:0, items:null };
      (scene.userData.cabs = scene.userData.cabs || []).push(group);
    }

    function local(alongM, y, outM){ // point on this cabinet: centre-line offset, height, distance out from the wall
      return new THREE.Vector3(
        geom.origin.x + geom.axis.x * (offsetM + widthM / 2 + alongM) + geom.normal.x * outM, y,
        geom.origin.z + geom.axis.z * (offsetM + widthM / 2 + alongM) + geom.normal.z * outM);
    }

    if (plinthM && meta && meta.plinthMat){
      // a hair shorter than the gap so its top never shares a plane with the body's underside (z-fighting showed through an open cabinet)
      var pl = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.004, plinthM - 0.004, depthM - 0.063), meta.plinthMat);
      pl.position.copy(local(0, baseYM + (plinthM - 0.004) / 2, 0.003 + (depthM - 0.063) / 2)); // 3 mm off the wall line so its back face never shares a plane with the skirting/wall
      pl.quaternion.copy(quat);
      pl.receiveShadow = true;
      group.add(pl);
    }
    if (meta && meta.counter && meta.stoneMat){
      var topGeo = new THREE.BoxGeometry(widthM + 0.001, 0.032, depthM + 0.02);
      scaleFrontUV(topGeo, widthM, depthM + 0.02, meta.stoneMat.userData && meta.stoneMat.userData.tile);
      var top = new THREE.Mesh(topGeo, meta.stoneMat);
      top.position.copy(local(0, baseYM + heightM + 0.016, (depthM + 0.02) / 2));
      top.quaternion.copy(quat);
      top.castShadow = true; top.receiveShadow = true;
      group.add(top);
      if (meta.sink) addSink(THREE, group, local, quat, widthM, depthM, baseYM + heightM + 0.032);
    }

    if (isOpen){ // shelf boards
      for (var sh = 1; sh <= (meta.shelves || 0); sh++){
        var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.036, 0.018, depthM - 0.02), meta.openMat);
        board.position.copy(local(0, bodyBase + bodyH * sh / ((meta.shelves || 0) + 1), (depthM - 0.02) / 2 + 0.005));
        board.quaternion.copy(quat); board.castShadow = true; board.receiveShadow = true;
        group.add(board);
      }
    }
    if (interior && interior.mode === "skuffur" && !art){
      addDrawerSeams(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior.count, interior.fractions);
    }
    if (meta && meta.locked && meta.zone !== "opening") addLockBadge(THREE, group, local(0, baseYM + heightM + (meta.counter ? 0.16 : 0.1), depthM / 2));
    if (art) addArticulated(THREE, scene, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta, useFrontMat, pickables);
    else if (meta && meta.zone !== "opening" && !isPanel) addFrontDetails(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta.handle, !!meta.tall, meta.zone === "wall", meta.split || 0.55, meta);
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
  function applyPart(p){
    var e = partEase(p);
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
      var board = new THREE.Mesh(new THREE.BoxGeometry(widthM - 2 * T, 0.018, CD - 0.03), meta.openMat);
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
    var L = drawers === 3 && meta.drawerSystem ? DRAWER_LAYOUT[meta.drawerSystem] : null;
    var sysKey = meta.drawerSystem || "legra";
    var wide = !drawers && widthM >= 0.75 && !meta.fridge && !meta.corner;
    var parts = (scene.userData.parts = scene.userData.parts || []);

    function makeLeaf(idx, cxL, w, y0, y1, hinge, f, fi){
      var key = meta.blockId + ":" + idx;
      var g = new THREE.Group(), pivotX = f.drawer ? 0 : (hinge === "left" ? cxL - w / 2 : cxL + w / 2), fh = y1 - y0;
      g.position.set(pivotX, 0, 0);
      var pmeta = Object.assign({}, meta, { isPart:true, partKey:key }), meshes = [];
      var slab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, fh, FRONT_T), frontMat);
      scaleFrontUV(slab.geometry, w - 0.004, fh, frontMat.userData && frontMat.userData.tile);
      slab.position.set(cxL - pivotX, (y0 + y1) / 2, CD + FRONT_T / 2);
      slab.castShadow = true; slab.receiveShadow = true;
      g.add(slab); meshes.push(slab);
      if (meta.handle){
        var tmp = new THREE.Group();
        var fake = { origin:{ x:cxL - w / 2, z:0 }, axis:{ x:1, z:0 }, normal:{ x:0, z:1 }, lenM:w };
        addFrontDetails(THREE, tmp, fake, 0, w, fh, y0, depthM, { mode:"skuffur", count:1 }, meta.handle, false, meta.zone === "wall" || (meta.tall && fi > 0 && !f.drawer), 0.55, {});
        tmp.children.slice().forEach(function(ch){ ch.position.x -= pivotX; g.add(ch); if (ch.isMesh) meshes.push(ch); else ch.traverse(function(o){ if (o.isMesh) meshes.push(o); }); });
      }
      if (f.drawer){
        var side = fi != null && L ? L.sides.slice().reverse()[fi] : Math.max(50, Math.min(200, Math.round(fh * 1000 - 55)));
        side = Math.max(40, Math.min(side, fh * 1000 - 40));
        var real = L ? getModel("drawers", sysKey + "_" + L.codes[2 - fi]) : null, bx;
        if (real){
          var rb = new THREE.Box3().setFromObject(real), rs = rb.getSize(new THREE.Vector3());
          bx = new THREE.Group(); real.position.set(0, 0, -rb.max.z); bx.add(real);
          bx.position.set(0, y1 - 0.03 - rs.y, CD - 0.005);
        } else {
          bx = buildDrawerBox(THREE, sysKey, meta.carcassKey, side, Math.max(0.2, widthM - 2 * T - 0.026), Math.max(0.2, Math.min(0.5, CD - 0.06)), L ? L.codes[2 - fi] : null);
          bx.position.set(0, y1 - 0.03 - side / 1000, CD - 0.005);
        }
        g.add(bx); bx.traverse(function(o){ if (o.isMesh) meshes.push(o); });
        if (bx.userData && bx.userData.runners){ var rgR = bx.userData.runners; rgR.position.copy(bx.position); frame.add(rgR); } // runners stay in the cabinet
      }
      meshes.forEach(function(m){ m.userData = pmeta; pickables.push(m); });
      var prev = PART_STATE[key];
      var part = { key:key, group:g, kind:f.drawer ? "drawer" : "door", hinge:hinge, slide:Math.min(0.34, CD * 0.6), cur:prev ? prev.cur : 0, target:prev ? prev.target : 0 };
      PART_STATE[key] = part; parts.push(part); applyPart(part);
      frame.add(g);
    }

    var idx = 0;
    fronts.forEach(function(f, fi){
      var y0 = bodyBase + bodyH * f.y0 + 0.0015, y1 = bodyBase + bodyH * f.y1 - 0.0015;
      if (f.drawer) makeLeaf(idx++, 0, widthM, y0, y1, "left", f, fi);
      else if (meta.corner){
        var left = meta.doorSide === "left", hw = widthM / 2;
        makeLeaf(idx++, left ? -hw / 2 : hw / 2, hw, y0, y1, left ? "left" : "right", f, fi);
        var blind = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.004, y1 - y0, FRONT_T), frontMat); // fixed blind panel on the other half
        scaleFrontUV(blind.geometry, hw - 0.004, y1 - y0, frontMat.userData && frontMat.userData.tile);
        blind.position.set(left ? hw / 2 : -hw / 2, (y0 + y1) / 2, CD + FRONT_T / 2); blind.castShadow = true;
        frame.add(blind);
      } else if (wide){
        makeLeaf(idx++, -widthM / 4, widthM / 2, y0, y1, "left", f, fi);
        makeLeaf(idx++, widthM / 4, widthM / 2, y0, y1, "right", f, fi);
      } else makeLeaf(idx++, 0, widthM, y0, y1, meta.hingeRight ? "right" : "left", f, fi);
    });
  }

  // Stainless sink basin + tap on top of a worktop.
  function addSink(THREE, group, local, quat, widthM, depthM, topY){
    var steel = new THREE.MeshStandardMaterial({ color:0xb9bec4, metalness:0.85, roughness:0.28 });
    var w = Math.min(0.62, widthM * 0.72), d = Math.min(0.42, depthM * 0.62);
    var basin = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), steel);
    basin.position.copy(local(0, topY + 0.002, depthM * 0.5 + 0.01)); basin.quaternion.copy(quat);
    var inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 0.005, d - 0.05), new THREE.MeshStandardMaterial({ color:0x6f757b, metalness:0.7, roughness:0.4 }));
    inner.position.copy(local(0, topY + 0.004, depthM * 0.5 + 0.01)); inner.quaternion.copy(quat);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.2, 14), steel);
    stem.position.copy(local(0, topY + 0.1, 0.07));
    var spout = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 12), steel);
    spout.rotation.x = Math.PI / 2; spout.quaternion.premultiply(quat);
    spout.position.copy(local(0, topY + 0.2, 0.15));
    [basin, inner, stem, spout].forEach(function(m){ m.castShadow = true; group.add(m); });
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
      if (!opts.onSelect && !opts.onCabinetDragEnd) return; // read-only view (review page): leave every press to OrbitControls
      var mesh = pickMeshAt(evt);
      if (!mesh) return;
      if (mesh.userData.locked && mesh.userData.zone !== "opening"){
        // locked cabinet: it cannot be dragged, so the press is left to OrbitControls; a tap opens/closes a drawer/door or selects
        lockTap = { meta:mesh.userData, x:evt.clientX, y:evt.clientY };
        return;
      }
      evt.stopPropagation();
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
        drag.groups.forEach(function(g){ g.matrixAutoUpdate = false; g.matrix.makeTranslation(drag.dx, 0, drag.dz); g.matrixWorldNeedsUpdate = true; });
        return;
      }
      var drop = dropAt(evt);
      followCursor(drop);
      if (opts.onCabinetDragMove) opts.onCabinetDragMove(drag.meta, drop);
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
      tgtPos.set(
        g.origin.x + g.axis.x * (offsetM + widthM / 2) + g.normal.x * (depthM / 2),
        ty,
        g.origin.z + g.axis.z * (offsetM + widthM / 2) + g.normal.z * (depthM / 2));
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
          d0.groups.forEach(function(g){ g.matrix.identity(); g.matrixWorldNeedsUpdate = true; });
          suppressClick = true;
          if (opts.onIslandDragEnd) opts.onIslandDragEnd(d0.meta.islandId, Math.round(d0.dx * 1000), Math.round(d0.dz * 1000));
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
      m.userData.tile = { w:0.9, h:0.9 };
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

  function makeFrontMaterial(THREE, lookKey, look){
    if (look.tex){ // a real board texture from the gallery
      var im = new THREE.MeshStandardMaterial({ map:imgTex(THREE, look.tex), roughness:0.58 });
      im.userData.tile = { w:0.6, h:0.6 };
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
  function scaleFrontUV(geo, widthM, heightM, tile){
    if (!tile) return;
    var uv = geo.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * widthM / tile.w, uv.getY(i) * heightM / tile.h);
    uv.needsUpdate = true;
  }

  // wrap: DOM element to render into. state: the planner's {shape,walls,look}
  // object. opts (optional): {selectedId, onSelect(meta|null)} — onSelect is
  // called with {wallId,zone,blockId} when a cabinet is clicked, or null on
  // a click that hit nothing (deselect).
  function buildScene(wrap, state, opts){
    opts = opts || {};
    var THREE = window.__THREE__;
    var OrbitControls = window.__OrbitControls__;

    var geoms = wallGeoms(state);
    var surfaces = surfacesOf(state), allGeoms = geoms.concat(islandGeoms(state)); // walls + island rows
    var carcass = state.carcass ? CARCASS[state.carcass] : null;
    var carcassMat = new THREE.MeshStandardMaterial({ color: carcass ? carcass.color3d : "#3a3a3a", roughness:0.9 });
    var wallColor = state.wallColor && WALL_COLORS[state.wallColor] ? WALL_COLORS[state.wallColor].hex : "#f1efe8";
    var wallMat = new THREE.MeshStandardMaterial({ color:wallColor, roughness:1, side:THREE.DoubleSide });
    var floorMat;
    if (window.KPMat){
      var ft = floorTexture(state.floor), isTile = (FLOORS[state.floor] || {}).kind === "tile";
      floorMat = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, ft.color, true), bumpMap:canvasTex(THREE, ft.bump, false), bumpScale:isTile ? 0.35 : 0.7, roughness:isTile ? 0.38 : 0.58 });
      floorMat.userData.tile = ft.tileW;
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);

    var bbox = addFloor(THREE, scene, geoms, floorMat, stateBounds(state, geoms));
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
    geoms.forEach(function(g, i){
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
      if (isOpenGeom(gi)) return;
      var sk = new THREE.Mesh(new THREE.BoxGeometry(g.lenM, 0.09, 0.014), skirtMat);
      sk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      sk.position.set(g.origin.x + g.axis.x * g.lenM / 2 + g.normal.x * 0.005, 0.045, g.origin.z + g.axis.z * g.lenM / 2 + g.normal.z * 0.005); // back face 2 mm behind the wall line: seen from behind it no longer z-fights with the plinth's back face
      sk.receiveShadow = true;
      scene.add(sk);
    });

    // open edges of an open-plan kitchen: no wall, just a dashed line on the floor
    geoms.forEach(function(g, gi){
      if (!isOpenGeom(gi)) return;
      var pts = [new THREE.Vector3(g.origin.x, 0.012, g.origin.z), new THREE.Vector3(g.origin.x + g.axis.x * g.lenM, 0.012, g.origin.z + g.axis.z * g.lenM)];
      var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color:0x6f6d66, dashSize:0.12, gapSize:0.08 }));
      line.computeLineDistances();
      scene.add(line);
    });
    var wallFades = [];
    geoms.forEach(function(g, gi){
      if (isOpenGeom(gi)) return;
      var mat = wallMat.clone();
      mat.transparent = true;
      var wid = state.walls[gi] && state.walls[gi].id;
      var gaps = (state.doors || []).filter(function(d){ return d.gap && d.wallId === wid; })
        .map(function(d){ return { offM:d.offsetMm / 1000, widM:d.widthMm / 1000, hM:Math.min(d.heightMm, roomHeightMm) / 1000 }; });
      wallFades.push({ mesh:addWallPlane(THREE, scene, g, WALL_H, mat, gaps), geom:g, mat:mat });
    });

    function geomForWall(wallId){
      var wi = state.walls.findIndex(function(w){ return w.id === wallId; });
      return wi === -1 || state.walls[wi].open ? null : geoms[wi];
    }
    var pickables = [];
    (state.windows || []).forEach(function(win){
      var g = geomForWall(win.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, win.offsetMm / 1000, win.widthMm / 1000, win.heightMm / 1000,
        win.sillHeightMm / 1000, WINDOW_MARKER_COLOR, 0.55,
        { wallId:win.wallId, zone:"opening", kind:"window", blockId:win.id, widthMm:win.widthMm, depthMm:10, heightMm:win.heightMm, elevMm:win.sillHeightMm }, opts.selectedId === win.id, pickables);
    });
    (state.doors || []).forEach(function(door){
      var g = geomForWall(door.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, door.offsetMm / 1000, door.widthMm / 1000, door.heightMm / 1000,
        0, DOOR_MARKER_COLOR, 0.85,
        { wallId:door.wallId, zone:"opening", kind:"door", gap:!!door.gap, blockId:door.id, widthMm:door.widthMm, depthMm:10, heightMm:door.heightMm, elevMm:0 }, opts.selectedId === door.id, pickables);
    });

    // built-in fridge reads as an appliance: brushed-steel front instead of the kitchen's fronts
    var steelMat = new THREE.MeshStandardMaterial({ color:0xc9ccd1, metalness:0.75, roughness:0.32 });
    // shared by every floor unit: recessed plinth + honed-stone worktop
    var plinthMat = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 });
    // open-shelf units: inside faces must render (double-sided) and the front is left out
    var openMat = carcassMat.clone(); openMat.side = THREE.DoubleSide;
    var hiddenMat = new THREE.MeshBasicMaterial({ visible:false });
    var stoneMat = makeTopMaterial(THREE, state.top);
    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = look && window.KPMat
      ? makeFrontMaterial(THREE, state.look, look)
      : new THREE.MeshStandardMaterial({ color: look ? look.color3d : 0xb7b2a4, roughness:0.7 });

    surfaces.forEach(function(wall, wi){
      var g = allGeoms[wi];
      if (!g) return;
      var fStarts = blockStartsMm(wall.floor, cornerClearanceMm(surfaces, wi, "floor")), wStarts = blockStartsMm(wall.wall, 0);
      var islandId = wall.island ? wall.island.id : undefined;
      wall.floor.forEach(function(b, bi){
        var offset = fStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        var inter = b.interior && b.interior.mode === "skuffur" && b.interior.count === 3 && state.drawerSystem
          ? Object.assign({}, b.interior, { fractions:drawerFractions(state.drawerSystem, hM * 1000 - 100) }) : b.interior;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, carcassMat, c.fridge ? steelMat : frontMat, inter,
          { islandId:islandId, locked:!!b.locked, corner:c.cls === "corner", doorSide:b.swing === "vinstri" ? "left" : "right", hingeRight:b.swing === "haegri", shelves:(c.hasInterior || c.shelfRange) && !(b.interior && b.interior.mode === "skuffur") ? (shelvesOf(b) || 0) : 0,
            openMat:openMat, hiddenMat:hiddenMat, drawerSystem:state.drawerSystem, carcassKey:state.carcass,
            warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), wallId:wall.id, zone:"floor", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d), heightMm:hM * 1000, elevMm:0, handle:state.handle, tall:c.cls === "tall" || !!c.fridge, split:c.fridge ? 0.74 : 0.55,
            plinth:!c.panel, counter:!!c.counter, sink:!!c.sink, oven:!!c.oven, panel:!!c.panel, plinthMat:plinthMat, stoneMat:stoneMat }, selected, pickables);
      });
      wall.wall.forEach(function(b, bi){
        var offset = wStarts[bi];
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        var elevM = elevOf(b) / 1000;
        var metaBase = { locked:!!b.locked, drawerSystem:state.drawerSystem, carcassKey:state.carcass, warn:!!(opts.warnIds && opts.warnIds.indexOf(b.id) >= 0), wallId:wall.id, zone:"wall", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d),
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
          Object.assign(metaBase, { open:!!c.open, panel:!!c.panel, openMat:openMat, hiddenMat:hiddenMat, shelves:c.open ? shelvesOf(b) : (c.shelfRange ? (shelvesOf(b) || 0) : 0) }), selected, pickables);
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

    // Soft daylight: sky/ground hemisphere fill + a warm key light with soft
    // shadows fitted to the room + a faint cool fill from the other side.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb4a4, 0.5));
    var dir = new THREE.DirectionalLight(0xfff5e6, 1.0);
    dir.position.set(bbox.cx + 3.2, 5.5, bbox.cz + 4);
    dir.target.position.set(bbox.cx, 0.8, bbox.cz);
    scene.add(dir.target);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    var SR = Math.max(bbox.w, bbox.d) * 0.75 + 1;
    dir.shadow.camera.left = -SR; dir.shadow.camera.right = SR; dir.shadow.camera.top = SR; dir.shadow.camera.bottom = -SR;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 18;
    dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.02; dir.shadow.radius = 3;
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0xdfe8ff, 0.22);
    fill.position.set(bbox.cx - 3, 3, bbox.cz - 3);
    scene.add(fill);

    var camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    var dist = Math.max(bbox.w, bbox.d) * (geoms.closed ? 0.95 : 0.74) + (geoms.closed ? 1.7 : 1.2);
    camera.position.set(bbox.cx + dist * 0.6, dist * 0.55, bbox.cz + dist * 0.9);

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
    wrap.appendChild(renderer.domElement);

    // Subtle image-based lighting so steel, handles and the satin finish pick up
    // believable reflections; plus sharper textures at glancing angles.
    if (window.__RoomEnvironment__){
      if (!sharedEnv){
        var pmrem = new THREE.PMREMGenerator(renderer);
        sharedEnv = pmrem.fromScene(new window.__RoomEnvironment__(renderer), 0.04).texture;
        pmrem.dispose();
      }
      scene.environment = sharedEnv;
    }
    var maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    scene.traverse(function(o){
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(function(m){
        if (m.envMapIntensity !== undefined) m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.3;
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
    if (savedCameraState){
      camera.position.copy(savedCameraState.position);
      controls.target.copy(savedCameraState.target);
    }
    controls.update();

    var cleanupInteraction = setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, allGeoms, surfaces, opts, WALL_H);
    THREE_STATE = { renderer:renderer, camera:camera, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupInteraction:cleanupInteraction,
                    walls:surfaces, geoms:allGeoms, previewMesh:null, dragging:false, opts:opts, pickables:pickables, roomHM:WALL_H, wallHi:null };
    if (opts.selectedWallId) setSelectedWall3D(opts.selectedWallId);

    function resize(){
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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
        wallVec.set(camera.position.x - cx, 0, camera.position.z - cz);
        var behind = wallVec.x * w.geom.normal.x + wallVec.z * w.geom.normal.z < 0;
        var target = behind ? 0.1 : 1;
        w.mat.opacity += (target - w.mat.opacity) * 0.2;
        w.mat.depthWrite = w.mat.opacity > 0.6;
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
          c.items.push({ o:o, orig:o.material, ghost:Array.isArray(o.material) ? o.material.map(cl) : cl(o.material) });
        });
      }
      c.items.forEach(function(it){
        (Array.isArray(it.ghost) ? it.ghost : [it.ghost]).forEach(function(m){ m.opacity = 1 - (1 - GHOST_OPACITY) * t; m.depthWrite = t < 0.4; });
        it.o.material = t > 0.01 ? it.ghost : it.orig;
      });
    }
    function fadeCabinets(){
      (scene.userData.cabs || []).forEach(function(gr){
        var c = gr.userData.cab;
        var behind = camera.position.x * c.nx + camera.position.z * c.nz - c.d < -0.05;
        var want = behind && !THREE_STATE.dragging && opts.selectedId !== c.blockId ? 1 : 0;
        if (c.t === want) return;
        c.t = Math.abs(want - c.t) < 0.01 ? want : c.t + (want - c.t) * 0.2;
        ghostApply(gr, c.t);
      });
    }

    function loop(){
      THREE_STATE.rafId = requestAnimationFrame(loop);
      controls.update();
      settleLanded();
      if (THREE_STATE.dragStep) THREE_STATE.dragStep();
      fadeWalls();
      fadeCabinets();
      stepParts(scene);
      renderer.render(scene, camera);
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
    box(W - 0.004, PL - 0.004, CD - 0.06, 0, (PL - 0.004) / 2, (CD - 0.06) / 2, new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 }));
    box(T, BODY, CD, -W / 2 + T / 2, PL + BODY / 2, CD / 2, carcassMat);                 // sides
    box(T, BODY, CD, W / 2 - T / 2, PL + BODY / 2, CD / 2, carcassMat);
    box(W - 2 * T, T, CD, 0, PL + T / 2, CD / 2, carcassMat);                              // bottom
    box(W - 2 * T, T, CD, 0, H - T / 2, CD / 2, carcassMat);                               // top
    box(W - 2 * T, BODY - 2 * T, 0.008, 0, PL + BODY / 2, 0.004, carcassMat);              // back
    if (cfg.showTop){
      var topMat = makeTopMaterial(THREE, cfg.top);
      var topGeo = new THREE.BoxGeometry(W + 0.001, 0.032, D + 0.02);
      scaleFrontUV(topGeo, W + 0.001, D + 0.02, topMat.userData && topMat.userData.tile); // over the top face (width × depth), not the thin edge
      var topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(0, H + 0.016, (D + 0.02) / 2); topMesh.castShadow = true; topMesh.receiveShadow = true;
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
        var slab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.004, fh, FRONT_T), frontMat);
        scaleFrontUV(slab.geometry, W - 0.004, fh, frontMat.userData && frontMat.userData.tile);
        slab.position.set(0, (y0 + y1) / 2, CD + FRONT_T / 2); slab.castShadow = true; slab.receiveShadow = true;
        dg.add(slab); pickables.push(slab);
        if (cfg.showHandle && cfg.handle){
          var tmp = new THREE.Group();
          addFrontDetails(THREE, tmp, geomFake, 0, W, fh, y0, D, { mode:"skuffur", count:1 }, cfg.handle, false, false, 0.55, {});
          tmp.children.slice().forEach(function(ch){ dg.add(ch); if (ch.isMesh) pickables.push(ch); });
        }
      }
      if (showBoxes){
        var real = L ? getModel("drawers", cfg.drawer + "_" + L.codes[2 - i]) : null, bx;
        if (real){ // real model: front edge at the front, top just under the drawer front's top
          var rb = new THREE.Box3().setFromObject(real), rs = rb.getSize(new THREE.Vector3());
          bx = new THREE.Group(); real.position.set(0, 0, -rb.max.z); bx.add(real);
          bx.position.set(0, y1 - 0.03 - rs.y, CD - 0.005);
        } else {
          bx = buildDrawerBox(THREE, cfg.drawer, cfg.carcass, sides[i], null, null, L ? L.codes[2 - i] : null);
          bx.position.set(0, y1 - 0.03 - sides[i] / 1000, CD - 0.005);
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
    PREVIEW.cleanupPick = function(){ dom.removeEventListener("pointerdown", onDown); dom.removeEventListener("pointerup", onUp); dom.removeEventListener("pointermove", onMove); dom.style.cursor = ""; };

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
    floorPlanColor: floorPlanColor,
    TOP_GROUPS: TOP_GROUPS,
    CARCASS: CARCASS,
    DRAWER_SYSTEMS: DRAWER_SYSTEMS,
    DRAWER_LAYOUT: DRAWER_LAYOUT,
    HANDLES: HANDLES,
    wallGeometry3D: wallGeometry3D,
    cornerClearanceMm: cornerClearanceMm,
    blockStartsMm: blockStartsMm,
    planTransform: planTransform,
    rectCornersWorld: rectCornersWorld,
    WALL_COLORS: WALL_COLORS,
    WINDOW_DEFAULT: WINDOW_DEFAULT,
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
    shelvesOf: shelvesOf,
    hideDragPreview3D: hideDragPreview3D,
    teardown3D: teardown3D
  };
})();
