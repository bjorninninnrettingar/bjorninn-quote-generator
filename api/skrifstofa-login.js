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
};

export function skrifstofaDayToken(secret, employeeId, offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return crypto.createHmac("sha256", secret).update("skrifstofa-emp:" + employeeId + ":" + d.toISOString().slice(0, 10)).digest("hex").slice(0, 40);
}

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
  if (pin.length < 3 || !/[1-9]/.test(pin)) return res.status(400).json({ error: "BAD_PIN" });

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  url.searchParams.set("filterByFormula", `AND({PIN 🔢}=${pin},{Er starfandi? ✅}=1)`);
  url.searchParams.set("maxRecords", "1");
  ["Nafn starfsmanns 👷", "Starfsheiti 💼", "Tegund starfsmanns 🧑‍💻"].forEach((f) => url.searchParams.append("fields[]", f));
  const { ok, data } = await atFetch(airtableToken, url);
  if (!ok) return res.status(502).json({ error: "AIRTABLE_ERROR" });
  const rec = (data.records || [])[0];
  if (!rec) return res.status(401).json({ error: "BAD_PIN" });

  // Airtable's real REST API returns a singleSelect field as a plain string
  // (not {name} — that's how the Airtable MCP research tool normalizes it,
  // not how api.airtable.com itself responds; eigandi-clock.js's own direct
  // string comparison a few lines above the one this file was modeled on is
  // the correct precedent).
  const title = rec.fields["Starfsheiti 💼"] || "";
  const roles = TITLE_ROLES[title] || [];
  if (rec.fields["Tegund starfsmanns 🧑‍💻"] === OWNER_TYPE) roles.push("eigandi");
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
