// Short redirect for the QR code on Zebra piece labels.
// /v/<Sögunarlisti piece recordId>  →  302 → /velja?u=<unitId>&p=<projectId>&s=<pieceId>&k=<12h piece token>
//
// Takes the PIECE's record id (what print-server.js already has in hand when
// it prints that label) rather than the unit or project id directly, and
// resolves both server-side from the piece's own links. Sögunarlisti's links
// are generated fresh per project and are reliably single-valued; Eyðublað's
// "Tækifæri 📣 (projects)" field has been found to carry stray extra links on
// some units (confirmed 2026-09-11 — [0] is not always the real project), so
// resolving from the piece avoids that landmine rather than working around it.
//
// 2026-10-28: the redirect no longer carries the shared VERK_KEY. It carries a 12-hour piece token
// (api/_auth.js signPieceToken) limited to this piece, its unit and its project; api/airtable.js enforces it.
const AIRTABLE_BASE = "app91U15z9K704Okd";
import { signPieceToken, PIECE_TTL_SEC } from "./_auth.js";
const SOGUNARLISTI_TABLE = "tblhdgyvTcBfP8kov";

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(String(id))) {
    return res.status(400).send("Invalid link");
  }

  const secret = process.env.FLOOR_TOKEN_SECRET;
  const token = process.env.AIRTABLE_TOKEN;
  if (!secret) return res.status(500).send("FLOOR_TOKEN_SECRET not configured");
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
  // The scanned piece itself — /velja offers "Merkja fræst" for it when it's
  // marked Yfirfr., so the fræsari can tick it off with one scan + one tap.
  dest.searchParams.set("s", id);
  const exp = Math.floor(Date.now() / 1000) + PIECE_TTL_SEC;
  dest.searchParams.set("k", signPieceToken(secret, { pieceId: id, unitId, projectId, exp }));

  res.writeHead(302, { Location: dest.pathname + dest.search });
  res.end();
}
