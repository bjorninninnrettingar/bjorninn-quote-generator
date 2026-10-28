import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { STAGES, transitionAllowed, productionRecorded } from "../api/verk-status.js";

function call(body, env = { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x" }, fetchImpl) {
  Object.assign(process.env, env);
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts = {}) => { calls.push({ url, opts }); return fetchImpl(url, opts); };
  let status, json;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  return handler({ method: "POST", body }, res).finally(() => { global.fetch = realFetch; }).then(() => ({ status, json, calls }));
}
const ok = (fields) => ({ ok: true, status: 200, json: async () => ({ fields }) });
const T = "recAAAAAAAAAAAAAA";

test("floor may only move forward to Má afhenda / Afhent, and one step back", () => {
  assert.ok(transitionAllowed(STAGES.assembly, STAGES.deliver));
  assert.ok(transitionAllowed(STAGES.deliver, STAGES.done));
  assert.ok(transitionAllowed(STAGES.done, STAGES.deliver));
  assert.ok(!transitionAllowed(STAGES.ready, STAGES.done));
  assert.ok(!transitionAllowed(STAGES.done, STAGES.ready));
  assert.ok(!transitionAllowed("", STAGES.deliver));
});

test("wrong key is refused before Airtable is touched", async () => {
  const r = await call({ k: "rangt", t: T, action: "status" }, undefined, () => { throw new Error("no"); });
  assert.equal(r.status, 403);
  assert.equal(r.calls.length, 0);
});

test("a stale page (from ≠ current) gets 409 and the real stage", async () => {
  const r = await call({ k: "lykill", t: T, action: "status", from: STAGES.assembly, to: STAGES.deliver }, undefined,
    async () => ok({ "Staða í söluferli": "🏆 Tækifæri unnið", "Staða í framleiðslu": STAGES.deliver }));
  assert.equal(r.status, 409);
  assert.equal(r.json.stage, STAGES.deliver);
});

test("an allowed move PATCHes only Staða í framleiðslu", async () => {
  const r = await call({ k: "lykill", t: T, action: "status", from: STAGES.deliver, to: STAGES.done }, undefined,
    async (url, opts) => ok(opts.method === "PATCH" ? {} : { "Staða í söluferli": "🏆 Tækifæri unnið", "Staða í framleiðslu": STAGES.deliver }));
  assert.equal(r.status, 200);
  const patch = r.calls.find((c) => c.opts.method === "PATCH");
  assert.deepEqual(JSON.parse(patch.opts.body), { fields: { "Staða í framleiðslu": STAGES.done } });
});

test("sagað refuses a piece from another project", async () => {
  const r = await call({ k: "lykill", t: T, action: "sagad", pieceId: "recBBBBBBBBBBBBBB" }, undefined,
    async (url) => ok(url.includes("tblhdgyvTcBfP8kov") ? { "Tækifæri 📣 (projects)": ["recCCCCCCCCCCCCCC"] } : { "Staða í söluferli": "🏆 Tækifæri unnið" }));
  assert.equal(r.status, 403);
  assert.equal(r.calls.some((c) => c.opts.method === "PATCH"), false);
});

test("a status move also writes one office Virkni line (no chat)", async () => {
  const r = await call({ k: "lykill", t: T, action: "status", from: STAGES.assembly, to: STAGES.deliver }, undefined,
    async (url, opts) => ok(opts.method ? { id: "recVVVVVVVVVVVVVV" } : { "Staða í söluferli": "🏆 Tækifæri unnið", "Staða í framleiðslu": STAGES.assembly }));
  assert.equal(r.status, 200);
  const line = r.calls.find((c) => c.url.includes("tblPPMTlFhW0snk24"));
  const f = JSON.parse(line.opts.body).fields;
  assert.equal(f["Tegund"], "afhending");
  assert.equal(f["Til"], "Skrifstofa");
  assert.deepEqual(f["Tækifæri"], [T]);
  assert.equal(r.calls.some((c) => String(c.url).includes("chat.googleapis.com")), false);
});

const WON = "🏆 Tækifæri unnið";
const proj = (extra) => async (url, opts) => ok(opts.method ? { id: "recVVVVVVVVVVVVVV" } : Object.assign({ "Staða í söluferli": WON, "Staða í framleiðslu": STAGES.ready }, extra));

test("productionRecorded: saw 95 % and mill 60 % needed", () => {
  assert.equal(productionRecorded({ "Framvinda sögunar": 1, "Fjöldi hluta til að fræsa 🔬": 0 }).ok, true);
  assert.equal(productionRecorded({}).ok, false);
  const r = productionRecorded({ "Framvinda sögunar": 0.97, "Fjöldi hluta til að fræsa 🔬": 10, "Fjöldi hluta fræstir 🔬": 2 });
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 1);
});

test("Tilbúið → Má afhenda without recorded sawing/milling is refused (409) and nothing is written", async () => {
  const r = await call({ k: "lykill", t: T, action: "status", from: STAGES.ready, to: STAGES.deliver }, undefined, proj({}));
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "framleidsla_vantar");
  assert.equal(r.calls.some((c) => c.opts.method === "PATCH" || c.opts.method === "POST"), false);
});

test("override needs OWNER_KEY and a reason, then logs it in Virkni", async () => {
  const base = { k: "lykill", t: T, action: "status", from: STAGES.ready, to: STAGES.deliver, override: true };
  const noKey = await call({ ...base, reason: "x", ownerKey: "rangt" }, { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", OWNER_KEY: "eig" }, proj({}));
  assert.equal(noKey.status, 409);
  const noReason = await call({ ...base, ownerKey: "eig" }, { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", OWNER_KEY: "eig" }, proj({}));
  assert.equal(noReason.status, 409);
  const ok1 = await call({ ...base, ownerKey: "eig", reason: "afhent beint af birgi" }, { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", OWNER_KEY: "eig" }, proj({}));
  assert.equal(ok1.status, 200);
  const line = ok1.calls.find((c) => c.url.includes("tblPPMTlFhW0snk24"));
  assert.match(JSON.parse(line.opts.body).fields["Texti"], /eigandi fór framhjá/);
});

test("Samsetning → Má afhenda is not gated", async () => {
  const r = await call({ k: "lykill", t: T, action: "status", from: STAGES.assembly, to: STAGES.deliver }, undefined, proj({ "Staða í framleiðslu": STAGES.assembly }));
  assert.equal(r.status, 200);
});
