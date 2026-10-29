// cnc-bpp.js — shared .bpp → 2D elevation rendering, used by bpp-viewer.html (/bpp, drag-and-drop) and
// cnc.html (/cnc, automatic preview right after a USB export — same directory handle, no re-drag needed).
// Extracted 2026-10-17 from bpp-viewer.html, which owned this logic alone until then; moved out so the two
// pages can never drift apart, same reasoning as cnc-sides.js/cnc-doors.js already being shared modules.
//
// Only understands the macro vocabulary /cnc itself writes (drawer boxes, hinges, shelves, door leaf/jamb
// hardware) — a hand-made shop master uses many macros this never learned, so those files show the panel
// outline + a raw op dump instead of a (possibly wrong) drawing. Reconstructs positions the same way the
// generators compute them (bottom-up stacking with a 3mm gap, corner-coded hinge/shelf math) rather than
// trying to replicate the real Biesse macro's own internal geometry — correct for OUR files because we know
// exactly how we wrote them.
//
// CSS classes this emits (`.bpp-card`, `.bpp-chip`, `.bpp-note`, `.bpp-legend`, plus everything `.bw-*`) are
// namespaced so a page that already has its own unrelated `.card`/`.chip`/`.note` (cnc.html's own pre-export
// review cards) never collides — see the matching CSS block each page carries in its own <style>.
(function (root) {
  "use strict";

  // ── decode / generic parsing ────────────────────────────────────────────────────────────────────────
  function splitParams(raw) {
    var out = [], cur = "", inQ = false;
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return raw.trim() === "" ? [] : out;
  }
  function num(raw, vars) {
    if (raw == null) return null;
    var s = String(raw).trim();
    var sub = s.replace(/\b(lpx|lpy|lpz)\b/gi, function (m) { var v = vars[m.toUpperCase()]; return v == null ? m : String(v); });
    if (!/^[0-9.+\-*/() ]+$/.test(sub)) return null;
    try { var v = Function('"use strict";return (' + sub + ")")(); return isFinite(v) ? Math.round(v * 10) / 10 : null; } catch (e) { return null; }
  }
  var PAN_RE = /^PAN=(LPX|LPY|LPZ)\|([^|]*)\|/;
  var GLB_RE = /^GLB=([A-Za-z0-9_]+)\|([^|]*)\|/;
  var OP_RE = /^(\s*)([@'])\s+([A-Za-z0-9_]+),\s*"([^"]*)",\s*"([^"]*)",\s*(-?\d+),\s*"([^"]*)",\s*(-?\d+)\s*:\s*(.*)$/;

  function parseBpp(text) {
    var lines = text.split(/\r?\n/);
    var vars = {}, glb = {}, ops = [], section = "";
    lines.forEach(function (l) {
      var sec = l.match(/^\[([A-Z]+)\]\s*$/);
      if (sec) { section = sec[1]; return; }
      var g = l.match(GLB_RE);
      if (g) glb[g[1].toUpperCase()] = g[2];
      if (section === "VARIABLES") {
        var p = l.match(PAN_RE);
        if (p) vars[p[1]] = parseFloat(p[2]);
      }
      if (section === "PROGRAM") {
        var m = l.match(OP_RE);
        if (m) ops.push({ active: m[2] === "@", child: m[1].length >= 2, name: m[3], label: m[5], params: splitParams(m[9]), raw: l.trim() });
      }
    });
    return { vars: vars, glb: glb, ops: ops };
  }

  // ── which kind of /cnc file is this? ────────────────────────────────────────────────────────────────
  var LEAF_HW = ["COPLAN", "LAMIR_89_HURD", "IN05020_LAMIR_JNF", "HYDRAULIC_PIVOT_W_SYSTEM",
    "IN_20_835_60_BA", "EN12209", "IN_20_937", "HAWAJ_80B", "FELLI_THROSKULDUR"];
  var JAMB_HINGE_HW = ["COPLAN_KARM", "LAMIR_89", "IN05020_KARMLOM_JNF"];
  var JAMB_STRIKE_HW = ["IN_20_835_60_BA_SLUTJARN", "IN_20_937_SLUTTJARN", "KFV_SLUTTJARN", "SEGUL_SLUTTJARN", "JNF_SLUTTJARN"];
  var JAMB_TOP_HW = ["HYDRAULIC_PIVOT_W_SYSTEM_FRAME_INSERT"];
  var FRONT_EXTRA_MM = { E_NEDSTI_FRONTUR_MERIVO: 218, C_NEDSTI_FRONTUR_LEGRA: 203.5, F_NEDSTA_SKUFFA_LEGRABOX: 235.5 };
  var DOOR_VARS = ["HURD_H", "HURD_B", "LOM1", "LOM2", "LOM3", "HANDFANG"];

  function detectKind(parsed) {
    var names = parsed.ops.map(function (o) { return o.name; });
    var has = function (list) { return list.some(function (n) { return names.indexOf(n) >= 0; }); };
    var isDoorFamily = DOOR_VARS.some(function (k) { return ("HS_" + k) in parsed.glb; });
    if (isDoorFamily) {
      if (has(JAMB_HINGE_HW)) return "karmur-lamir";
      if (has(JAMB_STRIKE_HW)) return "karmur-slut";
      if (has(JAMB_TOP_HW)) return "karmur-topp";
      if (has(LEAF_HW)) return "hurdablad";
      return "karmur-topp"; // toppstykki switches nothing itself besides the pivot insert
    }
    // Note: fronts also carry GLB=HS_HLID (renderSide stamps every file it writes the same way), so TOPP_BOTN/
    // SLA_HLID — ops every side gets unconditionally and no front master has — are the only reliable "side" signal.
    if (names.indexOf("URTAK_F_VATNSLAS") >= 0) return "botn-urtak"; // the drawer bottom with the water-trap notch
    if (names.indexOf("TOPP_BOTN") >= 0 || names.indexOf("SLA_HLID") >= 0) return "hlid";
    if (has(Object.keys(FRONT_EXTRA_MM)) || names.indexOf("HARDVIDAR_GRIP_ENDA_TIL_ENDA") >= 0 || names.indexOf("K_M_NEDSTI_FRONTUR_MERIVO") >= 0 || names.indexOf("K_M_NEDSTI_FRONTUR_LEGRABOX") >= 0) return "front-skuffa";
    if (names.indexOf("IKEALOM") >= 0) return "front-hurd";
    if (names.indexOf("CUT_X") >= 0) return "hlid"; // an end panel (Úthlið): the master with just its LED line
    return "unknown";
  }
  var KIND_LABEL = { "hlid": "Hlið", "front-skuffa": "Skúffufrontur", "front-hurd": "Hurðafrontur",
    "hurdablad": "Hurðablað", "karmur-lamir": "Karmur — lamir", "karmur-slut": "Karmur — slúttjárn",
    "karmur-topp": "Karmur — toppstykki", "botn-urtak": "Skúffubotn — úrtak", "unknown": "Óþekkt" };

  // ── side / door-front feature reconstruction (mirrors cnc-sides.js unitPlan's own math) ───────────────
  function hingeFeature(op, vars) {
    var mm = num(op.params[0], vars);
    if (mm == null) return null;
    var corners = (op.params[2] || "").split(",").map(function (s) { return s.trim(); });
    var out = [];
    if (corners.indexOf("2") >= 0) out.push({ type: "hinge", y: mm, label: (op.label || "Löm") + " — " + mm + " mm frá botni" });
    if (corners.indexOf("3") >= 0) out.push({ type: "hinge", y: vars.LPX - mm, label: (op.label || "Löm") + " — " + mm + " mm frá toppi" });
    if (!out.length) out.push({ type: "hinge", y: mm, label: (op.label || "Löm") + " — " + mm + " mm", unsure: true });
    return out;
  }
  function cornersOf(raw) { return String(raw || "").replace(/"/g, "").split(",").map(function (x) { return parseInt(x, 10); }).filter(function (n) { return n >= 1 && n <= 4; }); }
  function buildSideFeatures(ops, vars) {
    var features = [], unknown = [], info = [];
    var drawerCursor = 0, fixedCursor = 0;
    ops.filter(function (o) { return o.active; }).forEach(function (op) {
      var p = op.params;
      switch (op.name) {
        case "TOPP_BOTN": {
          // Simulated from the macro itself (Macros/TOPP_BOTN, read 2026-10-29): params (BORA_I_GEGN, Z = board thickness,
          // BIL = gap from the end, CRN). Per corner: the board's footprint x ∈ [BIL, BIL+Z] from that end, y = the whole depth
          // less 1 mm (rectangle (BIL,0)–(Z, lpy−1) from the corner), and 5 end holes at x = Z/2+BIL, y = 30, 70, (lpy−1)/2,
          // lpy−31, lpy−71. Corners: 1 bottom-back, 2 bottom-front, 3 top-front, 4 top-back (the same reading as LOM's "2,3").
          var tz = num(p[1], vars), tbil = num(p[2], vars);
          if (tz != null && tbil != null) features.push({ type: "tb", z: tz, bil: tbil, corners: cornersOf(p[3]), label: "Toppur / Botn" });
          break;
        }
        case "SLA_HLID": {
          // Macro SLA_HLID (read 2026-10-29): params (BAKZ, BORA_I_GEGN, BIL, OFFSET, CRN). Per corner a rectangle 100 mm tall
          // (x from BIL+OFFSET from that end) and BAKZ thick from the corner's own edge — corners "1,4" = the BACK edge, at the
          // bottom and the top end. "Auka slár" has OFFSET lpx/3.
          var bz = num(p[0], vars), sb = num(p[2], vars), so2 = num(p[3], vars);
          if (bz != null && sb != null && so2 != null) features.push({ type: "rail", y: sb + so2, h: 100, bakz: bz, corners: cornersOf(p[4]), label: op.label || "Slá" });
          break;
        }
        case "LOM": case "IKEALOM": {
          var hf = hingeFeature(op, vars);
          if (hf) features = features.concat(hf); else unknown.push(op);
          break;
        }
        case "FOST_HILLA": {
          var mm = num(p[1], vars);
          if (mm == null) { unknown.push(op); break; }
          features.push({ type: "shelfFixed", y: mm, t: num(p[0], vars) || 16, k: num(p[2], vars), d: num(p[3], vars), label: op.label || "Föst hilla" });
          break;
        }
        case "LAUS_HILLA": {
          var first = num(p[0], vars), n = num(p[1], vars), spacing = num(p[4], vars) || 50;
          if (first == null || n == null) { unknown.push(op); break; }
          var ys = []; for (var k = 0; k < n; k++) ys.push(first + k * spacing);
          features.push({ type: "shelfLoose", ys: ys, yf: num(p[2], vars), yb: num(p[3], vars), label: op.label || "Laus hilla" });
          break;
        }
        case "LEGRABOX_NEDSTA_SKUFFA": {
          var H = num(p[0], vars), code = p[1];
          if (H == null) { unknown.push(op); break; }
          drawerCursor = 0;
          features.push({ type: "drawer", from: 0, to: H, sys: "legra", label: "Skúffa " + code + " (" + H + " mm)" });
          drawerCursor = H + 3;
          break;
        }
        case "LEGRABOX_SKUFFA": case "MERIVOBOX_V2": {
          var H2 = num(p[6], vars), code2 = p[7];
          if (H2 == null) { unknown.push(op); break; }
          var from = drawerCursor;
          features.push({ type: "drawer", from: from, to: from + H2, sys: op.name === "MERIVOBOX_V2" ? "merivo" : "legra", label: "Skúffa " + code2 + " (" + H2 + " mm)" });
          drawerCursor = from + H2 + 3;
          break;
        }
        case "LEGRABOX_INNSKUFFA": case "MERVIBOX_INNSKUFFA": {
          var H3 = num(p[0], vars), x = num(p[1], vars), code3 = p[2];
          if (H3 == null || x == null) { unknown.push(op); break; }
          features.push({ type: "inner", from: x, to: x + H3, label: "Innskúffa " + code3 + " (" + H3 + " mm)" });
          break;
        }
        case "FAST_FRAMSTYKKI": {
          var H4 = num(p[0], vars);
          if (H4 == null) { unknown.push(op); break; }
          var to = vars.LPX - fixedCursor, from2 = to - H4;
          features.push({ type: "fixed", from: from2, to: to, label: "Fast framstykki (" + H4 + " mm)" });
          fixedCursor += H4 + 3;
          break;
        }
        case "CUT_X": {
          info.push((op.label || "Sögun") + ": virk");
          // the masonite groove (4 mm wide, 16 mm from the back edge, Y = its centre from the front edge) and the LED routs (4 × 8):
          // vertical lines on the side, Y = mm from the front edge (2026-10-29)
          var cy = num(p[3], vars), isLed = /^LED/i.test(op.label || ""), isMas = /masonit/i.test(op.label || "");
          if (cy != null && (isLed || isMas)) {
            var gs = num(p[2], vars), gl = num(p[6], vars); // start + length: a custom LED run is shorter than the panel
            features.push({ type: "groove", y: cy, led: isLed, x0: Math.max(0, gs == null ? 0 : gs), x1: gl != null && gs != null ? Math.min(vars.LPX, gs + gl) : vars.LPX, label: isLed ? "LED-fræsing 4 × 8 mm — " + cy + " mm frá framkanti" : "Masonít-rauf 4 mm — 16 mm frá bakbrún" });
          }
          break;
        }
        case "EMUCA_HANG_FATASLA": case "KESSEBOHMER_TOPLIFT_FATASLA": {
          // Fatalyfta (2026-10-29). Read from the macros' own geometry (Macros/*.vbs): POSITION_X along the side from the bottom,
          // POSITION_Y from the front edge. Emuca: the housing's box [X−263, X] × [Y+20, Y+160] with its 4 screw holes
          // (X−249 / X−19 × Y+27 / Y+153). Toplift: the arm slot (P1022), the plate (P1012) with 3 Ø12 holes, the 525 mm bar (P1020).
          var lx = num(p[0], vars), ly = num(p[1], vars);
          if (lx == null || ly == null) { unknown.push(op); break; }
          var em = op.name === "EMUCA_HANG_FATASLA", sh = [];
          if (em) {
            sh.push({ k: "rect", x0: lx - 263, x1: lx, y0: ly + 20, y1: ly + 160 });
            [lx - 249, lx - 19].forEach(function (hx) { [ly + 27, ly + 153].forEach(function (hy) { sh.push({ k: "hole", x: hx, y: hy, r: 2.5 }); }); });
          } else {
            sh.push({ k: "poly", pts: [[lx - 50, ly], [lx - 50, ly + 25], [lx - 150, ly + 220], [lx - 175, ly + 220], [lx - 75, ly + 25], [lx - 75, ly - 25], [lx - 175, ly - 220], [lx - 150, ly - 220], [lx - 50, ly - 25]] });
            sh.push({ k: "rect", x0: lx - 690, x1: lx - 471, y0: ly - 99, y1: ly + 100 });
            sh.push({ k: "rect", x0: lx - 515, x1: lx + 10, y0: ly - 10, y1: ly + 10 });
            [[lx - 481, ly - 31], [lx - 519, ly - 79], [lx - 680, ly + 69]].forEach(function (h2) { sh.push({ k: "hole", x: h2[0], y: h2[1], r: 6 }); });
          }
          features.push({ type: "lift", shapes: sh, label: (em ? "Emuca fatalyfta" : "Kessebohmer toplift") + " — " + lx + " mm frá botni, " + ly + " mm frá framkanti" });
          break;
        }
        case "GEO": case "ENDPATH": case "GEOTEXT": case "STAT_BLOCK": case "BG": case "RECTANGLE": case "MOVENTO_BAKKI":
          break; // decorative / unmanaged shop-master furniture, not drawn
        default:
          unknown.push(op);
      }
    });
    return { features: features, unknown: unknown, info: info };
  }

  function buildFrontSkuffaFeatures(ops, vars) {
    var features = [], names = ops.filter(function (o) { return o.active; }).map(function (o) { return o.name; });
    Object.keys(FRONT_EXTRA_MM).forEach(function (n) {
      if (names.indexOf(n) >= 0) features.push({ type: "shelfFixed", y: FRONT_EXTRA_MM[n], axis: "y", label: n + " — " + FRONT_EXTRA_MM[n] + " mm frá botni" });
    });
    ops.filter(function (o) { return o.active && o.name === "HARDVIDAR_GRIP_ENDA_TIL_ENDA"; }).forEach(function (o) {
      var gy = num(o.params[0], vars);
      if (gy != null) features.push({ type: "shelfFixed", y: gy, axis: "y", label: "Harðviðargrip (fræst alla leið) — " + gy + " mm frá botni" });
    });
    return { features: features, unknown: [], info: [] };
  }

  function buildDoorFeatures(kind, ops, glb) {
    var g = {};
    Object.keys(glb).forEach(function (k) { if (/^HS_/.test(k)) g[k.slice(3)] = parseFloat(glb[k]); });
    var names = ops.filter(function (o) { return o.active; }).map(function (o) { return o.name; });
    var has = function (list) { return list.some(function (n) { return names.indexOf(n) >= 0; }); };
    var floorRel = kind !== "hurdablad";
    var HG = g.HG_BIL || 0, H = g.HURD_H;
    function fromTop(mm) { var y = H - mm; return floorRel ? HG + y : y; }
    function fromBottom(mm) { return floorRel ? HG + mm : mm; }
    var hingeHW = kind === "hurdablad" ? LEAF_HW.slice(0, 4) : kind === "karmur-lamir" ? JAMB_HINGE_HW : [];
    var lockHW = kind === "hurdablad" ? LEAF_HW.slice(4, 8) : kind === "karmur-slut" ? JAMB_STRIKE_HW : [];
    var thrHW = kind === "hurdablad" ? ["FELLI_THROSKULDUR"] : [];
    var features = [], info = [];
    if (H == null) { return { features: [], unknown: [], info: ["Engin GLB=HS_HURD_H fannst — mál óþekkt"] }; }
    var suffix = floorRel ? " (mælt frá gólfi, blaðsmál + " + HG + " mm bil)" : " frá botni/toppi blaðs";
    if (has(hingeHW)) {
      if (g.LOM1 != null) features.push({ type: "hinge", y: fromTop(g.LOM1), label: "Löm 1 — " + g.LOM1 + " mm" + suffix });
      if (g.LOM2 != null) features.push({ type: "hinge", y: fromTop(g.LOM2), label: "Löm 2 — " + g.LOM2 + " mm" + suffix });
      if (g.LOM3 != null) features.push({ type: "hinge", y: fromBottom(g.LOM3), label: "Löm 3 — " + g.LOM3 + " mm" + suffix });
    } else info.push("Engin löm virk í þessari skrá");
    if (has(lockHW)) { if (g.HANDFANG != null) features.push({ type: "handle", y: fromBottom(g.HANDFANG), label: "Handfang/skrá — " + g.HANDFANG + " mm" + suffix }); }
    if (has(thrHW)) features.push({ type: "threshold", y: 0, label: "Felliþröskuldur" });
    return { features: features, unknown: [], info: info, HURD_B: g.HURD_B, KARMAR_B: g.KARMAR_B };
  }

  // ── rendering — styled after a real BiesseWorks piece-editor screen (2026-10-14, user-supplied photo):
  // light warm-gray canvas, the piece always drawn "sideways" (PAN=LPX horizontal — that's literally the
  // machine's own X axis, confirmed by the photo's "Piece width (mm): HURD_H" field being bound to X),
  // teal annotation text/leader-lines, hinge/lock positions as pill-shaped markers docked on the top edge.
  var ZONE_FILL = { drawer: "#9db8cf", inner: "#c7a9d6", fixed: "#d9b98a" };
  var ZONE_STROKE = { drawer: "#4f7294", inner: "#8a5fa3", fixed: "#a3773f" };

  function svgEl(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  var gridPatternN = 0;
  function renderPlan(panelW, panelH, features, dims) {
    var maxW = 640, maxH = 300;
    var scale = Math.min(maxW / panelW, maxH / panelH);
    var W = panelW * scale, H = panelH * scale;
    var mmPx = function (px) { return px / scale; };
    var svg = svgEl("svg", { class: "plan", width: W, height: H, viewBox: "0 0 " + panelW + " " + panelH });
    var fontMm = mmPx(10), strokeMm = mmPx(1.1);

    var patId = "bwgrid" + (++gridPatternN);
    var defs = svgEl("defs", {});
    var grid = mmPx(22);
    var pattern = svgEl("pattern", { id: patId, width: grid, height: grid, patternUnits: "userSpaceOnUse" });
    pattern.appendChild(svgEl("circle", { cx: 1, cy: 1, r: mmPx(0.6), fill: "#00000014" }));
    defs.appendChild(pattern); svg.appendChild(defs);
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: panelW, height: panelH, fill: "#fbfaf6" }));
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: panelW, height: panelH, fill: "url(#" + patId + ")" }));
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: panelW, height: panelH, fill: "none", stroke: "var(--bw-ink)", "stroke-width": strokeMm * 1.3 }));

    var toSvgYbottomUp = function (y) { return panelH - y; }; // only for axis:"y" features (front-skuffa)

    var order = { drawer: 0, inner: 0, fixed: 0, rail: 1, shelfFixed: 1, shelfLoose: 1, hinge: 2, handle: 2, threshold: 2 };
    var sorted = features.slice().sort(function (a, b) { return (order[a.type] || 0) - (order[b.type] || 0); });
    var markerIx = 0; // staggers hinge/handle labels so close-together markers don't overlap text
    sorted.forEach(function (f) {
      if (f.type === "drawer" || f.type === "inner" || f.type === "fixed") {
        var x0 = Math.max(0, Math.min(panelW, f.from)), x1 = Math.max(0, Math.min(panelW, f.to));
        var left = x0, w = Math.max(1, x1 - x0);
        svg.appendChild(svgEl("rect", { x: left, y: 0, width: w, height: panelH, fill: ZONE_FILL[f.type], "fill-opacity": .45, stroke: ZONE_STROKE[f.type], "stroke-width": strokeMm, "stroke-dasharray": f.type === "inner" ? mmPx(5) + "," + mmPx(4) : "none" }));
        var t = svgEl("text", { x: left + w / 2, y: panelH / 2, "text-anchor": "middle", "dominant-baseline": "middle", fill: "#2a2a2a", "font-size": fontMm, "font-weight": "700", "font-family": "var(--bw-font)" });
        t.textContent = f.label; svg.appendChild(t);
      } else if (f.type === "hinge" || f.type === "handle") {
        var cx = f.y, topY = mmPx(2);
        var pw = mmPx(f.type === "hinge" ? 20 : 12), ph = mmPx(9);
        var shape = f.type === "hinge"
          ? svgEl("rect", { x: cx - pw / 2, y: topY, width: pw, height: ph, rx: ph / 2, fill: "var(--bw-pill)", stroke: "var(--bw-pill-ink)", "stroke-width": strokeMm, "fill-opacity": f.unsure ? .5 : 1 })
          : svgEl("rect", { x: cx - pw / 2, y: topY, width: pw, height: ph, fill: "var(--bw-pill)", stroke: "var(--bw-pill-ink)", "stroke-width": strokeMm });
        svg.appendChild(shape);
        var stagger = (markerIx++ % 2) * mmPx(16);
        svg.appendChild(svgEl("line", { x1: cx, y1: topY + ph, x2: cx, y2: topY + ph + mmPx(16) + stagger, stroke: "var(--bw-teal)", "stroke-width": strokeMm * .7, "stroke-dasharray": mmPx(3) + "," + mmPx(2) }));
        var lt = svgEl("text", { x: cx, y: topY + ph + mmPx(26) + stagger, "text-anchor": "middle", fill: "var(--bw-teal)", "font-size": fontMm * .88, "font-style": "italic", "font-family": "var(--bw-font)" });
        lt.textContent = f.label; svg.appendChild(lt);
      } else if (f.type === "shelfFixed" || f.type === "shelfLoose") {
        var ys = f.type === "shelfLoose" ? f.ys : [f.y];
        ys.forEach(function (y, i) {
          if (f.axis === "y") {
            var sy = toSvgYbottomUp(y);
            svg.appendChild(svgEl("line", { x1: 0, y1: sy, x2: panelW, y2: sy, stroke: "var(--bw-teal)", "stroke-width": strokeMm * .8, "stroke-dasharray": mmPx(12) + "," + mmPx(5) }));
            if (i === 0) { var st = svgEl("text", { x: panelW - mmPx(6), y: sy - mmPx(5), "text-anchor": "end", fill: "var(--bw-teal)", "font-size": fontMm * .85, "font-style": "italic", "font-family": "var(--bw-font)" }); st.textContent = f.label; svg.appendChild(st); }
          } else {
            svg.appendChild(svgEl("line", { x1: y, y1: 0, x2: y, y2: panelH, stroke: "var(--bw-teal)", "stroke-width": strokeMm * .8, "stroke-dasharray": mmPx(12) + "," + mmPx(5) }));
            if (i === 0) { var st2 = svgEl("text", { x: y + mmPx(5), y: mmPx(14), fill: "var(--bw-teal)", "font-size": fontMm * .85, "font-style": "italic", "font-family": "var(--bw-font)" }); st2.textContent = f.label; svg.appendChild(st2); }
          }
        });
      } else if (f.type === "rail") {
        svg.appendChild(svgEl("line", { x1: f.y, y1: 0, x2: f.y, y2: panelH, stroke: "#8a8878", "stroke-width": strokeMm }));
        var rt = svgEl("text", { x: f.y + mmPx(5), y: panelH - mmPx(6), fill: "#726f5e", "font-size": fontMm * .8, "font-family": "var(--bw-font)" });
        rt.textContent = f.label; svg.appendChild(rt);
      } else if (f.type === "threshold") {
        svg.appendChild(svgEl("rect", { x: 0, y: 0, width: mmPx(7), height: panelH, fill: "#b05c4a", "fill-opacity": .6 }));
      }
    });

    if (dims) {
      var bx = mmPx(10), by = mmPx(10), bw2 = mmPx(90), bh2 = mmPx(16 + (dims.LPZ != null ? 15.5 * 3 : 15.5 * 2));
      svg.appendChild(svgEl("rect", { x: bx, y: by, width: bw2, height: bh2, fill: "#fff", stroke: "#555", "stroke-width": strokeMm, rx: mmPx(3) }));
      var lines = ["X = " + dims.LPX, "Y = " + dims.LPY]; if (dims.LPZ != null) lines.push("Z = " + dims.LPZ);
      lines.forEach(function (line, i) {
        var dt = svgEl("text", { x: bx + mmPx(8), y: by + mmPx(14 + i * 15.5), fill: "#222", "font-size": fontMm * .95, "font-family": "ui-monospace,Menlo,Consolas,monospace", "font-weight": "700" });
        dt.textContent = line; svg.appendChild(dt);
      });
    }
    return svg;
  }

  // ── calm view (2026-10-26, default): only what to check before milling — hinge plate holes, shelf-pin rows,
  // fixed-shelf lines, drawer/inner runner lines — thin lines, standing up like the cabinet (bottom at the bottom,
  // front edge to the left), labels on hover (<title>). opts.accent = { hinge, shelf, inner }: drawn in blue when
  // that part was set by hand (in /smida), else ink. The BiesseWorks-style view stays one click away ("Tæknilegt").
  // Blum side heights (mm) — the same table the planner draws boxes with (kitchen-planner-3d.js DRAWER_CODES, Blum catalogue)
  var BOX_SIDE = { merivo: { N: 63, M: 91, K: 129, E: 192 }, legra: { M: 90.5, K: 128.5, C: 177, F: 241 } };
  // Blum cruciform mounting plate at true scale (2026-10-26, measured from Blum's own GLB: 41.8 × 56.5 mm). mm, origin =
  // plate centre on the screw line (the 37 mm line /cnc drills), u = toward the FRONT edge (the arm clips on that wing),
  // v = up. Drawn into group `el` with centre (cx, cy) px, s px/mm, front edge to the left (screen x = cx − u·s).
  function drawPlate(el, cx, cy, s, stroke, dir) {
    dir = dir || 1; // +1: front edge to the left on screen, −1: mirrored (front edge to the right)
    var P = function (u, v) { return (cx - dir * u * s).toFixed(2) + " " + (cy - v * s).toFixed(2); };
    var a = { fill: "#fff", stroke: stroke, "stroke-width": 1.1, "stroke-linejoin": "round" };
    el.appendChild(svgEl("path", Object.assign({ d: "M" + P(11, -8.45) + " L" + P(21.2, -8.45) + " Q" + P(22.8, -8.45) + " " + P(22.8, -6.8) + " L" + P(22.8, 7.3) +
      " Q" + P(22.8, 8.95) + " " + P(21.2, 8.95) + " L" + P(11, 8.95) + " Z" }, a))); // front wing
    el.appendChild(svgEl("path", Object.assign({ d: "M" + P(-11, -5.25) + " L" + P(-19, -5.25) + " L" + P(-19, 2.95) + " L" + P(-11, 2.95) + " Z" }, a))); // rear tab
    el.appendChild(svgEl("rect", Object.assign({ x: cx - 13 * s, y: cy - 28.25 * s, width: 26 * s, height: 56.5 * s, rx: 4.5 * s }, a))); // body, over the joins
    el.appendChild(svgEl("circle", { cx: cx + dir * 3.8 * s, cy: cy - 0.15 * s, r: 1.8 * s, fill: "none", stroke: stroke, "stroke-width": .9 })); // adjusting screw
  }
  function renderCalm(LPX, LPY, features, opts) {
    opts = opts || {};
    var acc = opts.accent || {}, BLUE = "#0071e3", INK = "#1d1d1f", SOFT = "#8e8e93", RED = "#d70015";
    var maxH = opts.maxH || 560, maxW = opts.maxW || 360, s = Math.min(maxH / LPX, maxW / LPY);
    var fr = opts.fronts && opts.fronts.length, colW = fr ? 12 : 0, gap = fr ? 7 : 0;
    // opts.mirror: the right side drawn as the mirror image of the left (front edge to the right) — the two sides face each other
    var mir = !!opts.mirror, w = LPY * s, h = LPX * s, padL = mir ? 22 : 30 + colW + gap, padR = mir ? 30 + colW + gap : 22, top = 12;
    var X = function (d) { return padL + (mir ? LPY - d : d) * s; }, Y = function (m) { return top + (LPX - m) * s; };
    var L = padL; // the panel's left edge on screen, whichever way it faces
    var XR = function (a, b) { var p = X(a), q = X(b); return { x: Math.min(p, q), w: Math.abs(q - p) }; };
    var svg = svgEl("svg", { class: "bpp-calm-svg", width: padL + w + padR, height: h + top + 24, viewBox: "0 0 " + (padL + w + padR) + " " + (h + top + 24),
      "data-s": s, "data-lpx": LPX, "data-top": top });
    function g(label, type, y) { var el = svgEl("g", { class: "cz" }); var t = svgEl("title", {}); t.textContent = label; el.appendChild(t);
      if (type) { el.setAttribute("data-type", type); el.setAttribute("data-y", Math.round(y)); } svg.appendChild(el); return el; }
    svg.appendChild(svgEl("rect", { x: L, y: Y(LPX), width: w, height: h, rx: 2, fill: "#fff", stroke: INK, "stroke-width": 1.2 }));
    var front = Math.min(37, LPY / 3), back = LPY - Math.min(37, LPY / 3);
    // fronts column (front edge = left)
    (opts.fronts || []).forEach(function (f) {
      var ef = g(f.label, "front", f.from);
      var colX = mir ? L + w + gap : L - gap - colW;
      ef.appendChild(svgEl("rect", { x: colX, y: Y(f.to), width: colW, height: Math.max(1, (f.to - f.from) * s), rx: f.kind === "grip" ? 0 : 1.5, fill: f.kind === "grip" ? "#c7c7cc" : "#f2f2f4", stroke: f.kind === "grip" ? "none" : "#aeaeb2", "stroke-width": 1 }));
      if ((f.to - f.from) * s > 14 && f.short) { var ft = svgEl("text", { x: colX + colW / 2, y: Y((f.from + f.to) / 2), "text-anchor": "middle", "dominant-baseline": "middle", "font-size": 9, fill: SOFT }); ft.textContent = f.short; ef.appendChild(ft); }
    });
    if (opts.fre) { // FRE cabinet (2026-10-29, owner): a whole back, as thick as the FRE board, from the top edge of the top rail's place to the bottom edge of the bottom one
      var frr = features.filter(function (f) { return f.type === "rail"; });
      if (frr.length) {
        var flo = Math.min.apply(null, frr.map(function (f) { return f.y; })), fhi = LPX - flo, fz = frr[0].bakz || 16, fb = XR(LPY - fz, LPY), efb = g("Heilt bak (FRE) — " + Math.round(fz) + " mm þykkt, " + Math.round(flo) + "–" + Math.round(fhi) + " mm frá botni");
        efb.appendChild(svgEl("rect", { x: fb.x, y: Y(fhi), width: Math.max(2, fb.w), height: Math.max(2, (fhi - flo) * s), fill: "#e4e4e9", stroke: "#6e6e73", "stroke-width": 1 }));
      }
    }
    features.forEach(function (f) {
      if (f.type === "drawer") {
        // the box as the Rover macro places it: on its runner line, as tall as the Blum side of its code
        var code = (String(f.label).match(/skúffa\s+([NMKCFE])\b/i) || [])[1] || "", sys = f.sys || "merivo";
        var el = g(f.label + " — úr Sögunarlista", "drawer", f.from), from = Math.max(0, f.from), to = Math.min(LPX, f.to);
        var ry = from + (sys === "legra" ? 62.5 : 80); // runner over its slot, as cnc-sides.js plans it
        var sideH = (BOX_SIDE[sys] || BOX_SIDE.merivo)[code.toUpperCase()] || 90;
        el.appendChild(svgEl("rect", { x: L + 3, y: Y(to), width: w - 6, height: Math.max(1, (to - from) * s), fill: "#f7f7f9" }));
        var dep = opts.depths && opts.depths[code.toUpperCase()], bx = XR(Math.min(12, LPY / 20), dep > 0 ? Math.min(LPY - 2, dep) : LPY - Math.min(22, LPY / 12)); // box as deep as its drawerDepth (Smíða) when known
        el.appendChild(svgEl("rect", { x: bx.x, y: Y(ry + sideH), width: bx.w, height: sideH * s, rx: 2, fill: "#fff", stroke: SOFT, "stroke-width": 1.1 }));
        el.appendChild(svgEl("line", { x1: X(front), x2: X(back), y1: Y(ry), y2: Y(ry), stroke: SOFT, "stroke-width": 1.6, "stroke-linecap": "round" }));
        if (code && sideH * s > 9) { var tl = svgEl("text", { x: X(LPY / 2), y: Y(ry + sideH / 2), "text-anchor": "middle", "dominant-baseline": "middle", "font-size": Math.min(12, sideH * s * .55), fill: SOFT }); tl.textContent = code.toUpperCase(); el.appendChild(tl); }
      } else if (f.type === "inner") {
        // an inner drawer = its front band (front bottom = runner − 54, cnc-sides.js INNER_RUNNER), dashed: it hides behind a front
        var icode = (String(f.label).match(/skúffa\s+([NMKCFE])\b/i) || [])[1] || "", ih = f.to - f.from, ib = f.from - 54;
        var ei = g(f.label + " — innskúffa", "inner", f.from), ic = acc.inner ? BLUE : "#6e6e73";
        var ibx = XR(Math.min(12, LPY / 20), LPY - Math.min(22, LPY / 12));
        ei.appendChild(svgEl("rect", { x: ibx.x, y: Y(ib + ih), width: ibx.w, height: ih * s, rx: 2, fill: "#fff", stroke: ic, "stroke-width": 1.1, "stroke-dasharray": "5 3" }));
        ei.appendChild(svgEl("line", { x1: X(front), x2: X(back), y1: Y(f.from), y2: Y(f.from), stroke: ic, "stroke-width": 1.6, "stroke-linecap": "round" }));
        if (ih * s > 12) { var it = svgEl("text", { x: X(LPY / 2), y: Y(ib + ih / 2), "text-anchor": "middle", "dominant-baseline": "middle", "font-size": Math.min(11, ih * s * .4), fill: ic }); it.textContent = "inn " + icode.toUpperCase(); ei.appendChild(it); }
      } else if (f.type === "fixed") {
        var ef2 = g(f.label); ef2.appendChild(svgEl("rect", { x: L + 3, y: Y(f.to), width: w - 6, height: Math.max(1, (f.to - f.from) * s), fill: "#f5f5f7" }));
      } else if (f.type === "shelfFixed") {
        var t0 = f.t || 16, es = g(f.label + " — " + Math.round(f.y) + " mm (efri flötur)", "shelf", f.y);
        // FOST_HILLA macro: the board is `d` deep from `k` mm in from the front (depth lpy−22 or the Sögunarlisti depth) — it stops at the masonite, not the back
        var fk = f.k != null ? f.k : 2, fd = f.d != null ? f.d : LPY - 22, fr2 = XR(fk, Math.min(LPY, fk + fd));
        es.appendChild(svgEl("rect", { x: fr2.x, y: Y(f.y), width: fr2.w, height: Math.max(1.5, t0 * s), fill: acc.shelf ? "#cfe3fb" : "#d1d1d6", stroke: acc.shelf ? BLUE : INK, "stroke-width": .9 }));
        [30, fd / 2, fd - 30, fd - 70, 70].forEach(function (hy) { es.appendChild(svgEl("circle", { cx: X(fk + hy), cy: Y(f.y - t0 / 2), r: Math.max(1.3, 2.5 * s), fill: acc.shelf ? BLUE : INK })); });
      } else if (f.type === "shelfLoose") {
        var mid = f.ys[Math.floor(f.ys.length / 2)], el2 = g(f.label + " — " + Math.round(mid + 16) + " mm, göt " + f.ys.map(function (y) { return Math.round(y); }).join(", "), "shelf", mid);
        // the shelf as cut (Sögunarlisti depth, opts.shelfD.loose, 2 mm in from the front like FOST_HILLA) — stops at the masonite;
        // pin rows exactly as LAUS_HILLA drills them: YF from the front edge, YB from the back edge
        var ld = opts.shelfD && opts.shelfD.loose ? opts.shelfD.loose : LPY - 22, lr = XR(2, Math.min(LPY, 2 + ld));
        el2.appendChild(svgEl("rect", { x: lr.x, y: Y(mid + 16), width: lr.w, height: Math.max(1.5, 16 * s), fill: acc.shelf ? "#e8f1fc" : "#f2f2f4", stroke: acc.shelf ? BLUE : SOFT, "stroke-width": .8, "stroke-dasharray": "4 3" }));
        var pf = f.yf != null ? f.yf : front, pb = f.yb != null ? LPY - f.yb : back;
        f.ys.forEach(function (y) { [pf, pb].forEach(function (d) { el2.appendChild(svgEl("circle", { cx: X(d), cy: Y(y), r: 2.4, fill: acc.shelf ? BLUE : INK })); }); });
      } else if (f.type === "hinge") {
        var eh = g(f.label || "Löm", "hinge", f.y);
        drawPlate(eh, X(front), Y(f.y), s, acc.hinge ? BLUE : INK, mir ? -1 : 1);
      } else if (f.type === "tb") {
        // toppur / botn: its footprint at each end (bottom: x from BIL, top: mirrored), the 5 end holes in it
        var etb = g(f.label + " — " + Math.round(f.z) + " mm þykkt, " + Math.round(f.bil) + " mm bil → tekur " + Math.round(f.bil + f.z) + " mm af hæðinni í hvorum enda", null);
        f.corners.forEach(function (cn) {
          var bot = cn <= 2, back = cn === 1 || cn === 4, x0 = bot ? f.bil : LPX - f.bil - f.z, d0 = back ? 1 : 0, d1 = back ? LPY : LPY - 1, rr = XR(d0, d1);
          etb.appendChild(svgEl("rect", { x: rr.x, y: Y(x0 + f.z), width: rr.w, height: Math.max(2, f.z * s), fill: "#ece6d6", stroke: "#9c8a6b", "stroke-width": .9 }));
          [30, 70, (LPY - 1) / 2, LPY - 31, LPY - 71].forEach(function (hy) { etb.appendChild(svgEl("circle", { cx: X(back ? LPY - hy : hy), cy: Y(x0 + f.z / 2), r: Math.max(1.6, 4 * s), fill: "none", stroke: "#7a6a4a", "stroke-width": .9 })); });
          var tl2 = svgEl("text", { x: X(LPY / 2), y: Y(bot ? x0 + f.z : x0) + (bot ? -3 : 10), "text-anchor": "middle", "font-size": 9, fill: "#7a6a4a" }); tl2.textContent = (bot ? "Botn " : "Toppur ") + Math.round(f.bil + f.z) + " mm"; etb.appendChild(tl2);
        });
      } else if (f.type === "rail" && opts.fre) {
        return; // FRE: no rails — one back board drawn above
      } else if (f.type === "rail") {
        // slá (SLA_HLID): a 100 mm tall, BAKZ thick block at the back edge, at both ends (+ the extra ones at lpx/3)
        var er = g(f.label + " — í bakinu, " + Math.round(f.y) + " mm frá enda", "rail", f.y);
        f.corners.forEach(function (cn) {
          var bot = cn <= 2, back = cn === 1 || cn === 4, x0 = bot ? f.y : LPX - f.y - f.h, rr2 = back ? XR(LPY - f.bakz, LPY) : XR(0, f.bakz);
          er.appendChild(svgEl("rect", { x: rr2.x, y: Y(x0 + f.h), width: rr2.w, height: Math.max(2, f.h * s), fill: "#e4e4e9", stroke: "#6e6e73", "stroke-width": 1 }));
        });
      } else if (f.type === "lift") {
        var elf = g(f.label, "lift", (f.shapes[0].pts ? f.shapes[0].pts[0][0] : f.shapes[0].x1)), lc2 = acc.rail ? BLUE : "#6e6e73";
        f.shapes.forEach(function (sp) {
          if (sp.k === "rect") { var rx = XR(sp.y0, sp.y1); elf.appendChild(svgEl("rect", { x: rx.x, y: Y(sp.x1), width: rx.w, height: Math.max(1, (sp.x1 - sp.x0) * s), fill: "none", stroke: lc2, "stroke-width": 1, "stroke-dasharray": "5 3" })); }
          else if (sp.k === "poly") elf.appendChild(svgEl("polygon", { points: sp.pts.map(function (q) { return X(q[1]).toFixed(1) + "," + Y(q[0]).toFixed(1); }).join(" "), fill: "#f2f2f4", stroke: lc2, "stroke-width": 1.1 }));
          else elf.appendChild(svgEl("circle", { cx: X(sp.y), cy: Y(sp.x), r: Math.max(2, sp.r * s), fill: "#fff", stroke: lc2, "stroke-width": 1.2 }));
        });
      } else if (f.type === "groove") {
        var egr = g(f.label), gx = X(f.y), gw = Math.max(f.led ? 3 : 2, 4 * s); // LED: magenta, true 4 mm (at least 3 px) so a clash is easy to see
        var gx1 = f.x1 != null ? f.x1 : LPX, gx0 = f.x0 != null ? f.x0 : 0;
        egr.appendChild(svgEl("rect", { x: gx - gw / 2, y: Y(gx1), width: gw, height: Math.max(1, (gx1 - gx0) * s), fill: f.led ? "#e6007e" : "#e6dcc8", stroke: f.led ? "#e6007e" : "#9c8a6b", "stroke-width": f.led ? 0 : .9 }));
      }
    });
    (opts.hits || []).forEach(function (hh) {
      var eh2 = g("Árekstur " + Math.round(hh.from) + "–" + Math.round(hh.to) + " mm");
      eh2.appendChild(svgEl("rect", { x: L - 2, y: Y(hh.to), width: w + 4, height: Math.max(3, (hh.to - hh.from) * s), fill: RED, "fill-opacity": .22, stroke: RED, "stroke-width": 1.2 }));
    });
    var t1 = svgEl("text", { x: mir ? L + w + gap + colW + 6 : L - gap - colW - 6, y: Y(LPX / 2), "text-anchor": mir ? "start" : "end", "dominant-baseline": "middle", "font-size": 11, fill: "#a1a1a6" }); t1.textContent = LPX; svg.appendChild(t1);
    var t2 = svgEl("text", { x: X(LPY / 2), y: Y(0) + 16, "text-anchor": "middle", "font-size": 11, fill: "#a1a1a6" }); t2.textContent = LPY; svg.appendChild(t2);
    return svg;
  }
  var CALM_CSS = ".bpp-calmv{background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px 14px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f}" +
    ".bpp-calm-h{display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px}.bpp-calm-h b{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".bpp-calm-h button{font:inherit;font-size:12px;color:#0071e3;background:none;border:none;cursor:pointer;padding:2px 0}" +
    ".bpp-calm-body{display:flex;justify-content:center}.bpp-calm-svg .cz{cursor:default}.bpp-calm-svg .cz:hover line,.bpp-calm-svg .cz:hover path,.bpp-calm-svg .cz[data-type=hinge]:hover rect,.bpp-calm-svg .cz[data-type=hinge]:hover circle{stroke:#0071e3;fill:#fff}.bpp-calm-svg .cz:hover line,.bpp-calm-svg .cz:hover rect[rx='2']{stroke:#0071e3}.bpp-calm-svg .cz:hover circle{fill:#0071e3}.bpp-calm-svg .cz:hover text{fill:#0071e3}" +
    ".bpp-card.bpp-calm>.bw-window,.bpp-card.bpp-calm>.bpp-raw,.bpp-card.bpp-calm .bpp-note.info{display:none}.bpp-card:not(.bpp-calm)>.bpp-calmv .bpp-calm-body{display:none}" +
    ".bpp-card:not(.bpp-calm)>.bpp-calmv{border:none;background:none;padding:0 0 6px}";
  function ensureCalmCss() {
    if (typeof document === "undefined" || document.getElementById("bppCalmCss")) return;
    var st = document.createElement("style"); st.id = "bppCalmCss"; st.textContent = CALM_CSS; document.head.appendChild(st);
  }

  var LEGEND_ITEMS = [
    ["drawer", "Skúffa"], ["inner", "Innskúffa"], ["fixed", "Fast framstykki"], ["hinge", "Löm"],
    ["handle", "Handfang/skrá"], ["shelfFixed", "Föst hilla"], ["shelfLoose", "Laus hilla"], ["rail", "Slá"], ["threshold", "Þröskuldur"],
  ];
  var LEGEND_COLOR = { drawer: "#9db8cf", inner: "#c7a9d6", fixed: "#d9b98a", hinge: "#4f7294", handle: "#4f7294", shelfFixed: "#2f7f6a", shelfLoose: "#2f7f6a", rail: "#8a8878", threshold: "#b05c4a" };

  // A master with 2+ template lines for the same managed macro made renderSide (cnc-sides.js /
  // cnc-doors.js) re-emit that macro's whole op group at every template occurrence before 2026-10-14's
  // fix (commit d342425) — flag it whenever the exact same active macro call (name + params) repeats in a
  // file, in case an older (pre-fix) export is ever dragged in or a new flavor of the bug ever creeps back
  // in, since a legitimate file never issues the identical command twice.
  var DUP_IGNORE = { ENDPATH: 1, GEO: 1 }; // legitimately repeat identically, not a sign of duplication
  function findDuplicateOps(ops) {
    var seen = {}, dups = [];
    ops.filter(function (o) { return o.active && !DUP_IGNORE[o.name]; }).forEach(function (o) {
      var k = o.name + "|" + o.params.join(",");
      seen[k] = (seen[k] || 0) + 1;
    });
    Object.keys(seen).forEach(function (k) { if (seen[k] > 1) dups.push(k.split("|")[0] + " (" + seen[k] + "×): " + k.split("|")[1]); });
    return dups;
  }

  // ── macro list panel (left side, like BiesseWorks' own program tree) ───────────────────────────────────
  var ICON_CAT = [
    [/^(LOM|IKEALOM|COPLAN|LAMIR_89|IN05020_)/, "#4f7294"],                 // hinges — blue
    [/^(IN_20_835|IN_20_937|EN12209|KFV_|SEGUL_|JNF_|HAWAJ_)/, "#a3773f"],  // locks/strike — tan/orange
    [/^(LEGRABOX|MERIVOBOX|MERVIBOX)/, "#5b8f6b"],                          // drawer boxes — green
    [/^(GEO|ENDPATH|GEOTEXT|STAT_BLOCK|RECTANGLE|START_POINT|LINC_EP)/, "#8a8878"], // structural — neutral
    [/^(FELLI_THROSKULDUR|HYDRAULIC)/, "#8a5fa3"],                          // threshold/pivot — purple
  ];
  function iconColor(name) {
    for (var i = 0; i < ICON_CAT.length; i++) if (ICON_CAT[i][0].test(name)) return ICON_CAT[i][1];
    return "#9b9686";
  }
  function buildMacroList(ops) {
    var list = document.createElement("div"); list.className = "bw-list";
    ops.forEach(function (o) {
      var row = document.createElement("div"); row.className = "bw-row" + (o.child ? " child" : "");
      var chk = document.createElement("span"); chk.className = "bw-chk" + (o.active ? " on" : "");
      var icon = document.createElement("span"); icon.className = "bw-icon"; icon.style.background = iconColor(o.name);
      var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = o.label && o.label !== o.name ? o.name + " (" + o.label + ")" : o.name;
      row.appendChild(chk); row.appendChild(icon); row.appendChild(nm);
      row.title = (o.active ? "virk" : "óvirk") + ": " + o.name + (o.params.length ? " : " + o.params.join(", ") : "");
      list.appendChild(row);
    });
    return list;
  }

  function mkNote(cls, text) { var n = document.createElement("div"); n.className = "bpp-note " + cls; n.textContent = text; return n; }

  // ── per-file card. `outEl`/`toolbarEl` are the page's own containers — the ✕ button needs them to know
  // whether to hide the toolbar once the last card is gone; each page supplies its own (bpp-viewer.html's
  // drop zone vs cnc.html's post-export preview section) so the two can coexist on the same page as cnc.html
  // does without id collisions. ────────────────────────────────────────────────────────────────────────
  // opts.view: "calm" (default, 2026-10-26) or "tech" (the BiesseWorks window); opts.accent → renderCalm
  function buildCard(file, text, outEl, toolbarEl, opts) {
    opts = opts || {};
    var card = document.createElement("div"); card.className = "bpp-card";
    var win = document.createElement("div"); win.className = "bw-window"; card.appendChild(win);

    var titlebar = document.createElement("div"); titlebar.className = "bw-titlebar";
    var ttl = document.createElement("div"); ttl.className = "ttl"; ttl.textContent = "Editor — " + file.name;
    var rm = document.createElement("button"); rm.className = "remove"; rm.textContent = "✕"; rm.title = "Fjarlægja";
    rm.onclick = function () { card.remove(); if (outEl && toolbarEl && !outEl.children.length) toolbarEl.classList.add("hide"); };
    titlebar.appendChild(ttl); titlebar.appendChild(rm);
    win.appendChild(titlebar);

    var notes = document.createElement("div"); // appended after the window, kept in page-dark style

    var parsed;
    try { parsed = parseBpp(text); } catch (e) {
      notes.appendChild(mkNote("err", "Gat ekki lesið skrána: " + e.message));
      card.appendChild(notes); return card;
    }
    var kind = detectKind(parsed);
    var kchip = document.createElement("span"); kchip.className = "bpp-chip kind" + (kind === "unknown" ? " unknown" : "");
    kchip.textContent = KIND_LABEL[kind]; titlebar.insertBefore(kchip, rm);

    var vars = parsed.vars;
    if (vars.LPX == null || vars.LPY == null) {
      notes.appendChild(mkNote("warn", "Fann ekki PAN=LPX/LPY í skránni — ekki hægt að teikna."));
      card.appendChild(notes); return card;
    }

    if (kind === "unknown") notes.appendChild(mkNote("warn", "Þekki ekki þessa skrá sem /cnc-skrá (engin GLB=HS_ merking fannst) — útlitið gæti verið rangt. Sýni bara hráan lista."));
    if (kind === "karmur-topp") notes.appendChild(mkNote("info", "Toppstykki: engin staðsetningarmerki sýnd hér (láréttur bútur, ekki sama hnitakerfi og hurð/karmur) — bara mál."));
    var dupOps = findDuplicateOps(parsed.ops);
    if (dupOps.length) notes.appendChild(mkNote("err", "Sama aðgerðin kemur fram " + dupOps.length + "× of oft í skránni (líklega vegna þess að master-skráin er með fleiri en eina sniðmátslínu fyrir sama makró) — vélin myndi keyra þetta tvisvar/oftar: " + dupOps.join("; ")));

    var built;
    if (kind === "hlid" || kind === "front-hurd") built = buildSideFeatures(parsed.ops, vars);
    else if (kind === "front-skuffa") built = buildFrontSkuffaFeatures(parsed.ops, vars);
    else if (kind === "hurdablad" || kind === "karmur-lamir" || kind === "karmur-slut" || kind === "karmur-topp") built = buildDoorFeatures(kind, parsed.ops, parsed.glb);
    else if (kind === "botn-urtak") built = { features: [], unknown: [], info: ["Úrtak fyrir vatnslás (URTAK_F_VATNSLAS) — teiknað í /smida, ekki hér."] };
    else built = { features: [], unknown: parsed.ops.filter(function (o) { return o.active; }), info: [] };

    // calm view on top (only for what it can draw: sides and door fronts); the full window below, one click away
    if (kind === "hlid" || kind === "front-hurd") {
      ensureCalmCss();
      var calm = document.createElement("div"); calm.className = "bpp-calmv";
      var ch = document.createElement("div"); ch.className = "bpp-calm-h";
      var cb = document.createElement("b"); cb.textContent = file.name; ch.appendChild(cb);
      var tb = document.createElement("button"); tb.type = "button";
      var setView = function (v) { card.classList.toggle("bpp-calm", v === "calm"); tb.textContent = v === "calm" ? "Tæknilegt" : "Einfalt"; card.dataset.view = v; };
      tb.onclick = function () { setView(card.classList.contains("bpp-calm") ? "tech" : "calm"); };
      ch.appendChild(tb);
      if (outEl) { var cx = document.createElement("button"); cx.type = "button"; cx.textContent = "Fjarlægja"; cx.style.color = "#8e8e93"; cx.onclick = rm.onclick; ch.appendChild(cx); }
      calm.appendChild(ch);
      var cbody = document.createElement("div"); cbody.className = "bpp-calm-body";
      cbody.appendChild(renderCalm(vars.LPX, vars.LPY, built.features, { accent: opts.accent, maxH: opts.maxH, maxW: opts.maxW, hits: opts.hits, fronts: opts.fronts, mirror: opts.mirror, fre: opts.fre, depths: opts.depths }));
      calm.appendChild(cbody);
      card.insertBefore(calm, win);
      setView(opts.view === "tech" ? "tech" : "calm");
    }

    var body = document.createElement("div"); body.className = "bw-body";
    body.appendChild(buildMacroList(parsed.ops));
    var canvasWrap = document.createElement("div"); canvasWrap.className = "bw-canvas-wrap";
    canvasWrap.appendChild(renderPlan(vars.LPX, vars.LPY, built.features, { LPX: vars.LPX, LPY: vars.LPY, LPZ: vars.LPZ }));
    body.appendChild(canvasWrap);
    win.appendChild(body);

    if (built.features.length) {
      var usedTypes = {}; built.features.forEach(function (f) { usedTypes[f.type] = 1; });
      var legend = document.createElement("div"); legend.className = "bpp-legend";
      LEGEND_ITEMS.filter(function (it) { return usedTypes[it[0]]; }).forEach(function (it) {
        var s = document.createElement("span"); var i = document.createElement("i"); i.style.background = LEGEND_COLOR[it[0]];
        s.appendChild(i); s.appendChild(document.createTextNode(it[1])); legend.appendChild(s);
      });
      win.appendChild(legend);
    }

    (built.info || []).forEach(function (t) { notes.appendChild(mkNote("info", t)); });
    if (built.unknown && built.unknown.length) {
      notes.appendChild(mkNote("warn", built.unknown.length + " virk(ar) aðgerð(ir) sem þessi skoðari teiknar ekki á myndina (sjá gátreit-listann til vinstri fyrir heiti, eða \"Hráar aðgerðir\" fyrir færibreytur)."));
    }
    card.appendChild(notes);

    var raw = document.createElement("details"); raw.className = "bpp-raw";
    var sum = document.createElement("summary"); sum.textContent = "Hráar aðgerðir með færibreytum (" + parsed.ops.filter(function (o) { return o.active; }).length + " virkar)";
    raw.appendChild(sum);
    var rlist = document.createElement("div"); rlist.className = "bpp-rawlist";
    parsed.ops.forEach(function (o) {
      var d = document.createElement("div"); if (!o.active) d.className = "off";
      d.textContent = (o.active ? "@ " : "' ") + o.name + (o.label ? " \"" + o.label + "\"" : "") + ": " + o.params.join(", ");
      rlist.appendChild(d);
    });
    raw.appendChild(rlist); card.appendChild(raw);
    return card;
  }

  var api = {
    parseBpp: parseBpp, detectKind: detectKind, KIND_LABEL: KIND_LABEL,
    buildSideFeatures: buildSideFeatures, buildFrontSkuffaFeatures: buildFrontSkuffaFeatures, buildDoorFeatures: buildDoorFeatures,
    renderPlan: renderPlan, findDuplicateOps: findDuplicateOps, buildMacroList: buildMacroList, buildCard: buildCard, mkNote: mkNote, renderCalm: renderCalm, drawPlate: drawPlate,
    LEGEND_ITEMS: LEGEND_ITEMS, LEGEND_COLOR: LEGEND_COLOR,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCBPP = api;
})(typeof window !== "undefined" ? window : globalThis);
