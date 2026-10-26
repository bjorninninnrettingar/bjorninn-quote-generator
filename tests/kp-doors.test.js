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
  const d = door({ frame: "gerefti", opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" }, hinge: "right", widthMm: 825, wallMm: 120, hunar: "ja", leaf: "eg_H3406" });
  const li = D.lineFor(d, { pid: "recDOOR0000000001", mat: { label: "Anthracite Mountain Larch", efnislistiId: "recMAT0000000001" } });
  const msg = li["Skilaboð til skipulags"];
  for (const s of ["hurð með gereftum", "op 825 mm × 2100 mm", "veggþykkt 120 mm", "lamir hægra megin", "Karmur með gereftum", "Lamir: sýnilegar lamir",
    "Felliþröskuldur: þétting sem fellur niður", "Skrá: hljóðlát skrá", "Húnn: söluaðili ráðleggur", "harðplast Egger Anthracite Mountain Larch"]) assert.ok(msg.includes(s), s + " — " + msg);
  const sg = JSON.parse(li["Smíðagögn (JSON) 🔧"]);
  assert.equal(sg.v, 1); assert.equal(sg.w, 825); assert.equal(sg.d, 120);
  assert.deepEqual(sg.door.opt, { lamir: "samloku", throskuldur: "ja", skra: "segul" });
  assert.equal(sg.door.frame, "gerefti"); assert.equal(sg.door.hunar, "ja"); assert.equal(sg.door.din, "right");
  assert.deepEqual(sg.door.leaf, { look: "eg_H3406", label: "Anthracite Mountain Larch", efnislistiId: "recMAT0000000001", type: "hardplast" });
  // a sliding door: no hinges, no handle question
  const r = JSON.parse(D.lineFor(door({ kind: "renni", opt: { braut: "vegg" }, hu: "HU2" }), { pid: "recDOOR0000000002" })["Smíðagögn (JSON) 🔧"]);
  assert.equal(r.door.swing, "slide"); assert.equal(r.door.din, undefined); assert.equal(r.door.hunar, undefined); assert.deepEqual(r.door.opt, { braut: "vegg" });
});

test("kp-submit receives every door with all its choices", async () => {
  const doors = [
    door({ hu: "HU1", frame: "gerefti", opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" }, hunar: "ja" }),
    door({ hu: "HU2", kind: "renni", frame: undefined, opt: { braut: "magic" }, room: D.OTHER, roomOther: "Geymsla", widthMm: 1200 }),
    door({ hu: "HU3", kind: "gler", frame: undefined, opt: { lamir: "innfelldar", throskuldur: "nei" }, room: "Baðh.", hunar: "nei" }),
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
  assert.match(sent[2]["Skilaboð til skipulags"], /Húnn: viðskiptavinur velur sjálf\/ur/);
});

test("hardware: one function per item, the door's choices pick them", () => {
  for (const k of ["hinge_hidden", "hinge_visible", "threshold_drop", "lock_standard", "lock_magnetic", "handle_lever", "track_wall", "track_ceiling", "track_hidden"]) assert.equal(typeof D.HW[k], "function", k);
  assert.deepEqual(D.hardwareOf(door({ opt: { lamir: "samloku", throskuldur: "ja", skra: "segul" } })).leaf, ["hinge_visible", "threshold_drop", "lock_magnetic", "handle_lever"]);
  assert.deepEqual(D.hardwareOf(door({ kind: "renni", opt: { braut: "loft" } })).fixed, ["track_ceiling"]);
  assert.deepEqual(D.hardwareOf(door({ kind: "karmur" })), { leaf: [], fixed: [] });
});

test("round 3: real hardware — the drop-seal GLB is in the repo, small, and a valid glTF 2 binary; the JNF parts are chosen by the options", async () => {
  const fs = await import("node:fs");
  const vm = await import("node:vm"), ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../kitchen-planner-models.js", import.meta.url), "utf8"), ctx);
  const e = ctx.window.KPMODELS.doorHardware.threshold_drop;
  const buf = fs.readFileSync(new URL("../" + e.file, import.meta.url));
  assert.ok(buf.length < 300 * 1024, "drop seal stays small: " + buf.length);
  assert.equal(buf.readUInt32LE(0), 0x46546C67); assert.equal(buf.readUInt32LE(4), 2);
  const gl = JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString());
  const pos = gl.accessors[gl.meshes[0].primitives[0].attributes.POSITION];
  assert.ok(Math.abs(pos.max[0] - pos.min[0] - e.lengthM) < 0.002, "length along x = lengthM");
  assert.deepEqual(D.hardwareOf(door({ opt: { lamir: "samloku", skra: "jnf" } })).leaf, ["hinge_visible", "lock_standard", "handle_lever"]);
  assert.deepEqual(D.hardwareOf(door({ kind: "gler", opt: { lamir: "samloku" } })).leaf, ["hinge_visible", "handle_lever"]); // no mortise lock in glass
});
