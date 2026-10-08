// api/field-check.js
// Daily check (Vercel Cron) that every Airtable field name the site depends on still exists.
// A field renamed in Airtable used to fail silently: the proxy drops an unknown field from reads (so a page just
// shows nothing there) and writes with it 422 — the planner's note to sales was missing from every submission
// for weeks that way (fixed 2026-09-29). Field names come from the code itself (fieldDeps() in api/airtable.js
// and api/kp-submit.js), so a new field is covered the moment it is added there.
//
// How: one GET per table with fields[]=<every name> and maxRecords=1. Airtable answers 422 UNKNOWN_FIELD_NAME
// for the first bad name; drop it and ask again until the rest pass. Needs no schema scope on the token.
// Anything missing → one row in "Skipulag villur 🐞" (Tegund "Airtable reitur") + console.error.
//
// Cron: Authorization: Bearer CRON_SECRET. By hand: GET /api/field-check?k=<VERK_KEY> (read-only, no row).
import { fieldDeps as proxyDeps } from "./airtable.js";
import { fieldDeps as submitDeps } from "./kp-submit.js";
import { fieldDeps as proDeps } from "./kp-pro.js";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const ISSUE_TABLE = "tbl7K8v94Pf6Ausk3"; // Skipulag villur 🐞

export function allDeps() {
  const out = {};
  for (const deps of [proxyDeps(), submitDeps(), proDeps()]) {
    for (const [t, names] of Object.entries(deps)) {
      out[t] = out[t] || new Set();
      names.forEach((n) => out[t].add(n));
    }
  }
  return out;
}

// → { missing: [{table, field}], errors: [{table, error}] }
export async function checkFields(deps, token, fetchImpl = fetch) {
  const missing = [], errors = [];
  for (const [table, set] of Object.entries(deps)) {
    let names = [...set];
    for (let guard = 0; guard <= set.size && names.length; guard++) {
      const q = names.map((n) => "fields%5B%5D=" + encodeURIComponent(n)).join("&");
      const r = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${table}?maxRecords=1&${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) break;
      const data = await r.json().catch(() => ({}));
      const bad = data?.error?.type === "UNKNOWN_FIELD_NAME" ? (String(data.error.message).match(/Unknown field name: "(.+)"/) || [])[1] : null;
      if (!bad || !names.includes(bad)) { errors.push({ table, error: `${r.status} ${JSON.stringify(data).slice(0, 200)}` }); break; }
      missing.push({ table, field: bad });
      names = names.filter((n) => n !== bad);
    }
  }
  return { missing, errors };
}

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN vantar" });
  const cron = !!process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const manual = !!process.env.VERK_KEY && (req.query || {}).k === process.env.VERK_KEY;
  if (!cron && !manual) return res.status(401).json({ error: "Unauthorized" });

  const { missing, errors } = await checkFields(allDeps(), token);
  if (missing.length || errors.length) {
    const lines = [
      ...missing.map((m) => `Reitur finnst ekki: "${m.field}" í ${m.table}`),
      ...errors.map((e) => `Gat ekki athugað ${e.table}: ${e.error}`),
    ];
    console.error("[field-check]\n" + lines.join("\n"));
    if (cron) {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${ISSUE_TABLE}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ typecast: true, fields: {
          "Titill": `⚠️ Airtable: ${missing.length} reit(ir) finnast ekki — vefurinn notar þá`,
          "Tími": new Date().toISOString(),
          "Tegund": "Airtable reitur",
          "Villuboð": lines.join("\n") + "\n\nEf reitur var endurnefndur: breyttu nafninu aftur, eða uppfærðu kóðann (api/airtable.js / api/kp-submit.js eða síðuna sem notar hann).",
          "Staða": "Ný",
        } }),
      }).catch((e) => console.error("[field-check] could not file the report", e));
    }
  }
  return res.status(200).json({ ok: !missing.length && !errors.length, checked: Object.values(allDeps()).reduce((n, s) => n + s.size, 0), missing, errors });
}
