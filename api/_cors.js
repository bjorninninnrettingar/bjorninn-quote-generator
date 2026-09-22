// api/_cors.js
// Shared CORS handling — first needed for Phase 1 of the site chatbot
// widget (see memory: project_chatbot). Every other page in this repo is
// either loaded directly from bjorninn.vercel.app (its own
// short URLs) or iframed into Wix (verkefni.html, faq.html) — an iframe's
// own JS runs in the iframe's origin, so no cross-origin fetch is involved.
// The chatbot widget is different by design: it's a script injected
// directly into the Wix page (not an iframe), so its fetch() calls to
// api/chat.js and api/airtable.js (to log the conversation into
// Vefspjall 💬) are genuinely cross-origin from bjorninninnrettingar.is.
//
// Restricted to the real domain rather than "*" — api/chat.js calls the
// Claude API on every request, which costs real money; an open wildcard
// would let any other site's JS ride on that for free.
const ALLOWED_ORIGINS = new Set([
  "https://www.bjorninninnrettingar.is",
  "https://bjorninninnrettingar.is",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Local dev convenience (vercel dev / a plain static server on localhost)
  // — browsers never send this origin from a real deployed site, so it's
  // not a production exposure.
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

// Sets CORS headers when the request's Origin is allowed, and handles the
// OPTIONS preflight Content-Type:application/json POSTs trigger. Returns
// true if the request was a handled preflight — the caller should return
// immediately without further processing.
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Kiosk-Token");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
