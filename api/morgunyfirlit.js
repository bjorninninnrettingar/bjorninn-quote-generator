// api/morgunyfirlit.js — Morgunyfirlit kl. 07:30 (2026-10-27)
// One morning line in Virkni 🔔 + one ALMENNT chat post listing what needs a human today:
//   1. won projects due within 7 days that aren't Má afhenda / Afhent yet ("sein skil")
//   2. Má afhenda with no booked time (no delivery/pickup date today or later)
//   3. Quick Fix past its Skiladagur, or with no Ábyrgðarmaður
//   4. production starts within 5 days but "5. Efni lent í húsi" isn't ticked
// Replaces the switched-off "💬 Sein skil á verkum" automation (0 Airtable automations used).
// Nothing to report → nothing written. Skips Sat/Sun.
//
// Cron (vercel.json, 07:30 UTC = Iceland): Authorization: Bearer CRON_SECRET.
// By hand: GET /api/morgunyfirlit?k=<VERK_KEY> → dry run, returns the text, writes nothing.
//          add &send=1 to really write + post.

import { addLine } from "./virkni.js";

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const QUICKFIX = "tblDQWuf4OSjUv2XI";
const ORIGIN = "https://bjorninn.vercel.app";
const WON = "🏆 Tækifæri unnið";
const DELIVER = "Má Afhenda 🚚";
const DONE = "Afhent (LOKIÐ ✅)";
const F = {
  name: "Heiti tækifæris / verkefnis",
  sala: "Staða í söluferli",
  fram: "Staða í framleiðslu",
  due: "Áætlaður afhendingardagur Björninn (internal)",
  pickup: "Viðskiptavinur sækir þann:",
  start: "Upphafs framleiðsludagur verks",
  efni: "5. Efni lent í húsi",
};

const d10 = (v) => (v ? String(v).slice(0, 10) : "");
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const short = (name) => String(name || "").split(" - ")[0].trim() || "(nafnlaust)";
const fmt = (iso) => (iso ? Number(iso.slice(8, 10)) + "." + Number(iso.slice(5, 7)) + "." : "");

// Pure: projects/quick fixes (Airtable records) + today → { sections, count, text }.
export function buildSummary(projects, quickfixes, today) {
  const in7 = addDays(today, 7), in5 = addDays(today, 5);
  const live = projects.filter((p) => p.fields[F.sala] === WON && p.fields[F.fram] !== DONE);
  const seint = live.filter((p) => { const d = d10(p.fields[F.due]); return d && d <= in7 && p.fields[F.fram] !== DELIVER; })
    .sort((a, b) => d10(a.fields[F.due]).localeCompare(d10(b.fields[F.due])))
    .map((p) => { const d = d10(p.fields[F.due]); return short(p.fields[F.name]) + " — afh. " + fmt(d) + (d < today ? " (liðið!)" : "") + " · " + String(p.fields[F.fram] || "ekki byrjað"); });
  const ekkiBokad = live.filter((p) => p.fields[F.fram] === DELIVER && !(d10(p.fields[F.due]) >= today || d10(p.fields[F.pickup]) >= today))
    .map((p) => short(p.fields[F.name]));
  const qf = quickfixes.filter((q) => q.fields["Staða"] !== "Lokið ✅")
    .filter((q) => !q.fields["Ábyrgðarmaður"] || (d10(q.fields["Skiladagur"]) && d10(q.fields["Skiladagur"]) < today))
    .map((q) => String(q.fields["Vandamálið"] || "Quick Fix").slice(0, 60) + " — " +
      (!q.fields["Ábyrgðarmaður"] ? "enginn ábyrgðarmaður" : q.fields["Ábyrgðarmaður"] + ", skil " + fmt(d10(q.fields["Skiladagur"]))));
  const efni = live.filter((p) => { const s = d10(p.fields[F.start]); return s && s >= today && s <= in5 && !p.fields[F.efni]; })
    .map((p) => short(p.fields[F.name]) + " — byrjar " + fmt(d10(p.fields[F.start])));

  const sections = [
    ["Afhending innan 7 daga, ekki í Má afhenda", seint],
    ["Má afhenda án bókaðs tíma", ekkiBokad],
    ["Quick Fix fram yfir / án eiganda", qf],
    ["Byrjar innan 5 daga en efni ekki komið", efni],
  ].filter(([, rows]) => rows.length);
  const count = sections.reduce((n, [, rows]) => n + rows.length, 0);
  const text = sections.map(([h, rows]) => "*" + h + " (" + rows.length + ")*\n" + rows.slice(0, 10).map((r) => "• " + r).join("\n") +
    (rows.length > 10 ? "\n• … og " + (rows.length - 10) + " í viðbót" : "")).join("\n\n");
  return { sections: sections.map(([h, rows]) => ({ heading: h, rows })), count, text };
}

async function listAll(table, params) {
  let out = [], offset = "";
  do {
    const r = await fetch(`${BASE}/${table}?${params}${offset ? "&offset=" + offset : ""}`, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` } });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || `Airtable ${r.status}`);
    out = out.concat(d.records || []);
    offset = d.offset || "";
  } while (offset);
  return out;
}
const fieldsQs = (names) => names.map((n) => "fields%5B%5D=" + encodeURIComponent(n)).join("&");

export default async function handler(req, res) {
  const q = req.query || {};
  const cron = !!process.env.CRON_SECRET && req.headers?.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const byHand = !!process.env.VERK_KEY && q.k === process.env.VERK_KEY;
  if (!cron && !byHand) return res.status(403).json({ error: "Ógildur lykill" });
  const send = cron || q.send === "1";

  const today = new Date().toISOString().slice(0, 10); // Iceland = UTC
  const dow = new Date().getUTCDay();
  if (cron && (dow === 0 || dow === 6)) return res.status(200).json({ ok: true, skipped: "helgi" });

  try {
    const pf = encodeURIComponent(`AND({${F.sala}}="${WON}", {${F.fram}}!="${DONE}")`);
    const [projects, quickfixes] = await Promise.all([
      listAll(PROJECTS, `filterByFormula=${pf}&${fieldsQs(Object.values(F))}&pageSize=100`),
      listAll(QUICKFIX, `filterByFormula=${encodeURIComponent('{Staða}!="Lokið ✅"')}&${fieldsQs(["Vandamálið", "Ábyrgðarmaður", "Skiladagur", "Staða"])}&pageSize=100`),
    ]);
    const s = buildSummary(projects, quickfixes, today);
    if (!send || !s.count) return res.status(200).json({ ok: true, dry: !send, today, ...s });

    await addLine({ texti: "☀️ Morgunyfirlit: " + s.count + " atriði — " + s.sections.map((x) => x.heading + " (" + x.rows.length + ")").join(", "),
      tegund: "seint", til: "Allir", tengill: "/skrifstofa", hver: "Morgunyfirlit" });
    let chat = "no-webhook";
    const hook = process.env.GOOGLE_CHAT_WEBHOOK_ALMENNT;
    if (hook && /^https:\/\/chat\.googleapis\.com\//.test(hook)) {
      const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ text: "☀️ *Morgunyfirlit " + fmt(today) + "*\n\n" + s.text + "\n\n<" + ORIGIN + "/skrifstofa|Opna skrifstofu>" }) }).catch(() => null);
      chat = r && r.ok ? "sent" : "failed";
    }
    return res.status(200).json({ ok: true, today, count: s.count, chat });
  } catch (e) {
    console.error("morgunyfirlit:", e);
    return res.status(500).json({ error: e.message });
  }
}
