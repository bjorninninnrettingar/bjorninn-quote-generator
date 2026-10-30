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

test("Æðaplan: only the exact FIND/ARRAYJOIN-by-project shape, never TRUE()", async () => {
  assert.equal((await get({ path: "tblzkw70E2xoX9RmK", filterByFormula: "TRUE()" })).statusCode, 403);
  const single = await get({ path: "tblzkw70E2xoX9RmK", filterByFormula: 'FIND("T-1", ARRAYJOIN({Tækifæri 📣})) > 0' });
  assert.equal(single.statusCode, 200);
  const batch = await get({ path: "tblzkw70E2xoX9RmK", filterByFormula: 'OR(FIND("T-1", ARRAYJOIN({Tækifæri 📣})) > 0,FIND("T-2", ARRAYJOIN({Tækifæri 📣})) > 0)' });
  assert.equal(batch.statusCode, 200);
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

// 2026-10-18 — ferli.html's "Yfirfara einingu" wizard: per-row ready checkboxes on both the
// Sögunarlisti and Vörur á einingu tabs gate the unit's "Samþykkja einingu" button.

test("Sögunarlisti: the per-row 'Tilbúið 🔒' ready checkbox is writable, no key needed", async () => {
  const res = await patch("tblhdgyvTcBfP8kov/recAAAAAAAAAAAAAA", { "Tilbúið 🔒": true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(f.calls.at(-1).body.fields, { "Tilbúið 🔒": true });
});

test("Vörur á einingu: 'Rétt' is the only writable field (substitutes for 'Tilbúið 🔒', which this table has no field for)", async () => {
  const ok = await patch("tblszHaBrwhYNV68z/recAAAAAAAAAAAAAA", { "Rétt": true });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(f.calls.at(-1).body.fields, { "Rétt": true });

  const blocked = await patch("tblszHaBrwhYNV68z/recAAAAAAAAAAAAAA", { "Magn": 5 });
  assert.equal(blocked.statusCode, 400); // silently dropped -> no writable fields in request
});

test("Eyðublað: 'Yfirfarin' (the unit-list ✅ cue) is readable without a key", async () => {
  f = fakeFetch(() => ({ status: 200, body: { records: [{ id: "rec1", fields: { "Yfirfarin": true, "Tegund einingu": "Grunnskápur" } }] } }));
  globalThis.fetch = f;
  const res = await get({ path: "tbl0WcyHhz63pSzZX" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.records[0].fields["Yfirfarin"], true);
});

test("Tækifæri: the two new Dagatal fields stay behind ?k=VERK_KEY on read, like the rest of the internal set", async () => {
  f = fakeFetch(() => ({
    status: 200,
    body: { records: [{ id: "rec1", fields: {
      "Heiti tækifæris / verkefnis": "T-1",
      "Áætlaðir dagar í vinnudögum Björninn (internal)": 12,
      "Áætlaðir Dagar í vinnu (samkvæmt tilboðsblaði)": 10,
    } }] },
  }));
  globalThis.fetch = f;
  const pub = await get({ path: "tbl4LMXlQjp66RFKI" });
  assert.equal(pub.body.records[0].fields["Áætlaðir dagar í vinnudögum Björninn (internal)"], undefined);
  const priv = await get({ path: "tbl4LMXlQjp66RFKI", k: "verk-secret" });
  assert.equal(priv.body.records[0].fields["Áætlaðir dagar í vinnudögum Björninn (internal)"], 12);
  assert.equal(priv.body.records[0].fields["Áætlaðir Dagar í vinnu (samkvæmt tilboðsblaði)"], 10);
});

test("Tækifæri: 'Áætlaðir dagar í vinnudögum Björninn (internal)' is writable from the Dagatal section (with the key, 2026-10-28)", async () => {
  assert.equal((await patch("tbl4LMXlQjp66RFKI/recAAAAAAAAAAAAAA", { "Áætlaðir dagar í vinnudögum Björninn (internal)": 14 })).statusCode, 403);
  const res = await patch("tbl4LMXlQjp66RFKI/recAAAAAAAAAAAAAA", { "Áætlaðir dagar í vinnudögum Björninn (internal)": 14 }, "verk-secret");
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls.at(-1).body.fields["Áætlaðir dagar í vinnudögum Björninn (internal)"], 14);
});

// 2026-10-26 — /laun reads vacation requests from Fjarvistir (they used to be read from the retired
// Orlofsbeiðnir table, so requests made on /klukka never showed up for the owner to approve).
test("Fjarvistir: /laun's Orlof-by-Staða list only with the key, never sick days, never TRUE()", async () => {
  const pending = 'AND({Tegund}="Orlof",{Staða}="Í bið")';
  const all = 'AND({Tegund}="Orlof",{Staða}!="")';
  assert.equal((await get({ path: "tbl3e5o0Klv9RcNQ4", filterByFormula: pending })).statusCode, 403);
  assert.equal((await get({ path: "tbl3e5o0Klv9RcNQ4", filterByFormula: pending, k: "wrong" })).statusCode, 403);
  assert.equal((await get({ path: "tbl3e5o0Klv9RcNQ4", filterByFormula: pending, k: "verk-secret" })).statusCode, 200);
  assert.equal((await get({ path: "tbl3e5o0Klv9RcNQ4", filterByFormula: all, k: "verk-secret" })).statusCode, 200);
  for (const fml of ['AND({Tegund}="Veikindi",{Staða}!="")', "TRUE()", 'AND({Tegund}="Orlof",{Staða}!="",TRUE())']) {
    assert.equal((await get({ path: "tbl3e5o0Klv9RcNQ4", filterByFormula: fml, k: "verk-secret" })).statusCode, 403, fml);
  }
});

test("Fjarvistir: approving a vacation request needs the key and only Samþykkt/Hafnað", async () => {
  const id = "tbl3e5o0Klv9RcNQ4/recAAAAAAAAAAAAAA";
  assert.equal((await patch(id, { "Staða": "Samþykkt" })).statusCode, 403);
  assert.equal((await patch(id, { "Staða": "Í bið" }, "verk-secret")).statusCode, 400);
  assert.equal((await patch(id, { "Tegund": "Veikindi" }, "verk-secret")).statusCode, 400);
  const ok = await patch(id, { "Staða": "Samþykkt", "Til": "2026-12-31" }, "verk-secret");
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(f.calls.at(-1).body.fields, { "Staða": "Samþykkt" });
});

test("SOP's: unreadable without a key, readable with the key (internal reference library)", async () => {
  const SOP = "tblPMeNUQirwdNlYf";
  assert.equal((await get({ path: SOP })).statusCode, 403);
  assert.equal((await get({ path: SOP, k: "wrong" })).statusCode, 403);
  assert.equal((await get({ path: `${SOP}/rec1` })).statusCode, 403);
  const ok = await get({ path: SOP, k: "verk-secret" });
  assert.equal(ok.statusCode, 200);
  const url = f.calls[f.calls.length - 1].url;
  assert.ok(decodeURIComponent(url).includes("Lýsing á skrefum"), "fields come through with the key");
});
