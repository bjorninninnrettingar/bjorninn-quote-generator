// cnc-doors.js — door programs (karmur + hurðablað) from one door Eyðublað.
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../cnc-doors.js");
const C = globalThis.CNCDOORS;

// Trimmed copy of the shop's "karmur_lamir_M.bpp" structure (CRLF, sections, @ / ' / Rem lines).
const JAMB = [
  "[HEADER]", "TYPE=BPP", "", "[VARIABLES]",
  "PAN=LPX|HURD_H+HG_BIL+HK_BIL+KARMAR_Z||4|", "PAN=LPY|KARMAR_B||4|", "PAN=LPZ|KARMAR_Z||4|", 'PAN=ORLST|"1"||3|',
  "GLB=LOM_1|HG_BIL+HURD_H-LOM1|Too save data write it here|0|", "GLB=LOM_3|HG_BIL+LOM3|x|0|", "",
  "[PROGRAM]", "",
  `Rem ' BASIC_LOM_4, "", "", 1, "", 0 :`,
  `' COPLAN_KARM, "", "", 2, "", 0 : LOM_3`,
  `@ IN05020_KARMLOM_JNF, "", "", 3, "", 0 : LOM_1`,
  `@ GEOTEXT, "", "", 4, "", 0 : "P1080", 0, "2", HURD_H+HG_BIL, 100`,
  "", "[TOOLING]", "Name=HURD_H stays here", "",
].join("\r\n");

const DOOR = {
  "Athugasemd": "HU 4.1", "Hæð": 2403, "Breidd": 901, "Dýpt": 129, "Þykkt karms [Hurð]": 37, "Karmabil frá vegg [Hurð]": 3,
  "Toppstykki hurðakarms": "Á milli hliða", "Opnun [Hurð]": "Hægri 👉",
  "Lamir [Hurð]": ["recoQeJKpvKLowWK3"], "Skrá [Hurð]": ["recgXxgK8jwfkFyhp"], "Felliþr. [Hurð]": ["recRJ3d2MCFv4DDJi"],
};

test("door sizes follow ÚRVINNSLA and match the shop's own T-49 HU 4.1 leaf (2350)", () => {
  const p = C.doorPlan(DOOR);
  assert.equal(p.id, "HU4.1");
  assert.equal(p.values.HURD_H, 2350);
  assert.equal(p.values.HURD_B, 815);
  assert.equal(p.values.KARMAR_B, 129);
  assert.deepEqual(p.on.jambHinge, ["COPLAN_KARM"]);
  assert.deepEqual(p.on.leaf, ["COPLAN", "IN_20_835_60_BA", "FELLI_THROSKULDUR"]);
  assert.equal(p.status, "check"); // strike plate macro not confirmed yet
});

test("missing data stops the door, unknown lock only warns", () => {
  const stop = C.doorPlan({ ...DOOR, "Þykkt karms [Hurð]": null, "Lamir [Hurð]": [] });
  assert.equal(stop.status, "stop");
  assert.equal(stop.values, null);
  const lock = C.doorPlan({ ...DOOR, "Skrá [Hurð]": ["recUNKNOWNLOCK0001"] });
  assert.equal(lock.status, "check");
  assert.deepEqual(lock.on.jambStrike, []);
});

test("renderBpp: numbers in, managed macros switched, other sections untouched, values saved as GLB", () => {
  const p = C.doorPlan(DOOR);
  const r = C.renderBpp(JAMB, p.values, C.MANAGED.jambHinge, p.on.jambHinge);
  assert.deepEqual(r.errors, []);
  const L = r.text.split("\r\n");
  assert.ok(L.includes("PAN=LPX|2400||4|"));                     // 2350 + 10 + 3 + 37
  assert.ok(L.includes("GLB=LOM_1|10+2350-237|Too save data write it here|0|"));
  assert.ok(L.some((l) => l.startsWith("@ COPLAN_KARM,")));
  assert.ok(L.some((l) => l.startsWith("' IN05020_KARMLOM_JNF,")));
  assert.ok(L.some((l) => l.startsWith("Rem ' BASIC_LOM_4")));
  assert.ok(L.includes("Name=HURD_H stays here"));
  assert.ok(L.includes("GLB=HS_HURD_Z|38|Hurdaskra|0|"));
  assert.ok(!L.some((l) => /^GLB=HURD_[HBZ]\|/.test(l)));        // never redefine the machine's own names
  assert.ok(r.text.includes("\r\n") && !/[^\r]\n/.test(r.text));   // CRLF kept
  assert.deepEqual(C.readValues(r.text), p.values);               // the file is its own record
});

test("a macro the master doesn't have is an error, not a silent skip", () => {
  const p = C.doorPlan(DOOR);
  const r = C.renderBpp(JAMB, p.values, C.MANAGED.jambStrike, ["IN_20_835_60_BA_SLUTJARN"]);
  assert.ok(r.errors.some((e) => e.includes("IN_20_835_60_BA_SLUTJARN")));
});

test("diffValues names what changed after the jamb was made", () => {
  const a = C.doorPlan(DOOR).values;
  const b = { ...a, HURD_H: 2347 };
  assert.deepEqual(C.diffValues(a, b), ["HURD_H 2350 → 2347"]);
});

test("Windows-1252 encoding keeps Icelandic letters and the en dash", () => {
  assert.deepEqual([...C.toCp1252("ðÞ–")], [0xF0, 0xDE, 0x96]);
});

test("door ids", () => {
  assert.equal(C.doorId("Hurð 7"), "HU7");
  assert.equal(C.doorId("HURÐ 3  BAÐHERBERGI "), "HU3");
  assert.equal(C.doorId("Robust 15 HU1 | HU1"), "Robust 15 HU1 - HU1");
});

test("readValues also reads the first-version files (GLB=HURD_H|…|Hurdaskra)", () => {
  const v = C.doorPlan(DOOR).values;
  const old = Object.keys(v).map((k) => `GLB=${k}|${v[k]}|Hurdaskra|0|`).join("\r\n");
  assert.deepEqual(C.readValues(old), v);
});
