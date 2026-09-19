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
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:600, maxW:600, h:800,  d:600, minH:800,  maxH:800,  minD:600, maxD:600, hasInterior:true, drawerCountRange:[1,5] },
    harskapur:   { label:"Hárskápur",   zone:"floor", cls:"tall",  defaultW:600, minW:600, maxW:600, h:2400, d:600, minH:2400, maxH:2400, minD:600, maxD:600, hasInterior:true, drawerCountRange:[1,5] },
    efriskapur:  { label:"Efriskápur",  zone:"wall",  cls:"wall",  defaultW:600, minW:600, maxW:600, h:1000, d:300, minH:1000, maxH:1000, minD:300, maxD:300, hasInterior:false }
  };

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
  }

  // Window/door markers (Phase 7e) — a flat panel on the wall's inner face
  // rather than a true cut hole (no CSG boolean ops in vanilla Three.js;
  // matches this module's existing "simple textured boxes, not full
  // realism" approach used for cabinets/handles throughout). `baseYM` is
  // where the opening starts (sill height for a window, 0 for a door).
  var WINDOW_MARKER_COLOR = 0xa9c6d6, DOOR_MARKER_COLOR = 0x8a6a4a;
  function addOpeningMarker(THREE, scene, geom, offsetM, widthM, heightM, baseYM, color, opacity){
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(widthM, heightM),
      new THREE.MeshStandardMaterial({ color:color, roughness:0.5, transparent:true, opacity:opacity, side:THREE.DoubleSide })
    );
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
    scene.add(mesh);
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

  // `interior` is optional: { mode:"hillur"|"skuffur", count:number }.
  // `meta` (optional) is tagged onto the mesh as userData for click-picking —
  // {wallId, zone, blockId}. `selected` swaps the edge color and tints the
  // front face so a picked cabinet is unambiguous. `pickables` (optional
  // array) collects the mesh so the caller can raycast against exactly the
  // clickable set, not walls/floor/seams.
  function addCabinetBox(THREE, scene, geom, offsetM, widthM, heightM, depthM, baseYM, carcassMat, frontMat, interior, meta, selected, pickables){
    var cx = geom.origin.x + geom.axis.x * (offsetM + widthM / 2) + geom.normal.x * (depthM / 2);
    var cz = geom.origin.z + geom.axis.z * (offsetM + widthM / 2) + geom.normal.z * (depthM / 2);
    var boxGeo = new THREE.BoxGeometry(widthM, heightM, depthM);
    var useFrontMat = frontMat;
    if (selected){
      useFrontMat = frontMat.clone();
      useFrontMat.emissive = new THREE.Color(SELECT_COLOR);
      useFrontMat.emissiveIntensity = 0.35;
    }
    var mesh = new THREE.Mesh(boxGeo, [carcassMat, carcassMat, carcassMat, carcassMat, useFrontMat, carcassMat]);
    mesh.position.set(cx, baseYM + heightM / 2, cz);
    var xAxis = new THREE.Vector3(geom.axis.x, 0, geom.axis.z);
    var yAxis = new THREE.Vector3(0, 1, 0);
    var zAxis = new THREE.Vector3(geom.normal.x, 0, geom.normal.z);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (meta) mesh.userData = meta;
    scene.add(mesh);
    if (pickables) pickables.push(mesh);

    // A light front color (e.g. hvítt) can otherwise blend into the equally
    // light wall/floor with no shadow-based separation — a dark edge outline
    // keeps every cabinet readable regardless of which look is applied.
    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: selected ? SELECT_COLOR : 0x2a2a2a })
    );
    edges.position.copy(mesh.position);
    edges.quaternion.copy(mesh.quaternion);
    scene.add(edges);

    if (interior && interior.mode === "skuffur"){
      addDrawerSeams(THREE, scene, geom, offsetM, widthM, heightM, baseYM, depthM, interior.count);
    }
  }

  function disposeScene(scene){
    if (!scene) return;
    scene.traverse(function(obj){
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material){
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(function(mat){
          if (mat.map) mat.map.dispose();
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
    var drag = null; // {meta, startX, startY, moved}
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
      var mesh = pickMeshAt(evt);
      if (!mesh) return;
      evt.stopPropagation();
      drag = { meta:mesh.userData, startX:evt.clientX, startY:evt.clientY, moved:false };
      controls.enabled = false;
    }
    function onMove(evt){
      if (!drag) return;
      if (!drag.moved){
        if (Math.hypot(evt.clientX - drag.startX, evt.clientY - drag.startY) < CABINET_DRAG_PX) return;
        drag.moved = true;
      }
      if (opts.onCabinetDragMove) opts.onCabinetDragMove(drag.meta, dropAt(evt));
    }
    function onUp(evt){
      if (!drag) return;
      var meta = drag.meta, moved = drag.moved;
      drag = null;
      controls.enabled = true;
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

  // Procedural front-face texture (2026-09-17): a flat MeshStandardMaterial
  // color read as plasticky in the 3D view — cabinet fronts want *some*
  // surface variation, not a solid swatch. Draws a small tileable canvas per
  // look — vertical wood-grain streaks for veneer/melamine-wood looks
  // (grain running the height of a door, the common real orientation),
  // a faint fleck for painted "perfectsense" colors — both tinted from the
  // look's own color3d. Not a substitute for a real product photo (see the
  // LOOKS comment above on why photos don't map cleanly onto a flat box
  // face) — just enough texture that a front doesn't read as flat plastic.
  // Cached per look key as a plain <canvas> (not a Three.js Texture) — a
  // fresh CanvasTexture wraps it on every scene build so disposeScene's
  // teardown can freely dispose that Texture without needing to know its
  // pixel data is shared/reused.
  var LOOK_TEXTURE_CANVAS = {};

  function lookTextureCanvas(lookKey){
    if (LOOK_TEXTURE_CANVAS[lookKey]) return LOOK_TEXTURE_CANVAS[lookKey];
    var look = LOOKS[lookKey];
    var size = 256;
    var canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = look.color3d;
    ctx.fillRect(0, 0, size, size);

    if (look.category === "perfectsense"){
      // Painted solid color — a faint fleck, not dead-flat plastic.
      for (var i = 0; i < 2500; i++){
        var shade = Math.random() < 0.5 ? "0,0,0" : "255,255,255";
        ctx.fillStyle = "rgba(" + shade + "," + (Math.random() * 0.035).toFixed(3) + ")";
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
      }
    } else {
      // Wood-look (veneer / melamine-wood) — wavy vertical grain streaks,
      // same spirit as grain.html's procedural feTurbulence woodgrain, just
      // drawn with the 2D canvas API instead of an SVG filter.
      var streaks = 46;
      for (var s = 0; s < streaks; s++){
        var x = Math.random() * size;
        var dark = Math.random() < 0.6;
        ctx.strokeStyle = "rgba(" + (dark ? "0,0,0" : "255,250,235") + "," + (0.04 + Math.random() * 0.09).toFixed(3) + ")";
        ctx.lineWidth = 0.6 + Math.random() * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (var y = 8; y <= size; y += 8){
          x += (Math.random() - 0.5) * 7;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    LOOK_TEXTURE_CANVAS[lookKey] = canvas;
    return canvas;
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
    var floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);

    var bbox = addFloor(THREE, scene, geoms, floorMat);
    // Phase 7c: customer-set room height (was a fixed 2.6m for every
    // project). Also caps how tall any cabinet can render — a Hárskápur
    // sized for a 2.6m ceiling shouldn't poke through a lower one.
    var roomHeightMm = state.roomHeightMm || 2600;
    var WALL_H = roomHeightMm / 1000;
    geoms.forEach(function(g){ addWallPlane(THREE, scene, g, WALL_H, wallMat); });

    function geomForWall(wallId){
      var wi = state.walls.findIndex(function(w){ return w.id === wallId; });
      return wi === -1 ? null : geoms[wi];
    }
    (state.windows || []).forEach(function(win){
      var g = geomForWall(win.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, win.offsetMm / 1000, win.widthMm / 1000, win.heightMm / 1000,
        win.sillHeightMm / 1000, WINDOW_MARKER_COLOR, 0.55);
    });
    (state.doors || []).forEach(function(door){
      var g = geomForWall(door.wallId);
      if (!g) return;
      addOpeningMarker(THREE, scene, g, door.offsetMm / 1000, door.widthMm / 1000, door.heightMm / 1000,
        0, DOOR_MARKER_COLOR, 0.85);
    });

    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = new THREE.MeshStandardMaterial({
      color: look ? 0xffffff : 0xb7b2a4, roughness:0.75
    });
    if (look){
      var frontTex = new THREE.CanvasTexture(lookTextureCanvas(state.look));
      frontTex.wrapS = frontTex.wrapT = THREE.RepeatWrapping;
      var wood = look.category !== "perfectsense";
      frontTex.repeat.set(wood ? 2 : 1, wood ? 4 : 1);
      frontMat.map = frontTex;
    }

    var pickables = [];
    state.walls.forEach(function(wall, wi){
      var g = geoms[wi];
      if (!g) return;
      var offset = cornerClearanceMm(state.walls, wi, "floor");
      wall.floor.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, carcassMat, frontMat, b.interior,
          { wallId:wall.id, zone:"floor", blockId:b.id }, selected, pickables);
        offset += b.widthMm;
      });
      offset = 0;
      wall.wall.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = Math.min(b.heightMm || c.h, roomHeightMm) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, WALL_CABINET_BASE_M, carcassMat, frontMat, null,
          { wallId:wall.id, zone:"wall", blockId:b.id }, selected, pickables);
        offset += b.widthMm;
      });
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(bbox.cx + 3, 5, bbox.cz + 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);

    var camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    var dist = Math.max(bbox.w, bbox.d) * 0.9 + 1.5;
    camera.position.set(bbox.cx + dist * 0.6, dist * 0.55, bbox.cz + dist * 0.9);

    var renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    wrap.appendChild(renderer.domElement);

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
    THREE_STATE = { renderer:renderer, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupInteraction:cleanupInteraction,
                    walls:state.walls, geoms:geoms, previewMesh:null };

    function resize(){
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    function loop(){
      THREE_STATE.rafId = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
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
      svg += '<line ' + dataAttr + '="' + o.id + '" x1="' + X(x1) + '" y1="' + Y(z1) + '" x2="' + X(x2) + '" y2="' + Y(z2) +
        '" stroke="' + color + '" stroke-width="7" stroke-linecap="butt" style="cursor:pointer;"/>';
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
    hideDragPreview3D: hideDragPreview3D,
    teardown3D: teardown3D
  };
})();
