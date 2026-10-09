// api/kp-pro.js — pro-mode save: designer state back to the Tækifæri, Smíðagögn onto Line Items by 🔑.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { save, validate } from "../api/kp-pro.js";
import { makeAirtable } from "../api/kp-submit.js";
import { mockRes, fakeFetch } from "./helpers.js";

const OPP = "recAAAAAAAAAAAAAA";
const SM = (h) => ({ v: 1, doors: [{ h, type: "hinged", hinges: [{ from: "bottom", mm: 80 }, { from: "top", mm: 80 }] }] });
const routes = (call) => {
  if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
    return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | Prófun", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1" }) } } };
  if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH"))
    return { status: 200, body: { records: [
      { id: "recL1", fields: { "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP], "Smíðagögn (JSON) 🔧": JSON.stringify(SM(797)) } },
      { id: "recL2", fields: { "🔑": "Sk2", "Tækifæri 📣 (projects)": [OPP] } },
      { id: "recLX", fields: { "🔑": "Sk3", "Tækifæri 📣 (projects)": ["recOTHERPROJECT00"] } },
    ] } };
  return { status: 200, body: { records: [] } };
};

test("writes the state (keeping submissionId) and only the Smíðagögn that changed; reports keys it can't find", async () => {
  const f = fakeFetch(routes);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk1: SM(797), Sk2: SM(467), Sk3: SM(400) } });
  assert.deepEqual([out.updated, out.unchanged, out.missing], [1, 1, ["Sk3"]]);  // Sk3 belongs to another project
  const proj = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI"));
  const lines = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  assert.equal(JSON.parse(proj.body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).submissionId, "sid-1");
  assert.deepEqual(lines.body.records.map((r) => r.id), ["recL2"]);
});

test("needs the office key and valid input", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const res = mockRes();
  await handler({ method: "POST", body: { k: "wrong", recordId: OPP, state: { walls: [] }, smida: {} } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { "Sk1; DROP": null } }), "Ógilt 🔑: Sk1; DROP");
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { Sk1: { v: 2 } } }), "Ógild Smíðagögn: Sk1");
});

test("cabinets without a Line Item get one (same fields as a submission); lines no longer drawn are reported, never deleted", async () => {
  const f = fakeFetch(routes);
  const li = (k, extra) => Object.assign({ "🔑": k, "Rými 🏡": "Eldhús", "Magn": 1, "Vöru reitur 1": ["recV1V1V1V1V1V1V1"], "Smíðagögn (JSON) 🔧": '{"v":1,"w":600}', "Bull": "x" }, extra);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), {
    recordId: OPP, state: { walls: [] }, smida: { Sk1: SM(797), Sk4: { v: 1, w: 600 } }, lineItems: [li("Sk1"), li("Sk4")] });
  assert.deepEqual([out.created, out.updated, out.removed], [1, 0, ["Sk2"]]);
  const post = f.calls.find((c) => c.method === "POST");
  assert.equal(post.body.typecast, true);
  assert.deepEqual(post.body.records, [{ fields: { "Tækifæri 📣 (projects)": [OPP], "Rými 🏡": "Eldhús", "Magn": 1, "Vöru reitur 1": ["recV1V1V1V1V1V1V1"], "🔑": "Sk4", "Smíðagögn (JSON) 🔧": '{"v":1,"w":600}' } }]);
  assert.ok(!f.calls.some((c) => c.method === "DELETE"));
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, lineItems: [{ "🔑": "Sk 1" }] }), "Ógilt 🔑 á línu");
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, lineItems: [{ "🔑": "Sk1", "Vöru reitur 1": ["nope"] }] }), "Ógild tenging");
});

test("V1/V2/V3: the drawing updates what Airtable hasn't touched, keeps Rakel's hand picks, asks when both changed", async () => {
  const A = "recAAAAAAAAAAAAA1", B = "recBBBBBBBBBBBBB2", C = "recCCCCCCCCCCCCC3", D = "recDDDDDDDDDDDDD4";
  const rows = [
    { id: "recS1", fields: { "🔑": "Sk1", "Vöru reitur 2": [A] } }, // drawing changed A → B, Airtable still A → write B
    { id: "recS2", fields: { "🔑": "Sk2", "Vöru reitur 2": [C] } }, // Airtable changed A → C, drawing still A → keep C
    { id: "recS3", fields: { "🔑": "Sk3", "Vöru reitur 2": [C] } }, // both changed → conflict
    { id: "recS4", fields: { "🔑": "Sk4", "Vöru reitur 2": [D] } }, // never sent (old line) and different → conflict
  ].map((r) => (r.fields["Tækifæri 📣 (projects)"] = [OPP], r));
  const sent = { Sk1: ["", A, ""], Sk2: ["", A, ""], Sk3: ["", A, ""] };
  const route = (call) => {
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
      return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | P", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ liSent: sent }) } } };
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH")) return { status: 200, body: { records: rows } };
    if (call.method === "GET" && call.url.includes("tbl8HjvBwNJ41cTV0"))
      return { status: 200, body: { records: [{ id: B, fields: { fldbG3jw1tEPEchGr: "Merivo E-skúff" } }, { id: C, fields: { fldbG3jw1tEPEchGr: "Merivo M-E" } }] } };
    return { status: 200, body: { records: [] } };
  };
  const li = (k, v2) => ({ "🔑": k, "Vöru reitur 2": [v2] });
  const body = { recordId: OPP, state: { walls: [] }, smida: { Sk1: null, Sk2: null, Sk3: null, Sk4: null },
    lineItems: [li("Sk1", B), li("Sk2", A), li("Sk3", B), li("Sk4", B)] };
  let f = fakeFetch(route);
  let out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body);
  const linePatch = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  assert.deepEqual(linePatch.body.records, [{ id: "recS1", fields: { "Vöru reitur 2": [B] } }]);
  assert.deepEqual(out.conflicts.map((c) => [c.key, c.field, c.drawingNames, c.airtableNames]),
    [["Sk3", "V2", ["Merivo E-skúff"], ["Merivo M-E"]], ["Sk4", "V2", ["Merivo E-skúff"], [D]]]);
  const saved = JSON.parse(f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).liSent;
  assert.deepEqual(saved, { Sk1: ["", B, ""], Sk2: ["", A, ""], Sk3: ["", A, ""], Sk4: ["", null, ""] });

  // Rakel settles them: Sk3 → the drawing, Sk4 → Airtable (and Sk4 stays quiet afterwards).
  f = fakeFetch(route);
  out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), Object.assign({}, body, { resolve: { Sk3: "drawing", Sk4: "airtable" } }));
  assert.deepEqual(f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH")).body.records.map((r) => r.id), ["recS1", "recS3"]);
  assert.deepEqual(out.conflicts, []);
  assert.deepEqual(out.liSent.Sk4, ["", B, ""]);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, resolve: { Sk1: "maybe" } }), "Ógilt resolve: Sk1");
});
