// api/kp-submit.js
// Kitchen planner (/skipuleggja) submission — Tengiliður → Tækifæri → one Line Item per cabinet, in ONE
// request that is safe to repeat. The browser used to make 2 + N separate /api/airtable creates; a dropped
// connection or an Airtable 429 halfway left a Tækifæri with only some of its Line Items, and pressing
// "Senda inn" again created a second, duplicate Tækifæri.
//
// Now: the client sends a submission id (`sid`, a UUID kept in its draft) with the whole payload.
//   - The Tækifæri carries that sid inside its planner JSON, so a repeat finds the existing one instead of
//     creating another; a contact with the same e-mail created in the last 2 h is reused the same way.
//   - Line Items already on that Tækifæri (matched by 🔑 = "Sk1", "Sk2"...) are skipped, the rest are
//     created 10 per request (Airtable's batch maximum).
//   - Every Airtable call retries on 429 / 5xx / network errors with backoff.
// So the client can simply retry the same POST until it gets 200, and the result is exactly one
// Tækifæri with exactly one Line Item per cabinet.
//
// "Vöru reitur 3" (2026-10-06): the LED a cabinet carries, for planning only — no quantity and no price there
// (the priced lighting is its own Line Item, V1 = the product, Magn = count). Einingar aukahlutir is being
// deleted, so nothing is written to it.
//
// The proxy (/api/airtable) no longer allows creating these three tables at all — this is the only path.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const CONTACTS = "tblQ8zeUanriESWvL";          // Tengiliðir
const PROJECTS = "tbl4LMXlQjp66RFKI";          // Tækifæri 📣 (projects)
const LINE_ITEMS = "tblFcsUoGxsuUwNEH";        // Vöru línur ➖📦 (Line item's)
const PLANNER_JSON = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const PROJECT_NAME = "Heiti tækifæris / verkefnis"; // primary field, "T-227 | Name - "
const LINK_TO_PROJECT = "Tækifæri 📣 (projects)";

// V1/V2/V3 as last sent by the designer, per Sk number — kept in the planner JSON as `liSent` so pro Vista can tell
// "changed in the drawing" from "changed by hand in Airtable" (api/kp-pro.js). One string per field: sorted ids.
export const PRODUCT_FIELDS = ["Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3"];
export const idsKey = (v) => (Array.isArray(v) ? v.slice().sort().join(",") : "");
export const sentOf = (li) => PRODUCT_FIELDS.map((f) => idsKey(li[f]));

// What the client may set (everything else is dropped silently, like the proxy's CREATABLE_FIELDS).
export const PROJECT_FIELDS = ["Skrokka efni 🔲 viðskiptavinar", "Fronta efni viðskiptavinar 🖼️", "Borðplata viðskiptavinar 🍽️", "Skilaboð til skipulags",
  "Höldur Viðskiptavinar ✊", "Litur á höldum 🎨", "Magn Halda 1", "Höldur Viðskiptavinar ✊2.0", "Magn halda 2.0", // one SKU per slot (G1, 2026-10-27)
  "Fronta efni 2.0 Viðskiptavinar 🖼️", "Innskúffufrontar [Handvalið]"]; // FR2 + inner drawer fronts default (2026-10-23)
export const LINE_FIELDS = ["Rými 🏡", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3", "Magn", "🔑", "Skilaboð til skipulags", "Smíðagögn (JSON) 🔧",
  "Frontaefni #2", "Tegund innskúffu fronts"];
