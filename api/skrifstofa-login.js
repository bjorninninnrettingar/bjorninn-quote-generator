// api/skrifstofa-login.js
// PIN login for /skrifstofa (the new office hub). Reuses the Starfsmenn PIN field
// already used by /klukka and /eigandi (see api/eigandi-clock.js) — same table,
// same field, no new Airtable schema needed.
//
// Every real Starfsheiti 💼 (job title) maps to "allt" — Skipulagsferli, Verkstæði and
// CRM are the same operational toolset everyone in the office actually needs day to day
// (2026-10-18: title used to split people into narrower skipulag/sala/forskipulag
// buckets, but Rakel and Jóel both need the full set in practice, so that distinction
// was dropped). The one real differentiator left is ownership, not job title: "eigandi"
// comes from "Tegund starfsmanns 🧑‍💻" (employment type) === Eigandi 👨🏻‍💼, same literal
// check api/eigandi-clock.js already uses — gates both the Yfirlit nav tile itself and,
// once there, the Starfsmenn overview table (pay rate, hours). Jóel is typed "Eigandi"
// despite his "Verkstjóri" title, so he correctly gets this too; Rakel doesn't.
//
// POST { pin } -> { token, verkKey, record: { id, name, roles } }
// `token` is a per-EMPLOYEE, per-day HMAC (KIOSK_DEVICE_SECRET, same secret as
// eigandi-clock, new namespace so tokens don't cross over) — bound to this specific
// record id (2026-10-18, not just "someone logged into skrifstofa today"), so another
// endpoint can take it back, re-derive who's asking, and re-check their role server-
// side before returning anything sensitive. api/starfsmenn-overview.js is the first
// consumer: it never trusts the client's claimed "eigandi" role, only this token.
//
// `verkKey` (2026-10-18) — every office-shell page's own VERK_KEY (the `?k=` the public
// api/airtable.js proxy needs for anything beyond its public field set) used to have NO
// bootstrap path except a `?k=` query param somewhere in a URL the person happened to
// click — a brand-new device/profile, a cleared browser, or a direct bookmark to plain
// /skrifstofa never got one, so every Tengiliðir/Fyrirtæki/etc. read silently fell back
// to the (often empty) public field set and every VERK_KEY-gated write 403'd outright.
// Symptom reported 2026-10-18: contact search always showing "(ónefnt)", "+ Nýtt
// verkefni" → "Teikna í hönnuði" doing nothing. Handing the key back on a successful PIN
// login (the person already proved themselves staff) removes that bootstrap gap for
// good; skrifstofa.html saves it into the same K_STORE the URL param used to.

import crypto from "node:crypto";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";

// Starfsheiti 💼 -> roles this hub cares about. Anyone whose title isn't listed here
// still logs in (so nobody's locked out), just sees no tiles yet.
const TITLE_ROLES = {
  "Rekstrarstjóri": ["allt"],
  "Verkstjóri": ["allt"],
  "Sölumaður / Arkitekt": ["allt"],
  "Framleiðslustjóri": ["allt"],
};

export function skrifstofaDayToken(secret, employeeId, offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return crypto.createHmac("sha256", secret).update("skrifstofa-emp:" + employeeId + ":" + d.toISOString().slice(0, 10)).digest("hex").slice(0, 40);
}

