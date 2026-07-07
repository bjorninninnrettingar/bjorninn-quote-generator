// api/airtable.js
// Airtable proxy — keeps the Personal Access Token server-side only, so it
// never sits in committed code or page source (GitHub's push protection
// blocks any commit containing an Airtable PAT). Used by cutlist.html and
// dashboard.html.
//
// Two layers of restriction, both enforced server-side (never trust the
// client to only ask for what it needs):
//   1. Table allowlist — only these 4 tables are reachable at all.
//   2. Field allowlist per table — the response is capped to exactly these
//      fields regardless of what fields[] requests or omits. Verified by
//      direct testing that omitting fields[] returns full records, including
//      Efnislisti's purchase-cost fields — this is what stops that.

const AIRTABLE_BASE = "app91U15z9K704Okd";

const ALLOWED_FIELDS = {
  "tbl4LMXlQjp66RFKI": [ // Tækifæri 📣 (projects)
    "Heiti tækifæris / verkefnis",
    "Staða í skipulagi",
    "Staða í framleiðslu",
    "Tækifæri unnið 🏆",
    "Áætlaður afhendingardagur Björninn (internal)",
    "Framvinda framleiðslu [weighted]",
    "Forgangur framleiðslu 🥇",
  ],
  "tblhdgyvTcBfP8kov": [ // Sögunarlisti 🪚
    "Tækifæri 📣 (projects)",
    "Partur",
    "H",
    "B",
    "Þ",
    "M",
    "Efni: (undirstaða)",
    "Villa?",
    "Athugasemd",
    "B.A.S.",
    "Lokið",
    "Skurðarskrá",
  ],
  "tbl8CrVWKF8CuI7HD": [ // Efnislisti 🧱
    "Heiti efnis",
    "Breidd (mm)",
    "Lengd (mm)",
    "Þykkt (mm)",
  ],
  "tblDQWuf4OSjUv2XI": [ // QUICK FIX❗
    "Verkheiti",
    "Vandamálið",
    "Ábyrgðarmaður",
    "Staða",
  ],
};

// Only Sögunarlisti rows may be patched, and only these fields — used for the
// "mark as manual cut" / "fix oversized piece" actions in cutlist.html, the
// Skurðarskrá file-assignment write, and labels.html's print trigger. Never
// exposes create/delete, and never touches Tækifæri or Efnislisti.
// Note: "Lokið" is intentionally NOT writable here — the shop's
// print-server.js is the sole owner of setting that field; this proxy only
// ever sets B.A.S. to request a print, then reads Lokið to see it complete.
const WRITABLE_FIELDS = {
  "tblhdgyvTcBfP8kov": ["H", "B", "Þ", "Villa?", "Athugasemd", "B.A.S.", "Skurðarskrá"],
};

function filterFields(record, allowedFields) {
  const allowedSet = new Set(allowedFields);
  const fields = {};
  for (const [k, v] of Object.entries(record.fields || {})) {
    if (allowedSet.has(k)) fields[k] = v;
  }
  return { ...record, fields };
}

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  if (req.method === "GET") {
    const { path, ...params } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const [tableId, recordId] = String(path).split("/");
    const allowedFields = ALLOWED_FIELDS[tableId];
    if (!allowedFields) return res.status(403).json({ error: "Table not allowed" });

    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
    for (const [key, value] of Object.entries(params)) {
      if (key === "fields[]") continue; // rebuilt below — client's request is ignored, not trusted
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    }
    allowedFields.forEach((f) => url.searchParams.append("fields[]", f));

    if (recordId) {
      // Airtable's single-record endpoint (GET /v0/{base}/{table}/{id}) started
      // rejecting every request with a generic 422 "parameter validation
      // failed" — verified via direct testing that even one allowed field, and
      // even the previously rock-solid Tækifæri table, fail identically.
      // Routing through the list endpoint's RECORD_ID() filter instead gets
      // the same data and sidesteps whatever broke there.
      url.searchParams.set("filterByFormula", `RECORD_ID()='${recordId}'`);
      const airtableRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await airtableRes.json();
      if (!airtableRes.ok) return res.status(airtableRes.status).json(data);
      const record = (data.records || [])[0];
      if (!record) return res.status(404).json({ error: "Record not found" });
      return res.status(200).json(filterFields(record, allowedFields));
    }

    const airtableRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await airtableRes.json();
    if (Array.isArray(data.records)) {
      data.records = data.records.map((r) => filterFields(r, allowedFields));
    }
    return res.status(airtableRes.status).json(data);
  }

  if (req.method === "PATCH") {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const [tableId, recordId] = String(path).split("/");
    const writable = WRITABLE_FIELDS[tableId];
    if (!writable || !recordId) {
      return res.status(403).json({ error: "Write not allowed for this path" });
    }

    const requestedFields = req.body?.fields || {};
    const fields = {};
    for (const [k, v] of Object.entries(requestedFields)) {
      if (writable.includes(k)) fields[k] = v;
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No writable fields in request" });
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`;
    const airtableRes = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
    const data = await airtableRes.json();
    // Airtable's PATCH response echoes the full updated record regardless of
    // what was sent — same leak as the GET path if left unfiltered (caught
    // via direct testing: a PATCH response included every field on the
    // record, not just the ones written).
    const filtered = data.fields ? filterFields(data, ALLOWED_FIELDS[tableId] || []) : data;
    return res.status(airtableRes.status).json(filtered);
  }

  return res.status(405).json({ error: "GET or PATCH only" });
}
