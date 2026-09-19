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
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:800,  d:600, minH:800,  maxH:800,  minD:600, maxD:600, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,4,1], counter:true },
    harskapur:   { label:"Hárskápur",   zone:"floor", cls:"tall",  defaultW:600, minW:600, maxW:600, h:2400, d:600, minH:2400, maxH:2400, minD:600, maxD:600, hasInterior:true, drawerCountRange:[1,5], shelfRange:[0,8,5] },
    efriskapur:  { label:"Efriskápur",  zone:"wall",  cls:"wall",  defaultW:600, minW:600, maxW:600, h:1000, d:300, minH:1000, maxH:1000, minD:300, maxD:300, hasInterior:false, shelfRange:[0,5,2] },
    // Built-in fridge: NOT its own Skápategund in the schema (Skápategund has
    // Grunn/Hár/Efri/Lagna/Ofna/Loftunarskápur only) — physically a Hárskápur
    // housing a bought appliance, so it submits as Hárskápur plus a plain note
    // (same pattern as the drawer note) and Rakel confirms the niche size.
    isskapur:    { label:"Ísskápur (innbyggður)", zone:"floor", cls:"fridge", defaultW:600, minW:600, maxW:600, h:2400, d:600, minH:2400, maxH:2400, minD:600, maxD:600, hasInterior:false,
                   skapategundOverride:"Hárskápur", fridge:true,
                   note:"Viðskiptavinur óskar eftir innbyggðum ísskáp í þessum skáp — vinsamlegast staðfestu stærð tækis (nisju) og hurðargerð." },
    // legacy:true = not offered in the editor's catalog, but kept so drafts
    // and already-submitted plans (Rakel's review page renders those) that
    // contain them still draw and submit correctly instead of crashing or
    // silently dropping a cabinet.
    ofnaskapur:  { label:"Ofnaskápur",  zone:"floor", cls:"oven",  defaultW:600, minW:600, maxW:600, h:2100, d:600, minH:1800, maxH:2200, minD:600, maxD:600, hasInterior:false, ovenHeightMm:595, legacy:true },
    tofrahorn:   { label:"Töfrahorn (kapphorn)", zone:"floor", cls:"corner", defaultW:900, minW:900, maxW:900, h:800, d:900, minH:800, maxH:800, minD:900, maxD:900, hasInterior:false,
                   skapategundOverride:"Grunnskápur", tofrahornId:"rec9PD5fCZGUpwAon", legacy:true }
  };

  // Loose shelves (Eyðublað "Lausar hillur fjöldi"): the customer's choice,
  // else the type's default. Not meaningful for a drawer unit.
  function shelvesOf(b){
    var c = CATALOG[b.type];
    if (!c || !c.shelfRange) return null;
    return b.shelves != null ? Math.max(c.shelfRange[0], Math.min(c.shelfRange[1], b.shelves)) : c.shelfRange[2];
  }

  // Width variants ("underskápar") of the three core types. Same height/depth
  // and same real Skápategund (skapategundOverride = the core's label), only
  // Breidd differs — so no new Airtable choices are needed. Offered in the
  // editor's catalog under "Fleiri stærðir"; edit this list to add or remove.
  var WIDTH_VARIANTS = {
    grunnskapur: [300, 400, 500, 800, 900, 1000, 1200],
    harskapur:   [300, 400, 500, 800, 900],
    efriskapur:  [300, 400, 500, 800, 900, 1000, 1200]
  };
  Object.keys(WIDTH_VARIANTS).forEach(function(base){
    WIDTH_VARIANTS[base].forEach(function(w){
      var b = CATALOG[base];
      CATALOG[base + "_" + w] = Object.assign({}, b, {
        label: b.label + " " + w, defaultW:w, minW:w, maxW:w, skapategundOverride:b.label, variantOf:base
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
  var LOOK_CATEGORIES = [
    { key:"sponn",         label:"Viðarspónn" },
    { key:"melamine-wood", label:"Plastspónn — viðaráferð" },
    { key:"perfectsense",  label:"Perfect Sense — litað" }
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
    if (zoneKey !== "floor" || wallIndex <= 0) return 0;
    var prev = walls[wallIndex - 1];
    if (!prev.turnAfter) return 0;
    var prevLast = prev.floor[prev.floor.length - 1];
    if (!prevLast) return 0;
    var cur = walls[wallIndex];
    var curFirst = cur.floor[0];
    if (CATALOG[prevLast.type].cls === "corner") return 0;
    if (curFirst && CATALOG[curFirst.type].cls === "corner") return 0;
    return prevLast.depthMm || CATALOG[prevLast.type].d;
  }

  var ROOM_DEPTH_M = 2.4; // assumed walkway/room depth beyond each wall, for floor sizing + camera framing only
  var WALL_CABINET_BASE_M = 1.4; // fixed visualization height for Efriskápur, not stored per-cabinet

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
  function interiorBounds(geoms){
    var minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    geoms.forEach(function(g){
      var end = { x:g.origin.x + g.axis.x*g.lenM, z:g.origin.z + g.axis.z*g.lenM };
      // Each wall's endpoints AND those endpoints pushed into the room along
      // the wall's own normal — must only grow on the interior side of a
      // wall, never symmetrically through it.
      [g.origin, end,
       { x:g.origin.x + g.normal.x*ROOM_DEPTH_M, z:g.origin.z + g.normal.z*ROOM_DEPTH_M },
       { x:end.x + g.normal.x*ROOM_DEPTH_M, z:end.z + g.normal.z*ROOM_DEPTH_M }
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

  function addFloor(THREE, scene, geoms, floorMat){
    var b = interiorBounds(geoms);
    var margin = 0.3;
    var w = (b.maxX - b.minX) + margin * 2, d = (b.maxZ - b.minZ) + margin * 2;
    var cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
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

  function addWallPlane(THREE, scene, geom, wallHeightM, wallMat){
    // A real (thin) box instead of a zero-thickness plane — a flat plane
    // viewed edge-on shrinks to a literal zero-width line, which read as a
    // "glitchy" flickering wall from some camera angles. The box's inner
    // (room-facing) surface stays exactly on the wall line; thickness
    // extends outward so cabinet placement (which assumes offset 0 = the
    // wall line) is unaffected.
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(geom.lenM, wallHeightM, WALL_THICKNESS_M), wallMat);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    mesh.position.set(
      geom.origin.x + geom.axis.x * (geom.lenM / 2) - geom.normal.x * (WALL_THICKNESS_M / 2),
      wallHeightM / 2,
      geom.origin.z + geom.axis.z * (geom.lenM / 2) - geom.normal.z * (WALL_THICKNESS_M / 2)
    );
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
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
    var mat = isWin
      ? new THREE.MeshPhysicalMaterial({ color:0xbfd8e8, roughness:0.05, metalness:0, transparent:true, opacity:0.32, side:THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color:0xd9d2c4, roughness:0.55, transparent:true, opacity:1, side:THREE.DoubleSide });
    if (selected){ mat.emissive = new THREE.Color(SELECT_COLOR); mat.emissiveIntensity = 0.55; }
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

  function addDrawerSeams(THREE, scene, geom, offsetM, widthM, heightM, baseYM, depthM, count){
    if (!count || count < 2) return;
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    var seamMat = new THREE.MeshBasicMaterial({ color:0x2a2a2a, side:THREE.DoubleSide });
    var frontOut = depthM + 0.004; // just proud of the front face, avoids z-fighting
    for (var i = 1; i < count; i++){
      var y = baseYM + heightM * (i / count);
      var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * frontOut;
      var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * frontOut;
      var seam = new THREE.Mesh(new THREE.PlaneGeometry(widthM * 0.94, 0.012), seamMat);
      seam.position.set(cx, y, cz);
      seam.quaternion.copy(quat);
      scene.add(seam);
    }
  }

  var SELECT_COLOR = 0x3d61c1;

  // Door seams + handles on a cabinet front (2026-09-19) so cabinets read as
  // cabinets instead of plain boxes. Handle style follows the customer's
  // chosen opening (HANDLES key): a bar (ona), a full-width profile (jey2 /
  // hexxa), a knob (arpa), or a milled groove (fraest); push-open (push)
  // shows no hardware. Fronts: drawers → equal rows, tall unit → two doors,
  // anything else → one door. Purely visual — nothing here is submitted.
  function addFrontDetails(THREE, group, geom, offsetM, widthM, heightM, baseYM, depthM, interior, handleKey, isTall, isWallRow, split, meta){
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, new THREE.Vector3(0, 1, 0), new THREE.Vector3(geom.normal.x, 0, geom.normal.z)));
    var drawers = interior && interior.mode === "skuffur" ? interior.count : 0;
    var fronts = [];
    if (drawers){ for (var i = 0; i < drawers; i++) fronts.push({ y0:i / drawers, y1:(i + 1) / drawers, drawer:true }); }
    else if (isTall){ fronts.push({ y0:0, y1:split }, { y0:split, y1:1 }); }
    else fronts.push({ y0:0, y1:1 });

    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2), cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2);
    function place(mesh, y, out){
      mesh.position.set(cx + geom.normal.x * (depthM + out), y, cz + geom.normal.z * (depthM + out));
      mesh.quaternion.copy(quat);
      group.add(mesh);
    }
    var seamMat = new THREE.MeshBasicMaterial({ color:0x2a2a2a, side:THREE.DoubleSide });
    var handleMat = new THREE.MeshStandardMaterial({ color:0x55575a, metalness:0.65, roughness:0.35 });

    fronts.forEach(function(f, idx){
      // seam between stacked door fronts (drawer seams are drawn separately)
      if (!f.drawer && idx > 0){
        place(new THREE.Mesh(new THREE.PlaneGeometry(widthM * 0.96, 0.008), seamMat), baseYM + heightM * f.y0, 0.004);
      }
      if (!handleKey || handleKey === "push") return;
      var top = baseYM + heightM * f.y1, bottom = baseYM + heightM * f.y0;
      // wall units and the upper door of a tall unit take the handle at the
      // lower edge, everything else at the upper edge
      var atBottom = isWallRow || (isTall && !f.drawer && idx === fronts.length - 1 && fronts.length > 1);
      var edgeY = atBottom ? bottom + 0.02 : top - 0.02;
      var mesh;
      if (handleKey === "ona"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.24, widthM * 0.5), 0.012, 0.02), handleMat);
        place(mesh, atBottom ? bottom + 0.06 : top - (f.drawer ? 0.07 : 0.06), 0.012);
      } else if (handleKey === "jey2" || handleKey === "hexxa"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(widthM * (handleKey === "jey2" ? 0.94 : 0.7), 0.02, 0.016), handleMat);
        place(mesh, edgeY, 0.008);
      } else if (handleKey === "arpa"){
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 12), handleMat);
        place(mesh, atBottom ? bottom + 0.07 : top - 0.07, 0.014);
      } else if (handleKey === "fraest"){
        mesh = new THREE.Mesh(new THREE.BoxGeometry(widthM * 0.9, 0.006, 0.002), seamMat);
        place(mesh, atBottom ? bottom + 0.012 : top - 0.012, 0.002);
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
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * (depthM / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * (depthM / 2);
    // Floor units stand on a recessed plinth (sökkull): the body starts 100 mm
    // up and a dark, set-back block fills the gap, as in a real kitchen.
    var plinthM = meta && meta.plinth ? 0.1 : 0;
    var bodyBase = baseYM + plinthM, bodyH = heightM - plinthM;
    var boxGeo = window.__RoundedBox__
      ? new window.__RoundedBox__(widthM, bodyH, depthM, 3, 0.004)
      : new THREE.BoxGeometry(widthM, bodyH, depthM);
    scaleFrontUV(boxGeo, widthM, bodyH, frontMat.userData && frontMat.userData.tile);
    var useFrontMat = frontMat;
    if (selected){
      useFrontMat = frontMat.clone();
      useFrontMat.emissive = new THREE.Color(SELECT_COLOR);
      useFrontMat.emissiveIntensity = 0.35;
    }
    var mesh = new THREE.Mesh(boxGeo, [carcassMat, carcassMat, carcassMat, carcassMat, useFrontMat, carcassMat]);
    mesh.position.set(cx, bodyBase + bodyH / 2, cz);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    var quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    mesh.quaternion.copy(quat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (meta) mesh.userData = meta;
    if (meta){ meta.selected = !!selected; meta.baseFront = frontMat; }
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
      new THREE.LineBasicMaterial({ color: selected ? SELECT_COLOR : 0x2a2a2a, transparent:true, opacity: selected ? 1 : 0.4 })
    );
    edges.position.copy(mesh.position);
    edges.quaternion.copy(mesh.quaternion);
    group.add(edges);

    function local(alongM, y, outM){ // point on this cabinet: centre-line offset, height, distance out from the wall
      return new THREE.Vector3(
        geom.origin.x + geom.axis.x * (offsetM + widthM / 2 + alongM) + geom.normal.x * outM, y,
        geom.origin.z + geom.axis.z * (offsetM + widthM / 2 + alongM) + geom.normal.z * outM);
    }

    if (plinthM && meta && meta.plinthMat){
      var pl = new THREE.Mesh(new THREE.BoxGeometry(widthM - 0.004, plinthM, depthM - 0.06), meta.plinthMat);
      pl.position.copy(local(0, baseYM + plinthM / 2, (depthM - 0.06) / 2));
      pl.quaternion.copy(quat);
      pl.receiveShadow = true;
      group.add(pl);
    }
    if (meta && meta.counter && meta.stoneMat){
      var top = new THREE.Mesh(new THREE.BoxGeometry(widthM + 0.001, 0.032, depthM + 0.02), meta.stoneMat);
      top.position.copy(local(0, baseYM + heightM + 0.016, (depthM + 0.02) / 2));
      top.quaternion.copy(quat);
      top.castShadow = true; top.receiveShadow = true;
      group.add(top);
      if (meta.sink) addSink(THREE, group, local, quat, widthM, depthM, baseYM + heightM + 0.032);
    }

    if (interior && interior.mode === "skuffur"){
      addDrawerSeams(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior.count);
    }
    if (meta && meta.zone !== "opening") addFrontDetails(THREE, group, geom, offsetM, widthM, bodyH, bodyBase, depthM, interior, meta.handle, !!meta.tall, meta.zone === "wall", meta.split || 0.55, meta);
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
    if (scene.environment) scene.environment.dispose();
    scene.traverse(function(obj){
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material){
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(function(mat){
          if (mat.map) mat.map.dispose();
          if (mat.bumpMap) mat.bumpMap.dispose();
          mat.dispose();
        });
      }
    });
  }

  var THREE_STATE = null;

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

  function nearestWallDrop(geoms, walls, worldX, worldZ){
    var best = null, bestDist = Infinity, bestAlongM = 0;
    geoms.forEach(function(g, i){
      var x1 = g.origin.x, z1 = g.origin.z;
      var dx = g.axis.x * g.lenM, dz = g.axis.z * g.lenM;
      var lenSq = dx * dx + dz * dz;
      var t = lenSq > 0 ? ((worldX - x1) * dx + (worldZ - z1) * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      var d = Math.hypot(worldX - (x1 + t * dx), worldZ - (z1 + t * dz));
      if (d < bestDist){ bestDist = d; best = i; bestAlongM = t * g.lenM; }
    });
    return best === null ? null : { wallId:walls[best].id, alongMm:Math.round(bestAlongM * 1000) };
  }

  function setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, geoms, walls, opts){
    var raycaster = new THREE.Raycaster();
    var floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var drag = null; // {meta, mesh, group, startMatrix, startX, startY, moved}
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
    function dropAt(evt){
      raycaster.setFromCamera(ndc(evt), camera);
      var pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(floorPlane, pt)) return null;
      return nearestWallDrop(geoms, walls, pt.x, pt.z);
    }

    function onDown(evt){
      if (evt.button !== undefined && evt.button !== 0) return;
      if (!opts.onSelect && !opts.onCabinetDragEnd) return; // read-only view (review page): leave every press to OrbitControls
      var mesh = pickMeshAt(evt);
      if (!mesh) return;
      evt.stopPropagation();
      drag = { meta:mesh.userData, mesh:mesh, group:mesh.parent, startX:evt.clientX, startY:evt.clientY, moved:false };
      controls.enabled = false;
    }
    var hovered = null;
    function setHover(mesh){
      if (mesh === hovered) return;
      if (hovered){ var e0 = hovered.parent && hovered.parent.children[1]; if (e0 && e0.material && !hovered.userData.selected) e0.material.color.set(0x2a2a2a); }
      hovered = mesh;
      if (hovered){ var e1 = hovered.parent && hovered.parent.children[1]; if (e1 && e1.material && e1.material.color) e1.material.color.set(SELECT_COLOR); }
      renderer.domElement.style.cursor = hovered ? "grab" : "";
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
      var drop = dropAt(evt);
      followCursor(drop);
      if (opts.onCabinetDragMove) opts.onCabinetDragMove(drag.meta, drop);
    }
    // The real cabinet slides along the wall under the cursor (free, not
    // snapped — the blue/red footprint shows where it will actually land),
    // and turns with the wall if the cursor moves to another one. Setting the
    // group matrix G = target * startInverse moves body, outline and seams as
    // one without touching their own transforms.
    function followCursor(drop){
      if (THREE_STATE) THREE_STATE.dragging = true;
      if (!drop) return;
      var wi = walls.findIndex(function(w){ return w.id === drop.wallId; });
      var g = geoms[wi];
      if (!g) return;
      var widthM = drag.meta.widthMm / 1000, depthM = drag.meta.depthMm / 1000;
      var offsetM = Math.max(0, Math.min(g.lenM - widthM, drop.alongMm / 1000 - widthM / 2));
      var mesh = drag.mesh;
      var target = new THREE.Vector3(
        g.origin.x + g.axis.x * (offsetM + widthM / 2) + g.normal.x * (depthM / 2),
        mesh.position.y,
        g.origin.z + g.axis.z * (offsetM + widthM / 2) + g.normal.z * (depthM / 2));
      var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      var m0 = new THREE.Matrix4().compose(mesh.position, mesh.quaternion, new THREE.Vector3(1, 1, 1));
      var m1 = new THREE.Matrix4().compose(target, q, new THREE.Vector3(1, 1, 1));
      drag.group.matrixAutoUpdate = false;
      drag.group.matrix.copy(m1).multiply(m0.invert());
      drag.group.matrixWorldNeedsUpdate = true;
    }
    function onUp(evt){
      if (!drag) return;
      var meta = drag.meta, moved = drag.moved;
      if (moved){ drag.group.matrix.identity(); drag.group.matrixWorldNeedsUpdate = true; }
      if (THREE_STATE) THREE_STATE.dragging = false;
      drag = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = "";
      if (moved){
        suppressClick = true;
        if (opts.onCabinetDragEnd) opts.onCabinetDragEnd(meta, dropAt(evt));
      } else if (opts.onSelect){
        opts.onSelect(meta);
      }
    }
    function onClickEmpty(evt){
      if (suppressClick){ suppressClick = false; return; }
      if (pickMeshAt(evt)) return; // a tap on a cabinet was already handled in onUp
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
  function updateDragPreview3D(wallId, offsetMm, widthMm, depthMm, ok){
    if (!THREE_STATE) return;
    var THREE = window.__THREE__;
    var wi = THREE_STATE.walls.findIndex(function(w){ return w.id === wallId; });
    var g = THREE_STATE.geoms[wi];
    if (!g){ hideDragPreview3D(); return; }
    var p = rectCornersWorld(g, offsetMm, widthMm, depthMm), y = 0.012;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      p[0].x, y, p[0].z,  p[1].x, y, p[1].z,  p[2].x, y, p[2].z,
      p[0].x, y, p[0].z,  p[2].x, y, p[2].z,  p[3].x, y, p[3].z
    ]), 3));
    if (!THREE_STATE.previewMesh){
      THREE_STATE.previewMesh = new THREE.Mesh(new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({ color:0x3d61c1, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false }));
      THREE_STATE.scene.add(THREE_STATE.previewMesh);
    }
    var mesh = THREE_STATE.previewMesh;
    mesh.geometry.dispose();
    mesh.geometry = geo;
    mesh.material.color.set(ok ? 0x3d61c1 : 0xb3432f);
    mesh.visible = true;
  }

  // Screen point → {wallId, alongMm} for the live 3D scene (used when a
  // catalog item is dragged in from the side panel); null when the point is
  // outside the canvas or misses the floor.
  function dropPointFromClient(clientX, clientY){
    if (!THREE_STATE) return null;
    var rect = THREE_STATE.renderer.domElement.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    var THREE = window.__THREE__;
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), THREE_STATE.camera);
    var pt = new THREE.Vector3();
    if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return null;
    return nearestWallDrop(THREE_STATE.geoms, THREE_STATE.walls, pt.x, pt.z);
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
      if (Array.isArray(m.material)){ // cabinet
        if (want){
          var c = u.baseFront.clone();
          c.emissive = new THREE.Color(SELECT_COLOR); c.emissiveIntensity = 0.35;
          m.material[4] = c;
        } else {
          if (m.material[4] !== u.baseFront) m.material[4].dispose();
          m.material[4] = u.baseFront;
        }
        var e = m.parent && m.parent.children[1];
        if (e && e.material && e.material.color) e.material.color.set(want ? SELECT_COLOR : 0x2a2a2a);
      } else { // window / door plane
        m.material.emissive = new THREE.Color(want ? SELECT_COLOR : 0x000000);
        m.material.emissiveIntensity = want ? 0.55 : 0;
      }
    });
    THREE_STATE.opts.selectedId = id;
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
    if (THREE_STATE && THREE_STATE.previewMesh) THREE_STATE.previewMesh.visible = false;
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
    THREE_STATE.renderer.dispose();
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
  function canvasTex(THREE, canvas, srgb){
    var x = new THREE.CanvasTexture(canvas);
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    if (srgb && THREE.SRGBColorSpace) x.colorSpace = THREE.SRGBColorSpace;
    return x;
  }

  function makeFrontMaterial(THREE, lookKey, look){
    var wood = look.category !== "perfectsense";
    var t = wood ? window.KPMat.woodTexture(lookKey, look.color3d) : window.KPMat.paintTexture(lookKey, look.color3d);
    function tex(canvas, srgb){ return canvasTex(THREE, canvas, srgb); }
    var mat = wood
      ? new THREE.MeshStandardMaterial({ map:tex(t.color, true), bumpMap:tex(t.bump, false), bumpScale:1.4, roughness:0.6 })
      : new THREE.MeshPhysicalMaterial({ map:tex(t.color, true), bumpMap:tex(t.bump, false), bumpScale:0.5, roughness:0.5, clearcoat:0.14, clearcoatRoughness:0.45 });
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

    var geoms = wallGeometry3D(state.walls);
    var carcass = state.carcass ? CARCASS[state.carcass] : null;
    var carcassMat = new THREE.MeshStandardMaterial({ color: carcass ? carcass.color3d : "#3a3a3a", roughness:0.9 });
    var wallColor = state.wallColor && WALL_COLORS[state.wallColor] ? WALL_COLORS[state.wallColor].hex : "#f1efe8";
    var wallMat = new THREE.MeshStandardMaterial({ color:wallColor, roughness:1, side:THREE.DoubleSide });
    var floorMat;
    if (window.KPMat){
      var ft = window.KPMat.plankFloorTexture("#c9a97c");
      floorMat = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, ft.color, true), bumpMap:canvasTex(THREE, ft.bump, false), bumpScale:0.7, roughness:0.58 });
      floorMat.userData.tile = ft.tileW;
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);

    var bbox = addFloor(THREE, scene, geoms, floorMat);
    // Phase 7c: customer-set room height (was a fixed 2.6m for every
    // project). Also caps how tall any cabinet can render — a Hárskápur
    // sized for a 2.6m ceiling shouldn't poke through a lower one.
    var roomHeightMm = state.roomHeightMm || 2600;
    var WALL_H = roomHeightMm / 1000;
    // Walls between the camera and the room fade out (HomeByMe-style) so an
    // orbit to the "outside" never hides the cabinets behind a solid wall.
    // Wall length labels floating just above each wall (HomeByMe shows room
    // dimensions on the plan); a canvas-texture sprite, drawn on top.
    geoms.forEach(function(g, i){
      var cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
      var cx = cv.getContext("2d");
      cx.fillStyle = "rgba(255,255,255,.92)"; cx.strokeStyle = "#e6e3da"; cx.lineWidth = 3;
      cx.beginPath(); cx.roundRect ? cx.roundRect(4, 4, 248, 56, 14) : cx.rect(4, 4, 248, 56); cx.fill(); cx.stroke();
      cx.fillStyle = "#191919"; cx.font = "600 30px 'Kumbh Sans', Arial, sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(Math.round(g.lenM * 1000) + " mm", 128, 34);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false, transparent:true }));
      sp.scale.set(0.62, 0.155, 1);
      sp.position.set(g.origin.x + g.axis.x * g.lenM / 2, WALL_H + 0.16, g.origin.z + g.axis.z * g.lenM / 2);
      sp.renderOrder = 10;
      scene.add(sp);
    });

    // White skirting boards along every wall (visible wherever no cabinet stands)
    var skirtMat = new THREE.MeshStandardMaterial({ color:0xf3f1ec, roughness:0.55 });
    geoms.forEach(function(g){
      var sk = new THREE.Mesh(new THREE.BoxGeometry(g.lenM, 0.09, 0.014), skirtMat);
      sk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.axis.x, 0, g.axis.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.normal.x, 0, g.normal.z)));
      sk.position.set(g.origin.x + g.axis.x * g.lenM / 2 + g.normal.x * 0.007, 0.045, g.origin.z + g.axis.z * g.lenM / 2 + g.normal.z * 0.007);
      sk.receiveShadow = true;
      scene.add(sk);
    });

    var wallFades = geoms.map(function(g){
      var mat = wallMat.clone();
      mat.transparent = true;
      return { mesh:addWallPlane(THREE, scene, g, WALL_H, mat), geom:g, mat:mat };
    });

    function geomForWall(wallId){
      var wi = state.walls.findIndex(function(w){ return w.id === wallId; });
      return wi === -1 ? null : geoms[wi];
    }
    var pickables = [];
    (state.windows || []).forEach(function(win){
      var g = geomForWall(win.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, win.offsetMm / 1000, win.widthMm / 1000, win.heightMm / 1000,
        win.sillHeightMm / 1000, WINDOW_MARKER_COLOR, 0.55,
        { wallId:win.wallId, zone:"opening", kind:"window", blockId:win.id, widthMm:win.widthMm, depthMm:10 }, opts.selectedId === win.id, pickables);
    });
    (state.doors || []).forEach(function(door){
      var g = geomForWall(door.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, door.offsetMm / 1000, door.widthMm / 1000, door.heightMm / 1000,
        0, DOOR_MARKER_COLOR, 0.85,
        { wallId:door.wallId, zone:"opening", kind:"door", blockId:door.id, widthMm:door.widthMm, depthMm:10 }, opts.selectedId === door.id, pickables);
    });

    // built-in fridge reads as an appliance: brushed-steel front instead of the kitchen's fronts
    var steelMat = new THREE.MeshStandardMaterial({ color:0xc9ccd1, metalness:0.75, roughness:0.32 });
    // shared by every floor unit: recessed plinth + honed-stone worktop
    var plinthMat = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:0.85 });
    var stoneMat = window.KPMat
      ? (function(){ var st = window.KPMat.stoneTexture("#e4dfd6"); var m = new THREE.MeshStandardMaterial({ map:canvasTex(THREE, st.color, true), roughness:0.32, metalness:0.02 }); m.map.repeat.set(1 / st.tileW, 1 / st.tileH); return m; })()
      : new THREE.MeshStandardMaterial({ color:0xe4dfd6, roughness:0.4 });
    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = look && window.KPMat
      ? makeFrontMaterial(THREE, state.look, look)
      : new THREE.MeshStandardMaterial({ color: look ? look.color3d : 0xb7b2a4, roughness:0.7 });

    state.walls.forEach(function(wall, wi){
      var g = geoms[wi];
      if (!g) return;
      var offset = cornerClearanceMm(state.walls, wi, "floor");
      wall.floor.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, carcassMat, c.fridge ? steelMat : frontMat, b.interior,
          { wallId:wall.id, zone:"floor", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d), handle:state.handle, tall:c.cls === "tall" || !!c.fridge, split:c.fridge ? 0.74 : 0.55,
            plinth:true, counter:!!c.counter, sink:!!c.sink, oven:!!c.oven, plinthMat:plinthMat, stoneMat:stoneMat }, selected, pickables);
        offset += b.widthMm;
      });
      offset = 0;
      wall.wall.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, WALL_CABINET_BASE_M, carcassMat, frontMat, null,
          { wallId:wall.id, zone:"wall", blockId:b.id, widthMm:b.widthMm, depthMm:(b.depthMm || c.d), handle:state.handle }, selected, pickables);
        offset += b.widthMm;
      });
    });

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
    var dist = Math.max(bbox.w, bbox.d) * 0.74 + 1.2;
    camera.position.set(bbox.cx + dist * 0.6, dist * 0.55, bbox.cz + dist * 0.9);

    var renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    wrap.appendChild(renderer.domElement);

    // Subtle image-based lighting so steel, handles and the satin finish pick up
    // believable reflections; plus sharper textures at glancing angles.
    if (window.__RoomEnvironment__){
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new window.__RoomEnvironment__(renderer), 0.04).texture;
      pmrem.dispose();
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

    var cleanupInteraction = setupCabinetInteraction(THREE, wrap, renderer, camera, controls, pickables, geoms, state.walls, opts);
    THREE_STATE = { renderer:renderer, camera:camera, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupInteraction:cleanupInteraction,
                    walls:state.walls, geoms:geoms, previewMesh:null, dragging:false, opts:opts, pickables:pickables };

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
      if (!mesh){ el.hidden = true; return; }
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

    function loop(){
      THREE_STATE.rafId = requestAnimationFrame(loop);
      controls.update();
      settleLanded();
      fadeWalls();
      renderer.render(scene, camera);
      placeFloatBar();
    }
    loop();
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
    var geoms = wallGeometry3D(state.walls);
    if (!geoms.length) return null;
    var b = interiorBounds(geoms);
    var margin = 0.4;
    return { minX: b.minX - margin, minZ: b.minZ - margin, pxPerM: PX_PER_M, geoms: geoms };
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
    var geoms = wallGeometry3D(state.walls);
    if (!geoms.length){ container.innerHTML = ""; return; }

    var b = interiorBounds(geoms);
    var margin = 0.4;
    var minX = b.minX - margin, maxX = b.maxX + margin;
    var minZ = b.minZ - margin, maxZ = b.maxZ + margin;
    var svgW = (maxX - minX) * PX_PER_M, svgH = (maxZ - minZ) * PX_PER_M;

    function X(x){ return (x - minX) * PX_PER_M; }
    function Y(z){ return (z - minZ) * PX_PER_M; }

    var look = state.look ? LOOKS[state.look] : null;
    var fillColor = look ? look.color3d : "#b7b2a4";

    var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg" ' +
      'style="width:100%;height:100%;display:block;background:#faf9f6;font-family:\'Kumbh Sans\',Arial,sans-serif;">';

    geoms.forEach(function(g, gi){
      var x1 = X(g.origin.x), y1 = Y(g.origin.z);
      var end = { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM };
      var x2 = X(end.x), y2 = Y(end.z);
      var wallId = state.walls[gi] ? state.walls[gi].id : "";
      svg += '<line data-wall-line-id="' + wallId + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#191919" stroke-width="6" stroke-linecap="square"/>';
      var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      var lx = midX - g.normal.x * 14, ly = midY - g.normal.z * 14;
      svg += '<text x="' + lx + '" y="' + ly + '" font-size="11" fill="#6f6d66" text-anchor="middle">' + Math.round(g.lenM * 1000) + ' mm</text>';
    });

    // Window/door markers: a thick colored segment over the wall line at
    // the opening's own span — simpler than drawing a true gap, and this
    // plan already isn't a precision architectural drawing.
    function openingSegment(o, dataAttr, color){
      var g = geoms[state.walls.findIndex(function(w){ return w.id === o.wallId; })];
      if (!g) return;
      var offsetM = o.offsetMm / 1000, widthM = o.widthMm / 1000;
      var x1 = g.origin.x + g.axis.x * offsetM, z1 = g.origin.z + g.axis.z * offsetM;
      var x2 = g.origin.x + g.axis.x * (offsetM + widthM), z2 = g.origin.z + g.axis.z * (offsetM + widthM);
      var sel = opts.selectedId === o.id;
      svg += '<line ' + dataAttr + '="' + o.id + '" x1="' + X(x1) + '" y1="' + Y(z1) + '" x2="' + X(x2) + '" y2="' + Y(z2) +
        '" stroke="' + (sel ? "#3d61c1" : color) + '" stroke-width="' + (sel ? 10 : 7) + '" stroke-linecap="butt" style="cursor:pointer;"/>';
    }
    (state.windows || []).forEach(function(w){ openingSegment(w, 'data-window-id', "#5b8fae"); });
    (state.doors || []).forEach(function(d){ openingSegment(d, 'data-door-id', "#8a6a4a"); });

    function drawCabinetRect(bl, c, g, wallId, zone, offsetMm, isWallRow){
      var widthM = bl.widthMm / 1000;
      var corners = rectCornersWorld(g, offsetMm, bl.widthMm, bl.depthMm || c.d);
      var poly = corners.map(function(p){ return X(p.x) + "," + Y(p.z); }).join(" ");
      var dash = isWallRow ? ' stroke-dasharray="4,3"' : '';
      var selected = opts.selectedId === bl.id;
      var stroke = selected ? "#3d61c1" : "#2a2a2a";
      var strokeW = selected ? 3 : 1.5;
      svg += '<polygon data-wall-id="' + wallId + '" data-zone="' + zone + '" data-block-id="' + bl.id + '" ' +
        'points="' + poly + '" fill="' + fillColor + '" fill-opacity="' + (isWallRow ? 0.55 : 0.9) + '" ' +
        'stroke="' + stroke + '" stroke-width="' + strokeW + '"' + dash + ' style="cursor:pointer;"/>';
      if (widthM * PX_PER_M > 30){
        var cx = (X(corners[0].x) + X(corners[2].x)) / 2;
        var cy = (Y(corners[0].z) + Y(corners[2].z)) / 2;
        var label = bl.widthMm + (bl.interior && bl.interior.mode === "skuffur" ? " · " + bl.interior.count + "sk" : "");
        svg += '<text x="' + cx + '" y="' + cy + '" font-size="9" fill="#191919" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none;">' + label + '</text>';
      }
    }

    state.walls.forEach(function(wall, wi){
      var g = geoms[wi];
      if (!g) return;
      var offset = cornerClearanceMm(state.walls, wi, "floor");
      wall.floor.forEach(function(bl){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "floor", offset, false); offset += bl.widthMm; });
      offset = 0;
      wall.wall.forEach(function(bl){ drawCabinetRect(bl, CATALOG[bl.type], g, wall.id, "wall", offset, true); offset += bl.widthMm; });
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
    CARCASS: CARCASS,
    DRAWER_SYSTEMS: DRAWER_SYSTEMS,
    HANDLES: HANDLES,
    wallGeometry3D: wallGeometry3D,
    cornerClearanceMm: cornerClearanceMm,
    planTransform: planTransform,
    rectCornersWorld: rectCornersWorld,
    WALL_COLORS: WALL_COLORS,
    WINDOW_DEFAULT: WINDOW_DEFAULT,
    DOOR_DEFAULT: DOOR_DEFAULT,
    hasWebGL: hasWebGL,
    waitForThree: waitForThree,
    buildScene: buildScene,
    buildPlan2D: buildPlan2D,
    updateDragPreview3D: updateDragPreview3D,
    dropPointFromClient: dropPointFromClient,
    setSelected3D: setSelected3D,
    snapshot3D: snapshot3D,
    shelvesOf: shelvesOf,
    hideDragPreview3D: hideDragPreview3D,
    teardown3D: teardown3D
  };
})();
