// 2026-10-28: piece token — api/v.js no longer puts VERK_KEY in the /velja redirect; it mints a 12 h token
// limited to the scanned piece / its unit / its project (api/_auth.js, scope in api/airtable.js).
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../api/airtable.js";
import vHandler from "../api/v.js";
import verkStatus from "../api/verk-status.js";
import { signPieceToken, verifyPieceToken, keyLevel, checkFloorOrFullKey, PIECE_TTL_SEC } from "../api/_auth.js";
import { mockRes, fakeFetch } from "./helpers.js";

const SECRET = "floor-secret-for-tests";
const PIECE = "recPPPPPPPPPPPPPP", OTHER = "recQQQQQQQQQQQQQQ", UNIT = "recUUUUUUUUUUUUUU", PROJ = "recJJJJJJJJJJJJJJ";
const SOG = "tblhdgyvTcBfP8kov", UNITS = "tbl0WcyHhz63pSzZX", PROJECTS = "tbl4LMXlQjp66RFKI";
const now = () => Math.floor(Date.now() / 1000);
const mint = (o = {}) => signPieceToken(SECRET, { pieceId: PIECE, unitId: UNIT, projectId: PROJ, exp: now() + PIECE_TTL_SEC, ...o });

let realFetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
  process.env.AIRTABLE_TOKEN = "test";
  process.env.VERK_KEY = "verk-secret";
  process.env.FLOOR_TOKEN_SECRET = SECRET;
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { id: "recX", fields: { "Heiti rýmis": "Eldhús", "Lamir [Hurð]": "Blum", "Fullt nafn 👤": "Jón" }, records: [{ id: "recX", fields: { "Heiti rýmis": "Eldhús" } }] } }));
});
afterEach(() => { globalThis.fetch = realFetch; });

const get = async (query) => { const r = mockRes(); await handler({ method: "GET", query, headers: {} }, r); return r; };
const patch = async (path, fields, k) => { const r = mockRes(); await handler({ method: "PATCH", query: k ? { path, k } : { path }, body: { fields }, headers: {} }, r); return r; };
const post = async (path, fields, k) => { const r = mockRes(); await handler({ method: "POST", query: { path, k }, body: { fields }, headers: {} }, r); return r; };
const UNITS_FORMULA = 'OR(ARRAYJOIN({Tækifæri 📣 (projects)})="T-15 Test", ARRAYJOIN({Tækifæri 📣})="T-15 Test")';

// ── primitives ───────────────────────────────────────────────────────────────────────────────
test("piece token verifies and carries piece/unit/project", () => {
  const v = verifyPieceToken(mint());
  assert.equal(v.ok, true);
  assert.deepEqual([v.pieceId, v.unitId, v.projectId], [PIECE, UNIT, PROJ]);
  assert.equal(verifyPieceToken(mint({ projectId: null })).projectId, null);
});

test("piece token: tamper with any part, expiry, wrong secret, no secret", () => {
  const parts = mint().split(".");
  const swap = (i, val) => parts.map((p, j) => (j === i ? val : p)).join(".");
  assert.equal(verifyPieceToken(swap(1, OTHER)).reason, "bad_signature");
  assert.equal(verifyPieceToken(swap(2, OTHER)).reason, "bad_signature");
  assert.equal(verifyPieceToken(swap(3, OTHER)).reason, "bad_signature");
  assert.equal(verifyPieceToken(swap(4, String(now() + 999999))).reason, "bad_signature");
  assert.equal(verifyPieceToken(swap(5, "AAAA")).reason, "bad_signature");
  assert.equal(verifyPieceToken(mint({ exp: now() - 1 })).reason, "expired");
  assert.equal(verifyPieceToken(mint(), Date.now() + (PIECE_TTL_SEC + 5) * 1000).reason, "expired");
  assert.equal(verifyPieceToken(signPieceToken("other-secret", { pieceId: PIECE, unitId: UNIT, projectId: PROJ, exp: now() + 100 })).reason, "bad_signature");
  assert.equal(verifyPieceToken("pk1.junk").reason, "malformed");
  assert.equal(verifyPieceToken(mint() + ".x").reason, "malformed");
  const t = mint();
  delete process.env.FLOOR_TOKEN_SECRET;
  assert.equal(verifyPieceToken(t).ok, false);
});

test("a piece token is not a floor key or the full key anywhere keyLevel is used", () => {
  assert.equal(keyLevel(mint()), null);
  assert.equal(checkFloorOrFullKey(mint()), false);
});