// Brute-force damper (2026-10-30). A 3-4 digit PIN is ~10 000 guesses and a correct one returns
// the master VERK_KEY, so failures are counted per IP, per PIN and globally, and 429 once over the
// limit. In-memory = per warm serverless instance (best effort, same approach as floor-token.js);
// the Vercel Firewall rate-limit rule on this path is the real backstop (see docs/api.md).
// The PIN itself is matched by Airtable's formula (no secret is compared in this code), so there is
// no string compare here to make constant-time.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_IP = 5;
const MAX_FAILS_PIN = 5;
const MAX_FAILS_ALL = 60;
const FAIL_DELAY_MS = 300;
const fails = new Map(); // key -> [timestamps]
export function _resetLoginLimiter() { fails.clear(); }
function recent(key, now) {
  const arr = (fails.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length) fails.set(key, arr); else fails.delete(key);
  return arr;
}
function clientIp(req) {
  return String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "anon").split(",")[0].trim();
}
function pinHash(pin) { return crypto.createHash("sha256").update("skrifstofa-pin:" + pin).digest("hex").slice(0, 16); }
function lockedFor(keys, now) {
  const lim = { ip: MAX_FAILS_IP, pin: MAX_FAILS_PIN, all: MAX_FAILS_ALL };
  let wait = 0;
  for (const k of keys) {
    const arr = recent(k, now);
    const max = lim[k.split(":")[0]];
    if (arr.length >= max) wait = Math.max(wait, Math.ceil((arr[arr.length - max] + WINDOW_MS - now) / 1000));
  }
  return wait;
}
function noteFail(keys, now) {
  for (const k of keys) { const arr = recent(k, now); arr.push(now); fails.set(k, arr); }
  if (fails.size > 2000) for (const k of fails.keys()) recent(k, now);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function atFetch(token, url) {
  const r = await fetch(url.toString().replace(/\+/g, "%20"), { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

export default async function handler(req, res) {
  const airtableToken = process.env.AIRTABLE_TOKEN;
  const secret = process.env.KIOSK_DEVICE_SECRET;
  const verkKey = process.env.VERK_KEY;
  if (!airtableToken || !secret || !verkKey) return res.status(500).json({ error: "Server not configured" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const q = { ...(req.query || {}), ...(req.body || {}) };
  const pin = String(q.pin || "").replace(/\D/g, "");
  const now = Date.now();
  const ipKey = "ip:" + clientIp(req);
  const baseKeys = [ipKey, "all:*"];
  const preWait = lockedFor(baseKeys.concat(pin ? ["pin:" + pinHash(pin)] : []), now);
  if (preWait) {
    res.setHeader("Retry-After", String(preWait));
    return res.status(429).json({ error: "TOO_MANY_ATTEMPTS", retryAfter: preWait });
  }
  // Length rule unchanged on purpose: 3-digit PINs may be in real use (the keypad accepts up to 4).
  if (pin.length < 3 || !/[1-9]/.test(pin)) { noteFail(baseKeys, now); return res.status(400).json({ error: "BAD_PIN" }); }
  const failKeys = baseKeys.concat(["pin:" + pinHash(pin)]);

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  url.searchParams.set("filterByFormula", `AND({PIN 🔢}=${pin},{Er starfandi? ✅}=1)`);
  url.searchParams.set("maxRecords", "1");
  ["Nafn starfsmanns 👷", "Starfsheiti 💼", "Tegund starfsmanns 🧑‍💻"].forEach((f) => url.searchParams.append("fields[]", f));
  const { ok, data } = await atFetch(airtableToken, url);
  if (!ok) return res.status(502).json({ error: "AIRTABLE_ERROR" });
  const rec = (data.records || [])[0];
  if (!rec) {
    noteFail(failKeys, Date.now());
    await sleep(FAIL_DELAY_MS);
    return res.status(401).json({ error: "BAD_PIN" });
  }
  fails.delete(ipKey);

  // Airtable's real REST API returns a singleSelect field as a plain string
  // (not {name} — that's how the Airtable MCP research tool normalizes it,
  // not how api.airtable.com itself responds; eigandi-clock.js's own direct
  // string comparison a few lines above the one this file was modeled on is
  // the correct precedent).
  const title = rec.fields["Starfsheiti 💼"] || "";
  // copy: the pushes below must never mutate the shared TITLE_ROLES arrays (warm instances)
  const roles = (TITLE_ROLES[title] || []).slice();
  if (rec.fields["Tegund starfsmanns 🧑‍💻"] === OWNER_TYPE) roles.push("eigandi");
  // "admin" (2026-10-19) — deliberately narrower than "eigandi": Jóel is also
  // Tegund starfsmanns = Eigandi (see the file header comment) but the user
  // was explicit that only they (Rekstrarstjóri) should reach /bakendi.
  // Titled, not employment-type, on purpose.
  if (title === "Rekstrarstjóri") roles.push("admin");
  return res.status(200).json({
    token: skrifstofaDayToken(secret, rec.id),
    verkKey: verkKey,
    record: {
      id: rec.id,
      name: rec.fields["Nafn starfsmanns 👷"] || "",
      roles,
    },
  });
}
