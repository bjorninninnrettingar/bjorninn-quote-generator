// 2026-10-28: per-device floor tokens (api/_auth.js, api/floor-token.js, scope in api/airtable.js).
// Dual-run safety first: the old VERK_KEY keeps every behaviour it had; a floor token is a strictly
// smaller credential. No network, no live Airtable.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import handler from "../api/airtable.js";
import tokenHandler, { _resetLimiter } from "../api/floor-token.js";
import virkni from "../api/virkni.js";
import verkStatus from "../api/verk-status.js";
import { skrifstofaDayToken } from "../api/skrifstofa-login.js";
import { signFloorToken, signPairCode, verifyFloorToken, verifyPairCode, keyLevel, safeEq } from "../api/_auth.js";
import { mockRes, fakeFetch } from "./helpers.js";

const SECRET = "floor-secret-for-tests";
const NOW = Math.floor(Date.now() / 1000);
const good = (over = {}) => signFloorToken(SECRET, { deviceId: "abc123def456", name: "Sögun spjaldtölva", exp: NOW + 3600, ...over });

const PROJECTS = "tbl4LMXlQjp66RFKI";
const UNITS = "tbl0WcyHhz63pSzZX";
const SOG = "tblhdgyvTcBfP8kov";
const CONTACTS = "tblQ8zeUanriESWvL";
const FJARV = "tbl3e5o0Klv9RcNQ4";
const MATERIALS = "tbl8CrVWKF8CuI7HD";
const LINEITEMS = "tblFcsUoGxsuUwNEH";

const PROJECT_FIELDS = {
  "Heiti tækifæris / verkefnis": "T-15 Test",
  "🧠📌Það sem þarf að hafa í huga": "Passa horn",
  "Skúffusamantekt": "12 skúffur",
  "Framvinda sögunar": 0.5,
  "Fullt nafn 👤": "Jón Jónsson",
  "Netfang 📧": "jon@example.is",
  "☎️ Símanúmer": "5551234",
  "💰 Tilboðsupphæð": 1234567,
  "Staðfest tilboðsupphæð 🔒": 1200000,
  "Sölumaður 🧑‍💼": "Rakel",
  "Næsta skref": "Hringja",
};

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.VERK_KEY = "verk-secret";
  process.env.FLOOR_TOKEN_SECRET = SECRET;
  process.env.KIOSK_DEVICE_SECRET = "kiosk-secret";
  delete process.env.FLOOR_REVOKED;
  _resetLimiter();
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { id: "rec1", fields: PROJECT_FIELDS, records: [{ id: "recAAAAAAAAAAAAAA", fields: PROJECT_FIELDS }] } }));
});
afterEach(() => { globalThis.fetch = realFetch; });

async function get(query) { const res = mockRes(); await handler({ method: "GET", query, headers: {} }, res); return res; }
async function patch(path, fields, k) { const res = mockRes(); await handler({ method: "PATCH", query: k ? { path, k } : { path }, body: { fields }, headers: {} }, res); return res; }
async function post(path, fields, k) { const res = mockRes(); await handler({ method: "POST", query: k ? { path, k } : { path }, body: { fields }, headers: {} }, res); return res; }
async function tokenCall(body, headers = {}) { const res = mockRes(); await tokenHandler({ method: "POST", body, headers }, res); return res; }

// ── token primitives ────────────────────────────────────────────────────────────────────────
test("sign/verify round trip carries device id, name and expiry", () => {
  const v = verifyFloorToken(good());
  assert.equal(v.ok, true);
  assert.equal(v.deviceId, "abc123def456");
  assert.equal(v.name, "Sögun spjaldtölva");
  assert.equal(v.exp, NOW + 3600);
});

test("tampering with any part of a token breaks the signature", () => {
  const parts = good().split(".");
  const swap = (i, val) => parts.map((p, j) => (j === i ? val : p)).join(".");
  assert.equal(verifyFloorToken(swap(1, "zzz999zzz999")).reason, "bad_signature"); // other device id
  assert.equal(verifyFloorToken(swap(2, String(NOW + 999999))).reason, "bad_signature"); // extended expiry
  assert.equal(verifyFloorToken(swap(3, Buffer.from("Eigandi").toString("base64url"))).reason, "bad_signature"); // renamed
  assert.equal(verifyFloorToken(swap(4, parts[4].slice(0, -2) + "AA")).reason, "bad_signature");
  assert.equal(verifyFloorToken(parts.slice(0, 4).join(".")).reason, "malformed");
  assert.equal(verifyFloorToken("fl1.a.b.c.d.e").reason, "malformed");
  assert.equal(verifyFloorToken("").ok, false);
  assert.equal(verifyFloorToken(null).ok, false);
});