// "Tegund innskúffu fronts" (Line Item) / "Innskúffufrontar [Handvalið]" (Tækifæri) choices — anything else is dropped,
// so typecast can never invent a new select option from a request.
export const INNER_FRONTS = ["Skrokkaefni", "Frontaefni", "Frontaefni 2", "Ál", "Ál og gler"];
// A self-serve submission must never look like reviewed designer work or enter production by itself.
export const PROJECT_FORCED = {
  "Staða í söluferli": "Hönnun & Ráðgjöf 🖊️✨",
  "Staða í skipulagi": "For-skipulag",
  "Sjálfsafgreiðsla — óyfirfarið ⚠️": true,
};
const MAX_LINES = 200;
const SID_RE = /^[A-Za-z0-9-]{16,64}$/;
const EMAIL_RE = /^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/;
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") out[k] = obj[k];
  if ("Innskúffufrontar [Handvalið]" in out && !INNER_FRONTS.includes(out["Innskúffufrontar [Handvalið]"])) delete out["Innskúffufrontar [Handvalið]"];
  if ("Tegund innskúffu fronts" in out && !INNER_FRONTS.includes(out["Tegund innskúffu fronts"])) delete out["Tegund innskúffu fronts"];
  if ("Frontaefni #2" in out) out["Frontaefni #2"] = out["Frontaefni #2"] === true;
  return out;
};
const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// One Airtable call with retries. 429 = Airtable's 5 req/s per base limit (it asks for a pause);
// 5xx and network errors are usually momentary. 4xx other than 429 are real errors — no retry.
// A POST is only retried on 429 (Airtable did nothing then): after a 5xx or a dropped connection it may already have
// created the record, and blindly POSTing again made a second contact / Tækifæri / batch of lines (2026-10-25). The
// error goes back as a 502 instead and the client re-sends the whole submission, which resumes by sid, contact
// e-mail and the 🔑s already on the Tækifæri — so nothing is made twice. GET/PATCH are safe to repeat.
export function makeAirtable(token, { fetchImpl = fetch, delays = [500, 1500, 3000, 6000, 10000] } = {}) {
  return async function at(method, path, body) {
    let lastErr;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt) await sleep(delays[attempt - 1]);
      let r;
      try {
        r = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) { lastErr = e; if (method === "POST") break; continue; }
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      lastErr = Object.assign(new Error(`Airtable ${r.status}: ${JSON.stringify(data).slice(0, 300)}`), { status: r.status });
      if (r.status !== 429 && r.status < 500) throw lastErr;
      if (r.status !== 429 && method === "POST") break;
    }
    throw lastErr;
  };
}

function listPath(table, formula, fields, max) {
  const p = new URLSearchParams();
  p.set("filterByFormula", formula);
  if (max) p.set("maxRecords", String(max));
  fields.forEach((f) => p.append("fields[]", f));
  // Airtable reads "+" as a literal plus inside formulas — always %20.
  return `${table}?${p.toString().replace(/\+/g, "%20")}`;
}

