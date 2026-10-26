// kitchen-planner-workdraw.js — 2D vinnuteikningar (work drawings) for PRO, 2026-10-23.
//
// Pure SVG from a plain "sheet model" the planner builds (wdModel() in kitchen-planner.html, from the same
// Smíðagögn numbers /cnc and Keyra skipulag use) — no DOM, no THREE, so it also renders under node for tests.
// One A3-landscape sheet per wall: plan strip (top view) above the front elevation, an end section beside it,
// and a right column with the room minimap, notes and the title block. Sheet 1 = the whole room's plan.
//
// Shop conventions (Rakel's own drawings, confirmed by the user 2026-10-23):
//   colours  ÚTHLIÐ black/thick · ÁFELLA hatched · SK gold · LED magenta · GRIP blue · TEXTI green ·
//            MERIVO red · LEGRA orange · BLIND LOK cross-hatched · SÖKKULL purple hatch
//   drawers  "<system>-<I if inner><size>" e.g. M-K, L-E, M-IK; "(FRE1)/(FRE2)/(SKRE)" = front material when the
//            project has more than one (filled in by the model: front.mat)
//   shelves  FH = föst hilla · H3 = hilla, 3 boranir (adjustable) · LH = loftunarhilla (above an oven)
//   doors    dashed lines from the two hinge-side corners meeting at the middle of the far edge — the point
//            faces AWAY from the hinges (">" = hinges on the left)
//   SLA = fataslá · PUSH = push-to-open
(function(root){
  "use strict";
  var C = { ink:"#1d1d1f", thin:"#4a4a4f", dim:"#2f2f33", sk:"#b8860b", led:"#c026d3", grip:"#2f7cf6", text:"#4c9a1f",
    merivo:"#e03131", legra:"#f0821e", plinth:"#7c4dff", anno:"#e8590c", open:"#9a9aa0" };
  var PAGE_W = 420, PAGE_H = 297, M = 10, COL_W = 92; // mm
  var SCALES = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

  function esc(t){ return String(t == null ? "" : t).replace(/[&<>"]/g, function(ch){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[ch]; }); }
  function n(v){ return Math.round(v * 100) / 100; }
  function ln(x1, y1, x2, y2, stroke, w, extra){ return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + stroke + '" stroke-width="' + w + '"' + (extra || "") + '/>'; }
  function rc(x, y, w, h, stroke, sw, fill, extra){ return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(Math.max(0, w)) + '" height="' + n(Math.max(0, h)) + '" stroke="' + (stroke || "none") + '" stroke-width="' + (sw || 0) + '" fill="' + (fill || "none") + '"' + (extra || "") + '/>'; }
  function tx(x, y, s, size, fill, extra){ return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + size + '" fill="' + fill + '"' + (extra || "") + '>' + esc(s) + '</text>'; }
  var DASH = ' stroke-dasharray="1.6 1.1"', DASH_S = ' stroke-dasharray="0.9 0.7"';
  var DEFS = '<defs>' +
    '<pattern id="wdHatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="' + C.thin + '" stroke-width="0.35"/></pattern>' +
    '<pattern id="wdPlinth" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.4" stroke="' + C.plinth + '" stroke-width="0.35"/></pattern>' +
    '<pattern id="wdCross" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0,0 L2,2 M2,0 L0,2" stroke="' + C.ink + '" stroke-width="0.3"/></pattern>' +
    '<pattern id="wdWall" width="1.8" height="1.8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.8" stroke="#8a8a90" stroke-width="0.3"/></pattern>' +
    '<marker id="wdArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + C.anno + '"/></marker>' +
    '</defs>';

  // dimension line with ticks (architectural slashes), text centred above (horizontal) or left of it (vertical)
  function dim(x1, y1, x2, y2, label, opts){
    opts = opts || {};
    var vert = Math.abs(x1 - x2) < 0.01, s = ln(x1, y1, x2, y2, C.dim, 0.22), t = 1.1;
    [[x1, y1], [x2, y2]].forEach(function(p){ s += ln(p[0] - t, p[1] + t, p[0] + t, p[1] - t, C.dim, 0.3); });
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, size = opts.size || 2.3, len = vert ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
    if (len < size * String(label).length * 0.5 && !opts.force) size = Math.max(1.5, len / (String(label).length * 0.55)); // short span: smaller text
    s += vert ? tx(mx - 1, my, label, size, C.dim, ' text-anchor="middle" transform="rotate(-90 ' + n(mx - 1) + ' ' + n(my) + ')"' + (opts.bold ? ' font-weight="700"' : ''))
      : tx(mx, my - 1, label, size, C.dim, ' text-anchor="middle"' + (opts.bold ? ' font-weight="700"' : ''));
    return s;
  }
  function chain(pts, at, vertical, map, opts){ // pts = sorted mm positions; map(mm) → page coord along the chain
    var s = "", u = pts.filter(function(v, i){ return i === 0 || Math.abs(v - pts[i - 1]) > 0.5; });
    for (var i = 1; i < u.length; i++){
      var a = map(u[i - 1]), b = map(u[i]), v = Math.round(u[i] - u[i - 1]);
      s += vertical ? dim(at, a, at, b, v, opts) : dim(a, at, b, at, v, opts);
      s += vertical ? ln(at - 1.5, a, at + 1.5, a, C.dim, 0.15) : ln(a, at - 1.5, a, at + 1.5, C.dim, 0.15);
    }
    return s;
  }

  function pickScale(wMm, hMm, availW, availH){
    for (var i = 0; i < SCALES.length; i++) if (wMm / SCALES[i] <= availW && hMm / SCALES[i] <= availH) return SCALES[i];
    return SCALES[SCALES.length - 1];
  }

  function drawerLabel(sys, f){ // inner codes may already carry their I ("IK", Blum's own naming in DRAWER_CODES.inner)
    var code = String(f.code || ""), inner = f.inner && code.charAt(0) !== "I" ? "I" : "";
    return (sys === "merivo" ? "M" : "L") + "-" + inner + code + (f.mat ? " (" + f.mat + ")" : "");
  }

  // ── one unit in elevation (x0 = page x of its left edge, yb = page y of the floor, k = mm → page) ──
  function unitElev(u, x0, yb, k, sys){
    var s = "", w = u.w * k, yBot = yb - u.y0 * k, h = u.h * k, yTop = yBot - h, sysC = sys === "merivo" ? C.merivo : C.legra;
    if (u.plinth) s += rc(x0, yb - u.plinth * k, w, u.plinth * k, C.plinth, 0.25, "url(#wdPlinth)");
    if (u.panel){ return s + rc(x0, yTop, w, h, C.ink, 0.2, C.ink); }
    s += rc(x0, yTop, w, h, C.ink, 0.35);
    if (u.blind) s += rc(x0, yTop, w, h, "none", 0, "url(#wdCross)", ' opacity=".55"');
    if (u.appliance){
      s += tx(x0 + w / 2, yTop + h / 2, u.appliance, 2.2, C.thin, ' text-anchor="middle"');
      return s;
    }
    // oven
    if (u.oven){
      var oy = yBot - (u.oven.under + u.oven.h) * k;
      s += rc(x0 + 0.8, oy, w - 1.6, u.oven.h * k, C.thin, 0.25, "#f2f2f3") + tx(x0 + w / 2, oy + u.oven.h * k / 2 + 1, "OFN " + u.oven.h, 2.1, C.thin, ' text-anchor="middle"');
    }
    // drawer fronts, bottom → top; the box as a dashed rectangle (its real side height) in the system colour
    var acc = 0;
    (u.fronts || []).forEach(function(f){
      var fy = yBot - (acc + f.mm) * k, fh = f.mm * k;
      s += rc(x0 + 0.4, fy + 0.3, w - 0.8, fh - 0.6, C.ink, 0.25);
      if (f.code === "fast"){ s += tx(x0 + w / 2, fy + fh / 2 + 0.8, "fastur frontur", 1.9, C.text, ' text-anchor="middle"'); }
      else {
        var bh = Math.min(fh - 2, (f.side || f.mm * 0.6) * k);
        s += rc(x0 + 2.2, fy + fh - 1 - bh, w - 4.4, bh, sysC, 0.3, "none", DASH);
        var lab = drawerLabel(sys, f), ls = Math.min(2.8, fh * 0.45, (w - 3) / (lab.length * 0.58)); // a long "M-K (FRE1)" shrinks to fit a narrow unit
        s += tx(x0 + w / 2, fy + fh / 2 + 1, lab, ls, sysC, ' text-anchor="middle" font-weight="700"');
        // the front's own slot height (= Sérhæð), a size smaller than the code so it's there for whoever looks for it
        // (top-right corner, above the dashed box — never on top of the code or the box line)
        var ms = Math.max(1.2, Math.min(ls - 0.75, fh - bh - 1.4));
        if (w > 9) s += tx(x0 + w - 1, fy + 0.4 + ms, Math.round(f.mm), ms, C.thin, ' text-anchor="end"');
      }
      if (f.push) s += tx(x0 + w - 1, fy + 2.4, "PUSH", 1.6, C.text, ' text-anchor="end"');
      acc += f.mm;
    });
    // inner drawers behind doors (dashed, system colour)
    (u.inner || []).forEach(function(d){
      var iy = yBot - (d.mm + d.h) * k;
      var il = drawerLabel(sys, { code:d.code, inner:true, mat:d.mat });
      s += rc(x0 + 3, iy, w - 6, d.h * k, sysC, 0.3, "none", DASH) + tx(x0 + w / 2, iy + d.h * k / 2 + 0.9, il, Math.min(2.5, d.h * k * 0.5, (w - 7) / (il.length * 0.58)), sysC, ' text-anchor="middle" font-weight="700"');
    });
    // shelves: FH solid, H3 dashed, LH (over an oven) solid with its label
    (u.shelves || []).forEach(function(sh){
      var y = yBot - sh.mm * k;
      s += ln(x0 + 0.8, y, x0 + w - 0.8, y, C.thin, sh.fixed ? 0.4 : 0.3, sh.fixed ? "" : DASH);
      s += tx(x0 + 1.6, y - 0.9, sh.vent ? "LH" : sh.fixed ? "FH" : "H3", 1.9, C.text);
    });
    (u.rails || []).forEach(function(mm){
      var y = yBot - mm * k;
      s += ln(x0 + 2, y, x0 + w - 2, y, C.thin, 0.5) + tx(x0 + w - 2, y - 1, "SLA", 1.9, C.text, ' text-anchor="end"');
    });
    // doors (top → bottom): the leaf outline + the opening lines pointing AWAY from the hinges
    var dy = yTop;
    (u.doors || []).forEach(function(d){
      var dh = d.h * k, leaves = d.hinge === "both" ? [[x0, w / 2, "left"], [x0 + w / 2, w / 2, "right"]] : [[x0, w, d.hinge]];
      leaves.forEach(function(L){
        var lx = L[0], lw = L[1], side = L[2];
        s += rc(lx + 0.4, dy + 0.4, lw - 0.8, dh - 0.8, C.ink, 0.25);
        if (side === "left") s += ln(lx + 0.4, dy + 0.4, lx + lw - 0.4, dy + dh / 2, C.thin, 0.2, DASH) + ln(lx + 0.4, dy + dh - 0.4, lx + lw - 0.4, dy + dh / 2, C.thin, 0.2, DASH);
        else if (side === "right") s += ln(lx + lw - 0.4, dy + 0.4, lx + 0.4, dy + dh / 2, C.thin, 0.2, DASH) + ln(lx + lw - 0.4, dy + dh - 0.4, lx + 0.4, dy + dh / 2, C.thin, 0.2, DASH);
        else if (side === "top") s += ln(lx + 0.4, dy + 0.4, lx + lw / 2, dy + dh - 0.4, C.thin, 0.2, DASH) + ln(lx + lw - 0.4, dy + 0.4, lx + lw / 2, dy + dh - 0.4, C.thin, 0.2, DASH);
        else if (side === "pocket") s += tx(lx + lw / 2, dy + dh / 2, "RENNIHURÐ", 1.9, C.text, ' text-anchor="middle"');
      });
      if (d.push) s += tx(x0 + w - 1, dy + 2.4, "PUSH", 1.6, C.text, ' text-anchor="end"');
      dy += dh;
    });
    if (u.led === "hlid-vinstri" || u.led === "hlid-haegri"){ // fataskápur: 6×6 strip in a groove up one side (C4 — must not be forgotten)
      var lxs = u.led === "hlid-vinstri" ? x0 + 1 : x0 + w - 1;
      s += ln(lxs, yTop + 2, lxs, yBot - 2, C.led, 0.6) + tx(lxs + (u.led === "hlid-vinstri" ? 1 : -1), yTop + 5, "LED RAUF", 1.7, C.led, ' font-weight="700"' + (u.led === "hlid-vinstri" ? "" : ' text-anchor="end"'));
    } else if (u.led === "hilla") s += ln(x0 + 0.6, yTop + h * 0.16, x0 + w - 0.6, yTop + h * 0.16, C.led, 0.6) + tx(x0 + w / 2, yTop + h * 0.16 - 0.8, "LED", 1.7, C.led, ' text-anchor="middle" font-weight="700"');
    else if (u.led) s += ln(x0 + 0.6, yBot - 0.5, x0 + w - 0.6, yBot - 0.5, C.led, 0.6);
    // SK number outside the unit, where it never collides with a drawer/shelf label: floor units on a row just under
    // the floor line, wall units just under their own bottom edge
    if (u.sk) s += u.zone === "wall" ? tx(x0 + w / 2, yBot + 3, u.sk.toUpperCase(), 2.4, C.sk, ' text-anchor="middle" font-weight="700"')
      : tx(x0 + w / 2, yb + 3.2, u.sk.toUpperCase(), 2.4, C.sk, ' text-anchor="middle" font-weight="700"');
    return s;
  }

  function annotationsSvg(list, X, Y){
    var s = "";
    (list || []).forEach(function(a){
      var p = { x:X(a.a.x), y:Y(a.a.y) };
      if (a.kind === "arrow" && a.b) s += ln(p.x, p.y, X(a.b.x), Y(a.b.y), C.anno, 0.35, ' marker-end="url(#wdArrow)"');
      else if (a.kind === "text"){
        var lines = String(a.text || "").split("\n");
        lines.forEach(function(l, i){ s += tx(p.x, p.y + i * 3, l, 2.3, C.anno, ' font-weight="600"'); });
      } else if (a.kind === "symbol"){
        s += '<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="1.8" fill="' + C.anno + '"/>' + tx(p.x, p.y + 0.8, a.glyph || "!", 2.2, "#fff", ' text-anchor="middle" font-weight="700"') +
          (a.text || a.symLabel ? tx(p.x + 2.6, p.y + 0.8, a.text || a.symLabel, 2, C.anno, ' font-weight="600"') : "");
      }
    });
    return s;
  }

  // ── right column: minimap, notes, legend, title block ──
  function column(model, sheet, idx, total, scale){
    var x = PAGE_W - M - COL_W, s = "", y = M;
    if (sheet.wallId && model.planGeo){
      s += rc(x, y, COL_W, 62, C.thin, 0.25, "#fff") + planSvg(model.planGeo, { x:x + 3, y:y + 3, w:COL_W - 6, h:56 }, { mini:true, selectedWallId:sheet.wallId });
      y += 66;
    } else if (sheet.minimap){
      s += rc(x, y, COL_W, 62, C.thin, 0.25, "#fff") + '<svg x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (COL_W - 2) + '" height="60" viewBox="' + sheet.minimap.viewBox + '" preserveAspectRatio="xMidYMid meet">' + sheet.minimap.inner + '</svg>';
      y += 66;
    }
    var notes = (model.notes || []).concat(sheet.notes || []);
    if (notes.length){
      // black + larger (user, 2026-10-26): the green 2.1 mm notes were hard to read on a printed sheet
      s += tx(x, y + 2.8, "ATHUGASEMDIR", 2.7, C.ink, ' font-weight="700"'); y += 5.6;
      var yMax = PAGE_H - M - 34 - 16 - 5, cut = false; // stop above the legend
      notes.forEach(function(t){
        wrap(t, 52).forEach(function(l){ if (y + 3.5 > yMax){ cut = true; return; } s += tx(x, y + 2.6, l, 2.5, C.ink); y += 3.5; });
        y += 1.3;
      });
      if (cut) s += tx(x, yMax + 2.6, "… fleiri athugasemdir í Line Items", 2.2, C.thin);
    }
    // legend
    var leg = [["ÚTHLIÐ", C.ink, "fill"], ["ÁFELLA", "url(#wdHatch)", "pat"], ["SK", C.sk, "fill"], ["LED", C.led, "fill"], ["GRIP", C.grip, "fill"],
      ["TEXTI", C.text, "fill"], ["MERIVO", C.merivo, "fill"], ["LEGRA", C.legra, "fill"], ["BLIND LOK", "url(#wdCross)", "pat"], ["SÖKKULL", "url(#wdPlinth)", "pat"]];
    var ly = PAGE_H - M - 34 - 16;
    leg.forEach(function(L, i){
      var cx = x + (i % 5) * (COL_W / 5), cy = ly + Math.floor(i / 5) * 8;
      s += rc(cx, cy, 4, 4, C.thin, 0.2, L[1]) + tx(cx + 5, cy + 3.2, L[0], 1.6, L[0] === "SK" ? C.sk : L[2] === "fill" && L[1] !== C.ink ? L[1] : C.ink);
    });
    // title block
    var ty = PAGE_H - M - 30;
    s += rc(x, ty, COL_W, 30, C.ink, 0.35);
    s += tx(x + 3, ty + 6, "BJÖRNINN INNRÉTTINGAR", 3, C.ink, ' font-weight="800" letter-spacing=".2"');
    s += tx(x + 3, ty + 11.5, model.project || "", 2.6, C.ink, ' font-weight="600"');
    s += tx(x + 3, ty + 16.5, sheet.title, 2.6, C.ink);
    s += ln(x, ty + 19.5, x + COL_W, ty + 19.5, C.ink, 0.2);
    s += tx(x + 3, ty + 25, "Mkv. " + (scale ? "1:" + scale : "—") + " (A3)", 2.2, C.ink) + tx(x + COL_W / 2, ty + 25, model.date || "", 2.2, C.ink, ' text-anchor="middle"') +
      tx(x + COL_W - 3, ty + 25, "Blað " + idx + "/" + total, 2.2, C.ink, ' text-anchor="end"');
    return s;
  }
  function wrap(t, chars){
    var words = String(t).split(/\s+/), out = [], cur = "";
    words.forEach(function(w){ if ((cur + " " + w).trim().length > chars && cur){ out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) out.push(cur);
    return out;
  }
  function page(body){
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + PAGE_W + 'mm" height="' + PAGE_H + 'mm" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" font-family="Arial, Helvetica, sans-serif">' +
      DEFS + rc(0, 0, PAGE_W, PAGE_H, "none", 0, "#fff") + rc(M / 2, M / 2, PAGE_W - M, PAGE_H - M, C.ink, 0.35) + body + '</svg>';
  }

  // ── a wall sheet ──
  function wallSheet(model, sheet, idx, total){
    var sys = model.drawerSystem, units = sheet.units || [];
    var maxD = Math.max(300, Math.max.apply(null, units.map(function(u){ return u.d || 0; }).concat([0])));
    var areaW = PAGE_W - 2 * M - COL_W - 8, areaH = PAGE_H - 2 * M - 6;
    // needed (mm at 1:1): elevation width + dims (≈ 40 mm on paper each side, scale-independent → reserve on paper)
    var paperDims = 34, gapPaper = 14;
    var scale = pickScale(sheet.lenMm + maxD + 1, sheet.roomH + maxD, areaW - paperDims - gapPaper - 26, areaH - paperDims - gapPaper - 6);
    var k = 1 / scale;
    var blockH = 2 + maxD * k + gapPaper + 14 + sheet.roomH * k + 20; // plan strip → elevation → its dimension rows
    var ex = M + 22, planTop = M + 10 + Math.max(0, (areaH - 10 - blockH) / 2), wallY = planTop + 2, planBot = wallY + maxD * k;
    var yb = planBot + gapPaper + 14 + sheet.roomH * k; // floor line of the elevation
    var X = function(mm){ return ex + mm * k; }, Y = function(mm){ return yb - mm * k; };
    var s = "";
    s += tx(ex, M + 6, sheet.title.toUpperCase(), 3.4, C.ink, ' font-weight="800"');
    // ── plan strip (top view): wall at the top, units hanging below it, wall units dashed ──
    s += rc(X(0), wallY - 2.2, sheet.lenMm * k, 2.2, "#8a8a90", 0.2, "url(#wdWall)");
    (sheet.openings || []).forEach(function(o){ if (o.kind !== "window") s += rc(X(o.x), wallY - 2.2, o.w * k, 2.2, "none", 0, "#fff"); });
    units.forEach(function(u){
      var y0 = wallY + (u.outMm || 0) * k;
      if (u.panel) s += rc(X(u.x), y0, u.w * k, (u.d || 19) * k, C.ink, 0.2, C.ink);
      else {
        s += rc(X(u.x), y0, u.w * k, u.d * k, u.zone === "wall" ? C.thin : C.ink, u.zone === "wall" ? 0.25 : 0.35, "none", u.zone === "wall" ? DASH : "");
        if (u.sk && u.zone !== "wall") s += tx(X(u.x + u.w / 2), y0 + u.d * k / 2 + 1, u.sk.toUpperCase(), 2.3, C.sk, ' text-anchor="middle" font-weight="700"');
        (u.doors || []).forEach(function(d, i){ // door swing in plan (first leaf set only, floor + tall units)
          if (i || u.zone === "wall" || !(d.hinge === "left" || d.hinge === "right" || d.hinge === "both")) return;
          var leaves = d.hinge === "both" ? [["left", u.x, u.w / 2], ["right", u.x + u.w / 2, u.w / 2]] : [[d.hinge, u.x, u.w]];
          leaves.forEach(function(L){
            var r = L[2] * k, fy = y0 + u.d * k, hx = L[0] === "left" ? X(L[1]) : X(L[1] + L[2]), ex2 = L[0] === "left" ? hx + r : hx - r;
            s += ln(hx, fy, hx, fy + r, C.open, 0.2) + '<path d="M ' + n(hx) + ' ' + n(fy + r) + ' A ' + n(r) + ' ' + n(r) + ' 0 0 ' + (L[0] === "left" ? 0 : 1) + ' ' + n(ex2) + ' ' + n(fy) + '" fill="none" stroke="' + C.open + '" stroke-width="0.18"' + DASH_S + '/>';
          });
        });
      }
    });
    // plan depth dim (deepest unit)
    s += dim(X(0) - 6, wallY, X(0) - 6, wallY + maxD * k, Math.round(maxD));
    // ── elevation ──
    s += ln(X(0) - 4, yb, X(sheet.lenMm) + 4, yb, C.ink, 0.45); // floor
    s += ln(X(0), yb, X(0), Y(sheet.roomH), C.thin, 0.2, DASH) + ln(X(sheet.lenMm), yb, X(sheet.lenMm), Y(sheet.roomH), C.thin, 0.2, DASH); // wall ends
    s += ln(X(0), Y(sheet.roomH), X(sheet.lenMm), Y(sheet.roomH), C.thin, 0.2, DASH); // ceiling
    (sheet.openings || []).forEach(function(o){
      s += rc(X(o.x), Y(o.y0 + o.h), o.w * k, o.h * k, C.open, 0.25, "none", o.kind === "gap" ? DASH : "");
      s += tx(X(o.x + o.w / 2), Y(o.y0 + o.h / 2), o.kind === "window" ? "GLUGGI" : o.kind === "gap" ? "OP" : "HURÐ", 2, C.open, ' text-anchor="middle"');
    });
    (sheet.afella || []).forEach(function(a){ s += rc(X(a.x), Y(a.y0 + a.h), a.w * k, a.h * k, C.thin, 0.2, "url(#wdHatch)"); });
    if (sheet.worktop) sheet.worktop.forEach(function(t){ s += rc(X(t.x), Y(t.y + t.t), t.w * k, t.t * k, C.ink, 0.3, "#e9e7e1"); });
    units.forEach(function(u){ s += unitElev(u, X(u.x), yb, k, sys); });
    s += annotationsSvg(sheet.annotations, X, Y);
    // ── dimension chains ──
    var floorU = units.filter(function(u){ return u.zone === "floor"; }), wallU = units.filter(function(u){ return u.zone === "wall"; });
    var fp = [0, sheet.lenMm]; floorU.forEach(function(u){ fp.push(u.x, u.x + u.w); }); (sheet.afella || []).forEach(function(a){ fp.push(a.x, a.x + a.w); });
    fp.sort(function(a, b){ return a - b; });
    s += chain(fp, yb + 9, false, X);
    s += dim(X(0), yb + 16, X(sheet.lenMm), yb + 16, Math.round(sheet.lenMm), { bold:true, size:2.6 });
    if (wallU.length){
      var wp = []; wallU.forEach(function(u){ wp.push(u.x, u.x + u.w); }); wp.sort(function(a, b){ return a - b; });
      s += chain(wp, Y(sheet.roomH) - 5, false, X);
    }
    var hp = [0, sheet.roomH];
    units.forEach(function(u){ if (!u.panel){ hp.push(u.y0, u.y0 + u.h); if (u.plinth) hp.push(u.plinth); } });
    if (sheet.worktop) sheet.worktop.forEach(function(t){ hp.push(t.y + t.t); });
    hp = hp.filter(function(v){ return v >= 0 && v <= sheet.roomH; }).sort(function(a, b){ return a - b; });
    var hx = X(sheet.lenMm) + 7;
    s += chain(hp, hx, true, Y);
    s += dim(hx + 7, yb, hx + 7, Y(sheet.roomH), Math.round(sheet.roomH), { bold:true, size:2.6 });
    // ── end section (seen from the wall's left end): every distinct profile, the wall on the left ──
    var sx = hx + 18, prof = {};
    units.forEach(function(u){ if (u.panel) return; var key = [u.zone, u.d, u.y0, u.h, u.plinth || 0].join("|"); if (!prof[key]) prof[key] = u; });
    var SX = function(mm){ return sx + mm * k; };
    s += tx(sx, Y(sheet.roomH) - 3, "HLIÐARSNIÐ", 2.3, C.ink, ' font-weight="700"');
    s += rc(sx - 2.2, Y(sheet.roomH), 2.2, sheet.roomH * k, "#8a8a90", 0.2, "url(#wdWall)") + ln(sx - 2.2, yb, SX(maxD) + 6, yb, C.ink, 0.45);
    var depths = [0];
    Object.keys(prof).forEach(function(key){
      var u = prof[key];
      if (u.plinth) s += rc(SX(40), Y(u.plinth), (u.d - 40 - 50) * k, u.plinth * k, C.plinth, 0.25, "url(#wdPlinth)");
      s += rc(SX(0), Y(u.y0 + u.h), u.d * k, u.h * k, C.ink, 0.3);
      s += rc(SX(u.d), Y(u.y0 + u.h), 19 * k, u.h * k, C.ink, 0.2, "#fff"); // front thickness
      depths.push(u.d);
    });
    if (sheet.worktop && sheet.worktop[0]){ var wt = sheet.worktop[0]; s += rc(SX(0), Y(wt.y + wt.t), (wt.d || 620) * k, wt.t * k, C.ink, 0.3, "#e9e7e1"); depths.push(wt.d || 620); }
    depths = depths.filter(function(v, i, a){ return a.indexOf(v) === i; }).sort(function(a, b){ return a - b; });
    s += chain(depths, yb + 6, false, SX);
    // ── right column ──
    s += column(model, sheet, idx, total, scale);
    return page(s);
  }

  // ── clean line-drawing plan (sheet 1 + every sheet's minimap) ──
  // geo (metres, room coordinates, page y = room z — the same orientation as the editor's 2D plan):
  //   walls [{a:{x,z}, b:{x,z}, n:{x,z} (into the room), open, id, label, lenMm}], openings [{a, b, n, kind, sweep:{h,u,v,r}|null}],
  //   units [{poly:[{x,z}…], zone, sk, panel}], obstacles [{poly}]
  function planSvg(geo, box, opts){
    opts = opts || {};
    if (!geo || !geo.walls || !geo.walls.length) return "";
    var xs = [], zs = [];
    geo.walls.forEach(function(w){ xs.push(w.a.x, w.b.x); zs.push(w.a.z, w.b.z); });
    (geo.units || []).forEach(function(u){ u.poly.forEach(function(p){ xs.push(p.x); zs.push(p.z); }); });
    var pad = opts.mini ? 0.25 : 0.9, x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad, z0 = Math.min.apply(null, zs) - pad, z1 = Math.max.apply(null, zs) + pad;
    var sc = Math.min(box.w / (x1 - x0), box.h / (z1 - z0)), ox = box.x + (box.w - (x1 - x0) * sc) / 2, oy = box.y + (box.h - (z1 - z0) * sc) / 2;
    var P = function(p){ return { x:ox + (p.x - x0) * sc, y:oy + (p.z - z0) * sc }; };
    var T = (opts.mini ? 0.12 : 0.1) * sc, s = ""; // wall thickness on paper
    function poly(pts, stroke, sw, fill, extra){ return '<polygon points="' + pts.map(function(p){ var q = P(p); return n(q.x) + "," + n(q.y); }).join(" ") + '" stroke="' + stroke + '" stroke-width="' + sw + '" fill="' + (fill || "none") + '"' + (extra || "") + '/>'; }
    // walls: a filled band on the outside of each wall line, with the openings cut out of it
    geo.walls.forEach(function(w){
      var sel = opts.selectedWallId && w.id === opts.selectedWallId;
      if (w.open){ var a0 = P(w.a), b0 = P(w.b); s += ln(a0.x, a0.y, b0.x, b0.y, C.open, 0.25, DASH); return; }
      var ops = (geo.openings || []).filter(function(o){ return o.wallId === w.id; }).map(function(o){ return [o.t0, o.t1]; }).sort(function(p, q){ return p[0] - q[0]; });
      var segs = [], t = 0; ops.forEach(function(o){ if (o[0] > t) segs.push([t, o[0]]); t = Math.max(t, o[1]); }); if (t < 1) segs.push([t, 1]);
      var dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
      var L = Math.hypot(dx, dz) || 1, ext = T / sc / L; // a wall's band runs one thickness past each end so outside corners close
      segs.forEach(function(g){
        var t0 = g[0] === 0 ? -ext : g[0], t1 = g[1] === 1 ? 1 + ext : g[1];
        var p0 = { x:w.a.x + dx * t0, z:w.a.z + dz * t0 }, p1 = { x:w.a.x + dx * t1, z:w.a.z + dz * t1 };
        var o = T / sc, q0 = { x:p0.x - w.n.x * o, z:p0.z - w.n.z * o }, q1 = { x:p1.x - w.n.x * o, z:p1.z - w.n.z * o };
        s += poly([p0, p1, q1, q0], sel ? C.grip : C.ink, opts.mini ? 0.15 : 0.3, sel ? C.grip : (opts.mini ? C.ink : "url(#wdWall)"));
      });
      if (!opts.mini && !opts.noWallLabels){ // wall name + its length, outside the room
        var mid = { x:(w.a.x + w.b.x) / 2 - w.n.x * (T / sc + 0.32), z:(w.a.z + w.b.z) / 2 - w.n.z * (T / sc + 0.32) }, mp = P(mid);
        s += tx(mp.x, mp.y - 0.4, w.label + " · " + Math.round(w.lenMm), 2.4, C.ink, ' text-anchor="middle" font-weight="600"');
      }
    });
    (geo.openings || []).forEach(function(o){
      var a = P(o.a), b = P(o.b);
      if (o.kind === "window"){ var oo = { x:-o.n.x * T / 2, y:-o.n.z * T / 2 };
        s += ln(a.x, a.y, b.x, b.y, C.thin, 0.2) + ln(a.x + oo.x * 2, a.y + oo.y * 2, b.x + oo.x * 2, b.y + oo.y * 2, C.thin, 0.2) + ln(a.x + oo.x, a.y + oo.y, b.x + oo.x, b.y + oo.y, C.thin, 0.35);
      } else if (o.sweep){
        var sw = o.sweep, h = P(sw.h), tip = P({ x:sw.h.x + sw.v.x * sw.r, z:sw.h.z + sw.v.z * sw.r }), lat = P({ x:sw.h.x + sw.u.x * sw.r, z:sw.h.z + sw.u.z * sw.r }), r = sw.r * sc;
        var cr = sw.v.x * sw.u.z - sw.v.z * sw.u.x;
        s += ln(h.x, h.y, tip.x, tip.y, C.ink, 0.3) + '<path d="M ' + n(tip.x) + ' ' + n(tip.y) + ' A ' + n(r) + ' ' + n(r) + ' 0 0 ' + (cr > 0 ? 1 : 0) + ' ' + n(lat.x) + ' ' + n(lat.y) + '" fill="none" stroke="' + C.thin + '" stroke-width="0.2"' + DASH_S + '/>';
      } else if (o.kind === "slide"){ var so = { x:o.n.x * 0.04 * sc, y:o.n.z * 0.04 * sc }; s += ln(a.x + so.x, a.y + so.y, b.x + so.x, b.y + so.y, C.ink, 0.45); }
    });
    (geo.obstacles || []).forEach(function(o){ s += poly(o.poly, C.thin, 0.2, "url(#wdHatch)"); });
    (geo.labels || []).forEach(function(l){ var lp = P(l); s += tx(lp.x, lp.y - 0.6, l.text, 3.2, C.ink, ' text-anchor="middle" font-weight="800"') + (l.sub ? tx(lp.x, lp.y + 3.4, l.sub, 2.3, C.thin, ' text-anchor="middle"') : ""); }); // room names (Allt heimilið)
    var labels = ""; // drawn after every footprint, so a dashed wall unit above never runs through a floor unit's Sk
    (geo.units || []).forEach(function(u){
      if (u.panel){ s += poly(u.poly, C.ink, 0.2, C.ink); return; }
      s += poly(u.poly, u.zone === "wall" ? C.thin : C.ink, u.zone === "wall" ? 0.2 : (opts.mini ? 0.18 : 0.3), u.zone === "wall" ? "none" : "#fff", u.zone === "wall" ? DASH : "");
      if (!opts.mini && u.sk && u.zone !== "wall"){
        var c = u.poly.reduce(function(acc, p){ return { x:acc.x + p.x / u.poly.length, z:acc.z + p.z / u.poly.length }; }, { x:0, z:0 }), cp = P(c);
        // twice the old 2.3 (user, 2026-10-26: "tiny" on the Grunnmynd), shrunk only where the footprint is too small
        var qs = u.poly.map(P), qx = qs.map(function(q){ return q.x; }), qy = qs.map(function(q){ return q.y; });
        var fw = Math.max.apply(null, qx) - Math.min.apply(null, qx), fh = Math.max.apply(null, qy) - Math.min.apply(null, qy), lab = u.sk.toUpperCase();
        var fs = Math.max(2.3, Math.min(4.6, (Math.max(fw, fh) - 1) / (lab.length * 0.62), Math.min(fw, fh) * 0.8));
        var vert = fh > fw * 1.4 && fw < lab.length * 0.62 * fs; // a deep, narrow footprint (side wall run seen from above): read along it
        labels += tx(cp.x, cp.y + fs * 0.36, lab, n(fs), C.sk, ' text-anchor="middle" font-weight="700" stroke="#fff" stroke-width="0.7" paint-order="stroke"' + (vert ? ' transform="rotate(-90 ' + n(cp.x) + ' ' + n(cp.y) + ')"' : ""));
      }
    });
    return s + labels;
  }

  // ── sheet 1: the whole room ──
  function overviewSheet(model, idx, total){
    var x = M + 6, y = M + 12, w = PAGE_W - 2 * M - COL_W - 14, h = PAGE_H - 2 * M - 22;
    var s = tx(x, M + 7, "GRUNNMYND — " + (model.roomName || "RÝMIÐ").toUpperCase(), 3.4, C.ink, ' font-weight="800"');
    if (model.planGeo) s += planSvg(model.planGeo, { x:x, y:y, w:w, h:h }, {});
    else if (model.plan) s += '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" viewBox="' + model.plan.viewBox + '" preserveAspectRatio="xMidYMid meet">' + model.plan.inner + '</svg>';
    s += column(model, { title:"Grunnmynd", minimap:null, notes:[] }, idx, total, null);
    return page(s);
  }

  // ── Allt heimilið (2026-10-23): every room on one sheet, placed as on the home plan — geo is a merged planGeo with
  // room labels; wall names are left off (each room's own sheets carry them) ──
  function homeSheet(model, geo, idx, total){
    var x = M + 6, y = M + 12, w = PAGE_W - 2 * M - COL_W - 14, h = PAGE_H - 2 * M - 22;
    var s = tx(x, M + 7, "GRUNNMYND — ALLT HEIMILIÐ", 3.4, C.ink, ' font-weight="800"');
    s += planSvg(geo, { x:x, y:y, w:w, h:h }, { noWallLabels:true });
    s += column(model, { title:"Allt heimilið", minimap:null, notes:["Innveggir milli rýma eru teiknaðir sem bil — mál staðfest á staðnum."] }, idx, total, null);
    return page(s);
  }

  // ── Forsíða (2026-10-23, I1): one PDF for the whole project — the rooms, their sheets and the door list ──
  // project = {name, date, rooms:[{name, sheets, units, notes:[]}], doors:n, totalSheets}
  function coverSheet(project){
    var x = M + 14, y = M + 26, s = tx(x, y, "VINNUTEIKNINGAR", 9, C.ink, ' font-weight="800" letter-spacing="0.6"');
    s += tx(x, y + 12, project.name || "Verkefni", 6, C.ink, ' font-weight="700"');
    s += tx(x, y + 21, (project.date || "") + " · " + project.totalSheets + " blöð (A3)", 3.2, C.thin);
    var ty = y + 40, colW = 120;
    s += tx(x, ty, "EFNISYFIRLIT", 3, C.text, ' font-weight="700"'); ty += 7;
    var pg = 2;
    if (project.home){ s += tx(x, ty, "Allt heimilið — grunnmynd", 3.4, C.ink, ' font-weight="700"') + tx(x + colW, ty, "bls. 2", 3, C.thin, ' text-anchor="end"') + ln(x, ty + 1.6, x + colW, ty + 1.6, "#d4d4d8", 0.15); ty += 13; pg = 3; }
    (project.rooms || []).forEach(function(r){
      s += tx(x, ty, r.name, 3.4, C.ink, ' font-weight="700"') + tx(x + colW, ty, "bls. " + pg + (r.sheets > 1 ? "–" + (pg + r.sheets - 1) : ""), 3, C.thin, ' text-anchor="end"');
      s += ln(x, ty + 1.6, x + colW, ty + 1.6, "#d4d4d8", 0.15);
      ty += 5;
      s += tx(x + 2, ty, r.units + " einingar" + (r.notes && r.notes.length ? " · " + r.notes.slice(0, 3).join(" · ") : ""), 2.4, C.thin);
      ty += 8; pg += r.sheets;
    });
    if (project.cabinets){ s += tx(x, ty, "Skápalisti", 3.4, C.ink, ' font-weight="700"') + tx(x + colW, ty, "bls. " + pg + (project.cabinets.sheets > 1 ? "–" + (pg + project.cabinets.sheets - 1) : ""), 3, C.thin, ' text-anchor="end"') + ln(x, ty + 1.6, x + colW, ty + 1.6, "#d4d4d8", 0.15); ty += 5;
      s += tx(x + 2, ty, project.cabinets.rows + " einingar — mál, skúffur, hurðir og hillur", 2.4, C.thin); ty += 8; pg += project.cabinets.sheets; }
    if (project.doors){ s += tx(x, ty, "Hurðalisti", 3.4, C.ink, ' font-weight="700"') + tx(x + colW, ty, "bls. " + pg, 3, C.thin, ' text-anchor="end"') + ln(x, ty + 1.6, x + colW, ty + 1.6, "#d4d4d8", 0.15); ty += 5; s += tx(x + 2, ty, project.doors + (project.doors === 1 ? " hurð" : " hurðir"), 2.4, C.thin); }
    s += tx(PAGE_W - M - 14, PAGE_H - M - 10, "BJÖRNINN INNRÉTTINGAR", 4, C.ink, ' text-anchor="end" font-weight="800"');
    s += tx(PAGE_W - M - 14, PAGE_H - M - 4, "Drög — mál staðfest á staðnum", 2.6, C.thin, ' text-anchor="end"');
    return page(s);
  }

  // ── Hurðalisti (2026-10-23, I2): every door in the project's door list as one table, a small elevation per row
  // (hinge side by DIN: seen from the side the door opens towards; dashed point away from the hinges) ──
  // doors = [{hu, room, kind, product, w, h, wall, hinge:"left"|"right", slide, leaf, qty, note}]
  function doorSheet(model, doors, idx, total){
    var x = M + 6, y = M + 8, s = tx(x, M + 7, "HURÐALISTI — " + (model.project || "").toUpperCase(), 3.4, C.ink, ' font-weight="800"');
    var cols = [["", 16], ["HU", 13], ["Rými", 26], ["Vara", 80], ["Op B × H", 24], ["Veggþ.", 13], ["Lamir (DIN)", 27], ["Efni hurðarblaðs", 46], ["Stk", 9], ["Athugasemd", 0]];
    var tw = PAGE_W - 2 * M - COL_W - 16, used = cols.reduce(function(a, c){ return a + c[1]; }, 0); cols[cols.length - 1][1] = Math.max(20, tw - used);
    y += 6;
    var cx = x; cols.forEach(function(c){ s += tx(cx + 1, y, c[0], 2.2, C.ink, ' font-weight="700"'); cx += c[1]; });
    s += ln(x, y + 1.6, x + tw, y + 1.6, C.ink, 0.3);
    var rowH = 15, ry = y + 2;
    doors.slice(0, 15).forEach(function(d, i){
      var top = ry + i * rowH; cx = x;
      // the glyph: frame + leaf + dashed swing point, or an arrow for a sliding door
      var gw = 7, gh = 11, gx = cx + 4, gy = top + 2;
      s += rc(gx - 0.8, gy - 0.8, gw + 1.6, gh + 0.8, C.ink, 0.3);
      if (d.kind !== "karmur"){
        s += rc(gx, gy, gw, gh, C.thin, 0.2, d.glass ? "#e3f0f7" : "#fff");
        if (d.slide) s += tx(gx + gw / 2, gy + gh / 2 + 1, d.hinge === "left" ? "→" : "←", 3, C.ink, ' text-anchor="middle"');
        else { var hx = d.hinge === "left" ? gx : gx + gw, px = d.hinge === "left" ? gx + gw : gx; s += '<path d="M' + n(hx) + ' ' + n(gy) + ' L' + n(px) + ' ' + n(gy + gh / 2) + ' L' + n(hx) + ' ' + n(gy + gh) + '" fill="none" stroke="' + C.open + '" stroke-width="0.25"' + DASH_S + '/>'; }
      }
      cx += cols[0][1];
      var cells = [d.hu, d.room || "—", d.product || "—", d.w + " × " + d.h, d.wall, d.kind === "karmur" ? "—" : d.slide ? "Rennur til " + (d.hinge === "left" ? "hægri" : "vinstri") : (d.hinge === "left" ? "Vinstri" : "Hægri"), d.leaf || "—", d.qty, d.note || ""];
      cells.forEach(function(v, j){
        var cw = cols[j + 1][1], lines = wrap(String(v), Math.max(6, Math.floor(cw / 1.25)));
        lines.slice(0, 3).forEach(function(l, k){ s += tx(cx + 1, top + 5 + k * 3, l, 2.1, j === 0 ? C.ink : C.thin, j === 0 ? ' font-weight="700"' : ""); });
        cx += cw;
      });
      s += ln(x, top + rowH, x + tw, top + rowH, "#c9c9cf", 0.15);
    });
    if (doors.length > 15) s += tx(x, ry + 15 * rowH + 5, "+ " + (doors.length - 15) + " hurðir í viðbót — sjá Line Items.", 2.3, C.anno);
    s += column(model, { title:"Hurðalisti", minimap:null, notes:["Lamir eftir DIN: séð frá hliðinni sem hurðin opnast að.", "Mál eru op í vegg — staðfest á staðnum.", "Karmur er innifalinn í HU-vörunum."] }, idx, total, null);
    return page(s);
  }

  // ── Skápalisti (2026-10-26): one row per Sk, the numbers the Line Items / Keyra skipulag / /cnc get (the planner
  // builds the rows from each line's own Smíðagögn — wdCabinetRows — so the list can't disagree with what is built).
  // rows = [{sk, type, product, size, front, drawers, doors, shelves, grip, note} | {group:"Eldhús"}]; part/parts when
  // a project needs more than one sheet ──
  var CAB_ROWS = 18;
  function cabinetSheet(model, rows, idx, total, part, parts){
    var x = M + 6, y = M + 8, s = tx(x, M + 7, "SKÁPALISTI — " + (model.project || "").toUpperCase() + (parts > 1 ? " (" + part + "/" + parts + ")" : ""), 3.4, C.ink, ' font-weight="800"');
    var cols = [["Sk", 12], ["Tegund", 46], ["B × H × D", 27], ["Framhlið", 17], ["Skúffur (ofan frá, mm)", 44], ["Hurðir / lamir", 38], ["Hillur", 26], ["Grip / höldur", 26], ["Athugasemd", 0]];
    var tw = PAGE_W - 2 * M - COL_W - 16, used = cols.reduce(function(a, c){ return a + c[1]; }, 0); cols[cols.length - 1][1] = Math.max(20, tw - used);
    y += 6;
    var cx = x; cols.forEach(function(c){ s += tx(cx + 1, y, c[0], 2.4, C.ink, ' font-weight="700"'); cx += c[1]; });
    s += ln(x, y + 1.6, x + tw, y + 1.6, C.ink, 0.3);
    var top = y + 2, rowH = 12.5;
    rows.forEach(function(r){
      if (r.group){ s += tx(x + 1, top + 5, String(r.group).toUpperCase(), 2.3, C.ink, ' font-weight="700" letter-spacing=".3"') + ln(x, top + 6.6, x + tw, top + 6.6, C.thin, 0.2); top += 7.5; return; }
      cx = x;
      var cells = [r.sk, [r.type, r.product].filter(Boolean).join(" · "), r.size, r.front, r.drawers, r.doors, r.shelves, r.grip, r.note];
      cells.forEach(function(v, j){
        var cw = cols[j][1], lines = wrap(String(v == null || v === "" ? "—" : v), Math.max(5, Math.floor(cw / 1.32)));
        if (lines.length > 3){ lines = lines.slice(0, 3); lines[2] = lines[2].replace(/.{0,2}$/, "…"); }
        lines.forEach(function(l, k){ s += tx(cx + 1, top + 4.4 + k * 3.4, l, j === 0 ? 3 : 2.5, j === 0 ? C.sk : C.ink, j === 0 ? ' font-weight="800"' : ""); });
        cx += cw;
      });
      top += rowH;
      s += ln(x, top - 0.6, x + tw, top - 0.6, "#c9c9cf", 0.15);
    });
    s += column(model, { title:"Skápalisti", minimap:null, notes:["B × H × D = skrokkurinn í mm, án sökkuls og borðplötu.", "Skúffur ofan frá; talan = Sérhæð (raufin) í mm, framhliðin er 3 mm minni.",
      "Lamir: fjöldi á hverja hurð; hlið séð framan frá.", "Sama og fer í Line Items (Smíðagögn), Keyra skipulag og /cnc."] }, idx, total, null);
    return page(s);
  }
  // rows → as many sheets as they need (group headers count as rows, a group header never ends a sheet)
  function cabinetSheets(model, rows, startIdx, total){
    var chunks = [[]], n = 0;
    rows.forEach(function(r, i){
      var w = r.group ? 0.7 : 1, lastGroup = r.group && i === rows.length - 1;
      if (lastGroup) return;
      if (n + w > CAB_ROWS || (r.group && n + w + 1 > CAB_ROWS)){ chunks.push([]); n = 0; }
      chunks[chunks.length - 1].push(r); n += w;
    });
    return chunks.map(function(c, i){ return cabinetSheet(model, c, startIdx + i, total, i + 1, chunks.length); });
  }
  function cabinetSheetCount(rows){ return cabinetSheets({}, rows, 1, 1).length; }

  // ── Borðplata (2026-10-26): one sheet per room with a worktop. wt = { room, kind:"inhouse"|"stone", top:{label, code,
  // groupLabel, thick}, plan:{inner, viewBox} (KPWT.planSvg), pieces:[{label, wall, len, depth, front, ends, edges, upstand,
  // note, cutouts:[text]}], joints:[text], notes:[text] }. In-house = every number is production data (cut here);
  // stone = the layout + what goes where, the stone maker measures on site. ──
  function worktopSheet(model, wt, idx, total){
    var stone = wt.kind === "stone", x = M + 6, top = M + 8, tw = PAGE_W - 2 * M - COL_W - 16;
    var s = tx(x, M + 7, "BORÐPLATA — " + (model.project || "").toUpperCase() + (wt.room ? " · " + String(wt.room).toUpperCase() : ""), 3.4, C.ink, ' font-weight="800"');
    s += tx(x, top + 4, (wt.top.label || "") + (wt.top.code ? " · Egger " + wt.top.code : "") + " · " + wt.top.thick + " mm · " + (stone ? "Steinn" : (wt.top.groupLabel || "") + " — sagað hjá okkur"), 2.8, C.ink, ' font-weight="600"');
    if (stone) s += rc(x, top + 7, tw, 11, C.anno, 0.5, "#fff4ec") + tx(x + 4, top + 14.2, "Steinn — mál tekin af steinsmið. Engin sögunarteikning: myndin sýnir legu, vask, helluborð og krana.", 3.1, C.anno, ' font-weight="700"');
    var py = top + (stone ? 21 : 8), ph = stone ? 120 : 138;
    s += rc(x, py, tw, ph, C.thin, 0.25, "#fff");
    if (wt.plan && wt.plan.inner) s += '<svg x="' + n(x + 2) + '" y="' + n(py + 2) + '" width="' + n(tw - 4) + '" height="' + n(ph - 4) + '" viewBox="' + wt.plan.viewBox + '" preserveAspectRatio="xMidYMid meet">' + wt.plan.inner + '</svg>';
    var ty = py + ph + 7;
    var cols = stone ? [["Stykki", 14], ["Veggur", 30], ["Gróf stærð L × D", 36], ["Hvað fer hvar", 0]] : [["Stykki", 14], ["Veggur", 26], ["L × D × Þ (mm)", 34], ["Endar", 34], ["Kantlímt", 46], ["Bakkantur", 18], ["Úrtök (miðja frá vinstri enda / vegg)", 0]];
    var used = cols.reduce(function(a, c){ return a + c[1]; }, 0); cols[cols.length - 1][1] = Math.max(30, tw - used);
    var cx = x; cols.forEach(function(c){ s += tx(cx + 1, ty, c[0], 2.3, C.ink, ' font-weight="700"'); cx += c[1]; });
    s += ln(x, ty + 1.6, x + tw, ty + 1.6, C.ink, 0.3);
    var ry = ty + 2, maxY = PAGE_H - M - 10;
    (wt.pieces || []).forEach(function(p){
      if (ry > maxY) return;
      var cells = stone ? [p.label, p.wall, p.len + " × " + p.depth, (p.cutouts || []).join("; ") || "—"]
        : [p.label, p.wall, p.len + " × " + p.depth + " × " + wt.top.thick + (p.front ? " (framan " + p.front + ")" : ""), p.ends, p.edges, p.upstand || "—", (p.cutouts || []).join("; ") || "—"];
      var hRow = 0; cx = x;
      cells.forEach(function(v, j){
        var cw = cols[j][1], lines = wrap(String(v), Math.max(5, Math.floor(cw / 1.25))).slice(0, 4);
        lines.forEach(function(l, k){ s += tx(cx + 1, ry + 4 + k * 3.2, l, j === 0 ? 3 : 2.4, j === 0 ? C.sk : C.ink, j === 0 ? ' font-weight="800"' : ""); });
        hRow = Math.max(hRow, lines.length); cx += cw;
      });
      ry += Math.max(1, hRow) * 3.2 + 3;
      s += ln(x, ry - 0.6, x + tw, ry - 0.6, "#c9c9cf", 0.15);
    });
    var notes = [];
    if ((wt.joints || []).length) notes.push("Samskeyti: " + wt.joints.join("; ") + ".");
    notes = notes.concat(wt.notes || []);
    if (stone) notes.push("Steinsmiðurinn mælir á staðnum og sker; málin hér eru gróf (fyrir tilboð).");
    else notes.push("Mál í mm. L = lengd á bakbrún (við vegg); skáskorið horn er styttra framan.", "Úrtök: miðja úrtaks frá vinstri enda stykkisins og frá bakbrún. Staðfestu helluborð og vask við tækin sjálf.");
    notes.push("Blátt = kantlímt · fjólublátt strik = bakkantur upp við vegg.");
    s += column(model, { title:"Borðplata" + (wt.room ? " — " + wt.room : ""), minimap:null, notes:notes }, idx, total, null);
    return page(s);
  }

  function render(model){
    var walls = (model.sheets || []).filter(function(sh){ return (sh.units && sh.units.length) || (sh.annotations && sh.annotations.length); });
    var total = walls.length + 1, out = [overviewSheet(model, 1, total)];
    walls.forEach(function(sh, i){ out.push(wallSheet(model, sh, i + 2, total)); });
    return out;
  }

  var API = { render:render, worktopSheet:worktopSheet, wallSheet:wallSheet, doorSheet:doorSheet, cabinetSheet:cabinetSheet, cabinetSheets:cabinetSheets, cabinetSheetCount:cabinetSheetCount, coverSheet:coverSheet, homeSheet:homeSheet, overviewSheet:overviewSheet, planSvg:planSvg, drawerLabel:drawerLabel, pickScale:pickScale, COLORS:C, PAGE_W:PAGE_W, PAGE_H:PAGE_H };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KPWD = API;
})(typeof window !== "undefined" ? window : globalThis);
