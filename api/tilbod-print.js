// api/tilbod-print.js
// Thin server-side relay for PRO mode's "Prenta tilboð" button — same shape
// as api/pontun-print.js. The real PDF generator (api/generate-quote.js)
// already exists and is what the "🖨️ Prenta Tilboð" Airtable automation
// itself calls; this just lets PRO mode trigger it directly instead of
// going back to the old Interface button. The secret never reaches the
// browser: the client only ever sends { recordId }, this function holds
// WEBHOOK_SECRET.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Server not configured" });

  const { recordId } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "Missing recordId" });

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const r = await fetch(`https://${host}/api/generate-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify({ recordId, mode: "cabinets" }),
  });
  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}
