// cnc-data.js — what /cnc reads for one project, shared by /cnc (cnc.html) and /smida (smida.html, "Smíða úr
// Eyðublöðum", 2026-10-26) so both plan every cabinet from exactly the same rows. Read-only GETs through
// /api/airtable; nothing here writes.
//   load(opts)        → { units, rows, lineSmida, lineKey, projGrip }   (opts: { proxy, key, id, prefix })
//   sideInput(data)   → the per-unit maps cnc-sides.js unitPlan is fed with (+ isDoor)
//   gripFor(I, projGrip, unitId, override) → { mm, src }   same order /cnc always used
//   legacy(data)      → true when no Eyðublað was made from a Line Item (planned the old way in Airtable)
(function (root) {
  "use strict";
  var PROJECTS = "tbl4LMXlQjp66RFKI", UNIT = "tbl0WcyHhz63pSzZX", SAW = "tblhdgyvTcBfP8kov", PRODUCTS = "tblzuuRSRkeXaLWxC", LINES = "tblFcsUoGxsuUwNEH";
  var HANDLE_FIELD = "Höldur Viðskiptavinar ✊"; // what PRO's Vista writes from the drawing's handle (Vörulisti ids)
  var PNAME = "Heiti tækifæris / verkefnis";
  var SMIDA = "Smíðagögn (JSON) 🔧";
  var UNIT_FIELDS = ["Athugasemd", "Sérsmíði tegund", "Hæð", "Breidd", "Dýpt", "Fjöldi eininga",
    "Þykkt karms [Hurð]", "Karmabil frá vegg [Hurð]", "Toppstykki hurðakarms", "Opnun [Hurð]", "Lamir [Hurð]", "Skrá [Hurð]", "Felliþr. [Hurð]", SMIDA,
    "Grip mm (Höldur 1)", // per-unit, via its own Höldur; falls back to the manual field below when absent
    "Grip svæði (JSON) 🪚", // Fræst grip zones (2026-10-14) — Keyra skipulag's validated copy of Smíðagögn's grip[]; "Grip mm (Höldur 1)" is unrelated to this (real handle hardware only, Fræst grip doesn't use it any more)
    "Fataslár", "Fataslár magn", // Fataskápar clothes rail — hardware only, no cut part; ordering count (position comes from Smíðagögn's own rails, drilled via FATASLA — see cnc-sides.js)
    "Hæð ofns"]; // /smida: the oven's default height on a legacy Ofnaskápur
  var SAW_FIELDS = ["Partur", "H", "B", "Þ", "M", "Tegund einingu", "Eyðublað ✏️"];

  // encodeURIComponent, never URLSearchParams ("+" breaks {Field} refs — see CLAUDE.md).
  async function fetchAll(proxy, key, table, params) {
    var qs = ["path=" + encodeURIComponent(table), "k=" + encodeURIComponent(key)];
    Object.keys(params).forEach(function (k) { [].concat(params[k]).forEach(function (v) { qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); }); });
    var recs = [], offset;
    do {
      var r = await fetch(proxy + "?" + qs.concat(offset ? ["offset=" + encodeURIComponent(offset)] : []).join("&"));
      if (!r.ok) { var err = new Error("Airtable " + r.status); err.status = r.status; throw err; }
      var d = await r.json(); recs = recs.concat(d.records || []); offset = d.offset;
    } while (offset);
    return recs;
  }

  // Canonical Smíðagögn for comparing the drawing's copy (Line Item) with the Eyðublað's (written by Keyra skipulag):
  // the review mark and hinge side are left out — they never change what Sögunarlisti cuts
  function smidaShape(txt) {
    var o; try { o = JSON.parse(txt); } catch (e) { return null; }
    if (!o || typeof o !== "object") return null;
    delete o.ready; delete o.hinge;
    var canon = function (v) { return Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.keys(v).sort().reduce(function (a, k) { a[k] = canon(v[k]); return a; }, {}) : v; };
    return JSON.stringify(canon(o));
  }

  // Units + Sögunarlisti throw (the caller shows "Gat ekki sótt …"); the drawing's Line Items and the project
  // handle are optional — /cnc still works on the Eyðublöð alone.
  async function load(o) {
    var get = function (t, p) { return fetchAll(o.proxy, o.key, t, p); };
    var q = String(o.prefix).replace(/"/g, '\\"');
    var units = await get(UNIT, { filterByFormula: 'FIND("' + q + ' |",{Athugasemd + Tækifæri (fyrir yfirfara)})', "fields[]": UNIT_FIELDS });
    var rows = await get(SAW, { filterByFormula: 'FIND("' + q + ' |",ARRAYJOIN({Tækifæri 📣 (projects)}))', "fields[]": SAW_FIELDS });
    var lineSmida = {}, lineKey = {}, linesSeen = false;
    try {
      (await get(LINES, { filterByFormula: 'FIND("' + q + ' |",ARRAYJOIN({Tækifæri 📣 (projects)}))', "fields[]": ["🔑", SMIDA, "Eyðublað búið til ✏️"] }))
        .forEach(function (l) { var f = l.fields || {}; (f["Eyðublað búið til ✏️"] || []).forEach(function (u) { u = u.id || u; linesSeen = true; if (f[SMIDA]) lineSmida[u] = f[SMIDA]; if (f["🔑"]) lineKey[u] = f["🔑"]; }); });
    } catch (e) { linesSeen = null; /* the Eyðublað copy is used */ }
    var projGrip = null;
    try {
      var proj = (await get(PROJECTS, { filterByFormula: 'RECORD_ID()="' + o.id + '"', "fields[]": [HANDLE_FIELD] }))[0];
      var hids = ((proj && proj.fields[HANDLE_FIELD]) || []).map(function (x) { return x.id || x; });
      if (hids.length) {
        var hs = await get(PRODUCTS, { filterByFormula: "OR(" + hids.map(function (x) { return 'RECORD_ID()="' + x + '"'; }).join(",") + ")", "fields[]": ["Heiti vöru 📣", "Grip mm"] });
        var withGrip = hs.filter(function (h) { return typeof h.fields["Grip mm"] === "number"; });
        var pick = withGrip[0] || hs[0];
        if (pick) projGrip = { mm: withGrip.length ? withGrip[0].fields["Grip mm"] : 0, name: String(pick.fields["Heiti vöru 📣"] || "").replace(/\s*\(frágangur innifalinn\)/i, ""),
          mixed: withGrip.some(function (h) { return h.fields["Grip mm"] !== withGrip[0].fields["Grip mm"]; }) };
      }
    } catch (e) { /* grip stays unknown → flagged */ }
    return { units: units, rows: rows, lineSmida: lineSmida, lineKey: lineKey, linesSeen: linesSeen, projGrip: projGrip };
  }

  // planned the old way: Eyðublöð that no Line Item made (no PRO drawing behind them) — /smida edits these
  function legacy(data) { return data.linesSeen === false && data.units.some(function (u) { return String(u.fields["Sérsmíði tegund"] || "") !== "Hurð"; }); }

  function sideInput(data) {
    var unitName = {}, isDoor = {}, unitH = {}, unitSmida = {}, unitStale = {}, unitSk = {}, unitGrip = {}, unitGripZones = {}, unitFataslar = {};
    data.units.forEach(function (u) {
      unitName[u.id] = u.fields["Athugasemd"] || "(nafnlaust)"; unitH[u.id] = u.fields["Hæð"];
      var ey = u.fields[SMIDA] || null, li = data.lineSmida[u.id] || null;
      unitSmida[u.id] = li || ey; // the drawing's copy wins: same data, plus the review mark / hinge side PRO saved since
      // sizes/fronts/shelves differ = the drawing changed after Keyra skipulag, so Sögunarlisti may be out of date
      unitStale[u.id] = !!(li && ey && smidaShape(li) !== smidaShape(ey));
      unitSk[u.id] = data.lineKey[u.id] || (String(unitName[u.id]).match(/^(Sk\d+|HU\d+)/) || [])[1] || null;
      isDoor[u.id] = String(u.fields["Sérsmíði tegund"] || "") === "Hurð";
      // multipleLookupValues always comes back as an array, even through a single-record link.
      var g = u.fields["Grip mm (Höldur 1)"]; g = Array.isArray(g) ? g[0] : g;
      unitGrip[u.id] = typeof g === "number" ? g : null;
      // Fræst grip zones (2026-10-14): Keyra skipulag's own validated JSON, not Smíðagögn directly — already
      // has the dimension shrink baked elsewhere (Sérhæð/Hæð frontur N), this is milling-position metadata only.
      try { var gz = JSON.parse(u.fields["Grip svæði (JSON) 🪚"] || "[]"); unitGripZones[u.id] = Array.isArray(gz) ? gz : []; } catch (e) { unitGripZones[u.id] = []; }
      // Fataslá (clothes rail) — multipleRecordLinks already comes back with each link's name, no catalog lookup needed.
      var fs = u.fields["Fataslár"], fm = u.fields["Fataslár magn"];
      if (fs && fs.length) unitFataslar[u.id] = { magn: typeof fm === "number" ? fm : fs.length, names: fs.map(function (x) { return x.name; }) };
    });
    // Sides — every non-door unit's Sögunarlisti rows.
    var byUnit = {};
    data.rows.forEach(function (r) { var u = (r.fields["Eyðublað ✏️"] || [])[0]; u = u && (u.id || u); if (!u || isDoor[u]) return; (byUnit[u] = byUnit[u] || []).push(r.fields); });
    return { byUnit: byUnit, isDoor: isDoor, unitName: unitName, unitH: unitH, unitSmida: unitSmida, unitStale: unitStale, unitSk: unitSk, unitGrip: unitGrip, unitGripZones: unitGripZones, unitFataslar: unitFataslar };
  }

  // Where each unit's grip comes from (2026-10-26): the manual override when given, else the unit's own Höldur 1
  // (Vörulisti "Grip mm"), else the project's handle chosen in PRO (a handle with none = 0), else unknown (0, flagged).
  function gripFor(I, projGrip, u, override) {
    if (override != null) return { mm: override, src: "override" };
    if (I.unitGrip[u] != null) return { mm: I.unitGrip[u], src: "unit" };
    if (projGrip) return { mm: projGrip.mm, src: "project" };
    return { mm: 0, src: "unknown" };
  }

  var api = { PROJECTS: PROJECTS, UNIT: UNIT, SAW: SAW, PRODUCTS: PRODUCTS, LINES: LINES, PNAME: PNAME, SMIDA: SMIDA, UNIT_FIELDS: UNIT_FIELDS, SAW_FIELDS: SAW_FIELDS,
    fetchAll: fetchAll, smidaShape: smidaShape, load: load, legacy: legacy, sideInput: sideInput, gripFor: gripFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCDATA = api;
})(typeof window !== "undefined" ? window : globalThis);
