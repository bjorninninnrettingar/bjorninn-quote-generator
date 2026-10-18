// api/skrifstofa-login.js — regression test for the 2026-10-18 "Ónefnt everywhere" /
// "Nýtt verk í designer virkar ekki" bug: VERK_KEY used to have no bootstrap path except
// a ?k= URL param, so a fresh login never got it. A successful PIN login must now hand
// it back.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler, { skrifstofaDayToken } from "../api/skrifstofa-login.js";
import { mockRes, fakeFetch } from "./helpers.js";

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.KIOSK_DEVICE_SECRET = "kiosk-secret";
  process.env.VERK_KEY = "verk-secret";
});
afterEach(() => { globalThis.fetch = realFetch; });

async function call(pin) {
  const res = mockRes();
  await handler({ method: "POST", query: {}, body: { pin } }, res);
  return res;
}

test("a successful PIN login hands back the VERK_KEY (and the token is bound to this employee's id)", async () => {
  globalThis.fetch = fakeFetch(() => ({
    status: 200,
    body: { records: [{ id: "recAAAAAAAAAAAAAA", fields: { "Nafn starfsmanns 👷": "Anna", "Starfsheiti 💼": "Rekstrarstjóri", "Tegund starfsmanns 🧑‍💻": "Eigandi 👨🏻‍💼" } }] },
  }));
  const res = await call("1234");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verkKey, "verk-secret");
  assert.equal(res.body.record.roles.includes("eigandi"), true);
  assert.equal(res.body.token, skrifstofaDayToken("kiosk-secret", "recAAAAAAAAAAAAAA", 0));
});

test("missing VERK_KEY server config is refused up front, same as the other two secrets", async () => {
  delete process.env.VERK_KEY;
  const res = await call("1234");
  assert.equal(res.statusCode, 500);
});
