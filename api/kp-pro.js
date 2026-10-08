// api/kp-pro.js
// Kitchen planner "pro mode" save (2026-10-08) — Rakel finishes a project in the same designer the customer used,
// opened from the Tækifæri with the office key. Saving writes back to the SAME project:
//   - the whole designer state → Tækifæri "Sjálfsafgreiðsla skipulag (JSON) 📐" (its submissionId is kept);
//   - each cabinet's Smíðagögn (hinges, door type …) → its Line Item "Smíðagögn (JSON) 🔧", matched by 🔑 (Sk1, Sk2…).
// Only Line Items whose Smíðagögn actually changed are written, so "⚠️ Breytt eftir stofnun" (which watches that
// field's last-modified time) only lights up for real changes; Keyra skipulag then copies it to the Eyðublað and
// /cnc drills it. No Line Item is created or deleted here — cabinets added in pro mode are reported as missing.
// Behind VERK_KEY: the public proxy can't write Line Items at all.

import { makeAirtable, listAll } from "./kp-submit.js";

const PROJECTS = "tbl4LMXlQjp66RFKI";
const LINE_ITEMS = "tblFcsUoGxsuUwNEH";
const PLANNER_JSON = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const PROJECT_NAME = "Heiti tækifæris / verkefnis";
const LINK_TO_PROJECT = "Tækifæri 📣 (projects)";
const SMIDA = "Smíðagögn (JSON) 🔧";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;
const KEY_RE = /^Sk\d{1,3}$/;

export function fieldDeps() {
  return { [PROJECTS]: new Set([PLANNER_JSON, PROJECT_NAME]), [LINE_ITEMS]: new Set([SMIDA, "🔑", LINK_TO_PROJECT]) };
}

export function validate(body) {
  const b = body || {};
  if (!REC_RE.test(String(b.recordId || ""))) return "Ógilt recordId";
  if (typeof b.state !== "object" || !b.state || !Array.isArray(b.state.walls)) return "Skipulag vantar";
  if (typeof b.smida !== "object" || !b.smida) return "Smíðagögn vantar";
  for (const [k, v] of Object.entries(b.smida)) {
    if (!KEY_RE.test(k)) return "Ógilt 🔑: " + k;
    if (v !== null && (typeof v !== "object" || v.v !== 1)) return "Ógild Smíðagögn: " + k;
  }
  return null;
}

export async function save(at, body) {
  const opp = await at("GET", `${PROJECTS}/${body.recordId}`);
  const old = (() => { try { return JSON.parse((opp.fields || {})[PLANNER_JSON] || "{}"); } catch (e) { return {}; } })();
  const json = JSON.stringify(Object.assign({}, body.state, old.submissionId ? { submissionId: old.submissionId } : {}, { proSavedAt: new Date().toISOString() }));
  await at("PATCH", PROJECTS, { records: [{ id: opp.id, fields: { [PLANNER_JSON]: json } }] });

  const prefix = String((opp.fields || {})[PROJECT_NAME] || "").split("|")[0].trim(); // "T-227"
  const rows = prefix ? (await listAll(at, LINE_ITEMS, `FIND("${prefix.replace(/"/g, '\\"')} |",ARRAYJOIN({${LINK_TO_PROJECT}}))`, ["🔑", SMIDA, LINK_TO_PROJECT]))
    .filter((r) => (r.fields[LINK_TO_PROJECT] || []).includes(opp.id)) : [];
  const byKey = new Map(rows.map((r) => [String(r.fields["🔑"] || "").trim(), r]));
  const updates = [], missing = [];
  let unchanged = 0;
  for (const [key, val] of Object.entries(body.smida)) {
    const row = byKey.get(key);
    if (!row) { if (val) missing.push(key); continue; }
    const next = val ? JSON.stringify(val) : "";
    if ((row.fields[SMIDA] || "") === next) { unchanged++; continue; }
    updates.push({ id: row.id, fields: { [SMIDA]: next || null } });
  }
  for (let i = 0; i < updates.length; i += 10) await at("PATCH", LINE_ITEMS, { records: updates.slice(i, i + 10) });
  return { recordId: opp.id, project: (opp.fields || {})[PROJECT_NAME] || "", updated: updates.length, unchanged, missing };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN, key = process.env.VERK_KEY;
  if (!token || !key) return res.status(500).json({ error: "AIRTABLE_TOKEN / VERK_KEY vantar" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || body.k !== key) return res.status(403).json({ error: "Rangur lykill" });
  const bad = validate(body);
  if (bad) return res.status(400).json({ error: bad });
  try {
    return res.status(200).json(Object.assign({ ok: true }, await save(makeAirtable(token), body)));
  } catch (e) {
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
