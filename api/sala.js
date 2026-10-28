// api/sala.js
// Sales actions from /crm (2026-10-27) that used to need the Airtable grid. Same idea as
// api/greidslur.js: no business logic of its own — each action writes the field an existing Airtable
// automation (or the person in the grid) already writes, so the automations stay in Airtable:
//
//   unnid     → checkbox "Tækifæri unnið 🏆" (+ status) → "Færir verk -> tækifæri unnið 🏆"
//               (wflGbtZowOX4cdk0M): Staðfest tilboð 🔒 PDF, Staða í skipulagi = For-skipulag,
//               SKRIF-CHAT "UNNIÐ 🏆🎉". Writing the status alone (what /crm did before) skipped all three.
//   tapad     → checkbox "Tækifæri tapað 🥀" (+ status), optional reason → new row in
//               "Töpuð tækifæri svör🥀" linked to the project (same choices as the customer form).
//   sent      → status "📤 Tilboð sent" + Næsta skref "⏳ Bíða eftir svari" in 3 days (only with a
//               Tilboð til sendingar PDF) → "Skráir tíma þegar tilboð var sent" → Eftirfylgni 1.0/2.0.
//   followup  → "Búið að fylgja eftir" (☎️ RH tók símtal …)   svar → "Svar við eftirfylgni"
//   likur     → "Líkur á sölu"                              prufa → "Prufuverk 🧪" (KPIs skip it)
//   approve   → clears "Óyfirfarið — Rakel ⚠️" on a Tengiliður / Fyrirtæki — owners and
//               Sölumaður / Arkitekt only, re-checked against Starfsmenn with the per-person login token.
//   fyrirspurn → "Staða" on a Vefspjall 💬 row (Nýtt → Skoðað / Afgreitt) — no automation watches that table.
//   afturkalla → "Afturkalla Unnið" (owner only, 2026-10-28): reverses what is safely reversible (see UNDO_NOTE).
// UNNIÐ posts to Google Chat through api/virkni.js addLine (env webhook) — the Airtable SKRIF-CHAT script
// step is broken (hard-coded webhook).
// GET ?k=…&stats=lost → loss reasons counted from "Töpuð tækifæri svör🥀".
// GET ?k=…&list=fyrirspurnir → open (not Afgreitt) site-chat conversations, newest first. Vefspjall is
//   write-only on the open proxy (every visitor's email + transcript), so it's read only here.
//
// Everything needs VERK_KEY (?k= / body.k); reads and writes by field id. Kept off the open
// /api/airtable proxy on purpose.

import { addLine } from "./virkni.js";

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
export const PROJECTS = "tbl4LMXlQjp66RFKI";
export const LOST = "tblqBugJUwhuUnQPa";
export const CONTACTS = "tblQ8zeUanriESWvL";
export const COMPANIES = "tbl2akoCETBx9S1SK";
const STARFSMENN = "tblhglpjQkczdG1AY";
export const VEFSPJALL = "tbltD1UNpqj05WtMx";
export const V = { first: "fldnERxcbscPlWHRb", talk: "fldIThjHh1sHECytq", open: "fldnUS4uFKBCsUDTf", email: "fldf7pztTLTwqGeTR", status: "fldxLQnSJy3X4SOI4", page: "fldYYGJVTdWtid40b", at: "fld97ErzJDU7UoUwe" };
export const V_STATUSES = ["Nýtt", "Skoðað", "Afgreitt"];
const REC = /^rec[A-Za-z0-9]{14}$/;

