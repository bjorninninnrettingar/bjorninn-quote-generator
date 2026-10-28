// Smíða wizard, phase 1 (docs/pro-smida-wizard.md): source-level guards for the rules that keep Keyra skipulag and the
// Vinnuteikningar untouched — Rakel's Mál confirmation (b.smidaAck) must never leak into Smíðagögn.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../kitchen-planner.html", import.meta.url), "utf8");
function fnBody(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " exists");
  const next = html.indexOf("\n  function ", start + 10);
  return html.slice(start, next);
}

test("smidaFor / smidaHash / proReady never read b.smidaAck (Smíðagögn stay identical)", () => {
  ["smidaFor", "smidaHash", "proReady", "proSetReady", "proIssues"].forEach((n) => {
    assert.ok(!/smidaAck/.test(fnBody(n)), n + " must not depend on smidaAck");
  });
});

test("a copied cabinet does not inherit the confirmed Mál", () => {
  assert.ok(/delete copy\.smidaAck/.test(html));
});

test("the ack is a per-dimension record of mm — a drawing change makes it differ", () => {
  const body = fnBody("smAckOk");
  assert.ok(/smidaAck\.mal\[k\] === mm/.test(body), "compares the confirmed mm to the current one");
});

test("Smíða is the Ný eining wizard (uw*) on the real block, never a parallel panel", () => {
  assert.ok(!/id="proWiz"/.test(html));
  assert.ok(/uw\.b = fb\.block/.test(fnBody("openSmidaWizard")), "edits the cabinet in the room, not a copy");
  assert.ok(!/refreshAfterEdit\(/.test(fnBody("smCommit")), "the room scene must not be rebuilt over the preview");
});

test("the wizard only opens in PRO (or a test scene) and the old editor stays reachable", () => {
  assert.ok(/if \(!PRO && !SCENE\) return;/.test(fnBody("openSmidaWizard")));
  assert.ok(/data-sm-editor/.test(html) && /openBoxEditor\(id\)/.test(fnBody("smOldEditor")));
});

test("no function name is declared twice in the planner script (a later one silently shadows the earlier — crossBounds broke growBlock)", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const big = scripts.sort((a, b) => b.length - a.length)[0];
  const seen = {};
  const dup = [];
  for (const m of big.matchAll(/^  function ([A-Za-z0-9_$]+)\(/gm)) {
    if (seen[m[1]]) dup.push(m[1]);
    seen[m[1]] = true;
  }
  assert.deepEqual(dup, []);
});

test("Staðsetning / Vélbúnaður: every item is acked on its own, and legacy helpers can't rebuild the room over the preview", () => {
  const body = fnBody("smItemAckOk");
  assert.ok(/smidaAck\[grp\]\[it\.id\] === it\.val/.test(body), "an item's ack is the value it was confirmed at");
  const refresh = fnBody("refreshAfterEdit");
  assert.ok(/uw && uw\.smida\) return/.test(refresh), "refreshAfterEdit is a no-op while Smíða's preview is the 3D scene");
  ["smidaFor", "smidaHash", "proIssues"].forEach((n) => assert.ok(!/smidaAck/.test(fnBody(n))));
});