export async function listAll(at, table, formula, fields) {
  const out = [];
  let offset;
  do {
    const data = await at("GET", listPath(table, formula, fields) + (offset ? `&offset=${offset}` : ""));
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return out;
}

// Handles → the Tækifæri's two slots (G1, 2026-10-27). Airtable prices handles as Σprice("Höldur ✊") × "Magn Halda 1"
// + Σprice("Höldur ✊2.0") × "Magn halda 2.0", and the quote PDF prints the same two rows. The drawing sends how many of
// each SKU it uses (`handleSkus`); with one or two SKUs that is exact. More (Jey cut-to-size: 400/600/800/900/3000…)
// can't fit two slots, so two of the used SKUs and a split of the TRUE total count are picked whose amount is the
// smallest one ≥ the exact Σ nᵢ·pᵢ — at most one handle's price step too high, never low. (It used to send every SKU
// with one count: every handle priced as the sum of all lengths, ~4×.) Ordering never reads these fields — each
// Eyðublað's handle comes from its own Útfærslur in Keyra skipulag.
export const PR_PRICE = "fldCJjSJWoUWyT7iv"; // Vörulisti "Söluverð Bjarnarins 💰" (án vsk)
export function validHandleSkus(v) {
  return Array.isArray(v) && v.length <= 24 && v.every((x) => x && REC_RE.test(String(x.id)) && Number.isInteger(x.n) && x.n >= 1 && x.n <= 500);
}
export function handleSlots(skus, priceOf) {
  const by = new Map();
  for (const x of skus || []) by.set(x.id, (by.get(x.id) || 0) + x.n);
  const used = [...by].map(([id, n]) => ({ id, n, p: priceOf(id) || 0 })).sort((a, b) => b.n - a.n || a.p - b.p || (a.id < b.id ? -1 : 1));
  if (used.length <= 2) return used.map(({ id, n }) => ({ id, n }));
  const N = used.reduce((a, x) => a + x.n, 0), exact = used.reduce((a, x) => a + x.n * x.p, 0);
  let best = null;
  for (const X of used) for (const Y of used) {
    if (X === Y || X.p > Y.p) continue;
    for (let c2 = 0; c2 <= N; c2++) {
      const t = (N - c2) * X.p + c2 * Y.p;
      if (t < exact - 1e-6) continue;
      const moved = Math.abs(N - c2 - X.n) + Math.abs(c2 - Y.n); // prefer the split closest to the real counts
      if (!best || t < best.t - 1e-6 || (Math.abs(t - best.t) <= 1e-6 && moved < best.moved)) best = { t, moved, s: [{ id: X.id, n: N - c2 }, { id: Y.id, n: c2 }] };
      break; // the first c2 that reaches `exact` is this pair's cheapest
    }
  }
  return best.s.filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}
// the four Tækifæri fields for `skus`, prices read from Vörulisti
export async function handleSlotFields(at, skus) {
  const ids = [...new Set(skus.map((x) => x.id))], price = {};
  if (!ids.length) return {};
  const f = "OR(" + ids.map((id) => `RECORD_ID()='${id}'`).join(",") + ")";
  const d = await at("GET", `tblzuuRSRkeXaLWxC?filterByFormula=${encodeURIComponent(f)}&returnFieldsByFieldId=true&fields%5B%5D=${PR_PRICE}`);
  for (const r of d.records || []) price[r.id] = Number((r.fields || {})[PR_PRICE]) || 0;
  const sl = handleSlots(skus, (id) => price[id]);
  return { "Höldur Viðskiptavinar ✊": [sl[0].id], "Magn Halda 1": sl[0].n,
    "Höldur Viðskiptavinar ✊2.0": sl[1] ? [sl[1].id] : [], "Magn halda 2.0": sl[1] ? sl[1].n : 0 };
}

// Every field name this endpoint uses, per table (api/field-check.js checks them daily).
export function fieldDeps() {
  return {
    [CONTACTS]: new Set(["Fornafn ⬅️", "Eftirnafn ➡️", "Netfang 📧", "Símanúmer ☎️", "Tegund tengiliðs 👥", "Hvaðan kom viðskiptavinurinn 📥"]),
    [PROJECTS]: new Set([...PROJECT_FIELDS, ...Object.keys(PROJECT_FORCED), "Tengiliður verkefnis 👤", PLANNER_JSON, PROJECT_NAME, "Teikningar úr skipuleggjara 📐"]),
    [LINE_ITEMS]: new Set([...LINE_FIELDS, LINK_TO_PROJECT]),
  };
}

// "Hvernig fréttir þú af okkur?" (Studio, 2026-10-26) → an EXISTING choice of the contact's single select "Hvaðan kom
// viðskiptavinurinn 📥" (Facebook / Instagram / TikTok / Tilvísun frá fyrri viðskiptavin / Arkitekt bendi á okkur /
// Vefsíða — checked in the live base). Google / Annað / no answer have no choice of their own: "Vefsíða" as before
// (the answer itself is in Skilaboð til skipulags). Never typecast a new choice from what the browser sends.
export const SOURCE_CHOICES = { Instagram: "Instagram", Facebook: "Facebook", "Meðmæli": "Tilvísun frá fyrri viðskiptavin" };
export const sourceChoice = (v) => (Object.prototype.hasOwnProperty.call(SOURCE_CHOICES, String(v || "")) ? SOURCE_CHOICES[v] : "Vefsíða");

export function validate(body) {
  const b = body || {};
  if (!SID_RE.test(String(b.sid || ""))) return "Ógilt sid";
  const c = b.contact || {};
  if (!String(c.fornafn || "").trim()) return "Nafn vantar";
  if (!EMAIL_RE.test(String(c.netfang || "").trim())) return "Ógilt netfang";
  if (typeof b.state !== "object" || !b.state) return "Skipulag vantar";
  const bad = validateLineItems(b.lineItems);
  if (bad) return bad;
  for (const v of [b.project?.["Skrokka efni 🔲 viðskiptavinar"], b.project?.["Fronta efni viðskiptavinar 🖼️"], b.project?.["Borðplata viðskiptavinar 🍽️"], b.project?.["Höldur Viðskiptavinar ✊"], b.project?.["Höldur Viðskiptavinar ✊2.0"], b.project?.["Fronta efni 2.0 Viðskiptavinar 🖼️"]]) {
    if (v != null && !(Array.isArray(v) && v.every((x) => REC_RE.test(x)))) return "Ógild tenging";
  }
  // typecast:true would turn any text into a new select choice / a stray number — keep these to what the planner sends
  const p = b.project || {};
  if (b.handleSkus != null && !validHandleSkus(b.handleSkus)) return "Ógildar höldur";
  for (const f of ["Magn Halda 1", "Magn halda 2.0"]) if (p[f] != null && !(Number.isInteger(p[f]) && p[f] >= 0 && p[f] <= 500)) return "Ógilt Magn Halda";

  return null;
}

// Line Items as the designer sends them — also checked by api/kp-pro.js (pro Vista creates the missing ones).
export function validateLineItems(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length > MAX_LINES) return "Ógildar línur";
  const keys = new Set();
  for (const li of lineItems) {
    if (!li || !String(li["🔑"] || "")) return "Lína án 🔑";
    if (keys.has(li["🔑"])) return "Tvítekinn 🔑";
    if (!LINE_KEY_RE.test(String(li["🔑"]))) return "Ógilt 🔑 á línu";
    if (li["Magn"] != null && !(Number.isInteger(li["Magn"]) && li["Magn"] >= 1 && li["Magn"] <= 999)) return "Ógilt Magn";

    keys.add(li["🔑"]);
    for (const f of ["Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3"]) {
      const v = li[f];
      if (v != null && !(Array.isArray(v) && v.length <= 5 && v.every((x) => REC_RE.test(x)))) return "Ógild tenging";
    }
    const sm = li["Smíðagögn (JSON) 🔧"];
    if (sm != null && !(typeof sm === "string" && sm.length <= 20000 && /^\{"v":1[,}]/.test(sm))) return "Ógild Smíðagögn";
  }
  return null;
}

