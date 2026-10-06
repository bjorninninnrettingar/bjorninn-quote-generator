// npm run test:live — checks every Airtable record id hard-coded in the kitchen planner against the
// LIVE base: each id must exist, and in the table its target field links to. Needs AIRTABLE_TOKEN
// (source .env.local first). Not part of `npm test` (CI has no token) — run it after regenerating the
// linemap or adding products/handles/materials.
//
// Why: an Útfærslur id in a field that links to Vörulisti only fails at submit time (422), and a mocked
// test can't see it — that is exactly how every Jey/Hexxa submission failed from 2026-09-29 to 2026-10-01.
import fs from "node:fs";
import vm from "node:vm";

const BASE = "app91U15z9K704Okd";
const TABLES = {
  efnislisti: "tbl8CrVWKF8CuI7HD",   // Tækifæri "Skrokka efni" / "Fronta efni viðskiptavinar"
  vorulisti: "tblzuuRSRkeXaLWxC",    // Tækifæri "Höldur Viðskiptavinar ✊"
  utfaerslur: "tbl8HjvBwNJ41cTV0",   // Line Items "Vöru reitur 1 / 2"
};
const token = process.env.AIRTABLE_TOKEN;
if (!token) { console.error("AIRTABLE_TOKEN vantar (source .env.local)"); process.exit(2); }

const root = new URL("../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");
const ctx = { window: {}, console };
vm.runInNewContext(read("kitchen-planner-models.js"), ctx);
vm.runInNewContext(read("kitchen-planner-linemap.js"), ctx);
vm.runInNewContext(read("kitchen-planner-catalog.js"), ctx);
vm.runInNewContext(read("kitchen-planner-egger.js"), ctx);

const want = { efnislisti: new Set(), vorulisti: new Set(), utfaerslur: new Set() };
// handles → Vörulisti
for (const h of Object.values(ctx.window.KPMODELS.handles || {})) for (const o of h.lenOptions || []) want.vorulisti.add(o.vorulistiId);
// linemap + Töfrahorn → Útfærslur
(function walk(o) { for (const v of Object.values(o)) if (v && typeof v === "object") { if (typeof v.id === "string") want.utfaerslur.add(v.id); walk(v); } })(ctx.window.KP_LINEMAP);
const tof = read("kitchen-planner-3d.js").match(/tofrahornIds:(\{[^\n]+\} \})/);
for (const m of (tof ? tof[1] : "").matchAll(/"(rec\w{14})"/g)) want.utfaerslur.add(m[1]);
// lighting products (LIGHT_PRODUCTS in the planner) → Útfærslur
for (const m of (read("kitchen-planner.html") + read("kitchen-planner-3d.js")).matchAll(/utfaerslaId\s*:\s*"(rec\w{14})"/g)) want.utfaerslur.add(m[1]);
// Egger decors, fronts / carcass → Efnislisti
for (const d of Object.values(ctx.window.KPEGGER.decors)) for (const r of d.rows) want.efnislisti.add(r.id);
for (const src of [read("kitchen-planner-catalog.js"), read("kitchen-planner-3d.js")]) {
  for (const m of src.matchAll(/(?:efnislistiId|gripalistarId)\s*:\s*"(rec\w{14})"/g)) want.efnislisti.add(m[1]);
}

async function existing(table, ids) {
  const found = new Set();
  const list = [...ids];
  for (let i = 0; i < list.length; i += 50) {
    const f = "OR(" + list.slice(i, i + 50).map((id) => `RECORD_ID()='${id}'`).join(",") + ")";
    let offset = "";
    do {
      const url = `https://api.airtable.com/v0/${BASE}/${table}?filterByFormula=${encodeURIComponent(f)}&fields[]=_none_${offset ? "&offset=" + offset : ""}`;
      let r = await fetch(url.replace("&fields[]=_none_", ""), { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 30000)); r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
      const d = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(d));
      d.records.forEach((x) => found.add(x.id));
      offset = d.offset || "";
    } while (offset);
  }
  return found;
}

let bad = 0;
for (const [kind, ids] of Object.entries(want)) {
  const found = await existing(TABLES[kind], ids);
  const missing = [...ids].filter((id) => !found.has(id));
  console.log(`${missing.length ? "✖" : "✔"} ${kind}: ${ids.size - missing.length}/${ids.size} í réttri töflu`);
  for (const id of missing) {
    // say where it actually lives, if anywhere
    let where = "finnst hvergi";
    for (const [k2, t2] of Object.entries(TABLES)) if (k2 !== kind && (await existing(t2, [id])).size) where = `er í ${k2}`;
    console.log(`    ${id} — ${where}`);
  }
  bad += missing.length;
}
process.exit(bad ? 1 : 0);
