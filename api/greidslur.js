// api/greidslur.js
// "Greiðslur & tilboð" — a project's money actions from the office app (/skrifstofa + /crm project
// popups, shared office-money.js), so owners and Rakel don't have to open Airtable for them.
// No business logic of its own: every action only flips the same checkbox (or calls the same
// /api/generate-quote mode) an existing Airtable automation / button already uses, so the
// automations stay in Airtable where they're tweaked:
//   g2 / g3    → "Greiðsla 2/3 greidd"   → "Skráir tíma þegar Greiðsla 2/3 er greidd" stamps the date
//   vidbaetur  → "Viðbætur samþykktar"   → "✅ Samþykkja viðbætur" (adds, locks lines, unticks itself)
//   g1         → "🧾 Búa til G1 drög"    → "🧾 Konto: Drög að greiðslu 1" once its trigger is switched
//                                           from the Interface button to this checkbox (see docs/api.md)
//   print      → /api/generate-quote with mode cabinets | combined | estimate | vidbot — exactly what the
//                Prenta Tilboð / sameinað / Verðhugmynd / viðbótartilboð automations' scripts send.
//
// Kept off the public /api/airtable proxy on purpose (Tækifæri PATCH there is keyless, see
// project_security_audit_findings): everything here needs VERK_KEY (?k= / body.k — what
// /api/skrifstofa-login hands every office login). Reads and writes go by field ID, so a renamed
// field can't silently break it.
//
// GET  ?id=<rec>&k=…                          → summary (see summarize())
// POST ?k=… { recordId, action, mode?, expect? } → { ok, … }

import { LEDGER_FIELD, G1_PAID_FIELD, mergedLedger, paymentRows, kontoErrors } from "./_konto-ledger.js";

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";

export const F = {
  name: "fldDC7LI0D4cUeCds",       // Heiti tækifæris / verkefnis
  split: "fldlvDTC46bqAsAP8",      // Skipting greiðslu
  g1: "fld7yuVcAwq949z5P",         // Greiðsla 1 (staðfesting) — formula
  g2: "fldznyrXOEVeRTPy9",         // Greiðsla 2 greidd
  g3: "fld8eVrW714WQmean",         // Greiðsla 3 greidd
  g2At: "fld5ORwqrysX97UfD",       // Greiðsla 2 greidd þann
  g3At: "fldpCuB3RWCs6BtdR",       // Greiðsla 3 greidd þann
  vidbApprove: "fld2GqHA4mYCDpAFb", // Viðbætur samþykktar
  vidb: "fldQpeRzlAddLp2Sj",       // Viðbætur (kr) 💰
  vidbDone: "fld5y7azMIhIw4hIa",   // Samþykktar viðbætur innréttinga 🔒
  confirmed: "fldx9h2VPlEjhFXPm",  // Staðfest tilboðsupphæð 🔒
  log: "fldCoyt9zJ6NSHXyU",        // Konto drög 🧾
  tilbod: "flddIR5JAm8ZM753V",     // Tilboð til sendingar
  vidbot: "fldDS2vYYUURbPaVT",     // Viðbótartilboð 📄
};
// Not created yet — the user adds it in Airtable (docs/api.md). Until then g1 answers G1_NOT_SET_UP.
export const G1_FIELD = "🧾 Búa til G1 drög";
export const PRINT_MODES = ["cabinets", "combined", "estimate", "vidbot"];

const num = (v) => { const n = parseFloat(Array.isArray(v) ? v[0] : v); return Number.isFinite(n) ? n : 0; };
const files = (v) => (Array.isArray(v) ? v : []).map((a) => ({ filename: a.filename, url: a.url }));
// konto-invoice.js logs every created draft as "… · G1 · drög <guid>"; a "❌" line is a failed try.
export const g1Drafted = (log) => /·\s*G1\s*·\s*drög/.test(String(log || ""));

// `extra` = { ledgerText, g1Paid, today } read by field NAME (the new Konto paid-sync fields have no
// known ids and may not exist yet — see readExtra); absent = payments [] and no paid info.
export function summarize(f, g1Ready, extra = {}) {
  const today = extra.today || new Date().toISOString().slice(0, 10);
  const payments = paymentRows(mergedLedger(extra.ledgerText, f[F.log]), today, !!extra.g1Paid);
  return {
    payments,
    overdue: payments.filter((p) => p.overdue).map((p) => p.key),
    kontoErrors: kontoErrors(f[F.log]),
    name: f[F.name] || "",
    split: f[F.split] || "",
    g1: f[F.g1] || "",
    g2: { paid: !!f[F.g2], at: f[F.g2At] || null },
    g3: { paid: !!f[F.g3], at: f[F.g3At] || null },
    vidbaetur: Math.round(num(f[F.vidb])),
    vidbaeturSamthykktar: Math.round(num(f[F.vidbDone])),
    confirmed: f[F.confirmed] == null ? null : Math.round(num(f[F.confirmed])),
    kontoLog: f[F.log] || "",
    g1Drafted: g1Drafted(f[F.log]),
    g1Ready: !!g1Ready,
    tilbod: files(f[F.tilbod]),
    vidbot: files(f[F.vidbot]),
  };
}

