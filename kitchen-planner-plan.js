// kitchen-planner-plan.js — find a room's outline on an uploaded floor plan (Allt heimilið, 2026-10-23).
//
// The plan (a scanned aðaluppdráttur from the municipality's drawing archive, or a CAD export) is a bitmap; the
// visitor clicks inside a room. Walls are the dark pixels. Door openings are gaps in the walls, so a plain flood fill
// would leak into the next room: first every wall is grown by `bridgeMm` (≈ half a door) so the gaps close, the click
// is flood-filled inside that, then the region is grown back by the same amount (never into a wall) — the room's own
// floor, up to its walls. Its border is traced, simplified, and edges within a few degrees of the drawing's axes are
// squared up. Pure (no DOM): KPPLAN.detect(gray, w, h, clickX, clickY, opts) → [{x, y}] in pixels, or null.
(function(root){
  "use strict";
  // two-pass chamfer distance (3-4) from every "on" pixel, in units of 1 px (≈)
  function distanceFrom(mask, w, h){
    var INF = 1e9, d = new Float32Array(w * h), i, x, y;
    for (i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++){
      i = y * w + x; var v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0){ v = Math.min(v, d[i - w] + 1); if (x > 0) v = Math.min(v, d[i - w - 1] + 1.414); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 1.414); }
      d[i] = v;
    }
    for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--){
      i = y * w + x; var u = d[i];
      if (x < w - 1) u = Math.min(u, d[i + 1] + 1);
      if (y < h - 1){ u = Math.min(u, d[i + w] + 1); if (x < w - 1) u = Math.min(u, d[i + w + 1] + 1.414); if (x > 0) u = Math.min(u, d[i + w - 1] + 1.414); }
      d[i] = u;
    }
    return d;
  }
  function flood(ok, w, h, sx, sy){ // 4-connected fill over ok[] from (sx, sy) → Uint8Array region, or null
    var start = sy * w + sx; if (!ok[start]) return null;
    var reg = new Uint8Array(w * h), stack = [start], n = 0; reg[start] = 1;
    while (stack.length){
      var i = stack.pop(), x = i % w, y = (i - x) / w; n++;
      if (x > 0 && ok[i - 1] && !reg[i - 1]){ reg[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && ok[i + 1] && !reg[i + 1]){ reg[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && ok[i - w] && !reg[i - w]){ reg[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && ok[i + w] && !reg[i + w]){ reg[i + w] = 1; stack.push(i + w); }
    }
    reg.count = n;
    return reg;
  }
  // outer border of a region by marching squares → closed list of corner points (pixel corners)
  function trace(reg, w, h){
    var sx = -1, sy = -1;
    for (var y = 0; y < h && sx < 0; y++) for (var x = 0; x < w; x++) if (reg[y * w + x]){ sx = x; sy = y; break; }
    if (sx < 0) return null;
    function at(x, y){ return x >= 0 && y >= 0 && x < w && y < h && reg[y * w + x] ? 1 : 0; }
    // walk the boundary keeping the region on the right; start at the top-left corner of the first pixel, heading right
    var pts = [], x0 = sx, y0 = sy, dir = 0, cx = x0, cy = y0, guard = 0; // dir: 0 right, 1 down, 2 left, 3 up (corner coords)
    var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    do {
      pts.push({ x:cx, y:cy });
      // the 2×2 cells around corner (cx, cy): a = top-left, b = top-right, c = bottom-left, d = bottom-right
      var turned = false;
      for (var k = 0; k < 4; k++){
        var nd = (dir + 3 + k) % 4; // try left turn first, then straight, right, back
        var ok;
        if (nd === 0) ok = at(cx, cy) && !at(cx, cy - 1);      // moving right along the top edge of cell (cx, cy)
        else if (nd === 1) ok = at(cx - 1, cy) && !at(cx, cy); // down: region on the left-below side
        else if (nd === 2) ok = at(cx - 1, cy - 1) && !at(cx - 1, cy);
        else ok = at(cx, cy - 1) && !at(cx - 1, cy - 1);
        if (ok){ dir = nd; turned = true; break; }
      }
      if (!turned) break;
      cx += DX[dir]; cy += DY[dir];
    } while ((cx !== x0 || cy !== y0) && ++guard < w * h * 4);
    return pts;
  }
  function dp(pts, eps){ // Douglas–Peucker on a closed ring
    if (pts.length < 4) return pts;
    var far = 0, fd = -1; pts.forEach(function(p, i){ var d = Math.hypot(p.x - pts[0].x, p.y - pts[0].y); if (d > fd){ fd = d; far = i; } });
    var ring = pts.concat([pts[0]]);
    function rec(a, b){
      var A = ring[a], B = ring[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, best = -1, bi = -1;
      for (var i = a + 1; i < b; i++){ var d = Math.abs((ring[i].x - A.x) * dy - (ring[i].y - A.y) * dx) / L; if (d > best){ best = d; bi = i; } }
      return best > eps ? rec(a, bi).concat(rec(bi, b).slice(1)) : [A, B];
    }
    var out = rec(0, far).concat(rec(far, ring.length - 1).slice(1));
    out.pop();
    return out;
  }
  // square up: an edge within `tolDeg` of horizontal/vertical becomes exactly that; corners = intersections of
  // consecutive edges' lines
  function square(pts, tolDeg){
    var n = pts.length, lines = [];
    for (var i = 0; i < n; i++){
      var a = pts[i], b = pts[(i + 1) % n], ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, m = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 };
      var f = ((ang % 180) + 180) % 180;
      if (Math.min(f, 180 - f) < tolDeg) lines.push({ p:m, d:{ x:1, y:0 } });
      else if (Math.abs(f - 90) < tolDeg) lines.push({ p:m, d:{ x:0, y:1 } });
      else { var L = Math.hypot(b.x - a.x, b.y - a.y) || 1; lines.push({ p:m, d:{ x:(b.x - a.x) / L, y:(b.y - a.y) / L } }); }
    }
    var out = [];
    for (var j = 0; j < n; j++){
      var l1 = lines[(j - 1 + n) % n], l2 = lines[j], den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
      if (Math.abs(den) < 1e-6){ continue; } // collinear neighbours: the corner disappears
      var t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
      out.push({ x:l1.p.x + l1.d.x * t, y:l1.p.y + l1.d.y * t });
    }
    return out;
  }
  // a door gap leaves a small tent in the core's border (two short slanted edges): drop such a vertex when both its
  // edges are short and the triangle it adds is small, until none is left
  function debump(pts, R){
    var changed = true;
    while (changed && pts.length > 4){
      changed = false;
      for (var i = 0; i < pts.length; i++){
        var a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
        var ab = Math.hypot(b.x - a.x, b.y - a.y), bc = Math.hypot(c.x - b.x, c.y - b.y), tri = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
        var slanted = function(p, q){ var f = ((Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI) % 90 + 90) % 90; return f > 10 && f < 80; };
        if (ab < 2.2 * R && bc < 2.2 * R && tri < 0.6 * R * R && (slanted(a, b) || slanted(b, c))){ pts.splice(i, 1); changed = true; break; }
      }
    }
    return pts;
  }
  // the outline from its wall lines only: long edges (or any edge within tolDeg of the axes and ≥ R/2) are walls;
  // short slanted bits (the tent a door gap makes) are dropped; neighbouring wall lines are intersected, and two
  // consecutive parallel ones (a wall split by such a tent) become one
  function rectify(pts, R, tolDeg){
    var n = pts.length, lines = [];
    for (var i = 0; i < n; i++){
      var a = pts[i], b = pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (!L) continue;
      var f = ((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180, ax = Math.min(f, 180 - f) < tolDeg ? "h" : Math.abs(f - 90) < tolDeg ? "v" : null;
      if (ax ? L < R * 0.5 : L < R * 3) continue; // noise
      var m = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 }, d = ax === "h" ? { x:Math.sign(dx) || 1, y:0 } : ax === "v" ? { x:0, y:Math.sign(dy) || 1 } : { x:dx / L, y:dy / L };
      if (ax === "h") m.y = (a.y + b.y) / 2; if (ax === "v") m.x = (a.x + b.x) / 2;
      var prev = lines[lines.length - 1];
      if (prev && Math.abs(prev.d.x * d.y - prev.d.y * d.x) < 1e-3 && prev.d.x * d.x + prev.d.y * d.y > 0){ // same direction: one wall split in two
        var off = Math.abs((m.x - prev.p.x) * d.y - (m.y - prev.p.y) * d.x);
        if (off < R * 0.8){ if (L > prev.L){ prev.p = m; } prev.L += L; continue; }
      }
      lines.push({ p:m, d:d, L:L });
    }
    if (lines.length > 2){ var f0 = lines[0], fl = lines[lines.length - 1];
      if (Math.abs(f0.d.x * fl.d.y - f0.d.y * fl.d.x) < 1e-3 && f0.d.x * fl.d.x + f0.d.y * fl.d.y > 0 && Math.abs((fl.p.x - f0.p.x) * f0.d.y - (fl.p.y - f0.p.y) * f0.d.x) < R * 0.8){ if (fl.L > f0.L) f0.p = fl.p; lines.pop(); } }
    var out = [], k = lines.length;
    for (var j = 0; j < k; j++){
      var l1 = lines[(j - 1 + k) % k], l2 = lines[j], den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
      if (Math.abs(den) < 1e-6) continue;
      var t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
      out.push({ x:l1.p.x + l1.d.x * t, y:l1.p.y + l1.d.y * t });
    }
    return out;
  }
  // push every edge of a polygon out by d (px) and re-intersect neighbours
  function offset(pts, d){
    var n = pts.length, area = 0, i;
    for (i = 0; i < n; i++){ var q = pts[(i + 1) % n]; area += pts[i].x * q.y - q.x * pts[i].y; }
    var sgn = area > 0 ? 1 : -1, lines = [];
    for (i = 0; i < n; i++){
      var a = pts[i], b = pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = sgn * dy / L, ny = -sgn * dx / L;
      lines.push({ p:{ x:a.x + nx * d, y:a.y + ny * d }, d:{ x:dx / L, y:dy / L } });
    }
    var out = [];
    for (i = 0; i < n; i++){
      var l1 = lines[(i - 1 + n) % n], l2 = lines[i], den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
      if (Math.abs(den) < 1e-6) continue;
      var t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
      out.push({ x:l1.p.x + l1.d.x * t, y:l1.p.y + l1.d.y * t });
    }
    return out;
  }
  // gray: Uint8 luminance (0 = black), w×h. opts: { pxPerMm, bridgeMm (default 520), dark (default 120), minAreaMm2 }
  function detect(gray, w, h, cx, cy, opts){
    opts = opts || {};
    var pxPerMm = opts.pxPerMm || 0.1, dark = opts.dark || 120, R = Math.max(2, (opts.bridgeMm || 520) * pxPerMm);
    cx = Math.round(cx); cy = Math.round(cy);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
    var wall = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) wall[i] = gray[i] < dark ? 1 : 0;
    // close pinholes (scan speckle, hatching, a jagged slanted wall): dilate the dark pixels ~20 mm, erode back
    var cr = Math.max(1.5, 20 * pxPerMm), dD = distanceFrom(wall, w, h), dil = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) dil[i] = dD[i] <= cr ? 0 : 1; // 1 = still light after the dilation
    var dE = distanceFrom(dil, w, h);
    for (i = 0; i < w * h; i++) wall[i] = dE[i] > cr ? 1 : 0;
    // thin strokes (text, furniture, door arcs) aren't walls: a wall pixel must have a wall neighbour band ≥ ~60 mm thick
    var thick = Math.max(1, Math.round(60 * pxPerMm / 2)), dIn = distanceFrom(wall.map(function(v){ return v ? 0 : 1; }), w, h), core = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) core[i] = dIn[i] >= thick ? 1 : 0; // pixels at least `thick` deep inside a dark area
    var dCore = distanceFrom(core, w, h), walls = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) walls[i] = wall[i] && dCore[i] <= thick + 1 ? 1 : 0; // the thick dark areas, back to full width
    var dW = distanceFrom(walls, w, h), ok = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) ok[i] = dW[i] > R ? 1 : 0;
    // the click may land within R of a wall (a small room / near an edge): start from the nearest open pixel
    var s = cy * w + cx;
    if (!ok[s]){ var best = -1, bd = 1e9; var RR = Math.ceil(3 * R); for (var yy = Math.max(0, cy - RR); yy < Math.min(h, cy + RR); yy++) for (var xx = Math.max(0, cx - RR); xx < Math.min(w, cx + RR); xx++){ var k = yy * w + xx; if (ok[k]){ var dd = (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy); if (dd < bd){ bd = dd; best = k; } } } if (best < 0) return null; s = best; }
    var reg = flood(ok, w, h, s % w, (s - s % w) / w); if (!reg) return null;
    // not enclosed (it reaches the sheet's edge — outside the building, or a room open to the outside)?
    for (var bx = 0; bx < w; bx++) if (reg[bx] || reg[(h - 1) * w + bx]) return null;
    for (var by = 0; by < h; by++) if (reg[by * w] || reg[by * w + w - 1]) return null;
    // the core is everything ≥ R from a wall, so its border runs exactly R inside the room's walls: trace it, flatten
    // (the little bulges a door gap makes in it go away), square it up, then push every edge out by R — the room's
    // floor wall to wall, with sharp corners, and a door gap never pulls the outline into the next room
    var ring = trace(reg, w, h); if (!ring || ring.length < 4) return null;
    var dpr = dp(ring, 2); if (opts.debug){ opts.debug.dp = dpr.map(function(p){ return [Math.round(p.x), Math.round(p.y)]; }); opts.debug.R = R; }
    var core0 = rectify(dpr, R, opts.tolDeg || 7);
    if (core0.length < 3) return null;
    if (opts.debug) opts.debug.core = core0.map(function(p){ return [Math.round(p.x), Math.round(p.y)]; });
    var poly = offset(core0, R);
    var area = 0; poly.forEach(function(p, j){ var q = poly[(j + 1) % poly.length]; area += p.x * q.y - q.x * p.y; });
    if (Math.abs(area) / 2 / (pxPerMm * pxPerMm) < (opts.minAreaMm2 || 1.2e6)) return null; // smaller than ~1.2 m²: not a room
    return poly;
  }
  var API = { detect:detect, _offset:offset, _distanceFrom:distanceFrom, _trace:trace, _dp:dp, _square:square };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KPPLAN = API;
})(typeof window !== "undefined" ? window : globalThis);
