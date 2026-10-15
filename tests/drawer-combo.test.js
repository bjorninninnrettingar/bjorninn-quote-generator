// api/drawer-combo.js — "create this drawer combo if it doesn't exist yet" (user, 2026-10-19). Covers the
// bug found live while building this: the create response's own price (a rollup-dependent formula field)
// came back stale (0) — a fresh read right after showed the real number — so findOrCreate always re-reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, findOrCreate } from "../api/drawer-combo.js";
import { fakeFetch } from "./helpers.js";
import { makeAirtable } from "../api/kp-submit.js";

test("validate: system, 1-6 drawers, letters belong to that system", () => {
  assert.equal(validate({ sys:"merivo", codes:["N"] }), null);
  assert.equal(validate({ sys:"oops", codes:["N"] }), "Ógilt kerfi");
  assert.equal(validate({ sys:"merivo", codes:[] }), "1–6 skúffur");
  assert.equal(validate({ sys:"merivo", codes:["N", "N", "N", "N", "N", "N", "N"] }), "1–6 skúffur");
  assert.equal(validate({ sys:"legra", codes:["N"] }), "Ógildur skúffustafur fyrir legra"); // N doesn't exist in Legra
});

test("existing combo: found by its real Vörunúmer, nothing written", async () => {
  const f = fakeFetch((call) => {
    if (call.method === "GET" && call.url.includes("M-KMM"))
      return { status:200, body:{ records:[{ id:"rec10unIVmn3M9ept", fields:{ fldbG3jw1tEPEchGr:"Merivo - 1 K-skúffur | 2 M-skúffur", fld36kgODkNOZNOeU:89294.8 } }] } };
    return { status:200, body:{ records:[] } };
  });
  const out = await findOrCreate(makeAirtable("t", { fetchImpl:f, delays:[] }), "merivo", ["K", "M", "M"]);
  assert.deepEqual(out, { created:false, id:"rec10unIVmn3M9ept", sku:"M-KMM", name:"Merivo - 1 K-skúffur | 2 M-skúffur", price:89294.8 });
  assert.ok(!f.calls.some((c) => c.method === "POST"));
});

test("new combo: not found → created with the right slots, then re-read for the settled price (not the create response's stale one)", async () => {
  const f = fakeFetch((call) => {
    if (call.method === "GET" && call.url.includes("M-KMN")) return { status:200, body:{ records:[] } }; // doesn't exist
    if (call.method === "POST") return { status:200, body:{ records:[{ id:"recNEW111111111AA", fields:{} }] } }; // stale — no price yet
    if (call.method === "GET" && call.url.includes("recNEW111111111AA"))
      return { status:200, body:{ fields:{ fldbG3jw1tEPEchGr:"Merivo - 1 K-skúffa | 1 M-skúffa | 1 N-skúffa", fld36kgODkNOZNOeU:87721.2 } } };
    return { status:200, body:{ records:[] } };
  });
  const out = await findOrCreate(makeAirtable("t", { fetchImpl:f, delays:[] }), "merivo", ["N", "K", "M"]);
  assert.equal(out.created, true);
  assert.equal(out.sku, "M-KMN"); // tallest-first: K > M > N
  assert.equal(out.price, 87721.2); // from the settled re-read, not the (stale, 0-ish) create response
  const post = f.calls.find((c) => c.method === "POST");
  assert.equal(post.body.records[0].fields.fldpHihoAgFxkjTVy, "M-KMN");
  assert.equal(post.body.records[0].fields.fldrFCpVB3Wrzm4BA, "MERIVO - Skúffu samsetning");
  // one slot per drawer, tallest-first: V1=K, V2=M, V3=N
  assert.deepEqual(post.body.records[0].fields.fldbnVgbWTgSXLjMm, ["recMs68rxtnjwnWId"]);
  assert.deepEqual(post.body.records[0].fields.fldJ726tLaP7r8PW8, ["recxsBNvkRztkEmbX"]);
  assert.deepEqual(post.body.records[0].fields.fldOAEkfwZo0GZPa4, ["recbYSmMAQcBWhtjb"]);
});
