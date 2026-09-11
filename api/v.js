// Short redirect for the QR code on Zebra piece labels.
// /v/<Tækifæri recordId>  →  302 → /verk?t=<recordId>&k=<VERK_KEY>
//
// Exists only so the QR encodes a short, key-free string — VERK_KEY is
// injected here from the env at request time, never baked into the printed
// label or committed to source (same reasoning as api/airtable.js keeping
// AIRTABLE_TOKEN server-side only).
export default function handler(req, res) {
  const id = req.query.id;
  if (!id || !/^rec[A-Za-z0-9]{14}$/.test(String(id))) {
    return res.status(400).send("Invalid link");
  }

  const key = process.env.VERK_KEY;
  if (!key) return res.status(500).send("VERK_KEY not configured");

  res.writeHead(302, { Location: `/verk?t=${id}&k=${encodeURIComponent(key)}` });
  res.end();
}
