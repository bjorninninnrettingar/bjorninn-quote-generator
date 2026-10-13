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
  assert.equal(p.status, "ok"); // strike-plate macro confirmed 2026-10-13 against the real master
});

test("missing data stops the door, unknown lock only warns", () => {
  const stop = C.doorPlan({ ...DOOR, "Þykkt karms [Hurð]": null, "Lamir [Hurð]": [] });
  assert.equal(stop.status, "stop");
  assert.equal(stop.values, null);
  const lock = C.doorPlan({ ...DOOR, "Skrá [Hurð]": ["recUNKNOWNLOCK0001"] });
  assert.equal(lock.status, "check");
  assert.deepEqual(lock.on.jambStrike, []);
});

// ── Vörulisti-driven catalog, for hardware not in HINGES/LOCKS/THRESHOLDS (user, 2026-10-13) ─────
test("a hinge/threshold unknown to the hardcoded dicts is picked up from an Airtable-provided catalog", () => {
  const catalog = {
    recNEWHINGE0000001: { name: "Ný löm", leaf: "NEW_HINGE_LEAF", jamb: "NEW_HINGE_JAMB" },
    recNEWTHRESH000001: { name: "Nýr þröskuldur", leaf: "NEW_THRESH" }, // leaf-only, like THRESHOLDS entries
  };
  const p = C.doorPlan({ ...DOOR, "Lamir [Hurð]": ["recNEWHINGE0000001"], "Felliþr. [Hurð]": ["recNEWTHRESH000001"] }, catalog);
  assert.equal(p.hinge, "Ný löm");
  assert.equal(p.threshold, "Nýr þröskuldur");
  assert.ok(p.on.leaf.includes("NEW_HINGE_LEAF"));
  assert.ok(p.on.leaf.includes("NEW_THRESH"));
  assert.deepEqual(p.on.jambHinge, ["NEW_HINGE_JAMB"]);
});
test("an empty Vörulisti macró field is still unknown — stops exactly like today, catalog or not", () => {
  const catalog = { recUNFILLEDHINGE01: { name: "Hálfkláruð vara" } }; // name set but no leaf macro yet
  const p = C.doorPlan({ ...DOOR, "Lamir [Hurð]": ["recUNFILLEDHINGE01"] }, catalog);
  assert.equal(p.status, "stop");
  assert.ok(p.stop.some((s) => s.includes("Lamir")));
});
test("a hardcoded HINGES/LOCKS/THRESHOLDS entry always wins over the catalog, even if both have the id", () => {
  const catalog = { recoQeJKpvKLowWK3: { name: "Should never be used", leaf: "WRONG_MACRO" } };
  const p = C.doorPlan(DOOR, catalog);
  assert.equal(p.hinge, "JNF Coplan (innfelld)");
  assert.ok(p.on.leaf.includes("COPLAN"));
  assert.ok(!p.on.leaf.includes("WRONG_MACRO"));
});

test("renderBpp: numbers in, managed macros switched, other sections untouched, values saved as GLB", () => {
  const p = C.doorPlan(DOOR);
  const r = C.renderBpp(JAMB, p.values, C.MANAGED.jambHinge, p.on.jambHinge);
  assert.deepEqual(r.errors, []);
  const L = r.text.split("\r\n");
  assert.ok(L.includes("PAN=LPX|2400||4|"));                     // 2350 + 10 + 3 + 37
  assert.ok(L.includes("GLB=LOM_1|10+2350-237|Too save data write it here|0|"));
  assert.ok(L.some((l) => l.startsWith("@ COPLAN_KARM,")));
  assert.ok(!L.some((l) => l.includes("IN05020_KARMLOM_JNF")));  // not this door's hinge — dropped, not just switched off
  assert.ok(L.some((l) => l.startsWith("Rem ' BASIC_LOM_4")));   // untouched: not a managed macro at all
  assert.ok(L.includes("Name=HURD_H stays here"));
  assert.ok(L.includes("GLB=HS_HURD_Z|38|Hurdaskra|0|"));
  assert.ok(!L.some((l) => /^GLB=HURD_[HBZ]\|/.test(l)));        // never redefine the machine's own names
  assert.ok(r.text.includes("\r\n") && !/[^\r]\n/.test(r.text));   // CRLF kept
  assert.deepEqual(C.readValues(r.text), p.values);               // the file is its own record
});

