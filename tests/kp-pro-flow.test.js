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

test("(b) one flow: Áfram in PRO's Ný eining goes on into Smíða in the same modal, never leaving it", () => {
  const add = html.slice(html.indexOf('var add = side.querySelector("[data-uw-add]")'));
  const tail = add.slice(0, add.indexOf("leaveUnitWizard();\n      refreshAfterEdit();"));
  assert.ok(/if \(PRO\)\{ smEnterNew\(/.test(tail), "PRO branches into the Smíða mode before the customer's leave/refresh");
  assert.ok(!/openSmidaWizard\(b\.id\)/.test(add.slice(0, 6000)), "no second modal is opened after placement");
  const body = fnBody("smEnterNew");
  assert.ok(!/leaveUnitWizard|closeUnitWizard|refreshAfterEdit/.test(body), "the modal stays; the room is rebuilt when it closes");
});

test("(b) the flow code paths never touch Smíðagögn: only a freshly placed cabinet gets an ack (its own picked width), Klár state is untouched", () => {
  ["smSetOn", "smEnterNew", "smUndoNew", "smUndoOk"].forEach((n) => {
    assert.ok(!/smidaReady\s*=|delete [a-z.]*smidaReady|smidaHash|smidaFor|proSetReady/.test(fnBody(n)), n + " must not touch the ready hash / Smíðagögn");
  });
  assert.ok(/pre\.picked && o\.pre\.picked\.w/.test(fnBody("smEnterNew")), "the width ack only carries over a width she picked herself");
  assert.ok(/smUndoOk\(\)/.test(html) && /!b\.smidaReady/.test(fnBody("smUndoOk")), "Til baka never removes a cabinet that is confirmed or Klár");
  assert.ok(/JSON\.stringify\(b\.smidaAck \|\| null\) === n\.ack0/.test(fnBody("smUndoOk")), "…or one with anything confirmed beyond the carried width");
});

test("(b) every entry (panel button, /smida Laga í PRO, new unit) lands in the same wizard, on the first unconfirmed section", () => {
  assert.ok(/smSetOn\(fb\); renderUnitWizard\(\)/.test(fnBody("openSmidaWizard")));
  assert.ok(/smFirstSec\(b, c\)/.test(html.slice(html.indexOf("uw.sec = uw.smida ? smFirstSec"), html.indexOf("uw.sec = uw.smida ? smFirstSec") + 80)));
  assert.ok(/smFirstSec/.test(fnBody("smEnterNew")));
});