// The whole submission. Returns { recordId, created, skipped, resumed }.
export async function submit(at, body) {
  const sid = body.sid;
  const email = String(body.contact.netfang).trim();

  // 1. Existing Tækifæri for this submission (a retry)? The sid lives in the planner JSON.
  const existing = await at("GET", listPath(PROJECTS,
    `AND(FIND('"submissionId":"${sid}"',{${PLANNER_JSON}}),IS_AFTER(CREATED_TIME(),DATEADD(NOW(),-2,'days')))`,
    [PROJECT_NAME], 1));
  let opp = (existing.records || [])[0];
  const resumed = !!opp;

  if (!opp) {
    // 2. Contact — reuse one made by an earlier attempt of this same submission (same e-mail, last 2 h),
    //    never an older customer record (anyone can type any e-mail into the form).
    const found = await at("GET", listPath(CONTACTS,
      `AND(LOWER({Netfang 📧})="${q(email.toLowerCase())}",IS_AFTER(CREATED_TIME(),DATEADD(NOW(),-2,'hours')))`,
      ["Netfang 📧"], 1));
    let contact = (found.records || [])[0];
    if (!contact) {
      contact = await at("POST", CONTACTS, { typecast: true, fields: {
        "Fornafn ⬅️": String(body.contact.fornafn).trim(),
        "Eftirnafn ➡️": String(body.contact.eftirnafn || "").trim(),
        "Netfang 📧": email,
        "Símanúmer ☎️": String(body.contact.simi || "").trim(),
        "Tegund tengiliðs 👥": "Einstaklingur / heimili",
        "Hvaðan kom viðskiptavinurinn 📥": sourceChoice(body.contact.source),
      } });
    }
    // 3. Tækifæri — the sid is written into the JSON here (server-side, so it is always there).
    const liSent = {};
    for (const li of body.lineItems) liSent[li["🔑"]] = sentOf(li);
    let json = JSON.stringify(Object.assign({}, body.state, { submissionId: sid, liSent }));
    const fields = pick(body.project, PROJECT_FIELDS);
    if (body.handleSkus && body.handleSkus.length) Object.assign(fields, await handleSlotFields(at, body.handleSkus));
    if (fields["Litur á höldum 🎨"] != null) fields["Litur á höldum 🎨"] = shortLabel(fields["Litur á höldum 🎨"]);
    if (json.length > PLANNER_JSON_MAX) { // Airtable's long text holds 100 000 characters: a huge multi-room drawing
      // must not lose the whole submission — keep what resuming and pro Vista need, and say so (2026-10-25)
      json = JSON.stringify({ submissionId: sid, liSent, tooLarge: json.length });
      fields["Skilaboð til skipulags"] = ((fields["Skilaboð til skipulags"] || "") + "\n⚠ Teikningin úr skipuleggjaranum var of stór til að vista hér (" + JSON.parse(json).tooLarge + " stafir) — línurnar og PDF-teikningarnar fóru samt inn.").trim();
    }
    opp = await at("POST", PROJECTS, { typecast: true, fields: Object.assign(
      fields,
      { "Tengiliður verkefnis 👤": [contact.id], [PLANNER_JSON]: json },
      PROJECT_FORCED,
    ) });
  }

  // 4. Line Items — skip the 🔑s this Tækifæri already has, create the rest 10 at a time.
  let have = new Set();
  if (resumed) have = new Set((await linesOfProject(at, opp.id, ["🔑"])).map((r) => r.fields["🔑"]));
  const todo = body.lineItems.filter((li) => !have.has(li["🔑"]));
  for (let i = 0; i < todo.length; i += 10) {
    await createLines(at, todo.slice(i, i + 10).map((li) => ({
      fields: Object.assign(pick(li, LINE_FIELDS), li["Rými 🏡"] != null ? { "Rými 🏡": shortLabel(li["Rými 🏡"]) } : {}, { [LINK_TO_PROJECT]: [opp.id] }),
    })));
  }
  return { recordId: opp.id, created: todo.length, skipped: body.lineItems.length - todo.length, resumed };
}

