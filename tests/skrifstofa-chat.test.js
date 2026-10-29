// Office helper chatbot (api/skrifstofa-chat.js): VERK key required, read-only Airtable (GET only), links built
// server-side from page keys / ids a tool returned this request, validated queries, rate limit.
import test from "node:test";
import assert from "node:assert/strict";
import handler, { buildReply, cleanQuery, searchFormula, validateMessages, runTool, shapeProject, skrifstofaRateLimited, _resetSkrifstofaLimiter, TOOLS } from "../api/skrifstofa-chat.js";
import { PAGES, PAGE_MAP, projectLinks, buildSkrifstofaPrompt } from "../api/_skrifstofa-prompt.js";

const ID = "recAAAAAAAAAAAAAA";
const ID2 = "recBBBBBBBBBBBBBB";
const proj = { id: ID, t: "T-32", nafn: "T-32 - Jón", framleidsla: "Í vinnslu" };

function mockRes() {
  return { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
function withEnv(fn) {
  const old = { v: process.env.VERK_KEY, a: process.env.ANTHROPIC_API_KEY, t: process.env.AIRTABLE_TOKEN, f: globalThis.fetch };
  process.env.VERK_KEY = "secretkey"; process.env.ANTHROPIC_API_KEY = "sk-test"; process.env.AIRTABLE_TOKEN = "pat-test";
  _resetSkrifstofaLimiter();
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of [["VERK_KEY", old.v], ["ANTHROPIC_API_KEY", old.a], ["AIRTABLE_TOKEN", old.t]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    globalThis.fetch = old.f;
  });
}
const post = (body, headers = {}) => ({ method: "POST", body, headers: { "x-forwarded-for": "1.2.3.4", ...headers } });
const msgs = [{ role: "user", content: "hvar er T-32" }];

test("auth: no key, wrong key and a floor-style token are refused before any fetch", () => withEnv(async () => {
  let fetched = 0; globalThis.fetch = async () => { fetched++; return { ok: true, json: async () => ({}) }; };
  for (const k of [undefined, "", "nope", "fl1.abc.def"]) {
    const res = mockRes(); await handler(post({ k, messages: msgs }), res);
    assert.equal(res.code, 403);
  }
  const res = mockRes(); await handler({ method: "GET", body: {}, headers: {} }, res);
  assert.equal(res.code, 405);
  assert.equal(fetched, 0);
}));

test("input validation: shape, length cap, must end with user", () => {
  assert.ok(validateMessages([]).error);
  assert.ok(validateMessages([{ role: "system", content: "x" }]).error);
  assert.ok(validateMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]).error);
  assert.ok(validateMessages(Array.from({ length: 17 }, () => ({ role: "user", content: "x" }))).error);
  assert.equal(validateMessages([{ role: "user", content: "x".repeat(5000) }]).messages[0].content.length, 1000);
});

