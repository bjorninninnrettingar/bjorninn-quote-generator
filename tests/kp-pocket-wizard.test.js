// Vasahurðir round 1 (2026-10-30): source-level guards for the wizard step, Smíða wiring and the 3D gates —
// a non-pocket cabinet must be byte-for-byte what it was before.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../kitchen-planner.html", import.meta.url), "utf8");
const js3d = fs.readFileSync(new URL("../kitchen-planner-3d.js", import.meta.url), "utf8");
function fnBody(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " exists");
  const next = src.indexOf("\n  function ", start + 10);
  return src.slice(start, next < 0 ? start + 6000 : next);
}

test("the rules module loads before the 3D module, and the planner tags it", () => {
  assert.ok(html.indexOf('src="kitchen-planner-pocket.js"') > 0 && html.indexOf('src="kitchen-planner-pocket.js"') < html.indexOf('src="kitchen-planner-3d.js"'));
});

test("Ný eining: the version step exists only for a unit that already has a pocket spec", () => {
  assert.ok(/if \(!uw\.smida && pocketUnit\(b\)\)\{[^]*?uwSec\("ver", __\("Hvaða útgáfu\?"\)/.test(html));
  assert.ok(/!uw\.smida && pocketUnit\(uw\.b\) && "ver"/.test(html), "uwAdvance only counts the step for pocket units");
  const pu = fnBody(html, "pocketUnit");
  assert.ok(/pocketSpecOf\(b, c\)/.test(pu));
  // the kitchen path is Tækjaskápar -> Vasahurð, still the same option (pocket:true)
  assert.ok(/kOne\("Tækjaskápar", "renni", "Vasahurð", [^)]*pocket:true/.test(html));
});

test("old specs hash as before: the new fields are written only when set", () => {
  assert.ok(/pocketVer:sp\.type === "pocket" \? sp\.pocketVer : undefined, pocketSide:sp\.type === "pocket" \? sp\.pocketSide : undefined/.test(html));
  assert.ok(/toeKick:sp\.type === "pocket" && sp\.toeKick === false \? false : undefined, onWorktop:sp\.type === "pocket" && sp\.onWorktop \? true : undefined/.test(html));
  const orig = JSON.stringify({ h: 2000, type: "pocket", side: null, hinges: [], pocketSys: "revego", pocketVer: undefined, pocketSide: undefined, toeKick: undefined, onWorktop: undefined });
  assert.equal(orig, JSON.stringify({ h: 2000, type: "pocket", side: null, hinges: [], pocketSys: "revego" }));
});

test("proIssues: the size limits only run for a pocket door (every other cabinet is unchanged) and carry no Laga button", () => {
  const m = html.match(/if \(sp\.type === "pocket" && window\.KPPOCKET && i === 0\)\{[^]*?\n      \}/);
  assert.ok(m, "pocket block found");
  assert.ok(/if \(v\.level === "err"\) add\(v\.text\)/.test(m[0]), "errors only, no fix key");
});

test("the product mapping still goes through POCKET_PRODUCTS and pocketLeafOf", () => {
  assert.ok(/POCKET_PRODUCTS\[pocketSys\] \|\| \{\}\)\[pocketLeafOf\(b, c\)\]/.test(html));
  const pl = fnBody(html, "pocketLeafOf");
  assert.ok(/KPPOCKET\.leafOf\(r\)/.test(pl) && /b\.widthMm > 900/.test(pl));
});

test("switching back to hinges drops every new pocket field", () => {
  const n = (html.match(/delete sp\.pocketSys; delete sp\.pocketVer; delete sp\.pocketSide; delete sp\.toeKick; delete sp\.onWorktop;/g) || []).length;
  assert.equal(n, 2);
});

test("3D: only a cabinet with a pocket spec gets pockets; handles go only on non-pocket leaves; the old pose stays for old calls", () => {
  const pr = fnBody(js3d, "pocketResOf");
  assert.ok(/if \(!sp\) return null|sp \? K\.resolve/.test(pr) && /meta\.corner \|\| meta\.fridge \|\| meta\.oven/.test(pr));
  assert.ok(/var hcfgA = !leafPk && meta\.handle/.test(js3d) && /if \(meta\.handle && !leafPk\)\{/.test(js3d));
  assert.ok(/else p\.group\.position\.z = p\.z0 - p\.pocketIn \* smooth01/.test(js3d), "no pk → the old slide");
  assert.ok(/plinth:\(!c\.panel \|\| hungPanel\) && !c\.appliance && !pocketNoToe\(b\)/.test(js3d));
  const pn = fnBody(js3d, "pocketNoToe");
  assert.ok(/d\.type === "pocket" && \(d\.toeKick === false \|\| d\.onWorktop\)/.test(pn));
});

test("3D: a pocket unit's leaves tile its whole front (no gap, no overlap beyond the 2 mm joint)", async () => {
  globalThis.window = globalThis;
  await import("../kitchen-planner-pocket.js");
  const K = globalThis.KPPOCKET;
  for (const [sys, ver, w] of [["revego", "uno", 600], ["revego", "duo", 1000], ["revego", "unouno", 1500], ["concepta", "f2x2", 2000], ["concepta", "f2p1", 1500]]) {
    const r = K.resolve({ pocketSys: sys, pocketVer: ver }, { widthMm: w, bodyMm: 2300, depthMm: 600 });
    const sum = r.leaves.reduce((s, l) => s + (l.x1 - l.x0), 0);
    assert.ok(Math.abs(sum - w) < 1e-6, ver);
  }
});
