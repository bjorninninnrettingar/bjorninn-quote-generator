// kitchen-planner-doors.js — Innihurðir (2026-10-26): the steps per kind, and every door's choices reaching Airtable
// through api/kp-submit.js (fake `at`, never the live API).
import { test } from "node:test";
import assert from "node:assert/strict";
import { submit, makeAirtable } from "../api/kp-submit.js";
import { fakeFetch } from "./helpers.js";
await import("../kitchen-planner-doors.js");
const D = globalThis.KPDOORS;

const door = (o) => Object.assign({ kind: "hurd", frame: "innf", opt: {}, widthMm: 800, heightMm: 2100, wallMm: 100, hinge: "left", qty: 1, room: "Hjónah.", hu: "HU1", designed: true }, o);

test("each kind has its own steps, in the user's order", () => {
  assert.deepEqual(D.sections(door()), ["gerd", "mal", "opnun", "efni", "lamir", "throskuldur", "skra"]);
  assert.deepEqual(D.sections(door({ kind: "gler" })), ["gerd", "mal", "opnun", "lamir", "throskuldur", "skra"]);
  assert.deepEqual(D.sections(door({ kind: "renni" })), ["gerd", "mal", "opnun", "efni", "braut"]);
  assert.deepEqual(D.sections(door({ kind: "eld" })), ["gerd", "mal", "opnun", "efni", "flokkur", "skra"]);
  assert.deepEqual(D.sections(door({ kind: "karmur" })), ["gerd", "mal", "karmur"]);
});

test("setKind: the two main cards are both a hinged door (innfelld / með gereftum); special kinds stay reachable", () => {
  const d = door({ opt: { lamir: "samloku" }, leaf: "sp00", hunar: "ja" });
  D.setKind(d, "gerefti");
  assert.equal(d.kind, "hurd"); assert.equal(d.frame, "gerefti"); assert.equal(d.opt.lamir, "samloku"); // kept
  D.setKind(d, "glerrenni");
  assert.equal(d.kind, "glerrenni"); assert.equal(d.frame, undefined); assert.equal(d.leaf, undefined); assert.equal(d.hunar, undefined);
  assert.equal(d.opt.braut, "loft");
  assert.deepEqual(D.KINDS.map((k) => k.key), ["innf", "gerefti", "gler", "renni", "glerrenni", "eld", "karmur"]);
});

test("rooms: the short list maps to Rými choices; 'Annað' keeps the typed name in the note, never a new Rými", () => {
  assert.equal(D.roomLabelOf(door({ room: "Hjónah." })), "Hjónaherbergi");
  const o = door({ room: D.OTHER, roomOther: "Geymsla" });
  assert.ok(D.roomOk(o)); assert.ok(!D.roomOk(door({ room: D.OTHER, roomOther: " " })));
  const li = D.lineFor(o, { pid: "recDOOR0000000001" });
  assert.equal(li["Rými 🏡"], "Alrými");
  assert.match(li["Skilaboð til skipulags"], /\(Geymsla\)/);
});

