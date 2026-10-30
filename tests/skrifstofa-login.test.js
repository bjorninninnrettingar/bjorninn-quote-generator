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

test("brute force: 5 wrong PINs from one IP -> 429 + Retry-After, even for the right PIN; other IPs unaffected", async () => {
  const { _resetLoginLimiter } = await import("../api/skrifstofa-login.js");
  _resetLoginLimiter();
  let calls = 0;
  globalThis.fetch = fakeFetch(() => { calls++; return { status: 200, body: { records: [] } }; });
  const mk = (ip, pin) => { const res = mockRes(); return handler({ method: "POST", query: {}, headers: { "x-forwarded-for": ip }, body: { pin } }, res).then(() => res); };
  for (let i = 0; i < 5; i++) assert.equal((await mk("1.1.1.1", "10" + i + "1")).statusCode, 401);
  const blocked = await mk("1.1.1.1", "1234");
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.error, "TOO_MANY_ATTEMPTS");
  assert.equal(calls, 5, "blocked request must not reach Airtable");
  assert.equal((await mk("2.2.2.2", "5551")).statusCode, 401);
  _resetLoginLimiter();
});

test("brute force: the same PIN tried from 5 different IPs gets locked per PIN", async () => {
  const { _resetLoginLimiter } = await import("../api/skrifstofa-login.js");
  _resetLoginLimiter();
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [] } }));
  const mk = (ip, pin) => { const res = mockRes(); return handler({ method: "POST", query: {}, headers: { "x-forwarded-for": ip }, body: { pin } }, res).then(() => res); };
  for (let i = 0; i < 5; i++) await mk("9.9.9." + i, "4242");
  assert.equal((await mk("9.9.9.99", "4242")).statusCode, 429);
  _resetLoginLimiter();
});
