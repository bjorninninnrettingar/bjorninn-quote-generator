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
async function post(path, fields, k) {
  const res = mockRes();
  const query = k ? { path, k } : { path };
  await handler({ method: "POST", query, body: { fields }, headers: {} }, res);
  return res;
}
async function patch(path, fields, k) {
  const res = mockRes();
  const query = k ? { path, k } : { path };
  await handler({ method: "PATCH", query, body: { fields }, headers: {} }, res);
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

test("Tækifæri can't be created through the proxy at all (only api/kp-submit)", async () => {
  assert.equal((await post("tbl4LMXlQjp66RFKI", { "Heiti tækifæris / verkefnis": "x" })).statusCode, 403);
});

test("/crm self-serve creates (Tengiliðir, Fyrirtæki, Útfærslur, Efnislisti, Line Items) need ?k=VERK_KEY", async () => {
  for (const t of ["tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK", "tbl8HjvBwNJ41cTV0", "tbl8CrVWKF8CuI7HD", "tblFcsUoGxsuUwNEH"]) {
    assert.equal((await post(t, { "Fornafn ⬅️": "x" })).statusCode, 403, t + " (no key)");
    assert.equal((await post(t, { "Fornafn ⬅️": "x" }, "wrong")).statusCode, 403, t + " (wrong key)");
  }
});

test("new contact/company/útfærsla/material always lands flagged Óyfirfarið — Rakel ⚠️, regardless of what's sent", async () => {
  for (const t of ["tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK", "tbl8HjvBwNJ41cTV0", "tbl8CrVWKF8CuI7HD"]) {
    const res = await post(t, { "Óyfirfarið — Rakel ⚠️": false }, "verk-secret");
    assert.equal(res.statusCode, 200, t);
    assert.equal(f.calls.at(-1).body.fields["Óyfirfarið — Rakel ⚠️"], true, t);
  }
});

test("editing an existing Tengiliðir/Fyrirtæki/Útfærslur/Efnislisti record needs ?k=VERK_KEY too", async () => {
  const field = {
    "tblQ8zeUanriESWvL": "Netfang 📧", "tbl2akoCETBx9S1SK": "Netfang 📧",
    "tbl8HjvBwNJ41cTV0": "Vörunúmer", "tbl8CrVWKF8CuI7HD": "Heiti efnis",
  };
  for (const t of Object.keys(field)) {
    assert.equal((await patch(t + "/recAAAAAAAAAAAAAA", { [field[t]]: "x" })).statusCode, 403, t + " (no key)");
    const ok = await patch(t + "/recAAAAAAAAAAAAAA", { [field[t]]: "x" }, "verk-secret");
    assert.equal(ok.statusCode, 200, t + " (keyed)");
  }
});

test("Tengiliðir/Fyrirtæki by-id reads work (crm.html + the job popup resolve a linked contact/company this way) — a STRICT_FILTERS entry must not also block legitimate record-id lookups", async () => {
  for (const t of ["tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK"]) {
    const res = await get({ path: t + "/recAAAAAAAAAAAAAA", k: "verk-secret" });
    assert.equal(res.statusCode, 200, t);
  }
});

test("Starfsmenn/Fjarvistir by-id reads stay refused — the PIN-filter / Starfsmaður=X shape is the only intended way in, even with a real record id", async () => {
  for (const t of ["tblhglpjQkczdG1AY", "tbl3e5o0Klv9RcNQ4"]) {
    assert.equal((await get({ path: t + "/recAAAAAAAAAAAAAA" })).statusCode, 403, t);
  }
});

test("Tengiliðir/Fyrirtæki search: only the exact SEARCH() shape, never TRUE() even with the key", async () => {
  for (const t of ["tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK"]) {
    assert.equal((await get({ path: t, filterByFormula: "TRUE()", k: "verk-secret" })).statusCode, 403, t);
  }
  const person = await get({ path: "tblQ8zeUanriESWvL", filterByFormula: 'OR(SEARCH(LOWER("anna"),LOWER({Fornafn ⬅️}&" "&{Eftirnafn ➡️})),SEARCH(LOWER("anna"),LOWER({Netfang 📧})),SEARCH("anna",{Símanúmer ☎️}))', k: "verk-secret" });
  assert.equal(person.statusCode, 200);
  const company = await get({ path: "tbl2akoCETBx9S1SK", filterByFormula: 'SEARCH(LOWER("innval"),LOWER({Nafn fyrirtækis}))', k: "verk-secret" });
  assert.equal(company.statusCode, 200);
});

test("error report: Staða forced to Ný", async () => {
  const res = await post("tbl7K8v94Pf6Ausk3", { "Titill": "x", "Staða": "Lokið" });
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls.at(-1).body.fields["Staða"], "Ný");
});
