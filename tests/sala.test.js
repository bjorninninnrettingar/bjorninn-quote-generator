import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { F, L, LOST, CONTACTS, PENDING, WON, LOST_STAGE, SENT, refusal, patchesFor, inDays } from "../api/sala.js";
import { mockRes, fakeFetch } from "./helpers.js";

const T = "recAAAAAAAAAAAAAA", ME = "recMMMMMMMMMMMMMM";
const ENV = { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", KIOSK_DEVICE_SECRET: "leynd" };

async function run(req, fields, extra = () => undefined) {
  Object.assign(process.env, ENV);
  const real = global.fetch;
  const f = fakeFetch((c) => extra(c) || (c.method === "GET" ? { status: 200, body: { records: [{ id: T, fields }] } } : { status: 200, body: { id: "recNEWNEWNEWNEWNE", fields: {} } }));
  global.fetch = f;
  const res = mockRes();
  try { await handler({ headers: { host: "h" }, query: {}, ...req }, res); } finally { global.fetch = real; }
  return { res, calls: f.calls };
}
const post = (body, k = "lykill") => ({ method: "POST", query: { k }, body: { recordId: T, ...body } });
const patches = (calls) => calls.filter((c) => c.method === "PATCH");

test("no / wrong key is refused before Airtable is touched", async () => {
  for (const k of [null, "rangt"]) {
    const { res, calls } = await run(post({ action: "unnid" }, k), {});
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  }
});

test("a malformed record id never reaches a filterByFormula", async () => {
  const { res, calls } = await run(post({ action: "unnid", recordId: "x') ,TRUE()" }), {});
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("Unnið ticks the checkbox the Airtable automation listens to, plus the status, by field id", async () => {
  const { res, calls } = await run(post({ action: "unnid" }), { [F.stage]: SENT });
  assert.equal(res.statusCode, 200);
  const p = patches(calls);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].body.fields, { [F.won]: true, [F.lost]: false, [F.stage]: WON });
  assert.match(p[0].url, /tbl4LMXlQjp66RFKI\/recAAAAAAAAAAAAAA$/);
});

test("a stale ticked checkbox (reopened deal) is unticked first so the automation fires again", () => {
  const out = patchesFor("unnid", { [F.won]: true, [F.stage]: SENT });
  assert.deepEqual(out, [{ [F.won]: false }, { [F.won]: true, [F.lost]: false, [F.stage]: WON }]);
  assert.equal(patchesFor("tapad", { [F.lost]: true }).length, 2);
});

test("Unnið / Tapað are never re-sent on an already-closed deal", () => {
  assert.match(refusal("unnid", { [F.stage]: WON }), /þegar unnið/);
  assert.match(refusal("tapad", { [F.stage]: LOST_STAGE }), /þegar tapað/);
});

test("Tapað with a reason adds one linked Töpuð tækifæri svör row; an unknown reason is refused", async () => {
  const { res, calls } = await run(post({ action: "tapad", reason: "📈 Verð", detail: "of dýrt" }), { [F.stage]: SENT, [F.name]: "T-1 | X" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(patches(calls)[0].body.fields, { [F.lost]: true, [F.won]: false, [F.stage]: LOST_STAGE });
  const c = calls.filter((x) => x.method === "POST");
  assert.equal(c.length, 1);
  assert.match(c[0].url, new RegExp(LOST + "$"));
  assert.equal(c[0].body.fields[L.reason], "📈 Verð");
  assert.deepEqual(c[0].body.fields[L.project], [T]);
  const bad = await run(post({ action: "tapad", reason: "Leiðinlegt" }), { [F.stage]: SENT });
  assert.equal(bad.res.statusCode, 409);
  assert.equal(patches(bad.calls).length, 0);
});

test("Merkja sent needs a Tilboð til sendingar and sets the follow-up step 3 days out", async () => {
  assert.match(refusal("sent", { [F.stage]: "✍️ Teikna og yfirfara tilboð" }), /Ekkert tilboð/);
  assert.match(refusal("sent", { [F.stage]: WON, [F.tilbod]: [{}] }), /lokað/);
  const now = new Date("2026-10-27T12:00:00Z");
  assert.deepEqual(patchesFor("sent", {}, {}, now), [{ [F.stage]: SENT, [F.step]: "⏳ Bíða eftir svari frá viðskiptavini", [F.stepDate]: "2026-10-30" }]);
  assert.equal(inDays(5, now), "2026-11-01");
});

test("follow-up / svar / líkur only accept the field's own choices; svar and líkur can be cleared", async () => {
  assert.equal(refusal("followup", {}, { value: "☎️ 🐰 RH tók símtal" }), null);
  assert.match(refusal("followup", {}, { value: "" }), /Veldu/);
  assert.match(refusal("likur", {}, { value: "100%" }), /Óþekkt/);
  assert.equal(refusal("svar", {}, { value: null }), null);
  const { calls } = await run(post({ action: "likur", value: "🟢 Góð" }), {});
  assert.deepEqual(patches(calls)[0].body.fields, { [F.likur]: "🟢 Góð" });
  assert.match(refusal("prufa", {}, { value: "já" }), /já\/nei/);
});

test("approve: refused without a valid login token, and for a non-approver role", async () => {
  const bad = await run(post({ action: "approve", table: "contact", me: ME, t: "nope" }), {});
  assert.equal(bad.res.statusCode, 403);
  assert.equal(patches(bad.calls).length, 0);
  const { skrifstofaDayToken } = await import("../api/skrifstofa-login.js");
  const t = skrifstofaDayToken("leynd", ME, 0);
  const staff = (title, type) => (c) => (c.url.includes("tblhglpjQkczdG1AY") ? { status: 200, body: { records: [{ id: ME, fields: { "Starfsheiti 💼": title, "Tegund starfsmanns 🧑‍💻": type } }] } } : undefined);
  const floor = await run(post({ action: "approve", table: "contact", me: ME, t }), {}, staff("Verkstjóri", "Fast ráðinn 👷"));
  assert.equal(floor.res.statusCode, 403);
  const rakel = await run(post({ action: "approve", table: "contact", me: ME, t }), {}, staff("Sölumaður / Arkitekt", "Fast ráðinn 👷"));
  assert.equal(rakel.res.statusCode, 200);
  const p = patches(rakel.calls);
  assert.equal(p.length, 1);
  assert.match(p[0].url, new RegExp(CONTACTS + "/" + T + "$"));
  assert.deepEqual(p[0].body.fields, { [PENDING[CONTACTS]]: false });
});
