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
  var INNER_TOP_GAP = 32;  // inner drawer front top sits 32 mm under the top of the zone it hides in (T-33, T-56)
  var FIXED_FRONT_MAX = 350; // a "Frontur" this low in a drawer cabinet is a fixed (false) front — FAST_FRAMSTYKKI, no hinges
  var INNER_RUNNER = 54;    // MERVIBOX_INNSKUFFA: the inner front starts 54 mm below X ("st_5mm frontur er 54 fyrir neðan")
  var TALL_EXTRA_RAIL = 1000; // sides taller than this get the extra rail ("Auka slár", lpx/3) — user 2026-10-08 (T-33 Sk 34 = 1040)
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
    if (/^fre\d*\b/.test(p) && /hlið/.test(p)) return "freSide"; // "FRE - Hlið", "FRE2 - Hlið"
    if (/hlið/.test(p)) return "side";
    var dm = String(partur).match(/^(inn)?skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i);
    if (dm) return dm[1] ? "inner" : "drawer";
    if (/^(skiptur )?frontur/.test(p)) return "door"; // "Skiptur frontur 1/2/3" = a front split in Smíða
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

  // ── Smíðagögn (2026-10-08): positions decided in the designer's pro mode, carried Line Item → Eyðublað ──
  // { v:1, doors:[ { h: front mm, type:"hinged"|"lift", side:"vinstri"|"haegri"|null,
  //                  hinges:[ {from:"bottom"|"top", mm} ] } ] }   doors listed top → bottom.
  // Hinge positions are measured from the door's own ends, so they follow small size changes in ÚRVINNSLA.
  var SMIDA_TOLERANCE = 20; // a designer door matches a Sögunarlisti front within ±20 mm
  function parseSmida(v) {
    if (!v) return null;
    if (typeof v === "object") return v;
    try { var o = JSON.parse(String(v)); return o && o.v === 1 ? o : null; } catch (e) { return null; }
  }
  function defaultHingeSpec(boxLen) {
    return hingePositions(boxLen).at.map(function (x) { return x <= boxLen / 2 ? { from: "bottom", mm: r1(x) } : { from: "top", mm: r1(boxLen - x) }; });
  }
  function specToPositions(spec, boxLen) {
    return (spec || []).map(function (h) { return r1(h.from === "top" ? boxLen - h.mm : h.mm); }).sort(function (a, b) { return a - b; });
  }

  // One unit's Sögunarlisti rows → what its sides need. rows: [{Partur, H, B, Þ, M, Tegund einingu}]
  // opts.unitHeight = the Eyðublað's Hæð (only to tell which way a side is stored — Sögunarlisti has some tall
  //   sides as H 580 × B 2470); opts.gripMm = grip strip on the drawer fronts (slot = cut front + grip).
  function unitPlan(name, rows, opts) {
    opts = opts || {};
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
    var s = by.side[0], H = num(s.H), B = num(s.B), T = num(s["Þ"]), hh = num(opts.unitHeight);
    if (hh && H != null && B != null && Math.abs(B - hh) < Math.abs(H - hh)) { var t0 = H; H = B; B = t0; info.push("Hlið snúin: Sögunarlisti " + s.H + "×" + s.B); }
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
    plan.groove = !/lagna/i.test(s.Partur); // and FRE sides never (they stop before this)
    var grip = num(opts.gripMm) || 0;

    // Drawers, bottom → top, from the real front heights.
    var drawers = expand(by.drawer, function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]), front: num(r.H), H: r1(num(r.H) + grip) }; });
    // A drawer whose front is listed as a plain "Frontur" (the low oven OFN6: "Frontur" 202 + "Skúffubak K - Merivo",
    // no "Skúffufrontur K") — the low front becomes that drawer, not a door with hinges (T-32 pilot, 2026-10-09).
    if (!drawers.length) {
      var backs = expand(rows.filter(function (r) { return /^skúffubak\s+[NMKCFE]\b.*?(merivo|legra)/i.test(r.Partur); }), function (r) {
        var m = r.Partur.match(/^skúffubak\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]) }; });
      var lowDoors = (by.door || []).filter(function (r) { return /^frontur$/i.test(String(r.Partur).trim()) && num(r.H) <= FIXED_FRONT_MAX; });
      if (backs.length && backs.length === lowDoors.reduce(function (a, r) { return a + per(r); }, 0)) {
        lowDoors.forEach(function (r) { for (var k = 0; k < per(r); k++) { var bk = backs.shift(); drawers.push({ code: bk.code, sys: bk.sys, front: num(r.H), H: r1(num(r.H) + grip) }); } });
        by.door = (by.door || []).filter(function (r) { return lowDoors.indexOf(r) < 0; });
        info.push("„Frontur“ " + drawers.map(function (d) { return d.front; }).join(", ") + " mm = skúffa " + drawers.map(function (d) { return d.code; }).join(", ") + " (skúffubak í Sögunarlista)");
      }
    }
    if (grip && by.drawer) info.push("Skúffuhólf = front + " + grip + " mm grip");
    drawers.sort(function (a, b) { return CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code) || b.H - a.H; });
    var sys = {}; drawers.forEach(function (d) { sys[d.sys] = 1; });
    if (Object.keys(sys).length > 1) { stop.push("Merivo og Legra í sama skáp"); plan.status = "stop"; return plan; }
    var y = 0, runners = [], drawerTop = 0;
    drawers.forEach(function (d, i) {
      var below = r1(y - BOX_GAP);
      // bottom Merivo drawer: runner at 80 (user, 2026-10-09): V2 puts it at 1.5 + 80 + slot, so slot −1.5
      // (the old −3 gave 78.5, copied from the T-56 hand files)
      if (d.sys === "merivo") op("MERIVOBOX_V2", "Skúffa " + d.code, (i === 0 ? -1.5 : below) + ", 0, 0, 0, 0, 0, " + d.H + ", " + d.code);
      else if (i === 0) op("LEGRABOX_NEDSTA_SKUFFA", "Skúffa " + d.code, d.H + ", " + d.code);
      else op("LEGRABOX_SKUFFA", "Skúffa " + d.code, below + ", 0, 0, 0, 0, 0, " + d.H + ", " + d.code);
      runners.push(r1(y + (d.sys === "merivo" ? 80 : 62.5)));
      d.from = y; y = r1(y + d.H + BOX_GAP); d.to = y;
    });
    drawerTop = y;
    if (drawers.some(function (d) { return d.sys === "legra"; })) check.push("Legra: staðsetning eftir sama mynstri og Merivo — bera saman við fyrsta Legra-skáp");

    // Doors, stacked from the top of the side down (above the drawers).
    //  - a low "Frontur" in a drawer cabinet is a fixed front (FAST_FRAMSTYKKI), not a door;
    //  - two identical fronts that don't fit on top of each other are the leaves of ONE opening (vænghurð);
    //  - a front taller than the space (wall cabinets with a lip below) → the opening is the side's space.
    var doors = expand(by.door, function (r) { return { H: num(r.H), partur: r.Partur }; });
    // split fronts top → bottom by their number (Skiptur frontur 1 = top, as the designer writes Hæð frontur 1)
    var splitNo = function (d) { var m = /skiptur frontur\s*(\d)/i.exec(d.partur); return m ? +m[1] : 0; };
    if (doors.some(splitNo)) doors.sort(function (a, b) { return splitNo(a) - splitNo(b); });
    var fixedFronts = drawers.length ? doors.filter(function (d) { return d.H <= FIXED_FRONT_MAX; }) : [];
    doors = doors.filter(function (d) { return fixedFronts.indexOf(d) < 0; });
    fixedFronts.forEach(function (d) { op("FAST_FRAMSTYKKI", "Fast framstykki", r1(d.H) + ", LPX, 0, 0"); });
    var room = H - drawerTop - fixedFronts.reduce(function (a, d) { return a + d.H + BOX_GAP; }, 0);
    var sumDoors = doors.reduce(function (a, d) { return a + d.H + BOX_GAP; }, 0);
    if (doors.length > 1 && (sumDoors > room + 5 || doors.some(function (d) { return /væng/i.test(d.partur); }))) {
      var seen = {}; doors = doors.filter(function (d) { var k = Math.round(d.H); if (seen[k]) return false; seen[k] = 1; return true; });
      info.push("Vænghurð: hurðir hlið við hlið");
    }
    var top = H - fixedFronts.reduce(function (a, d) { return a + d.H + BOX_GAP; }, 0);
    doors.forEach(function (d) { d.to = top; d.from = r1(Math.max(drawerTop, top - d.H - BOX_GAP)); top = d.from; });
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

    // Inner drawers (user 2026-10-08): on the cabinet sides like any runner, 32 mm back, hidden behind the front
    // of the drawer whose zone it sits in — the tallest drawer zone (tie → the top one); its front top 32 mm under
    // the top of that zone (or of the cabinet's top board). Behind a door (tall cabinets/pantries) the designer
    // places them; until then from the bottom, start 5 mm over the bottom board, front + 80 apart (⚠).
    var inner = expand(by.inner, function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]), H: num(r.H) }; });
    if (inner.length) {
      var macroOf = function (d) { return d.sys === "merivo" ? "MERVIBOX_INNSKUFFA" : "LEGRABOX_INNSKUFFA"; };
      if (drawers.length) {
        var zone = drawers.reduce(function (z, d) { return !z || d.H >= z.H ? d : z; }, null);
        var edge = r1((zone.to >= H - 1.5 ? H - T : zone.to) - INNER_TOP_GAP);
        inner.forEach(function (d) {
          var x = r1(edge - d.H + INNER_RUNNER);
          if (edge - d.H < zone.from + 60) check.push("Innskúffa " + d.code + " (" + d.H + ") — lítið pláss fyrir neðan í hólfi " + zone.code + ", athuga");
          runners.push(x); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + x + ", " + d.code);
          edge = r1(edge - d.H - BOX_GAP);
        });
        if (inner.length > 1 || oven) check.push("Innskúffur (" + inner.length + "): athuga staðsetningu eftir teikningu");
      } else {
        var bottom = T + 5;
        inner.forEach(function (d) { runners.push(r1(bottom + INNER_RUNNER)); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + r1(bottom + INNER_RUNNER) + ", " + d.code); bottom = r1(bottom + d.H + 80); });
        if (bottom > H - T) stop.push("Innskúffur komast ekki fyrir");
        check.push("Innskúffur bak við hurð (" + inner.length + "): sjálfgefið neðan frá, framhlið + 80 á milli — hönnuður staðsetur");
      }
    }

    // Hinges: per door, 80 from each end of its box + evenly between (default), or exactly where the designer put
    // them (Smíðagögn) when its doors match Sögunarlisti; corner "2" = from the bottom, "3" = from the top.
    var smida = parseSmida(opts.smida), sd = null;
    if (smida && Array.isArray(smida.doors) && doors.length) { // no doors = sizes only, /cnc default
      var sdoors = smida.doors || [];
      // Same number of doors → the designer's hinges are used (they're measured from each door's ends, so a few
      // mm of difference doesn't move them off the door); a height that differs by more than 20 mm is flagged.
      if (sdoors.length === doors.length) {
        sd = sdoors; info.push("Lamir úr hönnuði (Smíðagögn)");
        sdoors.forEach(function (x, i) { var dh = Math.abs((num(x.h) || 0) - doors[i].H);
          if (dh > SMIDA_TOLERANCE) check.push("Hurð " + (i + 1) + ": hönnuður " + x.h + " mm, Sögunarlisti " + doors[i].H + " mm — lamir miðaðar við enda hurðar, athuga"); });
      } else check.push("Smíðagögn passa ekki við Sögunarlista (" + sdoors.length + " hurðir í hönnuði, " + doors.length + " í Sögunarlista) — sjálfgefnar lamir notaðar");
    }
    var hingeAt = [], defaulted = false;
    doors.forEach(function (d, i) {
      var len = r1(d.to - d.from), mine = sd && sd[i];
      var avoid = shelfRows.concat(runners).filter(function (x) { return x > d.from && x < d.to; }).map(function (x) { return r1(x - d.from); });
      if (mine && mine.type === "lift") { d.type = "lift"; d.hinges = []; check.push("Lyftihurð (" + d.H + "): engar lamir á hlið — lamirnar fara í toppborðið"); return; }
      var at;
      if (mine && mine.hinges && mine.hinges.length) {
        at = specToPositions(mine.hinges, len);
        at.forEach(function (p) { if (avoid.some(function (a) { return Math.abs(a - p) < 40; })) check.push("Löm við " + p + " (hönnuður) er nálægt hillu/skúffu — athuga"); });
      } else {
        var h = hingePositions(len, avoid); at = h.at; defaulted = true;
        h.moved.forEach(function (m) { check.push("Löm færð frá hillu/skúffu: " + m + " (frá neðri brún hurðar)"); });
        h.blocked.forEach(function (m) { check.push("Löm við " + m + " rekst á hillu/skúffu — setja handvirkt"); });
      }
      at.forEach(function (p) { hingeAt.push(r1(d.from + p)); });
      d.hinges = at; d.frontHinges = at.map(function (x) { return x < len / 2 ? x - HINGE_FRONT_OFFSET : x + HINGE_FRONT_OFFSET; });
    });
    hingeAt.sort(function (a, b) { return a - b; });
    hingeAt.forEach(function (x) {
      var fromTop = r1(H - x);
      if (Math.abs(x - HINGE_END) < 0.01 && hingeAt.indexOf(r1(H - HINGE_END)) >= 0) return; // covered by "2,3" below
      if (Math.abs(fromTop - HINGE_END) < 0.01 && hingeAt.indexOf(HINGE_END) >= 0) { op("LOM", "Löm", HINGE_END + ', 37, "2,3"'); return; }
      if (x <= H / 2) op("LOM", "Löm", x + ', 37, "2"'); else op("LOM", "Löm", fromTop + ', 37, "3"');
    });
    if (defaulted) check.push("Lamir: sjálfgefið 80 frá endum + jafnt á milli — ef lyftihurð fara lamirnar í toppinn, ekki hliðina");

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
    frontHinges: frontHinges, parseSmida: parseSmida, defaultHingeSpec: defaultHingeSpec, specToPositions: specToPositions, signature: signature, groupPlans: groupPlans, fileName: fileName, renderSide: renderSide };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCSIDES = api;
})(typeof window !== "undefined" ? window : globalThis);
