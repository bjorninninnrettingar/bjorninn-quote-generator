// kitchen-planner-package.js — "Senda drög til viðskiptavinar" (PRO, 2026-10-28): the pure logic.
// No DOM, no network: the report text, the e-mail, the readiness checklist. kitchen-planner.html gathers the facts
// (rooms, materials, price, contact) and calls these; tests/kp-package.test.js runs them under node.
//   KPPACKAGE.buildReport(d)   → { lines:[…6–10 plain Icelandic lines], text }
//   KPPACKAGE.buildEmail(d)    → { subject, body }  (greeting + report + link + signature; link may still be a placeholder)
//   KPPACKAGE.readiness(d)     → { items:[{id,ok,optional,label,detail,fix}], canSend, blocking:[ids] }
//   KPPACKAGE.gmailUrl(to, subject, body)
(function(root){
  "use strict";

  var LINK_PLACEHOLDER = "[hlekkur á tilboðið kemur hér þegar það er tilbúið]";
  var VALID_DAYS = 30; // same as generate-quote.js ("Tilboð gildir í 30 daga frá útgáfudegi")
  // What the quote covers / does not — one place to edit the wording.
  var INCLUDES = "innréttingar eins og þær eru teiknaðar, framhliðar, höldur og efnið sem er valið";
  var EXCLUDES = "tæki, raf- og pípulagnir og vinna annarra iðnaðarmanna, nema það komi fram á tilboðinu";

  function pl(n, one, many){ return n === 1 ? one : many; }
  function trim(s){ return String(s == null ? "" : s).trim(); }
  function isEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(s)); }
  function firstName(full){ var f = trim(full).split(/\s+/)[0] || ""; return f; }
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
    if (d.hasDrawings) lines.push("Teikningar af rýminu fylgja með tilboðinu.");
    lines.push(Number(d.total) > 0 ? "Heildarverð með vsk: " + kr(d.total) + "." : "Heildarverð: sjá tilboðið.");
    lines.push("Tilboðið gildir í " + VALID_DAYS + " daga.");
    lines.push("Næsta skref: þú svarar þessum pósti eða hringir í okkur með breytingar eða ef þú vilt staðfesta — við gerum svo næstu skref með þér.");
    return { lines: lines, text: lines.join("\n") };
  }

  // d: { first, report (the text as edited), link (or empty → placeholder), projectName, signature }
  function buildEmail(d){
    d = d || {};
    var nm = trim(d.projectName).split("|")[0].trim();
    var subject = "Drög og tilboð frá Birninum" + (nm ? " — " + nm : "");
    var sig = trim(d.signature) || "Kær kveðja,\nRakel\nBjörninn Innréttingar";
    var body = (trim(d.first) ? "Hæ " + trim(d.first) + "," : "Hæ,") + "\n\n" +
      "Takk fyrir síðast. Hér eru drög að innréttingunni og tilboð frá okkur.\n\n" +
      trim(d.report) + "\n\n" +
      "Tilboð, teikningar og efnisval (PDF):\n" + (trim(d.link) || LINK_PLACEHOLDER) + "\n\n" +
      "Ef eitthvað er óljóst eða þú vilt breyta einhverju er velkomið að svara þessum pósti.\n\n" + sig;
    return { subject: subject, body: body };
  }
  // the placeholder is swapped for the real link once the PDF exists (and the text Rakel edited is kept)
  function withLink(body, link){ return String(body || "").split(LINK_PLACEHOLDER).join(link); }
  function hasPlaceholder(body){ return String(body || "").indexOf(LINK_PLACEHOLDER) >= 0; }

  function gmailUrl(to, subject, body){
    return "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(trim(to)) + "&su=" + encodeURIComponent(subject || "") + "&body=" + encodeURIComponent(body || "");
  }

  // d: { dirty, saved?, rooms:[{name, closed, units, missing:[…names of unchosen materials]}], skipDrawings (Rakel accepts none),
  //      email, quote: null (not made yet) | { ok, files, link }, drawingsSkippedWhy, studioKnown (number|null) }
  function readiness(d){
    d = d || {}; var items = [], rooms = d.rooms || [];
    items.push(d.dirty
      ? { id:"saved", ok:false, label:"Teikningin er vistuð", detail:"Óvistaðar breytingar (● óvistað).", fix:{ id:"save", label:"Vista núna" } }
      : { id:"saved", ok:true, label:"Teikningin er vistuð" });
    var open = rooms.filter(function(r){ return !r.closed; });
    if (!open.length) items.push({ id:"closed", ok:true, label:"Öll rými lokuð — teikningar fylgja" });
    else if (d.skipDrawings) items.push({ id:"closed", ok:true, label:"Teikningar sleppt", detail:"Rýmið er ekki lokað: " + open.map(function(r){ return r.name; }).join(", ") + " — tilboðið fer án teikninga." });
    else items.push({ id:"closed", ok:false, label:"Öll rými lokuð — teikningar fylgja",
      detail:"Ekki lokað: " + open.map(function(r){ return r.name; }).join(", ") + ". Teikningar yrðu sleppt.", fix:{ id:"skipDrawings", label:"Senda án teikninga" } });
    items.push(isEmail(d.email)
      ? { id:"email", ok:true, label:"Netfang viðskiptavinar: " + trim(d.email) }
      : { id:"email", ok:false, label:"Netfang viðskiptavinar vantar", detail:"Skrifaðu netfangið í reitinn hér að neðan.", fix:{ id:"focusEmail", label:"Skrifa netfang" } });
    var q = d.quote;
    if (!q) items.push({ id:"quote", ok:false, pending:true, label:"Tilboð (PDF) með hlekk", detail:"Verður búið til þegar þú ýtir á hnappinn." });
    else if (q.ok && q.link && q.files > 0) items.push({ id:"quote", ok:true, label:"Tilboð (PDF) tilbúið, hlekkurinn virkar" });
    else items.push({ id:"quote", ok:false, label:"Tilboð (PDF) náðist ekki", detail:"PDF-ið kom ekki á Tækifærið.", fix:{ id:"retry", label:"Reyna aftur" } });
    if (d.drawingsSkippedWhy) items.push({ id:"drawings", ok:false, label:"Teikningar fylgdu ekki", detail:d.drawingsSkippedWhy, fix:{ id:"retry", label:"Reyna aftur" } });
    var unset = [];
    rooms.forEach(function(r){ if (r.missing && r.missing.length) unset.push(r.name + ": " + r.missing.join(", ")); });
    items.push(unset.length
      ? { id:"materials", ok:false, label:"Efni valið", detail:"Óákveðið — " + unset.join("; "), fix:{ id:"materials", label:"Loka og velja efni" } }
      : { id:"materials", ok:true, label:"Efni valið í öllum rýmum" });
    items.push({ id:"studio", ok:Number(d.studioKnown) > 0, optional:true, label:"Studio mynd (valfrjálst)",
      detail: Number(d.studioKnown) > 0 ? d.studioKnown + " " + pl(d.studioKnown, "mynd", "myndir") + " vistuð" : "Engin talin hér. Myndir á Tækifærinu fylgja ekki póstinum." });
    var blocking = items.filter(function(i){ return !i.ok && !i.optional && !i.pending; }).map(function(i){ return i.id; });
    return { items: items, canSend: !blocking.length, blocking: blocking };
  }

  var api = { buildReport: buildReport, buildEmail: buildEmail, readiness: readiness, gmailUrl: gmailUrl, withLink: withLink, hasPlaceholder: hasPlaceholder,
    isEmail: isEmail, firstName: firstName, kr: kr, LINK_PLACEHOLDER: LINK_PLACEHOLDER, VALID_DAYS: VALID_DAYS };
  root.KPPACKAGE = api;
})(typeof window !== "undefined" ? window : globalThis);
