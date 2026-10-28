// 2026-10-28 security round: Tækifæri PATCH by field, Stimplanir/Verktímar filters, pontun-print key,
// skrifstofa-login role copy, chat rate limit, security headers.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../api/airtable.js";
import loginHandler from "../api/skrifstofa-login.js";
import pontunPrint from "../api/pontun-print.js";
import { chatRateLimited, _resetChatLimiter } from "../api/chat.js";
import { mockRes, fakeFetch } from "./helpers.js";

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.VERK_KEY = "verk-secret";
  process.env.WEBHOOK_SECRET = "hook";
  process.env.KIOSK_DEVICE_SECRET = "kiosk-secret";
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { id: "rec1", fields: {}, records: [] } }));
});
afterEach(() => { globalThis.fetch = realFetch; });

const T = "tbl4LMXlQjp66RFKI/recAAAAAAAAAAAAAA";
async function patch(path, fields, k) {
  const res = mockRes();
  await handler({ method: "PATCH", query: k ? { path, k } : { path }, body: { fields }, headers: {} }, res);
  return res;
}
async function get(query) {
  const res = mockRes();
  await handler({ method: "GET", query, headers: {} }, res);
  return res;
}

test("Tækifæri PATCH: dagatal's three date fields stay keyless", async () => {
  for (const f of ["Upphafs framleiðsludagur verks", "Áætlaður afhendingardagur Björninn (internal)", "Viðskiptavinur sækir þann:"]) {
    assert.equal((await patch(T, { [f]: "2026-11-02" })).statusCode, 200, f);
  }
});

test("Tækifæri PATCH: every other field (alone or mixed with a date) needs the key", async () => {
  for (const f of ["🔄 Keyra Pöntunarlista 4.0", "Staða í söluferli", "Ósýnilegur afsláttur %", "6. CNC yfirfarið", "Sjálfsafgreiðsla — óyfirfarið ⚠️"]) {
    assert.equal((await patch(T, { [f]: true })).statusCode, 403, f);
    assert.equal((await patch(T, { [f]: true }, "wrong")).statusCode, 403, f);
    assert.equal((await patch(T, { [f]: true, "Upphafs framleiðsludagur verks": "2026-11-02" })).statusCode, 403, f + " mixed");
  }
  assert.equal((await patch(T, { "Staða í söluferli": "Unnið" }, "verk-secret")).statusCode, 200);
  assert.equal((await patch(T, { "🔄 Keyra Skipulag": true }, "verk-secret")).statusCode, 200);
});

test("Stimplanir / Verktímar: need a per-employee filter, TRUE() and bare listing refused", async () => {
  for (const t of ["tblnFIO8RB6HcelXF", "tblGu27c2fcwN2i2n"]) {
    assert.equal((await get({ path: t })).statusCode, 403, t + " bare");
    assert.equal((await get({ path: t, filterByFormula: "TRUE()" })).statusCode, 403, t + " TRUE()");
    assert.equal((await get({ path: t, filterByFormula: "{Út}=BLANK()" })).statusCode, 403, t + " no employee");
  }
});

test("Stimplanir / Verktímar: the shapes /klukka, /app and /laun send still pass", async () => {
  const S = "tblnFIO8RB6HcelXF", V = "tblGu27c2fcwN2i2n";
  const ok = [
    [S, `AND({Starfsmaður}="Anna Jóns",{Út}=BLANK())`],
    [S, `AND({Starfsmaður}="Anna",{Út}!=BLANK(),IS_AFTER({Inn},DATEADD(NOW(),-5,'days')))`],
    [S, `AND({Starfsmaður}="Anna",DATETIME_FORMAT({Inn},'YYYY-MM')="2026-10",{Út}!=BLANK())`],
    [S, `AND({Starfsmaður}="Anna", DATETIME_FORMAT({Inn},'YYYY-MM')="2026-10", {Út}!=BLANK())`],
    [S, `AND(FIND("Anna",ARRAYJOIN({Starfsmaður}))>0,{Tímabil 🗓️}="2026-10")`],
    [V, `AND({Starfsmaður}="Anna",IS_AFTER({Dagsetning},DATEADD(TODAY(),-6,'days')))`],
    [V, `AND({Starfsmaður}="Anna",DATETIME_FORMAT({Dagsetning},'YYYY-MM-DD')="2026-10-28")`],
  ];
  for (const [t, f] of ok) assert.equal((await get({ path: t, filterByFormula: f })).statusCode, 200, f);
});

test("pontun-print: no key / wrong key refused, real key relays to the generator", async () => {
  const call = async (body) => { const res = mockRes(); await pontunPrint({ method: "POST", headers: { host: "x" }, body }, res); return res; };
  assert.equal((await call({ recordId: "recX" })).statusCode, 403);
  assert.equal((await call({ recordId: "recX", k: "nope" })).statusCode, 403);
  assert.equal(globalThis.fetch.calls.length, 0);
  assert.equal((await call({ recordId: "recX", k: "verk-secret", kind: "extra" })).statusCode, 200);
  assert.match(globalThis.fetch.calls[0].url, /generate-extra-order-pdf/);
});

test("skrifstofa-login: logging in as an owner does not leak 'eigandi' into the next same-title login", async () => {
  const login = async (type) => {
    globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [{ id: "recAAAAAAAAAAAAAA", fields: { "Nafn starfsmanns 👷": "A", "Starfsheiti 💼": "Verkstjóri", "Tegund starfsmanns 🧑‍💻": type } }] } }));
    const res = mockRes();
    await loginHandler({ method: "POST", query: {}, body: { pin: "1234" } }, res);
    return res.body.record.roles;
  };
  assert.ok((await login("Eigandi 👨🏻‍💼")).includes("eigandi"));
  const second = await login("Starfsmaður");
  assert.deepEqual(second.filter((r) => r !== "allt"), []);
});

test("chat: 20/min and 200/day per IP, other IPs unaffected", () => {
  _resetChatLimiter();
  const t0 = 1_000_000;
  for (let i = 0; i < 20; i++) assert.equal(chatRateLimited("1.1.1.1", t0 + i), false);
  assert.equal(chatRateLimited("1.1.1.1", t0 + 30), true);
  assert.equal(chatRateLimited("2.2.2.2", t0 + 30), false);
  assert.equal(chatRateLimited("1.1.1.1", t0 + 61_000), false); // a minute later
  _resetChatLimiter();
  let now = t0;
  for (let i = 0; i < 200; i++) { assert.equal(chatRateLimited("3.3.3.3", now), false); now += 61_000; }
  assert.equal(chatRateLimited("3.3.3.3", now), true);
});

test("vercel.json sends Referrer-Policy and nosniff on every page", () => {
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const all = cfg.headers.find((h) => h.source === "/(.*)");
  const keys = Object.fromEntries(all.headers.map((h) => [h.key, h.value]));
  assert.equal(keys["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(keys["X-Content-Type-Options"], "nosniff");
});