test("a token signed with another secret is rejected", () => {
  assert.equal(verifyFloorToken(signFloorToken("someone-elses-secret", { deviceId: "abc123def456", name: "x", exp: NOW + 100 })).reason, "bad_signature");
});

test("expired tokens are rejected", () => {
  assert.equal(verifyFloorToken(good({ exp: NOW - 1 })).reason, "expired");
  assert.equal(verifyFloorToken(good({ exp: NOW + 60 }), (NOW + 61) * 1000).reason, "expired");
});

test("a revoked device id (FLOOR_REVOKED) is rejected, others stay valid", () => {
  process.env.FLOOR_REVOKED = "zzz, ABC123DEF456 ,yyy";
  assert.equal(verifyFloorToken(good()).reason, "revoked");
  assert.equal(verifyFloorToken(good({ deviceId: "other0000001" })).ok, true);
  assert.equal(keyLevel(good()), null);
});

test("without FLOOR_TOKEN_SECRET no floor token is ever valid", () => {
  const t = good();
  delete process.env.FLOOR_TOKEN_SECRET;
  assert.equal(verifyFloorToken(t).ok, false);
  assert.equal(keyLevel(t), null);
});

test("a pairing code is not a floor token and vice versa", () => {
  const code = signPairCode(SECRET, { deviceId: "abc123def456", name: "x", exp: NOW + 100 });
  assert.equal(verifyPairCode(code).ok, true);
  assert.equal(verifyFloorToken(code).ok, false);
  assert.equal(keyLevel(code), null);
  assert.equal(verifyPairCode(good()).ok, false);
  // same fields, wrong prefix label: re-labelling a floor token as a code must not verify
  assert.equal(verifyPairCode(good().replace(/^fl1/, "pc1")).reason, "bad_signature");
});

test("keyLevel: old key is full, valid token is floor, anything else null", () => {
  assert.equal(keyLevel("verk-secret"), "full");
  assert.equal(keyLevel(good()), "floor");
  assert.equal(keyLevel("verk-secre"), null);
  assert.equal(keyLevel(""), null);
  assert.equal(keyLevel(undefined), null);
  delete process.env.VERK_KEY;
  assert.equal(keyLevel("undefined"), null);
  assert.equal(keyLevel(""), null);
  assert.equal(safeEq("a", "ab"), false);
  assert.equal(safeEq("ab", "ab"), true);
});

// ── proxy: old key unchanged ─────────────────────────────────────────────────────────────────
test("old VERK_KEY still unlocks the full VERK_ONLY set (contact + pricing included)", async () => {
  const r = await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: "verk-secret" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.fields["Fullt nafn 👤"], "Jón Jónsson");
  assert.equal(r.body.fields["💰 Tilboðsupphæð"], 1234567);
  assert.equal(r.body.fields["🧠📌Það sem þarf að hafa í huga"], "Passa horn");
});

test("no key: still the public field set; wrong key: still 403", async () => {
  const pub = await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA" });
  assert.equal(pub.statusCode, 200);
  assert.equal(pub.body.fields["Fullt nafn 👤"], undefined);
  assert.equal(pub.body.fields["🧠📌Það sem þarf að hafa í huga"], undefined);
  assert.equal((await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: "nope" })).statusCode, 403);
});

test("old key still unlocks key-gated writes (create, patch, field-gated Tækifæri patch)", async () => {
  assert.equal((await post(MATERIALS, { "Heiti efnis": "X" }, "verk-secret")).statusCode, 200);
  assert.equal((await patch(CONTACTS + "/recAAAAAAAAAAAAAA", { "Fornafn ⬅️": "A" }, "verk-secret")).statusCode, 200);
  assert.equal((await patch(PROJECTS + "/recAAAAAAAAAAAAAA", { "Sjálfsafgreiðsla — óyfirfarið ⚠️": true }, "verk-secret")).statusCode, 200);
});

// ── proxy: floor scope ────────────────────────────────────────────────────────────────────────
test("floor token reads production notes/progress but NOT contact, pricing or CRM fields", async () => {
  const r = await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: good() });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.fields["🧠📌Það sem þarf að hafa í huga"], "Passa horn");
  assert.equal(r.body.fields["Skúffusamantekt"], "12 skúffur");
  assert.equal(r.body.fields["Framvinda sögunar"], 0.5);
  for (const f of ["Fullt nafn 👤", "Netfang 📧", "☎️ Símanúmer", "💰 Tilboðsupphæð", "Staðfest tilboðsupphæð 🔒", "Sölumaður 🧑‍💼", "Næsta skref"]) {
    assert.equal(r.body.fields[f], undefined, f);
  }
});

