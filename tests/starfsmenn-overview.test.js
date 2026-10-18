// api/starfsmenn-overview.js — the Eigandi-only Yfirlit Starfsmenn table. These tests
// are the "never trust the client's claimed role" boundary: a token alone isn't enough,
// the handler must re-check Airtable's own Tegund starfsmanns every time.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/starfsmenn-overview.js";
import { skrifstofaDayToken } from "../api/skrifstofa-login.js";
import { mockRes, fakeFetch } from "./helpers.js";

const OWNER = "recAAAAAAAAAAAAAA";
const NOT_OWNER = "recBBBBBBBBBBBBBB";
const SECRET = "test-secret";

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.KIOSK_DEVICE_SECRET = SECRET;
});
afterEach(() => { globalThis.fetch = realFetch; });

async function call(query) {
  const res = mockRes();
  await handler({ method: "GET", query }, res);
  return res;
}

test("a malformed id is refused before any Airtable call", async () => {
  const f = fakeFetch(() => { throw new Error("should not be called"); });
  globalThis.fetch = f;
  const res = await call({ id: "not-a-record-id", t: "x" });
  assert.equal(res.statusCode, 400);
  assert.equal(f.calls.length, 0);
});

test("a wrong or missing token is refused before the owner check", async () => {
  const f = fakeFetch(() => { throw new Error("should not be called"); });
  globalThis.fetch = f;
  const res = await call({ id: OWNER, t: "wrong" });
  assert.equal(res.statusCode, 401);
  assert.equal(f.calls.length, 0);
});

test("a valid token for someone who is NOT currently an owner in Airtable is refused — the token's age doesn't matter, only what Airtable says now", async () => {
  globalThis.fetch = fakeFetch((call) => {
    if (call.url.includes("RECORD_ID")) return { status: 200, body: { records: [{ id: NOT_OWNER, fields: { "Tegund starfsmanns 🧑‍💻": "Almennur starfsmaður" } }] } };
    throw new Error("list/open queries must never run for a non-owner");
  });
  const t = skrifstofaDayToken(SECRET, NOT_OWNER, 0);
  const res = await call({ id: NOT_OWNER, t });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "NOT_OWNER");
});

test("an owner's token returns the active staff list, with pay rate and clocked-in status merged in", async () => {
  const f = fakeFetch((call) => {
    if (call.url.includes("RECORD_ID")) {
      return { status: 200, body: { records: [{ id: OWNER, fields: { "Tegund starfsmanns 🧑‍💻": "Eigandi 👨🏻‍💼" } }] } };
    }
    if (call.url.includes("tblnFIO8RB6HcelXF")) {
      return { status: 200, body: { records: [{ fields: { "Starfsmaður": ["recCCCCCCCCCCCCCC"], "Inn": "2026-10-18T08:00:00.000Z" } }] } };
    }
    return {
      status: 200,
      body: {
        records: [
          { id: "recCCCCCCCCCCCCCC", fields: { "Nafn starfsmanns 👷": "Anna", "Kaup per klst 💲": 3500, "Dagvinna í mán. ⏱️": 120, "Yfirvinna í mán. ⏱️": 4, "Samtals í mán. ⏱️": 124, "Veikindadagar í mán. 🤒": 1 } },
          { id: "recDDDDDDDDDDDDDD", fields: { "Nafn starfsmanns 👷": "Björn", "Kaup per klst 💲": 4000 } },
        ],
      },
    };
  });
  globalThis.fetch = f;
  const t = skrifstofaDayToken(SECRET, OWNER, 0);
  const res = await call({ id: OWNER, t });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.records.length, 2);
  const anna = res.body.records.find((r) => r.name === "Anna");
  assert.equal(anna.payRate, 3500);
  assert.equal(anna.hoursTotal, 124);
  assert.equal(anna.sickDays, 1);
  assert.equal(anna.clockedIn, true);
  assert.equal(anna.clockedInSince, "2026-10-18T08:00:00.000Z");
  const bjorn = res.body.records.find((r) => r.name === "Björn");
  assert.equal(bjorn.clockedIn, false);
  // the pay rate never goes through the general-purpose proxy's own field allowlist —
  // confirm this handler is the one reading it, and that the list query actually asked
  // for it (a regression here would silently drop pay rate from the response).
  assert.ok(f.calls.some((c) => c.url.includes(encodeURIComponent("Kaup per klst 💲"))));
});

test("yesterday's token still works (UTC-midnight shift boundary), but a two-day-old one doesn't", async () => {
  globalThis.fetch = fakeFetch((call) => {
    if (call.url.includes("RECORD_ID")) return { status: 200, body: { records: [{ id: OWNER, fields: { "Tegund starfsmanns 🧑‍💻": "Eigandi 👨🏻‍💼" } }] } };
    return { status: 200, body: { records: [] } };
  });
  const yesterday = skrifstofaDayToken(SECRET, OWNER, -1);
  const res = await call({ id: OWNER, t: yesterday });
  assert.equal(res.statusCode, 200);

  globalThis.fetch = fakeFetch(() => { throw new Error("should not reach Airtable"); });
  const twoDaysAgo = skrifstofaDayToken(SECRET, OWNER, -2);
  const stale = await call({ id: OWNER, t: twoDaysAgo });
  assert.equal(stale.statusCode, 401);
});
