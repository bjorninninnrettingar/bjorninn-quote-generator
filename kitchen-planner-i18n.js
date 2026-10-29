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
  // English is switched OFF for now (owner, 2026-10-29): the dictionary below stays, the visitor can't reach it.
  // To bring it back: set window.KP_ENGLISH = true before this file loads (and drop the CSS rule hiding .help-lang).
  var ENGLISH_ON = window.KP_ENGLISH === true;
  if (!isPro && ENGLISH_ON){
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
    if (!ENGLISH_ON || (l !== "en" && l !== "is")) return;
    try{ localStorage.setItem(KEY, l); }catch(e){}
    try{ sessionStorage.setItem("bjorninn:kitchenPlanner:langResume", "1"); }catch(e){} // the page reopens on the same step, not the welcome page
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

  window.KPI18N = { get lang(){ return cur(); }, get forced(){ return forced > 0; }, chosen:lang, isPro:isPro, EN:EN, PATTERNS:PATTERNS, missing:missing,
    add:add, addPat:addPat, __:__, plural:plural, asIS:asIS, asISAsync:asISAsync, apply:apply, setLang:setLang, norm:norm };
  window.__ = __;

  // The EN dictionary (≈155 KB) is its own file, written in only when English is on (owner switched it off 2026-10-29):
  // a Icelandic visitor neither downloads nor parses it. Tests / hosts without document.write load it themselves.
  if (lang === "en" && typeof document.write === "function") document.write('<script src="kitchen-planner-i18n-en.js"><\/script>');
})();