test("the Airtable request for a floor token never asks for out-of-scope fields", async () => {
  await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: good() });
  const url = decodeURIComponent(globalThis.fetch.calls.at(-1).url);
  assert.ok(!url.includes("Netfang"));
  assert.ok(!url.includes("Tilboðsupphæð"));
  assert.ok(!url.includes("k=fl1"), "the token is never forwarded to Airtable");
});

test("floor token reads unit build detail (Eyðublað VERK_ONLY) like the old key", async () => {
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [{ id: "recU", fields: { "Heiti rýmis": "Eldhús", "Lamir [Hurð]": "Blum", "Skúffutegund": "Legrabox" } }] } }));
  const r = await get({ path: UNITS, k: good(), filterByFormula: "TRUE()" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.records[0].fields["Lamir [Hurð]"], "Blum");
});

test("floor token on a table outside the floor scope gets only the public set (here: nothing)", async () => {
  const contact = { "Fornafn ⬅️": "Jón", "Kennitala 👤#️⃣": "1234567890", "Netfang 📧": "x@y.is" };
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [{ id: "recC", fields: contact }] } }));
  const full = await get({ path: CONTACTS + "/recAAAAAAAAAAAAAA", k: "verk-secret" });
  assert.ok(Object.keys(full.body.fields || {}).length > 0, "sanity: old key sees contact fields");
  const r = await get({ path: CONTACTS + "/recAAAAAAAAAAAAAA", k: good() });
  assert.deepEqual(r.body.fields, {});
  const li = await get({ path: LINEITEMS, k: good(), filterByFormula: "TRUE()" });
  assert.deepEqual((li.body.records || []).map((x) => x.fields), [{}].slice(0, (li.body.records || []).length));
});

test("floor token does not open the key-only STRICT_FILTERS shapes (laun's orlof list)", async () => {
  const f = 'AND({Tegund}="Orlof",{Staða}!="")';
  assert.equal((await get({ path: FJARV, k: "verk-secret", filterByFormula: f })).statusCode, 200);
  assert.equal((await get({ path: FJARV, k: good(), filterByFormula: f })).statusCode, 403);
});

test("tampered, expired, revoked or unconfigured floor tokens get 403 'Invalid key'", async () => {
  const t = good();
  for (const bad of [t.slice(0, -3) + "AAA", good({ exp: NOW - 5 }), "fl1.x.y", "garbage"]) {
    const r = await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: bad });
    assert.equal(r.statusCode, 403);
    assert.equal(r.body.error, "Invalid key");
  }
  process.env.FLOOR_REVOKED = "abc123def456";
  assert.equal((await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: t })).statusCode, 403);
  delete process.env.FLOOR_REVOKED;
  delete process.env.FLOOR_TOKEN_SECRET;
  assert.equal((await get({ path: PROJECTS + "/recAAAAAAAAAAAAAA", k: t })).statusCode, 403);
});

test("floor token never satisfies a key-gated write", async () => {
  const t = good();
  assert.equal((await post(MATERIALS, { "Heiti efnis": "X" }, t)).statusCode, 403);
  assert.equal((await post(LINEITEMS, { "Magn": 1 }, t)).statusCode, 403);
  assert.equal((await patch(CONTACTS + "/recAAAAAAAAAAAAAA", { "Fornafn ⬅️": "A" }, t)).statusCode, 403);
  assert.equal((await patch(MATERIALS + "/recAAAAAAAAAAAAAA", { "Heiti efnis": "A" }, t)).statusCode, 403);
  // Tækifæri: only the keyless calendar dates, same as no key at all
  assert.equal((await patch(PROJECTS + "/recAAAAAAAAAAAAAA", { "Sjálfsafgreiðsla — óyfirfarið ⚠️": true }, t)).statusCode, 403);
  assert.equal((await patch(PROJECTS + "/recAAAAAAAAAAAAAA", { "Upphafs framleiðsludagur verks": "2026-11-02" }, t)).statusCode, 200);
});

test("the floor's own keyless writes (Sögunarlisti) work whether k is absent, old, or a floor token", async () => {
  for (const k of [undefined, "verk-secret", good()]) {
    const r = await patch(SOG + "/recAAAAAAAAAAAAAA", { "Fræst": true }, k);
    assert.equal(r.statusCode, 200, String(k).slice(0, 6));
  }
});

