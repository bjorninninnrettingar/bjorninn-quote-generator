// api/staff-new-project.js
// CRM's "+ Nýtt verkefni" (2026-10-18) — staff creates a bare Tækifæri for a picked existing contact or
// a freshly typed one. Mirrors kp-submit.js's direct-Airtable + retry pattern (same base, same CONTACTS/
// PROJECTS tables) but deliberately does NOT set "Sjálfsafgreiðsla — óyfirfarið ⚠️" — that flag means
// "unreviewed self-serve input"; a project staff create directly was never self-serve, so it doesn't
// need the review queue. VERK_KEY-gated (not public like kp-submit.js) since this is an internal action
// reachable only from the PIN-gated /crm page.
//
// POST { k, contactId? , contact?: { fornafn, eftirnafn, simi, netfang } } -> { ok, recordId }
// Exactly one of contactId / contact must be given — contactId reuses a contact the staff member found
// via the search box; contact creates a new one.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const CONTACTS = "tblQ8zeUanriESWvL"; // Tengiliðir
const PROJECTS = "tbl4LMXlQjp66RFKI"; // Tækifæri 📣 (projects)
const EMAIL_RE = /^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/;
const REC_RE = /^rec[A-Za-z0-9]{14}$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeAirtable(token) {
  const delays = [500, 1500, 3000];
  return async function at(method, path, body) {
    let lastErr;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt) await sleep(delays[attempt - 1]);
      let r;
      try {
        r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`, {
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.AIRTABLE_TOKEN;
  const verkKey = process.env.VERK_KEY;
  if (!token || !verkKey) return res.status(500).json({ error: "Server not configured" });

  const q = req.query || {};
  if (!verkKey || q.k !== verkKey) return res.status(403).json({ error: "Invalid key" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Bad body" });

  const at = makeAirtable(token);
  try {
    let contactId = body.contactId;
    if (contactId != null) {
      if (!REC_RE.test(String(contactId))) return res.status(400).json({ error: "Ógilt contactId" });
    } else {
      const c = body.contact || {};
      const fornafn = String(c.fornafn || "").trim();
      if (!fornafn) return res.status(400).json({ error: "Nafn vantar" });
      const netfang = String(c.netfang || "").trim();
      if (netfang && !EMAIL_RE.test(netfang)) return res.status(400).json({ error: "Ógilt netfang" });
      const created = await at("POST", CONTACTS, { typecast: true, fields: {
        "Fornafn ⬅️": fornafn,
        "Eftirnafn ➡️": String(c.eftirnafn || "").trim(),
        "Netfang 📧": netfang,
        "Símanúmer ☎️": String(c.simi || "").trim(),
        "Tegund tengiliðs 👥": "Einstaklingur / heimili",
      } });
      contactId = created.id;
    }

    const proj = await at("POST", PROJECTS, { typecast: true, fields: {
      "Tengiliður verkefnis 👤": [contactId],
      "Staða í söluferli": "Hönnun & Ráðgjöf 🖊️✨",
      "Staða í skipulagi": "For-skipulag",
    } });
    return res.status(200).json({ ok: true, recordId: proj.id });
  } catch (e) {
    return res.status(e.status && e.status < 500 && e.status !== 429 ? 400 : 502).json({ error: e.message });
  }
}
