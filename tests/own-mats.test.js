// A room's OWN carcass / worktop → Line Item links "Skrokkaefni (lína) 🔲" / "Borðplata (lína) 🍽️" (2026-10-28).
// The fields may not exist in Airtable yet: every path must fall back without them and never fail the save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submit, validate, makeAirtable } from "../api/kp-submit.js";
import { save } from "../api/kp-pro.js";
import { fakeFetch as rawFetch, byLink } from "./helpers.js";

const MATS = ["Skrokkaefni (lína) 🔲", "Borðplata (lína) 🍽️"];
const MATREC = "recMAT1MAT1MAT1MA";
const NO_WAIT = { delays: [0, 0, 0, 0, 0] };
const unknown = { status: 422, body: { error: { type: "UNKNOWN_FIELD_NAME", message: `Unknown field name: "${MATS[0]}"` } } };

// ---- kp-submit ----
const body = (n) => ({
  sid: "11111111-2222-3333-4444-555555555555",
  contact: { fornafn: "Anna", eftirnafn: "Jóns", netfang: "anna@example.is", simi: "5551234" },
  project: { "Skilaboð til skipulags": "note" },
  state: { step: "contact", walls: [] },
  lineItems: Array.from({ length: n }, (_, i) => ({ "🔑": "Sk" + (i + 1), "Rými 🏡": "Eldhús", "Magn": 1 })),
});
const submitFetch = (reject) => rawFetch((c) => {
  if (c.method === "POST" && c.url.endsWith("tblQ8zeUanriESWvL")) return { status: 200, body: { id: "recCONTACT0000000" } };
  if (c.method === "POST" && c.url.endsWith("tbl4LMXlQjp66RFKI")) return { status: 200, body: { id: "recOPP00000000000", fields: {} } };
  if (reject && c.method === "POST" && c.body.records.some((r) => MATS[0] in r.fields)) return unknown;
  if (c.method === "POST") return { status: 200, body: { records: c.body.records.map((_, i) => ({ id: "rec" + i })) } };
});
const lineCalls = (f) => f.calls.filter((c) => c.method === "POST" && c.url.endsWith("tblFcsUoGxsuUwNEH"));

test("validate: the material links take [] or one rec id, reject two ids and junk", () => {
  const ok = (v) => { const b = body(1); b.lineItems[0][MATS[0]] = v; return validate(b); };
  assert.equal(ok([]), null);
  assert.equal(ok([MATREC]), null);
  assert.equal(ok([MATREC, "recAAAAAAAAAAAAAA"]), "Ógild tenging");
  assert.equal(ok(["nope"]), "Ógild tenging");
});

test("kp-submit, plain project: empty material arrays are not sent, line shape unchanged, no matsSkipped", async () => {
  const f = submitFetch(false);
  const b = body(2); for (const li of b.lineItems) { li[MATS[0]] = []; li[MATS[1]] = []; }
  const out = await submit(makeAirtable("t", { fetchImpl: f, ...NO_WAIT }), b);
  assert.equal(out.matsSkipped, undefined);
  assert.deepEqual(Object.keys(lineCalls(f)[0].body.records[0].fields).sort(), ["Magn", "Rými 🏡", "Tækifæri 📣 (projects)", "🔑"].sort());
});

test("kp-submit, differing room: own carcass is written; Airtable without the field (422) -> lines go in without it, matsSkipped", async () => {
  const b = body(2); b.lineItems[1][MATS[0]] = [MATREC]; b.lineItems[0][MATS[0]] = [];
  const f1 = submitFetch(false);
  const o1 = await submit(makeAirtable("t", { fetchImpl: f1, ...NO_WAIT }), b);
  assert.equal(o1.matsSkipped, undefined);
  assert.deepEqual(lineCalls(f1)[0].body.records[1].fields[MATS[0]], [MATREC]);
  assert.equal(MATS[0] in lineCalls(f1)[0].body.records[0].fields, false);
  const f2 = submitFetch(true);
  const o2 = await submit(makeAirtable("t", { fetchImpl: f2, ...NO_WAIT }), b);
  assert.equal(o2.matsSkipped, true);
  assert.equal(o2.created, 2);
  const last = lineCalls(f2).pop().body.records;
  assert.equal(last.length, 2);
  assert.ok(last.every((r) => !(MATS[0] in r.fields) && !(MATS[1] in r.fields)));
});

