// BJÖRNINN STUDIO English version (kitchen-planner-i18n.js): every literal key the planner looks up — __("…"),
// plural(n, "…", "…") and static markup marked data-i18n — must have an EN entry, or an English visitor
// would see Icelandic there. Also: placeholders ({n}) survive translation, and the runtime behaves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");

function loadI18n(search = "?lang=en", stored = null, englishOn = true) {
  const store = new Map(stored ? [["bjorninn:kitchenPlanner:lang", stored]] : []);
  const ctx = {
    URLSearchParams, URL,
    location: { search, href: "https://x.test/skipuleggja" + search, replace() {}, reload() {} },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    document: { addEventListener() {}, documentElement: {}, title: "BJÖRNINN STUDIO — hannaðu heimilið", querySelector: () => null },
  };
  ctx.window = ctx;
  ctx.KP_ENGLISH = englishOn;
  vm.runInNewContext(read("kitchen-planner-i18n.js"), ctx);
  vm.runInNewContext(read("kitchen-planner-i18n-en.js"), ctx); // the dictionary is its own file, written in by the page only when English is on
  return { I: ctx.window.KPI18N, store, ctx };
}

const { I } = loadI18n();
const unq = (lit) => vm.runInNewContext(lit); // a JS string literal → its value
const LIT = String.raw`("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')`;
const sources = ["kitchen-planner.html", ...fs.readdirSync(root).filter((f) => /^kitchen-planner-.*\.js$/.test(f) && f !== "kitchen-planner-i18n.js" && f !== "kitchen-planner-i18n-en.js")];
const lineOf = (src, i) => src.slice(0, i).split("\n").length;
const known = (k) => Object.prototype.hasOwnProperty.call(I.EN, k) || I.PATTERNS.some(([re]) => re.test(k));

test("every __(\"…\") and plural(n, \"…\", \"…\") key has an EN entry", () => {
  const missing = [];
  for (const f of sources) {
    const src = read(f);
    for (const m of src.matchAll(new RegExp(String.raw`(?<![\w$.])__\(\s*` + LIT, "g"))) {
      const k = unq(m[1]);
      if (!known(k)) missing.push(`${f}:${lineOf(src, m.index)}: ${k}`);
    }
    for (const m of src.matchAll(new RegExp(String.raw`(?<![\w$.])plural\([^,()]*(?:\([^()]*\))?[^,()]*,\s*` + LIT + String.raw`\s*,\s*` + LIT, "g"))) {
      for (const k of [unq(m[1]), unq(m[2])]) if (!known(k)) missing.push(`${f}:${lineOf(src, m.index)}: plural ${k}`);
    }
  }
  if (process.env.I18N_LIST) console.log(missing.join("\n"));
  assert.deepEqual([...new Set(missing)], []);
});

test("static markup marked data-i18n has EN entries (text + title/placeholder/aria-label/alt)", () => {
  const html = read("kitchen-planner.html").split("<script>\n(function(){")[0];
  const missing = [];
  let n = 0;
  for (const m of html.matchAll(/<(\w+)((?:\s[^>]*)?\sdata-i18n(?:="([^"]*)")?(?:\s[^>]*)?)>/g)) {
    n++;
    const [whole, tag, attrs, mode] = m;
    if (mode !== "attrs") {
      // the element's inner HTML up to its matching close tag (same-tag nesting counted)
      let depth = 1, i = m.index + whole.length, start = i;
      const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
      re.lastIndex = i;
      let t;
      while ((t = re.exec(html))) { depth += t[1] ? -1 : 1; if (!depth) break; }
      const k = I.norm(html.slice(start, t ? t.index : html.length));
      if (!known(k)) missing.push(`kitchen-planner.html:${lineOf(html, m.index)}: <${tag}> ${k}`);
    }
    for (const a of attrs.matchAll(/\s(title|placeholder|aria-label|alt)="([^"]*)"/g)) {
      const k = I.norm(a[2]);
      if (k && !known(k)) missing.push(`kitchen-planner.html:${lineOf(html, m.index)}: <${tag} ${a[1]}> ${k}`);
    }
  }
  if (process.env.I18N_LIST) console.log(missing.join("\n"));
  assert.ok(n > 20, `found ${n} data-i18n elements`);
  assert.deepEqual(missing, []);
});

test("EN values keep their key's {placeholders}", () => {
  const bad = [];
  for (const [k, v] of Object.entries(I.EN)) {
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    if (ph(k) !== ph(v)) bad.push(`${k} → ${v}`);
    if (typeof v !== "string" || !v.trim()) bad.push(`empty: ${k}`);
  }
  assert.deepEqual(bad, []);
});

test("runtime: EN lookup, IS default, forced Icelandic for Airtable data, plurals", () => {
  assert.equal(I.lang, "en");
  assert.equal(I.__("Veggur 3"), "Wall 3");
  I.EN["{n} skápar"] = "{n} cabinets";
  assert.equal(I.__("{n} skápar", { n: 4 }), "4 cabinets");
  assert.equal(I.asIS(() => I.__("{n} skápar", { n: 4 })), "4 skápar");
  assert.equal(I.__("eitthvað sem er ekki til"), "eitthvað sem er ekki til"); // falls back to the source
  I.EN["skápur"] = "cabinet"; I.EN["skápar"] = "cabinets";
  assert.equal(I.plural(21, "skápur", "skápar"), "cabinets");
  assert.equal(I.plural(1, "skápur", "skápar"), "cabinet");
  assert.equal(I.asIS(() => I.plural(21, "skápur", "skápar")), "skápur");
  return I.asISAsync(async () => { assert.equal(I.lang, "is"); }).then(() => assert.equal(I.lang, "en"));
});

test("English is switched off by default: ?lang=en and a stored \"en\" are ignored", () => {
  assert.equal(loadI18n("?lang=en", null, false).I.lang, "is");
  assert.equal(loadI18n("", "en", false).I.lang, "is");
});

test("runtime: language choice — default IS, ?lang= wins and is remembered, PRO always IS", () => {
  assert.equal(loadI18n("").I.lang, "is");
  assert.equal(loadI18n("", "en").I.lang, "en");
  const r = loadI18n("?lang=en");
  assert.equal(r.store.get("bjorninn:kitchenPlanner:lang"), "en");
  assert.equal(loadI18n("?lang=is", "en").I.lang, "is");
  assert.equal(loadI18n("?pro=recAAAAAAAAAAAAAA&lang=en", "en").I.lang, "is");
  assert.equal(loadI18n("?pro=home", "en").I.lang, "is");
});
