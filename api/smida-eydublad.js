// api/smida-eydublad.js — "Smíða úr Eyðublöðum" save (2026-10-26, /smida = smida.html).
// A project planned the old way in Airtable (Eyðublöð + Sögunarlisti, no PRO drawing) gets its hinge side, hinges,
// shelves, oven and inner drawers set in /smida; this writes them where /cnc reads them: the Eyðublað's
// `Smíðagögn (JSON) 🔧` (fldc72nKFtSVOChCZ). That ONE field, nothing else — no Line Items, no Keyra skipulag.
//
// POST { k, recordId, items:[{ id, smida, prev }] }
//   id    = an Eyðublað of THAT project (checked against its project link, else 400 and nothing is written)
//   smida = the new JSON text ({ v:1, … }), or null to empty the field (Afturkalla of a field that was empty)
//   prev  = the value the page loaded (null = it was empty). If Airtable has something else now, someone changed it
//           since: 409 { conflict:[ids] } and nothing is written.
// → { ok, written, previous:{ id: old value } } — the page keeps `previous` for "Afturkalla" (same call, reversed).
// Automations checked 2026-10-26 (read-only): nothing triggers on this field (the only Eyðublað trigger is
// per-unit Yfirfara 3.0 on its own checkbox), and only Keyra skipulag writes it — on Eyðublöð linked to a Line Item.
// Behind VERK_KEY.
import { makeAirtable, listAll } from "./kp-submit.js";

const UNIT = "tbl0WcyHhz63pSzZX";
const SMIDA = "Smíðagögn (JSON) 🔧";
const LINKS = ["Tækifæri 📣 (projects)", "Tækifæri 📣"]; // older units are only linked through the second one
const REC_RE = /^rec[A-Za-z0-9]{14}$/;
const MAX_ITEMS = 120, MAX_LEN = 20000;

export function fieldDeps() { return { [UNIT]: new Set([SMIDA, ...LINKS, "Athugasemd"]) }; }

export function validate(body) {
  const b = body || {};
  if (!REC_RE.test(String(b.recordId || ""))) return "Ógilt recordId";
  if (!Array.isArray(b.items) || !b.items.length) return "Engar einingar";
  if (b.items.length > MAX_ITEMS) return "Of margar einingar";
  const seen = new Set();
  for (const it of b.items) {
    if (!it || !REC_RE.test(String(it.id || ""))) return "Ógilt Eyðublað";
    if (seen.has(it.id)) return "Sama Eyðublað tvisvar";
    seen.add(it.id);
    for (const k of ["smida", "prev"]) {
      const v = it[k];
      if (v == null) continue;
      if (typeof v !== "string" || v.length > MAX_LEN) return "Smíðagögn ógild (" + it.id + ")";
      if (k === "smida") {
        let o; try { o = JSON.parse(v); } catch (e) { return "Smíðagögn ekki JSON (" + it.id + ")"; }
        if (!o || typeof o !== "object" || Array.isArray(o) || o.v !== 1) return "Smíðagögn verða að vera { v:1, … } (" + it.id + ")";
      }
    }
  }
  return null;
}

const norm = (v) => (v == null || v === "" ? null : String(v));

export async function save(at, body) {
  const ids = body.items.map((it) => it.id);
  const formula = "OR(" + ids.map((id) => `RECORD_ID()='${id}'`).join(",") + ")";
  const recs = await listAll(at, UNIT, formula, [SMIDA, "Athugasemd", ...LINKS]);
  const byId = new Map(recs.map((r) => [r.id, r]));
  const foreign = ids.filter((id) => {
    const f = (byId.get(id) || {}).fields;
    if (!f) return true;
    return !LINKS.some((l) => (f[l] || []).some((x) => (x && x.id ? x.id : x) === body.recordId));
  });
  if (foreign.length) throw Object.assign(new Error("Eyðublöð sem tilheyra ekki verkefninu: " + foreign.join(", ")), { status: 400 });
  const conflict = body.items.filter((it) => "prev" in it && norm(byId.get(it.id).fields[SMIDA]) !== norm(it.prev)).map((it) => it.id);
  if (conflict.length) throw Object.assign(new Error("Smíðagögnum breytt annars staðar síðan síðan var opnuð"), { status: 409, conflict });
  const previous = {};
  const todo = body.items.filter((it) => norm(byId.get(it.id).fields[SMIDA]) !== norm(it.smida));
  body.items.forEach((it) => { previous[it.id] = norm(byId.get(it.id).fields[SMIDA]); });
  for (let i = 0; i < todo.length; i += 10) {
    await at("PATCH", UNIT, { records: todo.slice(i, i + 10).map((it) => ({ id: it.id, fields: { [SMIDA]: norm(it.smida) } })) });
  }
  return { written: todo.length, previous };
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
    if (e.status === 409) return res.status(409).json({ error: e.message, conflict: e.conflict });
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
