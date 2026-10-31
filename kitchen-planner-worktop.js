// kitchen-planner-worktop.js — the worktop (borðplata) as a real object in PRO, 2026-10-26.
//
// Before this the worktop was only a name (state.top → one note line). Now, per room:
//   compute(state, K)  → the pieces (one per straight counter run, split at corners), the corner joints, the cutouts
//                        (sink + tap hole over the sink unit, hob over the hob unit), edges and the back upstand.
//                        Pure: no DOM, no THREE — runs under node for tests (K = KP3D).
//   state.worktop      = ONLY what Rakel changed (sizes, joint choices, cutout moves, edges); everything else is
//                        recomputed from the cabinets, so an old project with no state.worktop loads auto-computed.
//   smida(r) / lines(r) → the Smíðagögn and Line Items PRO Vista sends (BP<n> worktop m², BV<n> sink cutouts,
//                        BH<n> hob cutouts — the same Útfærslur the office already prices worktops with by hand).
//   planSvg(r, opts)   → the plan of every piece with dims, joints and cutouts (editor + the A3 "Borðplata" sheet).
//
// Two kinds of worktop (user, 2026-10-26):
//   in-house (harðplast / compact / límtré) — CUT HERE: exact sizes, joints and cutout positions are production data.
//   stone — ordered; the stone maker measures on site: only the choice, rough size (for the quote) and which
//           sink/hob/tap go where. Joints are optional (agreed with the stone maker), cutout mm are information only.
// Joints have no default (differs per job): an unchosen joint on an in-house top is an issue (Yfirferð stops).
//
// Coordinates: each piece in its own wall frame — x along the wall (mm from the wall's start), y out from the wall
// (0 = back edge at the wall, grows towards the room). Cutouts are given from the piece's left end (as seen facing
// the wall) and from its back edge. World coordinates (for the plan) = geom.origin + axis·x + normal·y.
(function(root){
  "use strict";

  var FRONT_OV = 20;           // the worktop's front overhang (the 3D always drew depth + 20)
  var BOARD_MAX_MM = 4100;     // the longest worktop board (Egger 4100 × 600/920)
  var TAP_DIA = 35;            // tap hole Ø
  var EDGE_MARGIN = 40;        // a cutout must stay this far from every edge of an in-house piece
  // hob cutouts by hob width (standard built-in hobs; confirm against the appliance's own sheet)
  var HOB_CUT = { 300:[270, 490], 600:[560, 490], 700:[650, 490], 800:[750, 490], 900:[860, 490] };
  var JOINT_LABELS = { ska:"Skáskorið (45°)", beint:"Beint" };
  // the Útfærslur existing worktop Line Items use (Vörulisti/Útfærslur, read 2026-10-26)
  var PRODUCTS = {
    m2:   { id:"rec2hrdZTzZSKO4Gx", name:"Borðplata - Efni viðskiptavinar | m² verð" }, // Magn = m², priced on the Tækifæri's "Borðplata viðskiptavinar 🍽️"
    sink: { id:"recjwxEFkBL17Q9gW", name:"Fræsing f. vask og blöndunartæki" },          // Magn = stk
    hob:  { id:"recPElwpyIEo8inKq", name:"Fræsing f. helluborði" }                      // Magn = stk
  };

  function num(v, d){ v = Number(v); return isFinite(v) ? v : d; }
  function r10(v){ return Math.round(v / 10) * 10; }
  function letter(i){ return i < 26 ? String.fromCharCode(65 + i) : "P" + (i + 1); }

  // in-house / stone / none / unset from the room's top key
  function kindOf(K, topKey){
    if (!topKey) return "unset";
    var t = K.TOPS[topKey];
    if (!t || t.none || topKey === "engin") return "none";
    return t.group === "steinn" ? "stone" : "inhouse";
  }
  function topInfo(K, topKey){
    var t = K.TOPS[topKey] || {}, g = (K.TOP_GROUPS || []).find(function(x){ return x.key === t.group; }) || {};
    return { key:topKey || null, label:t.label || "", code:t.code || null, group:t.group || null, groupLabel:g.label || "", thick:Math.round(K.topThickM(topKey) * 1000), efnislistiId:t.efnislistiId || null };
  }

  // The counter runs of one surface: contiguous counter cabinets at the same height.
  function runsOf(K, surfs, si){
    var w = surfs[si], C = K.CATALOG, out = [];
    if (!w || w.open || !w.floor || !w.floor.length) return out;
    var clr = K.cornerClearanceMm(surfs, si, "floor"), S = K.blockStartsMm(w.floor, clr), cur = null;
    w.floor.forEach(function(b, i){
      var c = C[b.type];
      if (!c || !c.counter){ cur = null; return; }
      var h = b.heightMm || c.h, d = b.depthMm || c.d, s = S[i], e = s + b.widthMm;
      if (cur && Math.abs(cur.eRaw - s) < 2 && cur.h === h){ cur.eRaw = e; cur.d = Math.max(cur.d, d); cur.blocks.push({ b:b, c:c, s:s, i:i }); cur.lastI = i; return; }
      cur = { si:si, sRaw:s, eRaw:e, h:h, d:d, blocks:[{ b:b, c:c, s:s, i:i }], firstI:i, lastI:i, clr:clr };
      out.push(cur);
    });
    return out;
  }

  function cfgOf(state){ var w = state.worktop; return w && typeof w === "object" ? w : {}; }

  // Piece overrides are stored under "p:<first cabinet id>" (joints under "j:<pieceA>|<pieceB>"), so removing or replacing a
  // run's first cabinet used to orphan them and reset the piece to auto (PRO audit 2026-10-30 #4). Every override entry
  // therefore also remembers WHERE its piece is (surface id + run position, `at`); when its key no longer matches a piece
  // but that place has a piece without an entry, the entry moves there and the joint keys follow. Returns [{from,to,label}].
  function runKeys(state, K){
    var surfs = K.surfacesOf(state), out = [];
    surfs.forEach(function(w, si){ runsOf(K, surfs, si).forEach(function(r, i){ out.push({ id:"p:" + r.blocks[0].b.id, at:w.id + "#" + i, label:letter(out.length) }); }); });
    return out;
  }
  function reconcile(state, K){
    var cfg = state && state.worktop, moved = [];
    if (!cfg || typeof cfg !== "object" || !cfg.pieces || typeof cfg.pieces !== "object") return moved;
    var cur = runKeys(state, K), have = {};
    cur.forEach(function(c){ have[c.id] = c; var e = cfg.pieces[c.id]; if (e && typeof e === "object" && e.at !== c.at) e.at = c.at; });
    var ren = {};
    Object.keys(cfg.pieces).forEach(function(k){
      var e = cfg.pieces[k]; if (have[k] || !e || typeof e !== "object" || !e.at) return;
      var tgt = cur.find(function(c){ return c.at === e.at && !cfg.pieces[c.id]; });
      if (!tgt) return;
      cfg.pieces[tgt.id] = e; delete cfg.pieces[k]; ren[k] = tgt.id; moved.push({ from:k, to:tgt.id, label:tgt.label });
    });
    if (moved.length && cfg.joints){
      Object.keys(cfg.joints).forEach(function(jk){
        var parts = jk.replace(/^j:/, "").split("|"), np = parts.map(function(x){ return ren[x] || x; });
        if (np.join("|") !== parts.join("|")){ var v = cfg.joints[jk]; delete cfg.joints[jk]; if (!cfg.joints["j:" + np.join("|")]) cfg.joints["j:" + np.join("|")] = v; }
      });
    }
    return moved;
  }

  // ── the whole room ──
  function compute(state, K, opts){
    opts = opts || {};
    reconcile(state, K);
    var topKey = state.top || null, kind = kindOf(K, topKey), info = topInfo(K, topKey), cfg = cfgOf(state);
    var surfs = K.surfacesOf(state), geoms = K.surfaceGeoms(state), C = K.CATALOG;
    var nReal = 0; while (nReal < surfs.length && !surfs[nReal].island && !surfs[nReal].partition) nReal++;
    var runs = [];
    surfs.forEach(function(w, si){ runsOf(K, surfs, si).forEach(function(r){ runs.push(r); }); });
    var res = { kind:kind, top:info, pieces:[], joints:[], issues:[], notes:[], hobChoices:[] };
    if (!runs.length) return res;

    // ends: over an áfella / against a wall or a tall unit = "wall"; nothing there = "free"
    runs.forEach(function(r){
      var w = surfs[r.si], af = K.afellaMm(surfs, r.si, "floor"), isl = !!(w.island || w.partition);
      r.x0 = r.sRaw; r.x1 = r.eRaw;
      r.L = "free"; r.R = "free";
      if (isl){
        r.L = r.R = w.partition ? "wall" : "free";
        if (w.island){ // a tall unit (or a tall úthlið) standing against the end of an island run is a wall there, not a free end (owner, 2026-10-30)
          var iS = K.blockStartsMm(w.floor, 0), tallNb = function(b){ var c = C[b.type]; return !!c && !c.counter && (b.heightMm || c.h) > r.h + 50; };
          var pB = r.firstI > 0 ? w.floor[r.firstI - 1] : null, nB = r.lastI < w.floor.length - 1 ? w.floor[r.lastI + 1] : null;
          if (pB && tallNb(pB) && Math.abs(iS[r.firstI - 1] + pB.widthMm - r.sRaw) < 2) r.L = "wall";
          if (nB && tallNb(nB) && Math.abs(iS[r.lastI + 1] - r.eRaw) < 2) r.R = "wall";
        }
        return;
      }
      var prevB = r.firstI > 0 ? w.floor[r.firstI - 1] : null, nextB = r.lastI < w.floor.length - 1 ? w.floor[r.lastI + 1] : null;
      var S = K.blockStartsMm(w.floor, r.clr);
      if (af.start && Math.abs(r.sRaw - af.start) < 2){ r.x0 = 0; r.L = "wall"; }
      else if (r.clr > 0 && r.firstI === 0 && Math.abs(r.sRaw - r.clr) < 2) r.L = "wall";
      else if (prevB && Math.abs(S[r.firstI - 1] + prevB.widthMm - r.sRaw) < 2) r.L = "wall";
      if (af.end && Math.abs(r.eRaw - (w.lengthMm - af.end)) < 2){ r.x1 = w.lengthMm; r.R = "wall"; }
      else if (nextB && Math.abs(S[r.lastI + 1] - r.eRaw) < 2) r.R = "wall";
      else if (r.eRaw >= w.lengthMm - 2) r.R = "wall";
    });

    // pieces: one per run, lettered in surface order
    var pieces = runs.map(function(r, k){
      var w = surfs[r.si], first = r.blocks[0].b, id = "p:" + first.id, pc = (cfg.pieces || {})[id] || {};
      var isl = !!w.island, single = isl && !w.island.two;
      var p = { id:id, label:letter(k), si:r.si, surfId:w.id, wall:w.label || "", island:isl, partition:!!w.partition, h:r.h,
        x0:r.x0, x1:r.x1, d:r.d, ends:{ L:{ type:r.L }, R:{ type:r.R } }, blocks:r.blocks.map(function(x){ return x.b.id; }), _run:r, cfg:pc };
      return p;
    });
    var byRunFirst = {}; pieces.forEach(function(p){ byRunFirst[p.surfId + ":" + p._run.firstI] = p; });

    // corner joints: a 90° inward corner where the previous wall's last counter run reaches the corner and this
    // wall's first run starts right after the previous wall's cabinet depth (cornerClearanceMm)
    for (var i = 0; i < nReal; i++){
      var w = surfs[i]; if (!w || w.open) continue;
      var clr = K.cornerClearanceMm(surfs, i, "floor"); if (!clr) continue;
      var prevIdx = i > 0 ? i - 1 : (surfs.closed ? nReal - 1 : -1); if (prevIdx < 0 || prevIdx === i) continue;
      var pw = surfs[prevIdx];
      var B = pieces.find(function(p){ return p.si === i && p._run.firstI === 0; });
      var A = pieces.filter(function(p){ return p.si === prevIdx && p._run.lastI === pw.floor.length - 1; })[0];
      if (!A || !B || Math.abs(B._run.sRaw - clr) >= 2 || A.x1 < pw.lengthMm - 2 || A.h !== B.h) continue;
      var ang = pw.angleDeg != null ? pw.angleDeg : 90;
      if (ang !== 90){ res.notes.push("Horn " + A.label + "–" + B.label + " er ekki 90° (" + ang + "°) — samskeytin mæld og sniðin á staðnum."); continue; }
      var jid = "j:" + A.id + "|" + B.id, jc = (cfg.joints || {})[jid] || {};
      var type = jc.type === "ska" || jc.type === "beint" ? jc.type : null, through = type === "beint" ? (jc.through === "b" ? "b" : "a") : null;
      var J = { id:jid, a:A.id, b:B.id, aLabel:A.label, bLabel:B.label, type:type, through:through, chosen:!!type, corner:pw.label + " / " + w.label };
      res.joints.push(J);
      A.ends.R = { type:"joint", joint:jid }; B.ends.L = { type:"joint", joint:jid };
      A._jR = J; B._jL = J;
    }

    // sizes per piece (depth first: a joint needs both pieces' depths)
    pieces.forEach(function(p){
      var c = p.cfg, single = p.island && !surfs[p.si].island.two;
      p.ov = { front:Math.max(0, num(c.front, FRONT_OV)), L:p.ends.L.type === "free" ? Math.max(0, num(c.ovL, 0)) : 0, R:p.ends.R.type === "free" ? Math.max(0, num(c.ovR, 0)) : 0 };
      p.depthAuto = p.d + p.ov.front;
      p.depth = c.depthMm > 0 ? Math.round(c.depthMm) : p.depthAuto;
      p.manualDepth = c.depthMm > 0;
      var e = c.edges || {};
      p.edges = { front:e.front !== false, L:e.L != null ? !!e.L : p.ends.L.type === "free", R:e.R != null ? !!e.R : p.ends.R.type === "free", back:e.back != null ? !!e.back : single };
      var canUp = !p.island && !p.partition;
      p.upstand = { on:canUp && !!(c.upstand && c.upstand.on), h:Math.max(10, Math.min(200, num(c.upstand && c.upstand.h, 50))), allowed:canUp };
      p.note = typeof c.note === "string" ? c.note.slice(0, 300) : "";
    });
    // joints → where each piece starts/ends at the corner (an unchosen joint is drawn as "A runs through")
    res.joints.forEach(function(J){
      var A = pieces.find(function(p){ return p.id === J.a; }), B = pieces.find(function(p){ return p.id === J.b; });
      var aLen = surfs[A.si].lengthMm;
      A.x1 = aLen; B.x0 = 0; A.miterR = false; B.miterL = false;
      if (J.type === "ska"){ A.miterR = B.depth; B.miterL = A.depth; }
      else if (J.through === "b") A.x1 = aLen - B.depth;
      else B.x0 = A.depth; // through A (and the drawing of an unchosen joint)
    });
    pieces.forEach(function(p){
      var c = p.cfg;
      p.lenAuto = Math.round(p.x1 - p.x0 + p.ov.L + p.ov.R);
      p.manualLen = c.lenMm > 0;
      p.len = p.manualLen ? Math.round(c.lenMm) : p.lenAuto;
      // a manual length grows/shrinks at the free end (right unless only the left is free)
      var grow = p.len - p.lenAuto;
      p.left = p.x0 - p.ov.L - (grow && p.ends.R.type !== "free" && p.ends.L.type === "free" ? grow : 0); // the piece's left edge, wall frame
      p.right = p.left + p.len;
      p.frontLen = p.len - (p.miterR || 0) - (p.miterL || 0);
      p.m2 = (p.len * p.depth - ((p.miterR || 0) * (p.miterR || 0) + (p.miterL || 0) * (p.miterL || 0)) / 2 + (p.upstand.on ? p.len * p.upstand.h : 0)) / 1e6;
    });

    // cutouts: sink + tap hole over every sink unit, the hob over the hob unit
    var hobCfg = cfg.hob || {}, hobId;
    var counterBlocks = [];
    pieces.forEach(function(p){ p._run.blocks.forEach(function(x){ counterBlocks.push({ p:p, x:x }); }); });
    if (hobCfg.id === "") hobId = null;
    else if (hobCfg.id && counterBlocks.some(function(cb){ return cb.x.b.id === hobCfg.id; })) hobId = hobCfg.id;
    else { var lo = counterBlocks.find(function(cb){ return cb.x.c.lowOven; }); hobId = lo ? lo.x.b.id : null; }
    var hobW = HOB_CUT[hobCfg.w] ? +hobCfg.w : 600;
    res.hob = { id:hobId, w:hobW, auto:hobCfg.id === undefined };
    res.hobChoices = counterBlocks.filter(function(cb){ return !cb.x.c.panel && !cb.x.c.sink; }).map(function(cb){ return { id:cb.x.b.id, piece:cb.p.label }; });
    var cutCfg = cfg.cut || {}, mountDefault = kind === "stone" || info.group === "compact" ? "undir" : "ofan";
    pieces.forEach(function(p){
      p.cutouts = [];
      function add(o){
        var cc = cutCfg[o.id] || {};
        if (cc.off){ o.off = true; }
        o.autoX = o.x; o.autoY = o.y;
        if (cc.dx) o.x += num(cc.dx, 0);
        if (cc.dy) o.y += num(cc.dy, 0);
        o.moved = !!(cc.dx || cc.dy);
        if (o.kind === "vaskur"){ if (cc.w > 0) o.w = Math.round(cc.w); if (cc.d > 0) o.d = Math.round(cc.d); o.mount = cc.mount === "undir" || cc.mount === "ofan" ? cc.mount : mountDefault; }
        o.x = Math.round(o.x); o.y = Math.round(o.y);
        if (!o.off) p.cutouts.push(o); else (p.cutoutsOff = p.cutoutsOff || []).push(o);
      }
      p._run.blocks.forEach(function(x){
        var b = x.b, c = x.c, cx = x.s + b.widthMm / 2 - p.left, dCab = b.depthMm || c.d;
        if (c.sink){
          var sw = r10(Math.min(620, b.widthMm * 0.72)), sd = r10(Math.min(420, dCab * 0.62)), sy = Math.round(p.depth / 2 + 10);
          add({ id:"v:" + b.id, kind:"vaskur", block:b.id, x:cx, y:sy, w:sw, d:sd });
          var sink = p.cutouts[p.cutouts.length - 1] || (p.cutoutsOff || [])[(p.cutoutsOff || []).length - 1];
          add({ id:"k:" + b.id, kind:"kranagat", block:b.id, x:sink.x, y:Math.max(40, Math.round(sink.y - sink.d / 2 - 45)), dia:TAP_DIA });
        }
        if (hobId === b.id){
          var hc = HOB_CUT[hobW];
          add({ id:"h:" + b.id, kind:"helluborð", block:b.id, x:cx, y:Math.round(p.depth / 2), w:hc[0], d:hc[1], hobW:hobW });
        }
      });
    });

    // what's wrong (⛔ for an in-house top: these are production numbers)
    var inhouse = kind === "inhouse";
    res.joints.forEach(function(J){
      if (!J.chosen && inhouse) res.issues.push({ kind:"joint", ref:J.id, text:"Samskeyti " + J.aLabel + "–" + J.bLabel + " (" + J.corner + ") ekki valin — skáskorið eða beint, og hvort stykkið fer í gegn." });
    });
    pieces.forEach(function(p){
      p.cutouts.forEach(function(o){
        var hw = o.dia ? o.dia / 2 : o.w / 2, hd = o.dia ? o.dia / 2 : o.d / 2;
        var bad = o.x - hw < EDGE_MARGIN || o.x + hw > p.len - EDGE_MARGIN || o.y - hd < (o.dia ? 25 : EDGE_MARGIN) || o.y + hd > p.depth - EDGE_MARGIN;
        o.bad = bad;
        if (bad && inhouse) res.issues.push({ kind:"cutout", ref:o.id, piece:p.id, text:cutLabel(o) + " í " + p.label + " nær of nálægt brún plötunnar (minnst " + EDGE_MARGIN + " mm)." });
      });
      if (inhouse && p.len > BOARD_MAX_MM) res.notes.push(p.label + " er " + p.len + " mm — lengri en plata (" + BOARD_MAX_MM + " mm): samskeyti á beinum kafla, merktu hvar í athugasemd stykkisins.");
    });
    pieces.forEach(function(p){ delete p._run; delete p._jL; delete p._jR; });
    res.pieces = pieces;
    res.m2 = pieces.reduce(function(a, p){ return a + p.m2; }, 0);
    res.sinks = pieces.reduce(function(a, p){ return a + p.cutouts.filter(function(o){ return o.kind === "vaskur"; }).length; }, 0);
    res.hobs = pieces.reduce(function(a, p){ return a + p.cutouts.filter(function(o){ return o.kind === "helluborð"; }).length; }, 0);
    return res;
  }
  function cutLabel(o){ return o.kind === "vaskur" ? "Vaskur" : o.kind === "kranagat" ? "Kranagat" : "Helluborð"; }
  function cutText(o, skOf){
    var sk = skOf && skOf[o.block] ? " (" + skOf[o.block] + ")" : "";
    if (o.kind === "kranagat") return "Kranagat Ø" + o.dia + sk + ": " + o.x + " mm frá vinstri enda, " + o.y + " mm frá vegg";
    return cutLabel(o) + sk + (o.kind === "vaskur" ? " " + (o.mount === "undir" ? "undirlímdur" : "ofan á") : " " + (o.hobW / 10) + " cm") + ", úrtak " + o.w + " × " + o.d +
      ", miðja " + o.x + " mm frá vinstri enda, " + o.y + " mm frá vegg";
  }
  function jointText(J){
    if (!J.chosen) return J.aLabel + "–" + J.bLabel + ": ekki valið";
    return J.aLabel + "–" + J.bLabel + ": " + (J.type === "ska" ? "skáskorið 45°" : "beint, " + (J.through === "b" ? J.bLabel : J.aLabel) + " heilt í gegn");
  }
  function edgeText(p){
    var e = [];
    if (p.edges.front) e.push("framkantur");
    if (p.edges.L) e.push("vinstri endi");
    if (p.edges.R) e.push("hægri endi");
    if (p.edges.back) e.push("bakkantur");
    return e.length ? "Kantlímt: " + e.join(", ") : "Enginn kantur";
  }

  // ── what PRO Vista sends ──
  function smida(r, skOf){
    var maxLen = 0, maxD = 0;
    r.pieces.forEach(function(p){ maxLen = Math.max(maxLen, p.len); maxD = Math.max(maxD, p.depth); });
    return { v:1, w:maxLen, h:r.top.thick, d:maxD, bordplata:{
      kind:r.kind, top:{ key:r.top.key, label:r.top.label, code:r.top.code, group:r.top.group, thick:r.top.thick },
      m2:Math.round(r.m2 * 100) / 100,
      pieces:r.pieces.map(function(p){
        return { id:p.label, wall:p.wall, island:p.island || undefined, len:p.len, depth:p.depth, front:p.frontLen !== p.len ? p.frontLen : undefined,
          ends:{ L:p.ends.L.type, R:p.ends.R.type }, miter:p.miterL || p.miterR ? { L:!!p.miterL, R:!!p.miterR } : undefined,
          edges:p.edges, upstand:p.upstand.on ? { h:p.upstand.h } : undefined, note:p.note || undefined,
          cutouts:p.cutouts.map(function(o){ return { kind:o.kind, sk:skOf && skOf[o.block] || undefined, x:o.x, y:o.y, w:o.w, d:o.d, dia:o.dia, mount:o.mount, hob:o.hobW }; }) };
      }),
      joints:r.joints.map(function(J){ return { a:J.aLabel, b:J.bLabel, type:J.type, through:J.through ? (J.through === "b" ? J.bLabel : J.aLabel) : null }; }),
      info:r.kind === "stone" ? "Steinn — mál tekin af steinsmið" : undefined
    } };
  }
  // n = the room's number (BP1 / BV1 / BH1 in the first room with a worktop), room = "Rými 🏡"
  function lines(r, n, room, skOf, stonePrice){
    if (!r.pieces.length || r.kind === "none" || r.kind === "unset") return [];
    var out = [], sm = JSON.stringify(smida(r, skOf)), m2 = Math.max(1, Math.ceil(r.m2 - 1e-6));
    var dims = r.pieces.map(function(p){ return p.label + " " + p.len + "×" + p.depth; }).join(", ");
    var jt = r.joints.length ? " Samskeyti: " + r.joints.map(jointText).join("; ") + "." : "";
    var ct = []; r.pieces.forEach(function(p){ p.cutouts.forEach(function(o){ ct.push(p.label + ": " + cutText(o, skOf)); }); });
    var ups = r.pieces.filter(function(p){ return p.upstand.on; }).map(function(p){ return p.label + " " + p.upstand.h + " mm"; });
    var common = dims + " mm (" + (Math.round(r.m2 * 100) / 100).toString().replace(".", ",") + " m²)." + jt + (ups.length ? " Bakkantur upp við vegg: " + ups.join(", ") + "." : "");
    if (r.kind === "stone"){
      out.push({ "🔑":"BP" + n, "Rými 🏡":room, "Magn":m2, "Smíðagögn (JSON) 🔧":sm,
        "Skilaboð til skipulags":"Steinborðplata — " + r.top.label + ". Steinsmiður mælir og sker sjálfur; gróf stærð: " + common +
          (ct.length ? " Staðsetning: " + ct.join("; ") + "." : "") +
          (stonePrice > 0 ? " Verð frá steinsmið: " + Math.round(stonePrice).toLocaleString("is-IS") + " kr. m/vsk (slegið inn í PRO Tilboð)." : " Verð frá steinsmið vantar.") +
          " Engin steinvara í Vörulista — settu Útfærslu/verð á línuna í Airtable." });
      return out;
    }
    out.push({ "🔑":"BP" + n, "Rými 🏡":room, "Magn":m2, "Vöru reitur 1":[PRODUCTS.m2.id], "Smíðagögn (JSON) 🔧":sm,
      "Skilaboð til skipulags":"Borðplata " + r.top.label + (r.top.code ? " (Egger " + r.top.code + ")" : "") + ", " + r.top.thick + " mm, sagað hjá okkur: " + common +
        " Magn = m² námundað upp. " + r.pieces.map(function(p){ return p.label + ": " + edgeText(p).toLowerCase(); }).join("; ") + ". Sjá blaðið Borðplata í vinnuteikningum." });
    var sinks = [], hobs = [];
    r.pieces.forEach(function(p){ p.cutouts.forEach(function(o){ if (o.kind === "vaskur" || o.kind === "kranagat") sinks.push({ p:p, o:o }); else hobs.push({ p:p, o:o }); }); });
    var nS = sinks.filter(function(x){ return x.o.kind === "vaskur"; }).length;
    if (nS) out.push({ "🔑":"BV" + n, "Rými 🏡":room, "Magn":nS, "Vöru reitur 1":[PRODUCTS.sink.id],
      "Smíðagögn (JSON) 🔧":JSON.stringify({ v:1, cutouts:sinks.map(function(x){ return { piece:x.p.label, kind:x.o.kind, x:x.o.x, y:x.o.y, w:x.o.w, d:x.o.d, dia:x.o.dia, mount:x.o.mount }; }) }),
      "Skilaboð til skipulags":sinks.map(function(x){ return x.p.label + ": " + cutText(x.o, skOf); }).join("; ") + "." });
    if (hobs.length) out.push({ "🔑":"BH" + n, "Rými 🏡":room, "Magn":hobs.length, "Vöru reitur 1":[PRODUCTS.hob.id],
      "Smíðagögn (JSON) 🔧":JSON.stringify({ v:1, cutouts:hobs.map(function(x){ return { piece:x.p.label, kind:x.o.kind, x:x.o.x, y:x.o.y, w:x.o.w, d:x.o.d, hob:x.o.hobW }; }) }),
      "Skilaboð til skipulags":hobs.map(function(x){ return x.p.label + ": " + cutText(x.o, skOf); }).join("; ") + " — staðfestu útskurðarmál við helluborðið sjálft." });
    return out;
  }
  // Skápalisti rows (same columns as the cabinets')
  function cabinetRows(r, n){
    return r.pieces.map(function(p){
      return { sk:"BP" + n + p.label, n:9000 + p.label.charCodeAt(0), type:"Borðplata " + p.label, product:r.top.label + (r.kind === "stone" ? " (steinn)" : ""),
        size:p.len + " × " + p.depth + " × " + r.top.thick, front:"", drawers:"", doors:"", shelves:"", grip:"",
        note:[p.wall, edgeText(p), p.upstand.on ? "bakkantur " + p.upstand.h + " mm" : "", p.cutouts.map(function(o){ return cutLabel(o).toLowerCase(); }).join(", "),
          r.joints.filter(function(J){ return J.a === p.id || J.b === p.id; }).map(jointText).join("; ")].filter(Boolean).join(" · ") };
    });
  }

  // ── plan drawing (SVG, world mm, y down = world z) ──
  function worldOf(K, state){ return K.surfaceGeoms(state); }
  function piecePoly(p, g){ // the outline in world mm (a mitred end cuts the front corner)
    function P(x, y){ return [(g.origin.x + g.axis.x * x / 1000 + g.normal.x * y / 1000) * 1000, (g.origin.z + g.axis.z * x / 1000 + g.normal.z * y / 1000) * 1000]; }
    var L = p.left, R = p.right, D = p.depth;
    return [P(L, 0), P(R, 0), P(R - (p.miterR || 0), D), P(L + (p.miterL || 0), D)];
  }
  function esc(t){ return String(t == null ? "" : t).replace(/[&<>"]/g, function(ch){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[ch]; }); }
  function f1(v){ return Math.round(v * 10) / 10; }
  // opts: {state, K, sel:{piece, joint, cut}, ink, font (mm-world text size), skOf, interactive}
  function planSvg(r, opts){
    var K = opts.K, state = opts.state, G = worldOf(K, state), ink = opts.ink || "#1d1d1f", sel = opts.sel || {};
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, s = "";
    function ext(pt){ minX = Math.min(minX, pt[0]); minY = Math.min(minY, pt[1]); maxX = Math.max(maxX, pt[0]); maxY = Math.max(maxY, pt[1]); }
    // the room's walls as thin context lines
    var walls = [];
    (state.walls || []).forEach(function(w, i){ var g = G[i]; if (!g) return;
      var a = [g.origin.x * 1000, g.origin.z * 1000], b = [(g.origin.x + g.axis.x * g.lenM) * 1000, (g.origin.z + g.axis.z * g.lenM) * 1000];
      walls.push([a, b, w.open]); });
    r.pieces.forEach(function(p){ piecePoly(p, G[p.si]).forEach(ext); });
    if (!r.pieces.length) return "";
    var pad = 420; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var span = Math.max(maxX - minX, maxY - minY), fs = opts.font || Math.max(55, span / 38);
    walls.forEach(function(w){ s += '<line x1="' + f1(w[0][0]) + '" y1="' + f1(w[0][1]) + '" x2="' + f1(w[1][0]) + '" y2="' + f1(w[1][1]) + '" stroke="#9a9aa0" stroke-width="' + f1(fs * 0.9) + '"' + (w[2] ? ' stroke-dasharray="' + f1(fs) + ' ' + f1(fs) + '"' : '') + ' opacity=".45"/>'; });
    r.pieces.forEach(function(p){
      var g = G[p.si], poly = piecePoly(p, g), on = sel.piece === p.id;
      function P(x, y){ return [(g.origin.x * 1000 + g.axis.x * x + g.normal.x * y), (g.origin.z * 1000 + g.axis.z * x + g.normal.z * y)]; }
      s += '<polygon data-wt-piece="' + esc(p.id) + '" points="' + poly.map(function(q){ return f1(q[0]) + "," + f1(q[1]); }).join(" ") + '" fill="' + (on ? "#dbe7ff" : "#efe9dc") + '" stroke="' + (on ? "#2f6fdb" : ink) + '" stroke-width="' + f1(fs * (on ? 0.22 : 0.14)) + '"' + (opts.interactive ? ' style="cursor:pointer"' : '') + '/>';
      // finished edges: a thick line just inside the edge
      function edge(a, b){ s += '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke="#2f7cf6" stroke-width="' + f1(fs * 0.32) + '" stroke-linecap="round" pointer-events="none"/>'; }
      var L = p.left, R = p.right, D = p.depth, k = fs * 0.2;
      if (p.edges.front) edge(P(L + (p.miterL || 0), D - k), P(R - (p.miterR || 0), D - k));
      if (p.edges.L) edge(P(L + k, 0), P(L + k, D));
      if (p.edges.R) edge(P(R - k, 0), P(R - k, D));
      if (p.edges.back) edge(P(L, k), P(R, k));
      if (p.upstand.on) s += '<line x1="' + f1(P(L, -k * 2)[0]) + '" y1="' + f1(P(L, -k * 2)[1]) + '" x2="' + f1(P(R, -k * 2)[0]) + '" y2="' + f1(P(R, -k * 2)[1]) + '" stroke="#7c4dff" stroke-width="' + f1(fs * 0.28) + '" stroke-dasharray="' + f1(fs * 0.8) + ' ' + f1(fs * 0.4) + '" pointer-events="none"/>';
      // cutouts
      p.cutouts.forEach(function(o){
        var c0 = P(L + o.x, o.y), cs = sel.cut === o.id, stroke = o.bad ? "#e03131" : cs ? "#2f6fdb" : ink;
        if (o.kind === "kranagat"){ s += '<circle data-wt-cut="' + esc(o.id) + '" cx="' + f1(c0[0]) + '" cy="' + f1(c0[1]) + '" r="' + f1(Math.max(o.dia / 2, fs * 0.35)) + '" fill="#fff" stroke="' + stroke + '" stroke-width="' + f1(fs * 0.12) + '"/>'; return; }
        var a = P(L + o.x - o.w / 2, o.y - o.d / 2), b = P(L + o.x + o.w / 2, o.y - o.d / 2), c = P(L + o.x + o.w / 2, o.y + o.d / 2), d = P(L + o.x - o.w / 2, o.y + o.d / 2);
        s += '<polygon data-wt-cut="' + esc(o.id) + '" points="' + [a, b, c, d].map(function(q){ return f1(q[0]) + "," + f1(q[1]); }).join(" ") + '" fill="' + (o.kind === "vaskur" ? "#e6eef2" : "#2b2b2e") + '" fill-opacity="' + (o.kind === "vaskur" ? 1 : 0.12) + '" stroke="' + stroke + '" stroke-width="' + f1(fs * 0.14) + '"' + (o.kind === "vaskur" && o.mount === "undir" ? ' stroke-dasharray="' + f1(fs * 0.5) + ' ' + f1(fs * 0.3) + '"' : '') + '/>';
        var ta = Math.atan2(g.axis.z, g.axis.x) * 180 / Math.PI; if (ta > 90.5 || ta < -89.5) ta += 180;
        s += '<text x="' + f1(c0[0]) + '" y="' + f1(c0[1]) + '" font-size="' + f1(Math.min(fs * 0.8, o.w / 7)) + '" text-anchor="middle" dominant-baseline="central" fill="' + stroke + '" transform="rotate(' + f1(ta) + ' ' + f1(c0[0]) + ' ' + f1(c0[1]) + ')" pointer-events="none">' + (o.kind === "vaskur" ? "VASKUR" : "HELLUBORÐ") + '</text>';
      });
      // label + dims
      var mid = P((L + R) / 2, D / 2), ang = Math.atan2(g.axis.z, g.axis.x) * 180 / Math.PI;
      if (ang > 90.5 || ang < -89.5) ang += 180;
      // the letter: centred on an empty piece, at the free end of one with cutouts (they'd sit on it)
      var hasCut = p.cutouts.length > 0, lx = (L + R) / 2;
      if (hasCut){ var cx0 = Math.min.apply(null, p.cutouts.map(function(o){ return o.x - (o.w || o.dia) / 2; })), cx1 = Math.max.apply(null, p.cutouts.map(function(o){ return o.x + (o.w || o.dia) / 2; }));
        lx = cx0 > p.len - cx1 ? L + cx0 / 2 : L + (cx1 + p.len) / 2; }
      var room = hasCut ? Math.max(Math.min.apply(null, p.cutouts.map(function(o){ return o.x - (o.w || o.dia) / 2; })), p.len - Math.max.apply(null, p.cutouts.map(function(o){ return o.x + (o.w || o.dia) / 2; }))) : p.len;
      var lab = room < fs * 1.6 ? P((L + R) / 2, D + fs * 4.2) : P(lx, D / 2), big = room < fs * 1.6 ? fs * 1.3 : Math.min(fs * 1.5, Math.max(fs * 0.8, room * 0.6)); // no room between the cutouts: outside, past the length
      s += '<text x="' + f1(lab[0]) + '" y="' + f1(lab[1]) + '" font-size="' + f1(big) + '" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="' + (on ? "#2f6fdb" : "#b8860b") + '" transform="rotate(' + f1(ang) + ' ' + f1(lab[0]) + ' ' + f1(lab[1]) + ')" pointer-events="none">' + esc(p.label) + '</text>';
      // length along the front (outside), depth at the left end (outside)
      var off = D + fs * 2.2, dimA = P(L, off), dimB = P(R, off), dm = P((L + R) / 2, off + fs * 0.1);
      s += '<line x1="' + f1(dimA[0]) + '" y1="' + f1(dimA[1]) + '" x2="' + f1(dimB[0]) + '" y2="' + f1(dimB[1]) + '" stroke="' + ink + '" stroke-width="' + f1(fs * 0.08) + '" pointer-events="none"/>';
      [L, R].forEach(function(x){ var t0 = P(x, off - fs * 0.6), t1 = P(x, off + fs * 0.6); s += '<line x1="' + f1(t0[0]) + '" y1="' + f1(t0[1]) + '" x2="' + f1(t1[0]) + '" y2="' + f1(t1[1]) + '" stroke="' + ink + '" stroke-width="' + f1(fs * 0.08) + '"/>'; });
      s += '<text x="' + f1(dm[0]) + '" y="' + f1(dm[1]) + '" font-size="' + f1(fs) + '" text-anchor="middle" fill="' + ink + '" transform="rotate(' + f1(ang) + ' ' + f1(dm[0]) + ' ' + f1(dm[1]) + ')" dy="' + f1(-fs * 0.35) + '" pointer-events="none">' + p.len + (p.frontLen !== p.len ? " (framan " + p.frontLen + ")" : "") + (p.manualLen ? " *" : "") + '</text>';
      var dd = P(L - fs * 1.3, D / 2);
      s += '<text x="' + f1(dd[0]) + '" y="' + f1(dd[1]) + '" font-size="' + f1(fs * 0.9) + '" text-anchor="middle" fill="' + ink + '" transform="rotate(' + f1(ang - 90) + ' ' + f1(dd[0]) + ' ' + f1(dd[1]) + ')" pointer-events="none">' + p.depth + '</text>';
    });
    // joints: a marker at the inner (wall) corner; amber while not chosen
    r.joints.forEach(function(J){
      var A = r.pieces.find(function(p){ return p.id === J.a; }), B = r.pieces.find(function(p){ return p.id === J.b; });
      var ga = G[A.si], gb = G[B.si];
      var corner = [(gb.origin.x) * 1000, (gb.origin.z) * 1000];
      var outer = [corner[0] + ga.normal.x * A.depth + gb.normal.x * B.depth, corner[1] + ga.normal.z * A.depth + gb.normal.z * B.depth];
      var col = J.chosen ? "#1f9d55" : "#f0821e", on = sel.joint === J.id;
      if (J.type === "ska") s += '<line x1="' + f1(corner[0]) + '" y1="' + f1(corner[1]) + '" x2="' + f1(outer[0]) + '" y2="' + f1(outer[1]) + '" stroke="' + col + '" stroke-width="' + f1(fs * 0.25) + '" pointer-events="none"/>';
      var m = [(corner[0] + outer[0]) / 2, (corner[1] + outer[1]) / 2];
      s += '<circle data-wt-joint="' + esc(J.id) + '" cx="' + f1(m[0]) + '" cy="' + f1(m[1]) + '" r="' + f1(fs * (on ? 1.25 : 1)) + '" fill="' + col + '" stroke="#fff" stroke-width="' + f1(fs * 0.15) + '"' + (opts.interactive ? ' style="cursor:pointer"' : '') + '/>' +
        '<text x="' + f1(m[0]) + '" y="' + f1(m[1]) + '" font-size="' + f1(fs * 0.95) + '" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#fff" pointer-events="none">' + (J.chosen ? (J.type === "ska" ? "45" : "|") : "?") + '</text>';
    });
    return { inner:s, viewBox:f1(minX) + " " + f1(minY) + " " + f1(maxX - minX) + " " + f1(maxY - minY), w:maxX - minX, h:maxY - minY };
  }


  // ── what Rakel changes (only overrides are stored) ──
  function cfgW(state){ if (!state.worktop || typeof state.worktop !== "object") state.worktop = {}; return state.worktop; }
  function setPiece(state, pid, patch){ var w = cfgW(state); w.pieces = w.pieces || {}; var p = w.pieces[pid] = Object.assign({}, w.pieces[pid] || {}, patch);
    Object.keys(p).forEach(function(k){ if (p[k] === null || p[k] === undefined) delete p[k]; }); }
  function setJoint(state, jid, val){ var w = cfgW(state); w.joints = w.joints || {}; if (val) w.joints[jid] = val; else delete w.joints[jid]; }
  function setCut(state, cid, patch){ var w = cfgW(state); w.cut = w.cut || {}; var c = w.cut[cid] = Object.assign({}, w.cut[cid] || {}, patch);
    Object.keys(c).forEach(function(k){ if (c[k] === null || c[k] === undefined || c[k] === 0) delete c[k]; }); if (!Object.keys(c).length) delete w.cut[cid]; }
  function setHob(state, patch){ var w = cfgW(state); w.hob = Object.assign({}, w.hob || {}, patch); }

  // ── "Smíða — Borðplata" (PRO): same white card as the cabinet Smíða ──
  var CSS = [
    "#proWt{color-scheme:light;position:fixed;inset:0;z-index:350;background:rgba(15,18,24,.55);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}",
    "#proWt .wt-card{background:#fff;color:#1b1f24;border-radius:16px;width:min(1180px,96vw);max-height:calc(96vh - 52px);overflow:auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,1fr);align-items:start;gap:22px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.35);box-sizing:border-box}",
    "#proWt .wt-img{position:sticky;top:0;align-self:start;min-width:0}",
    "#proWt .wt-img svg{display:block;width:100%;height:auto;max-height:calc(96vh - 150px);background:#f4f5f7;border-radius:12px;user-select:none}",
    "#proWt .wt-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:12px;color:#5b6470}",
    "#proWt .wt-leg i{display:inline-block;width:14px;height:4px;border-radius:2px;margin-right:5px;vertical-align:middle}",
    "#proWt h3{margin:0 0 4px;font-size:18px;display:flex;align-items:center;gap:8px}",
    "#proWt h3 span{flex:1}",
    "#proWt .wt-sub{color:#5b6470;font-size:13px;margin-bottom:12px}",
    "#proWt .wt-info{margin:0 0 12px;padding:9px 11px;border-radius:10px;background:#eef3fb;color:#24426f;font-size:13px;line-height:1.4}",
    "#proWt .wt-issues{margin:0 0 12px;padding:9px 11px;border-radius:10px;background:#3a1f1b;color:#ffb4a6;font-size:13px;line-height:1.4}",
    "#proWt .wt-issues div{cursor:pointer}#proWt .wt-issues div+div{margin-top:4px}#proWt .wt-issues u{white-space:nowrap}",
    "#proWt .wt-notes{margin:0 0 12px;padding:8px 11px;border-radius:10px;background:#fff6dc;color:#7a5200;font-size:12.5px;line-height:1.4}",
    "#proWt .wt-sec{border:1px solid #e1e4e8;border-radius:12px;padding:10px 12px;margin-bottom:10px}",
    "#proWt .wt-sec h4{margin:0 0 8px;font-size:14px;display:flex;align-items:center;gap:8px}",
    "#proWt .wt-sec h4 small{font-weight:400;color:#5b6470;font-size:12px}",
    "#proWt .wt-row{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:5px 0;font-size:13px}",
    "#proWt .wt-row>label{display:inline-flex;align-items:center;gap:5px}",
    "#proWt .wt-row .wt-l{width:118px;color:#3b4652}",
    "#proWt input[type=number],#proWt input[type=text]{width:76px;padding:5px 7px;border:1px solid #cfd4da;border-radius:7px;font:inherit;background:#fff;color:#1b1f24;box-sizing:border-box}",
    "#proWt input:disabled,#proWt select:disabled{opacity:.55}",
    "#proWt input[type=checkbox]{accent-color:#0a84ff;width:15px;height:15px;margin:0}",
    "#proWt select{padding:5px 7px;border:1px solid #cfd4da;border-radius:7px;font:inherit;background:#fff;color:#1b1f24}",
    "#proWt .wt-btn{border:1px solid #cfd4da;background:#fff;color:#1b1f24;border-radius:8px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px;line-height:1.2}",
    "#proWt .wt-btn.on{background:#1d2633;color:#fff;border-color:#1d2633}",
    "#proWt .wt-link{border:0;background:none;color:#0058a3;cursor:pointer;font:inherit;font-size:12px;padding:0 2px;text-decoration:underline}",
    "#proWt .wt-link[disabled]{visibility:hidden}",
    "#proWt .wt-tabs{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}",
    "#proWt .wt-tab{border:1px solid #cfd4da;background:#fff;color:#1b1f24;border-radius:8px;padding:5px 12px;cursor:pointer;font:600 13px/1.2 inherit;font-family:inherit}",
    "#proWt .wt-tab.on{background:#1b1f24;color:#fff;border-color:#1b1f24}",
    "#proWt .wt-joint{display:grid;grid-template-columns:1fr;gap:6px;padding:8px 10px;border-radius:10px;background:#f6f7f9;margin-bottom:6px}",
    "#proWt .wt-joint.todo{background:#fff1dd;box-shadow:inset 3px 0 0 #f0821e}",
    "#proWt .wt-joint.blink,#proWt .wt-cut.blink{animation:wtBlink 1.1s ease 2}",
    "@keyframes wtBlink{50%{box-shadow:0 0 0 3px #0a84ff}}",
    "#proWt .wt-joint b{font-size:13px}",
    "#proWt .wt-cut{border-top:1px solid #eceef1;padding-top:7px;margin-top:7px}",
    "#proWt .wt-cut.bad .wt-ct{color:#c0322b}",
    "#proWt .wt-ct{font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px}",
    "#proWt .wt-foot{grid-column:1 / -1;position:sticky;bottom:-20px;z-index:3;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e1e4e8;margin:0 -22px -20px;padding:12px 22px 14px;background:#fff;border-radius:0 0 16px 16px}",
    "#proWt .wt-done{width:170px;padding:9px 10px;border:0;border-radius:9px;font:700 13.5px/1.2 inherit;font-family:inherit;cursor:pointer;color:#fff;background:#0a84ff}",
    "#proWt .wt-x{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#5b6470;padding:0 4px}",
    "#proWt .wt-empty{padding:30px;text-align:center;color:#5b6470;font-size:14px}"
  ].join("\n");
  var ed = null; // {ctx, sel:{piece, joint, cut}, blink}
  function closeEditor(){ var el = document.getElementById("proWt"); if (el) el.remove(); window.removeEventListener("keydown", edKey, true); if (ed && ed.ctx.onClose) ed.ctx.onClose(); ed = null; }
  function edKey(e){
    if (!ed) return;
    if (e.key === "Escape" && !(e.target.closest && e.target.closest("input,select,textarea"))){ e.preventDefault(); e.stopImmediatePropagation(); closeEditor(); }
  }
  // focus: {blockId} | {joint} | {cut} | {piece}
  function openEditor(ctx, focus){
    if (!document.getElementById("kpwtCss")){ var st = document.createElement("style"); st.id = "kpwtCss"; st.textContent = CSS; document.head.appendChild(st); }
    ed = { ctx:ctx, sel:{}, blink:null };
    var r = compute(ctx.state(), ctx.K);
    focus = focus || {};
    if (focus.blockId){ var p0 = r.pieces.find(function(p){ return p.blocks.indexOf(focus.blockId) >= 0; }); if (p0) ed.sel.piece = p0.id; }
    if (focus.joint){ ed.sel.joint = focus.joint; ed.blink = "j" + focus.joint; }
    if (focus.cut){ ed.sel.cut = focus.cut; ed.blink = "c" + focus.cut; r.pieces.forEach(function(p){ if (p.cutouts.some(function(o){ return o.id === focus.cut; })) ed.sel.piece = p.id; }); }
    if (focus.piece) ed.sel.piece = focus.piece;
    if (!ed.sel.piece && r.pieces[0]) ed.sel.piece = r.pieces[0].id;
    window.addEventListener("keydown", edKey, true);
    renderEditor();
  }
  function edCommit(){ ed.ctx.save(); renderEditor(); if (ed.ctx.refresh) ed.ctx.refresh(); }
  function h(t){ return esc(t); }
  function numIn(attr, val, ph, ro){ return '<input type="number" step="1" ' + attr + ' value="' + (val == null ? "" : val) + '"' + (ph != null ? ' placeholder="' + ph + '"' : '') + (ro ? " disabled" : "") + '>'; }
  function renderEditor(){
    if (!ed) return;
    var ctx = ed.ctx, state = ctx.state(), r = compute(state, ctx.K), skOf = ctx.skOf ? ctx.skOf() : {}, ro = ctx.readOnly && ctx.readOnly();
    var el = document.getElementById("proWt");
    if (!el){ el = document.createElement("div"); el.id = "proWt"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el);
      el.addEventListener("pointerdown", function(e){ if (e.target === el) closeEditor(); }); }
    var keepScroll = (el.querySelector(".wt-content") || {}).scrollTop || 0, cardScroll = (el.querySelector(".wt-card") || {}).scrollTop || 0;
    var kindTxt = r.kind === "stone" ? "Steinn — pantaður, steinsmiður mælir og sker sjálfur" : r.kind === "inhouse" ? (r.top.groupLabel || "Borðplata") + " — sagað hjá okkur" : "";
    var head = '<h3><span>Smíða — Borðplata</span><button type="button" class="wt-x" data-wt="close" title="Loka (Esc)">×</button></h3>';
    if (r.kind === "none" || !r.pieces.length){
      el.innerHTML = '<div class="wt-card" style="grid-template-columns:1fr;max-width:560px"><div>' + head +
        '<div class="wt-empty">' + (!r.pieces.length ? "Engir skápar með borðplötu í þessu rými." : r.kind === "none" ? "Engin borðplata valin í þessu rými (Engin borðplata)." : "Engin borðplata valin enn.") + '</div>' +
        (r.pieces.length ? '<div style="text-align:center"><button type="button" class="wt-btn" data-wt="efni">Velja borðplötu í Efni</button></div>' : '') + '</div></div>';
      wireEditor(el, r, state); return;
    }
    if (!r.pieces.some(function(p){ return p.id === ed.sel.piece; })) ed.sel.piece = r.pieces[0].id;
    var plan = planSvg(r, { K:ctx.K, state:state, sel:ed.sel, interactive:true, skOf:skOf });
    var P = r.pieces.find(function(p){ return p.id === ed.sel.piece; }), stone = r.kind === "stone";
    var html = '<div class="wt-card"><div class="wt-img"><svg viewBox="' + plan.viewBox + '" preserveAspectRatio="xMidYMid meet">' + plan.inner + '</svg>' +
      '<div class="wt-leg"><span><i style="background:#2f7cf6"></i>kantlímt</span><span><i style="background:#7c4dff"></i>bakkantur</span><span><i style="background:#f0821e;width:8px;height:8px;border-radius:50%"></i>samskeyti ekki valin</span>' +
      '<span><i style="background:#1f9d55;width:8px;height:8px;border-radius:50%"></i>samskeyti valin</span><span>* lengd slegin inn</span></div></div>';
    html += '<div class="wt-content">' + head + '<div class="wt-sub">' + (r.kind === "unset" ? "Engin borðplata valin" : h(r.top.label) + (r.top.code ? " · Egger " + h(r.top.code) : "") + " · " + r.top.thick + " mm · " + h(kindTxt)) + " · " +
      r.pieces.length + " " + (r.pieces.length === 1 ? "stykki" : "stykki") + ", " + (Math.round(r.m2 * 100) / 100).toString().replace(".", ",") + " m²</div>";
    if (r.kind === "unset") html += '<div class="wt-issues">⛔ Engin borðplata valin — efnið ræður hvort hún er sögð hjá okkur (mál, samskeyti, úrtök) eða pöntuð úr steini. <u data-wt="efni" style="cursor:pointer">Velja í Efni</u></div>';
    if (stone) html += '<div class="wt-info">Steinn: steinsmiðurinn mælir á staðnum og sker sjálfur. Málin hér eru fyrir tilboðið (gróf stærð) og til að sýna hvar vaskur, helluborð og krani eiga að vera — engin sögunarteikning.</div>';
    if (r.issues.length) html += '<div class="wt-issues">' + r.issues.map(function(x, i){ return '<div data-wt-issue="' + i + '">⛔ ' + h(x.text) + ' <u>Laga</u></div>'; }).join("") + '</div>';
    if (r.notes.length) html += '<div class="wt-notes">' + r.notes.map(h).join("<br>") + '</div>';
    // joints
    if (r.joints.length){
      html += '<div class="wt-sec"><h4>Samskeyti <small>' + (stone ? "valfrjálst — ákveðið með steinsmið" : "engin sjálfgefin: veldu fyrir hvert horn") + '</small></h4>' + r.joints.map(function(J){
        function b(val, through, label){ var on = J.type === val && (val !== "beint" || J.through === through); return '<button type="button" class="wt-btn' + (on ? " on" : "") + '" data-wt-jset="' + h(J.id) + '" data-type="' + val + '" data-through="' + (through || "") + '"' + (ro ? " disabled" : "") + '>' + h(label) + '</button>'; }
        return '<div class="wt-joint' + (J.chosen ? "" : " todo") + (ed.blink === "j" + J.id ? " blink" : "") + '" data-wt-jrow="' + h(J.id) + '"><b>Horn ' + h(J.aLabel) + '–' + h(J.bLabel) + ' · ' + h(J.corner) + (J.chosen ? "" : " — ekki valið") + '</b>' +
          '<div class="wt-row">' + b("ska", null, "Skáskorið 45°") + b("beint", "a", "Beint — " + J.aLabel + " í gegn") + b("beint", "b", "Beint — " + J.bLabel + " í gegn") + '</div></div>';
      }).join("") + '</div>';
    }
    // the selected piece
    html += '<div class="wt-sec"><div class="wt-tabs">' + r.pieces.map(function(p){ return '<button type="button" class="wt-tab' + (p.id === P.id ? " on" : "") + '" data-wt-piece="' + h(p.id) + '">' + h(p.label) + ' · ' + h(p.wall) + '</button>'; }).join("") + '</div>';
    function endTxt(e){ return e.type === "wall" ? "við vegg / skáp" : e.type === "joint" ? "samskeyti" : "laus endi"; }
    html += '<div class="wt-row"><span class="wt-l">Lengd (mm)</span>' + numIn('data-wt-pf="lenMm"', P.len, P.lenAuto, ro) + '<button type="button" class="wt-link" data-wt-reset="lenMm"' + (P.manualLen ? "" : " disabled") + '>Sjálfvirkt (' + P.lenAuto + ')</button></div>' +
      '<div class="wt-row"><span class="wt-l">Dýpt (mm)</span>' + numIn('data-wt-pf="depthMm"', P.depth, P.depthAuto, ro) + '<button type="button" class="wt-link" data-wt-reset="depthMm"' + (P.manualDepth ? "" : " disabled") + '>Sjálfvirkt (' + P.depthAuto + ')</button></div>' +
      '<div class="wt-row"><span class="wt-l">Þykkt</span><b>' + r.top.thick + ' mm</b> <small style="color:#5b6470">(úr borðplötunni sem er valin)</small></div>' +
      '<div class="wt-row"><span class="wt-l">Yfirhang framan</span>' + numIn('data-wt-pf="front"', P.ov.front, FRONT_OV, ro) + '<small style="color:#5b6470">mm fram fyrir skápana</small></div>' +
      '<div class="wt-row"><span class="wt-l">Vinstri endi</span>' + (P.ends.L.type === "free" ? numIn('data-wt-pf="ovL"', P.ov.L, 0, ro) + '<small style="color:#5b6470">mm yfirhang</small>' : '<small style="color:#5b6470">' + endTxt(P.ends.L) + '</small>') + '</div>' +
      '<div class="wt-row"><span class="wt-l">Hægri endi</span>' + (P.ends.R.type === "free" ? numIn('data-wt-pf="ovR"', P.ov.R, 0, ro) + '<small style="color:#5b6470">mm yfirhang</small>' : '<small style="color:#5b6470">' + endTxt(P.ends.R) + '</small>') + '</div>';
    function chk(key, label, on){ return '<label><input type="checkbox" data-wt-edge="' + key + '"' + (on ? " checked" : "") + (ro ? " disabled" : "") + '> ' + label + '</label>'; }
    html += '<div class="wt-row"><span class="wt-l">Kantar</span>' + chk("front", "Framkantur", P.edges.front) + chk("L", "Vinstri endi", P.edges.L) + chk("R", "Hægri endi", P.edges.R) + (P.island ? chk("back", "Bakhlið", P.edges.back) : "") + '</div>';
    if (P.upstand.allowed) html += '<div class="wt-row"><span class="wt-l">Bakkantur</span><label><input type="checkbox" data-wt-up="on"' + (P.upstand.on ? " checked" : "") + (ro ? " disabled" : "") + '> Upp við vegg</label>' +
      (P.upstand.on ? numIn('data-wt-up="h"', P.upstand.h, 50, ro) + '<small style="color:#5b6470">mm hár</small>' : '') + '</div>';
    html += '<div class="wt-row"><span class="wt-l">Athugasemd</span><input type="text" data-wt-pf="note" value="' + h(P.note) + '" placeholder="t.d. hvar samskeyti á beinum kafla" style="flex:1;min-width:160px;padding:5px 7px;border:1px solid #cfd4da;border-radius:7px;font:inherit"' + (ro ? " disabled" : "") + '></div>';
    // cutouts in this piece
    var cuts = P.cutouts.concat(P.cutoutsOff || []);
    html += '<h4 style="margin:12px 0 2px;font-size:14px">Úrtök <small style="font-weight:400;color:#5b6470;font-size:12px">' + (stone ? "til upplýsinga fyrir steinsmið — hann mælir sjálfur" : "frá vinstri enda stykkisins og frá vegg (bakbrún), mm") + '</small></h4>';
    if (!cuts.length) html += '<div class="wt-row"><small style="color:#5b6470">Ekkert úrtak í þessu stykki.</small></div>';
    cuts.forEach(function(o){
      var sk = skOf[o.block] ? " · " + skOf[o.block] : "", off = !!o.off;
      html += '<div class="wt-cut' + (o.bad && !stone ? " bad" : "") + (ed.blink === "c" + o.id ? " blink" : "") + '" data-wt-crow="' + h(o.id) + '"><div class="wt-ct">' + h(cutLabel(o)) + h(sk) + (o.kind === "kranagat" ? " Ø" + o.dia : "") +
        (o.kind === "kranagat" ? ' <label style="font-weight:400;margin-left:auto"><input type="checkbox" data-wt-coff="' + h(o.id) + '"' + (off ? "" : " checked") + (ro ? " disabled" : "") + '> í borðplötu</label>' : "") + '</div>';
      if (!off){
        if (o.kind === "vaskur") html += '<div class="wt-row"><span class="wt-l">Gerð</span><button type="button" class="wt-btn' + (o.mount === "ofan" ? " on" : "") + '" data-wt-mount="ofan" data-cut="' + h(o.id) + '"' + (ro ? " disabled" : "") + '>Ofan á</button><button type="button" class="wt-btn' + (o.mount === "undir" ? " on" : "") + '" data-wt-mount="undir" data-cut="' + h(o.id) + '"' + (ro ? " disabled" : "") + '>Undirlímdur</button></div>' +
          '<div class="wt-row"><span class="wt-l">Úrtak B × D</span>' + numIn('data-wt-cf="w" data-cut="' + h(o.id) + '"', o.w, null, ro) + '×' + numIn('data-wt-cf="d" data-cut="' + h(o.id) + '"', o.d, null, ro) + '</div>';
        if (o.kind === "helluborð") html += '<div class="wt-row"><span class="wt-l">Helluborð</span><select data-wt-hobw="1"' + (ro ? " disabled" : "") + '>' + Object.keys(HOB_CUT).map(function(k){ return '<option value="' + k + '"' + (+k === o.hobW ? " selected" : "") + '>' + (k / 10) + ' cm — úrtak ' + HOB_CUT[k][0] + ' × ' + HOB_CUT[k][1] + '</option>'; }).join("") + '</select></div>';
        html += '<div class="wt-row"><span class="wt-l">Miðja</span>' + numIn('data-wt-cx="' + h(o.id) + '"', o.x, null, ro) + '<small style="color:#5b6470">frá vinstri enda</small>' + numIn('data-wt-cy="' + h(o.id) + '"', o.y, null, ro) + '<small style="color:#5b6470">frá vegg</small>' +
          '<button type="button" class="wt-link" data-wt-creset="' + h(o.id) + '"' + (o.moved ? "" : " disabled") + '>Yfir skápnum</button></div>';
      }
      html += '</div>';
    });
    html += '</div>';
    // hob
    html += '<div class="wt-sec"><h4>Helluborð <small>' + (r.hob.auto && r.hob.id ? "sett sjálfkrafa yfir ofnaskápinn" : "") + '</small></h4><div class="wt-row"><span class="wt-l">Yfir skáp</span><select data-wt-hob="1"' + (ro ? " disabled" : "") + '><option value=""' + (r.hob.id ? "" : " selected") + '>Ekkert helluborð</option>' +
      r.hobChoices.map(function(c){ return '<option value="' + h(c.id) + '"' + (c.id === r.hob.id ? " selected" : "") + '>' + h(skOf[c.id] || c.id) + ' (stykki ' + h(c.piece) + ')</option>'; }).join("") + '</select></div></div>';
    html += '</div><div class="wt-foot"><button type="button" class="wt-done" data-wt="close">Klárt</button></div></div>';
    el.innerHTML = html;
    var ct = el.querySelector(".wt-card"); if (ct) ct.scrollTop = cardScroll;
    if (ed.blink){ var bl = el.querySelector(".blink"); if (bl) bl.scrollIntoView({ block:"center" }); ed.blink = null; }
    wireEditor(el, r, state);
  }
  function wireEditor(el, r, state){
    var ctx = ed.ctx, P = r.pieces.find(function(p){ return p.id === ed.sel.piece; });
    el.onclick = function(e){
      var t = e.target.closest("[data-wt],[data-wt-piece],[data-wt-joint],[data-wt-cut],[data-wt-jset],[data-wt-reset],[data-wt-mount],[data-wt-creset],[data-wt-issue]");
      if (!t) return;
      if (t.dataset.wt === "close"){ closeEditor(); return; }
      if (t.dataset.wt === "efni"){ closeEditor(); if (ctx.openEfni) ctx.openEfni(); return; }
      if (ctx.readOnly && ctx.readOnly() && (t.dataset.wtJset || t.dataset.wtReset || t.dataset.wtMount || t.dataset.wtCreset)){ if (ctx.toast) ctx.toast("Opnaðu til breytinga fyrst"); return; }
      if (t.dataset.wtIssue != null){ var x = r.issues[+t.dataset.wtIssue];
        if (x.kind === "joint"){ ed.sel.joint = x.ref; ed.blink = "j" + x.ref; }
        else { ed.sel.piece = x.piece; ed.sel.cut = x.ref; ed.blink = "c" + x.ref; }
        renderEditor(); return; }
      if (t.dataset.wtPiece){ ed.sel.piece = t.dataset.wtPiece; ed.sel.cut = null; renderEditor(); return; }
      if (t.dataset.wtJoint){ ed.sel.joint = t.dataset.wtJoint; ed.blink = "j" + t.dataset.wtJoint; renderEditor(); return; }
      if (t.dataset.wtCut){ ed.sel.cut = t.dataset.wtCut; ed.blink = "c" + t.dataset.wtCut; renderEditor(); return; }
      if (t.dataset.wtJset){ setJoint(state, t.dataset.wtJset, { type:t.dataset.type, through:t.dataset.through || undefined }); ed.sel.joint = t.dataset.wtJset; edCommit(); return; }
      if (t.dataset.wtReset){ var pt = {}; pt[t.dataset.wtReset] = null; setPiece(state, P.id, pt); edCommit(); return; }
      if (t.dataset.wtMount){ setCut(state, t.dataset.cut, { mount:t.dataset.wtMount }); edCommit(); return; }
      if (t.dataset.wtCreset){ setCut(state, t.dataset.wtCreset, { dx:null, dy:null }); edCommit(); return; }
    };
    el.onchange = function(e){
      var t = e.target;
      if (ctx.readOnly && ctx.readOnly()){ if (ctx.toast) ctx.toast("Opnaðu til breytinga fyrst"); renderEditor(); return; }
      var v = t.type === "number" ? (t.value === "" ? null : Math.round(Number(t.value))) : t.value;
      if (t.dataset.wtPf){
        var f = t.dataset.wtPf, pt = {};
        if (f === "note") pt.note = String(v || "").slice(0, 300) || null;
        else if (f === "lenMm" || f === "depthMm") pt[f] = v > 0 && v !== (f === "lenMm" ? P.lenAuto : P.depthAuto) ? v : null;
        else pt[f] = v == null ? null : Math.max(0, Math.min(f === "front" ? 300 : 600, v));
        setPiece(state, P.id, pt); edCommit(); return;
      }
      if (t.dataset.wtEdge){ var ed0 = Object.assign({}, (P.cfg && P.cfg.edges) || {}); ed0[t.dataset.wtEdge] = t.checked; setPiece(state, P.id, { edges:ed0 }); edCommit(); return; }
      if (t.dataset.wtUp){ var up = Object.assign({ on:P.upstand.on, h:P.upstand.h }, (P.cfg && P.cfg.upstand) || {}); if (t.dataset.wtUp === "on") up.on = t.checked; else up.h = v || 50; setPiece(state, P.id, { upstand:up }); edCommit(); return; }
      if (t.dataset.wtCf){ var cp = {}; cp[t.dataset.wtCf] = v > 0 ? v : null; setCut(state, t.dataset.cut, cp); edCommit(); return; }
      if (t.dataset.wtCx || t.dataset.wtCy){
        var id = t.dataset.wtCx || t.dataset.wtCy, o = P.cutouts.find(function(c){ return c.id === id; }); if (!o || v == null) return;
        var cc = ((state.worktop || {}).cut || {})[id] || {};
        if (t.dataset.wtCx) setCut(state, id, { dx:Math.round(v - o.autoX) || null, dy:cc.dy || null });
        else setCut(state, id, { dy:Math.round(v - o.autoY) || null, dx:cc.dx || null });
        edCommit(); return;
      }
      if (t.dataset.wtCoff){ setCut(state, t.dataset.wtCoff, { off:t.checked ? null : true }); edCommit(); return; }
      if (t.dataset.wtHob){ setHob(state, { id:t.value }); edCommit(); return; }
      if (t.dataset.wtHobw){ setHob(state, { w:+t.value, id:(r.hob.id || "") }); edCommit(); return; }
    };
  }

  var API = { compute:compute, reconcile:reconcile, smida:smida, lines:lines, cabinetRows:cabinetRows, planSvg:planSvg, kindOf:kindOf, cutText:cutText, cutLabel:cutLabel,
    jointText:jointText, edgeText:edgeText, openEditor:openEditor, closeEditor:closeEditor, isOpen:function(){ return !!ed; }, rerender:function(){ renderEditor(); }, setJoint:setJoint, setPiece:setPiece, setCut:setCut, setHob:setHob, PRODUCTS:PRODUCTS, HOB_CUT:HOB_CUT, JOINT_LABELS:JOINT_LABELS, FRONT_OV:FRONT_OV, BOARD_MAX_MM:BOARD_MAX_MM, TAP_DIA:TAP_DIA };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KPWT = API;
})(typeof window !== "undefined" ? window : globalThis);
