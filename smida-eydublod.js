// smida-eydublod.js — "Smíða úr Eyðublöðum" (2026-10-26): Smíða for a project planned the OLD way in Airtable
// (Eyðublöð + Sögunarlisti, no PRO drawing). Pure functions, used by smida.html and tests.
//
// Why not PRO's own box editor: it edits planner blocks (catalog type, interior, plinth, wall) and turns them into
// Smíðagögn. A legacy Eyðublað has none of that, and /cnc ignores Smíðagögn whose door count differs from what it
// finds in Sögunarlisti. So here every cabinet is built from the SAME thing /cnc plans from — its Sögunarlisti rows
// through cnc-sides.js unitPlan — and the edits are only what Smíðagögn carries (hinge side, hinge positions, door
// type, shelves, oven, inner drawers behind a door). Drawers, fronts and sizes are read-only: they come from
// Sögunarlisti, and changing them belongs on the Eyðublað (+ Yfirfara).
//
// The JSON written is the same v:1 format PRO's smidaFor writes and /cnc reads (docs/cnc.md):
//   { v:1, w, h, d, hinge, doors:[{h, type, side, hinges:[{from, mm}]}], shelves:{loose, fixed, list:[{mm, fixed, pos}]},
//     oven:{h, under, boards:"list", shelves:[…]}, inner:[{code, mm}], ready }
// Keys this file doesn't manage (fronts, grip, rails…) are kept from the Eyðublað's previous value.
(function (root) {
  "use strict";
  var SD = root.CNCSIDES;
  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  var BOARD = 16, INNER_GAP = 80, INNER_FIRST = 60;
  var OVEN_HEIGHTS = [455, 595, 1050];

  function parse(v) { if (!v) return null; try { var o = typeof v === "object" ? v : JSON.parse(String(v)); return o && typeof o === "object" ? o : null; } catch (e) { return null; } }

  // one cabinet per Eyðublað with a carcass side (status "skip" = plinth/end panel/front: nothing to drill)
  // u = Airtable Eyðublað record, rows = its Sögunarlisti rows (fields), ctx = { gripMm, gripZones, fataslar }
  function cabinet(u, rows, ctx) {
    ctx = ctx || {};
    var f = u.fields || {}, name = String(f["Athugasemd"] || "(nafnlaust)").trim();
    var cab = { unit: u.id, name: name, sk: name.split("|")[0].trim(), rows: rows, count: num(f["Fjöldi eininga"]) || 1,
      B: num(f["Breidd"]), H: num(f["Hæð"]), D: num(f["Dýpt"]), ovenH: num(f["Hæð ofns"]),
      gripMm: num(ctx.gripMm) || 0, gripZones: ctx.gripZones || [], fataslar: ctx.fataslar || null,
      raw: f["Smíðagögn (JSON) 🔧"] || null };
    cab.existing = parse(cab.raw);
    cab.base = planOf(cab, null);
    cab.tegund = cab.base.tegund || "";
    if (cab.base.status === "skip") return null;
    var by = {}; rows.forEach(function (r) { var k = SD.kind(r.Partur); (by[k] = by[k] || []).push(r); });
    var per = function (list) { return (list || []).reduce(function (a, r) { return a + (num(r.M) || 0); }, 0) / (cab.base.cabinets || 1); };
    cab.nLoose = Math.round(per(by.looseShelf)); cab.nFixed = Math.round(per(by.fixedShelf));
    cab.tLoose = num(((by.looseShelf || [])[0] || {})["Þ"]) || BOARD; cab.tFixed = num(((by.fixedShelf || [])[0] || {})["Þ"]) || BOARD;
    cab.inner = [];
    (by.inner || []).forEach(function (r) { var m = r.Partur.match(/skúffufrontur\s+([NMKCFE])\b/i); for (var i = 0; i < Math.round((num(r.M) || 0) / (cab.base.cabinets || 1)); i++) cab.inner.push({ code: m[1].toUpperCase(), h: num(r.H) }); });
    cab.oven = /ofn/i.test(cab.tegund) || rows.some(function (r) { return SD.kind(r.Partur) === "door" && /ofn/i.test(r.Partur); });
    cab.fre = !!by.freSide;
    return cab;
  }

  function planOf(cab, smida) {
    return SD.unitPlan(cab.name, cab.rows, { unitHeight: cab.H, gripMm: cab.gripMm, smida: smida || null, grip: cab.gripZones, fataslar: cab.fataslar });
  }

  // geometry the editor draws, all mm from the bottom of the side (like /cnc)
  function geom(cab) {
    var p = cab.base, H = p.LPX, T = p.LPZ || BOARD;
    var drawerTop = 0; (p.drawers || []).forEach(function (d) { drawerTop = Math.max(drawerTop, d.to || 0); });
    var doorBottom = (p.doors || []).reduce(function (a, d) { return Math.min(a, d.from); }, H);
    return { H: H, T: T, drawerTop: r1(drawerTop), doorBottom: r1(doorBottom), top: r1(H - T) };
  }

  // /cnc's own default shelf spots (holes centred where it would put them), so an untouched list drills the same
  function spread(n, a, b) { var out = []; for (var i = 1; i <= n; i++) out.push(r1(a + (b - a) * i / (n + 1))); return out; }
  function defaultShelves(cab) {
    var g = geom(cab), n = cab.nLoose + cab.nFixed; if (!n) return [];
    var a = (cab.base.doors || []).length ? Math.max(g.drawerTop, g.doorBottom) : g.drawerTop;
    var xs = spread(n, a, g.H);
    // fixed ones in the middle of the stack (a divider), loose around them — Rakel moves them to the drawing
    var fixedAt = {}, mid = (n - 1) / 2, order = xs.map(function (x, i) { return i; }).sort(function (i, j) { return Math.abs(i - mid) - Math.abs(j - mid) || j - i; });
    order.slice(0, cab.nFixed).forEach(function (i) { fixedAt[i] = 1; });
    return xs.map(function (x, i) { return fixedAt[i] ? { mm: r1(x + cab.tFixed / 2), fixed: true } : { mm: r1(x + cab.tLoose), fixed: false, pos: 3 }; });
  }
  function defaultOven(cab) {
    var g = geom(cab), h = cab.ovenH || 595, under = g.drawerTop || 0;
    return { h: h, under: under, shelves: ovenLayout(cab, h, under) };
  }
  // the boards Sögunarlisti counts as fixed (oven stands on one, one over it, a 60+45 pair gets one between),
  // the rest spread above; loose shelves above the oven
  function ovenLayout(cab, h, under) {
    var g = geom(cab), fixed = [], top = r1(under + h + BOARD);
    if (cab.nFixed >= 1) fixed.push(r1(under));
    if (cab.nFixed >= 2 && top <= g.top) fixed.push(top);
    if (cab.nFixed >= 3 && h > 1000) fixed.push(r1(under + 595 + BOARD));
    var extra = cab.nFixed - fixed.length, above = Math.max(top, (cab.base.doors || []).reduce(function (a, d) { return Math.min(a, d.from); }, g.H));
    spread(Math.max(0, extra), top, g.top).forEach(function (x) { fixed.push(x); });
    var out = fixed.map(function (mm) { return { mm: mm, fixed: true }; });
    spread(cab.nLoose, Math.min(above, g.top - 50), g.top).forEach(function (x) { out.push({ mm: r1(x + cab.tLoose), fixed: false, pos: 3 }); });
    return out.sort(function (a, b) { return a.mm - b.mm; });
  }
  // inner drawers behind a door: /cnc's default (60 from the bottom, front + 80 apart) — squeezed to fit when it doesn't
  function defaultInner(cab) {
    var g = geom(cab), list = cab.inner, x = INNER_FIRST, out = [];
    var need = INNER_FIRST + list.reduce(function (a, d) { return a + d.h; }, 0) + INNER_GAP * Math.max(0, list.length - 1);
    var gap = INNER_GAP, first = INNER_FIRST;
    if (need > g.top - 20) {
      var room = g.top - 20 - list.reduce(function (a, d) { return a + d.h; }, 0);
      first = Math.max(20, Math.min(INNER_FIRST, room / (list.length + 1)));
      gap = list.length > 1 ? Math.max(3, (room - first) / (list.length - 1)) : 0;
    }
    x = first;
    list.forEach(function (d) { out.push({ code: d.code, mm: Math.round(x) }); x += d.h + gap; });
    return out;
  }
  function editable(cab) { return !cab.fre && !!cab.base.LPX; }
  // Fataslá: 60 mm under the (first) fixed shelf, else 60 under the top
  function defaultRails(cab, e) {
    var g = geom(cab), fx = (e.shelves || []).filter(function (x) { return x.fixed; })[0];
    var mm = r1((fx ? fx.mm - cab.tFixed : g.top) - 60), out = [];
    for (var i = 0; i < cab.fataslar.magn; i++) out.push({ mm: r1(mm - i * 300) });
    return out;
  }
  function innerEditable(cab) { return cab.inner.length > 0 && !(cab.base.drawers || []).length; }
  function hingedDoors(cab) { return (cab.base.doors || []).filter(function (d) { return d.type !== "lift"; }); }

  // the editable state of one cabinet — from the Eyðublað's previous Smíðagögn when it has one, else /cnc's defaults
  function initEdit(cab) {
    var ex = cab.existing || {}, e = { hinge: null, doors: null, shelves: null, oven: null, inner: null, rails: null, reviewed: !!ex.ready };
    if (!editable(cab)) return e; // FRE / no usable side: nothing /cnc would drill from here
    var nd = (cab.base.doors || []).length;
    if (nd) e.hinge = ex.hinge || cab.base.hingeSide || null;
    if (nd && Array.isArray(ex.doors) && ex.doors.length === nd) e.doors = ex.doors.map(function (d) { return { type: d.type || "hinged", hinges: clone(d.hinges || []) }; });
    if (cab.oven) {
      var so = ex.oven && ex.oven.boards === "list" && Array.isArray(ex.oven.shelves) ? ex.oven : null;
      e.oven = so ? { h: num(so.h) || 595, under: num(so.under) || 0, shelves: clone(so.shelves) } : defaultOven(cab);
    } else if (cab.nLoose + cab.nFixed) {
      var sl = ex.shelves && Array.isArray(ex.shelves.list) ? ex.shelves.list : null;
      var ok = sl && sl.filter(function (x) { return x.fixed; }).length === cab.nFixed && sl.length === cab.nLoose + cab.nFixed;
      e.shelves = ok ? clone(sl) : defaultShelves(cab);
    }
    if (cab.fataslar && cab.fataslar.magn) e.rails = Array.isArray(ex.rails) && ex.rails.length ? clone(ex.rails) : defaultRails(cab, e);
    if (innerEditable(cab)) e.inner = Array.isArray(ex.inner) && ex.inner.length === cab.inner.length ? clone(ex.inner) : defaultInner(cab);
    return e;
  }

  // edit → Smíðagögn object (what Vista writes). `ready` only while marked reviewed.
  function smidaOf(cab, e) {
    var o = Object.assign({}, clone(cab.existing) || {});
    ["doors", "hinge", "shelves", "oven", "inner", "rails", "ready"].forEach(function (k) { delete o[k]; });
    o.v = 1;
    if (o.w == null && cab.B) o.w = cab.B;
    if (o.h == null && cab.base.LPX) o.h = cab.base.LPX;
    if (o.d == null && cab.D) o.d = cab.D;
    var doors = cab.base.doors || [];
    if (doors.length && e.hinge) o.hinge = e.hinge;
    if (doors.length && e.doors && e.doors.length === doors.length)
      o.doors = doors.map(function (d, i) { var x = e.doors[i]; return { h: d.H, type: x.type, side: null, hinges: x.type === "hinged" ? clone(x.hinges) : [] }; });
    var sort = function (l) { return clone(l).sort(function (a, b) { return a.mm - b.mm; }); };
    if (e.shelves && e.shelves.length) o.shelves = { loose: e.shelves.filter(function (x) { return !x.fixed; }).length, fixed: e.shelves.filter(function (x) { return x.fixed; }).length, list: sort(e.shelves) };
    if (e.oven) {
      o.oven = { h: e.oven.h, under: e.oven.under, boards: "list", shelves: sort(e.oven.shelves) };
      o.shelves = { loose: e.oven.shelves.filter(function (x) { return !x.fixed; }).length, fixed: e.oven.shelves.filter(function (x) { return x.fixed; }).length };
    }
    if (e.inner && e.inner.length) o.inner = clone(e.inner);
    if (e.rails && e.rails.length) o.rails = clone(e.rails);
    if (e.reviewed) o.ready = true;
    return o;
  }

  // the hinge positions /cnc would use for door i right now (mm from the door box's bottom) → editable spec
  function hingeSpec(cab, e, i) {
    if (e.doors && e.doors[i]) return clone(e.doors[i].hinges);
    var p = planOf(cab, Object.assign(smidaOf(cab, e), { doors: undefined }));
    var d = (p.doors || [])[i]; if (!d) return [];
    var len = r1(d.to - d.from);
    return (d.hinges || []).map(function (x) { return x <= len / 2 ? { from: "bottom", mm: r1(x) } : { from: "top", mm: r1(len - x) }; });
  }

  // what blocks "Yfirfarinn" (the rest is /cnc's own list, shown live)
  function blockers(cab, e, plan) {
    var out = [];
    if (!editable(cab)) return out; // FRE: shown, made by hand, never blocks the rest
    (plan.stop || []).forEach(function (s) { out.push(s); });
    var hinged = (cab.base.doors || []).some(function (d, i) { return !(e.doors && e.doors[i] && e.doors[i].type !== "hinged"); });
    if (hinged && !e.hinge) out.push("Veldu lamahlið (vinstri / hægri / báðum megin).");
    var g = geom(cab);
    (e.shelves || (e.oven && e.oven.shelves) || []).forEach(function (s) { if (!(s.mm > 0 && s.mm < g.H)) out.push("Hilla í " + s.mm + " mm er utan skápsins (0–" + g.H + ")."); });
    (e.inner || []).forEach(function (x, i) { var h = (cab.inner[i] || {}).h || 0; if (!(x.mm > 0) || x.mm + h > g.top) out.push("Innskúffa " + x.code + " í " + x.mm + " mm kemst ekki fyrir (toppur " + g.top + ")."); });
    return out;
  }

  // a simple change fingerprint (Vista only sends cabinets whose JSON differs from what the Eyðublað has)
  function canon(v) { return Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.keys(v).sort().reduce(function (a, k) { if (v[k] !== undefined) a[k] = canon(v[k]); return a; }, {}) : v; }
  function same(a, b) { return JSON.stringify(canon(a || null)) === JSON.stringify(canon(b || null)); }

  var api = { cabinet: cabinet, planOf: planOf, geom: geom, initEdit: initEdit, smidaOf: smidaOf, hingeSpec: hingeSpec, blockers: blockers,
    defaultShelves: defaultShelves, defaultOven: defaultOven, ovenLayout: ovenLayout, defaultInner: defaultInner, innerEditable: innerEditable, editable: editable, defaultRails: defaultRails,
    hingedDoors: hingedDoors, same: same, parse: parse, OVEN_HEIGHTS: OVEN_HEIGHTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SMIDAEY = api;
})(typeof window !== "undefined" ? window : globalThis);