test("search query: only safe characters reach the Airtable formula", () => {
  assert.equal(cleanQuery('T-32"), TRUE(), "x'), "t-32 true x");
  assert.equal(searchFormula("a"), null);
  const f = searchFormula('x"),OR(1,"');
  assert.ok(!/["']/.test(f.replace(/^SEARCH\("|"\,LOWER.*$/g, "")), f);
  assert.match(searchFormula("T-32"), /FIND\("t-32 "/);
  assert.match(searchFormula("t32"), /FIND\("t-32 "/);
  assert.match(searchFormula("Jón"), /^SEARCH\("jón"/);
});

test("links: only whitelisted page keys and ids a tool returned in this request", () => {
  const seen = new Map([[ID, proj]]);
  const r = buildReply(JSON.stringify({ answer: "T-32 er í vinnslu.", pages: ["ferli", "evil", "http://x.is"], projects: [ID, ID2, "not-an-id", "recAAAAAAAAAAAAAA/../x"] }), seen);
  assert.equal(r.answer, "T-32 er í vinnslu.");
  const urls = r.links.map((l) => l.url);
  assert.ok(urls.includes(`/ferli?recordId=${ID}`) && urls.includes(`/framleidsla?recordId=${ID}`) && urls.includes(`/pontun?recordId=${ID}`));
  assert.ok(urls.includes("/ferli"));
  assert.ok(!urls.some((u) => u.includes(ID2) || u.includes("evil") || u.includes("http")));
  assert.ok(r.links.every((l) => l.url.startsWith("/")));
  assert.equal(new Set(urls).size, urls.length);
  // garbage / injected text never becomes a link
  assert.deepEqual(buildReply("bara texti", seen).links, []);
  const q = buildReply('{"answer": "Ýttu á „Keyra skipulag" núna.", "pages": ["ferli"]}', seen);
  assert.equal(q.answer, "Ýttu á „Keyra skipulag“ núna.");
});

test("project links: framleiðsla chip only when the project has a production status", () => {
  assert.equal(projectLinks({ id: ID, t: "T-1", framleidsla: "" }).length, 2);
  assert.equal(projectLinks({ id: ID, t: "T-1", framleidsla: "Í vinnslu" }).length, 3);
});

test("page table: every key unique, urls are same-origin paths, prompt lists them", () => {
  assert.equal(new Set(PAGES.map((p) => p.key)).size, PAGES.length);
  for (const p of PAGES) assert.match(p.url, /^\/[a-z\-\/]*$/);
  assert.ok(PAGE_MAP.has("ferli") && PAGE_MAP.has("framleidsla") && PAGE_MAP.has("crm") && PAGE_MAP.has("starfsmenn") && PAGE_MAP.has("pro"));
  const prompt = buildSkrifstofaPrompt("2026-10-29");
  for (const p of PAGES) assert.ok(prompt.includes(`"${p.key}"`), p.key);
  assert.match(prompt, /LESANDI/);
});

test("tools are tiny and Airtable is only ever read (GET)", async () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), ["find_project", "list_active_projects"]);
  await withEnv(async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method || "GET", auth: init.headers?.Authorization }); return { ok: true, json: async () => ({ records: [{ id: ID, fields: { "Heiti tækifæris / verkefnis": "T-32 - Jón", "Áætlaður afhendingardagur Björninn (internal)": "2026-10-01", "Staða í framleiðslu": "Í vinnslu" } }] }) }; };
    const a = await runTool("find_project", { query: "T-32" }, "2026-10-29");
    const b = await runTool("list_active_projects", {}, "2026-10-29");
    assert.equal(a.projects[0].t, "T-32");
    assert.equal(a.projects[0].late, true);
    assert.equal(b.late, 1);
    assert.deepEqual(await runTool("find_project", { query: "x" }, "2026-10-29"), { error: "query too short" });
    assert.deepEqual(await runTool("delete_everything", {}, "2026-10-29"), { error: "unknown tool" });
    assert.ok(calls.length >= 2 && calls.every((c) => c.method === "GET" && c.url.startsWith("https://api.airtable.com/") && c.auth === "Bearer pat-test"));
    assert.ok(!calls.some((c) => /pat-test/.test(c.url)));
  });
});

test("shapeProject: not late once Má afhenda / Afhent", () => {
  const mk = (fram) => shapeProject({ id: ID, fields: { "Heiti tækifæris / verkefnis": "T-9 - X", "Áætlaður afhendingardagur Björninn (internal)": "2026-01-01", "Staða í framleiðslu": fram } }, "2026-10-29").late;
  assert.equal(mk("Í vinnslu"), true);
  assert.equal(mk("Má Afhenda 🚚"), false);
  assert.equal(mk("Afhent (LOKIÐ ✅)"), false);
});

test("full flow: model calls find_project, reply links come from the tool result only", () => withEnv(async () => {
  const seenBodies = [];
  let round = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("anthropic.com")) {
      const b = JSON.parse(init.body); seenBodies.push(b);
      round++;
      if (round === 1) return { ok: true, json: async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "find_project", input: { query: "T-32" } }] }) };
      return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ answer: "T-32 er í framleiðslu.", pages: [], projects: [ID, ID2] }) }] }) };
    }
    assert.equal(init.method || "GET", "GET");
    return { ok: true, json: async () => ({ records: [{ id: ID, fields: { "Heiti tækifæris / verkefnis": "T-32 - Jón", "Staða í framleiðslu": "Í vinnslu" } }] }) };
  };
  const res = mockRes();
  await handler(post({ k: "secretkey", messages: msgs }), res);
  assert.equal(res.code, 200);
  assert.match(res.body.answer, /T-32/);
  assert.ok(res.body.links.some((l) => l.url === `/ferli?recordId=${ID}`));
  assert.ok(!res.body.links.some((l) => l.url.includes(ID2)));
  assert.equal(seenBodies[0].tools.length, 2);
}));

test("rate limit: 15 per minute per IP", () => {
  _resetSkrifstofaLimiter();
  const t = Date.now();
  for (let i = 0; i < 15; i++) assert.equal(skrifstofaRateLimited("9.9.9.9", t + i), false);
  assert.equal(skrifstofaRateLimited("9.9.9.9", t + 20), true);
  assert.equal(skrifstofaRateLimited("8.8.8.8", t + 20), false);
  assert.equal(skrifstofaRateLimited("9.9.9.9", t + 61000), false);
});
