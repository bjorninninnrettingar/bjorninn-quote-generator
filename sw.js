// sw.js — exists only so /app qualifies as an installable PWA (Chrome/Android
// requires a registered service worker with a fetch handler before it will
// offer "Add to Home Screen" as a real app, not just a bookmark). Deliberately
// does NOT cache anything — this app talks to Airtable through /api/airtable
// and must always see live data, never a stale offline snapshot. Every fetch
// just passes straight through to the network.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });
self.addEventListener("fetch", (e) => { e.respondWith(fetch(e.request)); });