test("a managed macro not chosen for this door is dropped from the file entirely — not switched off (user, 2026-10-13)", () => {
  // Three hinge options and a threshold, all present in the master and all switched off by default —
  // the finished file should show only the one hinge this door actually uses, and no threshold line at
  // all when the door has none. This is what the operator reads; it should never show options that
  // don't apply.
  const master = [
    "[VARIABLES]", "PAN=LPX|HURD_B||4|", "PAN=LPY|HURD_H||4|", "PAN=LPZ|HURD_Z||4|", "",
    "[PROGRAM]", "",
    `' COPLAN, "", "", 1, "", 0 : LOM1, LOM2, LOM3`,
    `' LAMIR_89_HURD, "", "", 2, "", 0 : LOM3`,
    `' IN05020_LAMIR_JNF, "", "", 3, "", 0 : LOM3`,
    `' FELLI_THROSKULDUR, "", "", 4, "", 0 : 0`,
    "",
  ].join("\r\n");
  const p = C.doorPlan(DOOR);
  const r = C.renderBpp(master, p.values, C.MANAGED.leaf, ["COPLAN"]); // only the hinge this door actually has
  assert.deepEqual(r.errors, []);
  const L = r.text.split("\r\n");
  assert.ok(L.some((l) => l.startsWith("@ COPLAN,")));
  assert.ok(!L.some((l) => l.includes("LAMIR_89_HURD")));
  assert.ok(!L.some((l) => l.includes("IN05020_LAMIR_JNF")));
  assert.ok(!L.some((l) => l.includes("FELLI_THROSKULDUR")));       // no threshold on this door → no line
});

// ── Strike plate height, confirmed against the real masters (2026-10-13) ─────────────────────
// A prior version of this test invented a "HG_BIL+HANDFANG" jamb formula by analogy with the
// (already-confirmed) hinge pattern and asserted it matched — that only proved the invented
// formula was consistent with itself, not that it's real. Fixed by reading the actual USB stick:
// leaf's [01] - Hurd.bpp has `GLB=HANDFANG_|HANDFANG||0|` (leaf-relative — no correction needed,
// HANDFANG is already measured from the leaf's own bottom) and `IN_20_835_60_BA ... : HANDFANG_`;
// both jamb variants (karmur_sluttjarn.bpp and _M.bpp) have `GLB=HANDFANG_|HG_BIL+HANDFANG||0|`
// (jamb is floor-relative, so it adds the leaf-to-floor gap) and `IN_20_835_60_BA_SLUTJARN ...
// : Handfang_` — the exact same leaf/jamb split already confirmed for LOM1-3 above. LOCKS[...]
// no longer carries a `confirm` flag for this lock as a result.
const LEAF_LOCK = [
  "[VARIABLES]", "PAN=LPX|HURD_B||4|", "PAN=LPY|HURD_H||4|", "PAN=LPZ|HURD_Z||4|", "GLB=HANDFANG_|HANDFANG||0|", "",
  "[PROGRAM]", "", `@ IN_20_835_60_BA, "", "", 132087908, "", 0 : HANDFANG_`, "",
].join("\r\n");
const JAMB_STRIKE = [
  "[VARIABLES]", "PAN=LPX|HURD_H+HG_BIL+HK_BIL||4|", "PAN=LPY|KARMAR_B||4|", "PAN=LPZ|KARMAR_Z||4|", "GLB=HANDFANG_|HG_BIL+HANDFANG||0|", "",
  "[PROGRAM]", "", `' IN_20_835_60_BA_SLUTJARN, "", "", 131820940, "", 0 : Handfang_`, "",
].join("\r\n");
test("leaf and jamb strike plate both resolve to 1050mm from the floor, via the real masters' own formulas", () => {
  const p = C.doorPlan(DOOR);
  const leaf = C.renderBpp(LEAF_LOCK, p.values, C.MANAGED.leaf, ["IN_20_835_60_BA"]);
  const jamb = C.renderBpp(JAMB_STRIKE, p.values, C.MANAGED.jambStrike, ["IN_20_835_60_BA_SLUTJARN"]);
  assert.deepEqual(leaf.errors, []); assert.deepEqual(jamb.errors, []);
  assert.ok(leaf.text.includes("GLB=HANDFANG_|1040||0|"));      // leaf's own zero = leaf's bottom
  assert.ok(jamb.text.includes("GLB=HANDFANG_|10+1040||0|"));   // jamb's own zero = the floor
  assert.ok(leaf.text.includes('@ IN_20_835_60_BA, "", "", 132087908, "", 0 : HANDFANG_'));
  assert.ok(jamb.text.includes('@ IN_20_835_60_BA_SLUTJARN, "", "", 131820940, "", 0 : Handfang_')); // switched on
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
