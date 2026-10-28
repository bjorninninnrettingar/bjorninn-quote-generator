// api/_auth.js — shared key checks (2026-10-28, floor-token round).
//
// Two kinds of credential travel in the `k` parameter the floor and office pages already send:
//   - the shared office key  (env VERK_KEY)                       -> level "full"  (unchanged behaviour)
//   - a per-device floor token (env FLOOR_TOKEN_SECRET, HMAC)     -> level "floor" (scope-limited)
// keyLevel(k) says which one a value is; endpoints decide what each level may do. Both comparisons are
// constant-time. A floor token never works unless FLOOR_TOKEN_SECRET is configured, so shipping this
// file changes nothing until the owner adds the env var and pairs a device.
//
// Floor token = fl1.<deviceId>.<expUnixSeconds>.<base64url(name)>.<base64url(hmac)>
//   hmac = HMAC-SHA256(FLOOR_TOKEN_SECRET, "floor:" + deviceId + ":" + exp + ":" + nameB64)
// Pairing code = pc1.<deviceId>.<exp>.<nameB64>.<hmac("pair:"...)>  (short-lived, minted for the owner,
// exchanged once by the device for the long-lived token; same deviceId so one revoke kills both).
// Revocation = deviceId listed in env FLOOR_REVOKED (comma separated) — see docs/api.md for why no DB.

import crypto from "node:crypto";

export const FLOOR_PREFIX = "fl1";
export const PAIR_PREFIX = "pc1";
export const FLOOR_TTL_SEC = 90 * 24 * 3600;
export const PAIR_TTL_SEC = 15 * 60;
const DEVICE_RE = /^[a-z0-9]{6,24}$/;

const b64u = (buf) => Buffer.from(buf).toString("base64url");

// Constant-time string equality (hash first so unequal lengths don't leak through timingSafeEqual).
export function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const mac = (secret, label, deviceId, exp, nameB64) =>
  b64u(crypto.createHmac("sha256", secret).update(`${label}:${deviceId}:${exp}:${nameB64}`).digest());

export function cleanName(name) {
  return String(name || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40);
}
export function newDeviceId() {
  return crypto.randomBytes(6).toString("hex"); // 12 hex chars
}

export function revokedIds() {
  return String(process.env.FLOOR_REVOKED || "").split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function sign(prefix, label, secret, { deviceId, name, exp }) {
  if (!secret) throw new Error("FLOOR_TOKEN_SECRET not configured");
  if (!DEVICE_RE.test(deviceId)) throw new Error("bad deviceId");
  const nameB64 = b64u(cleanName(name));
  return [prefix, deviceId, exp, nameB64, mac(secret, label, deviceId, exp, nameB64)].join(".");
}
export const signFloorToken = (secret, p) => sign(FLOOR_PREFIX, "floor", secret, p);
export const signPairCode = (secret, p) => sign(PAIR_PREFIX, "pair", secret, p);

function verify(value, prefix, label, secret, now) {
  if (!secret) return { ok: false, reason: "not_configured" };
  if (typeof value !== "string" || value.length > 400) return { ok: false, reason: "malformed" };
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== prefix) return { ok: false, reason: "malformed" };
  const [, deviceId, expStr, nameB64, sig] = parts;
  if (!DEVICE_RE.test(deviceId) || !/^\d{1,12}$/.test(expStr)) return { ok: false, reason: "malformed" };
  if (!safeEq(sig, mac(secret, label, deviceId, expStr, nameB64))) return { ok: false, reason: "bad_signature" };
  const exp = Number(expStr);
  if (exp * 1000 <= (now == null ? Date.now() : now)) return { ok: false, reason: "expired" };
  let name = "";
  try { name = Buffer.from(nameB64, "base64url").toString("utf8"); } catch { /* keep "" */ }
  return { ok: true, deviceId, exp, name };
}

export function verifyFloorToken(value, now) {
  const r = verify(value, FLOOR_PREFIX, "floor", process.env.FLOOR_TOKEN_SECRET, now);
  if (r.ok && revokedIds().includes(r.deviceId)) return { ok: false, reason: "revoked", deviceId: r.deviceId };
  return r;
}
export function verifyPairCode(value, now) {
  const r = verify(value, PAIR_PREFIX, "pair", process.env.FLOOR_TOKEN_SECRET, now);
  if (r.ok && revokedIds().includes(r.deviceId)) return { ok: false, reason: "revoked", deviceId: r.deviceId };
  return r;
}

// "full" (the shared key), "floor" (valid per-device token) or null.
export function keyLevel(k) {
  if (typeof k !== "string" || !k) return null;
  const verk = process.env.VERK_KEY;
  if (verk && safeEq(k, verk)) return "full";
  if (k.startsWith(FLOOR_PREFIX + ".") && verifyFloorToken(k).ok) return "floor";
  return null;
}
export const isFullKey = (k) => keyLevel(k) === "full";

// For endpoints the floor really uses (virkni, verk-status): old key OR a valid floor token.
export const checkFloorOrFullKey = (k) => keyLevel(k) !== null;
