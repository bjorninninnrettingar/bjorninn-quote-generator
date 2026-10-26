import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { F, G1_FIELD, refusal, g1Drafted, summarize } from "../api/greidslur.js";
import { mockRes, fakeFetch } from "./helpers.js";

const T = "recAAAAAAAAAAAAAA";
const ENV = { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", WEBHOOK_SECRET: "leynd" };

async function run(req, fields, extra = () => undefined) {
  Object.assign(process.env, ENV);
  const real = global.fetch;
  const f = fakeFetch((c) => extra(c) || (c.method === "GET" ? { status: 200, body: { records: [{ id: T, fields }] } } : { status: 200, body: { id: T, fields: {} } }));
  global.fetch = f;
  const res = mockRes();
  try { await handler({ headers: { host: "h" }, query: {}, ...req }, res); } finally { global.fetch = real; }
  return { res, calls: f.calls };
}
const post = (body, k = "lykill") => ({ method: "POST", query: { k }, body: { recordId: T, ...body } });

test("no / wrong key is refused before Airtable is touched", async () => {
  for (const k of [null, "rangt"]) {
    const { res, calls } = await run(post({ action: "g2" }, k), {});
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  }
  const { res } = await run({ method: "GET", query: { id: T } }, {});
  assert.equal(res.statusCode, 403);
});

test("a malformed record id never reaches a filterByFormula", async () => {
  const { res, calls } = await run({ method: "GET", query: { k: "lykill", id: "x') ,TRUE()" } }, {});
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("g2 PATCHes only the Greiðsla 2 checkbox, by field id, to true", async () => {
  const { res, calls } = await run(post({ action: "g2", fields: { "💰 Tilboðsupphæð": 1 } }), { [F.split]: "50% - 50%" });
  assert.equal(res.statusCode, 200);
  const p = calls.filter((c) => c.method === "PATCH");
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].body, { fields: { [F.g2]: true } });
  assert.match(p[0].url, /tbl4LMXlQjp66RFKI\/recAAAAAAAAAAAAAA$/);
});

test("payment ticks follow Skipting greiðslu and are never re-ticked", () => {
  assert.match(refusal("g2", { [F.split]: "100%" }), /100%/);
  assert.match(refusal("g3", { [F.split]: "50% - 50%" }), /50\/50/);
  assert.equal(refusal("g3", { [F.split]: "40% - 30% - 30%" }), null);
  assert.match(refusal("g2", { [F.split]: "40% - 30% - 30%", [F.g2]: true }), /Þegar/);
});

test("viðbætur needs a confirmed project, an amount > 0, and the amount the user confirmed", async () => {
  const f = { [F.confirmed]: 1000000, [F.vidb]: 125000 };
  assert.match(refusal("vidbaetur", { [F.vidb]: 5 }, { expect: 5 }), /ekki staðfest/);
  assert.match(refusal("vidbaetur", { [F.confirmed]: 1, [F.vidb]: 0 }, { expect: 0 }), /Engar/);
  assert.match(refusal("vidbaetur", f, { expect: 100000 }), /breyttist/);
  const bad = await run(post({ action: "vidbaetur", expect: 1 }), f);
  assert.equal(bad.res.statusCode, 409);
  assert.equal(bad.calls.some((c) => c.method === "PATCH"), false);
  const good = await run(post({ action: "vidbaetur", expect: 125000 }), f);
  assert.equal(good.res.statusCode, 200);
  assert.deepEqual(good.calls.find((c) => c.method === "PATCH").body, { fields: { [F.vidbApprove]: true } });
});

test("G1 is refused once a draft is logged, and reports a missing trigger field", async () => {
  assert.ok(g1Drafted("2026-10-06 · G1 · drög handvirkt"));
  assert.ok(!g1Drafted("2026-10-18 · G1 · ❌ Kennitala vantar"));
  const done = await run(post({ action: "g1" }), { [F.log]: "2026-10-06 · G1 · drög abc" });
  assert.equal(done.res.statusCode, 409);
  assert.equal(done.calls.some((c) => c.method === "PATCH"), false);
  const missing = await run(post({ action: "g1" }), {}, (c) => (c.method === "PATCH" ? { status: 422, body: { error: { type: "UNKNOWN_FIELD_NAME" } } } : undefined));
  assert.equal(missing.res.statusCode, 409);
  assert.equal(missing.res.body.error, "G1_NOT_SET_UP");
  assert.deepEqual(missing.calls.find((c) => c.method === "PATCH").body, { fields: { [G1_FIELD]: true } });
});

test("print relays only known modes to generate-quote with the server-held secret", async () => {
  const bad = await run(post({ action: "print", mode: "separate" }), {});
  assert.equal(bad.res.statusCode, 409);
  const ok = await run(post({ action: "print", mode: "vidbot" }), {}, (c) => (c.url.includes("generate-quote") ? { status: 200, body: { success: true } } : undefined));
  assert.equal(ok.res.statusCode, 200);
  const relay = ok.calls.find((c) => c.url.includes("generate-quote"));
  assert.deepEqual(relay.body, { recordId: T, mode: "vidbot" });
  assert.equal(ok.calls.some((c) => c.method === "PATCH"), false);
});

test("GET returns the summary and whether the G1 field exists", async () => {
  const { res } = await run({ method: "GET", query: { k: "lykill", id: T } },
    { [F.split]: "40% - 30% - 30%", [F.g2]: true, [F.g2At]: "2026-10-20T10:00:00.000Z", [F.vidb]: 5000, [F.tilbod]: [{ filename: "a.pdf", url: "u" }] },
    (c) => (c.url.includes(encodeURIComponent(G1_FIELD)) ? { status: 422, body: { error: { type: "UNKNOWN_FIELD_NAME" } } } : undefined));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.g2.paid, true);
  assert.equal(res.body.g3.paid, false);
  assert.equal(res.body.vidbaetur, 5000);
  assert.equal(res.body.g1Ready, false);
  assert.deepEqual(res.body.tilbod, [{ filename: "a.pdf", url: "u" }]);
  assert.equal(summarize({}, true).g1Ready, true);
});
