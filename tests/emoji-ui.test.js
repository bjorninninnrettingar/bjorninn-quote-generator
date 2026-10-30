// Emoji-as-icon guard (2026-10-30). Floor + office pages use the shared line icons from bjorninn-icons.js.
// Emoji may only remain inside quoted literals that are Airtable field names, choices, filters or keys
// (listed in tests/emoji-data-literals.json). Those are compared / sent back as-is and only STRIPPED at render time.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, "..");
const ALLOW = JSON.parse(fs.readFileSync(path.join(__dirname, "emoji-data-literals.json"), "utf8"));
// Pages / scripts converted so far. Add new ones here as groups are converted.
const PAGES = Object.keys(ALLOW);

const EM = /(?![\u2194\u2195\u2196-\u2199\u21a9\u21aa\u25b6\u25c0])\p{Extended_Pictographic}|\uFE0F/u;

function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "bjorninn-icons.js"), "utf8"), ctx);
  return ctx.window.BJICON;
}

function stripComments(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => {
    if (/^\s*\/\//.test(l)) return "";
    const m = l.match(/^(.*?\S)(\s+\/\/\s.*)$/);
    if (m && (m[1].match(/["'`]/g) || []).length % 2 === 0) return m[1];
    return l;
  }).join("\n");
}

test("BJICON.strip removes emoji for display and leaves text, arrows and ©", () => {
  const B = load();
  assert.strictEqual(B.strip("🏆 Tækifæri unnið"), "Tækifæri unnið");
  assert.strictEqual(B.strip("Komið í hús 🐻"), "Komið í hús");
  assert.strictEqual(B.strip("Afhent (LOKIÐ ✅)"), "Afhent (LOKIÐ)");
  assert.strictEqual(B.strip("Samsetning og pökkun 🪛📦"), "Samsetning og pökkun");
  assert.strictEqual(B.strip("Ísak 🐻‍❄️"), "Ísak");
  assert.strictEqual(B.strip("Eigandi 👨🏻‍💼"), "Eigandi");
  assert.strictEqual(B.strip("← → ↕ © 12×34 – x"), "← → ↕ © 12×34 – x");
  assert.strictEqual(B.strip(null), "");
});

test("BJICON: every mapped emoji points at an existing icon and icons are valid line svg", () => {
  const B = load();
  for (const [k, v] of Object.entries(B.EMOJI)) if (v) assert.ok(B.paths[v], "missing icon " + v + " for " + k);
  const svg = B("saw");
  assert.match(svg, /^<svg class="bji" viewBox="0 0 24 24"/);
  assert.match(svg, /stroke-width="1.5"/);
  assert.strictEqual(B("nope"), "");
  assert.strictEqual(B.iconify("⚠️ a 🪚 &amp; 🦁"), '<i data-ic="alert"></i> a <i data-ic="saw"></i> &amp; ');
});

for (const page of PAGES) {
  test("no UI emoji left in " + page + " (only allow-listed Airtable literals)", () => {
    let t = stripComments(fs.readFileSync(path.join(ROOT, page), "utf8"));
    for (const lit of ALLOW[page]) {
      assert.ok(fs.readFileSync(path.join(ROOT, page), "utf8").includes(lit), page + ": allow-listed literal no longer in file: " + lit.slice(0, 60));
      t = t.split(lit).join("");
    }
    const bad = t.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => EM.test(l)).map(([n, l]) => n + ": " + l.trim().slice(0, 100));
    assert.deepStrictEqual(bad, [], page + " still has emoji outside allow-listed literals");
  });
  test(page + " uses only known icon names and loads the icon script", () => {
    const B = load();
    const t = fs.readFileSync(path.join(ROOT, page), "utf8");
    const names = new Set([...t.matchAll(/data-ic=\\?["']?([A-Za-z]+)/g)].map((m) => m[1]));
    for (const n of names) assert.ok(B.paths[n], page + ": unknown icon " + n);
    if (page.endsWith(".html") && (names.size || /BJICON/.test(t))) assert.match(t, /bjorninn-icons\.js/, page + " must load bjorninn-icons.js");
  });
}