export const F = {
  name: "fldDC7LI0D4cUeCds",     // Heiti tækifæris / verkefnis
  stage: "fldSHOFH4ocUyoglg",    // Staða í söluferli
  won: "fld12pqrqXvsP5qvS",      // Tækifæri unnið 🏆
  lost: "fldN0h77hn5C0Y2LE",     // Tækifæri tapað 🥀
  tilbod: "flddIR5JAm8ZM753V",   // Tilboð til sendingar
  step: "fldOy9IcNbwNZgrUB",     // Næsta skref
  stepDate: "flddCMBfUhRuQrzMQ", // Næsta skref dags.
  followup: "fldpBbn9R81znPr6U", // Búið að fylgja eftir
  svar: "fldygHnitQ2ecN7J1",     // Svar við eftirfylgni
  likur: "fldPM6TY0a1Eq7h1e",    // Líkur á sölu
  prufa: "fldmFWmxlhMEtfD3y",    // Prufuverk 🧪
  contacts: "fldwF9nnmsFo2yp1R", // Tengiliður verkefnis 👤
  osynilegur: "fldxxGsEY1GkEw4BB", // Ósýnilegur afsláttur %   (fraction, 0.1 = 10 %)
  afslUpps: "fldJYI0FGjA1wChOh",   // Afsláttur í uppsetningu  (fraction)
  uppsetning: "fldf7s8YUWHgczAy5", // Uppsetning Bjarnarins 🪛🐻
  ferdir: "fld4qWuFpGim3IFmi",     // Fjöldi ferða 🚚
  skipting: "fldlvDTC46bqAsAP8",   // Skipting greiðslu
  planning: "fldXS9CA2HD7qJg2P",   // Staða í skipulagi
  confirmed: "fldx9h2VPlEjhFXPm",  // Staðfest tilboðsupphæð 🔒
  g2: "fldznyrXOEVeRTPy9",         // Greiðsla 2 greidd
  g3: "fld8eVrW714WQmean",         // Greiðsla 3 greidd
  log: "fldCoyt9zJ6NSHXyU",        // Konto drög 🧾
};
export const CONTACT_KT = "Kennitala 👤#️⃣";
export const kennitalaOf = (v) => String(v == null ? "" : v).replace(/\D/g, "");
// What "Afturkalla Unnið" does NOT undo — shown to the user and returned by the API.
export const UNDO_NOTE = [
  "Frysta Staðfest tilboð 🔒 PDF-afritið er ekki afturkallað (næsta Unnið skrifar yfir það).",
  "Konto-drög sem þegar voru búin til eru ekki afturkölluð (undo er því neitað ef G1-drög eru til).",
  "Læsingar á Line Items (🔒 Verðlás, læst hölduverð) eru ekki opnaðar héðan — opnaðu þær í Airtable.",
  "Ár/Mánuður staðfestingar og Virkni-línur sem urðu til standa eftir.",
];
// Verðstillingar the deal popup may set (`verd`). Discounts are capped at 50 % to catch a typed 10 meaning 10 %.
export const PRICE_KEYS = ["osynilegur", "afslUpps", "uppsetning", "ferdir", "skipting"];
export const L = { name: "fldvDFIGtjQarHVX3", reason: "fldeshNrwubHuiaOj", detail: "fldo8yRxBJHTGtEaL", project: "fld5AKHh8uChH7epA" };
export const PENDING = { [CONTACTS]: "fldPDEG0fiAmgI5ed", [COMPANIES]: "fldK3PJLILdEjt5MG" }; // Óyfirfarið — Rakel ⚠️

export const WON = "🏆 Tækifæri unnið", LOST_STAGE = "🥀 Tækifæri tapað", SENT = "📤 Tilboð sent";
const CLOSED = [WON, LOST_STAGE, "🚫 Tækifæri neitað"];
export const CHOICES = {
  followup: ["☎️ 🐰 RH tók símtal", "📤 🐰 RH sendi póst ", "☎️ 🦁 JK Tók símtal ", "📤 🦁 JK sendi póst", "💬 Í samskiptum (líkleg)"],
  svar: ["Bíður fjármagns 💸", "Bíður betri tíma ⏰", "Óákveðið❓", "Bíða e. svari ⏳"],
  likur: ["🔴 Lítil", "🟡 Miðlungs", "🟢 Góð", "🔥 Mjög líkleg"],
  ferdir: ["1 Ferð 🚚", "2 Ferðir 🚚🚚", "3 Ferðir 🚚🚚🚚", "4 Ferðir 🚚🚚🚚🚚"],
  skipting: ["100%", "50% - 50%", "40% - 30% - 30%"],
  reason: ["⏰ Afhendingartími", "📈 Verð", "🔨 Valdi annað fyrirtæki", "🛟 Upplifði óöryggi í ferlinu", "📆 Verkefni var frestað", "✍️ Annað"],
};
const APPROVER_TITLES = ["Sölumaður / Arkitekt"];
const OWNER_TYPE = "Eigandi 👨🏻‍💼";

