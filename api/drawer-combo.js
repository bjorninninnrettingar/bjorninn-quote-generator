// api/drawer-combo.js
// Public (customer wizard + PRO) endpoint for "this drawer combination doesn't exist as a real product yet —
// create it" (user, 2026-10-19). Útfærslur 🎨 prices a combo by linking each physical drawer to a real
// Vörulisti product in one of 6 generic slots (Tengdar vörur 🚪V1..V6) — "Samtals Söluverð útfærlsu" just sums
// whichever slots are filled; which slot number holds which letter doesn't matter (plain addition), confirmed
// against ~115 real rows (reverse-engineered, 2026-10-19: V1..V7's field labels — "alltaf setja Skrokka hér",
// "alltaf setja Fronta eða gler HÉR" — are for other product categories; a drawer-combo row just fills them
// 1-per-drawer in whatever order, real rows aren't consistent about which number holds which letter). Every
// field below is addressed by its Airtable field ID (not display name) throughout — reads and writes — the
// one way to touch this table with zero risk of a guessed Icelandic name 422ing a real catalog write; see
// kp-pro.js's own VARIANT_NAME for the same pattern on this table. Max 6 drawers (user's own cap, matches the
// 6 available slots — no schema change). Vörunúmer naming (letters tallest-first, 1=bare/2=repeat/3+=digit,
// "M-"/"L-" prefix) mirrors KP3D.comboVorunumer's rule, duplicated in plain data form so this stays a small,
// fast endpoint rather than importing the whole planner module.
import { makeAirtable } from "./kp-submit.js";

const VARIANTS = "tbl8HjvBwNJ41cTV0"; // Útfærslur 🎨
const F_VORUNUMER = "fldpHihoAgFxkjTVy";
const F_FLOKKUR = "fldrFCpVB3Wrzm4BA";
const F_NAME = "fldbG3jw1tEPEchGr"; // "Heiti útfærslu" — same field kp-pro.js's VARIANT_NAME points at
const F_PRICE = "fld36kgODkNOZNOeU"; // Samtals Söluverð útfærlsu (formula — read-only, Airtable computes it)
const F_COUNT = { N:"fldOkXTZOay6ixf0F", M:"fldujEeuzZlFFWSHW", K:"fldkbvdxHo3keO1Ml", E:"fld7oLyo7wwDIfWjV", C:"fld5w69mzp4IztIhf", F:"fldWPg7l6RoCRx2a7" };
const F_SLOT = ["fldbnVgbWTgSXLjMm", "fldJ726tLaP7r8PW8", "fldOAEkfwZo0GZPa4", "fldskdu0i2QF644i7", "fld2vezDWGFEhxnuM", "fldhp2ZNpEOXivlfk"]; // V1..V6
const MAX_DRAWERS = 6;

const CODE_ORDER = "NMKECF";
const LETTERS = { merivo:["N", "M", "K", "E"], legra:["M", "K", "C", "F"] };
const FLOKKUR = { merivo:"MERIVO - Skúffu samsetning", legra:"LEGRA - Skúffu samsetning" };
// one real single-drawer Vörulisti 🚪 product per letter, read off the matching "M-N"/"L-K"/… Útfærslur rows
// (2026-10-19) — every new combo's slots link straight to these, never anything invented.
const VORULISTI = {
  merivo: { N:"recbYSmMAQcBWhtjb", M:"recxsBNvkRztkEmbX", K:"recMs68rxtnjwnWId", E:"recW5WXZdg8zGXil6" },
  legra:  { M:"recGXu1swf2hl7YnJ", K:"rec8RiV2T8Rtj7j1P", C:"recqD8fqrxSQOnzuF", F:"reci46uar1qtcDY7k" },
};

function vorunumer(sys, sortedCodes) {
  const counts = {};
  sortedCodes.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  const order = CODE_ORDER.split("").reverse().join("");
  const body = order.split("").filter((l) => counts[l]).map((l) => {
    const n = counts[l];
    return n === 1 ? l : n === 2 ? l + l : l + n;
  }).join("");
  return (sys === "merivo" ? "M-" : "L-") + body;
}

export function validate(body) {
  const b = body || {};
  if (b.sys !== "merivo" && b.sys !== "legra") return "Ógilt kerfi";
  if (!Array.isArray(b.codes) || !b.codes.length || b.codes.length > MAX_DRAWERS) return "1–" + MAX_DRAWERS + " skúffur";
  if (b.codes.some((c) => LETTERS[b.sys].indexOf(c) < 0)) return "Ógildur skúffustafur fyrir " + b.sys;
  return null;
}

// The real work, factored out from the handler so tests can inject a fake `at` (same shape as kp-pro.js's save()).
export async function findOrCreate(at, sys, codes) {
  const sorted = codes.slice().sort((a, z) => CODE_ORDER.indexOf(z) - CODE_ORDER.indexOf(a)); // tallest-first
  const sku = vorunumer(sys, sorted);
  const found = await at("GET", `${VARIANTS}?filterByFormula=${encodeURIComponent(`{${F_VORUNUMER}}="${sku.replace(/"/g, '\\"')}"`)}&fields%5B%5D=${F_NAME}&fields%5B%5D=${F_PRICE}&maxRecords=1&returnFieldsByFieldId=true`);
  if (found.records && found.records.length) {
    const r = found.records[0];
    return { created:false, id:r.id, sku, name:r.fields[F_NAME] || sku, price:r.fields[F_PRICE] || 0 };
  }
  const counts = {};
  sorted.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  const fields = { [F_VORUNUMER]:sku, [F_FLOKKUR]:FLOKKUR[sys] };
  Object.keys(counts).forEach((l) => { fields[F_COUNT[l]] = counts[l]; });
  sorted.forEach((l, i) => { fields[F_SLOT[i]] = [VORULISTI[sys][l]]; });
  const label = (sys === "merivo" ? "Merivo" : "Legra") + " - " + Object.keys(counts).map((l) => counts[l] + " " + l + "-skúff" + (counts[l] > 1 ? "ur" : "a")).join(" | ");
  fields[F_NAME] = label;
  const created = await at("POST", `${VARIANTS}?returnFieldsByFieldId=true`, { records:[{ fields }], typecast:false });
  const newId = created.records[0].id;
  // the create response's own rollup-dependent formula fields (price) can come back stale/unsettled —
  // confirmed live, 2026-10-19: a fresh read right after shows the right number, the create response didn't.
  const settled = await at("GET", `${VARIANTS}/${newId}?returnFieldsByFieldId=true`);
  return { created:true, id:newId, sku, name:settled.fields[F_NAME] || label, price:settled.fields[F_PRICE] || 0 };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN vantar" });
  const bad = validate(req.body);
  if (bad) return res.status(400).json({ error: bad });
  try {
    return res.status(200).json(await findOrCreate(makeAirtable(token), req.body.sys, req.body.codes));
  } catch (e) {
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error:e.message });
  }
}
