// api/tilbod-print.js
// Thin server-side relay for PRO mode's "Prenta tilboð" button (and /crm's) — same shape as api/pontun-print.js.
// The real PDF generator (api/generate-quote.js) is what the "🖨️ Prenta Tilboð" Airtable automation calls; this
// lets the apps trigger it directly. The client sends { recordId, k }: since 2026-10-27 (G13) it needs the office
// key — before, anyone could re-print (= overwrite "Tilboð til sendingar") on any Tækifæri. WEBHOOK_SECRET never
// reaches the browser. The answer carries the new PDF(s) (Airtable's short-lived links) so the app can open the
// quote right away instead of sending Rakel to Airtable to find it.

const PROJECTS = "tbl4LMXlQjp66RFKI";
const ATTACHMENT_FIELD = "flddIR5JAm8ZM753V"; // "Tilboð til sendingar" — what generate-quote.js fills
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

export default async function handler(req, res, { fetchImpl = fetch } = {}) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const secret = process.env.WEBHOOK_SECRET, key = process.env.VERK_KEY, token = process.env.AIRTABLE_TOKEN;
  if (!secret || !key) return res.status(500).json({ error: "Server not configured" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const { recordId, k } = body || {};
  if (k !== key) return res.status(403).json({ error: "Rangur lykill" });
  if (!REC_RE.test(String(recordId || ""))) return res.status(400).json({ error: "Ógilt recordId" });

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const r = await fetchImpl(`https://${host}/api/generate-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify({ recordId, mode: "cabinets" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !token) return res.status(r.status).json(data);
  // the PDF(s) generate-quote just put on the Tækifæri
  let files = [];
  try {
    const a = await fetchImpl(`https://api.airtable.com/v0/app91U15z9K704Okd/${PROJECTS}/${recordId}?returnFieldsByFieldId=true&fields%5B%5D=${ATTACHMENT_FIELD}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const rec = await a.json().catch(() => ({}));
    files = ((rec.fields || {})[ATTACHMENT_FIELD] || []).map((f) => ({ url: f.url, filename: f.filename }));
  } catch (e) { /* the print itself worked — the app falls back to "see Airtable" */ }
  return res.status(200).json(Object.assign({}, data, { files }));
}