// Iceland is UTC+0 all year, so the ISO date is the local date.
export function inDays(n, now = new Date()) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Why an action isn't allowed on this project right now (null = allowed). Pure, for tests.
// `ctx.kt` = the linked contact's kennitala as read by the handler (unnid only).
export function refusal(action, f, b = {}, ctx = {}) {
  const stage = f[F.stage] || "";
  if (action === "unnid") {
    if (stage === WON) return "Verkið er þegar unnið.";
    const missing = [];
    if (!(Array.isArray(f[F.tilbod]) && f[F.tilbod].length)) missing.push("Tilboð til sendingar (PDF) — prentaðu tilboð fyrst");
    if (!f[F.skipting]) missing.push("Skipting greiðslu — veldu í Verðstillingum");
    if (!(f[F.contacts] || []).length) missing.push("tengiliður á verkinu");
    else if (kennitalaOf(ctx.kt).length !== 10) missing.push("kennitala tengiliðs (10 tölustafir) — bættu henni við á tengiliðnum");
    return missing.length ? "Ekki hægt að merkja unnið — vantar: " + missing.join("; ") + "." : null;
  }
  if (action === "afturkalla") {
    if (stage !== WON) return "Verkið er ekki merkt unnið.";
    if (f[F.g2] || f[F.g3]) return "Greiðsla 2 eða 3 er merkt greidd — ekki hægt að afturkalla héðan.";
    if (/·\s*G1\s*·\s*drög/.test(String(f[F.log] || ""))) return "G1-drög í Konto eru til — eyddu þeim fyrst, svo má afturkalla.";
    const plan = f[F.planning] || "";
    if (plan && plan !== "For-skipulag") return `Verkið er komið í „${plan}“ í skipulagi — ekki hægt að afturkalla héðan.`;
    return null;
  }
  if (action === "tapad") {
    if (stage === LOST_STAGE) return "Verkið er þegar tapað.";
    if (b.reason != null && b.reason !== "" && !CHOICES.reason.includes(b.reason)) return "Óþekkt ástæða.";
    return null;
  }
  if (action === "sent") {
    if (CLOSED.includes(stage)) return "Verkið er lokað.";
    if (!(Array.isArray(f[F.tilbod]) && f[F.tilbod].length)) return "Ekkert tilboð til sendingar — prentaðu tilboð fyrst.";
    return null;
  }
  if (action === "followup" || action === "svar" || action === "likur") {
    if (action === "followup" && (b.value == null || b.value === "")) return "Veldu hvað var gert.";
    return b.value == null || b.value === "" || CHOICES[action].includes(b.value) ? null : "Óþekkt gildi.";
  }
  if (action === "prufa") return typeof b.value === "boolean" ? null : "Gildið þarf að vera já/nei.";
  if (action === "verd") {
    // After Unnið the price is locked (🔒 Verðlás) and Konto drafts read Skipting — change those in Airtable.
    if (stage === WON) return "Verðstillingar eru læstar eftir staðfestingu.";
    const v = b.fields && typeof b.fields === "object" ? b.fields : null;
    const keys = v ? Object.keys(v) : [];
    if (!keys.length || keys.some((x) => !PRICE_KEYS.includes(x))) return "Óþekktur reitur.";
    for (const x of keys) {
      const val = v[x];
      if (x === "osynilegur" || x === "afslUpps") { if (val !== null && !(typeof val === "number" && val >= 0 && val <= 0.5)) return "Afsláttur þarf að vera 0–50 %."; }
      else if (x === "uppsetning") { if (typeof val !== "boolean") return "Uppsetning þarf að vera já/nei."; }
      else if (val !== null && !CHOICES[x].includes(val)) return "Óþekkt gildi.";
    }
    return null;
  }
  if (action === "tengilid") {
    if (!REC.test(String(b.contactId || ""))) return "Ógildur tengiliður.";
    if ((f[F.contacts] || []).includes(b.contactId)) return "Tengiliðurinn er þegar á verkinu.";
    return null;
  }
  return "Óþekkt aðgerð.";
}