test("every choice is in the Line Item: note + Smíðagögn", () => {
  const d = door({ frame: "gerefti", opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" }, hinge: "right", widthMm: 825, wallMm: 120, hwColor: "svart", hunar: "ja", leaf: "eg_H3406" });
  const li = D.lineFor(d, { pid: "recDOOR0000000001", mat: { label: "Anthracite Mountain Larch", efnislistiId: "recMAT0000000001" } });
  const msg = li["Skilaboð til skipulags"];
  for (const s of ["hurð með gereftum", "op 825 mm × 2100 mm", "veggþykkt 120 mm", "lamir hægra megin", "Karmur með gereftum", "Lamir: samlokulamir",
    "Felliþröskuldur.", "Skrá: segulskrá", "Litur á járnum (lamir, skrá, slútt): svart", "harðplast Egger Anthracite Mountain Larch"]) assert.ok(msg.includes(s), s + " — " + msg);
  const sg = JSON.parse(li["Smíðagögn (JSON) 🔧"]);
  assert.equal(sg.v, 1); assert.equal(sg.w, 825); assert.equal(sg.d, 120);
  assert.deepEqual(sg.door.opt, { lamir: "samloku", throskuldur: "ja", skra: "segul" });
  assert.equal(sg.door.frame, "gerefti"); assert.equal(sg.door.hwColor, "svart"); assert.equal(sg.door.hunar, undefined); assert.ok(!/Húnn|húna/.test(msg), "no handle question any more"); assert.equal(sg.door.din, "right");
  assert.deepEqual(sg.door.leaf, { look: "eg_H3406", label: "Anthracite Mountain Larch", efnislistiId: "recMAT0000000001", type: "hardplast" });
  // a sliding door: no hinges, no handle question
  const r = JSON.parse(D.lineFor(door({ kind: "renni", opt: { braut: "vegg" }, hu: "HU2" }), { pid: "recDOOR0000000002" })["Smíðagögn (JSON) 🔧"]);
  assert.equal(r.door.swing, "slide"); assert.equal(r.door.din, undefined); assert.equal(r.door.hwColor, undefined); assert.deepEqual(r.door.opt, { braut: "vegg" });
});

test("kp-submit receives every door with all its choices", async () => {
  const doors = [
    door({ hu: "HU1", frame: "gerefti", opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" }, hunar: "ja" }),
    door({ hu: "HU2", kind: "renni", frame: undefined, opt: { braut: "magic" }, room: D.OTHER, roomOther: "Geymsla", widthMm: 1200 }),
    door({ hu: "HU3", kind: "gler", frame: undefined, opt: { lamir: "innfelldar", throskuldur: "nei" }, room: "Baðh." }),
  ];
  const lines = doors.map((d, i) => D.lineFor(d, { pid: "recDOOR000000000" + (i + 1) }));
  const b = { sid: "11111111-2222-3333-4444-555555555555", contact: { fornafn: "Anna", eftirnafn: "Jóns", netfang: "anna@example.is", simi: "5551234" },
    project: { "Skilaboð til skipulags": "note" }, state: { step: "contact", walls: [], doorList: doors }, lineItems: lines };
  const f = fakeFetch((c) => {
    if (c.method === "POST" && c.url.endsWith("tblQ8zeUanriESWvL")) return { status: 200, body: { id: "recCONTACT0000000" } };
    if (c.method === "POST" && c.url.endsWith("tbl4LMXlQjp66RFKI")) return { status: 200, body: { id: "recOPP00000000000", fields: {} } };
    if (c.method === "POST") return { status: 200, body: { records: c.body.records.map((_, i) => ({ id: "recLINE" + i })) } };
  });
  await submit(makeAirtable("t", { fetchImpl: f, delays: [0, 0, 0, 0, 0] }), b);
  const sent = f.calls.filter((c) => c.method === "POST" && c.url.endsWith("tblFcsUoGxsuUwNEH")).flatMap((c) => c.body.records.map((r) => r.fields));
  assert.deepEqual(sent.map((x) => x["🔑"]), ["HU1", "HU2", "HU3"]);
  assert.deepEqual(sent.map((x) => x["Rými 🏡"]), ["Hjónah.", "Alrými", "Baðh."]);
  assert.deepEqual(sent.map((x) => x["Vöru reitur 1"]), [["recDOOR0000000001"], ["recDOOR0000000002"], ["recDOOR0000000003"]]);
  sent.forEach((x, i) => {
    assert.equal(x["Skilaboð til skipulags"], lines[i]["Skilaboð til skipulags"]);
    assert.deepEqual(JSON.parse(x["Smíðagögn (JSON) 🔧"]).door.opt, JSON.parse(lines[i]["Smíðagögn (JSON) 🔧"]).door.opt);
  });
  assert.match(sent[1]["Skilaboð til skipulags"], /Brautin: falin braut/);
  assert.match(sent[2]["Skilaboð til skipulags"], /Litur á járnum \(lamir, skrá, slútt\): króm/); // default colour
});

test("hardware: one function per item, the door's choices pick them", () => {
  for (const k of ["hinge_hidden", "hinge_visible", "threshold_drop", "lock_standard", "lock_magnetic", "handle_lever", "track_wall", "track_ceiling", "track_hidden"]) assert.equal(typeof D.HW[k], "function", k);
  assert.deepEqual(D.hardwareOf(door({ opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" } })).leaf, ["hinge_visible", "threshold_drop", "lock_magnetic", "handle_lever"]);
  assert.deepEqual(D.hardwareOf(door({ kind: "renni", opt: { braut: "loft" } })).fixed, ["track_ceiling"]);
  assert.deepEqual(D.hardwareOf(door({ kind: "karmur" })), { leaf: [], fixed: [] });
});

test("round 8: the drop seal is two parts — a fixed housing and a carrier named seal that drops; no GLB any more", () => {
  assert.deepEqual(D.hardwareOf(door({ opt: { lamir: "samloku", skra: "jnf" } })).leaf, ["hinge_visible", "threshold_drop", "lock_standard", "handle_lever"]); // round 9: felliþröskuldur is the default
  assert.deepEqual(D.hardwareOf(door({ opt: { lamir: "samloku", throskuldur: "nei", skra: "jnf" } })).leaf, ["hinge_visible", "lock_standard", "handle_lever"]); // an old door that said "nei" keeps it
  assert.deepEqual(D.hardwareOf(door({ kind: "gler", opt: { lamir: "samloku", throskuldur: "nei" } })).leaf, ["hinge_visible", "handle_lever"]); // no mortise lock in glass
  assert.equal(D.KIND_OPTS.hurd.throskuldur[0], "ja");
  assert.ok(D.hardwareOf(door({ opt: { throskuldur: "ja" } })).leaf.includes("threshold_drop"));
});

// PRO (2026-10-26): the old "Innihurðir" overlay stored door rows without designed / frame (and with every room the
// old Rými dropdown had). The customer HU list + Hanna popup now opens them — they must come out exactly the same.
const OLD_PRO_ROWS = [ // what openDoorList (removed 2026-10-26) wrote: DOOR_DEFAULT + the row's own edits
  { id: "DLm1", hu: "HU1", kind: "hurd", opt: { lamir: "innfelldar", throskuldur: "nei", skra: "jnf" }, widthMm: 830, heightMm: 2080, wallMm: 125, swing: "in", hinge: "right", qty: 2, room: "Baðh.", leaf: "eg_H3406", note: "inn á bað, 10 mm hærri karmur" },
  { id: "DLm2", hu: "HU2", kind: "gler", opt: { lamir: "samloku", throskuldur: "ja" }, widthMm: 450, heightMm: 3150, wallMm: 100, swing: "in", hinge: "left", qty: 1, room: "Eldhús" },
  { id: "DLm3", hu: "HU3", kind: "karmur", opt: { karmur: "gerefti" }, widthMm: 900, heightMm: 2100, wallMm: 90, swing: "in", hinge: "left", qty: 1, room: "Geymsla" },
  { id: "DLm4", hu: "HU4", kind: "eld", opt: { flokkur: "ei60", skra: "segul" }, widthMm: 1000, heightMm: 2100, wallMm: 200, hinge: "left", qty: 1, room: "" },
];
const ctxFor = (d) => ({ pid: "recDOOR0000000009", mat: d.leaf ? { label: "Anthracite Mountain Larch", efnislistiId: "recMAT0000000001" } : null });

test("migration: an old PRO door row opens in the new UI as a finished door and sends the same HU line", () => {
  for (const old of OLD_PRO_ROWS) {
    const before = D.lineFor(JSON.parse(JSON.stringify(old)), ctxFor(old));
    const m = D.migrate(JSON.parse(JSON.stringify(old)));
    assert.equal(m.designed, true, old.hu + " counts as designed");
    for (const k of Object.keys(old)) assert.deepEqual(m[k], old[k], old.hu + " keeps " + k); // nothing changed, only filled
    if (old.kind === "hurd") assert.equal(m.frame, "innf");
    assert.deepEqual(D.lineFor(m, ctxFor(m)), before, old.hu + " line identical");
    assert.deepEqual(D.migrate(JSON.parse(JSON.stringify(m))), m, "idempotent");
    // every stored size is inside PRO's mm ranges (the old overlay's own), so Mál opens valid
    for (const k of ["widthMm", "heightMm", "wallMm"]) assert.ok(old[k] >= D.LIMITS_PRO[k][0] && old[k] <= D.LIMITS_PRO[k][1], old.hu + " " + k);
    assert.equal(D.cncOf(m), null, "no CNC block until PRO saves the door");
  }
  // every old field has a place in the new steps (Gerð, Mál, Opnun, Útlit, Lamir, Felliþröskuldur, Skrá + PRO Smíða)
  assert.deepEqual(D.sections(D.migrate({ ...OLD_PRO_ROWS[0] })), ["gerd", "mal", "opnun", "efni", "lamir", "throskuldur", "skra"]);
  assert.equal(D.optValue(OLD_PRO_ROWS[1], "lamir"), "samloku");
  assert.equal(D.PRO_HW.lamir.samloku, "JNF IN.05.020.100 · sýnilegar (samlokulamir)");
  assert.equal(D.PRO_HW.skra.jnf, "JNF IN.20.835");
  assert.equal(D.PRO_HW.skra.segul, "JNF segulskrá IN.20.976.60.B");
  const n = D.lineFor(D.migrate({ ...OLD_PRO_ROWS[0] }), ctxFor(OLD_PRO_ROWS[0]))["Skilaboð til skipulags"];
  for (const s of ["op 830 mm × 2080 mm", "veggþykkt 125 mm", "lamir hægra megin", "2 eins hurðir", "inn á bað, 10 mm hærri karmur", "Anthracite Mountain Larch"]) assert.ok(n.includes(s), s);
});

test("PRO Smíða: the karmur + exact hardware go in Smíðagögn door.cnc (what /cnc reads)", async () => {
  await import("../cnc-doors.js");
  const CD = globalThis.CNCDOORS;
  // the automatic picks are hardware /cnc has a confirmed macro pair for
  for (const [k, map] of [["hinge", CD.HINGES], ["threshold", CD.THRESHOLDS]]) for (const ids of Object.values(D.CNC_AUTO[k])) for (const id of Object.values(ids)) assert.ok(map[id], k + " " + id);
  const d = door({ opt: { lamir: "innfelldar", throskuldur: "ja", skra: "jnf" }, cnc: { ...D.CNC_DEFAULT } });
  assert.deepEqual(D.cncOf(d), { karmZ: 37, karmB: 6, topp: "Ofan á hliðum", hinge: "recoQeJKpvKLowWK3", threshold: "recRJ3d2MCFv4DDJi" }); // no lock is ever guessed
  const li = D.lineFor({ ...d, cnc: { karmZ: 40, karmB: 3, topp: "Á milli hliða", lock: "recgXxgK8jwfkFyhp", threshold: "none" } }, { pid: "recDOOR0000000001" });
  const c = JSON.parse(li["Smíðagögn (JSON) 🔧"]).door.cnc;
  assert.deepEqual(c, { karmZ: 40, karmB: 3, topp: "Á milli hliða", hinge: "recoQeJKpvKLowWK3", lock: "recgXxgK8jwfkFyhp" });
  assert.match(li["Skilaboð til skipulags"], /Karmur: þykkt karms 40 mm, karmabil frá vegg 3 mm, toppstykki á milli hliða\./);
  // visible hinges (IN.05.020.100) have no confirmed macro → nothing automatic, /cnc stops the door rather than guess
  assert.equal((D.cncOf(door({ opt: { lamir: "samloku" }, cnc: { karmZ: 37 } })) || {}).hinge, undefined);
  // and the drawing's door feeds /cnc's plan: every empty Eyðublað field filled from it, flagged ⚠
  const sg = JSON.parse(li["Smíðagögn (JSON) 🔧"]);
  const p = CD.doorPlan({ "Athugasemd": "HU1", "Opnun [Hurð]": "Hægri 👉" }, {}, sg);
  assert.equal(p.status, "check");
  assert.equal(p.values.KARMAR_Z, 40); assert.equal(p.values.KARMAR_B, 100); assert.equal(p.topp, "Á milli hliða");
  assert.equal(p.values.HURD_H, 2100 - 10 - 3 - 3 - 40); assert.equal(p.values.HURD_B, 800 - 6 - 80 - 6);
  assert.deepEqual(p.on.leaf, ["COPLAN", "IN_20_835_60_BA"]);
  assert.match(p.check.join(" "), /Úr PRO-teikningunni \(autt á Eyðublaði\): hæð 2100, breidd 800, dýpt 100, þykkt karms 40, karmabil 3, toppstykki á milli hliða, lamir JNF Coplan/);
});
