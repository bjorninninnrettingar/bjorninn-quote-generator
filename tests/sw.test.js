// /app offline shell (sw.js): shell is cache-first, /api/* is never touched or cached, other pages network-first
// with a cached fallback, old caches are deleted when a new deploy's worker activates. Runs sw.js in a vm with an
// in-memory Cache Storage + scripted fetch — no browser, no network.
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SRC = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sw.js"), "utf8");
const ORIGIN = "https://x.test";

function norm(req, ignoreSearch) {
  const u = new URL(typeof req === "string" ? new URL(req, ORIGIN).href : req.url);
  return u.origin + u.pathname + (ignoreSearch ? "" : u.search);
}
function makeEnv(version, stores) {
  const handlers = {};
  const calls = [];
  const state = { online: true, routes: {} };
  const store = stores || new Map();
  const mkCache = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      match: async (req, o) => { const k = norm(req, o && o.ignoreSearch); for (const [kk, v] of m) if (norm(kk, o && o.ignoreSearch) === k) return v.clone(); return undefined; },
      put: async (req, res) => { m.set(norm(req), res); },
      add: async (p) => { const r = await ctx.fetch(new URL(p, ORIGIN).href); if (!r.ok) throw new Error("bad"); m.set(norm(p), r); },
    };
  };
  const caches = {
    open: async (n) => mkCache(n),
    keys: async () => [...store.keys()],
    delete: async (n) => store.delete(n),
    match: async (req) => { for (const n of store.keys()) { const r = await mkCache(n).match(req); if (r) return r; } return undefined; },
  };
  const ctx = {
    URL, Response, Request, Promise, Map,
    caches,
    self: { location: { href: ORIGIN + "/sw.js" + (version ? "?v=" + version : ""), origin: ORIGIN }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() { state.skipped = true; }, clients: { claim() { state.claimed = true; } } },
    fetch: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      calls.push(url);
      if (!state.online) throw new TypeError("offline");
      const p = new URL(url).pathname;
      const r = state.routes[p];
      if (!r) return new Response("nf", { status: 404 });
      const res = new Response(r.body ?? p, { status: 200, headers: { "content-type": "text/plain" } });
      Object.defineProperty(res, "type", { value: "basic" }); // what a same-origin fetch returns
      return res;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const run = async (type, extra) => {
    const ev = Object.assign({ waits: [], waitUntil(p) { this.waits.push(p); }, respondWith(p) { this.p = Promise.resolve(p); } }, extra);
    handlers[type](ev);
    await Promise.all(ev.waits);
    return ev;
  };
  const get = (p, o = {}) => run("fetch", { request: { url: ORIGIN + p, method: o.method || "GET", mode: o.mode || "cors", destination: o.destination || "" } });
  return { ctx, state, store, calls, run, get, handlers };
}
const SHELL_ROUTES = ["/app", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-192.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png", "/bjorninn-tokens.css", "/bjorninn-icons.js", "/floor-key.js", "/virkni-bell.js"];
const text = async (ev) => (await ev.p).text();

test("install precaches the shell, version comes from ?v= and names the caches", async () => {
  const e = makeEnv("abc123");
  SHELL_ROUTES.forEach((p) => (e.state.routes[p] = { body: "v1:" + p }));
  await e.run("install");
  assert.deepStrictEqual([...e.store.keys()], ["bj-shell-abc123"]);
  assert.strictEqual(e.store.get("bj-shell-abc123").size, SHELL_ROUTES.length);
  assert.ok(e.state.skipped);
});

test("install survives a missing asset", async () => {
  const e = makeEnv("abc");
  e.state.routes["/app"] = { body: "app" };
  await e.run("install");
  assert.strictEqual(e.store.get("bj-shell-abc").size, 1);
});

test("shell is served from cache first, even offline, and refreshed in the background when online", async () => {
  const e = makeEnv("v1");
  SHELL_ROUTES.forEach((p) => (e.state.routes[p] = { body: "old:" + p }));
  await e.run("install");
  e.calls.length = 0;
  e.state.routes["/app"] = { body: "new:/app" };
  const ev = await e.get("/app?x=1", { mode: "navigate", destination: "document" });
  assert.strictEqual(await text(ev), "old:/app", "cache-first answer");
  assert.ok(e.calls.some((u) => u.endsWith("/app?x=1")), "background revalidation ran");
  const ev2 = await e.get("/app", { mode: "navigate", destination: "document" });
  assert.strictEqual(await text(ev2), "new:/app", "next open shows the refreshed shell");
  e.state.online = false;
  for (const p of ["/app", "/bjorninn-tokens.css", "/icons/icon-192.png", "/icons/anything-new.png"]) {
    const o = await e.get(p, { mode: p === "/app" ? "navigate" : "cors" });
    assert.ok(o.p, p + " handled");
  }
  const off = await e.get("/app", { mode: "navigate" });
  assert.strictEqual(await text(off), "new:/app");
});

test("/api/* is never intercepted and never cached (live Airtable data)", async () => {
  const e = makeEnv("v1");
  e.state.routes["/api/airtable"] = { body: "live" };
  for (const p of ["/api/airtable?path=tbl1", "/api/virkni", "/api/version", "/api/todo"]) {
    const ev = await e.get(p);
    assert.strictEqual(ev.p, undefined, p + " must pass straight to the network");
  }
  assert.strictEqual([...e.store.values()].reduce((n, m) => n + m.size, 0), 0, "nothing stored");
});

test("writes and foreign hosts are left alone; Google fonts are cached forever", async () => {
  const e = makeEnv("v1");
  assert.strictEqual((await e.get("/app", { method: "POST" })).p, undefined);
  assert.strictEqual((await e.get("/api/airtable", { method: "PATCH" })).p, undefined);
  const other = await e.run("fetch", { request: { url: "https://api.airtable.com/v0/x", method: "GET", mode: "cors", destination: "" } });
  assert.strictEqual(other.p, undefined);
  e.state.routes["/css2"] = { body: "font-css" };
  const f1 = await e.run("fetch", { request: { url: "https://fonts.googleapis.com/css2", method: "GET", mode: "cors", destination: "style" } });
  assert.ok(f1.p);
});

test("other pages are network-first with a cached copy as the offline fallback; unknown pages fall back to the shell", async () => {
  const e = makeEnv("v1");
  e.state.routes["/app"] = { body: "shell" };
  e.state.routes["/labels"] = { body: "labels-live-1" };
  await e.run("install");
  assert.strictEqual(await text(await e.get("/labels", { mode: "navigate", destination: "document" })), "labels-live-1");
  e.state.routes["/labels"] = { body: "labels-live-2" };
  assert.strictEqual(await text(await e.get("/labels", { mode: "navigate", destination: "document" })), "labels-live-2", "online: always the fresh page");
  e.state.online = false;
  assert.strictEqual(await text(await e.get("/labels", { mode: "navigate", destination: "document" })), "labels-live-2", "offline: last copy");
  assert.strictEqual(await text(await e.get("/never-opened", { mode: "navigate", destination: "document" })), "shell", "offline + never opened: the app shell");
  const asset = await e.get("/data.bin", { destination: "image" });
  assert.strictEqual(asset.p, undefined, "images/other assets are not handled");
});

test("a new deploy deletes the old version's caches but keeps fonts", async () => {
  const e1 = makeEnv("old");
  SHELL_ROUTES.forEach((p) => (e1.state.routes[p] = { body: p }));
  await e1.run("install");
  e1.store.set("bj-fonts-v1", new Map([["x", new Response("f")]]));
  e1.store.set("bj-pages-old", new Map());
  e1.store.set("unrelated-cache", new Map());
  const e2 = makeEnv("new", e1.store);
  SHELL_ROUTES.forEach((p) => (e2.state.routes[p] = { body: p }));
  await e2.run("install");
  await e2.run("activate");
  assert.deepStrictEqual([...e1.store.keys()].sort(), ["bj-fonts-v1", "bj-shell-new"]);
  assert.ok(e2.state.claimed);
});

test("without ?v= the fallback constant is used", async () => {
  const e = makeEnv("");
  e.state.routes["/app"] = { body: "a" };
  await e.run("install");
  assert.match([...e.store.keys()][0], /^bj-shell-\d{4}-\d{2}-\d{2}\.\d+$/);
});

test("app.html: offline banner + versioned registration + maskable icons exist", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const app = fs.readFileSync(path.join(root, "app.html"), "utf8");
  assert.match(app, /Ekkert net/);
  assert.match(app, /\/sw\.js\?v=/);
  const man = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const mask = man.icons.filter((i) => i.purpose === "maskable");
  assert.ok(mask.length >= 1);
  for (const i of man.icons) assert.ok(fs.existsSync(path.join(root, i.src)), i.src + " missing");
  assert.ok(mask.every((i) => /maskable/.test(i.src)), "maskable purpose must use the padded icons");
});
