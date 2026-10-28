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

const READY = { [F.stage]: SENT, [F.tilbod]: [{ filename: "t.pdf", url: "u" }], [F.skipting]: "100%", [F.contacts]: ["recCCCCCCCCCCCCCC"], [F.name]: "T-1 | X" };
const withKt = (kt) => (c) => (c.url.includes(CONTACTS) ? { status: 200, body: { id: "recCCCCCCCCCCCCCC", fields: { "Kennitala 👤#️⃣": kt } } } : undefined);

test("Unnið ticks the checkbox the Airtable automation listens to, plus the status, by field id", async () => {
  const { res, calls } = await run(post({ action: "unnid" }), READY, withKt("010190-1239"));
  assert.equal(res.statusCode, 200);
  const p = patches(calls);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].body.fields, { [F.won]: true, [F.lost]: false, [F.stage]: WON });
  assert.match(p[0].url, /tbl4LMXlQjp66RFKI\/recAAAAAAAAAAAAAA$/);
});

test("Unnið is refused, naming exactly what is missing (PDF, Skipting, kennitala, contact)", async () => {
  assert.match(refusal("unnid", { [F.stage]: SENT }), /Tilboð til sendingar.*Skipting greiðslu.*tengiliður/);
  const noPdf = await run(post({ action: "unnid" }), { ...READY, [F.tilbod]: undefined }, withKt("0101901239"));
  assert.equal(noPdf.res.statusCode, 409);
  assert.match(noPdf.res.body.error, /Tilboð til sendingar/);
  assert.doesNotMatch(noPdf.res.body.error, /Skipting|kennitala/);
  const noKt = await run(post({ action: "unnid" }), READY, withKt("12345"));
  assert.equal(noKt.res.statusCode, 409);
  assert.match(noKt.res.body.error, /kennitala tengiliðs/);
  assert.equal(patches(noKt.calls).length, 0);
  const noSplit = await run(post({ action: "unnid" }), { ...READY, [F.skipting]: undefined }, withKt("0101901239"));
  assert.match(noSplit.res.body.error, /Skipting greiðslu/);
});

test("Unnið announces itself through Virkni + the env chat webhook; a missing webhook never fails it", async () => {
  Object.assign(process.env, { GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA: "https://chat.googleapis.com/v1/spaces/X/messages?key=fake" });
  const on = await run(post({ action: "unnid" }), READY, (c) => withKt("0101901239")(c) || (c.url.includes("chat.googleapis") ? { status: 200, body: {} } : undefined));
  assert.equal(on.res.statusCode, 200);
  const virkni = on.calls.find((c) => c.method === "POST" && c.url.includes("tblPPMTlFhW0snk24"));
  assert.match(virkni.body.fields.Texti, /UNNIÐ/);
  assert.deepEqual(virkni.body.fields["Tækifæri"], [T]);
  const chat = on.calls.find((c) => c.url.includes("chat.googleapis"));
  assert.match(chat.body.text, /UNNIÐ.*\n.*T-1/);
  delete process.env.GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA;
  const off = await run(post({ action: "unnid" }), READY, withKt("0101901239"));
  assert.equal(off.res.statusCode, 200);
  assert.equal(off.calls.filter((c) => c.url.includes("chat.googleapis")).length, 0);
});

