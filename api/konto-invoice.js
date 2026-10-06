// api/konto-invoice.js
// Fjárhagsáfangi 4 — drafts (never sent/booked) invoices in Konto from a Tækifæri.
//
// POST /api/konto-invoice   header x-webhook-secret: <WEBHOOK_SECRET>
//   body { recordId, payment: "G1" | "G2" | "LOK" | "UPPGJOR" | "preview" }
//
// When each one is drafted (Airtable automations / button):
//   G1       button "🧾 Drög að greiðslu 1" — before the deal is marked won
//            (the customer pays first). p1 of the quote + 50 % of uppsetning.
//   G2       Staða í skipulagi → Klárt til framleiðslu, 40–30–30 only: 30 %.
//   LOK      Staða í framleiðslu → Má afhenda: the last innréttinga share
//            (50 % / 30 %) + every approved viðbót. On 100 % only if viðbætur exist.
//   UPPGJOR  Staða í framleiðslu → Afhent: the other 50 % of uppsetning +
//            heimsending. Skipped when there is neither.
//   preview  🧪 dry run: computes every invoice above, checks the Konto login and
//            looks the customer up — creates NOTHING — and writes the result to
//            "Konto drög 🧾" so it can be read back.
//
// Every created draft is logged as a line in "Konto drög 🧾" ("… · G1 · drög <guid> …");
// a payment already logged there is refused, so nothing is ever drafted twice.
// Gjalddagi = 3 virkir dagar, eindagi = 5 virkir dagar (helgar + Frídagar 📅 skipped),
// krafa í banka (is_claim) on every draft.
//
// Env: AIRTABLE_TOKEN, WEBHOOK_SECRET, KONTO_USERNAME, KONTO_API_KEY.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const PROJECTS_TABLE = "tbl4LMXlQjp66RFKI";
const CONTACTS_TABLE = "tblQ8zeUanriESWvL";
const HOLIDAYS_TABLE = "tblXoWJacAvfrXgty";
const KONTO = "https://konto.is/api/v1";

const P = {
  name: "Heiti tækifæris / verkefnis",
  split: "Skipting greiðslu",
  live: "💰 Tilboðsupphæð",
  confirmed: "Staðfest tilboðsupphæð 🔒",
  installOn: "Uppsetning Bjarnarins 🪛🐻",
  install: "Uppsetningarverð Verkefnis",
  delivery: "heimsendingaverð",
  trips: "Fjöldi ferða 🚚",
  addInnr: "Samþykktar viðbætur innréttinga 🔒",
  addUpps: "Samþykktar viðbætur uppsetningar 🔒",
  contact: "Tengiliður verkefnis 👤",
  log: "Konto drög 🧾",
};
const C = { name: "Fullt nafn 👤", kt: "Kennitala 👤#️⃣", email: "Netfang 📧", address: "Heimilisfang 🏡" };

const SPLITS = { "100%": [1], "50% - 50%": [0.5, 0.5], "40% - 30% - 30%": [0.4, 0.3, 0.3] };

// ── pure helpers (exported for tests) ─────────────────────────────────────────

export function num(v) {
  const n = parseFloat(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
}

export function isk(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr.";
}

// n working days after `from` (YYYY-MM-DD out), skipping weekends and full holidays.
export function addWorkdays(from, n, holidays = new Set()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !holidays.has(iso)) added++;
  }
  return d.toISOString().slice(0, 10);
}

function line(description, amountInclVat) {
  return { description, amountInclVat: Math.round(amountInclVat) };
}

// Which invoice lines a payment gets. Returns { lines, skip } — skip = a reason
// nothing should be drafted (not an error: e.g. G2 on a 50/50 project).
export function invoiceLines(project, payment) {
  const split = String(project[P.split] || "");
  const pct = SPLITS[split];
  if (!pct) return { lines: [], skip: `Skipting greiðslu vantar eða er óþekkt („${split}“)` };

  const name = String(project[P.name] || "").trim();
  const n = pct.length;
  const confirmed = num(project[P.confirmed]);
  const base = confirmed || num(project[P.live]);
  const installOn = !!project[P.installOn];
  const install = installOn ? num(project[P.install]) : 0;
  const addInnr = num(project[P.addInnr]);
  const addUpps = num(project[P.addUpps]);
  const delivery = num(project[P.delivery]);
  const pctLabel = (i) => `${Math.round(pct[i] * 100)}%`;
  const lines = [];

  if (payment === "G1") {
    lines.push(line(`Greiðsla 1 af ${n} (${pctLabel(0)}) — innréttingar · ${name}`, base * pct[0]));
    if (install > 0) lines.push(line("Uppsetning — 50% við staðfestingu", install * 0.5));
  } else if (payment === "G2") {
    if (n !== 3) return { lines: [], skip: `Greiðsla 2 á aðeins við 40–30–30 (verkið er ${split})` };
    lines.push(line(`Greiðsla 2 af 3 (${pctLabel(1)}) — innréttingar · ${name}`, base * pct[1]));
  } else if (payment === "LOK") {
    if (n > 1) lines.push(line(`Lokagreiðsla ${n} af ${n} (${pctLabel(n - 1)}) — innréttingar · ${name}`, base * pct[n - 1]));
    if (addInnr > 0) lines.push(line("Viðbætur skv. viðbótartilboði — innréttingar", addInnr));
    if (addUpps > 0) lines.push(line("Viðbætur skv. viðbótartilboði — uppsetning", addUpps));
    if (!lines.length) return { lines, skip: "100% greitt við staðfestingu og engar samþykktar viðbætur" };
  } else if (payment === "UPPGJOR") {
    if (install > 0) lines.push(line("Uppsetning — eftirstöðvar (50%)", install * 0.5));
    if (delivery > 0) lines.push(line(`Heimsending — ${String(project[P.trips] || "").replace(/[^\p{L}\p{N} ]/gu, "").trim()}`, delivery));
    if (!lines.length) return { lines, skip: "Hvorki uppsetning né heimsending á verkinu" };
  } else {
    return { lines: [], skip: `Óþekkt greiðsla „${payment}“` };
  }
  return { lines: lines.filter((l) => l.amountInclVat > 0) };
}