// The PATCH(es) an allowed project action sends, in order. A won/lost checkbox that is already ticked
// (left over from an earlier win that was reopened) is unticked first — otherwise ticking it again
// is no change and the automation never fires.
export function patchesFor(action, f, b = {}, now = new Date()) {
  if (action === "unnid" || action === "tapad") {
    const box = action === "unnid" ? F.won : F.lost, other = action === "unnid" ? F.lost : F.won;
    const out = [];
    if (f[box]) out.push({ [box]: false });
    out.push({ [box]: true, [other]: false, [F.stage]: action === "unnid" ? WON : LOST_STAGE });
    return out;
  }
  if (action === "afturkalla") {
    return [{ [F.won]: false, [F.stage]: Array.isArray(f[F.tilbod]) && f[F.tilbod].length ? SENT : "✍️ Teikna og yfirfara tilboð", [F.planning]: null, [F.confirmed]: null }];
  }
  if (action === "sent") return [{ [F.stage]: SENT, [F.step]: "⏳ Bíða eftir svari frá viðskiptavini", [F.stepDate]: inDays(3, now) }];
  if (action === "prufa") return [{ [F.prufa]: b.value }];
  if (action === "verd") { const o = {}; for (const [x, val] of Object.entries(b.fields)) o[F[x]] = val; return [o]; }
  if (action === "tengilid") return [{ [F.contacts]: [...(f[F.contacts] || []), b.contactId] }];
  return [{ [F[action]]: b.value || null }];
}

const H = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
async function at(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: H(token) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}
const byId = (table, id, fields) => `${BASE}/${table}?maxRecords=1&returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(`RECORD_ID()='${id}'`)}&` + fields.map((x) => "fields%5B%5D=" + x).join("&");

export function shapeInquiry(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id, at: f[V.at] || rec.createdTime || null, status: f[V.status] || "Nýtt",
    email: f[V.email] || "", page: f[V.page] || "",
    first: String(f[V.first] || "").slice(0, 500), open: String(f[V.open] || "").slice(0, 500),
    talk: String(f[V.talk] || "").slice(0, 6000),
  };
}
async function inquiries(token) {
  const fml = encodeURIComponent(`{${V.status}}!='Afgreitt'`);
  const r = await at(token, `${BASE}/${VEFSPJALL}?pageSize=50&returnFieldsByFieldId=true&filterByFormula=${fml}&sort%5B0%5D%5Bfield%5D=${V.at}&sort%5B0%5D%5Bdirection%5D=desc&` + Object.values(V).map((x) => "fields%5B%5D=" + x).join("&"));
  return r.ok ? (r.d.records || []).map(shapeInquiry) : null;
}

async function lostStats(token) {
  const counts = {};
  let total = 0, offset = "";
  do {
    const r = await at(token, `${BASE}/${LOST}?pageSize=100&returnFieldsByFieldId=true&fields%5B%5D=${L.reason}` + (offset ? "&offset=" + offset : ""));
    if (!r.ok) return null;
    for (const rec of r.d.records || []) { const k = rec.fields[L.reason] || "(ekki svarað)"; counts[k] = (counts[k] || 0) + 1; total++; }
    offset = r.d.offset || "";
  } while (offset);
  return { total, reasons: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason, n })) };
}

// Owners + Sölumaður / Arkitekt (Rakel) may approve. Never trusts the page's own roles: the login token is
// bound to one Starfsmenn id and that record is re-read here.
async function mayApprove(token, me, t, ownerOnly = false) {
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!secret || !REC.test(String(me || ""))) return false;
  const { skrifstofaDayToken } = await import("./skrifstofa-login.js");
  if (t !== skrifstofaDayToken(secret, me, 0) && t !== skrifstofaDayToken(secret, me, -1)) return false;
  const url = `${BASE}/${STARFSMENN}?maxRecords=1&filterByFormula=${encodeURIComponent(`RECORD_ID()='${me}'`)}&fields%5B%5D=${encodeURIComponent("Tegund starfsmanns 🧑‍💻")}&fields%5B%5D=${encodeURIComponent("Starfsheiti 💼")}`;
  const r = await at(token, url);
  const f = ((r.d.records || [])[0] || {}).fields || {};
  return r.ok && (f["Tegund starfsmanns 🧑‍💻"] === OWNER_TYPE || (!ownerOnly && APPROVER_TITLES.includes(f["Starfsheiti 💼"])));
}

