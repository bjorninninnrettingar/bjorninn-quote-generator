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
  assert.equal(p.values.HANDFANG, 1040); // 1040 from the leaf's bottom + HG_BIL 10 = 1050 from the floor (user, 2026-10-13)
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

// ── What's actually confirmed vs assumed about the strike plate (2026-10-13 correction) ──────
// The hinge side IS confirmed: the JAMB fixture above is a trimmed copy of the shop's real
// karmur_lamir_M.bpp, and it shows the jamb computing HG_BIL+LOM3 / HG_BIL+HURD_H-LOM1 itself —
// i.e. the real master already adds the floor gap on the jamb side, in its own coordinate frame.
// The lock/strike side is NOT confirmed the same way (see LOCKS[...].confirm, surfaced as a ⚠️
// on every door that uses this lock) — nobody has read the real karmur_sluttjarn master, so
// nobody knows what expression it actually uses for the strike-plate height, or whether this
// hardware's latch sits at the same height as its own handle centre (a HANDFANG+offset would be
// a per-product hardware spec, not something this code can derive). A prior version of this test
// invented a "HG_BIL+HANDFANG" jamb formula to mirror the hinge pattern and asserted it matched —
// that only proved the invented formula was internally consistent with itself, not that it's the
// real one. Removed; don't re-add a strike-plate formula here without reading the real master.
test("renderBpp substitutes the same HANDFANG number everywhere it's referenced, regardless of the surrounding formula", () => {
  // This is the one thing we CAN prove without the real strike-plate master: whatever expression
  // the real master turns out to use, every literal occurrence of the word HANDFANG in it will be
  // replaced by the exact same number doorPlan() computed — because renderBpp does a single blind
  // text substitution, not a per-file recomputation. It does not prove the expression is correct.
  const p = C.doorPlan(DOOR);
  const master = [
    "[VARIABLES]", "PAN=LPX|HANDFANG||4|", "PAN=LPY|HG_BIL+HANDFANG||4|", "PAN=LPZ|2*HANDFANG||4|", "",
    "[PROGRAM]", "", `@ IN_20_835_60_BA, "", "", 1, "", 0 : HANDFANG`, "",
  ].join("\r\n");
  const r = C.renderBpp(master, p.values, C.MANAGED.leaf, ["IN_20_835_60_BA"]);
  assert.deepEqual(r.errors, []);
  assert.ok(r.text.includes("PAN=LPX|1040|"));
  assert.ok(r.text.includes("PAN=LPY|1050|"));           // 10 + 1040, if the real master turns out to use this form
  assert.ok(r.text.includes(`: ${p.values.HANDFANG}`));
  assert.equal(p.values.HANDFANG, 1040);
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

test("door files: short names inside Hurðir/<HU>/, long names for jambs in the old flat layout", () => {
  const plan = { id: "HU01", topp: "Ofan á hliðum", on: { leaf: [], jambHinge: [], jambStrike: [] } };
  assert.deepEqual(C.filesFor(plan, "T-49", true).map((f) => f.name), ["Hurðablað.bpp", "Karmur lamir.bpp", "Karmur slúttjárn.bpp", "Karmur toppstykki.bpp"]);
  assert.equal(C.filesFor(plan, "T-49")[1].name, "T-49 HU01 Karmur lamir.bpp");
});