// Why an action isn't allowed on this record right now (null = allowed). Pure, for tests.
export function refusal(action, f, body = {}) {
  const split = f[F.split] || "";
  if (action === "g2" || action === "g3") {
    if (split === "100%") return "Skipting er 100% — engin greiðsla " + action.slice(1) + ".";
    if (action === "g3" && split === "50% - 50%") return "Skipting er 50/50 — engin greiðsla 3.";
    if (f[F[action]]) return "Þegar merkt greidd.";
    return null;
  }
  if (action === "vidbaetur") {
    const v = Math.round(num(f[F.vidb]));
    if (f[F.confirmed] == null) return "Verkið er ekki staðfest.";
    if (!(v > 0)) return "Engar ósamþykktar viðbætur.";
    if (Math.round(num(body.expect)) !== v) return "Upphæðin breyttist (" + v + " kr.) — opnaðu aftur og staðfestu.";
    return null;
  }
  if (action === "g1") return g1Drafted(f[F.log]) ? "Drög að greiðslu 1 eru þegar til." : null;
  if (action === "print") return PRINT_MODES.includes(body.mode) ? null : "Óþekkt prentun.";
  return "Óþekkt aðgerð.";
}

// List endpoint + RECORD_ID() (not GET /<id>): fields[] is only documented on list requests.
const byId = (id) => `${BASE}/${PROJECTS}?maxRecords=1&filterByFormula=${encodeURIComponent(`RECORD_ID()='${id}'`)}`;
export function readUrl(id) {
  return byId(id) + "&returnFieldsByFieldId=true&" + Object.values(F).map((x) => "fields%5B%5D=" + x).join("&");
}

async function readRecord(token, id) {
  const r = await fetch(readUrl(id), { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  const rec = (d.records || [])[0];
  return { ok: r.ok && !!rec, status: r.ok ? 404 : r.status, fields: (rec && rec.fields) || {} };
}

// Airtable answers 422 UNKNOWN_FIELD_NAME for an unknown fields[] name — that's how we know the
// G1 checkbox exists yet without needing a schema-scoped token.
async function g1FieldExists(token, id) {
  const r = await fetch(`${byId(id)}&fields%5B%5D=${encodeURIComponent(G1_FIELD)}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok;
}

// New fields (docs/owner-airtable-steps-2026-10-28.md): read by name, tolerate "not created yet" (422).
async function readExtra(token, id) {
  const r = await fetch(`${byId(id)}&fields%5B%5D=${encodeURIComponent(LEDGER_FIELD)}&fields%5B%5D=${encodeURIComponent(G1_PAID_FIELD)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return {};
  const d = await r.json().catch(() => ({}));
  const f = ((d.records || [])[0] || {}).fields || {};
  return { ledgerText: f[LEDGER_FIELD], g1Paid: !!f[G1_PAID_FIELD] };
}

async function patch(token, id, fields) {
  const r = await fetch(`${BASE}/${PROJECTS}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

export default async function handler(req, res) {
  const b = req.body || {};
  const q = req.query || {};
  const key = q.k || b.k;
  if (!process.env.VERK_KEY || key !== process.env.VERK_KEY) return res.status(403).json({ error: "Ógildur lykill" });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "Server not configured" });

  const id = String((req.method === "GET" ? q.id : b.recordId) || "").trim();
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: "Ógilt recordId" });

  if (req.method === "GET") {
    const [rec, g1Ready, extra] = await Promise.all([readRecord(token, id), g1FieldExists(token, id), readExtra(token, id)]);
    if (!rec.ok) return res.status(rec.status).json({ error: "Fann ekki verkið" });
    return res.status(200).json(summarize(rec.fields, g1Ready, extra));
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET eða POST" });

  const action = String(b.action || "");
  const rec = await readRecord(token, id);
  if (!rec.ok) return res.status(rec.status).json({ error: "Fann ekki verkið" });
  const why = refusal(action, rec.fields, b);
  if (why) return res.status(409).json({ error: why });

  if (action === "print") {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: "Server not configured" });
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const r = await fetch(`https://${host}/api/generate-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ recordId: id, mode: b.mode }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: d.error || "Prentun tókst ekki" });
    return res.status(200).json({ ok: true, mode: b.mode });
  }

  const fields = action === "g1" ? { [G1_FIELD]: true }
    : action === "vidbaetur" ? { [F.vidbApprove]: true }
    : { [F[action]]: true };
  const p = await patch(token, id, fields);
  if (!p.ok) {
    const type = p.d && p.d.error && (p.d.error.type || p.d.error);
    if (action === "g1" && type === "UNKNOWN_FIELD_NAME") return res.status(409).json({ error: "G1_NOT_SET_UP" });
    return res.status(p.status).json({ error: "Airtable: " + (type || p.status) });
  }
  return res.status(200).json({ ok: true, action });
}
