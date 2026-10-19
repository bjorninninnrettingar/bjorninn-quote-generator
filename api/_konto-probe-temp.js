// TEMPORARY diagnostic endpoint — probes the legacy Konto REST API for payment/invoice-status
// data, since the in-app reference for this API isn't publicly reachable. GET-only, read-only,
// creates nothing in Konto. Delete this file once the real endpoint is found.
// GET /api/_konto-probe-temp?secret=<WEBHOOK_SECRET>

const KONTO = "https://konto.is/api/v1";

function kontoAuth() {
  const u = process.env.KONTO_USERNAME, k = process.env.KONTO_API_KEY;
  if (!u || !k) throw new Error("KONTO_USERNAME / KONTO_API_KEY missing");
  return { u, k, header: "Basic " + Buffer.from(`${u}:${k}`).toString("base64") };
}

async function tryGet(path, params = {}) {
  const { header } = kontoAuth();
  const url = `${KONTO}/${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: header } });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { path, status: res.status, body: typeof body === "string" ? body.slice(0, 500) : body };
  } catch (e) {
    return { path, error: e.message };
  }
}

export default async function handler(req, res) {
  if (req.query.secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: "no" });
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const candidates = [
    ["get-invoices", { from_date: monthAgo, to_date: today }],
    ["list-invoices", { from_date: monthAgo, to_date: today }],
    ["get-invoice-list", {}],
    ["invoices", {}],
    ["get-paid-invoices", { from_date: monthAgo, to_date: today }],
    ["get-payments", { from_date: monthAgo, to_date: today }],
    ["list-payments", {}],
    ["payments", {}],
    ["get-bank-transactions", { from_date: monthAgo, to_date: today }],
    ["get-draft-invoices", {}],
  ];
  const out = [];
  for (const [path, params] of candidates) {
    out.push(await tryGet(path, params));
  }
  res.status(200).json({ out });
}