export default async function handler(req, res) {
  const b = req.body || {}, q = req.query || {};
  if (!process.env.VERK_KEY || (q.k || b.k) !== process.env.VERK_KEY) return res.status(403).json({ error: "Ógildur lykill" });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "Server not configured" });

  if (req.method === "GET") {
    if (q.list === "fyrirspurnir") {
      const l = await inquiries(token);
      return l ? res.status(200).json({ records: l }) : res.status(502).json({ error: "Airtable" });
    }
    if (q.stats !== "lost") return res.status(400).json({ error: "?stats=lost" });
    const s = await lostStats(token);
    return s ? res.status(200).json(s) : res.status(502).json({ error: "Airtable" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET eða POST" });
  const action = String(b.action || "");
  const id = String(b.recordId || "").trim();
  if (!REC.test(id)) return res.status(400).json({ error: "Ógilt recordId" });

  if (action === "fyrirspurn") {
    if (!V_STATUSES.includes(b.value)) return res.status(409).json({ error: "Óþekkt staða." });
    const p = await at(token, `${BASE}/${VEFSPJALL}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: { [V.status]: b.value } }) });
    return p.ok ? res.status(200).json({ ok: true, action }) : res.status(p.status).json({ error: "Airtable: " + ((p.d.error && (p.d.error.type || p.d.error)) || p.status) });
  }

  if (action === "approve") {
    const table = b.table === "company" ? COMPANIES : b.table === "contact" ? CONTACTS : null;
    if (!table) return res.status(400).json({ error: "Óþekkt tafla" });
    if (!(await mayApprove(token, b.me, b.t))) return res.status(403).json({ error: "Aðeins eigandi eða sölufulltrúi getur samþykkt (skráðu þig inn aftur ef þú ert það)." });
    const p = await at(token, `${BASE}/${table}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: { [PENDING[table]]: false } }) });
    return p.ok ? res.status(200).json({ ok: true, action }) : res.status(p.status).json({ error: "Airtable: " + ((p.d.error && (p.d.error.type || p.d.error)) || p.status) });
  }

  const rec = await at(token, byId(PROJECTS, id, Object.values(F)));
  const row = (rec.d.records || [])[0];
  if (!rec.ok || !row) return res.status(rec.ok ? 404 : rec.status).json({ error: "Fann ekki verkið" });
  let ctx = {};
  if (action === "unnid") {
    const cid = (row.fields[F.contacts] || [])[0];
    if (cid && REC.test(cid)) {
      const c = await at(token, `${BASE}/${CONTACTS}/${cid}?fields%5B%5D=${encodeURIComponent(CONTACT_KT)}`);
      ctx = { kt: c.ok && c.d.fields ? c.d.fields[CONTACT_KT] : "" };
    }
  }
  const why = refusal(action, row.fields, b, ctx);
  if (why) return res.status(409).json({ error: why });
  if (action === "afturkalla" && !(await mayApprove(token, b.me, b.t, true))) return res.status(403).json({ error: "Aðeins eigandi getur afturkallað Unnið (skráðu þig inn aftur ef þú ert eigandi)." });

  for (const fields of patchesFor(action, row.fields, b)) {
    const p = await at(token, `${BASE}/${PROJECTS}/${id}`, { method: "PATCH", body: JSON.stringify({ fields, typecast: false }) });
    if (!p.ok) return res.status(p.status).json({ error: "Airtable: " + ((p.d.error && (p.d.error.type || p.d.error)) || p.status) });
  }
  const projectName = String(row.fields[F.name] || "");
  if (action === "unnid") {
    await addLine({ texti: "UNNIÐ 🏆🎉", tegund: "staða", til: "Skrifstofa", t: id, tengill: "/crm", chat: true, projectName });
  }
  if (action === "afturkalla") {
    // Best effort: an automation-written field may not be writable — a failure is reported, not fatal.
    const x = await at(token, `${BASE}/${PROJECTS}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: { "Verk staðfest þann": null }, typecast: false }) });
    await addLine({ texti: "Unnið afturkallað", tegund: "staða", til: "Skrifstofa", t: id, tengill: "/crm", chat: false, projectName });
    return res.status(200).json({ ok: true, action, notReverted: UNDO_NOTE, dateCleared: x.ok });
  }
  let lostRow = null;
  if (action === "tapad" && b.reason) {
    const detail = String(b.detail || "").slice(0, 500);
    const c = await at(token, `${BASE}/${LOST}`, { method: "POST", body: JSON.stringify({ fields: {
      [L.name]: String(row.fields[F.name] || "").slice(0, 200) + " (skráð í /crm)",
      [L.reason]: b.reason, ...(detail ? { [L.detail]: detail } : {}), [L.project]: [id],
    } }) });
    // The project is already lost at this point; a failed reason row is reported, not rolled back.
    if (!c.ok) return res.status(200).json({ ok: true, action, reasonSaved: false });
    lostRow = c.d.id;
  }
  return res.status(200).json({ ok: true, action, ...(lostRow ? { reasonSaved: true } : {}) });
}
