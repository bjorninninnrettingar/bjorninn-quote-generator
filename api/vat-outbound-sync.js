// api/vat-outbound-sync.js
// Aggregates útskattur (VAT owed on sales) from Tækifæri into "VSK Uppgjör 🧾",
// one row per 2-month Icelandic VSK settlement period (jan-feb, mar-apr, ...).
//
// Only counts projects that are BOTH "🏆 Tækifæri unnið" (won) AND have a real
// delivery date set — a won deal isn't invoiced yet, so it shouldn't count
// toward VAT liability until delivered.
//
// Deliberately does NOT use the existing "vsk." field on Tækifæri — that
// field only covers VAT on the main furniture price, not installation or
// delivery income (both of which carry the same 24% VAT per
// generate-quote.js). The correct full figure is derived from
// "Heildartekjur án. vsk" (which already sums all three revenue streams)
// × 0.24.
//
// Idempotent: upserts by period label, so re-running after more projects
// get marked delivered just updates the affected period(s).
// Protected by CRON_SECRET, same pattern as the other api/*.js jobs.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const TAEKIFAERI_TABLE = "tbl4LMXlQjp66RFKI";
const VSK_UPPGJOR_TABLE = "tblgwddbbpJFgRYSS";

const WON_STATUS = "🏆 Tækifæri unnið";
const DELIVERY_DATE_FIELD = "Raun afhendingardagur (int/external)";
const REVENUE_EX_VAT_FIELD = "Heildartekjur án. vsk";
const STATUS_FIELD = "Staða í söluferli";

const PERIOD_MONTHS = [
  ["jan", "feb"],
  ["mar", "apr"],
  ["maí", "jún"],
  ["júl", "ágú"],
  ["sep", "okt"],
  ["nóv", "des"],
];

function periodFor(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const idx = Math.floor(d.getUTCMonth() / 2);
  const [m1, m2] = PERIOD_MONTHS[idx];
  const start = new Date(Date.UTC(year, idx * 2, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, idx * 2 + 2, 0)).toISOString().slice(0, 10);
  return { label: `${year} ${m1}-${m2}`, start, end };
}

async function airtableFetchAll(token, tableId, params) {
  let offset;
  const records = [];
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
    for (const [k, v] of Object.entries(params || {})) {
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
      else url.searchParams.set(k, v);
    }
    if (offset) url.searchParams.set("offset", offset);
    // See api/airtable.js's airtableUrl() — URLSearchParams encodes spaces as
    // "+", which Airtable's formula parser doesn't decode back to space.
    const finalUrl = url.toString().replace(/\+/g, "%20");
    const res = await fetch(finalUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable ${tableId} fetch failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    records.push(...(json.records || []));
    offset = json.offset;
  } while (offset);
  return records;
}

async function airtableCreate(token, tableId, records) {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${tableId} create failed: ${res.status} ${await res.text()}`);
  }
}

async function airtableUpdate(token, tableId, records) {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${tableId} update failed: ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  try {
    const wonProjects = await airtableFetchAll(token, TAEKIFAERI_TABLE, {
      filterByFormula: `AND({${STATUS_FIELD}}='${WON_STATUS}', {${DELIVERY_DATE_FIELD}}!='')`,
      "fields[]": [STATUS_FIELD, DELIVERY_DATE_FIELD, REVENUE_EX_VAT_FIELD],
      pageSize: 100,
    });

    const periods = new Map(); // label -> { start, end, revenueExVat, count }
    for (const rec of wonProjects) {
      const deliveryDate = rec.fields[DELIVERY_DATE_FIELD];
      const revenueExVat = rec.fields[REVENUE_EX_VAT_FIELD];
      if (!deliveryDate || typeof revenueExVat !== "number") continue;
      const { label, start, end } = periodFor(deliveryDate);
      if (!periods.has(label)) periods.set(label, { start, end, revenueExVat: 0, count: 0 });
      const p = periods.get(label);
      p.revenueExVat += revenueExVat;
      p.count += 1;
    }

    const existing = await airtableFetchAll(token, VSK_UPPGJOR_TABLE, { "fields[]": ["Tímabil"] });
    const existingByLabel = new Map(existing.map((r) => [r.fields["Tímabil"], r.id]));

    const toCreate = [];
    const toUpdate = [];
    for (const [label, p] of periods) {
      const fields = {
        Tímabil: label,
        "Upphaf tímabils": p.start,
        "Lok tímabils": p.end,
        "Heildartekjur án vsk (samtals)": Math.round(p.revenueExVat),
        Útskattur: Math.round(p.revenueExVat * 0.24),
        "Fjöldi verkefna": p.count,
      };
      const existingId = existingByLabel.get(label);
      if (existingId) toUpdate.push({ id: existingId, fields });
      else toCreate.push({ fields });
    }

    if (toCreate.length) await airtableCreate(token, VSK_UPPGJOR_TABLE, toCreate);
    if (toUpdate.length) await airtableUpdate(token, VSK_UPPGJOR_TABLE, toUpdate);

    return res.status(200).json({
      projectsProcessed: wonProjects.length,
      periodsCreated: toCreate.length,
      periodsUpdated: toUpdate.length,
      periods: Array.from(periods.entries()).map(([label, p]) => ({
        label,
        revenueExVat: Math.round(p.revenueExVat),
        vskDue: Math.round(p.revenueExVat * 0.24),
        projectCount: p.count,
      })),
    });
  } catch (err) {
    console.error("vat-outbound-sync failed:", err);
    return res.status(502).json({ error: err.message });
  }
}
