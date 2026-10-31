// Áfella round 1 (docs/spec-afella-2026-10-30.md): width from the gap or typed mm, the AF key, the Line Item, the three key regexes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
globalThis.window = globalThis;
globalThis.location = globalThis.location || { search: "" };
await import("../kitchen-planner-3d.js");
const K = globalThis.KP3D;
const html = fs.readFileSync(new URL("../kitchen-planner.html", import.meta.url), "utf8");
function fnBody(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " exists");
  return html.slice(start, html.indexOf("\n  function ", start + 10));
}

// a closed 4-wall room, wall 1 holds one 600 mm base unit `gap` mm from its start
const room = (gap, afella) => {
  const walls = [0, 1, 2, 3].map((i) => ({ id: "W" + (i + 1), label: "Veggur " + (i + 1), lengthMm: 4000, turnAfter: "left", floor: [], wall: [] }));
  walls[0].floor = [{ id: "b1", type: "grunnskapur", widthMm: 600, gapMm: gap }];
  if (afella) walls[0].afella = afella;
  return { closed: true, roomHeightMm: 2600, walls };
};
const ends = (st, zone = "floor") => K.afellaEndsOf(K.surfacesOf(st), 0, zone);

test("afellaMm: no wall.afella = 19 mm as before (old drafts); typed mm replaces it; junk and out-of-range fall back to 19", () => {
  const st = room(19);
  assert.deepEqual(K.afellaMm(K.surfacesOf(st), 0, "floor"), { start: 19, end: 19 });
  st.walls[0].afella = { start: { mm: 60 } };
  assert.deepEqual(K.afellaMm(K.surfacesOf(st), 0, "floor"), { start: 60, end: 19 });
  for (const bad of [5, 18, 301, "x", null, 1e9]) {
    st.walls[0].afella = { start: { mm: bad }, end: { mm: bad } };
    assert.deepEqual(K.afellaMm(K.surfacesOf(st), 0, "floor"), { start: 19, end: 19 }, String(bad));
  }
});

test("afellaEndsOf: the width is the real gap (19 minimum); a flush old draft and an end panel get none; over 300 mm is a gap, not an áfella", () => {
  assert.deepEqual(ends(room(19)).map((e) => [e.side, e.mm]), [["start", 19]]);
  assert.deepEqual(ends(room(45)).map((e) => [e.side, e.mm]), [["start", 45]]); // automatic from the gap
  assert.equal(ends(room(0)).length, 0); // an old draft flush to the wall keeps its place, no filler
  assert.equal(ends(room(10)).length, 0);
  assert.equal(ends(room(301)).length, 0);
  assert.equal(ends(room(300)).length, 1);
  const st = room(19); st.walls[0].floor[0].type = "uthlid"; // an úthlið at the wall already closes it
  assert.equal(ends(st).length, 0);
  // typed 60 and the cabinet stands 60 from the wall: 60 mm; the other end (cabinet at 3400, wall 4000) is a 600 mm gap: none
  assert.deepEqual(ends(room(60, { start: { mm: 60 } })).map((e) => [e.side, e.mm]), [["start", 60]]);
  // not solid ends: a straight joint / open edge has no wall face
  const open = room(19); open.walls[3].open = true; open.walls[0].turnAfter = "left";
  assert.ok(ends(open).every((e) => e.side !== "end"));
});

test("typed mm moves the reserved limit: a cabinet nearer than the typed mm is not an áfella end (placement keeps the room free)", () => {
  const st = room(19, { start: { mm: 60 } }); // typed 60, the cabinet is still at 19 → not at the limit
  assert.equal(ends(st).length, 0);
  assert.equal(K.afellaMm(K.surfacesOf(st), 0, "floor").start, 60);
});

test("fitWarnings: an áfella wall gap only gets a word above 100 mm", () => {
  const msgs = (gap) => K.fitWarnings(room(gap), { pro: true }).map((x) => x.msg).filter((m) => /vegg/.test(m) && /Áfella/.test(m));
  assert.equal(msgs(100).length, 0);
  assert.equal(msgs(60).length, 0);
  assert.equal(msgs(150).length, 1);
  assert.equal(msgs(350).length, 0);
});

