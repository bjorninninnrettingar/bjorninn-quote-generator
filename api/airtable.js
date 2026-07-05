// api/airtable.js
// Read-only Airtable proxy — keeps the Personal Access Token server-side only,
// so it never sits in committed code or page source (GitHub's push protection
// blocks any commit with a plaintext Airtable token, and rightly so).
// Used by cutlist.html and dashboard.html.

const AIRTABLE_BASE = "app91U15z9K704Okd";

// Whitelist keeps this from becoming a general-purpose read backdoor into the
// rest of the base — only the tables the two pages actually need.
const ALLOWED_TABLES = new Set([
  "tbl4LMXlQjp66RFKI", // Tækifæri 📣 (projects)
  "tblhdgyvTcBfP8kov", // Sögunarlisti 🪚
  "tbl8CrVWKF8CuI7HD", // Efnislisti 🧱
]);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const { path, ...params } = req.query;
  if (!path) return res.status(400).json({ error: "Missing path" });

  const tableId = String(path).split("/")[0];
  if (!ALLOWED_TABLES.has(tableId)) {
    return res.status(403).json({ error: "Table not allowed" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, value);
  }

  const airtableRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await airtableRes.json();
  res.status(airtableRes.status).json(data);
}
