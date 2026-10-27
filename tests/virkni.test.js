import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { cleanLink, visibleTo, chatText } from "../api/virkni.js";

const HOOK = "https://chat.googleapis.com/v1/spaces/X/messages?key=a&token=b";
function call(req, env, fetchImpl) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return fetchImpl(String(url), opts); };
  let status, json;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; }, setHeader() {} };
  return handler(req, res).finally(() => {
    global.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }).then(() => ({ status, json, calls }));
}
const ENV = { VERK_KEY: "lykill", AIRTABLE_TOKEN: "x", GOOGLE_CHAT_WEBHOOK_ALMENNT: HOOK, GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA: undefined };
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });
const T = "recAAAAAAAAAAAAAA";
const post = (body) => ({ method: "POST", body });

test("links are in-app paths only, never a host or a key", () => {
  assert.equal(cleanLink("/verk?t=" + T), "/verk?t=" + T);
  assert.equal(cleanLink(""), "");
  assert.equal(cleanLink("https://evil.example"), null);
  assert.equal(cleanLink("//evil.example/x"), null);
  assert.equal(cleanLink("/verk?t=" + T + "&k=secret"), null);
  assert.equal(cleanLink("/x<script>"), null);
});

test("each role sees its own lines plus Allir; untagged old lines are office-only", () => {
  assert.ok(visibleTo("Verkstæði", "Allir"));
  assert.ok(visibleTo("Verkstæði", "Verkstæði"));
  assert.ok(!visibleTo("Verkstæði", "Skrifstofa"));
  assert.ok(!visibleTo("Verkstæði", ""));
  assert.ok(visibleTo("Skrifstofa", ""));
});

test("chat text links to our own origin", () => {
  const s = chatText({ texti: "Klárt", projectName: "T-1", hver: "Rakel", tengill: "/verk?t=" + T });
  assert.match(s, /<https:\/\/bjorninn\.vercel\.app\/verk\?t=rec/);
});

test("wrong key is refused before Airtable is touched (GET and POST)", async () => {
  const g = await call({ method: "GET", query: { k: "rangt" } }, ENV, () => { throw new Error("no"); });
  const p = await call(post({ k: "rangt", texti: "x", tegund: "klart", til: "Allir" }), ENV, () => { throw new Error("no"); });
  assert.equal(g.status, 403); assert.equal(p.status, 403);
  assert.equal(g.calls.length + p.calls.length, 0);
});

test("bad tegund / til / link are refused without writing", async () => {
  for (const body of [
    { texti: "x", tegund: "hack", til: "Allir" },
    { texti: "x", tegund: "klart", til: "Allt" },
    { texti: "x", tegund: "klart", til: "Allir", tengill: "https://evil.example" },
    { texti: "", tegund: "klart", til: "Allir" },
  ]) {
    const r = await call(post({ k: "lykill", ...body }), ENV, () => { throw new Error("no"); });
    assert.equal(r.status, 400);
    assert.equal(r.calls.length, 0);
  }
});

test("POST writes one Virkni line and posts to the ALMENNT chat from the server", async () => {
  const r = await call(post({ k: "lykill", texti: "Klárt til framleiðslu", tegund: "klart", til: "Allir", t: T, tengill: "/verk?t=" + T, hver: "Rakel", chat: true }), ENV,
    async (url, opts) => {
      if (url.startsWith("https://chat.googleapis.com")) return { ok: true, status: 200, json: async () => ({}) };
      if (opts.method === "POST") return okJson({ id: "recNEWNEWNEWNEWNE", fields: {} });
      return okJson({ fields: { "Heiti tækifæris / verkefnis": "T-1 | Prófun" } });
    });
  assert.equal(r.status, 200);
  assert.equal(r.json.chat, "sent");
  const write = r.calls.find((c) => c.url.includes("tblPPMTlFhW0snk24") && c.opts.method === "POST");
  const f = JSON.parse(write.opts.body).fields;
  assert.deepEqual(f["Tækifæri"], [T]);
  assert.equal(f["Tengill"], "https://bjorninn.vercel.app/verk?t=" + T);
  assert.equal(f["Til"], "Allir");
  const chat = r.calls.find((c) => c.url === HOOK);
  assert.match(JSON.parse(chat.opts.body).text, /T-1 \| Prófun/);
});

test("no webhook env var → line still written, chat skipped", async () => {
  const r = await call(post({ k: "lykill", texti: "x", tegund: "klart", til: "Skrifstofa", chat: true }), ENV,
    async () => okJson({ id: "recNEWNEWNEWNEWNE" }));
  assert.equal(r.status, 200);
  assert.equal(r.json.chat, "no-webhook");
  assert.equal(r.calls.length, 1);
});

test("a status echo never goes to chat even if asked", async () => {
  const r = await call(post({ k: "lykill", texti: "x", tegund: "staða", til: "Allir", chat: true }), ENV,
    async () => okJson({ id: "recNEWNEWNEWNEWNE" }));
  assert.equal(r.json.chat, "off");
  assert.equal(r.calls.some((c) => c.url.startsWith("https://chat.googleapis.com")), false);
});

test("GET filters by role and project", async () => {
  const recs = [
    { id: "r1", fields: { "Texti": "a", "Til": "Allir", "Tækifæri": [T] } },
    { id: "r2", fields: { "Texti": "b", "Til": "Skrifstofa" } },
    { id: "r3", fields: { "Texti": "c", "Til": "Verkstæði", "Tengill": "https://bjorninn.vercel.app/app#qf" } },
  ];
  const r = await call({ method: "GET", query: { k: "lykill", til: "Verkstæði" } }, ENV, async () => okJson({ records: recs }));
  assert.deepEqual(r.json.items.map((i) => i.id), ["r1", "r3"]);
  assert.equal(r.json.items[1].tengill, "/app#qf");
  const p = await call({ method: "GET", query: { k: "lykill", til: "Skrifstofa", t: T } }, ENV, async () => okJson({ records: recs }));
  assert.deepEqual(p.json.items.map((i) => i.id), ["r1"]);
});

test("GET til=Allt (the office panel) returns every line", async () => {
  const recs = [{ id: "a", fields: { "Til": "Verkstæði" } }, { id: "b", fields: {} }, { id: "c", fields: { "Til": "Allir" } }];
  const r = await call({ method: "GET", query: { k: "lykill", til: "Allt" } }, ENV, async () => okJson({ records: recs }));
  assert.deepEqual(r.json.items.map((i) => i.id), ["a", "b", "c"]);
});
