// kitchen-planner-home.js — Allt heimilið drawn the way an architect does (2026-10-23): first the outline (the
// inside faces of the outer walls), then interior walls across it, and the rooms are whatever the walls leave between
// them. Pure (no DOM), all in mm with x to the right and z down:
//   outlinePoly({w, d, shape:"rect"|"L", cw, cd, corner:"nw"|"ne"|"sw"|"se"}) → [{x, z}]
//   spans(outline, walls)  walls = [{o:"v"|"h", c, p}] — a wall is a line (x = c for "v", z = c for "h") through the
//                          point p along it; it always runs to the nearest wall on each side (the outline or an
//                          EARLIER wall), so every wall closes a room and a later wall never crosses an earlier one
//                          → [{o, c, a, b} | null] (null: p is outside, or the wall doubles another)
//   regions(outline, spans, T) → [{raw, pts, label, area}] — raw: the room on the wall centre lines, pts: its floor
//                          (T/2 in from every interior wall), label: a point inside it, area in m²
(function(root){
  "use strict";
  var EPS = 0.5;
  function outlinePoly(o){
    var w = o.w, d = o.d;
    if (o.shape !== "L") return [{ x:0, z:0 }, { x:w, z:0 }, { x:w, z:d }, { x:0, z:d }];
    var cw = Math.max(300, Math.min(w - 300, o.cw || w / 2)), cd = Math.max(300, Math.min(d - 300, o.cd || d / 2));
    var P = {
      ne:[[0, 0], [w - cw, 0], [w - cw, cd], [w, cd], [w, d], [0, d]],
      nw:[[cw, 0], [w, 0], [w, d], [0, d], [0, cd], [cw, cd]],
      se:[[0, 0], [w, 0], [w, d - cd], [w - cw, d - cd], [w - cw, d], [0, d]],
      sw:[[0, 0], [w, 0], [w, d], [cw, d], [cw, d - cd], [0, d - cd]]
    }[o.corner] || null;
    return (P || [[0, 0], [w, 0], [w, d], [0, d]]).map(function(q){ return { x:q[0], z:q[1] }; });
  }
  function inside(P, x, z){
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++){
      var a = P[i], b = P[j];
      if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  }
  // the outline's edges as axis lines: {o:"h", c:z, a:x0, b:x1} / {o:"v", c:x, a:z0, b:z1}
  function outlineSegs(P){
    return P.map(function(p, i){
      var q = P[(i + 1) % P.length];
      return Math.abs(p.z - q.z) < EPS ? { o:"h", c:p.z, a:Math.min(p.x, q.x), b:Math.max(p.x, q.x) } : { o:"v", c:p.x, a:Math.min(p.z, q.z), b:Math.max(p.z, q.z) };
    });
  }
  function spans(P, walls){
    var segs = outlineSegs(P), out = [];
    walls.forEach(function(w){
      var x = w.o === "v" ? w.c : w.p, z = w.o === "v" ? w.p : w.c;
      if (!inside(P, x, z)){ out.push(null); return; }
      var lo = -Infinity, hi = Infinity, dup = false;
      segs.concat(out.filter(Boolean)).forEach(function(s){
        if (s.o === w.o){ if (Math.abs(s.c - w.c) < EPS && s.a <= w.p + EPS && s.b >= w.p - EPS && segs.indexOf(s) < 0) dup = true; return; }
        if (s.a > w.c - EPS || s.b < w.c + EPS) return; // doesn't cross this wall's line (touching an end isn't a cross)
        if (s.c < w.p && s.c > lo) lo = s.c;
        if (s.c > w.p && s.c < hi) hi = s.c;
      });
      out.push(dup || !isFinite(lo) || !isFinite(hi) ? null : { o:w.o, c:w.c, a:lo, b:hi });
    });
    return out;
  }
  function uniq(a){ a = a.slice().sort(function(p, q){ return p - q; }); return a.filter(function(v, i){ return !i || v - a[i - 1] > EPS; }); }
  function regions(P, S, T){
    var half = (T == null ? 120 : T) / 2, sp = (S || []).filter(Boolean);
    var X = uniq(P.map(function(p){ return p.x; }).concat(sp.filter(function(s){ return s.o === "v"; }).map(function(s){ return s.c; })));
    var Z = uniq(P.map(function(p){ return p.z; }).concat(sp.filter(function(s){ return s.o === "h"; }).map(function(s){ return s.c; })));
    var nx = X.length - 1, nz = Z.length - 1, inn = [], par = [];
    function id(i, j){ return j * nx + i; }
    for (var j = 0; j < nz; j++) for (var i = 0; i < nx; i++){ inn[id(i, j)] = inside(P, (X[i] + X[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2); par[id(i, j)] = id(i, j); }
    function find(k){ while (par[k] !== k){ par[k] = par[par[k]]; k = par[k]; } return k; }
    function blocked(o, c, a, b){ return sp.some(function(s){ return s.o === o && Math.abs(s.c - c) < EPS && s.a <= a + EPS && s.b >= b - EPS; }); }
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++){
      if (!inn[id(i, j)]) continue;
      if (i + 1 < nx && inn[id(i + 1, j)] && !blocked("v", X[i + 1], Z[j], Z[j + 1])) par[find(id(i + 1, j))] = find(id(i, j));
      if (j + 1 < nz && inn[id(i, j + 1)] && !blocked("h", Z[j + 1], X[i], X[i + 1])) par[find(id(i, j + 1))] = find(id(i, j));
    }
    var groups = {};
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++){ if (!inn[id(i, j)]) continue; var r = find(id(i, j)); (groups[r] = groups[r] || []).push([i, j]); }
    var res = [];
    Object.keys(groups).forEach(function(g){
      var cells = groups[g], mine = {}, edges = [], big = null;
      cells.forEach(function(c){ mine[id(c[0], c[1])] = 1; });
      function other(i2, j2){ return i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz ? 0 : mine[id(i2, j2)] ? 2 : inn[id(i2, j2)] ? 1 : 0; } // 0 outside, 1 another room, 2 this room
      cells.forEach(function(c){
        var i2 = c[0], j2 = c[1], x0 = X[i2], x1 = X[i2 + 1], z0 = Z[j2], z1 = Z[j2 + 1], ar = (x1 - x0) * (z1 - z0);
        if (!big || ar > big.ar) big = { ar:ar, x:(x0 + x1) / 2, z:(z0 + z1) / 2 };
        [[x0, z0, x1, z0, i2, j2 - 1], [x1, z0, x1, z1, i2 + 1, j2], [x1, z1, x0, z1, i2, j2 + 1], [x0, z1, x0, z0, i2 - 1, j2]].forEach(function(e){
          var n = other(e[4], e[5]); if (n === 2) return;
          edges.push({ x0:e[0], z0:e[1], x1:e[2], z1:e[3], wall:n === 1 });
        });
      });
      // chain the edges into one ring (clockwise on screen: the floor is on the right of travel)
      var from = {}; edges.forEach(function(e){ var k = e.x0 + "," + e.z0; (from[k] = from[k] || []).push(e); });
      var ring = [], e = edges[0], guard = edges.length + 2;
      while (e && guard--){ e.used = 1; ring.push(e); var nxt = (from[e.x1 + "," + e.z1] || []).filter(function(q){ return !q.used; }); e = nxt[0]; }
      // merge straight runs (same direction, same kind of wall)
      var m = [];
      ring.forEach(function(q){
        var l = m[m.length - 1];
        if (l && l.wall === q.wall && Math.sign(l.x1 - l.x0) === Math.sign(q.x1 - q.x0) && Math.sign(l.z1 - l.z0) === Math.sign(q.z1 - q.z0)){ l.x1 = q.x1; l.z1 = q.z1; }
        else m.push({ x0:q.x0, z0:q.z0, x1:q.x1, z1:q.z1, wall:q.wall });
      });
      if (m.length > 1){ var f = m[0], l2 = m[m.length - 1];
        if (f.wall === l2.wall && Math.sign(l2.x1 - l2.x0) === Math.sign(f.x1 - f.x0) && Math.sign(l2.z1 - l2.z0) === Math.sign(f.z1 - f.z0)){ f.x0 = l2.x0; f.z0 = l2.z0; m.pop(); } }
      var raw = m.map(function(q){ return { x:q.x0, z:q.z0 }; });
      // the floor: every interior wall moves in by half its thickness (the inward normal is (-dz, dx))
      var pts = [];
      m.forEach(function(q, k){
        var pv = m[(k - 1 + m.length) % m.length];
        function sh(ed){ var L = Math.hypot(ed.x1 - ed.x0, ed.z1 - ed.z0) || 1, o = ed.wall ? half : 0; return { x:-(ed.z1 - ed.z0) / L * o, z:(ed.x1 - ed.x0) / L * o }; }
        var a = sh(pv), b = sh(q), horizP = Math.abs(pv.z1 - pv.z0) < EPS, horizQ = Math.abs(q.z1 - q.z0) < EPS;
        if (horizP !== horizQ) pts.push(horizP ? { x:q.x0 + b.x, z:q.z0 + a.z } : { x:q.x0 + a.x, z:q.z0 + b.z });
        else { pts.push({ x:q.x0 + a.x, z:q.z0 + a.z }); pts.push({ x:q.x0 + b.x, z:q.z0 + b.z }); }
      });
      pts = pts.filter(function(p, k){ var q = pts[(k + 1) % pts.length]; return Math.abs(p.x - q.x) > EPS || Math.abs(p.z - q.z) > EPS; });
      var area = 0; pts.forEach(function(p, k){ var q = pts[(k + 1) % pts.length]; area += p.x * q.z - q.x * p.z; });
      var bx = { x0:Infinity, x1:-Infinity, z0:Infinity, z1:-Infinity }; raw.forEach(function(p){ bx.x0 = Math.min(bx.x0, p.x); bx.x1 = Math.max(bx.x1, p.x); bx.z0 = Math.min(bx.z0, p.z); bx.z1 = Math.max(bx.z1, p.z); });
      var mid = { x:(bx.x0 + bx.x1) / 2, z:(bx.z0 + bx.z1) / 2 }; // the middle when it's inside (an L's may not be)
      res.push({ raw:raw, pts:pts, label:inside(raw, mid.x, mid.z) ? mid : { x:big.x, z:big.z }, area:Math.abs(area) / 2e6 });
    });
    res.sort(function(a, b){ return a.label.z - b.label.z || a.label.x - b.label.x; });
    return res;
  }
  // homes to start from: the outline, its interior walls (in the order they're drawn) and what each room is
  var TEMPLATES = {
    "2ja": { label:"2ja herbergja", sub:"Um 70 m²", outline:{ w:8000, d:9000, shape:"rect" },
      walls:[{ o:"h", c:4060, p:4000 }, { o:"v", c:4860, p:2000 }, { o:"h", c:5380, p:4000 }, { o:"v", c:3860, p:7000 }, { o:"v", c:6140, p:7000 }],
      names:[[2000, 2000, "Stofa"], [6400, 2000, "Eldhús"], [4000, 4700, "Gangur"], [1900, 7000, "Svefnh."], [5000, 7000, "Baðh."], [7000, 7000, "Forstofa"]] },
    "3ja": { label:"3ja herbergja", sub:"Um 80 m²", outline:{ w:8600, d:9200, shape:"rect" },
      walls:[{ o:"h", c:4260, p:4000 }, { o:"v", c:5060, p:2000 }, { o:"h", c:5580, p:4000 }, { o:"v", c:3560, p:7400 }, { o:"v", c:6480, p:7400 }, { o:"h", c:7700, p:7500 }],
      names:[[2500, 2000, "Stofa"], [6800, 2000, "Eldhús"], [4300, 4900, "Gangur"], [1700, 7400, "Hjónah."], [5000, 7400, "Barnah."], [7500, 6600, "Baðh."], [7500, 8500, "Forstofa"]] },
    "einbyli": { label:"Einbýli á einni hæð", sub:"Um 130 m²", outline:{ w:10200, d:13000, shape:"rect" },
      walls:[{ o:"h", c:4560, p:5000 }, { o:"v", c:6060, p:2000 }, { o:"h", c:6040, p:5000 }, { o:"h", c:9960, p:5000 }, { o:"v", c:4060, p:8000 }, { o:"v", c:7380, p:8000 }, { o:"v", c:2560, p:11500 }, { o:"v", c:4680, p:11500 }],
      names:[[3000, 2000, "Stofa"], [8000, 2000, "Eldhús"], [5000, 5300, "Gangur"], [2000, 8000, "Hjónah."], [5700, 8000, "Barnah."], [8800, 8000, "Barnah."], [1200, 11500, "Baðh."], [3600, 11500, "Þvottah."], [7000, 11500, "Forstofa"]] }
  };
  var API = { outlinePoly:outlinePoly, inside:inside, spans:spans, regions:regions, TEMPLATES:TEMPLATES };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KPHOME = API;
})(typeof window !== "undefined" ? window : globalThis);
