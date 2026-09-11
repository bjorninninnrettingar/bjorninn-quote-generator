// Short redirect for the QR code on Zebra piece labels.
// /v/<Sögunarlisti piece recordId>  →  302 → /velja?u=<unitId>&p=<projectId>&k=<VERK_KEY>
//
// Takes the PIECE's record id (what print-server.js already has in hand when
// it prints that label) rather than the unit or project id directly, and
// resolves both server-side from the piece's own links. Sögunarlisti's links
// are generated fresh per project and are reliably single-valued; Eyðublað's
// "Tækifæri 📣 (projects)" field has been found to carry stray extra links on
// some units (confirmed 2026-09-11 — [0] is not always the real project), so
// resolving from the piece avoids that landmine rather than working around it.
//
// VERK_KEY is injected here from the env at request time, never baked into
// the printed label or committed to source (same reasoning as
// api/airtable.js keeping AIRTABLE_TOKEN server-side only).
const AIRTABLE_BASE = "app91U15z9K704Okd";
const SOGUNARLISTI_TABLE = "tblhdgyvTcBfP8kov";

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(String(id))) {
    return res.status(400).send("Invalid link");
  }

  const key = process.env.VERK_KEY;
  const token = process.env.AIRTABLE_TOKEN;
  if (!key) return res.status(500).send("VERK_KEY not configured");
  if (!token) return res.status(500).send("AIRTABLE_TOKEN not configured");

  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${SOGUNARLISTI_TABLE}`);
  url.searchParams.set("filterByFormula", `RECORD_ID()='${id}'`);
  url.searchParams.append("fields[]", "Eyðublað ✏️");
  url.searchParams.append("fields[]", "Tækifæri 📣 (projects)");

  const airtableRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await airtableRes.json();
  const record = airtableRes.ok ? (data.records || [])[0] : null;
  if (!record) return res.status(404).send("Piece not found");

  const unitId = (record.fields["Eyðublað ✏️"] || [])[0];
  const projectId = (record.fields["Tækifæri 📣 (projects)"] || [])[0];
  if (!unitId) return res.status(404).send("Piece has no unit linked");

  const dest = new URL("/velja", `https://${req.headers.host}`);
  dest.searchParams.set("u", unitId);
  if (projectId) dest.searchParams.set("p", projectId);
  dest.searchParams.set("k", key);

  res.writeHead(302, { Location: dest.pathname + dest.search });
  res.end();
}
