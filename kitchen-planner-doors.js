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
    hurd:{ lamir:["innfelldar", "samloku"], throskuldur:["nei", "ja"], skra:["jnf", "segul"] },
    gler:{ lamir:["innfelldar", "samloku"], throskuldur:["nei", "ja"] },
    renni:{ braut:["loft", "vegg", "magic"] },
    glerrenni:{ braut:["loft", "vegg"] },
    eld:{ flokkur:["ei30", "ei60"] },
    karmur:{ karmur:["innf", "gerefti"] }
  };
  // plain words, a line under each — no trade names in the customer's steps
  var OPT_TEXT = {
    lamir:{ label:"Lamir", vals:{ innfelldar:["Faldar lamir", "Sjást ekki þegar hurðin er lokuð"], samloku:["Sýnilegar lamir", "Hefðbundnar lamir á kantinum"] } },
    throskuldur:{ label:"Felliþröskuldur", vals:{ nei:["Venjulegt bil", "Lítið bil við gólfið"], ja:["Þétting sem fellur niður", "Lokar bilinu þegar hurðin lokast — hljóð og trekkur"] } },
    skra:{ label:"Skrá", vals:{ jnf:["Venjuleg skrá", "Smella og lás"], segul:["Hljóðlát skrá", "Segull í stað smellu — lokast hljóðlaust"] } },
    braut:{ label:"Brautin", vals:{ loft:["Braut í loftinu", "Fest upp í loft"], vegg:["Braut á veggnum", "Með hlíf yfir brautinni"], magic:["Falin braut", "Brautin sést ekki"] } },
    flokkur:{ label:"Brunavörn", vals:{ ei30:["30 mínútur", "Algengast innan íbúðar"], ei60:["60 mínútur", "T.d. milli íbúðar og stigagangs"] } },
    karmur:{ label:"Karmurinn", vals:{ innf:["Sléttur við vegginn", "Enginn listi í kringum"], gerefti:["Með listum í kringum", "Gerefti hylja samskeytin"] } }
  };
  var HUNAR = { ja:["Já, takk", "Söluaðili ráðleggur þér um húna"], nei:["Nei, ég vel sjálf/ur", "Þú útvegar húnana sjálf/ur"] };
  // exact numbers only (user: people must be precise here) — cm in the inputs, mm inside
  var LIMITS = { widthMm:[500, 2500], heightMm:[1500, 3000], wallMm:[50, 400] };

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
    if (!hasHandle(d)) delete d.hunar;
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
      if (t && t.vals[v]) out.push(t.label + ": " + t.vals[v][0].toLowerCase());
    });
    if (hasHandle(d) && d.hunar) out.push(d.hunar === "ja" ? "Húnar: viðskiptavinur vill húna frá okkur — söluaðili ráðleggur" : "Húnar: viðskiptavinur velur sjálf/ur");
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
      (d.qty > 1 ? " " + d.qty + " eins hurðir." : "") + (d.note ? " " + d.note : "") + " Staðfestu mál karms á staðnum.";
    var opt = {}; Object.keys(optsOf(d)).forEach(function(k){ opt[k] = optValue(d, k); });
    return { "Rými 🏡":room, "Magn":Math.max(1, d.qty | 0), "🔑":d.hu, "Vöru reitur 1":[ctx.pid], "Skilaboð til skipulags":msg,
      "Smíðagögn (JSON) 🔧":JSON.stringify({ v:1, w:d.widthMm, h:d.heightMm, d:d.wallMm, door:{ widthMm:d.widthMm, heightMm:d.heightMm, wallMm:d.wallMm,
        swing:slide ? "slide" : "toward", hinge:d.hinge, din:slide || d.kind === "karmur" ? undefined : d.hinge, kind:d.kind,
        frame:d.kind === "hurd" || d.kind === "karmur" ? (d.frame || "innf") : undefined, opt:opt, hunar:hasHandle(d) ? d.hunar || undefined : undefined,
        room:roomLabelOf(d) || undefined,
        leaf:mat ? { look:d.leaf, label:mat.label, efnislistiId:mat.efnislistiId || null, type:matType } : undefined } }) };
  }

  // ---------------------------------------------------------------- 3D
  var M = 0.001, JAMB = 0.022, CASE_W = 0.07, CASE_T = 0.012, GAP = 0.003, FLOOR_GAP = 0.008, HANDLE_Y = 1.05;
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
  function steel(T){ return mat(T, { color:0xb9bcc0, metalness:0.85, roughness:0.32 }); }

  // --- hardware: one function per item. ctx = { T, d, g, leafMat, frameMat }. Returns an Object3D in the door frame
  // (hinge parts are added to the swinging leaf group, whose origin is the hinge line at the front face).
  function hingeYs(g){ var ys = [0.22, g.leafH - 0.25]; if (g.leafH > 2.15) ys.splice(1, 0, g.leafH * 0.55); return ys; }
  var HW = {
    // faldar lamir: in the edge of the leaf and the jamb — only a dark slot shows when the door is open
    hinge_hidden:function(c){ var T = c.T, grp = new T.Group(), m = mat(T, { color:0x5d6166, metalness:0.6, roughness:0.4 });
      hingeYs(c.g).forEach(function(y){ grp.add(box(T, 0.004, 0.12, 0.028, m, 0, FLOOR_GAP + y, -c.g.leafT / 2)); }); return grp; },
    // sýnilegar lamir: barrels on the hinge line, proud of the face
    hinge_visible:function(c){ var T = c.T, grp = new T.Group(), m = steel(T);
      hingeYs(c.g).forEach(function(y){ var b = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.1, 20), m); b.position.set(0, FLOOR_GAP + y, 0.004); b.castShadow = true; grp.add(b); }); return grp; },
    // þétting sem fellur niður: a grey seal along the bottom of the leaf, down on the floor when closed
    threshold_drop:function(c){ var T = c.T; return box(T, c.g.leafW - 0.04, 0.012, 0.014, mat(T, { color:0x3c3f43, roughness:0.8 }), -c.g.s * c.g.leafW / 2, FLOOR_GAP - 0.002, -c.g.leafT / 2); },
    // skrá: the latch plate on the free edge + a key rosette on both faces (the magnetic one has a dark magnet in the strike)
    lock_standard:function(c){ return lockPart(c, false); },
    lock_magnetic:function(c){ return lockPart(c, true); },
    // húnn: a plain lever on both faces (placeholder — Björninn's own handles come later)
    handle_lever:function(c){ var T = c.T, grp = new T.Group(), m = steel(T), g = c.g, x = -g.s * (g.leafW - 0.065);
      [1, -1].forEach(function(side){
        var zf = side > 0 ? 0 : -g.leafT, dir = side;
        var rose = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.008, 28), m); rose.rotation.x = Math.PI / 2; rose.position.set(x, HANDLE_Y, zf + dir * 0.004); grp.add(rose);
        var neck = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.05, 16), m); neck.rotation.x = Math.PI / 2; neck.position.set(x, HANDLE_Y, zf + dir * 0.03); grp.add(neck);
        var lever = box(T, 0.13, 0.017, 0.017, m, x + g.s * 0.058, HANDLE_Y, zf + dir * 0.055); grp.add(lever);
      });
      return grp; },
    // rennihurð: the track above the opening — on the wall with a cover, in the ceiling, or hidden
    track_wall:function(c){ var T = c.T, g = c.g, grp = new T.Group(), m = mat(T, { color:0xd8d9db, metalness:0.5, roughness:0.35 });
      grp.add(box(T, g.W * 2 + 0.12, 0.08, 0.05, m, g.trackX || 0, g.H + 0.07, g.T / 2 + 0.025)); return grp; },
    track_ceiling:function(c){ var T = c.T, g = c.g, grp = new T.Group(), m = mat(T, { color:0xd8d9db, metalness:0.5, roughness:0.35 });
      grp.add(box(T, g.W * 2 + 0.12, 0.035, 0.06, m, g.trackX || 0, g.H + 0.045, g.T / 2 + 0.035)); return grp; },
    track_hidden:function(c){ var T = c.T, g = c.g; return box(T, g.W * 2 + 0.12, 0.02, 0.03, mat(T, { color:0x9a9ca0, metalness:0.6 }), g.trackX || 0, g.H + 0.03, g.T / 2 + 0.02); }
  };
  function lockPart(c, magnetic){
    var T = c.T, g = c.g, grp = new T.Group(), m = steel(T), x = -g.s * (g.leafW - 0.065);
    grp.add(box(T, 0.004, 0.24, 0.024, m, -g.s * g.leafW - g.s * 0.0005, HANDLE_Y - 0.03, -g.leafT / 2)); // forend on the edge
    [1, -1].forEach(function(side){ var r = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.006, 24), m); r.rotation.x = Math.PI / 2; r.position.set(x, HANDLE_Y - 0.085, side > 0 ? 0.003 : -g.leafT - 0.003); grp.add(r);
      var key = box(T, 0.004, 0.016, 0.002, mat(T, { color:0x222222 }), x, HANDLE_Y - 0.085, side > 0 ? 0.0065 : -g.leafT - 0.0065); grp.add(key); });
    if (magnetic) grp.add(box(T, 0.003, 0.05, 0.016, mat(T, { color:0x1d1f22, metalness:0.3 }), -g.s * g.leafW - g.s * 0.002, HANDLE_Y, -g.leafT / 2));
    return grp;
  }
  // real models (later): window.KPMODELS.doorHardware[key] = { file:"models/doors/<key>.glb", scale?:1, rot?:[x,y,z] } —
  // the model's origin is placed where the procedural part's origin is (its own frame, metres)
  var MODEL_CACHE = {};
  function hwModel(key, T){
    var e = root.KPMODELS && root.KPMODELS.doorHardware && root.KPMODELS.doorHardware[key];
    if (!e || !e.file) return null;
    var c = MODEL_CACHE[e.file];
    if (!c){
      c = MODEL_CACHE[e.file] = { state:"loading" };
      import("three/addons/loaders/GLTFLoader.js").then(function(mod){
        new mod.GLTFLoader().load(e.file, function(res){ c.obj = res.scene; c.state = "ready"; if (P) P.key = ""; /* rebuild with it */ }, undefined, function(){ c.state = "error"; });
      }).catch(function(){ c.state = "error"; });
    }
    if (c.state !== "ready") return null;
    var o = c.obj.clone(true); if (e.scale) o.scale.setScalar(e.scale); if (e.rot) o.rotation.set(e.rot[0] * Math.PI / 180, e.rot[1] * Math.PI / 180, e.rot[2] * Math.PI / 180);
    return o;
  }
  // where a real model goes (its own origin): one per hinge on the hinge line at the front face; the threshold at the
  // leaf's bottom centre; lock + handle at the spindle on the front face (the model has both sides); a track at the top
  // centre of the opening on the wall face
  function hwAnchors(key, g){
    if (/^hinge_/.test(key)) return hingeYs(g).map(function(y){ return [0, FLOOR_GAP + y, 0]; });
    if (key === "threshold_drop") return [[-g.s * g.leafW / 2, FLOOR_GAP, 0]];
    if (/^lock_|^handle_/.test(key)) return [[-g.s * (g.leafW - 0.065), HANDLE_Y, 0]];
    return [[0, g.H, g.T / 2]];
  }
  function hw(key, c){
    if (!hwModel(key, c.T)) return HW[key](c);
    var grp = new c.T.Group();
    hwAnchors(key, c.g).forEach(function(a){ var m = hwModel(key, c.T); m.position.set(a[0], a[1], a[2]); if (c.g.s > 0 && /^hinge_|^lock_|^handle_/.test(key)) m.scale.x *= -1; grp.add(m); });
    return grp;
  }
  // which hardware this door has
  function hardwareOf(d){
    var out = { leaf:[], fixed:[] };
    if (isSlide(d)){ var b = optValue(d, "braut"); out.fixed.push(b === "loft" ? "track_ceiling" : b === "magic" ? "track_hidden" : "track_wall"); return out; }
    if (d.kind === "karmur") return out;
    out.leaf.push(optValue(d, "lamir") === "samloku" ? "hinge_visible" : "hinge_hidden");
    if (d.kind === "eld" || optValue(d, "throskuldur") === "ja") out.leaf.push("threshold_drop");
    out.leaf.push(optValue(d, "skra") === "segul" ? "lock_magnetic" : "lock_standard");
    out.leaf.push("handle_lever");
    return out;
  }

  function buildDoor(T, d, look){
    var g = geo(d), grp = new T.Group(), W = g.W, H = g.H, Th = g.T;
    var wallMat = mat(T, { color:0xc9c0b0, roughness:0.95 }), sideW = 0.45, Hw = Math.max(2.5, H + 0.45);
    var paint = mat(T, { color:0xf4f2ee, roughness:0.7 });
    var leafMat = look && look.color ? mat(T, { color:new T.Color(look.color), roughness:0.55 }) : mat(T, { color:0xf3f1ec, roughness:0.6 });
    if (look && look.tex){ leafMat.map = look.tex; leafMat.color = new T.Color(0xffffff); }
    var frameMat = (d.kind === "hurd" || d.kind === "eld" || d.kind === "renni") && look && look.color ? mat(T, { color:new T.Color(look.color), roughness:0.55 }) : paint; // the karmur in the leaf's colour (a texture would stretch on the thin parts)
    // the wall, cut where the opening is
    grp.add(box(T, sideW, Hw, Th, wallMat, -W / 2 - sideW / 2, Hw / 2, 0));
    grp.add(box(T, sideW, Hw, Th, wallMat, W / 2 + sideW / 2, Hw / 2, 0));
    if (Hw > H) grp.add(box(T, W, Hw - H, Th, wallMat, 0, H + (Hw - H) / 2, 0));
    g.wallEnd = W / 2 + sideW; g.wallH = Hw;
    var gerefti = (d.kind === "hurd" || d.kind === "karmur") && d.frame === "gerefti" || d.kind === "eld" && d.frame === "gerefti";
    if (!g.slide){ // karmur: lining in the opening (same face as the wall for an innfelld door)
      grp.add(box(T, JAMB, H, Th, frameMat, -W / 2 + JAMB / 2, H / 2, 0));
      grp.add(box(T, JAMB, H, Th, frameMat, W / 2 - JAMB / 2, H / 2, 0));
      grp.add(box(T, W, JAMB, Th, frameMat, 0, H - JAMB / 2, 0));
      if (gerefti) [1, -1].forEach(function(side){ var z = side * (Th / 2 + CASE_T / 2);
        grp.add(box(T, CASE_W, H + CASE_W - JAMB, CASE_T, frameMat, -W / 2 - CASE_W / 2 + JAMB, (H + CASE_W - JAMB) / 2, z));
        grp.add(box(T, CASE_W, H + CASE_W - JAMB, CASE_T, frameMat, W / 2 + CASE_W / 2 - JAMB, (H + CASE_W - JAMB) / 2, z));
        grp.add(box(T, W + 2 * CASE_W - 2 * JAMB, CASE_W, CASE_T, frameMat, 0, H - JAMB + CASE_W / 2, z));
      });
    }
    var c = { T:T, d:d, g:g, leafMat:leafMat, frameMat:frameMat }, leafGroup = null;
    if (d.kind !== "karmur"){
      var glassMat = mat(T, { color:0xcfe3ee, transparent:true, opacity:0.38, roughness:0.05, metalness:0.1 });
      leafGroup = new T.Group();
      if (g.slide){
        var lx = 0, lz = Th / 2 + 0.014 + g.leafT / 2;
        if (d.kind === "glerrenni"){ var fr = mat(T, { color:0x2f3135, metalness:0.6, roughness:0.35 });
          leafGroup.add(box(T, g.leafW, g.leafH, 0.01, glassMat, lx, g.leafH / 2, lz));
          [[g.leafW, 0.04, 0, g.leafH - 0.02], [g.leafW, 0.04, 0, 0.02], [0.04, g.leafH, -g.leafW / 2 + 0.02, g.leafH / 2], [0.04, g.leafH, g.leafW / 2 - 0.02, g.leafH / 2]].forEach(function(r){ leafGroup.add(box(T, r[0], r[1], 0.03, fr, lx + r[2], r[3], lz)); });
        } else {
          leafGroup.add(box(T, g.leafW, g.leafH, g.leafT, leafMat, lx, g.leafH / 2, lz));
          leafGroup.add(box(T, 0.022, 0.24, 0.006, steel(T), lx + (d.hinge === "left" ? -1 : 1) * (g.leafW / 2 - 0.06), HANDLE_Y, lz + g.leafT / 2 + 0.003)); // flush pull on the leading edge
        }
        leafGroup.userData.slideDir = d.hinge === "left" ? 1 : -1; // "lamir vinstra" ≙ rennur til hægri (as before)
      } else {
        var leaf = box(T, g.leafW, g.leafH, g.leafT, d.kind === "gler" ? glassMat : leafMat, -g.s * g.leafW / 2, FLOOR_GAP + g.leafH / 2, -g.leafT / 2);
        leafGroup.add(leaf);
        leafGroup.position.set(g.pivotX, 0, Th / 2);
        hardwareOf(d).leaf.forEach(function(k){ var o = hw(k, c); if (o) leafGroup.add(o); });
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
    grp.userData.leaf = leafGroup; grp.userData.g = g;
    return grp;
  }

  // ---------------------------------------------------------------- the live preview (one at a time)
  var P = null, R = null, ENV = null; // P = the open preview, R = the renderer (kept between opens)
  function renderer(T){
    if (R) return R;
    R = new T.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    R.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    if (T.ACESFilmicToneMapping){ R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 0.92; }
    R.domElement.style.width = "100%"; R.domElement.style.height = "100%"; R.domElement.style.display = "block";
    return R;
  }
  function makeScene(T){
    var scene = new T.Scene(); scene.background = new T.Color(0xf2f0eb);
    var floor = new T.Mesh(new T.PlaneGeometry(12, 12), mat(T, { color:0xb39d7e, roughness:0.85 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    scene.add(new T.HemisphereLight(0xffffff, 0xbdb4a4, 0.75));
    var key = new T.DirectionalLight(0xfff5e6, 1.1); key.position.set(2.2, 3.6, 3.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    var sc = key.shadow.camera; sc.left = -2.5; sc.right = 2.5; sc.top = 3.5; sc.bottom = -0.5; sc.near = 0.5; sc.far = 12; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key);
    var fill = new T.DirectionalLight(0xdfe8ff, 0.35); fill.position.set(-2.5, 2, 2); scene.add(fill);
    var back = new T.DirectionalLight(0xffffff, 0.25); back.position.set(0, 2, -3); scene.add(back);
    if (root.__RoomEnvironment__ && !ENV){ try{ var pm = new T.PMREMGenerator(renderer(T)); ENV = pm.fromScene(new root.__RoomEnvironment__(renderer(T)), 0.04).texture; pm.dispose(); }catch(e){ ENV = null; } }
    if (ENV) scene.environment = ENV;
    return scene;
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
      case "opnun": return { t:[0, g.H * 0.45, zF + 0.3], p:[-g.s * 0.5, g.H * 1.2, zF + whole * 1.25] };
      case "lamir": return { t:[g.pivotX * 0.8, g.H * 0.5, zF], p:[g.pivotX * 0.1 + g.s * 0.25, g.H * 0.6, zF + whole * 0.92] };
      case "throskuldur": return { t:[0, 0.06, zF + 0.05], p:[g.W * 0.32, 0.42, zF + Math.max(1.1, g.W * 1.15)] };
      case "skra": return { t:[g.freeX, HANDLE_Y - 0.03, zF + 0.1], p:[g.freeX + g.s * 0.35, HANDLE_Y + 0.2, zF + 0.95] };
      case "mal": if (focus === "wallMm") return { t:[g.W / 2 + 0.3, g.H / 2, 0], p:[g.W / 2 + 0.85 + whole * 0.55, g.H * 0.7, whole * 0.6] };
      /* falls through */
      default: return { t:[0.08, g.H / 2 + 0.05, zF], p:[whole * 0.36, g.H * 0.62, zF + whole * 0.97] };
    }
  }
  function lookKey(look){ return look ? (look.color || "") + "|" + (look.img || "") : ""; }
  var TEX = {};
  function texFor(T, look){ // a leaf texture from the swatch image, once
    if (!look || !look.img) return null;
    var t = TEX[look.img];
    if (!t){ t = TEX[look.img] = new T.TextureLoader().load(look.img, function(){ if (P) P.key = ""; }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.65, 0.75); /* Egger's raport is ~1.3 × 2.8 m: a leaf is about half of it */ if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; }
    return t.image && t.image.complete !== false && t.image.width ? t : null;
  }
  var preview = {
    // host = the element the canvas goes in, svg = the dimension-line overlay, fmt(mm) → "80" for the labels
    open:function(host, svg, fmt){
      var T = root.__THREE__; if (!T || !host) return false;
      preview.close();
      var r = renderer(T); host.innerHTML = ""; host.appendChild(r.domElement);
      var cam = new T.PerspectiveCamera(40, 1, 0.02, 40);
      P = { T:T, host:host, svg:svg, fmt:fmt || function(mm){ return Math.round(mm / 10); }, scene:makeScene(T), cam:cam, door:null, key:"", view:{}, d:null, look:null,
        camFrom:null, camTo:null, tFrom:null, tTo:null, t0:0, open:0, openTo:0, raf:0, size:"" };
      P.ctl = root.__OrbitControls__ ? new root.__OrbitControls__(cam, r.domElement) : null;
      if (P.ctl){ P.ctl.enablePan = false; P.ctl.enableZoom = false; P.ctl.enableRotate = !!(P.view && P.view.free); P.ctl.enableDamping = true; }
      cam.position.set(1, 1.4, 3.5); (function loop(){ if (!P) return; P.raf = requestAnimationFrame(loop); frame(); })();
      return true;
    },
    // d = the draft door, look = { color, img } of its leaf, view = { sec, focus:"widthMm"|…, picked:{mal:true}, free }
    set:function(d, look, view){
      if (!P) return;
      P.d = d; P.look = look; P.view = view || {};
      if (P.ctl) P.ctl.enableRotate = !!P.view.free;
      var key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, lookKey(look)]);
      if (key !== P.key) rebuild();
      var sec = P.view.sec, slide = isSlide(d);
      P.openTo = !slide && d.kind !== "karmur" && (sec === "opnun" || sec === "lamir") ? (sec === "lamir" ? 0.22 : 0.55) : slide && sec === "opnun" ? 0.45 : 0;
      if (P.door && P.door.userData.arc) P.door.userData.arc.visible = sec === "opnun";
      var aimK = JSON.stringify([sec, P.view.focus, P.size, d.widthMm, d.heightMm, d.wallMm, d.kind, d.hinge]);
      if (aimK !== P.aimK){ P.aimK = aimK; aim(!!P.aimed); P.aimed = true; }
    },
    close:function(){
      if (!P) return;
      cancelAnimationFrame(P.raf);
      if (P.ctl) P.ctl.dispose();
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
    P.key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, lookKey(look)]);
    // (the texture loader clears P.key when the picture is in, and the next frame rebuilds with it)
    setOpen(P.open);
  }
  function setOpen(k){
    var door = P.door, lg = door && door.userData.leaf; if (!lg) return;
    var g = door.userData.g;
    if (g.slide) lg.position.x = (lg.userData.slideDir || 1) * k * g.W;
    else lg.rotation.y = g.s * k * Math.PI / 2;
  }
  function aim(animate){
    var g = P.door.userData.g, a = aimFor(g, P.view.sec, P.cam.aspect, P.view.focus), T = P.T;
    P.camFrom = P.cam.position.clone(); P.tFrom = P.ctl ? P.ctl.target.clone() : new T.Vector3();
    P.camTo = new T.Vector3(a.p[0], a.p[1], a.p[2]); P.tTo = new T.Vector3(a.t[0], a.t[1], a.t[2]);
    P.t0 = animate ? performance.now() : 0;
  }
  function frame(){
    var r = R, host = P.host, w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var sz = w + "x" + h;
    if (sz !== P.size){ P.size = sz; r.setSize(w, h, false); P.cam.aspect = w / h; P.cam.updateProjectionMatrix(); P.aimK = ""; if (P.d) preview.set(P.d, P.look, P.view); }
    if (P.d && !P.key && P.door) rebuild(); // a texture / hardware model came in
    if (!P.door) return;
    if (P.camTo){ // smooth like the cabinet wizard's uwAimCamera
      var k = P.t0 ? Math.min(1, (performance.now() - P.t0) / 520) : 1, e = k * k * (3 - 2 * k);
      P.cam.position.copy(P.camFrom).lerp(P.camTo, e);
      var t = P.tFrom.clone().lerp(P.tTo, e);
      if (P.ctl) P.ctl.target.copy(t); P.cam.lookAt(t);
      if (k >= 1) P.camTo = null;
    }
    if (Math.abs(P.open - P.openTo) > 0.002){ P.open += (P.openTo - P.open) * 0.12; setOpen(P.open); }
    if (P.ctl && !P.camTo) P.ctl.update();
    r.render(P.scene, P.cam);
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
      { key:"wallMm", a:Pt(g.wallEnd + 0.06, g.wallH * 0.75, -g.T / 2), b:Pt(g.wallEnd + 0.06, g.wallH * 0.75, g.T / 2), mm:d.wallMm }
    ];
    var editing = sec === "mal";
    svg.innerHTML = lines.map(function(l){
      var active = editing && (P.view.focus === l.key || !P.view.focus && !(P.view.done || {})[l.key]), fixed = picked.mal || (P.view.done || {})[l.key];
      if (!active && !fixed) return "";
      var col = active ? "#0058a3" : "#2b2b2e", sw = active ? 2.4 : 1.4;
      var dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 6, ny = dx / L * 6, mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
      if (l.a.off || l.b.off) return "";
      var txt = ((P.view.entered || {})[l.key] === false ? "?" : P.fmt(l.mm)) + " cm", tw = txt.length * 7.4 + 14;
      if (l.key === "wallMm"){ mx += 26; } // the wall's end is short on screen: the pill sits beside it
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
    var key = JSON.stringify([d.kind, d.frame, d.widthMm, d.heightMm, d.wallMm, d.hinge, d.opt, lookKey(look), wPx, hPx]);
    if (THUMBS[key]) return THUMBS[key];
    var r = renderer(T), scene = makeScene(T), door = buildDoor(T, d, look ? { color:look.color } : null); scene.add(door);
    var g = door.userData.g, cam = new T.PerspectiveCamera(40, wPx / hPx, 0.02, 40), a = aimFor(g, null, wPx / hPx);
    cam.position.set(a.p[0] * 0.92, a.p[1], a.p[2] * 0.92); cam.lookAt(a.t[0], a.t[1], a.t[2]);
    var prev = new T.Vector2(); r.getSize(prev);
    r.setSize(wPx * 2, hPx * 2, false); r.render(scene, cam);
    var url = r.domElement.toDataURL("image/jpeg", 0.82);
    disposeTree(scene);
    if (P){ r.setSize(prev.x, prev.y, false); P.size = ""; } // the open preview sizes itself again on its next frame
    THUMBS[key] = url;
    return url;
  }

  root.KPDOORS = { KINDS:KINDS, KIND_OPTS:KIND_OPTS, OPT_TEXT:OPT_TEXT, HUNAR:HUNAR, LIMITS:LIMITS, ROOMS:ROOMS, OTHER:OTHER,
    kindKey:kindKey, kindDef:kindDef, isSlide:isSlide, isGlass:isGlass, hasLeafMat:hasLeafMat, hasHandle:hasHandle,
    sections:sections, optValue:optValue, setKind:setKind, roomLabelOf:roomLabelOf, roomOk:roomOk, choicesText:choicesText, lineFor:lineFor,
    HW:HW, hardwareOf:hardwareOf, preview:preview, thumb:thumb, _p:function(){ return P; } };
})(typeof window !== "undefined" ? window : globalThis);
