// api/airtable.js
// Airtable proxy — keeps the Personal Access Token server-side only, so it
// never sits in committed code or page source (GitHub's push protection
// blocks any commit containing an Airtable PAT). Used by cutlist.html,
// dashboard.html, labels.html and stimpilklukka.html.
//
// Two layers of restriction, both enforced server-side (never trust the
// client to only ask for what it needs):
//   1. Table allowlist — only these tables are reachable at all.
//   2. Field allowlist per table — the response is capped to exactly these
//      fields regardless of what fields[] requests or omits. Verified by
//      direct testing that omitting fields[] returns full records, including
//      Efnislisti's purchase-cost fields — this is what stops that.
//      Starfsmenn additionally requires a filterByFormula (REQUIRE_FILTER)
//      so a caller can't dump every employee's PIN in one request.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STIMPLANIR_TABLE = "tblnFIO8RB6HcelXF";
const ORLOFSBEIDNIR_TABLE = "tbljdg6uxEfHE7uCU";

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
  "tblhglpjQkczdG1AY": [ // Starfsmenn 👷🏼‍♂️ — stimpilklukka PIN lookup only.
    "Nafn starfsmanns 👷",
    "PIN 🔢",
    "Er starfandi? ✅",
    "Kyn",
  ],
  "tblnFIO8RB6HcelXF": [ // Stimplanir ⏱️ (time clock shifts — one row per Inn→Út)
    "Inn",
    "Út",
    "Starfsmaður",
    "Dagvinna (klst)",
    "Yfirvinna (klst)",
    "Samtals (klst)",
  ],
  "tbl3e5o0Klv9RcNQ4": [ // Fjarvistir 🤒 (sick day log)
    "Dagsetning",
    "Starfsmaður",
    "Tegund",
  ],
  "tbljdg6uxEfHE7uCU": [ // Orlofsbeiðnir 🌴 (vacation requests)
    "Frá",
    "Til",
    "Starfsmaður",
    "Staða",
  ],
};

// Tables that hold credential-like or health-adjacent data — a request with
// no filterByFormula would otherwise dump every row's allowed fields, which
// for Starfsmenn means every employee's PIN at once, and for Fjarvistir
// means every employee's sick-day history at once. Require the caller to
// filter to a single lookup instead of listing the whole table.
const REQUIRE_FILTER = new Set(["tblhglpjQkczdG1AY", "tbl3e5o0Klv9RcNQ4"]);

// Stimplanir is for opening a new shift (Inn). Fjarvistir is for marking a
// day sick from the kiosk. Orlofsbeiðnir is for submitting a vacation
// request. No other table accepts creates through this proxy. Stimplanir's
// "Út" is deliberately not creatable: a shift is opened blank and only ever
// closed via the PATCH path below, never created pre-closed. Orlofsbeiðnir's
// "Staða" is deliberately not creatable either — see FORCED_CREATE_FIELDS
// below, which sets it server-side so a client can't self-approve.
const CREATABLE_FIELDS = {
  // "Mánuður 🗓️"/"Ár 🗓️" are real single-select fields (not formulas) so
  // they work as clean pick-a-value dropdown filters in Interfaces — the
  // kiosk computes and sends them at creation time since there's no
  // Airtable Automation populating them.
  "tblnFIO8RB6HcelXF": ["Inn", "Starfsmaður", "Mánuður 🗓️", "Ár 🗓️"],
  "tbl3e5o0Klv9RcNQ4": ["Dagsetning", "Starfsmaður", "Tegund"],
  "tbljdg6uxEfHE7uCU": ["Frá", "Til", "Starfsmaður"],
};

// Fields forced to a fixed value on create, regardless of what (or whether)
// the client sends — applied after CREATABLE_FIELDS filtering, so these
// don't need to be creatable at all.
const FORCED_CREATE_FIELDS = {
  "tbljdg6uxEfHE7uCU": { "Staða": "Í bið" },
};

// Only the stimpilklukka kiosk's own paired device may open/close a shift —
// this is what keeps INN/ÚT tied to being physically at the shop, while
// Fjarvistir (sick) and Orlofsbeiðnir (vacation request) stay reachable from
// any device. Pairing happens client-side (stimpilklukka.html stores the
// secret from a one-time ?setup= link); this just checks the header matches.
const KIOSK_LOCKED_TABLES = new Set([STIMPLANIR_TABLE]);

