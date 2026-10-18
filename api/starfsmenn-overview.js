// api/starfsmenn-overview.js
// Eigandi-only Starfsmenn table for skrifstofa.html's Yfirlit page (2026-10-18): live
// hours this month, sick days this month, clocked in/out, and (only here, never through
// the general api/airtable.js proxy) each person's "Kaup per klst 💲" pay rate for the
// row's detail popup.
//
// Never trusts the client's own claim of being an owner (the Stillingar/roles array on
// the session is a UI convenience, not a security boundary) — every request re-verifies
// against Airtable itself: the token from api/skrifstofa-login.js is bound to one
// specific employee record id, and this handler re-fetches THAT record's
// "Tegund starfsmanns 🧑‍💻" fresh before returning anything, so a role change (or a
// stolen token for a now-ex-owner) can't outlive what Airtable currently says.
//
// GET ?id=<employeeRecordId>&t=<token from skrifstofa-login> -> { records: [...] }

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const STIMPLANIR_TABLE = "tblnFIO8RB6HcelXF";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

async function atFetch(token, url) {
  const r = await fetch(url.toString().replace(/\+/g, "%20"), { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const airtableToken = process.env.AIRTABLE_TOKEN;
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!airtableToken || !secret) return res.status(500).json({ error: "Server not configured" });

  const { id, t } = req.query || {};
  if (!REC_RE.test(String(id || ""))) return res.status(400).json({ error: "BAD_ID" });

  // Deferred import to keep this file's own concerns (Starfsmenn data) separate from the
  // login endpoint's — the token helper is the only thing shared between the two.
  const { skrifstofaDayToken } = await import("./skrifstofa-login.js");
  const valid = t === skrifstofaDayToken(secret, id, 0) || t === skrifstofaDayToken(secret, id, -1);
  if (!valid) return res.status(401).json({ error: "BAD_TOKEN" });

  const meUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  meUrl.searchParams.set("filterByFormula", `RECORD_ID()='${id}'`);
  meUrl.searchParams.set("maxRecords", "1");
  meUrl.searchParams.append("fields[]", "Tegund starfsmanns 🧑‍💻");
  const me = await atFetch(airtableToken, meUrl);
  const meRec = me.ok ? (me.data.records || [])[0] : null;
  if (!meRec || meRec.fields["Tegund starfsmanns 🧑‍💻"] !== OWNER_TYPE) {
    return res.status(403).json({ error: "NOT_OWNER" });
  }

  const listUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  listUrl.searchParams.set("filterByFormula", "{Er starfandi? ✅}=1");
  listUrl.searchParams.set("pageSize", "100");
  [
    "Nafn starfsmanns 👷", "Mynd af starfsmanni", "Starfsheiti 💼", "Netfang 📧", "Símanúmer ☎️",
    "Kaup per klst 💲", "Yfirvinnagjald per klst 💲💲",
    "Dagvinna í mán. ⏱️", "Yfirvinna í mán. ⏱️", "Samtals í mán. ⏱️", "Veikindadagar í mán. 🤒",
  ].forEach((f) => listUrl.searchParams.append("fields[]", f));
  const list = await atFetch(airtableToken, listUrl);
  if (!list.ok) return res.status(502).json({ error: "AIRTABLE_ERROR" });

  const openUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STIMPLANIR_TABLE}`);
  openUrl.searchParams.set("filterByFormula", "{Út}=BLANK()");
  openUrl.searchParams.set("pageSize", "50");
  ["Starfsmaður", "Inn"].forEach((f) => openUrl.searchParams.append("fields[]", f));
  const open = await atFetch(airtableToken, openUrl);
  const clockedInSince = {}; // employee record id -> ISO "Inn" time
  if (open.ok) {
    for (const r of open.data.records || []) {
      for (const empId of r.fields["Starfsmaður"] || []) clockedInSince[empId] = r.fields["Inn"];
    }
  }

  const records = (list.data.records || []).map((r) => {
    const f = r.fields;
    const payRate = f["Kaup per klst 💲"] ?? null;
    const overtimeRate = f["Yfirvinnagjald per klst 💲💲"] ?? payRate;
    const hoursNormal = f["Dagvinna í mán. ⏱️"] ?? 0;
    const hoursOvertime = f["Yfirvinna í mán. ⏱️"] ?? 0;
    return {
      id: r.id,
      name: f["Nafn starfsmanns 👷"] || "",
      photo: (f["Mynd af starfsmanni"] || [])[0]?.thumbnails?.small?.url || null,
      title: f["Starfsheiti 💼"] || "",
      email: f["Netfang 📧"] || "",
      phone: f["Símanúmer ☎️"] || "",
      payRate,
      overtimeRate,
      hoursNormal,
      hoursOvertime,
      hoursTotal: f["Samtals í mán. ⏱️"] ?? 0,
      // hourly pay only — doesn't include fixed salary, bonuses, or anything else that might
      // make up someone's real total, just the "hours worked this month × rate" figure the user
      // asked to see per person (skrifstofa.html sums this across everyone for the table footer).
      payThisMonth: payRate == null ? null : hoursNormal * payRate + hoursOvertime * overtimeRate,
      sickDays: f["Veikindadagar í mán. 🤒"] ?? 0,
      clockedIn: Object.prototype.hasOwnProperty.call(clockedInSince, r.id),
      clockedInSince: clockedInSince[r.id] || null,
    };
  });
  records.sort((a, b) => a.name.localeCompare(b.name, "is"));

  return res.status(200).json({ records });
}