// ── virkni + verk-status accept the floor token ────────────────────────────────────────────────
test("virkni: old key and floor token pass the gate, others 403", async () => {
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [] } }));
  for (const [k, want] of [["verk-secret", 200], [good(), 200], ["nope", 403], [good({ exp: NOW - 1 }), 403]]) {
    const res = mockRes();
    await virkni({ method: "GET", query: { k, role: "Verkstæði" }, headers: {} }, res);
    assert.equal(res.statusCode === 403, want === 403, String(k).slice(0, 8) + " -> " + res.statusCode);
  }
});

test("verk-status: floor token passes the key gate, a bad one is refused before Airtable", async () => {
  globalThis.fetch = fakeFetch(() => { throw new Error("must not reach airtable"); });
  const bad = mockRes();
  await verkStatus({ method: "POST", body: { k: "fl1.a.b.c.d", t: "recAAAAAAAAAAAAAA", action: "status" }, headers: {} }, bad);
  assert.equal(bad.statusCode, 403);
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { fields: {} } }));
  const ok = mockRes();
  await verkStatus({ method: "POST", body: { k: good(), t: "recAAAAAAAAAAAAAA", action: "bogus" }, headers: {} }, ok);
  assert.notEqual(ok.statusCode, 403);
});

// ── api/floor-token.js ──────────────────────────────────────────────────────────────────────────
const OWNER = "recOWNERAAAAAAAAA";
function ownerFetch(type = "Eigandi 👨🏻‍💼") {
  return fakeFetch(() => ({ status: 200, body: { records: [{ id: OWNER, fields: { "Tegund starfsmanns 🧑‍💻": type } }] } }));
}
const ownerAuth = () => ({ id: OWNER, t: skrifstofaDayToken("kiosk-secret", OWNER, 0) });

test("pair: owner gets a code, which exchanges for a 90-day token with the same device id", async () => {
  globalThis.fetch = ownerFetch();
  const p = await tokenCall({ action: "pair", name: "Fræsari", ...ownerAuth() });
  assert.equal(p.statusCode, 200);
  assert.match(p.body.code, /^pc1\./);
  assert.match(p.body.path, /^\/para-taeki\?c=pc1/);
  const pc = verifyPairCode(p.body.code);
  assert.equal(pc.ok, true);
  assert.ok(pc.exp - NOW <= 15 * 60 + 2);
  const x = await tokenCall({ action: "exchange", code: p.body.code });
  assert.equal(x.statusCode, 200);
  const v = verifyFloorToken(x.body.token);
  assert.equal(v.ok, true);
  assert.equal(v.deviceId, p.body.deviceId);
  assert.equal(v.name, "Fræsari");
  assert.ok(Math.abs(v.exp - (NOW + 90 * 24 * 3600)) < 10);
  assert.equal(keyLevel(x.body.token), "floor");
});

test("pair: non-owner, wrong session token, or missing name is refused", async () => {
  globalThis.fetch = ownerFetch("Fast ráðinn 👷");
  assert.equal((await tokenCall({ action: "pair", name: "X", ...ownerAuth() })).statusCode, 403);
  globalThis.fetch = ownerFetch();
  assert.equal((await tokenCall({ action: "pair", name: "X", id: OWNER, t: "wrong" })).statusCode, 403);
  assert.equal((await tokenCall({ action: "pair", name: "X", id: "bad", t: ownerAuth().t })).statusCode, 403);
  assert.equal((await tokenCall({ action: "pair", name: "X" })).statusCode, 403);
  assert.equal((await tokenCall({ action: "pair", name: "  ", ...ownerAuth() })).statusCode, 400);
  // the old shared key is NOT enough to mint tokens (it is in page source today)
  assert.equal((await tokenCall({ action: "pair", name: "X", k: "verk-secret" })).statusCode, 403);
});

test("exchange: expired, tampered, revoked and foreign codes are refused", async () => {
  const mk = (over = {}) => signPairCode(SECRET, { deviceId: "abc123def456", name: "T", exp: NOW + 600, ...over });
  assert.equal((await tokenCall({ action: "exchange", code: mk({ exp: NOW - 1 }) })).statusCode, 401);
  assert.equal((await tokenCall({ action: "exchange", code: mk().slice(0, -2) + "AA" })).statusCode, 401);
  assert.equal((await tokenCall({ action: "exchange", code: good() })).statusCode, 401);
  assert.equal((await tokenCall({ action: "exchange", code: "" })).statusCode, 401);
  process.env.FLOOR_REVOKED = "abc123def456";
  assert.equal((await tokenCall({ action: "exchange", code: mk() })).statusCode, 401);
});

