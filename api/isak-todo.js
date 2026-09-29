// api/isak-todo.js
// Ísak's private to-do list ("To do listinn hans Ísaks 🐻‍❄️") for the /app home tile.
// The table is deliberately NOT in api/airtable.js's ALLOWED_FIELDS — the generic proxy
// is open to anyone, so hiding a tile in the page would not keep the table private.
// Every read/write goes through here instead, and only with a token that is handed out
// after the PIN has been checked server-side against Ísak's own Starfsmenn record.
//
//   POST { pin }                                   → { token }  (401 BAD_PIN otherwise)
//   POST { action:"list" }                         → { records } (open tasks, not Lokið)
//   POST { action:"status", id, status }           → { ok }
//   POST { action:"create", task, priority?, area?, due? } → { record }
//   All but the PIN login need header X-Todo-Token.
//
// Token = HMAC(KIOSK_DEVICE_SECRET, "isak-todo:" + recordId) — stable, so the phone only
// asks for the PIN once. Rotating KIOSK_DEVICE_SECRET revokes it (along with the kiosk
// pairing and the /eigandi shortcut links).

import crypto from "node:crypto";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const TODO_TABLE = "tblvVMCn7Tz5BAI5d";
const OWNER_ID = "recIqKajYeUpwB8tU"; // Ísak Einar Ágústsson — the only person who may see this list

const F_TASK = "Verkefni / Task";
const F_STATUS = "Status";
const F_PRIORITY = "Forgangsröðun";
const F_AREA = "Hluti reksturins";
const F_DESC = "Lýsing";
const F_DUE = "Skiladagur (Delivery Date)";
const FIELDS = [F_TASK, F_STATUS, F_PRIORITY, F_AREA, F_DESC, F_DUE];

const STATUSES = ["Nýtt ✨", "Í vinnslu ⚙️", "Í bið 🧊", "Lokið ✅"];
const PRIORITIES = ["TOPP 3", "Núna 🧨", "Í vinnslu en í bið ⚙️", "Við tækifæri 🏃‍♂️‍➡️", "Skoða síðar 🧊"];
const AREAS = ["Almennur rekstur ⚙️", "Airtable / Kerfi 🏓", "Bestun 📈", "Framleiðsla 🛠️", "Upplifun viðskiptavina 😁", "Verkefnistengt 🧾", "Heimasíða 🌐", "Markaðssetning 📸"];

const tokenFor = (secret) => crypto.createHmac("sha256", secret).update("isak-todo:" + OWNER_ID).digest("hex").slice(0, 40);
function tokenOk(secret, given) {
  const a = Buffer.from(tokenFor(secret));
  const b = Buffer.from(String(given || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function at(token, method, path, body) {
  const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`.replace(/\+/g, "%20"), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}
const slim = (rec) => {
  const fields = {};
  for (const f of FIELDS) if (f in rec.fields) fields[f] = rec.fields[f];
  return { id: rec.id, fields };
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const airtableToken = process.env.AIRTABLE_TOKEN;
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!airtableToken || !secret) return res.status(500).json({ error: "Server not configured" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const q = req.body || {};

  // ---- PIN login ----
  if (q.pin != null) {
    const pin = String(q.pin).replace(/\D/g, "");
    if (pin.length < 3) return res.status(400).json({ error: "BAD_PIN" });
    const { ok, data } = await at(airtableToken, "GET",
      `${STARFSMENN_TABLE}?filterByFormula=${encodeURIComponent(`AND({PIN 🔢}=${pin},{Er starfandi? ✅}=1)`)}&maxRecords=1&fields[]=${encodeURIComponent("PIN 🔢")}`);
    if (!ok) return res.status(502).json({ error: "LOOKUP_FAILED" });
    const rec = (data.records || [])[0];
    if (!rec || rec.id !== OWNER_ID) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return res.status(401).json({ error: "BAD_PIN" });
    }
    return res.status(200).json({ token: tokenFor(secret) });
  }

  if (!tokenOk(secret, req.headers["x-todo-token"])) return res.status(401).json({ error: "BAD_TOKEN" });

  if (q.action === "list") {
    const records = [];
    let offset = "";
    do {
      const params = [`filterByFormula=${encodeURIComponent(`{${F_STATUS}}!="Lokið ✅"`)}`, "pageSize=100"]
        .concat(FIELDS.map((f) => `fields[]=${encodeURIComponent(f)}`));
      if (offset) params.push(`offset=${encodeURIComponent(offset)}`);
      const { ok, data } = await at(airtableToken, "GET", `${TODO_TABLE}?${params.join("&")}`);
      if (!ok) return res.status(502).json({ error: "READ_FAILED" });
      records.push(...(data.records || []).map(slim));
      offset = data.offset || "";
    } while (offset);
    return res.status(200).json({ records, statuses: STATUSES, priorities: PRIORITIES, areas: AREAS });
  }

  if (q.action === "status") {
    const id = String(q.id || "");
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return res.status(400).json({ error: "BAD_ID" });
    if (!STATUSES.includes(q.status)) return res.status(400).json({ error: "BAD_STATUS" });
    const { ok } = await at(airtableToken, "PATCH", `${TODO_TABLE}/${id}`, { fields: { [F_STATUS]: q.status } });
    return ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: "WRITE_FAILED" });
  }

  if (q.action === "create") {
    const task = String(q.task || "").trim().slice(0, 300);
    if (!task) return res.status(400).json({ error: "MISSING_TASK" });
    const fields = { [F_TASK]: task, [F_STATUS]: "Nýtt ✨" };
    if (PRIORITIES.includes(q.priority)) fields[F_PRIORITY] = q.priority;
    if (AREAS.includes(q.area)) fields[F_AREA] = q.area;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.due || ""))) fields[F_DUE] = q.due;
    const { ok, data } = await at(airtableToken, "POST", TODO_TABLE, { fields });
    return ok ? res.status(200).json({ record: slim(data) }) : res.status(502).json({ error: "WRITE_FAILED" });
  }

  return res.status(400).json({ error: "BAD_ACTION" });
}
