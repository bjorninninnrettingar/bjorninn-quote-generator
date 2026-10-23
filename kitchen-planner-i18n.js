// BJÖRNINN STUDIO — English version (2026-10-23). Loaded before every other kitchen-planner script.
//
// Source-keyed, gettext-style: the Icelandic text in the code IS the key, so the planner still reads as
// Icelandic and nothing changes when the language is IS.
//   __("Til baka")                     → "Back" in EN, "Til baka" in IS
//   __("{n} mm frá horni", { n:450 })  → "{n}" is filled in both languages
//   plural(n, "skápur", "skápar")      → the planner's own plural() translates both words in EN
//   <button data-i18n>Áfram →</button> → static markup: innerHTML + title/placeholder/aria-label/alt are
//                                        looked up once at start (data-i18n="attrs" = attributes only)
// A key with no EN entry falls back to the Icelandic text (and lands in KPI18N.missing for debugging);
// tests/kp-i18n.test.js checks every literal key the code uses exists here.
//
// DATA STAYS ICELANDIC: only what's displayed is translated. Anything built for Airtable (Skilaboð til
// skipulags, Line Items, Smíðagögn, the drawings PDF) is built inside KPI18N.asIS(fn) / asISAsync(fn),
// where __() and plural() answer in Icelandic whatever the visitor picked. PRO mode is always Icelandic.
(function(){
  "use strict";
  var KEY = "bjorninn:kitchenPlanner:lang";
  var q; try{ q = new URLSearchParams(location.search); }catch(e){ q = { get:function(){ return null; } }; }
  var isPro = !!q.get("pro");
  var lang = "is";
  if (!isPro){
    var p = q.get("lang");
    if (p === "en" || p === "is"){ lang = p; try{ localStorage.setItem(KEY, p); }catch(e){} }
    else { try{ if (localStorage.getItem(KEY) === "en") lang = "en"; }catch(e){} }
  }
  var forced = 0;
  var EN = {}, PATTERNS = [], missing = {};
  function add(o){ for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) EN[k] = o[k]; }
  // A stored label like "Veggur 2" is data (it goes into notes as is) — shown through a pattern.
  function addPat(re, repl){ PATTERNS.push([re, repl]); }
  function norm(s){ return String(s).replace(/\s+/g, " ").trim(); }
  function has(k){ return Object.prototype.hasOwnProperty.call(EN, k); }
  function cur(){ return forced ? "is" : lang; }

  function lookup(s){
    var k = String(s);
    if (has(k)) return EN[k];
    for (var i = 0; i < PATTERNS.length; i++) if (PATTERNS[i][0].test(k)) return k.replace(PATTERNS[i][0], PATTERNS[i][1]);
    if (k.trim() && !missing[k]){ missing[k] = 1; }
    return k;
  }
  function __(s, vars){
    if (s == null) return s;
    var out = cur() === "en" ? lookup(s) : String(s);
    if (vars) out = out.replace(/\{(\w+)\}/g, function(m, n){ return Object.prototype.hasOwnProperty.call(vars, n) ? vars[n] : m; });
    return out;
  }
  // Icelandic: 1, 21, 31… take the singular (11 doesn't). English: only 1.
  function plural(n, one, many){
    if (cur() === "en") return n === 1 ? __(one) : __(many);
    return (n % 10 === 1 && n % 100 !== 11) ? one : many;
  }
  function asIS(fn){ forced++; try{ return fn(); } finally { forced--; } }
  function asISAsync(fn){
    forced++;
    var done = function(){ forced--; };
    try{ return Promise.resolve(fn()).then(function(v){ done(); return v; }, function(e){ done(); throw e; }); }
    catch(e){ done(); return Promise.reject(e); }
  }
  var ATTRS = ["title", "placeholder", "aria-label", "alt"];
  function apply(root){
    if (lang !== "en") return;
    (root || document).querySelectorAll("[data-i18n]").forEach(function(el){
      if (el.getAttribute("data-i18n") !== "attrs"){
        var k = norm(el.innerHTML);
        if (has(k)) el.innerHTML = EN[k]; else lookup(k);
      }
      ATTRS.forEach(function(a){ var v = el.getAttribute(a); if (v) el.setAttribute(a, __(norm(v))); });
    });
  }
  // Switching language reloads the page: the draft lives in localStorage, so the visitor lands on the same
  // step with every JS-built string redrawn — simpler and safer than re-rendering everything in place.
  function setLang(l){
    if (l !== "en" && l !== "is") return;
    try{ localStorage.setItem(KEY, l); }catch(e){}
    try{
      var u = new URL(location.href);
      if (u.searchParams.has("lang")) u.searchParams.set("lang", l);
      location.replace(u.toString());
    }catch(e){ location.reload(); }
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-setlang]");
    if (b){ e.preventDefault(); setLang(b.getAttribute("data-setlang")); }
  });

  window.KPI18N = { get lang(){ return cur(); }, chosen:lang, isPro:isPro, EN:EN, PATTERNS:PATTERNS, missing:missing,
    add:add, addPat:addPat, __:__, plural:plural, asIS:asIS, asISAsync:asISAsync, apply:apply, setLang:setLang, norm:norm };
  window.__ = __;

  // ======================================================================
  // EN dictionary — one block per area of the planner. Keys are the exact Icelandic source strings.
  // ======================================================================
  addPat(/^Veggur (\d+)$/, "Wall $1");
  addPat(/^Eyja (\d+)$/, "Island $1");

  // ---- page shell: <head>, header, language switch ----
  add({
    "BJÖRNINN STUDIO — hannaðu heimilið": "BJÖRNINN STUDIO — design your home",
    "Teiknaðu upp draumaeldhúsið í 3D — veldu skápa, efni og lögun. Gróf teikning, engin binding. Björninn Innréttingar fer yfir og fullkomnar hönnunina með þér.":
      "Sketch your dream kitchen in 3D — choose cabinets, materials and layout. A rough drawing, no commitment. Björninn Innréttingar reviews it and perfects the design with you.",
    "Tungumál": "Language",
    "🇬🇧 In English": "🇬🇧 In English",
    "🇮🇸 Á íslensku": "🇮🇸 Á íslensku"
  });

  // ---- part A: markup + start / intake / room shape step ----
  add({
  });

  // ---- part B: openings phase, walls, placement, end panels, drawer builder, variants ----
  add({
    "Veggur {n}": "Wall {n}",
    "(opinn)": "(open)",
    "Engir gluggar eða hurðir á þessum vegg": "No windows or doors on this wall",
    "Bil frá vinstra horni": "Gap from the left corner",
    "Bil að hægra horni": "Gap to the right corner",
    "Þykkt": "Thickness",
    "Breidd": "Width",
    "Hæð": "Height",
    "Frá gólfi": "From the floor",
    "Bilið þarf að vera á milli 0 og {max} mm.": "The gap must be between 0 and {max} mm.",
    "Ekki nóg pláss á {wall} fyrir {item}.": "Not enough room on {wall} for {item}.",
    "Skápurinn er læstur 🔒 — opnaðu lásinn til að breyta honum.": "The cabinet is locked 🔒 — unlock it to change it.",
    "Úthliðin er læst við skápinn — hún fylgir honum.": "The end panel is locked to the cabinet — it follows it.",
    "Læsta úthliðin komst ekki með skápnum — ekkert pláss. Hún er á sama stað.": "The locked end panel couldn't move with the cabinet — no room. It stays where it was.",
    "Úthliðin kemst ekki með skápnum þangað — ekkert pláss.": "The end panel can't go there with the cabinet — no room.",
    "Dýpt": "Depth",
    "{what} þarf að vera á milli {a} og {b} mm.": "{what} must be between {a} and {b} mm.",
    "{item} {v} mm passar ekki á {wall}.": "{item} {v} mm doesn't fit on {wall}.",
    "Ekki nóg pláss á {wall} fyrir þessa breidd.": "Not enough room on {wall} for this width.",
    "Þá myndi skápurinn rekast á {what} á sama vegg.": "The cabinet would then run into {what} on the same wall.",
    "efri skáp eða hillu": "a wall cabinet or shelf",
    "hávan skáp": "a tall cabinet",
    "Hæð þarf að vera á milli {a} og {b} mm.": "Height must be between {a} and {b} mm.",
    "Sökkulhæð þarf að vera á milli {a} og {b} mm.": "Plinth height must be between {a} and {b} mm.",
    "<b>Það vantar úthliðar á {n} {places}.</b> Sýnilegar hliðar á skápum fá 19 mm úthlið í framhliðaefninu. Viltu að við bætum þeim við?": "<b>End panels are missing in {n} {places}.</b> Visible cabinet sides get a 19 mm end panel in the front material. Shall we add them?",
    "stað": "place",
    "stöðum": "places",
    "Já, bæta við": "Yes, add them",
    "Nei, halda áfram": "No, continue",
    "Bætti við {n} {panels}": "Added {n} {panels}",
    "úthlið": "end panel",
    "úthliðum": "end panels",
    " — {n} komust ekki fyrir, færðu skápana aðeins til": " — {n} didn't fit, move the cabinets a little",
    ". Skoðaðu og ýttu aftur á Áfram.": ". Have a look and press Next again.",
    "Ekki hægt — {item} myndi rekast á {what} á sama vegg.": "Not possible — {item} would run into {what} on the same wall.",
    "Mjög lág": "Very low",
    "Lág": "Low",
    "Miðlungs": "Medium",
    "Djúp": "Deep",
    "Mjög djúp": "Very deep",
    "Föst framhlið": "Fixed front",
    "mjög lágar": "very low",
    "lágar": "low",
    "miðlungs": "medium",
    "djúpar": "deep",
    "mjög djúpar": "very deep",
    "Þessi samsetning með innskúffu er ekki til.": "This combination with an inner drawer doesn't exist.",
    "Býr til nýja samsetningu…": "Creating a new combination…",
    "Ekki tókst að búa til samsetningu": "Couldn't create the combination",
    "Ekki tókst að búa til samsetningu — reyndu aftur.": "Couldn't create the combination — please try again.",
    "Vinsælar lausnir — einn smellur": "Popular set-ups — one click",
    "2 hillur": "2 shelves",
    "Innskúffur (neðan frá)": "Inner drawers (from the bottom)",
    "Fjarlægja": "Remove",
    "Engar innskúffur enn.": "No inner drawers yet.",
    "Hillur fyrir ofan": "Shelves above",
    "hilla": "shelf",
    "hillur": "shelves",
    "Sérsamsetning — söluaðili staðfestir verð.": "Custom combination — a sales advisor confirms the price.",
    "Tómur skápur — bættu við innskúffum og hillum eða veldu lausn hér að ofan.": "Empty cabinet — add inner drawers and shelves or pick a set-up above.",
    "Það komast ekki fleiri innskúffur fyrir í skápnum.": "No more inner drawers fit in the cabinet.",
    "skúffa": "drawer",
    "skúffur": "drawers",
    "miðlungs innskúffa": "medium inner drawer",
    "lág innskúffa": "low inner drawer",
    "Ofninn er": "The oven is",
    "Í háum skáp": "In a tall cabinet",
    "Í grunnskáp": "In a base cabinet",
    "Ofninn undir borðplötu, M-skúffa undir honum.": "The oven under the worktop, an M drawer below it.",
    "Undir ofninum": "Under the oven",
    "Skápur með hurð (engar skúffur)": "Cabinet with a door (no drawers)",
    "Frontahæðir undir ofni": "Front heights under the oven",
    "Aðeins samsetningar sem Björninn smíðar ({sys}).": "Only combinations Björninn makes ({sys}).",
    "Efni": "Material",
    "Skrokkefni": "Carcass material",
    "Allt úr framhliðaefni": "All in the front material",
    "Útfærsla": "Variant",
    "Skúffa undir vélinni + skápur ofan við": "Drawer under the machine + cabinet above",
    "Hurðir alla leið, 4 loftunarhillur": "Doors all the way, 4 ventilated shelves",
    "Dragðu til að breyta hæð skúffanna": "Drag to change the drawer heights",
    "Hæð framhliðar (mm)": "Front height (mm)",
    "↺ Sjálfgefnar hæðir": "↺ Default heights",
    "Innskúffa er ekki til fyrir þennan skáp.": "An inner drawer isn't available for this cabinet.",
    "Innskúffa fæst ekki með <b>{cur}</b> — hún er bara til með 1–2 skúffum. Viltu skipta yfir í <b>{alt} + {inner}</b>?": "An inner drawer isn't available with <b>{cur}</b> — it only comes with 1–2 drawers. Switch to <b>{alt} + {inner}</b>?",
    "miðlungs innskúffu": "a medium inner drawer",
    "lága innskúffu": "a low inner drawer",
    "Já, skipta": "Yes, switch",
    "Nei takk": "No thanks",
    "Ruslafötur fara í neðstu skúffuna.": "Bins go in the bottom drawer.",
    "Hillur": "Shelves",
    "Hurðir": "Doors",
    "Skúffur": "Drawers",
    "Innskúffa:": "Inner drawer:",
    "Fæst með {alt} — smelltu til að skipta": "Available with {alt} — click to switch",
    "Ekki til fyrir þennan skáp": "Not available for this cabinet",
    "Innskúffa fæst með 1–2 skúffum ({list}).": "An inner drawer comes with 1–2 drawers ({list}).",
    "⚠️ Þessi samsetning er ekki til sem stöðluð vara — söluaðili staðfestir hana.": "⚠️ This combination isn't a standard product — a sales advisor will confirm it.",
    "Efst, við vaskinn": "At the top, by the sink",
    "Skúffa undir vaski": "Drawer under the sink",
    "Fastur frontur": "Fixed front",
    "⚠️ Með föstum fronti þarf minnst tvær skúffur.": "⚠️ A fixed front needs at least two drawers.",
    "⚠️ Efsti frontur er {top} mm — {what} minnst {min} mm.": "⚠️ The top front is {top} mm — {what} at least {min} mm.",
    "vaskurinn (~200 mm) þarf": "the sink (~200 mm) needs",
    "skúffan undir vaskinum þarf": "the drawer under the sink needs",
    "{kind} skúffa er undir {min} mm lágmarkinu": "{kind} drawer is below the {min} mm minimum",
    "hurðin fyrir ofan er orðin of lítil": "the door above has become too small",
    " og ": " and ",
    " — lagaðu áður en skápurinn er merktur klár.": " — fix it before the cabinet is marked ready.",
    "{kind} ({v} mm, lágmark {min} mm)": "{kind} ({v} mm, minimum {min} mm)",
    " undir lágmarki — lagaðu áður en skápurinn er merktur klár.": " below the minimum — fix it before the cabinet is marked ready.",
    "Gluggi": "Window",
    "Hurð": "Door",
    "Op í vegg": "Wall opening",
    "Eyja — ein röð": "Island — one row",
    "Eyja — tvær raðir": "Island — two rows",
    "Gluggar, hurðir, op og skápar mega ekki skarast — það er ekki pláss fyrir þetta þarna.": "Windows, doors, openings and cabinets can't overlap — there's no room for this there.",
    "Ekki nóg pláss fyrir {item} á neinum vegg.": "Not enough room for {item} on any wall."
  });

  // ---- part C: Ný eining wizard, catalog, islands, materials, 3D view, wall annotations ----
  add({
  });

  // ---- part D: warnings, X-Ray, edit panel, obstacles, decor, lighting, screens ----
  add({
  });

  // ---- part E: stepper, contact / submit, tour, Studio cards, door list, Studio mynd, walk ----
  add({
  });

  // ---- part F: kitchen-planner-3d.js, -catalog.js, -handles.js, -models.js ----
  add({
  });

  if (lang === "en"){
    document.documentElement.lang = "en";
    document.title = __(document.title);
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", __(md.getAttribute("content")));
  }
})();
