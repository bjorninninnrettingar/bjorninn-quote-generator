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
    "Innskúffan passar ekki með {n} skúffum — hún var tekin út.": "The inner drawer doesn't fit with {n} drawers — it was removed.",
    "Innskúffan passar ekki með þessari breytingu — hún var tekin út.": "The inner drawer doesn't fit with this change — it was removed.",
    "ábending": "note",
    "ábendingar": "notes",
    "Ekki nóg pláss á {wall} til að afrita.": "Not enough space on {wall} to duplicate.",
    "3D er ekki stutt í þessum vafra — þú getur skipulagt í teikningunni.": "3D isn't supported in this browser — you can plan in the drawing.",
    "Hleð 3D…": "Loading 3D…",
    "3D tókst ekki að hlaða — þú getur skipulagt í teikningunni.": "3D failed to load — you can plan in the drawing.",
    "X-Ray: smelltu á skúffu eða hurð til að opna hana. Skápar hreyfast ekki á meðan.": "X-Ray: click a drawer or door to open it. Cabinets can't be moved meanwhile.",
    "Smelltu til að slá inn mál": "Click to type in sizes",
    "Læst — smelltu til að geta fært": "Locked — click to be able to move it",
    "Læsa": "Lock",
    "Skápurinn er læstur — smelltu til að opna": "The cabinet is locked — click to unlock",
    "Læsa skáp": "Lock cabinet",
    "Læst — smelltu til að opna": "Locked — click to unlock",
    "Læsa hlutnum": "Lock this item",
    "Breidd": "Width",
    "Hæð": "Height",
    "Dýpt": "Depth",
    "Hæð frá gólfi": "Height from floor",
    "Tvær raðir bak í bak": "Two rows back to back",
    "Ein röð": "One row",
    "frístandandi": "freestanding",
    "Loka": "Close",
    "Lengd: <b>{n} mm</b> — reiknast út frá skápunum. Veldu skáp í eyjunni til að breyta breidd hans, eða notaðu ＋ og ✕ til að breyta fjölda.": "Length: <b>{n} mm</b> — worked out from the cabinets. Select a cabinet in the island to change its width, or use ＋ and ✕ to change how many.",
    "Raðir": "Rows",
    "Tvær raðir": "Two rows",
    "Staðsetning — dragðu gula punktinn á gólfinu, eða notaðu örvarnar": "Position — drag the yellow dot on the floor, or use the arrows",
    "Vinstri": "Left",
    "Upp": "Up",
    "Niður": "Down",
    "Hægri": "Right",
    "Örvar á lyklaborði færa líka (Shift = 10 mm)": "The keyboard arrows move it too (Shift = 10 mm)",
    "↻ Snúa 90°": "↻ Rotate 90°",
    "✓ Bak á eyju": "✓ Island back panel",
    "＋ Bak á eyju": "＋ Island back panel",
    "＋ Skápur": "＋ Cabinet",
    "röð A": "row A",
    "röð B": "row B",
    "✕ Fjarlægja eyju": "✕ Remove island",
    "Smelltu á skáp í eyjunni til að breyta tegund, skúffum o.fl.": "Click a cabinet in the island to change its type, drawers, etc.",
    "{what} þarf að vera á milli {a} og {b} mm.": "{what} must be between {a} and {b} mm.",
    "Gluggi": "Window",
    "Op í vegg": "Opening",
    "Hurð": "Door",
    "Mál (mm)": "Size (mm)",
    "Frá gólfi": "From floor",
    "Dragðu gluggann upp og niður á veggnum í 3D til að breyta hæðinni.": "Drag the window up and down the wall in 3D to change its height.",
    "🔒 Læst — smelltu til að geta fært": "🔒 Locked — click to be able to move it",
    "🔓 Hægt að færa — smelltu til að læsa": "🔓 Can be moved — click to lock",
    "Læst á meðan þú raðar skápum, svo glugginn færist ekki óvart. Málin hér að ofan má samt slá inn.": "Locked while you arrange cabinets, so the window doesn't move by accident. You can still type in the sizes above.",
    "Læst á meðan þú raðar skápum, svo hurðin færist ekki óvart. Málin hér að ofan má samt slá inn.": "Locked while you arrange cabinets, so the door doesn't move by accident. You can still type in the sizes above.",
    "Dragðu til í 3D eða 2D. Læstu aftur þegar staðsetningin er rétt.": "Drag it in 3D or 2D. Lock it again when the position is right.",
    "Fjarlægja": "Remove",
    "✕ Fjarlægja": "✕ Remove",
    "rýmið": "the room",
    "Opnast": "Opens",
    "Inn í rýmið": "Into the room",
    "Út úr því": "Out of it",
    "Rennihurð": "Sliding door",
    "Rennur til hægri": "Slides to the right",
    "Lamir vinstra megin": "Hinges on the left",
    "Rennur til vinstri": "Slides to the left",
    "Lamir hægra megin": "Hinges on the right",
    "Séð innan úr rýminu, horft á vegginn.": "Seen from inside the room, facing the wall.",
    "Þykkt": "Thickness",
    "Lengd": "Length",
    "Heildarhæð": "Total height",
    "Frá gólfi (mm)": "From floor (mm)",
    "Neðri brún skápsins · 0–{max} mm, eða dragðu hann upp og niður": "Bottom edge of the cabinet · 0–{max} mm, or drag it up and down",
    "Fjöldi hilla (allt að {n})": "Number of shelves (up to {n})",
    "hilla": "shelf",
    "hillur": "shelves",
    "38 mm þykkar": "38 mm thick",
    "Bil á milli hilla": "Gap between shelves",
    "Tekur hæð, dýpt og hæð frá gólfi af skápnum sem hún liggur að": "Takes the height, depth and height from floor of the cabinet it sits against",
    "↔ Passa við skápinn": "↔ Match the cabinet",
    "Lausar hillur": "Loose shelves",
    "Fataslár": "Clothes rails",
    "fataslá": "clothes rail",
    "fataslár": "clothes rails",
    "Ein hurð; hinn helmingurinn er föst blindplata": "One door; the other half is a fixed blind panel",
    "Hurðin er": "Door is on the",
    "Hurðin rennur inn í hlið skápsins þegar hún er opin (Blum Revego). Dýrari lausn, söluaðili staðfestir verð.": "The door slides into the side of the cabinet when open (Blum Revego). A pricier option; the sales advisor confirms the price.",
    "Á lömum": "On hinges",
    "Rennur inn í hlið": "Slides into the side",
    "LED-borði inni í skápnum. Rafmagn er tengt á staðnum af þér eða fagaðila.": "LED strip inside the cabinet. Power is connected on site by you or a professional.",
    "Ekkert": "None",
    "Lóðrétt í hlið": "Vertical in the side",
    "Undir efstu hillu": "Under the top shelf",
    "Vinstri hlið": "Left side",
    "Hægri hlið": "Right side",
    "Rafmagn: viðskiptavinur eða fagaðili þarf að tengja LED-lýsinguna við rafmagn á staðnum.": "Power: the customer or a professional needs to connect the LED lighting to power on site.",
    "Séð framan frá": "Seen from the front",
    "Lamir": "Hinges",
    "💡 LED undir skápnum: á": "💡 LED under the cabinet: on",
    "💡 LED undir skápnum: af": "💡 LED under the cabinet: off",
    "Smelltu á skúffur og hurðir í 3D til að opna þær": "Click drawers and doors in 3D to open them",
    "Læstu honum þegar hann er réttur": "Lock it once it's right",
    "🔒 Læstur": "🔒 Locked",
    "🔓 Læsa": "🔓 Lock",
    "Tegund": "Type",
    "Úthlið": "End panel",
    "19 mm úthlið — fylgir skápnum": "19 mm end panel — goes with the cabinet",
    "Söluaðili staðfestir stærð tækis og hurðargerð.": "The sales advisor confirms the appliance size and door type.",
    "efri röð": "upper row",
    "neðri röð": "lower row",
    "Velja eyjuna": "Select the island",
    "Eyja": "Island",
    "Færa til vinstri": "Move left",
    "Færa til hægri": "Move right",
    "Hæð frá gólfi þarf að vera á milli 0 og {max} mm.": "Height from floor must be between 0 and {max} mm.",
    "Þar rekst hann á háan skáp á sama vegg.": "There it would hit a tall cabinet on the same wall.",
    "Bil þarf að vera á milli 50 og 800 mm.": "The gap must be between 50 and 800 mm.",
    "Það er þegar úthlið þeim megin.": "There's already an end panel on that side.",
    "Úthliðin kemst ekki fyrir — það er ekkert laust bil á veggnum til að færa skápana í.": "The end panel doesn't fit — there's no free space on the wall to move the cabinets into.",
    "Engin úthlið passar ekki — hún þarf að liggja að skáp.": "The end panel can't be matched — it needs to sit against a cabinet.",
    "valinn": "selected",
    "{len} mm langur · lofthæð {h} mm": "{len} mm long · ceiling height {h} mm",
    "Laust pláss: neðri röð <b>{lo} mm</b> · efri röð <b>{hi} mm</b>": "Free space: lower row <b>{lo} mm</b> · upper row <b>{hi} mm</b>",
    "Á þessum vegg": "On this wall",
    "Ekkert ennþá — dragðu skáp úr vörulistanum á vegginn.": "Nothing yet — drag a cabinet from the catalogue onto the wall.",
    "＋ Gluggi": "＋ Window",
    "＋ Hurð": "＋ Door",
    "＋ Op": "＋ Opening",
    "Breyta lengd veggja": "Change wall lengths",
    "Ekki nóg pláss á {wall}.": "Not enough space on {wall}.",
    "Teiknaðu rýmið fyrst.": "Draw the room first.",
    "Of langt til að snúa á þessum vegg — styttu það fyrst.": "Too long to rotate on this wall — shorten it first.",
    "Fjarlægðu skápana af milliveggnum fyrst.": "Remove the cabinets from the partition wall first.",
    "Hindrun · ekki í pöntun": "Obstacle · not ordered",
    "Veggur": "Wall",
    "Frá vinstra horni": "From left corner",
    "Lengd út í rýmið": "Length into the room",
    "Dýpt út frá vegg": "Depth out from wall",
    "Bil frá vegg": "Gap from wall",
    "Frá gólfi upp í loft": "Floor to ceiling",
    "Vaskaskápur eða uppþvottavél fer yfir það.": "A sink cabinet or dishwasher goes over it.",
    "Lögun": "Shape",
    "Kassi": "Box",
    "Hringur": "Round",
    "Snúa um 90° um miðjuna": "Rotate 90° about its centre",
    "Það eru skápar á milliveggnum sem passa ekki í styttri vegg — fjarlægðu þá fyrst.": "There are cabinets on the partition wall that won't fit a shorter wall — remove them first.",
    "Húsgögnin eru læst — opnaðu þau í „Húsgögn og skraut“.": "The furniture is locked — unlock it under “Furniture & decor”.",
    "Hluturinn er læstur — smelltu á 🔒 til að geta fært hann.": "This item is locked — click 🔒 to be able to move it.",
    "Settu fyrst inn skáp með borðplötu — þá fer hluturinn ofan á hana.": "First add a cabinet with a worktop — the item then goes on top of it.",
    "Engin borðplata eða borð til að setja þetta á.": "No worktop or table to put this on.",
    "Hluturinn kemst ekki fyrir þar.": "The item doesn't fit there.",
    "Það kemst ekki fyrir hér — færðu hlutinn fyrst.": "It doesn't fit here — move the item first.",
    "Stærð": "Size",
    "{n} manna": "{n} seats",
    "Húsgögn og skraut — ekki í pöntun": "Furniture & decor — not ordered",
    "Snúningur": "Rotation",
    "🔒 Öll húsgögn eru læst": "🔒 All furniture is locked",
    "🔒 Læst — smelltu til að opna": "🔒 Locked — click to unlock",
    "🔓 Læsa hlutnum": "🔓 Lock this item",
    "🗑 Fjarlægja": "🗑 Remove",
    "Dragðu hlutinn til í 3D — hann stoppar við veggi og skápa.": "Drag the item around in 3D — it stops at walls and cabinets.",
    "Hann sest ofan á borðplötuna eða borðið sem hann lendir á.": "It sits on top of the worktop or table it lands on.",
    "LED-borði 4×8 mm, 1 m": "LED strip 4×8 mm, 1 m",
    "LED-borði 4×8 mm, 2 m": "LED strip 4×8 mm, 2 m",
    "LED-borði 4×8 mm, 3 m": "LED strip 4×8 mm, 3 m",
    "LED-borði 6×6 mm í rauf, 3 m": "LED strip 6×6 mm in a groove, 3 m",
    "Straumbreytir D-power 15 W": "D-power 15 W transformer",
    "Straumbreytir D-power 30 W": "D-power 30 W transformer",
    "Straumbreytir D-power 60 W": "D-power 60 W transformer",
    "Straumbreytir D-power 100 W": "D-power 100 W transformer",
    "Viltu setja hann {w} mm breiðan í staðinn?": "Would you like it {w} mm wide instead?",
    "Já, {w} mm": "Yes, {w} mm",
    "Nei takk": "No thanks",
    "Sömu efni og í {room} — þú getur breytt þeim fyrir þetta rými í Efni.": "Same materials as in {room} — you can change them for this room under Materials.",
    "Eldhús": "Kitchen",
    "Fataskápar": "Wardrobes",
    "Baðherbergi": "Bathroom",
    "Þvottahús": "Laundry room",
    "Hurðir": "Doors",
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