// ── api/v.js ───────────────────────────────────────────────────────────────────────────────────
async function scan(id, fields) {
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { records: [{ id, fields }] } }));
  const res = mockRes(); res.writeHead = (c, h) => { res.statusCode = c; res.headers = h; };
  await vHandler({ query: { id }, headers: { host: "bjorninn.vercel.app" } }, res);
  return res;
}
test("v.js redirect carries a piece token, never VERK_KEY", async () => {
  const res = await scan(PIECE, { "Eyðublað ✏️": [UNIT], "Tækifæri 📣 (projects)": [PROJ] });
  assert.equal(res.statusCode, 302);
  const loc = new URL(res.headers.Location, "https://x");
  assert.ok(!res.headers.Location.includes("verk-secret"));
  const v = verifyPieceToken(loc.searchParams.get("k"));
  assert.deepEqual([v.ok, v.pieceId, v.unitId, v.projectId], [true, PIECE, UNIT, PROJ]);
  assert.ok(v.exp - now() > PIECE_TTL_SEC - 60 && v.exp - now() <= PIECE_TTL_SEC);
  assert.equal(loc.searchParams.get("s"), PIECE);
});
test("v.js: no FLOOR_TOKEN_SECRET -> 500, and still never leaks VERK_KEY", async () => {
  delete process.env.FLOOR_TOKEN_SECRET;
  const res = await scan(PIECE, { "Eyðublað ✏️": [UNIT] });
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res).includes("verk-secret"));
});

// ── proxy GET scope ───────────────────────────────────────────────────────────────────────────
test("piece token reads its own piece, unit and project (floor-visible fields only)", async () => {
  const k = mint();
  assert.equal((await get({ path: `${SOG}/${PIECE}`, k })).statusCode, 200);
  const u = await get({ path: `${UNITS}/${UNIT}`, k });
  assert.equal(u.statusCode, 200);
  const unitUrl = decodeURIComponent(globalThis.fetch.calls.at(-1).url);
  assert.ok(unitUrl.includes("Lamir [Hurð]"), "unit build detail requested like a floor token");
  const p = await get({ path: `${PROJECTS}/${PROJ}`, k });
  assert.equal(p.statusCode, 200);
  assert.equal(p.body.fields["Fullt nafn 👤"], undefined, "contact fields stay hidden");
  const url = decodeURIComponent(globalThis.fetch.calls.at(-1).url);
  assert.ok(!url.includes("pk1."), "token never forwarded to Airtable");
  assert.ok(!url.includes("Netfang") && !url.includes("Tilboðsupphæð"));
});

test("piece token reads the project's unit list for /verk, only in that exact formula shape", async () => {
  const k = mint();
  assert.equal((await get({ path: UNITS, k, filterByFormula: UNITS_FORMULA })).statusCode, 200);
  assert.equal((await get({ path: UNITS, k, filterByFormula: "TRUE()" })).statusCode, 403);
  assert.equal((await get({ path: UNITS, k })).statusCode, 403);
  assert.equal((await get({ path: UNITS, k, filterByFormula: UNITS_FORMULA + ",TRUE()" })).statusCode, 403);
  assert.equal((await get({ path: UNITS, k, filterByFormula: 'OR(ARRAYJOIN({Tækifæri 📣 (projects)})="x", ARRAYJOIN({Tækifæri 📣})="y"), TRUE()' })).statusCode, 403);
});

test("piece token: wrong piece / unit / project record is refused", async () => {
  const k = mint();
  assert.equal((await get({ path: `${SOG}/${OTHER}`, k })).statusCode, 403);
  assert.equal((await get({ path: `${UNITS}/${OTHER}`, k })).statusCode, 403);
  assert.equal((await get({ path: `${PROJECTS}/${OTHER}`, k })).statusCode, 403);
  assert.equal((await get({ path: `${PROJECTS}/${PROJ}`, k: mint({ projectId: null }) })).statusCode, 403);
});

test("piece token: wrong table is refused (not treated as 'no key')", async () => {
  const k = mint();
  for (const t of ["tblQ8zeUanriESWvL", "tblFcsUoGxsuUwNEH", "tblhglpjQkczdG1AY", "tbl8CrVWKF8CuI7HD", "tblPPMTlFhW0snk24", SOG]) {
    assert.equal((await get({ path: t, k, filterByFormula: "TRUE()" })).statusCode, 403, t);
  }
});

test("piece token: tampered, expired, wrong-secret tokens get 403 and never reach Airtable", async () => {
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { id: "x", fields: {} } }));
  const good = mint();
  const bad = [good.slice(0, -2) + "xx", mint({ exp: now() - 5 }), good.replace(PIECE, OTHER), signPieceToken("nope", { pieceId: PIECE, unitId: UNIT, projectId: PROJ, exp: now() + 99 })];
  for (const k of bad) assert.equal((await get({ path: `${SOG}/${PIECE}`, k })).statusCode, 403);
  assert.equal(globalThis.fetch.calls.length, 0);
});

