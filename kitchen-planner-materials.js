// kitchen-planner-materials.js — procedural, tileable material textures for the
// kitchen planner's 3D view (wood grain, oak plank floor, painted fronts, stone).
// No image assets: everything is drawn once per material into <canvas> elements
// with periodic value-noise, so tiles repeat seamlessly. Exposed as window.KPMat.
// Canvases are cached per key; callers wrap them in fresh THREE textures.
(function(){
  "use strict";

  function hexToRgb(hex){
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Periodic 2D value noise: a px × py lattice that wraps, smoothstep-interpolated.
  function tileNoise(seed, px, py){
    var rnd = mulberry32(seed), grid = new Float32Array(px * py);
    for (var i = 0; i < grid.length; i++) grid[i] = rnd();
    return function(x, y){ // x,y in lattice units (any real; wraps)
      var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      var x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
      var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      var a = grid[x0 + y0 * px], b = grid[x1 + y0 * px], c = grid[x0 + y1 * px], d = grid[x1 + y1 * px];
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  }

  // Wood sampler: returns brightness factor + bump for a point (across, along)
  // in [0,1)² tile space. Rings run across the board, fibres along it.
  function makeWood(seed, ringCount, fibreDensity, contrast, warpAmp){
    contrast = contrast == null ? 1 : contrast; warpAmp = warpAmp == null ? 0.04 : warpAmp;
    var big = tileNoise(seed, 4, 4), mid = tileNoise(seed + 7, 8, 8);
    var fibre = tileNoise(seed + 13, fibreDensity, 6), pore = tileNoise(seed + 29, fibreDensity * 2, 24);
    var fine = tileNoise(seed + 41, 64, 64);
    return function(across, along){
      // slow along the board, gentle across it: long soft figure, not zebra stripes
      var warp = (big(across * 2, along * 1) - 0.5) * 1.0 + (mid(across * 4, along * 2) - 0.5) * 0.4;
      // ring lines flow along the board and drift apart/together (irregular spacing)
      var v = across * ringCount + warp * warpAmp, fr = v - Math.floor(v);
      var ring = 1 - Math.abs(fr - 0.5) * 2; ring = ring * ring * (3 - 2 * ring);
      var f = fibre(across * fibreDensity, along * 6);
      var p = pore(across * fibreDensity * 2, along * 24);
      var dot = p > 0.83 ? (p - 0.83) * 5 : 0; // pores
      var fn = fine(across * 64, along * 64);
      var light = 1 - 0.075 * ring - 0.045 * f + 0.05 * (big(across * 2, along * 1) - 0.5) - 0.10 * dot + 0.025 * (fn - 0.5);
      light = 1 + (light - 1) * contrast;
      var bump = 0.5 + (f - 0.5) * 0.5 - ring * 0.22 - dot * 0.45;
      return { light: light, ring: ring, bump: Math.max(0, Math.min(1, bump)) };
    };
  }

  var cache = {};

  // Board texture for a front material. Tile = 0.6 m across × 1.2 m along
  // (grain runs vertically on a door), 512×1024 px so pixels are square.
  function woodTexture(key, baseHex){
    if (cache[key]) return cache[key];
    var W = 512, H = 1024, wood = makeWood(hashKey(key), 5, 46, 0.85, 1.7);
    var base = hexToRgb(baseHex), warm = [base[0] * 0.9, base[1] * 0.82, base[2] * 0.72];
    var color = document.createElement("canvas"), bump = document.createElement("canvas");
    color.width = bump.width = W; color.height = bump.height = H;
    var cx = color.getContext("2d"), bx = bump.getContext("2d");
    var ci = cx.createImageData(W, H), bi = bx.createImageData(W, H);
    for (var y = 0; y < H; y++){
      for (var x = 0; x < W; x++){
        var s = wood(x / W, y / H), k = (y * W + x) * 4;
        var m = Math.max(0, Math.min(1, s.ring * 0.9)); // darker rings drift toward the warm tone
        ci.data[k]     = clamp((base[0] * (1 - m) + warm[0] * m) * s.light);
        ci.data[k + 1] = clamp((base[1] * (1 - m) + warm[1] * m) * s.light);
        ci.data[k + 2] = clamp((base[2] * (1 - m) + warm[2] * m) * s.light);
        ci.data[k + 3] = 255;
        var g = Math.round(s.bump * 255);
        bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = g; bi.data[k + 3] = 255;
      }
    }
    cx.putImageData(ci, 0, 0); bx.putImageData(bi, 0, 0);
    return (cache[key] = { color: color, bump: bump, tileW: 0.6, tileH: 1.2 });
  }

  // Painted / solid-colour front: near-flat with a whisper of orange-peel so it
  // doesn't read as pure plastic. Tile 0.6 × 0.6 m, 256 px.
  function paintTexture(key, baseHex){
    if (cache[key]) return cache[key];
    var S = 256, n1 = tileNoise(hashKey(key), 32, 32), n2 = tileNoise(hashKey(key) + 5, 6, 6), base = hexToRgb(baseHex);
    var color = document.createElement("canvas"), bump = document.createElement("canvas");
    color.width = bump.width = S; color.height = bump.height = S;
    var cx = color.getContext("2d"), bx = bump.getContext("2d"), ci = cx.createImageData(S, S), bi = bx.createImageData(S, S);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++){
      var k = (y * S + x) * 4, a = n1(x / S * 32, y / S * 32), b = n2(x / S * 6, y / S * 6);
      var l = 1 + (a - 0.5) * 0.035 + (b - 0.5) * 0.03;
      ci.data[k] = clamp(base[0] * l); ci.data[k + 1] = clamp(base[1] * l); ci.data[k + 2] = clamp(base[2] * l); ci.data[k + 3] = 255;
      var g = Math.round(a * 255); bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = g; bi.data[k + 3] = 255;
    }
    cx.putImageData(ci, 0, 0); bx.putImageData(bi, 0, 0);
    return (cache[key] = { color: color, bump: bump, tileW: 0.6, tileH: 0.6 });
  }

  // Oak plank floor. Tile = 2 m × 2 m, 1024 px; 14 rows of ~14 cm planks running
  // along x, each with a staggered end joint, its own tint and grain offset.
  function plankFloorTexture(baseHex){
    var key = "floor:" + baseHex;
    if (cache[key]) return cache[key];
    var S = 1024, rows = 14, rowH = S / rows, rnd = mulberry32(2026), wood = makeWood(4242, 2, 16, 0.8, 1.6), base = hexToRgb(baseHex);
    var joints = [], tint = [], offs = [];
    for (var r = 0; r < rows; r++){
      joints.push(0.15 + rnd() * 0.7);
      tint.push([0.955 + rnd() * 0.09, 0.955 + rnd() * 0.09]);
      offs.push([rnd(), rnd()]);
    }
    var color = document.createElement("canvas"), bump = document.createElement("canvas");
    color.width = bump.width = S; color.height = bump.height = S;
    var cx = color.getContext("2d"), bx = bump.getContext("2d"), ci = cx.createImageData(S, S), bi = bx.createImageData(S, S);
    for (var y = 0; y < S; y++){
      var row = Math.min(rows - 1, Math.floor(y / rowH)), across = (y - row * rowH) / rowH;
      for (var x = 0; x < S; x++){
        var s = x / S, seg = s < joints[row] ? 0 : 1, along = ((s - joints[row]) % 1 + 1) % 1;
        var w = wood(((across * 0.92 + offs[row][seg]) % 1), ((along * 0.5 + offs[row][1 - seg]) % 1));
        var t = tint[row][seg], k = (y * S + x) * 4;
        var groove = across < 0.03 || across > 0.97 || Math.abs(s - joints[row]) < 0.0025 || (s < 0.0025);
        var l = groove ? 0.62 : w.light * t;
        ci.data[k] = clamp(base[0] * l); ci.data[k + 1] = clamp(base[1] * l * 0.985); ci.data[k + 2] = clamp(base[2] * l * 0.96); ci.data[k + 3] = 255;
        var g = groove ? 20 : Math.round(w.bump * 255); bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = g; bi.data[k + 3] = 255;
      }
    }
    cx.putImageData(ci, 0, 0); bx.putImageData(bi, 0, 0);
    return (cache[key] = { color: color, bump: bump, tileW: 2, tileH: 2 });
  }

  // Worktop: honed stone with fine mineral speckle. Tile 0.8 × 0.8 m.
  function stoneTexture(baseHex){
    var key = "stone:" + baseHex;
    if (cache[key]) return cache[key];
    var S = 256, n = tileNoise(99, 64, 64), v = tileNoise(101, 8, 8), base = hexToRgb(baseHex);
    var color = document.createElement("canvas"); color.width = color.height = S;
    var cx = color.getContext("2d"), ci = cx.createImageData(S, S), rnd = mulberry32(5);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++){
      var k = (y * S + x) * 4, a = n(x / S * 64, y / S * 64), b = v(x / S * 8, y / S * 8);
      var l = 1 + (a - 0.5) * 0.09 + (b - 0.5) * 0.08;
      if (rnd() > 0.992) l *= 0.72; // speckle
      ci.data[k] = clamp(base[0] * l); ci.data[k + 1] = clamp(base[1] * l); ci.data[k + 2] = clamp(base[2] * l); ci.data[k + 3] = 255;
    }
    cx.putImageData(ci, 0, 0);
    return (cache[key] = { color: color, tileW: 0.8, tileH: 0.8 });
  }

  function clamp(v){ return v < 0 ? 0 : v > 255 ? 255 : v; }
  function hashKey(str){ var h = 2166136261; for (var i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  window.KPMat = { woodTexture: woodTexture, paintTexture: paintTexture, plankFloorTexture: plankFloorTexture, stoneTexture: stoneTexture };
})();
