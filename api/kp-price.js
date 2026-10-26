// api/kp-price.js
// Live tilboðsblað for the kitchen planner's PRO mode (2026-10-23). The browser sends the drawing's Line Items
// (exactly what "Vista í Airtable" would send) + its materials/handles; this prices them with the SAME formulas
// Airtable uses, so Rakel sees the quote move while she draws, before anything is saved:
//
//   Line Item "Einingarverð (lifandi)" = (V1 + V2 + V3 + efniskostnaður × álagning) / 1.24
//                                         × (1 − Afsl. %) × (1 − Ósýnilegur afsláttur %) × smáverk
//     V1/V2 = Útfærslur "Samtals Söluverð útfærlsu", V3 = "Söluverð fyrir V3 án halda" (sums, m/vsk)
//     efniskostnaður = skrokkplata × "% af plötu (Skrokkar)"(V1) + frontaplata × "fm fronta"(V1+V2)
//                    + borðplata × "% í Borðplötu"(V1) + hurðaefni × "% í Hurð"(V1) + KL m-verð × "metrar í KL"(V1)
//   "Endanlegt" per line = einingarverð × Magn × 1.24;   💰 Tilboðsupphæð = Σ lines + höldur
//   höldur = Σ "Söluverð Bjarnarins 💰" of the picked handles × "Magn Halda 1" × 1.24 (+ handle 2, read as-is)
//
// A line the drawing hasn't changed (same V1/V2/V3 + Magn as in Airtable, same materials as the Tækifæri)
// shows Airtable's own Einingarverð — that one also honours price locks (Læst einingarverð 🔒). Every other line
// is computed here. `drift` = unchanged, unlocked lines where our math disagrees with Airtable's by > 1 kr, so a
// formula change in Airtable shows up instead of silently giving wrong numbers.
//
// Purchase prices (plate costs) are used here only — the response carries sale prices. Behind VERK_KEY.

import { makeAirtable, listAll, idsKey } from "./kp-submit.js";

const PROJECTS = "tbl4LMXlQjp66RFKI", LINE_ITEMS = "tblFcsUoGxsuUwNEH", VARIANTS = "tbl8HjvBwNJ41cTV0";
const MATERIALS = "tbl8CrVWKF8CuI7HD", PRODUCTS = "tblzuuRSRkeXaLWxC";
const REC_RE = /^rec[A-Za-z0-9]{14}$/;
const KEY_RE = /^(Sk|HU)\d{1,3}$/; // cabinets Sk1…, room doors HU1… (2026-10-23)
const VAT = 1.24;
const DEFAULT_MARKUP = 2.05; // "❗Álagning á efniskostnað❗" default on a new Line Item (every planner line has it)

// Tækifæri
const P = {
  name: "fldDC7LI0D4cUeCds", carcass: "fldw1MDJEpQhPhDQf", front: "fldU92py68muVPDA4", front2: "fldOb7qomhuRyNLAg", top: "fld3r8ZXf6Bxfamv6", door: "fldsbpUfOGNep0VFo",
  kl: "flds96p2Mv09ZiSBg", hidden: "fldxxGsEY1GkEw4BB", small: "fldK6wXoyRovdAFqq",
  h1: "fldtFyOJnSYidfqjI", h1n: "fldroX7FdGTb9c296", h2price: "fldL4wEZyEzZxGwPT", h2n: "fldomhPpb5hmcHvl7",
  handlesLive: "fld5N9nsHCOQroGzT", handlesNow: "fldYsA3vFjGHXYN3B", total: "fldeXc2zWOrmaGtkC",
};
// Útfærslur
const V = {
  name: "fldbG3jw1tEPEchGr", price: "fld36kgODkNOZNOeU", priceV3: "fld730X4XCEc23o1r",
  carcassPct: "fldpDs9vsXO1neZU6", frontM2: "fldVq3i01NtRfM5sz", topPct: "fldBncYRtRGpEN5G3", doorPct: "fldDVVcpyoOwyTjgi", klM: "fldnSzFZvb5QHv4dr",
};
const M_PLATE = "fldtZyfnYCzdKDcAf";   // Efnislisti "Söluverð á plötu (aðeins f. spónlagt)" — skrokkur + framhlið
const M_COST = "fld4Wun8YLifPH2JH";    // Efnislisti "🚨INNKAUPAVERÐ🚨" — borðplata + hurðaefni
const PR_PRICE = "fldCJjSJWoUWyT7iv";  // Vörulisti "Söluverð Bjarnarins 💰"
const SMALL = { "Smáverk 10%": 1.1, "Smáverk 20%": 1.2, "Smáverk 30%": 1.3, "Smáverk 40%": 1.4, "Smáverk 50%": 1.5,
  "Smáverk 60%": 1.6, "Smáverk 70%": 1.7, "Smáverk 80%": 1.8, "Smáverk 90%": 1.9 };

