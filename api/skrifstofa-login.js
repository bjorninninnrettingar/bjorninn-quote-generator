// api/skrifstofa-login.js
// PIN login for /skrifstofa (the new office hub). Reuses the Starfsmenn PIN field
// already used by /klukka and /eigandi (see api/eigandi-clock.js) — same table,
// same field, no new Airtable schema needed.
//
// Role comes from "Starfsheiti 💼" (job title), not "Tegund starfsmanns" (employment
// type) — Jóel is typed "Eigandi" but his title "Verkstjóri" is what maps him to the
// Skipulag role, so title is the correct signal here. "Tegund starfsmanns 🧑‍💻" is
// checked separately (2026-10-18) for the ONE place this hub does care about it: the
// Starfsmenn overview table on Yfirlit (pay rate, hours) is Eigandi-only, same literal
// check api/eigandi-clock.js already uses ("Eigandi 👨🏻‍💼").
//
// POST { pin } -> { token, record: { id, name, roles } }
// `token` is a per-EMPLOYEE, per-day HMAC (KIOSK_DEVICE_SECRET, same secret as
// eigandi-clock, new namespace so tokens don't cross over) — bound to this specific
// record id (2026-10-18, not just "someone logged into skrifstofa today"), so another
// endpoint can take it back, re-derive who's asking, and re-check their role server-
// side before returning anything sensitive. api/starfsmenn-overview.js is the first
// consumer: it never trusts the client's claimed "eigandi" role, only this token.

import crypto from "node:crypto";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";

// Starfsheiti 💼 -> roles this hub cares about. Anyone whose title isn't listed here
// still logs in (so nobody's locked out), just sees no tiles yet.
const TITLE_ROLES = {
  "Rekstrarstjóri": ["allt"],
  "Verkstjóri": ["skipulag"],
  "Sölumaður / Arkitekt": ["sala", "forskipulag"],
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
  if (!airtableToken || !secret) return res.status(500).json({ error: "Server not configured" });
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
    record: {
      id: rec.id,
      name: rec.fields["Nafn starfsmanns 👷"] || "",
      roles,
    },
  });
}
