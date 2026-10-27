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
//
// Two computers (2026-10-26): every save stamps proSavedAt in the planner JSON. The page sends `basedOn` = the
// proSavedAt its copy was loaded from (null = a drawing nobody had saved from PRO yet). If Airtable's proSavedAt is
// newer, someone else saved in between: nothing is written, 409 { conflict, savedAt } — the page asks "Sækja nýrri
// útgáfu" / "Skrifa samt yfir" (the latter = `force: true`). A page that sends no basedOn at all (an old cached copy)
// is not checked. The reply carries the new proSavedAt for the next Vista.

import { makeAirtable, listAll, linesOfProject, validateLineItems, LINE_FIELDS, PRODUCT_FIELDS, PROJECT_FIELDS, INNER_FRONTS, idsKey, sentOf, validHandleSkus, handleSlotFields } from "./kp-submit.js";

const PROJECTS = "tbl4LMXlQjp66RFKI";
const VARIANTS = "tbl8HjvBwNJ41cTV0";              // Útfærslur 🎨 (what V1/V2/V3 link to)
const VARIANT_NAME = "fldbG3jw1tEPEchGr";        // its name, e.g. "Merivo E-skúff"
const LINE_ITEMS = "tblFcsUoGxsuUwNEH";
const PLANNER_JSON = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const PROJECT_NAME = "Heiti tækifæris / verkefnis";
const LINK_TO_PROJECT = "Tækifæri 📣 (projects)";
const SMIDA = "Smíðagögn (JSON) 🔧";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;
const KEY_RE = /^(Sk|HU|BP|BV|BH)\d{1,3}$/; // cabinets Sk1…, room doors HU1… (2026-10-23), worktop BP1 + cutouts BV1/BH1 (2026-10-26)
// Materials + handles on the Tækifæri (2026-10-23): Airtable prices every line from these, but pro Vista never
// wrote them — a front changed in the drawing kept the quote on the old front. Same idea as V1/V2/V3 below, one
// rule: the drawing's value is written unless it is unchanged since the drawing last sent it AND Airtable has
// been changed by hand since (then Airtable's pick stays). `projSent` in the planner JSON remembers what was sent.
export const PROJECT_SYNC = PROJECT_FIELDS.filter((f) => f !== "Skilaboð til skipulags");
const HANDLE2 = ["Höldur Viðskiptavinar ✊2.0", "Magn halda 2.0"];
const projVal = (v) => (Array.isArray(v) ? idsKey(v) : v == null ? "" : String(v));
const LINE_EXTRA = ["Frontaefni #2", "Tegund innskúffu fronts"];
// The worktop's lines (2026-10-26): BP = m² of worktop, BV/BH = sink/hob cutouts. Their Magn follows the drawing (a
// longer worktop = more m²), with the same rule as LINE_EXTRA: a Magn changed by hand in Airtable since the drawing
// last sent it stays. Cabinet lines' Magn is never touched (always 1 from the drawing).
const QTY_KEY_RE = /^(BP|BV|BH)\d{1,3}$/;
const extraVal = (f, v) => (f === "Frontaefni #2" ? (v ? "1" : "") : v && typeof v === "object" ? String(v.name || "") : v == null ? "" : String(v));

