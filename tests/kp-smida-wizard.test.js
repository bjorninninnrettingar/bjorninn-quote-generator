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
  const body = fnBody("pwAckOk");
  assert.ok(/smidaAck\.mal\[k\] === mm/.test(body), "compares the confirmed mm to the current one");
});

test("the wizard only opens in PRO (or a test scene) and the old editor stays reachable", () => {
  assert.ok(/if \(!PRO && !SCENE\) return;/.test(fnBody("openSmidaWizard")));
  assert.ok(/data-pw="editor"/.test(html) && /openBoxEditor\(pw\.id\)/.test(html));
});
