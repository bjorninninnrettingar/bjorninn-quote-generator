// BJÖRNINN STUDIO — Innihurðir (2026-10-26, user's design): one door = one HU row, designed in a popup like the
// cabinet "Ný eining" wizard — a live 3D door on the left, collapsible steps on the right
// (Gerð → Mál → Opnun → Útlit → Lamir → Felliþröskuldur → Skrá; the special kinds have their own short list).
//
// window.KPDOORS (also globalThis in node, tests/kp-doors.test.js):
//   data      KINDS, ROOMS, KIND_OPTS, LIMITS, sections(d), roomValue/roomLabel, lineFor(d, ctx) (→ one Line Item)
//   3D        preview.open(host, svg) / preview.set(d, look, view) / preview.close() / thumb(d, look) → dataURL
//   hardware  HW: one function per hardware item (hinges, threshold, lock, handle, track), each returns a THREE.Object3D
//             in the door's own frame. A real model replaces one by adding it to window.KPMODELS.doorHardware
//             (see kitchen-planner-models.js) — the procedural part is only the placeholder.
//
// Units: the door object stores mm (widthMm = the opening in the wall, B × H, wallMm = wall thickness); the 3D is metres.
// Frame of the 3D door: x along the wall, y up, z out of the wall towards the side the door opens to (the viewer).
(function(root){
  "use strict";

  // ---------------------------------------------------------------- data
  // main = the two big cards on Gerð; the rest sit under "Fleiri gerðir" (nothing that existed before is lost)
  var KINDS = [
    { key:"innf",      kind:"hurd",      frame:"innf",    label:"Innfelld hurð",      desc:"Slétt við vegginn, enginn listi í kringum", main:true },
    { key:"gerefti",   kind:"hurd",      frame:"gerefti", label:"Hurð með gereftum",  desc:"Listar í kringum opið hylja samskeytin",   main:true },
    { key:"gler",      kind:"gler",      label:"Glerhurð",        desc:"Hurð úr gleri" },
    { key:"renni",     kind:"renni",     label:"Rennihurð",       desc:"Rennur meðfram veggnum" },
    { key:"glerrenni", kind:"glerrenni", label:"Glerrennihurð",   desc:"Rennihurð úr gleri" },
    { key:"eld",       kind:"eld",       label:"Eldvarnarhurð",   desc:"Brunavarin, EI-30 eða EI-60" },
    { key:"karmur",    kind:"karmur",    label:"Karmur eingöngu", desc:"Aðeins karmurinn, engin hurð" }
  ];
  function kindKey(d){ return d.kind === "hurd" ? (d.frame === "gerefti" ? "gerefti" : "innf") : d.kind; }
  function kindDef(d){ var k = kindKey(d); return KINDS.find(function(x){ return x.key === k; }) || KINDS[0]; }
  function isSlide(d){ return d.kind === "renni" || d.kind === "glerrenni"; }
  function isGlass(d){ return d.kind === "gler" || d.kind === "glerrenni"; }
  function hasLeafMat(d){ return d.kind === "hurd" || d.kind === "renni" || d.kind === "eld"; }
  function hasHandle(d){ return d.kind === "hurd" || d.kind === "gler" || d.kind === "eld"; }

  // the choices each kind really has (the same values the product names carry — doorAttrs in kitchen-planner.html),
  // the usual one first. Static so the steps are the same whether the product list has loaded or not.
  var KIND_OPTS = {
    hurd:{ lamir:["innfelldar", "samloku"], throskuldur:["ja", "nei"], skra:["jnf", "segul"] },
    gler:{ lamir:["innfelldar", "samloku"], throskuldur:["ja", "nei"] },
    renni:{ braut:["loft", "vegg", "magic"] },
    glerrenni:{ braut:["loft", "vegg"] },
    eld:{ flokkur:["ei30", "ei60"] },
    karmur:{ karmur:["innf", "gerefti"] }
  };
  // plain words, a line under each — no trade names in the customer's steps
  var OPT_TEXT = {
    lamir:{ label:"Lamir", vals:{ innfelldar:["Innfelldar lamir", "Sjást ekki þegar hurðin er lokuð"], samloku:["Samlokulamir", "Hefðbundnar lamir á brúninni"] } },
    throskuldur:{ label:"Felliþröskuldur", vals:{ nei:["Enginn felliþröskuldur", "Lítið bil við gólfið"], ja:["Felliþröskuldur", "Lokar bilinu þegar hurðin lokast — bætir hljóðeinangrun og kemur í veg fyrir gegnumtrekk."] } },
    skra:{ label:"Skrá", vals:{ jnf:["Stöðluð skrá", "Smella og lás"], segul:["Segulskrá", "Segull í stað smellu — lokast hljóðlaust"] } },
    braut:{ label:"Brautin", vals:{ loft:["Braut í loftinu", "Fest upp í loft"], vegg:["Braut á veggnum", "Með hlíf yfir brautinni"], magic:["Falin braut", "Brautin sést ekki"] } },
    flokkur:{ label:"Brunavörn", vals:{ ei30:["30 mínútur", "Algengast innan íbúðar"], ei60:["60 mínútur", "T.d. milli íbúðar og stigagangs"] } },
    karmur:{ label:"Karmurinn", vals:{ innf:["Sléttur við vegginn", "Enginn listi í kringum"], gerefti:["Með listum í kringum", "Gerefti hylja samskeytin"] } }
  };
  var HW_COLORS = { krom:["Króm", "Gljáandi stál"], svart:["Svart", "Matt svart"] }; // lamir, skrá, slútt and húnn in one colour (round 4)
  // exact numbers only (user: people must be precise here) — cm in the inputs, mm inside
  var LIMITS = { widthMm:[500, 2500], heightMm:[1500, 3000], wallMm:[50, 400] };
  // PRO (mm): the ranges the old PRO door rows allowed (2026-10-23 overlay), so no stored door becomes invalid
  var LIMITS_PRO = { widthMm:[400, 3000], heightMm:[1500, 3200], wallMm:[50, 400] };

  // PRO's workshop extras (2026-10-26) — d.cnc, what /cnc's door export (cnc-doors.js doorPlan) needs and a customer
  // never sees: karmur thickness, karmabil, toppstykki, and the exact hardware product (Vörulisti id) per CNC macro.
  // The Eyðublað's own fields always win in /cnc; these only fill the ones left empty there.
  var CNC_DEFAULT = { karmZ:37, karmB:6, topp:"Ofan á hliðum" }; // what the shop's doors have (T-54 HU1–5)
  var TOPP = ["Ofan á hliðum", "Á milli hliða"];
  var CNC_LIMITS = { karmZ:[15, 80], karmB:[0, 40] };
  // the hardware names PRO shows on each step (the customer sees plain words: OPT_TEXT)
  var PRO_HW = {
    lamir:{ innfelldar:"JNF Coplan · faldar lamir (innfelldar)", samloku:"JNF IN.05.020.100 · sýnilegar (samlokulamir)" },
    skra:{ jnf:"JNF IN.20.835", segul:"JNF segulskrá IN.20.976.60.B" },
    throskuldur:{ ja:"Já — felliþröskuldur", nei:"Enginn felliþröskuldur" }
  };
  // a door row as the old PRO overlay stored it (no designed / frame / cnc) → today's shape. Only fills what is
  // missing — never changes a value, so the HU line (lineFor) is byte-for-byte the same before and after.
  function migrate(d){
    if (!d || typeof d !== "object") return d;
    if (d.designed === undefined) d.designed = true; // an old row was always a finished door
    if (d.kind === "hurd" && d.frame !== "innf" && d.frame !== "gerefti") d.frame = "innf";
    if (!d.opt || typeof d.opt !== "object") d.opt = {};
    return d;
  }
  // the hardware /cnc has a confirmed macro pair for, picked from the door's own choice when PRO leaves "Sjálfvirkt"
  // (Vörulisti ids = the keys of cnc-doors.js HINGES / THRESHOLDS — tests/kp-doors.test.js checks they still are).
  // No lock is ever automatic: "JNF IN.20.835" / the magnetic one aren't matched to a Vörulisti product yet.
  var CNC_AUTO = { hinge:{ lamir:{ innfelldar:"recoQeJKpvKLowWK3" } }, threshold:{ throskuldur:{ ja:"recRJ3d2MCFv4DDJi" } } };
  var REC = /^rec[A-Za-z0-9]{14}$/;
  // the CNC block a door sends (only once PRO has touched it — d.cnc), numbers clamped, unknown toppstykki dropped;
  // hinge/lock/threshold = a Vörulisti id, "none" (= nothing milled, left out) or empty (= CNC_AUTO from the choice)
  function cncOf(d){
    var c = d && d.cnc; if (!c || typeof c !== "object") return null;
    var o = {};
    ["karmZ", "karmB"].forEach(function(k){ var v = +c[k]; if (isFinite(v) && c[k] !== "" && c[k] != null) o[k] = Math.max(CNC_LIMITS[k][0], Math.min(CNC_LIMITS[k][1], Math.round(v * 10) / 10)); });
    if (TOPP.indexOf(c.topp) >= 0) o.topp = c.topp;
    ["hinge", "lock", "threshold"].forEach(function(k){
      if (c[k] === "none") return;
      if (REC.test(String(c[k] || ""))){ o[k] = c[k]; return; }
      var auto = CNC_AUTO[k]; if (!auto) return;
      Object.keys(auto).forEach(function(opt){ if (optsOf(d)[opt]){ var id = auto[opt][optValue(d, opt)]; if (id) o[k] = id; } });
    });
    return Object.keys(o).length ? o : null;
  }
  function cncText(c){
    if (!c) return "";
    var t = [];
    if (c.karmZ != null) t.push("þykkt karms " + c.karmZ + " mm");
    if (c.karmB != null) t.push("karmabil frá vegg " + c.karmB + " mm");
    if (c.topp) t.push("toppstykki " + c.topp.toLowerCase());
    return t.length ? " Karmur: " + t.join(", ") + "." : "";
  }

  // the order of the steps for a door of this kind
  function sections(d){
    var s = ["gerd", "mal"];
    if (d.kind !== "karmur") s.push("opnun");
    if (hasLeafMat(d)) s.push("efni");
    Object.keys(KIND_OPTS[d.kind] || {}).forEach(function(k){ if (k !== "skra") s.push(k); });
    if (hasHandle(d)) s.push("skra");
    return s;
  }
  function optsOf(d){ return KIND_OPTS[d.kind] || {}; }
  function optValue(d, k){ var o = optsOf(d)[k]; return (d.opt && d.opt[k] && o && o.indexOf(d.opt[k]) >= 0) ? d.opt[k] : o ? o[0] : undefined; }
  // set a kind: options start at the usual values (keeping the ones this kind also has)
  function setKind(d, key){
    var k = KINDS.find(function(x){ return x.key === key; }); if (!k) return;
    var old = d.opt || {};
    d.kind = k.kind; d.opt = {};
    if (k.frame) d.frame = k.frame; else delete d.frame;
    Object.keys(optsOf(d)).forEach(function(o){ d.opt[o] = optsOf(d)[o].indexOf(old[o]) >= 0 ? old[o] : optsOf(d)[o][0]; });
    if (d.kind === "karmur" && d.opt.karmur) d.frame = d.opt.karmur;
    if (!hasLeafMat(d)) delete d.leaf;
    delete d.hunar; // the "Viltu húna frá okkur?" question is gone (round 4)
  }

  // the short room list (user, 2026-10-26) → the Rými 🏡 choice it is stored as
  var ROOMS = [
    ["Hjónaherbergi", "Hjónah."], ["Barnaherbergi", "Barnah."], ["Svefnherbergi", "Svefnh."], ["Fataherbergi", "Fatask."],
    ["Baðherbergi", "Baðh."], ["Þvottahús", "Þvottah."], ["Gangur", "Gangur"], ["Anddyri", "Andyri"], ["Stofa", "Stofa"],
    ["Alrými", "Alrými"], ["Eldhús", "Eldhús"], ["Skrifstofa", "Skrifst."]
  ].map(function(r){ return { label:r[0], value:r[1] }; });
  var OTHER = "__annad";
  function roomLabelOf(d){ // the name the customer sees (Icelandic — the caller translates)
    if (d.room === OTHER) return (d.roomOther || "").trim() || "Annað";
    var r = ROOMS.find(function(x){ return x.value === d.room; });
    return r ? r.label : d.room || "";
  }
  function roomOk(d){ return !!d.room && (d.room !== OTHER || !!(d.roomOther || "").trim()); }

  // ---------------------------------------------------------------- the Line Item (Icelandic, data — never translated)
  function fmtMm(mm){ return Math.round(mm) + " mm"; }
  function choicesText(d){
    var out = [];
    if (d.kind === "hurd") out.push(d.frame === "gerefti" ? "Karmur með gereftum" : "Innfelld (karmur sléttur við vegginn, engin gerefti)");
    Object.keys(optsOf(d)).forEach(function(k){
      var t = OPT_TEXT[k], v = optValue(d, k);
      if (t && t.vals[v]) out.push(k === "throskuldur" ? t.vals[v][0] : t.label + ": " + t.vals[v][0].toLowerCase()); // "Felliþröskuldur" / "Enginn felliþröskuldur" say it themselves
    });
    if (hasHandle(d)) out.push("Litur á járnum (lamir, skrá, slútt): " + HW_COLORS[d.hwColor === "svart" ? "svart" : "krom"][0].toLowerCase());
    return out.join(". ");
  }
  // ctx = { pid: product record id, mat: { label, efnislistiId } | null }
  function lineFor(d, ctx){
    ctx = ctx || {};
    var slide = isSlide(d);
    var how = slide ? "rennihurð, rennur til " + (d.hinge === "left" ? "hægri" : "vinstri") + " þegar hún opnast"
      : d.kind === "karmur" ? "karmur eingöngu" : "lamir " + (d.hinge === "left" ? "vinstra" : "hægra") + " megin séð frá hliðinni sem hurðin opnast að";
    var mat = hasLeafMat(d) && d.leaf && ctx.mat ? ctx.mat : null, matType = mat ? (/^eg_/.test(d.leaf) ? "hardplast" : "sponlagt") : null;
    var room = d.room === OTHER ? "Alrými" : d.room || "Alrými"; // a typed room name goes in the note, never a new Rými choice
    var msg = "Innihurð" + (d.hu ? " " + d.hu : "") + " (" + roomLabelOf(d) + "): " + kindDef(d).label.toLowerCase() + ", op " + fmtMm(d.widthMm) + " × " + fmtMm(d.heightMm) + ", veggþykkt " + fmtMm(d.wallMm) + ", " + how + "." +
      (choicesText(d) ? " " + choicesText(d) + "." : "") +
      (mat ? " Hurðarblað: " + (matType === "hardplast" ? "harðplast Egger " : "spónlagt ") + mat.label + "." : hasLeafMat(d) ? " Efni hurðarblaðs ekki valið." : "") +
      (d.qty > 1 ? " " + d.qty + " eins hurðir." : "") + cncText(cncOf(d)) + (d.note ? " " + d.note : "") + " Staðfestu mál karms á staðnum.";
    var opt = {}; Object.keys(optsOf(d)).forEach(function(k){ opt[k] = optValue(d, k); });
    return { "Rými 🏡":room, "Magn":Math.max(1, d.qty | 0), "🔑":d.hu, "Vöru reitur 1":[ctx.pid], "Skilaboð til skipulags":msg,
      "Smíðagögn (JSON) 🔧":JSON.stringify({ v:1, w:d.widthMm, h:d.heightMm, d:d.wallMm, door:{ widthMm:d.widthMm, heightMm:d.heightMm, wallMm:d.wallMm,
        swing:slide ? "slide" : "toward", hinge:d.hinge, din:slide || d.kind === "karmur" ? undefined : d.hinge, kind:d.kind,
        frame:d.kind === "hurd" || d.kind === "karmur" ? (d.frame || "innf") : undefined, opt:opt, hwColor:hasHandle(d) ? (d.hwColor === "svart" ? "svart" : "krom") : undefined,
        room:roomLabelOf(d) || undefined,
        leaf:mat ? { look:d.leaf, label:mat.label, efnislistiId:mat.efnislistiId || null, type:matType } : undefined,
        cnc:cncOf(d) || undefined } }) };
  }

  // ---------------------------------------------------------------- 3D
  var ROOM_SIDE = 2.2, ROOM_H = 2.6, SKRA_OPEN = 0.5, THR_OPEN = 1, SEAL_DROP = 0.014, M = 0.001, JAMB = 0.022, CASE_W = 0.07, CASE_T = 0.012, GAP = 0.003, FLOOR_GAP = 0.01, HANDLE_Y = 1.05;
  function geo(d){ // every size the door is built from, metres
    var W = d.widthMm * M, H = d.heightMm * M, T = d.wallMm * M, s = d.hinge === "right" ? 1 : -1;
    var g = { W:W, H:H, T:T, s:s, slide:isSlide(d) };
    if (g.slide){ g.leafW = W + 0.06; g.leafH = H + 0.02; g.leafT = 0.04; }
    else { g.leafW = W - 2 * JAMB - 2 * GAP; g.leafH = H - JAMB - GAP - FLOOR_GAP; g.leafT = d.kind === "gler" ? 0.01 : d.kind === "eld" ? 0.055 : 0.04; }
    g.pivotX = s * (W / 2 - JAMB - GAP); g.freeX = -s * (W / 2 - JAMB - GAP - 0.065);
    return g;
  }
  function mat(T, o){ return new T.MeshStandardMaterial(Object.assign({ roughness:0.6, metalness:0 }, o)); }
  function box(T, w, h, dd, m, x, y, z){ var b = new T.Mesh(new T.BoxGeometry(w, h, dd), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; return b; }
  // --- hardware: one function per item. ctx = { T, d, g, leafMat, frameMat }. Returns an Object3D in the leaf's frame
  // (origin = the hinge line at the front face, the leaf runs to x = -s·leafW, its back face at z = -leafT). Parts that
  // stay on the frame (a hinge's frame leaf, a strike plate) go in obj.userData.fixed, in the same frame — buildDoor
  // moves them to the door frame so they don't swing.
  // Real hardware (round 3, 2026-10-26), sizes from the makers' drawings in mm:
  //   hinge_visible  JNF IN.05.020.100.R.ECO heavy duty, ball bearings: 100 × 75 (29.5 frame + 44.5 door from the knuckle
  //                  axis), 3 mm leaves, Ø14 knuckle in 5 segments, R10 outer corners, 4 countersunk Ø6 screws per leaf
  //   lock_standard  JNF IN.20.835 mortise lock (backset 60/50): faceplate 18 × 196 R9, latch 11.2 × 26.2, PZ 85 cylinder,
  //                  strike IN.20.835 22 × 82 R11 with a 10 × 31 opening (DXF: IN.20.835.60_DXF / _strike)
  //   lock_magnetic  JNF IN.20.976.60.B magnetic: faceplate 20 × 235 R10, magnet latch 13.2 × 31.6 above the spindle,
  //                  bolt 9.2 × 36 below, strike 24 × 170 R12 (DXF: IN.20.976.60.B / .Strike)
  //   threshold_drop the drop seal from models/door-hardware/drop-seal.glb (SketchUp → GLB), procedural until it loads
  // Colour (round 4): the Skrá step's króm / svart — the hinges, the lock, the strike and the handle all follow it.
  var FINISHES = { krom:[0xdfe2e6, 0.12, 1], svart:[0x1d1e20, 0.42, 0.65] };
  function steel(T, d){
    var f = FINISHES[(d && d.hwColor) || "krom"] || FINISHES.krom, o = { color:f[0], metalness:f[2], roughness:f[1], envMapIntensity:1.2 };
    if (T.MeshPhysicalMaterial) return new T.MeshPhysicalMaterial(Object.assign(o, { clearcoat:d && d.hwColor === "svart" ? 0.2 : 0.6, clearcoatRoughness:0.1 }));
    return mat(T, o);
  }
  function dark(T){ return mat(T, { color:0x1e1f21, metalness:0.4, roughness:0.6 }); }
  // a rounded plate in its own XY (centred), holes = [{ x, y, w, h, r } rectangles or { x, y, r } circles], extruded `t` along +Z.
  // r on the plate = corner radius (w / 2 = round ends); `only` = "right" rounds only the two corners at +x
  function plateShape(T, w, h, r, holes, only){
    var s = new T.Shape(), x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, rl = only === "right" ? 0 : r, rr = r;
    s.moveTo(x0 + rl, y0); s.lineTo(x1 - rr, y0); if (rr) s.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false); s.lineTo(x1, y1 - rr);
    if (rr) s.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false); s.lineTo(x0 + rl, y1); if (rl) s.absarc(x0 + rl, y1 - rl, rl, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + rl); if (rl) s.absarc(x0 + rl, y0 + rl, rl, Math.PI, Math.PI * 1.5, false);
    (holes || []).forEach(function(o){
      var p = new T.Path();
      if (o.w){ var hr = Math.min(o.r || 0, o.w / 2, o.h / 2), a = o.x - o.w / 2, b = o.x + o.w / 2, c = o.y - o.h / 2, e = o.y + o.h / 2;
        p.moveTo(a + hr, c); p.lineTo(b - hr, c); if (hr) p.absarc(b - hr, c + hr, hr, -Math.PI / 2, 0, false); p.lineTo(b, e - hr); if (hr) p.absarc(b - hr, e - hr, hr, 0, Math.PI / 2, false);
        p.lineTo(a + hr, e); if (hr) p.absarc(a + hr, e - hr, hr, Math.PI / 2, Math.PI, false); p.lineTo(a, c + hr); if (hr) p.absarc(a + hr, c + hr, hr, Math.PI, Math.PI * 1.5, false); }
      else p.absarc(o.x, o.y, o.r, 0, Math.PI * 2, true);
      s.holes.push(p);
    });
    return s;
  }
  function plate(T, shape, t, m, bevel){ var g = new T.ExtrudeGeometry(shape, { depth:bevel ? t - 2 * bevel : t, bevelEnabled:!!bevel, bevelThickness:bevel || 0, bevelSize:bevel || 0, bevelSegments:2, curveSegments:16 }); if (bevel) g.translate(0, 0, bevel); var mm = new T.Mesh(g, m); mm.castShadow = true; mm.receiveShadow = true; return mm; }
  // a plate lying on a face whose outward normal is ±x: its own +Z turned onto that normal, its own X along the door's z
  function onXFace(o, nx){ o.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2; return o; }
  function screwHead(T, m, r, cross){ // axis along x; `cross` = a countersunk head with a Phillips cross
    var h = new T.Mesh(new T.CylinderGeometry(r, r * (cross ? 0.75 : 0.92), 0.0008, 24), m); h.rotation.z = Math.PI / 2;
    if (cross){ var g = new T.Group(), dk = mat(T, { color:0x3a3c40, metalness:0.6, roughness:0.5 }); g.add(h);
      [0, Math.PI / 2].forEach(function(a){ var sl = new T.Mesh(new T.BoxGeometry(0.0006, r * 1.3, r * 0.28), dk); sl.rotation.x = a; g.add(sl); }); return g; }
    return h;
  }
  var COPLAN_FINISH = { silver:[0xb4b7bb, 0.48, 0x55585c], black:[0x232427, 0.58, 0x101112], bronze:[0x8a6a50, 0.45, 0x3a2c22] }; // [colour, roughness, housing]
  function coplanMat(T, fin){ // powder-coated matt zamak with a slight satin sheen; plain caps (round 9: no maker's marks)
    var o = { color:fin[0], roughness:fin[1], metalness:0.55, envMapIntensity:1 };
    return T.MeshPhysicalMaterial ? new T.MeshPhysicalMaterial(Object.assign(o, { sheen:0.3, sheenRoughness:0.6, clearcoat:0.08 })) : mat(T, o);
  }
  function linkGeo(T, len, depth, height, r, concave){ // a link seen from above (len × depth), bevelled, extruded up `height`
    var sh = new T.Shape(), x0 = -len / 2, x1 = len / 2, y0 = -depth / 2, y1 = depth / 2, cv = concave ? 0.0009 : 0;
    sh.moveTo(x0 + r, y0); sh.quadraticCurveTo(0, y0 + cv, x1 - r, y0); sh.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false); sh.lineTo(x1, y1 - r);
    sh.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false); sh.quadraticCurveTo(0, y1 - cv, x0 + r, y1); sh.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(x0, y0 + r); sh.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    var b = 0.0009, g = new T.ExtrudeGeometry(sh, { depth:height - 2 * b, bevelEnabled:true, bevelThickness:b, bevelSize:b * 0.8, bevelSegments:3, curveSegments:12 });
    g.rotateX(-Math.PI / 2); g.center(); return g;
  }
  function capGeo(T, w, l, end){ // a D-shaped cap w × l, round at the outer end (end = +1 top, -1 bottom), 1.6 mm, UVs over its box
    var s = new T.Shape(), r = w / 2;
    if (end > 0){ s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, l - r); s.absarc(r, l - r, r, 0, Math.PI, false); s.lineTo(0, 0); }
    else { s.moveTo(0, 0); s.lineTo(0, -(l - r)); s.absarc(r, -(l - r), r, Math.PI, Math.PI * 2, false); s.lineTo(w, 0); s.lineTo(0, 0); }
    var g = new T.ExtrudeGeometry(s, { depth:0.0016, bevelEnabled:true, bevelThickness:0.0004, bevelSize:0.0004, bevelSegments:2, curveSegments:16 });
    var uv = g.attributes.uv, y0 = end > 0 ? 0 : -l; for (var i = 0; i < uv.count; i++){ uv.setXY(i, uv.getX(i) / w, (uv.getY(i) - y0) / l); }
    return g;
  }
  function hingeYs(g){ var ys = [0.2, g.leafH - 0.22]; if (g.leafH > 2.15) ys.splice(1, 0, g.leafH * 0.55); return ys; } // hinge centres above the leaf's bottom
  var HW = {
    // innfelldar lamir = JNF COPLAN 175 (round 7, from the maker's drawing, mm): two mortise bodies 28 wide × 177 long with
    // round ends (R14) — plain flush end caps, a 79 mm housing between them — and a 3-section folding
    // arm (two outer links on the door body, a centre link on the frame body, pins + black washers). The arm is solved
    // from the door angle every frame (two-link fold), so it opens and closes with the door. Colour: króm → matt silver,
    // svart → matt black (bronze kept in COPLAN_FINISH for later).
    hinge_hidden:function(c){
      var T = c.T, g = c.g, sg = g.s, grp = new T.Group(), fixed = new T.Group(), fin = COPLAN_FINISH[c.d && c.d.hwColor === "svart" ? "black" : "silver"];
      var m = coplanMat(T, fin), cap = coplanMat(T, fin), inner = mat(T, { color:fin[2], roughness:0.7, metalness:0.4 }), pin = mat(T, { color:0x9a9da1, metalness:0.9, roughness:0.3 }), wash = dark(T);
      var W = 0.028, CAPL = 0.049, HOUS = 0.079, zc = -g.leafT / 2, DEPTH = 0.012, LINK = 0.024, arms = []; // pivots near the faces, so the arm stands out of both bodies when open
      function body(par, faceX, out){ // out = the side the face looks to (±x); caps + the housing seen through the face
        [1, -1].forEach(function(e){ var cp = new T.Mesh(capGeo(T, W, CAPL, e), cap); cp.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; cp.position.set(faceX - out * 0.0012, 0, out > 0 ? zc + W / 2 : zc - W / 2); cp.position.y = e * HOUS / 2; cp.castShadow = true; par.add(cp); });
        par.add(box(T, 0.0004, HOUS, W - 0.003, inner, faceX + out * 0.0003, 0, zc)); // the housing, read as a recess
        [1, -1].forEach(function(k){ par.add(box(T, 0.0012, HOUS, 0.0014, m, faceX + out * 0.0006, 0, zc + k * (W / 2 - 0.0007))); }); // its rims
        [1, -1].forEach(function(e){ par.add(rbox(T, 0.0016, 0.007, W - 0.004, 0.0006, m, faceX + out * 0.0005, e * (HOUS / 2 - 0.0042), zc)); // the adjuster plates above and below the arm
          [-1, 1].forEach(function(dd){ var tri = new T.Shape(); tri.moveTo(0, -0.0018); tri.lineTo(0, 0.0018); tri.lineTo(dd * 0.0026, 0); tri.lineTo(0, -0.0018);
            var tm = new T.Mesh(new T.ShapeGeometry(tri), inner); tm.rotation.y = out > 0 ? Math.PI / 2 : -Math.PI / 2; tm.position.set(faceX + out * 0.0014, e * (HOUS / 2 - 0.0042), zc + (out > 0 ? -1 : 1) * (0.0055 + dd * 0.0016)); par.add(tm); }); }); // ◁▷ adjuster arrows
      }
      hingeYs(g).forEach(function(yc){
        var y = FLOOR_GAP + yc, dg = new T.Group(), fg = new T.Group(); dg.position.y = fg.position.y = y;
        body(dg, 0, sg); body(fg, sg * GAP, -sg); grp.add(dg); fixed.add(fg);
        // the arm (in the frame's group, posed from the door angle)
        var arm = new T.Group(); arm.position.y = y; fixed.add(arm);
        // round 9, from the photo: chunky links — the wide centre link rounded at the front, narrower outer links above and below
        // round 10, after the photo: links are bevelled extrusions (flat front, chamfered + rounded edges); the centre link
        // is wide with slightly concave long sides; the outer links carry their own pivot knuckles; pins with screw heads
        var outerL = [0.0245, -0.0245].map(function(oy){ var l = new T.Group(), b = new T.Mesh(linkGeo(T, LINK + 0.006, 0.017, 0.0128, 0.0045, false), m); b.castShadow = true; l.add(b);
          [-1, 1].forEach(function(e){ var kn = new T.Mesh(new T.CylinderGeometry(0.0068, 0.0068, 0.0128, 28), m); kn.position.x = e * LINK / 2; l.add(kn); }); l.position.y = oy; arm.add(l); return l; });
        var centreL = new T.Group(), cb2 = new T.Mesh(linkGeo(T, LINK + 0.012, 0.026, 0.0335, 0.0062, true), m); cb2.castShadow = true; centreL.add(cb2);
        [-1, 1].forEach(function(e){ var kn = new T.Mesh(new T.CylinderGeometry(0.0072, 0.0072, 0.0335, 28), m); kn.position.x = e * LINK / 2; centreL.add(kn); }); arm.add(centreL);
        var pins = [0, 1, 2].map(function(){ var p = new T.Group(), sh = new T.Mesh(new T.CylinderGeometry(0.0026, 0.0026, 0.0615, 16), pin); p.add(sh);
          arm.add(p); return p; }); // round 11: no screw heads on the pin ends (flush with the links)
        var washers = []; [0.0165, -0.0165].forEach(function(oy){ for (var i = 0; i < 3; i++){ var w2 = new T.Mesh(new T.CylinderGeometry(0.0062, 0.0062, 0.0011, 24), wash); w2.userData.oy = oy; w2.userData.pin = i; arm.add(w2); washers.push(w2); } });
        arms.push(function(ang){ // ang = the leaf's rotation (radians)
          var dx = -sg * DEPTH, dz = zc, ca = Math.cos(ang), sa = Math.sin(ang);
          var A = { x:dx * ca + dz * sa, z:-dx * sa + dz * ca }, B = { x:sg * (GAP + DEPTH), z:zc };
          var mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, vx = B.x - A.x, vz = B.z - A.z, d = Math.hypot(vx, vz) || 1, h = Math.sqrt(Math.max(0, LINK * LINK - d * d / 4));
          var nx = -vz / d, nz = vx / d; if (nz < 0){ nx = -nx; nz = -nz; } // fold toward the room the door opens to
          var J = { x:mx + nx * h, z:mz + nz * h };
          function place(o, P1, P2){ o.position.x = (P1.x + P2.x) / 2; o.position.z = (P1.z + P2.z) / 2; o.rotation.y = -Math.atan2(P2.z - P1.z, P2.x - P1.x); }
          outerL.forEach(function(l){ place(l, A, J); }); place(centreL, J, B);
          [A, J, B].forEach(function(P, i){ pins[i].position.set(P.x, 0, P.z); });
          washers.forEach(function(w2){ var P = [A, J, B][w2.userData.pin]; w2.position.set(P.x, w2.userData.oy, P.z); });
        });
        arms[arms.length - 1](0);
      });
      fixed.userData.update = function(ang){ arms.forEach(function(f){ f(ang); }); };
      grp.userData.fixed = fixed; return grp; },
    // sýnilegar lamir: JNF IN.05.020.100 heavy duty, the knuckle on the hinge line at the face (half of it proud)
    hinge_visible:function(c){
      var T = c.T, g = c.g, s = g.s, m = steel(T, c.d), dk = mat(T, { color:0x8d9095, metalness:0.9, roughness:0.45 }), grp = new T.Group(), fixed = new T.Group();
      var R = 0.007, H = 0.1, seg = H / 5, door = 0.0445, frame = 0.0295, t = 0.003, ax = 0.0015; // knuckle axis 1.5 mm in front of the face
      hingeYs(g).forEach(function(yc){
        var y = FLOOR_GAP + yc;
        for (var k = 0; k < 5; k++){ // 5 knuckle segments with hairline joints (the ball bearings sit in them)
          var kn = new T.Mesh(new T.CylinderGeometry(R, R, seg - 0.0006, 32), m); kn.position.set(0, y - H / 2 + seg * (k + 0.5), ax); kn.castShadow = true; grp.add(kn);
          if (k === 0 || k === 4){ var dome = new T.Mesh(new T.SphereGeometry(R, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); dome.scale.y = 0.28; dome.rotation.x = k === 0 ? Math.PI : 0; dome.position.set(0, y + (k === 0 ? -1 : 1) * (H / 2 - 0.0003), ax); grp.add(dome); } // domed ends
          if (k) { var ring = new T.Mesh(new T.CylinderGeometry(R * 0.96, R * 0.96, 0.0006, 28), dk); ring.position.set(0, y - H / 2 + seg * k, ax); grp.add(ring); }
        }
        // the door leaf in the leaf's hinge edge (mortised, face flush with the edge), R10 on its outer corners, 4 screws
        // (plate X → into the thickness, its 3 mm along +x: the door leaf goes into the leaf's edge, the frame leaf into the jamb)
        var dl = plate(T, plateShape(T, door - R, H, 0.01, null, "right"), t, m, 0.0005); dl.rotation.y = Math.PI / 2; dl.position.set((s > 0 ? -t : 0) + s * 0.0004, y, ax - R - (door - R) / 2); grp.add(dl); // 0.4 mm proud of the edge (no z-fighting with it)
        [[0.037, 0.020], [0.0125, 0.011], [-0.0125, 0.020], [-0.037, 0.011]].forEach(function(p){ var sh = screwHead(T, m, 0.003, true); sh.position.set(s * 0.0009, y + p[0], ax - door + p[1]); grp.add(sh); });
        // the frame leaf on the jamb (it stays put when the door swings)
        var fl = plate(T, plateShape(T, frame - R, H, 0.01, null, "right"), t, m, 0.0005); fl.rotation.y = Math.PI / 2; fl.position.set((s > 0 ? GAP : -GAP - t) - s * 0.0004, y, ax - R - (frame - R) / 2); fixed.add(fl);
      });
      grp.userData.fixed = fixed; return grp; },
    // þétting sem fellur niður (procedural stand-in while drop-seal.glb loads): an aluminium strip in the bottom edge
    // felliþröskuldur (round 8): an automatic drop seal in two parts — the U housing (14 × 30 mm, anodised aluminium,
    // bevelled) stays in the door's bottom edge; only the T carrier with its rubber lip drops to the floor as the door
    // shuts. The brass hex button that triggers it sticks out at the hinge-side end. mm profiles, extruded along the leaf.
    threshold_drop:function(c){
      var T = c.T, g = c.g, sg = g.s, grp = new T.Group(), mm = 0.001, L = g.leafW + 0.0006, x0 = Math.min(0, -sg * g.leafW) - 0.0003, zc = -g.leafT / 2;
      var alu = T.MeshPhysicalMaterial ? new T.MeshPhysicalMaterial({ color:0xc3c6ca, metalness:0.75, roughness:0.38, sheen:0.25, sheenRoughness:0.5, clearcoat:0.15, envMapIntensity:1 }) : mat(T, { color:0xc3c6ca, metalness:0.75, roughness:0.38 });
      var rubber = mat(T, { color:0x2a2b2d, roughness:0.85, metalness:0 }), brass = mat(T, { color:0xc9a24d, metalness:0.9, roughness:0.32 });
      function prof(pts, m, bev){ var sh = new T.Shape(); pts.forEach(function(p, i){ if (i) sh.lineTo(p[0] * mm, p[1] * mm); else sh.moveTo(p[0] * mm, p[1] * mm); });
        var geo = new T.ExtrudeGeometry(sh, { depth:L - (bev ? 0.0006 : 0), bevelEnabled:!!bev, bevelThickness:0.0003, bevelSize:0.0003, bevelSegments:2, curveSegments:8 });
        var o = new T.Mesh(geo, m); o.rotation.y = Math.PI / 2; o.position.set(x0 + (bev ? 0.0003 : 0), 0, zc); o.castShadow = true; o.receiveShadow = true; return o; } // shape X → -z, its length → +x
      var house = prof([[-6.8, 0], [-5.4, 0], [-5.4, 28.4], [5.4, 28.4], [5.4, 0], [6.8, 0], [6.8, 29.8], [-6.8, 29.8]], alu, true); // in the slot, its faces flush with the leaf's
      house.position.y = FLOOR_GAP; grp.add(house);
      var carrier = new T.Group(); carrier.name = "seal";
      carrier.add(prof([[-1.6, 9], [-1.6, 22], [-5, 22], [-5, 25], [5, 25], [5, 22], [1.6, 22], [1.6, 9], [4.8, 9], [4.8, 6.5], [-4.8, 6.5], [-4.8, 9]], alu, false)); // the T carrier
      var lip = new T.Shape(); lip.moveTo(-5.4 * mm, 6.5 * mm); lip.lineTo(5.4 * mm, 6.5 * mm); lip.lineTo(5.4 * mm, 3 * mm); lip.quadraticCurveTo(5.4 * mm, 0.6 * mm, 2.5 * mm, 0.6 * mm); lip.lineTo(-2.5 * mm, 0.6 * mm); lip.quadraticCurveTo(-5.4 * mm, 0.6 * mm, -5.4 * mm, 3 * mm); lip.lineTo(-5.4 * mm, 6.5 * mm);
      var lipM = new T.Mesh(new T.ExtrudeGeometry(lip, { depth:L, bevelEnabled:false, curveSegments:10 }), rubber); lipM.rotation.y = Math.PI / 2; lipM.position.set(x0, 0, zc); lipM.castShadow = true; carrier.add(lipM);
      carrier.position.y = FLOOR_GAP; carrier.userData.y0 = FLOOR_GAP; carrier.userData.drop = FLOOR_GAP; grp.add(carrier);
      var hex = new T.Mesh(new T.CylinderGeometry(0.0065, 0.0065, 0.007, 6), brass); hex.rotation.z = Math.PI / 2; hex.position.set(-sg * 0.001, FLOOR_GAP + 0.016, zc); hex.castShadow = true; grp.add(hex); // the trigger at the hinge end
      return grp; },
    lock_standard:function(c){ return mortiseLock(c, LOCKS.jnf835); },
    lock_magnetic:function(c){ return mortiseLock(c, LOCKS.jnf976); },
    // húnn: a plain lever on both faces (placeholder — Björninn's own handles come later)
    handle_lever:function(c){ var T = c.T, grp = new T.Group(), m = steel(T, c.d), g = c.g, x = -g.s * (g.leafW - 0.06);
      [1, -1].forEach(function(side){
        var zf = side > 0 ? 0 : -g.leafT, dir = side;
        // a soft modern lever: a rose with a chamfered edge, a round neck and a rounded bar (placeholder for Björninn's own)
        var rose = new T.Mesh(new T.CylinderGeometry(0.0245, 0.026, 0.008, 40), m); rose.rotation.x = dir * Math.PI / 2; rose.position.set(x, HANDLE_Y, zf + dir * 0.004); rose.castShadow = true; grp.add(rose);
        var neck = new T.Mesh(new T.CylinderGeometry(0.0085, 0.0095, 0.052, 24), m); neck.rotation.x = dir * Math.PI / 2; neck.position.set(x, HANDLE_Y, zf + dir * 0.033); neck.castShadow = true; grp.add(neck);
        var knee = new T.Mesh(new T.SphereGeometry(0.0095, 20, 12), m); knee.position.set(x, HANDLE_Y, zf + dir * 0.058); grp.add(knee);
        var lever = rbox(T, 0.128, 0.018, 0.017, 0.0075, m, x + g.s * 0.062, HANDLE_Y, zf + dir * 0.058); grp.add(lever);
      });
      return grp; },
    // rennihurð: the track above the opening — on the wall with a cover, in the ceiling, or hidden
    track_wall:function(c){ var T = c.T, g = c.g, grp = new T.Group(), m = mat(T, { color:0xd8d9db, metalness:0.5, roughness:0.35 });
      grp.add(box(T, g.W * 2 + 0.12, 0.08, 0.05, m, g.trackX || 0, g.H + 0.07, g.T / 2 + 0.025)); return grp; },
    track_ceiling:function(c){ var T = c.T, g = c.g, grp = new T.Group(), m = mat(T, { color:0xd8d9db, metalness:0.5, roughness:0.35 });
      grp.add(box(T, g.W * 2 + 0.12, 0.035, 0.06, m, g.trackX || 0, g.H + 0.045, g.T / 2 + 0.035)); return grp; },
    track_hidden:function(c){ var T = c.T, g = c.g; return box(T, g.W * 2 + 0.12, 0.02, 0.03, mat(T, { color:0x9a9ca0, metalness:0.6 }), g.trackX || 0, g.H + 0.03, g.T / 2 + 0.02); }
  };
  // the two JNF locks, measured off their DXFs (mm, y = up from the handle spindle; plate-relative where it says so)
  var LOCKS = {
    jnf835:{ plate:[18, 196, 9], plateY:-45, holes:[{ x:0, y:0, w:11.2, h:26.2, r:0.5, latch:true }], screws:[87, -59.5, -87], trims:[50, -50],
      body:[83, 132, 13, -44.6], cyl:-85, strike:{ plate:[22, 82, 11], y:-45, holes:[{ x:0, y:0, w:10, h:31, r:1 }], screws:[30, -30] } },
    jnf976:{ plate:[20, 235, 10], plateY:-21, holes:[{ x:0, y:68.5, w:13.2, h:31.6, r:1, magnet:true }, { x:0, y:-12, w:9.2, h:36, r:0.5 }], screws:[104.5, -104.5], trims:[],
      body:[88, 170, 13, -18], cyl:-78, strike:{ plate:[24, 170, 12], y:8.5, holes:[{ x:0, y:39, w:14, h:38, r:1, magnet:true }, { x:0, y:-41, w:10.5, h:50, r:1 }], screws:[75, 0, -75] } }
  };
  function mortiseLock(c, L){
    var T = c.T, g = c.g, s = g.s, d = c.d, m = steel(T, d), dk = dark(T), grp = new T.Group(), fixed = new T.Group(), mm = 0.001;
    var edgeX = -s * g.leafW, zc = -g.leafT / 2, yP = HANDLE_Y + L.plateY * mm;
    // faceplate on the free edge, 3 mm, 0.5 mm proud; its openings show a dark pocket, the latch / magnet sits in them
    var fp = onXFace(plate(T, plateShape(T, L.plate[0] * mm, L.plate[1] * mm, L.plate[2] * mm, L.holes.map(function(o){ return { x:o.x * mm, y:o.y * mm, w:o.w * mm, h:o.h * mm, r:o.r * mm }; })), 0.003, m), -s);
    fp.position.set(edgeX + s * 0.0025, yP, zc); grp.add(fp);
    L.holes.forEach(function(o){
      grp.add(box(T, 0.0003, o.h * mm, o.w * mm, dk, edgeX - s * 0.00025, yP + o.y * mm, zc)); // the dark pocket seen through the opening (in front of the wood)
      if (o.latch) grp.add(box(T, 0.009, (o.h - 1.2) * mm, (o.w - 1.2) * mm, m, edgeX - s * 0.004, yP + o.y * mm, zc)); // the latch, out 9 mm while the door is open
      if (o.magnet) grp.add(box(T, 0.0035, (o.h - 1.6) * mm, (o.w - 1.6) * mm, mat(T, { color:0x3a3c40, metalness:0.8, roughness:0.35 }), edgeX - s * 0.0002, yP + o.y * mm, zc)); // the magnetic latch, flush
    });
    L.screws.forEach(function(y){ var h = screwHead(T, m, 0.0042); h.position.set(edgeX - s * 0.0009, yP + y * mm, zc); grp.add(h); });
    L.trims.forEach(function(y){ var h = screwHead(T, dk, 0.0028); h.position.set(edgeX - s * 0.0009, yP + y * mm, zc); grp.add(h); });
    // the lock body inside the leaf (only seen in a cut-away)
    grp.add(box(T, L.body[0] * mm, L.body[1] * mm, L.body[2] * mm, mat(T, { color:0x6d7075, metalness:0.7, roughness:0.5 }), edgeX + s * (0.0025 + L.body[0] * mm / 2), HANDLE_Y + L.body[3] * mm, zc));
    // the cylinder / thumb-turn escutcheon on both faces, PZ below the spindle (a dark euro profile in it)
    var cx = -s * (g.leafW - 0.06), cy = HANDLE_Y + L.cyl * mm;
    [1, -1].forEach(function(side){
      var zf = side > 0 ? 0 : -g.leafT, r = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.007, 32), m); r.rotation.x = Math.PI / 2; r.position.set(cx, cy, zf + side * 0.0035); grp.add(r);
      var pf = plate(T, plateShape(T, 0.01, 0.022, 0.005), 0.0006, dk); pf.position.set(cx, cy - 0.006, zf + side * 0.0071); if (side < 0) pf.rotation.y = Math.PI; grp.add(pf);
      var pc = new T.Mesh(new T.CylinderGeometry(0.0085, 0.0085, 0.0006, 24), dk); pc.rotation.x = Math.PI / 2; pc.position.set(cx, cy + 0.004, zf + side * 0.0074); grp.add(pc);
    });
    // the strike on the jamb's face across the gap (stays on the frame)
    var S = L.strike, jx = -s * (g.leafW + GAP), sy = HANDLE_Y + S.y * mm;
    var sp = onXFace(plate(T, plateShape(T, S.plate[0] * mm, S.plate[1] * mm, S.plate[2] * mm, S.holes.map(function(o){ return { x:o.x * mm, y:o.y * mm, w:o.w * mm, h:o.h * mm, r:o.r * mm }; })), 0.0015, m), s);
    sp.position.set(jx, sy, zc); fixed.add(sp);
    S.holes.forEach(function(o){ fixed.add(box(T, 0.0004, o.h * mm, o.w * mm, o.magnet ? mat(T, { color:0x2c2e31, metalness:0.85, roughness:0.3 }) : dk, jx + s * 0.0003, sy + o.y * mm, zc)); }); // the box behind / the magnet's steel plate
    S.screws.forEach(function(y){ var h = screwHead(T, m, 0.0035); h.position.set(jx + s * 0.0019, sy + y * mm, zc); fixed.add(h); });
    grp.userData.fixed = fixed; return grp;
  }
  // real models: window.KPMODELS.doorHardware[key] = { file, scale?, rot?, lengthM? } (see kitchen-planner-models.js)
  var MODEL_CACHE = {};
  function hwModel(key, T){
    var e = root.KPMODELS && root.KPMODELS.doorHardware && root.KPMODELS.doorHardware[key];
    if (!e || !e.file) return null;
    var c = MODEL_CACHE[e.file];
    if (!c){
      c = MODEL_CACHE[e.file] = { state:"loading" };
      import("three/addons/loaders/GLTFLoader.js").then(function(mod){
        new mod.GLTFLoader().load(e.file, function(res){ c.obj = res.scene; c.obj.traverse(function(o){ if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); c.state = "ready"; THUMBS = {}; if (P) P.key = ""; if (root.KPDOORS.onTexture) try{ root.KPDOORS.onTexture(); }catch(er){} }, undefined, function(){ c.state = "error"; });
      }).catch(function(){ c.state = "error"; });
    }
    if (c.state !== "ready") return null;
    var o = c.obj.clone(true); if (e.scale) o.scale.setScalar(e.scale); if (e.rot) o.rotation.set(e.rot[0] * Math.PI / 180, e.rot[1] * Math.PI / 180, e.rot[2] * Math.PI / 180);
    o.userData.entry = e; return o;
  }
  // where a real model goes (its own origin): one per hinge on the hinge line at the front face; the threshold at the
  // leaf's bottom centre in the middle of its thickness; lock + handle at the spindle; a track at the top of the opening
  function hwAnchors(key, g){
    if (/^hinge_/.test(key)) return hingeYs(g).map(function(y){ return [0, FLOOR_GAP + y, 0]; });
    if (key === "threshold_drop") return [[-g.s * g.leafW / 2, FLOOR_GAP + 0.0005, -g.leafT / 2]];
    if (/^lock_|^handle_/.test(key)) return [[-g.s * (g.leafW - 0.06), HANDLE_Y, 0]];
    return [[0, g.H, g.T / 2]];
  }
  function hw(key, c){
    if (!hwModel(key, c.T)) return HW[key](c);
    var grp = new c.T.Group();
    hwAnchors(key, c.g).forEach(function(a){
      var m = hwModel(key, c.T), e = m.userData.entry;
      if (e.lengthM) m.scale.x *= (c.g.leafW - 0.006) / e.lengthM; // a profile cut to the leaf's width (inside it — the cut-away shows it)
      m.position.set(a[0], a[1], a[2]); if (c.g.s > 0 && /^hinge_|^lock_|^handle_/.test(key)) m.scale.x *= -1; grp.add(m);
    });
    if (key === "threshold_drop"){ grp.name = "seal"; grp.userData.y0 = 0; grp.userData.drop = FLOOR_GAP; grp.position.y = -FLOOR_GAP; } // the gasket's foot is flush with the leaf when up, on the floor when down
    return grp;
  }
  // which hardware this door has
  function hardwareOf(d){
    var out = { leaf:[], fixed:[] };
    if (isSlide(d)){ var b = optValue(d, "braut"); out.fixed.push(b === "loft" ? "track_ceiling" : b === "magic" ? "track_hidden" : "track_wall"); return out; }
    if (d.kind === "karmur") return out;
    out.leaf.push(optValue(d, "lamir") === "samloku" ? "hinge_visible" : "hinge_hidden");
    if (d.kind === "eld" || optValue(d, "throskuldur") === "ja") out.leaf.push("threshold_drop");
    if (d.kind !== "gler") out.leaf.push(optValue(d, "skra") === "segul" ? "lock_magnetic" : "lock_standard"); // a 10 mm glass leaf takes no mortise lock
    out.leaf.push("handle_lever");
    return out;
  }

  // ---------- round 4 (2026-10-26): a calmer, photo-like door — rounded edges, real veneer (KPMat wood: 0.6 × 1.2 m tile,
  // grain along the leaf), a door stop behind the leaf, profiled karmur + gerefti in the leaf's material, soft AO.
  function rbox(T, w, h, dd, r, m, x, y, z){ // a box with rounded edges (RoundedBoxGeometry when three has it)
    var RB = root.__RoundedBox__, g = RB ? new RB(w, h, dd, 2, Math.min(r, w / 2.2, h / 2.2, dd / 2.2)) : new T.BoxGeometry(w, h, dd);
    var b = new T.Mesh(g, m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; return b;
  }
  var WOOD_TEX = {};
  function woodMaps(T, look){ // { map, bump } canvas textures for a spónlagt look, once per look
    var k = look.key + "|" + look.color; if (WOOD_TEX[k]) return WOOD_TEX[k];
    if (!root.KPMat || !root.KPMat.woodTexture) return null;
    var w = root.KPMat.woodTexture("door-" + look.key, look.color), map = new T.CanvasTexture(w.color), bump = new T.CanvasTexture(w.bump);
    if (T.SRGBColorSpace) map.colorSpace = T.SRGBColorSpace;
    var an = R ? R.capabilities.getMaxAnisotropy() : 8;
    [map, bump].forEach(function(t){ t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = an; t.minFilter = T.LinearMipmapLinearFilter; });
    return (WOOD_TEX[k] = { map:map, bump:bump, tw:w.tileW, th:w.tileH });
  }
  // the leaf's material for a part of size u × v metres on its big face (grain along v; `across` turns it 90°)
  // planar UVs in the leaf's frame (metres → tiles): big faces x / y, edges z / y, top + bottom x / z — the same for every
  // piece of a leaf that is built in parts, so the veneer runs across them without a seam
  function leafUV(mesh, ox, oy, oz, tw, th){
    var gm = mesh.geometry, pos = gm.attributes.position, nor = gm.attributes.normal, uv = gm.attributes.uv, p = mesh.position;
    for (var i = 0; i < pos.count; i++){
      var x = pos.getX(i) + p.x - ox, y = pos.getY(i) + p.y - oy, z = pos.getZ(i) + p.z - oz, nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      if (nz >= nx && nz >= ny) uv.setXY(i, x / tw, y / th); else if (nx >= ny) uv.setXY(i, z / tw, y / th); else uv.setXY(i, x / tw, z / th);
    }
    uv.needsUpdate = true;
  }
  function woodPart(T, look, u, v, across, vFrom){ // vFrom = where this piece starts up the leaf (m): the grain continues across pieces
    var base = { roughness:0.5, metalness:0, envMapIntensity:0.5 };
    if (look && look.wood){
      var wm = woodMaps(T, look);
      if (wm){
        var map = wm.map.clone(), bump = wm.bump.clone(); map.needsUpdate = bump.needsUpdate = true;
        [map, bump].forEach(function(t){ if (across){ t.rotation = Math.PI / 2; t.center.set(0.5, 0.5); t.repeat.set(v / wm.tw, u / wm.th); } else { t.repeat.set(u / wm.tw, v / wm.th); if (vFrom) t.offset.y = vFrom / wm.th; } });
        return mat(T, Object.assign(base, { map:map, bumpMap:bump, bumpScale:0.6 }));
      }
    }
    if (look && look.tex){ var m = mat(T, Object.assign(base, { map:look.tex })); return m; } // an older Egger choice
    return mat(T, Object.assign(base, { color:new T.Color((look && look.color) || "#f3f1ec") }));
  }
  function buildDoor(T, d, look){
    var g = geo(d), grp = new T.Group(), W = g.W, H = g.H, Th = g.T;
    var paintTex = root.KPMat && root.KPMat.paintTexture ? root.KPMat.paintTexture("door-wall", "#e9e4dc") : null;
    var wallMat = mat(T, { color:0xe6e1d8, roughness:0.92 });
    if (paintTex){ var wb = new T.CanvasTexture(paintTex.bump); wb.wrapS = wb.wrapT = T.RepeatWrapping; wb.repeat.set(3, 4); wallMat.bumpMap = wb; wallMat.bumpScale = 0.4; }
    var sideW = ROOM_SIDE, Hw = Math.max(ROOM_H, H + 0.3), walls = [], xray = [];
    var paint = mat(T, { color:0xf6f4f0, roughness:0.6 });
    var woody = d.kind === "hurd" || d.kind === "eld" || d.kind === "renni";
    var leafMat = woodPart(T, woody ? look : null, g.leafW, g.leafH);
    var jambMat = woody ? woodPart(T, look, Th, H) : paint, headMat = woody ? woodPart(T, look, W, Th, true) : paint;
    var caseMatV = woody ? woodPart(T, look, CASE_W, H) : paint, caseMatH = woody ? woodPart(T, look, W + 2 * CASE_W, CASE_W, true) : paint; // gerefti follow the leaf (user, round 4)
    var gerefti = (d.kind === "hurd" || d.kind === "karmur" || d.kind === "eld") && d.frame === "gerefti";
    // the wall, cut where the opening is. Its right part is two pieces: in Mál the outer one hides and the wall ends at
    // cutX — a section through the wall, so its bare end shows how thick it is (round 6: the dimension sat on the karmur)
    var cutX = W / 2 + (gerefti ? CASE_W - JAMB : 0) + 0.32, cutAway = [];
    g.cutX = cutX;
    [[sideW, Hw, -W / 2 - sideW / 2, Hw / 2], [cutX - W / 2, Hw, (W / 2 + cutX) / 2, Hw / 2], [W, Hw - H, 0, H + (Hw - H) / 2]].forEach(function(p){
      if (p[1] <= 0) return; var m = box(T, p[0], p[1], Th, wallMat, p[2], p[3], 0); walls.push(m); grp.add(m); });
    var outer = box(T, W / 2 + sideW - cutX, Hw, Th, wallMat, (cutX + W / 2 + sideW) / 2, Hw / 2, 0); walls.push(outer); cutAway.push(outer); grp.add(outer);
    // the room (round 5): side walls and a ceiling so it reads as part of a house, not a wall in a void
    [-1, 1].forEach(function(sx){ var m = box(T, 0.1, Hw, 4.2, wallMat, sx * (W / 2 + sideW + 0.05), Hw / 2, Th / 2 + 2.1); m.receiveShadow = true; grp.add(m); if (sx > 0) cutAway.push(m); });
    var ceil = new T.Mesh(new T.PlaneGeometry(W + 2 * sideW + 0.2, 4.4), mat(T, { color:0xf7f6f2, roughness:0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, Hw, Th / 2 + 2.2); grp.add(ceil);
    // skirting on both faces, stopping clean against the karmur / gerefti (round 5: it ran through them) and along the side walls
    var skEdge = W / 2 + (gerefti ? CASE_W - JAMB : 0), skLen = sideW - (skEdge - W / 2);
    [-1, 1].forEach(function(sx){ [1, -1].forEach(function(sz){
        if (sx < 0) grp.add(rbox(T, skLen, 0.07, 0.012, 0.002, paint, -(skEdge + skLen / 2), 0.035, sz * (Th / 2 + 0.006)));
        else { var a = cutX - skEdge, b = W / 2 + sideW - cutX; grp.add(rbox(T, a, 0.07, 0.012, 0.002, paint, skEdge + a / 2, 0.035, sz * (Th / 2 + 0.006)));
          var o = rbox(T, b, 0.07, 0.012, 0.002, paint, cutX + b / 2, 0.035, sz * (Th / 2 + 0.006)); cutAway.push(o); grp.add(o); } });
      var sw2 = rbox(T, 0.012, 0.07, 4.2, 0.002, paint, sx * (W / 2 + sideW - 0.006), 0.035, Th / 2 + 2.1); if (sx > 0) cutAway.push(sw2); grp.add(sw2); });
    g.wallH = Hw;
    if (!g.slide){ // karmur: lining in the opening, rounded edges; a door stop behind the leaf
      [-1, 1].forEach(function(sx){ var j = rbox(T, JAMB, H, Th, 0.002, sx === g.s ? jambMat.clone() : jambMat, sx * (W / 2 - JAMB / 2), H / 2, 0); if (sx === g.s) xray.push(j); grp.add(j); });
      grp.add(rbox(T, W, JAMB, Th, 0.002, headMat, 0, H - JAMB / 2, 0));
      if (d.kind !== "karmur"){
        var stopZ = Th / 2 - g.leafT - 0.009, STOP = 0.011;
        [-1, 1].forEach(function(sx){ var st = rbox(T, STOP, H - JAMB, 0.016, 0.002, sx === g.s ? jambMat.clone() : jambMat, sx * (W / 2 - JAMB - STOP / 2), (H - JAMB) / 2, stopZ); if (sx === g.s) xray.push(st); grp.add(st); });
        grp.add(rbox(T, W - 2 * JAMB, STOP, 0.016, 0.002, headMat, 0, H - JAMB - STOP / 2, stopZ));
      }
      if (gerefti) [1, -1].forEach(function(side){ // casing: a 70 × 14 board with a rounded front edge and a small bead
        var z = side * (Th / 2 + CASE_T / 2), zb = side * (Th / 2 + CASE_T + 0.002), hh = H + CASE_W - JAMB;
        [-1, 1].forEach(function(sx){ var cs = rbox(T, CASE_W, hh, CASE_T, 0.004, sx === g.s ? caseMatV.clone() : caseMatV, sx * (W / 2 + CASE_W / 2 - JAMB), hh / 2, z); if (sx === g.s) xray.push(cs); grp.add(cs); });
        grp.add(rbox(T, W + 2 * CASE_W - 2 * JAMB, CASE_W, CASE_T, 0.004, caseMatH, 0, H - JAMB + CASE_W / 2, z));
        [-1, 1].forEach(function(sx){ var bd = rbox(T, 0.008, hh - 0.012, 0.004, 0.0018, sx === g.s ? caseMatV.clone() : caseMatV, sx * (W / 2 - JAMB + CASE_W - 0.012), (hh - 0.012) / 2, zb); if (sx === g.s) xray.push(bd); grp.add(bd); });
        grp.add(rbox(T, W + 2 * CASE_W - 2 * JAMB - 0.024, 0.008, 0.004, 0.0018, caseMatH, 0, H - JAMB + CASE_W - 0.012, zb));
      });
    }
    if (!g.slide && d.kind !== "karmur") grp.add(box(T, W - 2 * JAMB, 0.002, Th, mat(T, { color:0x4a4038, roughness:0.9 }), 0, 0.001, 0)); // the floor through the opening, darker so the gap under the leaf shows
    var c = { T:T, d:d, g:g, leafMat:leafMat, frameMat:jambMat }, leafGroup = null;
    if (d.kind !== "karmur"){
      var glassMat = T.MeshPhysicalMaterial ? new T.MeshPhysicalMaterial({ color:0xe4f0f4, transmission:0.85, opacity:1, transparent:true, roughness:0.06, thickness:0.01, ior:1.5, envMapIntensity:0.9 }) : mat(T, { color:0xcfe3ee, transparent:true, opacity:0.38, roughness:0.05 });
      if (!("transmission" in glassMat)){ glassMat.opacity = 0.38; }
      leafGroup = new T.Group();
      if (g.slide){
        var lx = 0, lz = Th / 2 + 0.014 + g.leafT / 2;
        if (d.kind === "glerrenni"){ var fr = mat(T, { color:0x2f3135, metalness:0.6, roughness:0.35 });
          leafGroup.add(box(T, g.leafW, g.leafH, 0.01, glassMat, lx, g.leafH / 2, lz));
          [[g.leafW, 0.04, 0, g.leafH - 0.02], [g.leafW, 0.04, 0, 0.02], [0.04, g.leafH, -g.leafW / 2 + 0.02, g.leafH / 2], [0.04, g.leafH, g.leafW / 2 - 0.02, g.leafH / 2]].forEach(function(r){ leafGroup.add(rbox(T, r[0], r[1], 0.03, 0.004, fr, lx + r[2], r[3], lz)); });
        } else {
          leafGroup.add(rbox(T, g.leafW, g.leafH, g.leafT, 0.003, leafMat, lx, g.leafH / 2, lz));
          leafGroup.add(rbox(T, 0.022, 0.24, 0.006, 0.003, steel(T, d), lx + (d.hinge === "left" ? -1 : 1) * (g.leafW / 2 - 0.06), HANDLE_Y, lz + g.leafT / 2 + 0.003)); // flush pull on the leading edge
        }
        leafGroup.userData.slideDir = d.hinge === "left" ? 1 : -1; // "lamir vinstra" ≙ rennur til hægri (as before)
      } else {
        // round 8: one solid leaf again (the round-6 slot pieces left a band at the bottom); the drop seal's housing sits
        // flush in the bottom edge and shows at both ends, so it reads as a clean recess
        // round 9: a leaf with a drop seal has a real slot (14.2 × 30.2 mm) the length of its bottom edge — the body above
        // it and two cheeks beside it, plain boxes that meet without overlap, the grain continuing from cheek to body
        var slot = d.kind !== "gler" && hardwareOf(d).leaf.indexOf("threshold_drop") >= 0, SW = 0.0142, SH = 0.0302, lx = -g.s * g.leafW / 2;
        var leaf = d.kind === "gler" ? box(T, g.leafW, g.leafH, g.leafT, glassMat, lx, FLOOR_GAP + g.leafH / 2, -g.leafT / 2)
          : slot ? box(T, g.leafW, g.leafH - SH, g.leafT, woodPart(T, woody ? look : null, g.leafW, g.leafH - SH, false, SH), lx, FLOOR_GAP + SH + (g.leafH - SH) / 2, -g.leafT / 2)
          : rbox(T, g.leafW, g.leafH, g.leafT, 0.003, leafMat, lx, FLOOR_GAP + g.leafH / 2, -g.leafT / 2);
        leaf.userData.isLeaf = true;
        leafGroup.add(leaf);
        if (slot){ var ch = (g.leafT - SW) / 2, wmS = woody && look && look.wood ? woodMaps(T, look) : null;
          var pieces = [leaf]; [-1, 1].forEach(function(k){ var cb = box(T, g.leafW, SH, ch, leaf.material, lx, FLOOR_GAP + SH / 2, -g.leafT / 2 + k * (SW / 2 + ch / 2)); leafGroup.add(cb); pieces.push(cb); });
          // round 10: one planar mapping in the leaf's own frame for all three pieces — the grain runs straight through the joins
          var tw = 0, th = 0, wmat = null;
          if (wmS){ tw = wmS.tw; th = wmS.th; wmat = woodPart(T, look, tw, th); } // repeat 1 × 1: the UVs below are already in tiles
          else if (woody && look && look.tex){ var tl = look.tile || { w:1.3, h:2.8 }, tx = look.tex.clone(); tx.repeat.set(1, 1); tx.needsUpdate = true; tw = tl.w; th = tl.h;
            wmat = mat(T, { map:tx, roughness:0.5, metalness:0, envMapIntensity:0.5 }); } // a decor texture (Egger raport)
          if (wmat) pieces.forEach(function(pc){ pc.material = wmat; leafUV(pc, Math.min(0, -g.s * g.leafW), FLOOR_GAP, -g.leafT, tw, th); }); }
        leafGroup.position.set(g.pivotX, 0, Th / 2);
        hardwareOf(d).leaf.forEach(function(k){ var o = hw(k, c); if (!o) return; leafGroup.add(o);
          if (o.userData.fixed){ o.userData.fixed.position.set(g.pivotX, 0, Th / 2); grp.add(o.userData.fixed); if (o.userData.fixed.userData.update) (grp.userData.armUps = grp.userData.armUps || []).push(o.userData.fixed.userData.update); } }); // frame leaves / strikes stay on the frame
      }
      grp.add(leafGroup);
    }
    hardwareOf(d).fixed.forEach(function(k){ var o = hw(k, c); if (o) grp.add(o); });
    // the swing on the floor (Opnun): a dashed quarter circle on the side it opens to
    if (!g.slide && d.kind !== "karmur"){
      var pts = []; for (var i = 0; i <= 24; i++){ var a = i / 24 * Math.PI / 2; pts.push(new T.Vector3(g.pivotX - g.s * g.leafW * Math.cos(a), 0.002, Th / 2 + g.leafW * Math.sin(a))); }
      var arc = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color:0x0058a3, dashSize:0.04, gapSize:0.03 }));
      arc.computeLineDistances(); arc.visible = false; grp.add(arc); grp.userData.arc = arc;
    }
    grp.userData.leaf = leafGroup; grp.userData.g = g; grp.userData.walls = walls; grp.userData.wallMat = wallMat; grp.userData.xray = xray; grp.userData.cutAway = cutAway;
    return grp;
  }

  // ---------------------------------------------------------------- the live preview (one at a time)
  var P = null, R = null, ENV = null; // P = the open preview, R = the renderer (kept between opens)
  function renderer(T){
    if (R) return R;
    R = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    R.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2.5)); R.localClippingEnabled = true; // the seal cut-away
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    if (T.ACESFilmicToneMapping){ R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 0.95; }
    R.domElement.style.width = "100%"; R.domElement.style.height = "100%"; R.domElement.style.display = "block";
    return R;
  }
  function makeScene(T){
    var scene = new T.Scene(); scene.background = new T.Color(0xf3f1ed);
    var floorMat = mat(T, { color:0xc9a97c, roughness:0.62 });
    if (root.KPMat && root.KPMat.plankFloorTexture){ try{ var ft = root.KPMat.plankFloorTexture("#c9a97c", 14), fm = new T.CanvasTexture(ft.color || ft); if (T.SRGBColorSpace) fm.colorSpace = T.SRGBColorSpace; fm.wrapS = fm.wrapT = T.RepeatWrapping; fm.repeat.set(6, 6); fm.anisotropy = R ? R.capabilities.getMaxAnisotropy() : 8; floorMat.map = fm; floorMat.color = new T.Color(0xffffff); }catch(e){} }
    var floor = new T.Mesh(new T.PlaneGeometry(12, 12), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    scene.add(new T.HemisphereLight(0xfffdf8, 0xb9ae9c, 0.45));
    var key = new T.DirectionalLight(0xfff3e2, 1.25); key.position.set(1.8, 3.4, 3.0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6;
    var sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3.2; sc.bottom = -0.4; sc.near = 0.5; sc.far = 10; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015;
    scene.add(key);
    var fill = new T.DirectionalLight(0xe4ecff, 0.3); fill.position.set(-2.5, 1.8, 2.4); scene.add(fill);
    var back = new T.DirectionalLight(0xffffff, 0.3); back.position.set(-0.5, 2.2, -3); scene.add(back);
    if (root.__RoomEnvironment__ && !ENV){ try{ var pm = new T.PMREMGenerator(renderer(T)); ENV = pm.fromScene(new root.__RoomEnvironment__(renderer(T)), 0.04).texture; pm.dispose(); }catch(e){ ENV = null; } }
    if (ENV) scene.environment = ENV;
    return scene;
  }
  // soft ambient occlusion where the leaf meets the frame and the frame meets the wall (three's GTAO, as in the room view)
  function makeComposer(T, scene, cam, w, h){
    var PP = root.__POST__; if (!PP || !PP.GTAOPass || !PP.EffectComposer) return null;
    try{
      var r = renderer(T), pr = r.getPixelRatio(), rt = new T.WebGLRenderTarget(w * pr, h * pr, { samples:4, type:T.HalfFloatType }); // MSAA through the AO pass: sharp edges (round 5)
      var comp = new PP.EffectComposer(r, rt); comp.setSize(w, h);
      comp.addPass(new PP.RenderPass(scene, cam));
      var ao = new PP.GTAOPass(scene, cam, w, h);
      ao.updateGtaoMaterial({ radius:0.06, distanceExponent:1.4, thickness:0.06, scale:1.6, distanceFallOff:0.6, samples:16 });
      ao.updatePdMaterial({ lumaPhi:10, depthPhi:2, normalPhi:3, radius:8, rings:3, samples:16 });
      ao.blendIntensity = 0.9;
      comp.addPass(ao); comp.addPass(new PP.OutputPass());
      return comp;
    }catch(e){ return null; }
  }
  // where the camera looks for each step (user: whole door for Gerð/Mál/Efni, the hinge side for Opnun/Lamir,
  // the bottom edge for Felliþröskuldur, the lock/handle for Skrá)
  function aimFor(g, sec, aspect, focus){
    var vHalf = 40 * Math.PI / 360, hHalf = Math.atan(Math.tan(vHalf) * (aspect || 1)), zF = g.T / 2;
    function fit(h, w){ return Math.max(h / 2 / Math.tan(vHalf), w / 2 / Math.tan(hHalf)); }
    var whole = fit(g.H + 0.5, g.W + 0.9) * 1.08;
    if (g.slide && (sec === "opnun" || sec === "braut")){
      if (sec === "braut") return { t:[0, g.H, zF], p:[g.W * 0.35, g.H + 0.35, zF + fit(0.7, g.W * 2 + 0.3) * 0.9] };
      return { t:[0, g.H / 2, zF], p:[0, g.H * 0.62, zF + fit(g.H + 0.5, g.W * 2.2 + 0.4) * 1.05] };
    }
    switch (sec){
      case "opnun": return { t:[0, g.H * 0.45, zF + 0.3], p:[0, g.H * 1.2, zF + whole * 1.25] }; // centred and the same for left / right: hovering only changes the door (round 6)
      // the hinge side from outside the swing, close on the upper hinges, the leaf ajar so the hinge line shows
      case "lamir": { // round 6: the door open 90°, standing in the doorway looking at the hinge side — the hinge edge, the knuckle, the jamb
        var hy = FLOOR_GAP + g.leafH - 0.22; return { t:[g.pivotX, hy - 0.04, zF + 0.012], p:[g.pivotX - g.s * 0.34, hy + 0.05, zF - 0.08] }; }
      // low on the bottom edge: the gap under the leaf (and the seal dropping into it)
      case "throskuldur": { // the open leaf's free end, at the floor, from a little to the side: the bottom edge in section, the seal in its slot
        var fx = g.pivotX - g.s * g.leafT / 2, fz = zF + g.leafW;
        return { t:[fx, 0.028, fz], p:[fx - g.s * 0.11, 0.08, fz + 0.2] }; } // round 8: closer, the seal's profile fills the view
      case "skra": { // the door half open: the lock's faceplate on its edge, the handle beside it
        var oa = SKRA_OPEN * Math.PI / 2, ex = g.pivotX - g.s * g.leafW * Math.cos(oa), ez = zF + g.leafW * Math.sin(oa) - g.leafT / 2;
        return { t:[ex, HANDLE_Y - 0.05, ez], p:[ex - g.s * 0.42, HANDLE_Y + 0.12, ez + 0.62] }; }
      case "mal": if (focus === "wallMm") return { t:[g.cutX - 0.5, g.H * 0.5, 0], p:[g.cutX + 1.55, g.H * 0.72, zF + 2.25] }; // the cut wall end, the karmur and the door together (round 6)
      /* falls through */
      default: { var dist = fit(g.H + 0.75, g.W + 0.8) * 1.04; return { t:[0, g.H / 2 + 0.08, zF], p:[dist * 0.3, g.H * 0.56, zF + dist] }; } // the whole door centred, room for the dimension pills
    }
  }
  function lookKey(look){ return look ? (look.key || "") + "|" + (look.color || "") + "|" + (look.img || "") : ""; }
  var TEX = {};
  function texFor(T, look){ // a leaf texture from the swatch image, once
    if (!look || !look.img) return null;
    var t = TEX[look.img];
    if (!t){
      t = TEX[look.img] = new T.TextureLoader().load(look.img, function(){ if (P) P.key = ""; if (root.KPDOORS.onTexture) try{ root.KPDOORS.onTexture(); }catch(e){} });
      if (look.crop){ var k = 1 / look.crop; t.repeat.set(k, k * 1.6); t.offset.set((1 - k) / 2, (1 - k * 1.6) / 2); } // a spónlagt photo: only its middle is veneer (same crop as the swatch), stretched along the leaf
      else { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.65, 0.75); } // Egger's raport is ~1.3 × 2.8 m: a leaf is about half of it
      if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    }
    return t.image && t.image.complete !== false && t.image.width ? t : null;
  }
  var preview = {
    // host = the element the canvas goes in, svg = the dimension-line overlay, fmt(mm) → "80" for the labels
    open:function(host, svg, fmt, unit){ // unit = the label after the number ("cm"; PRO: "mm")
      var T = root.__THREE__; if (!T || !host) return false;
      preview.close();
      var r = renderer(T); host.innerHTML = ""; host.appendChild(r.domElement);
      var cam = new T.PerspectiveCamera(40, 1, 0.02, 40);
      P = { T:T, host:host, svg:svg, fmt:fmt || function(mm){ return Math.round(mm / 10); }, unit:unit || "cm", scene:makeScene(T), cam:cam, door:null, key:"", view:{}, d:null, look:null,
        camFrom:null, camTo:null, tFrom:null, tTo:null, t0:0, open:0, openTo:0, raf:0, size:"" };
      P.ctl = root.__OrbitControls__ ? new root.__OrbitControls__(cam, r.domElement) : null;
      if (P.ctl){ P.ctl.enablePan = false; P.ctl.enableZoom = false; P.ctl.enableRotate = !!(P.view && P.view.free); P.ctl.enableDamping = true; }
      P.zoom = 1;
      // zoom (round 4): wheel, trackpad pinch (ctrl+wheel) and two-finger pinch scale the distance of the step's own view
      P.onWheel = function(e){ e.preventDefault(); setZoom(P.zoom * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); };
      P.onTouch = function(e){
        if (e.touches.length !== 2) { P.pinch = 0; return; }
        var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY, dd = Math.hypot(dx, dy);
        if (P.pinch && e.type === "touchmove"){ e.preventDefault(); setZoom(P.zoom * P.pinch / dd); }
        P.pinch = dd;
      };
      r.domElement.addEventListener("wheel", P.onWheel, { passive:false });
      r.domElement.addEventListener("touchstart", P.onTouch, { passive:false }); r.domElement.addEventListener("touchmove", P.onTouch, { passive:false });
      cam.position.set(1, 1.4, 3.5); (function loop(){ if (!P) return; P.raf = requestAnimationFrame(loop); frame(); })();
      return true;
    },
    // d = the draft door, look = { color, img } of its leaf, view = { sec, focus:"widthMm"|…, picked:{mal:true}, free }
    set:function(d, look, view){
      if (!P) return;
      P.d = d; P.look = look; P.view = view || {};
      if (P.ctl) P.ctl.enableRotate = !!P.view.free;
      var key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, d.hwColor, lookKey(look)]);
      if (key !== P.key) rebuild();
      var sec = P.view.sec, slide = isSlide(d);
      P.openTo = !slide && d.kind !== "karmur" && (sec === "opnun" || sec === "lamir" || sec === "skra") ? (sec === "lamir" ? 1 : sec === "skra" ? SKRA_OPEN : 0.55) : slide && sec === "opnun" ? 0.45 : 0;
      if (P.door && P.door.userData.arc) P.door.userData.arc.visible = sec === "opnun";
      var aimK = JSON.stringify([sec, P.view.focus, P.size, d.widthMm, d.heightMm, d.wallMm, d.kind, d.hinge]);
      if (aimK !== P.aimK){ P.aimK = aimK; aim(!!P.aimed); P.aimed = true; }
    },
    close:function(){
      if (!P) return;
      cancelAnimationFrame(P.raf);
      if (P.ctl) P.ctl.dispose();
      R.domElement.removeEventListener("wheel", P.onWheel); R.domElement.removeEventListener("touchstart", P.onTouch); R.domElement.removeEventListener("touchmove", P.onTouch);
      if (P.comp && P.comp.dispose) try{ P.comp.dispose(); }catch(e){}
      if (R && R.domElement.parentNode) R.domElement.parentNode.removeChild(R.domElement);
      if (P.svg) P.svg.innerHTML = "";
      disposeTree(P.scene); P = null;
    }
  };
  function disposeTree(o){ o.traverse(function(x){ if (x.geometry) x.geometry.dispose(); if (x.material && !x.material.map) [].concat(x.material).forEach(function(m){ m.dispose(); }); }); }
  function rebuild(){
    var T = P.T, d = P.d, look = P.look;
    if (P.door){ P.scene.remove(P.door); disposeTree(P.door); }
    var l = look ? Object.assign({}, look, { tex:texFor(T, look) }) : null;
    P.door = buildDoor(T, d, l); P.scene.add(P.door);
    P.key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, d.hwColor, lookKey(look)]);
    // (the texture loader clears P.key when the picture is in, and the next frame rebuilds with it)
    setOpen(P.open);
  }
  function setOpen(k){
    var door = P.door, lg = door && door.userData.leaf; if (!lg) return;
    var g = door.userData.g;
    if (g.slide) lg.position.x = (lg.userData.slideDir || 1) * k * g.W;
    else { lg.rotation.y = g.s * k * Math.PI / 2; (door.userData.armUps || []).forEach(function(f){ f(lg.rotation.y); }); } // the COPLAN arm folds with the door
  }
  // Felliþröskuldur: the door swings shut and the seal drops onto the floor, over and over (3.2 s)
  function sealLoop(){
    var lg = P.door.userData.leaf, seal = lg && lg.getObjectByName("seal"), t = (performance.now() % 3200) / 3200, open, drop;
    function ease(x){ x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    // round 4: the door stands open, seen from the side of its bottom edge (the seal's profile shows at the end); the
    // seal drops to the floor and lifts again, the way it does when the door shuts
    drop = t < 0.25 ? 0 : t < 0.4 ? ease((t - 0.25) / 0.15) : t < 0.8 ? 1 : 1 - ease((t - 0.8) / 0.15);
    open = P.open + (THR_OPEN - P.open) * 0.12;
    P.open = open; setOpen(open);
    if (seal) seal.position.y = seal.userData.y0 - (seal.userData.drop || SEAL_DROP) * drop;
  }
  function aim(animate){
    var g = P.door.userData.g, a = aimFor(g, P.view.sec, P.cam.aspect, P.view.focus), T = P.T;
    P.aimP = new T.Vector3(a.p[0], a.p[1], a.p[2]); P.aimT = new T.Vector3(a.t[0], a.t[1], a.t[2]);
    P.camFrom = P.cam.position.clone(); P.tFrom = P.ctl ? P.ctl.target.clone() : new T.Vector3();
    P.camTo = P.aimT.clone().add(P.aimP.clone().sub(P.aimT).multiplyScalar(P.zoom || 1)); P.tTo = P.aimT.clone();
    P.t0 = animate ? performance.now() : 0;
  }
  var ZOOM_MIN = 0.45, ZOOM_MAX = 1.7;
  function setZoom(z){
    if (!P || !P.aimP) return;
    P.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    P.camFrom = P.cam.position.clone(); P.tFrom = P.ctl ? P.ctl.target.clone() : P.aimT.clone();
    P.camTo = P.aimT.clone().add(P.aimP.clone().sub(P.aimT).multiplyScalar(P.zoom)); P.tTo = P.aimT.clone();
    P.t0 = performance.now() - 380; // a short ease, not the full step move
  }
  function frame(){
    var r = R, host = P.host, w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var sz = w + "x" + h;
    if (sz !== P.size){ P.size = sz; r.setSize(w, h, false); P.cam.aspect = w / h; P.cam.updateProjectionMatrix(); P.aimK = ""; if (P.d) preview.set(P.d, P.look, P.view);
      if (P.comp && P.comp.dispose) try{ P.comp.dispose(); }catch(e){} P.comp = makeComposer(P.T, P.scene, P.cam, w, h); }
    if (P.d && !P.key && P.door) rebuild(); // a texture / hardware model came in
    if (!P.door) return;
    if (P.camTo){ // smooth like the cabinet wizard's uwAimCamera
      var k = P.t0 ? Math.min(1, (performance.now() - P.t0) / 520) : 1, e = k * k * (3 - 2 * k);
      P.cam.position.copy(P.camFrom).lerp(P.camTo, e);
      var t = P.tFrom.clone().lerp(P.tTo, e);
      if (P.ctl) P.ctl.target.copy(t); P.cam.lookAt(t);
      if (k >= 1) P.camTo = null;
    }
    if (P.view.sec === "throskuldur") sealLoop();
    else if (Math.abs(P.open - P.openTo) > 0.002){ P.open += (P.openTo - P.open) * 0.12; setOpen(P.open); }
    if (P.ctl && !P.camTo) P.ctl.update();
    var cut = P.view.sec === "mal"; // Mál: the wall shown in section beside the door (round 6)
    if (P.door.userData.cutOn !== cut){ P.door.userData.cutOn = cut; (P.door.userData.cutAway || []).forEach(function(m){ m.visible = !cut; }); }
    if (P.comp) P.comp.render(); else r.render(P.scene, P.cam);
    drawDims();
  }
  // dimension lines like the cabinet wizard: the one being typed blue, the ones already entered dark, only on the
  // whole-door views (they'd float off the detail views)
  function drawDims(){
    var svg = P.svg; if (!svg) return;
    var sec = P.view.sec, picked = P.view.picked || {}, whole = !sec || sec === "gerd" || sec === "mal" || sec === "efni";
    if (!whole){ if (svg.innerHTML) svg.innerHTML = ""; return; }
    var g = P.door.userData.g, d = P.d, T = P.T, w = P.host.clientWidth, h = P.host.clientHeight, zF = g.T / 2 + (d.frame === "gerefti" ? CASE_T : 0);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    function Pt(x, y, z){ var v = new T.Vector3(x, y, z).project(P.cam); return { x:(v.x + 1) / 2 * w, y:(1 - v.y) / 2 * h, off:v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02 }; }
    var off = d.frame === "gerefti" ? CASE_W + 0.08 : 0.12;
    var lines = [
      { key:"widthMm", a:Pt(-g.W / 2, g.H + off, zF), b:Pt(g.W / 2, g.H + off, zF), mm:d.widthMm },
      { key:"heightMm", a:Pt(-g.W / 2 - off, 0, zF), b:Pt(-g.W / 2 - off, g.H, zF), mm:d.heightMm },
      { key:"wallMm", a:Pt(g.cutX + 0.003, g.H * 0.62, -g.T / 2), b:Pt(g.cutX + 0.003, g.H * 0.62, g.T / 2), mm:d.wallMm, label:P.view.wallLabel || "" } // across the cut wall's bare end
    ];
    var editing = sec === "mal";
    svg.innerHTML = lines.map(function(l){
      var active = editing && (P.view.focus === l.key || !P.view.focus && !(P.view.done || {})[l.key]), fixed = picked.mal || (P.view.done || {})[l.key];
      if (!active && !fixed) return "";
      var col = active ? "#0058a3" : "#2b2b2e", sw = active ? 2.4 : 1.4;
      var dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 6, ny = dx / L * 6, mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
      if (l.a.off || l.b.off) return "";
      if (l.key === "wallMm" && !(P.door.userData.cutOn)) return ""; // only while the wall is shown cut
      var txt = (l.label ? l.label + " " : "") + ((P.view.entered || {})[l.key] === false ? "?" : P.fmt(l.mm)) + " " + P.unit, tw = txt.length * 7.4 + 14;
      if (L < 34 || l.key === "wallMm"){ // the wall thickness: ticks on the wall's faces, arrows from outside, the pill beside it with a leader
        var ux = dx / L, uy = dy / L, ext = 16, px = mx + tw / 2 + 26, py = my - 30;
        return '<line x1="' + (l.a.x - ux * ext) + '" y1="' + (l.a.y - uy * ext) + '" x2="' + (l.b.x + ux * ext) + '" y2="' + (l.b.y + uy * ext) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
          [[l.a, -1], [l.b, 1]].map(function(q){ var p = q[0], o = q[1], tx = p.x + ux * o * 7, ty = p.y + uy * o * 7;
            return '<line x1="' + (p.x - nx * 1.4) + '" y1="' + (p.y - ny * 1.4) + '" x2="' + (p.x + nx * 1.4) + '" y2="' + (p.y + ny * 1.4) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
              '<path d="M' + p.x + ' ' + p.y + 'L' + (tx + nx * 0.6) + ' ' + (ty + ny * 0.6) + 'L' + (tx - nx * 0.6) + ' ' + (ty - ny * 0.6) + 'Z" fill="' + col + '"/>'; }).join("") +
          '<line x1="' + mx + '" y1="' + my + '" x2="' + (px - tw / 2) + '" y2="' + py + '" stroke="' + col + '" stroke-width="1"/>' +
          '<rect x="' + (px - tw / 2) + '" y="' + (py - 11) + '" width="' + tw + '" height="22" rx="11" fill="' + (active ? col : "#fff") + '" stroke="' + col + '" stroke-width="1"/>' +
          '<text x="' + px + '" y="' + (py + 4.5) + '" text-anchor="middle" font-size="12.5" font-weight="700" font-family="inherit" fill="' + (active ? "#fff" : col) + '">' + txt + '</text>';
      }
      return '<line x1="' + l.a.x + '" y1="' + l.a.y + '" x2="' + l.b.x + '" y2="' + l.b.y + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
        [l.a, l.b].map(function(p){ return '<line x1="' + (p.x - nx) + '" y1="' + (p.y - ny) + '" x2="' + (p.x + nx) + '" y2="' + (p.y + ny) + '" stroke="' + col + '" stroke-width="' + sw + '"/>'; }).join("") +
        '<rect x="' + (mx - tw / 2) + '" y="' + (my - 11) + '" width="' + tw + '" height="22" rx="11" fill="' + (active ? col : "#fff") + '" stroke="' + col + '" stroke-width="1"/>' +
        '<text x="' + mx + '" y="' + (my + 4.5) + '" text-anchor="middle" font-size="12.5" font-weight="700" font-family="inherit" fill="' + (active ? "#fff" : col) + '">' + txt + '</text>';
    }).join("");
  }
  // a still picture of a door for the list (same renderer, its own scene) → data URL, cached per door look
  var THUMBS = {};
  function thumb(d, look, wPx, hPx){
    var T = root.__THREE__; if (!T) return null;
    var key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, d.hwColor, lookKey(look), wPx, hPx]);
    if (THUMBS[key]) return THUMBS[key];
    var tex = texFor(T, look), pending = !!(look && look.img && !tex);
    var r = renderer(T), scene = makeScene(T), door = buildDoor(T, d, look ? Object.assign({}, look, { tex:tex }) : null); scene.add(door);
    var g = door.userData.g, asp = wPx / hPx, cam = new T.PerspectiveCamera(30, asp, 0.02, 40);
    var vH = 15 * Math.PI / 180, hH = Math.atan(Math.tan(vH) * asp), cw = (g.slide ? g.W * 2 : g.W) + 0.32, dist = Math.max((g.H + 0.22) / 2 / Math.tan(vH), cw / 2 / Math.tan(hH)) * 1.02;
    cam.position.set(dist * 0.16, g.H * 0.55, g.T / 2 + dist); cam.lookAt(0, g.H / 2 + 0.02, g.T / 2); // the door filling the picture, a touch from the side
    var prev = new T.Vector2(); r.getSize(prev);
    r.setSize(wPx * 2, hPx * 2, false);
    var pr = r.getPixelRatio(); r.setPixelRatio(1); r.setSize(wPx * 2, hPx * 2, false);
    var comp = makeComposer(T, scene, cam, wPx * 2, hPx * 2); // the same soft AO as the popup
    if (comp) comp.render(); else r.render(scene, cam);
    var url = r.domElement.toDataURL("image/jpeg", 0.85);
    if (comp && comp.dispose) try{ comp.dispose(); }catch(e){}
    disposeTree(scene);
    r.setPixelRatio(pr);
    if (P){ r.setSize(prev.x, prev.y, false); P.size = ""; } // the open preview sizes itself again on its next frame
    if (!pending) THUMBS[key] = url; // a texture still loading: render again when it's in (onTexture)
    return url;
  }

  root.KPDOORS = { KINDS:KINDS, KIND_OPTS:KIND_OPTS, OPT_TEXT:OPT_TEXT, HW_COLORS:HW_COLORS, LIMITS:LIMITS, LIMITS_PRO:LIMITS_PRO, ROOMS:ROOMS, OTHER:OTHER,
    CNC_DEFAULT:CNC_DEFAULT, CNC_AUTO:CNC_AUTO, TOPP:TOPP, CNC_LIMITS:CNC_LIMITS, PRO_HW:PRO_HW, migrate:migrate, cncOf:cncOf,
    kindKey:kindKey, kindDef:kindDef, isSlide:isSlide, isGlass:isGlass, hasLeafMat:hasLeafMat, hasHandle:hasHandle,
    sections:sections, optValue:optValue, setKind:setKind, roomLabelOf:roomLabelOf, roomOk:roomOk, choicesText:choicesText, lineFor:lineFor,
    HW:HW, hardwareOf:hardwareOf, preview:preview, thumb:thumb, _p:function(){ return P; } };
})(typeof window !== "undefined" ? window : globalThis);