export function fieldDeps() {
  return { [PROJECTS]: new Set([PLANNER_JSON, PROJECT_NAME, ...PROJECT_SYNC]), [LINE_ITEMS]: new Set([...LINE_FIELDS, SMIDA, "🔑", LINK_TO_PROJECT]) };
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
  if (b.project != null) {
    if (typeof b.project !== "object") return "Ógilt efnisval";
    for (const [f, v] of Object.entries(b.project)) {
      if (!PROJECT_SYNC.includes(f)) return "Ógilt efnisval: " + f;
      if (f === "Magn Halda 1" || f === "Magn halda 2.0" ? !(Number.isInteger(v) && v >= 0 && v <= 9999) : f === "Litur á höldum 🎨" ? !(typeof v === "string" && v.length <= 40) :
        f === "Innskúffufrontar [Handvalið]" ? !INNER_FRONTS.includes(v) :
        !(Array.isArray(v) && v.length <= 8 && v.every((x) => REC_RE.test(x)))) return "Ógilt efnisval: " + f;
    }
  }
  if (b.handleSkus != null && !validHandleSkus(b.handleSkus)) return "Ógildar höldur";
  if (b.basedOn !== undefined && b.basedOn !== null && !(typeof b.basedOn === "string" && b.basedOn.length <= 40 && !isNaN(Date.parse(b.basedOn)))) return "Ógilt basedOn";
  if (b.force != null && typeof b.force !== "boolean") return "Ógilt force";
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
  if (body.basedOn !== undefined && !body.force && old.proSavedAt && (!body.basedOn || Date.parse(old.proSavedAt) > Date.parse(body.basedOn))) {
    const e = new Error("Einhver annar vistaði verkefnið á undan"); e.status = 409; e.savedAt = old.proSavedAt; throw e;
  }

  // this Tækifæri's own lines, by its link field — not the "T-227 |" name prefix, which a new one may not have yet
  const rows = await linesOfProject(at, opp.id, ["🔑", SMIDA, LINK_TO_PROJECT, "Magn", ...PRODUCT_FIELDS, ...LINE_EXTRA]);
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

  // FR2 + inner drawer fronts on existing lines (2026-10-23): same rule as the Tækifæri materials — the drawing's value
  // is written unless it hasn't changed since it was last sent AND someone set it by hand in Airtable since.
  const oldExtra = old.liExtra && typeof old.liExtra === "object" ? old.liExtra : {}, liExtra = {};
  for (const [key, li] of newLines) {
    const row = byKey.get(key), prev = oldExtra[key] || {}, sent = {};
    for (const f of LINE_EXTRA) {
      const D = extraVal(f, li[f]); sent[f] = D;
      if (!row) continue;
      const A = extraVal(f, row.fields[f]), B = prev[f];
      if (A === D) continue;
      if (B !== undefined && D === B && A !== B) { sent[f] = B; continue; }
      if (B === undefined && !D) continue; // never sent before and the drawing has no pick: Airtable's stays
      if (f === "Tegund innskúffu fronts" && !D) continue; // the drawing never clears a hand-picked inner front
      put(row, f, f === "Frontaefni #2" ? D === "1" : D || null);
    }
    if (QTY_KEY_RE.test(key) && Number.isInteger(li["Magn"])) {
      const D = String(li["Magn"]), A = row && row.fields["Magn"] != null ? String(row.fields["Magn"]) : "", B = prev.Magn;
      sent.Magn = D;
      if (row && A !== D) {
        if (B !== undefined && D === B && A !== B) sent.Magn = B; // hand-changed in Airtable, the drawing hasn't moved
        else put(row, "Magn", li["Magn"]);
      }
    }
    liExtra[key] = sent;
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

  // Materials/handles — see PROJECT_SYNC. Only fields the drawing actually has a value for are touched.
  const oldProj = old.projSent && typeof old.projSent === "object" ? old.projSent : {};
  const projFields = {}, projSent = Object.assign({}, oldProj), projectUpdated = [];
  const hInfo = {};
  if (body.handleSkus && body.handleSkus.length) body.project = Object.assign({}, body.project, await handleSlotFields(at, body.handleSkus, hInfo)); // priced slots (G1)
  // more SKUs than slots: what the quote PDF prints instead of the two slot rows, while the slots are still these
  const handlesPrint = hInfo.skus && hInfo.skus.length > 2 ? { key: hInfo.key, skus: hInfo.skus } : null;
  for (const [f, v] of Object.entries(body.project || {})) {
    const D = projVal(v), A = projVal((opp.fields || {})[f]), B = oldProj[f];
    projSent[f] = D;
    if (A === D) continue;
    if (B !== undefined && D === B && A !== B) { projSent[f] = B; continue; } // hand-changed in Airtable, drawing untouched
    if (B === undefined && HANDLE2.includes(f) && (D === "" || D === "0")) { delete projSent[f]; continue; } // a one-SKU drawing never clears a Halda 2 set by hand
    projFields[f] = v;
    projectUpdated.push(f);
  }

  // The state goes last, so liSent only ever records what really reached the Line Items.
  const proSavedAt = new Date().toISOString();
  const json = JSON.stringify(Object.assign({}, body.state, old.submissionId ? { submissionId: old.submissionId } : {},
    { liSent, liExtra, projSent, proSavedAt, handlesPrint }));
  await at("PATCH", PROJECTS, { typecast: true, records: [{ id: opp.id, fields: Object.assign({ [PLANNER_JSON]: json }, projFields) }] });

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
    conflicts: conflicts.map((c) => Object.assign(c, { drawingNames: named(c.drawing), airtableNames: named(c.airtable) })), liSent, projectUpdated, proSavedAt };
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
    if (e.status === 409 && e.savedAt) return res.status(409).json({ error: e.message, conflict: true, savedAt: e.savedAt });
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
