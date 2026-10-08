// cnc-sides.js — cabinet-side programs for the Rover-B, built ONLY from Sögunarlisti (the pieces that were
// actually cut) and the shop's own side master ([01] - Innvols/[01] - Hliðar.bpp).
//
// Agreed with the user 2026-10-08:
//  - sizes, drawers, inner drawers, shelves and doors all come from the unit's Sögunarlisti rows — no CNC-side
//    rules for dimensions, so Eyðublað/Sögunarlisti is the single place to fix things;
//  - side programs only (top/bottom/rails have their own program), but a side still gets TOPP_BOTN + SLA_HLID;
//  - inner drawer: gap from the top of its front to the underside of the cabinet top ≥ 4 mm, aim 20 (finger pull);
//  - hinges: 80 mm from each end of the side; the same function gives the fronts' positions (79, fronts are 3 mm
//    shorter than the box), so side and door can't disagree; default positions are flagged for checking;
//  - identical sides share one file.
// Pure functions: cnc.html feeds Sögunarlisti rows + master text, tests feed fixtures.
(function (root) {
  "use strict";

  var MASTER = ["[01] - Innvols", "[01] - Hliðar.bpp"];
  var BOX_GAP = 3;          // every front is 3 mm shorter than its box (one 3 mm gap per front)
  var HINGE_END = 80;       // hinge centre from each end of the side
  var HINGE_FRONT_OFFSET = 1; // …and 79 on the front itself
  var INNER_GAP_AIM = 20, INNER_GAP_MIN = 4;
  var INNER_RUNNER = 54;    // MERVIBOX_INNSKUFFA: the inner front starts 54 mm below X ("st_5mm frontur er 54 fyrir neðan")
  var TALL_EXTRA_RAIL = 1500; // sides taller than this get the extra rail ("Auka slár", lpx/3) — T-56 SK 10.1 / SK 17
  // Bottom → top order of a drawer stack: deepest box first.
  var CODE_ORDER = ["F", "E", "C", "K", "M", "N"];
  // Every macro this generator decides about. All master lines with these names are switched off and the
  // generated ones are inserted next to them. CUT_X only for the masonite groove (the LED CUT_X lines stay as they are).
  var MANAGED = ["TOPP_BOTN", "GRUNNUR_SKAPUR_TB", "SLA_HLID", "LOM", "IKEALOM", "FOST_HILLA", "LAUS_HILLA",
    "LEGRABOX_NEDSTA_SKUFFA", "LEGRABOX_SKUFFA", "LEGRABOX_INNSKUFFA", "MERIVOBOX_BOTNSKUFFA", "MERIVOBOX_V2", "MERVIBOX_INNSKUFFA"];
  var GROOVE_LABEL = "masonit";

  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function lc(s) { return String(s || "").toLowerCase(); }

  // "SK 1" → "SK01", "SK 11/ 13 EYJA" → "SK11-13", "SK 9.2 (FRE)" → "SK09.2"; anything else cleaned as typed.
  function unitId(name) {
    var s = String(name || "").trim();
    var m = s.match(/^sk\s*([0-9][0-9.]*(?:\s*[\/,&-]\s*[0-9][0-9.]*)*)/i);
    if (!m) return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 30) || "?";
    var parts = m[1].split(/\s*[\/,&-]\s*/).map(function (p, i) { return i === 0 && /^\d(\.|$)/.test(p) ? "0" + p : p; });
    return "SK" + parts.join("-");
  }

  // What kind of Sögunarlisti row is this?
  function kind(partur) {
    var p = lc(partur);
    if (/úthlið|blindlok/.test(p)) return "uthlid";
    if (/karm|slaglist|kjötlist|gerefti|hurðablað/.test(p)) return "doorPart"; // door jambs ("Karmur – Hliðar") are /cnc's door half
    if (/^fre\b/.test(p) && /hlið/.test(p)) return "freSide";
    if (/hlið/.test(p)) return "side";
    var dm = String(partur).match(/^(inn)?skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i);
    if (dm) return dm[1] ? "inner" : "drawer";
    if (/^frontur/.test(p)) return "door";
    if (/laus.*hill/.test(p)) return "looseShelf";
    if (/föst.*hill/.test(p)) return "fixedShelf";
    if (/bak$/.test(p) || / bak\b/.test(p)) return "back";
    return "other";
  }

  // Hinge centres on a door/box of length `len` (mm from the bottom end): 80 from each end + middle ones by the
  // Eyðublað rule (≤1000: 2, ≤1500: 3, ≤2000: 4, else 5), middle ones moved just below anything they'd hit
  // (`avoid` = positions within the same span, e.g. shelf rows or drawer runners). Returns { at:[…], moved:[…], blocked:[…] }.
  function hingePositions(len, avoid) {
    var n = len <= 1000 ? 2 : len <= 1500 ? 3 : len <= 2000 ? 4 : 5;
    var at = [HINGE_END, len - HINGE_END], moved = [], blocked = [];
    for (var i = 1; i < n - 1; i++) {
      var p = r1(HINGE_END + (len - 2 * HINGE_END) * i / (n - 1));
      var hit = (avoid || []).filter(function (a) { return Math.abs(a - p) < 50; });
      if (hit.length) {
        var q = r1(Math.min.apply(null, hit) - 50);
        var still = (avoid || []).some(function (a) { return Math.abs(a - q) < 50; });
        if (still || q < HINGE_END + 100) blocked.push(p); else { moved.push(p + "→" + q); p = q; }
      }
      at.push(p);
    }
    return { at: at.sort(function (a, b) { return a - b; }), moved: moved, blocked: blocked };
  }
  function frontHinges(len, avoid) { // the same positions as seen from the front (79 instead of 80)
    var h = hingePositions(len, avoid);
    return h.at.map(function (x) { return x < len / 2 ? x - HINGE_FRONT_OFFSET : x + HINGE_FRONT_OFFSET; });
  }

  // One unit's Sögunarlisti rows → what its sides need. rows: [{Partur, H, B, Þ, M, Tegund einingu}]
  function unitPlan(name, rows) {
    var stop = [], check = [], info = [];
    var by = {}; rows.forEach(function (r) { var k = kind(r.Partur); (by[k] = by[k] || []).push(r); });
    var tegund = String([].concat((rows[0] || {})["Tegund einingu"] || "")[0] || "");
    var plan = { name: name, id: unitId(name), tegund: tegund, stop: stop, check: check, info: info, ops: [] };
    if (by.freSide) { stop.push("FRE-skápur — bíður hönnuðar (bak, rastex) og er gerður í höndunum þangað til"); }
    // Plinths, end panels, covers… have no carcass side — not a side program, not an error.
    if (!by.side) { plan.status = by.freSide ? "stop" : "skip"; return plan; }
    if (by.side.length > 1) {
      var sz = by.side.map(function (r) { return r.H + "×" + r.B + "×" + r["Þ"]; });
      if (sz.some(function (s) { return s !== sz[0]; })) { stop.push("Hliðar af ólíkri stærð í sömu einingu (" + sz.join(", ") + ") — skipta einingunni"); plan.status = "stop"; return plan; }
    }
    var s = by.side[0], H = num(s.H), B = num(s.B), T = num(s["Þ"]);
    var sideCount = by.side.reduce(function (a, r) { return a + (num(r.M) || 0); }, 0);
    if (H == null || B == null || T == null) { stop.push("Hlið vantar H/B/Þ í Sögunarlista"); plan.status = "stop"; return plan; }
    var cab = sideCount / 2;
    if (cab !== Math.round(cab) || cab < 1) { check.push("Fjöldi hliða (" + sideCount + ") er ekki slétt tala skápa — gert ráð fyrir 1 skáp"); cab = 1; }
    plan.LPX = H; plan.LPY = B; plan.LPZ = T; plan.cabinets = cab;
    var per = function (r) { var m = (num(r.M) || 0) / cab; if (m !== Math.round(m)) check.push(r.Partur + ": magn " + r.M + " deilist ekki á " + cab + " skápa"); return Math.round(m); };
    var expand = function (list, f) { var out = []; (list || []).forEach(function (r) { for (var i = 0; i < per(r); i++) out.push(f(r)); }); return out; };

    var op = function (name, label, params) { plan.ops.push({ name: name, label: label, params: params }); };
    // Joints to top/bottom and the rails — every side.
    op("TOPP_BOTN", "Toppur / Botn", 'Bora_I_Gegn, LPZ, 1, "1,4"');
    op("SLA_HLID", "Slár", 'LPZ, bora_i_gegn, lpz+1, 0, "1,4"');
    if (H > TALL_EXTRA_RAIL) op("SLA_HLID", "Auka Slár", 'LPZ, bora_i_gegn, lpz+1, lpx/3, "1,4"');
    // Masonite groove unless it's a plumbing (lagna) side — the master's own note: "Ef lagna = ekki masonit".
    plan.groove = !/lagna/i.test(s.Partur);

    // Drawers, bottom → top, from the real front heights.
    var drawers = expand(by.drawer, function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]), H: num(r.H) }; });
    drawers.sort(function (a, b) { return CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code) || b.H - a.H; });
    var sys = {}; drawers.forEach(function (d) { sys[d.sys] = 1; });
    if (Object.keys(sys).length > 1) { stop.push("Merivo og Legra í sama skáp"); plan.status = "stop"; return plan; }
    var y = 0, runners = [], drawerTop = 0;
    drawers.forEach(function (d, i) {
      var below = r1(y - BOX_GAP);
      if (d.sys === "merivo") op("MERIVOBOX_V2", "Skúffa " + d.code, below + ", 0, 0, 0, 0, 0, " + d.H + ", " + d.code);
      else if (i === 0) op("LEGRABOX_NEDSTA_SKUFFA", "Skúffa " + d.code, d.H + ", " + d.code);
      else op("LEGRABOX_SKUFFA", "Skúffa " + d.code, below + ", 0, 0, 0, 0, 0, " + d.H + ", " + d.code);
      runners.push(r1(y + (d.sys === "merivo" ? 80 : 62.5)));
      d.from = y; y = r1(y + d.H + BOX_GAP); d.to = y;
    });
    drawerTop = y;
    if (drawers.some(function (d) { return d.sys === "legra"; })) check.push("Legra: staðsetning eftir sama mynstri og Merivo — bera saman við fyrsta Legra-skáp");

    // Doors: stacked from the top of the side down (above the drawers).
    var doors = expand(by.door, function (r) { return { H: num(r.H), partur: r.Partur }; });
    var top = H;
    doors.forEach(function (d) { d.to = top; d.from = r1(top - d.H - BOX_GAP); top = d.from; });
    var oven = /ofn/i.test(tegund) || (by.door || []).some(function (r) { return /ofn/i.test(r.Partur); });
    var stackSum = r1(drawerTop + (H - top));
    if (!oven && (drawers.length || doors.length) && Math.abs(stackSum - H) > 1.5)
      check.push("Frontar (" + stackSum + ") passa ekki við hlið (" + H + ") — athuga röðun/hæðir");
    if (oven) check.push("Ofnaskápur: föstu hillurnar og ofninn bíða hönnuðar — settu þær inn eftir teikningu");

    // Loose shelves: one row of 3 holes each, spread evenly over the door space (default — per drawing).
    var loose = expand(by.looseShelf, function (r) { return r; }).length;
    var shelfRows = [];
    if (loose) {
      var a = doors.length ? Math.max(drawerTop, top) : drawerTop, b = H;
      for (var i = 1; i <= loose; i++) shelfRows.push(r1(a + (b - a) * i / (loose + 1)));
      shelfRows.forEach(function (x) { op("LAUS_HILLA", "Laus hilla", r1(x - 50) + ", 3, 37, 20+60, 50"); });
      check.push("Lausar hillur (" + loose + "): sjálfgefin staðsetning — breyttu eftir teikningu ef þarf");
    }
    var fixed = expand(by.fixedShelf, function (r) { return r; }).length;
    if (fixed && !oven) check.push("Föst hilla (" + fixed + ") — staðsetning ekki í gögnum, settu inn eftir teikningu");

    // Inner drawers.
    //  - inside the top drawer (base cabinets): top of the inner front ≥ 4 mm below the underside of the cabinet
    //    top (or the drawer box top), aim 20 for a finger pull (user, 2026-10-08);
    //  - behind a door (tall cabinets): stacked from the bottom like the shop does it (T-56 SK 17: first front 5 mm
    //    above the bottom board, 85 mm between fronts) — flagged, the drawing decides.
    var inner = expand(by.inner, function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]), H: num(r.H) }; });
    if (inner.length) {
      var macroOf = function (d) { return d.sys === "merivo" ? "MERVIBOX_INNSKUFFA" : "LEGRABOX_INNSKUFFA"; };
      if (drawers.length) {
        var topD = drawers[drawers.length - 1], ceil = topD.to >= H - 1.5 ? H - T : topD.to, floor = topD.from, edge = ceil;
        inner.forEach(function (d, i) {
          var gap = i === 0 ? INNER_GAP_AIM : BOX_GAP;
          if (edge - gap - d.H < floor) gap = i === 0 ? INNER_GAP_MIN : 0;
          var frontTop = r1(edge - gap);
          if (frontTop - d.H < floor) stop.push("Innskúffa " + d.code + " (" + d.H + ") kemst ekki fyrir í efstu skúffunni");
          runners.push(r1(frontTop - d.H + INNER_RUNNER)); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + r1(frontTop - d.H + INNER_RUNNER) + ", " + d.code);
          edge = r1(frontTop - d.H);
        });
        if (inner.length > 1 || oven) check.push("Innskúffur (" + inner.length + "): athuga staðsetningu eftir teikningu");
      } else {
        var bottom = T + 5;
        inner.forEach(function (d) { runners.push(r1(bottom + INNER_RUNNER)); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + r1(bottom + INNER_RUNNER) + ", " + d.code); bottom = r1(bottom + d.H + 85); });
        if (bottom > H - T) stop.push("Innskúffur komast ekki fyrir");
        check.push("Innskúffur bak við hurð (" + inner.length + "): neðan frá, 85 mm á milli — athuga eftir teikningu");
      }
    }

    // Hinges: per door, 80 from each end of its box; corner "2" = from the bottom, "3" = from the top.
    var hingeAt = [];
    doors.forEach(function (d) {
      var len = r1(d.to - d.from);
      var avoid = shelfRows.concat(runners).filter(function (x) { return x > d.from && x < d.to; }).map(function (x) { return r1(x - d.from); });
      var h = hingePositions(len, avoid);
      h.moved.forEach(function (m) { check.push("Löm færð frá hillu/skúffu: " + m + " (frá neðri brún hurðar)"); });
      h.blocked.forEach(function (m) { check.push("Löm við " + m + " rekst á hillu/skúffu — setja handvirkt"); });
      h.at.forEach(function (p) { hingeAt.push(r1(d.from + p)); });
      d.hinges = h.at; d.frontHinges = frontHinges(len, avoid);
    });
    hingeAt.sort(function (a, b) { return a - b; });
    hingeAt.forEach(function (x) {
      var fromTop = r1(H - x);
      if (Math.abs(x - HINGE_END) < 0.01 && hingeAt.indexOf(r1(H - HINGE_END)) >= 0) return; // covered by "2,3" below
      if (Math.abs(fromTop - HINGE_END) < 0.01 && hingeAt.indexOf(HINGE_END) >= 0) { op("LOM", "Löm", HINGE_END + ', 37, "2,3"'); return; }
      if (x <= H / 2) op("LOM", "Löm", x + ', 37, "2"'); else op("LOM", "Löm", fromTop + ', 37, "3"');
    });
    if (doors.length) check.push("Lamir: sjálfgefið 80 frá endum hverrar hurðar — ef lyftihurð/push, taktu þær út");

    plan.drawers = drawers; plan.doors = doors; plan.loose = loose;
    plan.status = stop.length ? "stop" : check.length ? "check" : "ok";
    return plan;
  }

  // Same machining → same file. Name doesn't matter, only what the machine does.
  function signature(p) { return JSON.stringify([p.LPX, p.LPY, p.LPZ, p.groove, p.ops.map(function (o) { return o.name + ":" + o.params; })]); }
  function groupPlans(plans) {
    var groups = [], bySig = {};
    plans.forEach(function (p) {
      if (p.status === "stop" || p.status === "skip") return;
      var k = signature(p);
      if (!bySig[k]) { bySig[k] = { plans: [] }; groups.push(bySig[k]); }
      bySig[k].plans.push(p);
    });
    groups.forEach(function (g) {
      g.plans.sort(function (a, b) { return a.id.localeCompare(b.id, "is", { numeric: true }); });
      var ids = g.plans.map(function (p, i) { return i === 0 ? p.id : p.id.replace(/^SK/, ""); });
      g.label = ids.join("+");
      if (g.label.length > 90) g.label = ids.slice(0, 8).join("+") + "+" + (ids.length - 8) + " fl";
      g.cabinets = g.plans.reduce(function (a, p) { return a + p.cabinets; }, 0);
    });
    return groups.sort(function (a, b) { return a.label.localeCompare(b.label, "is", { numeric: true }); });
  }
  function fileName(prefix, group) { return (prefix ? prefix + " " : "") + group.label.replace(/[\\/:*?"<>|]+/g, "-") + " Hliðar.bpp"; }

  // Master text (CRLF, decoded) + one plan → program. Managed master lines are switched off, generated lines
  // inserted right after the first master line of the same macro (new unique object ids), sizes as numbers.
  function renderSide(text, p) {
    var nl = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lines = text.split(/\r?\n/), errors = [], section = "", used = {};
    lines.forEach(function (l) { var m = l.match(/, (\d{8,9}), "", 0 :/); if (m) used[m[1]] = 1; });
    var seed = 0; p.ops.forEach(function (o) { for (var i = 0; i < o.params.length; i++) seed = (seed * 31 + o.params.charCodeAt(i)) >>> 0; });
    function newId() { var id; do { seed = (seed * 1103515245 + 12345) >>> 0; id = String(100000000 + (seed % 99999999)); } while (used[id]); used[id] = 1; return id; }
    var firstAt = {}, out = [];
    lines.forEach(function (l) {
      var sec = l.match(/^\[([A-Z]+)\]\s*$/); if (sec) section = sec[1];
      if (section === "VARIABLES") {
        var pan = l.match(/^PAN=(LPX|LPY|LPZ)\|[^|]*\|(.*)$/);
        if (pan) l = "PAN=" + pan[1] + "|" + p[pan[1]] + "|" + pan[2];
      }
      if (section === "PROGRAM") {
        var m = l.match(/^([@'])( +)([A-Z0-9_]+), "", "([^"]*)",(.*)$/);
        if (m && m[3] === "CUT_X" && lc(m[4]).indexOf(GROOVE_LABEL) >= 0) l = (p.groove ? "@" : "'") + m[2] + "CUT_X, \"\", \"" + m[4] + "\"," + m[5];
        else if (m && MANAGED.indexOf(m[3]) >= 0) { l = "'" + m[2] + m[3] + ', "", "' + m[4] + '",' + m[5]; if (firstAt[m[3]] == null) firstAt[m[3]] = out.length; }
      }
      out.push(l);
    });
    // Insert in reverse so earlier indexes stay valid; ops with the same macro keep their order.
    var groups = {}; p.ops.forEach(function (o) { (groups[o.name] = groups[o.name] || []).push(o); });
    var stat = out.findIndex(function (l) { return /^@ STAT_BLOCK,/.test(l); });
    Object.keys(groups).map(function (n) { return { n: n, at: firstAt[n] != null ? firstAt[n] + 1 : (stat >= 0 ? stat : -1) }; })
      .sort(function (a, b) { return b.at - a.at; })
      .forEach(function (g) {
        if (g.at < 0) { errors.push("Fann ekki stað fyrir " + g.n + " í master"); return; }
        if (firstAt[g.n] == null) errors.push("Makró " + g.n + " er ekki í master — bætt við á undan STAT_BLOCK");
        var add = groups[g.n].map(function (o) { return "@ " + o.name + ', "", "' + o.label + '", ' + newId() + ', "", 0 : ' + o.params; });
        out.splice.apply(out, [g.at, 0].concat(add));
      });
    var lastPan = -1; out.forEach(function (l, i) { if (/^PAN=LP[XYZ]\|/.test(l)) lastPan = i; });
    if (lastPan < 0) errors.push("Fann ekki PAN=LPX í master");
    else out.splice(lastPan + 1, 0, "GLB=HS_HLID|1|Bjorninn CNC|0|"); // marks a file made by /cnc (re-exports may replace it)
    return { text: out.join(nl), errors: errors };
  }

  var MARKER = "GLB=HS_HLID|";
  var api = { MARKER: MARKER, MASTER: MASTER, MANAGED: MANAGED, unitId: unitId, kind: kind, unitPlan: unitPlan, hingePositions: hingePositions,
    frontHinges: frontHinges, signature: signature, groupPlans: groupPlans, fileName: fileName, renderSide: renderSide };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCSIDES = api;
})(typeof window !== "undefined" ? window : globalThis);
