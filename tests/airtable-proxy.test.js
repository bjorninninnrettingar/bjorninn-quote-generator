// api/airtable.js — the open proxy. These are the rules that keep customer/employee data private.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/airtable.js";
import { mockRes, fakeFetch } from "./helpers.js";

let realFetch, f;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.VERK_KEY = "verk-secret";
  f = fakeFetch(() => ({ status: 200, body: { records: [{ id: "rec1", fields: { "Fullt nafn 👤": "Anna", "PIN 🔢": 1234, "Heiti tækifæris / verkefnis": "T-1" } }] } }));
  globalThis.fetch = f;
});
afterEach(() => { globalThis.fetch = realFetch; });

async function get(query) {
  const res = mockRes();
  await handler({ method: "GET", query, headers: {} }, res);
  return res;
}
async function post(path, fields) {
  const res = mockRes();
  await handler({ method: "POST", query: { path }, body: { fields }, headers: {} }, res);
  return res;
}

test("Tengiliðir (customer contacts) can't be read", async () => {
  assert.equal((await get({ path: "tblQ8zeUanriESWvL" })).statusCode, 403);
});

test("Starfsmenn: only the exact PIN query shape, never TRUE(), never returns the PIN", async () => {
  assert.equal((await get({ path: "tblhglpjQkczdG1AY", filterByFormula: "TRUE()" })).statusCode, 403);
  assert.equal((await get({ path: "tblhglpjQkczdG1AY", filterByFormula: "AND({PIN 🔢}=0000,{Er starfandi? ✅}=1)" })).statusCode, 403);
  assert.equal((await get({ path: "tblhglpjQkczdG1AY/recAAAAAAAAAAAAAA" })).statusCode, 403);
  const ok = await get({ path: "tblhglpjQkczdG1AY", filterByFormula: "AND({PIN 🔢}=1234,{Er starfandi? ✅}=1)" });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.records[0].fields["PIN 🔢"], undefined);
});

test("write-only tables refuse GET", async () => {
  for (const t of ["tbltD1UNpqj05WtMx", "tbl7K8v94Pf6Ausk3"]) {
    assert.equal((await get({ path: t, filterByFormula: "TRUE()" })).statusCode, 403, t);
  }
});

test("Tækifæri contact fields need ?k=VERK_KEY", async () => {
  const pub = await get({ path: "tbl4LMXlQjp66RFKI" });
  assert.equal(pub.body.records[0].fields["Fullt nafn 👤"], undefined);
  assert.equal(pub.body.records[0].fields["Heiti tækifæris / verkefnis"], "T-1");
  assert.equal((await get({ path: "tbl4LMXlQjp66RFKI", k: "wrong" })).statusCode, 403);
  const priv = await get({ path: "tbl4LMXlQjp66RFKI", k: "verk-secret" });
  assert.equal(priv.body.records[0].fields["Fullt nafn 👤"], "Anna");
  assert.ok(!f.calls.at(-1).url.includes("verk-secret"), "key never forwarded to Airtable");
});

test("contacts / Tækifæri / Line Items can't be created through the proxy (only api/kp-submit)", async () => {
  for (const t of ["tblQ8zeUanriESWvL", "tbl4LMXlQjp66RFKI", "tblFcsUoGxsuUwNEH"]) {
    assert.equal((await post(t, { "Fornafn ⬅️": "x" })).statusCode, 403, t);
  }
});

test("error report: Staða forced to Ný", async () => {
  const res = await post("tbl7K8v94Pf6Ausk3", { "Titill": "x", "Staða": "Lokið" });
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls.at(-1).body.fields["Staða"], "Ný");
});