test("Afturkalla Unnið: owner only; refused after payments / Konto G1 draft / further in planning; reverses the checkbox + stage + amount", async () => {
  const won = { ...READY, [F.stage]: WON, [F.planning]: "For-skipulag", [F.confirmed]: 900000 };
  assert.match(refusal("afturkalla", { [F.stage]: SENT }), /ekki merkt unnið/);
  assert.match(refusal("afturkalla", { ...won, [F.g2]: true }), /Greiðsla 2/);
  assert.match(refusal("afturkalla", { ...won, [F.log]: "27.10 · G1 · drög abc" }), /G1-drög/);
  assert.match(refusal("afturkalla", { ...won, [F.planning]: "Klárt til framleiðslu" }), /Klárt til framleiðslu/);
  assert.equal(refusal("afturkalla", won), null);
  assert.deepEqual(patchesFor("afturkalla", won), [{ [F.won]: false, [F.stage]: SENT, [F.planning]: null, [F.confirmed]: null }]);
  const { skrifstofaDayToken } = await import("../api/skrifstofa-login.js");
  const t = skrifstofaDayToken("leynd", ME, 0);
  const staff = (title, type) => (c) => (c.url.includes("tblhglpjQkczdG1AY") ? { status: 200, body: { records: [{ id: ME, fields: { "Starfsheiti 💼": title, "Tegund starfsmanns 🧑‍💻": type } }] } } : undefined);
  const rakel = await run(post({ action: "afturkalla", me: ME, t }), won, staff("Sölumaður / Arkitekt", "Fast ráðinn 👷"));
  assert.equal(rakel.res.statusCode, 403);
  assert.equal(patches(rakel.calls).length, 0);
  const owner = await run(post({ action: "afturkalla", me: ME, t }), won, staff("Framkvæmdastjóri", "Eigandi 👨🏻‍💼"));
  assert.equal(owner.res.statusCode, 200);
  assert.ok(owner.res.body.notReverted.length >= 3);
  assert.deepEqual(patches(owner.calls)[0].body.fields, { [F.won]: false, [F.stage]: SENT, [F.planning]: null, [F.confirmed]: null });
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

test("Fyrirspurnir: list needs the key and never shows Afgreitt; status only takes the field's own choices", async () => {
  const { VEFSPJALL, V } = await import("../api/sala.js");
  const noKey = await run({ method: "GET", query: { list: "fyrirspurnir" } }, {});
  assert.equal(noKey.res.statusCode, 403);
  assert.equal(noKey.calls.length, 0);
  const rows = { records: [{ id: "recV", createdTime: "2026-10-27T10:00:00Z", fields: { [V.email]: "a@b.is", [V.talk]: "x".repeat(9000) } }] };
  const ok = await run({ method: "GET", query: { k: "lykill", list: "fyrirspurnir" } }, {}, (c) => (c.url.includes(VEFSPJALL) ? { status: 200, body: rows } : undefined));
  assert.equal(ok.res.statusCode, 200);
  assert.match(decodeURIComponent(ok.calls[0].url), /!='Afgreitt'/);
  assert.equal(ok.res.body.records[0].email, "a@b.is");
  assert.equal(ok.res.body.records[0].talk.length, 6000);
  const bad = await run(post({ action: "fyrirspurn", value: "Eytt" }), {});
  assert.equal(bad.res.statusCode, 409);
  assert.equal(patches(bad.calls).length, 0);
  const good = await run(post({ action: "fyrirspurn", value: "Afgreitt" }), {});
  assert.deepEqual(patches(good.calls)[0].body.fields, { [V.status]: "Afgreitt" });
  assert.match(patches(good.calls)[0].url, new RegExp(VEFSPJALL + "/"));
});

test("Verðstillingar: only the 5 price fields, discounts 0–50 %, locked once the deal is won", async () => {
  assert.equal(refusal("verd", {}, { fields: { osynilegur: 0.1, uppsetning: true, skipting: "50% - 50%", ferdir: null } }), null);
  assert.match(refusal("verd", {}, { fields: { osynilegur: 10 } }), /0–50/);
  assert.match(refusal("verd", {}, { fields: { "Staða í söluferli": "x" } }), /Óþekktur/);
  assert.match(refusal("verd", {}, { fields: {} }), /Óþekktur/);
  assert.match(refusal("verd", {}, { fields: { skipting: "30%" } }), /Óþekkt gildi/);
  assert.match(refusal("verd", { [F.stage]: WON }, { fields: { uppsetning: true } }), /læstar/);
  const { calls } = await run(post({ action: "verd", fields: { afslUpps: 0.2, ferdir: "2 Ferðir 🚚🚚" } }), {});
  assert.deepEqual(patches(calls)[0].body.fields, { [F.afslUpps]: 0.2, [F.ferdir]: "2 Ferðir 🚚🚚" });
});

test("Tengja tengilið appends to the existing contacts, never replaces or duplicates", async () => {
  const C1 = "recCCCCCCCCCCCCC1", C2 = "recCCCCCCCCCCCCC2";
  assert.match(refusal("tengilid", { [F.contacts]: [C1] }, { contactId: C1 }), /þegar/);
  assert.match(refusal("tengilid", {}, { contactId: "x" }), /Ógildur/);
  const { calls } = await run(post({ action: "tengilid", contactId: C2 }), { [F.contacts]: [C1] });
  assert.deepEqual(patches(calls)[0].body.fields, { [F.contacts]: [C1, C2] });
});