test("AF keys: AF is accepted by kp-submit, kp-pro and kp-price (the T-248 bug: a rejected key failed every call)", async () => {
  const { validateLineItems } = await import("../api/kp-submit.js");
  const pro = await import("../api/kp-pro.js");
  const price = await import("../api/kp-price.js");
  const A = "recAAAAAAAAAAAAAA", sm = '{"v":1,"w":60,"h":720,"d":19}';
  assert.equal(validateLineItems([{ "🔑": "AF1", Magn: 1, "Vöru reitur 1": [A], "Smíðagögn (JSON) 🔧": sm }]), null);
  assert.equal(validateLineItems([{ "🔑": "AF12" }, { "🔑": "UH1" }, { "🔑": "Sk1" }]), null);
  assert.ok(validateLineItems([{ "🔑": "AF1234" }]));
  assert.ok(validateLineItems([{ "🔑": "AF" }]));
  assert.ok(validateLineItems([{ "🔑": "XF1" }]));
  assert.equal(pro.validate({ recordId: "recBBBBBBBBBBBBBB", state: { walls: [] }, smida: { AF1: JSON.parse(sm) }, lineItems: [{ "🔑": "AF1" }, { "🔑": "Sk1" }] }), null);
  assert.equal(price.validate({ recordId: A, lines: [{ key: "AF1", v1: [A] }, { key: "Sk2" }] }), null);
  assert.ok(price.validate({ recordId: A, lines: [{ key: "AF1234" }] }));
});

test("afKeyOf: numbers are handed out once, per room, and never reused (even after an áfella is gone)", () => {
  const src = html.slice(html.indexOf("function afKeyOf("), html.indexOf("\n  function afellaWhere("));
  const ctx = { state: { activeCategory: "eldhus" }, SK_CAT: null };
  vm.runInNewContext(src + ";this.afKeyOf=afKeyOf;", ctx);
  const a = ctx.afKeyOf("v:W1:start"), b = ctx.afKeyOf("v:W2:end");
  assert.deepEqual([a, b], ["AF1", "AF2"]);
  assert.equal(ctx.afKeyOf("v:W1:start"), "AF1"); // stable
  ctx.state.activeCategory = "bad";
  assert.equal(ctx.afKeyOf("v:W1:start"), "AF3"); // same wall id in another room is another áfella
  delete ctx.state.afKeys["eldhus|v:W2:end"]; // (a removed entry never happens, but the max rule keeps numbers apart anyway)
  assert.equal(ctx.afKeyOf("v:W9:start"), "AF4");
});

