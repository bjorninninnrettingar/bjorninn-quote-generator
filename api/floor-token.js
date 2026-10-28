// api/floor-token.js — per-device floor tokens (2026-10-28).
//
// Replaces "every workshop page hard-codes VERK_KEY" with a token per tablet/phone, so VERK_KEY can be
// rotated without breaking the shop. Dual-run: nothing here changes how the old key works; a device with no
// token keeps using the constant. Token format, scope and revocation: see api/_auth.js and docs/api.md.
//
// POST { action:"pair", id, t, name }   owner only -> { code, deviceId, name, exp, path }
//      id/t = the skrifstofa session (record id + day token from api/skrifstofa-login.js); the employee's
//      "Tegund starfsmanns" is re-read from Airtable and must be Eigandi (same check as starfsmenn-overview).
// POST { action:"exchange", code }      device -> { token, deviceId, name, exp }   (code valid 15 minutes)
// POST { action:"check", token }        device -> { ok, deviceId?, name?, exp?, reason? }  (used to drop revoked tokens)
// POST { action:"list", id, t }         owner only -> { revoked:[ids], configured }
//
// Revocation without a database: env FLOOR_REVOKED = comma separated deviceIds (api/_auth.js reads it on every
// request). A Vercel env edit needs a redeploy to apply — acceptable for a handful of devices that are revoked
// rarely; an Airtable table would add a read to every proxied request, which is exactly the coupling we avoid.

import { signFloorToken, signPairCode, verifyFloorToken, verifyPairCode, newDeviceId, cleanName, revokedIds, FLOOR_TTL_SEC, PAIR_TTL_SEC } from "./_auth.js";
import { skrifstofaDayToken } from "./skrifstofa-login.js";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

// Light per-instance brute-force damper for the unauthenticated actions.
const hits = new Map();
export function _resetLimiter() { hits.clear(); }
function limited(req) {
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "anon").split(",")[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < 60000)) hits.delete(k);
  return arr.length > 30;
}

async function isOwner(id, t) {
  const secret = process.env.KIOSK_DEVICE_SECRET;
  const airtableToken = process.env.AIRTABLE_TOKEN;
  if (!secret || !airtableToken) return false;
  if (!REC_RE.test(String(id || "")) || typeof t !== "string") return false;
  if (t !== skrifstofaDayToken(secret, id, 0) && t !== skrifstofaDayToken(secret, id, -1)) return false;
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  url.searchParams.set("filterByFormula", `RECORD_ID()='${id}'`);
  url.searchParams.set("maxRecords", "1");
  url.searchParams.append("fields[]", "Tegund starfsmanns 🧑‍💻");
  const r = await fetch(url.toString().replace(/\+/g, "%20"), { headers: { Authorization: `Bearer ${airtableToken}` } });
  const data = await r.json().catch(() => ({}));
  const rec = r.ok ? (data.records || [])[0] : null;
  return !!rec && rec.fields["Tegund starfsmanns 🧑‍💻"] === OWNER_TYPE;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.FLOOR_TOKEN_SECRET) return res.status(503).json({ error: "FLOOR_TOKEN_SECRET not configured" });
  const b = req.body || {};
  const now = Date.now();

  try {
    if (b.action === "pair" || b.action === "list") {
      if (!(await isOwner(b.id, b.t))) return res.status(403).json({ error: "NOT_OWNER" });
      if (b.action === "list") return res.status(200).json({ configured: true, revoked: revokedIds() });
      const name = cleanName(b.name);
      if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });
      const deviceId = newDeviceId();
      const exp = Math.floor(now / 1000) + PAIR_TTL_SEC;
      const code = signPairCode(process.env.FLOOR_TOKEN_SECRET, { deviceId, name, exp });
      return res.status(200).json({ code, deviceId, name, exp, path: "/para-taeki?c=" + encodeURIComponent(code) });
    }

    if (limited(req)) return res.status(429).json({ error: "RATE_LIMITED" });

    if (b.action === "exchange") {
      const v = verifyPairCode(String(b.code || ""), now);
      if (!v.ok) return res.status(401).json({ error: "BAD_CODE", reason: v.reason });
      const exp = Math.floor(now / 1000) + FLOOR_TTL_SEC;
      const token = signFloorToken(process.env.FLOOR_TOKEN_SECRET, { deviceId: v.deviceId, name: v.name, exp });
      return res.status(200).json({ token, deviceId: v.deviceId, name: v.name, exp });
    }

    if (b.action === "check") {
      const v = verifyFloorToken(String(b.token || ""), now);
      if (!v.ok) return res.status(200).json({ ok: false, reason: v.reason });
      return res.status(200).json({ ok: true, deviceId: v.deviceId, name: v.name, exp: v.exp });
    }

    return res.status(400).json({ error: "BAD_ACTION" });
  } catch (e) {
    console.error("floor-token:", e);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
