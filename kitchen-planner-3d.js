// kitchen-planner-3d.js — shared 3D + 2D rendering for the kitchen planner.
// Loaded by both kitchen-planner.html (customer) and kitchen-planner-review.html
// (Rakel's review page) so the two never drift apart. Exposes everything via
// window.KP3D. Depends on window.__THREE__ / window.__OrbitControls__ being
// set by the importmap module script each host page includes in its <head>.
(function(){
  "use strict";

  var CATALOG = {
    grunnskapur: { label:"Grunnskápur", zone:"floor", cls:"floor", defaultW:600, minW:300, maxW:1200, h:800,  d:600, minH:600,  maxH:900,  minD:400, maxD:650, hasInterior:true, drawerCountRange:[1,5] },
    harskapur:   { label:"Hárskápur",   zone:"floor", cls:"tall",  defaultW:600, minW:300, maxW:900,  h:2400, d:600, minH:2000, maxH:2600, minD:400, maxD:650, hasInterior:true, drawerCountRange:[1,5] },
    efriskapur:  { label:"Efriskápur",  zone:"wall",  cls:"wall",  defaultW:600, minW:300, maxW:1200, h:600,  d:600, minH:400,  maxH:900,  minD:300, maxD:650, hasInterior:false },
    // Real Skápategund choice, with real oven-cavity fields already in
    // Eyðublað (Hæð ofns / Hæð undir ofni) — a fixed 600mm-wide tower is
    // the common real config, so width isn't customer-adjustable here.
    ofnaskapur:  { label:"Ofnaskápur",  zone:"floor", cls:"oven",  defaultW:600, minW:600, maxW:600,  h:2100, d:600, minH:1800, maxH:2200, minD:600, maxD:600, hasInterior:false, ovenHeightMm:595 },
    // Not its own Skápategund in the real schema — physically a Grunnskápur
    // corner unit fitted with a real Le Mans mechanism (Vörulisti product).
    // Fixed 900×900×800 (the real hardware's actual footprint/height).
    tofrahorn:   { label:"Töfrahorn (kapphorn)", zone:"floor", cls:"corner", defaultW:900, minW:900, maxW:900, h:800, d:900, minH:800, maxH:800, minD:900, maxD:900, hasInterior:false,
                   skapategundOverride:"Grunnskápur", tofrahornId:"rec9PD5fCZGUpwAon" }
  };

  // Fixed tie-break priority when two looks score equal in the quiz.
  var LOOK_ORDER = ["hvitt", "gratt", "eik", "valhnota"];
  // `color3d` is the material's real average color (sampled directly from its
  // own photo, not guessed) — used as a flat color on 3D/2D cabinet faces. The
  // photos themselves are angled product shots with visible background, which
  // looks broken mapped 1:1 onto a flat box face (a photo of a tilted board
  // pasted onto another 3D box reads as a floating, wrongly-shaped patch) —
  // they stay as the actual images only on the 2D look-picker cards.
  var LOOKS = {
    hvitt:    { label:"Hvítt",    img:"materials/hvitt.png",    color3d:"#fffef9", desc:"Klassískt og bjart",   efnislistiId:"recETAWxGH3R4yYQK" },
    gratt:    { label:"Grátt",    img:"materials/gratt.png",    color3d:"#e3dcd0", desc:"Nútímalegt og hlutlaust", efnislistiId:"recv9klBmrhz3BJJf" },
    eik:      { label:"Eik",      img:"materials/eik.png",      color3d:"#ccae8b", desc:"Náttúrulegt og ljóst", efnislistiId:"recr7o33yRRU4DqO7" },
    valhnota: { label:"Valhnota", img:"materials/valhnota.png", color3d:"#765e48", desc:"Hlýtt og dökkt",       efnislistiId:"recOwpVNZipD18qME" }
  };

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
    hexxa:  { label:"Hexxa Ál grip", img:"handles/hexxa.jpg", desc:"Grannt álprófíl-grip", vorulistiId:"rec9YdI6ECx0pxkPA" }
  };

  // Hardcoded per-shape wall layout: each wall's start point, its own axis
  // (direction cabinets run along) and normal (direction cabinets project
  // into the room), in meters. Straight/L/U are fixed presets, so this
  // doesn't need to be a generic corner-solver.
  function wallGeometry3D(shape, walls){
    function m(mm){ return mm / 1000; }
    // Every wall here must form a RIGHT-HANDED basis with world-up, i.e.
    // cross(axis, (0,1,0)) must equal normal — makeBasis() below doesn't
    // validate this, it'll happily build a mirrored (determinant -1) matrix
    // that Quaternion.setFromRotationMatrix then silently mangles into a
    // degenerate non-unit quaternion (garbled wall/cabinet orientation,
    // "material facing the wrong way"). Where a wall's natural fill
    // direction would violate this, the wall is parameterized from its
    // *other* end instead (axis flipped, origin moved to the far corner) —
    // same physical wall segment, opposite offset(0) end, always verified
    // right-handed. See the session notes for how this was diagnosed.
    if (shape === "straight"){
      return [ { origin:{x:0,z:0}, axis:{x:1,z:0}, normal:{x:0,z:1}, lenM:m(walls[0].lengthMm) } ];
    }
    if (shape === "L"){
      var lB = m(walls[1].lengthMm);
      return [
        { origin:{x:0,z:0}, axis:{x:1,z:0}, normal:{x:0,z:1}, lenM:m(walls[0].lengthMm) },
        { origin:{x:0,z:lB}, axis:{x:0,z:-1}, normal:{x:1,z:0}, lenM:lB }
      ];
    }
    if (shape === "U"){
      var LA = m(walls[0].lengthMm), LB = m(walls[1].lengthMm), LC = m(walls[2].lengthMm);
      var aEnd = { x:0, z:LA };
      var bEnd = { x:LB, z:LA };
      return [
        { origin:aEnd, axis:{x:0,z:-1}, normal:{x:1,z:0},  lenM:LA },
        { origin:bEnd, axis:{x:-1,z:0}, normal:{x:0,z:-1}, lenM:LB },
        { origin:bEnd, axis:{x:0,z:1},  normal:{x:-1,z:0}, lenM:LC }
      ];
    }
    return [];
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

  // Click-to-select: a plain 'click' listener (not pointerdown/up distance
  // tracking) — browsers already suppress a synthetic click when the pointer
  // moved significantly between down and up, which is exactly the same
  // "was this an orbit-drag or a tap" distinction picking needs, so this
  // coexists with OrbitControls without extra bookkeeping.
  function setupPicking(THREE, renderer, camera, pickables, onSelect){
    var raycaster = new THREE.Raycaster();
    function onClick(evt){
      var rect = renderer.domElement.getBoundingClientRect();
      var ndc = {
        x: ((evt.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((evt.clientY - rect.top) / rect.height) * 2 + 1
      };
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(pickables, false);
      onSelect(hits.length ? hits[0].object.userData : null);
    }
    renderer.domElement.addEventListener("click", onClick);
    return function cleanup(){ renderer.domElement.removeEventListener("click", onClick); };
  }

  function teardown3D(){
    if (!THREE_STATE) return;
    cancelAnimationFrame(THREE_STATE.rafId);
    window.removeEventListener("resize", THREE_STATE.onResize);
    if (THREE_STATE.cleanupPicking) THREE_STATE.cleanupPicking();
    THREE_STATE.controls.dispose();
    disposeScene(THREE_STATE.scene);
    THREE_STATE.renderer.dispose();
    if (THREE_STATE.renderer.domElement.parentNode){
      THREE_STATE.renderer.domElement.parentNode.removeChild(THREE_STATE.renderer.domElement);
    }
    THREE_STATE = null;
  }

  // wrap: DOM element to render into. state: the planner's {shape,walls,look}
  // object. opts (optional): {selectedId, onSelect(meta|null)} — onSelect is
  // called with {wallId,zone,blockId} when a cabinet is clicked, or null on
  // a click that hit nothing (deselect).
  function buildScene(wrap, state, opts){
    opts = opts || {};
    var THREE = window.__THREE__;
    var OrbitControls = window.__OrbitControls__;

    var geoms = wallGeometry3D(state.shape, state.walls);
    var carcassMat = new THREE.MeshStandardMaterial({ color:0x3a3a3a, roughness:0.9 });
    var wallMat = new THREE.MeshStandardMaterial({ color:0xf1efe8, roughness:1, side:THREE.DoubleSide });
    var floorMat = new THREE.MeshStandardMaterial({ color:0xd8d3c6, roughness:1 });

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f6f2);

    var bbox = addFloor(THREE, scene, geoms, floorMat);
    var WALL_H = 2.6;
    geoms.forEach(function(g){ addWallPlane(THREE, scene, g, WALL_H, wallMat); });

    var look = state.look ? LOOKS[state.look] : null;
    var frontMat = new THREE.MeshStandardMaterial({
      color: look ? look.color3d : 0xb7b2a4, roughness:0.75
    });

    var pickables = [];
    state.walls.forEach(function(wall, wi){
      var g = geoms[wi];
      if (!g) return;
      var offset = 0;
      wall.floor.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = (b.heightMm || c.h) / 1000, dM = (b.depthMm || c.d) / 1000;
        var selected = opts.selectedId === b.id;
        addCabinetBox(THREE, scene, g, offset / 1000, b.widthMm / 1000, hM, dM, 0, carcassMat, frontMat, b.interior,
          { wallId:wall.id, zone:"floor", blockId:b.id }, selected, pickables);
        offset += b.widthMm;
      });
      offset = 0;
      wall.wall.forEach(function(b){
        var c = CATALOG[b.type];
        var hM = (b.heightMm || c.h) / 1000, dM = (b.depthMm || c.d) / 1000;
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
    controls.update();

    var cleanupPicking = opts.onSelect ? setupPicking(THREE, renderer, camera, pickables, opts.onSelect) : null;
    THREE_STATE = { renderer:renderer, controls:controls, scene:scene, rafId:0, onResize:resize, cleanupPicking:cleanupPicking };

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

  function buildPlan2D(container, state, opts){
    opts = opts || {};
    var geoms = wallGeometry3D(state.shape, state.walls);
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

    geoms.forEach(function(g){
      var x1 = X(g.origin.x), y1 = Y(g.origin.z);
      var end = { x:g.origin.x + g.axis.x * g.lenM, z:g.origin.z + g.axis.z * g.lenM };
      var x2 = X(end.x), y2 = Y(end.z);
      svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#191919" stroke-width="6" stroke-linecap="square"/>';
      var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      var lx = midX - g.normal.x * 14, ly = midY - g.normal.z * 14;
      svg += '<text x="' + lx + '" y="' + ly + '" font-size="11" fill="#6f6d66" text-anchor="middle">' + Math.round(g.lenM * 1000) + ' mm</text>';
    });

    function drawCabinetRect(bl, c, g, wallId, zone, offsetMm, isWallRow){
      var offsetM = offsetMm / 1000, widthM = bl.widthMm / 1000, depthM = (bl.depthMm || c.d) / 1000;
      var x0 = g.origin.x + g.axis.x * offsetM, z0 = g.origin.z + g.axis.z * offsetM;
      var corners = [0, widthM].map(function(along){
        return [0, depthM].map(function(out){
          return { x:x0 + g.axis.x * along + g.normal.x * out, z:z0 + g.axis.z * along + g.normal.z * out };
        });
      });
      var poly = [corners[0][0], corners[1][0], corners[1][1], corners[0][1]]
        .map(function(p){ return X(p.x) + "," + Y(p.z); }).join(" ");
      var dash = isWallRow ? ' stroke-dasharray="4,3"' : '';
      var selected = opts.selectedId === bl.id;
      var stroke = selected ? "#3d61c1" : "#2a2a2a";
      var strokeW = selected ? 3 : 1.5;
      svg += '<polygon data-wall-id="' + wallId + '" data-zone="' + zone + '" data-block-id="' + bl.id + '" ' +
        'points="' + poly + '" fill="' + fillColor + '" fill-opacity="' + (isWallRow ? 0.55 : 0.9) + '" ' +
        'stroke="' + stroke + '" stroke-width="' + strokeW + '"' + dash + ' style="cursor:pointer;"/>';
      if (widthM * PX_PER_M > 30){
        var cx = (X(corners[0][0].x) + X(corners[1][1].x)) / 2;
        var cy = (Y(corners[0][0].z) + Y(corners[1][1].z)) / 2;
        var label = bl.widthMm + (bl.interior && bl.interior.mode === "skuffur" ? " · " + bl.interior.count + "sk" : "");
        svg += '<text x="' + cx + '" y="' + cy + '" font-size="9" fill="#191919" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none;">' + label + '</text>';
      }
    }

    state.walls.forEach(function(wall, wi){
      var g = geoms[wi];
      if (!g) return;
      var offset = 0;
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
    HANDLES: HANDLES,
    wallGeometry3D: wallGeometry3D,
    hasWebGL: hasWebGL,
    waitForThree: waitForThree,
    buildScene: buildScene,
    buildPlan2D: buildPlan2D,
    teardown3D: teardown3D
  };
})();
