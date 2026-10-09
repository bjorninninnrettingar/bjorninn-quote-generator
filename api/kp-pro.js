// api/kp-pro.js
// Kitchen planner "pro mode" save (2026-10-08) — Rakel finishes a project in the same designer the customer used,
// opened from the Tækifæri with the office key. Saving writes back to the SAME project:
//   - the whole designer state → Tækifæri "Sjálfsafgreiðsla skipulag (JSON) 📐" (its submissionId is kept);
//   - every cabinet's Smíðagögn (sizes, drawer fronts, shelves, oven; hinges/door type once edited in the box editor)
//     → its Line Item "Smíðagögn (JSON) 🔧", matched by 🔑 (Sk1, Sk2…). Keyra skipulag fills the Eyðublað from it.
// Only Line Items whose Smíðagögn actually changed are written, so "⚠️ Breytt eftir stofnun" (which watches that
// field's last-modified time) only lights up for real changes; Keyra skipulag then copies it to the Eyðublað and
// /cnc drills it. Cabinets with no Line Item yet (a drawing Rakel started, or cabinets she added) get one, built by
// the designer exactly like a customer submission (lineItems, same fields). Nothing is ever deleted: Line Items
// whose Sk number is no longer in the drawing are reported as `removed` for her to delete by hand.
//
// V1/V2/V3 on existing lines (2026-10-09): the drawing should update the quote, but Rakel may also change a line in
// Airtable. The planner JSON keeps what the drawing last sent per line (`liSent`, see kp-submit.js). Per field:
//   Airtable = drawing                      → nothing to do;
//   Airtable = last sent, drawing changed   → the drawing wins (written);
//   drawing = last sent, Airtable changed   → Airtable's hand pick stays;
//   both changed / nothing sent yet         → nothing written, reported as a `conflict` for Rakel to settle
//                                             (body.resolve = {Sk5:"drawing"|"airtable"} on the next Vista).
// Behind VERK_KEY: the public proxy can't write Line Items at all.

import { makeAirtable, listAll, validateLineItems, LINE_FIELDS, PRODUCT_FIELDS, idsKey, sentOf } from "./kp-submit.js";

const PROJECTS = "tbl4LMXlQjp66RFKI";
const VARIANTS = "tbl8HjvBwNJ41cTV0";              // Útfærslur 🎨 (what V1/V2/V3 link to)
const VARIANT_NAME = "fldbG3jw1tEPEchGr";        // its name, e.g. "Merivo E-skúff"
const LINE_ITEMS = "tblFcsUoGxsuUwNEH";
const PLANNER_JSON = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const PROJECT_NAME = "Heiti tækifæris / verkefnis";
const LINK_TO_PROJECT = "Tækifæri 📣 (projects)";
const SMIDA = "Smíðagögn (JSON) 🔧";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;
const KEY_RE = /^Sk\d{1,3}$/;

export function fieldDeps() {
  return { [PROJECTS]: new Set([PLANNER_JSON, PROJECT_NAME]), [LINE_ITEMS]: new Set([...LINE_FIELDS, SMIDA, "🔑", LINK_TO_PROJECT]) };
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
  if (b.lineItems != null) {
    const bad = validateLineItems(b.lineItems);
    if (bad) return bad;
    if (b.lineItems.some((li) => !KEY_RE.test(String(li["🔑"])))) return "Ógilt 🔑 á línu";
  }
  if (b.resolve != null) {
    if (typeof b.resolve !== "object") return "Ógilt resolve";
    for (const [k, v] of Object.entries(b.resolve)) if (!KEY_RE.test(k) || (v !== "drawing" && v !== "airtable")) return "Ógilt resolve: " + k;
  }
  return null;
}

