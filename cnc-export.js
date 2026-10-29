// cnc-export.js — the whole CNC export in one place (2026-10-29): read a project, plan every cabinet side / front /
// door, and write the files to the USB stick. It was cnc.html's inline code; /smida (smida.html "Skrifa á USB") loaded
// /cnc in a hidden frame to reach it. Now both call this file directly, so /cnc can go away and the shop's USB export
// stays byte for byte the same (tests/cnc-export.test.js replays the old /cnc's output on fixtures).
//   loadProject(o)        o = { proxy, key, id, name }      → P (reads Airtable, plans doors; sides via planSides)
//   planSides(P, gripMm)  gripMm = manual override or null  → fills P.groups / P.stopped (one entry per cabinet)
//   gripInfo(P, gripMm)   → { drawerUnits, unknown, own, text, override, unitName }  (text is HTML-escaped, like /cnc's)
//   writeUsb(P, dir, o)   o = { groups, doors, overwriteJamb, log, proxy, key }
//                          → { made, warn, missing, preview, folder } (preview = [{dir,name}] files to read back)
//                          throws when nothing could be written; dir = the folder the user picked
// Pure of any DOM: log() is a callback, the page builds its own UI around the result.
(function (root) {
  "use strict";
  var PRODUCTS = "tblzuuRSRkeXaLWxC", PROJECTS = "tbl4LMXlQjp66RFKI";
  function D() { return root.CNCDOORS; } function SD() { return root.CNCSIDES; } function CD() { return root.CNCDATA; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function safe(s) { return String(s).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim(); }
  function prefixOf(n) { var m = n.match(/^(T-\d+)/); return m ? m[1] : safe(n).slice(0, 20); }
  function folderOf(n) { return safe(n.replace(/\s*\|\s*/, " ")); }

  // ── read + plan ────────────────────────────────────────────────────────────────────────────────────────
  async function loadProject(o) {
    var name = String(o.name).trim(), pre = prefixOf(name);
    var data = await CD().load({ proxy: o.proxy, key: o.key, id: o.id, prefix: pre });
    var units = data.units, lineSmida = data.lineSmida;
    var P = { project: { id: o.id, name: name, prefix: pre }, proxy: o.proxy, key: o.key, projGrip: data.projGrip, legacy: CD().legacy(data),
      doors: [], groups: [], stopped: [], productNames: {}, data: data };
    var I = P.sideInput = CD().sideInput(data), isDoor = I.isDoor;

    // Doors — Vörulisti first (names always; CNC macró fields are the catalog fallback for a hinge/lock/
    // threshold not already hardcoded in cnc-doors.js, 2026-10-13), THEN plan, so doorPlan can use it.
    var doorUnits = units.filter(function (u) { return isDoor[u.id]; });
    var ids = {}, catalog = {}, productNames = P.productNames;
    doorUnits.forEach(function (u) { ["Lamir [Hurð]", "Skrá [Hurð]", "Felliþr. [Hurð]"].forEach(function (f) { (u.fields[f] || []).forEach(function (x) { ids[x.id || x] = 1; }); }); });
    if (Object.keys(ids).length) {
      try { (await CD().fetchAll(o.proxy, o.key, PRODUCTS, { filterByFormula: "OR(" + Object.keys(ids).map(function (x) { return 'RECORD_ID()="' + x + '"'; }).join(",") + ")", "fields[]": ["Heiti vöru 📣", "CNC macró — blað", "CNC macró — karmur"] }))
        .forEach(function (p) { productNames[p.id] = p.fields["Heiti vöru 📣"]; catalog[p.id] = { name: p.fields["Heiti vöru 📣"], leaf: p.fields["CNC macró — blað"], jamb: p.fields["CNC macró — karmur"] }; }); } catch (e) { /* names only */ }
    }
    P.doors = doorUnits.map(function (u) { return { rec: u, plan: D().doorPlan(u.fields, catalog, lineSmida[u.id] || null) }; })
      .sort(function (a, b) { return a.plan.id.localeCompare(b.plan.id, "is", { numeric: true }); });
    P.doors.forEach(function (d) { Object.keys(productNames).forEach(function (pid) {
      d.plan.stop = d.plan.stop.map(function (s) { return s.replace(pid, productNames[pid]); });
      d.plan.check = d.plan.check.map(function (s) { return s.replace("(" + pid + ")", "(" + productNames[pid] + ")"); }); }); });
    return P;
  }

  // Where each unit's grip comes from: the manual override when given (marked), else what the cut list took off the fronts —
  // the Eyðublað's "Grip?" through GRIP_RULES (cnc-data.js).
  var DRAWER_FRONT_RE = /skúffufrontur\s+[nmkcfe]\b.*?(merivo|legra)/i; // same test cnc-sides.js uses to find drawers
  function gripFor(P, u, overrideMm) { return CD().gripFor(P.sideInput, P.projGrip, u, overrideMm == null ? null : overrideMm); }
  function gripInfo(P, overrideMm) {
    var I = P.sideInput, ov = overrideMm == null ? null : overrideMm;
    var drawerUnits = Object.keys(I.byUnit).filter(function (u) { return I.byUnit[u].some(function (r) { return DRAWER_FRONT_RE.test(r.Partur || ""); }); });
    var unknown = drawerUnits.filter(function (u) { return gripFor(P, u, ov).src === "unknown"; });
    var own = drawerUnits.filter(function (u) { return gripFor(P, u, ov).src === "unit"; });
    var by = {}; drawerUnits.forEach(function (u) { var n = I.unitGripName[u] || "ekkert grip"; by[n] = (by[n] || 0) + 1; });
    var parts = Object.keys(by).map(function (n) { return esc(n) + (CD().GRIP_RULES[n] ? " (" + CD().GRIP_RULES[n] + " mm)" : "") + " ×" + by[n]; });
    var text = !drawerUnits.length ? "" : ov != null
      ? "Grip handvirkt: <b>" + ov + " mm</b> — yfirskrifar „Grip?“ á Eyðublöðunum á öllum skúffueiningum"
      : "Grip eftir „Grip?“ á Eyðublaði (eins og Sögunarlisti sker frontana): " + parts.join(" · ");
    return { drawerUnits: drawerUnits, unknown: unknown, own: own, text: text, override: ov != null, unitName: I.unitName };
  }

  // Sides are re-planned when the grip changes (drawer slot = cut front + grip).
  function planSides(P, overrideMm) {
    var I = P.sideInput, S = SD();
    var plans = Object.keys(I.byUnit).map(function (u) {
      var p = S.unitPlan(I.unitName[u] || u, I.byUnit[u], { unitHeight: I.unitH[u], gripMm: gripFor(P, u, overrideMm).mm, smida: I.unitSmida[u], grip: I.unitGripZones[u], fataslar: I.unitFataslar[u] });
      p.unit = u; p.sk = I.unitSk[u]; p.stale = I.unitStale[u];
      return p;
    });
    // one entry per cabinet (2026-10-10: a folder each, no merging of identical cabinets)
    P.groups = plans.filter(function (p) { return p.status !== "stop" && p.status !== "skip"; })
      .sort(function (a, b) { return a.id.localeCompare(b.id, "is", { numeric: true }); })
      .map(function (p) { return { plans: [p], label: S.cabinetFolder(p), cabinets: p.cabinets, files: S.sideFiles(p) }; });
    P.stopped = plans.filter(function (p) { return p.status === "stop"; }).sort(function (a, b) { return a.id.localeCompare(b.id, "is", { numeric: true }); });
    return plans;
  }

  // ── USB ────────────────────────────────────────────────────────────────────────────────────────────────
  async function sub(dir, name, create) { return dir.getDirectoryHandle(name, { create: !!create }); }
  async function tryFile(dir, name) { try { return await (await dir.getFileHandle(name)).getFile(); } catch (e) { return null; } }
  async function readText(file) { return new TextDecoder("windows-1252").decode(await file.arrayBuffer()); }
  async function writeBytes(dir, name, bytes) { var w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(bytes); await w.close(); }
  // The user may pick the stick itself or the "[01] - AÐALMÖPPUR …" folder — find the folder holding the masters.
  async function findRoot(picked) {
    try { await sub(picked, "[05] - Hurdir"); return picked; } catch (e) {}
    for await (var entry of picked.values()) {
      if (entry.kind !== "directory") continue;
      try { await sub(entry, "[05] - Hurdir"); return entry; } catch (e) {}
    }
    return null;
  }

  // o.groups / o.doors = what to write (defaults: every cabinet, every door that isn't ⛔). Returns the export, or throws
  // with the last ⛔ line when nothing could be written (the page shows it).
  async function writeUsb(P, pickedDir, o) {
    o = o || {};
    var S = SD(), Dr = D(), project = P.project;
    var lines = [], log = function (s) { lines.push(s); if (o.log) o.log(s); };
    var sideSel = o.groups || P.groups, doorSel = o.doors || P.doors.filter(function (d) { return d.plan.status !== "stop"; });
    var overwrite = !!o.overwriteJamb, gripText = gripInfo(P, o.gripMm).text;
    var pre = project.prefix, proxy = o.proxy || P.proxy, KEY = o.key || P.key, stopped = P.stopped, doors = P.doors;
    if (!sideSel.length && !doorSel.length) throw new Error("Ekkert valið til að skrifa");
    var masterCache = {};
    async function readMaster(rootDir, parts) {
      var key = parts.join("/"); if (masterCache[key]) return masterCache[key];
      var d = rootDir; for (var i = 0; i < parts.length - 1; i++) d = await sub(d, parts[i]);
      var f = await tryFile(d, parts[parts.length - 1]);
      if (!f) throw new Error("Master fannst ekki: " + key);
      return (masterCache[key] = await readText(f));
    }
    var when = new Date().toLocaleString("is-IS"), made = [], warn = [], missing = [], preview = [], result = null;
    try {
      var rootDir = await findRoot(pickedDir);
      if (!rootDir) { log("⛔ Fann ekki masterana — veldu lykilinn sjálfan eða „[01] - AÐALMÖPPUR …“ möppuna."); throw 0; }
      var job = await sub(pickedDir, folderOf(project.name), true);
      log("USB verkefnamappa: " + folderOf(project.name));

      // Sides. Skápar/<Sk - tegund>/ — one folder per cabinet, its side files (left/right when only one side
      // has hinges), folders only for what the project has (no Skápar/ without cabinets, no Hurðir/ without doors).
      var cabDir = sideSel.length ? await sub(job, "Skápar", true) : await sub(job, "Skápar").catch(function () { return null; });
      for (var g of sideSel) {
        var p0 = g.plans[0], dir = await sub(cabDir, g.label, true);
        for (var sf of g.files) {
          var fname = S.sideFileName(pre, p0, sf), r = S.renderSide(await readMaster(rootDir, S.MASTER), sf.plan);
          if (r.errors.length) { log("⛔ " + g.label + "/" + fname + " EKKI skrifað: " + r.errors.join(" · ")); missing.push(fname + ": " + r.errors.join(" · ")); continue; }
          await writeBytes(dir, fname, Dr.toCp1252(r.text));
          log("✅ Skápar/" + g.label + "/" + fname); made.push("Skápar/" + g.label + "/" + fname + "  (" + p0.LPX + "×" + p0.LPY + "×" + p0.LPZ + ", keyra ×" + sf.count + ")");
          preview.push({ dir: dir, name: fname });
        }
        // the cabinet's fronts: drawer fronts on the global front masters, door fronts with their hinge cups
        for (var fr of (p0.fronts || [])) {
          var frName = fr.name.replace(/[\\/:*?"<>|]+/g, "-") + ".bpp", rf;
          try { rf = S.renderSide(await readMaster(rootDir, S.FRONT_MASTERS[fr.master]), fr, S.FRONT_MANAGED[fr.master]); }
          catch (e) { log("⛔ " + g.label + "/" + frName + ": " + e.message); missing.push(g.label + "/" + frName + ": " + e.message); continue; }
          if (rf.errors.length) { log("⛔ " + g.label + "/" + frName + " EKKI skrifað: " + rf.errors.join(" · ")); missing.push(frName + ": " + rf.errors.join(" · ")); continue; }
          await writeBytes(dir, frName, Dr.toCp1252(rf.text));
          log("✅ Skápar/" + g.label + "/" + frName); made.push("Skápar/" + g.label + "/" + frName + "  (" + fr.LPX + "×" + fr.LPY + "×" + fr.LPZ + ", keyra ×" + fr.count + ")");
          preview.push({ dir: dir, name: frName });
        }
        p0.check.concat(p0.frontCheck || []).forEach(function (c) { var s = g.label + ": " + c; if (warn.indexOf(s) < 0) warn.push(s); });
      }
      // Stale-file cleanup removed 2026-10-16 (user): workflow is now "delete the whole project folder, then
      // export fresh" — not a partial re-export — so sweeping for and deleting old marked files is unneeded
      // noise in the log. Hand-made files were never touched by it either way.
      stopped.forEach(function (p) { missing.push(p.name + ": " + p.stop.join(" · ")); });

      // Doors — the jamb that may already exist decides the leaf (see cnc-doors.js).
      var logBlocks = [];
      var doorDir = doorSel.length ? await sub(job, "Hurðir", true) : null;
      for (var d of doorSel) {
        var pl = d.plan, files = Dr.filesFor(pl, pre), values = pl.values, jambKept = false;
        // Hurðir/<HU>/ with short names — unless this door's jamb was made in the old flat layout: then its files stay next to it
        var ddir = await sub(doorDir, pl.id.replace(/[\\/:*?"<>|]+/g, "-"), true);
        files = Dr.filesFor(pl, pre, true);
        var where = "Hurðir/" + pl.id + "/";
        var jambFile = await tryFile(ddir, files[1].name);
        if (jambFile) {
          var saved = Dr.readValues(await readText(jambFile));
          if (!saved) { log("⚠️ " + pl.id + ": „" + files[1].name + "“ er til en var ekki gerður hér. " + (overwrite ? "Yfirskrifa." : "Karmar ekki snertir; blað gert eftir Airtable — BERA SAMAN við karminn.")); jambKept = !overwrite; }
          else if (!overwrite) {
            var diff = Dr.diffValues(saved, pl.values);
            if (diff.length) { log("⚠️ " + pl.id + ": Airtable hefur breyst síðan karmurinn var gerður (karmur → Airtable: " + diff.join(", ") + "). Blaðið er gert eftir KARMINUM."); values = saved; jambKept = true; warn.push(pl.id + ": blað gert eftir karmi (" + diff.join(", ") + ")"); }
          }
        }
        for (var f of files) {
          if (f.kind !== "leaf" && jambKept) { log("   = " + where + f.name + " (óbreyttur, karmur til)"); preview.push({ dir: ddir, name: f.name }); continue; }
          var rr = Dr.renderBpp(await readMaster(rootDir, f.master), values, f.managed, f.on);
          if (rr.errors.length) { log("⛔ " + f.name + " EKKI skrifað: " + rr.errors.join(" · ")); missing.push(f.name + ": " + rr.errors.join(" · ")); continue; }
          await writeBytes(ddir, f.name, Dr.toCp1252(rr.text)); log("✅ " + where + f.name); made.push(where + f.name);
          preview.push({ dir: ddir, name: f.name });
        }
        pl.check.forEach(function (c) { warn.push(pl.id + ": " + c); });
        logBlocks.push(Dr.logText(Object.assign({}, pl, { values: values }), project.name, when));
      }
      doors.filter(function (d) { return d.plan.status === "stop"; }).forEach(function (d) { missing.push(d.plan.id + ": " + d.plan.stop.join(" · ")); });
      if (logBlocks.length) {
        var logName = pre + " Hurðaskrá.txt", oldLog = await tryFile(job, logName), prev = oldLog ? await readText(oldLog) : "";
        await writeBytes(job, logName, Dr.toCp1252(prev + (prev ? "\r\n" : "") + logBlocks.join("\r\n" + "-".repeat(60) + "\r\n")));
      }
      // The one sheet that goes with the stick: made / check / missing.
      var sheet = ["CNC — " + project.name, "Búið til: " + when, (P.sideInput ? gripText.replace(/<\/?b>/g, "") : "Grip: —"), "",
        "SKRÁR (" + made.length + "):"].concat(made.map(function (s) { return "  " + s; }),
        ["", "ATHUGA (" + warn.length + "):"], warn.map(function (s) { return "  " + s; }),
        ["", "EKKI GERT — þarf að forrita í höndunum eða laga gögn (" + missing.length + "):"], missing.map(function (s) { return "  " + s; }));
      await writeBytes(job, pre + " CNC skrá.txt", Dr.toCp1252(sheet.join("\r\n") + "\r\n"));
      log("📒 " + pre + " CNC skrá.txt — " + made.length + " skrár, " + warn.length + " ⚠, " + missing.length + " ⛔. Búið.");
      result = { made: made, warn: warn, missing: missing, preview: preview, folder: folderOf(project.name) };
      // 2026-10-17 (user): "Bpp yfirfarið" on /ferli's Loka yfirferð checklist should auto-tick
      // once CNC has actually been exported to USB, instead of staying a manual box — this is the
      // one real signal that export happened, so self-report it here rather than relying on
      // someone remembering to tick it by hand.
      // 2026-10-28 (G1/G20): only tick when NOTHING is left to program by hand — a single file
      // with ⛔ items still open must not turn the Klárt gate green. The PATCH carries the office
      // key and a failure is shown, not swallowed.
      if (made.length && !missing.length) {
        fetch(proxy + "?path=" + encodeURIComponent(PROJECTS + "/" + project.id) + "&k=" + encodeURIComponent(KEY), {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { "6. CNC yfirfarið": true } })
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (j) {
          if (j && j.error) throw new Error(typeof j.error === "string" ? j.error : (j.error.message || "villa"));
        }).catch(function (e) { log("⛔ Tókst ekki að haka „6. CNC yfirfarið“ á verkið (" + e.message + ") — hakaðu í höndunum í /ferli."); });
      } else if (made.length) {
        log("ℹ️ CNC að hluta — „6. CNC yfirfarið“ hakast ekki fyrr en " + missing.length + " ⛔ atriði eru leyst (forrita í höndunum eða laga gögn).");
      }
      if (made.length) {
        // 🔔 Tilkynningar (2026-10-27): tell the fræsari the files are on the stick (bell +
        // ALMENNT chat). Fire-and-forget, after every file is written — never touches the export.
        try {
          fetch("/api/virkni", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ k: KEY, tegund: "cnc", til: "Verkstæði", chat: true, t: project.id, tengill: "/fraesing?recordId=" + project.id,
              texti: "CNC-skrár komnar á USB — " + made.length + " skrár" + (warn.length ? ", " + warn.length + " ⚠" : "") + (missing.length ? ", " + missing.length + " ⛔ þarf að forrita í höndunum — CNC að hluta, ekki hakað yfirfarið" : "") }),
          }).catch(function () {});
        } catch (e) {}
      }
    } catch (e) {
      if (e !== 0) log("⛔ Villa: " + e.message);
    }
    if (!result) throw new Error((lines.join("\n").match(/⛔[^\n]*/g) || ["Ekkert skrifað"]).pop());
    return result;
  }

  var api = { loadProject: loadProject, planSides: planSides, gripInfo: gripInfo, gripFor: gripFor, writeUsb: writeUsb, prefixOf: prefixOf, folderOf: folderOf, safe: safe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCEXPORT = api;
})(typeof window !== "undefined" ? window : globalThis);