function isKioskPaired(req) {
  const secret = process.env.KIOSK_DEVICE_SECRET;
  return !!secret && req.headers["x-kiosk-token"] === secret;
}

// Only Sögunarlisti rows may be patched, and only these fields — used for the
// "mark as manual cut" / "fix oversized piece" actions in cutlist.html, the
// Skurðarskrá file-assignment write, and labels.html's print trigger. Never
// exposes create/delete, and never touches Tækifæri or Efnislisti.
// Note: "Lokið" is intentionally NOT writable here — the shop's
// print-server.js is the sole owner of setting that field; this proxy only
// ever sets B.A.S. to request a print, then reads Lokið to see it complete.
const WRITABLE_FIELDS = {
  "tblhdgyvTcBfP8kov": ["H", "B", "Þ", "Villa?", "Athugasemd", "B.A.S.", "Skurðarskrá"],
  // Closes an open shift (stimpilklukka's ÚT button). "Inn" is intentionally
  // not writable here — a shift's start time is only ever set at creation.
  "tblnFIO8RB6HcelXF": ["Út"],
};

// URLSearchParams serializes spaces as "+" (application/x-www-form-urlencoded).
// Airtable's query-string field matching tolerates that, but its formula
// parser doesn't decode "+" back to space, so a filterByFormula referencing
// a field name with a space (e.g. {PIN 🔢}) fails with "Unknown field
// names". %20 works in both contexts, so normalize before every request.
function airtableUrl(url) {
  return url.toString().replace(/\+/g, "%20");
}

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
    if (!recordId && REQUIRE_FILTER.has(tableId) && !params.filterByFormula) {
      return res.status(403).json({ error: "filterByFormula required for this table" });
    }

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
      const airtableRes = await fetch(airtableUrl(url), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await airtableRes.json();
      if (!airtableRes.ok) return res.status(airtableRes.status).json(data);
      const record = (data.records || [])[0];
      if (!record) return res.status(404).json({ error: "Record not found" });
      return res.status(200).json(filterFields(record, allowedFields));
    }

    const airtableRes = await fetch(airtableUrl(url), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await airtableRes.json();
    if (Array.isArray(data.records)) {
      data.records = data.records.map((r) => filterFields(r, allowedFields));
    }
    return res.status(airtableRes.status).json(data);
  }

  if (req.method === "POST") {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const tableId = String(path);
    const creatable = CREATABLE_FIELDS[tableId];
    if (!creatable) return res.status(403).json({ error: "Create not allowed for this table" });
    if (KIOSK_LOCKED_TABLES.has(tableId) && !isKioskPaired(req)) {
      return res.status(403).json({ error: "DEVICE_NOT_PAIRED" });
    }

    const requestedFields = req.body?.fields || {};
    const fields = {};
    for (const [k, v] of Object.entries(requestedFields)) {
      if (creatable.includes(k)) fields[k] = v;
    }
    Object.assign(fields, FORCED_CREATE_FIELDS[tableId] || {});
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No writable fields in request" });
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`;
    const airtableRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // typecast: true so a singleSelect value with no exact-matching choice
      // (e.g. a stale/renamed option) creates the choice instead of hard-
      // failing the write — a create should never brick over a label typo.
      body: JSON.stringify({ fields, typecast: true }),
    });
    const data = await airtableRes.json();
    const filtered = data.fields ? filterFields(data, ALLOWED_FIELDS[tableId] || []) : data;
    return res.status(airtableRes.status).json(filtered);
  }

  if (req.method === "PATCH") {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const [tableId, recordId] = String(path).split("/");
    const writable = WRITABLE_FIELDS[tableId];
    if (!writable || !recordId) {
      return res.status(403).json({ error: "Write not allowed for this path" });
    }
    if (KIOSK_LOCKED_TABLES.has(tableId) && !isKioskPaired(req)) {
      return res.status(403).json({ error: "DEVICE_NOT_PAIRED" });
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

  return res.status(405).json({ error: "GET, POST or PATCH only" });
}