test("Line Item: one AF line per áfella, Magn 1, V1 = the Útfærsla, Smíðagögn {v:1,w,h,d:19}; no line while the id is the placeholder", () => {
  const f = fnBody("afLines");
  assert.ok(/if \(!afellaLive\(\) || /.test(f), "gated on a real record id");
  assert.ok(/"Magn":1/.test(f) && /"Vöru reitur 1":\[AFELLA_UTFAERSLA_ID\]/.test(f));
  assert.ok(/JSON\.stringify\(\{ v:1, w:e\.mm, h:proBodyMm\(e\.b, c, e\.zone\), d:19 \}\)/.test(f), "same shape as an úthlið's Smíðagögn");
  assert.ok(/afKeyOf\(afellaId\(wall, e\)\)/.test(f));
  assert.ok(/AFELLA_PLACEHOLDER = "PLACEHOLDER_AFELLA_UTFAERSLA_ID"/.test(html));
  assert.ok(/\^rec\[A-Za-z0-9\]\{14\}\$/.test(fnBody("afellaLive")));
  // wired into the Line Items and the Smíðagögn map (else Vista flags the line 'removed')
  assert.ok(/afLines\(\)\.forEach\(function\(li\)\{ rows\.push\(li\); \}\)/.test(fnBody("collectLineItems")));
  assert.ok(/afLines\(\)\.forEach\(function\(li\)\{ out\[li\["🔑"\]\] = JSON\.parse/.test(fnBody("proSmidaAll")));
  const src = fnBody("afellaWhere").split("\n  //")[0] + "\n;this.w=afellaWhere;";
  const ctx = {}; vm.runInNewContext(src, ctx);
  assert.equal(ctx.w({ label: "Veggur 1" }, { side: "start", zone: "floor", mm: 19 }), "Áfella við Vegg 1, vinstri (19 mm)");
  assert.equal(ctx.w({ label: "Veggur 2" }, { side: "end", zone: "wall", mm: 60 }), "Áfella við Vegg 2, hægri (efri skápar) (60 mm)");
});

test("the linemap carries the Áfella Útfærsla id as a plain string (never an id object)", () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../kitchen-planner-linemap.js", import.meta.url), "utf8"), ctx);
  const id = ctx.window.KP_LINEMAP.afellaId;
  assert.equal(id, "recKiurbbZTkXpzmp"); // the real Útfærsla "Áfella" (AF)
  assert.match(id, /^rec[A-Za-z0-9]{14}$/);
});

test("Smíða ack / Klár hash: smidaFor and smidaHash never read the áfella (typed mm moves cabinets, not what is built)", () => {
  for (const n of ["smidaFor", "smidaHash", "proReady", "proSetReady"]) assert.ok(!/afella|afKeys|afLines|wall\.afella/i.test(fnBody(n)), n);
  assert.ok(!/afKeys/.test(fnBody("proStateSig")) || /delete o\.afKeys/.test(fnBody("proStateSig")), "AF numbers are not an edit");
});

test("missingEndPanels: an áfella (any width) at a wall end closes it — no úthlið is offered beside it; the workdraw uses the real width", () => {
  assert.ok(/hasAf\(dir < 0 \? "start" : "end", me\.b\)/.test(fnBody("missingEndPanels")));
  assert.ok(/KP3D\.afellaEndsOf\(surfs, wi, "floor"\)\.map/.test(html));
  assert.ok(!/afs\.push\(\{ x:0, w:af\.start/.test(html), "the 19 mm-only push is gone");
});

test("typed mm: Enter confirms; nothing changes (and it says so) when it does not fit; PRO only", () => {
  const f = fnBody("setAfellaMm");
  assert.ok(/"Það vantar " \+ Math\.ceil\(short\)/.test(f) && !/undo\(\)/.test(f), "no undo: moves as far as it goes and warns");
  assert.ok(/mm < 19 \|\| mm > MAXA/.test(f));
  assert.ok(/ev\.key === "Enter"/.test(fnBody("wireAfellaFields")));
  assert.ok(/var f = PRO \? findBlock/.test(fnBody("afellaEndsOfBlock")), "Studio shows no field");
});

test("Studio submit stays byte-identical: AF lines only from PRO unless AFELLA_LINES_IN_STUDIO_SUBMIT is flipped", () => {
  assert.match(html, /var AFELLA_LINES_IN_STUDIO_SUBMIT = false;/);
  assert.match(fnBody("afLines"), /if \(!afellaLive\(\) \|\| \(!PRO && !AFELLA_LINES_IN_STUDIO_SUBMIT\)\) return \[\];/);
});

test("lifting a cabinet also lifts the unbound end panel standing against it (owner, 2026-10-31); a panel shared with a neighbour stays", () => {
  const f = fnBody("looseEndPanelsOf");
  assert.ok(/CATALOG\[x\.b\.type\]\.panel/.test(f) && /far/.test(f));
  const d = fnBody("on3DDragStart");
  assert.ok(/looseEndPanelsOf\(blockId\)/.test(d));
});

test("áfella moves the whole run (only the first gap of each row changes) and PRO asks about missing áfellur at the end", () => {
  const f = fnBody("setAfellaMm");
  assert.ok(/rows\.forEach/.test(f) && /r\.list\[0\]\.gapMm/.test(f));
  assert.ok(/missingAfellur\(\)/.test(fnBody("proNextAction")));
  assert.ok(/Það vantar áfellur á/.test(fnBody("checkAfellurThen")));
});