// ── proxy writes ───────────────────────────────────────────────────────────────────────────────
test("piece token PATCH: its own piece's milling fields only", async () => {
  const k = mint();
  const ok = await patch(`${SOG}/${PIECE}`, { "Fræst": true, "Magn fræst": 2, "V hlið magn fræst": 1, "H hlið magn fræst": 1 }, k);
  assert.equal(ok.statusCode, 200);
  assert.equal(globalThis.fetch.calls.at(-1).method, "PATCH");
  assert.equal((await patch(`${SOG}/${OTHER}`, { "Fræst": true }, k)).statusCode, 403, "wrong piece");
  assert.equal((await patch(`${SOG}/${PIECE}`, { "Fræst": true, "Tilbúið 🔒": true }, k)).statusCode, 403, "extra field");
  assert.equal((await patch(`${SOG}/${PIECE}`, { "Fræst": true }, mint({ exp: now() - 1 }))).statusCode, 403, "expired");
  assert.equal((await patch(`${PROJECTS}/${PROJ}`, { "Upphafs framleiðsludagur verks": "2026-11-02" }, k)).statusCode, 403, "other table, even a keyless field");
  assert.equal((await post("tblFcsUoGxsuUwNEH", { x: 1 }, k)).statusCode, 403, "create");
});

test("piece token never satisfies a key-gated write", async () => {
  assert.equal((await patch(`${PROJECTS}/${PROJ}`, { "Staða í söluferli": "Unnið" }, mint())).statusCode, 403);
});

// ── dual-run: the old key behaves exactly as before ────────────────────────────────────────────────
test("old VERK_KEY still works everywhere (other pieces, other tables, unit list, writes)", async () => {
  const k = "verk-secret";
  assert.equal((await get({ path: `${SOG}/${OTHER}`, k })).statusCode, 200);
  assert.equal((await get({ path: `${PROJECTS}/${OTHER}`, k })).statusCode, 200);
  assert.equal((await get({ path: UNITS, k, filterByFormula: "TRUE()" })).statusCode, 200);
  assert.equal((await patch(`${SOG}/${OTHER}`, { "Fræst": true }, k)).statusCode, 200);
  assert.equal((await patch(`${PROJECTS}/${PROJ}`, { "Staða í söluferli": "Unnið" }, k)).statusCode, 200);
  assert.equal((await patch(`${SOG}/${OTHER}`, { "Fræst": true })).statusCode, 200, "keyless write unchanged");
  assert.equal((await get({ path: `${PROJECTS}/${PROJ}`, k: "wrong" })).statusCode, 403);
});

// ── verk-status ────────────────────────────────────────────────────────────────────────────────────
async function vs(body) { const r = mockRes(); await verkStatus({ method: "POST", body }, r); return r; }
test("verk-status: piece token cannot change stage, other project, or other actions", async () => {
  globalThis.fetch = fakeFetch(() => ({ status: 200, body: { fields: { "Staða í söluferli": "🏆 Tækifæri unnið", "Staða í framleiðslu": "Verk í vinnslu 🔨", "Tækifæri 📣 (projects)": [PROJ] } } }));
  const k = mint();
  assert.equal((await vs({ k, t: PROJ, action: "status", from: "Verk í vinnslu 🔨", to: "Má Afhenda 🚚" })).statusCode, 403);
  assert.equal((await vs({ k, t: OTHER, action: "sagad", pieceId: PIECE, done: true })).statusCode, 403);
  assert.equal((await vs({ k: mint({ exp: now() - 1 }), t: PROJ, action: "sagad", pieceId: PIECE, done: true })).statusCode, 403);
  assert.equal((await vs({ k: mint({ projectId: null }), t: PROJ, action: "sagad", pieceId: PIECE, done: true })).statusCode, 403);
  assert.notEqual((await vs({ k, t: PROJ, action: "sagad", pieceId: PIECE, done: true })).statusCode, 403, "own project's sagað passes the gate");
  assert.notEqual((await vs({ k: "verk-secret", t: PROJ, action: "status", from: "x", to: "y" })).statusCode, 403, "old key unchanged");
});

// ── pages ──────────────────────────────────────────────────────────────────────────────────────────
test("v.js never reads VERK_KEY; velja sends the token on its write; verk never stores a piece token", () => {
  const v = readFileSync(new URL("../api/v.js", import.meta.url), "utf8");
  const velja = readFileSync(new URL("../velja.html", import.meta.url), "utf8");
  const verk = readFileSync(new URL("../verk.html", import.meta.url), "utf8");
  assert.ok(!/process\.env\.VERK_KEY/.test(v));
  assert.ok(velja.includes('encodeURIComponent(SOG_TABLE + "/" + s) + "&k=" + encodeURIComponent(k)'));
  assert.ok(verk.includes('k.indexOf("pk1.") !== 0'));
});
