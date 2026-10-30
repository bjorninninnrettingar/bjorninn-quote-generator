// sw.js — service worker for the /app PWA (installable + offline shell).
//
// What is cached: ONLY the app shell (/app, manifest, icons, shared css/js, fonts) so the home screen opens with no
// signal. Everything under /api/ (Airtable proxy, virkni, todo …) is never touched here and never cached — the floor
// must always see live data, never a stale snapshot. Other same-origin pages/scripts/styles are network-first with a
// cached copy as the fallback, so a page you already opened still opens offline.
//
// Versioning: app.html registers this file as /sw.js?v=<deploy sha from /api/version>, so every deploy is a new
// worker with its own cache names and the old caches are deleted on activate. With no ?v= (offline first visit, tests)
// FALLBACK_VERSION is used — bump it by hand if you ever ship without a deploy sha.
var FALLBACK_VERSION = "2026-10-30.1";
var VERSION = "";
try { VERSION = new URL(self.location.href).searchParams.get("v") || ""; } catch (e) {}
VERSION = VERSION || FALLBACK_VERSION;

var SHELL_CACHE = "bj-shell-" + VERSION;
var PAGE_CACHE = "bj-pages-" + VERSION;
var FONT_CACHE = "bj-fonts-v1"; // fonts never change for a given URL, survives deploys

var SHELL = [
  "/app", "/manifest.json",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-192.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png",
  "/bjorninn-tokens.css", "/bjorninn-icons.js", "/floor-key.js", "/virkni-bell.js"
];
var FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

function isShellPath(p) { return SHELL.indexOf(p) !== -1 || p.indexOf("/icons/") === 0; }
function isApi(p) { return p === "/api" || p.indexOf("/api/") === 0; }
function offlineResponse() { return new Response("Ekkert net", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } }); }

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL_CACHE).then(function (c) {
    // One by one so a single failing asset never blocks the install.
    return Promise.all(SHELL.map(function (p) { return c.add(p).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL_CACHE && k !== PAGE_CACHE && k !== FONT_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// cache-first for the shell, refreshed in the background so a new deploy shows up on the next open
function shellStrategy(e, req, url) {
  var key = new Request(url.origin + url.pathname);
  return caches.open(SHELL_CACHE).then(function (c) {
    return c.match(key).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && res.ok) { c.put(key, res.clone()); } return res; }).catch(function () { return null; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (r) { return r || offlineResponse(); });
    });
  });
}

// network-first for other same-origin documents/scripts/styles, cached copy when the network is gone
function pageStrategy(e, req, nav) {
  return fetch(req).then(function (res) {
    if (res && res.ok && res.type === "basic") { var copy = res.clone(); e.waitUntil(caches.open(PAGE_CACHE).then(function (c) { return c.put(req, copy); })); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (nav) return caches.match("/app").then(function (shell) { return shell || offlineResponse(); });
      return offlineResponse();
    });
  });
}

function fontStrategy(e, req) {
  return caches.open(FONT_CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) e.waitUntil(c.put(req, res.clone())); return res; });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return; // writes always go straight to the network
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.indexOf(url.hostname) !== -1) e.respondWith(fontStrategy(e, req));
    return; // every other cross-origin request is left alone
  }
  if (isApi(url.pathname)) return; // live data: never cached, never intercepted
  if (isShellPath(url.pathname)) { e.respondWith(shellStrategy(e, req, url)); return; }
  var dest = req.destination;
  if (req.mode === "navigate" || dest === "document" || dest === "script" || dest === "style") e.respondWith(pageStrategy(e, req, req.mode === "navigate"));
});
