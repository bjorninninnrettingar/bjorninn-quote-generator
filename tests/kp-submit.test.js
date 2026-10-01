// api/kp-submit.js — the kitchen planner's one-request, retry-safe submission.
import { test } from "node:test";
import assert from "node:assert/strict";
import { submit, validate, makeAirtable, PROJECT_FORCED } from "../api/kp-submit.js";
import { fakeFetch } from "./helpers.js";

const NO_WAIT = { delays: [0, 0, 0, 0, 0] };
const body = (n = 23) => ({
  sid: "11111111-2222-3333-4444-555555555555",
  contact: { fornafn: "Anna", eftirnafn: "Jóns", netfang: "anna@example.is", simi: "5551234" },
  project: { "Skilaboð til skipulags": "note", "Staða í skipulagi": "Klárt til framleiðslu", "Fronta efni viðskiptavinar 🖼️": ["recAAAAAAAAAAAAAA"] },
  state: { step: "contact", walls: [] },
  lineItems: Array.from({ length: n }, (_, i) => ({ "🔑": "Sk" + (i + 1), "Rými 🏡": "Eldhús", "Magn": 1, "Bull": "x" })),
});
const isList = (c, tbl) => c.method === "GET" && c.url.includes(tbl);

test("fresh submission: contact, Tækifæri with forced fields + sid, Line Items in batches of 10", async () => {
  const f = fakeFetch((c) => {
    if (c.method === "POST" && c.url.endsWith("tblQ8zeUanriESWvL")) return { status: 200, body: { id: "recCONTACT0000000" } };
    if (c.method === "POST" && c.url.endsWith("tbl4LMXlQjp66RFKI")) return { status: 200, body: { id: "recOPP00000000000", fields: {} } };
    if (c.method === "POST") return { status: 200, body: { records: c.body.records.map((_, i) => ({ id: "rec" + i })) } };
  });
  const out = await submit(makeAirtable("t", { fetchImpl: f, ...NO_WAIT }), body());
  assert.equal(out.recordId, "recOPP00000000000");
  assert.equal(out.created, 23);
  const opp = f.calls.find((c) => c.method === "POST" && c.url.endsWith("tbl4LMXlQjp66RFKI")).body.fields;
  for (const [k, v] of Object.entries(PROJECT_FORCED)) assert.deepEqual(opp[k], v, k);   // client can't override
  assert.deepEqual(opp["Tengiliður verkefnis 👤"], ["recCONTACT0000000"]);
  assert.equal(JSON.parse(opp["Sjálfsafgreiðsla skipulag (JSON) 📐"]).submissionId, body().sid);
  const batches = f.calls.filter((c) => c.method === "POST" && c.url.endsWith("tblFcsUoGxsuUwNEH"));
  assert.deepEqual(batches.map((b) => b.body.records.length), [10, 10, 3]);
  const li = batches[0].body.records[0].fields;
  assert.deepEqual(li["Tækifæri 📣 (projects)"], ["recOPP00000000000"]);
  assert.equal(li.Bull, undefined);                                                       // unknown fields dropped
});

test("retry after a half submission: reuses the Tækifæri, only creates missing Line Items", async () => {
  const f = fakeFetch((c) => {
    if (isList(c, "tbl4LMXlQjp66RFKI")) return { status: 200, body: { records: [{ id: "recOPP00000000000", fields: { "Heiti tækifæris / verkefnis": "T-301 | Anna Jóns - " } }] } };
    if (isList(c, "tblFcsUoGxsuUwNEH")) return { status: 200, body: { records: [
      { id: "r1", fields: { "🔑": "Sk1", "Tækifæri 📣 (projects)": ["recOPP00000000000"] } },
      { id: "r2", fields: { "🔑": "Sk2", "Tækifæri 📣 (projects)": ["recOPP00000000000"] } },
      { id: "r3", fields: { "🔑": "Sk3", "Tækifæri 📣 (projects)": ["recSOMEOTHER00000"] } }, // other project → ignored
    ] } };
    if (c.method === "POST") return { status: 200, body: { records: [] } };
  });
  const out = await submit(makeAirtable("t", { fetchImpl: f, ...NO_WAIT }), body(5));
  assert.equal(out.resumed, true);
  assert.equal(out.created, 3);
  assert.ok(!f.calls.some((c) => c.method === "POST" && /tblQ8zeUanriESWvL|tbl4LMXlQjp66RFKI/.test(c.url)), "no new contact/Tækifæri");
  const keys = f.calls.filter((c) => c.method === "POST").flatMap((c) => c.body.records.map((r) => r.fields["🔑"]));
  assert.deepEqual(keys, ["Sk3", "Sk4", "Sk5"]);
});

test("an earlier attempt's contact (same e-mail, last 2 h) is reused", async () => {
  const f = fakeFetch((c) => {
    if (isList(c, "tblQ8zeUanriESWvL")) return { status: 200, body: { records: [{ id: "recOLDCONTACT0000" }] } };
    if (c.method === "POST") return { status: 200, body: { id: "recOPP00000000000", records: [] } };
  });
  await submit(makeAirtable("t", { fetchImpl: f, ...NO_WAIT }), body(1));
  assert.ok(!f.calls.some((c) => c.method === "POST" && c.url.endsWith("tblQ8zeUanriESWvL")));
  const opp = f.calls.find((c) => c.method === "POST" && c.url.endsWith("tbl4LMXlQjp66RFKI")).body.fields;
  assert.deepEqual(opp["Tengiliður verkefnis 👤"], ["recOLDCONTACT0000"]);
});

test("429 / 5xx / network errors are retried, a 422 is not", async () => {
  let n = 0;
  const flaky = fakeFetch(() => (++n === 1 ? { throw: "ECONNRESET" } : n === 2 ? { status: 429, body: {} } : n === 3 ? { status: 503, body: {} } : { status: 200, body: { ok: 1 } }));
  assert.deepEqual(await makeAirtable("t", { fetchImpl: flaky, ...NO_WAIT })("GET", "x"), { ok: 1 });
  assert.equal(flaky.calls.length, 4);
  const bad = fakeFetch(() => ({ status: 422, body: { error: "INVALID" } }));
  await assert.rejects(makeAirtable("t", { fetchImpl: bad, ...NO_WAIT })("GET", "x"), /422/);
  assert.equal(bad.calls.length, 1);
});

test("validate rejects bad input", () => {
  assert.equal(validate(body()), null);
  assert.ok(validate({ ...body(), sid: "x" }));
  assert.ok(validate({ ...body(), contact: { fornafn: "A", netfang: 'a"@b.is' } }));     // no quotes → safe in formulas
  assert.ok(validate({ ...body(), lineItems: [{ "🔑": "Sk1" }, { "🔑": "Sk1" }] }));
  assert.ok(validate({ ...body(), project: { "Fronta efni viðskiptavinar 🖼️": ["nope"] } }));
  assert.ok(validate({ ...body(), lineItems: Array.from({ length: 201 }, (_, i) => ({ "🔑": "Sk" + i })) }));
});
