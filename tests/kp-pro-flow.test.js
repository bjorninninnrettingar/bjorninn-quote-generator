// PRO Smíða / Ný eining round 1 (docs/pro-smida-spec-2026-10-30.md): source-level guards.
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

test("(a) PRO Ný eining has Studio's options: closet cards, Skúffur eða hurðir for bath, camera aiming", () => {
  assert.ok(!/PRO/.test(fnBody("bathFrontsWiz")), "bath's picture step is not PRO-gated");
  assert.ok(!/PRO/.test(fnBody("uwLockView")), "the preview camera behaves the same in PRO");
  assert.ok(!/if \(PRO && !uw\.smida\) return;/.test(fnBody("uwAimCamera")), "uwAimCamera aims in PRO's Ný eining too");
  const r = fnBody("renderUnitWizard");
  assert.ok(/if \(isCloset\(\) && closetTall\(b\)\)\{/.test(r), "slide-door counts and the Tilbúnar lausnir / Stakir hlutir cards are not hidden from PRO");
  assert.ok(!/closetTall\(b\) && \(!PRO \|\| uw\.smida\)/.test(r));
});

test("(a) the customer's wizard keeps what it had: Studio-only things stay Studio-only", () => {
  const r = fnBody("renderUnitWizard");
  assert.ok(/machineOnly = isLaundry\(\) && !PRO/.test(r), "own machine stays customer-only");
  assert.ok(/!PRO && c\.zone === "floor" && c\.counter/.test(r), "'Toppurinn verður í … cm hæð' stays customer-only");
  assert.ok(/suggest/.test(r) && /Algengast/.test(r));
});
