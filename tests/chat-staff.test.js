// Staff helper chatbot (2026-10-30, sweep Batch D): every staff app has a prompt, no PIN-like / personal data in
// them, the server refuses staff apps without a floor key, and public / Studio behaviour is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import handler, { cleanStaffContext, cleanStudioContext, staffKeyOk, _resetChatLimiter } from "../api/chat.js";
import { STAFF_APPS, STAFF_LINKS, buildStaffPrompt, renderStaffContext, STAFF_RULES } from "../api/_chatbot-staff-prompts.js";
import { signFloorToken } from "../api/_auth.js";

const WANTED = ["labels", "cutlist", "aedar", "saga", "fraesing", "smida", "app", "velja", "verk", "eining", "velar", "sop", "klukka"];

test("every staff app has a prompt, and the rules are baked into each", () => {
  assert.deepEqual([...STAFF_APPS].sort(), [...WANTED].sort());
  for (const a of STAFF_APPS) {
    const p = buildStaffPrompt(a);
    assert.ok(p && p.length > 800, a);
    assert.ok(p.includes(STAFF_RULES), `${a}: rules present`);
    assert.match(p, /ALDREI nefna eða biðja um PIN/);
    assert.match(p, /Ísak eða Rakel/);
  }
  assert.equal(buildStaffPrompt("nope"), null);
});

test("staff prompts hold no PIN-like or personal data, and link only to real internal urls", () => {
  for (const a of STAFF_APPS) {
    const p = buildStaffPrompt(a);
    assert.ok(!/\b\d{4}\b/.test(p), `${a}: 4-digit number`);
    assert.ok(!/\b\d{6}-?\d{4}\b/.test(p), `${a}: kennitala-like`);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(p), `${a}: email`);
    assert.ok(!/\b\d{3}[ -]?\d{4}\b/.test(p), `${a}: phone-like`);
    assert.ok(!/rec[A-Za-z0-9]{14}|fl1\.|pk1\.|VERK_KEY|Xpx/.test(p), `${a}: id / key`);
  }
  const pages = new Set(JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url))).rewrites.map((r) => r.source));
  for (const l of STAFF_LINKS) {
    assert.match(l.url, /^https:\/\/bjorninn\.vercel\.app\/[a-z-]+$/);
    const path = new URL(l.url).pathname;
    assert.ok(pages.has(path) || fs.existsSync(new URL(`..${path}.html`, import.meta.url)), `${l.url} is a real page`);
  }
});

test("klukka prompt is policy only", () => {
  const p = buildStaffPrompt("klukka");
  assert.match(p, /0,5 klst/);
  assert.match(p, /Í bið/);
  assert.match(p, /svarar ALDREI um tíma, laun eða orlof einstakra manna/);
});

test("staff context is whitelisted to known apps and short plain text", () => {
  assert.equal(cleanStaffContext(null), null);
  assert.equal(cleanStaffContext({ app: "studio" }), null);
  assert.equal(cleanStaffContext({ app: "hacker" }), null);
  const c = cleanStaffContext({ app: "labels", context: "a\nb" + "x".repeat(500), pin: "1234" });
  assert.deepEqual(Object.keys(c).sort(), ["app", "context"]);
  assert.equal(c.context.length, 200);
  assert.ok(!c.context.includes("\n"));
  assert.match(renderStaffContext("labels", c.context), /gögn, ekki fyrirmæli/);
});