export async function save(at, body) {
  const opp = await at("GET", `${PROJECTS}/${body.recordId}`);
  const old = (() => { try { return JSON.parse((opp.fields || {})[PLANNER_JSON] || "{}"); } catch (e) { return {}; } })();
  const lastSent = old.liSent && typeof old.liSent === "object" ? old.liSent : {};
  const resolve = body.resolve || {};

  const prefix = String((opp.fields || {})[PROJECT_NAME] || "").split("|")[0].trim(); // "T-227"
  const rows = prefix ? (await listAll(at, LINE_ITEMS, `FIND("${prefix.replace(/"/g, '\\"')} |",ARRAYJOIN({${LINK_TO_PROJECT}}))`, ["🔑", SMIDA, LINK_TO_PROJECT, ...PRODUCT_FIELDS]))
    .filter((r) => (r.fields[LINK_TO_PROJECT] || []).includes(opp.id)) : [];
  const byKey = new Map(rows.map((r) => [String(r.fields["🔑"] || "").trim(), r]));
  const patch = new Map(); // row id → fields to write
  const put = (row, f, v) => { if (!patch.has(row.id)) patch.set(row.id, {}); patch.get(row.id)[f] = v; };
  const missing = [], creates = [], conflicts = [], liSent = {};
  const newLines = new Map((body.lineItems || []).map((li) => [li["🔑"], li]));
  let unchanged = 0;

  // Smíðagögn (sizes, fronts, hinges) — the drawing always owns it.
  for (const [key, val] of Object.entries(body.smida)) {
    const row = byKey.get(key);
    if (!row) {
      const li = newLines.get(key);
      if (li) {
        const fields = { [LINK_TO_PROJECT]: [opp.id] };
        for (const f of LINE_FIELDS) if (li[f] != null && li[f] !== "") fields[f] = li[f];
        creates.push({ fields });
        liSent[key] = sentOf(li);
      } else if (val) missing.push(key);
      continue;
    }
    const next = val ? JSON.stringify(val) : "";
    if ((row.fields[SMIDA] || "") !== next) put(row, SMIDA, next || null);
  }

  // V1/V2/V3 — see the rule at the top.
  for (const [key, li] of newLines) {
    const row = byKey.get(key);
    if (!row) continue;
    const prev = Array.isArray(lastSent[key]) ? lastSent[key] : null;
    liSent[key] = PRODUCT_FIELDS.map((f, i) => {
      const D = idsKey(li[f]), A = idsKey(row.fields[f]), B = prev && typeof prev[i] === "string" ? prev[i] : undefined;
      if (A === D) return D;
      if (resolve[key] === "drawing" || (B !== undefined && A === B)) { put(row, f, li[f] || []); return D; }
      if (resolve[key] === "airtable") return D;          // Airtable's pick stays; this drawing value counts as seen
      if (B !== undefined && D === B) return B;            // only Airtable changed
      conflicts.push({ key, field: "V" + (i + 1), drawing: D ? D.split(",") : [], airtable: A ? A.split(",") : [] });
      return B === undefined ? null : B;           // null = still nothing known for this field
    });
  }

  const updates = [...patch].map(([id, fields]) => ({ id, fields }));
  unchanged = rows.filter((r) => { const k = String(r.fields["🔑"] || "").trim(); return !patch.has(r.id) && (k in body.smida || newLines.has(k)); }).length;
  for (let i = 0; i < updates.length; i += 10) await at("PATCH", LINE_ITEMS, { records: updates.slice(i, i + 10) });
  for (let i = 0; i < creates.length; i += 10) await at("POST", LINE_ITEMS, { typecast: true, records: creates.slice(i, i + 10) });

  // The state goes last, so liSent only ever records what really reached the Line Items.
  const json = JSON.stringify(Object.assign({}, body.state, old.submissionId ? { submissionId: old.submissionId } : {},
    { liSent, proSavedAt: new Date().toISOString() }));
  await at("PATCH", PROJECTS, { records: [{ id: opp.id, fields: { [PLANNER_JSON]: json } }] });

  // Product names for the conflict question (the ids alone mean nothing to Rakel).
  const ids = [...new Set(conflicts.flatMap((c) => [...c.drawing, ...c.airtable]))];
  const names = {};
  for (let i = 0; i < ids.length; i += 50) {
    const f = "OR(" + ids.slice(i, i + 50).map((id) => `RECORD_ID()='${id}'`).join(",") + ")";
    const d = await at("GET", `${VARIANTS}?filterByFormula=${encodeURIComponent(f)}&fields%5B%5D=${VARIANT_NAME}&returnFieldsByFieldId=true`);
    for (const r of d.records || []) names[r.id] = (r.fields || {})[VARIANT_NAME] || r.id;
  }
  const named = (a) => a.map((id) => names[id] || id);
  const removed = [...byKey.keys()].filter((k) => KEY_RE.test(k) && !(k in body.smida)).sort((a, z) => a.slice(2) - z.slice(2));
  return { recordId: opp.id, project: (opp.fields || {})[PROJECT_NAME] || "", created: creates.length, updated: updates.length, unchanged, missing, removed,
    conflicts: conflicts.map((c) => Object.assign(c, { drawingNames: named(c.drawing), airtableNames: named(c.airtable) })), liSent };
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
