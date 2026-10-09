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

// What the client may set (everything else is dropped silently, like the proxy's CREATABLE_FIELDS).
export const PROJECT_FIELDS = ["Skrokka efni 🔲 viðskiptavinar", "Fronta efni viðskiptavinar 🖼️", "Borðplata viðskiptavinar 🍽️", "Skilaboð til skipulags",
  "Höldur Viðskiptavinar ✊", "Litur á höldum 🎨", "Magn Halda 1"];
export const LINE_FIELDS = ["Rými 🏡", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3", "Magn", "🔑", "Skilaboð til skipulags", "Smíðagögn (JSON) 🔧"];
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
  return out;
};
const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// One Airtable call with retries. 429 = Airtable's 5 req/s per base limit (it asks for a pause);
// 5xx and network errors are usually momentary. 4xx other than 429 are real errors — no retry.
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
      } catch (e) { lastErr = e; continue; }
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      lastErr = Object.assign(new Error(`Airtable ${r.status}: ${JSON.stringify(data).slice(0, 300)}`), { status: r.status });
      if (r.status !== 429 && r.status < 500) throw lastErr;
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

// Every field name this endpoint uses, per table (api/field-check.js checks them daily).
export function fieldDeps() {
  return {
    [CONTACTS]: new Set(["Fornafn ⬅️", "Eftirnafn ➡️", "Netfang 📧", "Símanúmer ☎️", "Tegund tengiliðs 👥", "Hvaðan kom viðskiptavinurinn 📥"]),
    [PROJECTS]: new Set([...PROJECT_FIELDS, ...Object.keys(PROJECT_FORCED), "Tengiliður verkefnis 👤", PLANNER_JSON, PROJECT_NAME, "Teikningar úr skipuleggjara 📐"]),
    [LINE_ITEMS]: new Set([...LINE_FIELDS, LINK_TO_PROJECT]),
  };
}

export function validate(body) {
  const b = body || {};
  if (!SID_RE.test(String(b.sid || ""))) return "Ógilt sid";
  const c = b.contact || {};
  if (!String(c.fornafn || "").trim()) return "Nafn vantar";
  if (!EMAIL_RE.test(String(c.netfang || "").trim())) return "Ógilt netfang";
  if (typeof b.state !== "object" || !b.state) return "Skipulag vantar";
  const bad = validateLineItems(b.lineItems);
  if (bad) return bad;
  for (const v of [b.project?.["Skrokka efni 🔲 viðskiptavinar"], b.project?.["Fronta efni viðskiptavinar 🖼️"], b.project?.["Borðplata viðskiptavinar 🍽️"], b.project?.["Höldur Viðskiptavinar ✊"]]) {
    if (v != null && !(Array.isArray(v) && v.every((x) => REC_RE.test(x)))) return "Ógild tenging";
  }
  return null;
}

// Line Items as the designer sends them — also checked by api/kp-pro.js (pro Vista creates the missing ones).
export function validateLineItems(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length > MAX_LINES) return "Ógildar línur";
  const keys = new Set();
  for (const li of lineItems) {
    if (!li || !String(li["🔑"] || "")) return "Lína án 🔑";
    if (keys.has(li["🔑"])) return "Tvítekinn 🔑";
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
        "Hvaðan kom viðskiptavinurinn 📥": "Vefsíða",
      } });
    }
    // 3. Tækifæri — the sid is written into the JSON here (server-side, so it is always there).
    const json = JSON.stringify(Object.assign({}, body.state, { submissionId: sid }));
    opp = await at("POST", PROJECTS, { typecast: true, fields: Object.assign(
      pick(body.project, PROJECT_FIELDS),
      { "Tengiliður verkefnis 👤": [contact.id], [PLANNER_JSON]: json },
      PROJECT_FORCED,
    ) });
  }

  // 4. Line Items — skip the 🔑s this Tækifæri already has, create the rest 10 at a time.
  let have = new Set();
  if (resumed) {
    const name = String((opp.fields || {})[PROJECT_NAME] || "");
    const prefix = name.split("|")[0].trim();           // "T-227"
    if (prefix) {
      const rows = await listAll(at, LINE_ITEMS,
        `FIND("${q(prefix)} |",ARRAYJOIN({${LINK_TO_PROJECT}}))`, ["🔑", LINK_TO_PROJECT]);
      have = new Set(rows.filter((r) => (r.fields[LINK_TO_PROJECT] || []).includes(opp.id)).map((r) => r.fields["🔑"]));
    }
  }
  const todo = body.lineItems.filter((li) => !have.has(li["🔑"]));
  for (let i = 0; i < todo.length; i += 10) {
    await at("POST", LINE_ITEMS, { typecast: true, records: todo.slice(i, i + 10).map((li) => ({
      fields: Object.assign(pick(li, LINE_FIELDS), { [LINK_TO_PROJECT]: [opp.id] }),
    })) });
  }
  return { recordId: opp.id, created: todo.length, skipped: body.lineItems.length - todo.length, resumed };
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