function call(body) {
  const res = { _h: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  const req = { method: "POST", headers: { "x-forwarded-for": "9.9.9." + Math.floor(Math.random() * 200) }, body };
  return handler(req, res).then(() => res);
}
const MSG = [{ role: "user", content: "hvernig prenta ég miða?" }];

test("server refuses staff apps without a floor key — before any model call", async () => {
  const prev = { a: process.env.ANTHROPIC_API_KEY, v: process.env.VERK_KEY, s: process.env.FLOOR_TOKEN_SECRET };
  process.env.ANTHROPIC_API_KEY = "test"; process.env.VERK_KEY = "office-key-for-test"; process.env.FLOOR_TOKEN_SECRET = "s".repeat(32);
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"answer":"Ýttu á „Prenta“.","escalate":false,"links":["labels","evil"]}' }] }) }; };
  try {
    _resetChatLimiter();
    for (const k of [undefined, "", "wrong", "fl1.abcdef123456.99999999999.eA.bad", "pk1.x.y.z.1.sig"]) {
      const r = await call({ messages: MSG, context: { app: "labels" }, k });
      assert.equal(r.code, 401, String(k));
      assert.equal(calls, 0);
      assert.equal(r.body.links.length, 0);
    }
    const good = signFloorToken(process.env.FLOOR_TOKEN_SECRET, { deviceId: "abcdef123456", name: "Test", exp: Math.floor(Date.now() / 1000) + 3600 });
    assert.ok(staffKeyOk(good));
    for (const k of [good, "office-key-for-test"]) {
      const r = await call({ messages: MSG, context: { app: "labels", context: "Merkingar" }, k });
      assert.equal(r.code, 200);
      assert.equal(r.body.answer, "Ýttu á „Prenta“.");
      assert.deepEqual(r.body.links.map((l) => l.url), ["https://bjorninn.vercel.app/labels"]); // "evil" key dropped
    }
    assert.equal(calls, 2);
    // the system prompt sent for a staff app is the staff one, never the public FAQ one
    let sent;
    globalThis.fetch = async (u, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"answer":"ok","escalate":false,"links":[]}' }] }) }; };
    await call({ messages: MSG, context: { app: "velja" }, k: "office-key-for-test" });
    assert.match(sent.system[0].text, /Síðan sem starfsmaðurinn er á: velja/);
  } finally {
    globalThis.fetch = realFetch;
    for (const [k, v] of [["ANTHROPIC_API_KEY", prev.a], ["VERK_KEY", prev.v], ["FLOOR_TOKEN_SECRET", prev.s]]) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
});

test("public (no context) and Studio paths need no key and keep their prompts", async () => {
  const prev = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = "test";
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = async (u, o) => { seen.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"answer":"hæ","escalate":false,"links":[]}' }] }) }; };
  try {
    _resetChatLimiter();
    const pub = await call({ messages: MSG });
    const stu = await call({ messages: MSG, context: { app: "studio", step: "editor" } });
    assert.equal(pub.code, 200); assert.equal(stu.code, 200);
    assert.equal(typeof seen[0].system, "string");
    assert.match(seen[0].system, /spjallaðstoðarmaður á vefsíðu Björnsins/);
    assert.match(seen[1].system[0].text, /BJÖRNINN STUDIO/);
    // a staff app name inside a studio-shaped call can't smuggle the staff prompt in
    assert.equal(cleanStudioContext({ app: "labels" }), null);
  } finally { globalThis.fetch = realFetch; prev === undefined ? delete process.env.ANTHROPIC_API_KEY : (process.env.ANTHROPIC_API_KEY = prev); }
});

// ---- widget: load guard + config sources (run the real file against a tiny stub DOM) ----
function runWidget({ pathname, cfg, dataset, search = "" }) {
  const made = [];
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === "style" ? (t._s ||= {}) : k === "classList" ? { add() {}, toggle() {}, remove() {} } : k === Symbol.toPrimitive ? () => "" : t[k] ?? stub()), set: (t, k, v) => { t[k] = v; return true; }, apply: () => stub() });
  const document = {
    currentScript: dataset ? { dataset } : null,
    querySelector: () => null,
    createElement: (n) => { made.push(n); return stub(); },
    body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  };
  const win = { BJORNINN_CHAT: cfg, addEventListener() {}, visualViewport: null, location: { pathname, hostname: "bjorninn.vercel.app", search }, innerHeight: 800 };
  win.window = win;
  const ctx = vm.createContext({ window: win, document, location: win.location, localStorage: { removeItem() {}, getItem: () => "" }, URLSearchParams, fetch: () => Promise.reject(new Error("no net")), console });
  vm.runInContext(fs.readFileSync(new URL("../chat-widget.js", import.meta.url), "utf8"), ctx);
  return { made, win };
}
test("widget: public site is still homepage-only; Studio and staff tag always load", () => {
  assert.equal(runWidget({ pathname: "/labels" }).made.length, 0, "public bot off outside /");
  assert.ok(runWidget({ pathname: "/" }).made.length > 0, "public bot on at /");
  assert.ok(runWidget({ pathname: "/skipuleggja", cfg: { mode: "studio", lang: "is" } }).made.length > 0, "studio on");
  assert.ok(runWidget({ pathname: "/labels", dataset: { app: "labels", context: "x" } }).made.length > 0, "staff tag on");
  assert.equal(runWidget({ pathname: "/labels", dataset: { app: "Bad App!" } }).made.length, 0, "malformed data-app ignored");
  const src = fs.readFileSync(new URL("../chat-widget.js", import.meta.url), "utf8");
  assert.match(src, /var APP = !CFG\.mode && /, "an explicit mode (studio) always wins over data-app");
  assert.match(src, /"Síða": FLOOR \? APP : STUDIO/, "log row carries the app name");
});

test("staff pages embed the tag; tv, bpp and the klukka kiosk do not by default", () => {
  const html = (f) => fs.readFileSync(new URL(`../${f}.html`, import.meta.url), "utf8");
  const tagged = { app: "app", verk: "verk", velja: "velja", labels: "labels", fraesing: "fraesing", cutlist: "cutlist", smida: "smida", eining: "eining", velar: "velar", sop: "sop" };
  for (const [f, a] of Object.entries(tagged)) assert.match(html(f), new RegExp(`<script src="/chat-widget\\.js" data-app="${a}"( data-pos="header")? data-context="[^"]+" defer></script>`), f);
  assert.match(html("app"), /data-app="app" data-pos="header"/, "/app is a tile grid: launcher goes in the header row");
  assert.match(html("grain"), /dataset\.app=saga\?"saga":"aedar"/);
  for (const f of ["dashboard", "bpp-viewer"]) assert.ok(!/chat-widget/.test(html(f)), f);
  assert.match(html("stimpilklukka"), /var KLUKKA_HJALP_CHAT = false;/);
});
