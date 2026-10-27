// api/tilbod-pdf.js — the customer's lasting link to their quote (G4, 2026-10-27). "Senda tilboð" in PRO puts this
// link in the Gmail draft: Airtable's own attachment URLs expire within hours, so the link points here and is
// resolved to the CURRENT "Tilboð til sendingar" PDF on every click (a re-print = the customer sees the new one).
// GET ?r=<Tækifæri id>&s=<signature> — the signature (HMAC of the id with VERK_KEY, see tilbodSig) stops anyone from
// walking record ids; nothing else about the project is exposed.
import { createHmac, timingSafeEqual } from "node:crypto";

const PROJECTS = "tbl4LMXlQjp66RFKI";
const ATTACHMENT_FIELD = "flddIR5JAm8ZM753V"; // Tilboð til sendingar
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

export function tilbodSig(recordId, key) { return createHmac("sha256", String(key)).update("tilbod:" + recordId).digest("hex").slice(0, 24); }
export function tilbodLink(host, recordId, key) { return `https://${host}/api/tilbod-pdf?r=${recordId}&s=${tilbodSig(recordId, key)}`; }
// the quote itself among the PDFs generate-quote puts there ("… (Tilboð).pdf" / "(Tilboð & Uppsetning)" / "(Verðhugmynd)")
export function pickQuote(files) { return (files || []).find((f) => /\((Tilboð|Verðhugmynd)/.test(f.filename || "")) || (files || [])[0] || null; }

export default async function handler(req, res, { fetchImpl = fetch } = {}) {
  const key = process.env.VERK_KEY, token = process.env.AIRTABLE_TOKEN;
  if (!key || !token) return res.status(500).send("Server not configured");
  const { r = "", s = "" } = req.query || {};
  const want = REC_RE.test(r) ? tilbodSig(r, key) : "";
  if (!want || String(s).length !== want.length || !timingSafeEqual(Buffer.from(String(s)), Buffer.from(want))) return res.status(404).send("Tilboðið fannst ekki.");
  // (the single-record GET takes no fields[] — it answers 422 — so the whole record, by field id)
  const a = await fetchImpl(`https://api.airtable.com/v0/app91U15z9K704Okd/${PROJECTS}/${r}?returnFieldsByFieldId=true`,
    { headers: { Authorization: `Bearer ${token}` } });
  const rec = await a.json().catch(() => ({}));
  const f = a.ok ? pickQuote((rec.fields || {})[ATTACHMENT_FIELD]) : null;
  if (!f) return res.status(404).send("Tilboðið fannst ekki — hafðu samband við Björninn.");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", f.url);
  return res.status(302).end();
}