test("check reports ok / revoked / expired; list returns revoked ids to the owner only", async () => {
  assert.equal((await tokenCall({ action: "check", token: good() })).body.ok, true);
  assert.equal((await tokenCall({ action: "check", token: good({ exp: NOW - 1 }) })).body.reason, "expired");
  process.env.FLOOR_REVOKED = "abc123def456";
  assert.equal((await tokenCall({ action: "check", token: good() })).body.reason, "revoked");
  globalThis.fetch = ownerFetch();
  const l = await tokenCall({ action: "list", ...ownerAuth() });
  assert.deepEqual(l.body.revoked, ["abc123def456"]);
  assert.equal((await tokenCall({ action: "list" })).statusCode, 403);
});

test("floor-token endpoint: POST only, 503 without secret, unauthenticated actions are rate limited", async () => {
  const g = mockRes();
  await tokenHandler({ method: "GET", headers: {} }, g);
  assert.equal(g.statusCode, 405);
  delete process.env.FLOOR_TOKEN_SECRET;
  assert.equal((await tokenCall({ action: "check", token: "x" })).statusCode, 503);
  process.env.FLOOR_TOKEN_SECRET = SECRET;
  let last;
  for (let i = 0; i < 32; i++) last = await tokenCall({ action: "check", token: "x" }, { "x-forwarded-for": "1.2.3.4" });
  assert.equal(last.statusCode, 429);
});

// ── pages + client helper ───────────────────────────────────────────────────────────────────────
const OLD_KEY = "XpxfZw1Cc9APLSlDGhm1AM4NdU1j";
test("the five floor pages load floor-key.js and still fall back to the old constant", () => {
  for (const f of ["app", "cutlist", "fraesing", "labels", "grain"]) {
    const html = readFileSync(new URL(`../${f}.html`, import.meta.url), "utf8");
    assert.ok(html.includes('<script src="/floor-key.js"></script>'), f + " loads floor-key.js");
    assert.ok(html.indexOf("/floor-key.js") < html.indexOf("VERK_KEY ="), f + ": helper loads before the constant is read");
    assert.ok(html.includes(`window.FloorKey.get("${OLD_KEY}") : "${OLD_KEY}"`), f + " keeps the fallback");
  }
});

function loadFloorKey({ store = {}, fetchImpl } = {}) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const win = {};
  const ctx = { window: win, localStorage: ls, Date, Number, String, atob, escape, decodeURIComponent, fetch: fetchImpl };
  vm.runInNewContext(readFileSync(new URL("../floor-key.js", import.meta.url), "utf8"), ctx);
  return { FloorKey: win.FloorKey, store };
}

test("FloorKey.get: unpaired device and expired token get the old constant; paired gets the token", () => {
  assert.equal(loadFloorKey().FloorKey.get("OLD"), "OLD");
  const t = good();
  assert.equal(loadFloorKey({ store: { "bjorninn:floorToken:v1": t } }).FloorKey.get("OLD"), t);
  const expired = good({ exp: NOW - 10 });
  const { FloorKey, store } = loadFloorKey({ store: { "bjorninn:floorToken:v1": expired } });
  assert.equal(FloorKey.get("OLD"), "OLD");
  assert.equal(store["bjorninn:floorToken:v1"], undefined, "expired token is dropped");
  assert.equal(loadFloorKey({ store: { "bjorninn:floorToken:v1": "junk" } }).FloorKey.get("OLD"), "OLD");
});

test("FloorKey.validate drops a revoked token (next load falls back) but keeps it on network errors", async () => {
  const t = good();
  const revoked = loadFloorKey({ store: { "bjorninn:floorToken:v1": t }, fetchImpl: async () => ({ ok: true, json: async () => ({ ok: false, reason: "revoked" }) }) });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(revoked.store["bjorninn:floorToken:v1"], undefined);
  const down = loadFloorKey({ store: { "bjorninn:floorToken:v1": t }, fetchImpl: async () => { throw new Error("offline"); } });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(down.store["bjorninn:floorToken:v1"], t);
  const srv503 = loadFloorKey({ store: { "bjorninn:floorToken:v1": t }, fetchImpl: async () => ({ ok: false, json: async () => ({}) }) });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(srv503.store["bjorninn:floorToken:v1"], t);
});

test("the pairing screen is reachable from the office nav and routed", () => {
  assert.ok(/id: "para".*href: "\/para-taeki"/.test(readFileSync(new URL("../office-shell.js", import.meta.url), "utf8")));
  assert.ok(readFileSync(new URL("../vercel.json", import.meta.url), "utf8").includes('"/para-taeki.html"'));
});
