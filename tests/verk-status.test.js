import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { STAGES, transitionAllowed } from "../api/verk-status.js";

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
