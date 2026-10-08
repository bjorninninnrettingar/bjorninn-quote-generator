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
  const patches = f.calls.filter((c) => c.method === "PATCH");
  assert.equal(JSON.parse(patches[0].body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).submissionId, "sid-1");
  assert.deepEqual(patches[1].body.records.map((r) => r.id), ["recL2"]);
});

test("needs the office key and valid input", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const res = mockRes();
  await handler({ method: "POST", body: { k: "wrong", recordId: OPP, state: { walls: [] }, smida: {} } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { "Sk1; DROP": null } }), "Ógilt 🔑: Sk1; DROP");
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { Sk1: { v: 2 } } }), "Ógild Smíðagögn: Sk1");
});
