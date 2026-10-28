// kitchen-planner-package.js — "Búa til kynningu (PDF)" (PRO, 2026-10-28): the pure logic.
// No DOM, no network: the report text, the per-room quote sections, the readiness checklist. kitchen-planner.html gathers
// the facts (rooms, materials, price, contact, 3D views) and calls these, then posts to /api/kynning-pdf (the PDF itself).
// tests/kp-package.test.js runs them under node.
//   KPPACKAGE.buildReport(d)          → { lines:[…6–10 plain Icelandic lines], text }
//   KPPACKAGE.buildQuoteSections(...) → per-room quote lines + totals, same numbers as the live Tilboð panel
//   KPPACKAGE.readiness(d)            → { items:[{id,ok,optional,label,detail,fix}], canMake, blocking:[ids] }
(function(root){
  "use strict";

  var VALID_DAYS = 30; // same as generate-quote.js ("Tilboð gildir í 30 daga frá útgáfudegi")
  // What the quote covers / does not — one place to edit the wording.
  var INCLUDES = "innréttingar eins og þær eru teiknaðar, framhliðar, höldur og efnið sem er valið";
  var EXCLUDES = "tæki, raf- og pípulagnir og vinna annarra iðnaðarmanna, nema það komi fram á tilboðinu";

  function pl(n, one, many){ return n === 1 ? one : many; }
  function trim(s){ return String(s == null ? "" : s).trim(); }
  // 1234567 → "1.234.567 kr." (no locale: the same text on every machine)
  function kr(n){
    var v = Math.round(Number(n) || 0), neg = v < 0; v = Math.abs(v);
    return (neg ? "-" : "") + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr.";
  }
  function lowerFirst(s){ s = trim(s); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  // d.rooms: [{ name, units, look, carcass, top, handle, plain }]  d.total (kr. incl. VSK)  d.hasDrawings  d.noHandles
  function roomMaterials(r){
    var bits = [];
    if (trim(r.look)) bits.push("framhlið " + lowerFirst(r.look));
    if (trim(r.carcass)) bits.push("skrokkur " + lowerFirst(r.carcass));
    if (trim(r.top)) bits.push("borðplata " + lowerFirst(r.top));
    if (trim(r.handle)) bits.push("höldur " + lowerFirst(r.handle));
    return bits;
  }
  function buildReport(d){
    d = d || {};
    var rooms = (d.rooms || []).filter(function(r){ return r && trim(r.name); }), lines = [];
    var nUnits = rooms.reduce(function(n, r){ return n + (Number(r.units) || 0); }, 0);
    var names = rooms.map(function(r){ return r.name + (r.units ? " (" + r.units + " " + pl(r.units, "eining", "einingar") + ")" : ""); });
    lines.push(rooms.length
      ? "Verkefnið: " + names.join(", ") + (rooms.length > 1 ? " — alls " + nUnits + " " + pl(nUnits, "eining", "einingar") + "." : ".")
      : "Verkefnið: innrétting eftir teikningu frá okkur.");
    // materials: one line per room while it stays short, otherwise one line for the whole project
    var withMat = rooms.filter(function(r){ return !r.plain && roomMaterials(r).length; });
    if (withMat.length && withMat.length <= 4) withMat.forEach(function(r){ lines.push(r.name + ": " + roomMaterials(r).join(", ") + "."); });
    else if (withMat.length){ var m = roomMaterials(withMat[0]); lines.push("Efni: " + m.join(", ") + (withMat.length > 1 ? " (nánar í tilboðinu fyrir hvert rými)." : ".")); }
    if (d.noHandles) lines.push("Höldur: engar í þessari útgáfu.");
    lines.push("Innifalið í tilboðinu: " + INCLUDES + ".");
    lines.push("Ekki innifalið: " + EXCLUDES + ".");
    if (d.hasDrawings) lines.push("Þrívíddarteikningar af rýminu fylgja með.");
    lines.push(Number(d.total) > 0 ? "Heildarverð með vsk: " + kr(d.total) + "." : "Heildarverð: sjá tilboðið.");
    lines.push("Tilboðið gildir í " + VALID_DAYS + " daga.");
    lines.push("Næsta skref: hafðu samband við okkur með breytingar eða ef þú vilt staðfesta — við gerum svo næstu skref með þér.");
    return { lines: lines, text: lines.join("\n") };
  }

  // The quote section of the PDF, per room, from the SAME numbers the live Tilboð panel shows (tp.data = /api/kp-price's answer):
  //   data   { lines:[{key,name,extra,qty,total}], other:[…same…], handles:{count,total}, total }
  //   roomOf { "Sk1": "Eldhús", … }   (the Line Items' "Rými 🏡")      stone { "BP1": kr } (typed stone-top prices)
  // → { rooms:[{name, lines:[{name,extra,qty,total}], sum}], handles:{count,total}|null, total, panelTotal, mismatch }
  // total = what is printed (sum of the lines); panelTotal = what the Tilboð panel shows; mismatch = they differ by > 2 kr
  // (the caller then refuses to make the PDF — a quote whose total differs from the panel is never handed out).
  function buildQuoteSections(data, roomOf, stone){
    data = data || {}; roomOf = roomOf || {}; stone = stone || {};
    var groups = [], idx = {}, stoneSum = 0;
    function add(room, l){
      if (!(room in idx)){ idx[room] = groups.length; groups.push({ name: room, lines: [], sum: 0 }); }
      var g = groups[idx[room]], t = Number(l.total) || 0;
      g.lines.push({ name: trim(l.name) || "Lína", extra: trim(l.extra), qty: l.qty == null ? null : Number(l.qty), total: t }); g.sum += t;
    }
    (data.lines || []).forEach(function(l){
      var st = l.key && stone[l.key] != null ? Math.max(0, Number(stone[l.key]) || 0) : null;
      if (st != null && /^BP\d+$/.test(l.key)){ stoneSum += st; l = { key: l.key, name: "Steinborðplata — verð frá steinsmið", extra: l.extra, qty: l.qty, total: st }; } // as proTilbodRender does
      add(roomOf[l.key] || "Annað", l);
    });
    (data.other || []).forEach(function(l){ add("Aðrar línur", l); });
    groups = groups.filter(function(g){ return g.lines.length; });
    var h = data.handles && Number(data.handles.total) > 0 ? { count: Number(data.handles.count) || 0, total: Number(data.handles.total) } : null;
    var total = groups.reduce(function(n, g){ return n + g.sum; }, 0) + (h ? h.total : 0);
    var panelTotal = (Number(data.total) || 0) + stoneSum;
    return { rooms: groups, handles: h, total: total, panelTotal: panelTotal, mismatch: Math.abs(total - panelTotal) > 2 };
  }

  // The checklist in the "Búa til kynningu (PDF)" dialog. Only what really blocks stops the button; everything else says
  // plainly what the PDF will leave out. d: { dirty, rooms:[{name, closed, units, missing:[…names of unchosen materials]}],
  //   address, contact, imageCount (3D views captured; null = not captured yet), hasQuote }
  function readiness(d){
    d = d || {}; var items = [], rooms = d.rooms || [];
    items.push(d.dirty
      ? { id:"saved", ok:false, label:"Teikningin er vistuð", detail:"Óvistaðar breytingar (● óvistað) — kynningin yrði búin til eftir gamalli teikningu.", fix:{ id:"save", label:"Vista núna" } }
      : { id:"saved", ok:true, label:"Teikningin er vistuð" });
    var open = rooms.filter(function(r){ return !r.closed; });
    if (d.imageCount === 0) items.push({ id:"drawings", ok:false, optional:true, label:"3D teikningar fylgja ekki", detail:"Engar myndir náðust — kaflinn um teikningar og 2D athugasemdin eru sleppt." });
    else if (open.length) items.push({ id:"drawings", ok:false, optional:true, label:"3D teikningar fylgja ekki", detail:"Rýmið er ekki lokað: " + open.map(function(r){ return r.name; }).join(", ") + ". Lokaðu rýminu til að fá teikningar með." });
    else items.push({ id:"drawings", ok:true, label:"3D teikningar fylgja" });
    items.push(trim(d.address)
      ? { id:"address", ok:true, label:"Heimilisfang: " + trim(d.address) }
      : { id:"address", ok:false, optional:true, label:"Heimilisfang verkefnis vantar", detail:"Skrifaðu það í reitinn hér að neðan — annars sýnir forsíðan bara verkefnisnafnið.", fix:{ id:"focusAddress", label:"Skrifa heimilisfang" } });
    items.push(trim(d.contact)
      ? { id:"contact", ok:true, label:"Tengiliður: " + trim(d.contact) }
      : { id:"contact", ok:false, optional:true, label:"Nafn tengiliðs vantar", detail:"Forsíðan sýnir ekkert nafn." });
    var unset = [];
    rooms.forEach(function(r){ if (r.missing && r.missing.length) unset.push(r.name + ": " + r.missing.join(", ")); });
    items.push(unset.length
      ? { id:"materials", ok:false, optional:true, label:"Efni valið", detail:"Óákveðið — " + unset.join("; "), fix:{ id:"materials", label:"Loka og velja efni" } }
      : { id:"materials", ok:true, label:"Efni valið í öllum rýmum" });
    items.push(d.hasQuote === false
      ? { id:"quote", ok:false, label:"Tilboð vantar", detail:"Engar tilboðslínur — opnaðu Tilboð-flipann og bíddu eftir verðinu." }
      : { id:"quote", ok:true, label:"Tilboð per rými" });
    var blocking = items.filter(function(i){ return !i.ok && !i.optional; }).map(function(i){ return i.id; });
    return { items: items, canMake: !blocking.length, blocking: blocking };
  }

  var api = { buildReport: buildReport, buildQuoteSections: buildQuoteSections, readiness: readiness, kr: kr, VALID_DAYS: VALID_DAYS };
  root.KPPACKAGE = api;
})(typeof window !== "undefined" ? window : globalThis);
