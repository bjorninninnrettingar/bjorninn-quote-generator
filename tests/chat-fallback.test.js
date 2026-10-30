// Chat cost + resilience (2026-10-30): any upstream failure → a friendly 200 payload with the contact link (never the
// raw Anthropic error), history is capped, greetings skip the model, usage is logged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import handler, { fallbackPayload, shortCircuit, _resetChatLimiter } from "../api/chat.js";

const CONTACT = "https://www.bjorninninnrettingar.is/haf%C3%B0u-samband";
const SECRET = "Your credit balance is too low SECRET-RAW-TEXT";
const MSG = [{ role: "user", content: "hvað tekur ferlið langan tíma?" }];
function call(body) {
  const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  const req = { method: "POST", headers: { "x-forwarded-for": "8.8.8." + Math.floor(Math.random() * 250) }, body };
  return handler(req, res).then(() => res);
}
async function withFetch(impl, fn) {
  const prev = process.env.ANTHROPIC_API_KEY, realFetch = globalThis.fetch, realErr = console.error, realLog = console.log;
  process.env.ANTHROPIC_API_KEY = "test"; globalThis.fetch = impl; _resetChatLimiter();
  const errs = [], logs = []; console.error = (...a) => errs.push(a.join(" ")); console.log = (...a) => logs.push(a.join(" "));
  try { return await fn({ errs, logs }); }
  finally { globalThis.fetch = realFetch; console.error = realErr; console.log = realLog; prev === undefined ? delete process.env.ANTHROPIC_API_KEY : (process.env.ANTHROPIC_API_KEY = prev); }
}
const ok = (text, usage) => async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text }], usage, stop_reason: "end_turn" }) });
const bad = (status, body) => async () => ({ ok: false, status, json: async () => body });

test("upstream 402 / 400 billing / 429 / 500 / 529 → friendly payload, no raw error text, contact link", async () => {
  for (const [status, body] of [[402, { error: { type: "billing_error", message: SECRET } }], [400, { error: { type: "invalid_request_error", message: SECRET } }], [429, { error: { message: SECRET } }], [500, { error: { message: SECRET } }], [529, { error: { type: "overloaded_error", message: SECRET } }]]) {
    await withFetch(bad(status, body), async ({ errs }) => {
      const r = await call({ messages: MSG });
      assert.equal(r.code, 200, String(status));
      assert.match(r.body.answer, /Því miður get ég ekki svarað núna/);
      assert.equal(r.body.escalate, true);
      assert.deepEqual(r.body.links.map((l) => l.url), [CONTACT]);
      assert.ok(!JSON.stringify(r.body).includes("SECRET"), "raw upstream text must not reach the client");
      assert.ok(errs.some((e) => e.includes("SECRET")), "real error is logged server-side");
    });
  }
});

test("network error, timeout (abort), non-JSON body and garbage model output → same friendly payload", async () => {
  const cases = [
    async () => { throw new Error("ECONNRESET SECRET"); },
    async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; },
    async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError("Unexpected token < SECRET"); } }),
    ok("þetta er ekki JSON"),
    ok(""),
    ok('{"answer": "   ", "escalate": false}'),
  ];
  for (const f of cases) await withFetch(f, async () => {
    const r = await call({ messages: MSG });
    assert.equal(r.code, 200);
    assert.equal(r.body.degraded, true);
    assert.deepEqual(r.body.links.map((l) => l.url), [CONTACT]);
    assert.ok(!JSON.stringify(r.body).includes("SECRET"));
  });
});

test("missing API key → friendly payload, not a 500 with config text", async () => {
  await withFetch(ok("{}"), async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await call({ messages: MSG });
    assert.equal(r.code, 200); assert.equal(r.body.degraded, true);
  });
});

test("Studio (is/en, email only, no phone/contact page) and staff fallbacks", async () => {
  await withFetch(bad(402, { error: { message: SECRET } }), async () => {
    const is = await call({ messages: MSG, context: { app: "studio" } });
    assert.match(is.body.answer, /bjorninn@bjorninninnrettingar\.is/); assert.equal(is.body.links.length, 0); assert.equal(is.body.escalate, true);
    const en = await call({ messages: MSG, context: { app: "studio", lang: "en" } });
    assert.match(en.body.answer, /Sorry, I can't answer right now/);
    process.env.VERK_KEY = "office-key-for-test";
    const st = await call({ messages: MSG, context: { app: "labels" }, k: "office-key-for-test" });
    assert.equal(st.code, 200); assert.match(st.body.answer, /Spurðu Ísak eða Rakel/); assert.equal(st.body.escalate, false);
    delete process.env.VERK_KEY;
  });
  assert.deepEqual(fallbackPayload("public").links.map((l) => l.url), [CONTACT]);
});

test("a good reply is unchanged, and usage is logged without the conversation", async () => {
  await withFetch(ok('{"answer":"Ferlið tekur nokkrar vikur.","escalate":false,"links":["ferli"]}', { input_tokens: 12, cache_read_input_tokens: 7800, cache_creation_input_tokens: 0, output_tokens: 40 }), async ({ logs }) => {
    const r = await call({ messages: MSG });
    assert.equal(r.body.answer, "Ferlið tekur nokkrar vikur."); assert.equal(r.body.escalate, false); assert.ok(!r.body.degraded);
    const u = JSON.parse(logs.find((l) => l.includes("chat_usage"))).chat_usage;
    assert.deepEqual([u.bot, u.input, u.cache_read, u.cache_creation, u.output], ["public", 12, 7800, 0, 40]);
    assert.ok(!logs.join("").includes("ferlið tekur"), "no conversation text in logs");
  });
});

test("only the last 6 messages reach the model, starting with a user turn", async () => {
  let sent;
  const many = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
  await withFetch(async (u, o) => { sent = JSON.parse(o.body); return ok('{"answer":"x","escalate":false,"links":[]}')(); }, async () => {
    await call({ messages: many });
    assert.ok(sent.messages.length >= 5 && sent.messages.length <= 6);
    assert.equal(sent.messages[0].role, "user");
    assert.equal(sent.messages.at(-1).content, "m10");
  });
});

test("greetings and thanks never call the model; real questions do", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return ok('{"answer":"x","escalate":false,"links":[]}')(); }, async () => {
    for (const t of ["Hæ!", "halló", "  Takk fyrir 👍", "góðan daginn"]) {
      const r = await call({ messages: [{ role: "user", content: t }] });
      assert.equal(r.code, 200); assert.equal(r.body.escalate, false);
    }
    assert.equal(calls, 0);
    await call({ messages: [{ role: "user", content: "hæ, hvað kostar eldhús?" }] });
    assert.equal(calls, 1);
  });
  assert.equal(shortCircuit("hvað kostar þetta", "public"), null);
});

test("widget: every failure path shows the same local apology (works with the endpoint down)", () => {
  const src = fs.readFileSync(new URL("../chat-widget.js", import.meta.url), "utf8");
  assert.equal((src.match(/Því miður get ég ekki svarað núna/g) || []).length, 3, "staff, public, studio-is");
  assert.match(src, /I can't answer right now/);
  assert.match(src, /if \(!res\.ok\) throw new Error/);
  assert.match(src, /\.catch\(function \(\) \{[\s\S]{0,200}GENERIC_ERROR/);
  assert.match(src, /AbortController/);
});
