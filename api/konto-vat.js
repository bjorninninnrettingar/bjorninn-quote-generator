// api/konto-vat.js
// Real VSK-owed estimate for Yfirlit's "Næsta VSK-skil" pill — the user explicitly didn't want
// this guessed from Airtable "greitt"-style checkboxes (people forget to tick them), so it sums
// Konto's own real paid-invoice data instead: every invoice actually marked "Paid" with a
// paid_date inside the current VAT period, using each line item's own vat_amount (Konto already
// computes this correctly per item — found by probing the live API, not guessed; a flat 24% of
// the gross total would be wrong, since vat_amount = net_price × 24%, not gross × 24/124 either).
//
// The 2-month period boundary is derived from the due date the client already computes via
// VAT_DUE_DATES/nextVat() in skrifstofa.html, so that literal schedule stays the single source
// of truth rather than being duplicated here.
//
// GET /api/konto-vat?dueDate=YYYY-MM-DD&k=<VERK_KEY>
// Env: KONTO_USERNAME, KONTO_API_KEY, VERK_KEY (already configured — same ones api/konto-invoice.js uses).

const KONTO = "https://konto.is/api/v1";

function kontoAuth() {
  const u = process.env.KONTO_USERNAME, k = process.env.KONTO_API_KEY;
  if (!u || !k) throw new Error("KONTO_USERNAME / KONTO_API_KEY vantar");
  return "Basic " + Buffer.from(`${u}:${k}`).toString("base64");
}

async function kontoGet(path, params) {
  const res = await fetch(`${KONTO}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: kontoAuth() } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  if (!res.ok || body.status === false) throw new Error(body.message || `Konto ${path} ${res.status}`);
  return body.result || [];
}

// due date's month, minus 2, is the period's end month (e.g. due 2026-10-05 → period Jul-Aug).
export function periodFromDueDate(dueDateStr) {
  const due = new Date(dueDateStr + "T00:00:00Z");
  const endMonth = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - 1, 0)); // last day of (dueMonth - 2)
  const startMonth = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - 1, 1));
  return { start: startMonth.toISOString().slice(0, 10), end: endMonth.toISOString().slice(0, 10) };
}

export default async function handler(req, res) {
  const verkKey = process.env.VERK_KEY;
  if (!verkKey || req.query.k !== verkKey) return res.status(403).json({ error: "Invalid key" });
  const dueDate = String(req.query.dueDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return res.status(400).json({ error: "Missing/invalid dueDate" });

  const { start, end } = periodFromDueDate(dueDate);

  try {
    // Konto's from_date/to_date filter on invoice creation/issue date, not paid_date — query a
    // window wider than the period itself (an invoice can be issued before the period and paid
    // inside it, or vice versa) and filter precisely on paid_date below.
    const fromQuery = new Date(start + "T00:00:00Z"); fromQuery.setUTCMonth(fromQuery.getUTCMonth() - 2);
    const toQuery = new Date(end + "T00:00:00Z"); toQuery.setUTCMonth(toQuery.getUTCMonth() + 2);
    const invoices = await kontoGet("get-invoices", {
      from_date: fromQuery.toISOString().slice(0, 10),
      to_date: toQuery.toISOString().slice(0, 10),
    });

    let vatOwed = 0, paidTotal = 0, invoiceCount = 0;
    for (const inv of invoices) {
      if (inv.status !== "Paid") continue;
      const paidDate = String(inv.paid_date || "");
      if (!paidDate || paidDate < start || paidDate > end) continue;
      invoiceCount++;
      paidTotal += parseFloat(inv.amount) || 0;
      for (const item of inv.items || []) vatOwed += parseFloat(item.vat_amount) || 0;
    }
    return res.status(200).json({
      period: { start, end },
      vatOwed: Math.round(vatOwed),
      paidTotal: Math.round(paidTotal),
      invoiceCount,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
