// api/eigandi-clock.js
// Phone clock-in for owners. The shop kiosk lock (X-Kiosk-Token === KIOSK_DEVICE_SECRET,
// see api/airtable.js) keeps INN/ÚT tied to being physically at the shop for regular
// staff — owners don't want that. This endpoint verifies a PIN belongs to an
// "Eigandi 👨🏻‍💼" and hands back a short-lived token the /eigandi page then uses as
// X-Kiosk-Token for its own Stimplanir/Verktímar writes. The token is an HMAC of the
// day keyed with KIOSK_DEVICE_SECRET — it never exposes the real secret and rotates
// daily, so a token sniffed off the wire is dead tomorrow. api/airtable.js's
// isKioskPaired() accepts today's or yesterday's token in addition to the real secret.

import crypto from "node:crypto";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";
const RETURN_FIELDS = ["Nafn starfsmanns 👷", "Kyn", "Starfsheiti 💼", "Auka orlofsdagar 🌴", "PIN 🔢"];

export function ownerDayToken(secret, offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return crypto
    .createHmac("sha256", secret)
    .update("eigandi-clock:" + d.toISOString().slice(0, 10))
    .digest("hex")
    .slice(0, 40);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const airtableToken = process.env.AIRTABLE_TOKEN;
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!airtableToken || !secret) return res.status(500).json({ error: "Server not configured" });

  const pin = String((req.body && req.body.pin) || "").replace(/\D/g, "");
  if (pin.length < 3) return res.status(400).json({ error: "BAD_PIN" });

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  url.searchParams.set("filterByFormula", `AND({PIN 🔢}=${pin},{Er starfandi? ✅}=1)`);
  url.searchParams.set("maxRecords", "1");
  [...RETURN_FIELDS, "Tegund starfsmanns 🧑‍💻"].forEach((f) => url.searchParams.append("fields[]", f));

  const r = await fetch(url.toString().replace(/\+/g, "%20"), {
    headers: { Authorization: `Bearer ${airtableToken}` },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: "Airtable error" });

  const record = (data.records || [])[0];
  if (!record) return res.status(401).json({ error: "BAD_PIN" });
  if (record.fields["Tegund starfsmanns 🧑‍💻"] !== OWNER_TYPE) {
    return res.status(403).json({ error: "NOT_OWNER" });
  }

  const fields = {};
  for (const f of RETURN_FIELDS) if (f in record.fields) fields[f] = record.fields[f];

  return res.status(200).json({
    token: ownerDayToken(secret, 0),
    record: { id: record.id, fields },
  });
}