// A batch of Line Items. If Airtable refuses it with a 422 — almost always a linked product (Vöru reitur) that was
// deleted or replaced in Airtable since the planner was built — the batch is retried one line at a time, and a line
// that still fails goes in WITHOUT its product links plus a note saying which ids to add by hand. One stale id must
// never lose the customer's whole submission (2026-10-25). (A batch is all-or-nothing, so nothing is doubled.)
const PRODUCT_LINKS = ["Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3"];
export const PLANNER_JSON_MAX = 99000;
const LINE_KEY_RE = /^(Sk|HU|BP|BV|BH)\d{1,3}$/;             // same as api/kp-pro.js's KEY_RE
// a room / colour name goes in as a select (typecast): never rejected (a customer's own room name must not lose the
// submission), just kept short and free of control characters
export const shortLabel = (v) => String(v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
// A Tækifæri's own Line Items, found by its link field (2026-10-25) — not by the "T-227 |" prefix of its name, which
// a brand-new Tækifæri may not have yet (then a resume re-created every line and pro Vista doubled every cabinet).
export const OPP_LINES_FIELD = "fldlcBLh5sXC6VlRn"; // Tækifæri 📣 → its Line Items (inverse of LINK_TO_PROJECT)
export async function linesOfProject(at, oppId, fields) {
  const p = await at("GET", `${PROJECTS}/${oppId}?returnFieldsByFieldId=true`);
  const ids = ((p && p.fields) || {})[OPP_LINES_FIELD] || [];
  const out = [];
  for (let i = 0; i < ids.length; i += 40) {
    const formula = "OR(" + ids.slice(i, i + 40).map((id) => `RECORD_ID()='${String(id).replace(/[^A-Za-z0-9]/g, "")}'`).join(",") + ")";
    out.push(...await listAll(at, LINE_ITEMS, formula, fields));
  }
  return out;
}
export async function createLines(at, records) {
  try { return await at("POST", LINE_ITEMS, { typecast: true, records }); }
  catch (e) { if (e.status !== 422) throw e; }
  for (const r of records) {
    try { await at("POST", LINE_ITEMS, { typecast: true, records: [r] }); continue; }
    catch (e) { if (e.status !== 422) throw e; }
    const f = Object.assign({}, r.fields), dropped = [];
    for (const k of PRODUCT_LINKS) if (f[k] && [].concat(f[k]).length) { dropped.push(k + ": " + [].concat(f[k]).join(", ")); delete f[k]; }
    f["Skilaboð til skipulags"] = ((f["Skilaboð til skipulags"] || "") + "\n⚠ Vara fannst ekki í Airtable (eytt eða breytt?) — tekin af línunni, bættu við handvirkt: " + dropped.join("; ")).trim();
    await at("POST", LINE_ITEMS, { typecast: true, records: [{ fields: f }] });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN vantar" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const bad = validate(body);
  if (bad) return res.status(400).json({ error: bad });
  try {
    const out = await submit(makeAirtable(token), body);
    return res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    // 502 tells the client it is safe (and useful) to retry the same request.
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
