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
  var GRIP_MILL_DEPTH = 30; // HARDVIDAR_GRIP_* DEPTH param — matches every real master/test default seen on the USB (2026-10-14)
  var RADBORUN_PITCH = 32;  // Raðborun (continuous shelf-pin drilling, 2026-10-15): one LAUS_HILLA run at this pitch — see kitchen-planner-3d.js RADBORUN_PITCH_MM
  // Bottom → top order of a drawer stack: deepest box first.
  var CODE_ORDER = ["F", "E", "C", "K", "M", "N"];
  // Every macro this generator decides about. All master lines with these names are switched off and the
  // generated ones are inserted next to them. CUT_X only for the masonite groove (the LED CUT_X lines stay as they are).
  var MANAGED = ["TOPP_BOTN", "GRUNNUR_SKAPUR_TB", "SLA_HLID", "LOM", "IKEALOM", "FOST_HILLA", "LAUS_HILLA",
    "LEGRABOX_NEDSTA_SKUFFA", "LEGRABOX_SKUFFA", "LEGRABOX_INNSKUFFA", "MERIVOBOX_BOTNSKUFFA", "MERIVOBOX_V2", "MERVIBOX_INNSKUFFA", "FATASLA"];
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
  // A hinge plate needs HINGE_CLEAR mm from a shelf hole / fixed shelf / runner row (same line, 37 mm from the front).
  // A middle hinge that would hit one moves to the nearest clear spot (down first, then up, 5 mm steps, ≤ 250 mm).
  // Middle spacing confirmed against real masters 2026-10-13 (Emilia Barugata sk1.bpp, 1980 mm door: hinges at
  // 80, 1980/3=660, 1980/3*2=1320, 1980-80=1900; Birgitta Axlaras sk12/13 wip.bpp, 1990 mm door, same len×i/(n-1)
  // pattern before its hand-adjustments) — middle hinges sit at plain fractions of the FULL door length, not
  // evenly divided between the two 80 mm end hinges as this used to compute (that gave 640/1760 instead of the
  // real 660/1320 for a 1980 mm, 4-hinge door — ~27 mm off).
  var HINGE_CLEAR = 30;
  function hingePositions(len, avoid) {
    var n = len <= 1000 ? 2 : len <= 1500 ? 3 : len <= 2000 ? 4 : 5;
    var at = [HINGE_END, len - HINGE_END], moved = [], blocked = [];
    function clear(q) { return !(avoid || []).some(function (a) { return Math.abs(a - q) < HINGE_CLEAR; }); }
    for (var i = 1; i < n - 1; i++) {
      var p = r1(len * i / (n - 1));
      if (!clear(p)) {
        var q = null;
        for (var d = 5; d <= 250 && q == null; d += 5) {
          [p - d, p + d].forEach(function (c) { if (q == null && c >= HINGE_END + 100 && c <= len - HINGE_END - 100 && clear(c)) q = r1(c); });
        }
        if (q == null) blocked.push(p); else { moved.push(p + "→" + q); p = q; }
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
  var SMIDA_TOLERANCE = 20;
  var OVEN_BOARD = 16; // Loftunarbotn / Loftunartoppur / shelves in an oven cabinet (carcass board) // a designer door matches a Sögunarlisti front within ±20 mm
  function parseSmida(v) {
    if (!v) return null;
    if (typeof v === "object") return v;
    try { var o = JSON.parse(String(v)); return o && o.v === 1 ? o : null; } catch (e) { return null; }
  }
  function defaultHingeSpec(boxLen, avoid) { // avoid = shelf rows etc. measured from the door's bottom (the designer passes them)
    return hingePositions(boxLen, avoid).at.map(function (x) { return x <= boxLen / 2 ? { from: "bottom", mm: r1(x) } : { from: "top", mm: r1(boxLen - x) }; });
  }
  function specToPositions(spec, boxLen) {
    return (spec || []).map(function (h) { return r1(h.from === "top" ? boxLen - h.mm : h.mm); }).sort(function (a, b) { return a - b; });
  }

  // One unit's Sögunarlisti rows → what its sides need. rows: [{Partur, H, B, Þ, M, Tegund einingu}]
  // opts.unitHeight = the Eyðublað's Hæð (only to tell which way a side is stored — Sögunarlisti has some tall
  //   sides as H 580 × B 2470); opts.gripMm = grip strip on the drawer fronts (slot = cut front + grip).
  function unitPlan(name, rows, opts) {
    opts = opts || {};
    var stop = [], check = [], info = [], defaults = [];
    // a default the cabinet's review in PRO accepts ("Skápur yfirfarinn", Smíðagögn ready): shown until then, dropped after
    function dflt(msg) { check.push(msg); defaults.push(msg); }
    var by = {}; rows.forEach(function (r) { var k = kind(r.Partur); (by[k] = by[k] || []).push(r); });
    var tegund = String([].concat((rows[0] || {})["Tegund einingu"] || "")[0] || "");
    var plan = { name: name, id: unitId(name), tegund: tegund, stop: stop, check: check, info: info, ops: [] };
    // FRE (owner 2026-10-29): an FRE cabinet works like any other — its "FRE - Hlið" rows are the sides; plan.fre marks it
    // (no masonite groove on FRE sides)
    if (by.freSide && !by.side) { by.side = by.freSide; plan.fre = true; info.push("FRE-skápur — hliðar úr „FRE - Hlið“"); }
    // Plinths, end panels, covers… have no carcass side — not a side program, not an error.
    if (!by.side) { plan.status = "skip"; return plan; }
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
    plan.groove = !/lagna/i.test(s.Partur) && !plan.fre; // and FRE sides never (they stop before this)
    var grip = num(opts.gripMm) || 0;

    // Drawers, bottom → top, from the real front heights.
    // A Fræst grip "alla" lárétt zone (Smíðagögn grip[] → Eyðublað "Grip svæði") was taken off that front's Sérhæð /
    // Hæð frontur N by Keyra skipulag (35 mm), so the cut front is 35 shorter than its slot: add it back to the slot
    // like any grip (2026-10-27 — before, the runners above such a drawer would have sat 35 mm low).
    var zoneShrink = function (target) { return (Array.isArray(opts.grip) ? opts.grip : []).some(function (z) { return z && z.target === target && z.type === "alla" && z.att === "lárétt"; }) ? 35 : 0; };
    var drawers = expand(by.drawer, function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]), front: num(r.H), B: num(r.B), T: num(r["Þ"]), H: r1(num(r.H) + grip + zoneShrink(m[1].toUpperCase())) }; });
    // A drawer whose front is listed as a plain "Frontur" (the low oven OFN6: "Frontur" 202 + "Skúffubak K - Merivo",
    // no "Skúffufrontur K") — the low front becomes that drawer, not a door with hinges (T-32 pilot, 2026-10-09).
    if (!drawers.length) {
      var backs = expand(rows.filter(function (r) { return /^skúffubak\s+[NMKCFE]\b.*?(merivo|legra)/i.test(r.Partur); }), function (r) {
        var m = r.Partur.match(/^skúffubak\s+([NMKCFE])\b.*?(merivo|legra)/i); return { code: m[1].toUpperCase(), sys: lc(m[2]) }; });
      var lowDoors = (by.door || []).filter(function (r) { return /^frontur$/i.test(String(r.Partur).trim()) && num(r.H) <= FIXED_FRONT_MAX; });
      if (backs.length && backs.length === lowDoors.reduce(function (a, r) { return a + per(r); }, 0)) {
        lowDoors.forEach(function (r) { for (var k = 0; k < per(r); k++) { var bk = backs.shift(); drawers.push({ code: bk.code, sys: bk.sys, front: num(r.H), B: num(r.B), T: num(r["Þ"]), H: r1(num(r.H) + grip) }); } });
        by.door = (by.door || []).filter(function (r) { return lowDoors.indexOf(r) < 0; });
        info.push("„Frontur“ " + drawers.map(function (d) { return d.front; }).join(", ") + " mm = skúffa " + drawers.map(function (d) { return d.code; }).join(", ") + " (skúffubak í Sögunarlista)");
      }
    }
    if (grip && by.drawer) info.push("Skúffuhólf = front + " + grip + " mm grip");
    drawers.sort(function (a, b) { return CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code) || b.H - a.H; });
    // Jey off on a front (Smíða "Jey-grip" rofi, 2026-10-29): Smíðagögn noJey = { drawers:[i bottom→top], doors:[i top→bottom] }.
    // That front has no profile on it, so its slot is the cut front alone (a Fræst grip zone still shrinks it as above).
    var noJey = (parseSmida(opts.smida) || {}).noJey || {}, njD = Array.isArray(noJey.drawers) ? noJey.drawers : [], njR = Array.isArray(noJey.doors) ? noJey.doors : [];
    drawers.forEach(function (d, i) { if (grip && njD.indexOf(i) >= 0) { d.H = r1(d.front + zoneShrink(d.code)); d.noJey = true; } });
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
    var doors = expand(by.door, function (r) { return { H: num(r.H), B: num(r.B), T: num(r["Þ"]), partur: r.Partur }; });
    // split fronts top → bottom by their number (Skiptur frontur 1 = top, as the designer writes Hæð frontur 1)
    var splitNo = function (d) { var m = /skiptur frontur\s*(\d)/i.exec(d.partur); return m ? +m[1] : 0; };
    if (doors.some(splitNo)) doors.sort(function (a, b) { return splitNo(a) - splitNo(b); });
    var leaves = null;
    var fixedFronts = drawers.length ? doors.filter(function (d) { return d.H <= FIXED_FRONT_MAX; }) : [];
    doors = doors.filter(function (d) { return fixedFronts.indexOf(d) < 0; });
    // Not drilled (2026-10-19, same reason as Fataslá just above): this reference master isn't guaranteed to
    // have FAST_FRAMSTYKKI defined, and cnc.html's write gate refuses to write the WHOLE side file the moment
    // any op references an undefined macro — found live, T-70 Sk2. The real safety property (no hinges on a
    // fixed front) doesn't depend on this op at all — `doors` already excludes every fixedFront above, so it
    // was never going to get hinge holes drilled either way; this was purely an extra alignment/marking step.
    fixedFronts.forEach(function (d) { check.push("Fast framstykki (" + r1(d.H) + " mm): engar lamir, en borað handvirkt þangað til FAST_FRAMSTYKKI er staðfest í master."); });
    // Grip on a door/fixed front: a positive grip (Jey and the like — a real handle sitting on the face) always
    // applies, any height. The old "fræst grip" branch here (a negative Höldur-1 Grip mm, zeroed above 900mm) is
    // retired (2026-10-14) — Fræst grip no longer goes through Höldur 1 at all, so `grip` itself is never negative
    // any more; see the Grip svæði block below instead. Drawer fronts are unconditional either way (set above).
    function doorGrip(d) { return d.noJey ? 0 : grip; }
    doors.forEach(function (d, i) { if (grip && njR.indexOf(i) >= 0) d.noJey = true; });
    var room = H - drawerTop - fixedFronts.reduce(function (a, d) { return a + d.H + doorGrip(d) + BOX_GAP; }, 0);
    var sumDoors = doors.reduce(function (a, d) { return a + d.H + doorGrip(d) + BOX_GAP; }, 0);
    if (doors.length > 1 && (sumDoors > room + 5 || doors.some(function (d) { return /væng/i.test(d.partur); }))) {
      leaves = doors.slice(); // every leaf is still its own front
      var seen = {}; doors = doors.filter(function (d) { var k = Math.round(d.H); if (seen[k]) return false; seen[k] = 1; return true; });
      info.push("Vænghurð: hurðir hlið við hlið");
    }
    var top = H - fixedFronts.reduce(function (a, d) { return a + d.H + doorGrip(d) + BOX_GAP; }, 0);
    // 2026-10-27 (T-15): a door that only fits WITHOUT the grip reveal above it has none (a vertical Jey, a front that
    // fills its space or overhangs it — T-15 Sk 15: 831 in 834 with grip 27 was pushed 27 down). And a front taller than
    // its box (wall units with an undergrip lip, T-15 Sk 1 / Sk 5-8: 467 / 897 on 450 / 880 sides) keeps its top at the
    // box top and overhangs at the bottom: its cups are then placed from the same absolute heights as the side plates
    // (d.fb/d.ft = where the front itself sits), not from its own ends — those were 18–46 mm off the plates.
    doors.forEach(function (d) {
      var zs = splitNo(d) ? zoneShrink("front" + splitNo(d)) : 0; // a split front's "alla" zone (see zoneShrink)
      var g = (d.H + doorGrip(d) + BOX_GAP <= top - drawerTop + 0.5 ? doorGrip(d) : 0) + zs;
      d.g = g; // the grip profile (e.g. Jey 27) sits in this reveal above the front
      d.to = r1(top - g); d.from = r1(Math.max(drawerTop, d.to - d.H - BOX_GAP));
      d.ft = r1(d.to - HINGE_FRONT_OFFSET); d.fb = r1(d.ft - d.H);
      d.over = d.H + BOX_GAP > d.to - d.from + 0.5;
      top = d.from;
    });
    var oven = /ofn/i.test(tegund) || (by.door || []).some(function (r) { return /ofn/i.test(r.Partur); });
    var stackSum = r1(drawerTop + (H - top));
    if (!oven && (drawers.length || doors.length) && Math.abs(stackSum - H) > 1.5)
      check.push("Frontar (" + stackSum + ") passa ekki við hlið (" + H + ") — athuga röðun/hæðir");
    // Oven from the designer (Smíðagögn oven = {h, under, shelves:[{mm, fixed, pos}]}, 2026-10-10): the niche boards
    // (Loftunarbotn the oven stands on, top face at `under`; Loftunartoppur over it — none under a worktop) and the
    // shelves above, fixed = FOST_HILLA at its top face, loose = LAUS_HILLA with `pos` holes 50 apart, the middle
    // one under the shelf. mm are from the bottom of the side, like everything here.
    var so = (parseSmida(opts.smida) || {}).oven, shelfRows = [], ovenDone = false;
    // what occupies height on the side, for the collision check below (2026-10-26): boards (fixed/loose shelves,
    // oven boards) as [bot, top] bands, shelf-pin hole rows, inner drawer front bands
    var boards = [], pinRows = [], innerBands = [];
    // fixed = FOST_HILLA at its top face; loose = LAUS_HILLA with `pos` holes 50 apart, the middle one under the shelf.
    // Board thickness from Sögunarlisti's own shelf row when there is one. Counts are compared with Sögunarlisti.
    // The shelf's real depth comes from its Sögunarlisti row (H or B, whichever is the depth: the one nearest side depth − 22 and
    // not deeper than the side) — it stops at the masonite groove, it does NOT reach the back (owner 2026-10-29). Fallback lpy-22.
    function shelfDepth(rowsOf) {
      var r = (rowsOf || [])[0]; if (!r) return null;
      var c = [num(r.H), num(r.B)].filter(function (v) { return v != null && v > 50 && v <= B; });
      if (!c.length) return null;
      return r1(c.reduce(function (a, v) { return Math.abs(v - (B - 22)) < Math.abs(a - (B - 22)) ? v : a; }, c[0]));
    }
    var dFixed = shelfDepth(by.fixedShelf), dLoose = shelfDepth(by.looseShelf);
    plan.shelfD = { fixed: dFixed != null ? dFixed : r1(B - 22), loose: dLoose != null ? dLoose : r1(B - 22) };
    var dFixedS = dFixed != null && Math.abs(dFixed - (B - 22)) > 0.05 ? String(dFixed) : "lpy-22"; // the usual case stays the shop's own expression
    function emitShelves(list, above, noCount, radborun) {
      var tF = num(((by.fixedShelf || [])[0] || {})["Þ"]) || OVEN_BOARD, tL = num(((by.looseShelf || [])[0] || {})["Þ"]) || OVEN_BOARD;
      var sl = (list || []).filter(function (x) { return num(x.mm) > above && num(x.mm) < H; });
      sl.forEach(function (x) {
        var mm = r1(num(x.mm));
        if (x.fixed) { op("FOST_HILLA", "Föst hilla", tF + ", " + mm + ", 2, " + dFixedS + ", lpz+5"); shelfRows.push(r1(mm - tF / 2)); boards.push({ bot: r1(mm - tF), top: mm, fixed: true, what: "föstu hilluna í " + mm }); return; }
        boards.push({ bot: r1(mm - tL), top: mm, what: "hilluna í " + mm });
        if (radborun) { shelfRows.push(r1(mm - tL)); return; } // its holes come from the one continuous run below
        var n = Math.max(1, Math.min(9, Math.round(num(x.pos) || 3))), gp = num(x.gap) > 0 ? Math.round(num(x.gap)) : 50, mid = r1(mm - tL), first = r1(mid - Math.floor((n - 1) / 2) * gp);
        op("LAUS_HILLA", "Laus hilla (" + n + " stillingar)", first + ", " + n + ", 37, 20+60, " + gp);
        for (var k = 0; k < n; k++) { shelfRows.push(r1(first + k * gp)); pinRows.push(r1(first + k * gp)); }
      });
      // Raðborun (continuous/IKEA-style drilling): one LAUS_HILLA run spanning the whole span at a fixed pitch,
      // instead of each loose shelf's own small cluster — any loose shelf above can sit anywhere in that run.
      if (radborun && num(radborun.from) != null && num(radborun.to) != null && num(radborun.to) > num(radborun.from)) {
        var rFrom = r1(num(radborun.from)), rN = Math.max(1, Math.floor((num(radborun.to) - rFrom) / RADBORUN_PITCH) + 1);
        op("LAUS_HILLA", "Raðborun (" + rN + " göt)", rFrom + ", " + rN + ", 37, 20+60, " + RADBORUN_PITCH);
        for (var rk = 0; rk < rN; rk++) { shelfRows.push(r1(rFrom + rk * RADBORUN_PITCH)); pinRows.push(r1(rFrom + rk * RADBORUN_PITCH)); }
      }
      if (!noCount) {
        var nL = sl.filter(function (x) { return !x.fixed; }).length, nF = sl.length - nL;
        var rL = expand(by.looseShelf, function (r) { return r; }).length, rF = expand(by.fixedShelf, function (r) { return r; }).length;
        if (nL !== rL) check.push("Lausar hillur: " + nL + " í hönnuði, " + rL + " í Sögunarlista — keyra skipulag/per unit aftur?");
        if (nF !== rF) check.push("Fastar hillur: " + nF + " í hönnuði, " + rF + " í Sögunarlista — keyra skipulag/per unit aftur?");
      }
      return sl;
    }
    // Legacy Ofnaskápur (Eyðublað planned in Airtable, edited in /smida, 2026-10-26): there Sögunarlisti's "Föst
    // loftunarhilla" count INCLUDES the board the oven stands on and the one over it, so `boards:"list"` = every
    // board and shelf is in oven.shelves at its own mm (no automatic niche boards), counted like any cabinet's list.
    if (oven && so && so.boards === "list" && Array.isArray(so.shelves)) {
      var slL = emitShelves(so.shelves, 0, false);
      info.push("Ofn úr Smíða (Eyðublað): " + (num(so.h) || "?") + " mm, " + slL.length + " hillur/botnar á sínum stað");
      ovenDone = true;
    } else if (oven && so && num(so.under) > 0 && num(so.h) > 0) {
      var nb = r1(num(so.under)), nt = r1(nb + num(so.h) + OVEN_BOARD);
      op("FOST_HILLA", "Loftunarbotn (ofn stendur á)", OVEN_BOARD + ", " + nb + ", 2, lpy-22, lpz+5"); shelfRows.push(nb); boards.push({ bot: r1(nb - OVEN_BOARD), top: nb, fixed: true, what: "botninn undir ofninum í " + nb });
      if (nt <= H - T) { op("FOST_HILLA", "Loftunartoppur", OVEN_BOARD + ", " + nt + ", 2, lpy-22, lpz+5"); shelfRows.push(nt); boards.push({ bot: r1(nt - OVEN_BOARD), top: nt, fixed: true, what: "toppinn yfir ofninum í " + nt }); }
      var hasShelves = Array.isArray(so.shelves); // older Smíðagögn: niche only, shelves spread by default below
      var sl = emitShelves(hasShelves ? so.shelves : [], nt, !hasShelves);
      info.push("Ofn úr hönnuði: " + num(so.h) + " mm, " + nb + " undir, " + sl.length + " hillur fyrir ofan");
      ovenDone = hasShelves;
    } else if (oven) check.push("Ofnaskápur: föstu hillurnar og ofninn bíða hönnuðar — settu þær inn eftir teikningu");
    // any other cabinet: the shelves where they're drawn in Smíða (Smíðagögn shelves.list, 2026-10-10)
    var sms = parseSmida(opts.smida) || {};
    if (!oven && sms.shelves && Array.isArray(sms.shelves.list)) { emitShelves(sms.shelves.list, 0, !!(sms.shelves.loose == null && sms.shelves.fixed == null), sms.shelves.radborun); ovenDone = true; }

    // Loose shelves: one row of 3 holes each, spread evenly over the door space (default — per drawing).
    var loose = ovenDone ? 0 : expand(by.looseShelf, function (r) { return r; }).length;
    if (loose) {
      var a = so && num(so.under) > 0 && num(so.h) > 0 ? r1(num(so.under) + num(so.h) + OVEN_BOARD) : doors.length ? Math.max(drawerTop, top) : drawerTop, b = H;
      for (var i = 1; i <= loose; i++) { var x = r1(a + (b - a) * i / (loose + 1)); shelfRows.push(x); pinRows.push(r1(x - 50), x, r1(x + 50)); boards.push({ bot: x, top: r1(x + 16), what: "hilluna í " + r1(x + 16) }); op("LAUS_HILLA", "Laus hilla", r1(x - 50) + ", 3, 37, 20+60, 50"); }
      dflt("Lausar hillur (" + loose + "): sjálfgefin staðsetning — breyttu eftir teikningu ef þarf");
    }
    var fixed = expand(by.fixedShelf, function (r) { return r; }).length;
    if (fixed && !oven && !ovenDone) check.push("Föst hilla (" + fixed + ") — staðsetning ekki í gögnum, settu inn eftir teikningu");

    // Fataslá (clothes rail): positions come from Smíðagögn's own o.rails (Smíða, 2026-10-15 — "same zone as
    // o.shelves", bottom-up mm like a shelf). A real drilling macro (FATASLA) was added 2026-10-15, but the
    // reference master this export reads isn't guaranteed to have it defined — a plan referencing an undefined
    // macro gets inserted before STAT_BLOCK anyway (cnc.html's own check), but cnc.html's write gate then
    // refuses to write ANY file whose plan has a non-empty errors/check list at all, macro-related or not — so
    // a real "not in master" case blocked the whole side file outright instead of just flagging it (found
    // live, T-80 Sk1-3, 2026-10-19). Back to flag-only until the master is confirmed to carry FATASLA — same
    // "no position" message below, just with the real Smíða position included so it's a two-second manual job.
    if (Array.isArray(sms.rails) && sms.rails.length) {
      check.push("Fataslá (" + sms.rails.length + "): " + sms.rails.map(function (rl) { return r1(num(rl.mm)); }).join(", ") + " mm frá botni (úr Smíða) — borað handvirkt þangað til FATASLA er staðfest í master.");
      if (opts.fataslar && opts.fataslar.magn && opts.fataslar.magn !== sms.rails.length)
        check.push("Fataslá: magn í Pöntunarlista (" + opts.fataslar.magn + ") og staðsetningar í Smíða (" + sms.rails.length + ") stemma ekki — keyra skipulag/per unit aftur?");
    } else if (opts.fataslar && opts.fataslar.magn) {
      check.push("Fataslá (" + opts.fataslar.magn + "): " + (opts.fataslar.names || []).join(", ") + " — staðsetning vantar í Smíða, settu upp eftir teikningu");
    }

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
          runners.push(x); innerBands.push({ code: d.code, bot: r1(x - INNER_RUNNER), top: r1(x - INNER_RUNNER + d.H), runner: x }); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + x + ", " + d.code);
          edge = r1(edge - d.H - BOX_GAP);
        });
        if (inner.length > 1 || oven) dflt("Innskúffur (" + inner.length + "): athuga staðsetningu eftir teikningu");
      } else {
        // behind a door: where the designer put them (Smíðagögn inner = [{code, mm = bottom of the inner front}], búrskápur
        // in Smíða, 2026-10-10), matched by code; otherwise from the bottom, front + 80 apart (⚠)
        var sInner = (parseSmida(opts.smida) || {}).inner, left = inner.slice(), placed = [];
        if (Array.isArray(sInner) && sInner.length === inner.length) {
          sInner.forEach(function (x) { var i = left.findIndex(function (d) { return d.code === x.code; }); if (i >= 0) placed.push({ d: left.splice(i, 1)[0], mm: num(x.mm) }); });
        }
        if (placed.length === inner.length && placed.every(function (p) { return p.mm > 0; })) {
          placed.forEach(function (p) { var x = r1(p.mm + INNER_RUNNER); runners.push(x); innerBands.push({ code: p.d.code, bot: r1(p.mm), top: r1(p.mm + p.d.H), runner: x }); op(macroOf(p.d), "Innskúffa " + p.d.code, p.d.H + ", " + x + ", " + p.d.code); });
          info.push("Innskúffur staðsettar í hönnuði");
        } else {
          var bottom = 60; // the designer's default too: the bottom runner (60 + 54) clears the bottom hinge at 80
          inner.forEach(function (d) { runners.push(r1(bottom + INNER_RUNNER)); innerBands.push({ code: d.code, bot: r1(bottom), top: r1(bottom + d.H), runner: r1(bottom + INNER_RUNNER) }); op(macroOf(d), "Innskúffa " + d.code, d.H + ", " + r1(bottom + INNER_RUNNER) + ", " + d.code); bottom = r1(bottom + d.H + 80); });
          if (bottom > H - T) stop.push("Innskúffur komast ekki fyrir");
          dflt("Innskúffur bak við hurð (" + inner.length + "): sjálfgefið neðan frá, framhlið + 80 á milli — hönnuður staðsetur");
        }
      }
    }

    // Collisions on the side (2026-10-26, owner on T-15 Sk 2): an inner drawer (its front band = the box's height) must
    // clear every board (shelf / oven board, 16 mm under its top face); no runner may sit on a shelf-pin row or a fixed
    // shelf's fixing line; an inner drawer stays under the cabinet top. Hinges vs runners/shelves are checked below.
    // Every hit is a check on the cabinet and in plan.hits (drawn red by the calm view).
    var hits = [];
    innerBands.forEach(function (ib) {
      boards.forEach(function (b) {
        if (ib.top > b.bot + 0.5 && ib.bot < b.top - 0.5) {
          var miss = ib.bot < b.bot ? r1(ib.top - b.bot) : r1(b.top - ib.bot);
          check.push("Innskúffa " + ib.code + " rekst í " + b.what + " — " + miss + " mm vantar");
          hits.push({ from: Math.max(ib.bot, b.bot), to: Math.min(ib.top, b.top) });
        }
      });
      if (ib.top > H - T + 0.5) { check.push("Innskúffa " + ib.code + " nær upp í toppinn — " + r1(ib.top - (H - T)) + " mm of hátt"); hits.push({ from: H - T, to: ib.top }); }
    });
    runners.forEach(function (r) {
      var pin = pinRows.filter(function (y) { return Math.abs(y - r) < 12; })[0];
      if (pin != null) { check.push("Skúffubraut í " + r + " rekst á hillugöt í " + pin); hits.push({ from: Math.min(r, pin) - 6, to: Math.max(r, pin) + 6 }); }
      boards.filter(function (b) { return b.fixed && Math.abs(r1((b.bot + b.top) / 2) - r) < 20; }).forEach(function (b) {
        check.push("Skúffubraut í " + r + " rekst á festingu fyrir " + b.what); hits.push({ from: b.bot, to: b.top });
      });
    });
    plan.hits = hits;

    // Hinges: per door, 80 from each end of its box + evenly between (default), or exactly where the designer put
    // them (Smíðagögn) when its doors match Sögunarlisti; corner "2" = from the bottom, "3" = from the top.
    var smida = parseSmida(opts.smida), sd = null;
    // drawn in the designer but not marked "✅ Klár til framleiðslu" in Smíða (or changed after it was)
    plan.reviewed = smida ? !!smida.ready : null; // null = never drawn in PRO
    if (smida && !smida.ready) check.push("Ekki merktur „Skápur yfirfarinn“ í PRO");
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
    // Flóknari kerfi (Studio, 2026-10-27): a wardrobe with Rennihurðir (Hettich Topline XL) or Fellihurðir (Hettich
    // WingLine L) — Smíðagögn doorSys "renni" / "felli" — has NO hinges: nothing on the sides, no cups in the fronts.
    // The system's own fittings are drilled per its instructions (söluaðili staðfestir kerfi og stærð).
    var DOOR_SYS = { renni: { type: "slide", name: "rennihurðir (Hettich Topline XL)" }, felli: { type: "fold", name: "fellihurðir (Hettich WingLine L)" } };
    var dsys = smida && DOOR_SYS[smida.doorSys];
    if (dsys && doors.length) {
      doors.forEach(function (d) { d.type = dsys.type; d.hinges = []; });
      check.push("Engar lamir — " + dsys.name + ", borað eftir kerfi");
    }
    doors.forEach(function (d, i) {
      if (d.type === "slide" || d.type === "fold") return;
      var len = r1(d.to - d.from), mine = sd && sd[i];
      var avoid = shelfRows.concat(runners).filter(function (x) { return x > d.from && x < d.to; }).map(function (x) { return r1(x - d.from); });
      if (mine && mine.type === "lift") { d.type = "lift"; d.hinges = []; check.push("Lyftihurð (" + d.H + "): engar lamir á hlið — lamirnar fara í toppborðið"); return; }
      if (mine && mine.type === "pocket") { d.type = "pocket"; d.hinges = []; check.push("Rennihurð (" + d.H + ", " + (mine.pocketSys === "concepta" ? "Hawa Concepta III" : "Blum Revego") + "): engar lamir — vélbúnaður fer ekki eftir þessari CNC-útreikningu, bora/fræsa eftir leiðbeiningum framleiðanda"); return; }
      var at;
      if (mine && mine.hinges && mine.hinges.length) {
        at = specToPositions(mine.hinges, len);
        at.forEach(function (p) { if (avoid.some(function (a) { return Math.abs(a - p) < HINGE_CLEAR; })) check.push("Löm við " + p + " (hönnuður) er nálægt hillu/skúffu — athuga"); });
      } else {
        var h = hingePositions(len, avoid); at = h.at; defaulted = true;
        h.moved.forEach(function (m) { dflt("Löm færð frá hillu/skúffu: " + m + " (frá neðri brún hurðar)"); });
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
    // Which side carries the hinges (2026-10-10, user: only the hinge side is drilled for them): Smíðagögn `hinge`
    // ("vinstri" / "haegri" / "baedi", seen from the front), else its first door's side. Unknown → both sides, as before.
    var hs = hingeAt.length ? (smida && (smida.hinge || (smida.doors && smida.doors[0] && smida.doors[0].side))) || null : null;
    // every opening hung as two leaves side by side (vænghurð) = a hinge in each side, whatever the drawing says
    // (older Smíðagögn has no `hinge`; 2026-10-26, T-32 Sk6)
    if (hingeAt.length && !hs && leaves && doors.every(function (d) { return leaves.filter(function (l) { return Math.round(l.H) === Math.round(d.H); }).length >= 2; })) hs = "baedi";
    plan.hingeSide = hs;
    // Default hinge positions (80 from each end + evenly between) are confirmed against the real masters
    // (2026-10-13), so that formula itself is no longer worth a warning. What's still real: (a) a defaulted door
    // that's actually lift-up would get hinges drilled on the side instead of the top (only the designer can tell
    // us that), (b) an unknown hinge side bores both sides. One line, merged when both apply (no Smíðagögn at all
    // — the common case) so a door with real designer data never fires either.
    var noDesignerHingeSide = hingeAt.length && !hs;
    if (defaulted && noDesignerHingeSide)
      check.push("Lamir: sjálfgefin staðsetning, lamahlið óþekkt (lamagöt í báðar hliðar) — ef lyftihurð fara lamirnar í toppinn, ekki hliðina; vista skápinn í hönnuðinum til að staðfesta");
    else {
      if (defaulted) dflt("Lamir: sjálfgefin staðsetning — ef lyftihurð fara lamirnar í toppinn, ekki hliðina");
      if (noDesignerHingeSide) check.push("Lamahlið óþekkt — lamagöt í báðar hliðar (vista skápinn í hönnuðinum svo /cnc viti hvorum megin)");
    }

    // Grip svæði (Fræst grip, 2026-10-14): per-front milling metadata from Eyðublað's own "Grip svæði (JSON)" —
    // Keyra skipulag has already validated it and, for "alla", already baked the height shrink into that front's
    // own Sérhæð/Hæð frontur N (so H/d.H above are already the shrunk size, nothing to adjust here).
    // 2026-10-13/14: found the real master macro on the USB (Frontar/Höldur/Hardvidar grip + /Macros/HARDVIDAR_*)
    // and added a disabled HARDVIDAR_GRIP_ENDA_TIL_ENDA template line to both drawer-front masters — a type:"alla"
    // zone on a drawer code is now actually milled (frontPlans() below), not just flagged. Everything else (split
    // fronts — frontPlans() gives them LPX=height there, so this edge-to-edge macro would cut the wrong axis —
    // and every "hluti" zone, whose real placement still isn't confirmed on the machine) stays a manual flag.
    (Array.isArray(opts.grip) ? opts.grip : []).forEach(function (g) {
      if (!g || !g.target) return;
      var dw = drawers.filter(function (d) { return d.code === g.target; })[0];
      var mf = /^front([1-3])$/.exec(g.target), md = /^door([0-9]+)$/.exec(g.target);
      var label = dw ? "Skúffa " + g.target + " (" + dw.front + " mm)"
        : mf && doors[+mf[1] - 1] ? "Frontur " + mf[1] + " (" + r1(doors[+mf[1] - 1].H) + " mm)"
          : md && doors[+md[1]] ? "Hurð " + (+md[1] + 1) + " (" + r1(doors[+md[1]].H) + " mm)" : null;
      if (!label) { check.push("Grip \"" + g.target + "\": fronturinn finnst ekki (breytt/fjarlægður eftir að grip var sett) — athuga teikningu"); return; }
      if (dw && g.type === "alla" && g.att === "lárétt") {
        info.push("Grip — " + label + ": alla leið, lárétt frá " + g.brun + " — fræst af HARDVIDAR_GRIP_ENDA_TIL_ENDA (⚠ ekki keyrt á vélinni enn, prófa á afskurði fyrst).");
        return;
      }
      var what = g.type === "alla"
        ? "alla leið, " + g.att + " frá " + g.brun + " (mál þegar stytt á Eyðublaði)"
        : "hluti, " + g.att + ", " + r1(num(g.start)) + "–" + r1(num(g.start) + num(g.length)) + " mm frá botni fronts";
      check.push("Grip — " + label + ": " + what + " — fræst í höndunum, ekki í þessu útflutti.");
    });

    plan.frontCheck = []; // front notes stay out of the side status
    plan.fronts = frontPlans(drawers, doors, fixedFronts, by, plan.frontCheck, leaves, opts.grip);
    // GUARD (2026-10-27, after T-15): every hinge cup the door-front file drills must sit on a plate the side file
    // drills (≤ 1.5 mm; the 79/80 convention is 1 mm), and every plate needs its cup. The front's position is
    // reconstructed from cut sizes + rules, so a case the rules don't cover would otherwise slip through silently —
    // a mismatch STOPS the cabinet (no files written, listed as EKKI GERT) instead of milling doors that won't hang.
    doors.forEach(function (d, i) {
      if (d.type === "lift" || d.type === "pocket" || d.type === "slide" || d.type === "fold" || !(d.hinges || []).length) return;
      var fr = plan.fronts.filter(function (f) { return f.master === "door" && Math.abs(f.LPX - r1(d.H)) < 0.6; })[0];
      if (!fr) return;
      var len = r1(d.to - d.from), cups = [];
      fr.ops.forEach(function (o) {
        var m = /^([\d.]+), 0, "([\d,]+)"/.exec(o.params); if (!m) return;
        m[2].split(",").forEach(function (end) {
          var v = +m[1];
          // the front's REAL extent (its cut height, top 1 mm under the box top) — never the box, which is what went wrong
          var ft = r1(d.to - HINGE_FRONT_OFFSET), fb = r1(ft - d.H);
          cups.push(end === "2" ? fb + v : ft - v);
        });
      });
      var plates = d.hinges.map(function (x) { return r1(d.from + x); });
      var worst = 0;
      plates.forEach(function (a) { var b = Math.min.apply(null, cups.map(function (c) { return Math.abs(c - a); })); if (b > worst) worst = b; });
      cups.forEach(function (c) { var b = Math.min.apply(null, plates.map(function (a) { return Math.abs(c - a); })); if (b > worst) worst = b; });
      if (worst > 1.5) stop.push("Hurð " + (i + 1) + " (" + r1(d.H) + "): lamaskálar í fronti passa ekki við lamaplötur í hlið (" + r1(worst) + " mm) — ekki skrifað, athuga hæð frontsins");
    });
    // LED fræsing (Smíða "+ LED", 2026-10-29): Smíðagögn led = [{ where:"hlid"|"toppur", y: mm from the front edge }] — 4 mm wide,
    // 8 mm deep. On the sides it is the master's own "LED 4x8" CUT_X line with Y replaced (renderSide); the top board's
    // file isn't written by /cnc, so those are listed for the hand.
    plan.led = [];
    ((parseSmida(opts.smida) || {}).led || []).forEach(function (l) {
      var y = num(l && l.y); if (!(y > 0)) return;
      if (l.where === "toppur") check.push("LED í toppi, " + r1(y) + " mm frá framkanti — fræst með Topp/Botn skránni í höndunum (ekki í /cnc enn)");
      else plan.led.push(r1(y));
    });
    plan.drawers = drawers; plan.doors = doors; plan.loose = loose;
    plan.defaults = defaults; plan.defaultsAccepted = false;
    if (plan.reviewed && defaults.length) { // reviewed in PRO = these defaults were looked at and accepted
      for (var di = check.length - 1; di >= 0; di--) if (defaults.indexOf(check[di]) >= 0) check.splice(di, 1);
      plan.defaultsAccepted = true;
    }
    plan.status = stop.length ? "stop" : check.length ? "check" : "ok";
    return plan;
  }

  // ── Fronts (2026-10-10) ─────────────────────────────────────────────────────────────────────────────────
  // Drawer fronts: the shop's GLOBAL front masters (user: every drawer front is drilled like a bottom drawer), panel
  // LPX = width, LPY = height; the base K/M row always, the E (Merivo) / C / F (Legra) row only on that code's front.
  // Door fronts: the "Lama frontar" master, LPX = height (hinges run along X), LPY = width; IKEALOM cups where the
  // hinges are on the side, measured from the front's own ends (80 on the side = 79 on the front), corner "2" =
  // from the bottom, "3" = from the top, "2,3" = both. Fixed/inner/lift fronts aren't drilled here yet (⚠).
  var FRONT_MASTERS = {
    merivo: ["[03] - Skúffur", "01 - MERIVO", "[01] - Global MERIVO Frontar.bpp"],
    legra: ["[03] - Skúffur", "02 - LEGRA", "01 - Global Frontar - LEGRABOX.bpp"],
    door: ["[02] - Frontar", "[01] - Lama frontar", "[01] - Frontur Breytiskjal.bpp"],
  };
  var FRONT_MANAGED = {
    merivo: ["K_M_NEDSTI_FRONTUR_MERIVO", "E_NEDSTI_FRONTUR_MERIVO", "HARDVIDAR_GRIP_ENDA_TIL_ENDA"],
    legra: ["K_M_NEDSTI_FRONTUR_LEGRABOX", "C_NEDSTI_FRONTUR_LEGRA", "F_NEDSTA_SKUFFA_LEGRABOX", "HARDVIDAR_GRIP_ENDA_TIL_ENDA"],
    door: ["IKEALOM", "LOM"],
  };
  var FRONT_EXTRA = { merivo: { E: "E_NEDSTI_FRONTUR_MERIVO" }, legra: { C: "C_NEDSTI_FRONTUR_LEGRA", F: "F_NEDSTA_SKUFFA_LEGRABOX" } };
  // where each extra row sits (from the bottom of the front, as the macros on the stick drill it)
  var FRONT_EXTRA_MM = { E_NEDSTI_FRONTUR_MERIVO: 218, C_NEDSTI_FRONTUR_LEGRA: 203.5, F_NEDSTA_SKUFFA_LEGRABOX: 235.5 };
  function frontPlans(drawers, doors, fixedFronts, by, check, leaves, grip) {
    var out = [], seen = {};
    function add(f) { var k = f.name + "|" + JSON.stringify(f.ops) + "|" + f.LPX + "|" + f.LPY + "|" + f.LPZ; if (seen[k]) { seen[k].count++; return; } f.count = 1; seen[k] = f; out.push(f); }
    // Grip svæði (Fræst grip, 2026-10-14): only type:"alla" + lárétt on a drawer code is milled here (real master
    // macro HARDVIDAR_GRIP_ENDA_TIL_ENDA, confirmed on the USB — see unitPlan's grip block above). FINALSTAERD is
    // where the channel's far edge sits, measured from the bottom of this front: the front's own (already-shrunk)
    // height for "efst" (top), or just the mill depth for "neðst" (bottom) — both already known, no extra input.
    var gripByCode = {};
    (Array.isArray(grip) ? grip : []).forEach(function (g) { if (g && g.type === "alla" && g.att === "lárétt" && g.brun) gripByCode[g.target] = g; });
    drawers.forEach(function (d) {
      var base = d.sys === "merivo" ? "K_M_NEDSTI_FRONTUR_MERIVO" : "K_M_NEDSTI_FRONTUR_LEGRABOX", extra = FRONT_EXTRA[d.sys][d.code];
      if (extra && FRONT_EXTRA_MM[extra] + 10 > d.front) { // the row would land on/above the front's top edge
        check.push(d.code + "-frontur " + r1(d.front) + " mm: " + d.code + "-gatið (" + FRONT_EXTRA_MM[extra] + ") kemst ekki á hann — ekki borað, athuga skúffuna");
        extra = null;
      }
      var ops = [{ name: base, label: "", params: "" }].concat(extra ? [{ name: extra, label: "", params: "" }] : []);
      var g = gripByCode[d.code];
      if (g) {
        var finalstaerd = g.brun === "efst" ? r1(d.front) : GRIP_MILL_DEPTH;
        ops.push({ name: "HARDVIDAR_GRIP_ENDA_TIL_ENDA", label: "Harðviðargrip", params: finalstaerd + ", " + GRIP_MILL_DEPTH });
      }
      add({ name: "Skúffufrontur " + d.code + " " + r1(d.front), master: d.sys, LPX: d.B, LPY: r1(d.front), LPZ: d.T, ops: ops });
    });
    doors.forEach(function (d) {
      if (d.type === "lift") { check.push("Lyftihurð " + d.H + ": frontur ekki boraður hér"); return; }
      if (d.type === "slide" || d.type === "fold") { check.push((d.type === "slide" ? "Rennihurð " : "Fellihurð ") + d.H + ": engar lamaskálar, frontur boraður eftir kerfi"); return; }
      var len = r1(d.to - d.from), ops = [], H = d.H;
      var pos = (d.hinges || []).map(function (x) {
        if (d.over) { var a = d.from + x, fromB = r1(a - d.fb), fromT = r1(d.ft - a); return fromB <= H / 2 ? { end: "2", mm: fromB } : { end: "3", mm: fromT }; }
        return x <= len / 2 ? { end: "2", mm: r1(x - HINGE_FRONT_OFFSET) } : { end: "3", mm: r1(len - x - HINGE_FRONT_OFFSET) }; });
      pos.forEach(function (p, i) {
        var twin = pos.find(function (q, j) { return j !== i && q.end !== p.end && q.mm === p.mm; });
        if (twin && p.end === "3") return; // emitted once as "2,3"
        ops.push({ name: "IKEALOM", label: "Lamaskál", params: p.mm + ', 0, "' + (twin ? "2,3" : p.end) + '"' });
      });
      var n = leaves ? leaves.filter(function (l) { return Math.round(l.H) === Math.round(H) && l.partur === d.partur; }).length : 1;
      for (var k = 0; k < Math.max(1, n); k++) add({ name: String(d.partur).trim() + " " + r1(H), master: "door", LPX: r1(H), LPY: d.B, LPZ: d.T, ops: ops });
    });
    if (fixedFronts.length) check.push("Fast framstykki (" + fixedFronts.length + "): frontur ekki boraður hér");
    if (by.inner) check.push("Innskúffufrontar: ekki boraðir hér");
    return out;
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
  // The side programs of one cabinet (2026-10-10): no hinges → one "Hliðar" run on both; hinges on one side → that
  // side with them and the other without; hinges on both (two doors) or side unknown → one file with hinges for both.
  function isHinge(o) { return o.name === "LOM" || o.name === "IKEALOM"; }
  function sideFiles(p) {
    if (!p.ops.some(isHinge)) return [{ name: "Hliðar", count: 2 * p.cabinets, plan: p }];
    if (p.hingeSide === "vinstri" || p.hingeSide === "haegri") {
      var bare = Object.assign({}, p, { ops: p.ops.filter(function (o) { return !isHinge(o); }) }), left = p.hingeSide === "vinstri";
      return [{ name: "Vinstri hlið" + (left ? " - lamir" : ""), count: p.cabinets, plan: left ? p : bare },
        { name: "Hægri hlið" + (left ? "" : " - lamir"), count: p.cabinets, plan: left ? bare : p }];
    }
    return [{ name: "Hliðar - lamir báðum megin", count: 2 * p.cabinets, plan: p }];
  }
  var BAD = /[\\/:*?"<>|]+/g;
  function shortName(p) { return String(p.name || p.id).split("|")[0].trim() || p.id; } // "Sk10 | LHA60 | 1E1K1M" → "Sk10"
  function cabinetFolder(p) { return (shortName(p) + (p.tegund ? " - " + p.tegund : "")).replace(BAD, "-").trim(); }
  function sideFileName(prefix, p, f) { return f.name.replace(BAD, "-") + ".bpp"; } // inside Skápar/<Sk - tegund>/: no project / Sk in the name (user, 2026-10-10)
  function fileName(prefix, group) { return (prefix ? prefix + " " : "") + group.label.replace(/[\\/:*?"<>|]+/g, "-") + " Hliðar.bpp"; }

  // Master text (CRLF, decoded) + one plan → program. Managed master lines are switched off, generated lines
  // inserted right after the first master line of the same macro (new unique object ids), sizes as numbers.
  function renderSide(text, p, managed) {
    managed = managed || MANAGED;
    var nl = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lines = text.split(/\r?\n/), errors = [], section = "", used = {};
    lines.forEach(function (l) { var m = l.match(/, (\d{8,9}), "", 0 :/); if (m) used[m[1]] = 1; });
    var seed = 0; p.ops.forEach(function (o) { for (var i = 0; i < o.params.length; i++) seed = (seed * 31 + o.params.charCodeAt(i)) >>> 0; });
    function newId() { var id; do { seed = (seed * 1103515245 + 12345) >>> 0; id = String(100000000 + (seed % 99999999)); } while (used[id]); used[id] = 1; return id; }
    // A managed macro's own template line is dropped from the output entirely, never left visible
    // switched off — whether this cabinet has no ops for it at all (e.g. a Merivo-only cabinet showing
    // no trace of LEGRABOX_*, a cabinet with no door showing no LOM line) or it does, in which case the
    // real generated lines are written in its place, right there in one pass — not spliced in afterward
    // next to a leftover disabled copy of the template with its own example numbers (user, 2026-10-13 —
    // same rule as the door programs). Doing the substitution in a single top-to-bottom pass (rather
    // than drop-then-reinsert-by-index) is what keeps several adjacent managed macros in the master's
    // own relative order even though none of their template lines survive to anchor that order by
    // position. CUT_X (the masonite groove) is a plain yes/no toggle for the whole cabinet, not an
    // enumerable op list, so it keeps the old on/off behavior.
    // A master can have MORE THAN ONE template line for the same managed macro name (e.g. the side
    // master's own SLA_HLID/MERIVOBOX_V2 each have 2 example lines, the door-front master has 5 IKEALOM
    // lines — one per hinge-count example) — only the FIRST such line gets the real generated ops
    // written in its place; every later template line for that same name is dropped like an empty group
    // would be, not re-populated, otherwise the whole op group was being written out once per template
    // line and every real file with 2+ Merivo/Legra drawers (or any door front) ended up drilling/cutting
    // its managed macros 2–5× over (found via the /bpp viewer against the real masters, 2026-10-14).
    function render(o) { return "@ " + o.name + ', "", "' + o.label + '", ' + newId() + ', "", 0 :' + (o.params ? " " + o.params : ""); }
    var groups = {}; p.ops.forEach(function (o) { (groups[o.name] = groups[o.name] || []).push(o); });
    var foundTemplate = {}, out = [];
    lines.forEach(function (l) {
      var sec = l.match(/^\[([A-Z]+)\]\s*$/); if (sec) section = sec[1];
      if (section === "VARIABLES") {
        var pan = l.match(/^PAN=(LPX|LPY|LPZ)\|[^|]*\|(.*)$/);
        if (pan) l = "PAN=" + pan[1] + "|" + p[pan[1]] + "|" + pan[2];
      }
      if (section === "PROGRAM") {
        var m = l.match(/^([@'])( +)([A-Z0-9_]+), "", "([^"]*)",(.*)$/);
        if (m && m[3] === "CUT_X" && /^LED 4x8/.test(m[4]) && (p.led || []).length) {
          (p.led || []).forEach(function (y) { out.push("@" + m[2] + 'CUT_X, "", "LED 4x8 (Smíða Y ' + y + ')", ' + newId() + "," + m[5].replace(/^ \d+,/, "").replace(/(: 0, "\d", -50, )[^,]+/, "$1" + y)); });
          return;
        }
        if (m && m[3] === "CUT_X" && lc(m[4]).indexOf(GROOVE_LABEL) >= 0) { out.push((p.groove ? "@" : "'") + m[2] + "CUT_X, \"\", \"" + m[4] + "\"," + m[5]); return; }
        if (m && managed.indexOf(m[3]) >= 0) {
          if (!foundTemplate[m[3]]) { foundTemplate[m[3]] = true; (groups[m[3]] || []).forEach(function (o) { out.push(render(o)); }); }
          return;
        }
      }
      out.push(l);
    });
    // Ops whose macro has no template anywhere in this master at all — never seen above, so insert
    // before STAT_BLOCK and flag it (the file is still made; the master just doesn't match what the
    // plan expected, worth a human glance).
    var missing = Object.keys(groups).filter(function (n) { return !foundTemplate[n]; });
    if (missing.length) {
      var stat = out.findIndex(function (l) { return /^@ STAT_BLOCK,/.test(l); });
      var add = [];
      missing.forEach(function (n) {
        if (stat < 0) { errors.push("Fann ekki stað fyrir " + n + " í master"); return; }
        errors.push("Makró " + n + " er ekki í master — bætt við á undan STAT_BLOCK");
        groups[n].forEach(function (o) { add.push(render(o)); });
      });
      if (stat >= 0) out.splice.apply(out, [stat, 0].concat(add));
    }
    var lastPan = -1; out.forEach(function (l, i) { if (/^PAN=LP[XYZ]\|/.test(l)) lastPan = i; });
    if (lastPan < 0) errors.push("Fann ekki PAN=LPX í master");
    else out.splice(lastPan + 1, 0, "GLB=HS_HLID|1|Bjorninn CNC|0|"); // marks a file made by /cnc (re-exports may replace it)
    return { text: out.join(nl), errors: errors };
  }

  var MARKER = "GLB=HS_HLID|";
  var api = { MARKER: MARKER, FRONT_MASTERS: FRONT_MASTERS, FRONT_MANAGED: FRONT_MANAGED, frontPlans: frontPlans, sideFiles: sideFiles, cabinetFolder: cabinetFolder, sideFileName: sideFileName, shortName: shortName, MASTER: MASTER, MANAGED: MANAGED, unitId: unitId, kind: kind, unitPlan: unitPlan, hingePositions: hingePositions,
    frontHinges: frontHinges, parseSmida: parseSmida, defaultHingeSpec: defaultHingeSpec, specToPositions: specToPositions, signature: signature, groupPlans: groupPlans, fileName: fileName, renderSide: renderSide };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCSIDES = api;
})(typeof window !== "undefined" ? window : globalThis);