// lookups/rollups come back as arrays (or a single number); Airtable's arithmetic on a one-value lookup = that value
export const num = (v) => Array.isArray(v) ? v.reduce((a, x) => a + num(x), 0) : (typeof v === "number" ? v : (parseFloat(v) || 0));
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && REC_RE.test(x)) : []);
const first = (v) => (Array.isArray(v) ? v[0] : v);

// Line Items are read by name (the formula filter needs names anyway) — checked daily by api/field-check.js.
const LINE_NAMES = ["🔑", "Tækifæri 📣 (projects)", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3", "Magn", "Afsl. %", "❗Álagning á efniskostnað❗",
  "Einingarverð", "Einingarverð (lifandi)", "Læstur verðlykill 🔒", "Verðlykill", "Frontaefni #2"];
export function fieldDeps() { return { [LINE_ITEMS]: new Set(LINE_NAMES) }; }

export function validate(body) {
  const b = body || {};
  if (!REC_RE.test(String(b.recordId || ""))) return "Ógilt recordId";
  if (!Array.isArray(b.lines) || b.lines.length > 400) return "Ógildar línur";
  for (const li of b.lines) {
    if (!li || !KEY_RE.test(String(li.key))) return "Ógilt 🔑";
    for (const f of ["v1", "v2", "v3"]) if (li[f] != null && !(Array.isArray(li[f]) && li[f].length <= 8 && li[f].every((x) => REC_RE.test(x)))) return "Ógild tenging";
    if (li.qty != null && !(Number.isFinite(li.qty) && li.qty >= 0 && li.qty <= 999)) return "Ógilt magn";
  }
  const m = b.materials || {};
  for (const f of ["carcass", "front", "front2", "top"]) if (m[f] != null && !REC_RE.test(m[f])) return "Ógilt efni";
  if (m.handles != null && !(Array.isArray(m.handles) && m.handles.length <= 8 && m.handles.every((x) => REC_RE.test(x)))) return "Ógildar höldur";
  if (m.handleCount != null && !(Number.isFinite(m.handleCount) && m.handleCount >= 0 && m.handleCount <= 9999)) return "Ógilt magn halda";
  const pr = b.project;
  if (pr != null) {
    if (typeof pr !== "object") return "Ógilt verkefni";
    if (pr.hidden != null && !(Number.isFinite(pr.hidden) && pr.hidden >= 0 && pr.hidden < 1)) return "Ógildur afsláttur";
    if (pr.small != null && pr.small !== "" && !(pr.small in SMALL)) return "Ógild smáverka álagning";
  }
  return null;
}

// One line's unit price án vsk (Airtable's "Einingarverð (lifandi)") from resolved inputs — pure, unit-tested.
export function unitPrice({ v1 = [], v2 = [], v3 = [], qty = 1, disc = 0, markup = DEFAULT_MARKUP, front2 = false }, variants, mat, proj) {
  if (!qty) return 0;
  const g = (id) => variants[id] || {};
  const sum = (list, f) => list.reduce((a, id) => a + num(g(id)[f]), 0);
  const material =
    mat.carcass * sum(v1, V.carcassPct) +
    (front2 && mat.front2 ? mat.front2 : mat.front) * (sum(v1, V.frontM2) + sum(v2, V.frontM2)) + // "Frontaefni #2" → FR2's plate (2026-10-23)
    mat.top * sum(v1, V.topPct) +
    mat.door * sum(v1, V.doorPct) +
    mat.kl * sum(v1, V.klM);
  const gross = sum(v1, V.price) + sum(v2, V.price) + sum(v3, V.priceV3) + material * markup;
  return gross / VAT * (1 - (disc || 0)) * (1 - (proj.hidden || 0)) * (proj.small || 1);
}

async function byIds(at, table, list, fields) {
  const out = {};
  const uniq = [...new Set(list)];
  for (let i = 0; i < uniq.length; i += 40) {
    const f = "OR(" + uniq.slice(i, i + 40).map((id) => `RECORD_ID()='${id}'`).join(",") + ")";
    const d = await at("GET", `${table}?filterByFormula=${encodeURIComponent(f)}&returnFieldsByFieldId=true` + fields.map((x) => "&fields%5B%5D=" + x).join(""));
    for (const r of d.records || []) out[r.id] = r.fields || {};
  }
  return out;
}

