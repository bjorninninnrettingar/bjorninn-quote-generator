// kitchen-planner-pocket.js — pocket-door (vasahurð) rules: Blum REVEGO + Hawa Concepta III / Folding Concepta III.
// Pure maths, no DOM, no THREE (window.KPPOCKET; tests/kp-pocket.test.js). Round 1, 2026-10-30; spec: docs/spec-pocket-doors-2026-10-30.md.
// The pocket sits INSIDE the cabinet's installation width (Blum: uno 100 mm, duo 150 mm of the width; Hawa: connector
// 55 mm for one door, 110 mm for two). Everything is in mm, x from the cabinet's left edge as seen from the front.
(function(root){
  "use strict";
  // EN version (kitchen-planner-i18n.js): display strings go through __(); standalone (tests) it just fills {placeholders}
  var __ = root.__ || function(s, v){ return v ? String(s).replace(/\{(\w+)\}/g, function(m, n){ return Object.prototype.hasOwnProperty.call(v, n) ? v[n] : m; }) : s; };

  var SYSTEMS = {
    revego:   { label:"Blum REVEGO", short:"REVEGO" },
    concepta: { label:"Hawa Concepta III", short:"Concepta III" }
  };
  // ---- editable constants (named so they are easy to change when the owner has the exact numbers) ----
  var BLUM_POCKET_MM = { uno:100, duo:150 };            // Blum overview p.4–16: fixed pocket widths, inside the installation width
  var HAWA_CONNECTOR_MM = { one:55, two:110 };           // Hawa catalog: connector set for one / two doors — TO BE CONFIRMED in the Hawa configurator
  var HAWA_FOLD_EXTRA_MM = 0;                            // extra room the folded doors need in front when open, beyond the leaf itself — NOT KNOWN yet: comes from the Hawa configurator
  var GAP_MM = 2;                                        // joint between a full-overlay front and its neighbour (mm per side)
  var DOOR_T_MM = 20;                                    // drawn door thickness (Blum 18–26)
  var PARTITION_T_MM = 16;                               // the pocket's inner board

  var LIMITS = {
    revego:   { unoEB:[450, 900], duoEB:[900, 1500], leafFB:[442, 898], duoLeafFB:[442, 748], bodyH:[1155, 3012], doorH:[1130, 2980], depthMin:573, pocketDepthMin:553, maxKg:35 },
    concepta: { leafW:[350, 750], doorH:[600, 2700], foldDoorH:[1200, 2700], baseSetMaxH:2200, depthMin:414 }
  };

  // installation width (EB) of a whole version, from Blum's overview tables (p.12–16)
  var TOTAL_EB = { uno:[450, 900], unouno:[900, 1800], duo:[900, 1500], unoduo:[1350, 2400], duoduo:[1800, 3000] };
  // Units: the pocket's own width and how many leaves go into it.
  var UNIT = {
    uno:   { leaves:1, pocketMm:BLUM_POCKET_MM.uno, name:"uno" },
    duo:   { leaves:2, pocketMm:BLUM_POCKET_MM.duo, name:"duo" },
    one:   { leaves:1, pocketMm:HAWA_CONNECTOR_MM.one, name:"1 hurð" },
    fold2: { leaves:2, pocketMm:HAWA_CONNECTOR_MM.two, name:"2 hurðir (felli)", fold:true }
  };
  // Versions in card order. units[0]'s pocket is on `pocketSide`, units[1]'s on the opposite end.
  var VERSIONS = {
    revego: [
      { key:"uno",    label:"REVEGO uno",          sub:"1 hurð",              units:["uno"] },
      { key:"unouno", label:"REVEGO uno + uno",    sub:"2 stakar hurðir",     units:["uno", "uno"] },
      { key:"duo",    label:"REVEGO duo",          sub:"2 hurðir saman",      units:["duo"] },
      { key:"unoduo", label:"REVEGO uno + duo",    sub:"1 hurð + 2 hurðir",   units:["uno", "duo"] },
      { key:"duoduo", label:"REVEGO duo + duo",    sub:"2 × 2 hurðir",        units:["duo", "duo"] }
    ],
    concepta: [
      { key:"c1",     label:"1 hurð",              sub:"Concepta III",        units:["one"] },
      { key:"c2x1",   label:"2 × 1 hurð",          sub:"Concepta III",        units:["one", "one"] },
      { key:"f2",     label:"2 hurðir, felli",     sub:"Folding Concepta III", units:["fold2"] },
      { key:"f2x2",   label:"2 × 2 hurðir, felli", sub:"Folding Concepta III", units:["fold2", "fold2"] },
      { key:"f2p1",   label:"2 hurðir felli + 1",  sub:"Folding + Concepta III", units:["fold2", "one"] }
    ]
  };

  function versionDef(sys, ver){ var l = VERSIONS[sys] || VERSIONS.revego; for (var i = 0; i < l.length; i++) if (l[i].key === ver) return l[i]; return null; }
  function versionsOf(sys){ return (VERSIONS[sys] || VERSIONS.revego).slice(); }
  function sysOf(spec){ return spec && spec.pocketSys === "concepta" ? "concepta" : "revego"; }

  // The version an old / unset spec means: Revego uno up to 900, duo 900–1500, uno+uno above; Hawa 1 door up to 750, then 2 × 1.
  function defaultVer(sys, widthMm){
    if (sys === "concepta") return widthMm <= 752 ? "c1" : "c2x1";
    return widthMm <= 900 ? "uno" : widthMm <= 1500 ? "duo" : "unouno";
  }
  // a stored pocketVer that belongs to the other system (or is unknown) falls back to the width default
  function verOf(spec, widthMm){
    var sys = sysOf(spec);
    return spec && spec.pocketVer && versionDef(sys, spec.pocketVer) ? spec.pocketVer : defaultVer(sys, widthMm);
  }
  // `ver` of the other system → the closest one here (card clicks never need this, saved drafts and the system switch do)
  var CLOSEST = { uno:"c1", unouno:"c2x1", duo:"f2", duoduo:"f2x2", unoduo:"f2p1", c1:"uno", c2x1:"unouno", f2:"duo", f2x2:"duoduo", f2p1:"unoduo" };
  function closestVer(sys, ver){ if (versionDef(sys, ver)) return ver; var m = CLOSEST[ver]; return m && versionDef(sys, m) ? m : null; }

  // ---- geometry ----
  // dims: { widthMm, bodyMm, depthMm }. spec: { pocketSys, pocketVer, pocketSide, toeKick, onWorktop }.
  // Returns the layout in mm. `defaultSide` is where the pocket goes when the spec has none (the old hinge side).
  function resolve(spec, dims, defaultSide){
    spec = spec || {};
    var sys = sysOf(spec), W = Math.round(dims.widthMm), ver = verOf(spec, W), def = versionDef(sys, ver);
    var side = spec.pocketSide === "left" || spec.pocketSide === "right" ? spec.pocketSide : (defaultSide === "right" ? "right" : "left");
    var other = side === "left" ? "right" : "left";
    var units = def.units.map(function(k, i){ var u = UNIT[k]; return { kind:k, leaves:u.leaves, pocketMm:u.pocketMm, fold:!!u.fold, pocketSide:i === 0 ? side : other }; });
    var nLeaves = units.reduce(function(s, u){ return s + u.leaves; }, 0), widths;
    if (units.length === 1) widths = [W];
    else if (sys === "revego" && units[0].kind !== units[1].kind){ // uno + duo: leaves as equal as the table lets them be
      var uno = Math.min(LIMITS.revego.unoEB[1], Math.max(W - LIMITS.revego.duoEB[1], Math.min(Math.round(W / 3), LIMITS.revego.unoEB[1])));
      widths = units[0].kind === "uno" ? [uno, W - uno] : [W - uno, uno];
    } else { // equal leaves (Hawa 2 + 1 as well)
      var per = W / nLeaves; widths = units.map(function(u){ return Math.round(per * u.leaves); }); widths[widths.length - 1] = W - widths.slice(0, -1).reduce(function(s, x){ return s + x; }, 0);
    }
    // unit 0 sits at the pocketSide end, unit 1 at the other: lay them out left → right
    var order = units.length === 1 ? [0] : side === "left" ? [0, 1] : [1, 0], x = 0, leaves = [], pockets = [];
    order.forEach(function(ui){
      var u = units[ui], uw = widths[ui], lw = uw / u.leaves;
      u.x0 = x; u.x1 = x + uw; u.widthMm = uw; u.leafMm = Math.round((lw - GAP_MM) * 10) / 10;
      var px0 = u.pocketSide === "left" ? u.x0 : u.x1 - u.pocketMm;
      u.pocket = { x0:px0, x1:px0 + u.pocketMm, side:u.pocketSide };
      pockets.push(u.pocket);
      for (var k = 0; k < u.leaves; k++){ // leaf 0 is the one next to the pocket
        var li = u.pocketSide === "left" ? k : u.leaves - 1 - k;
        leaves.push({ x0:u.x0 + li * lw, x1:u.x0 + (li + 1) * lw, w:lw, hinge:u.pocketSide, unit:ui, order:k, fold:u.fold });
      }
      x += uw;
    });
    leaves.sort(function(a, b){ return a.x0 - b.x0; });
    pockets.sort(function(a, b){ return a.x0 - b.x0; });
    var pocketTotal = pockets.reduce(function(s, p){ return s + (p.x1 - p.x0); }, 0), depth = dims.depthMm || 0;
    var res = { sys:sys, ver:ver, label:def.label, units:units, leaves:leaves, pockets:pockets, side:side, widthMm:W, bodyMm:dims.bodyMm || 0, depthMm:depth,
      pocketTotal:pocketTotal, innerMm:W - pocketTotal, toeKick:spec.toeKick !== false && !spec.onWorktop, onWorktop:!!spec.onWorktop,
      openings:[], folding:units.some(function(u){ return u.fold; }) };
    // the clear opening(s): what is left of the width between the pockets
    var cur = 0; pockets.forEach(function(p){ if (p.x0 > cur) res.openings.push([cur, p.x0]); cur = Math.max(cur, p.x1); }); if (cur < W) res.openings.push([cur, W]);
    res.protrudeMm = protrusion(res);
    return res;
  }
  // how far the widest open door stands out in front of the cabinet (door lengthways in the pocket, pushed to the back)
  function protrusion(res){
    var pd = Math.max(0, (res.depthMm || 0) - 40), widest = 0; // the pocket is as deep as the carcass (front 20 mm + back)
    res.leaves.forEach(function(l){ widest = Math.max(widest, l.w - GAP_MM); });
    return Math.max(0, Math.round(widest - pd + (res.folding ? HAWA_FOLD_EXTRA_MM : 0)));
  }
  // 1 | 2 for POCKET_PRODUCTS (uno / duo; a Hawa single door is "uno", two doors folding "duo"); two-unit versions order the bigger one
  function leafOf(res){ return res.units.some(function(u){ return u.leaves === 2; }) ? "duo" : "uno"; }

  // ---- limits → messages (Icelandic). level: "err" stops Smíða, "warn" is yellow, "info" is a note ----
  function validate(res, opts){
    var out = [], L = LIMITS[res.sys], W = res.widthMm, H = res.bodyMm, D = res.depthMm;
    function add(level, text){ out.push({ level:level, text:text }); }
    if (res.sys === "revego"){
      var tot = TOTAL_EB[res.ver], single = res.units.length === 1, u0 = res.units[0], fbMax = u0.kind === "duo" ? L.duoLeafFB[1] : L.leafFB[1];
      if (W < tot[0] - 0.5) add("err", __("Skápurinn er of mjór fyrir {sys} (lágmark {n} mm)", { sys:res.label, n:tot[0] }));
      else if (W > tot[1] + 0.5) add("err", single ? __("Hurðin er of breið fyrir {sys} (hámark {n} mm)", { sys:res.label, n:fbMax }) : __("Skápurinn er of breiður fyrir {sys} (hámark {n} mm)", { sys:res.label, n:tot[1] }));
      else if (res.units.some(function(u){ var r = u.kind === "duo" ? L.duoEB : L.unoEB; return u.widthMm < r[0] - 0.5 || u.widthMm > r[1] + 0.5; })) add("err", __("Breiddin skiptist ekki rétt milli hurðanna í {sys} — breyttu breiddinni", { sys:res.label }));
      var minH = res.onWorktop ? L.doorH[0] : L.bodyH[0];
      if (H && H < minH) add("err", res.onWorktop ? __("Framhliðin er of lág fyrir REVEGO (lágmark {n} mm)", { n:L.doorH[0] }) : __("Skápurinn er of lágur fyrir REVEGO (lágmark {n} mm)", { n:L.bodyH[0] }));
      else if (H && H > L.bodyH[1]) add("err", __("Skápurinn er of hár fyrir REVEGO (hámark {n} mm)", { n:L.bodyH[1] }));
      if (D && D < L.depthMin) add("err", __("Skápurinn er of grunnur fyrir REVEGO (lágmark {n} mm)", { n:L.depthMin }));
    } else {
      var sizeErr = false;
      res.leaves.forEach(function(l, i){
        var lw = l.w - GAP_MM;
        if (i && sizeErr) return;
        if (lw > L.leafW[1] + 0.05) { sizeErr = true; add("err", __("Hurðin er of breið fyrir Concepta III (hámark {n} mm)", { n:L.leafW[1] })); }
        else if (lw < L.leafW[0] - 0.05) { sizeErr = true; add("err", __("Hurðin er of mjó fyrir Concepta III (lágmark {n} mm)", { n:L.leafW[0] })); }
      });
      var hr = res.folding ? L.foldDoorH : L.doorH, nm = res.folding ? "Folding Concepta III" : "Concepta III";
      if (H && H < hr[0]) add("err", __("Hurðin er of lág fyrir {sys} (lágmark {n} mm)", { sys:nm, n:hr[0] }));
      else if (H && H > hr[1]) add("err", __("Hurðin er of há fyrir {sys} (hámark {n} mm)", { sys:nm, n:hr[1] }));
      else if (H && H > L.baseSetMaxH) add("warn", __("Hurð yfir {n} mm þarf stærra sett — staðfestu við birgi", { n:L.baseSetMaxH }));
      if (D && D < L.depthMin) add("err", __("Skápurinn er of grunnur fyrir Concepta III (lágmark {n} mm)", { n:L.depthMin }));
    }
    if (opts && opts.neighbourSwing) add("warn", __("Hurð nágranna opnast yfir vasann"));
    return out;
  }
  function firstError(res){ var v = validate(res).filter(function(x){ return x.level === "err"; }); return v.length ? v[0].text : null; }

  // ---- words ----
  function mm(n){ return Math.round(n) + " mm"; }
  // "Vasinn tekur 100 mm af 600 mm. Innanmál: 500 mm" (+ what the open doors need in front)
  function spaceText(res){
    var P = res.pockets, first = P[0], n = P.length;
    var v = { a:n === 1 ? mm(first.x1 - first.x0) : P.map(function(p){ return mm(p.x1 - p.x0); }).join(" + "), b:mm(res.widthMm), c:mm(res.innerMm), p:mm(res.protrudeMm) };
    var line1 = n === 1 ? __("Vasinn tekur {a} af {b}. Innanmál: {c}", v) : __("Vasarnir taka {a} af {b}. Innanmál: {c}", v);
    var est = " " + __("(áætlun — nákvæmt mál kemur úr Hawa-stillinum)"), line2;
    if (res.folding) line2 = res.protrudeMm > 0 ? __("Fellihurðirnar þurfa um {p} fyrir framan skápinn þegar þær eru opnaðar", v) + est : __("Fellihurðirnar rúmast í vasanum þegar þær eru opnaðar") + est;
    else line2 = res.protrudeMm > 0 ? __("Opin hurð stendur um {p} fram fyrir skápinn", v) : __("Opin hurð rúmast í vasanum");
    return [line1, line2];
  }
  // "REVEGO uno · vasi hægri · 100 mm" (chips, Yfirlit)
  function summary(res){
    var s = res.units.length === 1 ? (res.side === "left" ? __("vasi vinstri") : __("vasi hægri")) : __("vasar báðum megin");
    return res.label + (res.sys === "concepta" ? " (Hawa)" : "") + " · " + s + " · " + res.pockets.map(function(p){ return Math.round(p.x1 - p.x0); }).join(" + ") + " mm";
  }

  // ---- top-view plan symbol (SVG, true mm: the viewBox IS the cabinet) ----
  // W × D with the wall at the top, front at the bottom; pockets grey, closed doors a thick line on the front, the open
  // position dashed inside the pocket and sticking out past the front. opts.mini: no dimension text.
  function planSvg(res, opts){
    opts = opts || {};
    var W = res.widthMm, D = res.depthMm || 600, out = Math.max(res.protrudeMm, 0), m = 40, t = DOOR_T_MM, ox = -m, oy = -m, vw = W + 2 * m, vh = D + out + 2 * m + (opts.mini ? 0 : 0);
    var s = '<svg viewBox="' + ox + " " + oy + " " + vw + " " + vh + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + D + '" fill="#f4f1ea" stroke="#6d675e" stroke-width="6"/>';
    res.pockets.forEach(function(p){ s += '<rect x="' + p.x0 + '" y="0" width="' + (p.x1 - p.x0) + '" height="' + D + '" fill="#b9b4a9" stroke="#6d675e" stroke-width="4"/>'; });
    res.leaves.forEach(function(l){ // closed: a slab on the front line, a hair apart from its neighbours
      s += '<rect x="' + (l.x0 + GAP_MM / 2) + '" y="' + (D - t) + '" width="' + (l.w - GAP_MM) + '" height="' + t + '" fill="#2f2c28"/>';
    });
    res.units.forEach(function(u){ // open: the doors turned 90° and pushed back into their pocket
      var p = u.pocket, pw = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      for (var k = 0; k < u.leaves; k++){
        var dx = cx + (k - (u.leaves - 1) / 2) * (t + 4), lw = u.leafMm, y0 = PARTITION_T_MM / 2 + 4;
        s += '<rect x="' + (dx - t / 2) + '" y="' + y0 + '" width="' + t + '" height="' + lw + '" fill="none" stroke="#c0552e" stroke-width="5" stroke-dasharray="22 14"/>';
      }
      // arrow: from the front of the door slot into the pocket
      s += '<path d="M' + cx + " " + (D + 28) + "V" + (D - 6) + '" stroke="#c0552e" stroke-width="7" fill="none" marker-end="none"/>';
    });
    if (out > 0) s += '<line x1="0" y1="' + D + '" x2="' + W + '" y2="' + D + '" stroke="#c0552e" stroke-width="3" stroke-dasharray="10 10" opacity=".5"/>';
    return s + "</svg>";
  }

  var API = {
    SYSTEMS:SYSTEMS, LIMITS:LIMITS, VERSIONS:VERSIONS, UNIT:UNIT, BLUM_POCKET_MM:BLUM_POCKET_MM, HAWA_CONNECTOR_MM:HAWA_CONNECTOR_MM, HAWA_FOLD_EXTRA_MM:HAWA_FOLD_EXTRA_MM,
    GAP_MM:GAP_MM, DOOR_T_MM:DOOR_T_MM, PARTITION_T_MM:PARTITION_T_MM,
    versionsOf:versionsOf, versionDef:versionDef, defaultVer:defaultVer, verOf:verOf, closestVer:closestVer, sysOf:sysOf,
    resolve:resolve, validate:validate, firstError:firstError, spaceText:spaceText, summary:summary, leafOf:leafOf, planSvg:planSvg
  };
  root.KPPOCKET = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