export function alreadyDrafted(log, payment) {
  return String(log || "").split("\n").some((l) => l.includes(`· ${payment} · drög`));
}

// Konto validates the customer on the draft itself: {guid} alone → "Vinsamlegast skrá
// rétta kennitölu", {guid, registration_no} → "Name is required". So send the full details.
export function kontoDraft({ customerGuid, contact, description, lines, today, holidays }) {
  return {
    customer: {
      guid: customerGuid,
      name: contact.name,
      registration_no: contact.kennitala,
      email: contact.email || "",
      address: contact.address || "",
      currency: "ISK",
      lang: "is",
    },
    kennitala: contact.kennitala,
    currency: "ISK",
    description,
    amount: lines.reduce((s, l) => s + l.amountInclVat, 0),
    due_date: addWorkdays(today, 3, holidays),
    settlement_date: addWorkdays(today, 5, holidays),
    is_claim: true,
    items: lines.map((l, i) => ({
      item_number: String(i + 1),
      description: l.description,
      qty: 1,
      uom: "C62",
      tax: "S",
      unit_price: Math.round((l.amountInclVat / 1.24) * 100) / 100,
    })),
  };
}

// ── Airtable / Konto I/O ──────────────────────────────────────────────────────

async function at(path, opts = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function holidaySet() {
  const out = new Set();
  let offset;
  do {
    const q = new URLSearchParams({ "fields[]": "Dagsetning", pageSize: "100" });
    if (offset) q.set("offset", offset);
    const j = await at(`${HOLIDAYS_TABLE}?${q}`);
    // Half days (aðfangadagur / gamlársdagur) count as non-working too — banks are closed.
    for (const r of j.records) {
      if (r.fields.Dagsetning) out.add(String(r.fields.Dagsetning).slice(0, 10));
    }
    offset = j.offset;
  } while (offset);
  return out;
}

function kontoAuth() {
  const u = process.env.KONTO_USERNAME, k = process.env.KONTO_API_KEY;
  if (!u || !k) throw new Error("KONTO_USERNAME / KONTO_API_KEY vantar í Vercel");
  return { u, k, header: "Basic " + Buffer.from(`${u}:${k}`).toString("base64") };
}

async function kontoGet(path, params = {}) {
  const { header } = kontoAuth();
  const res = await fetch(`${KONTO}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: header } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`Konto ${path} ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

async function kontoPost(path, data) {
  const { u, k, header } = kontoAuth();
  const res = await fetch(`${KONTO}/${path}`, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: u, api_key: k, data: JSON.stringify(data) }),
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok || (body && body.status === false)) throw new Error(`Konto ${path} ${res.status}: ${text.slice(0, 500)}`);
  return body;
}

async function appendLog(recordId, project, entry) {
  const prev = String(project[P.log] || "").trim();
  await at(`${PROJECTS_TABLE}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { [P.log]: (prev ? prev + "\n" : "") + entry } }),
  });
}

async function loadContact(project) {
  const id = (project[P.contact] || [])[0];
  if (!id) throw new Error("Tengiliður verkefnis vantar á verkið");
  const c = (await at(`${CONTACTS_TABLE}/${id}`)).fields;
  const kennitala = String(c[C.kt] || "").replace(/\D/g, "");
  if (kennitala.length !== 10) throw new Error(`Kennitala tengiliðs vantar eða er ógild („${c[C.kt] || ""}“)`);
  return { name: String(c[C.name] || "").trim(), kennitala, email: c[C.email] || "", address: c[C.address] || "" };
}

function customersFrom(body) {
  const r = body && (body.result ?? body.data ?? body);
  return Array.isArray(r) ? r : [];
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.WEBHOOK_SECRET || req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const recordId = String((req.body || {}).recordId || "").trim();
  const payment = String((req.body || {}).payment || "").trim();
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return res.status(400).json({ error: "Ógilt recordId" });

  const today = new Date();
  const stamp = today.toISOString().slice(0, 10);
  let project;
  try {
    project = (await at(`${PROJECTS_TABLE}/${recordId}`)).fields;
  } catch (e) {
    return res.status(404).json({ error: "Tækifæri fannst ekki" });
  }

  try {
    const holidays = await holidaySet();

    if (payment === "preview") {
      const out = [`🧪 PRUFA ${stamp} — ekkert búið til í Konto`];
      try {
        const hello = await kontoGet("hello", { username: process.env.KONTO_USERNAME || "", api_key: process.env.KONTO_API_KEY || "" });
        out.push(typeof hello === "object" && hello
          ? `Konto aðgangur: ${hello.status ? "✅" : "❌"} ${hello.message || ""} (${hello.name || "?"})`
          : `Konto aðgangur: ${String(hello).slice(0, 120)}`);
      } catch (e) { out.push(`Konto aðgangur: ❌ ${e.message}`); }
      let contact;
      try {
        contact = await loadContact(project);
        const found = customersFrom(await kontoGet("get-customers-by-kennitala", { kennitala: contact.kennitala }));
        out.push(`Viðskiptavinur: ${contact.name} (${contact.kennitala}) — ${found.length ? `til í Konto (${found[0].name})` : "ekki til, yrði stofnaður"}`);
      } catch (e) { out.push(`Viðskiptavinur: ❌ ${e.message}`); }
      out.push(`Gjalddagi ${addWorkdays(today, 3, holidays)} · eindagi ${addWorkdays(today, 5, holidays)} · krafa í banka`);
      for (const p of ["G1", "G2", "LOK", "UPPGJOR"]) {
        const { lines, skip } = invoiceLines(project, p);
        if (skip) { out.push(`${p}: sleppt — ${skip}`); continue; }
        const total = lines.reduce((s, l) => s + l.amountInclVat, 0);
        out.push(`${p}: ${isk(total)} m. vsk${alreadyDrafted(project[P.log], p) ? " (⚠️ þegar til í Konto)" : ""}`);
        for (const l of lines) out.push(`   · ${l.description}: ${isk(l.amountInclVat)}`);
      }
      await appendLog(recordId, project, out.join("\n"));
      return res.status(200).json({ ok: true, preview: out });
    }

    if (alreadyDrafted(project[P.log], payment)) {
      return res.status(409).json({ error: `${payment} er þegar til sem drög í Konto (sjá Konto drög 🧾)` });
    }
    const { lines, skip } = invoiceLines(project, payment);
    if (skip) return res.status(200).json({ ok: true, skipped: skip });

    const contact = await loadContact(project);
    const found = customersFrom(await kontoGet("get-customers-by-kennitala", { kennitala: contact.kennitala }));
    let customerGuid = found[0] && found[0].guid;
    if (!customerGuid) {
      const created = await kontoPost("create-customer", {
        name: contact.name, registration_no: contact.kennitala, email: contact.email,
        address: contact.address, currency: "ISK", lang: "is",
      });
      customerGuid = typeof created.result === "string" ? created.result : created.result?.guid;
      if (!customerGuid) throw new Error(`Konto skilaði ekki auðkenni nýs viðskiptavinar: ${JSON.stringify(created).slice(0, 200)}`);
    }
    const draft = kontoDraft({
      customerGuid,
      contact,
      description: String(project[P.name] || "").trim(),
      lines, today, holidays,
    });
    // Konto's docs are vague about where the bill-to kennitala goes on a draft
    // (first try → "Vinsamlegast skrá rétta kennitölu"). Try the plausible shapes
    // in order and stop at the first one Konto accepts — a rejected attempt
    // creates nothing, so at most one draft is ever made. The winner is logged
    // so the code can be narrowed to it later.
    const variants = [
      ["full-customer", (d) => d],
      ["full-customer-no-top-kt", (d) => { const { kennitala, ...rest } = d; return rest; }],
    ];
    let result, used;
    const tried = [];
    for (const [label, shape] of variants) {
      try {
        result = await kontoPost("create-draft-invoice", shape(draft));
        used = label;
        break;
      } catch (e) {
        tried.push(`${label}: ${e.message.replace(/^Konto create-draft-invoice \d+: /, "")}`);
        if (!/kennit/i.test(e.message)) break; // a different complaint — stop and report it (a different variant won't fix it)
      }
    }
    if (!result) throw new Error(`Konto hafnaði drögum — ${tried.join(" | ")}`);
    const guid = (result && (result.guid || result.result?.guid || result.result)) || "?";
    console.log(`konto-invoice: draft accepted with shape "${used}"`);
    await appendLog(recordId, project, `${stamp} · ${payment} · drög ${typeof guid === "string" ? guid : JSON.stringify(guid)} · ${isk(draft.amount)} · (${used})`);
    return res.status(200).json({ ok: true, payment, amount: draft.amount, guid });
  } catch (e) {
    console.error("konto-invoice:", e);
    try { await appendLog(recordId, project, `${stamp} · ${payment} · ❌ ${e.message}`); } catch {}
    return res.status(500).json({ error: e.message });
  }
}