export async function price(at, body) {
  const opp = await at("GET", `${PROJECTS}/${body.recordId}?returnFieldsByFieldId=true`);
  const pf = opp.fields || {};
  const m = body.materials || {};
  const prefix = String(pf[P.name] || "").split("|")[0].trim(); // "T-32"

  // existing Line Items of this project (both the drawing's Sk lines and lines added by hand in Airtable)
  const rows = prefix ? (await listAll(at, LINE_ITEMS, `FIND("${prefix.replace(/"/g, '\\"')} |",ARRAYJOIN({Tækifæri 📣 (projects)}))`, LINE_NAMES))
    .filter((r) => (r.fields["Tækifæri 📣 (projects)"] || []).includes(opp.id)) : [];
  const byKey = new Map(rows.map((r) => [String(r.fields["🔑"] || "").trim(), r]));

  // materials: the drawing's pick, else what the Tækifæri has
  const pick = { carcass: m.carcass || first(pf[P.carcass]), front: m.front || first(pf[P.front]), front2: m.front2 || first(pf[P.front2]), top: m.top || first(pf[P.top]), door: first(pf[P.door]) };
  const materialsChanged = ["carcass", "front", "front2", "top"].filter((k) => m[k] && m[k] !== first(pf[P[k]]));
  const sameMaterials = !materialsChanged.length;
  const handleIds = m.handles != null ? m.handles : ids(pf[P.h1]);
  const handleCount = m.handleCount != null ? m.handleCount : num(pf[P.h1n]);

  const allV = [];
  for (const li of body.lines) allV.push(...(li.v1 || []), ...(li.v2 || []), ...(li.v3 || []));
  for (const r of rows) for (const f of ["Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3"]) allV.push(...ids(r.fields[f]));
  const variants = allV.length ? await byIds(at, VARIANTS, allV, Object.values(V)) : {};
  const matRecs = await byIds(at, MATERIALS, [pick.carcass, pick.front, pick.front2, pick.top, pick.door].filter(Boolean), [M_PLATE, M_COST]);
  const handleRecs = handleIds.length ? await byIds(at, PRODUCTS, handleIds, [PR_PRICE]) : {};

  const mat = {
    carcass: num((matRecs[pick.carcass] || {})[M_PLATE]), front: num((matRecs[pick.front] || {})[M_PLATE]), front2: num((matRecs[pick.front2] || {})[M_PLATE]),
    top: num((matRecs[pick.top] || {})[M_COST]), door: num((matRecs[pick.door] || {})[M_COST]),
    kl: num(pf[P.kl]), // "m. kostnaður á kantlímingu" — a text formula (120/400/800/1200 by Kantlíming skrokka)
  };
  // the Tilboð panel's Ósýnilegur afsláttur / Smáverka álagning while they're typed (2026-10-26) — a preview only, the
  // panel writes them to the Tækifæri itself. Both multiply every line, so an unchanged line keeps Airtable's own
  // Einingarverð scaled by new/old factor (a price-locked line stays as it is).
  const projNow = { hidden: num(pf[P.hidden]), small: SMALL[first(pf[P.small])] || 1 };
  const po = body.project || {};
  const proj = { hidden: po.hidden != null ? po.hidden : projNow.hidden, small: "small" in po ? (SMALL[po.small] || 1) : projNow.small };
  const projScale = ((1 - proj.hidden) * proj.small) / (((1 - projNow.hidden) * projNow.small) || 1);
  const nameOf = (list) => list.map((id) => (variants[id] || {})[V.name]).filter(Boolean).join(" + ");

  let drift = 0;
  const lines = body.lines.map((li) => {
    const row = byKey.get(li.key), rf = row ? row.fields : {};
    const qty = li.qty != null ? li.qty : 1;
    const disc = row ? num(rf["Afsl. %"]) : 0;
    const markup = row && rf["❗Álagning á efniskostnað❗"] != null ? num(rf["❗Álagning á efniskostnað❗"]) : DEFAULT_MARKUP;
    const calc = unitPrice({ v1: li.v1 || [], v2: li.v2 || [], v3: li.v3 || [], qty, disc, markup, front2: !!li.front2 }, variants, mat, proj);
    const sameLine = !!row && num(rf["Magn"]) === qty && !!rf["Frontaefni #2"] === !!li.front2 &&
      idsKey(li.v1 || []) === idsKey(ids(rf["Vöru reitur 1"])) && idsKey(li.v2 || []) === idsKey(ids(rf["Vöru reitur 2"])) && idsKey(li.v3 || []) === idsKey(ids(rf["Vöru reitur 3"]));
    const unchanged = sameLine && sameMaterials;
    const locked = !!(row && rf["Læstur verðlykill 🔒"] && rf["Læstur verðlykill 🔒"] === rf["Verðlykill"]);
    if (unchanged && !locked && Math.abs(num(rf["Einingarverð (lifandi)"]) - calc) > 1) drift++;
    const unit = unchanged ? num(rf["Einingarverð"]) * (locked ? 1 : projScale) : calc;
    return { key: li.key, lineId: row ? row.id : null, was: row ? Math.round(num(rf["Einingarverð"]) * num(rf["Magn"]) * VAT) : 0, name: nameOf(li.v1 || []) || "— engin vara tengd —", extra: nameOf([...(li.v2 || []), ...(li.v3 || [])]),
      qty, disc, unit: Math.round(unit), total: Math.round(unit * qty * VAT), source: unchanged ? "airtable" : "reiknað", changed: !!row && !sameLine, locked: unchanged && locked, mapped: !!(li.v1 || []).length };
  });

  // lines on the Tækifæri that aren't from the drawing (added by hand in Airtable) — on the quote as Airtable has them
  const drawn = new Set(body.lines.map((li) => li.key));
  const other = rows.filter((r) => !drawn.has(String(r.fields["🔑"] || "").trim()) && num(r.fields["Magn"])).map((r) => {
    const f = r.fields, qty = num(f["Magn"]), lockedO = !!(f["Læstur verðlykill 🔒"] && f["Læstur verðlykill 🔒"] === f["Verðlykill"]);
    const unit = num(f["Einingarverð"]) * (lockedO ? 1 : projScale);
    return { key: String(f["🔑"] || "").trim() || null, lineId: r.id, name: nameOf(ids(f["Vöru reitur 1"])) || "Lína úr Airtable", extra: nameOf([...ids(f["Vöru reitur 2"]), ...ids(f["Vöru reitur 3"])]),
      qty, disc: num(f["Afsl. %"]), unit: Math.round(unit), total: Math.round(unit * qty * VAT), was: Math.round(num(f["Einingarverð"]) * qty * VAT), source: "airtable", stale: KEY_RE.test(String(f["🔑"] || "").trim()) };
  });

  // handles: the Tækifæri's own (possibly locked) number unless the drawing changed handle or count
  const handlesChanged = idsKey(handleIds) !== idsKey(ids(pf[P.h1])) || handleCount !== num(pf[P.h1n]);
  const handlesTotal = handlesChanged
    ? Math.round((handleIds.reduce((a, id) => a + num((handleRecs[id] || {})[PR_PRICE]), 0) * handleCount + num(pf[P.h2price]) * num(pf[P.h2n])) * VAT)
    : Math.round(num(pf[P.handlesNow]));

  const linesTotal = lines.reduce((a, l) => a + l.total, 0) + other.reduce((a, l) => a + l.total, 0);
  // the same things as `total`, as Airtable has them right now (every line × Einingarverð + handles) — what Vista really
  // changes. The Tækifæri's own Tilboðsupphæð also holds parts that aren't lines (D3, 2026-10-26: "−4,154,620 þegar þú
  // vistar" on T-32 was just that difference, Vista wouldn't cut the quote by it).
  const airtableLinesTotal = Math.round(rows.filter((r) => num(r.fields["Magn"])).reduce((a, r) => a + num(r.fields["Einingarverð"]) * num(r.fields["Magn"]) * VAT, 0) + num(pf[P.handlesNow]));
  return { lines, other, handles: { count: handleCount, total: handlesTotal, changed: handlesChanged, airtableCount: num(pf[P.h1n]), airtableTotal: Math.round(num(pf[P.handlesNow])) },
    hiddenDiscount: proj.hidden, small: "small" in po ? (po.small || null) : (first(pf[P.small]) || null), total: linesTotal + handlesTotal,
    airtableTotal: Math.round(num(pf[P.total])), airtableLinesTotal, materialsChanged, drift };
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
    return res.status(200).json(Object.assign({ ok: true }, await price(makeAirtable(token), body)));
  } catch (e) {
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
