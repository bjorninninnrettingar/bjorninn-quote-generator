// api/pontun-print.js
// Thin server-side relay for /pontun's "endurprenta PDF" buttons. The real
// PDF generators (api/generate-order-pdf.js, api/generate-extra-order-pdf.js)
// already exist and are what the Airtable automations themselves call — same
// x-webhook-secret mechanism, just triggered from this app's own UI instead
// of an Interface button. The secret never reaches the browser: the client
// only ever sends { recordId, kind }, this function holds WEBHOOK_SECRET.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Server not configured" });

  const { recordId, kind } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "Missing recordId" });
  const endpoint = kind === "extra" ? "generate-extra-order-pdf" : "generate-order-pdf";

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const r = await fetch(`https://${host}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify({ recordId }),
  });
  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}
