// PRO Smíða round 2 (owner feedback 2026-10-30, docs/pro-smida-wizard.md "Round 2"): source-level guards.
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

test("A: a confirmation can be taken back — only the ack key is removed, same shapes, and Klár is dropped", () => {
  const u = fnBody("smUnack");
  assert.ok(/delete a\.inn/.test(u) && /delete a\[grp\]\[id\]/.test(u), "removes the key under mal / inn / pos / hw");
  assert.ok(/proSetReadyQuiet\(x\.b, false\)/.test(u));
  assert.ok(!/smida\b[^A]/.test(u.replace(/smidaAck|smidaReady/g, "")), "never touches b.smida");
  const w = fnBody("smWire");
  assert.ok(/smUnack\("mal", k\)/.test(w) && /smUnack\("inn"\)/.test(w) && /smUnack\(f\.grp, f\.id\)/.test(w), "Rétt ✓ is a toggle for Mál, Innvols and every item");
});

test("A: the current value is IN the field (never empty + ghost), Enter confirms what the field shows", () => {
  assert.ok(/data-sm-in="' \+ d\.k \+ '" value="' \+ d\.mm \+ '"/.test(fnBody("smDimSecs")));
  assert.ok(/data-sm-pin="' \+ key \+ '" value="' \+ it\.mm \+ '"/.test(fnBody("smRowsHtml")));
  const w = fnBody("smWire");
  assert.ok(/e\.key === "Enter"\)\{ e\.preventDefault\(\); inp\.__sent = true; smCommit/.test(w));
  assert.ok(/e\.key === "Enter"\)\{ e\.preventDefault\(\); inp\.__sent = true; smItemDone/.test(w));
});

test("A: the chosen option is solid blue, never a dashed 'suggest'; Yfirlit rows use the dark panel tokens", () => {
  assert.ok(!/' suggest'/.test(fnBody("smRowsHtml")));
  assert.ok(/body\.pro \.uw-side \.sm-secs :is\(\.hw-btn\.active/.test(html));
  assert.ok(/\.uw-sm-missbtn\{[^}]*background:var\(--card/.test(html));
  assert.ok(/\.uw-sm-issues\{[^}]*var\(--danger-soft/.test(html));
});

test("A: Raðborun is unset (Af) for any cabinet that has not chosen it — the wizard shows Af as the chosen value, never writes it", () => {
  const body = fnBody("smItems");
  assert.ok(/ch\("rb", "Raðborun", rb \? "1" : "0"/.test(body));
});

test("B: in PRO/Smíða items drag through each other — only the zone limits them, the list is written sorted, a clash is flagged afterwards", () => {
  const mv = fnBody("smMoveThrough");
  assert.ok(/shelfSpaceMm/.test(mv) && !/itemCrossBounds|info\.lo|info\.hi/.test(mv), "bounded by the zone, not by neighbours");
  assert.ok(/info\.list\.sort\(function\(a, z\)\{ return a\.mm - z\.mm; \}\)/.test(mv), "ordering resolved: smidaFor/cnc-sides read the same sorted list");
  assert.ok(/if \(smThrough\(\)\) return smMoveThrough/.test(fnBody("onShelfPosMove")));
  assert.ok(/!!PRO \|\| !!\(uw && uw\.smida\)/.test(fnBody("smThrough")), "the customer's Studio wizard keeps its neighbour limits");
  assert.ok(/proClashes/.test(fnBody("smMissing")), "Yfirlit lists a clash");
  assert.ok(!/proClashes/.test(fnBody("proIssues")) && !/proClashes/.test(fnBody("proReady")), "proReady is untouched: a cabinet already Klár stays Klár");
  assert.ok(/return "sh" \+ list\.indexOf\(me\)/.test(fnBody("smItems")), "typing a shelf past another confirms the shelf, not its old slot");
});

test("C: Staðsetning shows one shelf per screen; one Rétt confirms exactly what the fields show; holes only for a Laus shelf", () => {
  const h = fnBody("smScreenHtml");
  assert.ok(/af ' \+ shelves/.test(h), "'Hilla 2 af 4'");
  assert.ok(/shp && shg \?/.test(h), "fjöldi gata + bil milli gata only exist for a Laus shelf (smItems adds shp/shg only when !fixed)");
  assert.ok(/data-sm-pin="pos:' \+ it\.id \+ '" value="' \+ it\.mm/.test(h), "fields hold the current value");
  const ok = fnBody("smScreenOk");
  assert.ok(/smAckItem\("pos", it\.id\)/.test(ok) && /delete a\.pos\[it\.id\]/.test(ok), "acks stay per item under smidaAck.pos; the same button takes them back");
  assert.ok(/!\/\^sh\\d\+\$\/\.test\(it\.id\)/.test(ok), "hole values are applied before the position (which may re-sort)");
  assert.ok(/smFocusAbs/.test(fnBody("uwAimCamera")) && /m\.cur/.test(fnBody("drawUwDims")), "camera lifts to the shelf, a blue band marks it");
  assert.ok(/pos:sh/.test(fnBody("smItems") + "pos:sh") && /grp === "pos"\) smPosAfter\(\)/.test(fnBody("smItemDone")));
});