// ---- kp-pro ----
const OPP = "recAAAAAAAAAAAAAA";
const proRun = async ({ rowFields = {}, liExtra, li = {}, reject = false } = {}) => {
  const f = rawFetch(byLink((call) => {
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
      return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | Prófun", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1", liExtra }) } } };
    const dec = decodeURIComponent(call.url);
    if (reject && call.method === "GET" && dec.includes("tblFcsUoGxsuUwNEH") && dec.includes(MATS[0])) return unknown;
    if (reject && call.method === "PATCH" && call.url.includes("tblFcsUoGxsuUwNEH") && call.body.records.some((r) => MATS[0] in r.fields)) return unknown;
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH"))
      return { status: 200, body: { records: [{ id: "recL1", fields: Object.assign({ "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP] }, rowFields) }] } };
    return { status: 200, body: { records: [] } };
  }, { opp: OPP }));
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk1: null }, lineItems: [Object.assign({ "🔑": "Sk1" }, li)] });
  const patches = f.calls.filter((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  return { out, f, fields: patches.length ? patches[patches.length - 1].body.records[0].fields : {} };
};

test("kp-pro: a differing room is PATCHed as an id array; the same material writes and reads nothing new", async () => {
  assert.deepEqual((await proRun({ li: { [MATS[0]]: [MATREC], [MATS[1]]: [] } })).fields, { [MATS[0]]: [MATREC] });
  const same = await proRun({ li: { [MATS[0]]: [], [MATS[1]]: [] } });
  assert.deepEqual(same.fields, {});
  assert.equal(same.out.matsSkipped, undefined);
  assert.ok(same.f.calls.every((c) => !decodeURIComponent(c.url).includes(MATS[0])), "a plain project never mentions the new fields");
  const liExtra = JSON.parse(same.f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).liExtra;
  assert.deepEqual(Object.keys(liExtra.Sk1), ["Frontaefni #2", "Tegund innskúffu fronts"]); // planner JSON shape unchanged
});

test("kp-pro: a hand-set value survives when the drawing never sent one; a room back on the default clears what was sent", async () => {
  assert.deepEqual((await proRun({ rowFields: { [MATS[0]]: ["recHAND0HAND0HAND"] }, li: { [MATS[0]]: [] } })).fields, {});
  assert.deepEqual((await proRun({ rowFields: { [MATS[0]]: [MATREC] }, liExtra: { Sk1: { [MATS[0]]: MATREC } }, li: { [MATS[0]]: [] } })).fields, { [MATS[0]]: [] });
});

test("kp-pro: Airtable without the fields (422 on read) never fails the save: matsSkipped, other fields still written", async () => {
  const r = await proRun({ reject: true, li: { [MATS[0]]: [MATREC], "Tegund innskúffu fronts": "Ál" } });
  assert.equal(r.out.matsSkipped, true);
  assert.deepEqual(r.fields, { "Tegund innskúffu fronts": "Ál" });
});

test("kp-pro: 422 on the PATCH itself (field vanished between read and write) retries without the material fields", async () => {
  const f = rawFetch(byLink((call) => {
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`)) return { status: 200, body: { id: OPP, fields: { "Sjálfsafgreiðsla skipulag (JSON) 📐": "{}" } } };
    if (call.method === "PATCH" && call.url.includes("tblFcsUoGxsuUwNEH") && call.body.records.some((r) => MATS[0] in r.fields)) return unknown;
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH")) return { status: 200, body: { records: [{ id: "recL1", fields: { "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP] } }] } };
    return { status: 200, body: { records: [] } };
  }, { opp: OPP }));
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk1: { v: 1, w: 1 } }, lineItems: [{ "🔑": "Sk1", [MATS[0]]: [MATREC] }] });
  assert.equal(out.matsSkipped, true);
  const patches = f.calls.filter((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  assert.equal(patches.length, 2);
  assert.ok(!(MATS[0] in patches[1].body.records[0].fields));
  assert.ok("Smíðagögn (JSON) 🔧" in patches[1].body.records[0].fields);
});
