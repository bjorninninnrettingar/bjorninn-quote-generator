// api/konto-paid-sync.js — Konto "Paid" → Airtable payment ticks (2026-10-28, scan F1/F17).
//
// Cron every 30 min on weekdays (vercel.json). For every Tækifæri with Konto drafts it looks the
// invoice guid up in Konto's get-invoices (the only working read endpoint, same as api/konto-vat.js),
// and when an invoice is Paid: ticks Greiðsla 2/3 greidd (or `Greiðsla 1 greidd (Konto)`), stores
// status/due/paid in the JSON ledger field and writes ONE Virkni bell line "Greiðsla X komin".
// Idempotent: a payment is announced only when the ledger didn't already say paid; an overdue
// invoice (sent, unpaid, past due) is announced once (`overdueNotified`). Never writes to Konto.
//
// Auth: Authorization: Bearer CRON_SECRET (cron) or ?k=VERK_KEY (by hand; &dry=1 = change nothing).
// Needs the Airtable fields in docs/owner-airtable-steps-2026-10-28.md "Konto paid-sync fields";
// until they exist it still ticks Greiðsla 2/3 from the log-derived guids and reports `missingFields`.
import { addLine } from "./virkni.js";
import { LEDGER_FIELD, G1_PAID_FIELD, mergedLedger, planSync } from "./_konto-ledger.js";

const AT = "https://api.airtable.com/v0/app91U15z9K704Okd/tbl4LMXlQjp66RFKI";
const KONTO = "https://konto.is/api/v1";
const NAME = "Heiti tækifæris / verkefnis", SPLIT = "Skipting greiðslu", LOG = "Konto drög 🧾";
const BASE_FIELDS = [NAME, SPLIT, LOG, "Greiðsla 2 greidd", "Greiðsla 3 greidd"];

async function atReq(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

async function listProjects(withNew) {
  const fields = withNew ? BASE_FIELDS.concat([LEDGER_FIELD, G1_PAID_FIELD]) : BASE_FIELDS;
  const qs = "filterByFormula=" + encodeURIComponent(`{${LOG}}!=''`) + "&pageSize=100&" + fields.map((f) => "fields%5B%5D=" + encodeURIComponent(f)).join("&");
  const out = [];
  let offset = "";
  do {
    const r = await atReq(`${AT}?${qs}${offset ? "&offset=" + offset : ""}`);
    if (!r.ok) return { ok: false, status: r.status, d: r.d };
    out.push(...(r.d.records || []));
    offset = r.d.offset || "";
  } while (offset);
  return { ok: true, records: out };
}

async function kontoInvoices(from, to) {
  const u = process.env.KONTO_USERNAME, k = process.env.KONTO_API_KEY;
  if (!u || !k) throw new Error("KONTO_USERNAME / KONTO_API_KEY vantar");
  const res = await fetch(`${KONTO}/get-invoices?${new URLSearchParams({ from_date: from, to_date: to })}`, { headers: { Authorization: "Basic " + Buffer.from(`${u}:${k}`).toString("base64") } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) throw new Error(body.message || `Konto get-invoices ${res.status}`);
  return body.result || [];
}

const dayStr = (d) => d.toISOString().slice(0, 10);

export default async function handler(req, res) {
  const cron = !!process.env.CRON_SECRET && req.headers?.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const q = req.query || {};
  const byHand = !!process.env.VERK_KEY && q.k === process.env.VERK_KEY;
  if (!cron && !byHand) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.AIRTABLE_TOKEN) return res.status(500).json({ error: "Server not configured" });
  const dry = byHand && q.dry === "1";
  const today = dayStr(new Date());

  try {
    let missingFields = false;
    let list = await listProjects(true);
    if (!list.ok && list.status === 422) { missingFields = true; list = await listProjects(false); }
    if (!list.ok) return res.status(502).json({ error: "Airtable " + list.status });

    // Window: from the earliest draft we know of (minus a margin) to tomorrow.
    let earliest = dayStr(new Date(Date.now() - 180 * 864e5));
    const work = list.records.map((rec) => {
      const f = rec.fields || {};
      const ledger = mergedLedger(f[LEDGER_FIELD], f[LOG]);
      for (const e of Object.values(ledger)) if (e.created && e.created < earliest && e.created > "2024-01-01") earliest = e.created;
      return { rec, f, ledger };
    }).filter((w) => Object.keys(w.ledger).length);
    if (!work.length) return res.status(200).json({ ok: true, projects: 0, missingFields });

    const from = dayStr(new Date(new Date(earliest + "T00:00:00Z").getTime() - 2 * 864e5));
    const invoices = await kontoInvoices(from, dayStr(new Date(Date.now() + 864e5)));
    const inv = new Map();
    for (const i of invoices) { const g = i.guid || i.id; if (g) inv.set(String(g), i); }

    const report = { ok: true, dry, missingFields, projects: work.length, paid: 0, overdue: 0, ticked: 0, errors: [] };
    for (const w of work) {
      const plan = planSync({
        ledger: w.ledger, split: w.f[SPLIT] || "", inv, today,
        ticks: { g1: !!w.f[G1_PAID_FIELD], g2: !!w.f["Greiðsla 2 greidd"], g3: !!w.f["Greiðsla 3 greidd"] },
      });
      if (!plan.changed && !Object.keys(plan.patch).length) continue;
      const name = w.f[NAME] || "";
      if (dry) {
        report.paid += plan.lines.filter((l) => l.kind === "paid").length;
        report.overdue += plan.lines.filter((l) => l.kind === "overdue").length;
        continue;
      }

      // Write first (ticks + ledger); announce only after the write held, so a failed write is
      // retried next run and the bell line is never doubled.
      const fields = { ...plan.patch };
      if (plan.changed && !missingFields) fields[LEDGER_FIELD] = JSON.stringify(plan.ledger);
      let lines = plan.lines;
      if (Object.keys(fields).length) {
        let r = await atReq(`${AT}/${w.rec.id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
        if (!r.ok && r.status === 422) { // a new field isn't created yet — keep what exists (Greiðsla 2/3 ticks)
          missingFields = true; report.missingFields = true;
          const keep = {};
          for (const [k, v] of Object.entries(fields)) if (k !== LEDGER_FIELD && k !== G1_PAID_FIELD) keep[k] = v;
          const hasKeep = Object.keys(keep).length > 0;
          r = hasKeep ? await atReq(`${AT}/${w.rec.id}`, { method: "PATCH", body: JSON.stringify({ fields: keep }) }) : { ok: true };
          // Without the ledger field "already announced" can't be remembered: only announce what a tick guards.
          lines = hasKeep && r.ok ? lines.filter((l) => l.kind === "paid") : [];
        }
        if (!r.ok) { report.errors.push(w.rec.id + ": Airtable " + r.status); continue; }
        report.ticked += Object.keys(plan.patch).length;
      }
      for (const l of lines) {
        await addLine({
          texti: `${l.texti} — ${name}`.slice(0, 300), tegund: l.kind === "overdue" ? "seint" : "annað", til: "Skrifstofa",
          t: w.rec.id, hver: "Konto", chat: true, projectName: name,
        });
        report[l.kind === "paid" ? "paid" : "overdue"]++;
      }
    }
    return res.status(200).json(report);
  } catch (e) {
    console.error("konto-paid-sync:", e);
    return res.status(500).json({ error: e.message });
  }
}
